import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// ============================================================================
/// 🎨 จุดปรับแต่งโทนสีหลักของแอปทั้งระบบ (Rice AI Color Palette)
/// ============================================================================
/// หากต้องการเปลี่ยนสีธีม ให้แก้รหัสสี Hex ในคลาส AppColors นี้ได้เลย:
/// รหัสสีขึ้นต้นด้วย 0xFF ตามด้วยรหัส Hex 6 ตัว (เช่น 0xFF1B4332 คือ #1B4332)
/// ============================================================================
class AppColors {
  // --- โทนสีหลักของแบรนด์ (Brand Theme) ---
  static const forest = Color(0xFF1B4332);     // สีเขียวเข้มหลัก (ปุ่มสแกน, หัวข้อ, แถบนำทาง)
  static const forestDeep = Color(0xFF0F2A1E); // สีเขียวเข้มพิเศษ (เงา, การ์ดพิเศษ)
  static const forestSoft = Color(0xFFE3EDE5); // สีเขียวอ่อนพาสเทล (พื้นหลังปุ่มที่เลือก, ชิป)
  static const gold = Color(0xFFD4A84B);       // สีทองเมล็ดข้าว (ขอบอวาตาร์, แท็กเด่น, ไอคอนไฮไลต์)
  
  // --- โทนสีพื้นหลังและกระดาษ (Backgrounds & Surfaces) ---
  static const cream = Color(0xFFF4F1E8);      // สีพื้นหลังหลักของแอป (โทนครีมธรรมชาติ)
  static const creamDeep = Color(0xFFEFEBE0);  // สีครีมเข้มขึ้นเล็กน้อย (เส้นแบ่ง, การ์ดรอง)
  static const sheet = Color(0xFFFBF9F4);      // สีพื้นหลังของ Bottom Sheet ที่เด้งขึ้นมา
  static const line = Color(0xFFE4DFD3);       // สีเส้นขอบการ์ดและเส้นคั่น (Border & Divider)
  
  // --- โทนสีตัวอักษร (Typography) ---
  static const ink = Color(0xFF1C211E);        // สีตัวอักษรหลัก (หัวข้อตัวหนา, ตัวหนังสือเข้ม)
  static const body = Color(0xFF3A403B);       // สีเนื้อหาทั่วไป (อ่านง่าย สบายตา)
  static const muted = Color(0xFF6A706B);      // สีตัวอักษรรอง (คำบรรยายย่อย, วันที่)
  static const faint = Color(0xFF9A9F98);      // สีตัวอักษรจาง / ไอคอนที่ยังไม่ถูกเลือกในเมนูล่าง

  // --- โทนสีสถานะและการแจ้งเตือน (Status & Alerts) ---
  static const danger = Color(0xFFB42318);     // สีแดง (ระดับเสี่ยงสูง, เตือนภัย, เชื้อโรครุนแรง)
  static const dangerSoft = Color(0xFFFBEAE8); // สีแดงอ่อน (พื้นหลังกล่องเตือนภัยสีแดง)
  static const warn = Color(0xFFB45309);       // สีส้ม/เหลืองเข้ม (ระดับเฝ้าระวัง, ความเสี่ยงปานกลาง)
  static const warnSoft = Color(0xFFFCF1E1);   // สีส้มอ่อน (พื้นหลังกล่องเฝ้าระวัง)
  static const safe = Color(0xFF2D6A4F);       // สีเขียว (ระดับปลอดภัย, ข้าวสุขภาพดี ปกติ)
  static const safeSoft = Color(0xFFE6F0EA);   // สีเขียวอ่อน (พื้นหลังสถานะปลอดภัย)
  static const info = Color(0xFF1E5A8A);       // สีน้ำเงินข้อมูล (คำแนะนำ, คลังความรู้)
  static const infoSoft = Color(0xFFE6EEF5);   // สีน้ำเงินอ่อน (พื้นหลังกล่องข้อมูล)

  // Legacy names kept so every existing reference resolves to the new palette.
  static const paddy = safe;
  static const paddyDark = forest;
  static const paddyLight = forestSoft;
  static const mintBg = cream;
  static const paper = Color(0xFFFFFFFF);
  static const riskLow = safe;
  static const riskMedium = warn;
  static const riskHigh = danger;
}

/// Brightness-aware colour set. Read it with `context.pal`.
class AppPalette {
  const AppPalette({
    required this.bg,
    required this.surface,
    required this.sheet,
    required this.subtle,
    required this.line,
    required this.ink,
    required this.body,
    required this.muted,
    required this.faint,
    required this.primary,
    required this.primarySoft,
    required this.primaryText,
    required this.hero,
    required this.heroText,
    required this.heroMuted,
    required this.danger,
    required this.dangerSoft,
    required this.warn,
    required this.warnSoft,
    required this.safe,
    required this.safeSoft,
    required this.info,
    required this.infoSoft,
  });

  final Color bg, surface, sheet, subtle, line;
  final Color ink, body, muted, faint;
  final Color primary, primarySoft, primaryText;
  final Color hero, heroText, heroMuted;
  final Color danger, dangerSoft, warn, warnSoft, safe, safeSoft, info, infoSoft;
  Color get gold => AppColors.gold;

  // ==========================================================================
  // 💡 โหมดสว่าง (Light Theme) - ค่าสีที่หน้าจอส่วนใหญ่ดึงไปใช้งานผ่าน context.pal
  // เช่น final p = context.pal; จากนั้นเรียกใช้ p.bg, p.primary, p.surface
  // ==========================================================================
  static const light = AppPalette(
    bg: AppColors.cream,            // สีพื้นหลังทั้งจอ
    surface: Color(0xFFFFFFFF),     // สีพื้นหลังการ์ดสีขาว (AppCard)
    sheet: AppColors.sheet,         // สีพื้น BottomSheet
    subtle: AppColors.creamDeep,    // สีพื้นหลังปุ่มรอง
    line: AppColors.line,           // สีเส้นขอบ
    ink: AppColors.ink,             // สีข้อความหัวข้อ
    body: AppColors.body,           // สีข้อความเนื้อหา
    muted: AppColors.muted,         // สีข้อความรอง
    faint: AppColors.faint,         // สีข้อความจาง
    primary: AppColors.forest,      // สีหลัก (ปุ่มเด่น, ไอคอนแอ็กชัน)
    primarySoft: AppColors.forestSoft, // สีพื้นหลังปุ่มที่กำลังเลือก
    primaryText: AppColors.forest,  // สีข้อความบนชิปที่เลือก
    hero: AppColors.forest,         // สีส่วนหัว / Header
    heroText: Color(0xFFFFFFFF),    // สีข้อความบนการ์ด Hero
    heroMuted: Color(0xFFC9DDCF),   // สีข้อความรองบนการ์ด Hero
    danger: AppColors.danger,       // สีสถานะอันตราย/เสี่ยงสูง
    dangerSoft: AppColors.dangerSoft,
    warn: AppColors.warn,           // สีสถานะเฝ้าระวัง
    warnSoft: AppColors.warnSoft,
    safe: AppColors.safe,           // สีสถานะปลอดภัย
    safeSoft: AppColors.safeSoft,
    info: AppColors.info,           // สีสถานะข้อมูล
    infoSoft: AppColors.infoSoft,
  );

  static const dark = AppPalette(
    bg: Color(0xFF0E1511),
    surface: Color(0xFF16201A),
    sheet: Color(0xFF1A251E),
    subtle: Color(0xFF1F2B23),
    line: Color(0xFF26332B),
    ink: Color(0xFFECEAE3),
    body: Color(0xFFC9CCC6),
    muted: Color(0xFF959C95),
    faint: Color(0xFF6E756F),
    primary: Color(0xFF3E7D58),
    primarySoft: Color(0xFF1E3327),
    primaryText: Color(0xFF8CC7A1),
    hero: Color(0xFF173A28),
    heroText: Color(0xFFFFFFFF),
    heroMuted: Color(0xFFB5CDBD),
    danger: Color(0xFFF2B8B0),
    dangerSoft: Color(0xFF3A1714),
    warn: Color(0xFFF0C27A),
    warnSoft: Color(0xFF3A2610),
    safe: Color(0xFF8CC7A1),
    safeSoft: Color(0xFF17301F),
    info: Color(0xFF9CC3E6),
    infoSoft: Color(0xFF13283A),
  );
}

/// Serif display face for headings; body text comes from the theme.
class AppText {
  static TextStyle display(double size, {Color? color, FontWeight weight = FontWeight.w700, double height = 1.3}) {
    return GoogleFonts.notoSerifThai(fontSize: size, fontWeight: weight, color: color, height: height);
  }
}

class AppTheme {
  static ThemeData get light => _build(Brightness.light, AppPalette.light);
  static ThemeData get dark => _build(Brightness.dark, AppPalette.dark);

  static ThemeData _build(Brightness brightness, AppPalette p) {
    final base = GoogleFonts.ibmPlexSansThaiTextTheme(
      ThemeData(brightness: brightness).textTheme,
    ).apply(bodyColor: p.ink, displayColor: p.ink);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: p.bg,
      textTheme: base,
      splashFactory: InkSparkle.splashFactory,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.forest,
        brightness: brightness,
        primary: p.primary,
        onPrimary: Colors.white,
        secondary: AppColors.gold,
        surface: p.surface,
        error: p.danger,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: p.bg,
        foregroundColor: p.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      dividerTheme: DividerThemeData(color: p.line, thickness: 1, space: 1),
      cardTheme: CardTheme(
        elevation: 0,
        color: p.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: p.line)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: p.primary),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: p.primary,
        selectionColor: p.primary.withOpacity(0.2),
        selectionHandleColor: p.primary,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surface,
        hintStyle: TextStyle(color: p.faint),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: p.line, width: 1.5)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: p.line, width: 1.5)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: p.primary, width: 1.5)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.forestDeep,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
    );
  }
}

Color riskColor(String level) {
  switch (level.toLowerCase()) {
    case 'high':
      return AppColors.riskHigh;
    case 'medium':
      return AppColors.riskMedium;
    default:
      return AppColors.riskLow;
  }
}

extension ThemeHelper on BuildContext {
  bool get isDarkMode => Theme.of(this).brightness == Brightness.dark;
  AppPalette get pal => isDarkMode ? AppPalette.dark : AppPalette.light;
  Color get surfaceColor => pal.surface;
  Color get textColor => pal.ink;
  Color get mutedColor => pal.muted;
  Color get borderColor => pal.line;
}
