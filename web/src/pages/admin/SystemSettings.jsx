import { useEffect, useState } from 'react';
import {
  AlertTriangle, BellRing, Building2, CalendarDays, Check, ClipboardCheck, ExternalLink, Info, Link2, Megaphone, Minus, Plus, RotateCcw, Save, Settings2, ShieldCheck, Siren, UserPlus,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { DEFAULT_SETTINGS, liveAnnouncement, saveSettings, useSettings } from '../../lib/settings';
import { logAudit } from '../../lib/audit';
import { thaiDateTime } from '../../lib/exporters';
import { AnnouncementBar } from '../../components/AnnouncementBar';
import { Btn, ConfirmDialog, ErrorNote, PageHeader, Pill, Segmented, Toggle, inputCls, useToast } from '../../components/admin/ui';

const SECTIONS = [
  { id: 'alerts', label: 'การแจ้งเตือนการระบาด', hint: 'เกณฑ์ศูนย์แจ้งเตือน', icon: BellRing },
  { id: 'review', label: 'การตรวจทาน AI', hint: 'เกณฑ์ AI ไม่มั่นใจ', icon: ClipboardCheck },
  { id: 'announcement', label: 'ประกาศบนเว็บไซต์', hint: 'แถบด้านบนหน้าสาธารณะ', icon: Megaphone },
  { id: 'applications', label: 'การรับสมัครนักวิชาการ', hint: 'เปิด / ปิดรับสมัคร', icon: UserPlus },
  { id: 'organization', label: 'ข้อมูลหน่วยงาน', hint: 'หัวรายงานประจำเดือน', icon: Building2 },
  { id: 'security', label: 'ความปลอดภัยการเข้าสู่ระบบ', hint: 'บังคับใช้ 2FA', icon: ShieldCheck },
];

const TONES = [
  { value: 'info', label: 'ข่าวสาร', icon: Info, cls: 'bg-[var(--color-paddy)]' },
  { value: 'warning', label: 'เฝ้าระวัง', icon: AlertTriangle, cls: 'bg-amber-400' },
  { value: 'danger', label: 'เตือนภัย', icon: Siren, cls: 'bg-red-600' },
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function validate(s) {
  const e = {};
  const a = s.alerts;
  if (!(a.windowDays >= 1 && a.windowDays <= 90)) e.windowDays = 'ใส่ 1–90 วัน';
  if (!(a.medium >= 1)) e.medium = 'อย่างน้อย 1 จุด';
  if (!(a.high > a.medium)) e.high = 'ต้องมากกว่าเกณฑ์เฝ้าระวัง';
  if (!(s.review.lowConfidence >= 10 && s.review.lowConfidence <= 99)) e.low = 'ใส่ 10–99%';
  if (s.announcement.active && !s.announcement.text.trim()) e.text = 'เปิดประกาศอยู่ ต้องใส่ข้อความ';
  if (s.announcement.linkUrl && !/^(https?:\/\/|\/)/.test(s.announcement.linkUrl)) e.link = 'ขึ้นต้นด้วย https:// หรือ /';
  if (s.announcement.linkUrl && !s.announcement.linkLabel.trim()) e.linkLabel = 'ใส่ข้อความของลิงก์';
  return e;
}

const SECTION_ERRORS = {
  alerts: ['windowDays', 'medium', 'high'],
  review: ['low'],
  announcement: ['text', 'link', 'linkLabel'],
  applications: [],
  organization: [],
  security: [],
};

/* ── building blocks ─────────────────────────────────────── */

function Label({ children, error, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-extrabold text-gray-700">{children}</span>
      {error ? <span className="text-[11px] font-bold text-red-600">{error}</span> : hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
  );
}

function Stepper({ label, value, onChange, min = 0, max = 999, suffix, error, hint }) {
  const n = Number(value) || 0;
  const step = (d) => onChange(Math.min(max, Math.max(min, n + d)));
  return (
    <div>
      <Label error={error} hint={hint}>{label}</Label>
      <div className={`flex h-11 items-center rounded-xl border bg-white transition focus-within:ring-4 ${error ? 'border-red-300 focus-within:ring-red-100' : 'border-gray-200 focus-within:border-emerald-300 focus-within:ring-emerald-100'}`}>
        <button type="button" onClick={() => step(-1)} disabled={n <= min} aria-label={`ลด${label}`} className="flex h-full w-10 shrink-0 items-center justify-center rounded-l-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30"><Minus size={15} /></button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="h-full min-w-0 flex-1 bg-transparent text-center text-[15px] font-extrabold tabular-nums text-gray-950 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && <span className="pr-1 text-xs font-bold text-gray-400">{suffix}</span>}
        <button type="button" onClick={() => step(1)} disabled={n >= max} aria-label={`เพิ่ม${label}`} className="flex h-full w-10 shrink-0 items-center justify-center rounded-r-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30"><Plus size={15} /></button>
      </div>
    </div>
  );
}

function TextField({ label, error, hint, icon: Icon, ...rest }) {
  return (
    <label className="block">
      <Label error={error} hint={hint}>{label}</Label>
      <div className="relative">
        {Icon && <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input {...rest} className={`${inputCls} h-11 ${Icon ? 'pl-9' : ''} ${error ? '!border-red-300' : ''}`} />
      </div>
    </label>
  );
}

function Section({ s, changed, fromDefault, onResetSection, errors, children }) {
  const Icon = s.icon;
  return (
    <section id={s.id} className="scroll-mt-24 overflow-hidden rounded-[22px] border border-emerald-900/10 bg-white shadow-sm shadow-emerald-950/[0.03]">
      <header className="flex flex-wrap items-start gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-paddy)]"><Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-extrabold text-gray-950">{s.label}</h2>
            {errors > 0 ? <Pill tone="red">ต้องแก้ {errors} ช่อง</Pill> : changed && <Pill tone="amber">ยังไม่บันทึก</Pill>}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-gray-500">{s.desc}</p>
        </div>
        {fromDefault && (
          <button type="button" onClick={onResetSection} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <RotateCcw size={13} />ค่าเริ่มต้น
          </button>
        )}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function Overview({ draft, onJump }) {
  const ann = liveAnnouncement(draft.announcement);
  const items = [
    { id: 'alerts', icon: BellRing, label: 'แจ้งเตือนการระบาด', value: `${draft.alerts.windowDays || '–'} วัน`, sub: `เสี่ยงสูง ≥ ${draft.alerts.high || '–'} · เฝ้าระวัง ≥ ${draft.alerts.medium || '–'} จุด`, tone: 'green' },
    { id: 'review', icon: ClipboardCheck, label: 'AI ไม่มั่นใจ', value: `< ${draft.review.lowConfidence || '–'}%`, sub: 'ส่งเข้าคิวตรวจทาน', tone: 'green' },
    { id: 'announcement', icon: Megaphone, label: 'ประกาศบนเว็บไซต์', value: ann ? 'กำลังแสดง' : 'ปิดอยู่', sub: ann ? (draft.announcement.endsAt ? `ถึง ${new Date(draft.announcement.endsAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}` : 'ไม่มีกำหนดสิ้นสุด') : 'ไม่มีแถบประกาศ', tone: ann ? 'amber' : 'gray' },
    { id: 'applications', icon: UserPlus, label: 'รับสมัครนักวิชาการ', value: draft.applications.open ? 'เปิดรับ' : 'ปิดรับ', sub: draft.applications.open ? 'แบบฟอร์มเปิดอยู่' : 'แสดงข้อความแทนแบบฟอร์ม', tone: draft.applications.open ? 'green' : 'red' },
  ];
  const dot = { green: 'bg-emerald-500', amber: 'bg-amber-500', gray: 'bg-gray-300', red: 'bg-red-500' };
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onJump(it.id)} className="group rounded-[20px] border border-emerald-900/10 bg-white p-4 text-left shadow-sm shadow-emerald-950/[0.03] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-gray-500"><it.icon size={14} />{it.label}</span>
            <span className={`h-2 w-2 rounded-full ${dot[it.tone]}`} />
          </div>
          <div className="mt-2 text-lg font-extrabold text-gray-950">{it.value}</div>
          <div className="mt-0.5 truncate text-xs text-gray-500">{it.sub}</div>
        </button>
      ))}
    </div>
  );
}

/* ── page ───────────────────────────────────────────────── */

export default function SystemSettings() {
  const { user } = useAuth();
  const { settings, meta, loaded } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(SECTIONS[0].id);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => { if (loaded) setDraft(settings); }, [loaded, settings]);
  const dirty = !same(draft, settings);
  const errors = validate(draft);
  const errorCount = Object.keys(errors).length;
  const set = (group, key, value) => setDraft((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));
  const resetSection = (id) => setDraft((d) => ({ ...d, [id]: DEFAULT_SETTINGS[id] }));

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // highlight the section in view
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); }),
      { rootMargin: '-25% 0px -65% 0px' },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    // the last section never reaches the trigger line, so pick it at the bottom of the page
    const main = document.querySelector('main');
    const atEnd = () => { if (main && main.scrollTop + main.clientHeight >= main.scrollHeight - 8) setActive(SECTIONS[SECTIONS.length - 1].id); };
    main?.addEventListener('scroll', atEnd, { passive: true });
    return () => { io.disconnect(); main?.removeEventListener('scroll', atEnd); };
  }, []);

  const jump = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
    setActive(id);
  };

  // open at #section when linked from elsewhere (e.g. "ปรับเกณฑ์การแจ้งเตือน")
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === id)) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 80);
  }, []);

  const save = async () => {
    if (errorCount) {
      const first = SECTIONS.find((s) => SECTION_ERRORS[s.id].some((k) => errors[k]));
      if (first) jump(first.id);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveSettings(draft, user?.full_name || user?.email);
      const changed = Object.keys(draft).filter((k) => !same(draft[k], settings[k]));
      logAudit(user, 'แก้ไขการตั้งค่าระบบ', 'warning', `หมวด: ${changed.map((k) => SECTIONS.find((s) => s.id === k)?.label || k).join(', ')}`);
      showToast('บันทึกการตั้งค่าแล้ว');
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์บันทึก — ต้อง deploy Firestore rules (settings) ก่อน' : `บันทึกไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const ann = draft.announcement;
  const sec = (id) => ({
    s: { ...SECTIONS.find((x) => x.id === id), desc: DESC[id] },
    changed: !same(draft[id], settings[id]),
    fromDefault: !same(draft[id], DEFAULT_SETTINGS[id]),
    errors: SECTION_ERRORS[id].filter((k) => errors[k]).length,
    onResetSection: () => resetSection(id),
  });

  return (
    <div className="pb-28">
      {toast}
      <PageHeader
        icon={Settings2}
        eyebrow="Configuration"
        title="ตั้งค่าระบบ"
        desc="ค่าที่ใช้ร่วมกันทั้งเว็บพอร์ทัลและหน้าเว็บสาธารณะ แก้ได้หลายหมวดแล้วกดบันทึกครั้งเดียว ทุกการเปลี่ยนแปลงถูกบันทึกใน Audit log"
        actions={meta?.updatedAt && (
          <div className="rounded-2xl bg-white px-4 py-2.5 text-right ring-1 ring-emerald-900/10">
            <div className="text-[11px] font-bold text-gray-500">บันทึกล่าสุด</div>
            <div className="text-xs font-extrabold text-gray-900">{thaiDateTime(meta.updatedAt)} · {meta.updatedBy || '–'}</div>
          </div>
        )}
      />
      <ErrorNote>{error}</ErrorNote>
      <Overview draft={draft} onJump={jump} />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="หมวดการตั้งค่า" className="hidden lg:block">
          <ul className="sticky top-6 grid gap-1 rounded-[22px] border border-emerald-900/10 bg-white p-2">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              const changed = !same(draft[s.id], settings[s.id]);
              const bad = SECTION_ERRORS[s.id].some((k) => errors[k]);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => jump(s.id)}
                    aria-current={on ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? 'bg-emerald-50 text-gray-950' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-[var(--color-paddy)] text-white' : 'bg-gray-100 text-gray-500'}`}><s.icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold">{s.label}</span>
                      <span className="block truncate text-[11px] text-gray-400">{s.hint}</span>
                    </span>
                    {bad ? <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="มีช่องที่ต้องแก้" /> : changed && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="ยังไม่บันทึก" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-5">
          <Section {...sec('alerts')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stepper label="ช่วงเวลาที่นับ" suffix="วัน" min={1} max={90} value={draft.alerts.windowDays} onChange={(v) => set('alerts', 'windowDays', v)} error={errors.windowDays} />
              <Stepper label="เฝ้าระวังเมื่อพบ" suffix="จุด" min={1} max={99} value={draft.alerts.medium} onChange={(v) => set('alerts', 'medium', v)} error={errors.medium} />
              <Stepper label="เสี่ยงสูงเมื่อพบ" suffix="จุด" min={2} max={99} value={draft.alerts.high} onChange={(v) => set('alerts', 'high', v)} error={errors.high} />
            </div>
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-bold text-gray-500">จำนวนจุดที่พบโรคในจังหวัดเดียวกัน ภายใน {draft.alerts.windowDays || '–'} วัน</div>
              <div className="flex h-9 overflow-hidden rounded-xl text-[11px] font-extrabold">
                <div className="flex flex-1 items-center justify-center bg-gray-100 text-gray-500">0–{Math.max(0, (draft.alerts.medium || 1) - 1)} · ปกติ</div>
                <div className="flex flex-1 items-center justify-center bg-amber-100 text-amber-800">{draft.alerts.medium || '–'}–{Math.max(draft.alerts.medium || 0, (draft.alerts.high || 1) - 1)} · เฝ้าระวัง</div>
                <div className="flex flex-1 items-center justify-center bg-red-100 text-red-700">≥ {draft.alerts.high || '–'} · เสี่ยงสูง</div>
              </div>
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-gray-500"><Info size={13} className="mt-0.5 shrink-0" />ใช้กับศูนย์แจ้งเตือนและกระดิ่งเท่านั้น สีบนแผนที่ใช้เกณฑ์เดียวกับแอปเสมอ (≥ 5 / ≥ 2 จุด)</p>
            </div>
          </Section>

          <Section {...sec('review')}>
            <div className="grid items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
              <Stepper label="เกณฑ์ AI ไม่มั่นใจ" suffix="%" min={10} max={99} value={draft.review.lowConfidence} onChange={(v) => set('review', 'lowConfidence', v)} error={errors.low} hint="แนะนำ 70%" />
              <div>
                <div className="mb-2 text-[11px] font-bold text-gray-500">ความมั่นใจของ AI</div>
                <div className="relative h-2.5 rounded-full bg-gradient-to-r from-red-200 via-amber-200 to-emerald-300">
                  <span className="absolute -top-1.5 w-1 -translate-x-1/2 rounded-full bg-gray-900 shadow" style={{ left: `${Math.min(99, Math.max(1, draft.review.lowConfidence || 0))}%`, height: 22 }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>ต่ำกว่า {draft.review.lowConfidence || '–'}% → คิว “AI ไม่มั่นใจ”</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </Section>

          <Section {...sec('announcement')}>
            <div className="rounded-2xl bg-gray-50 p-3">
              <Toggle checked={ann.active} onChange={(v) => set('announcement', 'active', v)} label="แสดงประกาศบนเว็บไซต์" desc="แสดงบนหน้าแรก แผนที่การระบาด และความรู้โรคข้าว ผู้เข้าชมกดปิดได้เฉพาะเครื่องตัวเอง" />
            </div>
            <div className={`mt-5 grid gap-5 transition ${ann.active ? '' : 'opacity-75'}`}>
              <div>
                <Label>รูปแบบ</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TONES.map((t) => {
                    const on = ann.tone === t.value;
                    return (
                      <button key={t.value} type="button" onClick={() => set('announcement', 'tone', t.value)} aria-pressed={on} className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left text-sm font-bold ring-1 transition ${on ? 'bg-emerald-50 text-gray-950 ring-[var(--color-paddy)]' : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'}`}>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${t.cls}`}><t.icon size={14} /></span>
                        <span className="flex-1">{t.label}</span>
                        {on && <Check size={15} className="text-[var(--color-paddy)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <Label error={errors.text} hint={`${ann.text.length}/160`}>ข้อความประกาศ</Label>
                <textarea rows={2} value={ann.text} maxLength={160} onChange={(e) => set('announcement', 'text', e.target.value)} placeholder="เช่น ช่วงนี้พบโรคไหม้ระบาดในภาคอีสาน ตรวจแปลงนาทุก 3–5 วัน" className={`${inputCls} resize-none leading-6 ${errors.text ? '!border-red-300' : ''}`} />
              </label>
              <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr_1fr]">
                <TextField label="ข้อความลิงก์" icon={ExternalLink} value={ann.linkLabel} onChange={(e) => set('announcement', 'linkLabel', e.target.value)} placeholder="ดูแผนที่" error={errors.linkLabel} />
                <TextField label="ลิงก์" icon={Link2} value={ann.linkUrl} onChange={(e) => set('announcement', 'linkUrl', e.target.value)} placeholder="/risk-map หรือ https://…" error={errors.link} hint="ไม่บังคับ" />
                <TextField label="แสดงถึงวันที่" icon={CalendarDays} type="date" value={ann.endsAt} onChange={(e) => set('announcement', 'endsAt', e.target.value)} hint="ว่าง = ไม่มีกำหนด" />
              </div>
              <div>
                <Label hint={ann.active ? 'หน้าตาจริงบนเว็บไซต์' : 'ปิดอยู่ — จะไม่แสดงบนเว็บไซต์'}>ตัวอย่าง</Label>
                <div className="overflow-hidden rounded-2xl ring-1 ring-gray-200">
                  {ann.text.trim() ? (
                    <AnnouncementBar a={ann} preview />
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 text-xs text-gray-400"><Megaphone size={14} />พิมพ์ข้อความประกาศเพื่อดูตัวอย่าง</div>
                  )}
                  <div className="flex items-center gap-3 border-t border-gray-100 bg-[var(--color-paper)] px-4 py-2.5">
                    <img src="/brand/app_icon.svg" alt="" className="h-6 w-6 rounded-md" />
                    <span className="text-xs font-extrabold text-[var(--color-paddy-dark)]">Rice AI</span>
                    <span className="ml-auto flex gap-3 text-[11px] text-gray-400"><span>หน้าหลัก</span><span>ความรู้โรคข้าว</span><span>แผนที่การระบาด</span></span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section {...sec('applications')}>
            <div className="rounded-2xl bg-gray-50 p-3">
              <Toggle checked={draft.applications.open} onChange={(v) => set('applications', 'open', v)} label={draft.applications.open ? 'เปิดรับสมัครอยู่' : 'ปิดรับสมัครอยู่'} desc="เมื่อปิด หน้าสมัครจะซ่อนแบบฟอร์มและแสดงข้อความด้านล่างแทน คำขอเดิมที่รออนุมัติยังอยู่ครบ" />
            </div>
            <label className={`mt-5 block transition ${draft.applications.open ? 'opacity-75' : ''}`}>
              <Label hint={draft.applications.open ? 'ใช้เมื่อปิดรับสมัคร' : undefined}>ข้อความเมื่อปิดรับสมัคร</Label>
              <textarea rows={2} value={draft.applications.closedMessage} onChange={(e) => set('applications', 'closedMessage', e.target.value)} className={`${inputCls} resize-none leading-6`} />
            </label>
          </Section>

          <Section {...sec('organization')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="ชื่อหน่วยงาน" icon={Building2} value={draft.organization.name} onChange={(e) => set('organization', 'name', e.target.value)} />
              <TextField label="ผู้จัดทำรายงาน" value={draft.organization.preparedBy} onChange={(e) => set('organization', 'preparedBy', e.target.value)} placeholder={user?.full_name || 'ชื่อผู้จัดทำ'} hint="ว่าง = ใช้ชื่อผู้ออกรายงาน" />
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3">
              <img src="/brand/app_icon.svg" alt="" className="h-9 w-9 rounded-lg" />
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-gray-500">{draft.organization.name || 'ชื่อหน่วยงาน'}</div>
                <div className="truncate text-sm font-extrabold text-gray-950">รายงานสถานการณ์โรคข้าว · ตัวอย่างหัวรายงาน</div>
              </div>
              <span className="ml-auto hidden shrink-0 text-[11px] text-gray-400 sm:block">ผู้จัดทำ: {draft.organization.preparedBy || user?.full_name || '–'}</span>
            </div>
          </Section>

          <Section {...sec('security')}>
            <div className="mb-1.5 text-xs font-extrabold text-gray-700">บังคับใช้การยืนยันตัวตน 2 ขั้นตอน (2FA)</div>
            <Segmented
              value={draft.security.require2fa}
              onChange={(v) => set('security', 'require2fa', v)}
              options={[{ value: 'off', label: 'ไม่บังคับ' }, { value: 'researcher', label: 'นักวิชาการ' }, { value: 'all', label: 'นักวิชาการและผู้ดูแล' }]}
            />
            <p className="mt-3 text-xs leading-5 text-gray-500">
              ผู้ใช้ในกลุ่มที่บังคับจะถูกพาไปหน้า “บัญชีของฉัน” เพื่อผูกแอปยืนยันตัวตน (เช่น Google Authenticator) ก่อนใช้งานหน้าอื่น
              เมื่อผูกแล้ว Firebase Authentication จะขอรหัส 6 หลักทุกครั้งที่เข้าสู่ระบบ
            </p>
            <div className="mt-3 flex gap-2.5 rounded-xl bg-amber-50 p-3 text-[12px] leading-5 text-amber-900 ring-1 ring-amber-100">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <span>ต้องเปิด TOTP ใน Firebase Authentication (Identity Platform → Multi-factor) ก่อนบังคับใช้ และผู้ดูแลควรผูก 2FA ของตนเองก่อนเลือก “นักวิชาการและผู้ดูแล”</span>
            </div>
          </Section>

          <div className="flex justify-end">
            <Btn variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)}>คืนค่าเริ่มต้นทั้งหมด</Btn>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${dirty ? 'translate-y-0' : 'translate-y-[120%]'}`}>
        <div className="pointer-events-auto mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-white shadow-2xl sm:mx-auto sm:max-w-2xl">
          <span className={`h-2 w-2 shrink-0 rounded-full ${errorCount ? 'bg-red-400' : 'bg-amber-400'}`} />
          <span className="min-w-0 flex-1 text-sm font-bold">{errorCount ? `แก้ไข ${errorCount} ช่องก่อนบันทึก` : 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก'}</span>
          <Btn size="sm" variant="ghost" className="!text-white/80 hover:!bg-white/10" onClick={() => setDraft(settings)}>ยกเลิก</Btn>
          <Btn size="sm" variant="primary" icon={Save} busy={saving} className="!bg-emerald-500 hover:!bg-emerald-400" onClick={save}>บันทึก</Btn>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="คืนค่าเริ่มต้นทั้งหมด?"
        desc="ทุกหมวดจะกลับเป็นค่าเริ่มต้นในฟอร์ม ยังไม่มีผลจนกว่าจะกดบันทึก"
        confirmLabel="คืนค่าเริ่มต้น"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setDraft(DEFAULT_SETTINGS); setConfirmReset(false); }}
      />
    </div>
  );
}

const DESC = {
  alerts: 'จังหวัดที่พบโรคถึงเกณฑ์ภายในช่วงเวลานี้จะขึ้นในศูนย์แจ้งเตือนการระบาดและกระดิ่ง',
  review: 'ผลสแกนที่ความมั่นใจต่ำกว่าเกณฑ์จะเข้าคิว “AI ไม่มั่นใจ” และนับในตัวชี้วัดคุณภาพโมเดล',
  announcement: 'แถบประกาศด้านบนของหน้าเว็บสาธารณะทุกหน้า',
  applications: 'ควบคุมหน้า “สมัครขอสิทธิ์นักวิชาการเกษตร”',
  organization: 'ใช้บนหัวรายงานประจำเดือนและไฟล์ PDF',
  security: 'นโยบายการเข้าสู่ระบบเว็บพอร์ทัลของนักวิชาการและผู้ดูแลระบบ',
};
