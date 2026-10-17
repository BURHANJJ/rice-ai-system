import 'package:package_info_plus/package_info_plus.dart';

/// The installed app's version, read from the APK itself (the `--build-name` used at build
/// time), so the splash screen and profile always show the version people actually have.
class AppVersion {
  AppVersion._();

  static String _version = '';

  /// e.g. "0.9.3"; empty until [load] has run.
  static String get version => _version;

  /// e.g. "v0.9.3 (เบต้า)" — 0.x releases are the public beta.
  static String get label => _version.isEmpty ? '' : 'v$_version${_version.startsWith('0.') ? ' (เบต้า)' : ''}';

  /// Call once at start-up, before runApp.
  static Future<void> load() async {
    try {
      _version = (await PackageInfo.fromPlatform()).version;
    } catch (_) {
      // no version label is better than a wrong one
    }
  }
}
