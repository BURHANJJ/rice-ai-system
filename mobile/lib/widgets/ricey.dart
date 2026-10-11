import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

part 'ricey_art.dart';

/// Moods of Ricey, the Rice AI mascot. Each one picks a face, an arm pose and
/// optional props; the idle motion is tuned per mood.
/// Public name of the mascot. Code keeps the short internal name `Ricey`.
const mascotName = 'น้องข้าวหอม';
const mascotNameEn = 'Nong Khao Hom';

enum RiceyMood {
  /// Default, friendly.
  happy,

  /// Winks and waves — greetings, login.
  hello,

  /// Arms up with sparkles — success, harvest, healthy result.
  joy,

  /// Hand on chin with a "?" — no search results, unclear photo.
  think,

  /// Brows down — disease found, errors.
  worried,

  /// Asleep with Zzz — empty lists, nothing new.
  sleep,

  /// Sweeping a magnifier — analysing a photo.
  scan,

  /// Holding a shield — healthy rice, no outbreak nearby.
  guard,

  /// Holding a phone — take a photo / app tips.
  phone,
}

typedef _MoodSpec = ({String eyes, String mouth, String brows, String armL, String armR, List<String> props});

const Map<RiceyMood, _MoodSpec> _moods = {
  RiceyMood.happy: (eyes: 'open', mouth: 'open', brows: 'none', armL: 'rest', armR: 'rest', props: []),
  RiceyMood.hello: (eyes: 'wink', mouth: 'open', brows: 'none', armL: 'rest', armR: 'wave', props: []),
  RiceyMood.joy: (eyes: 'happy', mouth: 'big', brows: 'none', armL: 'up', armR: 'up', props: ['sparkles']),
  RiceyMood.think: (eyes: 'open', mouth: 'hmm', brows: 'think', armL: 'chin', armR: 'rest', props: ['question']),
  RiceyMood.worried: (eyes: 'open', mouth: 'worry', brows: 'worry', armL: 'rest', armR: 'rest', props: []),
  RiceyMood.sleep: (eyes: 'sleep', mouth: 'o', brows: 'none', armL: 'rest', armR: 'rest', props: ['zzz']),
  RiceyMood.scan: (eyes: 'wink', mouth: 'open', brows: 'none', armL: 'rest', armR: 'hold', props: ['magnifier']),
  RiceyMood.guard: (eyes: 'happy', mouth: 'open', brows: 'none', armL: 'hold', armR: 'thumb', props: ['shield']),
  RiceyMood.phone: (eyes: 'wink', mouth: 'open', brows: 'none', armL: 'hold', armR: 'thumb', props: ['phone']),
};

/// Animated Ricey. Breathes, blinks, sways its rice panicle and acts out its
/// [mood]; tapping makes it hop. Honours the platform "reduce motion" setting.
class Ricey extends StatefulWidget {
  const Ricey({
    super.key,
    this.mood = RiceyMood.happy,
    this.size = 120,
    this.interactive = true,
    this.entrance = true,
    this.semanticLabel,
  });

  final RiceyMood mood;

  /// Width of the mascot; height is `size * 1.1`.
  final double size;

  /// Hop and wink when tapped.
  final bool interactive;

  /// Pop in with a springy scale the first time it appears.
  final bool entrance;
  final String? semanticLabel;

  @override
  State<Ricey> createState() => _RiceyState();
}

class _RiceyState extends State<Ricey> with TickerProviderStateMixin {
  late final AnimationController _loop =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 3200))..repeat();
  late final AnimationController _blink =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 170));
  late final AnimationController _hop = AnimationController(vsync: this, duration: const Duration(milliseconds: 640));
  late final AnimationController _pop = AnimationController(vsync: this, duration: const Duration(milliseconds: 720));
  late final AnimationController _glance =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  Offset _lookFrom = Offset.zero, _lookTo = Offset.zero;
  final _rand = math.Random();
  Timer? _blinkTimer, _glanceTimer;
  bool _still = false;

  @override
  void initState() {
    super.initState();
    if (widget.entrance) {
      _pop.forward();
    } else {
      _pop.value = 1;
    }
    _scheduleBlink();
    _scheduleGlance();
  }

  // Eyes dart to a new spot now and then (a saccade), then rest — reads as alive, not mechanical.
  void _scheduleGlance() {
    _glanceTimer?.cancel();
    _glanceTimer = Timer(Duration(milliseconds: 1400 + _rand.nextInt(2600)), () {
      if (!mounted) return;
      if (!_still) {
        _lookFrom = _currentLook;
        _lookTo = _rand.nextDouble() < 0.35
            ? Offset.zero
            : Offset((_rand.nextDouble() * 2 - 1) * 2.4, (_rand.nextDouble() * 2 - 1) * 1.4);
        _glance.forward(from: 0);
      }
      _scheduleGlance();
    });
  }

  Offset get _currentLook => Offset.lerp(_lookFrom, _lookTo, Curves.easeOutCubic.transform(_glance.value))!;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (still != _still) {
      _still = still;
      if (still) {
        _loop.stop();
        _loop.value = 0;
        _pop.value = 1;
      } else {
        _loop.repeat();
      }
    }
  }

  @override
  void didUpdateWidget(Ricey old) {
    super.didUpdateWidget(old);
    if (old.mood != widget.mood && !_still) {
      _hop.forward(from: 0.35);
    }
  }

  void _scheduleBlink() {
    _blinkTimer?.cancel();
    _blinkTimer = Timer(Duration(milliseconds: 2200 + _rand.nextInt(2800)), () async {
      if (!mounted) return;
      if (!_still) {
        await _blink.forward(from: 0);
        if (!mounted) return;
        await _blink.reverse();
        // occasional double blink
        if (mounted && _rand.nextDouble() < 0.25) {
          await _blink.forward(from: 0);
          if (mounted) await _blink.reverse();
        }
      }
      if (mounted) _scheduleBlink();
    });
  }

  void _tap() {
    if (_hop.isAnimating) return;
    HapticFeedback.lightImpact();
    _hop.forward(from: 0);
  }

  @override
  void dispose() {
    _blinkTimer?.cancel();
    _glanceTimer?.cancel();
    _glance.dispose();
    _loop.dispose();
    _blink.dispose();
    _hop.dispose();
    _pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final painter = AnimatedBuilder(
      animation: Listenable.merge([_loop, _blink, _hop, _pop, _glance]),
      builder: (context, _) => CustomPaint(
        size: Size(widget.size, widget.size * 1.1),
        painter: RiceyPainter(
          mood: widget.mood,
          phase: _loop.value,
          blink: Curves.easeIn.transform(_blink.value),
          hop: _hop.value,
          pop: _pop.value,
          glance: _currentLook,
          bubbleColor: context.pal.surface,
          bubbleBorder: context.pal.line,
        ),
      ),
    );
    return Semantics(
      label: widget.semanticLabel ?? '$mascotName มาสคอตของ Rice AI',
      image: true,
      child: widget.interactive
          ? GestureDetector(behavior: HitTestBehavior.opaque, onTap: _tap, child: painter)
          : painter,
    );
  }
}

/// Pure painter so Ricey can also be drawn statically (icons, tests).
class RiceyPainter extends CustomPainter {
  RiceyPainter({
    required this.mood,
    this.phase = 0,
    this.blink = 0,
    this.hop = 0,
    this.pop = 1,
    this.bubbleColor = Colors.white,
    this.bubbleBorder = const Color(0xFFE4DFD3),
    this.glance = Offset.zero,
  });

  /// Where the eyes are looking, in viewBox units (about ±2.5).
  final Offset glance;

  final RiceyMood mood;

  /// 0..1 position in the idle loop.
  final double phase;

  /// 0 = eyes open, 1 = shut.
  final double blink;

  /// 0..1 progress of a tap hop (0 and 1 = grounded).
  final double hop;

  /// 0..1 entrance pop.
  final double pop;
  final Color bubbleColor;
  final Color bubbleBorder;

  static final Map<String, Path> _cache = {};
  double _scale = 1;
  static Path _path(String d) => _cache.putIfAbsent(d, () => _parse(d));

  // Viewbox with margin for props that stick out (magnifier, Zzz, sparkles).
  static const _vb = Rect.fromLTWH(-6, -10, 212, 232);

  @override
  void paint(Canvas canvas, Size size) {
    final spec = _moods[mood]!;
    final a = phase * math.pi * 2;
    final s = size.width / _vb.width;
    _scale = s;

    // hop: anticipation squash, leap, landing squash
    double lift = 0, squash = 0;
    if (hop > 0 && hop < 1) {
      if (hop < 0.18) {
        squash = math.sin(hop / 0.18 * math.pi) * 0.08;
      } else if (hop < 0.78) {
        final t = (hop - 0.18) / 0.6;
        lift = math.sin(t * math.pi) * 22;
        squash = -math.sin(t * math.pi) * 0.05;
      } else {
        final t = (hop - 0.78) / 0.22;
        squash = math.sin(t * math.pi) * 0.07 * (1 - t);
      }
    }
    // per-mood idle
    double bob = 0, breath = math.sin(a) * 0.018, shiver = 0;
    switch (mood) {
      case RiceyMood.joy:
        final j = math.sin(a * 2).abs();
        bob = j * 9;
        squash += (1 - j) * 0.03;
      case RiceyMood.sleep:
        breath = math.sin(a) * 0.035;
      case RiceyMood.worried:
        shiver = math.sin(a * 14) * 0.6;
      case RiceyMood.hello:
        bob = (math.sin(a * 2) * 0.5 + 0.5) * 2.5;
      default:
        bob = (math.sin(a) * 0.5 + 0.5) * 2;
    }
    final up = lift + bob;
    final popS = pop >= 1 ? 1.0 : Curves.elasticOut.transform(pop.clamp(0.0, 1.0));

    canvas.save();
    canvas.scale(s);
    canvas.translate(-_vb.left, -_vb.top);
    // entrance pop around the feet
    canvas.translate(100, 210);
    canvas.scale(popS);
    canvas.translate(-100, -210);

    // shadow shrinks as Ricey rises
    canvas.save();
    final sh = 1 - (up / 40).clamp(0.0, 0.5);
    canvas.translate(100, 210);
    canvas.scale(sh, 1);
    canvas.translate(-100, -210);
    _draw(canvas, _shadow, opacityMul: sh);
    canvas.restore();

    canvas.translate(shiver, -up);
    // squash & stretch + breath, anchored at the feet
    canvas.translate(100, 206);
    canvas.scale(1 + squash - breath * 0.6, 1 - squash + breath);
    canvas.translate(-100, -206);

    if (spec.props.contains('sparkles')) _sparkles(canvas, a);

    _draw(canvas, _feet);
    _draw(canvas, _backLeaves);
    _draw(canvas, _body);
    _draw(canvas, _bodyShine);

    final follow = hop > 0 && hop < 1 ? math.sin(hop * math.pi * 2.2) * math.exp(-hop * 2.4) * 14 : 0.0;
    _rotated(canvas, const Offset(101, 31), math.sin(a + 0.6) * 4.5 - follow, () => _draw(canvas, _panicle));
    _rotated(canvas, const Offset(100, 34), math.sin(a + 1.4) * 3.5 - follow * 0.5, () => _draw(canvas, _sprout));

    _face(canvas, spec, a);

    _draw(canvas, _cloak);
    _label(canvas);

    final armLA = _armAngle('L', spec.armL, a);
    final armRA = _armAngle('R', spec.armR, a);
    for (final p in spec.props) {
      if (p == 'magnifier' || p == 'phone') {
        final pivot = p == 'magnifier' ? _shoulderR : _shoulderL;
        final delta = p == 'magnifier' ? armRA - _armPose['R']![spec.armR]! : armLA - _armPose['L']![spec.armL]!;
        _rotated(canvas, pivot, delta, () => _draw(canvas, _props[p]!));
      }
    }
    _limb(canvas, _shoulderL, armLA, flip: true);
    _limb(canvas, _shoulderR, armRA);
    if (spec.props.contains('shield')) {
      _rotated(canvas, _shoulderL, armLA - _armPose['L']![spec.armL]!, () => _draw(canvas, _props['shield']!));
    }
    if (spec.props.contains('question')) _question(canvas, a);
    if (spec.props.contains('zzz')) _zzz(canvas);
    canvas.restore();
  }

  double _armAngle(String side, String pose, double a) {
    final base = _armPose[side]![pose]!;
    final sign = side == 'L' ? 1.0 : -1.0;
    switch (pose) {
      case 'wave':
        return base + math.sin(a * 4) * 22;
      case 'up':
        return base + sign * math.sin(a * 2) * 12;
      case 'hold':
        return base + math.sin(a) * 6;
      case 'thumb':
        return base + math.sin(a * 2) * 5;
      case 'chin':
        return base + math.sin(a) * 3;
      default:
        return base + sign * math.sin(a) * 4;
    }
  }

  void _face(Canvas canvas, _MoodSpec spec, double a) {
    canvas.save();
    canvas.translate(0, _faceDy);
    _draw(canvas, _cheeks, opacityMul: mood == RiceyMood.worried ? 0.4 : 1);
    // eyes wander a little; think looks up-right
    final look = switch (mood) {
      RiceyMood.think => const Offset(2.2, -2.4),
      RiceyMood.scan => Offset(math.sin(a) * 1.4 + 1, 0),
      RiceyMood.worried => const Offset(0, 1),
      _ => glance,
    };
    for (final (side, center, shapes) in [('L', _eyeL, _eyesL), ('R', _eyeR, _eyesR)]) {
      final kind = spec.eyes;
      final list = shapes[kind]!;
      final isOpen = kind == 'open' || (kind == 'wink' && side == 'L');
      canvas.save();
      if (isOpen) {
        canvas.translate(look.dx, look.dy);
        if (blink > 0) {
          canvas.translate(center.dx, center.dy + 3);
          canvas.scale(1, 1 - blink * 0.9);
          canvas.translate(-center.dx, -center.dy - 3);
        }
      }
      _draw(canvas, list);
      canvas.restore();
    }
    _draw(canvas, _brows[spec.brows]!);
    // talkative mouth: tiny open/close for happy moods
    final m = _mouths[spec.mouth]!;
    if (spec.mouth == 'open' || spec.mouth == 'big') {
      _scaled(canvas, const Offset(100, 123), 1, 0.92 + (math.sin(a * 2) * 0.5 + 0.5) * 0.12, () => _draw(canvas, m));
    } else {
      _draw(canvas, m);
    }
    canvas.restore();
  }

  void _limb(Canvas canvas, Offset shoulder, double deg, {bool flip = false}) {
    canvas.save();
    canvas.translate(shoulder.dx, shoulder.dy);
    canvas.rotate(deg * math.pi / 180);
    if (flip) canvas.scale(-1, 1);
    _draw(canvas, _arm);
    canvas.restore();
  }

  void _sparkles(Canvas canvas, double a) {
    final list = _props['sparkles']!;
    for (var i = 0; i < list.length; i++) {
      final c = _path(list[i].d).getBounds().center;
      final t = (math.sin(a * 2 + i * 1.7) * 0.5 + 0.5);
      _scaled(canvas, c, 0.55 + t * 0.6, 0.55 + t * 0.6, () => _draw(canvas, [list[i]], opacityMul: 0.35 + t * 0.65));
    }
  }

  void _question(Canvas canvas, double a) {
    canvas.save();
    canvas.translate(0, math.sin(a * 2) * 2.5);
    const c = Offset(170, 50);
    canvas.drawCircle(c, 17, Paint()..color = bubbleColor);
    canvas.drawCircle(
        c,
        17,
        Paint()
          ..color = bubbleBorder
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2);
    canvas.drawCircle(const Offset(152, 66), 4, Paint()..color = bubbleColor);
    canvas.drawCircle(
        const Offset(152, 66),
        4,
        Paint()
          ..color = bubbleBorder
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6);
    _text(canvas, '?', c, 22, const Color(0xFF6FAE2C));
    canvas.restore();
  }

  void _zzz(Canvas canvas) {
    for (var i = 0; i < 3; i++) {
      final t = (phase + i / 3) % 1;
      final o = Offset(146 + t * 34 + math.sin(t * 6) * 3, 66 - t * 54);
      final op = t < 0.15 ? t / 0.15 : (t > 0.75 ? (1 - t) / 0.25 : 1.0);
      _text(canvas, 'z', o, 12 + t * 14, const Color(0xFF6FAE2C).withOpacity(op.clamp(0.0, 1.0)));
    }
  }

  /// Name lettering on the sash — pre-outlined Nunito Black from the generator,
  /// so it looks the same on every device without loading a font.
  void _label(Canvas canvas) => _draw(canvas, _sashText);

  void _text(Canvas canvas, String t, Offset center, double size, Color color, {double spacing = 0}) {
    final tp = TextPainter(
      text: TextSpan(
        text: t,
        style: TextStyle(
            fontSize: size, fontWeight: FontWeight.w900, color: color, letterSpacing: spacing, height: 1),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  void _rotated(Canvas canvas, Offset pivot, double deg, VoidCallback draw) {
    canvas.save();
    canvas.translate(pivot.dx, pivot.dy);
    canvas.rotate(deg * math.pi / 180);
    canvas.translate(-pivot.dx, -pivot.dy);
    draw();
    canvas.restore();
  }

  void _scaled(Canvas canvas, Offset pivot, double sx, double sy, VoidCallback draw) {
    canvas.save();
    canvas.translate(pivot.dx, pivot.dy);
    canvas.scale(sx, sy);
    canvas.translate(-pivot.dx, -pivot.dy);
    draw();
    canvas.restore();
  }

  static const _bodyShader = RadialGradient(
    center: Alignment(-0.24, -0.36),
    radius: 0.75,
    colors: [Color(0xFFFFFFFF), Color(0xFFFFF9EA), Color(0xFFEEDFBC)],
    stops: [0, 0.55, 1],
  );

  void _draw(Canvas canvas, List<RShape> shapes, {double opacityMul = 1}) {
    for (final sh in shapes) {
      final path = _path(sh.d);
      final op = (sh.op * opacityMul).clamp(0.0, 1.0);
      if (sh.body) {
        canvas.drawPath(path, Paint()..shader = _bodyShader.createShader(path.getBounds()));
      } else if (sh.fill != null) {
        final paint = Paint();
        if (sh.fill2 != null) {
          final b = path.getBounds();
          paint.shader = ui.Gradient.linear(
            b.topCenter,
            b.bottomCenter,
            [Color(sh.fill!).withOpacity(op), Color(sh.fill2!).withOpacity(op)],
          );
        } else {
          paint.color = Color(sh.fill!).withOpacity(op);
        }
        if (sh.blur > 0) paint.maskFilter = MaskFilter.blur(BlurStyle.normal, sh.blur * _scale);
        canvas.drawPath(path, paint);
      }
      if (sh.stroke != null) {
        canvas.drawPath(
          path,
          Paint()
            ..color = Color(sh.stroke!).withOpacity(op)
            ..style = PaintingStyle.stroke
            ..strokeWidth = sh.sw
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round,
        );
      }
    }
  }

  @override
  bool shouldRepaint(RiceyPainter oldDelegate) =>
      oldDelegate.mood != mood ||
      oldDelegate.phase != phase ||
      oldDelegate.blink != blink ||
      oldDelegate.hop != hop ||
      oldDelegate.pop != pop ||
      oldDelegate.glance != glance ||
      oldDelegate.bubbleColor != bubbleColor;
}

/// One shape of the mascot rig.
class RShape {
  const RShape(this.d, {this.fill, this.fill2, this.stroke, this.sw = 0, this.op = 1, this.blur = 0, this.body = false});
  final String d;
  final int? fill;

  /// Bottom colour of a vertical gradient over the shape's bounds.
  final int? fill2;
  final int? stroke;
  final double sw;
  final double op;

  /// Gaussian blur sigma in viewBox units (soft shading, blush, ground shadow).
  final double blur;

  /// Filled with the body gradient instead of a flat colour.
  final bool body;
}

/// Minimal parser for the absolute M/L/Q/C/Z paths the generator emits.
Path _parse(String d) {
  final path = Path();
  final tokens = RegExp(r'[MLQCZ]|-?\d*\.?\d+').allMatches(d).map((m) => m.group(0)!).toList();
  var i = 0;
  String cmd = 'M';
  double n() => double.parse(tokens[i++]);
  while (i < tokens.length) {
    final t = tokens[i];
    if (RegExp(r'^[MLQCZ]$').hasMatch(t)) {
      cmd = t;
      i++;
      if (cmd == 'Z') {
        path.close();
        continue;
      }
    }
    switch (cmd) {
      case 'M':
        path.moveTo(n(), n());
        cmd = 'L';
      case 'L':
        path.lineTo(n(), n());
      case 'Q':
        path.quadraticBezierTo(n(), n(), n(), n());
      case 'C':
        path.cubicTo(n(), n(), n(), n(), n(), n());
      default:
        i++;
    }
  }
  return path;
}

/// Static head-and-shoulders Ricey in a rounded tile — for list rows such as
/// notifications, where dozens of animated mascots would waste battery.
class RiceyAvatar extends StatelessWidget {
  const RiceyAvatar({super.key, required this.mood, this.size = 44, this.tone});
  final RiceyMood mood;
  final double size;

  /// Tile background tint; defaults to the soft primary colour.
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final w = size * 1.55;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: (tone ?? p.primary).withOpacity(0.12),
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            left: (size - w) / 2,
            top: -w * 0.2,
            child: CustomPaint(size: Size(w, w * 1.1), painter: RiceyPainter(mood: mood)),
          ),
        ],
      ),
    );
  }
}

/// Ricey with a speech bubble — tips, greetings and status lines.
class RiceyTip extends StatelessWidget {
  const RiceyTip({
    super.key,
    required this.message,
    this.title,
    this.mood = RiceyMood.happy,
    this.size = 76,
    this.onTap,
    this.tone,
  });

  final String message;
  final String? title;
  final RiceyMood mood;
  final double size;
  final VoidCallback? onTap;

  /// Bubble accent; defaults to primary.
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final accent = tone ?? p.primary;
    final bubble = Container(
      padding: const EdgeInsets.fromLTRB(14, 11, 14, 12),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(18),
          topRight: Radius.circular(18),
          bottomRight: Radius.circular(18),
          bottomLeft: Radius.circular(6),
        ),
        border: Border.all(color: p.line),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(title!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: accent)),
            ),
          _TypeIn(
            text: message,
            style: TextStyle(fontSize: 13.5, height: 1.45, color: p.ink, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Ricey(mood: mood, size: size),
        const SizedBox(width: 6),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: size * 0.32),
            child: onTap == null ? bubble : GestureDetector(onTap: onTap, child: bubble),
          ),
        ),
      ],
    );
  }
}

/// Reveals text character by character (whole grapheme clusters, so Thai
/// vowels and tone marks never render detached).
class _TypeIn extends StatefulWidget {
  const _TypeIn({required this.text, required this.style});
  final String text;
  final TextStyle style;

  @override
  State<_TypeIn> createState() => _TypeInState();
}

class _TypeInState extends State<_TypeIn> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  late List<String> _chars;

  @override
  void initState() {
    super.initState();
    _chars = widget.text.characters.toList();
    _c = AnimationController(vsync: this, duration: Duration(milliseconds: (_chars.length * 22).clamp(300, 1600)))
      ..forward();
  }

  @override
  void didUpdateWidget(_TypeIn old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) {
      _chars = widget.text.characters.toList();
      _c.duration = Duration(milliseconds: (_chars.length * 22).clamp(300, 1600));
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return Text(widget.text, style: widget.style);
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final n = (_chars.length * _c.value).ceil();
        // Keep the full text laid out (transparent tail) so the bubble does not grow line by line.
        return Text.rich(
          TextSpan(children: [
            TextSpan(text: _chars.take(n).join()),
            TextSpan(text: _chars.skip(n).join(), style: const TextStyle(color: Colors.transparent)),
          ]),
          style: widget.style,
        );
      },
    );
  }
}
