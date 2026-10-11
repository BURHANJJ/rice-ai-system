import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell';
import FormField from '../../components/FormField';
import api from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', form);
      localStorage.setItem('rice_ai_token', data.token);
      navigate('/app/scan');
    } catch (err) {
      setError(err?.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate('/app/scan');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('สมัครสมาชิกด้วย Google ไม่สำเร็จ: ' + err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="สมัครบัญชีเกษตรกร" subtitle="ใบข้าวรุ่นเว็บสำหรับสาธิต — ในระบบจริงเกษตรกรใช้งานผ่านแอปมือถือ (ดูโฟลเดอร์ /mobile)">
      <form onSubmit={submit}>
        <FormField label="ชื่อผู้ใช้ (username)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <FormField label="ชื่อ-นามสกุล" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <FormField label="อีเมล" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <FormField label="รหัสผ่าน" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <FormField label="ยืนยันรหัสผ่าน" type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button disabled={busy} className="w-full bg-[var(--color-paddy)] text-white rounded-md py-2.5 text-sm font-medium hover:bg-[var(--color-paddy-dark)] transition-colors shadow-sm">
          {busy ? 'กำลังสมัคร...' : 'สมัครสมาชิกด้วยอีเมล'}
        </button>
        
        <div className="relative flex items-center py-2 mt-4 mb-2">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">หรือ</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <button 
          type="button"
          disabled={busy}
          onClick={handleGoogleSignUp}
          className="w-full bg-white border border-gray-300 text-gray-700 rounded-md py-2.5 text-sm font-medium shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center justify-center gap-3"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.11 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          สมัครด้วยบัญชี Google
        </button>
      </form>
      <div className="mt-4 text-sm text-center"><Link to="/login" className="text-[var(--color-paddy)] underline underline-offset-2">มีบัญชีแล้ว? เข้าสู่ระบบ</Link></div>
    </AuthShell>
  );
}
