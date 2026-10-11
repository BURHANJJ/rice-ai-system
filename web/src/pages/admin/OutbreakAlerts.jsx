import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import {
  ArrowDownRight, ArrowUpRight, BellRing, CheckCheck, CheckCircle2, Clock, Eye, FlaskConical, History, Map as MapIcon, Megaphone, Minus, Send,
  ShieldAlert, Siren, Smartphone, Users, Zap,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useSettings } from '../../lib/settings';
import { logAudit } from '../../lib/audit';
import { thaiDateTime } from '../../lib/exporters';
import { useOutbreakData, RISK } from '../../components/riskmap/outbreakData';
import {
  acknowledge, computeAlerts, deliveryList, deliveryStats, sendBroadcast, template, useAlertActions, useBroadcasts,
} from '../../components/admin/alerts';
import { Btn, ConfirmDialog, Drawer, EmptyState, ErrorNote, Field, Kpi, PageHeader, Panel, Pill, Segmented, inputCls, useToast } from '../../components/admin/ui';

const STATUS = {
  new: { label: 'ใหม่', tone: 'red' },
  ack: { label: 'รับทราบแล้ว', tone: 'gray' },
  sent: { label: 'ส่งประกาศแล้ว', tone: 'green' },
};
const LEVEL = {
  high: { label: 'เตือนภัย', tone: 'red', badge: 'ประกาศเตือนภัย', ring: 'border-red-200', chip: 'bg-red-50 text-red-700' },
  medium: { label: 'เฝ้าระวัง', tone: 'amber', badge: 'ประกาศเฝ้าระวัง', ring: 'border-amber-200', chip: 'bg-amber-50 text-amber-800' },
  custom: { label: 'ทั่วไป', tone: 'blue', badge: 'ประกาศจากเจ้าหน้าที่', ring: 'border-sky-200', chip: 'bg-sky-50 text-sky-700' },
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** All accounts, once per page: who can be reached and on how many phones. */
function useUserIndex() {
  const [users, setUsers] = useState(null);
  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => setUsers(Object.fromEntries(snap.docs.map((d) => {
        const u = d.data();
        return [d.id, { id: d.id, name: u.full_name || u.email || d.id, email: u.email || '', role: u.role || 'farmer', status: u.status || 'active', province: String(u.province || '').replace(/^(จังหวัด|จ\.)\s*/, '').trim(), devices: (u.fcm_tokens || []).length, enabled: u.notifications_enabled !== false }];
      }))))
      .catch(() => setUsers({}));
  }, []);
  return users;
}

function Trend({ a }) {
  if (a.change === null) return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><ArrowUpRight size={14} />ใหม่ในช่วงนี้</span>;
  if (a.change === 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500"><Minus size={14} />เท่าเดิม</span>;
  const up = a.change > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${up ? 'text-red-600' : 'text-emerald-700'}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {up ? '+' : ''}{Math.round(a.change * 100)}% จากช่วงก่อน
    </span>
  );
}

function AlertCard({ a, windowDays, reach, onAck, onCompose, busy }) {
  const r = RISK[a.level];
  const st = STATUS[a.status];
  return (
    <article className={`relative overflow-hidden rounded-[22px] border bg-white p-5 shadow-sm ${a.status === 'new' ? 'border-red-200' : 'border-emerald-900/10'}`}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: r.color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ${r.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />{r.label}</span>
            <Pill tone={st.tone}>{st.label}</Pill>
          </div>
          <h3 className="mt-2 font-display text-xl font-bold text-gray-950">จ.{a.geo.name}</h3>
          <p className="text-xs text-gray-500">{a.top ? `พบ${a.top}มากที่สุด` : 'พบหลายโรค'}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-bold leading-none tabular-nums text-gray-950">{a.recent}</div>
          <div className="mt-1 text-[11px] font-bold text-gray-500">จุดใน {windowDays} วัน</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <Trend a={a} />
        <span className="inline-flex items-center gap-1"><Clock size={13} />ล่าสุด {thaiDateTime(a.latest)}</span>
        <span className="inline-flex items-center gap-1"><Users size={13} />{reach ?? a.users.size} ผู้ใช้ในพื้นที่</span>
      </div>
      {a.action?.acknowledged_by && a.status !== 'new' && (
        <p className="mt-2 text-[11px] text-gray-400">{a.status === 'sent' ? 'ส่งประกาศ' : 'รับทราบ'}โดย {a.action.acknowledged_by} · {thaiDateTime(a.action.ackAt)}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn size="sm" variant="primary" icon={Send} onClick={() => onCompose(a)}>ส่งประกาศ</Btn>
        {a.status === 'new' && <Btn size="sm" icon={CheckCheck} busy={busy} onClick={() => onAck(a)}>รับทราบ</Btn>}
        <Btn size="sm" variant="ghost" icon={MapIcon} to="/admin/risk-map">ดูบนแผนที่</Btn>
      </div>
    </article>
  );
}

/* ── delivery channels ───────────────────────────────────── */

function ChannelStatus({ users, broadcasts }) {
  const list = Object.values(users || {}).filter((u) => u.status !== 'suspended');
  const withPhone = list.filter((u) => u.devices > 0);
  const pushLive = (broadcasts || []).some((b) => (b.push_sent || 0) + (b.push_no_device || 0) + (b.push_failed || 0) > 0);
  const rows = [
    { icon: BellRing, title: 'กระดิ่งในแอป', state: 'พร้อม', tone: 'green', desc: 'ทุกประกาศเข้ารายการแจ้งเตือนของแอปทันที' },
    {
      icon: Smartphone,
      title: 'เด้งบนหน้าจอมือถือ',
      state: users ? `${withPhone.length.toLocaleString()} / ${list.length.toLocaleString()} ผู้ใช้` : '…',
      tone: withPhone.length ? 'green' : 'amber',
      desc: 'แอปเวอร์ชันใหม่เด้งทันทีเมื่อเปิดแอปอยู่ และตรวจทุก ~15 นาทีเมื่อปิดแอป',
    },
    {
      icon: Zap,
      title: 'Push ทันที (FCM)',
      state: pushLive ? 'ทำงาน' : 'รอเปิดใช้',
      tone: pushLive ? 'green' : 'gray',
      desc: pushLive ? 'เด้งทันทีแม้ปิดแอปหรือล็อกจอ' : 'deploy Cloud Function “sendBroadcastPush” (แผน Blaze) เพื่อให้เด้งทันทีแม้ปิดแอป',
    },
  ];
  return (
    <Panel title="ช่องทางการส่ง" desc="ประกาศหนึ่งครั้งส่งทุกช่องทางพร้อมกัน ผู้รับเห็นครั้งเดียวไม่ซ้ำ" className="mb-5" bodyClass="grid gap-3 p-4 md:grid-cols-3">
      {rows.map((r) => (
        <div key={r.title} className="flex gap-3 rounded-2xl bg-gray-50/80 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-paddy)] ring-1 ring-gray-200"><r.icon size={17} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5"><span className="text-[13px] font-extrabold text-gray-900">{r.title}</span><Pill tone={r.tone}>{r.state}</Pill></div>
            <p className="mt-1 text-[11.5px] leading-5 text-gray-500">{r.desc}</p>
          </div>
        </div>
      ))}
    </Panel>
  );
}

/* ── composer ────────────────────────────────────────────── */

function PhonePreview({ title, body, level }) {
  const L = LEVEL[level] || LEVEL.custom;
  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-[26px] bg-[#14231B] p-2 shadow-xl">
        <div className="rounded-[20px] bg-gradient-to-b from-[#2b3f35] to-[#1a2a22] p-3">
          <div className="mb-2 flex justify-between px-1 text-[10px] font-bold text-white/60"><span>10:30</span><span>หน้าจอล็อก</span></div>
          <div className="rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center gap-1.5 text-[10.5px] text-gray-500">
              <img src="/brand/app_icon.svg" alt="" className="h-4 w-4 rounded" />
              <span className="font-bold">Rice AI</span><span>· ตอนนี้</span>
            </div>
            <div className="mt-1 text-[12.5px] font-bold leading-5 text-gray-900 [overflow-wrap:anywhere]">{title || 'หัวข้อประกาศ'}</div>
            <div className="line-clamp-3 text-[11.5px] leading-[1.45] text-gray-600 [overflow-wrap:anywhere]">{body || 'ข้อความประกาศ'}</div>
          </div>
        </div>
      </div>
      <div className="rounded-[20px] bg-[#FAF7F0] p-3 ring-1 ring-gray-200">
        <div className="mb-2 text-center text-[10px] font-bold text-gray-400">ในแอป · รายการแจ้งเตือน</div>
        <div className={`flex gap-3 rounded-2xl border bg-white p-3 ${L.ring}`}>
          <img src="/app/khao_hom_guard.webp" alt="" className="h-10 w-10 shrink-0 rounded-full bg-red-50 object-contain p-0.5" />
          <div className="min-w-0 flex-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${L.chip}`}>{L.badge}</span>
            <div className="mt-1.5 text-[12.5px] font-bold leading-5 text-gray-900 [overflow-wrap:anywhere]">{title || 'หัวข้อประกาศ'}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-[1.45] text-gray-500 [overflow-wrap:anywhere]">{body || 'ข้อความประกาศ'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer({ open, onClose, alerts, stats, users, initial, user, onSent }) {
  const [audience, setAudience] = useState('provinces');
  const [provinces, setProvinces] = useState([]);
  const [kind, setKind] = useState('high');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [testNote, setTestNote] = useState('');

  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  // fill the form once per opening; live data updates must not wipe what the admin typed
  useEffect(() => {
    if (!open) return;
    const list = alertsRef.current;
    const p = initial ? [initial.geo.name] : list.filter((a) => a.status === 'new').map((a) => a.geo.name);
    const k = initial?.level || (list.some((a) => a.level === 'high' && p.includes(a.geo.name)) ? 'high' : p.length ? 'medium' : 'custom');
    setAudience('provinces');
    setProvinces(p);
    setKind(k);
    const t = template(k, p, initial?.top);
    setTitle(t.title);
    setBody(t.body);
    setError('');
    setTestNote('');
  }, [open, initial]);

  const applyTemplate = (k, p = provinces, aud = audience) => {
    setKind(k);
    if (k === 'custom') return;
    const top = alerts.find((a) => a.geo.name === p[0])?.top;
    const t = template(k, aud === 'all' ? [] : p, aud !== 'all' && p.length === 1 ? top : null);
    setTitle(t.title);
    setBody(t.body);
  };

  const byName = useMemo(() => Object.fromEntries(Object.values(stats || {}).map((s) => [s.geo.name, s])), [stats]);
  // Everyone in the app, any role: located in the province now (app GPS) or has scanned there.
  const { recipients, here, scanned } = useMemo(() => {
    const active = (id) => users?.[id]?.status !== 'suspended';
    const set = new Set();
    const hereSet = new Set();
    const scannedSet = new Set();
    if (audience === 'all') {
      for (const u of Object.values(users || {})) if (active(u.id)) set.add(u.id);
    } else {
      for (const u of Object.values(users || {})) if (u.province && provinces.includes(u.province) && active(u.id)) { set.add(u.id); hereSet.add(u.id); }
      for (const p of provinces) for (const s of byName[p]?.scans || []) if (s.userId && active(s.userId)) { set.add(s.userId); scannedSet.add(s.userId); }
    }
    return { recipients: set, here: hereSet.size, scanned: scannedSet.size };
  }, [audience, provinces, byName, users]);
  const roles = useMemo(() => {
    const c = { farmer: 0, researcher: 0, admin: 0 };
    for (const id of recipients) c[users?.[id]?.role || 'farmer'] = (c[users?.[id]?.role || 'farmer'] || 0) + 1;
    return c;
  }, [recipients, users]);
  const reachable = useMemo(() => [...recipients].filter((id) => users?.[id]?.devices > 0).length, [recipients, users]);
  const others = useMemo(() => Object.keys(byName).filter((n) => !provinces.includes(n)).sort((a, b) => a.localeCompare(b, 'th')), [byName, provinces]);

  const toggle = (name) => {
    const next = provinces.includes(name) ? provinces.filter((p) => p !== name) : [...provinces, name];
    setProvinces(next);
    if (kind !== 'custom') applyTemplate(kind, next);
  };
  const switchAudience = (a) => {
    setAudience(a);
    if (kind !== 'custom') applyTemplate(kind, provinces, a);
  };

  const failMsg = (e) => (e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์ส่ง — ตรวจสอบว่าบัญชีนี้เป็นผู้ดูแลระบบ' : `ส่งไม่สำเร็จ: ${e?.message || e}`);

  const send = async () => {
    setBusy('send');
    setError('');
    try {
      await sendBroadcast({ provinces: audience === 'all' ? [] : provinces, audience, recipients, title: title.trim(), body: body.trim(), level: kind }, user);
      logAudit(user, 'ส่งประกาศแจ้งเตือนการระบาด', kind === 'high' ? 'warning' : 'info', `${audience === 'all' ? 'ผู้ใช้ทุกคน' : provinces.join(', ')} · ผู้รับ ${recipients.size} คน · ${title.trim()}`);
      setConfirm(false);
      onSent(recipients.size);
    } catch (e) {
      setError(failMsg(e));
      setConfirm(false);
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    setBusy('test');
    setError('');
    try {
      await sendBroadcast({ provinces: [], audience: 'test', recipients: [user.uid], title: `[ทดสอบ] ${title.trim()}`, body: body.trim(), level: kind, test: true }, user);
      setTestNote('ส่งทดสอบแล้ว — เปิดแอป Rice AI ด้วยบัญชีนี้บนมือถือเพื่อดู');
    } catch (e) {
      setError(failMsg(e));
    } finally {
      setBusy('');
    }
  };

  const canSend = (audience === 'all' || provinces.length) && recipients.size && title.trim() && body.trim();
  const where = audience === 'all' ? 'ผู้ใช้ทุกคน' : provinces.join(', ');
  return (
    <Drawer
      open={open}
      onClose={busy ? undefined : onClose}
      width="sm:max-w-[880px]"
      title="ส่งประกาศถึงผู้ใช้ในพื้นที่"
      subtitle="ส่งถึงทุกคนในแอป Rice AI ที่อยู่ในพื้นที่ พร้อมเด้งแจ้งเตือนบนหน้าจอมือถือ"
      footer={(
        <>
          <span className="mr-auto text-xs text-gray-500">
            <b className="text-gray-900">{recipients.size.toLocaleString()}</b> ผู้รับ · มือถือที่รับแจ้งเตือนได้ <b className="text-gray-900">{users ? reachable.toLocaleString() : '…'}</b>
          </span>
          <Btn icon={FlaskConical} busy={busy === 'test'} disabled={!title.trim() || !body.trim() || !!busy} onClick={sendTest}>ส่งทดสอบถึงตัวเอง</Btn>
          <Btn variant="primary" icon={Send} disabled={!canSend || !!busy} onClick={() => setConfirm(true)}>ส่งประกาศ</Btn>
        </>
      )}
    >
      <ErrorNote>{error}</ErrorNote>
      {testNote && <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100"><CheckCircle2 size={16} />{testNote}</div>}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid content-start gap-5">
          <Field label="ผู้รับ">
            <Segmented value={audience} onChange={switchAudience} options={[{ value: 'provinces', label: 'ตามจังหวัด' }, { value: 'all', label: 'ผู้ใช้ทุกคน' }]} />
          </Field>
          {audience === 'provinces' ? (
            <Field label="จังหวัดเป้าหมาย" hint="ผู้รับคือทุกคนในแอป (เกษตรกร นักวิชาการ เจ้าหน้าที่) ที่อยู่ในจังหวัดนี้ตามตำแหน่งล่าสุดของแอป หรือเคยส่งผลสแกนจากจังหวัดนี้">
              <div className="flex flex-wrap gap-1.5">
                {provinces.map((p) => (
                  <button key={p} type="button" onClick={() => toggle(p)} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-paddy)] px-2.5 py-1 text-xs font-bold text-white">{p}<span aria-hidden>×</span></button>
                ))}
                <select value="" onChange={(e) => e.target.value && toggle(e.target.value)} className="h-7 rounded-full border border-dashed border-gray-300 bg-white px-2 text-xs font-bold text-gray-600 outline-none">
                  <option value="">+ เพิ่มจังหวัด</option>
                  {alerts.filter((a) => !provinces.includes(a.geo.name)).map((a) => <option key={a.geo.code} value={a.geo.name}>{a.geo.name} · {RISK[a.level].label}</option>)}
                  <option disabled>──────────</option>
                  {others.filter((n) => !alerts.some((a) => a.geo.name === n)).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </Field>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-100">ส่งถึงผู้ใช้ทุกคนในแอปที่ไม่ถูกระงับ ({recipients.size.toLocaleString()} คน) ใช้สำหรับประกาศทั่วไปหรือการระบาดหลายภาค</div>
          )}
          {users && (audience === 'all' || provinces.length > 0) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['ผู้รับทั้งหมด', recipients.size],
                ...(audience === 'all' ? [] : [['อยู่ในจังหวัดตอนนี้', here], ['เคยสแกนในจังหวัด', scanned]]),
                ['เกษตรกร / นักวิชาการ / ผู้ดูแล', `${roles.farmer} / ${roles.researcher} / ${roles.admin}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200">
                  <div className="text-[10.5px] font-bold leading-4 text-gray-500">{k}</div>
                  <div className="mt-1 text-[15px] font-extrabold tabular-nums text-gray-950">{typeof v === 'number' ? v.toLocaleString() : v}</div>
                </div>
              ))}
            </div>
          )}
          <Field label="ระดับและแม่แบบ">
            <Segmented value={kind} onChange={(k) => applyTemplate(k)} options={[{ value: 'high', label: 'เตือนภัย' }, { value: 'medium', label: 'เฝ้าระวัง' }, { value: 'custom', label: 'ทั่วไป / เขียนเอง' }]} />
          </Field>
          <Field label={`หัวข้อ (${title.length}/80)`}>
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`ข้อความ (${body.length}/300)`} hint="สั้น ชัด บอกสิ่งที่ควรทำ — บนหน้าจอล็อกแสดงประมาณ 3 บรรทัดแรก">
            <textarea value={body} maxLength={300} rows={5} onChange={(e) => setBody(e.target.value)} className={`${inputCls} resize-none leading-6`} />
          </Field>
          {users && recipients.size > 0 && reachable < recipients.size && (
            <p className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-[11.5px] leading-5 text-gray-600">
              <Smartphone size={14} className="mt-0.5 shrink-0" />
              {(recipients.size - reachable).toLocaleString()} คนยังไม่ได้ใช้แอปเวอร์ชันที่รับแจ้งเตือนบนหน้าจอ จะเห็นประกาศในกระดิ่งของแอปเมื่อเปิดแอป
            </p>
          )}
        </div>
        <div className="md:sticky md:top-0 md:self-start">
          <PhonePreview title={title} body={body} level={kind} />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        busy={busy === 'send'}
        title="ยืนยันการส่งประกาศ"
        confirmLabel={`ส่งถึง ${recipients.size.toLocaleString()} คน`}
        onCancel={() => setConfirm(false)}
        onConfirm={send}
        desc={`“${title.trim()}” จะถูกส่งถึง ${recipients.size.toLocaleString()} คน (${where}) ส่งแล้วยกเลิกไม่ได้ และบันทึกในประวัติประกาศ`}
      />
    </Drawer>
  );
}

/* ── history & delivery ──────────────────────────────────── */

function DeliveryBar({ s, recipients }) {
  if (!s) return <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-100" />;
  const total = s.total || recipients || 0;
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="bg-[var(--color-paddy)]" style={{ width: `${pct(s.read, total)}%` }} />
        <div className="bg-emerald-300" style={{ width: `${pct(Math.max(0, s.pushed - s.read), total)}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
        <span><b className="text-gray-900">{s.read}</b>/{total} อ่านแล้ว ({pct(s.read, total)}%)</span>
        {s.pushed > 0 && <span>Push ถึง {s.pushed} คน</span>}
        {s.noDevice > 0 && <span>ไม่มีมือถือที่รับได้ {s.noDevice}</span>}
      </div>
    </div>
  );
}

function BroadcastRow({ b, onOpen }) {
  const [s, setS] = useState(null);
  useEffect(() => { deliveryStats(b.id).then(setS).catch(() => setS({ total: b.recipients || 0, read: 0, pushed: 0, noDevice: 0 })); }, [b.id, b.recipients]);
  const L = LEVEL[b.level] || LEVEL.custom;
  return (
    <li>
      <button type="button" onClick={() => onOpen(b, s)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-gray-50/70 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={L.tone}>{L.label}</Pill>
            {b.test && <Pill tone="gray" icon={FlaskConical}>ทดสอบ</Pill>}
            <span className="text-xs text-gray-500">{b.audience === 'all' ? 'ผู้ใช้ทุกคน' : b.audience === 'test' ? 'ส่งถึงตัวเอง' : (b.provinces || []).join(', ')}</span>
          </div>
          <div className="mt-1.5 truncate font-bold text-gray-900">{b.title}</div>
          <p className="mt-0.5 line-clamp-1 text-sm text-gray-600">{b.body}</p>
          <div className="mt-1 text-[11px] text-gray-400">{thaiDateTime(b.at)} · โดย {b.sent_by_name || '–'}</div>
        </div>
        <div className="self-center"><DeliveryBar s={s} recipients={b.recipients} /></div>
      </button>
    </li>
  );
}

function BroadcastDrawer({ b, users, onClose }) {
  const [rows, setRows] = useState(null);
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!b) return;
    setRows(null);
    deliveryList(b.id).then(setRows).catch(() => setRows([]));
    deliveryStats(b.id).then(setS).catch(() => {});
  }, [b]);
  if (!b) return null;
  const L = LEVEL[b.level] || LEVEL.custom;
  const push = { sent: ['ส่ง Push แล้ว', 'green'], no_device: ['ไม่มีมือถือที่รับได้', 'gray'], failed: ['Push ไม่สำเร็จ', 'red'] };
  return (
    <Drawer open onClose={onClose} title={b.title} subtitle={`${thaiDateTime(b.at)} · โดย ${b.sent_by_name || '–'}`} width="sm:max-w-[600px]">
      <div className="flex flex-wrap gap-1.5"><Pill tone={L.tone}>{L.label}</Pill>{b.test && <Pill tone="gray">ทดสอบ</Pill>}</div>
      <p className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 text-gray-700 ring-1 ring-gray-200">{b.body}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[['ผู้รับ', s?.total ?? b.recipients ?? 0], ['อ่านแล้ว', s ? `${s.read} (${pct(s.read, s.total)}%)` : '…'], ['Push ถึง', s ? s.pushed : '…']].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200"><div className="text-[11px] font-bold text-gray-500">{k}</div><div className="mt-1 text-base font-extrabold tabular-nums text-gray-950">{v}</div></div>
        ))}
      </div>
      <h3 className="mb-2 mt-6 text-xs font-extrabold text-gray-700">ผู้รับ</h3>
      {!rows ? <p className="text-xs text-gray-400">กำลังโหลด…</p> : (
        <ul className="divide-y divide-gray-100 rounded-2xl bg-white ring-1 ring-gray-200">
          {rows.map((r) => {
            const u = users?.[r.user_id];
            const p = push[r.push_status];
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.is_read ? 'bg-[var(--color-paddy)]' : 'bg-gray-300'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-gray-900">{u?.name || r.user_id.slice(0, 10)}</span>
                  <span className="block truncate text-[11px] text-gray-500">{u?.email || ''}</span>
                </span>
                {p && <Pill tone={p[1]}>{p[0]}</Pill>}
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${r.is_read ? 'text-[var(--color-paddy)]' : 'text-gray-400'}`}><Eye size={12} />{r.is_read ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}</span>
              </li>
            );
          })}
          {!rows.length && <li className="px-3 py-6 text-center text-xs text-gray-400">ไม่มีข้อมูลผู้รับ</li>}
        </ul>
      )}
    </Drawer>
  );
}

/* ── page ───────────────────────────────────────────────── */

export default function OutbreakAlerts() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const cfg = settings.alerts;
  const { stats, loading, error } = useOutbreakData();
  const { items: actions, error: actErr } = useAlertActions();
  const { items: broadcasts, error: bcErr } = useBroadcasts();
  const users = useUserIndex();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'alerts';
  const [filter, setFilter] = useState('all');
  const [composer, setComposer] = useState(null); // { initial }
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState('');
  const [toast, showToast] = useToast();

  const alerts = useMemo(() => computeAlerts(stats, cfg, actions), [stats, cfg, actions]);
  const shown = alerts.filter((a) => filter === 'all' || (filter === 'new' ? a.status === 'new' : a.level === filter));
  const sorted = useMemo(() => [...(broadcasts || [])].sort((a, b) => (b.at?.getTime() || Infinity) - (a.at?.getTime() || Infinity)), [broadcasts]);
  const real = sorted.filter((b) => !b.test);
  const month = Date.now() - 30 * 86_400_000;
  const recent = real.filter((b) => !b.at || b.at.getTime() >= month);

  useEffect(() => {
    if (params.get('compose') && stats) {
      setComposer({ initial: alerts.find((a) => a.geo.name === params.get('p')) || null });
      setParams((p) => { p.delete('compose'); p.delete('p'); return p; }, { replace: true });
    }
  }, [params, setParams, alerts, stats]);

  const ack = async (a) => {
    setBusy(a.geo.name);
    try {
      await acknowledge(a, user);
      logAudit(user, 'รับทราบการแจ้งเตือนการระบาด', 'info', `จ.${a.geo.name} · ${RISK[a.level].label} · ${a.recent} จุด`);
      showToast(`รับทราบ จ.${a.geo.name} แล้ว`);
    } catch (e) {
      showToast(e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์ — ตรวจสอบว่าเป็นผู้ดูแลระบบ' : 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="pb-10">
      {toast}
      <PageHeader
        icon={Siren}
        eyebrow="Early warning"
        title="ศูนย์แจ้งเตือนการระบาด"
        desc={`จังหวัดที่มีรายงานพบโรคถึงเกณฑ์ภายใน ${cfg.windowDays} วันล่าสุด (เสี่ยงสูง ≥ ${cfg.high} จุด · เฝ้าระวัง ≥ ${cfg.medium} จุด) รับทราบ หรือส่งประกาศเข้ามือถือทุกคนในพื้นที่ได้ทันที`}
        actions={(
          <>
            <Btn icon={view === 'history' ? Siren : History} onClick={() => setParams({ view: view === 'history' ? 'alerts' : 'history' })}>{view === 'history' ? 'ดูการแจ้งเตือน' : 'ประวัติประกาศ'}</Btn>
            <Btn variant="primary" icon={Megaphone} onClick={() => setComposer({ initial: null })}>ส่งประกาศ</Btn>
          </>
        )}
      />
      <ErrorNote>{error || actErr || bcErr}</ErrorNote>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={loading} icon={ShieldAlert} tone="red" label="เสี่ยงสูง" value={alerts.filter((a) => a.level === 'high').length} sub="จังหวัด" />
        <Kpi loading={loading} icon={BellRing} tone="amber" label="เฝ้าระวัง" value={alerts.filter((a) => a.level === 'medium').length} sub="จังหวัด" />
        <Kpi loading={loading} icon={Siren} tone="red" label="ยังไม่รับทราบ" value={alerts.filter((a) => a.status === 'new').length} sub="ต้องดำเนินการ" />
        <Kpi loading={!broadcasts} icon={Megaphone} tone="blue" label="ประกาศใน 30 วัน" value={recent.length} sub={`ผู้รับรวม ${recent.reduce((s, b) => s + (b.recipients || 0), 0).toLocaleString()} คน`} />
      </div>

      <ChannelStatus users={users} broadcasts={broadcasts} />

      {view === 'history' ? (
        <Panel title="ประวัติประกาศ" desc="กดที่ประกาศเพื่อดูรายชื่อผู้รับและสถานะการอ่าน" bodyClass="p-0">
          {!sorted.length ? <EmptyState icon={Megaphone} title="ยังไม่มีประกาศ" desc="ประกาศที่ส่งจะแสดงที่นี่พร้อมอัตราการอ่าน" /> : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((b) => <BroadcastRow key={b.id} b={b} onOpen={(x) => setDetail(x)} />)}
            </ul>
          )}
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'ทั้งหมด', count: alerts.length },
                { value: 'new', label: 'ยังไม่รับทราบ', count: alerts.filter((a) => a.status === 'new').length },
                { value: 'high', label: 'เสี่ยงสูง', count: alerts.filter((a) => a.level === 'high').length },
                { value: 'medium', label: 'เฝ้าระวัง', count: alerts.filter((a) => a.level === 'medium').length },
              ]}
            />
            <Link to="/admin/settings#alerts" className="text-xs font-bold text-[var(--color-paddy)] hover:underline">ปรับเกณฑ์การแจ้งเตือน</Link>
          </div>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-[22px] bg-white" />)}</div>
          ) : !shown.length ? (
            <div className="rounded-[22px] border border-emerald-900/10 bg-white">
              <EmptyState
                icon={CheckCheck}
                title={alerts.length ? 'ไม่มีรายการในตัวกรองนี้' : 'สถานการณ์ปกติ'}
                desc={alerts.length ? 'ลองเลือกตัวกรองอื่น' : `ไม่มีจังหวัดที่ถึงเกณฑ์ภายใน ${cfg.windowDays} วันล่าสุด ยังส่งประกาศทั่วไปได้จากปุ่ม “ส่งประกาศ”`}
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((a) => <AlertCard key={a.geo.code} a={a} windowDays={cfg.windowDays} reach={users ? new Set([...a.users, ...Object.values(users).filter((u) => u.province === a.geo.name).map((u) => u.id)]).size : undefined} busy={busy === a.geo.name} onAck={ack} onCompose={(x) => setComposer({ initial: x })} />)}
            </div>
          )}
        </>
      )}

      <Composer
        open={!!composer}
        initial={composer?.initial}
        alerts={alerts}
        stats={stats}
        users={users}
        user={user}
        onClose={() => setComposer(null)}
        onSent={(n) => { setComposer(null); showToast(`ส่งประกาศถึง ${n.toLocaleString()} คนแล้ว`); setParams({ view: 'history' }); }}
      />
      {detail && <BroadcastDrawer b={detail} users={users} onClose={() => setDetail(null)} />}
    </div>
  );
}
