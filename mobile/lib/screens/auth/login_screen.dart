import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../../widgets/brand.dart';
import '../home_shell.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _passFocus = FocusNode();
  bool _needs2fa = false;
  bool _busy = false;
  bool _userError = false;
  bool _passError = false;
  bool _pinError = false;
  int _errorTick = 0;

  @override
  void initState() {
    super.initState();
    _codeCtrl.addListener(() {
      if (_pinError && _codeCtrl.text.isNotEmpty) setState(() => _pinError = false);
    });
  }

  @override
  void dispose() {
    AppToast.hide();
    _userCtrl.dispose();
    _passCtrl.dispose();
    _codeCtrl.dispose();
    _passFocus.dispose();
    super.dispose();
  }

  String _mapError(dynamic e) {
    final code = e.toString();
    if (code.contains('invalid-credential') || code.contains('wrong-password') || code.contains('user-not-found')) {
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    }
    if (code.contains('unavailable')) {
      return 'ไม่สามารถติดต่อฐานข้อมูลได้ (กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต)';
    }
    if (code.contains('network-request-failed')) {
      return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้';
    }
    if (code.contains('user-disabled')) {
      return 'บัญชีนี้ถูกระงับการใช้งาน';
    }
    // Handle the Google Sign-In exceptions specifically
    if (code.contains('sign_in_failed') || code.contains('ApiException: 10')) {
      return 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ (การตั้งค่าแอปพลิเคชันยังไม่สมบูรณ์)';
    }
    if (code.contains('sign_in_canceled') || code.contains('ApiException: 12501')) {
      return 'ยกเลิกการเข้าสู่ระบบด้วย Google';
    }
    return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }

  void _showError(String message, {String title = 'เข้าสู่ระบบไม่สำเร็จ', ToastType type = ToastType.error}) {
    if (!mounted) return;
    AppToast.show(context, title: title, message: message, type: type);
    setState(() => _errorTick++);
  }

  void _showAuthError(Object e) {
    final message = _mapError(e);
    final canceled = message == 'ยกเลิกการเข้าสู่ระบบด้วย Google';
    _showError(
      canceled ? 'คุณยกเลิกการเข้าสู่ระบบด้วย Google' : message,
      title: canceled ? 'ยกเลิกแล้ว' : 'เข้าสู่ระบบไม่สำเร็จ',
      type: canceled ? ToastType.info : ToastType.error,
    );
  }

  Future<void> _submitCredentials() async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    final userEmpty = _userCtrl.text.trim().isEmpty;
    final passEmpty = _passCtrl.text.isEmpty;
    if (userEmpty || passEmpty) {
      setState(() {
        _userError = userEmpty;
        _passError = passEmpty;
      });
      _showError(
        userEmpty && passEmpty
            ? 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
            : userEmpty
                ? 'กรุณากรอกชื่อผู้ใช้หรืออีเมล'
                : 'กรุณากรอกรหัสผ่าน',
        title: 'กรอกข้อมูลไม่ครบ',
      );
      return;
    }
    AppToast.hide();
    setState(() => _busy = true);
    try {
      final auth = context.read<AuthProvider>();
      final needs2fa = await auth.login(_userCtrl.text.trim(), _passCtrl.text);
      if (!mounted) return;
      if (needs2fa) {
        setState(() => _needs2fa = true);
      } else {
        _goHome();
      }
    } catch (e) {
      debugPrint('Login Error: $e');
      _showAuthError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    AppToast.hide();
    setState(() => _busy = true);
    try {
      final needs2fa = await context.read<AuthProvider>().signInWithGoogle();
      if (!mounted) return;
      if (needs2fa) {
        setState(() => _needs2fa = true);
      } else if (context.read<AuthProvider>().user != null) {
        _goHome();
      }
    } catch (e) {
      debugPrint('Google Sign-In Error: $e');
      _showAuthError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit2fa() async {
    if (_busy) return;
    if (_codeCtrl.text.trim().length < 6) {
      setState(() => _pinError = true);
      _showError('กรุณากรอกรหัสให้ครบ 6 หลัก', title: 'รหัสยังไม่ครบ');
      return;
    }
    AppToast.hide();
    setState(() => _busy = true);
    try {
      await context.read<AuthProvider>().verify2fa(_codeCtrl.text.trim());
      if (mounted) _goHome();
    } on FirebaseAuthException catch (e) {
      _codeCtrl.clear();
      setState(() => _pinError = true);
      if (e.code == 'totp-challenge-timeout' || e.code == 'session-expired') {
        _showError('หมดเวลายืนยันตัวตน กรุณาเข้าสู่ระบบใหม่', title: 'หมดเวลา');
        setState(() => _needs2fa = false);
      } else {
        _showError('รหัสยืนยันไม่ถูกต้องหรือหมดอายุ ลองรหัสล่าสุดจากแอปอีกครั้ง', title: 'ยืนยันตัวตนไม่สำเร็จ');
      }
    } catch (e) {
      debugPrint('2FA Error: $e');
      _showAuthError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _back2fa() {
    HapticFeedback.selectionClick();
    AppToast.hide();
    context.read<AuthProvider>().cancel2fa();
    _codeCtrl.clear();
    setState(() {
      _needs2fa = false;
      _pinError = false;
    });
  }

  void _goHome() {
    AppToast.hide();
    HapticFeedback.heavyImpact();
    Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 550),
        pageBuilder: (_, __, ___) => const HomeShell(),
        transitionsBuilder: (_, a, __, child) {
          final curved = CurvedAnimation(parent: a, curve: Curves.easeOutCubic);
          return FadeTransition(
            opacity: curved,
            child: ScaleTransition(scale: Tween(begin: 1.04, end: 1.0).animate(curved), child: child),
          );
        },
      ),
      (route) => false,
    );
  }

  void _push(Widget page) {
    AppToast.hide();
    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }

  Future<void> _forgotPassword() async {
    final emailCtrl = TextEditingController(text: _userCtrl.text.contains('@') ? _userCtrl.text.trim() : '');
    await showAppSheet<void>(
      context,
      builder: (ctx) => _ForgotPasswordSheet(controller: emailCtrl),
    );
    emailCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: context.isDarkMode ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: p.bg,
        body: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: SafeArea(
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 420),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      transitionBuilder: (child, a) => FadeTransition(
                        opacity: a,
                        child: SlideTransition(
                          position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(a),
                          child: child,
                        ),
                      ),
                      child: _needs2fa
                          ? KeyedSubtree(key: const ValueKey('2fa'), child: _build2faForm())
                          : KeyedSubtree(key: const ValueKey('cred'), child: _buildCredentialsForm()),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCredentialsForm() {
    final p = context.pal;
    var i = 0;
    Widget step(Widget child) => FadeSlideIn.stagger(i++, child: child);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        step(BrandBanner(mascot: _userError || _passError ? RiceyMood.worried : RiceyMood.hello)),
        const SizedBox(height: 26),
        step(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ยินดีต้อนรับ', style: AppText.display(30, color: p.ink, height: 1.25)),
            const SizedBox(height: 4),
            Text('ลงชื่อเข้าใช้บัญชีของคุณเพื่อดำเนินการต่อ', style: TextStyle(fontSize: 14, color: p.muted)),
          ],
        )),
        const SizedBox(height: 24),
        AutofillGroup(
          child: Column(
            children: [
              step(ShakeOnChange(
                trigger: _userError ? _errorTick : 0,
                child: AppField(
                  controller: _userCtrl,
                  label: 'ชื่อผู้ใช้ หรือ อีเมล',
                  hint: 'name@example.com',
                  icon: Remix.user_3_line,
                  enabled: !_busy,
                  hasError: _userError,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.username, AutofillHints.email],
                  onChanged: (_) {
                    if (_userError) setState(() => _userError = false);
                  },
                  onSubmitted: (_) => _passFocus.requestFocus(),
                ),
              )),
              const SizedBox(height: 16),
              step(ShakeOnChange(
                trigger: _passError ? _errorTick : 0,
                child: AppField(
                  controller: _passCtrl,
                  focusNode: _passFocus,
                  label: 'รหัสผ่าน',
                  labelAction: AppLink(label: 'ลืมรหัสผ่าน?', onTap: _busy ? null : _forgotPassword, size: 13),
                  hint: 'กรอกรหัสผ่าน',
                  icon: Remix.lock_2_line,
                  obscure: true,
                  enabled: !_busy,
                  hasError: _passError,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  onChanged: (_) {
                    if (_passError) setState(() => _passError = false);
                  },
                  onSubmitted: (_) => _submitCredentials(),
                ),
              )),
            ],
          ),
        ),
        const SizedBox(height: 24),
        step(AppButton(
          label: 'เข้าสู่ระบบ',
          busyLabel: 'กำลังเข้าสู่ระบบ',
          trailingIcon: Remix.arrow_right_line,
          busy: _busy,
          onPressed: _submitCredentials,
        )),
        const SizedBox(height: 20),
        step(Row(
          children: [
            Expanded(child: Divider(color: p.line, height: 1)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text('หรือ', style: TextStyle(color: p.faint, fontSize: 12.5)),
            ),
            Expanded(child: Divider(color: p.line, height: 1)),
          ],
        )),
        const SizedBox(height: 20),
        step(GoogleButton(label: 'เข้าสู่ระบบด้วย Google', onPressed: _busy ? null : _signInWithGoogle)),
        const Spacer(),
        const SizedBox(height: 24),
        step(Column(
          children: [
            Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('ยังไม่มีบัญชี? ', style: TextStyle(color: p.muted, fontSize: 13.5)),
                AppLink(label: 'สมัครสมาชิก', underline: true, onTap: () => _push(const RegisterScreen())),
              ],
            ),
          ],
        )),
      ],
    );
  }

  Widget _build2faForm() {
    final p = context.pal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(alignment: Alignment.centerLeft, child: AppBackButton(onPressed: _busy ? null : _back2fa)),
        const SizedBox(height: 28),
        Center(
          child: Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(color: p.hero, borderRadius: BorderRadius.circular(26)),
            child: const Icon(Remix.shield_keyhole_line, color: AppColors.gold, size: 38),
          ),
        ),
        const SizedBox(height: 22),
        Text('ยืนยันตัวตนสองชั้น', textAlign: TextAlign.center, style: AppText.display(26, color: p.ink)),
        const SizedBox(height: 6),
        Text(
          'กรอกรหัส 6 หลักจากแอป Authenticator เพื่อเข้าใช้งาน',
          textAlign: TextAlign.center,
          style: TextStyle(color: p.muted, fontSize: 14, height: 1.55),
        ),
        const SizedBox(height: 28),
        ShakeOnChange(
          trigger: _errorTick,
          child: PinCodeInput(controller: _codeCtrl, hasError: _pinError, onCompleted: (_) => _submit2fa()),
        ),
        const SizedBox(height: 28),
        AppButton(label: 'ยืนยันรหัส', busyLabel: 'กำลังตรวจสอบ', busy: _busy, onPressed: _submit2fa),
        const Spacer(),
      ],
    );
  }
}

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet({required this.controller});
  final TextEditingController controller;

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  bool _busy = false;
  bool _error = false;
  int _tick = 0;

  Future<void> _send() async {
    final email = widget.controller.text.trim();
    if (!email.contains('@')) {
      setState(() {
        _error = true;
        _tick++;
      });
      AppToast.error(context, 'กรุณากรอกอีเมลที่ใช้สมัครให้ถูกต้อง', title: 'อีเมลไม่ถูกต้อง');
      return;
    }
    setState(() => _busy = true);
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.success(context, 'ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ $email แล้ว', title: 'ตรวจสอบอีเมลของคุณ');
    } catch (e) {
      if (!mounted) return;
      final code = e.toString();
      AppToast.error(
        context,
        code.contains('network-request-failed')
            ? 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้'
            : 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        title: 'ส่งลิงก์ไม่สำเร็จ',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SheetHeader(
                title: 'ลืมรหัสผ่าน',
                subtitle: 'เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล',
                icon: Remix.mail_send_line,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ShakeOnChange(
                      trigger: _tick,
                      child: AppField(
                        controller: widget.controller,
                        label: 'อีเมล',
                        hint: 'name@example.com',
                        icon: Remix.mail_line,
                        autofocus: true,
                        hasError: _error,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.send,
                        onChanged: (_) {
                          if (_error) setState(() => _error = false);
                        },
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(height: 20),
                    AppButton(
                      label: 'ส่งลิงก์',
                      busyLabel: 'กำลังส่ง',
                      icon: Remix.send_plane_line,
                      busy: _busy,
                      onPressed: _send,
                    ),
                    Text(
                      'ไม่ได้รับอีเมล? ตรวจสอบโฟลเดอร์จดหมายขยะ',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12.5, color: p.muted, height: 2.6),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
