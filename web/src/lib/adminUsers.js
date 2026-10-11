import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { logAudit } from './audit';

/** 16 chars from an unambiguous alphabet, used when the new user sets their own password by email. */
export function randomPassword(n = 16) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/**
 * Creates a Firebase Auth account + users/{uid} profile on behalf of an admin.
 * A throwaway secondary app is used so the admin's own session is not replaced
 * by the new account (createUserWithEmailAndPassword signs the new user in).
 */
export async function createUserAccount({ email, password, full_name, role, institution = '', province = '', invite = false }, me) {
  const secondary = initializeApp(firebaseConfig, `provision-${Date.now()}`);
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(secondary), email, password || randomPassword());
    const uid = cred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      email,
      username: email.split('@')[0],
      full_name,
      role,
      status: 'active',
      institution,
      ...(province ? { province } : {}),
      application_method: 'admin',
      created_by: me?.uid || '',
      created_at: serverTimestamp(),
    });
    await signOut(getAuth(secondary));
    if (invite) await sendPasswordResetEmail(auth, email);
    await logAudit(me, 'เพิ่มบัญชีผู้ใช้ใหม่', role === 'admin' ? 'critical' : 'info', `เป้าหมาย (Target): ${email} · บทบาท ${role.toUpperCase()}${invite ? ' · ส่งอีเมลตั้งรหัสผ่าน' : ''}`);
    return uid;
  } finally {
    deleteApp(secondary).catch(() => {});
  }
}

export const AUTH_ERRORS = {
  'auth/email-already-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว',
  'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
  'auth/weak-password': 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร',
  'auth/operation-not-allowed': 'ยังไม่ได้เปิดการเข้าสู่ระบบด้วยอีเมลใน Firebase Authentication',
  'auth/network-request-failed': 'เชื่อมต่ออินเทอร์เน็ตไม่ได้',
};
