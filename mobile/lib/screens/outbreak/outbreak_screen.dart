import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:remixicon/remixicon.dart';

import '../../data/thai_provinces.dart';
import '../../models/diagnosis.dart';
import '../../services/location_helper.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import 'outbreak_map.dart';

class OutbreakScreen extends StatefulWidget {
  const OutbreakScreen({super.key});
  @override
  State<OutbreakScreen> createState() => _OutbreakScreenState();
}

class RawScan {
  final double? lat;
  final double? lng;
  final String diseaseCode;
  final String diseaseName;
  final String? locationText;
  final DateTime? date;
  RawScan(this.lat, this.lng, this.diseaseCode, {this.diseaseName = '', this.locationText, this.date});

  bool get hasCoords => lat != null && lng != null;
  bool get isDisease => diseaseCode != 'HEALTHY';
}

/// Risk band for a province, shared by list, map and sheet.
(Tone, String) _riskOf(ProvinceStat p) {
  if (p.riskLevel.toUpperCase() == 'HIGH' || p.totalCases >= 5) return (Tone.danger, 'เสี่ยงสูง');
  if (p.riskLevel.toUpperCase() == 'MEDIUM' || (p.totalCases >= 2 && p.totalCases < 5)) return (Tone.warn, 'เฝ้าระวัง');
  return (Tone.safe, 'ปลอดภัย');
}

class _OutbreakScreenState extends State<OutbreakScreen> {
  List<ProvinceStat> _provinces = [];
  List<RawScan> _rawScans = [];
  bool _isLoading = true;
  bool _isMapView = false;

  // Location
  String _currentLocation = 'กำลังระบุพิกัด...';
  String _currentRegion = '';
  String _currentLatLon = '--, --';

  StreamSubscription? _scanSub;

  // Filters
  String _searchQuery = '';
  String _selectedRegion = 'ทั้งหมด';
  final List<String> _regions = ['ทั้งหมด', 'กลาง', 'เหนือ', 'อีสาน', 'ใต้'];

  @override
  void initState() {
    super.initState();
    _setupRealtimeListener();
    _determineLocation();
  }

  @override
  void dispose() {
    _scanSub?.cancel();
    super.dispose();
  }

  Future<void> _setupRealtimeListener() async {
    try {
      // 1. Get base 77 provinces list from local data
      List<ProvinceStat> baseProvinces = ThaiProvinces.getBaseProvinces();

      // 2. Listen to real scan data from Firestore (diagnoses collection)
      _scanSub = FirebaseFirestore.instance.collection('diagnoses').snapshots().listen((snapshot) {
        // 3. Aggregate real cases by province and save raw scans
        Map<String, int> realCases = {};
        Map<String, Map<String, int>> diseaseCounts = {}; // province -> disease -> count
        List<RawScan> scansList = [];

        for (var doc in snapshot.docs) {
          final scan = doc.data();

          // Extract raw scan for map
          // Keep every located scan (coords and/or address) for the map.
          if (scan['location'] != null) {
            final loc = scan['location'];
            scansList.add(RawScan(
              (loc['latitude'] as num?)?.toDouble(),
              (loc['longitude'] as num?)?.toDouble(),
              scan['disease_code'] as String? ?? 'HEALTHY',
              diseaseName: scan['disease_name'] as String? ?? '',
              locationText: loc['province'] as String?,
              date: scan['diag_date'] is Timestamp ? (scan['diag_date'] as Timestamp).toDate() : null,
            ));
          }

          if (scan['location'] != null && scan['location']['province'] != null) {
            String fullLoc = scan['location']['province'] as String;

            String prov = '';
            for (var bp in baseProvinces) {
              if (fullLoc.contains(bp.province)) {
                prov = bp.province;
                break;
              }
            }
            if (prov.isEmpty) {
              prov = _extractProvinceName(fullLoc);
            }

            if (prov.isNotEmpty) {
              // Only count non-healthy diagnoses as outbreak cases
              final diseaseCode = scan['disease_code'] as String? ?? '';
              if (diseaseCode != 'HEALTHY') {
                realCases[prov] = (realCases[prov] ?? 0) + 1;

                // Track diseases for _dominantDisease
                String disease = scan['disease_name'] as String? ?? 'Unknown';
                diseaseCounts[prov] ??= {};
                diseaseCounts[prov]![disease] = (diseaseCounts[prov]![disease] ?? 0) + 1;
              }
            }
          }
        }

        // 4. Merge real data into base provinces
        List<ProvinceStat> realProvinces = baseProvinces.map((p) {
          int cases = realCases[p.province] ?? 0;

          // Calculate risk level based on real cases (เกณฑ์กรมการข้าว)
          String risk = 'SAFE';
          if (cases >= 5) {
            risk = 'HIGH';
          } else if (cases >= 2) {
            risk = 'MEDIUM';
          }

          return ProvinceStat(
            province: p.province,
            region: p.region,
            totalCases: cases,
            riskLevel: risk,
            latitude: p.latitude,
            longitude: p.longitude,
          );
        }).toList();

        if (mounted) {
          setState(() {
            _provinces = realProvinces;
            _rawScans = scansList;
            _isLoading = false;
          });
        }
      });
    } catch (e) {
      debugPrint('Error setting up outbreak listener: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _extractProvinceName(String fullLocation) {
    final parts = fullLocation.split(' ');
    final pPart = parts.where((p) => p.startsWith('จ.') || p.startsWith('กรุงเทพ')).toList();
    if (pPart.isNotEmpty) {
      return pPart.first.replaceFirst('จ.', '');
    }
    return fullLocation.replaceFirst('จ.', '');
  }

  Future<void> _determineLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _currentLocation = 'ปิด GPS อยู่');
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() => _currentLocation = 'ไม่ได้รับอนุญาต GPS');
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() => _currentLocation = 'ถูกบล็อกสิทธิ์ GPS');
        return;
      }

      final pos = await Geolocator.getCurrentPosition();
      setState(() {
        _currentLatLon = '${pos.latitude.toStringAsFixed(3)}°N, ${pos.longitude.toStringAsFixed(3)}°E';
      });
      final address = await LocationHelper.getThaiAddress(pos);

      String prov = address;
      final parts = address.split(' ');
      final pPart = parts.where((p) => p.startsWith('จ.') || p.startsWith('กรุงเทพ')).toList();
      if (pPart.isNotEmpty) {
        prov = pPart.first;
      } else if (parts.isNotEmpty) {
        prov = parts.last;
      }

      setState(() {
        _currentLocation = prov;
        _currentRegion = 'ประเทศไทย';
      });
    } catch (e) {
      setState(() => _currentLocation = 'พิกัดปัจจุบัน');
    }
  }

  List<ProvinceStat> get _filteredProvinces {
    final list = _provinces.where((p) {
      final matchesSearch = p.province.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesRegion = _selectedRegion == 'ทั้งหมด' || p.region.contains(_selectedRegion);
      return matchesSearch && matchesRegion;
    }).toList();

    // เรียงจังหวัดที่มีโรคลำดับต้นๆ
    list.sort((a, b) {
      if (a.totalCases != b.totalCases) {
        return b.totalCases.compareTo(a.totalCases); // มากไปน้อย
      }
      return a.province.compareTo(b.province);
    });

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    int highCount = _provinces.where((p) => p.totalCases >= 5 || p.riskLevel.toUpperCase() == 'HIGH').length;
    int medCount = _provinces
        .where((p) => (p.totalCases >= 2 && p.totalCases < 5) || p.riskLevel.toUpperCase() == 'MEDIUM')
        .length;
    int safeCount = _provinces
        .where((p) => p.totalCases < 2 && p.riskLevel.toUpperCase() != 'HIGH' && p.riskLevel.toUpperCase() != 'MEDIUM')
        .length;

    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('พื้นที่ระบาด', style: AppText.display(24, color: p.ink)),
                        Row(
                          children: [
                            PulseDot(color: p.safe, size: 6),
                            Text('77 จังหวัด · อัปเดตสด', style: TextStyle(fontSize: 12.5, color: p.muted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  SizedBox(
                    width: 104,
                    child: SegmentedTabs(
                      compact: true,
                      labels: const ['รายการ', 'แผนที่'],
                      icons: const [Remix.list_unordered, Remix.map_2_line],
                      index: _isMapView ? 1 : 0,
                      onChanged: (i) => setState(() => _isMapView = i == 1),
                    ),
                  ),
                ],
              ),
            ),
            ChoiceChips(
              options: _regions,
              selected: _selectedRegion,
              onSelected: (r) => setState(() => _selectedRegion = r),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 380),
                switchInCurve: Curves.easeOutCubic,
                transitionBuilder: (c, a) => FadeTransition(
                  opacity: a,
                  child: ScaleTransition(scale: Tween(begin: 0.98, end: 1.0).animate(a), child: c),
                ),
                child: _isLoading
                    ? const _LoadingList(key: ValueKey('loading'))
                    : _isMapView
                        ? KeyedSubtree(key: const ValueKey('map'), child: _buildMapView())
                        : KeyedSubtree(
                            key: const ValueKey('list'), child: _buildListView(highCount, medCount, safeCount)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListView(int highCount, int medCount, int safeCount) {
    final filtered = _filteredProvinces;
    final showEmpty =
        filtered.where((p) => p.totalCases > 0).isEmpty && _searchQuery.isEmpty && _selectedRegion == 'ทั้งหมด';

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _buildLocationHeader(),
              const SizedBox(height: 12),
              _buildSummaryCards(highCount, medCount, safeCount),
              const SizedBox(height: 12),
              AppSearchField(hint: 'ค้นหาจังหวัด', onChanged: (val) => setState(() => _searchQuery = val)),
              const SizedBox(height: 12),
              _buildLegend(),
              const SizedBox(height: 16),
            ]),
          ),
        ),
        if (showEmpty)
          SliverToBoxAdapter(child: _buildEmptyState())
        else if (filtered.isEmpty)
          const SliverToBoxAdapter(
            child: EmptyState(
                icon: Remix.search_line,
                title: 'ไม่พบจังหวัดที่ค้นหา',
                message: 'ลองค้นหาด้วยชื่ออื่น หรือเลือกภาคอื่น',
                mascot: RiceyMood.think),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 130),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: FadeSlideIn.stagger(index, child: _buildProvinceCard(filtered[index])),
                ),
                childCount: filtered.length,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildEmptyState() {
    final p = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 12, 32, 130),
      child: Column(
        children: [
          const Ricey(mood: RiceyMood.guard, size: 140),
          const SizedBox(height: 12),
          Text('ยอดเยี่ยม!', textAlign: TextAlign.center, style: AppText.display(24, color: p.primaryText)),
          const SizedBox(height: 8),
          Text(
            'ขณะนี้ยังไม่พบรายงานพื้นที่เสี่ยงในประเทศไทย\nสถานการณ์โดยรวมอยู่ในเกณฑ์ปลอดภัย',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: p.muted, height: 1.6),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationHeader() {
    final p = context.pal;
    final parts = _currentLatLon.split(', ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: p.hero, borderRadius: BorderRadius.circular(18)),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(11)),
            child: const Icon(Remix.map_pin_2_line, color: AppColors.gold, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ตำแหน่งปัจจุบันของคุณ', style: TextStyle(color: p.heroMuted, fontSize: 11.5)),
                Text(
                  '$_currentLocation${_currentRegion.isNotEmpty ? ' · $_currentRegion' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(parts[0],
                  style:
                      TextStyle(color: p.heroMuted, fontSize: 11, fontFeatures: const [FontFeature.tabularFigures()])),
              Text(
                parts.length > 1 ? parts[1] : '',
                style: TextStyle(color: p.heroMuted, fontSize: 11, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCards(int high, int med, int safe) {
    return Row(
      children: [
        Expanded(child: _buildMetricCard(high, 'เสี่ยงสูง', Tone.danger)),
        const SizedBox(width: 8),
        Expanded(child: _buildMetricCard(med, 'เฝ้าระวัง', Tone.warn)),
        const SizedBox(width: 8),
        Expanded(child: _buildMetricCard(safe, 'ปลอดภัย', Tone.safe)),
      ],
    );
  }

  Widget _buildMetricCard(int count, String label, Tone tone) {
    final (fg, bg) = context.tone(tone);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CountUp(value: count, style: TextStyle(color: fg, fontSize: 24, fontWeight: FontWeight.w700, height: 1.1)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildLegend() {
    final p = context.pal;
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: AppCard(
        padding: EdgeInsets.zero,
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          shape: const RoundedRectangleBorder(),
          collapsedShape: const RoundedRectangleBorder(),
          iconColor: p.muted,
          collapsedIconColor: p.muted,
          leading: const IconTile(icon: Remix.shield_check_line, tone: Tone.primary, size: 34),
          title: Text('เกณฑ์การประเมินระดับความเสี่ยง',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink)),
          subtitle: Text('AI Assessment', style: TextStyle(fontSize: 11.5, color: p.muted)),
          children: [
            _legendRow(
                Tone.danger, 'เสี่ยงสูง', 'ตรวจพบโรค ≥ 5 จุด', 'แจ้งเจ้าหน้าที่เกษตรด่วน', Remix.error_warning_line),
            const SizedBox(height: 8),
            _legendRow(Tone.warn, 'เฝ้าระวัง', 'ตรวจพบโรค 2–4 จุด', 'เฝ้าระวังแปลงนาใกล้ชิด', Remix.alert_line),
            const SizedBox(height: 8),
            _legendRow(Tone.safe, 'ปลอดภัย', 'ตรวจพบโรค 0–1 จุด', 'สถานการณ์ปกติ', Remix.shield_check_line),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Remix.information_line, size: 13, color: p.faint),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'ข้อมูลจากระบบ AI วิเคราะห์โรคข้าว ไม่ใช่ข้อมูลทางราชการ',
                    style: TextStyle(fontSize: 11.5, color: p.muted),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendRow(Tone tone, String label, String criteria, String action, IconData icon) {
    final p = context.pal;
    final (fg, bg) = context.tone(tone);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: bg.withOpacity(0.6), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 13)),
                Text(action, style: TextStyle(fontSize: 12, color: p.body)),
              ],
            ),
          ),
          Text(criteria, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: p.muted)),
        ],
      ),
    );
  }

  Widget _buildProvinceCard(ProvinceStat prov) {
    final p = context.pal;
    final (tone, badgeText) = _riskOf(prov);
    final (fg, bg) = context.tone(tone);
    final severity = (prov.totalCases / 10.0).clamp(0.0, 1.0);

    return AppCard(
      onTap: () => _showProvinceDetails(prov),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration:
                BoxDecoration(color: fg, shape: BoxShape.circle, boxShadow: [BoxShadow(color: bg, spreadRadius: 4)]),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(prov.province, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.ink)),
                Text('${prov.region} · ตรวจพบ ${prov.totalCases} จุด', style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusPill(label: badgeText, tone: tone, dot: false),
              const SizedBox(height: 6),
              SizedBox(width: 56, child: ProgressBar(value: severity == 0 ? 0.04 : severity, color: fg, height: 5)),
            ],
          ),
          const SizedBox(width: 6),
          Icon(Remix.arrow_right_s_line, color: p.faint, size: 20),
        ],
      ),
    );
  }

  void _showProvinceDetails(ProvinceStat p) {
    showAppSheet<void>(context, builder: (context) => _ProvinceDetailSheet(province: p));
  }

  Widget _buildMapView() {
    return OutbreakMap(
      provinces: _provinces,
      scans: _rawScans,
      selectedRegion: _selectedRegion,
      onOpenProvinceDetails: _showProvinceDetails,
    );
  }
}

class _LoadingList extends StatelessWidget {
  const _LoadingList({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      physics: const NeverScrollableScrollPhysics(),
      children: const [
        Skeleton(height: 60, radius: 18),
        SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: Skeleton(height: 66, radius: 16)),
            SizedBox(width: 8),
            Expanded(child: Skeleton(height: 66, radius: 16)),
            SizedBox(width: 8),
            Expanded(child: Skeleton(height: 66, radius: 16)),
          ],
        ),
        SizedBox(height: 12),
        Skeleton(height: 50, radius: 14),
        SizedBox(height: 16),
        Skeleton(height: 64, radius: 20),
        SizedBox(height: 8),
        Skeleton(height: 64, radius: 20),
        SizedBox(height: 8),
        Skeleton(height: 64, radius: 20),
      ],
    );
  }
}

class _ProvinceDetailSheet extends StatefulWidget {
  final ProvinceStat province;
  const _ProvinceDetailSheet({required this.province});

  @override
  State<_ProvinceDetailSheet> createState() => _ProvinceDetailSheetState();
}

class _ProvinceDetailSheetState extends State<_ProvinceDetailSheet> {
  bool _isLoading = true;
  String _dominantDisease = 'Healthy';
  final List<Map<String, dynamic>> _riskyLocations = [];

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    try {
      // Fetch real scans from Firestore for this specific province
      final snapshot = await FirebaseFirestore.instance.collection('diagnoses').get();

      Map<String, int> diseaseCounts = {};

      for (var doc in snapshot.docs) {
        final scan = doc.data();
        if (scan['location'] != null && scan['location']['province'] != null) {
          String fullLoc = scan['location']['province'] as String;
          if (fullLoc.contains(widget.province.province)) {
            if (scan['disease_code'] != null && scan['disease_code'] != 'HEALTHY') {
              String disease = scan['disease_name'] ?? 'Unknown';
              diseaseCounts[disease] = (diseaseCounts[disease] ?? 0) + 1;

              // Extract location sub-parts for detailed view
              final parts = fullLoc.split(' ');
              final subParts = parts
                  .where((p) => p.startsWith('ต.') || p.startsWith('อ.') || p.startsWith('แขวง') || p.startsWith('เขต'))
                  .toList();
              String shortLoc =
                  subParts.isNotEmpty ? subParts.join(' ') : fullLoc.replaceAll(RegExp(r'จ\..*'), '').trim();
              if (shortLoc.isEmpty) shortLoc = fullLoc;

              _riskyLocations.add({
                'disease': disease,
                'location': shortLoc,
                'date': scan['diag_date'] != null ? (scan['diag_date'] as Timestamp).toDate() : DateTime.now(),
              });
            }
          }
        }
      }

      if (mounted) {
        if (diseaseCounts.isNotEmpty) {
          var sorted = diseaseCounts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
          _dominantDisease = sorted.first.key;
        } else {
          _dominantDisease = 'Healthy';
        }

        _riskyLocations.sort((a, b) => (b['date'] as DateTime).compareTo(a['date'] as DateTime));

        setState(() => _isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final p = widget.province;
    final (tone, _) = _riskOf(p);
    final (fg, _) = context.tone(tone);

    String badgeText;
    List<String> advice;

    if (tone == Tone.danger) {
      badgeText = 'สถานะอันตราย/เสี่ยงสูง';
      advice = [
        'แจ้งเจ้าหน้าที่เกษตรตำบลด่วน',
        'แยก/ถอนต้นที่ติดโรคเผาทำลายทันที',
        'ใช้สารเคมีกำจัดศัตรูพืชตามคำแนะนำ'
      ];
    } else if (tone == Tone.warn) {
      badgeText = 'สถานะเฝ้าระวัง';
      advice = [
        'เฝ้าระวังแปลงนาอย่างใกล้ชิด (ทุก 3-5 วัน)',
        'ฉีดพ่นชีวภัณฑ์ป้องกันเชื้อรา/แบคทีเรีย',
        'ลดปริมาณการใส่ปุ๋ยไนโตรเจน'
      ];
    } else {
      badgeText = 'สถานะปกติ/ปลอดภัย';
      advice = ['ตรวจสอบแปลงนาทุก 7-10 วัน', 'ใส่ปุ๋ยตามค่าวิเคราะห์ดิน', 'รักษาระดับน้ำให้เหมาะสม'];
    }

    double severity = (p.totalCases / 10.0).clamp(0.0, 1.0);
    if (p.totalCases == 0) severity = 0.05;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(context).padding.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.province, style: AppText.display(26, color: pal.ink)),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: _isLoading
                            ? const Padding(padding: EdgeInsets.only(top: 6), child: Skeleton(width: 140, height: 12))
                            : Text(
                                '${p.region.isNotEmpty ? '${p.region} · ' : ''}โรคเด่น: $_dominantDisease',
                                style: TextStyle(fontSize: 13, color: pal.muted),
                              ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                StatusPill(label: badgeText, tone: tone),
              ],
            ),
            const SizedBox(height: 18),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('ความรุนแรงการระบาด',
                            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: pal.ink)),
                      ),
                      CountUp(
                        value: (severity * 100).toInt(),
                        suffix: '%',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: fg),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ProgressBar(value: severity, color: fg, height: 10),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Remix.map_pin_2_line, size: 14, color: pal.muted),
                      const SizedBox(width: 6),
                      Text('ตรวจพบพื้นที่ระบาดรวม ${p.totalCases} จุดพิกัด',
                          style: TextStyle(fontSize: 12.5, color: pal.muted)),
                    ],
                  ),
                ],
              ),
            ),
            if (_riskyLocations.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text('จุดตรวจพบการระบาดล่าสุด',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: pal.ink)),
              const SizedBox(height: 8),
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Column(
                  children: [
                    for (var i = 0; i < (_riskyLocations.length > 10 ? 10 : _riskyLocations.length); i++) ...[
                      if (i > 0) Divider(height: 1, color: pal.line),
                      _locationRow(_riskyLocations[i]),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: pal.safeSoft, borderRadius: BorderRadius.circular(20)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Remix.lightbulb_line, size: 17, color: pal.safe),
                      const SizedBox(width: 8),
                      Text('คำแนะนำการดูแลพื้นที่',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: pal.safe)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  for (var i = 0; i < advice.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: pal.primary, shape: BoxShape.circle),
                            child: Text('${i + 1}',
                                style:
                                    const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                              child: Text(advice[i], style: TextStyle(fontSize: 13.5, color: pal.body, height: 1.5))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            AppButton(label: 'ปิด', kind: ButtonKind.soft, height: 52, onPressed: () => Navigator.pop(context)),
          ],
        ),
      ),
    );
  }

  Widget _locationRow(Map<String, dynamic> loc) {
    final pal = context.pal;
    final date = loc['date'] as DateTime;
    final dateStr = '${date.day}/${date.month}/${date.year + 543}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: pal.danger, shape: BoxShape.circle)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(loc['disease'] as String,
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: pal.ink)),
                Text(loc['location'] as String, style: TextStyle(fontSize: 12, color: pal.muted)),
              ],
            ),
          ),
          Text(dateStr, style: TextStyle(fontSize: 11.5, color: pal.muted, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
