import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, ExternalLink, Eye, EyeOff, FlaskConical, ImageIcon, ImagePlus, Plus, RotateCcw, Save, Search, Sparkles, Star, Trash2, Upload,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { categories, diseases as BASE } from '../../lib/riceDiseases';
import { EDITABLE, applyOverride, createDisease, customEntries, customToDisease, imageToDataUrl, isCaution, resetWiki, saveWiki, slugOf, useWikiOverrides } from '../../lib/wikiContent';
import { logAudit } from '../../lib/audit';
import { thaiDateTime } from '../../lib/exporters';
import { DiseaseBody } from '../RiceDiseases';
import { Btn, ConfirmDialog, ErrorNote, Field, Modal, PageHeader, Pill, Segmented, Toggle, inputCls, useToast } from '../../components/admin/ui';

const TABS = [
  { value: 'general', label: 'ข้อมูลทั่วไป' },
  { value: 'symptoms', label: 'อาการ' },
  { value: 'control', label: 'การป้องกันกำจัด' },
  { value: 'chemicals', label: 'สารเคมี' },
  { value: 'images', label: 'รูปภาพ' },
  { value: 'source', label: 'อ้างอิง' },
  { value: 'preview', label: 'ตัวอย่าง' },
];
const FIELD_TH = { chemicals: 'สารเคมี', name: 'ชื่อโรค', category: 'หมวด', cause: 'เชื้อสาเหตุ', found: 'พื้นที่ที่พบ', risk: 'สภาพเสี่ยง', symptoms: 'อาการ', prevention: 'สรุปการป้องกัน', control: 'การป้องกันกำจัด', published: 'วันที่เผยแพร่', source: 'แหล่งอ้างอิง', images: 'รูปภาพ', hidden: 'การแสดงผล' };

/** Editable copy of a disease: defaults, then saved edits; images keep a hidden flag. */
function toDraft(base, o) {
  const d = {};
  for (const k of EDITABLE) d[k] = structuredClone(o?.[k] ?? base[k]);
  d.chemicals = structuredClone(o?.chemicals ?? base.chemicals ?? []);
  d.images = structuredClone(o?.images ?? base.images.map((im) => ({ ...im, hidden: false })));
  d.hidden = !!o?.hidden;
  return d;
}

const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function IconBtn({ icon: Icon, label, onClick, disabled, tone = '' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 ${tone}`}>
      <Icon size={15} />
    </button>
  );
}

function StringList({ items, onChange, placeholder, addLabel }) {
  return (
    <div className="grid gap-2">
      {items.map((t, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2.5 w-5 shrink-0 text-right text-xs font-bold tabular-nums text-gray-400">{i + 1}</span>
          <textarea value={t} rows={Math.max(1, Math.ceil(t.length / 70))} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} placeholder={placeholder} className={`${inputCls} resize-none leading-6`} />
          <div className="flex shrink-0">
            <IconBtn icon={ArrowUp} label="เลื่อนขึ้น" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} />
            <IconBtn icon={ArrowDown} label="เลื่อนลง" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} />
            <IconBtn icon={Trash2} label="ลบ" tone="hover:!bg-red-50 hover:!text-red-600" onClick={() => onChange(items.filter((_, k) => k !== i))} />
          </div>
        </div>
      ))}
      <div><Btn size="sm" variant="soft" icon={Plus} onClick={() => onChange([...items, ''])}>{addLabel}</Btn></div>
    </div>
  );
}

function ControlEditor({ items, onChange }) {
  const set = (i, patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  let step = 0;
  return (
    <div className="grid gap-3">
      {items.map((c, i) => {
        const isNote = c.note !== undefined;
        const caution = !isNote && isCaution(c.text || '');
        if (!isNote) step += 1;
        return (
          <div key={i} className={`rounded-2xl p-3 ring-1 ${isNote || caution ? 'bg-amber-50/60 ring-amber-200' : 'bg-white ring-gray-200'}`}>
            <div className="mb-2 flex items-center gap-2">
              {isNote ? <Pill tone="amber" icon={AlertTriangle}>หมายเหตุ / ข้อควรระวัง</Pill> : (
                <>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black text-white ${caution ? 'bg-amber-500' : 'bg-[var(--color-paddy)]'}`}>{step}</span>
                  {caution && <Pill tone="amber" icon={AlertTriangle}>ข้อควรระวัง (ตรวจจากคำขึ้นต้น)</Pill>}
                </>
              )}
              <div className="ml-auto flex">
                <IconBtn icon={ArrowUp} label="เลื่อนขึ้น" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} />
                <IconBtn icon={ArrowDown} label="เลื่อนลง" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} />
                <IconBtn icon={Trash2} label="ลบ" tone="hover:!bg-red-50 hover:!text-red-600" onClick={() => onChange(items.filter((_, k) => k !== i))} />
              </div>
            </div>
            {isNote ? (
              <textarea value={c.note} rows={2} onChange={(e) => set(i, { note: e.target.value })} className={`${inputCls} resize-none leading-6`} />
            ) : (
              <>
                <textarea value={c.text} rows={Math.max(2, Math.ceil((c.text || '').length / 75))} onChange={(e) => set(i, { text: e.target.value })} className={`${inputCls} resize-none leading-6`} />
                {c.sub ? (
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] font-bold text-gray-500">ข้อย่อย (บรรทัดละ 1 ข้อ)</span>
                    <textarea
                      value={c.sub.join('\n')}
                      rows={Math.max(2, c.sub.length)}
                      onChange={(e) => set(i, { sub: e.target.value.split('\n') })}
                      className={`${inputCls} resize-none text-[13px] leading-6`}
                    />
                  </label>
                ) : (
                  <button type="button" onClick={() => set(i, { sub: [''] })} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-paddy)] hover:underline"><Plus size={12} />เพิ่มข้อย่อย</button>
                )}
              </>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant="soft" icon={Plus} onClick={() => onChange([...items, { text: '' }])}>เพิ่มขั้นตอน</Btn>
        <Btn size="sm" variant="soft" icon={AlertTriangle} onClick={() => onChange([...items, { note: '' }])}>เพิ่มหมายเหตุ</Btn>
      </div>
      <p className="text-[11px] leading-5 text-gray-500">ขั้นตอนที่ขึ้นต้นด้วย “ไม่ควร / ไม่ใช้ / หลีกเลี่ยง / ห้าม” จะแสดงเป็นข้อควรระวังสีเหลืองบนหน้าเว็บโดยอัตโนมัติ</p>
    </div>
  );
}

const CHEM_FIELDS = [
  ['name', 'สารเคมี (ชื่อสามัญ)', 'เช่น ไตรไซคลาโซล 75% WP'],
  ['rate', 'อัตราการใช้', 'เช่น 10–16 กรัม / น้ำ 20 ลิตร'],
  ['timing', 'ช่วงเวลา / วิธีใช้', 'เช่น พ่นเมื่อพบแผล 5% ของพื้นที่ใบ'],
];

function ChemicalEditor({ items, onChange }) {
  const set = (i, patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <div className="grid gap-3">
      {!items.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center">
          <FlaskConical size={22} className="mx-auto text-gray-400" />
          <p className="mt-2 text-sm font-bold text-gray-700">ยังไม่มีรายการสารเคมี</p>
          <p className="mt-1 text-xs text-gray-500">ระบุชื่อสาร อัตรา และช่วงเวลาใช้ตามคำแนะนำของกรมการข้าว เพื่อแสดงเป็นตารางบนหน้าเว็บ</p>
        </div>
      )}
      {items.map((c, i) => (
        <div key={i} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-600 text-xs font-black text-white">{i + 1}</span>
            <span className="text-xs font-extrabold text-gray-700">สารเคมีรายการที่ {i + 1}</span>
            <div className="ml-auto flex">
              <IconBtn icon={ArrowUp} label="เลื่อนขึ้น" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} />
              <IconBtn icon={ArrowDown} label="เลื่อนลง" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} />
              <IconBtn icon={Trash2} label="ลบ" tone="hover:!bg-red-50 hover:!text-red-600" onClick={() => onChange(items.filter((_, k) => k !== i))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {CHEM_FIELDS.map(([k, label, ph]) => (
              <Field key={k} label={label}><input value={c[k] || ''} onChange={(e) => set(i, { [k]: e.target.value })} placeholder={ph} className={inputCls} /></Field>
            ))}
          </div>
          <Field label="ข้อควรระวัง (ไม่บังคับ)" className="mt-3"><input value={c.note || ''} onChange={(e) => set(i, { note: e.target.value })} placeholder="เช่น หยุดใช้ก่อนเก็บเกี่ยว 14 วัน" className={inputCls} /></Field>
        </div>
      ))}
      <div><Btn size="sm" variant="soft" icon={Plus} onClick={() => onChange([...items, { name: '', rate: '', timing: '', note: '' }])}>เพิ่มสารเคมี</Btn></div>
      <p className="text-[11px] leading-5 text-gray-500">ใช้เฉพาะสารที่ขึ้นทะเบียนและแนะนำโดยกรมวิชาการเกษตร/กรมการข้าว ระบบจะแสดงคำเตือนให้ผู้ใช้ปรึกษาเจ้าหน้าที่ก่อนใช้ทุกครั้ง</p>
    </div>
  );
}

const MAX_UPLOADS = 4;

function UploadButton({ onAdd, disabled, label = 'อัปโหลดภาพ' }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-xs font-bold text-[var(--color-paddy)] ring-1 ring-emerald-100 hover:bg-emerald-100 ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}>
      <Upload size={13} />{busy ? 'กำลังย่อภาพ…' : label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try { onAdd(await imageToDataUrl(f)); } finally { setBusy(false); }
        }}
      />
    </label>
  );
}

function ImageEditor({ images, onChange }) {
  const set = (i, patch) => onChange(images.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const visible = images.filter((im) => !im.hidden).length;
  const uploads = images.filter((im) => im.src.startsWith('data:')).length;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <UploadButton disabled={uploads >= MAX_UPLOADS} onAdd={(im) => onChange([...images, { ...im, caption: '', hidden: false }])} />
        <span className="text-[11px] text-gray-500">ย่อเหลือไม่เกิน 1024 px อัตโนมัติ · อัปโหลดได้สูงสุด {MAX_UPLOADS} ภาพต่อโรค ({uploads}/{MAX_UPLOADS})</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((im, i) => {
          const cover = i === images.findIndex((x) => !x.hidden);
          return (
            <figure key={`${i}-${im.src.slice(-24)}`} className={`overflow-hidden rounded-2xl bg-white ring-1 ${cover ? 'ring-2 ring-[var(--color-paddy)]' : 'ring-gray-200'} ${im.hidden ? 'opacity-55' : ''}`}>
              <div className="relative aspect-[4/3] bg-gray-100">
                <img src={im.src} alt={im.caption || ''} loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute left-2 top-2 flex gap-1">
                  {cover && <Pill tone="dark" icon={Star}>ภาพปก</Pill>}
                  {im.hidden && <Pill tone="gray" icon={EyeOff}>ซ่อน</Pill>}
                </div>
              </div>
              <div className="p-2.5">
                <input value={im.caption || ''} onChange={(e) => set(i, { caption: e.target.value })} placeholder="คำบรรยายภาพ (ไม่บังคับ)" className={`${inputCls} !py-2 text-[13px]`} />
                <div className="mt-2 flex items-center">
                  <IconBtn icon={ArrowLeft} label="เลื่อนก่อน" disabled={i === 0} onClick={() => onChange(move(images, i, -1))} />
                  <IconBtn icon={ArrowRight} label="เลื่อนหลัง" disabled={i === images.length - 1} onClick={() => onChange(move(images, i, 1))} />
                  {!cover && !im.hidden && <Btn size="sm" variant="ghost" icon={Star} onClick={() => onChange([im, ...images.filter((_, k) => k !== i)])}>ตั้งเป็นปก</Btn>}
                  {im.src.startsWith('data:') && <IconBtn icon={Trash2} label="ลบภาพที่อัปโหลด" tone="hover:!bg-red-50 hover:!text-red-600" disabled={!im.hidden && visible <= 1} onClick={() => onChange(images.filter((_, k) => k !== i))} />}
                  <button
                    type="button"
                    disabled={!im.hidden && visible <= 1}
                    onClick={() => set(i, { hidden: !im.hidden })}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                  >
                    {im.hidden ? <><Eye size={13} />แสดง</> : <><EyeOff size={13} />ซ่อน</>}
                  </button>
                </div>
              </div>
            </figure>
          );
        })}
      </div>
      {!images.length && <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">ยังไม่มีรูปภาพ — อัปโหลดอย่างน้อย 1 ภาพเพื่อเผยแพร่โรคนี้บนหน้าเว็บ</p>}
      <p className="mt-3 text-[11px] leading-5 text-gray-500">ภาพแรกที่ไม่ได้ซ่อนคือภาพปกบนการ์ด ต้องแสดงอย่างน้อย 1 ภาพ · ภาพต้นฉบับมาจากหน้าเว็บกรมการข้าว</p>
    </div>
  );
}

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function NewDiseaseModal({ taken, onClose, onCreated, user }) {
  const [f, setF] = useState({ name: '', tag: '', category: 'เชื้อรา', cause: '' });
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const slug = slugify(f.tag);
  const clash = slug && taken.has(slug);
  const valid = f.name.trim() && slug && !clash && f.cause.trim() && image;

  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await createDisease(slug, {
        name: f.name.trim(),
        tag: f.tag.trim(),
        category: f.category,
        cause: f.cause.trim(),
        found: '',
        risk: '',
        symptoms: [],
        prevention: [],
        control: [],
        chemicals: [],
        images: [{ ...image, caption: '', hidden: false }],
        published: new Date().toISOString().slice(0, 10),
        source: '',
        hidden: true,
      }, user);
      logAudit(user, 'เพิ่มโรคใหม่ในสารานุกรมโรคข้าว', 'info', `${f.name.trim()} (${slug})`);
      onCreated(slug);
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์บันทึก' : `เพิ่มโรคไม่สำเร็จ: ${e?.message || e}`);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      width="max-w-lg"
      title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-[var(--color-paddy)]" />เพิ่มโรคใหม่ในสารานุกรม</span>}
      footer={(
        <>
          <Btn onClick={onClose} disabled={busy}>ยกเลิก</Btn>
          <Btn variant="primary" icon={Plus} busy={busy} disabled={!valid} onClick={create}>สร้างและแก้ไขต่อ</Btn>
        </>
      )}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อโรค (ภาษาไทย)"><input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="เช่น โรคใบไหม้แผลใหญ่" /></Field>
          <Field label="ชื่อภาษาอังกฤษ" hint={clash ? <span className="font-bold text-red-600">มีโรคชื่อนี้อยู่แล้ว</span> : slug ? <span className="font-mono">/rice-diseases?d={slug}</span> : 'ใช้สร้างลิงก์ของหน้าโรค'}>
            <input value={f.tag} onChange={(e) => set('tag', e.target.value)} className={inputCls} placeholder="เช่น Leaf Blight" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="หมวดเชื้อสาเหตุ">
            <select value={f.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
              {categories.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="เชื้อสาเหตุ"><input value={f.cause} onChange={(e) => set('cause', e.target.value)} className={`${inputCls} italic`} placeholder="ชื่อวิทยาศาสตร์" /></Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-extrabold text-gray-700">ภาพปก</span>
          {image ? (
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-2 ring-1 ring-gray-200">
              <img src={image.src} alt="" className="h-16 w-20 rounded-xl object-cover" />
              <span className="text-xs text-gray-500">{image.w}×{image.h} px</span>
              <Btn size="sm" variant="ghost" className="ml-auto" onClick={() => setImage(null)}>เปลี่ยนภาพ</Btn>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 p-4">
              <ImagePlus size={22} className="text-gray-400" />
              <span className="flex-1 text-xs text-gray-500">ภาพอาการที่เห็นชัด ระบบย่อให้อัตโนมัติ</span>
              <UploadButton label="เลือกภาพ" onAdd={setImage} />
            </div>
          )}
        </div>
        <p className="rounded-xl bg-sky-50 p-3 text-[12px] leading-5 text-sky-900 ring-1 ring-sky-100">โรคใหม่จะถูกซ่อนจากหน้าเว็บไว้ก่อน เพิ่มอาการ วิธีป้องกันกำจัด และสารเคมีให้ครบ แล้วจึงปิด “ซ่อนโรคนี้” เพื่อเผยแพร่</p>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

export default function WikiManage() {
  const { user } = useAuth();
  const { overrides, loaded } = useWikiOverrides();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const customs = useMemo(() => customEntries(overrides), [overrides]);
  const all = useMemo(() => [
    ...BASE.map((d) => ({ slug: slugOf(d), base: d, custom: false })),
    ...customs.map(([s, ov]) => ({ slug: s, base: customToDisease(ov), custom: true })),
  ], [customs]);
  const slug = params.get('d') || slugOf(BASE[0]);
  const entry = all.find((x) => x.slug === slug) || all[0];
  const { base, custom } = entry;
  const o = custom ? { ...overrides[slug], images: overrides[slug]?.images } : overrides[slug];
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(base, o));
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  const [toast, showToast] = useToast();

  const saved = useMemo(() => toDraft(base, o), [base, o]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(saved); setError(''); }, [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const changedFromBase = useMemo(() => {
    if (custom) return [];
    const pristine = toDraft(base, null);
    return Object.keys(pristine).filter((k) => JSON.stringify(pristine[k]) !== JSON.stringify(draft[k]));
  }, [base, draft, custom]);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter(({ base: d, slug: s }) => !t || `${overrides[s]?.name || d.name} ${d.tag} ${d.category}`.toLowerCase().includes(t));
  }, [q, all, overrides]);

  const pick = (s) => {
    if (dirty && !window.confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขหรือไม่?')) return;
    setParams({ d: s }, { replace: true });
  };

  const save = async () => {
    if (!draft.name.trim()) { setError('ต้องมีชื่อโรค'); return; }
    if (!draft.images.some((im) => !im.hidden)) { setError('ต้องแสดงรูปภาพอย่างน้อย 1 ภาพ'); return; }
    setSaving(true);
    setError('');
    const clean = {
      ...draft,
      symptoms: draft.symptoms.map((s) => s.trim()).filter(Boolean),
      prevention: draft.prevention.map((s) => s.trim()).filter(Boolean),
      control: draft.control
        .map((c) => {
          if (c.note !== undefined) return { note: c.note.trim() };
          const sub = (c.sub || []).map((x) => x.trim()).filter(Boolean);
          return { text: c.text.trim(), ...(sub.length ? { sub } : {}) };
        })
        .filter((c) => c.note || c.text),
      chemicals: (draft.chemicals || [])
        .map((c) => ({ name: (c.name || '').trim(), rate: (c.rate || '').trim(), timing: (c.timing || '').trim(), note: (c.note || '').trim() }))
        .filter((c) => c.name),
      ...(custom ? { custom: true, tag: base.tag } : {}),
    };
    try {
      await saveWiki(slug, clean, user);
      logAudit(user, 'แก้ไขสารานุกรมโรคข้าว', 'info', custom ? `${clean.name} (${slug}) · โรคที่เพิ่มเอง` : `${base.name} (${slug}) · ${changedFromBase.map((k) => FIELD_TH[k] || k).join(', ') || 'ไม่มีความต่างจากต้นฉบับ'}`);
      showToast('บันทึกและเผยแพร่แล้ว');
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์บันทึก — ต้องอัปเดต Firestore rules (wiki_content) ก่อน' : `บันทึกไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await resetWiki(slug);
      logAudit(user, 'คืนค่าสารานุกรมเป็นต้นฉบับกรมการข้าว', 'info', `${base.name} (${slug})`);
      setConfirmReset(false);
      showToast('คืนค่าต้นฉบับแล้ว');
    } catch {
      showToast('คืนค่าไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await resetWiki(slug);
      logAudit(user, 'ลบโรคออกจากสารานุกรมโรคข้าว', 'warning', `${base.name} (${slug})`);
      setConfirmDelete(false);
      setParams({ d: slugOf(BASE[0]) }, { replace: true });
      showToast('ลบโรคแล้ว');
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const preview = custom ? customToDisease({ ...draft, tag: base.tag }) : applyOverride(base, draft);

  return (
    <div className="pb-10">
      {toast}
      <PageHeader
        icon={BookOpen}
        eyebrow="Content"
        title="จัดการสารานุกรมโรคข้าว"
        desc="เพิ่ม แก้ไข หรือลบเนื้อหาในหน้า “ความรู้โรคข้าว” ของเว็บไซต์ รวมถึงสารเคมีและอัตราการใช้ ต้นฉบับมาจาก Rice Knowledge Bank กรมการข้าวและคืนค่ากลับได้ทุกเมื่อ"
        actions={(
          <>
            <Btn icon={ExternalLink} onClick={() => window.open(`/rice-diseases?d=${slug}`, '_blank')}>ดูหน้าเว็บ</Btn>
            <Btn variant="primary" icon={Plus} disabled={!loaded} onClick={() => setAdding(true)}>เพิ่มโรคใหม่</Btn>
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[22px] border border-emerald-900/10 bg-white lg:sticky lg:top-6 lg:self-start">
          <label className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <Search size={15} className="text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`ค้นหาใน ${all.length} โรค`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <ul className="max-h-[300px] overflow-y-auto lg:max-h-[calc(100vh-220px)]">
            {list.map(({ base: d, slug: s, custom: isNew }) => {
              const ov = overrides[s];
              const on = s === slug;
              const thumb = isNew ? d.thumb : applyOverride(d, ov).thumb;
              return (
                <li key={s}>
                  <button type="button" onClick={() => pick(s)} className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left transition ${on ? 'bg-emerald-50/80 shadow-[inset_3px_0_0_var(--color-paddy)]' : 'hover:bg-gray-50'}`}>
                    {thumb ? <img src={thumb} alt="" loading="lazy" className="h-10 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100"><ImageIcon size={15} className="text-gray-400" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-gray-900">{ov?.name || d.name}</span>
                      <span className="block truncate text-[11px] text-gray-500">{d.tag}</span>
                    </span>
                    {ov?.hidden ? <Pill tone="gray">ซ่อน</Pill> : isNew ? <Pill tone="green">เพิ่มใหม่</Pill> : ov ? <Pill tone="blue">แก้ไขแล้ว</Pill> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-w-0 rounded-[22px] border border-emerald-900/10 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-xl font-bold text-gray-950">{draft.name || base.name}</h2>
                {draft.hidden && <Pill tone="gray" icon={EyeOff}>ซ่อนจากหน้าเว็บ</Pill>}
                {dirty ? <Pill tone="amber">ยังไม่บันทึก</Pill> : custom ? <Pill tone="green" icon={Sparkles}>โรคที่เพิ่มโดยผู้ดูแล</Pill> : o ? <Pill tone="blue">แก้ไขจากต้นฉบับ</Pill> : <Pill tone="green">ต้นฉบับกรมการข้าว</Pill>}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {base.tag}
                {changedFromBase.length > 0 && <> · ต่างจากต้นฉบับ: {changedFromBase.map((k) => FIELD_TH[k] || k).join(', ')}</>}
                {o?.at && <> · บันทึกล่าสุด {thaiDateTime(o.at)} โดย {o.updated_by || '–'}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {custom
                ? <Btn size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>ลบโรคนี้</Btn>
                : o && <Btn size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)}>คืนค่าต้นฉบับ</Btn>}
              {dirty && <Btn size="sm" variant="ghost" onClick={() => setDraft(saved)}>ยกเลิก</Btn>}
              <Btn size="sm" variant="primary" icon={Save} busy={saving} disabled={!dirty || !loaded} onClick={save}>บันทึกและเผยแพร่</Btn>
            </div>
          </div>

          <div className="border-b border-gray-100 px-5 py-3"><Segmented value={tab} onChange={setTab} options={TABS} /></div>

          <div className="p-5">
            <ErrorNote>{error}</ErrorNote>
            {tab === 'general' && (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ชื่อโรค"><input value={draft.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></Field>
                  <Field label="หมวดเชื้อสาเหตุ">
                    <select value={draft.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
                      {categories.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="เชื้อสาเหตุ"><input value={draft.cause} onChange={(e) => set('cause', e.target.value)} className={`${inputCls} italic`} /></Field>
                <Field label="พื้นที่ที่พบ"><textarea rows={2} value={draft.found} onChange={(e) => set('found', e.target.value)} className={`${inputCls} resize-none leading-6`} /></Field>
                <Field label="สภาพที่เสี่ยงต่อการระบาด"><textarea rows={3} value={draft.risk} onChange={(e) => set('risk', e.target.value)} className={`${inputCls} resize-none leading-6`} /></Field>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <Toggle checked={draft.hidden} onChange={(v) => set('hidden', v)} label="ซ่อนโรคนี้จากหน้าเว็บ" desc={custom ? 'โรคที่เพิ่มใหม่จะซ่อนไว้จนกว่าเนื้อหาจะครบ ปิดสวิตช์นี้เพื่อเผยแพร่' : 'ใช้แทนการลบสำหรับเนื้อหาต้นฉบับกรมการข้าว ข้อมูลไม่ถูกลบและคืนค่าได้'} />
                </div>
              </div>
            )}
            {tab === 'symptoms' && (
              <div className="grid gap-6">
                <Field label="อาการสำคัญ"><StringList items={draft.symptoms} onChange={(v) => set('symptoms', v)} addLabel="เพิ่มอาการ" /></Field>
                <Field label="สรุปการป้องกัน (ใช้ในการค้นหา)"><StringList items={draft.prevention} onChange={(v) => set('prevention', v)} addLabel="เพิ่มข้อ" /></Field>
              </div>
            )}
            {tab === 'control' && <ControlEditor items={draft.control} onChange={(v) => set('control', v)} />}
            {tab === 'chemicals' && <ChemicalEditor items={draft.chemicals} onChange={(v) => set('chemicals', v)} />}
            {tab === 'images' && <ImageEditor images={draft.images} onChange={(v) => set('images', v)} />}
            {tab === 'source' && (
              <div className="grid max-w-2xl gap-4">
                <Field label="ลิงก์แหล่งอ้างอิง" hint="หน้าเว็บ Rice Knowledge Bank ของโรคนี้"><input value={draft.source} onChange={(e) => set('source', e.target.value)} className={inputCls} /></Field>
                <Field label="วันที่เผยแพร่ต้นฉบับ" hint="ใช้ในการอ้างอิงแบบ APA บนหน้าเว็บ"><input type="date" value={draft.published} onChange={(e) => set('published', e.target.value)} className={inputCls} /></Field>
              </div>
            )}
            {tab === 'preview' && (
              <div className="mx-auto max-w-[560px] overflow-hidden rounded-[24px] bg-[var(--color-paper)] ring-1 ring-gray-200">
                <div className="border-b border-gray-100 px-5 pb-4 pt-5">
                  <h3 className="font-display text-3xl font-black text-gray-950">{preview.name}</h3>
                  <p className="mt-1 text-sm font-bold text-[var(--color-paddy)]/70">{preview.tag}</p>
                </div>
                {preview.images.length ? <DiseaseBody disease={preview} onOpenPhoto={() => {}} /> : <p className="p-6 text-center text-sm text-gray-500">เพิ่มรูปภาพอย่างน้อย 1 ภาพเพื่อดูตัวอย่าง</p>}
              </div>
            )}
            {tab !== 'preview' && (
              <div className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                <ImageIcon size={14} />ดูผลลัพธ์ก่อนเผยแพร่ได้ที่แท็บ “ตัวอย่าง”
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        busy={saving}
        tone="danger"
        title="คืนค่าเป็นต้นฉบับกรมการข้าว?"
        desc={`การแก้ไขทั้งหมดของ “${base.name}” จะถูกลบ และหน้าเว็บจะกลับไปแสดงเนื้อหาต้นฉบับ`}
        confirmLabel="คืนค่าต้นฉบับ"
        onCancel={() => setConfirmReset(false)}
        onConfirm={reset}
      />

      <ConfirmDialog
        open={confirmDelete}
        busy={saving}
        tone="danger"
        title="ลบโรคนี้ออกจากสารานุกรม?"
        desc={`“${base.name}” และรูปภาพที่อัปโหลดจะถูกลบถาวร ย้อนกลับไม่ได้`}
        confirmLabel="ลบถาวร"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />

      {adding && (
        <NewDiseaseModal
          user={user}
          taken={new Set(all.map((x) => x.slug))}
          onClose={() => setAdding(false)}
          onCreated={(s) => { setAdding(false); setParams({ d: s }, { replace: true }); setTab('general'); showToast('เพิ่มโรคแล้ว กรอกรายละเอียดต่อได้เลย'); }}
        />
      )}
    </div>
  );
}
