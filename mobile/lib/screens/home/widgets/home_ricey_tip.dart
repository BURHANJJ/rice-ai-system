import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../widgets/app_ui.dart';

/// Daily tip from Ricey. Starts on a tip picked by the date, tap for the next.
/// Late at night Ricey is asleep instead.
class HomeRiceyTip extends StatefulWidget {
  const HomeRiceyTip({super.key});

  @override
  State<HomeRiceyTip> createState() => _HomeRiceyTipState();
}

class _HomeRiceyTipState extends State<HomeRiceyTip> {
  static const _tips = <(RiceyMood, String)>[
    (RiceyMood.scan, 'สแกนใบข้าวสัปดาห์ละครั้ง ช่วยให้เจอโรคตั้งแต่ระยะแรก'),
    (RiceyMood.think, 'เห็นแผลรูปตาตรงกลางสีเทาบนใบ? อาจเป็นโรคใบไหม้ ลองสแกนให้ช่วยดู'),
    (RiceyMood.guard, 'ใส่ปุ๋ยไนโตรเจนแต่พอดี ใส่มากเกินไปข้าวจะอ่อนแอต่อโรคใบไหม้'),
    (RiceyMood.worried, 'อย่าระบายน้ำจากแปลงที่เป็นโรคขอบใบแห้งเข้าแปลงอื่น เชื้อแพร่ไปกับน้ำได้'),
    (RiceyMood.think, 'เพลี้ยจักจั่นสีเขียวเป็นพาหะโรคใบสีส้ม หมั่นสำรวจโคนกอข้าว'),
    (RiceyMood.phone, 'ถ่ายภาพช่วงเช้าหรือเย็น แสงนุ่ม ภาพชัด ผลวิเคราะห์จะแม่นขึ้น'),
    (RiceyMood.joy, 'ใช้เมล็ดพันธุ์ดีจากแหล่งที่เชื่อถือได้ ลดโรคที่ติดมากับเมล็ด'),
    (RiceyMood.guard, 'ปลูกพันธุ์ต้านทานโรคที่เหมาะกับพื้นที่ ช่วยลดการใช้สารเคมี'),
  ];

  late int _i = DateTime.now().difference(DateTime(2024)).inDays % _tips.length;
  bool _awake = false;

  bool get _night {
    final h = DateTime.now().hour;
    return !_awake && (h >= 21 || h < 5);
  }

  void _next() {
    HapticFeedback.selectionClick();
    setState(() {
      if (_night) {
        _awake = true;
      } else {
        _i = (_i + 1) % _tips.length;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final night = _night;
    final (mood, text) = night ? (RiceyMood.sleep, 'ดึกแล้ว พักผ่อนนะ พรุ่งนี้เช้าค่อยออกสำรวจแปลงกัน') : _tips[_i];
    return Semantics(
      button: true,
      hint: 'แตะเพื่อดูเคล็ดลับถัดไป',
      child: RiceyTip(
        mood: mood,
        size: 78,
        title: night ? '$mascotNameหลับอยู่ · แตะเพื่อปลุก' : '$mascotNameแนะนำ · ${_i + 1}/${_tips.length}',
        message: text,
        onTap: _next,
      ),
    );
  }
}
