import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/rice_field.dart';
import '../../services/field_service.dart';
import '../../services/location_helper.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/thai_date_picker.dart';
import 'widgets/field_widgets.dart';

/// Add or edit a field. Pops with the field id after saving.
class FieldFormScreen extends StatefulWidget {
  const FieldFormScreen({super.key, this.field, this.suggestedColor = 0});
  final RiceField? field;

  /// Colour for a new field (the caller picks one not used yet).
  final int suggestedColor;

  @override
  State<FieldFormScreen> createState() => _FieldFormScreenState();
}

class _FieldFormScreenState extends State<FieldFormScreen> {
  late final RiceField? _orig = widget.field;
  late final _name = TextEditingController(text: _orig?.name ?? '');
  late final _rai = TextEditingController(text: _orig == null ? '' : '${_orig.areaRai.floor()}');
  late final _customName = TextEditingController(text: _orig?.varietyName ?? '');
  late final _days = TextEditingController(text: _orig?.maturityOverride?.toString() ?? '');
  late int _ngan = _orig == null ? 0 : ((_orig.areaRai - _orig.areaRai.floor()) * 4).round();
  late String _varietyId = _orig?.varietyId ?? 'kdml105';
  late PlantingMethod _method = _orig?.method ?? PlantingMethod.broadcast;
  late DateTime _sown = _orig?.sownAt ?? DateUtils.dateOnly(DateTime.now());
  late bool _override = _orig?.maturityOverride != null;
  late double? _lat = _orig?.lat;
  late double? _lng = _orig?.lng;
  late String? _address = _orig?.address;
  late final _note = TextEditingController(text: _orig?.note ?? '');
  late int _color = _orig?.colorIndex ?? widget.suggestedColor % fieldColors.length;

  bool _locating = false;
  bool _saving = false;
  final Set<String> _invalid = {};
  int _tick = 0;

  @override
  void initState() {
    super.initState();
    for (final c in [_rai, _days]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _rai, _customName, _days, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  RiceVariety get _variety => RiceVarieties.byId(_varietyId);
  double get _area => (double.tryParse(_rai.text.trim()) ?? 0) + _ngan / 4;
  int? get _overrideDays => _override || _variety.isCustom ? int.tryParse(_days.text.trim()) : null;

  RiceField _draft() => RiceField(
        id: _orig?.id ?? '',
        userId: _orig?.userId ?? '',
        name: _name.text,
        varietyId: _varietyId,
        varietyName: _customName.text,
        method: _method,
        sownAt: _sown,
        areaRai: _area,
        lat: _lat,
        lng: _lng,
        address: _address,
        maturityOverride: _overrideDays,
        colorIndex: _color,
        note: _note.text,
        status: _orig?.status ?? 'active',
        taskLog: _orig?.taskLog ?? const {},
      );

  Future<void> _pickVariety() async {
    final id = await showAppSheet<String>(context, builder: (ctx) => _VarietySheet(selected: _varietyId));
    if (id != null) setState(() => _varietyId = id);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showThaiDatePicker(
      context,
      title: 'วันที่เริ่มปลูก',
      initial: _sown,
      first: DateTime(now.year - 1, now.month, now.day),
      last: now.add(const Duration(days: 60)),
    );
    if (d != null) setState(() => _sown = d);
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) throw 'ปิดตำแหน่ง GPS อยู่ กรุณาเปิดแล้วลองใหม่';
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        throw 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง';
      }
      final pos = await Geolocator.getCurrentPosition();
      final addr = await LocationHelper.getThaiAddress(pos);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        _address = addr;
      });
    } catch (e) {
      if (mounted)
        AppToast.error(context, e is String ? e : 'ระบุตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง', title: 'ระบุตำแหน่งไม่ได้');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final bad = <String>{
      if (_name.text.trim().isEmpty) 'name',
      if (_area <= 0) 'area',
      if (_variety.isCustom && _customName.text.trim().isEmpty) 'customName',
      if ((_override || _variety.isCustom) && ((_overrideDays ?? 0) < 60 || (_overrideDays ?? 0) > 240)) 'days',
    };
    if (bad.isNotEmpty) {
      setState(() {
        _invalid
          ..clear()
          ..addAll(bad);
        _tick++;
      });
      AppToast.error(
        context,
        bad.contains('days') && bad.length == 1
            ? 'อายุเก็บเกี่ยวต้องอยู่ระหว่าง 60–240 วัน'
            : 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ',
        title: 'ข้อมูลยังไม่ครบ',
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final draft = _draft();
      String id;
      if (_orig == null) {
        id = await FieldService.create(draft);
      } else {
        await FieldService.update(draft);
        id = _orig.id;
      }
      if (!mounted) return;
      AppToast.success(context, _orig == null ? 'สร้างปฏิทินการปลูกให้แล้ว' : 'อัปเดตข้อมูลแปลงแล้ว',
          title: 'บันทึกแปลงนาแล้ว');
      Navigator.pop(context, id);
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().contains('permission-denied')
          ? 'ไม่มีสิทธิ์บันทึกข้อมูล (ตรวจสอบกฎความปลอดภัย Firestore)'
          : 'บันทึกไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
      AppToast.error(context, msg, title: 'บันทึกไม่สำเร็จ');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _shake(String key, Widget child) => ShakeOnChange(trigger: _invalid.contains(key) ? _tick : 0, child: child);

  Widget _label(AppPalette p, String text, {String? hint}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Text(text, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: p.ink)),
            if (hint != null) ...[
              const SizedBox(width: 6),
              Text(hint, style: TextStyle(fontSize: 12, color: p.faint)),
            ],
          ],
        ),
      );

  Widget _pickerBox(AppPalette p,
      {required IconData icon, required String title, String? sub, required VoidCallback onTap}) {
    return Pressable(
      onTap: onTap,
      scale: 0.985,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: p.line, width: 1.5),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: p.muted),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: p.ink)),
                  if (sub != null) Text(sub, style: TextStyle(fontSize: 12, color: p.muted)),
                ],
              ),
            ),
            Icon(Remix.arrow_down_s_line, color: p.faint),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final plan = _draft().plan;

    return Scaffold(
      backgroundColor: p.bg,
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Row(
                  children: [
                    const AppBackButton(),
                    const SizedBox(width: 12),
                    Expanded(
                      child:
                          Text(_orig == null ? 'เพิ่มแปลงนา' : 'แก้ไขแปลงนา', style: AppText.display(22, color: p.ink)),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  physics: const BouncingScrollPhysics(),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    _shake(
                      'name',
                      AppField(
                        controller: _name,
                        label: 'ชื่อแปลง',
                        hint: 'เช่น แปลงหลังบ้าน, นาโคกใหญ่',
                        icon: Remix.price_tag_3_line,
                        hasError: _invalid.contains('name'),
                        textInputAction: TextInputAction.next,
                        onChanged: (_) => setState(() => _invalid.remove('name')),
                      ),
                    ),
                    const SizedBox(height: 14),
                    AppField(
                      controller: _note,
                      label: 'จุดสังเกต (ไม่บังคับ)',
                      hint: 'เช่น ติดคลองหลังวัด, แปลงที่ 2 จากถนน',
                      icon: Remix.flag_2_line,
                      textInputAction: TextInputAction.done,
                    ),
                    const SizedBox(height: 18),
                    _label(p, 'สีประจำแปลง', hint: '(ช่วยแยกแปลงบนรายการและแผนที่)'),
                    _colorPicker(p),
                    const SizedBox(height: 18),
                    _label(p, 'พันธุ์ข้าว'),
                    _pickerBox(p,
                        icon: Remix.seedling_line,
                        title: _variety.name,
                        sub: '${_variety.type} · ${_variety.durationLabel}',
                        onTap: _pickVariety),
                    if (_variety.isCustom) ...[
                      const SizedBox(height: 12),
                      _shake(
                        'customName',
                        AppField(
                          controller: _customName,
                          label: 'ชื่อพันธุ์',
                          hint: 'เช่น หอมมะลิแดง',
                          icon: Remix.edit_line,
                          hasError: _invalid.contains('customName'),
                          onChanged: (_) => setState(() => _invalid.remove('customName')),
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    _label(p, 'วิธีปลูก'),
                    SegmentedTabs(
                      labels: [for (final m in PlantingMethod.values) m.label],
                      index: _method.index,
                      onChanged: (i) => setState(() => _method = PlantingMethod.values[i]),
                    ),
                    const SizedBox(height: 6),
                    Text(_method.description, style: TextStyle(fontSize: 12, color: p.muted)),
                    const SizedBox(height: 18),
                    _label(p, 'วันที่เริ่มปลูก',
                        hint: _method == PlantingMethod.transplant ? '(วันตกกล้า)' : '(วันหว่าน/หยอด)'),
                    _pickerBox(p, icon: Remix.calendar_line, title: thaiDate(_sown, short: false), onTap: _pickDate),
                    const SizedBox(height: 18),
                    _label(p, 'ขนาดแปลง', hint: '1 ไร่ = 4 งาน'),
                    _shake(
                      'area',
                      Row(
                        children: [
                          Expanded(
                            child: AppField(
                              controller: _rai,
                              hint: '0',
                              icon: Remix.ruler_line,
                              hasError: _invalid.contains('area'),
                              keyboardType: TextInputType.number,
                              trailing: Padding(
                                padding: const EdgeInsets.only(right: 12),
                                child: Text('ไร่', style: TextStyle(color: p.muted, fontWeight: FontWeight.w600)),
                              ),
                              onChanged: (_) => setState(() => _invalid.remove('area')),
                            ),
                          ),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 168,
                            child: SegmentedTabs(
                              labels: const ['0', '1', '2', '3'],
                              index: _ngan,
                              onChanged: (i) => setState(() {
                                _ngan = i;
                                _invalid.remove('area');
                              }),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 6, left: 4),
                      child: Text('ช่องขวาคือจำนวนงาน · รวม ${areaLabel(_area)}',
                          style: TextStyle(fontSize: 12, color: p.muted)),
                    ),
                    const SizedBox(height: 18),
                    _label(p, 'ตำแหน่งแปลง', hint: '(ใช้ดูสภาพอากาศและผลสแกนในแปลง)'),
                    _locationBox(p),
                    const SizedBox(height: 18),
                    if (!_variety.isCustom)
                      Row(
                        children: [
                          Expanded(
                            child: Text('ปรับอายุเก็บเกี่ยวเอง',
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: p.ink)),
                          ),
                          AppSwitch(
                            value: _override,
                            label: 'ปรับอายุเก็บเกี่ยวเอง',
                            onChanged: (v) => setState(() => _override = v),
                          ),
                        ],
                      ),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 250),
                      child: _override || _variety.isCustom
                          ? Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: _shake(
                                'days',
                                AppField(
                                  controller: _days,
                                  label: _variety.isCustom ? 'อายุเก็บเกี่ยว (วันนับจากวันปลูก)' : null,
                                  hint: 'เช่น 110',
                                  icon: Remix.timer_line,
                                  hasError: _invalid.contains('days'),
                                  keyboardType: TextInputType.number,
                                  trailing: Padding(
                                    padding: const EdgeInsets.only(right: 12),
                                    child: Text('วัน', style: TextStyle(color: p.muted, fontWeight: FontWeight.w600)),
                                  ),
                                  onChanged: (_) => setState(() => _invalid.remove('days')),
                                ),
                              ),
                            )
                          : const SizedBox(width: double.infinity),
                    ),
                    const SizedBox(height: 20),
                    _preview(p, plan),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                decoration: BoxDecoration(color: p.bg, border: Border(top: BorderSide(color: p.line))),
                child: AppButton(
                  label: _orig == null ? 'บันทึกแปลงนา' : 'บันทึกการแก้ไข',
                  busyLabel: 'กำลังบันทึก',
                  icon: Remix.check_line,
                  busy: _saving,
                  onPressed: _save,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _colorPicker(AppPalette p) {
    final initial = RegExp(r'[ก-ฮA-Za-z0-9]').firstMatch(_name.text)?.group(0)?.toUpperCase() ?? '•';
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var i = 0; i < fieldColors.length; i++)
          Semantics(
            button: true,
            selected: i == _color,
            label: 'สีที่ ${i + 1}',
            child: Pressable(
              onTap: () => setState(() => _color = i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Color(fieldColors[i]),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: i == _color ? p.ink : Colors.transparent, width: 2.5),
                  boxShadow:
                      i == _color ? [BoxShadow(color: Color(fieldColors[i]).withOpacity(0.4), blurRadius: 10)] : null,
                ),
                child: i == _color ? Text(initial, style: AppText.display(15, color: Colors.white, height: 1.1)) : null,
              ),
            ),
          ),
      ],
    );
  }

  Widget _locationBox(AppPalette p) {
    if (_lat == null) {
      return AppButton(
        label: 'ใช้ตำแหน่งปัจจุบัน',
        busyLabel: 'กำลังระบุตำแหน่ง',
        icon: Remix.focus_3_line,
        kind: ButtonKind.secondary,
        busy: _locating,
        onPressed: _locate,
      );
    }
    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      child: Row(
        children: [
          const IconTile(icon: Remix.map_pin_2_line, tone: Tone.warn, size: 38),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_address ?? 'พิกัดแปลง',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: p.ink)),
                Text('${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}',
                    style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'ระบุตำแหน่งใหม่',
            onPressed: _locating ? null : _locate,
            icon: _locating
                ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: p.primary))
                : Icon(Remix.refresh_line, color: p.muted, size: 20),
          ),
          IconButton(
            tooltip: 'ลบตำแหน่ง',
            onPressed: () => setState(() {
              _lat = null;
              _lng = null;
              _address = null;
            }),
            icon: Icon(Remix.close_line, color: p.muted, size: 20),
          ),
        ],
      ),
    );
  }

  Widget _preview(AppPalette p, GrowthPlan plan) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Remix.calendar_check_line, size: 18, color: p.primaryText),
              const SizedBox(width: 8),
              Text('ปฏิทินการปลูกโดยประมาณ',
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.primaryText)),
            ],
          ),
          const SizedBox(height: 12),
          GrowthTimeline(plan: plan),
          const SizedBox(height: 12),
          _row(p, 'ใส่ปุ๋ยครั้งที่ 2 (กำเนิดช่อดอก)', thaiDate(plan.dateOf(plan.panicleDay))),
          _row(p, 'ข้าวออกรวง', thaiDate(plan.dateOf(plan.floweringDay))),
          _row(p, 'คาดว่าเก็บเกี่ยว', '${thaiDate(plan.harvestDate)} · ${plan.harvestDay} วัน', strong: true),
          if (plan.lateSowing)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Remix.error_warning_line, size: 15, color: p.warn),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'พันธุ์ไวต่อช่วงแสงที่ปลูกช้า ข้าวจะออกรวงตามฤดูกาล อายุอาจสั้นและผลผลิตลดลง',
                      style: TextStyle(fontSize: 12, color: p.warn, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _row(AppPalette p, String l, String v, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Expanded(child: Text(l, style: TextStyle(fontSize: 13, color: p.body))),
            Text(v,
                style: TextStyle(
                    fontSize: 13,
                    color: strong ? p.primaryText : p.ink,
                    fontWeight: strong ? FontWeight.w700 : FontWeight.w600)),
          ],
        ),
      );
}

class _VarietySheet extends StatelessWidget {
  const _VarietySheet({required this.selected});
  final String selected;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.75,
      child: Column(
        children: [
          const SheetHeader(
              title: 'เลือกพันธุ์ข้าว',
              subtitle: 'อายุเก็บเกี่ยวเป็นค่าประมาณ ปรับได้ภายหลัง',
              icon: Remix.seedling_line),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + MediaQuery.of(context).padding.bottom),
              itemCount: RiceVarieties.all.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final v = RiceVarieties.all[i];
                final sel = v.id == selected;
                return AppCard(
                  onTap: () => Navigator.pop(context, v.id),
                  borderColor: sel ? p.primary : null,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(v.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.ink)),
                            Text(v.durationLabel, style: TextStyle(fontSize: 12, color: p.muted)),
                          ],
                        ),
                      ),
                      StatusPill(
                        label: v.type,
                        tone: v.photoSensitive ? Tone.warn : (v.isCustom ? Tone.neutral : Tone.primary),
                        dot: false,
                      ),
                      if (sel) ...[
                        const SizedBox(width: 8),
                        Icon(Remix.checkbox_circle_fill, color: p.primary, size: 20),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
