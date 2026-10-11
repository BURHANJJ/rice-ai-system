import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';

import '../../../models/rice_field.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../../widgets/thai_date_picker.dart';

Color stageColor(String key) => switch (key) {
      'seedling' => const Color(0xFF9CC5A1),
      'tillering' => const Color(0xFF4F9A6A),
      'booting' => const Color(0xFF2D6A4F),
      'heading' => const Color(0xFFD4A84B),
      'ripening' => const Color(0xFFC98A12),
      'harvest' => const Color(0xFF8A5A2B),
      _ => const Color(0xFF9A9F98),
    };

IconData stageIcon(String key) => switch (key) {
      'seedling' => Remix.seedling_line,
      'tillering' => Remix.plant_line,
      'booting' => Remix.leaf_line,
      'heading' => Remix.flower_line,
      'ripening' => Remix.sun_line,
      'harvest' => Remix.scissors_cut_line,
      _ => Remix.calendar_line,
    };

IconData taskIcon(String kind) => switch (kind) {
      'fertilizer' => Remix.flask_line,
      'weed' => Remix.leaf_line,
      'water' => Remix.drop_line,
      'survey' => Remix.search_eye_line,
      'harvest' => Remix.scissors_cut_line,
      _ => Remix.checkbox_circle_line,
    };

String areaLabel(double rai) {
  final whole = rai.floor();
  final ngan = ((rai - whole) * 4).round();
  if (ngan == 0) return '$whole ไร่';
  if (whole == 0) return '$ngan งาน';
  return '$whole ไร่ $ngan งาน';
}

/// Segmented crop timeline with a "today" marker.
class GrowthTimeline extends StatelessWidget {
  const GrowthTimeline({super.key, required this.plan, this.compact = false, this.onDark = false});
  final GrowthPlan plan;
  final bool compact;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final stages = plan.stages;
    final today = plan.today;
    final current = plan.stage.key;
    final labelColor = onDark ? Colors.white.withOpacity(0.75) : p.muted;

    return LayoutBuilder(
      builder: (_, c) {
        final w = c.maxWidth;
        final markerX = (plan.progress * w).clamp(0.0, w);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: compact ? 10 : 22,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.centerLeft,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Row(
                      children: [
                        for (final s in stages)
                          Expanded(
                            flex: s.length.clamp(1, 999),
                            child: TweenAnimationBuilder<double>(
                              tween: Tween(begin: 0, end: 1),
                              duration: const Duration(milliseconds: 700),
                              builder: (_, v, __) {
                                final passed = today >= s.end;
                                final isNow = s.key == current;
                                return Container(
                                  height: compact ? 6 : 10,
                                  margin: const EdgeInsets.only(right: 2),
                                  color: stageColor(s.key).withOpacity(passed || isNow ? 1.0 * v : 0.28),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (today >= 0 && !plan.field.isHarvested)
                    Positioned(
                      left: markerX - (compact ? 5 : 8),
                      child: Container(
                        width: compact ? 10 : 16,
                        height: compact ? 10 : 16,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: stageColor(current), width: compact ? 2.5 : 4),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 6)],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (!compact) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  for (final s in stages)
                    Expanded(
                      flex: s.length.clamp(1, 999),
                      child: Text(
                        s.name.replaceFirst('ระยะ', ''),
                        maxLines: 1,
                        overflow: TextOverflow.clip,
                        softWrap: false,
                        style: TextStyle(
                          fontSize: 10.5,
                          color: s.key == current ? (onDark ? Colors.white : p.ink) : labelColor,
                          fontWeight: s.key == current ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        );
      },
    );
  }
}

/// "1.2 กม." / "350 ม."
String distanceLabel(double m) => m < 1000 ? '${m.round()} ม.' : '${(m / 1000).toStringAsFixed(m < 10000 ? 1 : 0)} กม.';

/// Distance · landmark · short address, whichever are available.
String? fieldPlaceLine(RiceField f, double? distanceM) {
  final parts = <String>[
    if (distanceM != null) 'ห่าง ${distanceLabel(distanceM)}',
    if (f.note.trim().isNotEmpty) f.note.trim(),
    if (f.note.trim().isEmpty && (f.address?.isNotEmpty ?? false))
      f.address!.split(' ').where((w) => w.startsWith('ต.') || w.startsWith('อ.')).join(' '),
  ].where((s) => s.isNotEmpty).toList();
  return parts.isEmpty ? null : parts.join(' · ');
}

/// Coloured tile with the field's initial — its identity across the app.
class FieldAvatar extends StatelessWidget {
  const FieldAvatar({super.key, required this.field, this.size = 42});
  final RiceField field;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = Color(field.color);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c.withOpacity(field.isHarvested ? 0.45 : 1),
        borderRadius: BorderRadius.circular(size * 0.31),
        boxShadow: [BoxShadow(color: c.withOpacity(0.25), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      child: Text(field.initial, style: AppText.display(size * 0.45, color: Colors.white, height: 1.1)),
    );
  }
}

/// Summary card for a field (list + home).
class FieldCard extends StatelessWidget {
  const FieldCard({super.key, required this.field, required this.onTap, this.width, this.distanceM});
  final RiceField field;
  final VoidCallback onTap;
  final double? width;

  /// Distance from the farmer's current position, when known.
  final double? distanceM;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final plan = field.plan;
    final stage = plan.stage;
    final next = plan.nextTask;
    final nextState = next == null ? null : plan.stateOf(next);

    return SizedBox(
      width: width,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                FieldAvatar(field: field, size: 42),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(field.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: p.ink)),
                      Text('${field.varietyLabel} · ${areaLabel(field.areaRai)} · ${field.method.label}',
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: p.muted)),
                      if (fieldPlaceLine(field, distanceM) != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Row(
                            children: [
                              Icon(Remix.map_pin_2_line, size: 11.5, color: p.faint),
                              const SizedBox(width: 3),
                              Expanded(
                                child: Text(fieldPlaceLine(field, distanceM)!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 11.5, color: p.faint)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (field.isHarvested)
                  const StatusPill(label: 'เก็บเกี่ยวแล้ว', tone: Tone.neutral, dot: false)
                else if (plan.today >= 0)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${plan.today}', style: AppText.display(20, color: p.ink, height: 1.1)),
                      Text('วัน', style: TextStyle(fontSize: 11, color: p.muted)),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (field.isHarvested)
              Row(
                children: [
                  Icon(Remix.scissors_cut_line, size: 14, color: p.muted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'เก็บเกี่ยว ${field.harvestedAt != null ? thaiDate(field.harvestedAt!) : ''}'
                      '${field.yieldPerRai != null ? ' · ${field.yieldPerRai!.round()} กก./ไร่' : ''}',
                      style: TextStyle(fontSize: 12.5, color: p.body),
                    ),
                  ),
                ],
              )
            else ...[
              GrowthTimeline(plan: plan, compact: true),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(stage.name,
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: stageColor(stage.key))),
                  const Spacer(),
                  Text(
                    plan.today < 0
                        ? 'เริ่มปลูกอีก ${-plan.today} วัน'
                        : plan.daysToHarvest > 0
                            ? 'เก็บเกี่ยวอีก ${plan.daysToHarvest} วัน'
                            : 'ถึงกำหนดเก็บเกี่ยว',
                    style: TextStyle(fontSize: 12, color: p.muted),
                  ),
                ],
              ),
              if (next != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: nextState == TaskState.overdue
                        ? p.dangerSoft
                        : nextState == TaskState.now
                            ? p.warnSoft
                            : p.subtle,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(taskIcon(next.kind),
                          size: 15,
                          color: nextState == TaskState.overdue
                              ? p.danger
                              : nextState == TaskState.now
                                  ? p.warn
                                  : p.muted),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(next.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: p.ink)),
                      ),
                      Text(
                        switch (nextState) {
                          TaskState.overdue => 'เลยกำหนด',
                          TaskState.now => 'ทำได้เลย',
                          _ => thaiDate(plan.dateOf(next.day)),
                        },
                        style: TextStyle(fontSize: 11.5, color: p.muted, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
