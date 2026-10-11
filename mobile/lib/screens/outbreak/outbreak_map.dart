import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/diagnosis.dart';
import '../../services/geo_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/map3d.dart';
import 'outbreak_screen.dart' show RawScan;

/// Risk band from a case count (same thresholds as the province list).
Tone riskToneFor(int cases, [String riskLevel = '']) {
  if (riskLevel.toUpperCase() == 'HIGH' || cases >= 5) return Tone.danger;
  if (riskLevel.toUpperCase() == 'MEDIUM' || cases >= 2) return Tone.warn;
  return Tone.safe;
}

String riskLabelFor(Tone t) => switch (t) {
      Tone.danger => 'เสี่ยงสูง',
      Tone.warn => 'เฝ้าระวัง',
      _ => 'ปลอดภัย',
    };

/// Disease cases attributed to one district.
class DistrictStat {
  DistrictStat(this.geo);
  final GeoRegion geo;
  int cases = 0;
  int healthy = 0;
  final Map<String, int> diseases = {};
  DateTime? latest;

  String? get dominantDisease {
    if (diseases.isEmpty) return null;
    return (diseases.entries.toList()..sort((a, b) => b.value.compareTo(a.value))).first.key;
  }
}

/// 3D outbreak map: provinces extruded by case count; tap a province to
/// select it, tap again (or "ดูรายอำเภอ") to drill into its districts.
class OutbreakMap extends StatefulWidget {
  const OutbreakMap({
    super.key,
    required this.provinces,
    required this.scans,
    required this.selectedRegion,
    required this.onOpenProvinceDetails,
  });

  final List<ProvinceStat> provinces;
  final List<RawScan> scans;
  final String selectedRegion;
  final ValueChanged<ProvinceStat> onOpenProvinceDetails;

  @override
  State<OutbreakMap> createState() => _OutbreakMapState();
}

class _OutbreakMapState extends State<OutbreakMap> {
  final _controller = Map3DController();
  List<GeoRegion>? _provinceGeo;
  String? _error;

  GeoRegion? _province; // drilled-in province
  List<GeoRegion>? _districtGeo;
  bool _loadingDistricts = false;

  String? _selectedProvince;
  String? _selectedDistrict;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      if (mounted) setState(() {});
    });
    GeoRepository.provinces().then((g) {
      if (mounted) setState(() => _provinceGeo = g);
    }).catchError((Object e) {
      if (mounted) setState(() => _error = 'โหลดข้อมูลแผนที่ไม่สำเร็จ');
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  ProvinceStat? _statFor(String name) {
    for (final p in widget.provinces) {
      if (p.province == name) return p;
    }
    return null;
  }

  bool _inRegion(ProvinceStat? s) =>
      widget.selectedRegion == 'ทั้งหมด' || (s?.region.contains(widget.selectedRegion) ?? false);

  Future<void> _drill(GeoRegion province) async {
    HapticFeedback.mediumImpact();
    setState(() {
      _loadingDistricts = true;
      _selectedProvince = province.code;
    });
    try {
      final d = await GeoRepository.districts(province.code);
      if (!mounted) return;
      setState(() {
        _province = province;
        _districtGeo = d;
        _selectedDistrict = null;
        _loadingDistricts = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingDistricts = false);
      AppToast.error(context, 'โหลดข้อมูลอำเภอไม่สำเร็จ', title: 'เปิดรายอำเภอไม่ได้');
    }
  }

  void _backToCountry() {
    HapticFeedback.selectionClick();
    setState(() {
      _province = null;
      _districtGeo = null;
      _selectedDistrict = null;
    });
  }

  /// Attributes this province's scans to districts: by GPS point when
  /// available, otherwise by the "อ./เขต" name in the saved address.
  Map<String, DistrictStat> _districtStats() {
    final province = _province!;
    final stats = {for (final d in _districtGeo!) d.code: DistrictStat(d)};
    final byName = {for (final d in _districtGeo!) GeoRepository.normalizeDistrict(d.name): d.code};

    for (final s in widget.scans) {
      String? code;
      if (s.hasCoords && province.contains(s.lng!, s.lat!)) {
        for (final d in _districtGeo!) {
          if (d.contains(s.lng!, s.lat!)) {
            code = d.code;
            break;
          }
        }
      }
      if (code == null && !s.hasCoords && (s.locationText?.contains(province.name) ?? false)) {
        final name = GeoRepository.districtFromText(s.locationText!);
        if (name != null) {
          code = byName[name] ??
              byName.entries.where((e) => e.key.contains(name) || name.contains(e.key)).firstOrNull?.value;
        }
      }
      if (code == null) continue;
      final st = stats[code]!;
      if (s.isDisease) {
        st.cases++;
        st.diseases[s.diseaseName] = (st.diseases[s.diseaseName] ?? 0) + 1;
        if (s.date != null && (st.latest == null || s.date!.isAfter(st.latest!))) st.latest = s.date;
      } else {
        st.healthy++;
      }
    }
    return stats;
  }

  Color _riskColor(Tone t, AppPalette p) => switch (t) {
        Tone.danger => context.isDarkMode ? const Color(0xFFD9483B) : const Color(0xFFC0392B),
        Tone.warn => const Color(0xFFE08A1E),
        _ => context.isDarkMode ? const Color(0xFF3E7D58) : const Color(0xFF7DB394),
      };

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    if (_error != null) {
      return Center(child: EmptyState(icon: Remix.map_2_line, title: _error!));
    }
    final geo = _provinceGeo;
    if (geo == null) {
      return const Center(child: SizedBox.square(dimension: 28, child: CircularProgressIndicator(strokeWidth: 2.6)));
    }

    final bottomInset = MediaQuery.of(context).padding.bottom + 104;
    final inDistricts = _province != null && _districtGeo != null;

    late List<MapRegion> regions;
    List<GeoRegion> contextRegions = const [];
    List<MapPin> pins = const [];
    Map<String, DistrictStat> dStats = const {};

    if (inDistricts) {
      dStats = _districtStats();
      final maxCases = dStats.values.fold<int>(1, (m, s) => s.cases > m ? s.cases : m);
      regions = [
        for (final s in dStats.values)
          MapRegion(
            geo: s.geo,
            height: s.cases == 0 ? 0.04 : 0.2 + 0.8 * s.cases / maxCases,
            color: _riskColor(riskToneFor(s.cases), p),
            label: s.geo.name,
          ),
      ];
      final pb = _province!.bounds.inflate(0.6);
      contextRegions = geo.where((g) => g.code != _province!.code && g.bounds.overlaps(pb)).toList();
      pins = [
        for (final s in widget.scans)
          if (s.hasCoords && _province!.contains(s.lng!, s.lat!))
            MapPin(
              lon: s.lng!,
              lat: s.lat!,
              color: s.isDisease ? AppColors.danger : AppColors.safe,
              regionCode: _districtGeo!.where((d) => d.contains(s.lng!, s.lat!)).firstOrNull?.code,
            ),
      ];
    } else {
      final maxCases = widget.provinces.fold<int>(1, (m, s) => s.totalCases > m ? s.totalCases : m);
      regions = [
        for (final g in geo)
          () {
            final s = _statFor(g.name);
            final cases = s?.totalCases ?? 0;
            final tone = riskToneFor(cases, s?.riskLevel ?? '');
            return MapRegion(
              geo: g,
              height: cases == 0 ? 0.03 : 0.18 + 0.82 * cases / maxCases,
              color: _riskColor(tone, p),
              dimmed: !_inRegion(s),
              label: (cases > 0 || g.code == _selectedProvince) && _inRegion(s) ? g.name : null,
            );
          }(),
      ];
    }

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, -0.2),
                radius: 1.1,
                colors: [p.surface.withOpacity(context.isDarkMode ? 0.4 : 0.9), p.bg],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: Map3D(
            controller: _controller,
            fitKey: inDistricts ? 'p:${_province!.code}' : 'th:${widget.selectedRegion}',
            regions: regions,
            context: contextRegions,
            pins: pins,
            maxHeight: inDistricts ? 46 : 70,
            selectedCode: inDistricts ? _selectedDistrict : _selectedProvince,
            padding: EdgeInsets.fromLTRB(8, 64, 8, bottomInset + (inDistricts ? 150 : 120)),
            contextColor: context.isDarkMode ? const Color(0xFF26332B) : const Color(0xFFE4DFD3),
            edgeColor: context.isDarkMode ? const Color(0xFF0E1511) : Colors.white,
            labelColor: p.ink,
            labelHalo: p.bg,
            onSelect: (g) => setState(() {
              if (inDistricts) {
                _selectedDistrict = g?.code;
              } else {
                _selectedProvince = g?.code;
              }
            }),
            onDrill: inDistricts ? null : _drill,
          ),
        ),
        Positioned(left: 16, top: 6, right: 70, child: _breadcrumb(p, inDistricts)),
        Positioned(right: 16, top: 6, child: _controls(p)),
        Positioned(
          left: 16,
          right: 16,
          bottom: bottomInset,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 320),
            switchInCurve: Curves.easeOutCubic,
            transitionBuilder: (c, a) => FadeTransition(
              opacity: a,
              child:
                  SlideTransition(position: Tween(begin: const Offset(0, 0.15), end: Offset.zero).animate(a), child: c),
            ),
            child: inDistricts ? _districtPanel(p, dStats) : _provincePanel(p, geo),
          ),
        ),
        if (_loadingDistricts)
          Positioned.fill(
            child: ColoredBox(
              color: p.bg.withOpacity(0.35),
              child: const Center(
                  child: SizedBox.square(dimension: 28, child: CircularProgressIndicator(strokeWidth: 2.6))),
            ),
          ),
      ],
    );
  }

  // ─────────────────────────── overlays ───────────────────────────

  Widget _breadcrumb(AppPalette p, bool inDistricts) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
        decoration: BoxDecoration(
          color: p.surface.withOpacity(0.95),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: p.line),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Pressable(
              onTap: inDistricts ? _backToCountry : null,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: inDistricts ? p.primary : p.primarySoft, shape: BoxShape.circle),
                child: Icon(inDistricts ? Remix.arrow_left_s_line : Remix.earth_line,
                    size: 17, color: inDistricts ? Colors.white : p.primaryText),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(
                    text: 'ประเทศไทย',
                    style: TextStyle(
                        color: inDistricts ? p.muted : p.ink,
                        fontWeight: inDistricts ? FontWeight.w500 : FontWeight.w700),
                  ),
                  if (inDistricts) ...[
                    TextSpan(text: '  ›  ', style: TextStyle(color: p.faint)),
                    TextSpan(text: _province!.name, style: TextStyle(color: p.ink, fontWeight: FontWeight.w700)),
                  ],
                ]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13.5),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _controls(AppPalette p) {
    Widget btn(IconData icon, String tip, VoidCallback onTap, {bool active = false, Widget? child}) => Semantics(
          button: true,
          label: tip,
          child: Pressable(
            onTap: onTap,
            child: Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? p.primary : p.surface.withOpacity(0.95),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: active ? p.primary : p.line),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4))
                ],
              ),
              child: child ?? Icon(icon, size: 19, color: active ? Colors.white : p.ink),
            ),
          ),
        );
    return Column(
      children: [
        btn(Remix.box_3_line, _controller.is3D ? 'มุมมอง 2 มิติ' : 'มุมมอง 3 มิติ', _controller.toggle3D,
            active: _controller.is3D,
            child: Text('3D',
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w800, color: _controller.is3D ? Colors.white : p.ink))),
        const SizedBox(height: 8),
        btn(Remix.compass_3_line, 'หันทิศเหนือขึ้น', _controller.resetRotation,
            child: Transform.rotate(
              angle: _controller.rotation,
              child: Icon(Remix.navigation_fill, size: 18, color: p.danger),
            )),
        const SizedBox(height: 8),
        btn(Remix.fullscreen_exit_line, 'จัดแผนที่ให้พอดี', _controller.resetView),
      ],
    );
  }

  Widget _legend(AppPalette p) {
    Widget dot(Tone t) => Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: _riskColor(t, p), borderRadius: BorderRadius.circular(3)),
        );
    TextStyle s() => TextStyle(fontSize: 11.5, color: p.muted, fontWeight: FontWeight.w500);
    return Row(
      children: [
        dot(Tone.danger),
        const SizedBox(width: 5),
        Text('สูง', style: s()),
        const SizedBox(width: 10),
        dot(Tone.warn),
        const SizedBox(width: 5),
        Text('เฝ้าระวัง', style: s()),
        const SizedBox(width: 10),
        dot(Tone.safe),
        const SizedBox(width: 5),
        Text('ปลอดภัย', style: s()),
        const Spacer(),
        Icon(Remix.bar_chart_box_line, size: 13, color: p.faint),
        const SizedBox(width: 4),
        Text('ความสูง = จุดที่พบโรค', style: s()),
      ],
    );
  }

  Widget _panel(AppPalette p, {required Key key, required Widget child}) => Container(
        key: key,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: p.line),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(context.isDarkMode ? 0.35 : 0.08),
                blurRadius: 24,
                offset: const Offset(0, 10))
          ],
        ),
        child: child,
      );

  Widget _provincePanel(AppPalette p, List<GeoRegion> geo) {
    final g = _selectedProvince == null ? null : geo.where((e) => e.code == _selectedProvince).firstOrNull;
    if (g == null) {
      final top = [...widget.provinces.where((s) => s.totalCases > 0 && _inRegion(s))]
        ..sort((a, b) => b.totalCases.compareTo(a.totalCases));
      return _panel(
        p,
        key: const ValueKey('overview'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _legend(p),
            const SizedBox(height: 10),
            if (top.isEmpty)
              Row(
                children: [
                  const IconTile(icon: Remix.shield_check_line, tone: Tone.safe, size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('ยังไม่พบพื้นที่ระบาด แตะจังหวัดเพื่อดูรายละเอียดรายอำเภอ',
                        style: TextStyle(fontSize: 13, color: p.body, height: 1.4)),
                  ),
                ],
              )
            else
              SizedBox(
                height: 40,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: top.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final s = top[i];
                    final tone = riskToneFor(s.totalCases, s.riskLevel);
                    final (fg, bg) = context.tone(tone);
                    return Pressable(
                      onTap: () => setState(() => _selectedProvince = geo.firstWhere((e) => e.name == s.province).code),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
                        child: Text('${s.province} · ${s.totalCases}',
                            style: TextStyle(color: fg, fontSize: 12.5, fontWeight: FontWeight.w700)),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      );
    }

    final s = _statFor(g.name);
    final cases = s?.totalCases ?? 0;
    final tone = riskToneFor(cases, s?.riskLevel ?? '');
    return _panel(
      p,
      key: ValueKey('p${g.code}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(g.name, style: AppText.display(20, color: p.ink, height: 1.25)),
                    Text('${s?.region.isNotEmpty == true ? 'ภาค${s!.region} · ' : ''}${g.nameEn}',
                        style: TextStyle(fontSize: 12, color: p.muted)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusPill(label: riskLabelFor(tone), tone: tone),
                  const SizedBox(height: 4),
                  Text('พบโรค $cases จุด', style: TextStyle(fontSize: 12, color: p.body, fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'ดูรายอำเภอ',
                  icon: Remix.zoom_in_line,
                  height: 46,
                  onPressed: () => _drill(g),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppButton(
                  label: 'รายละเอียด',
                  kind: ButtonKind.secondary,
                  height: 46,
                  onPressed: s == null ? null : () => widget.onOpenProvinceDetails(s),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _districtPanel(AppPalette p, Map<String, DistrictStat> stats) {
    final sel = _selectedDistrict == null ? null : stats[_selectedDistrict];
    if (sel != null) {
      final tone = riskToneFor(sel.cases);
      return _panel(
        p,
        key: ValueKey('d${sel.geo.code}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                IconTile(icon: Remix.map_pin_2_line, tone: tone, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('อ.${sel.geo.name}', style: AppText.display(19, color: p.ink, height: 1.25)),
                      Text('จ.${_province!.name} · ${sel.geo.nameEn}', style: TextStyle(fontSize: 12, color: p.muted)),
                    ],
                  ),
                ),
                StatusPill(label: riskLabelFor(tone), tone: tone),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _miniStat(p, '${sel.cases}', 'จุดที่พบโรค', context.tone(tone).$1),
                _miniStat(p, '${sel.healthy}', 'สแกนปกติ', p.safe),
                _miniStat(
                  p,
                  sel.latest == null ? '–' : '${sel.latest!.day}/${sel.latest!.month}/${sel.latest!.year + 543}',
                  'พบล่าสุด',
                  p.ink,
                ),
              ],
            ),
            if (sel.dominantDisease != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(color: p.dangerSoft, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Remix.bug_2_line, size: 16, color: p.danger),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('โรคที่พบมากที่สุด: ${sel.dominantDisease}',
                          style: TextStyle(fontSize: 12.5, color: p.danger, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      );
    }

    final ranked = stats.values.toList()
      ..sort((a, b) => b.cases != a.cases ? b.cases.compareTo(a.cases) : a.geo.name.compareTo(b.geo.name));
    final total = ranked.fold<int>(0, (n, s) => n + s.cases);
    final affected = ranked.where((s) => s.cases > 0).length;
    final provinceStat = _statFor(_province!.name);
    return _panel(
      p,
      key: ValueKey('list${_province!.code}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${ranked.length} อำเภอ', style: AppText.display(18, color: p.ink, height: 1.25)),
                    Text(
                      affected == 0 ? 'ยังไม่พบโรคในจังหวัดนี้' : 'พบโรค $total จุด ใน $affected อำเภอ',
                      style: TextStyle(fontSize: 12.5, color: p.muted),
                    ),
                  ],
                ),
              ),
              if (provinceStat != null)
                AppLink(label: 'รายละเอียดจังหวัด', onTap: () => widget.onOpenProvinceDetails(provinceStat), size: 13),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 58,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: ranked.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final s = ranked[i];
                final tone = riskToneFor(s.cases);
                final (fg, bg) = context.tone(tone);
                return Pressable(
                  onTap: () => setState(() => _selectedDistrict = s.geo.code),
                  child: Container(
                    width: 112,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: s.cases > 0 ? bg : p.subtle,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(s.geo.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.ink)),
                        Text(s.cases > 0 ? 'พบโรค ${s.cases} จุด' : 'ไม่พบโรค',
                            style: TextStyle(
                                fontSize: 11.5, color: s.cases > 0 ? fg : p.muted, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniStat(AppPalette p, String value, String label, Color color) => Expanded(
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
            Text(label, style: TextStyle(fontSize: 11.5, color: p.muted)),
          ],
        ),
      );
}
