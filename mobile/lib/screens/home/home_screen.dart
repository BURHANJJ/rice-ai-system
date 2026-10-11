import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import '../../services/auth_provider.dart';
import '../../services/navigation_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';

import 'widgets/home_header.dart';
import 'widgets/home_hero_card.dart';
import 'widgets/home_quick_actions.dart';
import 'widgets/home_outbreak_section.dart';
import 'widgets/home_fields_section.dart';
import 'widgets/home_history_section.dart';
import 'widgets/home_ricey_tip.dart';
import '../../services/location_helper.dart';
import '../../services/notification_service.dart';
import '../../services/weather_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _locationName = 'ค้นหาตำแหน่ง...';
  String _temperature = '--°C';
  String _humidity = '--%';
  int _scanCount = 0;
  bool _isLocationError = false;
  bool _hasLocalRisk = false;
  WeatherSnapshot? _weather;

  @override
  void initState() {
    super.initState();
    _determinePosition();
  }

  Future<void> _fetchScanCount() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final qs = await FirebaseFirestore.instance.collection('diagnoses').where('user_id', isEqualTo: user.uid).get();
        if (mounted) {
          setState(() {
            _scanCount = qs.docs.length;
          });
        }
      }
    } catch (e) {
      debugPrint('Firestore history count failed: $e');
    }
  }

  Future<void> _determinePosition() async {
    // 1. Always fetch scan count independently
    _fetchScanCount();

    // 2. Fetch Location and Weather
    try {
      setState(() {
        _isLocationError = false;
        _locationName = 'กำลังระบุพิกัด...';
      });

      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _locationName = 'ปิดตำแหน่ง GPS อยู่';
          _isLocationError = true;
        });
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() {
            _locationName = 'ไม่ได้รับอนุญาต GPS';
            _isLocationError = true;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _locationName = 'ถูกบล็อกสิทธิ์ GPS';
          _isLocationError = true;
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition();

      try {
        final address = await LocationHelper.getThaiAddress(position);
        // remember the user's area so province broadcasts reach them (any role)
        NotificationService.instance.updateArea(address);

        // Extract province and check local risk
        bool foundRisk = false;
        final match = RegExp(r'จ\.(\S+)').firstMatch(address);
        if (match != null) {
          final prov = match.group(1);
          if (prov != null && prov.isNotEmpty) {
            // Firestore doesn't support substring search, and location.province currently stores full address
            final qs = await FirebaseFirestore.instance
                .collection('diagnoses')
                .where('disease_code', isNotEqualTo: 'HEALTHY')
                .get();
            foundRisk = qs.docs.any((d) {
              final dbLoc = d.data()['location']?['province'] as String? ?? '';
              return dbLoc.contains(prov);
            });
          }
        }

        setState(() {
          _locationName = address;
          _isLocationError = false;
          _hasLocalRisk = foundRisk;
        });
      } catch (e) {
        debugPrint('Reverse geocoding failed: $e');
        setState(() {
          _locationName = 'พิกัดปัจจุบัน';
          _isLocationError = false;
        });
      }

      // Fetch real weather (current + next hours) from Open-Meteo
      final weather = await WeatherService.fetch(position.latitude, position.longitude);
      if (weather != null && mounted) {
        setState(() {
          _weather = weather;
          _temperature = '${weather.temperature.round()}°C';
          _humidity = '${weather.humidity}%';
        });
      }
    } catch (e) {
      setState(() {
        _locationName = 'ระบุพิกัดไม่ได้';
        _isLocationError = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final nav = context.read<NavigationProvider>();
    final user = auth.user;
    final p = context.pal;

    return Scaffold(
      backgroundColor: p.bg,
      body: RefreshIndicator(
        onRefresh: _determinePosition,
        color: p.primary,
        backgroundColor: p.surface,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 12, 20, 130),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FadeSlideIn(child: HomeHeader(user: user)),
              const SizedBox(height: 20),
              FadeSlideIn(
                delay: const Duration(milliseconds: 80),
                child: GestureDetector(
                  onTap: () {
                    // Demo toggle for presentation
                    setState(() {
                      _hasLocalRisk = !_hasLocalRisk;
                    });
                  },
                  child: HomeHeroCard(
                    userName: user?.fullName.split(' ').first ?? 'ชาวนา',
                    locationName: _locationName,
                    temperature: _temperature,
                    humidity: _humidity,
                    scanCount: _scanCount,
                    isLocationError: _isLocationError,
                    hasLocalRisk: _hasLocalRisk,
                    weather: _weather,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FadeSlideIn(delay: const Duration(milliseconds: 160), child: HomeQuickActions(nav: nav)),
              const SizedBox(height: 22),
              const FadeSlideIn(delay: Duration(milliseconds: 180), child: HomeRiceyTip()),
              const SizedBox(height: 26),
              if (user?.settings['show_fields'] ?? true) ...[
                const FadeSlideIn(delay: Duration(milliseconds: 200), child: HomeFieldsSection()),
                const SizedBox(height: 28),
              ],
              FadeSlideIn(delay: const Duration(milliseconds: 240), child: HomeOutbreakSection(nav: nav)),
              const SizedBox(height: 28),
              const FadeSlideIn(delay: Duration(milliseconds: 320), child: HomeHistorySection()),
            ],
          ),
        ),
      ),
    );
  }
}
