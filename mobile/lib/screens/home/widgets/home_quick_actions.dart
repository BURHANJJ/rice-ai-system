import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../../core/localization/app_translations.dart';
import '../../../services/auth_provider.dart';
import '../../../services/navigation_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../fields/field_list_screen.dart';

class HomeQuickActions extends StatelessWidget {
  final NavigationProvider nav;

  const HomeQuickActions({super.key, required this.nav});

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final lang = context.watch<AuthProvider>().user?.settings['language'] ?? 'th';

    final tiles = [
      _Tile(AppTranslations.tr('home.outbreak', lang), Remix.map_pin_range_line, Tone.warn, () => nav.setIndex(1)),
      _Tile(AppTranslations.tr('home.wiki', lang), Remix.book_open_line, Tone.info, () => nav.setIndex(3)),
      _Tile(lang == 'en' ? 'My Fields' : 'สมุดแปลงนา', Remix.seedling_line, Tone.primary,
          () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FieldListScreen()))),
    ];

    return Column(
      children: [
        AppCard(
          onTap: () => nav.setIndex(2),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(color: p.bg, borderRadius: BorderRadius.circular(16)),
                child: CustomPaint(
                  painter: CornerFramePainter(length: 9, stroke: 2.4, inset: 11),
                  child: Icon(Remix.leaf_line, color: p.primaryText, size: 22),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lang == 'en' ? 'Scan a rice leaf' : 'สแกนตรวจโรคใบข้าว',
                      style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: p.ink),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppTranslations.tr('ai.desc', lang),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(color: p.primary, shape: BoxShape.circle),
                child: const Icon(Remix.arrow_right_line, color: Colors.white, size: 18),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            for (var i = 0; i < tiles.length; i++) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(
                child: AppCard(
                  onTap: tiles[i].onTap,
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconTile(icon: tiles[i].icon, tone: tiles[i].tone, size: 40),
                      const SizedBox(height: 12),
                      Text(
                        tiles[i].title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _Tile {
  const _Tile(this.title, this.icon, this.tone, this.onTap);
  final String title;
  final IconData icon;
  final Tone tone;
  final VoidCallback onTap;
}
