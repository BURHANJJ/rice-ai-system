import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';

/// First-launch introduction hosted by Ricey. Shown once, before login.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});
  final VoidCallback onDone;

  static const prefKey = 'onboarding_seen_v1';

  static Future<bool> seen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(prefKey) ?? false;
    } catch (_) {
      return true; // never block the app on storage errors
    }
  }

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _pages = [
    (
      RiceyMood.hello,
      'สวัสดี! $mascotNameเอง',
      'ผู้ช่วยดูแลนาข้าวของคุณ คอยตรวจโรค เตือนเมื่อมีการระบาดใกล้ๆ และบอกงานที่ต้องทำในแปลงตามอายุข้าว',
    ),
    (
      RiceyMood.scan,
      'ถ่ายภาพใบข้าว รู้ผลในไม่กี่วินาที',
      'AI ตรวจโรคใบไหม้ ขอบใบแห้ง และใบสีส้ม พร้อมวิธีจัดการตามคำแนะนำของกรมการข้าว',
    ),
    (
      RiceyMood.guard,
      'เฝ้าระวังโรคระบาดใกล้คุณ',
      'ดูแผนที่การระบาดรายจังหวัดและอำเภอ สภาพอากาศที่เสี่ยงต่อโรค และจดบันทึกแปลงนาได้ในที่เดียว',
    ),
  ];

  final _pc = PageController();
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _pc.addListener(() => setState(() => _page = _pc.page ?? 0));
  }

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    HapticFeedback.mediumImpact();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(OnboardingScreen.prefKey, true);
    } catch (_) {}
    widget.onDone();
  }

  void _next() {
    final i = _page.round();
    if (i >= _pages.length - 1) {
      _finish();
    } else {
      HapticFeedback.selectionClick();
      _pc.nextPage(duration: const Duration(milliseconds: 420), curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final last = _page.round() == _pages.length - 1;
    final top = MediaQuery.of(context).padding.top;
    final bottom = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      backgroundColor: p.bg,
      body: Stack(
        children: [
          PageView.builder(
            controller: _pc,
            itemCount: _pages.length,
            itemBuilder: (context, i) {
              final (mood, title, body) = _pages[i];
              final d = (i - _page).clamp(-1.0, 1.0);
              return Padding(
                padding: EdgeInsets.fromLTRB(28, top + 64, 28, 150 + bottom),
                child: Column(
                  children: [
                    Expanded(
                      child: LayoutBuilder(builder: (context, c) {
                        final s = c.maxHeight.clamp(160.0, 340.0);
                        return Center(
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // halo drifts slower than Ricey: a little depth while swiping
                              Transform.translate(
                                offset: Offset(d * 40, 0),
                                child: Container(
                                  width: s * 0.92,
                                  height: s * 0.92,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: RadialGradient(colors: [
                                      p.primarySoft,
                                      p.primarySoft.withOpacity(0),
                                    ], stops: const [0.62, 1]),
                                  ),
                                ),
                              ),
                              Transform.translate(
                                offset: Offset(d * 120, 0),
                                child: Opacity(
                                  opacity: (1 - d.abs()).clamp(0.0, 1.0),
                                  child: Ricey(mood: mood, size: s * 0.82),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 18),
                    Transform.translate(
                      offset: Offset(d * 60, 0),
                      child: Column(
                        children: [
                          Text(title,
                              textAlign: TextAlign.center, style: AppText.display(26, color: p.ink, height: 1.3)),
                          const SizedBox(height: 10),
                          Text(body,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 15, color: p.muted, height: 1.6)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          Positioned(
            top: top + 8,
            right: 12,
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 200),
              opacity: last ? 0 : 1,
              child: TextButton(
                onPressed: last ? null : _finish,
                child: Text('ข้าม', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: p.muted)),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 24 + bottom,
            child: Column(
              children: [
                Semantics(
                  label: 'หน้า ${_page.round() + 1} จาก ${_pages.length}',
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < _pages.length; i++)
                        Builder(builder: (_) {
                          final t = (1 - (i - _page).abs()).clamp(0.0, 1.0);
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: 8 + 18 * t,
                            height: 8,
                            decoration: BoxDecoration(
                              color: Color.lerp(p.line, p.primary, t),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                AppButton(
                  label: last ? 'เริ่มใช้งาน' : 'ถัดไป',
                  trailingIcon: last ? null : Icons.arrow_forward_rounded,
                  height: 56,
                  onPressed: _next,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
