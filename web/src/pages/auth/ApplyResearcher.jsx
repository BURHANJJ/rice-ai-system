import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useSettings } from '../../lib/settings';
import { ArrowLeft, AtSign, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, FileText, Globe2, KeyRound, MailCheck, ShieldCheck } from 'lucide-react';

const purposeOptions = [
  'งานวิจัยและวิเคราะห์ข้อมูลโรคข้าว',
  'ติดตามสถานการณ์โรคระบาดในพื้นที่รับผิดชอบ',
  'สนับสนุนงานบริการวิชาการ/ให้คำแนะนำเกษตรกร',
  'จัดทำรายงานหรือ Dashboard ภายในหน่วยงาน',
  'อื่น ๆ'
];

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-[var(--color-paddy)] focus:ring-4 focus:ring-emerald-100';

export default function ApplyResearcher() {
  const { settings: { applications }, loaded: settingsLoaded } = useSettings();
  const { loginWithGoogle } = useAuth();
  const [applyMethod, setApplyMethod] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    contact_email: '',
    email_type: 'institution',
    institution: '',
    access_purpose: '',
    access_purpose_detail: '',
    personal_email_note: '',
    password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [result, setResult] = useState(false);
  const [busy, setBusy] = useState(false);

  const isPersonalEmail = form.email_type === 'personal';
  const isOtherPurpose = form.access_purpose === 'อื่น ๆ';
  const isGoogle = applyMethod === 'google';
  const isEmail = applyMethod === 'email';

  const profile = useMemo(() => ({
    full_name: form.full_name.trim(),
    contact_email: form.contact_email.trim(),
    email_type: form.email_type,
    institution: form.institution.trim(),
    access_purpose: form.access_purpose.trim(),
    access_purpose_detail: form.access_purpose_detail.trim(),
    personal_email_note: form.personal_email_note.trim()
  }), [form]);

  const setValue = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const chooseMethod = (method) => {
    setError('');
    setApplyMethod(method);
  };

  const validateApplicationInfo = () => {
    if (!profile.full_name || !profile.contact_email || !profile.institution || !profile.access_purpose) {
      setError('กรุณากรอกข้อมูลประกอบคำขอให้ครบถ้วนก่อนส่งคำขอ');
      return false;
    }

    if (isOtherPurpose && !profile.access_purpose_detail) {
      setError('กรุณาระบุรายละเอียดวัตถุประสงค์เพิ่มเติม เมื่อเลือกตัวเลือกอื่น ๆ');
      return false;
    }

    if (isPersonalEmail && !profile.personal_email_note) {
      setError('กรุณาอธิบายเหตุผลที่ใช้อีเมลส่วนตัว เพื่อให้ผู้ดูแลระบบตรวจสอบคำขอได้อย่างเป็นระบบ');
      return false;
    }

    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateApplicationInfo()) return;

    if (form.password !== form.confirm_password) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setBusy(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, profile.contact_email, form.password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        email: profile.contact_email,
        ...profile,
        role: 'researcher',
        status: 'pending',
        application_method: 'email',
        created_at: serverTimestamp()
      });

      await signOut(auth);
      setResult(true);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('อีเมลนี้ถูกใช้งานแล้วในระบบ');
      } else if (err.code === 'auth/weak-password') {
        setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else {
        setError('ส่งคำขอไม่สำเร็จ: ' + err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleApply = async () => {
    setError('');
    if (!validateApplicationInfo()) return;

    setBusy(true);
    try {
      await loginWithGoogle(true, profile);
      await signOut(auth);
      setResult(true);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('สมัครด้วย Google ไม่สำเร็จ: ' + (err.customMsg || err.message));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!result && settingsLoaded && !applications.open) {
    return (
      <AuthShell title="ปิดรับสมัครชั่วคราว" subtitle="การสมัครขอสิทธิ์นักวิชาการเกษตร">
        <div className="flex flex-col items-center p-4 text-center sm:p-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
            <CalendarClock size={30} className="text-amber-600" />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-gray-600">{applications.closedMessage}</p>
          <div className="mt-8 w-full border-t border-gray-100 pt-6">
            <Link to="/login" className="inline-flex w-full justify-center rounded-xl bg-[var(--color-paddy)] py-3 font-semibold text-white shadow-md transition-all hover:bg-[var(--color-paddy-dark)]">
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (result) {
    return (
      <AuthShell title="ส่งคำขอสำเร็จ" subtitle="สถานะ: รอผู้ดูแลระบบตรวจสอบและอนุมัติสิทธิ์">
        <div className="flex flex-col items-center p-4 text-center sm:p-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-green-200 bg-green-100 shadow-inner">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">ส่งคำขอไปยังผู้ดูแลระบบเรียบร้อยแล้ว</h3>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-600">
            บัญชีของคุณจะเข้าใช้งานได้หลังจากผู้ดูแลระบบตรวจสอบข้อมูล วัตถุประสงค์ และความเกี่ยวข้องกับหน่วยงานเรียบร้อยแล้ว
          </p>
          <div className="mt-8 w-full border-t border-gray-100 pt-6">
            <Link to="/login" className="inline-flex w-full justify-center rounded-xl bg-[var(--color-paddy)] py-3 font-semibold text-white shadow-md transition-all hover:bg-[var(--color-paddy-dark)]">
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  const MethodCard = ({ method, icon, title, description, children }) => {
    const active = applyMethod === method;
    return (
      <button
        type="button"
        onClick={() => chooseMethod(method)}
        className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${active ? 'border-emerald-300 bg-emerald-50 shadow-md shadow-emerald-900/5' : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md'}`}
      >
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-[var(--color-paddy)] text-white' : 'bg-gray-50 text-[var(--color-paddy)] group-hover:bg-emerald-50'}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-950">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-gray-500">{description}</span>
        </span>
        {children}
      </button>
    );
  };

  const applicationFields = (
    <div className="rounded-[1.5rem] border border-gray-100 bg-white/80 p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--color-paddy)]">
          <ClipboardCheck size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-950">ข้อมูลประกอบคำขอ</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            ข้อมูลนี้ใช้ประกอบการตรวจสอบสิทธิ์ก่อนอนุมัติบัญชี {isGoogle ? 'หลังจากยืนยันตัวตนด้วย Google' : 'สำหรับการสมัครผ่านอีเมล'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">ชื่อ-นามสกุล</span>
          <input value={form.full_name} onChange={setValue('full_name')} required placeholder="เช่น ดร. สมชาย ใจดี" className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">อีเมลสถาบันหรือส่วนตัว</span>
          <input type="email" value={form.contact_email} onChange={setValue('contact_email')} required placeholder="name@institution.ac.th หรือ name@gmail.com" className={inputClass} />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-2xl border p-4 transition-all ${form.email_type === 'institution' ? 'border-emerald-300 bg-emerald-50 text-[var(--color-paddy)] shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200'}`}>
            <input type="radio" name="email_type" value="institution" checked={form.email_type === 'institution'} onChange={setValue('email_type')} className="sr-only" />
            <MailCheck size={20} className="mb-2" />
            <span className="block text-sm font-bold">อีเมลสถาบัน</span>
            <span className="mt-1 block text-xs text-gray-500">เหมาะสำหรับยืนยันตัวตนกับหน่วยงาน</span>
          </label>
          <label className={`cursor-pointer rounded-2xl border p-4 transition-all ${form.email_type === 'personal' ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-amber-200'}`}>
            <input type="radio" name="email_type" value="personal" checked={form.email_type === 'personal'} onChange={setValue('email_type')} className="sr-only" />
            <Globe2 size={20} className="mb-2" />
            <span className="block text-sm font-bold">อีเมลส่วนตัว</span>
            <span className="mt-1 block text-xs text-gray-500">ต้องมีคำชี้แจงเพิ่มเติม</span>
          </label>
        </div>

        {isPersonalEmail && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900">
              <FileText size={17} />
              คำชี้แจงสำหรับอีเมลส่วนตัว
            </div>
            <p className="mb-3 text-xs leading-relaxed text-amber-800">
              กรุณาระบุความเกี่ยวข้องกับหน่วยงาน บทบาทหน้าที่ และเหตุผลที่จำเป็นต้องใช้บัญชีส่วนตัวในการยื่นคำขอ
            </p>
            <textarea
              value={form.personal_email_note}
              onChange={setValue('personal_email_note')}
              required
              rows={4}
              placeholder="เช่น ใช้อีเมลส่วนตัวเนื่องจากหน่วยงานยังไม่มีอีเมลองค์กร แต่ปฏิบัติงานในโครงการติดตามโรคข้าวของ... ตำแหน่ง/บทบาท..."
              className={`${inputClass} resize-none border-amber-200 focus:border-amber-400 focus:ring-amber-100`}
            />
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">สถาบัน/หน่วยงาน</span>
          <input value={form.institution} onChange={setValue('institution')} required placeholder="มหาวิทยาลัย กรม/ศูนย์วิจัย หรือหน่วยงานที่สังกัด" className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">วัตถุประสงค์การเข้าถึงข้อมูล</span>
          <div className="relative">
            <select
              value={form.access_purpose}
              onChange={(e) => setForm((prev) => ({ ...prev, access_purpose: e.target.value, access_purpose_detail: e.target.value === 'อื่น ๆ' ? prev.access_purpose_detail : '' }))}
              required
              className={`${inputClass} appearance-none pr-10`}
            >
              <option value="">เลือกวัตถุประสงค์</option>
              {purposeOptions.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </label>

        {isOtherPurpose && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-900">
              <FileText size={17} />
              รายละเอียดวัตถุประสงค์เพิ่มเติม
            </div>
            <p className="mb-3 text-xs leading-relaxed text-emerald-800">
              อธิบายเป้าหมายการใช้งาน ขอบเขตข้อมูลที่ต้องการ และผลลัพธ์ที่คาดว่าจะนำไปใช้ เพื่อให้ผู้ดูแลระบบประเมินคำขอได้อย่างชัดเจน
            </p>
            <textarea
              value={form.access_purpose_detail}
              onChange={setValue('access_purpose_detail')}
              required
              rows={4}
              placeholder="เช่น ต้องการเข้าถึงข้อมูลเพื่อวิเคราะห์แนวโน้มโรคข้าวในพื้นที่รับผิดชอบ และจัดทำรายงานประกอบแผนเฝ้าระวังประจำฤดูกาลผลิต..."
              className={`${inputClass} resize-none border-emerald-200`}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AuthShell title="สมัครขอสิทธิ์นักวิชาการเกษตร" subtitle="เลือกวิธียื่นคำขอก่อน แล้วกรอกข้อมูลประกอบการพิจารณาให้ครบถ้วน">
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[var(--color-paddy)]" />
        <p className="leading-relaxed">
          ทุกคำขอต้องมีข้อมูลวัตถุประสงค์ สถาบัน/หน่วยงาน และอีเมลติดต่อ เพื่อให้ผู้ดูแลระบบตรวจสอบสิทธิ์ได้อย่างเป็นระบบ
        </p>
      </div>

      <div className="mb-5 grid gap-3">
        <MethodCard
          method="google"
          icon={<AtSign size={22} />}
          title="ยื่นคำขอด้วยบัญชี Google"
          description="เหมาะสำหรับยืนยันตัวตนเร็วขึ้น ระบบจะแสดงฟอร์มข้อมูลประกอบคำขอก่อนเปิดหน้าต่าง Google"
        >
          <span className="text-lg font-bold text-gray-300">G</span>
        </MethodCard>
        <MethodCard
          method="email"
          icon={<KeyRound size={22} />}
          title="ยื่นคำขอผ่านอีเมลและรหัสผ่าน"
          description="ใช้สำหรับสร้างบัญชีด้วยอีเมลที่ระบุ พร้อมตั้งรหัสผ่านสำหรับเข้าใช้งานหลังได้รับอนุมัติ"
        />
      </div>

      {!applyMethod && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-5 text-center text-sm leading-relaxed text-gray-500">
          เลือกวิธียื่นคำขอด้านบนก่อน ระบบจะแสดงช่องกรอกข้อมูลที่จำเป็นตามวิธีที่เลือก
        </div>
      )}

      {isEmail && (
        <form onSubmit={submit} className="space-y-5">
          {applicationFields}

          <div className="rounded-[1.5rem] border border-gray-100 bg-white/80 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
              <KeyRound size={18} className="text-[var(--color-paddy)]" />
              ตั้งค่าบัญชีสำหรับเข้าสู่ระบบ
            </div>
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">รหัสผ่าน (6 ตัวอักษรขึ้นไป)</span>
                <input type="password" value={form.password} onChange={setValue('password')} required className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">ยืนยันรหัสผ่าน</span>
                <input type="password" value={form.confirm_password} onChange={setValue('confirm_password')} required className={inputClass} />
              </label>
            </div>
            <button disabled={busy} className="mt-5 w-full rounded-xl bg-[var(--color-paddy)] py-3.5 text-sm font-bold text-white shadow-md shadow-[#166534]/30 transition-all hover:bg-[var(--color-paddy-dark)] disabled:opacity-70">
              {busy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอผ่านอีเมล'}
            </button>
          </div>
        </form>
      )}

      {isGoogle && (
        <div className="space-y-5">
          {applicationFields}
          <div className="rounded-[1.5rem] border border-gray-100 bg-white/80 p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-lg font-black text-gray-500">G</div>
              <div>
                <h3 className="text-base font-bold text-gray-950">ยืนยันตัวตนด้วย Google</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  หลังกรอกข้อมูลครบ ระบบจะเปิดหน้าต่าง Google เพื่อยืนยันบัญชี แล้วส่งคำขอเข้าสู่สถานะรออนุมัติ
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleApply}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-70"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.11 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              {busy ? 'กำลังยืนยันบัญชี Google...' : 'ยืนยันและยื่นคำขอด้วย Google'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6 text-center text-sm">
        <Link to="/login" className="inline-flex items-center justify-center gap-2 font-medium text-gray-500 transition-colors hover:text-[var(--color-paddy)]">
          <ArrowLeft size={16} />
          ยกเลิกและกลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </AuthShell>
  );
}

