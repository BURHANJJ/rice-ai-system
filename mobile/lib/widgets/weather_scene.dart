import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../services/weather_service.dart';

/// Gradient sky for a weather condition. `null` kind = neutral brand forest.
List<Color> skyColors(WeatherKind? kind, bool isDay) {
  if (kind == null) return const [Color(0xFF1B4332), Color(0xFF24573F)];
  if (!isDay) {
    return switch (kind) {
      WeatherKind.clear => const [Color(0xFF0B1426), Color(0xFF1B2C4A)],
      WeatherKind.partlyCloudy => const [Color(0xFF111B2E), Color(0xFF26354D)],
      WeatherKind.thunder => const [Color(0xFF12141F), Color(0xFF262A3A)],
      WeatherKind.fog => const [Color(0xFF2A3036), Color(0xFF3D454C)],
      _ => const [Color(0xFF151D29), Color(0xFF2A3544)],
    };
  }
  return switch (kind) {
    WeatherKind.clear => const [Color(0xFF1F6E9C), Color(0xFF4C98C2)],
    WeatherKind.partlyCloudy => const [Color(0xFF2E6688), Color(0xFF5E8FAD)],
    WeatherKind.cloudy => const [Color(0xFF4A5A68), Color(0xFF6E7F8C)],
    WeatherKind.fog => const [Color(0xFF55636A), Color(0xFF76848A)],
    WeatherKind.drizzle => const [Color(0xFF3E5263), Color(0xFF5B6F80)],
    WeatherKind.rain => const [Color(0xFF2C3E4F), Color(0xFF4A5E70)],
    WeatherKind.heavyRain => const [Color(0xFF223140), Color(0xFF3B4C5D)],
    WeatherKind.thunder => const [Color(0xFF1B2030), Color(0xFF353B50)],
  };
}

/// Animated sky: sun glow, stars, drifting clouds, rain, fog or lightning.
/// Every motion is an integer multiple of the loop, so it never jumps.
class WeatherScene extends StatefulWidget {
  const WeatherScene({super.key, required this.kind, required this.isDay});
  final WeatherKind? kind;
  final bool isDay;

  @override
  State<WeatherScene> createState() => _WeatherSceneState();
}

class _WeatherSceneState extends State<WeatherScene> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 12));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _ctrl.stop();
      _ctrl.value = 0.3;
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
    final colors = skyColors(widget.kind, widget.isDay);
    return ExcludeSemantics(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 700),
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: colors),
        ),
        child: RepaintBoundary(
          child: CustomPaint(
            painter: _ScenePainter(_ctrl, widget.kind, widget.isDay),
            size: Size.infinite,
          ),
        ),
      ),
    );
  }
}

class _ScenePainter extends CustomPainter {
  _ScenePainter(this.anim, this.kind, this.isDay) : super(repaint: anim);

  final Animation<double> anim;
  final WeatherKind? kind;
  final bool isDay;

  static final _rng = math.Random(42);
  static final _drops =
      List.generate(140, (_) => [_rng.nextDouble(), _rng.nextDouble(), 0.6 + _rng.nextDouble() * 0.8]);
  static final _stars = List.generate(
      36, (_) => [_rng.nextDouble(), _rng.nextDouble() * 0.7, _rng.nextDouble(), 0.6 + _rng.nextDouble()]);

  @override
  void paint(Canvas canvas, Size size) {
    final k = kind;
    if (k == null) return;
    final t = anim.value;

    final showSun = k == WeatherKind.clear || k == WeatherKind.partlyCloudy;
    if (showSun) isDay ? _sun(canvas, size, t) : _moon(canvas, size);
    if (!isDay && (k == WeatherKind.clear || k == WeatherKind.partlyCloudy)) _starsPaint(canvas, size, t);

    final clouds = switch (k) {
      WeatherKind.clear => 0,
      WeatherKind.partlyCloudy => 2,
      WeatherKind.fog => 0,
      WeatherKind.drizzle => 3,
      _ => 4,
    };
    if (clouds > 0) _cloudsPaint(canvas, size, t, clouds, dark: k.isWet && k != WeatherKind.drizzle);

    switch (k) {
      case WeatherKind.drizzle:
        _rain(canvas, size, t, count: 45, speed: 2, len: 8, alpha: 0.35, slant: 0.12);
      case WeatherKind.rain:
        _rain(canvas, size, t, count: 85, speed: 3, len: 14, alpha: 0.42, slant: 0.18);
      case WeatherKind.heavyRain:
        _rain(canvas, size, t, count: 140, speed: 4, len: 18, alpha: 0.5, slant: 0.24);
      case WeatherKind.thunder:
        _rain(canvas, size, t, count: 120, speed: 4, len: 17, alpha: 0.45, slant: 0.22);
        _lightning(canvas, size, t);
      case WeatherKind.fog:
        _fog(canvas, size, t);
      default:
        break;
    }
  }

  void _sun(Canvas canvas, Size size, double t) {
    final c = Offset(size.width * 0.86, size.height * 0.08);
    final pulse = 1 + 0.06 * math.sin(t * math.pi * 4);
    canvas.drawCircle(
      c,
      size.width * 0.55 * pulse,
      Paint()
        ..shader = RadialGradient(colors: [
          const Color(0xFFFFE3A0).withOpacity(0.55),
          const Color(0xFFFFE3A0).withOpacity(0),
        ]).createShader(Rect.fromCircle(center: c, radius: size.width * 0.55)),
    );
    final rays = Paint()
      ..color = const Color(0xFFFFF1C9).withOpacity(0.10)
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 8; i++) {
      final a = t * math.pi * 2 / 4 + i * math.pi / 4;
      canvas.drawLine(
        c + Offset(math.cos(a), math.sin(a)) * 50,
        c + Offset(math.cos(a), math.sin(a)) * 150,
        rays,
      );
    }
  }

  void _moon(Canvas canvas, Size size) {
    final c = Offset(size.width * 0.84, size.height * 0.12);
    canvas.drawCircle(
      c,
      110,
      Paint()
        ..shader = RadialGradient(colors: [
          const Color(0xFFDDE6F5).withOpacity(0.28),
          const Color(0xFFDDE6F5).withOpacity(0),
        ]).createShader(Rect.fromCircle(center: c, radius: 110)),
    );
  }

  void _starsPaint(Canvas canvas, Size size, double t) {
    final paint = Paint()..color = Colors.white;
    for (final s in _stars) {
      final tw = 0.35 + 0.65 * (0.5 + 0.5 * math.sin((t * 3 + s[2]) * math.pi * 2));
      paint.color = Colors.white.withOpacity(0.7 * tw);
      canvas.drawCircle(Offset(s[0] * size.width, s[1] * size.height), s[3], paint);
    }
  }

  void _cloud(Canvas canvas, Offset o, double scale, Paint paint) {
    final path = Path()
      ..addOval(Rect.fromCircle(center: o, radius: 26 * scale))
      ..addOval(Rect.fromCircle(center: o + Offset(28 * scale, -12 * scale), radius: 32 * scale))
      ..addOval(Rect.fromCircle(center: o + Offset(62 * scale, 0), radius: 24 * scale))
      ..addRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(o.dx - 4 * scale, o.dy - 4 * scale, 72 * scale, 30 * scale),
        Radius.circular(15 * scale),
      ));
    canvas.drawPath(path, paint);
  }

  void _cloudsPaint(Canvas canvas, Size size, double t, int count, {required bool dark}) {
    final specs = <List<double>>[
      // y fraction, scale, speed (loops per cycle), phase, opacity
      [0.10, 1.25, 1.0, 0.10, 0.20],
      [0.30, 0.90, 2.0, 0.55, 0.16],
      [0.04, 0.80, 1.0, 0.75, 0.14],
      [0.42, 1.40, 1.0, 0.35, 0.12],
    ];
    for (var i = 0; i < count; i++) {
      final s = specs[i];
      final span = size.width + 220;
      final x = ((s[3] + t * s[2]) % 1.0) * span - 140;
      final color = dark ? const Color(0xFF9AA6B2) : Colors.white;
      _cloud(canvas, Offset(x, size.height * s[0] + 30), s[1], Paint()..color = color.withOpacity(s[4]));
    }
  }

  void _rain(Canvas canvas, Size size, double t,
      {required int count, required int speed, required double len, required double alpha, required double slant}) {
    final paint = Paint()
      ..strokeWidth = 1.3
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < count; i++) {
      final d = _drops[i];
      final fall = ((d[1] + t * speed * (d[2] > 1 ? 2 : 1) * 4) % 1.0);
      final y = fall * (size.height + 40) - 20;
      final x = d[0] * (size.width + 60) - 30 - fall * size.height * slant;
      paint.color = Colors.white.withOpacity(alpha * (d[2] / 1.4));
      canvas.drawLine(Offset(x, y), Offset(x - len * slant, y + len * d[2]), paint);
    }
  }

  void _fog(Canvas canvas, Size size, double t) {
    for (var i = 0; i < 4; i++) {
      final y = size.height * (0.25 + i * 0.2);
      final dx = math.sin((t + i * 0.25) * math.pi * 2) * 40;
      final rect = Rect.fromLTWH(-60 + dx, y - 18, size.width + 120, 36);
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(18)),
        Paint()
          ..color = Colors.white.withOpacity(0.10 + 0.04 * i)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14),
      );
    }
  }

  void _lightning(Canvas canvas, Size size, double t) {
    // Two flashes per 12s loop.
    double flash(double at) {
      final d = (t - at).abs();
      if (d > 0.012) return 0;
      return 1 - d / 0.012;
    }

    final f = math.max(flash(0.31), flash(0.335) * 0.7) + flash(0.78);
    if (f <= 0) return;
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.white.withOpacity(0.28 * f));
    final x = size.width * (t < 0.5 ? 0.72 : 0.3);
    final bolt = Path()
      ..moveTo(x, 0)
      ..lineTo(x - 14, size.height * 0.22)
      ..lineTo(x + 4, size.height * 0.24)
      ..lineTo(x - 18, size.height * 0.5);
    canvas.drawPath(
      bolt,
      Paint()
        ..color = const Color(0xFFFFF6D6).withOpacity(0.9 * f)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _ScenePainter oldDelegate) => oldDelegate.kind != kind || oldDelegate.isDay != isDay;
}
