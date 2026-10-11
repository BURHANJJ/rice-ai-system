import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand palette: forest green on paddy cream, grain-gold accent.
class AppColors {
  static const forest = Color(0xFF1B4332);
  static const forestDeep = Color(0xFF0F2A1E);
  static const forestSoft = Color(0xFFE3EDE5);
  static const gold = Color(0xFFD4A84B);
  static const cream = Color(0xFFF4F1E8);
  static const creamDeep = Color(0xFFEFEBE0);
  static const sheet = Color(0xFFFBF9F4);
  static const line = Color(0xFFE4DFD3);
  static const ink = Color(0xFF1C211E);
  static const body = Color(0xFF3A403B);
  static const muted = Color(0xFF6A706B);
  static const faint = Color(0xFF9A9F98);

  static const danger = Color(0xFFB42318);
  static const dangerSoft = Color(0xFFFBEAE8);
  static const warn = Color(0xFFB45309);
  static const warnSoft = Color(0xFFFCF1E1);
  static const safe = Color(0xFF2D6A4F);
  static const safeSoft = Color(0xFFE6F0EA);
  static const info = Color(0xFF1E5A8A);
  static const infoSoft = Color(0xFFE6EEF5);

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

  static const light = AppPalette(
    bg: AppColors.cream,
    surface: Color(0xFFFFFFFF),
    sheet: AppColors.sheet,
    subtle: AppColors.creamDeep,
    line: AppColors.line,
    ink: AppColors.ink,
    body: AppColors.body,
    muted: AppColors.muted,
    faint: AppColors.faint,
    primary: AppColors.forest,
    primarySoft: AppColors.forestSoft,
    primaryText: AppColors.forest,
    hero: AppColors.forest,
    heroText: Color(0xFFFFFFFF),
    heroMuted: Color(0xFFC9DDCF),
    danger: AppColors.danger,
    dangerSoft: AppColors.dangerSoft,
    warn: AppColors.warn,
    warnSoft: AppColors.warnSoft,
    safe: AppColors.safe,
    safeSoft: AppColors.safeSoft,
    info: AppColors.info,
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
