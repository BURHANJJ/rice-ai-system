import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:remixicon/remixicon.dart';

import '../../../services/weather_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../../widgets/weather_scene.dart';

/// Home hero: live weather over an animated sky, with the local disease
/// risk and field advice for today. Long-press previews other skies.
class HomeHeroCard extends StatefulWidget {
  final String userName;
  final String locationName;
  final String temperature;
  final String humidity;
  final int scanCount;
  final bool isLocationError;
  final bool hasLocalRisk;
  final WeatherSnapshot? weather;

  const HomeHeroCard({
    super.key,
    required this.userName,
    required this.locationName,
    required this.temperature,
    required this.humidity,
    required this.scanCount,
    required this.isLocationError,
    this.hasLocalRisk = false,
    this.weather,
  });

  @override
  State<HomeHeroCard> createState() => _HomeHeroCardState();
}

class _HomeHeroCardState extends State<HomeHeroCard> {
  // Preview cycle for presentations: (kind, isDay). null = live weather.
  static const _previews = [
    (WeatherKind.clear, true),
    (WeatherKind.partlyCloudy, true),
    (WeatherKind.rain, true),
    (WeatherKind.thunder, true),
    (WeatherKind.fog, true),
    (WeatherKind.clear, false),
  ];
  int? _preview;

  void _cyclePreview() {
    HapticFeedback.mediumImpact();
    setState(() {
      final next = (_preview ?? -1) + 1;
      _preview = next >= _previews.length ? null : next;
    });
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.weather;
    final preview = _preview != null ? _previews[_preview!] : null;
    final kind = preview?.$1 ?? w?.kind;
    final isDay = preview?.$2 ?? w?.isDay ?? true;
    final shadow = widget.hasLocalRisk ? AppColors.danger : skyColors(kind, isDay).first;

    return GestureDetector(
      onLongPress: _cyclePreview,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 600),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          boxShadow: [BoxShadow(color: shadow.withOpacity(0.32), blurRadius: 28, offset: const Offset(0, 14))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(26),
          child: Stack(
            children: [
              Positioned.fill(child: WeatherScene(kind: kind, isDay: isDay)),
              // Bottom scrim keeps text legible over bright skies.
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.black.withOpacity(0.0), Colors.black.withOpacity(0.28)],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _topRow(w, preview != null ? kind!.label(isDay) : null),
                    const SizedBox(height: 14),
                    _current(w, kind, isDay),
                    const SizedBox(height: 14),
                    _statusBox(w),
                    if (w != null && w.hourly.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      _hourly(w),
                    ],
                    const SizedBox(height: 10),
                    _stats(w),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _topRow(WeatherSnapshot? w, String? previewLabel) {
    return Row(
      children: [
        Flexible(
          child: _Glass(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(widget.isLocationError ? Remix.error_warning_line : Remix.map_pin_2_line,
                    color: Colors.white, size: 13),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    widget.isLocationError ? 'ไม่สามารถระบุตำแหน่งได้' : widget.locationName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: previewLabel != null
              ? _Glass(
                  key: ValueKey(previewLabel),
                  color: AppColors.gold.withOpacity(0.9),
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  child: Text('ตัวอย่าง · $previewLabel',
                      style: const TextStyle(color: AppColors.forestDeep, fontSize: 11, fontWeight: FontWeight.w700)),
                )
              : Text(
                  w == null ? '' : 'อัปเดต ${DateFormat('HH:mm').format(w.fetchedAt)}',
                  key: const ValueKey('time'),
                  style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 11.5),
                ),
        ),
      ],
    );
  }

  Widget _current(WeatherSnapshot? w, WeatherKind? kind, bool isDay) {
    final tempText = w != null ? '${w.temperature.round()}°' : widget.temperature.replaceAll('C', '');
    final label = kind?.label(isDay) ?? (widget.isLocationError ? 'เปิด GPS เพื่อดูสภาพอากาศ' : 'กำลังโหลดสภาพอากาศ');
    final sub = w == null
        ? null
        : [
            'รู้สึกเหมือน ${w.apparent.round()}°',
            if (w.high != null && w.low != null) 'สูง ${w.high!.round()}° ต่ำ ${w.low!.round()}°',
          ].join(' · ');

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                transitionBuilder: (c, a) => FadeTransition(
                  opacity: a,
                  child: SlideTransition(
                      position: Tween(begin: const Offset(0, 0.2), end: Offset.zero).animate(a), child: c),
                ),
                child: Text(
                  tempText,
                  key: ValueKey(tempText),
                  style: AppText.display(52, color: Colors.white, height: 1.05),
                ),
              ),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Text(
                  label,
                  key: ValueKey(label),
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
              if (sub != null) Text(sub, style: TextStyle(color: Colors.white.withOpacity(0.78), fontSize: 12.5)),
            ],
          ),
        ),
        if (kind != null) _FloatingGlyph(icon: kind.icon(isDay), key: ValueKey('$kind$isDay')),
      ],
    );
  }

  Widget _statusBox(WeatherSnapshot? w) {
    final risk = widget.hasLocalRisk;
    final advice = w?.advice(hasLocalRisk: risk) ??
        (risk ? 'พบความเสี่ยงโรคพืชในพื้นที่ แนะนำให้สำรวจอย่างใกล้ชิด' : 'สภาพแวดล้อมดี เหมาะสำหรับการสำรวจแปลง');
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 11),
      decoration: BoxDecoration(
        color: risk ? AppColors.danger.withOpacity(0.82) : Colors.white.withOpacity(0.14),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(risk ? 0.25 : 0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PulseDot(color: risk ? const Color(0xFFFFD2CC) : const Color(0xFF8CE0A5), size: 6),
              const SizedBox(width: 2),
              Expanded(
                child: Text(
                  risk ? 'พื้นที่เสี่ยง · ต้องเฝ้าระวัง' : 'สถานการณ์ปกติ · ระบบ AI พร้อมใช้งาน',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(Remix.plant_line, size: 14, color: Colors.white.withOpacity(0.85)),
              ),
              const SizedBox(width: 6),
              Expanded(
                child:
                    Text(advice, style: TextStyle(color: Colors.white.withOpacity(0.92), fontSize: 12.5, height: 1.45)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _hourly(WeatherSnapshot w) {
    return _Glass(
      radius: 16,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Row(
        children: [
          for (var i = 0; i < w.hourly.length; i++)
            Expanded(
              child: Column(
                children: [
                  Text(
                    i == 0 ? 'ตอนนี้' : DateFormat('HH:mm').format(w.hourly[i].time),
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 11,
                        fontWeight: i == 0 ? FontWeight.w700 : FontWeight.w400),
                  ),
                  const SizedBox(height: 5),
                  Icon(w.hourly[i].kind.icon(w.hourly[i].isDay), color: Colors.white, size: 18),
                  const SizedBox(height: 4),
                  Text('${w.hourly[i].temperature.round()}°',
                      style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w700)),
                  Text(
                    '${w.hourly[i].rainChance}%',
                    style: TextStyle(
                      color: w.hourly[i].rainChance >= 50 ? const Color(0xFFB5DCFF) : Colors.white.withOpacity(0.55),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _stats(WeatherSnapshot? w) {
    Widget stat(IconData icon, Widget value, String label) => Expanded(
          child: Column(
            children: [
              value,
              const SizedBox(height: 2),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 11.5, color: Colors.white.withOpacity(0.7)),
                  const SizedBox(width: 3),
                  Flexible(
                    child: Text(label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
        );
    const v = TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, height: 1.2);
    final divider = VerticalDivider(width: 1, thickness: 1, color: Colors.white.withOpacity(0.15));

    return _Glass(
      radius: 16,
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: IntrinsicHeight(
        child: Row(
          children: [
            stat(Remix.qr_scan_2_line, CountUp(value: widget.scanCount, style: v), 'สแกนแล้ว'),
            divider,
            stat(Remix.drop_line, Text(w != null ? '${w.humidity}%' : widget.humidity, style: v), 'ความชื้น'),
            divider,
            stat(Remix.windy_line, Text(w != null ? '${w.windKmh.round()}' : '--', style: v), 'ลม กม./ชม.'),
            divider,
            stat(Remix.umbrella_line, Text(w?.rainChance != null ? '${w!.rainChance}%' : '--', style: v), 'โอกาสฝน'),
          ],
        ),
      ),
    );
  }
}

class _Glass extends StatelessWidget {
  const _Glass({super.key, required this.child, required this.padding, this.radius = 999, this.color});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? Colors.white.withOpacity(0.13),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: Colors.white.withOpacity(0.16)),
      ),
      child: child,
    );
  }
}

/// Big condition icon that bobs gently.
class _FloatingGlyph extends StatefulWidget {
  const _FloatingGlyph({super.key, required this.icon});
  final IconData icon;

  @override
  State<_FloatingGlyph> createState() => _FloatingGlyphState();
}

class _FloatingGlyphState extends State<_FloatingGlyph> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 4));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _ctrl.stop();
    } else if (!_ctrl.isAnimating) {
      _ctrl.repeat();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeOutBack,
      builder: (_, v, child) => Transform.scale(scale: v, child: child),
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, child) => Transform.translate(
          offset: Offset(0, math.sin(_ctrl.value * math.pi * 2) * 4),
          child: child,
        ),
        child: Icon(
          widget.icon,
          size: 68,
          color: Colors.white,
          shadows: [Shadow(color: Colors.black.withOpacity(0.18), blurRadius: 16, offset: const Offset(0, 6))],
        ),
      ),
    );
  }
}
