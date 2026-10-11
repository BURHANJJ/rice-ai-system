import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rice_ai_mobile/theme/app_theme.dart';
import 'package:rice_ai_mobile/widgets/app_ui.dart';

void main() {
  testWidgets('AppButton shows its label and reacts to taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(body: AppButton(label: 'วิเคราะห์ภาพ', onPressed: () => taps++)),
    ));
    expect(find.text('วิเคราะห์ภาพ'), findsOneWidget);
    await tester.tap(find.text('วิเคราะห์ภาพ'));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('AppButton is disabled while busy', (tester) async {
    var taps = 0;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(body: AppButton(label: 'บันทึก', busy: true, busyLabel: 'กำลังบันทึก', onPressed: () => taps++)),
    ));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('กำลังบันทึก'), findsOneWidget);
    await tester.tap(find.text('กำลังบันทึก'), warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 100));
    expect(taps, 0);
  });
}
