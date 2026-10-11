import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';

import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';

class ProfileMenuItem extends StatelessWidget {
  final IconData icon;
  final Tone tone;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final bool showBorder;
  final VoidCallback? onTap;

  const ProfileMenuItem({
    super.key,
    required this.icon,
    required this.tone,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.showBorder = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Pressable(
      onTap: onTap,
      scale: 0.985,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          border: showBorder ? Border(bottom: BorderSide(color: p.line)) : null,
        ),
        child: Row(
          children: [
            IconTile(icon: icon, tone: tone, size: 38),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: p.ink)),
                  const SizedBox(height: 1),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    child: Text(
                      subtitle,
                      key: ValueKey(subtitle),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: p.muted),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            trailing ?? Icon(Remix.arrow_right_s_line, color: p.faint),
          ],
        ),
      ),
    );
  }
}

class ProfileSectionHeader extends StatelessWidget {
  final String title;

  const ProfileSectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10, top: 24),
      child: Text(
        title,
        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: context.pal.muted, letterSpacing: 0.3),
      ),
    );
  }
}
