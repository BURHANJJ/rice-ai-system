import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { fetchSignInMethodsForEmail, sendPasswordResetEmail } from 'firebase/auth';
import {
  Ban, Building, CheckCircle, ChevronDown, Copy, Download, Edit, Eye, EyeOff, KeyRound, Mail, RefreshCw, ScanLine, Search, ShieldAlert, ShieldCheck, Trash2, UserCog, UserPlus, Users as UsersIcon, X,
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useScans } from '../../lib/scanStore';
import { logAudit } from '../../lib/audit';
import { downloadCSV, stamp, thaiDateTime } from '../../lib/exporters';
import { AUTH_ERRORS, createUserAccount, randomPassword } from '../../lib/adminUsers';
import { ALL_PROVINCES } from '../../lib/provinces';
import { Btn, ConfirmDialog, Drawer, EmptyState, ErrorNote, Field, Kpi, Modal, PageHeader, Pill, Segmented, inputCls, useToast } from '../../components/admin/ui';

const ROLE = { farmer: 'เกษตรกร', researcher: 'นักวิชาการ', admin: 'ผู้ดูแลระบบ' };
const STATUS = {
  active: { label: 'ใช้งานปกติ', tone: 'green' },
  pending: { label: 'รออนุมัติ', tone: 'amber' },
  suspended: { label: 'ถูกระงับ', tone: 'red' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'gray' },
};
const statusOf = (u) => (STATUS[u.status?.toLowerCase()] ? u.status.toLowerCase() : 'active');
const PAGE = 25;

const SORTS = {
  name: (a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'th'),
  scans: (a, b) => b.scans - a.scans,
  active: (a, b) => (b.lastActive?.getTime() || 0) - (a.lastActive?.getTime() || 0),
  joined: (a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0),
};

function relTime(d) {
  if (!d) return '–';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชม. ที่แล้ว`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function Avatar({ u, size = 'h-9 w-9 text-sm' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-emerald-50 font-extrabold text-[var(--color-paddy)] ring-1 ring-emerald-100 ${size}`}>
      {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

function UserDrawer({ u, me, onClose, onChanged, showToast }) {
  const [form, setForm] = useState({ full_name: u.full_name || '', institution: u.institution || '' });
  const [providers, setProviders] = useState(null);
  const [logs, setLogs] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const isSelf = u.id === me?.uid || u.email === me?.email;
  const dirty = form.full_name !== (u.full_name || '') || form.institution !== (u.institution || '');

  useEffect(() => {
    if (u.email) fetchSignInMethodsForEmail(auth, u.email).then((m) => setProviders(m.length ? m : ['password'])).catch(() => setProviders(['password']));
    getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(300)))
      .then((snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().timestamp?.toDate?.() || null }))
        .filter((l) => l.user_id === u.id || (u.email && String(l.details || '').includes(u.email))).slice(0, 12)))
      .catch(() => setLogs([]));
  }, [u.id, u.email]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); showToast(ok); onChanged(); } catch (e) { showToast(`ไม่สำเร็จ: ${e?.message || e}`, 'error'); } finally { setBusy(''); setConfirm(null); }
  };
  const target = `เป้าหมาย (Target): ${u.email || u.id}`;

  const save = () => run('save', async () => {
    await updateDoc(doc(db, 'users', u.id), form);
    await logAudit(me, 'แก้ไขข้อมูลผู้ใช้ระบบ', 'info', target);
  }, 'บันทึกข้อมูลแล้ว');
  const setStatus = (s) => run('status', async () => {
    await updateDoc(doc(db, 'users', u.id), { status: s });
    await logAudit(me, `เปลี่ยนสถานะบัญชีผู้ใช้เป็น ${s.toUpperCase()}`, s === 'suspended' ? 'warning' : 'info', target);
  }, s === 'suspended' ? 'ระงับบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว');
  const setRole = (r) => run('role', async () => {
    await updateDoc(doc(db, 'users', u.id), { role: r });
    await logAudit(me, `เปลี่ยนระดับสิทธิ์การใช้งานเป็น ${r.toUpperCase()}`, r === 'admin' ? 'critical' : 'info', target);
  }, `เปลี่ยนบทบาทเป็น${ROLE[r]}แล้ว`);
  const reset = () => run('reset', async () => {
    await sendPasswordResetEmail(auth, u.email);
    await logAudit(me, 'ส่งลิงก์รีเซ็ตรหัสผ่านให้ผู้ใช้', 'info', `เป้าหมาย (Target): ${u.email}`);
  }, `ส่งอีเมลตั้งรหัสใหม่ไปที่ ${u.email} แล้ว`);
  const remove = () => run('delete', async () => {
    await deleteDoc(doc(db, 'users', u.id));
    await logAudit(me, 'ลบบัญชีผู้ใช้ออกจากระบบถาวร', 'critical', target);
    onClose();
  }, 'ลบบัญชีแล้ว');

  const st = STATUS[statusOf(u)];
  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-3"><Avatar u={u} size="h-10 w-10 text-base" /><span className="min-w-0"><span className="block truncate">{u.full_name || 'ไม่ระบุชื่อ'}</span><span className="block truncate text-xs font-semibold text-gray-500">{u.email || u.id}</span></span></span>}
      footer={dirty && (
        <>
          <Btn onClick={() => setForm({ full_name: u.full_name || '', institution: u.institution || '' })}>ยกเลิก</Btn>
          <Btn variant="primary" busy={busy === 'save'} onClick={save}>บันทึกข้อมูล</Btn>
        </>
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        <Pill tone={st.tone}>{st.label}</Pill>
        <Pill tone="gray">{ROLE[u.role] || u.role || 'ไม่ระบุ'}</Pill>
        {isSelf && <Pill tone="blue">บัญชีของคุณ</Pill>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[['ผลสแกน', u.scans.toLocaleString()], ['พบโรค', u.sick.toLocaleString()], ['ใช้งานล่าสุด', relTime(u.lastActive)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200"><div className="text-[11px] font-bold text-gray-500">{k}</div><div className="mt-1 text-sm font-extrabold text-gray-950">{v}</div></div>
        ))}
      </div>

      <section className="mt-6">
        <h3 className="mb-3 text-xs font-extrabold text-gray-700">ข้อมูลโปรไฟล์</h3>
        <div className="grid gap-3">
          <Field label="ชื่อ-นามสกุล"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} /></Field>
          <Field label="สถาบัน / สังกัด"><input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} className={inputCls} /></Field>
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-gray-500">UID</dt><dd className="truncate font-mono text-gray-700">{u.id}</dd>
            <dt className="text-gray-500">สมัครเมื่อ</dt><dd className="text-gray-700">{thaiDateTime(u.created)}</dd>
            <dt className="text-gray-500">การเข้าสู่ระบบ</dt><dd className="text-gray-700">{providers ? providers.map((p) => (p === 'password' ? 'อีเมล/รหัสผ่าน' : p === 'google.com' ? 'Google' : p)).join(', ') : '…'}</dd>
            {u.access_purpose && <><dt className="text-gray-500">วัตถุประสงค์</dt><dd className="text-gray-700">{u.access_purpose}</dd></>}
          </dl>
        </div>
      </section>

      {!isSelf && (
        <section className="mt-6">
          <h3 className="mb-3 text-xs font-extrabold text-gray-700">สิทธิ์และสถานะ</h3>
          <div className="grid gap-3 rounded-2xl bg-white p-3 ring-1 ring-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-gray-800">บทบาท</span>
              <Segmented value={u.role} onChange={(r) => r !== u.role && setConfirm({ kind: 'role', role: r })} options={Object.entries(ROLE).map(([value, label]) => ({ value, label }))} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <span className="text-sm font-bold text-gray-800">บัญชี</span>
              {statusOf(u) === 'suspended'
                ? <Btn size="sm" variant="soft" icon={CheckCircle} busy={busy === 'status'} onClick={() => setStatus('active')}>ปลดระงับ</Btn>
                : <Btn size="sm" icon={Ban} busy={busy === 'status'} onClick={() => setConfirm({ kind: 'suspend' })}>ระงับการใช้งาน</Btn>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <span className="text-sm font-bold text-gray-800">รหัสผ่าน</span>
              <Btn size="sm" icon={KeyRound} busy={busy === 'reset'} disabled={!u.email || (providers && !providers.includes('password'))} onClick={() => setConfirm({ kind: 'reset' })}>ส่งอีเมลตั้งรหัสใหม่</Btn>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-3 text-xs font-extrabold text-gray-700">ผลสแกนล่าสุด</h3>
        {!u.recent.length ? <p className="text-xs text-gray-400">ยังไม่มีผลสแกน</p> : (
          <ul className="divide-y divide-gray-100 rounded-2xl bg-white ring-1 ring-gray-200">
            {u.recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${s.isDisease ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="min-w-0 flex-1 truncate font-bold text-gray-900">{s.disease}</span>
                <span className="truncate text-xs text-gray-500">{s.text || '–'}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-400">{relTime(s.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-xs font-extrabold text-gray-700">ประวัติในบันทึกความปลอดภัย</h3>
        {logs === null ? <p className="text-xs text-gray-400">กำลังโหลด…</p> : !logs.length ? <p className="text-xs text-gray-400">ไม่มีรายการ</p> : (
          <ol className="grid gap-2 border-l-2 border-gray-200 pl-4">
            {logs.map((l) => (
              <li key={l.id} className="relative text-[13px]">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--color-paper)] ${l.severity === 'critical' ? 'bg-red-500' : l.severity === 'warning' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                <div className="font-bold text-gray-900">{l.activity}</div>
                <div className="text-[11px] text-gray-500">{thaiDateTime(l.at)}{l.user_id === u.id ? ' · ทำโดยผู้ใช้นี้' : ''}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!isSelf && (
        <section className="mt-8 rounded-2xl bg-red-50/70 p-4 ring-1 ring-red-100">
          <div className="text-sm font-extrabold text-red-800">ลบบัญชีถาวร</div>
          <p className="mt-1 text-xs leading-5 text-red-700/80">ลบข้อมูลโปรไฟล์ออกจากระบบ ผลสแกนเดิมยังคงอยู่เพื่อใช้ในสถิติ</p>
          <Btn size="sm" variant="danger" icon={Trash2} className="mt-3" onClick={() => setConfirm({ kind: 'delete' })}>ลบบัญชี</Btn>
        </section>
      )}

      <ConfirmDialog
        open={!!confirm}
        busy={!!busy}
        tone={confirm?.kind === 'delete' || confirm?.kind === 'suspend' ? 'danger' : 'primary'}
        title={{ role: 'ยืนยันการเปลี่ยนบทบาท', suspend: 'ระงับบัญชีนี้?', reset: 'ส่งอีเมลตั้งรหัสผ่านใหม่?', delete: 'ลบบัญชีถาวร?' }[confirm?.kind]}
        desc={{
          role: `เปลี่ยน ${u.email} เป็น “${ROLE[confirm?.role]}”${confirm?.role === 'admin' ? ' ซึ่งจะเข้าถึงทุกส่วนของระบบได้' : ''}`,
          suspend: `${u.email} จะเข้าสู่ระบบเว็บพอร์ทัลไม่ได้จนกว่าจะปลดระงับ`,
          reset: `ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${u.email}`,
          delete: `ลบ ${u.email} ออกจากระบบ ย้อนกลับไม่ได้`,
        }[confirm?.kind]}
        confirmLabel={{ role: 'เปลี่ยนบทบาท', suspend: 'ระงับบัญชี', reset: 'ส่งอีเมล', delete: 'ลบบัญชี' }[confirm?.kind]}
        onCancel={() => setConfirm(null)}
        onConfirm={() => (confirm.kind === 'role' ? setRole(confirm.role) : confirm.kind === 'suspend' ? setStatus('suspended') : confirm.kind === 'reset' ? reset() : remove())}
      />
    </Drawer>
  );
}

const ROLE_HINT = {
  farmer: 'ใช้แอปมือถือสแกนโรค ดูประวัติ และรับประกาศเตือนภัย',
  researcher: 'เข้าพอร์ทัลวิจัย ดูแผนที่ความเสี่ยง และส่งออกข้อมูลแบบปกปิดตัวตน',
  admin: 'เข้าถึงทุกส่วนของระบบ รวมถึงจัดการผู้ใช้และตั้งค่าระบบ',
};

function AddUserModal({ me, existing, onClose, onCreated, showToast }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'farmer', institution: '', province: '', mode: 'invite', password: randomPassword(12) });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const email = form.email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const dup = emailOk && existing.some((u) => (u.email || '').toLowerCase() === email);
  const pwOk = form.mode === 'invite' || form.password.length >= 8;
  const valid = form.full_name.trim() && emailOk && !dup && pwOk && (form.role !== 'researcher' || form.institution.trim());

  const submit = async (e) => {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await createUserAccount({
        email,
        full_name: form.full_name.trim(),
        role: form.role,
        institution: form.institution.trim(),
        province: form.province,
        password: form.mode === 'password' ? form.password : '',
        invite: form.mode === 'invite',
      }, me);
      showToast(form.mode === 'invite' ? `สร้างบัญชีแล้ว · ส่งอีเมลตั้งรหัสผ่านไปที่ ${email}` : `สร้างบัญชี ${email} แล้ว`);
      onCreated();
      onClose();
    } catch (err) {
      setError(AUTH_ERRORS[err?.code] || `สร้างบัญชีไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      width="max-w-lg"
      title={<span className="flex items-center gap-2"><UserPlus size={18} className="text-[var(--color-paddy)]" />เพิ่มผู้ใช้งานใหม่</span>}
      footer={(
        <>
          <Btn onClick={onClose} disabled={busy}>ยกเลิก</Btn>
          <Btn variant="primary" icon={UserPlus} busy={busy} disabled={!valid} onClick={submit}>สร้างบัญชี</Btn>
        </>
      )}
    >
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <span className="mb-1.5 block text-xs font-extrabold text-gray-700">บทบาท</span>
          <Segmented value={form.role} onChange={(v) => set('role', v)} options={Object.entries(ROLE).map(([value, label]) => ({ value, label }))} />
          <span className="mt-1.5 block text-[11px] leading-5 text-gray-500">{ROLE_HINT[form.role]}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อ-นามสกุล"><input autoFocus value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={inputCls} placeholder="เช่น สมชาย ใจดี" /></Field>
          <Field label="อีเมล" hint={dup ? <span className="font-bold text-red-600">อีเมลนี้มีบัญชีอยู่แล้ว</span> : form.email && !emailOk ? <span className="text-red-600">รูปแบบอีเมลไม่ถูกต้อง</span> : null}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="name@example.com" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={form.role === 'researcher' ? 'สถาบัน / สังกัด *' : 'สถาบัน / สังกัด'}><input value={form.institution} onChange={(e) => set('institution', e.target.value)} className={inputCls} placeholder={form.role === 'farmer' ? 'ไม่บังคับ' : 'เช่น ศูนย์วิจัยข้าวปัตตานี'} /></Field>
          <Field label="จังหวัด" hint="ใช้ส่งประกาศเตือนภัยตามพื้นที่">
            <select value={form.province} onChange={(e) => set('province', e.target.value)} className={inputCls}>
              <option value="">ไม่ระบุ</option>
              {ALL_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <fieldset className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
          <legend className="sr-only">รหัสผ่าน</legend>
          <div className="text-xs font-extrabold text-gray-700">การตั้งรหัสผ่าน</div>
          <div className="mt-2 grid gap-2">
            {[
              ['invite', 'ส่งอีเมลให้ผู้ใช้ตั้งรหัสผ่านเอง (แนะนำ)', 'ผู้ดูแลไม่ต้องรู้รหัสผ่าน ลิงก์ในอีเมลใช้ได้ครั้งเดียว'],
              ['password', 'กำหนดรหัสผ่านชั่วคราว', 'แจ้งรหัสให้ผู้ใช้ด้วยตนเอง และให้เปลี่ยนหลังเข้าสู่ระบบครั้งแรก'],
            ].map(([v, label, desc]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-xl p-2.5 ring-1 transition ${form.mode === v ? 'bg-white ring-emerald-300' : 'ring-transparent hover:bg-white/70'}`}>
                <input type="radio" name="pwmode" checked={form.mode === v} onChange={() => set('mode', v)} className="mt-1 accent-[var(--color-paddy)]" />
                <span><span className="block text-sm font-bold text-gray-900">{label}</span><span className="block text-[11px] leading-5 text-gray-500">{desc}</span></span>
              </label>
            ))}
          </div>
          {form.mode === 'password' && (
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input type={show ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} className={`${inputCls} pr-10 font-mono`} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-700" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <Btn icon={RefreshCw} onClick={() => { set('password', randomPassword(12)); setShow(true); }} aria-label="สุ่มรหัสใหม่" />
              <Btn icon={Copy} onClick={() => navigator.clipboard?.writeText(form.password).then(() => showToast('คัดลอกรหัสผ่านแล้ว'))} aria-label="คัดลอก" />
            </div>
          )}
          {form.mode === 'password' && !pwOk && <p className="mt-1.5 text-[11px] text-red-600">รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร</p>}
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { scans } = useScans();
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('active');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState(null); // { kind, value }
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, showToast] = useToast();

  const load = () => getDocs(collection(db, 'users'))
    .then((snap) => setRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    .catch((e) => setError(`โหลดผู้ใช้ไม่สำเร็จ: ${e.message}`));
  useEffect(() => { load(); }, []);

  const users = useMemo(() => {
    if (!raw) return null;
    const byUser = {};
    for (const s of scans || []) if (s.userId) (byUser[s.userId] ||= []).push(s);
    return raw.map((u) => {
      const list = byUser[u.id] || [];
      const created = u.created_at?.toDate?.() || null;
      const lastScan = list[0]?.date || null;
      const login = u.last_login_at?.toDate?.() || u.updated_at?.toDate?.() || null;
      const lastActive = [lastScan, login, created].filter(Boolean).sort((a, b) => b - a)[0] || null;
      return { ...u, created, scans: list.length, sick: list.filter((s) => s.isDisease).length, recent: list.slice(0, 6), lastActive };
    });
  }, [raw, scans]);

  const counts = useMemo(() => {
    const c = { all: 0, farmer: 0, researcher: 0, admin: 0, active: 0, pending: 0, suspended: 0 };
    for (const u of users || []) { c.all += 1; c[u.role] = (c[u.role] || 0) + 1; c[statusOf(u)] = (c[statusOf(u)] || 0) + 1; }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users || [])
      .filter((u) => (!role || u.role === role) && (!status || statusOf(u) === status))
      .filter((u) => !t || `${u.full_name || ''} ${u.email || ''} ${u.institution || ''} ${u.id}`.toLowerCase().includes(t))
      .sort(SORTS[sort]);
  }, [users, q, role, status, sort]);
  useEffect(() => { setPage(1); }, [q, role, status, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const isSelf = (u) => u.id === me?.uid || u.email === me?.email;
  const selectable = rows.filter((u) => !isSelf(u));
  const allOnPage = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); selectable.forEach((u) => (allOnPage ? n.delete(u.id) : n.add(u.id))); return n; });

  const openId = params.get('u');
  const openUser = users?.find((u) => u.id === openId) || null;

  const runBulk = async () => {
    const targets = (users || []).filter((u) => selected.has(u.id) && !isSelf(u));
    setBusy(true);
    try {
      const batch = writeBatch(db);
      const patch = bulk.kind === 'role' ? { role: bulk.value } : { status: bulk.value };
      targets.forEach((u) => batch.update(doc(db, 'users', u.id), patch));
      await batch.commit();
      await logAudit(me, bulk.kind === 'role' ? `เปลี่ยนบทบาทแบบกลุ่มเป็น ${bulk.value.toUpperCase()}` : `เปลี่ยนสถานะแบบกลุ่มเป็น ${bulk.value.toUpperCase()}`, bulk.value === 'admin' ? 'critical' : bulk.value === 'suspended' ? 'warning' : 'info', `${targets.length} บัญชี: ${targets.map((u) => u.email || u.id).join(', ').slice(0, 900)}`);
      showToast(`อัปเดต ${targets.length} บัญชีแล้ว`);
      setSelected(new Set());
      setBulk(null);
      load();
    } catch (e) {
      showToast(`ไม่สำเร็จ: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => downloadCSV(`rice-ai-users-${stamp()}`, [
    { label: 'ชื่อ', value: 'full_name' },
    { label: 'อีเมล', value: 'email' },
    { label: 'บทบาท', value: (u) => ROLE[u.role] || u.role },
    { label: 'สถานะ', value: (u) => STATUS[statusOf(u)].label },
    { label: 'สถาบัน', value: 'institution' },
    { label: 'ผลสแกน', value: 'scans' },
    { label: 'ใช้งานล่าสุด', value: (u) => u.lastActive?.toLocaleString('th-TH') },
    { label: 'สมัครเมื่อ', value: (u) => u.created?.toLocaleString('th-TH') },
  ], selected.size ? filtered.filter((u) => selected.has(u.id)) : filtered, 'รายชื่อผู้ใช้งาน');

  const bulkLabel = bulk && (bulk.kind === 'role' ? `เปลี่ยนบทบาทเป็น “${ROLE[bulk.value]}”` : bulk.value === 'suspended' ? 'ระงับการใช้งาน' : 'เปิดใช้งาน');

  return (
    <div className="pb-24">
      {toast}
      <PageHeader
        icon={UsersIcon}
        eyebrow="Accounts"
        title="จัดการผู้ใช้งาน"
        desc="เพิ่มบัญชีใหม่ ค้นหา ดูประวัติการใช้งาน เปลี่ยนบทบาท หรือระงับบัญชี ทีละคนหรือหลายคนพร้อมกัน ทุกการเปลี่ยนแปลงถูกบันทึกใน Audit log"
        actions={(
          <>
            <Btn icon={Download} disabled={!users} onClick={exportCSV}>ส่งออก CSV{selected.size ? ` (${selected.size})` : ''}</Btn>
            <Btn variant="primary" icon={UserPlus} disabled={!users} onClick={() => setAdding(true)}>เพิ่มผู้ใช้</Btn>
          </>
        )}
      />
      <ErrorNote>{error}</ErrorNote>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={!users} icon={UsersIcon} label="บัญชีทั้งหมด" value={counts.all.toLocaleString()} sub={`เกษตรกร ${counts.farmer} · นักวิชาการ ${counts.researcher} · ผู้ดูแล ${counts.admin}`} />
        <Kpi loading={!users} icon={ScanLine} tone="blue" label="ใช้งานใน 30 วัน" value={(users || []).filter((u) => u.lastActive && Date.now() - u.lastActive.getTime() < 30 * 86_400_000).length.toLocaleString()} sub="มีผลสแกนหรือเข้าระบบ" />
        <Kpi loading={!users} icon={ShieldCheck} tone="amber" label="รออนุมัติ" value={counts.pending} sub="คำขอนักวิชาการ" to="/admin/approvals" />
        <Kpi loading={!users} icon={ShieldAlert} tone="red" label="ถูกระงับ" value={counts.suspended} sub="บัญชี" />
      </div>

      <div className="rounded-[22px] border border-emerald-900/10 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 xl:flex-row xl:items-center">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100 xl:max-w-sm">
            <Search size={15} className="text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ อีเมล สถาบัน หรือ UID" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="ล้าง"><X size={14} className="text-gray-400" /></button>}
          </label>
          <Segmented value={role} onChange={setRole} options={[{ value: '', label: 'ทุกบทบาท', count: counts.all }, ...Object.entries(ROLE).map(([value, label]) => ({ value, label, count: counts[value] || 0 }))]} />
          <div className="flex gap-2 xl:ml-auto">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none">
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k] || 0})</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none">
              <option value="active">เรียง: ใช้งานล่าสุด</option>
              <option value="scans">เรียง: สแกนมากสุด</option>
              <option value="joined">เรียง: สมัครล่าสุด</option>
              <option value="name">เรียง: ชื่อ ก–ฮ</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-extrabold text-gray-500">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="เลือกทั้งหน้า" className="h-4 w-4 accent-[var(--color-paddy)]" /></th>
                <th className="px-2 py-3">ผู้ใช้</th>
                <th className="px-3 py-3">บทบาท</th>
                <th className="px-3 py-3">สถานะ</th>
                <th className="px-3 py-3 text-right">ผลสแกน</th>
                <th className="px-3 py-3">ใช้งานล่าสุด</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!users ? (
                [0, 1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-9 animate-pulse rounded-xl bg-gray-100" /></td></tr>)
              ) : !rows.length ? (
                <tr><td colSpan={7}><EmptyState icon={UsersIcon} title="ไม่พบผู้ใช้" desc="ลองเปลี่ยนคำค้นหรือตัวกรอง" /></td></tr>
              ) : rows.map((u) => {
                const st = STATUS[statusOf(u)];
                const self = isSelf(u);
                const on = selected.has(u.id);
                return (
                  <tr key={u.id} className={`cursor-pointer transition ${on ? 'bg-emerald-50/60' : 'hover:bg-gray-50/70'}`} onClick={() => setParams({ u: u.id })}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" disabled={self} checked={on} onChange={() => toggle(u.id)} aria-label={`เลือก ${u.email}`} className="h-4 w-4 accent-[var(--color-paddy)] disabled:opacity-30" />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar u={u} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate font-bold text-gray-900">{u.full_name || 'ไม่ระบุชื่อ'}{self && <Pill tone="blue">คุณ</Pill>}</div>
                          <div className="flex items-center gap-1 truncate text-xs text-gray-500"><Mail size={11} />{u.email || u.id}</div>
                          {u.institution && <div className="flex items-center gap-1 truncate text-[11px] text-gray-400"><Building size={11} />{u.institution}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px] font-bold text-gray-700">{ROLE[u.role] || u.role || '–'}</td>
                    <td className="px-3 py-3"><Pill tone={st.tone}>{st.label}</Pill></td>
                    <td className="px-3 py-3 text-right tabular-nums"><span className="font-bold text-gray-900">{u.scans.toLocaleString()}</span>{u.sick > 0 && <span className="block text-[11px] text-red-600">พบโรค {u.sick}</span>}</td>
                    <td className="px-3 py-3 text-[13px] text-gray-600">{relTime(u.lastActive)}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[var(--color-paddy)]"><Edit size={13} />จัดการ</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 sm:flex-row">
          <span>แสดง {filtered.length ? (page - 1) * PAGE + 1 : 0}–{Math.min(page * PAGE, filtered.length)} จาก {filtered.length.toLocaleString()} บัญชี</span>
          <div className="flex items-center gap-2">
            <Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</Btn>
            <span className="font-bold tabular-nums text-gray-700">{page} / {pages}</span>
            <Btn size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป</Btn>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${selected.size ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-white shadow-2xl sm:mx-auto sm:max-w-3xl">
          <span className="mr-auto text-sm font-bold">เลือก {selected.size} บัญชี</span>
          <div className="relative">
            <select
              value=""
              onChange={(e) => e.target.value && setBulk({ kind: 'role', value: e.target.value })}
              className="h-8 appearance-none rounded-lg bg-white/10 pl-3 pr-8 text-xs font-bold text-white outline-none hover:bg-white/15 [&>option]:text-gray-900"
            >
              <option value="">เปลี่ยนบทบาท…</option>
              {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-white/70" />
          </div>
          <Btn size="sm" variant="ghost" icon={Ban} className="!text-white hover:!bg-white/10" onClick={() => setBulk({ kind: 'status', value: 'suspended' })}>ระงับ</Btn>
          <Btn size="sm" variant="ghost" icon={CheckCircle} className="!text-white hover:!bg-white/10" onClick={() => setBulk({ kind: 'status', value: 'active' })}>เปิดใช้งาน</Btn>
          <Btn size="sm" variant="ghost" icon={UserCog} className="!text-white/70 hover:!bg-white/10" onClick={() => setSelected(new Set())}>ล้าง</Btn>
        </div>
      </div>

      <ConfirmDialog
        open={!!bulk}
        busy={busy}
        tone={bulk?.value === 'suspended' || bulk?.value === 'admin' ? 'danger' : 'primary'}
        title={`${bulkLabel} ${selected.size} บัญชี?`}
        desc={bulk?.value === 'admin' ? 'บัญชีที่เลือกจะเข้าถึงทุกส่วนของระบบได้ ตรวจสอบรายชื่อให้แน่ใจก่อนยืนยัน' : 'การเปลี่ยนแปลงจะมีผลทันทีและบันทึกใน Audit log'}
        confirmLabel={bulkLabel}
        onCancel={() => setBulk(null)}
        onConfirm={runBulk}
      >
        <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-2 text-xs text-gray-600">
          {(users || []).filter((u) => selected.has(u.id)).map((u) => <li key={u.id} className="truncate py-0.5">{u.full_name || '–'} · {u.email || u.id}</li>)}
        </ul>
      </ConfirmDialog>

      {adding && <AddUserModal me={me} existing={users || []} showToast={showToast} onClose={() => setAdding(false)} onCreated={load} />}

      {openUser && (
        <UserDrawer
          key={openUser.id}
          u={openUser}
          me={me}
          showToast={showToast}
          onClose={() => setParams({}, { replace: true })}
          onChanged={load}
        />
      )}
    </div>
  );
}
