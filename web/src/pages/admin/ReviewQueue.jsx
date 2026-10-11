import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ImageOff, Keyboard, Loader2, MapPin, RotateCcw, ScanSearch, Undo2, X,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useScans } from '../../lib/scanStore';
import { useSettings } from '../../lib/settings';
import { logAudit } from '../../lib/audit';
import { thaiDateTime } from '../../lib/exporters';
import { Btn, EmptyState, ErrorNote, PageHeader, Pill, Segmented, useToast } from '../../components/admin/ui';
import { LABELS, MODEL_CLASSES, clearReview, labelName, pct, saveReview, useReviews } from '../../components/admin/reviews';

const imageCache = new Map();

function useScanImage(id) {
  const [src, setSrc] = useState(() => (id ? imageCache.get(id) : null));
  const [state, setState] = useState('idle');
  useEffect(() => {
    if (!id) return undefined;
    if (imageCache.has(id)) {
      setSrc(imageCache.get(id));
      setState('ready');
      return undefined;
    }
    let alive = true;
    setSrc(null);
    setState('loading');
    getDoc(doc(db, 'diagnoses', id))
      .then((snap) => {
        const d = snap.data() || {};
        const raw = d.image_base64 || d.image_url || '';
        const url = !raw ? '' : raw.startsWith('http') || raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
        imageCache.set(id, url);
        if (alive) { setSrc(url); setState('ready'); }
      })
      .catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [id]);
  return { src, state };
}

/** Prefetch the next few photos so reviewing feels instant. */
function prefetch(ids) {
  ids.filter((id) => id && !imageCache.has(id)).slice(0, 3).forEach((id) => {
    getDoc(doc(db, 'diagnoses', id)).then((snap) => {
      const d = snap.data() || {};
      const raw = d.image_base64 || d.image_url || '';
      imageCache.set(id, !raw ? '' : raw.startsWith('http') || raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`);
    }).catch(() => {});
  });
}

const confTone = (c, low) => (c === null ? 'gray' : c < low ? 'red' : c < 85 ? 'amber' : 'green');

function ConfidenceBar({ value, low }) {
  const v = value ?? 0;
  const color = value === null ? '#9ca3af' : value < low ? '#B4432F' : value < 85 ? '#C89B3C' : '#1F4D3A';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-gray-500">ความมั่นใจของ AI</span>
        <span className="font-display text-2xl font-bold tabular-nums text-gray-950">{value === null ? '–' : `${v.toFixed(1)}%`}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, v)}%`, background: color }} />
        <div className="absolute -top-1 h-4 w-0.5 rounded bg-gray-400" style={{ left: `${low}%` }} title={`เกณฑ์ไม่มั่นใจ ${low}%`} />
      </div>
      <div className="mt-1 text-[11px] text-gray-400">เส้นเทา = เกณฑ์ “AI ไม่มั่นใจ” {low}%</div>
    </div>
  );
}

export default function ReviewQueue() {
  const { user } = useAuth();
  const { scans, loading, error } = useScans();
  const { reviews, error: reviewError } = useReviews();
  const { settings } = useSettings();
  const low = settings.review.lowConfidence;
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'todo';
  const filterAi = params.get('ai') || '';
  const filterLabel = params.get('label') || '';
  const [currentId, setCurrentId] = useState(params.get('id') || null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, showToast] = useToast();
  const [lastSaved, setLastSaved] = useState(null);
  const listRef = useRef(null);

  const r = useMemo(() => reviews || {}, [reviews]);
  const all = useMemo(() => scans || [], [scans]);
  const counts = useMemo(() => ({
    todo: all.filter((s) => !r[s.id]).length,
    low: all.filter((s) => !r[s.id] && s.confidence !== null && s.confidence < low).length,
    done: all.filter((s) => r[s.id]).length,
    wrong: all.filter((s) => r[s.id] && !r[s.id].correct).length,
  }), [all, r, low]);

  const list = useMemo(() => {
    let l = all;
    if (tab === 'todo') l = l.filter((s) => !r[s.id]);
    if (tab === 'low') l = l.filter((s) => !r[s.id] && s.confidence !== null && s.confidence < low).sort((a, b) => a.confidence - b.confidence);
    if (tab === 'done') l = l.filter((s) => r[s.id]).sort((a, b) => (r[b.id].at?.getTime() || Infinity) - (r[a.id].at?.getTime() || Infinity));
    if (tab === 'wrong') l = l.filter((s) => r[s.id] && !r[s.id].correct);
    if (filterAi) l = l.filter((s) => s.code === filterAi);
    if (filterLabel) l = l.filter((s) => r[s.id]?.label === filterLabel);
    return l;
  }, [all, r, tab, low, filterAi, filterLabel]);

  const current = all.find((s) => s.id === currentId) || null;
  const index = list.findIndex((s) => s.id === currentId);
  const review = current ? r[current.id] : null;
  const { src, state: imgState } = useScanImage(current?.id);

  // keep a valid selection
  useEffect(() => {
    if (!scans) return;
    if (!current || (index === -1 && !lastSaved)) setCurrentId(list[0]?.id || null);
  }, [scans, list, current, index, lastSaved]);
  useEffect(() => { setNote(review?.note || ''); }, [current?.id, review?.note]);
  useEffect(() => {
    if (index >= 0) prefetch(list.slice(index + 1, index + 4).map((s) => s.id));
    listRef.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, list]);

  const go = useCallback((delta) => {
    if (!list.length) return;
    const i = index === -1 ? 0 : Math.max(0, Math.min(list.length - 1, index + delta));
    setLastSaved(null);
    setCurrentId(list[i].id);
  }, [list, index]);

  const decide = useCallback(async (label) => {
    if (!current || saving) return;
    setSaving(true);
    const nextInQueue = tab === 'todo' || tab === 'low' ? list.filter((s) => s.id !== current.id)[Math.max(0, index)]?.id : list[index + 1]?.id;
    try {
      await saveReview(current, label, note, user);
      if (!review) logAudit(user, 'ตรวจทานผลวินิจฉัยของ AI', label === current.code ? 'info' : 'warning', `ผลสแกน ${current.id}: AI=${current.code} ผู้ตรวจ=${label}`);
      setLastSaved({ id: current.id, label });
      showToast(label === current.code ? 'บันทึก: AI ถูกต้อง' : `บันทึก: แก้เป็น ${labelName(label)}`);
      if (nextInQueue) setCurrentId(nextInQueue);
    } catch (e) {
      showToast(e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์บันทึก — ต้องอัปเดต Firestore rules ก่อน' : 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }, [current, saving, tab, list, index, note, user, review, showToast]);

  const undo = async () => {
    if (!lastSaved) return;
    try {
      await clearReview(lastSaved.id);
      setCurrentId(lastSaved.id);
      setLastSaved(null);
      showToast('ย้อนกลับแล้ว');
    } catch {
      showToast('ย้อนกลับไม่สำเร็จ', 'error');
    }
  };

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const hit = LABELS.find((l) => l.key === k);
      if (hit) { e.preventDefault(); decide(hit.code); }
      else if ((k === 'a' || k === 'enter') && current) { e.preventDefault(); decide(current.code); }
      else if (k === 'j' || k === 'arrowdown' || k === 'arrowright') { e.preventDefault(); go(1); }
      else if (k === 'k' || k === 'arrowup' || k === 'arrowleft') { e.preventDefault(); go(-1); }
      else if (k === 'z' && lastSaved) { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const setParam = (k, v) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); p.delete('id'); return p; }, { replace: true });
  const sessionAcc = counts.done ? (counts.done - counts.wrong) / counts.done : null;

  return (
    <div className="pb-10">
      {toast}
      <PageHeader
        icon={ClipboardCheck}
        eyebrow="Human-in-the-loop"
        title="ตรวจทานผล AI"
        desc="ยืนยันหรือแก้ไขผลวินิจฉัยของ AI ทีละภาพ ผลตรวจทานใช้คำนวณความแม่นยำจริงของโมเดลในหน้า “คุณภาพโมเดล AI” และใช้เป็นข้อมูลฝึกโมเดลรุ่นถัดไป"
        actions={(
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-emerald-900/10">
            <div>
              <div className="text-[11px] font-bold text-gray-500">ตรวจแล้ว</div>
              <div className="text-sm font-extrabold tabular-nums text-gray-950">{counts.done.toLocaleString()} / {all.length.toLocaleString()}</div>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <div className="text-[11px] font-bold text-gray-500">AI ถูกต้อง</div>
              <div className="text-sm font-extrabold tabular-nums text-[var(--color-paddy)]">{pct(sessionAcc)}</div>
            </div>
          </div>
        )}
      />
      <ErrorNote>{error || reviewError}</ErrorNote>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={(v) => setParam('tab', v === 'todo' ? '' : v)}
          options={[
            { value: 'todo', label: 'รอตรวจทาน', count: counts.todo },
            { value: 'low', label: 'AI ไม่มั่นใจ', count: counts.low },
            { value: 'done', label: 'ตรวจแล้ว', count: counts.done },
            { value: 'wrong', label: 'AI ทายผิด', count: counts.wrong },
          ]}
        />
        <select value={filterAi} onChange={(e) => setParam('ai', e.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:ring-4 focus:ring-emerald-100">
          <option value="">AI ทาย: ทุกคลาส</option>
          {MODEL_CLASSES.map((c) => <option key={c.code} value={c.code}>AI ทาย: {c.name}</option>)}
        </select>
        {(tab === 'done' || tab === 'wrong') && (
          <select value={filterLabel} onChange={(e) => setParam('label', e.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:ring-4 focus:ring-emerald-100">
            <option value="">ผลจริง: ทุกคลาส</option>
            {LABELS.map((c) => <option key={c.code} value={c.code}>ผลจริง: {c.name}</option>)}
          </select>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] font-bold text-gray-400 lg:inline-flex"><Keyboard size={13} />คีย์ลัด: <span className="rb-kbd">1</span>–<span className="rb-kbd">5</span> เลือกผลจริง · <span className="rb-kbd">A</span> AI ถูก · <span className="rb-kbd">J</span>/<span className="rb-kbd">K</span> เลื่อน · <span className="rb-kbd">Z</span> ย้อนกลับ</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Queue */}
        <div className="order-2 overflow-hidden rounded-[22px] border border-emerald-900/10 bg-white lg:order-1">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-xs font-bold text-gray-500">
            <span>{list.length.toLocaleString()} รายการ</span>
            {index >= 0 && <span className="tabular-nums">#{index + 1}</span>}
          </div>
          <div ref={listRef} className="max-h-[320px] overflow-y-auto lg:max-h-[calc(100vh-280px)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" />กำลังโหลด</div>
            ) : !list.length ? (
              <EmptyState icon={CheckCircle2} title="ไม่มีรายการในคิวนี้" desc="ตรวจทานครบแล้ว หรือลองเปลี่ยนตัวกรอง" />
            ) : (
              list.slice(0, 400).map((s) => {
                const rv = r[s.id];
                const on = s.id === currentId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-on={on}
                    onClick={() => { setLastSaved(null); setCurrentId(s.id); }}
                    className={`flex w-full items-center gap-3 border-b border-gray-50 px-4 py-2.5 text-left transition ${on ? 'bg-emerald-50/80 shadow-[inset_3px_0_0_var(--color-paddy)]' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${!rv ? 'bg-gray-300' : rv.correct ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-gray-900">{labelName(s.code)}{rv && !rv.correct && <span className="font-semibold text-red-600"> → {labelName(rv.label)}</span>}</span>
                      <span className="block truncate text-[11px] text-gray-500">{s.text || 'ไม่ระบุจังหวัด'} · {thaiDateTime(s.date)}</span>
                    </span>
                    <Pill tone={confTone(s.confidence, low)}>{s.confidence === null ? '–' : `${s.confidence.toFixed(0)}%`}</Pill>
                  </button>
                );
              })
            )}
            {list.length > 400 && <div className="px-4 py-3 text-center text-[11px] text-gray-400">แสดง 400 รายการแรก — ตรวจทานไปเรื่อย ๆ รายการจะเลื่อนขึ้นมาเอง</div>}
          </div>
        </div>

        {/* Workspace */}
        <div className="order-1 min-w-0 lg:order-2">
          {!current ? (
            <div className="rounded-[22px] border border-emerald-900/10 bg-white">
              <EmptyState icon={ScanSearch} title={loading ? 'กำลังโหลดผลสแกน…' : 'เลือกรายการจากคิว'} desc="รายการที่เลือกจะแสดงภาพ ผลของ AI และปุ่มยืนยันผลที่นี่" />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-[22px] bg-gray-950 sm:min-h-[420px]">
                {imgState === 'loading' && <Loader2 className="animate-spin text-white/50" />}
                {imgState === 'ready' && src && <img key={current.id} src={src} alt={`ภาพสแกน ${labelName(current.code)}`} className="rb-fade max-h-[70vh] w-full object-contain" />}
                {(imgState === 'error' || (imgState === 'ready' && !src)) && <div className="flex flex-col items-center gap-2 text-sm text-white/50"><ImageOff size={28} />ไม่มีภาพสำหรับผลสแกนนี้</div>}
                <div className="absolute left-3 top-3 flex gap-1.5">
                  {review ? <Pill tone={review.correct ? 'green' : 'red'} icon={review.correct ? Check : X}>{review.correct ? 'AI ถูกต้อง' : 'AI ทายผิด'}</Pill> : <Pill tone="gray">ยังไม่ตรวจ</Pill>}
                </div>
                <div className="absolute bottom-3 right-3 flex gap-1.5">
                  <button type="button" onClick={() => go(-1)} disabled={index <= 0} aria-label="ก่อนหน้า" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-gray-800 shadow disabled:opacity-40"><ChevronLeft size={18} /></button>
                  <button type="button" onClick={() => go(1)} disabled={index === -1 || index >= list.length - 1} aria-label="ถัดไป" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-gray-800 shadow disabled:opacity-40"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-[22px] border border-emerald-900/10 bg-white p-4">
                  <div className="text-xs font-bold text-gray-500">AI วินิจฉัยว่า</div>
                  <div className="mt-1 font-display text-2xl font-bold text-gray-950">{labelName(current.code)}</div>
                  <div className="mt-3"><ConfidenceBar value={current.confidence} low={low} /></div>
                  <dl className="mt-4 grid gap-1.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-400" />{current.text || 'ไม่ระบุจังหวัด'}</div>
                    <div className="text-gray-500">{thaiDateTime(current.date)} · <span className="font-mono">{current.id.slice(0, 10)}</span></div>
                  </dl>
                </div>

                <div className="rounded-[22px] border border-emerald-900/10 bg-white p-4">
                  <div className="mb-2.5 text-xs font-extrabold text-gray-700">ผลที่ถูกต้องคือ</div>
                  <div className="grid gap-1.5">
                    {LABELS.map((l) => {
                      const isAi = l.code === current.code;
                      const chosen = review?.label === l.code;
                      return (
                        <button
                          key={l.code}
                          type="button"
                          disabled={saving}
                          onClick={() => decide(l.code)}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-1 transition disabled:opacity-60 ${chosen ? 'bg-[var(--color-paddy)] text-white ring-[var(--color-paddy)]' : isAi ? 'bg-emerald-50 text-[var(--color-paddy)] ring-emerald-200 hover:bg-emerald-100' : 'bg-white text-gray-800 ring-gray-200 hover:bg-gray-50'}`}
                        >
                          <span className={`rb-kbd ${chosen ? '!bg-white/15 !text-white !shadow-none' : ''}`}>{l.key}</span>
                          <span className="min-w-0 flex-1">{l.name}</span>
                          {isAi && <span className={`text-[10px] font-extrabold ${chosen ? 'text-emerald-100' : 'text-emerald-700'}`}>AI ทาย</span>}
                          {chosen && <Check size={15} />}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="หมายเหตุ (ไม่บังคับ) เช่น ภาพเบลอ มีหลายโรคในใบเดียว"
                    className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn variant="primary" icon={Check} busy={saving} onClick={() => decide(current.code)} className="flex-1">AI ถูกต้อง</Btn>
                    {lastSaved && <Btn icon={Undo2} onClick={undo}>ย้อนกลับ</Btn>}
                    {review && !lastSaved && (
                      <Btn icon={RotateCcw} onClick={() => clearReview(current.id).then(() => showToast('ล้างผลตรวจแล้ว')).catch(() => showToast('ล้างไม่สำเร็จ', 'error'))}>ล้างผล</Btn>
                    )}
                  </div>
                  {review && (
                    <p className="mt-3 text-[11px] leading-5 text-gray-500">ตรวจโดย {review.reviewer_name || '–'} · {thaiDateTime(review.at)}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
