import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../theme/app_theme.dart';
import '../../../widgets/app_ui.dart';
import '../../../widgets/brand.dart';

class ProfileStatsCard extends StatelessWidget {
  const ProfileStatsCard({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const SizedBox.shrink();
    }

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('diagnoses').where('user_id', isEqualTo: user.uid).snapshots(),
      builder: (context, snapshot) {
        int total = 0;
        int disease = 0;
        int healthy = 0;

        if (snapshot.hasData) {
          total = snapshot.data!.docs.length;
          for (var doc in snapshot.data!.docs) {
            final data = doc.data() as Map<String, dynamic>;
            if (data['disease_code'] == 'HEALTHY') {
              healthy++;
            } else {
              disease++;
            }
          }
        }

        final p = context.pal;
        final healthyShare = total == 0 ? 0.0 : healthy / total;

        return Container(
          decoration: BoxDecoration(color: p.hero, borderRadius: BorderRadius.circular(22)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: Stack(
              children: [
                const Positioned.fill(child: HeroContours()),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
                  child: Column(
                    children: [
                      IntrinsicHeight(
                        child: Row(
                          children: [
                            _stat(context, total, 'สแกนแล้ว', Colors.white),
                            VerticalDivider(width: 1, color: Colors.white.withOpacity(0.14)),
                            _stat(context, disease, 'ตรวจพบโรค', const Color(0xFFF2B8B0)),
                            VerticalDivider(width: 1, color: Colors.white.withOpacity(0.14)),
                            _stat(context, healthy, 'ปกติ', const Color(0xFF7BD389)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Text('สัดส่วนใบข้าวปกติ', style: TextStyle(color: p.heroMuted, fontSize: 11.5)),
                          const Spacer(),
                          Text(
                            '${(healthyShare * 100).round()}%',
                            style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Container(
                          height: 6,
                          color: const Color(0xFFF2B8B0).withOpacity(total == 0 ? 0.15 : 0.55),
                          child: TweenAnimationBuilder<double>(
                            tween: Tween(begin: 0, end: healthyShare),
                            duration: const Duration(milliseconds: 900),
                            curve: Curves.easeOutCubic,
                            builder: (_, v, __) => FractionallySizedBox(
                              alignment: Alignment.centerLeft,
                              widthFactor: v,
                              child: Container(color: const Color(0xFF7BD389)),
                            ),
                          ),
                        ),
                      ),
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

  Widget _stat(BuildContext context, int value, String label, Color color) {
    return Expanded(
      child: Column(
        children: [
          CountUp(value: value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color, height: 1.2)),
          Text(label, style: TextStyle(fontSize: 11.5, color: context.pal.heroMuted)),
        ],
      ),
    );
  }
}
