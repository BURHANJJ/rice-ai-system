// Free trial scanner: photo in, diagnosis out, all inside the browser (see lib/trialScan.js).
// 5 successful results per day per browser; unclear photos, "other disease" and errors are free.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BookOpenText, Camera, CheckCircle2, Clock3, Cpu, Download, Focus, Globe, HelpCircle,
  ImagePlus, Leaf, Lock, Maximize2, RefreshCw, ScanLine, ShieldCheck, Smartphone, Sparkles, Sun, Upload, UserRoundCheck, Wifi, X,
} from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { useDocTitle, useI18n } from '../lib/i18n';
import { classify, DAILY_LIMIT, LABELS, loadModel, msUntilReset, quota as readQuota, spend } from '../lib/trialScan';
import DISEASES from '../data/trialDiseases.json';
import khaoHom from '../../assets/khao_hom_scan.svg';

const NAMES = {
  BLAST: { th: 'โรคไหม้', en: 'Rice blast', sci: 'Magnaporthe oryzae', tone: 'danger' },
  BLB: { th: 'โรคขอบใบแห้ง', en: 'Bacterial leaf blight', sci: 'Xanthomonas oryzae pv. oryzae', tone: 'danger' },
  TUNGRO: { th: 'โรคใบสีส้ม', en: 'Rice tungro', sci: 'Rice tungro virus', tone: 'danger' },
  HEALTHY: { th: 'ใบปกติ', en: 'Healthy leaf', sci: '', tone: 'safe' },
  OTHER: { th: 'โรคอื่น', en: 'Other condition', sci: '', tone: 'info' },
};
const EN_SUMMARY = {
  BLAST: 'Eye-shaped lesions with dark brown edges and grey centres; spreads fast in humid weather. Reduce nitrogen, space plants, and follow your local extension officer on fungicides.',
  BLB: 'Water-soaked streaks from the leaf tip and edges turning yellow then dry. Spread by water, wind and wounds; drain fields and use resistant varieties.',
  TUNGRO: 'Yellow-orange leaves and stunted plants, carried by green leafhoppers. Remove infected plants and control the leafhopper early.',
  HEALTHY: 'No signs of the diseases the model knows. Keep checking the field regularly, especially after rain or humid spells.',
};

function useCountdown(active) {
  const [ms, setMs] = useState(() => msUntilReset());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setMs(msUntilReset()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

function QuotaMeter({ q, tr }) {
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white/80 p-4 shadow-sm backdrop-blur" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-800/80">{tr('สิทธิ์ทดลองวันนี้', 'Today’s free scans')}</div>
        <div className="text-sm font-extrabold tabular-nums text-emerald-950">{q.left}<span className="font-semibold text-slate-400"> / {q.limit}</span></div>
      </div>
      <div className="mt-2.5 flex gap-1.5" role="img" aria-label={tr(`เหลือ ${q.left} จาก ${q.limit} ครั้ง`, `${q.left} of ${q.limit} left`)}>
        {Array.from({ length: q.limit }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full transition-colors duration-500 ${i < q.left ? 'bg-gradient-to-r from-emerald-600 to-emerald-800' : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className="mt-2 text-[11.5px] leading-5 text-slate-500">{tr('นับเฉพาะครั้งที่ได้ผลวินิจฉัย ภาพไม่ชัดหรือสแกนไม่ได้ไม่เสียสิทธิ์', 'Only scans that return a result count. Unclear or failed scans are free.')}</p>
    </div>
  );
}

function ConfidenceRing({ value, tone, label }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = tone === 'safe' ? '#2d8a5b' : '#c0392b';
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e8efe9" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold tabular-nums text-slate-900">{value.toFixed(1)}%</span>
        <span className="text-[10px] font-semibold text-slate-500">{label}</span>
      </div>
    </div>
  );
}

/**
 * The scan workspace (photo on the left, state on the right), shared by the public trial page and
 * the portal scanner.
 *   quota        {left, limit} for the trial; null = unlimited (portal)
 *   onSuccess    called once per diagnosis (the trial spends one free scan here)
 *   onDiagnosis  async (result, file) => {state: 'saved'|'queued', id}: the portal saves it
 *   idleTop      extra content above "how it works" (the portal's GPS card)
 *   resultLinks  [{to, label, icon}] extra buttons under a result
 */
export function ScanWorkspace({ quota = null, onSuccess, onDiagnosis, idleTop = null, resultLinks = [], privacyNote, portal = false }) {
  const { lang } = useI18n();
  const isEn = lang === 'en';
  const tr = (th, en) => (isEn ? en : th);
  const q = quota || { left: Infinity, limit: Infinity };
  const latest = useRef({});
  latest.current = { quota, onSuccess, onDiagnosis };
  const [save, setSave] = useState(null); // portal: {state: 'saving'|'saved'|'queued'|'error', id?}
  const [lastFile, setLastFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | working | result | issue
  const [preview, setPreview] = useState('');
  const [download, setDownload] = useState(null); // model download progress 0..1, null when cached
  const [result, setResult] = useState(null);
  const [issue, setIssue] = useState(null); // unclear | other | bad_image | model
  const [drag, setDrag] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const panelRef = useRef(null);
  const answerRef = useRef(null);
  const out = quota ? quota.left <= 0 : false;
  // Narrow screens stack the answer under the photo: bring it into view once it's ready.
  useEffect(() => {
    if ((phase === 'result' || phase === 'issue') && window.innerWidth < 1024) {
      requestAnimationFrame(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [phase]);
  const countdown = useCountdown(out);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const persist = useCallback(async (r, file) => {
    const fn = latest.current.onDiagnosis;
    if (!fn) return;
    setSave({ state: 'saving' });
    try {
      setSave(await fn(r, file));
    } catch (e) {
      console.error('saving the diagnosis failed', e);
      setSave({ state: 'error' });
    }
  }, []);

  const warmUp = useCallback(() => { loadModel(setDownload).then(() => setDownload(null)).catch(() => {}); }, []);

  const run = useCallback(async (file) => {
    const lim = latest.current.quota;
    if (!file || (lim && lim.left <= 0)) return;
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setResult(null);
    setIssue(null);
    setSave(null);
    setLastFile(file);
    setPhase('working');
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    const started = performance.now();
    try {
      const r = await classify(file, setDownload);
      setDownload(null);
      // let the scan animation read as a deliberate step, not a flicker
      await new Promise((ok) => setTimeout(ok, Math.max(0, 1100 - (performance.now() - started))));
      if (r.status === 'ok') {
        latest.current.onSuccess?.();
        setResult(r);
        setPhase('result');
        persist(r, file);
      } else {
        setResult(r);
        setIssue(r.status);
        setPhase('issue');
      }
    } catch (e) {
      setDownload(null);
      setIssue(e.code === 'bad_image' ? 'bad_image' : 'model');
      setPhase('issue');
    }
  }, [persist]);

  const onFiles = (files) => { const f = files?.[0]; if (f) run(f); };
  // Back to the empty upload area: forget the photo too (the effect above frees its object URL).
  const reset = () => { setPreview(''); setPhase('idle'); setResult(null); setIssue(null); setSave(null); };
  const pickCamera = () => { warmUp(); cameraRef.current?.click(); };
  const pickGallery = () => { warmUp(); galleryRef.current?.click(); };

  // Paste a screenshot or copied photo straight onto the page (desktop convenience).
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f && phase !== 'working') run(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [phase, run]);

  const name = (code) => (isEn ? NAMES[code].en : NAMES[code].th);
  const busy = phase === 'working';

  return (
        <section ref={panelRef} className="scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-emerald-900/10 bg-white shadow-[0_30px_80px_-40px_rgba(15,45,31,.45)] lg:grid lg:grid-cols-[1.05fr_1fr]">
          {/* left: photo */}
          <div className="relative border-b border-emerald-900/10 bg-[radial-gradient(circle_at_30%_20%,#f1f6ee,#e6eee4)] p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
            {preview ? (
              <div className="relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
                <img src={preview} alt={tr('ภาพใบข้าวที่เลือก', 'Selected rice leaf')} className="h-full w-full object-cover" />
                {busy && (
                  <>
                    <div className="ts-scan-line pointer-events-none absolute inset-x-0 h-24" aria-hidden="true" />
                    <div className="absolute inset-0 border-[3px] border-emerald-400/70" aria-hidden="true" />
                  </>
                )}
                {!busy && (
                  <button type="button" onClick={reset} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60" aria-label={tr('ลบภาพ', 'Remove photo')}><X size={18} /></button>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); if (!out) setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); if (!out) { warmUp(); onFiles(e.dataTransfer.files); } }}
                onPointerEnter={warmUp}
                className={`relative mx-auto flex min-h-[25rem] w-full max-w-[460px] flex-col items-center justify-center overflow-hidden rounded-[1.4rem] px-6 py-12 text-center sm:aspect-square sm:min-h-0 sm:py-0 shadow-[inset_0_0_0_1px_rgba(31,77,58,.08)] transition ${drag ? 'bg-emerald-50 ring-4 ring-emerald-500/30' : 'bg-white/80'} ${out ? 'opacity-60' : ''}`}
              >
                {/* viewfinder corners, like the app's scan screen */}
                {['left-4 top-4 border-l-[3px] border-t-[3px] rounded-tl-xl', 'right-4 top-4 border-r-[3px] border-t-[3px] rounded-tr-xl', 'bottom-4 left-4 border-b-[3px] border-l-[3px] rounded-bl-xl', 'bottom-4 right-4 border-b-[3px] border-r-[3px] rounded-br-xl'].map((c) => (
                  <span key={c} aria-hidden="true" className={`absolute h-9 w-9 border-[#c9a24a] ${c}`} />
                ))}
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(52,168,108,.13),transparent_55%)]" />
                <div className="relative">
                  <span aria-hidden="true" className="ts-halo absolute inset-[-14px] rounded-full bg-emerald-400/15" />
                  <img src={khaoHom} alt="" className="relative h-24 w-24 object-contain drop-shadow-sm sm:h-28 sm:w-28" />
                </div>
                <p className="relative mt-4 text-[17px] font-bold text-slate-900">{out ? tr('ใช้สิทธิ์ทดลองวันนี้ครบแล้ว', 'Today’s free scans are used up') : tr('ถ่ายรูปหรือเลือกรูปใบข้าว', 'Take or choose a rice leaf photo')}</p>
                <p className="relative mt-1 text-xs leading-5 text-slate-500">{tr('ใบเดียว เต็มกรอบ เห็นรอยแผลชัด · JPG หรือ PNG', 'One leaf, filling the frame, lesions in focus · JPG or PNG')}</p>
                <div className="relative mt-5 flex w-full max-w-xs flex-col gap-2.5">
                  <button type="button" disabled={out} onClick={pickCamera} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1f4d3a] px-5 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(31,77,58,.8)] transition hover:bg-[#173d2e] disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"><Camera size={18} />{tr('ถ่ายรูปใบข้าว', 'Take a photo')}</button>
                  <button type="button" disabled={out} onClick={pickGallery} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-5 text-sm font-bold text-emerald-950 transition hover:border-emerald-700/40 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 sm:bg-[#1f4d3a] sm:text-white sm:hover:bg-[#173d2e]"><ImagePlus size={18} />{tr('เลือกรูปจากเครื่อง', 'Choose a photo')}</button>
                </div>
                <p className="relative mt-4 hidden items-center gap-1.5 text-[11.5px] text-slate-400 sm:flex"><Upload size={13} />{tr('หรือลากรูปมาวางตรงนี้', 'or drop a photo here')}<kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-slate-500">Ctrl</kbd>+<kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-slate-500">V</kbd></p>
              </div>
            )}
            <p className="mx-auto mt-4 flex max-w-[460px] items-start gap-2 text-[11.5px] leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" />{privacyNote || tr('ภาพไม่ถูกอัปโหลด AI วิเคราะห์ในเบราว์เซอร์ของคุณ และไม่บันทึกผลทดลองไว้ที่ใด', 'Your photo is not uploaded. The AI runs in your browser and trial results are not stored anywhere.')}</p>
          </div>

          {/* right: state */}
          <div ref={answerRef} className="flex min-h-[340px] scroll-mt-20 flex-col p-5 sm:p-7" aria-live="polite">
            {phase === 'idle' && !out && (
              <div className="my-auto">
                {idleTop}
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">{tr('3 ขั้นตอน · รู้ผลในไม่กี่วินาที', '3 steps · results in seconds')}</div>
                <h2 className="mt-1 font-display text-2xl font-bold text-slate-950">{tr('ทำงานยังไง', 'How it works')}</h2>
                <ol className="relative mt-5">
                  <span aria-hidden="true" className="absolute bottom-6 left-5 top-6 w-px bg-gradient-to-b from-emerald-300 via-emerald-200 to-transparent" />
                  {[
                    [Camera, tr('ถ่ายใบข้าวที่มีอาการ', 'Photograph a leaf with symptoms'), tr('ใกล้พอให้ใบเต็มกรอบ ในที่แสงสว่าง', 'Close enough to fill the frame, in good light')],
                    [Cpu, tr('AI วิเคราะห์ในเครื่องของคุณ', 'The AI runs on your device'), tr('EfficientNet-B0 ตัวเดียวกับในแอป · แม่นยำ 96.9% บนภาพทดสอบ', 'Same EfficientNet-B0 as the app · 96.9% on test images')],
                    [CheckCircle2, tr('ดูผลและคำแนะนำ', 'See the result and advice'), tr('ชื่อโรค ความมั่นใจ อาการ และวิธีจัดการตามกรมการข้าว', 'Disease, confidence, symptoms and Rice Department guidance')],
                  ].map(([Icon, t, d], i) => (
                    <li key={t} className="relative flex gap-4 pb-5 last:pb-0">
                      <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-800 shadow-[0_6px_16px_-8px_rgba(15,45,31,.45)] ring-1 ring-emerald-900/10"><Icon size={18} /></span>
                      <div className="pt-0.5">
                        <div className="flex items-center gap-2"><span className="text-[11px] font-bold tabular-nums text-emerald-700">0{i + 1}</span><span className="font-semibold text-slate-900">{t}</span></div>
                        <div className="mt-0.5 text-[13px] leading-5 text-slate-500">{d}</div>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{tr('AI ตรวจได้', 'What the AI checks')}</span>
                    <span className="text-[11px] text-slate-400">{tr('แบบอื่นจะบอกตรง ๆ ไม่เดา', 'Anything else is flagged, not guessed')}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    {[['BLAST', '#c0392b'], ['BLB', '#d4892a'], ['TUNGRO', '#e07b39'], ['HEALTHY', '#2d8a5b']].map(([c, color]) => (
                      <div key={c} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }} />
                        <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-slate-900">{name(c)}</span><span className="block truncate text-[10.5px] text-slate-400">{isEn ? NAMES[c].th : NAMES[c].en}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {phase === 'idle' && out && (
              <div className="my-auto text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Lock size={26} /></span>
                <h2 className="mt-4 text-xl font-bold text-slate-900">{tr('ใช้สิทธิ์ทดลองครบ 5 ครั้งแล้ว', 'You’ve used all 5 free scans')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{tr('สิทธิ์ใหม่จะกลับมาเที่ยงคืนนี้ (เวลาไทย)', 'New scans arrive at midnight (Thai time)')}</p>
                <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 font-mono text-2xl font-bold tabular-nums text-slate-900"><Clock3 size={20} className="text-slate-400" />{countdown}</div>
                <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-emerald-50/60 p-4 text-left">
                  <div className="flex items-center gap-2 font-bold text-emerald-950"><Smartphone size={18} />{tr('สแกนไม่จำกัดด้วยแอป Rice AI', 'Unlimited scans in the Rice AI app')}</div>
                  <p className="mt-1 text-[13px] leading-5 text-slate-600">{tr('ใช้ได้แม้ไม่มีอินเทอร์เน็ต บันทึกผลพร้อมพิกัด และดูประวัติย้อนหลัง', 'Works offline, saves results with GPS and keeps your history')}</p>
                  <Link to="/#app" className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f4d3a] px-4 text-sm font-bold text-white transition hover:bg-[#173d2e]"><Download size={16} />{tr('ดาวน์โหลดแอป (Android)', 'Get the app (Android)')}</Link>
                </div>
              </div>
            )}

            {phase === 'working' && (
              <div className="my-auto text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><ScanLine size={26} className="animate-pulse" /></span>
                <h2 className="mt-4 text-lg font-bold text-slate-900">{download != null && download < 1 ? tr('กำลังเตรียม AI ครั้งแรก', 'Preparing the AI (first time only)') : tr('AI กำลังวิเคราะห์ใบข้าว', 'Analysing the leaf')}</h2>
                <p className="mt-1 text-sm text-slate-500">{download != null && download < 1 ? tr('ดาวน์โหลดโมเดลประมาณ 8 MB ครั้งเดียว', 'One-time model download, about 8 MB') : tr('ใช้เวลาไม่กี่วินาที', 'This takes a few seconds')}</p>
                <div className="mx-auto mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                  {download != null && download < 1
                    ? <div className="h-full rounded-full bg-emerald-700 transition-[width] duration-200" style={{ width: `${Math.round(download * 100)}%` }} />
                    : <div className="ts-indeterminate h-full w-1/3 rounded-full bg-emerald-700" />}
                </div>
              </div>
            )}

            {phase === 'result' && result && (() => {
              const meta = NAMES[result.code];
              const info = DISEASES[result.code];
              const healthy = result.code === 'HEALTHY';
              return (
                <div className="ts-rise">
                  <div className="flex items-start gap-4">
                    <ConfidenceRing value={result.confidence} tone={meta.tone} label={tr('มั่นใจ', 'confident')} />
                    <div className="min-w-0">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${healthy ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{healthy ? <Leaf size={12} /> : <AlertTriangle size={12} />}{healthy ? tr('ไม่พบโรค', 'No disease found') : tr('พบอาการของโรค', 'Disease detected')}</span>
                      <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-slate-950">{name(result.code)}</h2>
                      {meta.sci && <div className="mt-0.5 text-[13px] italic text-slate-500">{meta.sci}</div>}
                    </div>
                  </div>

                  {isEn ? (
                    <p className="mt-5 text-sm leading-6 text-slate-700">{EN_SUMMARY[result.code]}</p>
                  ) : (
                    <dl className="mt-5 space-y-3.5 text-sm leading-6">
                      {info?.symptoms && <div><dt className="text-xs font-bold text-slate-500">อาการที่พบ</dt><dd className="text-slate-700">{info.symptoms}</dd></div>}
                      {!healthy && info?.cause && <div><dt className="text-xs font-bold text-slate-500">สาเหตุ</dt><dd className="text-slate-700">{info.cause}</dd></div>}
                      {info?.advice?.[0]?.treatment && <div><dt className="text-xs font-bold text-slate-500">{healthy ? 'คำแนะนำ' : 'วิธีจัดการ'}</dt><dd className="text-slate-700">{info.advice[0].treatment}</dd></div>}
                    </dl>
                  )}

                  <details className="group mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-2.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-600">{tr('ความน่าจะเป็นของแต่ละแบบ', 'Probability for each class')}<span className="transition group-open:rotate-180">▾</span></summary>
                    <ul className="mt-3 space-y-2">
                      {LABELS.map((code, i) => (
                        <li key={code} className="grid grid-cols-[96px_1fr_44px] items-center gap-2 text-xs">
                          <span className="truncate text-slate-600">{name(code)}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-slate-200"><span className={`block h-full rounded-full ${code === result.code ? 'bg-emerald-700' : 'bg-slate-400'}`} style={{ width: `${(result.probs[i] * 100).toFixed(1)}%` }} /></span>
                          <span className="text-right tabular-nums text-slate-500">{(result.probs[i] * 100).toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <p className="mt-4 text-[11.5px] leading-5 text-slate-500">{tr('ผลจาก AI เป็นการช่วยตัดสินใจเบื้องต้น ก่อนใช้สารเคมีควรปรึกษาเจ้าหน้าที่ส่งเสริมการเกษตรในพื้นที่', 'AI results support, not replace, expert advice. Check with your local extension officer before using chemicals.')}</p>
                  {portal && save && (
                    <div className={`mt-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${save.state === 'error' ? 'bg-red-50 text-red-800' : save.state === 'saving' ? 'bg-slate-50 text-slate-600' : 'bg-emerald-50 text-emerald-900'}`} aria-live="polite">
                      {save.state === 'saving' && <><RefreshCw size={15} className="animate-spin" />{tr('กำลังบันทึกผลเข้าระบบ…', 'Saving to the system…')}</>}
                      {save.state === 'saved' && <><CheckCircle2 size={15} />{tr('บันทึกเข้าระบบแล้ว', 'Saved to the system')}<span className="ml-auto font-mono text-[11px] font-normal text-emerald-800/70">#{save.id?.slice(0, 8)}</span></>}
                      {save.state === 'queued' && <><Clock3 size={15} />{tr('รอเชื่อมต่อ จะส่งเข้าระบบเองเมื่อออนไลน์ (อย่าเพิ่งปิดหน้านี้)', 'Waiting for a connection; it will sync once online (keep this page open)')}</>}
                      {save.state === 'error' && <><AlertTriangle size={15} />{tr('บันทึกไม่สำเร็จ', 'Couldn’t save')}<button type="button" onClick={() => persist(result, lastFile)} className="ml-auto rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-red-800 ring-1 ring-red-200 hover:bg-red-100">{tr('ลองบันทึกอีกครั้ง', 'Try again')}</button></>}
                    </div>
                  )}
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    <button type="button" onClick={q.left > 0 ? pickGallery : reset} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f4d3a] px-4 text-sm font-bold text-white transition hover:bg-[#173d2e]"><RefreshCw size={16} />{!quota ? tr('สแกนภาพถัดไป', 'Scan the next photo') : q.left > 0 ? tr(`สแกนภาพอื่น (เหลือ ${q.left})`, `Scan another (${q.left} left)`) : tr('ดูสิทธิ์ที่เหลือ', 'See allowance')}</button>
                    <Link to="/rice-diseases" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"><BookOpenText size={16} />{tr('ข้อมูลโรคเต็ม', 'Full disease guide')}</Link>
                    {resultLinks.map(({ to, label, icon: LinkIcon }) => (
                      <Link key={to} to={to} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 sm:col-span-2">{LinkIcon && <LinkIcon size={16} />}{label}<ArrowRight size={15} /></Link>
                    ))}
                  </div>
                  {!portal && (
                    <Link to="/#app" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-900/20 px-4 py-3 text-[13px] text-slate-600 transition hover:border-emerald-700/40 hover:bg-emerald-50/50">
                      <span className="flex items-center gap-2"><Smartphone size={16} className="text-emerald-800" />{tr('อยากบันทึกผลพร้อมพิกัด? ใช้แอป Rice AI', 'Want to save results with GPS? Use the app')}</span><ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              );
            })()}

            {phase === 'issue' && (
              <div className="ts-rise my-auto">
                {(() => {
                  const kinds = {
                    unclear: {
                      icon: HelpCircle, ring: 'bg-amber-50 text-amber-700', tag: tr('ภาพยังไม่ชัดพอ', 'Photo not clear enough'),
                      title: tr('ขอภาพใหม่อีกครั้งนะครับ', 'Let’s try another photo'),
                      body: tr(`AI มั่นใจเพียง ${result?.confidence ?? 0}% ต่ำกว่าเกณฑ์ 60% จึงไม่เดาผล เพื่อไม่ให้ได้คำแนะนำที่ผิด`, `The AI is only ${result?.confidence ?? 0}% sure, below the 60% bar, so it won’t guess.`),
                      tips: [[Maximize2, tr('ใบเต็มกรอบ', 'Fill the frame'), tr('เห็นรอยแผลชัด ห่างราวหนึ่งคืบ', 'Lesions visible, about a hand-span away')], [Sun, tr('แสงสว่างพอ', 'Good light'), tr('ไม่ย้อนแสง ไม่มีเงาบังแผล', 'No backlight or shadow on the lesion')], [Focus, tr('ภาพคมชัด', 'Sharp photo'), tr('ถือนิ่ง แตะจอตรงแผลให้โฟกัส', 'Hold still, tap the lesion to focus')], [Leaf, tr('ทีละใบ', 'One leaf'), tr('ไม่มีมือหรือสิ่งอื่นในภาพมาก', 'Little else in the frame')]],
                    },
                    other: {
                      icon: AlertTriangle, ring: 'bg-sky-50 text-sky-700', tag: tr('นอกขอบเขตของ AI', 'Outside what the AI covers'),
                      title: tr('อาจเป็นโรคที่ยังไม่รองรับ', 'Possibly a condition we don’t cover yet'),
                      body: tr('ลักษณะในภาพไม่ตรงกับ 4 แบบที่ AI ตรวจได้ อาจเป็นใบจุดสีน้ำตาล ราน้ำค้าง หรือแมลงทำลาย ระบบจึงไม่ให้ชื่อโรคที่อาจผิด', 'The photo doesn’t match the 4 cases the AI knows; it may be brown spot, downy mildew or insect damage, so no name is given.'),
                      tips: [[BookOpenText, tr('เทียบในคลังความรู้', 'Check the library'), tr('22 โรคจากกรมการข้าว พร้อมรูป', '22 diseases with photos')], [RefreshCw, tr('ลองใบอื่น', 'Try another leaf'), tr('เลือกใบที่เห็นอาการชัดกว่า', 'One with clearer symptoms')], [UserRoundCheck, tr('ถามผู้เชี่ยวชาญ', 'Ask an expert'), tr('ถ้าลุกลาม ติดต่อเกษตรอำเภอ', 'If it spreads, call your extension office')]],
                    },
                    bad_image: {
                      icon: ImagePlus, ring: 'bg-amber-50 text-amber-700', tag: tr('อ่านไฟล์ไม่ได้', 'Can’t read this file'),
                      title: tr('เปิดภาพนี้ไม่ได้', 'This image can’t be opened'),
                      body: tr('ไฟล์อาจเสียหรือเป็นรูปแบบที่เบราว์เซอร์ไม่รองรับ ลองถ่ายใหม่หรือเลือกไฟล์ JPG/PNG', 'The file may be damaged or in a format the browser can’t read. Try a JPG or PNG.'),
                      tips: [],
                    },
                    model: {
                      icon: Cpu, ring: 'bg-red-50 text-red-700', tag: tr('โหลด AI ไม่สำเร็จ', 'AI failed to load'),
                      title: tr('เตรียม AI ไม่สำเร็จ', 'Couldn’t start the AI'),
                      body: tr('อาจเป็นเพราะอินเทอร์เน็ตขาดระหว่างดาวน์โหลด หรือเบราว์เซอร์รุ่นเก่า ภาพของคุณยังอยู่ ลองอีกครั้งได้', 'The download may have been interrupted or the browser is too old. Your photo is still here; try again.'),
                      tips: [[Wifi, tr('ตรวจอินเทอร์เน็ต', 'Check your connection'), tr('ครั้งแรกต้องโหลด AI ราว 8 MB', 'First run downloads about 8 MB')], [Globe, tr('อัปเดตเบราว์เซอร์', 'Update your browser'), tr('Chrome, Edge หรือ Safari รุ่นล่าสุด', 'Latest Chrome, Edge or Safari')]],
                    },
                  };
                  const k = kinds[issue] || kinds.model;
                  const Icon = k.icon;
                  const conf = result?.confidence ?? 0;
                  return (
                    <div className="my-auto">
                      <div className="flex items-center gap-3.5">
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${k.ring}`}><Icon size={24} /></span>
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{k.tag}</span>
                          <h2 className="mt-0.5 text-xl font-bold leading-snug text-slate-950 sm:text-[22px]">{k.title}</h2>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{k.body}</p>

                      {issue === 'unclear' && (
                        <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4">
                          <div className="flex items-baseline justify-between text-xs font-semibold text-slate-600">
                            <span>{tr('ความมั่นใจของ AI', 'AI confidence')}</span>
                            <span className="text-base font-extrabold tabular-nums text-amber-700">{conf.toFixed(1)}%</span>
                          </div>
                          <div className="relative mt-2.5 h-2.5 rounded-full bg-white ring-1 ring-amber-200/70">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-700" style={{ width: `${Math.min(100, conf)}%` }} />
                            <div className="absolute -top-1 bottom-[-4px] left-[60%] w-0.5 rounded bg-emerald-800" aria-hidden="true" />
                          </div>
                          <div className="relative mt-1.5 h-4 text-[10.5px] font-semibold text-emerald-800"><span className="absolute left-[60%] -translate-x-1/2 whitespace-nowrap">{tr('เกณฑ์ 60%', '60% bar')}</span></div>
                        </div>
                      )}

                      {issue === 'other' && (
                        <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-3.5">
                          <div className="text-[11.5px] font-bold text-slate-500">{tr('AI ตรวจได้ตอนนี้', 'What the AI covers today')}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">{['BLAST', 'BLB', 'TUNGRO', 'HEALTHY'].map((c) => <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 ring-1 ring-sky-100">{name(c)}</span>)}</div>
                        </div>
                      )}

                      {k.tips.length > 0 && (
                        <>
                          <div className="mt-5 text-xs font-bold text-slate-900">{issue === 'unclear' ? tr('ถ่ายใหม่ให้ได้ผลแม่น', 'For a sharper result') : tr('ขั้นต่อไป', 'What to do next')}</div>
                          <ul className={`mt-2.5 grid gap-2 ${k.tips.length === 3 ? 'sm:grid-cols-3' : 'grid-cols-2'}`}>
                            {k.tips.map(([TipIcon, t, d]) => (
                              <li key={t} className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-col sm:gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-900/5"><TipIcon size={16} /></span>
                                <span className="min-w-0"><span className="block text-[13px] font-bold leading-5 text-slate-900">{t}</span><span className="block text-[11.5px] leading-[1.15rem] text-slate-500">{d}</span></span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                        <button type="button" onClick={pickCamera} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1f4d3a] px-4 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(31,77,58,.8)] transition hover:bg-[#173d2e] sm:hidden"><Camera size={17} />{tr('ถ่ายภาพใหม่', 'Retake photo')}</button>
                        <button type="button" onClick={pickGallery} className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 sm:border-transparent sm:bg-[#1f4d3a] sm:text-white sm:shadow-[0_10px_24px_-12px_rgba(31,77,58,.8)] sm:hover:bg-[#173d2e] ${issue === 'other' ? '' : 'sm:col-span-2'}`}><ImagePlus size={17} />{tr('เลือกภาพใหม่', 'Choose another photo')}</button>
                        {issue === 'other' && <Link to="/rice-diseases" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"><BookOpenText size={17} />{tr('เปิดคลังความรู้โรคข้าว', 'Open the disease library')}</Link>}
                      </div>
                      <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-slate-500"><CheckCircle2 size={14} className="text-emerald-700" />{quota ? tr(`ครั้งนี้ไม่นับสิทธิ์ · เหลือ ${q.left} จาก ${q.limit} ครั้งวันนี้`, `Not counted · ${q.left} of ${q.limit} left today`) : tr('ผลครั้งนี้ไม่ถูกบันทึกเข้าระบบ', 'Nothing was saved for this attempt')}</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </section>
  );
}

export default function TryScan() {
  const { lang } = useI18n();
  const isEn = lang === 'en';
  const tr = (th, en) => (isEn ? en : th);
  useDocTitle({ th: 'ทดลองสแกนโรคใบข้าวฟรี | Rice AI', en: 'Try the rice leaf scanner | Rice AI' });
  const [q, setQ] = useState(readQuota);
  // A new day may start while the page is open.
  useEffect(() => {
    const t = setInterval(() => setQ(readQuota()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8f1] text-slate-900">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-12">
        <div className="grid items-end gap-5 lg:grid-cols-[1fr_340px] lg:gap-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900"><Sparkles size={14} />{tr('ทดลองฟรี · ไม่ต้องสมัครสมาชิก', 'Free trial · no sign-up')}</div>
            <h1 className="mt-4 font-display text-[2rem] font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">{tr('ทดลองสแกนโรคใบข้าว', 'Try the rice leaf scanner')}</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600 sm:text-base">{tr('ถ่ายหรือเลือกรูปใบข้าว แล้ว AI ตัวเดียวกับในแอปจะบอกผลภายในไม่กี่วินาที แยกโรคไหม้ โรคขอบใบแห้ง โรคใบสีส้ม และใบปกติ', 'Take or choose a photo of a rice leaf. The same AI as the app tells you within seconds: rice blast, bacterial leaf blight, tungro or healthy.')}</p>
          </div>
          <QuotaMeter q={q} tr={tr} />
        </div>

        <div className="mt-7">
          <ScanWorkspace quota={q} onSuccess={() => setQ(spend())} />
        </div>

        {/* reassurance strip */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            [ShieldCheck, tr('เป็นส่วนตัว', 'Private'), tr('ภาพไม่ออกจากเครื่องของคุณ', 'Photos never leave your device')],
            [Cpu, tr('AI ตัวเดียวกับในแอป', 'Same AI as the app'), tr('EfficientNet-B0 · แม่นยำ 96.9% บนภาพทดสอบ 761 ภาพ', 'EfficientNet-B0 · 96.9% on 761 test images')],
            [Smartphone, tr('ใช้ต่อในแอปได้ไม่จำกัด', 'Unlimited in the app'), tr('บันทึกผล พิกัด และใช้แบบออฟไลน์', 'Save results, GPS, and work offline')],
          ].map(([Icon, t, d]) => (
            <div key={t} className="flex items-start gap-3 rounded-2xl border border-emerald-900/10 bg-white/70 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={17} /></span>
              <div><div className="text-sm font-bold text-slate-900">{t}</div><div className="mt-0.5 text-[12.5px] leading-5 text-slate-500">{d}</div></div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">{tr(`ทดลองได้ ${DAILY_LIMIT} ครั้งต่อวันต่อเครื่อง`, `${DAILY_LIMIT} free scans per day per device`)} · <Link to="/research-study" className="font-semibold text-emerald-800 hover:underline">{tr('ดูวิธีพัฒนาและทดสอบ AI', 'How the AI was built and tested')}</Link></p>
      </main>
      <PublicFooter />
    </div>
  );
}
