import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'ricey.dart';

/// Rice leaf inside gold scan brackets — the app's signature illustration.
/// [scan] (0–1) sweeps a gold line down the frame; pass a repeating
/// animation value to make it live.
class LeafScanPainter extends CustomPainter {
  LeafScanPainter({this.scan = 0.5, this.leafColor = const Color(0xFFA7C4B0), this.goldColor = AppColors.gold});

  final double scan;
  final Color leafColor;
  final Color goldColor;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    canvas.save();
    canvas.translate((size.width - s) / 2, (size.height - s) / 2);
    canvas.scale(s / 96);

    final gold = Paint()
      ..color = goldColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(
      Path()
        ..moveTo(6, 22)
        ..lineTo(6, 8)
        ..lineTo(20, 8)
        ..moveTo(76, 8)
        ..lineTo(90, 8)
        ..lineTo(90, 22)
        ..moveTo(90, 74)
        ..lineTo(90, 88)
        ..lineTo(76, 88)
        ..moveTo(20, 88)
        ..lineTo(6, 88)
        ..lineTo(6, 74),
      gold,
    );

    final leaf = Paint()
      ..color = leafColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(
      Path()
        ..moveTo(48, 16)
        ..cubicTo(66, 26, 72, 46, 48, 80)
        ..cubicTo(24, 46, 30, 26, 48, 16)
        ..close(),
      leaf,
    );
    final vein = Paint()
      ..color = leafColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(48, 22), const Offset(48, 78), vein);
    for (final (y, dx, dy) in [(38.0, 10.0, 7.0), (52.0, 12.0, 8.0), (66.0, 9.0, 6.0)]) {
      canvas.drawLine(Offset(48, y), Offset(48 - dx, y - dy), vein);
      canvas.drawLine(Offset(48, y), Offset(48 + dx, y - dy), vein);
    }

    final y = 20 + 60 * scan;
    canvas.drawLine(
      Offset(22, y),
      Offset(74, y),
      Paint()
        ..color = goldColor.withOpacity(0.75)
        ..strokeWidth = 1.5,
    );
    canvas.drawCircle(const Offset(40, 58), 2.6, Paint()..color = goldColor);
    canvas.drawCircle(const Offset(57, 42), 2, Paint()..color = goldColor);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant LeafScanPainter oldDelegate) =>
      oldDelegate.scan != scan || oldDelegate.leafColor != leafColor;
}

/// The leaf illustration with a slow scanning line.
class LeafScanArt extends StatefulWidget {
  const LeafScanArt({super.key, this.size = 96, this.leafColor = const Color(0xFFA7C4B0)});
  final double size;
  final Color leafColor;

  @override
  State<LeafScanArt> createState() => _LeafScanArtState();
}

class _LeafScanArtState extends State<LeafScanArt> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _ctrl.value = 0.5;
      _ctrl.stop();
    } else if (!_ctrl.isAnimating) {
      _ctrl.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) => CustomPaint(
          size: Size.square(widget.size),
          painter: LeafScanPainter(
            scan: Curves.easeInOut.transform(_ctrl.value),
            leafColor: widget.leafColor,
          ),
        ),
      ),
    );
  }
}

/// The Rice AI logo mark (rice panicle over leaves).
///
/// [onDark] picks the light-toned variant for forest-green surfaces.
/// Source artwork: assets/brand/*.svg; PNGs are 1024px with transparency.
class RiceLogo extends StatelessWidget {
  const RiceLogo({super.key, this.size = 48, this.onDark = false});
  final double size;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'โลโก้ Rice AI',
      image: true,
      child: Image.asset(
        onDark ? 'assets/brand/logo_mark_ondark.png' : 'assets/brand/logo_mark.png',
        width: size,
        height: size,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}

/// Logo on a cream rounded tile, for use on dark hero surfaces.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * 0.1),
      decoration: BoxDecoration(color: AppColors.cream, borderRadius: BorderRadius.circular(size * 0.3)),
      child: RiceLogo(size: size * 0.8),
    );
  }
}

/// Dark forest banner with brand mark, name, tagline and the scan art.
class BrandBanner extends StatelessWidget {
  const BrandBanner({super.key, this.tagline = 'ระบบวินิจฉัยโรคใบข้าวด้วย AI', this.height = 136, this.mascot});
  final String tagline;
  final double height;

  /// Ricey peeks in from the bottom-right instead of the leaf-scan art.
  final RiceyMood? mascot;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: p.hero,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: AppColors.forestDeep.withOpacity(0.18), blurRadius: 24, offset: const Offset(0, 12))
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _ContourPainter())),
            if (mascot != null)
              Positioned(right: 4, bottom: -20, child: Ricey(mood: mascot!, size: 120))
            else
              const Positioned(right: 16, top: 0, bottom: 0, child: Center(child: LeafScanArt(size: 98))),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const BrandMark(),
                      const SizedBox(width: 12),
                      Text('Rice AI', style: AppText.display(22, color: Colors.white, height: 1.2)),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 110),
                    child: Text(tagline, style: TextStyle(fontSize: 12.5, color: p.heroMuted, height: 1.4)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Faint field-row contour lines for dark hero surfaces.
class _ContourPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.055)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    for (var i = 0; i < 4; i++) {
      final y = size.height * (0.62 + i * 0.11);
      final path = Path()..moveTo(0, y);
      for (double x = 0; x <= size.width; x += 8) {
        path.lineTo(x, y + math.sin(x / size.width * math.pi * 2 + i) * 6);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Contour texture usable behind any dark hero card.
class HeroContours extends StatelessWidget {
  const HeroContours({super.key});

  @override
  Widget build(BuildContext context) => CustomPaint(painter: _ContourPainter());
}
