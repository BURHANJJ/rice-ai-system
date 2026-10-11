import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';

import '../../../services/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';

class ProfileHeader extends StatelessWidget {
  final AppUser? user;
  final VoidCallback? onEdit;

  const ProfileHeader({super.key, required this.user, this.onEdit});

  String get _roleLabel {
    switch (user?.role.toLowerCase()) {
      case 'researcher':
        return 'นักวิชาการ';
      case 'admin':
        return 'ผู้ดูแลระบบ';
      case 'expert':
        return 'ผู้เชี่ยวชาญ';
      default:
        return 'เกษตรกร';
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final name = user?.fullName ?? 'ผู้ใช้งาน';
    final initial = name.isNotEmpty ? name.characters.first.toUpperCase() : 'U';

    return Row(
      children: [
        Container(
          width: 66,
          height: 66,
          decoration: BoxDecoration(
            color: p.hero,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [BoxShadow(color: p.hero.withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 8))],
          ),
          alignment: Alignment.center,
          child: Text(initial, style: AppText.display(27, color: AppColors.cream, height: 1.1)),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.display(21, color: p.ink)),
              Text(
                user?.email ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, color: p.muted),
              ),
              const SizedBox(height: 5),
              StatusPill(label: _roleLabel, tone: Tone.primary, icon: Remix.leaf_line),
            ],
          ),
        ),
        if (onEdit != null) AppIconButton(icon: Remix.edit_line, tooltip: 'แก้ไขข้อมูลส่วนตัว', onPressed: onEdit),
      ],
    );
  }
}
