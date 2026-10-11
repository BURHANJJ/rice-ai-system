import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../../models/rice_field.dart';
import '../../../services/auth_provider.dart';
import '../../../services/field_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../fields/field_detail_screen.dart';
import '../../fields/field_form_screen.dart';
import '../../fields/field_list_screen.dart';
import '../../fields/widgets/field_widgets.dart';

/// "แปลงนาของฉัน" on the home screen: active fields with their stage and next job.
class HomeFieldsSection extends StatefulWidget {
  const HomeFieldsSection({super.key});

  @override
  State<HomeFieldsSection> createState() => _HomeFieldsSectionState();
}

class _HomeFieldsSectionState extends State<HomeFieldsSection> {
  late final Stream<List<RiceField>> _stream = FieldService.watchMine();

  void _push(Widget page) => Navigator.push(context, MaterialPageRoute(builder: (_) => page));

  /// Farmers who don't keep field records can hide this section for good.
  Future<void> _hide() async {
    final ok = await showAppConfirm(
      context,
      title: 'ซ่อนสมุดแปลงนา?',
      message: 'ส่วนนี้จะไม่แสดงที่หน้าหลัก ฟีเจอร์อื่นใช้ได้ตามปกติ เปิดกลับได้ที่ โปรไฟล์ › การตั้งค่า',
      confirmLabel: 'ซ่อน',
      icon: Remix.eye_off_line,
    );
    if (!ok || !mounted) return;
    try {
      await context.read<AuthProvider>().updateSetting('show_fields', false);
      if (mounted) AppToast.info(context, 'เปิดกลับได้ที่ โปรไฟล์ › แสดงสมุดแปลงนา', title: 'ซ่อนสมุดแปลงนาแล้ว');
    } catch (_) {
      if (mounted) AppToast.error(context, 'บันทึกการตั้งค่าไม่สำเร็จ');
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return StreamBuilder<List<RiceField>>(
      stream: _stream,
      builder: (context, snap) {
        final active = (snap.data ?? const <RiceField>[]).where((f) => !f.isHarvested).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionHeader(
              title: 'แปลงนาของฉัน',
              action: active.isEmpty ? null : 'ดูทั้งหมด',
              onAction: () => _push(const FieldListScreen()),
            ),
            const SizedBox(height: 12),
            if (snap.hasError)
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const IconTile(icon: Remix.error_warning_line, tone: Tone.warn, size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('โหลดแปลงนาไม่สำเร็จ',
                              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.ink)),
                          Text(
                            snap.error.toString().contains('permission-denied')
                                ? 'ระบบยังไม่เปิดสิทธิ์ข้อมูลแปลงนา (กฎ Firestore)'
                                : 'ตรวจสอบอินเทอร์เน็ต แล้วดึงหน้าจอลงเพื่อลองใหม่',
                            style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else if (!snap.hasData)
              const Skeleton(height: 150, radius: 20, width: double.infinity)
            else if (active.isEmpty) ...[
              AppCard(
                onTap: () => _push(const FieldFormScreen()),
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(16)),
                      child: Icon(Remix.seedling_line, color: p.primaryText, size: 26),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('เริ่มสมุดแปลงนา',
                              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: p.ink)),
                          const SizedBox(height: 2),
                          Text('บอกพันธุ์และวันปลูก รับปฏิทินงานตามอายุข้าวอัตโนมัติ',
                              style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.4)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(color: p.primary, shape: BoxShape.circle),
                      child: const Icon(Remix.add_line, color: Colors.white, size: 20),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('ยังไม่ต้องการใช้? ', style: TextStyle(fontSize: 12.5, color: p.muted)),
                  AppLink(label: 'ซ่อนส่วนนี้', onTap: _hide, size: 12.5),
                ],
              ),
            ] else if (active.length == 1)
              FieldCard(field: active.first, onTap: () => _push(FieldDetailScreen(fieldId: active.first.id)))
            else
              SizedBox(
                height: 212,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  itemCount: active.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) => FieldCard(
                    field: active[i],
                    width: MediaQuery.of(context).size.width - 72,
                    onTap: () => _push(FieldDetailScreen(fieldId: active[i].id)),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
