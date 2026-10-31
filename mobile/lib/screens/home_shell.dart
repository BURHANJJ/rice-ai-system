import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../core/localization/app_translations.dart';
import '../services/auth_provider.dart';
import '../services/navigation_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import 'home/home_screen.dart';
import 'outbreak/outbreak_screen.dart';
import 'profile/profile_screen.dart';
import 'scan/scan_screen.dart';
import 'wiki/wiki_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with SingleTickerProviderStateMixin {
  final _screens = const [
    HomeScreen(),
    OutbreakScreen(),
    ScanScreen(),
    WikiScreen(),
    ProfileScreen(),
  ];

  late final AnimationController _fade =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 320), value: 1);
  int _shown = 0;

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final nav = context.watch<NavigationProvider>();
    if (nav.currentIndex != _shown) {
      _shown = nav.currentIndex;
      if (!reduceMotion(context)) _fade.forward(from: 0);
    }
    final p = context.pal;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: (context.isDarkMode ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark)
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: p.bg,
        extendBody: true,
        body: Stack(
          children: [
            AnimatedBuilder(
              animation: _fade,
              child: IndexedStack(index: nav.currentIndex, children: _screens),
              builder: (_, child) {
                final t = Curves.easeOutCubic.transform(_fade.value);
                return Opacity(
                  opacity: 0.4 + 0.6 * t,
                  child: Transform.translate(offset: Offset(0, 10 * (1 - t)), child: child),
                );
              },
            ),
            Positioned(left: 0, right: 0, bottom: 0, child: _BottomNav(nav: nav)),
          ],
        ),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.nav});
  final NavigationProvider nav;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final lang = context.watch<AuthProvider>().user?.settings['language'] ?? 'th';
    final bottom = MediaQuery.of(context).padding.bottom;

    void go(int i) {
      if (i == nav.currentIndex) return;
      HapticFeedback.selectionClick();
      nav.setIndex(i);
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(14, 0, 14, bottom > 0 ? bottom : 16),
      child: SizedBox(
        height: 96,
        child: Stack(
          alignment: Alignment.bottomCenter,
          clipBehavior: Clip.none,
          children: [
            // ====================================================================
            // 📱 จุดปรับแต่งสีแถบเมนูล่าง (Mobile Bottom Navigation Bar)
            // ====================================================================
            Container(
              height: 68,
              decoration: BoxDecoration(
                color: p.surface, // สีพื้นหลังแถบเมนูล่าง (สีขาว p.surface หรือ AppPalette)
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: p.line), // สีเส้นขอบแถบเมนู (สีครีม p.line)
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(context.isDarkMode ? 0.4 : 0.1),
                      blurRadius: 30,
                      offset: const Offset(0, 12)),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Row(
                children: [
                  _NavItem(
                    icon: Remix.home_5_line,
                    activeIcon: Remix.home_5_fill,
                    label: AppTranslations.tr('nav.home', lang),
                    selected: nav.currentIndex == 0,
                    onTap: () => go(0),
                  ),
                  _NavItem(
                    icon: Remix.map_2_line,
                    activeIcon: Remix.map_2_fill,
                    label: AppTranslations.tr('nav.outbreak', lang),
                    selected: nav.currentIndex == 1,
                    onTap: () => go(1),
                  ),
                  const Expanded(child: SizedBox()),
                  _NavItem(
                    icon: Remix.book_3_line,
                    activeIcon: Remix.book_3_fill,
                    label: AppTranslations.tr('nav.wiki', lang),
                    selected: nav.currentIndex == 3,
                    onTap: () => go(3),
                  ),
                  _NavItem(
                    icon: Remix.user_line,
                    activeIcon: Remix.user_fill,
                    label: AppTranslations.tr('nav.profile', lang),
                    selected: nav.currentIndex == 4,
                    onTap: () => go(4),
                  ),
                ],
              ),
            ),
            Positioned(
              top: 4,
              child: _ScanButton(selected: nav.currentIndex == 2, onTap: () => go(2)),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                width: selected ? 46 : 30,
                height: 28,
                decoration: BoxDecoration(
                  color: selected ? p.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
                  child: Icon(
                    selected ? activeIcon : icon,
                    key: ValueKey(selected),
                    size: 21,
                    color: selected ? p.primaryText : p.faint,
                  ),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? p.primaryText : p.faint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScanButton extends StatelessWidget {
  const _ScanButton({required this.selected, required this.onTap});
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Semantics(
      button: true,
      selected: selected,
      label: 'สแกน',
      child: Pressable(
        onTap: onTap,
        scale: 0.92,
        child: Column(
          children: [
            // ====================================================================
            // 🔘 จุดปรับแต่งสีปุ่มสแกนกลมใหญ่ตรงกลาง (Center Floating Scan Button)
            // ====================================================================
            AnimatedContainer(
              duration: const Duration(milliseconds: 280),
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                color: p.primary, // สีพื้นหลังปุ่มสแกนกลม (สีเขียวหลัก p.primary)
                shape: BoxShape.circle,
                border: Border.all(color: p.bg, width: 5), // ขอบหนาสีพื้นหลังจอ (สีครีม p.bg)
                boxShadow: [
                  BoxShadow(
                    color: p.primary.withOpacity(selected ? 0.45 : 0.3),
                    blurRadius: selected ? 22 : 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: CustomPaint(
                painter: CornerFramePainter(length: 7, stroke: 2.2, inset: 15),
                child: const Center(child: Icon(Remix.focus_3_line, color: Colors.white, size: 22)),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              'สแกน',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                color: selected ? p.primaryText : p.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
