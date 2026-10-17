import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:remixicon/remixicon.dart';

import '../theme/app_theme.dart';
import 'ricey.dart';

export 'ricey.dart' show Ricey, RiceyAvatar, RiceyMood, RiceyTip, mascotName, mascotNameEn;

// ═════════════════════════════════════════════════════════════════════════════
// Tones
// ═════════════════════════════════════════════════════════════════════════════

enum Tone { primary, danger, warn, safe, info, neutral }

extension ToneColors on BuildContext {
  /// (foreground, soft background) for a tone.
  (Color, Color) tone(Tone t) {
    final p = pal;
    return switch (t) {
      Tone.primary => (p.primaryText, p.primarySoft),
      Tone.danger => (p.danger, p.dangerSoft),
      Tone.warn => (p.warn, p.warnSoft),
      Tone.safe => (p.safe, p.safeSoft),
      Tone.info => (p.info, p.infoSoft),
      Tone.neutral => (p.body, p.subtle),
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Motion helpers
// ═════════════════════════════════════════════════════════════════════════════

bool reduceMotion(BuildContext context) => MediaQuery.of(context).disableAnimations;

/// Fades and rises its child into place after [delay].
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 520),
    this.offset = 18,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final double offset;

  /// Convenience for list items: [index] × 60ms.
  factory FadeSlideIn.stagger(int index, {Key? key, required Widget child, int baseMs = 0}) {
    return FadeSlideIn(key: key, delay: Duration(milliseconds: baseMs + 60 * index.clamp(0, 10)), child: child);
  }

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _curve = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) _ctrl.value = 1;
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curve,
      child: widget.child,
      builder: (_, child) => Opacity(
        opacity: _curve.value,
        child: Transform.translate(offset: Offset(0, (1 - _curve.value) * widget.offset), child: child),
      ),
    );
  }
}

/// Number that counts up from 0 whenever [value] changes.
class CountUp extends StatelessWidget {
  const CountUp({super.key, required this.value, this.style, this.suffix = '', this.decimals = 0});

  final num value;
  final TextStyle? style;
  final String suffix;
  final int decimals;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: reduceMotion(context) ? Duration.zero : const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => Text('${v.toStringAsFixed(decimals)}$suffix', style: style),
    );
  }
}

/// Repeating 0→1 pulse, handy for live dots.
class PulseDot extends StatefulWidget {
  const PulseDot({super.key, required this.color, this.size = 8});
  final Color color;
  final double size;

  @override
  State<PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

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
    final s = widget.size;
    return SizedBox.square(
      dimension: s * 2.6,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) => Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: s + s * 1.6 * _ctrl.value,
              height: s + s * 1.6 * _ctrl.value,
              decoration:
                  BoxDecoration(shape: BoxShape.circle, color: widget.color.withOpacity(0.35 * (1 - _ctrl.value))),
            ),
            Container(width: s, height: s, decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color)),
          ],
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Press feedback
// ═════════════════════════════════════════════════════════════════════════════

class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.scale = 0.97, this.haptic = true});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final bool haptic;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap == null || _down == v) return;
    setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.lightImpact();
              widget.onTap!();
            },
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Buttons
// ═════════════════════════════════════════════════════════════════════════════

enum ButtonKind { primary, secondary, danger, soft }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.kind = ButtonKind.primary,
    this.icon,
    this.trailingIcon,
    this.busy = false,
    this.busyLabel,
    this.height = 54,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonKind kind;
  final IconData? icon;
  final IconData? trailingIcon;
  final bool busy;
  final String? busyLabel;
  final double height;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final enabled = onPressed != null && !busy;
    final (bg, fg, border) = switch (kind) {
      ButtonKind.primary => (p.primary, Colors.white, Colors.transparent),
      ButtonKind.secondary => (p.surface, p.ink, p.line),
      ButtonKind.danger => (p.surface, p.danger, p.danger.withOpacity(0.35)),
      ButtonKind.soft => (p.subtle, p.ink, Colors.transparent),
    };

    final content = AnimatedSwitcher(
      duration: const Duration(milliseconds: 240),
      transitionBuilder: (c, a) => FadeTransition(
        opacity: a,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.35), end: Offset.zero).animate(a), child: c),
      ),
      child: busy
          ? Row(
              key: const ValueKey('busy'),
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2.3, color: fg)),
                if (busyLabel != null) ...[
                  const SizedBox(width: 12),
                  Flexible(child: _label(busyLabel!, fg)),
                ],
              ],
            )
          : Row(
              key: const ValueKey('idle'),
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[Icon(icon, size: 20, color: fg), const SizedBox(width: 10)],
                Flexible(child: _label(label, fg)),
                if (trailingIcon != null) ...[const SizedBox(width: 10), Icon(trailingIcon, size: 19, color: fg)],
              ],
            ),
    );

    return Pressable(
      onTap: enabled ? onPressed : null,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: onPressed == null && !busy ? 0.5 : 1,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          height: height,
          width: expand ? double.infinity : null,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border, width: 1.5),
            boxShadow: kind == ButtonKind.primary && enabled
                ? [BoxShadow(color: p.primary.withOpacity(0.24), blurRadius: 22, offset: const Offset(0, 10))]
                : const [],
          ),
          alignment: Alignment.center,
          child: content,
        ),
      ),
    );
  }

  Widget _label(String text, Color color) => Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: color, fontSize: 15.5, fontWeight: FontWeight.w600),
      );
}

/// Square icon-only button (back, close, edit…).
class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.size = 44,
    this.filled = false,
    this.badge,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String tooltip;
  final double size;
  final bool filled;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Semantics(
      button: true,
      label: tooltip,
      child: Pressable(
        onTap: onPressed,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: filled ? p.primary : p.surface,
                borderRadius: BorderRadius.circular(size * 0.32),
                border: Border.all(color: filled ? p.primary : p.line, width: 1.5),
              ),
              child: Icon(icon, size: 21, color: filled ? Colors.white : p.ink),
            ),
            if (badge != null && badge! > 0)
              Positioned(
                top: -5,
                right: -5,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.elasticOut,
                  builder: (_, v, child) => Transform.scale(scale: v, child: child),
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 20),
                    height: 20,
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: p.bg, width: 2),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      badge! > 9 ? '9+' : '$badge',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700, height: 1),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class AppBackButton extends StatelessWidget {
  const AppBackButton({super.key, this.onPressed});
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return AppIconButton(
      icon: Remix.arrow_left_s_line,
      tooltip: 'ย้อนกลับ',
      onPressed: onPressed ?? () => Navigator.maybePop(context),
    );
  }
}

class GoogleButton extends StatelessWidget {
  const GoogleButton({super.key, required this.label, required this.onPressed});
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Pressable(
      onTap: onPressed,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: onPressed == null ? 0.5 : 1,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            color: p.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: p.line, width: 1.5),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CustomPaint(size: Size.square(19), painter: _GoogleLogoPainter()),
              const SizedBox(width: 12),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final stroke = s * 0.2;
    final r = (s - stroke) / 2;
    final c = Offset(s / 2, s / 2);
    final rect = Rect.fromCircle(center: c, radius: r);
    double rad(double deg) => deg * math.pi / 180;

    void arc(Color color, double start, double sweep) {
      canvas.drawArc(
        rect,
        rad(start),
        rad(sweep),
        false,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke,
      );
    }

    arc(const Color(0xFFEA4335), 200, 118);
    arc(const Color(0xFFFBBC05), 145, 56);
    arc(const Color(0xFF34A853), 40, 106);
    arc(const Color(0xFF4285F4), 0, 41);
    canvas.drawRect(
      Rect.fromLTRB(c.dx, c.dy - stroke / 2, c.dx + r + stroke / 2, c.dy + stroke / 2),
      Paint()..color = const Color(0xFF4285F4),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ═════════════════════════════════════════════════════════════════════════════
// Text fields
// ═════════════════════════════════════════════════════════════════════════════

/// Field with its label above, matching the brand form style.
class AppField extends StatefulWidget {
  const AppField({
    super.key,
    required this.controller,
    this.label,
    this.labelAction,
    this.hint,
    this.icon,
    this.focusNode,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
    this.onChanged,
    this.autofillHints,
    this.enabled = true,
    this.hasError = false,
    this.trailing,
    this.maxLines = 1,
    this.textCapitalization = TextCapitalization.none,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final String? label;
  final Widget? labelAction;
  final String? hint;
  final IconData? icon;
  final FocusNode? focusNode;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final Iterable<String>? autofillHints;
  final bool enabled;
  final bool hasError;
  final Widget? trailing;
  final int maxLines;
  final TextCapitalization textCapitalization;
  final bool autofocus;

  @override
  State<AppField> createState() => _AppFieldState();
}

class _AppFieldState extends State<AppField> {
  late final FocusNode _focus = widget.focusNode ?? FocusNode();
  bool _hidden = true;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocus);
  }

  void _onFocus() => setState(() {});

  @override
  void dispose() {
    _focus.removeListener(_onFocus);
    if (widget.focusNode == null) _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final focused = _focus.hasFocus;
    final error = widget.hasError;
    final borderColor = error ? p.danger : (focused ? p.primary : p.line);
    const none = InputBorder.none;

    final box = AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.only(
          left: widget.icon != null ? 14 : 16, right: widget.obscure || widget.trailing != null ? 4 : 14),
      constraints: BoxConstraints(minHeight: widget.maxLines > 1 ? 96 : 52),
      decoration: BoxDecoration(
        color: error ? p.dangerSoft.withOpacity(0.55) : p.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: (error ? p.danger : p.primary).withOpacity(focused ? 0.10 : 0),
            blurRadius: 0,
            spreadRadius: 4,
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: widget.maxLines > 1 ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          if (widget.icon != null) ...[
            Padding(
              padding: EdgeInsets.only(top: widget.maxLines > 1 ? 15 : 0),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Icon(
                  widget.icon,
                  key: ValueKey('$focused$error'),
                  size: 20,
                  color: error ? p.danger : (focused ? p.primaryText : p.muted),
                ),
              ),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              enabled: widget.enabled,
              autofocus: widget.autofocus,
              obscureText: widget.obscure && _hidden,
              keyboardType: widget.keyboardType,
              textInputAction: widget.textInputAction,
              onSubmitted: widget.onSubmitted,
              onChanged: widget.onChanged,
              autofillHints: widget.autofillHints,
              autocorrect: false,
              enableSuggestions: !widget.obscure,
              maxLines: widget.obscure ? 1 : widget.maxLines,
              textCapitalization: widget.textCapitalization,
              cursorColor: p.primary,
              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w500, color: p.ink),
              decoration: InputDecoration(
                hintText: widget.hint,
                hintStyle: TextStyle(color: p.faint, fontSize: 15, fontWeight: FontWeight.w400),
                filled: false,
                isDense: true,
                border: none,
                enabledBorder: none,
                focusedBorder: none,
                disabledBorder: none,
                contentPadding: const EdgeInsets.symmetric(vertical: 15),
              ),
            ),
          ),
          if (widget.trailing != null) widget.trailing!,
          if (widget.obscure)
            IconButton(
              tooltip: _hidden ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน',
              onPressed: () {
                HapticFeedback.selectionClick();
                setState(() => _hidden = !_hidden);
              },
              icon: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                transitionBuilder: (c, a) => ScaleTransition(scale: a, child: FadeTransition(opacity: a, child: c)),
                child: Icon(
                  _hidden ? Remix.eye_off_line : Remix.eye_line,
                  key: ValueKey(_hidden),
                  size: 20,
                  color: p.muted,
                ),
              ),
            ),
        ],
      ),
    );

    if (widget.label == null) return box;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                widget.label!,
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: error ? p.danger : p.ink),
              ),
            ),
            if (widget.labelAction != null) widget.labelAction!,
          ],
        ),
        const SizedBox(height: 8),
        box,
      ],
    );
  }
}

/// Text link styled for inline actions.
class AppLink extends StatelessWidget {
  const AppLink({super.key, required this.label, required this.onTap, this.underline = false, this.size = 13.5});
  final String label;
  final VoidCallback? onTap;
  final bool underline;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Pressable(
      onTap: onTap,
      haptic: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
        child: Text(
          label,
          style: TextStyle(
            fontSize: size,
            fontWeight: FontWeight.w700,
            color: p.primaryText,
            decoration: underline ? TextDecoration.underline : null,
            decorationColor: p.primaryText,
            decorationThickness: 1.6,
          ),
        ),
      ),
    );
  }
}

/// 4-bar strength meter for a password field.
class PasswordStrength extends StatelessWidget {
  const PasswordStrength({super.key, required this.password});
  final String password;

  static int score(String s) {
    if (s.isEmpty) return 0;
    var n = 0;
    if (s.length >= 6) n++;
    if (s.length >= 10) n++;
    if (RegExp(r'[0-9]').hasMatch(s) && RegExp(r'[A-Za-zก-๙]').hasMatch(s)) n++;
    if (RegExp(r'[^A-Za-z0-9ก-๙]').hasMatch(s) || RegExp(r'[A-Z]').hasMatch(s)) n++;
    return n.clamp(1, 4);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final s = score(password);
    final (label, color) = switch (s) {
      0 => ('', p.line),
      1 => ('อ่อน', p.danger),
      2 => ('พอใช้', p.warn),
      3 => ('ดี', p.safe),
      _ => ('แข็งแรงมาก', p.safe),
    };
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      child: password.isEmpty
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  for (var i = 0; i < 4; i++) ...[
                    Expanded(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 260),
                        height: 4,
                        decoration: BoxDecoration(
                          color: i < s ? color : p.line,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  SizedBox(
                    width: 62,
                    child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
                  ),
                ],
              ),
            ),
    );
  }
}

class AppSearchField extends StatelessWidget {
  const AppSearchField({super.key, required this.hint, required this.onChanged, this.controller});
  final String hint;
  final ValueChanged<String> onChanged;
  final TextEditingController? controller;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: p.line, width: 1.5),
      ),
      child: Row(
        children: [
          Icon(Remix.search_line, size: 19, color: p.muted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              textInputAction: TextInputAction.search,
              style: TextStyle(fontSize: 15, color: p.ink),
              cursorColor: p.primary,
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: TextStyle(color: p.faint, fontSize: 14.5),
                filled: false,
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Surfaces
// ═════════════════════════════════════════════════════════════════════════════

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
    this.borderColor,
    this.radius = 20,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? p.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? p.line),
      ),
      child: child,
    );
    return onTap == null ? card : Pressable(onTap: onTap, scale: 0.985, child: card);
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.action, this.onAction, this.trailing});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: Text(title, style: AppText.display(18, color: p.ink))),
        if (trailing != null) trailing!,
        if (action != null && onAction != null) AppLink(label: action!, onTap: onAction),
      ],
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.tone, this.dot = true, this.icon});
  final String label;
  final Tone tone;
  final bool dot;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = context.tone(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null)
            Padding(padding: const EdgeInsets.only(right: 5), child: Icon(icon, size: 13, color: fg))
          else if (dot)
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
          Text(label, style: TextStyle(color: fg, fontSize: 11.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, required this.tone, this.size = 40, this.iconSize});
  final IconData icon;
  final Tone tone;
  final double size;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = context.tone(tone);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(size * 0.3)),
      child: Icon(icon, color: fg, size: iconSize ?? size * 0.5),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action, this.mascot});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  /// Shows animated Ricey in this mood instead of the icon tile.
  final RiceyMood? mascot;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (mascot != null)
            Ricey(mood: mascot!, size: 112)
          else
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: p.subtle, borderRadius: BorderRadius.circular(20)),
              child: Icon(icon, size: 30, color: p.muted),
            ),
          SizedBox(height: mascot != null ? 6 : 14),
          Text(title,
              textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.ink)),
          if (message != null) ...[
            const SizedBox(height: 4),
            Text(message!, textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: p.muted, height: 1.5)),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

/// Shimmering placeholder block for loading states.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 14, this.radius = 8});
  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))
    ..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final t = _ctrl.value * 3 - 1;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(t - 1, 0),
              end: Alignment(t + 1, 0),
              colors: [p.subtle, p.line.withOpacity(0.9), p.subtle],
            ),
          ),
        );
      },
    );
  }
}

/// A list row skeleton: tile + two lines.
class SkeletonRow extends StatelessWidget {
  const SkeletonRow({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Row(
        children: [
          Skeleton(width: 42, height: 42, radius: 12),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [Skeleton(width: 140, height: 13), SizedBox(height: 8), Skeleton(width: 90, height: 11)],
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Selection controls
// ═════════════════════════════════════════════════════════════════════════════

/// Pill segmented control with a sliding thumb.
class SegmentedTabs extends StatelessWidget {
  const SegmentedTabs({
    super.key,
    required this.labels,
    required this.index,
    required this.onChanged,
    this.icons,
    this.compact = false,
  });

  final List<String> labels;
  final List<IconData>? icons;
  final int index;
  final ValueChanged<int> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final n = labels.length;
    return Container(
      height: compact ? 44 : 46,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: p.subtle, borderRadius: BorderRadius.circular(14)),
      child: LayoutBuilder(
        builder: (_, c) {
          final w = c.maxWidth / n;
          return Stack(
            children: [
              AnimatedPositioned(
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeOutBack,
                left: w * index,
                top: 0,
                bottom: 0,
                width: w,
                child: Container(
                  decoration: BoxDecoration(
                    color: p.surface,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 6, offset: const Offset(0, 2))
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < n; i++)
                    Expanded(
                      child: Semantics(
                        selected: i == index,
                        button: true,
                        label: labels[i],
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (i == index) return;
                            HapticFeedback.selectionClick();
                            onChanged(i);
                          },
                          child: Center(
                            child: compact && icons != null
                                ? Icon(icons![i], size: 19, color: i == index ? p.primaryText : p.muted)
                                : AnimatedDefaultTextStyle(
                                    duration: const Duration(milliseconds: 200),
                                    style: TextStyle(
                                      fontFamily: DefaultTextStyle.of(context).style.fontFamily,
                                      fontSize: 13.5,
                                      fontWeight: i == index ? FontWeight.w700 : FontWeight.w600,
                                      color: i == index ? p.primaryText : p.muted,
                                    ),
                                    child: Text(labels[i], maxLines: 1, overflow: TextOverflow.ellipsis),
                                  ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Horizontal choice chips.
class ChoiceChips extends StatelessWidget {
  const ChoiceChips({super.key, required this.options, required this.selected, required this.onSelected, this.padding});
  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelected;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          for (final o in options)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Pressable(
                onTap: () {
                  if (o == selected) return;
                  HapticFeedback.selectionClick();
                  onSelected(o);
                },
                haptic: false,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                  decoration: BoxDecoration(
                    color: o == selected ? p.primary : p.surface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: o == selected ? p.primary : p.line),
                  ),
                  child: Text(
                    o,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: o == selected ? Colors.white : p.body,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class AppSwitch extends StatelessWidget {
  const AppSwitch({super.key, required this.value, required this.onChanged, required this.label});
  final bool value;
  final ValueChanged<bool> onChanged;
  final String label;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Semantics(
      toggled: value,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onChanged(!value);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOutCubic,
          width: 50,
          height: 30,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: value ? p.primary : p.line,
            borderRadius: BorderRadius.circular(15),
          ),
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutBack,
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.18), blurRadius: 4, offset: const Offset(0, 1))
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Data display
// ═════════════════════════════════════════════════════════════════════════════

/// Animated circular gauge for AI confidence.
class ConfidenceRing extends StatelessWidget {
  const ConfidenceRing({super.key, required this.percent, this.size = 88, this.color});
  final double percent;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Semantics(
      label: 'ความมั่นใจ ${percent.toStringAsFixed(1)} เปอร์เซ็นต์',
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: (percent / 100).clamp(0, 1)),
        duration: reduceMotion(context) ? Duration.zero : const Duration(milliseconds: 1200),
        curve: Curves.easeOutCubic,
        builder: (_, v, __) => SizedBox.square(
          dimension: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: Size.square(size),
                painter: _RingPainter(value: v, track: p.subtle, color: color ?? p.primary),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${(v * 100).toStringAsFixed(1)}%',
                    style: TextStyle(fontSize: size * 0.2, fontWeight: FontWeight.w700, color: p.ink, height: 1.1),
                  ),
                  Text('มั่นใจ', style: TextStyle(fontSize: size * 0.12, color: p.muted)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.value, required this.track, required this.color});
  final double value;
  final Color track;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.09;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: (size.width - stroke) / 2);
    canvas.drawArc(
        rect,
        0,
        math.pi * 2,
        false,
        Paint()
          ..color = track
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke);
    canvas.drawArc(
        rect,
        -math.pi / 2,
        math.pi * 2 * value,
        false,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = stroke);
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.value != value || oldDelegate.color != color || oldDelegate.track != track;
}

/// Thin animated progress bar.
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.value, required this.color, this.height = 8});
  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Container(
        height: height,
        color: p.subtle,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: value.clamp(0, 1)),
          duration: reduceMotion(context) ? Duration.zero : const Duration(milliseconds: 900),
          curve: Curves.easeOutCubic,
          builder: (_, v, __) => FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: v,
            child: Container(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(height))),
          ),
        ),
      ),
    );
  }
}

/// Gold scan-frame corner brackets.
class CornerFramePainter extends CustomPainter {
  CornerFramePainter({this.color = AppColors.gold, this.length = 28, this.stroke = 3.5, this.inset = 0});
  final Color color;
  final double length;
  final double stroke;
  final double inset;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    final l = inset, t = inset, r = size.width - inset, b = size.height - inset;
    final path = Path()
      ..moveTo(l, t + length)
      ..lineTo(l, t)
      ..lineTo(l + length, t)
      ..moveTo(r - length, t)
      ..lineTo(r, t)
      ..lineTo(r, t + length)
      ..moveTo(r, b - length)
      ..lineTo(r, b)
      ..lineTo(r - length, b)
      ..moveTo(l + length, b)
      ..lineTo(l, b)
      ..lineTo(l, b - length);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CornerFramePainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.inset != inset;
}

// ═════════════════════════════════════════════════════════════════════════════
// Sheets & dialogs
// ═════════════════════════════════════════════════════════════════════════════

/// Brand bottom sheet: cream surface, grab handle, rounded top.
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool scrollControlled = true,
}) {
  HapticFeedback.lightImpact();
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: scrollControlled,
    backgroundColor: Colors.transparent,
    barrierColor: AppColors.forestDeep.withOpacity(0.45),
    builder: (ctx) => AppSheetFrame(child: builder(ctx)),
  );
}

class AppSheetFrame extends StatelessWidget {
  const AppSheetFrame({super.key, required this.child, this.height});
  final Widget child;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: p.sheet,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
              width: 42, height: 5, decoration: BoxDecoration(color: p.line, borderRadius: BorderRadius.circular(3))),
          Flexible(child: child),
        ],
      ),
    );
  }
}

/// Title row used at the top of sheets.
class SheetHeader extends StatelessWidget {
  const SheetHeader(
      {super.key, required this.title, this.subtitle, this.icon, this.tone = Tone.primary, this.trailing});
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Tone tone;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Row(
        children: [
          if (icon != null) ...[IconTile(icon: icon!, tone: tone, size: 42), const SizedBox(width: 12)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppText.display(20, color: p.ink)),
                if (subtitle != null) Text(subtitle!, style: TextStyle(fontSize: 12.5, color: p.muted)),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Centered brand dialog. Returns true when the confirm button is pressed.
Future<bool> showAppConfirm(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'ยกเลิก',
  IconData icon = Remix.question_line,
  Tone tone = Tone.primary,
  bool destructive = false,
  bool showCancel = true,
}) async {
  HapticFeedback.mediumImpact();
  final result = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: title,
    barrierColor: AppColors.forestDeep.withOpacity(0.45),
    transitionDuration: const Duration(milliseconds: 320),
    pageBuilder: (ctx, _, __) {
      final p = ctx.pal;
      return SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Material(
              color: p.sheet,
              borderRadius: BorderRadius.circular(26),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 24, 22, 18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconTile(icon: icon, tone: tone, size: 56),
                    const SizedBox(height: 14),
                    Text(title, textAlign: TextAlign.center, style: AppText.display(20, color: p.ink)),
                    const SizedBox(height: 6),
                    Text(message,
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: p.muted, height: 1.55)),
                    const SizedBox(height: 22),
                    Row(
                      children: [
                        if (showCancel) ...[
                          Expanded(
                            child: AppButton(
                              label: cancelLabel,
                              kind: ButtonKind.soft,
                              height: 50,
                              onPressed: () => Navigator.of(ctx).pop(false),
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: _DialogConfirmButton(
                            label: confirmLabel,
                            destructive: destructive,
                            onPressed: () => Navigator.of(ctx).pop(true),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
    transitionBuilder: (_, a, __, child) {
      final c = CurvedAnimation(parent: a, curve: Curves.easeOutBack, reverseCurve: Curves.easeInCubic);
      return FadeTransition(
        opacity: a,
        child: ScaleTransition(scale: Tween(begin: 0.9, end: 1.0).animate(c), child: child),
      );
    },
  );
  return result ?? false;
}

class _DialogConfirmButton extends StatelessWidget {
  const _DialogConfirmButton({required this.label, required this.destructive, required this.onPressed});
  final String label;
  final bool destructive;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Pressable(
      onTap: onPressed,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: destructive ? AppColors.danger : p.primary,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Non-dismissable progress dialog; close it with Navigator.pop.
void showAppProgress(BuildContext context, {required String title, String? message}) {
  showGeneralDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: AppColors.forestDeep.withOpacity(0.45),
    transitionDuration: const Duration(milliseconds: 260),
    pageBuilder: (ctx, _, __) {
      final p = ctx.pal;
      return PopScope(
        canPop: false,
        child: Center(
          child: Material(
            color: p.sheet,
            borderRadius: BorderRadius.circular(24),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox.square(dimension: 36, child: CircularProgressIndicator(strokeWidth: 3, color: p.primary)),
                  const SizedBox(height: 18),
                  Text(title, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: p.ink)),
                  if (message != null) ...[
                    const SizedBox(height: 4),
                    Text(message, style: TextStyle(fontSize: 13, color: p.muted)),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
    },
    transitionBuilder: (_, a, __, child) => FadeTransition(
      opacity: a,
      child: ScaleTransition(scale: Tween(begin: 0.92, end: 1.0).animate(a), child: child),
    ),
  );
}

/// Success dialog with an animated check; closes itself after [hold].
Future<void> showAppSuccess(
  BuildContext context, {
  required String title,
  required String message,
  Duration hold = const Duration(seconds: 2),
  RiceyMood? mascot,
}) async {
  HapticFeedback.mediumImpact();
  final nav = Navigator.of(context, rootNavigator: true);
  showGeneralDialog(
    context: context,
    barrierDismissible: false,
    barrierColor: AppColors.forestDeep.withOpacity(0.45),
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (ctx, _, __) {
      final p = ctx.pal;
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 36),
          child: Material(
            color: p.sheet,
            borderRadius: BorderRadius.circular(26),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 30, 24, 26),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (mascot != null) Ricey(mood: mascot, size: 120, interactive: false) else const _AnimatedCheck(),
                  SizedBox(height: mascot != null ? 8 : 18),
                  Text(title, textAlign: TextAlign.center, style: AppText.display(22, color: p.ink)),
                  const SizedBox(height: 6),
                  Text(message,
                      textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: p.muted, height: 1.55)),
                ],
              ),
            ),
          ),
        ),
      );
    },
    transitionBuilder: (_, a, __, child) => FadeTransition(
      opacity: a,
      child: ScaleTransition(
        scale: Tween(begin: 0.88, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutBack)),
        child: child,
      ),
    ),
  );
  await Future.delayed(hold);
  if (nav.mounted && nav.canPop()) nav.pop();
}

class _AnimatedCheck extends StatefulWidget {
  const _AnimatedCheck();

  @override
  State<_AnimatedCheck> createState() => _AnimatedCheckState();
}

class _AnimatedCheckState extends State<_AnimatedCheck> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..forward();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final pop = Curves.elasticOut.transform((_ctrl.value / 0.7).clamp(0, 1));
        final draw = Curves.easeOutCubic.transform(((_ctrl.value - 0.25) / 0.6).clamp(0, 1));
        return Transform.scale(
          scale: pop,
          child: Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: p.safeSoft,
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: p.safe.withOpacity(0.25), blurRadius: 24, spreadRadius: 2)],
            ),
            child: CustomPaint(painter: _CheckPainter(progress: draw, color: p.safe)),
          ),
        );
      },
    );
  }
}

class _CheckPainter extends CustomPainter {
  _CheckPainter({required this.progress, required this.color});
  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.3, size.height * 0.52)
      ..lineTo(size.width * 0.45, size.height * 0.66)
      ..lineTo(size.width * 0.71, size.height * 0.38);
    final metric = path.computeMetrics().first;
    canvas.drawPath(
      metric.extractPath(0, metric.length * progress),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _CheckPainter oldDelegate) => oldDelegate.progress != progress;
}

// ═════════════════════════════════════════════════════════════════════════════
// Feedback: shake, toast, PIN
// ═════════════════════════════════════════════════════════════════════════════

/// Shakes its child whenever [trigger] changes.
class ShakeOnChange extends StatefulWidget {
  const ShakeOnChange({super.key, required this.trigger, required this.child});
  final int trigger;
  final Widget child;

  @override
  State<ShakeOnChange> createState() => _ShakeOnChangeState();
}

class _ShakeOnChangeState extends State<ShakeOnChange> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 480));

  @override
  void didUpdateWidget(covariant ShakeOnChange old) {
    super.didUpdateWidget(old);
    if (old.trigger != widget.trigger) _ctrl.forward(from: 0);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      child: widget.child,
      builder: (_, child) {
        final t = _ctrl.value;
        final dx = math.sin(t * math.pi * 6) * 10 * (1 - t);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
    );
  }
}

enum ToastType { error, success, info }

/// Notification that drops from the status bar. Auto-dismisses with a
/// countdown bar; tap or swipe up to dismiss, hold to pause.
class AppToast {
  AppToast._();

  static GlobalKey<_ToastViewState>? _currentKey;

  static void show(
    BuildContext context, {
    required String title,
    required String message,
    ToastType type = ToastType.error,
    Duration duration = const Duration(milliseconds: 3600),
  }) {
    final overlay = Overlay.of(context, rootOverlay: true);
    _currentKey?.currentState?.dismiss();

    switch (type) {
      case ToastType.error:
        HapticFeedback.heavyImpact();
      case ToastType.success:
        HapticFeedback.mediumImpact();
      case ToastType.info:
        HapticFeedback.lightImpact();
    }

    final key = GlobalKey<_ToastViewState>();
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _ToastView(
        key: key,
        title: title,
        message: message,
        type: type,
        duration: duration,
        onDismissed: () {
          entry.remove();
          if (_currentKey == key) _currentKey = null;
        },
      ),
    );
    _currentKey = key;
    overlay.insert(entry);
  }

  // Errors carry something to read and act on, so they stay longer than confirmations.
  static void error(BuildContext context, String message, {String title = 'เกิดข้อผิดพลาด'}) =>
      show(context, title: title, message: message, duration: const Duration(seconds: 6));

  static void success(BuildContext context, String message, {String title = 'สำเร็จ'}) =>
      show(context, title: title, message: message, type: ToastType.success);

  static void info(BuildContext context, String message, {String title = 'แจ้งให้ทราบ'}) =>
      show(context, title: title, message: message, type: ToastType.info);

  static void hide() => _currentKey?.currentState?.dismiss();
}

class _ToastView extends StatefulWidget {
  const _ToastView({
    super.key,
    required this.title,
    required this.message,
    required this.type,
    required this.duration,
    required this.onDismissed,
  });

  final String title;
  final String message;
  final ToastType type;
  final Duration duration;
  final VoidCallback onDismissed;

  @override
  State<_ToastView> createState() => _ToastViewState();
}

class _ToastViewState extends State<_ToastView> with TickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 560),
    reverseDuration: const Duration(milliseconds: 280),
  );
  late final AnimationController _life = AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _slide =
      CurvedAnimation(parent: _enter, curve: Curves.easeOutBack, reverseCurve: Curves.easeInCubic);
  late final Animation<double> _iconPop =
      CurvedAnimation(parent: _enter, curve: const Interval(0.35, 1, curve: Curves.elasticOut));
  double _drag = 0;
  bool _dismissing = false;

  @override
  void initState() {
    super.initState();
    _enter.forward();
    _life.addStatusListener((s) {
      if (s == AnimationStatus.completed) dismiss();
    });
    _life.forward();
  }

  @override
  void dispose() {
    _enter.dispose();
    _life.dispose();
    super.dispose();
  }

  Future<void> dismiss() async {
    if (_dismissing || !mounted) return;
    _dismissing = true;
    _life.stop();
    await _enter.reverse().orCancel.catchError((_) {});
    widget.onDismissed();
  }

  void _onDragUpdate(DragUpdateDetails d) {
    if (_dismissing) return;
    _life.stop();
    setState(() {
      final next = _drag + d.delta.dy;
      _drag = next < 0 ? next : next * 0.35;
    });
  }

  void _onDragEnd(DragEndDetails d) {
    if (_dismissing) return;
    if (_drag < -24 || d.velocity.pixelsPerSecond.dy < -300) {
      dismiss();
    } else {
      setState(() => _drag = 0);
      _life.forward();
    }
  }

  (Color, IconData) get _style => switch (widget.type) {
        ToastType.error => (const Color(0xFFF2B8B0), Remix.error_warning_fill),
        ToastType.success => (const Color(0xFF8CD3A3), Remix.checkbox_circle_fill),
        ToastType.info => (const Color(0xFFE8C67A), Remix.information_fill),
      };

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + 8;
    final (accent, icon) = _style;

    return Positioned(
      top: top,
      left: 12,
      right: 12,
      child: Material(
        type: MaterialType.transparency,
        child: GestureDetector(
          onTap: dismiss,
          onLongPressStart: (_) => _life.stop(),
          onLongPressEnd: (_) {
            if (!_dismissing) _life.forward();
          },
          onVerticalDragUpdate: _onDragUpdate,
          onVerticalDragEnd: _onDragEnd,
          child: AnimatedBuilder(
            animation: _enter,
            builder: (_, child) {
              final dy = (1 - _slide.value) * -(top + 110) + _drag;
              return Opacity(
                opacity: _enter.value.clamp(0.0, 1.0),
                child: Transform.translate(
                  offset: Offset(0, dy),
                  child: Transform.scale(scale: 0.92 + 0.08 * _enter.value, child: child),
                ),
              );
            },
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 28, offset: const Offset(0, 12))
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.forestDeep.withOpacity(0.92),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 13, 14, 11),
                          child: Row(
                            children: [
                              ScaleTransition(
                                scale: _iconPop,
                                child: Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: accent.withOpacity(0.16),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(icon, color: accent, size: 21),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      widget.title,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14.5,
                                        fontWeight: FontWeight.w600,
                                        height: 1.3,
                                      ),
                                    ),
                                    const SizedBox(height: 1),
                                    Text(
                                      widget.message,
                                      style: const TextStyle(color: Color(0xFFC9DDCF), fontSize: 13, height: 1.4),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(Remix.close_line, size: 18, color: Colors.white.withOpacity(0.4)),
                            ],
                          ),
                        ),
                        AnimatedBuilder(
                          animation: _life,
                          builder: (_, __) => Align(
                            alignment: Alignment.centerLeft,
                            child: FractionallySizedBox(
                              widthFactor: 1 - _life.value,
                              child: Container(height: 3, color: accent.withOpacity(0.85)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 6-box one-time-code input backed by a single hidden TextField.
class PinCodeInput extends StatefulWidget {
  const PinCodeInput({
    super.key,
    required this.controller,
    required this.onCompleted,
    this.length = 6,
    this.hasError = false,
  });

  final TextEditingController controller;
  final ValueChanged<String> onCompleted;
  final int length;
  final bool hasError;

  @override
  State<PinCodeInput> createState() => _PinCodeInputState();
}

class _PinCodeInputState extends State<PinCodeInput> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_rebuild);
    _focus.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final text = widget.controller.text;

    return SizedBox(
      height: 60,
      child: Stack(
        children: [
          Row(
            children: List.generate(widget.length, (i) {
              final filled = i < text.length;
              final active =
                  _focus.hasFocus && (i == text.length || (i == widget.length - 1 && text.length == widget.length));
              final borderColor = widget.hasError
                  ? p.danger
                  : active
                      ? p.primary
                      : filled
                          ? p.primary.withOpacity(0.4)
                          : p.line;

              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    decoration: BoxDecoration(
                      color: filled ? p.primarySoft : p.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: borderColor, width: active ? 2 : 1.5),
                    ),
                    alignment: Alignment.center,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
                      child: filled
                          ? Text(
                              text[i],
                              key: ValueKey('$i${text[i]}'),
                              style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700, color: p.ink),
                            )
                          : active
                              ? _BlinkingCaret(key: const ValueKey('caret'), color: p.primary)
                              : const SizedBox.shrink(),
                    ),
                  ),
                ),
              );
            }),
          ),
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: widget.length,
                showCursor: false,
                enableInteractiveSelection: false,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  counterText: '',
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                ),
                onChanged: (v) {
                  HapticFeedback.selectionClick();
                  if (v.length == widget.length) widget.onCompleted(v);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BlinkingCaret extends StatefulWidget {
  const _BlinkingCaret({super.key, required this.color});
  final Color color;

  @override
  State<_BlinkingCaret> createState() => _BlinkingCaretState();
}

class _BlinkingCaretState extends State<_BlinkingCaret> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 550))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _ctrl,
      child: Container(
        width: 2,
        height: 24,
        decoration: BoxDecoration(color: widget.color, borderRadius: BorderRadius.circular(2)),
      ),
    );
  }
}
