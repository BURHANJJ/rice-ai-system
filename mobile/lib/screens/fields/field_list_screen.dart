import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/rice_field.dart';
import '../../services/field_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import 'field_detail_screen.dart';
import 'field_form_screen.dart';
import 'widgets/field_widgets.dart';

enum _Sort { recent, nearest, harvest, name }

/// สมุดแปลงนา — all of the farmer's fields, as a list or on a map.
class FieldListScreen extends StatefulWidget {
  const FieldListScreen({super.key});

  @override
  State<FieldListScreen> createState() => _FieldListScreenState();
}

class _FieldListScreenState extends State<FieldListScreen> {
  int _tab = 0; // 0 = กำลังปลูก, 1 = เก็บเกี่ยวแล้ว
  bool _map = false;
  _Sort _sort = _Sort.recent;
  String _query = '';
  Position? _here;
  String? _mapSelected;
  late final Stream<List<RiceField>> _stream = FieldService.watchMine();
  List<RiceField> _latest = const [];

  @override
  void initState() {
    super.initState();
    _locateQuietly();
  }

  /// Uses GPS only if permission was already granted — never prompts here.
  Future<void> _locateQuietly() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm != LocationPermission.always && perm != LocationPermission.whileInUse) return;
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(timeLimit: Duration(seconds: 8)),
      );
      if (mounted) setState(() => _here = pos);
    } catch (_) {}
  }

  double? _distance(RiceField f) => _here == null || !f.hasLocation
      ? null
      : FieldService.distanceM(_here!.latitude, _here!.longitude, f.lat!, f.lng!);

  void _open(RiceField f) =>
      Navigator.push(context, MaterialPageRoute(builder: (_) => FieldDetailScreen(fieldId: f.id)));

  Future<void> _add() async {
    // Suggest the first colour no field uses yet.
    final used = _latest.map((f) => f.colorIndex).toSet();
    final color =
        List.generate(fieldColors.length, (i) => i).firstWhere((i) => !used.contains(i), orElse: () => _latest.length);
    final id = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => FieldFormScreen(suggestedColor: color)),
    );
    if (id != null && mounted) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => FieldDetailScreen(fieldId: id)));
    }
  }

  List<RiceField> _arrange(List<RiceField> list) {
    final q = _query.trim().toLowerCase();
    final out = list.where((f) {
      if (q.isEmpty) return true;
      return [f.name, f.note, f.varietyLabel, f.address ?? ''].any((s) => s.toLowerCase().contains(q));
    }).toList();
    switch (_sort) {
      case _Sort.recent:
        break; // service order: newest sowing first
      case _Sort.nearest:
        out.sort((a, b) => (_distance(a) ?? double.infinity).compareTo(_distance(b) ?? double.infinity));
      case _Sort.harvest:
        out.sort((a, b) => a.plan.daysToHarvest.compareTo(b.plan.daysToHarvest));
      case _Sort.name:
        out.sort((a, b) => a.name.compareTo(b.name));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Scaffold(
      backgroundColor: p.bg,
      floatingActionButton: _map ? null : _Fab(onTap: _add),
      body: SafeArea(
        bottom: false,
        child: StreamBuilder<List<RiceField>>(
          stream: _stream,
          builder: (context, snap) {
            final all = snap.data ?? const <RiceField>[];
            _latest = all;
            final active = all.where((f) => !f.isHarvested).toList();
            final done = all.where((f) => f.isHarvested).toList();
            final shown = _arrange(_tab == 0 ? active : done);
            final totalRai = active.fold<double>(0, (s, f) => s + f.areaRai);
            final dueTasks = active.fold<int>(0, (n, f) {
              final plan = f.plan;
              return n +
                  plan.tasks
                      .where((t) => plan.stateOf(t) == TaskState.now || plan.stateOf(t) == TaskState.overdue)
                      .length;
            });

            final header = Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const AppBackButton(),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('สมุดแปลงนา', style: AppText.display(24, color: p.ink, height: 1.25)),
                            Text('ติดตามการเติบโตและงานในแปลงของคุณ', style: TextStyle(fontSize: 12.5, color: p.muted)),
                          ],
                        ),
                      ),
                      if (all.isNotEmpty)
                        SizedBox(
                          width: 104,
                          child: SegmentedTabs(
                            compact: true,
                            labels: const ['รายการ', 'แผนที่'],
                            icons: const [Remix.list_unordered, Remix.map_2_line],
                            index: _map ? 1 : 0,
                            onChanged: (i) => setState(() => _map = i == 1),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (!_map) ...[
                    _summary(p, active.length, totalRai, dueTasks),
                    const SizedBox(height: 16),
                  ],
                  SegmentedTabs(
                    labels: ['กำลังปลูก (${active.length})', 'เก็บเกี่ยวแล้ว (${done.length})'],
                    index: _tab,
                    onChanged: (i) => setState(() {
                      _tab = i;
                      _mapSelected = null;
                    }),
                  ),
                  if (!_map && (_tab == 0 ? active : done).length >= 3) ...[
                    const SizedBox(height: 12),
                    AppSearchField(
                        hint: 'ค้นหาชื่อแปลง จุดสังเกต หรือพันธุ์', onChanged: (v) => setState(() => _query = v)),
                    const SizedBox(height: 10),
                    _sortChips(p),
                  ],
                  const SizedBox(height: 14),
                ],
              ),
            );

            if (_map) {
              return Column(
                children: [
                  header,
                  Expanded(child: _mapView(p, _tab == 0 ? active : done)),
                ],
              );
            }

            return CustomScrollView(
              physics: const BouncingScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverToBoxAdapter(child: header),
                if (snap.connectionState == ConnectionState.waiting && !snap.hasData)
                  const SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverToBoxAdapter(
                      child: Column(children: [
                        Skeleton(height: 150, radius: 20, width: double.infinity),
                        SizedBox(height: 12),
                        Skeleton(height: 150, radius: 20, width: double.infinity),
                      ]),
                    ),
                  )
                else if (snap.hasError)
                  const SliverToBoxAdapter(
                    child: EmptyState(
                      icon: Remix.error_warning_line,
                      title: 'โหลดข้อมูลแปลงไม่สำเร็จ',
                      message: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง',
                      mascot: RiceyMood.worried,
                    ),
                  )
                else if (shown.isEmpty)
                  SliverToBoxAdapter(
                    child: _query.isNotEmpty
                        ? const EmptyState(icon: Remix.search_line, title: 'ไม่พบแปลงที่ค้นหา', mascot: RiceyMood.think)
                        : _tab == 0
                            ? EmptyState(
                                icon: Remix.plant_line,
                                title: 'ยังไม่มีแปลงนา',
                                mascot: RiceyMood.hello,
                                message: 'เพิ่มแปลงแรกเพื่อรับปฏิทินการปลูก\nงานที่ต้องทำ และคำแนะนำตามอายุข้าว',
                                action: AppButton(
                                    label: 'เพิ่มแปลงนา', icon: Remix.add_line, expand: false, onPressed: _add),
                              )
                            : const EmptyState(
                                icon: Remix.archive_line, title: 'ยังไม่มีแปลงที่เก็บเกี่ยว', mascot: RiceyMood.sleep),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 110),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: FadeSlideIn.stagger(
                            i,
                            key: ValueKey(shown[i].id),
                            child: FieldCard(
                                field: shown[i], distanceM: _distance(shown[i]), onTap: () => _open(shown[i])),
                          ),
                        ),
                        childCount: shown.length,
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _sortChips(AppPalette p) {
    final labels = {
      _Sort.recent: 'ปลูกล่าสุด',
      if (_here != null) _Sort.nearest: 'ใกล้ฉัน',
      _Sort.harvest: 'ใกล้เก็บเกี่ยว',
      _Sort.name: 'ชื่อแปลง',
    };
    return ChoiceChips(
      padding: EdgeInsets.zero,
      options: labels.values.toList(),
      selected: labels[_sort] ?? labels.values.first,
      onSelected: (v) => setState(() => _sort = labels.entries.firstWhere((e) => e.value == v).key),
    );
  }

  Widget _summary(AppPalette p, int count, double rai, int due) {
    Widget stat(String v, String l, {Color? color}) => Expanded(
          child: Column(
            children: [
              Text(v, style: AppText.display(20, color: color ?? Colors.white, height: 1.25)),
              Text(l, style: TextStyle(fontSize: 11.5, color: p.heroMuted)),
            ],
          ),
        );
    final divider = VerticalDivider(width: 1, color: Colors.white.withOpacity(0.15));
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: p.hero, borderRadius: BorderRadius.circular(20)),
      child: IntrinsicHeight(
        child: Row(
          children: [
            stat('$count', 'แปลงที่ปลูก'),
            divider,
            stat(rai == rai.roundToDouble() ? '${rai.round()}' : rai.toStringAsFixed(1), 'ไร่รวม'),
            divider,
            stat('$due', 'งานที่ต้องทำ', color: due > 0 ? AppColors.gold : Colors.white),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────── map ───────────────────────────

  Widget _mapView(AppPalette p, List<RiceField> fields) {
    final located = fields.where((f) => f.hasLocation).toList();
    final missing = fields.length - located.length;
    if (located.isEmpty) {
      return EmptyState(
        icon: Remix.map_pin_line,
        title: fields.isEmpty ? 'ยังไม่มีแปลงในหมวดนี้' : 'ยังไม่มีแปลงที่ระบุตำแหน่ง',
        message: fields.isEmpty ? null : 'แก้ไขแปลงแล้วกด "ใช้ตำแหน่งปัจจุบัน" ขณะอยู่ที่แปลง',
      );
    }
    final points = [for (final f in located) LatLng(f.lat!, f.lng!)];
    final selected = located.where((f) => f.id == _mapSelected).firstOrNull;

    return Stack(
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: FlutterMap(
            options: MapOptions(
              initialCameraFit: points.length > 1
                  ? CameraFit.coordinates(
                      coordinates: points, padding: const EdgeInsets.fromLTRB(60, 80, 60, 220), maxZoom: 16)
                  : null,
              initialCenter: points.first,
              initialZoom: 15,
              onTap: (_, __) => setState(() => _mapSelected = null),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.rice_ai_mobile',
              ),
              if (_here != null)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(_here!.latitude, _here!.longitude),
                    width: 22,
                    height: 22,
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E5A8A),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 6)],
                      ),
                    ),
                  ),
                ]),
              MarkerLayer(
                markers: [
                  for (final f in located)
                    Marker(
                      point: LatLng(f.lat!, f.lng!),
                      width: 150,
                      height: 74,
                      alignment: Alignment.topCenter,
                      child: GestureDetector(
                        onTap: () => setState(() => _mapSelected = f.id),
                        child: _FieldPin(field: f, selected: f.id == _mapSelected),
                      ),
                    ),
                ],
              ),
              const SimpleAttributionWidget(source: Text('OpenStreetMap contributors')),
            ],
          ),
        ),
        if (missing > 0)
          Positioned(
            top: 12,
            left: 16,
            right: 16,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                    color: p.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: p.line)),
                child: Text('$missing แปลงยังไม่ได้ระบุตำแหน่ง',
                    style: TextStyle(fontSize: 12, color: p.muted, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 16 + MediaQuery.of(context).padding.bottom,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            transitionBuilder: (c, a) => FadeTransition(
              opacity: a,
              child:
                  SlideTransition(position: Tween(begin: const Offset(0, 0.2), end: Offset.zero).animate(a), child: c),
            ),
            child: selected == null
                ? SizedBox(
                    key: const ValueKey('strip'),
                    height: 56,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: located.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => Pressable(
                        onTap: () => setState(() => _mapSelected = located[i].id),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
                          decoration: BoxDecoration(
                            color: p.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: p.line),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withOpacity(0.08), blurRadius: 12, offset: const Offset(0, 4))
                            ],
                          ),
                          child: Row(
                            children: [
                              FieldAvatar(field: located[i], size: 40),
                              const SizedBox(width: 10),
                              Text(located[i].name,
                                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  )
                : FieldCard(
                    key: ValueKey(selected.id),
                    field: selected,
                    distanceM: _distance(selected),
                    onTap: () => _open(selected),
                  ),
          ),
        ),
      ],
    );
  }
}

/// Map marker: the field's colour avatar with its name underneath.
class _FieldPin extends StatelessWidget {
  const _FieldPin({required this.field, required this.selected});
  final RiceField field;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final c = Color(field.color);
    return AnimatedScale(
      scale: selected ? 1.15 : 1,
      duration: const Duration(milliseconds: 200),
      alignment: Alignment.bottomCenter,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 8, offset: const Offset(0, 3))],
            ),
            child: FieldAvatar(field: field, size: 34),
          ),
          Container(width: 2, height: 6, color: c),
          Container(
            constraints: const BoxConstraints(maxWidth: 150),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(8)),
            child: Text(
              field.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _Fab extends StatelessWidget {
  const _Fab({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Semantics(
      button: true,
      label: 'เพิ่มแปลงนา',
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: p.primary,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [BoxShadow(color: p.primary.withOpacity(0.35), blurRadius: 20, offset: const Offset(0, 8))],
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Remix.add_line, color: Colors.white, size: 22),
              SizedBox(width: 8),
              Text('เพิ่มแปลง', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
