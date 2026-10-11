import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'firebase_options.dart';
import 'services/auth_provider.dart';
import 'services/navigation_provider.dart';
import 'services/notification_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home_shell.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';
import 'screens/onboarding_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await initializeDateFormatting('th_TH', null);
  await NotificationService.instance.init();
  runApp(const RiceAiApp());
}

class RiceAiApp extends StatelessWidget {
  const RiceAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) {
          final auth = AuthProvider();
          // register the phone for outbreak alerts whenever someone is signed in
          auth.addListener(() {
            final u = auth.user;
            if (u != null) NotificationService.instance.attachUser(u.userId);
          });
          return auth..bootstrap();
        }),
        ChangeNotifierProvider(create: (_) => NavigationProvider()),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          final isDark = auth.user?.settings['dark_mode'] ?? false;
          return MaterialApp(
            title: 'Rice AI',
            debugShowCheckedModeBanner: false,
            themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            home: const _RootRouter(),
          );
        },
      ),
    );
  }
}

class _RootRouter extends StatefulWidget {
  const _RootRouter();

  @override
  State<_RootRouter> createState() => _RootRouterState();
}

class _RootRouterState extends State<_RootRouter> {
  // Keep the launch animation on screen long enough to finish.
  bool _introDone = false;

  /// null while reading the flag; first-time users see Ricey's intro before login.
  bool? _onboarded;

  @override
  void initState() {
    super.initState();
    OnboardingScreen.seen().then((v) {
      if (mounted) setState(() => _onboarded = v);
    });
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _introDone = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 500),
      switchInCurve: Curves.easeOutCubic,
      child: auth.loading || !_introDone || _onboarded == null
          ? const SplashScreen()
          : auth.user != null
              ? const HomeShell()
              : _onboarded!
                  ? const LoginScreen()
                  : OnboardingScreen(onDone: () => setState(() => _onboarded = true)),
    );
  }
}
