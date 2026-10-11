import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { sendEmailVerification, updatePassword } from 'firebase/auth';
import QRCode from 'qrcode';
import {
  BadgeCheck, Check, Copy, KeyRound, Laptop, Lock, Mail, Monitor, Moon, Palette, Save, ShieldAlert, ShieldCheck, Smartphone, Sun, Type, UserRound,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logAudit } from '../lib/audit';
import { thaiDateTime } from '../lib/exporters';
import { ALL_PROVINCES } from '../lib/provinces';
import { useSettings } from '../lib/settings';
import { finishTotpEnrollment, hasTotp, mfaMessage, reauthenticate, removeTotp, startTotpEnrollment, totpFactors } from '../lib/mfa';
import { setPreferences, usePreferences } from '../lib/preferences';
import { Btn, ConfirmDialog, ErrorNote, Field, Modal, PageHeader, Pill, Segmented, Toggle, inputCls, useToast } from '../components/admin/ui';

const ROLE = { farmer: 'เกษตรกร', researcher: 'นักวิชาการเกษตร', admin: 'ผู้ดูแลระบบ' };
const TABS = [
  { value: 'profile', label: 'โปรไฟล์' },
  { value: 'security', label: 'ความปลอดภัย' },
  { value: 'display', label: 'การแสดงผล' },
];

/** 2FA is required for this user by the system settings policy. */
export const needs2fa = (policy, role) => policy === 'all' ? ['researcher', 'admin'].includes(role) : policy === 'researcher' && role === 'researcher';

function Card({ icon: Icon, title, desc, children, aside }) {
  return (
    <section className="rounded-[22px] border border-emerald-900/10 bg-white p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-paddy)] ring-1 ring-emerald-100"><Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-gray-950">{title}</h2>
          {desc && <p className="mt-0.5 text-xs leading-5 text-gray-500">{desc}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(4, s);
}
const STRENGTH = [['อ่อนมาก', 'bg-red-500'], ['อ่อน', 'bg-red-400'], ['พอใช้', 'bg-amber-400'], ['ดี', 'bg-emerald-400'], ['แข็งแรง', 'bg-emerald-600']];

/* ── re-authentication prompt (needed before password / 2FA changes) ── */
function ReauthModal({ open, onCancel, onDone }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPassword = auth.currentUser?.providerData.some((p) => p.providerId === 'password');
  useEffect(() => { if (open) { setPw(''); setError(''); } }, [open]);
  const go = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try { await reauthenticate(pw); onDone(); } catch (err) { setError(mfaMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onCancel} title="ยืนยันตัวตนอีกครั้ง" footer={<><Btn onClick={onCancel}>ยกเลิก</Btn><Btn variant="primary" busy={busy} disabled={isPassword && !pw} onClick={go}>ยืนยัน</Btn></>}>
      <form onSubmit={go} className="grid gap-3">
        <p className="text-sm leading-6 text-gray-600">เพื่อความปลอดภัย การเปลี่ยนรหัสผ่านหรือการตั้งค่า 2FA ต้องยืนยันตัวตนล่าสุด</p>
        {isPassword
          ? <Field label="รหัสผ่านปัจจุบัน"><input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} /></Field>
          : <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">ระบบจะเปิดหน้าต่าง Google ให้เลือกบัญชีเดิมอีกครั้ง</p>}
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/* ── profile ── */
function ProfileTab({ user, refreshMe, showToast }) {
  const initial = useMemo(() => ({
    full_name: user.full_name || '', institution: user.institution || '', contact_email: user.contact_email || '', phone: user.phone || '', province: user.province || '',
  }), [user]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setForm(initial), [initial]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.full_name.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    setBusy(true);
    setError('');
    try {
      const patch = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      await updateDoc(doc(db, 'users', user.uid), { ...patch, updated_at: serverTimestamp() });
      await logAudit(user, 'แก้ไขข้อมูลโปรไฟล์ของตนเอง', 'info', Object.keys(patch).filter((k) => patch[k] !== initial[k]).join(', '));
      await refreshMe();
      showToast('บันทึกโปรไฟล์แล้ว');
    } catch (e) {
      setError(`บันทึกไม่สำเร็จ: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card icon={UserRound} title="ข้อมูลส่วนตัว" desc="ชื่อและหน่วยงานจะแสดงในบันทึกการทำงาน รายงานประจำเดือน และประกาศที่คุณส่ง">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อ-นามสกุล"><input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputCls} /></Field>
        <Field label="อีเมลเข้าสู่ระบบ" hint="เปลี่ยนอีเมลเข้าสู่ระบบได้โดยติดต่อผู้ดูแลระบบ"><input value={user.email || ''} disabled className={inputCls} /></Field>
        <Field label="สถาบัน / สังกัด"><input value={form.institution} onChange={(e) => set('institution', e.target.value)} className={inputCls} /></Field>
        <Field label="จังหวัดที่ปฏิบัติงาน" hint="ใช้รับประกาศเตือนภัยของจังหวัดนั้น">
          <select value={form.province} onChange={(e) => set('province', e.target.value)} className={inputCls}>
            <option value="">ไม่ระบุ</option>
            {ALL_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="อีเมลติดต่อ"><input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className={inputCls} placeholder="ถ้าต่างจากอีเมลเข้าสู่ระบบ" /></Field>
        <Field label="เบอร์โทรศัพท์"><input inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="ไม่บังคับ" /></Field>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
        {dirty && <Btn onClick={() => setForm(initial)}>ยกเลิก</Btn>}
        <Btn variant="primary" icon={Save} busy={busy} disabled={!dirty} onClick={save}>บันทึกโปรไฟล์</Btn>
      </div>
    </Card>
  );
}

/* ── security ── */
function TwoFactorCard({ user, required, showToast, withReauth, onChanged }) {
  const fbUser = auth.currentUser;
  const [enrolled, setEnrolled] = useState(() => hasTotp());
  const [setup, setSetup] = useState(null); // { secret, uri, key, qr }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);
  const factor = totpFactors()[0];

  const begin = () => withReauth(async () => {
    setError('');
    setBusy(true);
    try {
      const s = await startTotpEnrollment();
      setSetup({ ...s, qr: await QRCode.toDataURL(s.uri, { margin: 1, width: 220, color: { dark: '#143327', light: '#ffffff' } }) });
      setCode('');
    } finally {
      setBusy(false);
    }
  }, setError);

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await finishTotpEnrollment(setup.secret, code);
      setSetup(null);
      setEnrolled(true);
      await logAudit(user, 'เปิดใช้การยืนยันตัวตน 2 ขั้นตอน (2FA)', 'info', user.email || '');
      showToast('เปิดใช้ 2FA แล้ว ครั้งต่อไประบบจะขอรหัส 6 หลักเมื่อเข้าสู่ระบบ');
      onChanged();
    } catch (e) {
      setError(mfaMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () => withReauth(async () => {
    await removeTotp();
    setEnrolled(false);
    setConfirmOff(false);
    await logAudit(user, 'ปิดการยืนยันตัวตน 2 ขั้นตอน (2FA)', 'warning', user.email || '');
    showToast('ปิด 2FA แล้ว');
    onChanged();
  }, (m) => { setConfirmOff(false); setError(m); });

  return (
    <Card
      icon={Smartphone}
      title="การยืนยันตัวตน 2 ขั้นตอน (2FA)"
      desc="ใช้รหัส 6 หลักจากแอป Google Authenticator, Microsoft Authenticator หรือแอปที่รองรับ TOTP ทุกครั้งที่เข้าสู่ระบบ"
      aside={enrolled ? <Pill tone="green" icon={ShieldCheck}>เปิดใช้งานแล้ว</Pill> : required ? <Pill tone="red" icon={ShieldAlert}>ต้องเปิดใช้</Pill> : <Pill tone="gray">ยังไม่เปิด</Pill>}
    >
      {required && !enrolled && !setup && (
        <div className="mb-4 flex gap-2.5 rounded-xl bg-red-50 p-3 text-[13px] leading-6 text-red-900 ring-1 ring-red-100">
          <ShieldAlert size={17} className="mt-1 shrink-0 text-red-600" />
          <span>ผู้ดูแลระบบกำหนดให้บัญชี{ROLE[user.role]}ต้องเปิดใช้ 2FA ก่อนใช้งานพอร์ทัล กรุณาตั้งค่าด้านล่างให้เสร็จ</span>
        </div>
      )}
      {!fbUser?.emailVerified && !enrolled && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-100">ต้องยืนยันอีเมลก่อนเปิดใช้ 2FA — ดูหัวข้อ “อีเมล” ด้านล่าง</p>
      )}

      {enrolled && !setup && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50/70 p-4 ring-1 ring-emerald-100">
          <BadgeCheck size={22} className="text-emerald-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-gray-900">{factor?.displayName || 'แอปยืนยันตัวตน'}</div>
            <div className="text-xs text-gray-500">ผูกเมื่อ {factor?.enrollmentTime ? thaiDateTime(new Date(factor.enrollmentTime)) : '–'}</div>
          </div>
          <Btn size="sm" variant="danger" onClick={() => setConfirmOff(true)}>ปิด 2FA</Btn>
        </div>
      )}

      {!enrolled && !setup && (
        <Btn variant="primary" icon={Lock} busy={busy} disabled={!fbUser?.emailVerified} onClick={begin}>เริ่มตั้งค่า 2FA</Btn>
      )}

      {setup && (
        <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="rounded-2xl bg-white p-2.5 ring-1 ring-gray-200">
            <img src={setup.qr} alt="QR code สำหรับแอปยืนยันตัวตน" className="mx-auto h-[220px] w-[220px]" />
          </div>
          <ol className="grid content-start gap-4 text-sm">
            <li>
              <div className="font-extrabold text-gray-900">1. สแกน QR code ด้วยแอปยืนยันตัวตน</div>
              <p className="mt-1 text-xs leading-5 text-gray-500">หรือกรอกคีย์นี้เองในแอป (ประเภท: ตามเวลา)</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-[13px] tracking-wider text-gray-800 ring-1 ring-gray-200">{setup.key.match(/.{1,4}/g).join(' ')}</code>
                <Btn size="sm" icon={Copy} onClick={() => navigator.clipboard?.writeText(setup.key).then(() => showToast('คัดลอกคีย์แล้ว'))} aria-label="คัดลอกคีย์" />
              </div>
            </li>
            <li>
              <div className="font-extrabold text-gray-900">2. กรอกรหัส 6 หลักที่แอปแสดง</div>
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && finish()}
                  placeholder="000000"
                  className={`${inputCls} max-w-[180px] text-center font-mono text-lg tracking-[0.4em]`}
                />
                <Btn variant="primary" icon={Check} busy={busy} disabled={code.length !== 6} onClick={finish}>ยืนยัน</Btn>
                <Btn variant="ghost" onClick={() => { setSetup(null); setError(''); }}>ยกเลิก</Btn>
              </div>
            </li>
          </ol>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>

      <ConfirmDialog
        open={confirmOff}
        tone="danger"
        title="ปิดการยืนยันตัวตน 2 ขั้นตอน?"
        desc={required ? 'นโยบายของระบบกำหนดให้บัญชีนี้ต้องใช้ 2FA หากปิด คุณจะต้องตั้งค่าใหม่ก่อนใช้งานหน้าอื่น' : 'บัญชีจะเหลือการป้องกันด้วยรหัสผ่านเพียงชั้นเดียว'}
        confirmLabel="ปิด 2FA"
        onCancel={() => setConfirmOff(false)}
        onConfirm={turnOff}
      />
    </Card>
  );
}

function PasswordCard({ user, showToast, withReauth }) {
  const isPassword = auth.currentUser?.providerData.some((p) => p.providerId === 'password');
  const [pw, setPw] = useState({ next: '', again: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sc = strength(pw.next);
  const valid = pw.next.length >= 8 && pw.next === pw.again;
  const save = () => withReauth(async () => {
    setBusy(true);
    try {
      await updatePassword(auth.currentUser, pw.next);
      await logAudit(user, 'เปลี่ยนรหัสผ่านของตนเอง', 'info', user.email || '');
      setPw({ next: '', again: '' });
      showToast('เปลี่ยนรหัสผ่านแล้ว');
    } finally {
      setBusy(false);
    }
  }, setError);
  if (!isPassword) {
    return (
      <Card icon={KeyRound} title="รหัสผ่าน" desc="บัญชีนี้เข้าสู่ระบบด้วย Google จึงจัดการรหัสผ่านที่บัญชี Google โดยตรง">
        <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-sm font-bold text-[var(--color-paddy)] hover:underline">เปิดการตั้งค่าความปลอดภัยของ Google</a>
      </Card>
    );
  }
  return (
    <Card icon={KeyRound} title="เปลี่ยนรหัสผ่าน" desc="อย่างน้อย 8 ตัวอักษร ควรผสมตัวพิมพ์เล็ก-ใหญ่ ตัวเลข และสัญลักษณ์">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="รหัสผ่านใหม่">
          <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={inputCls} />
          {pw.next && (
            <span className="mt-2 flex items-center gap-2">
              <span className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < sc ? STRENGTH[sc][1] : 'bg-gray-200'}`} />)}</span>
              <span className="text-[11px] font-bold text-gray-500">{STRENGTH[sc][0]}</span>
            </span>
          )}
        </Field>
        <Field label="ยืนยันรหัสผ่านใหม่" hint={pw.again && pw.again !== pw.next ? <span className="text-red-600">รหัสผ่านไม่ตรงกัน</span> : null}>
          <input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
        <Btn variant="primary" icon={KeyRound} busy={busy} disabled={!valid} onClick={save}>เปลี่ยนรหัสผ่าน</Btn>
      </div>
    </Card>
  );
}

function EmailCard({ showToast }) {
  const u = auth.currentUser;
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = u?.metadata || {};
  return (
    <Card icon={Mail} title="อีเมลและการเข้าสู่ระบบ" aside={u?.emailVerified ? <Pill tone="green" icon={BadgeCheck}>ยืนยันอีเมลแล้ว</Pill> : <Pill tone="amber">ยังไม่ยืนยันอีเมล</Pill>}>
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-gray-500">อีเมล</dt><dd className="truncate font-bold text-gray-900">{u?.email}</dd>
        <dt className="text-gray-500">วิธีเข้าสู่ระบบ</dt><dd className="text-gray-800">{u?.providerData.map((p) => (p.providerId === 'password' ? 'อีเมล/รหัสผ่าน' : p.providerId === 'google.com' ? 'Google' : p.providerId)).join(', ')}</dd>
        <dt className="text-gray-500">เข้าสู่ระบบล่าสุด</dt><dd className="text-gray-800">{meta.lastSignInTime ? thaiDateTime(new Date(meta.lastSignInTime)) : '–'}</dd>
        <dt className="text-gray-500">สร้างบัญชีเมื่อ</dt><dd className="text-gray-800">{meta.creationTime ? thaiDateTime(new Date(meta.creationTime)) : '–'}</dd>
      </dl>
      {!u?.emailVerified && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <Btn
            icon={Mail}
            busy={busy}
            disabled={sent}
            onClick={async () => {
              setBusy(true);
              try { await sendEmailVerification(u); setSent(true); showToast(`ส่งลิงก์ยืนยันไปที่ ${u.email} แล้ว`); } catch (e) { showToast(mfaMessage(e), 'error'); } finally { setBusy(false); }
            }}
          >
            {sent ? 'ส่งลิงก์แล้ว' : 'ส่งลิงก์ยืนยันอีเมล'}
          </Btn>
          {sent && <span className="text-xs text-gray-500">กดลิงก์ในอีเมลแล้วโหลดหน้านี้ใหม่</span>}
        </div>
      )}
    </Card>
  );
}

/* ── display ── */
const THEMES = [
  { value: 'light', label: 'สว่าง', icon: Sun, bg: '#FAF7F0', card: '#ffffff', ink: '#1C2620' },
  { value: 'dark', label: 'มืด', icon: Moon, bg: '#0e1512', card: '#16201b', ink: '#e6eee9' },
  { value: 'system', label: 'ตามระบบ', icon: Monitor, bg: 'linear-gradient(90deg,#FAF7F0 50%,#0e1512 50%)', card: 'transparent', ink: '#6b7568' },
];

function DisplayTab({ uid }) {
  const p = usePreferences();
  const set = (patch) => setPreferences(patch, uid);
  return (
    <div className="grid gap-4">
      <Card icon={Palette} title="ธีมหน้าจอ" desc="ใช้กับเว็บพอร์ทัลบนทุกอุปกรณ์ที่เข้าสู่ระบบด้วยบัญชีนี้">
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button key={t.value} type="button" onClick={() => set({ theme: t.value })} className={`overflow-hidden rounded-2xl text-left ring-2 transition ${p.theme === t.value ? 'ring-[var(--color-paddy)]' : 'ring-gray-200 hover:ring-gray-300'}`}>
              <div className="h-20 p-2.5" style={{ background: t.bg }}>
                <div className="h-2 w-10 rounded-full" style={{ background: t.ink, opacity: 0.7 }} />
                <div className="mt-2 h-9 rounded-lg" style={{ background: t.card, boxShadow: t.card === 'transparent' ? 'none' : '0 1px 2px rgba(0,0,0,.12)' }} />
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 text-sm font-bold text-gray-800">
                <t.icon size={15} />{t.label}
                {p.theme === t.value && <Check size={15} className="ml-auto text-[var(--color-paddy)]" />}
              </div>
            </button>
          ))}
        </div>
      </Card>
      <Card icon={Type} title="ขนาดตัวอักษร" desc="ปรับขนาดตัวอักษรและระยะห่างของทุกหน้าในพอร์ทัล">
        <Segmented value={p.fontScale} onChange={(v) => set({ fontScale: v })} options={[{ value: 'sm', label: 'เล็ก' }, { value: 'md', label: 'ปกติ' }, { value: 'lg', label: 'ใหญ่' }]} />
      </Card>
      <Card icon={Laptop} title="การเคลื่อนไหว">
        <div className="rounded-2xl bg-gray-50 p-3">
          <Toggle checked={!!p.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="ลดภาพเคลื่อนไหว" desc="ปิดแอนิเมชันและการเปลี่ยนหน้าแบบเลื่อน เหมาะกับเครื่องที่ช้าหรือผู้ที่ไวต่อการเคลื่อนไหว" />
        </div>
      </Card>
    </div>
  );
}

export default function Account() {
  const { user, refreshMe } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const required = needs2fa(settings.security?.require2fa, user?.role);
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get('tab') || (required && !hasTotp() ? 'security' : 'profile')));
  const [toast, showToast] = useToast();
  const [reauth, setReauth] = useState(null); // { run, onError }
  const [, bump] = useState(0);

  /** Runs a sensitive action; if Firebase wants a fresh sign-in, ask for it and retry once. */
  const withReauth = async (run, onError) => {
    try {
      await run();
    } catch (e) {
      if (e?.code === 'auth/requires-recent-login') setReauth({ run, onError });
      else onError(mfaMessage(e));
    }
  };

  return (
    <div className="pb-10">
      {toast}
      <PageHeader icon={UserRound} eyebrow="Account" title="บัญชีของฉัน" desc="จัดการข้อมูลส่วนตัว รหัสผ่าน การยืนยันตัวตน 2 ขั้นตอน และการแสดงผลของเว็บพอร์ทัล" />

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-[22px] border border-emerald-900/10 bg-white p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-paddy)] text-xl font-black text-white">{(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold text-gray-950">{user?.full_name || 'ไม่ระบุชื่อ'}</div>
          <div className="truncate text-sm text-gray-500">{user?.email}{user?.institution ? ` · ${user.institution}` : ''}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="blue">{ROLE[user?.role] || user?.role}</Pill>
          {hasTotp() ? <Pill tone="green" icon={ShieldCheck}>2FA</Pill> : <Pill tone={required ? 'red' : 'gray'}>ไม่มี 2FA</Pill>}
        </div>
      </div>

      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={TABS} /></div>

      {tab === 'profile' && <ProfileTab user={user} refreshMe={refreshMe} showToast={showToast} />}
      {tab === 'security' && (
        <div className="grid gap-4">
          <TwoFactorCard user={user} required={required} showToast={showToast} withReauth={withReauth} onChanged={() => bump((n) => n + 1)} />
          <PasswordCard user={user} showToast={showToast} withReauth={withReauth} />
          <EmailCard showToast={showToast} />
        </div>
      )}
      {tab === 'display' && <DisplayTab uid={user?.uid} />}

      <ReauthModal
        open={!!reauth}
        onCancel={() => setReauth(null)}
        onDone={async () => {
          const r = reauth;
          setReauth(null);
          try { await r.run(); } catch (e) { r.onError(mfaMessage(e)); }
        }}
      />
    </div>
  );
}
