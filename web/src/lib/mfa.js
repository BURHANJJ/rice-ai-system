import {
  EmailAuthProvider, GoogleAuthProvider, TotpMultiFactorGenerator, getMultiFactorResolver, multiFactor,
  reauthenticateWithCredential, reauthenticateWithPopup,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Two-step sign-in with an authenticator app (TOTP, RFC 6238) using Firebase
 * Authentication's built-in multi-factor support, so the second step is enforced
 * by Firebase itself and not just by this web page.
 * Requires TOTP to be enabled for the project (Identity Platform → MFA → TOTP).
 */

export const ISSUER = 'Rice AI';

export const totpFactors = (user = auth.currentUser) =>
  user ? multiFactor(user).enrolledFactors.filter((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID) : [];

export const hasTotp = (user = auth.currentUser) => totpFactors(user).length > 0;

/** Step 1: create a secret and the otpauth:// URI to show as a QR code. */
export async function startTotpEnrollment(user = auth.currentUser) {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return { secret, uri: secret.generateQrCodeUrl(user.email || user.uid, ISSUER), key: secret.secretKey };
}

/** Step 2: confirm with the first 6-digit code from the app. */
export async function finishTotpEnrollment(secret, code, name = 'แอปยืนยันตัวตน', user = auth.currentUser) {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  await multiFactor(user).enroll(assertion, name);
}

export async function removeTotp(user = auth.currentUser) {
  for (const f of totpFactors(user)) await multiFactor(user).unenroll(f);
}

/** Sensitive changes need a fresh sign-in; password users confirm their password, Google users re-pick their account. */
export async function reauthenticate(password, user = auth.currentUser) {
  const providers = user.providerData.map((p) => p.providerId);
  if (providers.includes('password')) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
}

/** When sign-in throws auth/multi-factor-auth-required, keep the resolver for the code step. */
export function resolverFrom(error) {
  const resolver = getMultiFactorResolver(auth, error);
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) throw Object.assign(new Error('unsupported second factor'), { code: 'auth/unsupported-second-factor' });
  return { resolver, hint };
}

export async function resolveWithCode({ resolver, hint }, code) {
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
  return resolver.resolveSignIn(assertion);
}

export const MFA_ERRORS = {
  'auth/invalid-verification-code': 'รหัส 6 หลักไม่ถูกต้องหรือหมดอายุ ลองรหัสล่าสุดจากแอปอีกครั้ง',
  'auth/totp-challenge-timeout': 'หมดเวลา กรุณาเข้าสู่ระบบใหม่',
  'auth/requires-recent-login': 'เพื่อความปลอดภัย กรุณายืนยันรหัสผ่านอีกครั้ง',
  'auth/operation-not-allowed': 'ระบบยังไม่ได้เปิดใช้การยืนยันตัวตน 2 ขั้นตอน (TOTP) ใน Firebase — แจ้งผู้ดูแลระบบ',
  'auth/admin-restricted-operation': 'ระบบยังไม่ได้เปิดใช้การยืนยันตัวตน 2 ขั้นตอน (TOTP) ใน Firebase — แจ้งผู้ดูแลระบบ',
  'auth/unverified-email': 'ต้องยืนยันอีเมลก่อนเปิดใช้ 2FA — ตรวจสอบกล่องจดหมายแล้วลองอีกครั้ง',
  'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
  'auth/invalid-credential': 'รหัสผ่านไม่ถูกต้อง',
  'auth/too-many-requests': 'ลองหลายครั้งเกินไป กรุณารอสักครู่',
};
export const mfaMessage = (e) => MFA_ERRORS[e?.code] || e?.message || 'เกิดข้อผิดพลาด';
