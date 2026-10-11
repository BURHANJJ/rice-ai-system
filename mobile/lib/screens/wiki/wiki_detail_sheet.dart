import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../scan/scan_screen.dart' show ChemicalAdvice;
import 'data/rice_department_data.dart';
import 'wiki_screen.dart' show categoryTone;

class WikiDetailSheet extends StatefulWidget {
  final RiceDiseaseData disease;

  const WikiDetailSheet({super.key, required this.disease});

  @override
  State<WikiDetailSheet> createState() => _WikiDetailSheetState();
}

class _WikiDetailSheetState extends State<WikiDetailSheet> {
  bool _isAcademicMode = false; // false = Farmer, true = Academic

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final d = widget.disease;
    final riskTone = d.riskLevel == 'เสี่ยงสูง'
        ? Tone.danger
        : d.riskLevel == 'ปานกลาง'
            ? Tone.warn
            : Tone.safe;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.96,
      builder: (_, scrollController) => Container(
        decoration: BoxDecoration(
          color: p.bg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        clipBehavior: Clip.antiAlias,
        child: CustomScrollView(
          controller: scrollController,
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverAppBar(
              expandedHeight: 280,
              pinned: true,
              stretch: true,
              backgroundColor: p.bg,
              surfaceTintColor: Colors.transparent,
              automaticallyImplyLeading: false,
              leadingWidth: 64,
              leading: Padding(
                padding: const EdgeInsets.only(left: 16, top: 6, bottom: 6),
                child: _GlassButton(icon: Remix.arrow_down_s_line, tooltip: 'ปิด', onTap: () => Navigator.pop(context)),
              ),
              flexibleSpace: FlexibleSpaceBar(
                stretchModes: const [StretchMode.zoomBackground],
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.network(
                      d.imageUrl,
                      headers: const {'User-Agent': 'RiceAISystem/1.0'},
                      fit: BoxFit.cover,
                      errorBuilder: (c, e, s) =>
                          Container(color: p.subtle, child: Icon(Remix.image_line, color: p.faint, size: 48)),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 130,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [p.bg.withOpacity(0), p.bg],
                          ),
                        ),
                      ),
                    ),
                    const Positioned(
                      top: 12,
                      left: 0,
                      right: 0,
                      child: Center(child: _Handle()),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 32 + MediaQuery.of(context).padding.bottom),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 6,
                      children: [
                        StatusPill(label: d.category, tone: categoryTone(d.category), dot: false),
                        StatusPill(label: d.riskLevel, tone: riskTone),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(d.name, style: AppText.display(28, color: p.ink, height: 1.25)),
                    Text(d.scientificName, style: TextStyle(fontSize: 14, fontStyle: FontStyle.italic, color: p.muted)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(Remix.bookmark_3_line, size: 14, color: p.primaryText),
                        const SizedBox(width: 6),
                        Text(
                          'อ้างอิงข้อมูลทางวิชาการจาก: กรมการข้าว',
                          style: TextStyle(fontSize: 12.5, color: p.primaryText, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    SegmentedTabs(
                      labels: const ['ภาษาชาวบ้าน', 'เจาะลึกวิชาการ'],
                      index: _isAcademicMode ? 1 : 0,
                      onChanged: (i) => setState(() => _isAcademicMode = i == 1),
                    ),
                    const SizedBox(height: 16),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 320),
                      switchInCurve: Curves.easeOutCubic,
                      transitionBuilder: (c, a) => FadeTransition(
                        opacity: a,
                        child: SlideTransition(
                          position:
                              Tween(begin: Offset(_isAcademicMode ? 0.05 : -0.05, 0), end: Offset.zero).animate(a),
                          child: c,
                        ),
                      ),
                      layoutBuilder: (current, previous) => Stack(
                        alignment: Alignment.topCenter,
                        children: [...previous, if (current != null) current],
                      ),
                      child: Column(
                        key: ValueKey(_isAcademicMode),
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _buildInfoCard(
                            icon: Remix.search_eye_line,
                            tone: Tone.info,
                            title: 'ลักษณะอาการ',
                            content: _isAcademicMode ? d.academicSymptoms : d.farmerSymptoms,
                          ),
                          const SizedBox(height: 12),
                          _buildInfoCard(
                            icon: Remix.cloud_windy_line,
                            tone: Tone.neutral,
                            title: 'ปัจจัยและสภาพแวดล้อม',
                            content:
                                _isAcademicMode ? d.academicEnvironment : 'สภาพอากาศและปัจจัยที่กระตุ้นให้เกิดโรคนี้',
                            subtitle: !_isAcademicMode && d.code != 'HEALTHY'
                                ? 'มักระบาดตอนอากาศชื้น ฝนตกชุก หรือใส่ปุ๋ยยูเรียเยอะเกินไป'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          _buildInfoCard(
                            icon: Remix.shield_cross_line,
                            tone: Tone.safe,
                            title: 'การป้องกันและกำจัด',
                            content: _isAcademicMode ? d.academicPrevention : d.farmerPrevention,
                            bottomContent: d.recommendedChemicals.isEmpty
                                ? null
                                : ChemicalAdvice(chemicals: d.recommendedChemicals),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required Tone tone,
    required String title,
    required String content,
    String? subtitle,
    Widget? bottomContent,
  }) {
    final p = context.pal;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconTile(icon: icon, tone: tone, size: 36),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: p.ink))),
            ],
          ),
          const SizedBox(height: 12),
          if (subtitle != null) ...[
            Text(subtitle, style: TextStyle(fontSize: 14, color: p.ink, height: 1.6, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
          ],
          Text(content, style: TextStyle(fontSize: 14, color: p.body, height: 1.7)),
          if (bottomContent != null) ...[
            Padding(padding: const EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: p.line)),
            bottomContent,
          ],
        ],
      ),
    );
  }
}

class _Handle extends StatelessWidget {
  const _Handle();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 5,
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.8), borderRadius: BorderRadius.circular(3)),
    );
  }
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.icon, required this.tooltip, required this.onTap});
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Pressable(
        onTap: onTap,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: Colors.white.withOpacity(0.92), borderRadius: BorderRadius.circular(14)),
          child: Icon(icon, color: AppColors.ink, size: 22),
        ),
      ),
    );
  }
}
