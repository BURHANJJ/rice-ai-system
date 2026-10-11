import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'api_service.dart';
import 'notification_service.dart';

class AppUser {
  final String userId;
  final String username;
  final String fullName;
  final String email;
  final String role; // farmer | researcher | admin
  final String status;
  final Map<String, dynamic> settings;

  AppUser({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.email,
    required this.role,
    required this.status,
    this.settings = const {},
  });

  factory AppUser.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return AppUser(
      userId: doc.id,
      username: data['username'] ?? '',
      fullName: data['full_name'] ?? '',
      email: data['email'] ?? '',
      role: data['role'] ?? 'farmer',
      status: data['status'] ?? 'active',
      settings: (data['settings'] as Map<String, dynamic>?) ?? {},
    );
  }

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        userId: j['user_id'],
        username: j['username'],
        fullName: j['full_name'],
        email: j['email'],
        role: j['role'],
        status: j['status'],
        settings: j['settings'] ?? {},
      );
}

class AuthProvider extends ChangeNotifier {
  final ApiService _api;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: kIsWeb ? '884305199718-mbdt0s9sroqj8t3uoepnrvpejeoav3l2.apps.googleusercontent.com' : null,
  );

  AppUser? user;
  bool loading = true;

  /// Set when Firebase asks for the authenticator-app code (TOTP 2FA) after the password.
  MultiFactorResolver? _mfaResolver;

  Future<void> _afterSignIn(User fbUser) async {
    await _loadUserProfile(fbUser.uid);
    final idToken = await fbUser.getIdToken();
    if (idToken != null) await _api.saveToken(idToken);
    notifyListeners();
  }

  AuthProvider({ApiService? api}) : _api = api ?? ApiService.instance;

  Future<void> bootstrap() async {
    try {
      final firebaseUser = _auth.currentUser;
      if (firebaseUser != null) {
        await _loadUserProfile(firebaseUser.uid);
      }
    } catch (_) {
      user = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> _loadUserProfile(String uid) async {
    try {
      final doc = await _db.collection('users').doc(uid).get();
      if (doc.exists) {
        user = AppUser.fromFirestore(doc);
      }
    } catch (e) {
      debugPrint('Error loading user profile: $e');
      // If Firestore is unavailable, we still have the Firebase Auth user,
      // but the app role/status might be missing. We could either
      // throw or set a default local user.
      rethrow;
    }
  }

  /// Returns true when the account has 2FA and the 6-digit code step must follow.
  Future<bool> login(String email, String password) async {
    final UserCredential cred;
    try {
      cred = await _auth.signInWithEmailAndPassword(email: email, password: password);
    } on FirebaseAuthMultiFactorException catch (e) {
      _mfaResolver = e.resolver;
      return true;
    }
    if (cred.user != null) await _afterSignIn(cred.user!);
    return false;
  }

  /// Returns true when the account has 2FA and the 6-digit code step must follow.
  Future<bool> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) return false; // User canceled

    final googleAuth = await googleUser.authentication;
    final AuthCredential credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    final UserCredential cred;
    try {
      cred = await _auth.signInWithCredential(credential);
    } on FirebaseAuthMultiFactorException catch (e) {
      _mfaResolver = e.resolver;
      return true;
    }
    if (cred.user != null) {
      final uid = cred.user!.uid;
      final doc = await _db.collection('users').doc(uid).get();

      if (!doc.exists) {
        // Create default profile for new Google users
        final userData = {
          'username': googleUser.email.split('@')[0],
          'email': googleUser.email,
          'full_name': googleUser.displayName ?? 'Google User',
          'role': 'farmer',
          'status': 'active',
          'created_at': FieldValue.serverTimestamp(),
        };
        await _db.collection('users').doc(uid).set(userData);
      }

      await _afterSignIn(cred.user!);
    }
    return false;
  }

  /// Second step of a 2FA sign-in: the code from Google Authenticator (or any TOTP app).
  /// Firebase Authentication checks the code, so the session only exists after this succeeds.
  Future<void> verify2fa(String code) async {
    final resolver = _mfaResolver;
    if (resolver == null) {
      throw FirebaseAuthException(code: 'totp-challenge-timeout', message: 'sign-in expired');
    }
    final hint = resolver.hints.firstWhere(
      (h) => h.factorId == 'totp',
      orElse: () => throw FirebaseAuthException(code: 'unsupported-second-factor'),
    );
    final assertion = await TotpMultiFactorGenerator.getAssertionForSignIn(hint.uid, code);
    final cred = await resolver.resolveSignIn(assertion);
    _mfaResolver = null;
    if (cred.user != null) await _afterSignIn(cred.user!);
  }

  void cancel2fa() => _mfaResolver = null;

  Future<void> registerFarmer({
    required String username,
    required String email,
    required String fullName,
    required String password,
    required String confirmPassword,
  }) async {
    if (password != confirmPassword) throw Exception('passwords-do-not-match');

    // Check for username uniqueness in Firestore
    final usernameQuery = await _db
        .collection('users')
        .where('username', isEqualTo: username)
        .limit(1)
        .get();

    if (usernameQuery.docs.isNotEmpty) {
      throw Exception('username-already-in-use');
    }

    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    if (cred.user != null) {
      final uid = cred.user!.uid;
      final userData = {
        'username': username,
        'email': email,
        'full_name': fullName,
        'role': 'farmer',
        'status': 'active',
        'created_at': FieldValue.serverTimestamp(),
      };

      await _db.collection('users').doc(uid).set(userData);

      final idToken = await cred.user!.getIdToken();
      if (idToken != null) {
        await _api.saveToken(idToken);
      }

      await _loadUserProfile(uid);
      notifyListeners();
    }
  }

  Future<void> updateSetting(String key, dynamic value) async {
    final currentUser = _auth.currentUser;
    if (currentUser == null || user == null) throw Exception('not-logged-in');

    final newSettings = Map<String, dynamic>.from(user!.settings);
    newSettings[key] = value;

    await _db.collection('users').doc(currentUser.uid).update({
      'settings.$key': value,
    });

    user = AppUser(
      userId: user!.userId,
      username: user!.username,
      email: user!.email,
      fullName: user!.fullName,
      role: user!.role,
      status: user!.status,
      settings: newSettings,
    );
    notifyListeners();
  }

  Future<void> updateProfileName(String newName) async {
    final currentUser = _auth.currentUser;
    if (currentUser == null || user == null) throw Exception('not-logged-in');

    // Update in Firebase Auth
    await currentUser.updateDisplayName(newName);

    // Update in Firestore
    await _db.collection('users').doc(currentUser.uid).update({
      'full_name': newName,
    });

    // Update local state
    user = AppUser(
      userId: user!.userId,
      username: user!.username,
      email: user!.email,
      fullName: newName,
      role: user!.role,
      status: user!.status,
      settings: user!.settings,
    );
    notifyListeners();
  }

  Future<void> logout() async {
    // unregister this phone while still signed in, so the next user doesn't receive these alerts
    await NotificationService.instance.detachUser();
    await _auth.signOut();
    await _api.clearToken();
    user = null;
    notifyListeners();
  }
}
