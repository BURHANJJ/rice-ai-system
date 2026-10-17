import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/rice_field.dart';
import '../../services/field_service.dart';
import '../../services/navigation_provider.dart';
import '../../services/weather_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/thai_date_picker.dart';
import '../history/history_detail_screen.dart';
import 'field_form_screen.dart';
import 'widgets/field_widgets.dart';

class FieldDetailScreen extends StatefulWidget {
  const FieldDetailScreen({super.key, required this.fieldId});
  final String fieldId;

  @override
  State<FieldDetailScreen> createState() => _FieldDetailScreenState();
}

class _FieldDetailScreenState extends State<FieldDetailScreen> {
  late final Stream<RiceField?> _stream = FieldService.watch(widget.fieldId);
  late final Stream<List<FieldLog>> _logs = FieldService.watchLogs(widget.fieldId);
  int _tab = 0;
  Future<WeatherSnapshot?>? _weather;
  Future<List<Map<String, dynamic>>>? _scans;
  String? _locKey;
  final Set<String> _pending = {};

  void _loadForLocation(RiceField f) {
    final key = '${f.lat},${f.lng},${f.sownAt}';
    if (key == _locKey) return;
    _locKey = key;
    _weather = f.hasLocation ? WeatherService.fetch(f.lat!, f.lng!) : Future.value(null);
    _scans = FieldService.scansNear(f);
  }

  Future<void> _toggleTask(RiceField f, FieldTask t, bool done) async {
    HapticFeedback.mediumImpact();
    setState(() => _pending.add(t.id));
    try {
      await FieldService.setTaskDone(f.id, t.id, done);
      if (done && mounted) AppToast.success(context, t.title, title: 'บันทึกว่าทำแล้ว');
    } catch (_) {
      if (mounted) AppToast.error(context, 'บันทึกสถานะงานไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      if (mounted) setState(() => _pending.remove(t.id));
    }
  }

  void _goScan() {
    Navigator.of(context).popUntil((r) => r.isFirst);
    context.read<NavigationProvider>().setIndex(2);
  }

  Future<void> _menu(RiceField f) async {
    final action = await showAppSheet<String>(
      context,
      builder: (ctx) {
        final p = ctx.pal;
        Widget item(String id, IconData icon, String label, {Tone tone = Tone.neutral}) => Pressable(
              onTap: () => Navigator.pop(ctx, id),
              scale: 0.985,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                child: Row(
                  children: [
                    IconTile(icon: icon, tone: tone, size: 40),
                    const SizedBox(width: 14),
                    Text(label,
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600, color: tone == Tone.danger ? p.danger : p.ink)),
                  ],
                ),
              ),
            );
        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                item('edit', Remix.edit_line, 'แก้ไขข้อมูลแปลง', tone: Tone.primary),
                if (f.isHarvested)
                  item('reopen', Remix.arrow_go_back_line, 'ยกเลิกสถานะเก็บเกี่ยว', tone: Tone.warn)
                else
                  item('harvest', Remix.scissors_cut_line, 'บันทึกการเก็บเกี่ยว', tone: Tone.warn),
                item('delete', Remix.delete_bin_line, 'ลบแปลงนี้', tone: Tone.danger),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted || action == null) return;
    switch (action) {
      case 'edit':
        Navigator.push(context, MaterialPageRoute(builder: (_) => FieldFormScreen(field: f)));
      case 'harvest':
        _harvestSheet(f);
      case 'reopen':
        await FieldService.reopen(f.id);
      case 'delete':
        final ok = await showAppConfirm(
          context,
          title: 'ลบแปลง "${f.name}"?',
          message: 'ปฏิทิน งานที่ทำแล้ว และบันทึกกิจกรรมทั้งหมดของแปลงนี้จะถูกลบถาวร',
          confirmLabel: 'ลบแปลง',
          icon: Remix.delete_bin_line,
          tone: Tone.danger,
          destructive: true,
        );
        if (!ok || !mounted) return;
        try {
          await FieldService.delete(f.id);
          if (!mounted) return;
          Navigator.pop(context);
          AppToast.success(context, 'ลบแปลง "${f.name}" แล้ว', title: 'ลบแล้ว');
        } catch (_) {
          if (mounted) AppToast.error(context, 'ลบแปลงไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
    }
  }

  Future<void> _harvestSheet(RiceField f) async {
    await showAppSheet<void>(context, builder: (_) => _HarvestSheet(field: f));
  }

  Future<void> _addLog(RiceField f) async {
    await showAppSheet<void>(context, builder: (_) => _LogSheet(field: f));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Scaffold(
      backgroundColor: p.bg,
      body: StreamBuilder<RiceField?>(
        stream: _stream,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting && !snap.hasData) {
            return const Center(
                child: SizedBox.square(dimension: 28, child: CircularProgressIndicator(strokeWidth: 2.6)));
          }
          final f = snap.data;
          if (f == null) {
            return const SafeArea(
              child: Column(
                children: [
                  Padding(
                      padding: EdgeInsets.all(20),
                      child: Align(alignment: Alignment.centerLeft, child: AppBackButton())),
                  Expanded(child: Center(child: EmptyState(icon: Remix.plant_line, title: 'ไม่พบแปลงนี้', mascot: RiceyMood.think))),
                ],
              ),
            );
          }
          _loadForLocation(f);
          final plan = f.plan;

          return CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const AppBackButton(),
                            const SizedBox(width: 12),
                            FieldAvatar(field: f, size: 40),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(f.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.display(20, color: p.ink, height: 1.25)),
                                  if (fieldPlaceLine(f, null) != null)
                                    Text(fieldPlaceLine(f, null)!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 12, color: p.muted)),
                                ],
                              ),
                            ),
                            AppIconButton(icon: Remix.more_2_line, tooltip: 'ตัวเลือก', onPressed: () => _menu(f)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        FadeSlideIn(child: _hero(p, f, plan)),
                        if (f.isHarvested) ...[
                          const SizedBox(height: 12),
                          _harvestSummary(p, f),
                        ] else if (f.hasLocation) ...[
                          const SizedBox(height: 12),
                          FadeSlideIn(delay: const Duration(milliseconds: 80), child: _weatherCard(p)),
                        ],
                        const SizedBox(height: 18),
                        SegmentedTabs(
                          labels: const ['งานในแปลง', 'บันทึก', 'ผลสแกน'],
                          index: _tab,
                          onChanged: (i) => setState(() => _tab = i),
                        ),
                        const SizedBox(height: 14),
                      ],
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 32 + MediaQuery.of(context).padding.bottom),
                sliver: SliverToBoxAdapter(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 280),
                    child: KeyedSubtree(
                      key: ValueKey(_tab),
                      child: switch (_tab) {
                        0 => _tasks(p, f, plan),
                        1 => _logsTab(p, f),
                        _ => _scansTab(p, f),
                      },
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  // ─────────────────────────── hero ───────────────────────────

  Widget _hero(AppPalette p, RiceField f, GrowthPlan plan) {
    final stage = f.isHarvested ? const GrowthStage('harvest', 'เก็บเกี่ยวแล้ว', 0, 0) : plan.stage;
    final day = plan.today;
    Widget date(String label, DateTime d) => Expanded(
          child: Column(
            children: [
              Text(label, style: TextStyle(fontSize: 11, color: p.heroMuted)),
              const SizedBox(height: 2),
              Text(thaiDate(d), style: const TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600)),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: p.hero,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: p.hero.withOpacity(0.3), blurRadius: 24, offset: const Offset(0, 12))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${f.varietyLabel} · ${areaLabel(f.areaRai)} · ${f.method.label}',
                        style: TextStyle(fontSize: 12.5, color: p.heroMuted)),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(day < 0 ? 'อีก ${-day}' : '$day',
                            style: AppText.display(44, color: Colors.white, height: 1.0)),
                        const SizedBox(width: 6),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(day < 0 ? 'วันถึงวันปลูก' : 'วัน',
                              style: TextStyle(fontSize: 14, color: p.heroMuted)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: stageColor(stage.key).withOpacity(0.25),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(stageIcon(stage.key), size: 14, color: Colors.white),
                          const SizedBox(width: 6),
                          Text(stage.name,
                              style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (!f.isHarvested && day >= 0)
                SizedBox.square(
                  dimension: 84,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: plan.progress),
                        duration: const Duration(milliseconds: 1100),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, __) => SizedBox.square(
                          dimension: 84,
                          child: CircularProgressIndicator(
                            value: v,
                            strokeWidth: 7,
                            strokeCap: StrokeCap.round,
                            backgroundColor: Colors.white.withOpacity(0.12),
                            color: AppColors.gold,
                          ),
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(plan.daysToHarvest > 0 ? '${plan.daysToHarvest}' : '0',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700, height: 1.1)),
                          Text('วันเก็บเกี่ยว', style: TextStyle(color: p.heroMuted, fontSize: 10)),
                        ],
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          GrowthTimeline(plan: plan, onDark: true),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(14)),
            child: Row(
              children: [
                date('วันปลูก', f.sownAt),
                date('ออกรวง', plan.dateOf(plan.floweringDay)),
                date(f.isHarvested ? 'เก็บเกี่ยวจริง' : 'คาดเก็บเกี่ยว', f.harvestedAt ?? plan.harvestDate),
              ],
            ),
          ),
          if (plan.lateSowing && !f.isHarvested) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Remix.error_warning_line, size: 14, color: AppColors.gold),
                const SizedBox(width: 6),
                Expanded(
                  child: Text('พันธุ์ไวต่อช่วงแสงปลูกช้า วันเก็บเกี่ยวเป็นค่าประมาณขั้นต่ำ',
                      style: TextStyle(fontSize: 11.5, color: p.heroMuted)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _harvestSummary(AppPalette p, RiceField f) {
    return AppCard(
      child: Row(
        children: [
          const IconTile(icon: Remix.scissors_cut_line, tone: Tone.warn, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ผลผลิตรอบนี้', style: TextStyle(fontSize: 12.5, color: p.muted)),
                Text(
                  f.yieldKg == null ? 'ยังไม่ได้บันทึกน้ำหนัก' : '${f.yieldKg!.round()} กก.',
                  style: AppText.display(20, color: p.ink, height: 1.3),
                ),
              ],
            ),
          ),
          if (f.yieldPerRai != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${f.yieldPerRai!.round()}',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: p.primaryText)),
                Text('กก./ไร่', style: TextStyle(fontSize: 11.5, color: p.muted)),
              ],
            ),
        ],
      ),
    );
  }

  Widget _weatherCard(AppPalette p) {
    return FutureBuilder<WeatherSnapshot?>(
      future: _weather,
      builder: (_, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Skeleton(height: 74, radius: 18, width: double.infinity);
        }
        final w = snap.data;
        if (w == null) return const SizedBox.shrink();
        final wet = w.kind.isWet || (w.rainChance ?? 0) >= 60;
        return AppCard(
          padding: const EdgeInsets.all(14),
          color: wet ? p.infoSoft : null,
          borderColor: wet ? Colors.transparent : null,
          child: Row(
            children: [
              Icon(w.kind.icon(w.isDay), size: 34, color: wet ? p.info : p.warn),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ที่แปลง ${w.temperature.round()}° · ${w.kind.label(w.isDay)} · ฝน ${w.rainChance ?? 0}%',
                      style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink),
                    ),
                    const SizedBox(height: 2),
                    Text(w.advice(hasLocalRisk: false), style: TextStyle(fontSize: 12.5, color: p.body, height: 1.4)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─────────────────────────── tasks ───────────────────────────

  Widget _tasks(AppPalette p, RiceField f, GrowthPlan plan) {
    final tasks = plan.tasks;
    final done = tasks.where((t) => plan.stateOf(t) == TaskState.done).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('งานตามอายุข้าว', style: AppText.display(17, color: p.ink))),
            Text('ทำแล้ว $done/${tasks.length}',
                style: TextStyle(fontSize: 12.5, color: p.muted, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 4),
        Text('คำแนะนำทั่วไปตามแนวทางกรมการข้าว ปรับตามสภาพแปลงและค่าวิเคราะห์ดิน',
            style: TextStyle(fontSize: 12, color: p.muted)),
        const SizedBox(height: 12),
        for (var i = 0; i < tasks.length; i++)
          FadeSlideIn.stagger(i, child: _taskTile(p, f, plan, tasks[i], last: i == tasks.length - 1)),
      ],
    );
  }

  Widget _taskTile(AppPalette p, RiceField f, GrowthPlan plan, FieldTask t, {required bool last}) {
    final state = f.isHarvested && plan.stateOf(t) != TaskState.done ? TaskState.upcoming : plan.stateOf(t);
    final done = state == TaskState.done;
    final pending = _pending.contains(t.id);
    final (tone, label) = switch (state) {
      TaskState.done => (Tone.safe, 'ทำแล้ว'),
      TaskState.overdue => (Tone.danger, 'เลยกำหนด'),
      TaskState.now => (Tone.warn, 'ถึงเวลาแล้ว'),
      TaskState.upcoming => (Tone.neutral, 'อีก ${t.day - plan.today} วัน'),
    };
    final (fg, _) = context.tone(tone);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 36,
            child: Column(
              children: [
                Semantics(
                  button: true,
                  checked: done,
                  label: t.title,
                  child: Pressable(
                    onTap: pending || f.isHarvested ? null : () => _toggleTask(f, t, !done),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: done ? p.safe : p.surface,
                        shape: BoxShape.circle,
                        border: Border.all(color: done ? p.safe : fg.withOpacity(0.6), width: 2),
                      ),
                      child: pending
                          ? Padding(
                              padding: const EdgeInsets.all(6),
                              child: CircularProgressIndicator(strokeWidth: 2, color: p.primary))
                          : done
                              ? const Icon(Remix.check_line, size: 17, color: Colors.white)
                              : Icon(taskIcon(t.kind), size: 14, color: fg),
                    ),
                  ),
                ),
                if (!last)
                  Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: p.line)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: AppCard(
                padding: const EdgeInsets.all(14),
                color: state == TaskState.now || state == TaskState.overdue ? null : (done ? p.subtle : null),
                borderColor: state == TaskState.overdue
                    ? p.danger.withOpacity(0.35)
                    : state == TaskState.now
                        ? p.warn.withOpacity(0.4)
                        : null,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            t.title,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: done ? p.muted : p.ink,
                              decoration: done ? TextDecoration.lineThrough : null,
                              decorationColor: p.muted,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusPill(label: label, tone: tone, dot: false),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'วันที่ ${t.day} · ${thaiDate(plan.dateOf(t.day))}'
                      '${done && f.taskLog[t.id] != null ? ' · ทำเมื่อ ${thaiDate(f.taskLog[t.id]!)}' : ''}',
                      style: TextStyle(fontSize: 12, color: p.muted),
                    ),
                    if (!done) ...[
                      const SizedBox(height: 8),
                      Text(t.detail, style: TextStyle(fontSize: 13, color: p.body, height: 1.5)),
                      if (t.kind == 'survey' && (state == TaskState.now || state == TaskState.overdue)) ...[
                        const SizedBox(height: 10),
                        AppButton(label: 'สแกนใบข้าวตอนนี้', icon: Remix.focus_3_line, height: 42, onPressed: _goScan),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────── logs ───────────────────────────

  Widget _logsTab(AppPalette p, RiceField f) {
    return StreamBuilder<List<FieldLog>>(
      stream: _logs,
      builder: (_, snap) {
        final logs = snap.data ?? const <FieldLog>[];
        final cost = logs.fold<double>(0, (s, l) => s + (l.cost ?? 0));
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('บันทึกกิจกรรม', style: AppText.display(17, color: p.ink)),
                      Text(
                        logs.isEmpty
                            ? 'จดสิ่งที่ทำในแปลงเพื่อดูย้อนหลัง'
                            : '${logs.length} รายการ · ต้นทุนรวม ${_baht(cost)}',
                        style: TextStyle(fontSize: 12, color: p.muted),
                      ),
                    ],
                  ),
                ),
                AppButton(label: 'เพิ่ม', icon: Remix.add_line, height: 40, expand: false, onPressed: () => _addLog(f)),
              ],
            ),
            const SizedBox(height: 12),
            if (snap.connectionState == ConnectionState.waiting && !snap.hasData)
              const Column(children: [SkeletonRow(), SkeletonRow()])
            else if (logs.isEmpty)
              const EmptyState(
                  icon: Remix.booklet_line, title: 'ยังไม่มีบันทึก', message: 'เช่น ใส่ปุ๋ย พ่นยา หรือการจัดการน้ำ')
            else
              for (var i = 0; i < logs.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: FadeSlideIn.stagger(i, child: _logTile(p, f, logs[i])),
                ),
          ],
        );
      },
    );
  }

  String _baht(double v) => '${v.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',')} บาท';

  Widget _logTile(AppPalette p, RiceField f, FieldLog l) {
    final icon = switch (l.type) {
      'fertilizer' => Remix.flask_line,
      'spray' => Remix.drop_line,
      'water' => Remix.water_flash_line,
      'weed' => Remix.leaf_line,
      'survey' => Remix.search_eye_line,
      _ => Remix.sticky_note_line,
    };
    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconTile(icon: icon, tone: Tone.primary, size: 38),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                        child: Text(l.typeLabel,
                            style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.ink))),
                    if (l.cost != null && l.cost! > 0)
                      Text(_baht(l.cost!),
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.body)),
                  ],
                ),
                Text('${thaiDate(l.date)} · วันที่ ${f.plan.dayOn(l.date)} ของการปลูก',
                    style: TextStyle(fontSize: 12, color: p.muted)),
                if (l.note.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(l.note, style: TextStyle(fontSize: 13, color: p.body, height: 1.45)),
                ],
              ],
            ),
          ),
          IconButton(
            tooltip: 'ลบบันทึก',
            icon: Icon(Remix.delete_bin_line, size: 18, color: p.faint),
            onPressed: () async {
              final ok = await showAppConfirm(
                context,
                title: 'ลบบันทึกนี้?',
                message: '${l.typeLabel} · ${thaiDate(l.date)}',
                confirmLabel: 'ลบ',
                icon: Remix.delete_bin_line,
                tone: Tone.danger,
                destructive: true,
              );
              if (ok) {
                try {
                  await FieldService.deleteLog(f.id, l.id);
                } catch (_) {
                  if (mounted) AppToast.error(context, 'ลบบันทึกไม่สำเร็จ');
                }
              }
            },
          ),
        ],
      ),
    );
  }

  // ─────────────────────────── scans ───────────────────────────

  Widget _scansTab(AppPalette p, RiceField f) {
    if (!f.hasLocation) {
      return EmptyState(
        icon: Remix.map_pin_line,
        title: 'ยังไม่ได้ระบุตำแหน่งแปลง',
        message: 'เพิ่มตำแหน่งเพื่อดูผลสแกนที่ถ่ายในแปลงนี้อัตโนมัติ',
        action: AppButton(
          label: 'ระบุตำแหน่ง',
          icon: Remix.map_pin_add_line,
          expand: false,
          height: 46,
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => FieldFormScreen(field: f))),
        ),
      );
    }
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _scans,
      builder: (_, snap) {
        if (snap.connectionState != ConnectionState.done) return const Column(children: [SkeletonRow(), SkeletonRow()]);
        final scans = snap.data ?? const [];
        final sick = scans.where((s) => s['disease_code'] != 'HEALTHY').length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('ผลสแกนในแปลง', style: AppText.display(17, color: p.ink)),
            Text(
              scans.isEmpty
                  ? 'สแกนภายในรัศมี 500 ม. จากแปลงหลังวันปลูก'
                  : '${scans.length} ครั้ง · พบโรค $sick ครั้ง (รัศมี 500 ม.)',
              style: TextStyle(fontSize: 12, color: p.muted),
            ),
            const SizedBox(height: 12),
            if (scans.isEmpty)
              EmptyState(
                icon: Remix.focus_3_line,
                title: 'ยังไม่มีผลสแกนในแปลงนี้',
                mascot: RiceyMood.scan,
                action: AppButton(
                    label: 'สแกนใบข้าว', icon: Remix.focus_3_line, expand: false, height: 46, onPressed: _goScan),
              )
            else
              for (var i = 0; i < scans.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: FadeSlideIn.stagger(i, child: _scanTile(p, f, scans[i])),
                ),
          ],
        );
      },
    );
  }

  Widget _scanTile(AppPalette p, RiceField f, Map<String, dynamic> s) {
    final healthy = s['disease_code'] == 'HEALTHY';
    final date = s['date'] as DateTime?;
    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: () => Navigator.push(
          context, MaterialPageRoute(builder: (_) => HistoryDetailScreen(diagId: s['diag_id'] as String))),
      child: Row(
        children: [
          IconTile(icon: healthy ? Remix.leaf_line : Remix.bug_line, tone: healthy ? Tone.safe : Tone.danger, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s['disease_name'] as String? ?? 'ไม่ทราบผล',
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.ink)),
                Text(
                  '${date != null ? '${thaiDate(date)} · วันที่ ${f.plan.dayOn(date)} · ' : ''}ห่าง ${(s['distance'] as double).round()} ม.',
                  style: TextStyle(fontSize: 12, color: p.muted),
                ),
              ],
            ),
          ),
          StatusPill(label: healthy ? 'ปกติ' : 'พบโรค', tone: healthy ? Tone.safe : Tone.danger),
        ],
      ),
    );
  }
}

// ─────────────────────────── sheets ───────────────────────────

class _LogSheet extends StatefulWidget {
  const _LogSheet({required this.field});
  final RiceField field;

  @override
  State<_LogSheet> createState() => _LogSheetState();
}

class _LogSheetState extends State<_LogSheet> {
  String _type = 'fertilizer';
  DateTime _date = DateUtils.dateOnly(DateTime.now());
  final _note = TextEditingController();
  final _cost = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    _cost.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await FieldService.addLog(
        widget.field.id,
        FieldLog(
            type: _type, date: _date, note: _note.text, cost: double.tryParse(_cost.text.replaceAll(',', '').trim())),
      );
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.success(context, '${FieldLog.types[_type]} · ${thaiDate(_date)}', title: 'บันทึกกิจกรรมแล้ว');
    } catch (_) {
      if (mounted) AppToast.error(context, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SheetHeader(title: 'บันทึกกิจกรรม', subtitle: widget.field.name, icon: Remix.booklet_line),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final e in FieldLog.types.entries)
                          Pressable(
                            onTap: () => setState(() => _type = e.key),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                              decoration: BoxDecoration(
                                color: _type == e.key ? p.primary : p.surface,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: _type == e.key ? p.primary : p.line),
                              ),
                              child: Text(e.value,
                                  style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w600,
                                      color: _type == e.key ? Colors.white : p.body)),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Pressable(
                      onTap: () async {
                        final d = await showThaiDatePicker(
                          context,
                          title: 'วันที่ทำกิจกรรม',
                          initial: _date,
                          first: widget.field.sownAt.subtract(const Duration(days: 30)),
                          last: DateTime.now(),
                        );
                        if (d != null) setState(() => _date = d);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: BoxDecoration(
                          color: p.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: p.line, width: 1.5),
                        ),
                        child: Row(
                          children: [
                            Icon(Remix.calendar_line, size: 20, color: p.muted),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(thaiDate(_date, short: false),
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.ink)),
                            ),
                            Text('วันที่ ${widget.field.plan.dayOn(_date)}',
                                style: TextStyle(fontSize: 12.5, color: p.muted)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    AppField(
                        controller: _note,
                        hint: 'รายละเอียด เช่น สูตรปุ๋ย ปริมาณ ยาที่ใช้',
                        icon: Remix.edit_line,
                        maxLines: 3),
                    const SizedBox(height: 12),
                    AppField(
                      controller: _cost,
                      hint: 'ค่าใช้จ่าย (ไม่บังคับ)',
                      icon: Remix.money_dollar_circle_line,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      trailing: Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Text('บาท', style: TextStyle(color: p.muted, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(height: 18),
                    AppButton(
                        label: 'บันทึก',
                        busyLabel: 'กำลังบันทึก',
                        icon: Remix.check_line,
                        busy: _busy,
                        onPressed: _save),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HarvestSheet extends StatefulWidget {
  const _HarvestSheet({required this.field});
  final RiceField field;

  @override
  State<_HarvestSheet> createState() => _HarvestSheetState();
}

class _HarvestSheetState extends State<_HarvestSheet> {
  late DateTime _date = DateUtils.dateOnly(DateTime.now());
  final _kg = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _kg.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _kg.dispose();
    super.dispose();
  }

  double? get _yield => double.tryParse(_kg.text.replaceAll(',', '').trim());

  Future<void> _save() async {
    setState(() => _busy = true);
    final root = Navigator.of(context, rootNavigator: true).context;
    try {
      await FieldService.markHarvested(widget.field.id, _date, _yield);
      if (!mounted) return;
      Navigator.pop(context);
      if (!root.mounted) return;
      await showAppSuccess(
        root,
        title: 'เก็บเกี่ยวเรียบร้อย!',
        message: 'ย้ายแปลงไปที่ "เก็บเกี่ยวแล้ว" ขอบคุณที่ดูแลข้าวมาตลอดฤดู',
        mascot: RiceyMood.joy,
      );
    } catch (_) {
      if (mounted) AppToast.error(context, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final perRai = _yield != null && widget.field.areaRai > 0 ? _yield! / widget.field.areaRai : null;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SheetHeader(
                  title: 'บันทึกการเก็บเกี่ยว',
                  subtitle: widget.field.name,
                  icon: Remix.scissors_cut_line,
                  tone: Tone.warn),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Pressable(
                      onTap: () async {
                        final d = await showThaiDatePicker(
                          context,
                          title: 'วันที่เก็บเกี่ยว',
                          initial: _date,
                          first: widget.field.sownAt,
                          last: DateTime.now(),
                        );
                        if (d != null) setState(() => _date = d);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: BoxDecoration(
                          color: p.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: p.line, width: 1.5),
                        ),
                        child: Row(
                          children: [
                            Icon(Remix.calendar_line, size: 20, color: p.muted),
                            const SizedBox(width: 10),
                            Text(thaiDate(_date, short: false),
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.ink)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    AppField(
                      controller: _kg,
                      label: 'น้ำหนักผลผลิตทั้งหมด (ไม่บังคับ)',
                      hint: 'เช่น 2,400',
                      icon: Remix.scales_3_line,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      trailing: Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Text('กก.', style: TextStyle(color: p.muted, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 200),
                      child: perRai == null
                          ? const SizedBox(width: double.infinity)
                          : Padding(
                              padding: const EdgeInsets.only(top: 8, left: 4),
                              child: Text('เฉลี่ย ${perRai.round()} กก./ไร่ (${areaLabel(widget.field.areaRai)})',
                                  style: TextStyle(fontSize: 12.5, color: p.primaryText, fontWeight: FontWeight.w600)),
                            ),
                    ),
                    const SizedBox(height: 18),
                    AppButton(
                        label: 'ยืนยันการเก็บเกี่ยว',
                        busyLabel: 'กำลังบันทึก',
                        icon: Remix.check_line,
                        busy: _busy,
                        onPressed: _save),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
