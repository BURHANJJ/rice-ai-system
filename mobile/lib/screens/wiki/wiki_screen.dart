import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:remixicon/remixicon.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import 'data/rice_department_data.dart';
import 'wiki_detail_sheet.dart';

class WikiScreen extends StatefulWidget {
  const WikiScreen({super.key});
  @override
  State<WikiScreen> createState() => _WikiScreenState();
}

class _WikiScreenState extends State<WikiScreen> {
  String _searchQuery = '';
  String _selectedCategory = 'ทั้งหมด';

  final List<String> _categories = ['ทั้งหมด', 'เชื้อรา', 'แบคทีเรีย', 'ไวรัส', 'ปกติ'];

  List<RiceDiseaseData> get _filteredDiseases {
    return RiceDepartmentData.diseases.where((d) {
      final matchesSearch = d.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          d.scientificName.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesCategory = _selectedCategory == 'ทั้งหมด' || d.category == _selectedCategory;
      return matchesSearch && matchesCategory;
    }).toList();
  }

  void _openDetail(RiceDiseaseData disease) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.forestDeep.withOpacity(0.45),
      builder: (_) => WikiDetailSheet(disease: disease),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final items = _filteredDiseases;

    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Text('คลังโรคข้าว', style: AppText.display(24, color: p.ink)),
                  Text('อ้างอิงข้อมูลวิชาการจากกรมการข้าว', style: TextStyle(fontSize: 13, color: p.muted)),
                  const SizedBox(height: 14),
                  AppSearchField(
                    hint: 'ค้นหาชื่อโรค หรือชื่อวิทยาศาสตร์',
                    onChanged: (val) => setState(() => _searchQuery = val),
                  ),
                  const SizedBox(height: 12),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: ChoiceChips(
                options: _categories,
                selected: _selectedCategory,
                onSelected: (c) => setState(() => _selectedCategory = c),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              sliver: SliverToBoxAdapter(child: _buildStatsRow()),
            ),
            if (items.isEmpty)
              const SliverToBoxAdapter(
                child: EmptyState(
                    icon: Remix.search_line,
                    title: 'ไม่พบโรคที่ค้นหา',
                    message: 'ลองค้นหาด้วยคำอื่น หรือเลือกหมวด "ทั้งหมด"',
                    mascot: RiceyMood.think),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 130),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: FadeSlideIn.stagger(i,
                          key: ValueKey('${items[i].code}$_selectedCategory'), child: _buildDiseaseCard(items[i])),
                    ),
                    childCount: items.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow() {
    final p = context.pal;
    Widget stat(String value, String label, Color color) => Expanded(
          child: Column(
            children: [
              Text(value, style: AppText.display(20, color: color, height: 1.3)),
              Text(label, style: TextStyle(fontSize: 11.5, color: p.muted)),
            ],
          ),
        );
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: IntrinsicHeight(
        child: Row(
          children: [
            stat('4', 'ประเภทโรค', p.ink),
            VerticalDivider(width: 1, color: p.line),
            stat('3', 'โรคอันตราย', p.danger),
            VerticalDivider(width: 1, color: p.line),
            stat('AI', 'พร้อมใช้', p.primaryText),
          ],
        ),
      ),
    );
  }

  Widget _buildDiseaseCard(RiceDiseaseData disease) {
    final p = context.pal;
    final riskTone = _riskTone(disease.riskLevel);

    return AppCard(
      onTap: () => _openDetail(disease),
      padding: const EdgeInsets.all(10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: 96,
              height: 112,
              child: Image.network(
                disease.imageUrl,
                headers: const {'User-Agent': 'RiceAISystem/1.0'},
                fit: BoxFit.cover,
                loadingBuilder: (c, child, progress) =>
                    progress == null ? child : const Skeleton(width: 96, height: 112, radius: 0),
                errorBuilder: (context, error, stackTrace) => Container(
                  color: p.subtle,
                  child: Icon(Remix.image_line, color: p.faint, size: 30),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2, right: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      StatusPill(label: disease.category, tone: categoryTone(disease.category), dot: false),
                      StatusPill(label: disease.riskLevel, tone: riskTone),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(disease.name, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.ink)),
                  Text(
                    disease.scientificName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: p.muted),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    disease.shortDescription,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: p.body, height: 1.45),
                  ),
                  const SizedBox(height: 8),
                  if (disease.code != 'HEALTHY')
                    _DiseaseStatsRow(disease: disease)
                  else
                    _statText(Remix.check_double_line, p.safe, 'ปลอดภัย'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Tone _riskTone(String level) {
    if (level == 'เสี่ยงสูง') return Tone.danger;
    if (level == 'ปานกลาง') return Tone.warn;
    return Tone.safe;
  }
}

Tone categoryTone(String category) {
  if (category == 'ไวรัส') return Tone.info;
  if (category == 'แบคทีเรีย') return Tone.warn;
  if (category == 'ปกติ') return Tone.safe;
  return Tone.primary;
}

Widget _statText(IconData icon, Color color, String text) {
  return Row(
    children: [
      Icon(icon, size: 13, color: color),
      const SizedBox(width: 5),
      Flexible(
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 11.5, color: color, fontWeight: FontWeight.w600),
        ),
      ),
    ],
  );
}

class _DiseaseStatsRow extends StatelessWidget {
  final RiceDiseaseData disease;
  const _DiseaseStatsRow({required this.disease});

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return FutureBuilder<QuerySnapshot>(
      future: FirebaseFirestore.instance.collection('diagnoses').where('disease_code', isEqualTo: disease.code).get(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Skeleton(width: 120, height: 12);
        }

        final docs = snapshot.data!.docs;
        if (docs.isEmpty) {
          return _statText(Remix.shield_check_line, p.safe, 'ยังไม่พบรายงาน');
        }

        final Set<String> provinces = {};
        for (var d in docs) {
          final data = d.data() as Map<String, dynamic>;
          final loc = data['location'] as Map<String, dynamic>?;
          if (loc != null && loc['province'] != null) {
            provinces.add(loc['province']);
          }
        }

        return _statText(
            Remix.map_pin_2_line, p.danger, 'พบแล้ว ${docs.length} ครั้ง · ${provinces.length} จังหวัดเสี่ยง');
      },
    );
  }
}
