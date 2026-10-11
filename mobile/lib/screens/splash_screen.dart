import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import '../widgets/brand.dart';

/// Launch screen: brand mark framed by gold scan corners that draw in,
/// one scan sweep, then the wordmark. Plays once (~1.4s), loader loops.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _intro =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  late final AnimationController _loader =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1300));

  Animation<double> _seg(double a, double b, [Curve curve = Curves.easeOutCubic]) =>
      CurvedAnimation(parent: _intro, curve: Interval(a, b, curve: curve));

  late final _mark = _seg(0.0, 0.45, Curves.easeOutBack);
  late final _corners = _seg(0.15, 0.6);
  late final _sweep = _seg(0.4, 0.8, Curves.easeInOut);
  late final _title = _seg(0.5, 0.85);
  late final _tagline = _seg(0.62, 0.95);
  late final _footer = _seg(0.75, 1.0);

  @override
  void initState() {
    super.initState();
    _intro.forward();
    _loader.repeat();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) _intro.value = 1;
  }

  @override
  void dispose() {
    _intro.dispose();
    _loader.dispose();
    super.dispose();
  }

  Widget _rise(Animation<double> a, Widget child, {double dy = 12}) => AnimatedBuilder(
        animation: a,
        child: child,
        builder: (_, c) => Opacity(
          opacity: a.value.clamp(0.0, 1.0),
          child: Transform.translate(offset: Offset(0, (1 - a.value) * dy), child: c),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: p.hero,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: p.hero,
        body: Semantics(
          label: 'Rice AI กำลังเปิดแอป',
          child: Stack(
            children: [
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox.square(
                      dimension: 136,
                      child: AnimatedBuilder(
                        animation: _intro,
                        builder: (_, __) => CustomPaint(
                          foregroundPainter: _FramePainter(corners: _corners.value, sweep: _sweep.value),
                          child: Center(
                            child: Opacity(
                              opacity: _mark.value.clamp(0.0, 1.0),
                              child: Transform.scale(
                                  scale: 0.82 + 0.18 * _mark.value, child: const RiceLogo(size: 104, onDark: true)),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 26),
                    _rise(_title, Text('Rice AI', style: AppText.display(32, color: Colors.white, height: 1.2))),
                    const SizedBox(height: 6),
                    _rise(
                      _tagline,
                      Text(
                        'ระบบวินิจฉัยโรคใบข้าวด้วย AI',
                        style: TextStyle(color: p.heroMuted, fontSize: 13.5, letterSpacing: 0.2),
                      ),
                      dy: 8,
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: MediaQuery.of(context).padding.bottom + 48,
                child: FadeTransition(
                  opacity: _footer,
                  child: Column(
                    children: [
                      SizedBox(
                        width: 72,
                        height: 2,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(1),
                          child: AnimatedBuilder(
                            animation: _loader,
                            builder: (_, __) => CustomPaint(painter: _LoaderPainter(_loader.value)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'v1.0',
                        style: TextStyle(color: p.heroMuted.withOpacity(0.6), fontSize: 11, letterSpacing: 1.2),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Gold corner brackets that grow from each corner, plus one scan sweep.
class _FramePainter extends CustomPainter {
  _FramePainter({required this.corners, required this.sweep});
  final double corners;
  final double sweep;

  @override
  void paint(Canvas canvas, Size size) {
    final len = 26 * corners.clamp(0.0, 1.0);
    if (len > 0) {
      final paint = Paint()
        ..color = AppColors.gold.withOpacity(corners.clamp(0.0, 1.0))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round;
      const i = 2.0;
      final r = size.width - i, b = size.height - i;
      final path = Path()
        ..moveTo(i, i + len)
        ..lineTo(i, i)
        ..lineTo(i + len, i)
        ..moveTo(r - len, i)
        ..lineTo(r, i)
        ..lineTo(r, i + len)
        ..moveTo(r, b - len)
        ..lineTo(r, b)
        ..lineTo(r - len, b)
        ..moveTo(i + len, b)
        ..lineTo(i, b)
        ..lineTo(i, b - len);
      canvas.drawPath(path, paint);
    }

    if (sweep > 0 && sweep < 1) {
      final y = 16 + (size.height - 32) * sweep;
      final fade = math.sin(sweep * math.pi);
      canvas.drawLine(
        Offset(18, y),
        Offset(size.width - 18, y),
        Paint()
          ..color = AppColors.gold.withOpacity(0.85 * fade)
          ..strokeWidth = 1.6,
      );
      canvas.drawRect(
        Rect.fromLTWH(18, y - 14, size.width - 36, 14),
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.gold.withOpacity(0), AppColors.gold.withOpacity(0.18 * fade)],
          ).createShader(Rect.fromLTWH(18, y - 14, size.width - 36, 14)),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _FramePainter oldDelegate) =>
      oldDelegate.corners != corners || oldDelegate.sweep != sweep;
}

/// Thin indeterminate bar: a gold segment gliding across a faint track.
class _LoaderPainter extends CustomPainter {
  _LoaderPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.white.withOpacity(0.12));
    final w = size.width * 0.4;
    final x = -w + (size.width + w) * Curves.easeInOut.transform(t);
    canvas.drawRect(Rect.fromLTWH(x, 0, w, size.height), Paint()..color = AppColors.gold);
  }

  @override
  bool shouldRepaint(covariant _LoaderPainter oldDelegate) => oldDelegate.t != t;
}
