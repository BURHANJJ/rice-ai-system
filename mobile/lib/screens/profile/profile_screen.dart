import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/auth_provider.dart';
import '../../services/navigation_provider.dart';
import '../../services/app_version.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../auth/login_screen.dart';
import '../fields/field_list_screen.dart';
import 'widgets/profile_header.dart';
import 'widgets/profile_menu_item.dart';
import 'widgets/profile_stats_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _locationDesc = 'กำลังค้นหาพิกัด...';

  @override
  void initState() {
    super.initState();
    _determinePosition();
  }

  Future<void> _determinePosition() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) setState(() => _locationDesc = 'ปิดตำแหน่ง GPS อยู่');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) setState(() => _locationDesc = 'ไม่ได้รับอนุญาต GPS');
          return;
        }
      }

      final position = await Geolocator.getCurrentPosition();
      final placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);

      if (placemarks.isNotEmpty) {
        final place = placemarks[0];
        final lat = position.latitude.toStringAsFixed(3);
        final lon = position.longitude.toStringAsFixed(3);
        final province = place.administrativeArea ?? 'ไม่ระบุ';
        if (mounted) {
          setState(() {
            _locationDesc = '$lat°N, $lon°E - $province';
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _locationDesc = 'ระบุพิกัดด้วยตัวเอง');
    }
  }

  void _showLanguageSheet(AuthProvider auth, String currentLang) {
    showAppSheet<void>(
      context,
      builder: (ctx) {
        final p = ctx.pal;
        Widget option(String code, String label, String sub) {
          final selected = currentLang == code;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AppCard(
              onTap: () {
                auth.updateSetting('language', code);
                Navigator.pop(ctx);
              },
              borderColor: selected ? p.primary : null,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.ink)),
                        Text(sub, style: TextStyle(fontSize: 12.5, color: p.muted)),
                      ],
                    ),
                  ),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: selected ? p.primary : Colors.transparent,
                      border: Border.all(color: selected ? p.primary : p.line, width: 2),
                    ),
                    child: selected ? const Icon(Remix.check_line, size: 15, color: Colors.white) : null,
                  ),
                ],
              ),
            ),
          );
        }

        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SheetHeader(title: 'เลือกภาษา', subtitle: 'Language', icon: Remix.global_line),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                  child: Column(
                    children: [
                      option('th', 'ภาษาไทย', 'Thai'),
                      option('en', 'English', 'ภาษาอังกฤษ'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showEditProfileSheet(AppUser? user, bool isEn) {
    final ctrl = TextEditingController(text: user?.fullName);
    showAppSheet<void>(
      context,
      builder: (ctx) {
        bool busy = false;
        return StatefulBuilder(
          builder: (ctx, setSheet) => Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SheetHeader(
                      title: isEn ? 'Edit Personal Info' : 'แก้ไขข้อมูลส่วนตัว',
                      icon: Remix.user_settings_line,
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AppField(
                            controller: ctrl,
                            label: isEn ? 'Full Name' : 'ชื่อ-นามสกุล',
                            icon: Remix.user_3_line,
                            autofocus: true,
                            textCapitalization: TextCapitalization.words,
                          ),
                          const SizedBox(height: 20),
                          AppButton(
                            label: isEn ? 'Save Data' : 'บันทึกข้อมูล',
                            icon: Remix.save_3_line,
                            busy: busy,
                            onPressed: () async {
                              if (ctrl.text.trim().isNotEmpty) {
                                setSheet(() => busy = true);
                                await context.read<AuthProvider>().updateProfileName(ctrl.text.trim());
                                if (ctx.mounted) Navigator.pop(ctx);
                                if (mounted) AppToast.success(context, 'อัปเดตชื่อเรียบร้อยแล้ว', title: 'บันทึกแล้ว');
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showNotificationsSheet() {
    showAppSheet<void>(
      context,
      builder: (ctx) => SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.55,
        child: const Column(
          children: [
            SheetHeader(title: 'การแจ้งเตือน', icon: Remix.notification_3_line),
            Expanded(
              child: Center(
                child: EmptyState(
                    icon: Remix.notification_badge_line, title: 'ไม่มีการแจ้งเตือนใหม่', mascot: RiceyMood.sleep),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showExportMock() async {
    showAppProgress(context, title: 'กำลังเตรียมไฟล์รายงาน...', message: 'กรุณารอสักครู่ (PDF / CSV)');
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    AppToast.success(context, 'ส่งออกรายงาน CSV สำเร็จ', title: 'ส่งออกแล้ว');
  }

  void _showAcademicAccessDenied() {
    showAppConfirm(
      context,
      title: 'สงวนสิทธิ์การเข้าถึง',
      message:
          'เมนูนี้สงวนสิทธิ์เฉพาะผู้ใช้งานระดับ "นักวิชาการ" (Academic/Expert) เท่านั้น หากท่านต้องการสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ',
      confirmLabel: 'เข้าใจแล้ว',
      icon: Remix.lock_password_line,
      tone: Tone.danger,
      showCancel: false,
    );
  }

  Future<void> _confirmLogout() async {
    final ok = await showAppConfirm(
      context,
      title: 'ออกจากระบบ',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบบัญชีนี้?',
      confirmLabel: 'ออกจากระบบ',
      icon: Remix.logout_box_r_line,
      tone: Tone.danger,
      destructive: true,
    );
    if (!ok || !mounted) return;
    await context.read<AuthProvider>().logout();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (r) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final p = context.pal;

    final bool isAlertEnabled = user?.settings['alerts_enabled'] ?? true;
    final bool isDarkMode = user?.settings['dark_mode'] ?? false;
    final bool showFields = user?.settings['show_fields'] ?? true;
    final String currentLang = user?.settings['language'] ?? 'th';
    final bool isEn = currentLang == 'en';
    final String langDesc = isEn ? 'English' : 'ภาษาไทย (Thai)';

    var i = 0;
    Widget step(Widget child) => FadeSlideIn.stagger(i++, child: child);

    return Scaffold(
      backgroundColor: p.bg,
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, 130),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            step(ProfileHeader(user: user, onEdit: () => _showEditProfileSheet(user, isEn))),
            const SizedBox(height: 18),
            step(const ProfileStatsCard()),
            step(ProfileSectionHeader(title: isEn ? 'Account & Location' : 'บัญชีและตำแหน่ง')),
            step(_buildMenuCard([
              ProfileMenuItem(
                icon: Remix.user_3_line,
                tone: Tone.primary,
                title: isEn ? 'Personal Info' : 'ข้อมูลส่วนตัว',
                subtitle: isEn ? 'Edit name and farm details' : 'แก้ไขชื่อและข้อมูลฟาร์ม',
                onTap: () => _showEditProfileSheet(user, isEn),
              ),
              ProfileMenuItem(
                icon: Remix.map_pin_2_line,
                tone: Tone.warn,
                title: isEn ? 'GPS Location' : 'ตำแหน่ง GPS',
                subtitle: _locationDesc,
                trailing: Icon(Remix.refresh_line, color: p.faint, size: 19),
                onTap: () {
                  setState(() => _locationDesc = 'กำลังค้นหาพิกัด...');
                  _determinePosition();
                },
              ),
              ProfileMenuItem(
                icon: Remix.notification_4_line,
                tone: Tone.info,
                title: isEn ? 'Notifications' : 'การแจ้งเตือน',
                subtitle: isEn ? 'Outbreak alerts' : 'แจ้งเตือนพื้นที่ระบาด',
                showBorder: false,
                onTap: _showNotificationsSheet,
              ),
            ])),
            step(ProfileSectionHeader(title: isEn ? 'Data & Reports' : 'ข้อมูลและรายงาน')),
            step(_buildMenuCard([
              ProfileMenuItem(
                icon: Remix.book_read_line,
                tone: Tone.info,
                title: isEn ? 'Academic Menu' : 'เมนูนักวิชาการ',
                subtitle: isEn ? 'Disease data & AI models' : 'จัดการข้อมูลโรคและแบบจำลอง AI',
                onTap: () async {
                  if (user?.role.toUpperCase() == 'RESEARCHER' || user?.role.toUpperCase() == 'ADMIN') {
                    final url = Uri.parse('https://rice-ai-appp.web.app/login');
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    }
                  } else {
                    _showAcademicAccessDenied();
                  }
                },
              ),
              ProfileMenuItem(
                icon: Remix.file_list_3_line,
                tone: Tone.neutral,
                title: isEn ? 'Export Report' : 'ส่งออกรายงาน',
                subtitle: isEn ? 'Export PDF / CSV' : 'Export รายงาน PDF / CSV',
                onTap: _showExportMock,
              ),
              ProfileMenuItem(
                icon: Remix.seedling_line,
                tone: Tone.primary,
                title: isEn ? 'Field Notebook' : 'สมุดแปลงนา',
                subtitle: isEn ? 'Crop calendar & field diary' : 'ปฏิทินการปลูกและบันทึกแปลง',
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FieldListScreen())),
              ),
              ProfileMenuItem(
                icon: Remix.map_2_line,
                tone: Tone.warn,
                title: isEn ? 'Outbreak Area' : 'พื้นที่ระบาด',
                subtitle: isEn ? 'View 77 provinces status' : 'ดูสถานการณ์ 77 จังหวัด',
                showBorder: false,
                onTap: () => context.read<NavigationProvider>().setIndex(1),
              ),
            ])),
            step(ProfileSectionHeader(title: isEn ? 'Settings' : 'การตั้งค่า')),
            step(_buildMenuCard([
              ProfileMenuItem(
                icon: Remix.alarm_warning_line,
                tone: Tone.danger,
                title: isEn ? 'Outbreak Alerts' : 'แจ้งเตือนโรคระบาด',
                subtitle: isEn ? 'Receive risk area alerts' : 'รับการแจ้งเตือนพื้นที่เสี่ยง',
                onTap: () => auth.updateSetting('alerts_enabled', !isAlertEnabled),
                trailing: AppSwitch(
                  value: isAlertEnabled,
                  label: isEn ? 'Outbreak Alerts' : 'แจ้งเตือนโรคระบาด',
                  onChanged: (val) => auth.updateSetting('alerts_enabled', val),
                ),
              ),
              ProfileMenuItem(
                icon: Remix.seedling_line,
                tone: Tone.primary,
                title: isEn ? 'Field notebook on Home' : 'แสดงสมุดแปลงนาที่หน้าหลัก',
                subtitle: isEn ? 'Hide if you do not track fields' : 'ปิดได้หากไม่ต้องการบันทึกแปลง',
                onTap: () => auth.updateSetting('show_fields', !showFields),
                trailing: AppSwitch(
                  value: showFields,
                  label: 'แสดงสมุดแปลงนาที่หน้าหลัก',
                  onChanged: (val) => auth.updateSetting('show_fields', val),
                ),
              ),
              ProfileMenuItem(
                icon: Remix.moon_clear_line,
                tone: Tone.neutral,
                title: isEn ? 'Dark Mode' : 'โหมดสีเข้ม',
                subtitle: isEn ? 'Dark theme' : 'ธีมสีเข้มสำหรับกลางคืน',
                onTap: () => auth.updateSetting('dark_mode', !isDarkMode),
                trailing: AppSwitch(
                  value: isDarkMode,
                  label: 'Dark Mode',
                  onChanged: (val) => auth.updateSetting('dark_mode', val),
                ),
              ),
              ProfileMenuItem(
                icon: Remix.global_line,
                tone: Tone.neutral,
                title: isEn ? 'Language' : 'ภาษา',
                subtitle: langDesc,
                showBorder: false,
                onTap: () => _showLanguageSheet(auth, currentLang),
              ),
            ])),
            step(ProfileSectionHeader(title: isEn ? 'Privacy & Terms' : 'ความเป็นส่วนตัวและเงื่อนไข')),
            step(_buildMenuCard([
              ProfileMenuItem(
                icon: Remix.shield_user_line,
                tone: Tone.info,
                title: isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว',
                subtitle: isEn ? 'What we collect and your rights' : 'ข้อมูลที่เก็บและสิทธิของคุณ',
                onTap: () => _openWeb('/privacy'),
              ),
              ProfileMenuItem(
                icon: Remix.file_text_line,
                tone: Tone.neutral,
                title: isEn ? 'Terms of Service' : 'เงื่อนไขการให้บริการ',
                subtitle: isEn ? 'Rules for using Rice AI' : 'ข้อตกลงการใช้งาน Rice AI',
                showBorder: false,
                onTap: () => _openWeb('/terms'),
              ),
            ])),
            const SizedBox(height: 24),
            step(AppButton(
              label: isEn ? 'Log out' : 'ออกจากระบบ',
              icon: Remix.logout_box_r_line,
              kind: ButtonKind.danger,
              onPressed: _confirmLogout,
            )),
            const SizedBox(height: 16),
            Center(child: Text('Rice AI · ${AppVersion.label}', style: TextStyle(fontSize: 11.5, color: p.faint))),
          ],
        ),
      ),
    );
  }

  Future<void> _openWeb(String path) async {
    final url = Uri.parse('https://rice-ai-appp.web.app$path');
    if (!await launchUrl(url, mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('เปิดหน้าเว็บไม่ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต')));
    }
  }

  Widget _buildMenuCard(List<Widget> children) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: ClipRRect(borderRadius: BorderRadius.circular(20), child: Column(children: children)),
    );
  }
}
