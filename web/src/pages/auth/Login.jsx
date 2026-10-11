import { useState, useEffect } from 'react';
import { ThaiOnly } from '../../lib/i18n';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import FormField from '../../components/FormField';
import { useAuth } from '../../lib/AuthContext';
import { ArrowLeft, Globe2, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { mfaMessage } from '../../lib/mfa';

export default function Login() {
  const { login, loginWithGoogle, logout, verify2fa, cancel2fa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username_or_email: '', password: '' });
  const [error, setError] = useState(location.state?.error || '');
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState(null); // { factor } while asking for the authenticator code
  const [code, setCode] = useState('');

  useEffect(() => {
    if (location.state?.error) {
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const routeByRole = (role) => {
    if (role === 'admin') navigate('/admin/dashboard');
    else if (role === 'researcher') navigate('/research/dashboard');
    else navigate('/app/scan');
  };

  const rejectFarmerWebAccess = async () => {
    await logout();
    throw { customMsg: 'ระบบเว็บเปิดให้เฉพาะผู้ดูแลระบบและนักวิชาการเท่านั้น สำหรับเกษตรกรกรุณาใช้งานผ่านแอปพลิเคชันบนมือถือ (Mobile App)' };
  };

  const validateUserAccess = async (user) => {
    if (user.role === 'farmer') await rejectFarmerWebAccess();

    if (user.status === 'pending') {
      await logout();
      throw { customMsg: 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ' };
    }

    if (user.status === 'suspended') {
      await logout();
      throw { customMsg: 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
    }
  };

  const handleAuthError = (err, google = false) => {
    if (err.customMsg) {
      setError(err.customMsg);
      return;
    }

    if (google && err.code === 'auth/popup-closed-by-user') return;

    if (google) {
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้: ' + err.message);
      return;
    }

    setError(
      err?.code === 'auth/invalid-credential' || err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password'
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    );
  };

  const submitCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await login(form.username_or_email, form.password);
      if (data.requires_2fa) { setOtp({ factor: data.factor }); setCode(''); return; }
      await validateUserAccess(data.user);
      routeByRole(data.user.role);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await loginWithGoogle();
      if (data.requires_2fa) { setOtp({ factor: data.factor }); setCode(''); return; }
      await validateUserAccess(data.user);
      routeByRole(data.user.role);
    } catch (err) {
      handleAuthError(err, true);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setError('');
    setBusy(true);
    try {
      const data = await verify2fa(code);
      await validateUserAccess(data.user);
      routeByRole(data.user.role);
    } catch (err) {
      if (err.customMsg) { setOtp(null); handleAuthError(err); } else { setError(mfaMessage(err)); setCode(''); }
      if (err?.code === 'auth/totp-challenge-timeout') setOtp(null);
    } finally {
      setBusy(false);
    }
  };

  const backToPassword = () => { cancel2fa(); setOtp(null); setCode(''); setError(''); };

  return (
    <ThaiOnly>
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-paper)]">
      <div className="hidden md:flex flex-[1.05] flex-col justify-center items-center bg-gradient-to-br from-[#0f3f3a] via-[#124d40] to-[var(--color-paddy-dark)] relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#34D399] rounded-full mix-blend-overlay filter blur-3xl opacity-25 animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#10B981] rounded-full mix-blend-overlay filter blur-3xl opacity-25 animate-blob animation-delay-2000" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative z-10 flex flex-col items-center px-12">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-lg backdrop-blur">
            <ShieldCheck size={16} className="text-emerald-200" />
            Rice AI Secure Research Portal
          </div>
          <img
            src="/khao_hom_scene.animated.svg"
            alt="น้องข้าวหอมตรวจโรคใบข้าว"
            className="w-full max-w-xl object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-[1.03]"
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-8 md:px-14 lg:px-20">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link
              to="/"
              aria-label="Back to home"
              className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[var(--color-paddy)] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
            >
              <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
              Back to home
            </Link>

            <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3.5 py-2.5 text-xs font-bold text-gray-600 shadow-sm transition-all hover:border-emerald-200 hover:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
              <Globe2 size={15} className="text-[var(--color-paddy)]" />
              <span className="sr-only">Language</span>
              <select defaultValue="th" aria-label="Select language" className="cursor-pointer bg-transparent pr-1 outline-none">
                <option value="th">ไทย</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-2xl shadow-emerald-950/5 backdrop-blur md:p-8">
            <div className="mb-8">
              <h1 className="font-display text-4xl text-[var(--color-paddy-dark)] mb-3 font-bold tracking-tight">Rice AI</h1>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">เข้าสู่ระบบ</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                สำหรับนักวิชาการเกษตรและผู้ดูแลระบบ (Web)<br />
                เกษตรกรใช้งานผ่านแอปมือถือเป็นหลัก
              </p>
            </div>

            {otp ? (
              <form onSubmit={submitCode} className="space-y-5">
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-paddy)] text-white"><Smartphone size={20} /></span>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">ยืนยันตัวตนขั้นที่ 2</div>
                    <p className="mt-0.5 text-xs leading-5 text-gray-600">เปิดแอป {otp.factor} (เช่น Google Authenticator) แล้วกรอกรหัส 6 หลักของบัญชี Rice AI</p>
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">รหัสยืนยัน 6 หลัก</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setCode(v);
                    }}
                    placeholder="000000"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-gray-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
                {error && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
                <button disabled={busy || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-paddy)] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#166534]/30 transition hover:bg-[var(--color-paddy-dark)] disabled:opacity-60">
                  <KeyRound size={16} />{busy ? 'กำลังตรวจสอบ…' : 'ยืนยันและเข้าสู่ระบบ'}
                </button>
                <button type="button" onClick={backToPassword} className="w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-800">ย้อนกลับไปหน้าเข้าสู่ระบบ</button>
                <p className="text-center text-[11px] leading-5 text-gray-400">ทำโทรศัพท์หาย? ติดต่อผู้ดูแลระบบเพื่อปิด 2FA ชั่วคราว</p>
              </form>
            ) : (
            <form onSubmit={submitCredentials} className="space-y-5">
              <FormField
                label="อีเมลเข้าสู่ระบบ"
                value={form.username_or_email}
                onChange={(e) => setForm({ ...form, username_or_email: e.target.value })}
                required
                placeholder="name@riceai.local"
              />
              <FormField
                label="รหัสผ่าน"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                placeholder="••••••••"
              />

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                disabled={busy}
                className="w-full bg-[var(--color-paddy)] text-white rounded-xl py-3.5 text-sm font-bold shadow-lg shadow-[#166534]/30 hover:shadow-[#166534]/50 hover:bg-[var(--color-paddy-dark)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : 'เข้าสู่ระบบ'}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-200" />
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">หรือเข้าสู่ระบบด้วย</span>
                <div className="flex-grow border-t border-gray-200" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full bg-white border border-gray-300 text-gray-700 rounded-xl py-3 text-sm font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-3"
              >
                <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.11 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                Google
              </button>
            </form>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex flex-col space-y-3 text-sm text-center font-medium">
                <Link to="/apply-researcher" className="text-[var(--color-paddy)] hover:text-[var(--color-paddy-dark)] transition-colors">
                  สมัครขอสิทธิ์นักวิชาการเกษตร
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ThaiOnly>
  );
}
