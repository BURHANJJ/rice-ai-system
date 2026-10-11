import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../home_shell.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _fullName = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  final Set<String> _invalid = {};
  int _errorTick = 0;

  @override
  void initState() {
    super.initState();
    for (final c in [_password, _confirm]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    AppToast.hide();
    for (final c in [_username, _email, _fullName, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  String _mapError(dynamic e) {
    final code = e.toString();
    if (code.contains('email-already-in-use')) return 'อีเมลนี้ถูกใช้งานไปแล้ว กรุณาใช้บัญชีนี้เข้าสู่ระบบ';
    if (code.contains('username-already-in-use')) return 'ชื่อผู้ใช้นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น';
    if (code.contains('weak-password')) return 'รหัสผ่านสั้นเกินไป (ต้องมีอย่างน้อย 6 ตัวอักษร)';
    if (code.contains('invalid-email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (code.contains('passwords-do-not-match')) return 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
    if (code.contains('network-request-failed')) return 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้';
    if (code.contains('unavailable')) {
      return 'ไม่สามารถติดต่อฐานข้อมูลได้ (กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือสถานะ Firestore)';
    }
    return 'สมัครสมาชิกไม่สำเร็จ: $code';
  }

  /// Which field a backend error belongs to, so it can be highlighted.
  String? _fieldFor(String code) {
    if (code.contains('email')) return 'email';
    if (code.contains('username')) return 'username';
    if (code.contains('password')) return 'password';
    return null;
  }

  void _fail(String message, {Set<String> fields = const {}}) {
    if (!mounted) return;
    setState(() {
      _invalid
        ..clear()
        ..addAll(fields);
      _errorTick++;
    });
    AppToast.error(context, message, title: 'สมัครสมาชิกไม่สำเร็จ');
  }

  void _clearField(String key) {
    if (_invalid.remove(key)) setState(() {});
  }

  Future<void> _submit() async {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    final missing = <String>{
      if (_fullName.text.trim().isEmpty) 'fullName',
      if (_username.text.trim().isEmpty) 'username',
      if (_email.text.trim().isEmpty) 'email',
      if (_password.text.isEmpty) 'password',
      if (_confirm.text.isEmpty) 'confirm',
    };
    if (missing.isNotEmpty) {
      _fail('กรุณากรอกข้อมูลให้ครบทุกช่อง', fields: missing);
      return;
    }

    AppToast.hide();
    setState(() => _busy = true);
    try {
      await context.read<AuthProvider>().registerFarmer(
            username: _username.text.trim(),
            email: _email.text.trim(),
            fullName: _fullName.text.trim(),
            password: _password.text,
            confirmPassword: _confirm.text,
          );
      if (mounted) _goHome();
    } catch (e) {
      debugPrint('Registration Error: $e');
      final code = e.toString();
      final field = _fieldFor(code);
      _fail(_mapError(e), fields: {
        if (field != null) field,
        if (code.contains('passwords-do-not-match')) 'confirm',
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    if (_busy) return;
    AppToast.hide();
    setState(() => _busy = true);
    try {
      await context.read<AuthProvider>().signInWithGoogle();
      if (mounted) _goHome();
    } catch (e) {
      debugPrint('Google Sign-In Error: $e');
      _fail(_mapError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _goHome() {
    HapticFeedback.heavyImpact();
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const HomeShell()), (r) => false);
  }

  Widget _shake(String key, Widget child) =>
      ShakeOnChange(trigger: _invalid.contains(key) ? _errorTick : 0, child: child);

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final matches = _confirm.text.isNotEmpty && _confirm.text == _password.text;
    final mismatch = _confirm.text.isNotEmpty && _confirm.text != _password.text;
    var i = 0;
    Widget step(Widget child) => FadeSlideIn.stagger(i++, child: child);

    return Scaffold(
      backgroundColor: p.bg,
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: SafeArea(
          child: ListView(
            physics: const BouncingScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              const Row(
                children: [
                  AppBackButton(),
                  Spacer(),
                  StatusPill(label: 'บัญชีเกษตรกร', tone: Tone.primary, icon: Remix.leaf_line),
                ],
              ),
              const SizedBox(height: 22),
              step(Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('สร้างบัญชีใหม่', style: AppText.display(28, color: p.ink, height: 1.25)),
                  const SizedBox(height: 4),
                  Text('ใช้เวลาไม่ถึงนาที เริ่มสแกนใบข้าวได้ทันที', style: TextStyle(fontSize: 14, color: p.muted)),
                ],
              )),
              const SizedBox(height: 22),
              AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    step(_shake(
                      'fullName',
                      AppField(
                        controller: _fullName,
                        label: 'ชื่อ-นามสกุล',
                        hint: 'สมชาย ใจดี',
                        icon: Remix.user_3_line,
                        hasError: _invalid.contains('fullName'),
                        textInputAction: TextInputAction.next,
                        textCapitalization: TextCapitalization.words,
                        autofillHints: const [AutofillHints.name],
                        onChanged: (_) => _clearField('fullName'),
                      ),
                    )),
                    const SizedBox(height: 14),
                    step(_shake(
                      'username',
                      AppField(
                        controller: _username,
                        label: 'ชื่อผู้ใช้',
                        hint: 'somchai',
                        icon: Remix.at_line,
                        hasError: _invalid.contains('username'),
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.newUsername],
                        onChanged: (_) => _clearField('username'),
                      ),
                    )),
                    const SizedBox(height: 14),
                    step(_shake(
                      'email',
                      AppField(
                        controller: _email,
                        label: 'อีเมล',
                        hint: 'name@example.com',
                        icon: Remix.mail_line,
                        hasError: _invalid.contains('email'),
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.email],
                        onChanged: (_) => _clearField('email'),
                      ),
                    )),
                    const SizedBox(height: 14),
                    step(_shake(
                      'password',
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AppField(
                            controller: _password,
                            label: 'รหัสผ่าน',
                            hint: 'อย่างน้อย 6 ตัวอักษร',
                            icon: Remix.lock_2_line,
                            obscure: true,
                            hasError: _invalid.contains('password'),
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.newPassword],
                            onChanged: (_) => _clearField('password'),
                          ),
                          PasswordStrength(password: _password.text),
                        ],
                      ),
                    )),
                    const SizedBox(height: 14),
                    step(_shake(
                      'confirm',
                      AppField(
                        controller: _confirm,
                        label: 'ยืนยันรหัสผ่าน',
                        hint: 'กรอกรหัสผ่านอีกครั้ง',
                        icon: Remix.lock_password_line,
                        hasError: _invalid.contains('confirm') || mismatch,
                        textInputAction: TextInputAction.done,
                        onChanged: (_) => _clearField('confirm'),
                        onSubmitted: (_) => _submit(),
                        trailing: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
                          child: matches
                              ? Padding(
                                  key: const ValueKey('ok'),
                                  padding: const EdgeInsets.only(right: 10),
                                  child: Icon(Remix.checkbox_circle_fill, color: p.safe, size: 21),
                                )
                              : const SizedBox(key: ValueKey('none'), width: 10),
                        ),
                      ),
                    )),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 200),
                      child: mismatch
                          ? Padding(
                              padding: const EdgeInsets.only(top: 6, left: 4),
                              child: Text('รหัสผ่านยังไม่ตรงกัน', style: TextStyle(fontSize: 12.5, color: p.danger)),
                            )
                          : const SizedBox(width: double.infinity),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              step(AppButton(label: 'สมัครสมาชิก', busyLabel: 'กำลังสมัคร...', busy: _busy, onPressed: _submit)),
              const SizedBox(height: 12),
              step(GoogleButton(label: 'สมัครด้วยบัญชี Google', onPressed: _busy ? null : _signInWithGoogle)),
              const SizedBox(height: 22),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('มีบัญชีแล้ว? ', style: TextStyle(color: p.muted, fontSize: 13.5)),
                  AppLink(label: 'เข้าสู่ระบบ', underline: true, onTap: () => Navigator.maybePop(context)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
