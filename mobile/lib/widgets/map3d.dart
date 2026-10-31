import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/geo_repository.dart';

/// One extruded region on the map.
class MapRegion {
  const MapRegion({
    required this.geo,
    required this.height,
    required this.color,
    this.label,
    this.dimmed = false,
  });

  final GeoRegion geo;

  /// 0–1 share of the maximum extrusion.
  final double height;
  final Color color;
  final String? label;
  final bool dimmed;
}

class MapPin {
  const MapPin({required this.lon, required this.lat, required this.color, this.regionCode});
  final double lon;
  final double lat;
  final Color color;
  final String? regionCode;
}

/// Camera over the map: world focus point, zoom (px per world unit),
/// tilt (radians from top-down) and rotation around the vertical axis.
@immutable
class MapCamera {
  const MapCamera({required this.focus, required this.zoom, this.tilt = 0.9, this.rotation = 0});
  final Offset focus;
  final double zoom;
  final double tilt;
  final double rotation;

  MapCamera copyWith({Offset? focus, double? zoom, double? tilt, double? rotation}) => MapCamera(
        focus: focus ?? this.focus,
        zoom: zoom ?? this.zoom,
        tilt: tilt ?? this.tilt,
        rotation: rotation ?? this.rotation,
      );

  static MapCamera lerp(MapCamera a, MapCamera b, double t) => MapCamera(
        focus: Offset.lerp(a.focus, b.focus, t)!,
        zoom: math.exp(ui.lerpDouble(math.log(a.zoom), math.log(b.zoom), t)!),
        tilt: ui.lerpDouble(a.tilt, b.tilt, t)!,
        rotation: ui.lerpDouble(a.rotation, b.rotation, t)!,
      );
}

/// Lon/lat → flat world units (equirectangular, scaled for Thailand's latitude).
const double _kWorld = 100;
final double _cosLat = math.cos(13.5 * math.pi / 180);
Offset toWorld(double lon, double lat) => Offset(lon * _cosLat * _kWorld, -lat * _kWorld);

/// Interactive extruded 3D choropleth.
///
/// Pan with one finger, pinch to zoom, twist to rotate. Tap a region to
/// select it; tap the selected region again to [onDrill] into it.
class Map3D extends StatefulWidget {
  const Map3D({
    super.key,
    required this.regions,
    required this.fitKey,
    this.context = const [],
    this.pins = const [],
    this.selectedCode,
    this.onSelect,
    this.onDrill,
    this.maxHeight = 70,
    this.padding = EdgeInsets.zero,
    this.controller,
    // ========================================================================
    // 🗺️ จุดปรับแต่งสีโมเดล 3D ฝั่งมือถือ (Mobile 3D Map Styling)
    // ========================================================================
    this.contextColor = const Color(0xFFE4DFD3), // สีแผ่นดินจังหวัดข้างเคียง (ครีมอมเทา)
    this.edgeColor = const Color(0xFFFFFFFF),    // สีเส้นขอบ 3D (สีขาว)
    this.labelColor = const Color(0xFF1C211E),   // สีตัวหนังสือชื่อจังหวัดบนแผนที่
    this.labelHalo = const Color(0xFFF4F1E8),    // สีเงารัศมีรอบตัวหนังสือ (ครีมกระดาษ)
  });

  final List<MapRegion> regions;

  /// Flat, non-interactive regions drawn underneath (e.g. neighbouring provinces).
  final List<GeoRegion> context;
  final List<MapPin> pins;
  final String? selectedCode;
  final ValueChanged<GeoRegion?>? onSelect;
  final ValueChanged<GeoRegion>? onDrill;

  /// Changing this refits the camera to [regions] and replays the rise.
  final Object fitKey;
  final double maxHeight;

  /// Space covered by overlays; the fitted map avoids it.
  final EdgeInsets padding;
  final Map3DController? controller;
  final Color contextColor;
  final Color edgeColor;
  final Color labelColor;
  final Color labelHalo;

  @override
  State<Map3D> createState() => _Map3DState();
}

/// Lets overlays drive the camera.
class Map3DController extends ChangeNotifier {
  _Map3DState? _state;
  bool get is3D => (_state?._camera.value.tilt ?? 1) > 0.2;
  double get rotation => _state?._camera.value.rotation ?? 0;

  void toggle3D() => _state?._setTilt(is3D ? 0 : _Map3DState._defaultTilt);
  void resetView() => _state?._fit(animate: true);
  void resetRotation() => _state?._animateTo(_state!._camera.value.copyWith(rotation: 0));
  void _changed() => notifyListeners();
}

class _Map3DState extends State<Map3D> with TickerProviderStateMixin {
  static const _defaultTilt = 0.88;

  final _camera = ValueNotifier(const MapCamera(focus: Offset.zero, zoom: 1));
  late final AnimationController _camAnim =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 750));
  late final AnimationController _heightAnim =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  late final AnimationController _pulse =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));

  MapCamera _camFrom = const MapCamera(focus: Offset.zero, zoom: 1);
  MapCamera _camTo = const MapCamera(focus: Offset.zero, zoom: 1);
  Map<String, double> _hFrom = {};
  Map<String, double> _hTo = {};
  Size _size = Size.zero;
  double _fitZoom = 1;
  bool _needsFit = true;

  // Gesture state
  MapCamera? _gestureStart;
  final _scene = _SceneCache();

  @override
  void initState() {
    super.initState();
    widget.controller?._state = this;
    _camAnim.addListener(() {
      _camera.value = MapCamera.lerp(_camFrom, _camTo, Curves.easeInOutCubic.transform(_camAnim.value));
    });
    _camera.addListener(() => widget.controller?._changed());
    _hTo = _targets();
    _hFrom = {for (final k in _hTo.keys) k: 0};
    _heightAnim.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncPulse();
  }

  @override
  void didUpdateWidget(covariant Map3D old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) widget.controller?._state = this;
    final current = _currentHeights();
    final refit = old.fitKey != widget.fitKey;
    _hTo = _targets();
    _hFrom = refit ? {for (final k in _hTo.keys) k: 0} : {for (final k in _hTo.keys) k: current[k] ?? 0};
    if (refit) {
      _needsFit = true;
      _heightAnim.forward(from: 0);
    } else if (!_mapEquals(current, _hTo)) {
      _heightAnim.forward(from: 0);
    }
    _syncPulse();
  }

  bool _mapEquals(Map<String, double> a, Map<String, double> b) =>
      a.length == b.length && a.entries.every((e) => (b[e.key] ?? -1) == e.value);

  void _syncPulse() {
    final want = widget.pins.isNotEmpty && !(MediaQuery.maybeDisableAnimationsOf(context) ?? false);
    if (want && !_pulse.isAnimating) _pulse.repeat();
    if (!want) _pulse.stop();
  }

  Map<String, double> _targets() => {for (final r in widget.regions) r.geo.code: r.dimmed ? 0 : r.height};

  Map<String, double> _currentHeights() {
    final t = Curves.easeOutBack.transform(_heightAnim.value.clamp(0.0, 1.0));
    return {
      for (final k in _hTo.keys) k: ui.lerpDouble(_hFrom[k] ?? 0, _hTo[k] ?? 0, t)!,
    };
  }

  @override
  void dispose() {
    if (widget.controller?._state == this) widget.controller?._state = null;
    _camAnim.dispose();
    _heightAnim.dispose();
    _pulse.dispose();
    _camera.dispose();
    super.dispose();
  }

  // ─────────────────────────── camera ───────────────────────────

  Rect _worldBounds() {
    Rect? b;
    for (final r in widget.regions) {
      final g = r.geo.bounds;
      final wb = Rect.fromPoints(toWorld(g.left, g.top), toWorld(g.right, g.bottom));
      b = b == null ? wb : b.expandToInclude(wb);
    }
    return b ?? const Rect.fromLTWH(0, 0, 1, 1);
  }

  MapCamera _fitCamera(double tilt) {
    final b = _worldBounds();
    final pad = widget.padding;
    final w = math.max(40.0, _size.width - pad.horizontal - 24);
    final h = math.max(40.0, _size.height - pad.vertical - 24);
    final squash = math.cos(tilt) + 0.08;
    final zoom = math.min(w / b.width, h / (b.height * squash)) * 0.94;
    _fitZoom = zoom;
    return MapCamera(focus: b.center, zoom: zoom, tilt: tilt, rotation: 0);
  }

  void _fit({bool animate = false}) {
    final target = _fitCamera(_camera.value.tilt);
    if (animate) {
      _animateTo(target);
    } else {
      _camera.value = target;
    }
  }

  void _animateTo(MapCamera target, {Duration duration = const Duration(milliseconds: 750)}) {
    _camFrom = _camera.value;
    _camTo = target;
    _camAnim.duration = MediaQuery.of(context).disableAnimations ? Duration.zero : duration;
    _camAnim.forward(from: 0);
  }

  void _setTilt(double tilt) {
    HapticFeedback.selectionClick();
    _animateTo(_fitCamera(tilt).copyWith(rotation: _camera.value.rotation));
  }

  void _onScaleStart(ScaleStartDetails d) {
    _camAnim.stop();
    _gestureStart = _camera.value;
  }

  void _onScaleUpdate(ScaleUpdateDetails d) {
    final start = _gestureStart;
    if (start == null) return;
    var cam = _camera.value;
    if (d.pointerCount >= 2) {
      cam = cam.copyWith(
        zoom: (start.zoom * d.scale).clamp(_fitZoom * 0.6, _fitZoom * 10),
        rotation: start.rotation + d.rotation,
      );
    }
    // Pan: screen delta → world delta (undo rotation, tilt squash and zoom).
    final dx = d.focalPointDelta.dx, dy = d.focalPointDelta.dy / math.max(0.35, math.cos(cam.tilt));
    final c = math.cos(-cam.rotation), s = math.sin(-cam.rotation);
    final wx = (dx * c - dy * s) / cam.zoom, wy = (dx * s + dy * c) / cam.zoom;
    _camera.value = cam.copyWith(focus: cam.focus - Offset(wx, wy));
  }

  void _onTapUp(TapUpDetails d) {
    final hit = _scene.hitTest(d.localPosition);
    if (hit == null) {
      widget.onSelect?.call(null);
      return;
    }
    final region = widget.regions.firstWhere((r) => r.geo.code == hit).geo;
    HapticFeedback.selectionClick();
    if (hit == widget.selectedCode && widget.onDrill != null) {
      widget.onDrill!(region);
    } else {
      widget.onSelect?.call(region);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (_, c) {
        final size = c.biggest;
        if (size != _size) {
          _size = size;
          _needsFit = true;
        }
        if (_needsFit && size.width > 0) {
          _needsFit = false;
          final first = _camera.value.zoom == 1;
          final target = _fitCamera(first ? _defaultTilt : _camera.value.tilt);
          if (first) {
            _camera.value = target;
          } else {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _animateTo(target, duration: const Duration(milliseconds: 900));
            });
          }
        }
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onScaleStart: _onScaleStart,
          onScaleUpdate: _onScaleUpdate,
          onScaleEnd: (_) => _gestureStart = null,
          onTapUp: _onTapUp,
          child: CustomPaint(
            size: size,
            painter: _MapPainter(
              state: this,
              fontFamily: DefaultTextStyle.of(context).style.fontFamily,
              repaint: Listenable.merge([_camera, _heightAnim, _pulse]),
            ),
          ),
        );
      },
    );
  }
}

/// Projected top faces from the last paint, for hit testing.
class _SceneCache {
  final List<(String, Path)> tops = [];

  String? hitTest(Offset p) {
    for (var i = tops.length - 1; i >= 0; i--) {
      if (tops[i].$2.contains(p)) return tops[i].$1;
    }
    return null;
  }
}

class _MapPainter extends CustomPainter {
  _MapPainter({required this.state, required this.fontFamily, required Listenable repaint}) : super(repaint: repaint);

  final _Map3DState state;
  final String? fontFamily;
  final Map<String, TextPainter> _labelCache = {};

  Float64List? _m;

  Matrix4 _matrix(Size size, MapCamera c, EdgeInsets pad) {
    final cx = pad.left + (size.width - pad.horizontal) / 2;
    final cy = pad.top + (size.height - pad.vertical) / 2;
    final m = Matrix4.identity()
      ..translate(cx, cy)
      ..multiply(Matrix4.identity()..setEntry(3, 2, 1 / 1500))
      ..rotateX(-c.tilt)
      ..rotateZ(c.rotation)
      ..scale(c.zoom, c.zoom, c.zoom)
      ..translate(-c.focus.dx, -c.focus.dy);
    return m;
  }

  /// Projects world (x, y, z) to screen; returns w (depth) via [_lastW].
  double _lastW = 1;
  Offset _proj(double x, double y, double z) {
    final s = _m!;
    final px = s[0] * x + s[4] * y + s[8] * z + s[12];
    final py = s[1] * x + s[5] * y + s[9] * z + s[13];
    var w = s[3] * x + s[7] * y + s[11] * z + s[15];
    if (w < 0.05) w = 0.05;
    _lastW = w;
    return Offset(px / w, py / w);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final widget = state.widget;
    final cam = state._camera.value;
    _m = _matrix(size, cam, widget.padding).storage;
    final heights = state._currentHeights();
    // maxHeight is in screen px at the fitted zoom, so towers keep the same
    // proportions for a whole country or a single province.
    final scale = widget.maxHeight / state._fitZoom;

    canvas.clipRect(Offset.zero & size);

    // Context regions: flat, faint.
    if (widget.context.isNotEmpty) {
      final fill = Paint()..color = widget.contextColor;
      final edge = Paint()
        ..color = widget.edgeColor.withOpacity(0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.7;
      for (final g in widget.context) {
        final path = _ringPath(g, 0);
        canvas.drawPath(path, fill);
        canvas.drawPath(path, edge);
      }
    }

    // Depth-sort regions back to front by projected label point.
    final order = <(MapRegion, double)>[];
    for (final r in widget.regions) {
      final w = toWorld(r.geo.labelPoint.dx, r.geo.labelPoint.dy);
      _proj(w.dx, w.dy, 0);
      order.add((r, _lastW));
    }
    order.sort((a, b) => b.$2.compareTo(a.$2));

    // Viewer direction in world space (for wall culling and shading).
    final viewDir = Offset(math.sin(cam.rotation), math.cos(cam.rotation));
    const lightDir = Offset(-0.55, 0.83);

    state._scene.tops.clear();
    final labels = <(Offset, String, bool)>[];

    for (final (r, _) in order) {
      final selected = r.geo.code == widget.selectedCode;
      final h = (heights[r.geo.code] ?? 0) * scale + ((r.dimmed ? 0 : 2.5) + (selected ? 6 : 0)) / state._fitZoom;
      final top = r.dimmed ? widget.contextColor : r.color;

      if (h > 0.5 && cam.tilt > 0.05) {
        final lit = Path(), shade = Path();
        for (final ring in r.geo.rings) {
          final ccw = _signedArea(ring) > 0; // in lon/lat (y up)
          for (var i = 0; i < ring.length; i += 2) {
            final j = (i + 2) % ring.length;
            final a = toWorld(ring[i], ring[i + 1]);
            final b = toWorld(ring[j], ring[j + 1]);
            // Outward normal in world space (world y is flipped from lat).
            var n = Offset(b.dy - a.dy, a.dx - b.dx);
            if (ccw) n = -n;
            final len = n.distance;
            if (len == 0) continue;
            n = n / len;
            if (n.dx * viewDir.dx + n.dy * viewDir.dy <= 0) continue; // faces away
            final quad = [_proj(a.dx, a.dy, 0), _proj(b.dx, b.dy, 0), _proj(b.dx, b.dy, -h), _proj(a.dx, a.dy, -h)];
            (n.dx * lightDir.dx + n.dy * lightDir.dy > 0.2 ? lit : shade).addPolygon(quad, true);
          }
        }
        canvas.drawPath(shade, Paint()..color = _shift(top, -0.30));
        canvas.drawPath(lit, Paint()..color = _shift(top, -0.14));
      }

      final topPath = _ringPath(r.geo, -h);
      canvas.drawPath(topPath, Paint()..color = top);
      canvas.drawPath(
        topPath,
        Paint()
          ..color = selected ? const Color(0xFFD4A84B) : widget.edgeColor.withOpacity(r.dimmed ? 0.35 : 0.7)
          ..style = PaintingStyle.stroke
          ..strokeJoin = StrokeJoin.round
          ..strokeWidth = selected ? 2.4 : 0.8,
      );
      if (!r.dimmed) state._scene.tops.add((r.geo.code, topPath));

      if (r.label != null) {
        final lp = toWorld(r.geo.labelPoint.dx, r.geo.labelPoint.dy);
        labels.add((_proj(lp.dx, lp.dy, -h), r.label!, selected));
      }
    }

    _drawPins(canvas, heights, scale);
    _drawLabels(canvas, labels);
  }

  Path _ringPath(GeoRegion g, double z) {
    final path = Path()..fillType = PathFillType.evenOdd;
    for (final ring in g.rings) {
      for (var i = 0; i < ring.length; i += 2) {
        final w = toWorld(ring[i], ring[i + 1]);
        final p = _proj(w.dx, w.dy, z);
        i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      }
      path.close();
    }
    return path;
  }

  double _signedArea(List<double> r) {
    var a = 0.0;
    for (var i = 0; i < r.length; i += 2) {
      final j = (i + 2) % r.length;
      a += r[i] * r[j + 1] - r[j] * r[i + 1];
    }
    return a;
  }

  Color _shift(Color c, double amount) {
    final hsl = HSLColor.fromColor(c);
    return hsl.withLightness((hsl.lightness + amount).clamp(0.0, 1.0)).toColor();
  }

  void _drawPins(Canvas canvas, Map<String, double> heights, double scale) {
    final pins = state.widget.pins;
    if (pins.isEmpty) return;
    final t = state._pulse.value;
    for (final pin in pins) {
      final h = (heights[pin.regionCode] ?? 0) * scale + 2.5 / state._fitZoom;
      final w = toWorld(pin.lon, pin.lat);
      final base = _proj(w.dx, w.dy, -h);
      final head = _proj(w.dx, w.dy, -h - 16 / state._fitZoom);
      canvas.drawLine(
          base,
          head,
          Paint()
            ..color = Colors.white.withOpacity(0.9)
            ..strokeWidth = 1.4);
      canvas.drawCircle(head, 7 + 9 * t, Paint()..color = pin.color.withOpacity(0.35 * (1 - t)));
      canvas.drawCircle(head, 5.5, Paint()..color = Colors.white);
      canvas.drawCircle(head, 4, Paint()..color = pin.color);
    }
  }

  void _drawLabels(Canvas canvas, List<(Offset, String, bool)> labels) {
    // Selected first so it always wins collisions.
    labels.sort((a, b) => (b.$3 ? 1 : 0) - (a.$3 ? 1 : 0));
    final placed = <Rect>[];
    final w = state.widget;
    for (final (p, text, selected) in labels) {
      final tp = _labelCache.putIfAbsent(
        '$text|$selected',
        () => TextPainter(
          text: TextSpan(
            text: text,
            style: TextStyle(
              fontFamily: fontFamily,
              fontSize: selected ? 13 : 11,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
              color: w.labelColor,
              shadows: [
                for (final o in const [Offset(1, 0), Offset(-1, 0), Offset(0, 1), Offset(0, -1)])
                  Shadow(color: w.labelHalo, offset: o, blurRadius: 2),
              ],
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout(),
      );
      final rect = Rect.fromCenter(center: p.translate(0, -10), width: tp.width + 6, height: tp.height + 2);
      if (placed.any((r) => r.overlaps(rect))) continue;
      placed.add(rect);
      tp.paint(canvas, rect.topLeft.translate(3, 1));
    }
  }

  @override
  bool shouldRepaint(covariant _MapPainter oldDelegate) => true;
}
