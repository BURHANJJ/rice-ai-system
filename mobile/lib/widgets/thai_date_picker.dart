import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import 'app_ui.dart';

const thaiMonths = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
const thaiMonthsShort = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.'
];

/// 12 ต.ค. 2569
String thaiDate(DateTime d, {bool short = true}) =>
    '${d.day} ${short ? thaiMonthsShort[d.month - 1] : thaiMonths[d.month - 1]} ${d.year + 543}';

/// Wheel date picker in Thai (day · month · พ.ศ.) inside a brand sheet.
Future<DateTime?> showThaiDatePicker(
  BuildContext context, {
  required DateTime initial,
  required DateTime first,
  required DateTime last,
  String title = 'เลือกวันที่',
}) {
  return showAppSheet<DateTime>(
    context,
    builder: (_) => _ThaiDatePicker(initial: initial, first: first, last: last, title: title),
  );
}

class _ThaiDatePicker extends StatefulWidget {
  const _ThaiDatePicker({required this.initial, required this.first, required this.last, required this.title});
  final DateTime initial;
  final DateTime first;
  final DateTime last;
  final String title;

  @override
  State<_ThaiDatePicker> createState() => _ThaiDatePickerState();
}

class _ThaiDatePickerState extends State<_ThaiDatePicker> {
  late int _y = widget.initial.year;
  late int _m = widget.initial.month;
  late int _d = widget.initial.day;
  late final _years = [for (var y = widget.first.year; y <= widget.last.year; y++) y];
  late final _yc = FixedExtentScrollController(initialItem: _years.indexOf(_y));
  late final _mc = FixedExtentScrollController(initialItem: _m - 1);
  late final _dc = FixedExtentScrollController(initialItem: _d - 1);

  int get _daysInMonth => DateUtils.getDaysInMonth(_y, _m);

  DateTime get _value {
    final v = DateTime(_y, _m, _d.clamp(1, _daysInMonth));
    if (v.isBefore(widget.first)) return DateUtils.dateOnly(widget.first);
    if (v.isAfter(widget.last)) return DateUtils.dateOnly(widget.last);
    return v;
  }

  @override
  void dispose() {
    _yc.dispose();
    _mc.dispose();
    _dc.dispose();
    super.dispose();
  }

  Widget _wheel(FixedExtentScrollController c, List<String> items, ValueChanged<int> onChanged, {int flex = 1}) {
    final p = context.pal;
    return Expanded(
      flex: flex,
      child: ListWheelScrollView.useDelegate(
        controller: c,
        itemExtent: 44,
        diameterRatio: 1.6,
        perspective: 0.004,
        physics: const FixedExtentScrollPhysics(),
        onSelectedItemChanged: (i) {
          HapticFeedback.selectionClick();
          onChanged(i);
        },
        childDelegate: ListWheelChildBuilderDelegate(
          childCount: items.length,
          builder: (_, i) => Center(
            child: Text(items[i], style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: p.ink)),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final value = _value;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SheetHeader(title: widget.title, subtitle: thaiDate(value, short: false)),
            SizedBox(
              height: 220,
              child: Stack(
                children: [
                  Center(
                    child: Container(
                      height: 44,
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        _wheel(_dc, [for (var i = 1; i <= _daysInMonth; i++) '$i'], (i) => setState(() => _d = i + 1)),
                        _wheel(_mc, thaiMonths, (i) => setState(() => _m = i + 1), flex: 2),
                        _wheel(_yc, [for (final y in _years) '${y + 543}'], (i) => setState(() => _y = _years[i])),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: AppButton(label: 'เลือก ${thaiDate(value)}', onPressed: () => Navigator.pop(context, value)),
            ),
          ],
        ),
      ),
    );
  }
}
