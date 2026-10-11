import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { logAudit } from './audit';
import { resolveWithCode, resolverFrom } from './mfa';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pending2fa = useRef(null); // { resolver, hint } while waiting for the 6-digit code

  /** Firebase signals an enrolled second factor by throwing; turn it into the "enter your code" step. */
  const secondFactor = (err) => {
    if (err?.code !== 'auth/multi-factor-auth-required') throw err;
    pending2fa.current = resolverFrom(err);
    return { requires_2fa: true, factor: pending2fa.current.hint.displayName || 'แอปยืนยันตัวตน' };
  };

  const profileOf = async (fbUser) => {
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    updateDoc(doc(db, 'users', fbUser.uid), { last_login_at: serverTimestamp() }).catch(() => {});
    return { uid: fbUser.uid, email: fbUser.email, ...(snap.exists() ? snap.data() : { role: 'researcher' }) };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...docSnap.data()
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'researcher'
            });
          }
        } catch (e) {
          console.error('Error fetching user data:', e);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (isSignUp = false, profile = {}) => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let userCredential;
    try {
      userCredential = await signInWithPopup(auth, provider);
    } catch (err) {
      return secondFactor(err);
    }
    const docRef = doc(db, 'users', userCredential.user.uid);
    const docSnap = await getDoc(docRef);

    let userData = {};
    if (docSnap.exists()) {
      userData = docSnap.data();
      if (isSignUp) {
        userData = {
          ...userData,
          full_name: profile.full_name || userData.full_name || userCredential.user.displayName || 'Google User',
          contact_email: profile.contact_email || userData.contact_email || userCredential.user.email,
          email_type: profile.email_type || userData.email_type || 'institution',
          institution: profile.institution || userData.institution || '',
          access_purpose: profile.access_purpose || userData.access_purpose || '',
          access_purpose_detail: profile.access_purpose_detail || userData.access_purpose_detail || '',
          personal_email_note: profile.personal_email_note || userData.personal_email_note || '',
          application_method: userData.application_method || 'google',
          role: userData.role || 'researcher',
          status: userData.status || 'pending',
          updated_at: serverTimestamp()
        };
        await setDoc(docRef, userData, { merge: true });
      }
    } else {
      if (!isSignUp) {
        throw { customMsg: 'ไม่พบบัญชีผู้ใช้งานในระบบ กรุณาไปที่หน้า "สมัครขอสิทธิ์นักวิชาการเกษตร" ก่อนเข้าใช้งาน' };
      }

      userData = {
        role: 'researcher',
        full_name: profile.full_name || userCredential.user.displayName || 'Google User',
        email: userCredential.user.email,
        contact_email: profile.contact_email || userCredential.user.email,
        email_type: profile.email_type || 'institution',
        institution: profile.institution || '',
        access_purpose: profile.access_purpose || '',
        access_purpose_detail: profile.access_purpose_detail || '',
        personal_email_note: profile.personal_email_note || '',
        application_method: 'google',
        status: 'pending',
        created_at: serverTimestamp()
      };
      await setDoc(docRef, userData);
    }

    return {
      requires_2fa: false,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        ...userData
      }
    };
  };

  const login = async (username_or_email, password) => {
    let email = username_or_email;
    if (!email.includes('@')) {
      email = `${email}@riceai.local`;
    }

    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      return secondFactor(err);
    }
    return { requires_2fa: false, user: await profileOf(userCredential.user) };
  };

  /** Second step: the 6-digit code from the authenticator app. */
  const verify2fa = async (code) => {
    if (!pending2fa.current) throw Object.assign(new Error('no pending sign-in'), { code: 'auth/totp-challenge-timeout' });
    const cred = await resolveWithCode(pending2fa.current, code);
    pending2fa.current = null;
    const profile = await profileOf(cred.user);
    logAudit(profile, 'เข้าสู่ระบบด้วยการยืนยันตัวตน 2 ขั้นตอน (2FA)', 'info', profile.email || '');
    return { requires_2fa: false, user: profile };
  };

  const cancel2fa = () => { pending2fa.current = null; };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  /** Re-reads the profile after the user edits it on the account page. */
  const refreshMe = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload().catch(() => {});
    setUser(await profileOf(auth.currentUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, verify2fa, cancel2fa, logout, setUser, refreshMe }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}



