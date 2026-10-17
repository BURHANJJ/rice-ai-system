// Model-comparison blocks for /research-study. All numbers come from src/data/modelComparison.json,
// written by ai-service/model-comparison/export_web.py, so the page never drifts from the measured results.
import { useEffect, useMemo, useState } from 'react';
import data from '../../data/modelComparison.json';

export { data };

const GREEN = '#1f4d3a';
const GRAY = '#94a3a0';
const CLASS_TH = { BLAST: ['โรคไหม้', 'Rice blast'], BLB: ['โรคขอบใบแห้ง', 'Bacterial leaf blight'], TUNGRO: ['โรคใบสีส้ม', 'Rice tungro'], HEALTHY: ['ใบปกติ', 'Healthy leaf'] };

export const pct = (v, d = 2) => `${(v * 100).toFixed(d)}%`;
export const pm = (v, d = 2) => `${(v.mean * 100).toFixed(d)} ± ${(v.sd * 100).toFixed(d)}`;
export const mainModel = () => data.models.find((m) => m.role === 'main');
// Ties on accuracy (same number of correct images) fall back to macro F1.
export const byAccuracy = () => [...data.models].sort((a, b) => (b.accuracy.mean - a.accuracy.mean) || (b.macroF1.mean - a.macroF1.mean));

// What each architecture is and why it is in the study, in plain words.
export const ABOUT = {
  efficientnet_b0: {
    th: ['ขยายความกว้าง ความลึก และขนาดภาพของเครือข่ายไปพร้อมกันอย่างสมดุล จึงแม่นโดยใช้พารามิเตอร์น้อย', 'โมเดลหลักของ Rice AI เทรนซ้ำที่นี่ภายใต้เงื่อนไขเดียวกับตัวอื่น'],
    en: ['Scales width, depth and resolution together, reaching high accuracy with few parameters.', 'The architecture Rice AI runs, retrained here under the same conditions as the others.'],
  },
  mobilenet_v3_large: {
    th: ['ออกแบบมาให้รันเร็วบน CPU ของมือถือ ใช้ depthwise convolution และโครงสร้างที่หาด้วย NAS', 'คู่แข่งโดยตรงของงานที่รันบนเครื่องผู้ใช้'],
    en: ['Built for fast inference on phone CPUs using depthwise convolutions and an NAS-searched layout.', 'The direct rival for on-device use.'],
  },
  densenet121: {
    th: ['ทุกชั้นรับข้อมูลจากทุกชั้นก่อนหน้า จึงใช้ลักษณะเด่นซ้ำได้มาก', 'นิยมในงานโรคพืชและภาพการแพทย์'],
    en: ['Each layer receives the outputs of all earlier layers, so features are reused heavily.', 'Popular for plant-disease and medical images.'],
  },
  vgg16: {
    th: ['CNN แบบดั้งเดิม ซ้อน convolution 3×3 ลึก 16 ชั้น ไม่มี BatchNorm', 'baseline รุ่นเก่าที่งานวิจัยส่วนใหญ่อ้างอิง'],
    en: ['A classic CNN of stacked 3×3 convolutions, 16 layers deep, without BatchNorm.', 'The legacy baseline most papers cite.'],
  },
  resnet50: {
    th: ['ใช้ทางลัดข้ามชั้น (residual) ทำให้เทรนเครือข่าย 50 ชั้นได้', 'baseline มาตรฐานของงานจำแนกภาพ'],
    en: ['Residual shortcuts make a 50-layer network trainable.', 'The standard image-classification baseline.'],
  },
  convnext_tiny: {
    th: ['CNN สมัยใหม่ที่ยืมแนวคิดจาก Vision Transformer เช่น kernel 7×7 และ LayerNorm', 'ตัวแทนโมเดลใหม่และใหญ่ ใช้ดูว่าใหญ่ขึ้นแล้วแม่นขึ้นจริงไหม'],
    en: ['A modern CNN borrowing Vision Transformer ideas such as 7×7 kernels and LayerNorm.', 'A newer, larger model: does bigger buy accuracy here?'],
  },
};

export function ModelCards({ tr, t }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {data.models.map((m) => {
      const [what, why] = t(ABOUT[m.key]);
      const main = m.role === 'main';
      return <article key={m.key} className={`flex flex-col rounded-2xl border bg-white p-5 ${main ? 'border-emerald-900/25 shadow-[0_10px_28px_rgba(31,77,58,.10)]' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div><h4 className="text-base font-bold text-slate-900">{m.name}</h4><div className="mt-0.5 text-[11px] text-slate-500">{m.paper}</div></div>
          {main && <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ backgroundColor: GREEN }}>{tr('โมเดลหลัก', 'Main')}</span>}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{what}</p>
        <p className="mt-2 text-xs leading-5 text-emerald-900/80"><strong>{tr('เหตุผลที่เลือก:', 'Why it is here:')}</strong> {why}</p>
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
          {[[tr('พารามิเตอร์', 'Params'), `${(m.params / 1e6).toFixed(1)}M`], ['GFLOPs', m.gflops.toFixed(1)], [tr('บนมือถือ', 'On phone'), `${m.tfliteMb.toFixed(1)} MB`]].map(([k, v]) => <div key={k}><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">{v}</dd></div>)}
        </dl>
      </article>;
    })}
  </div>;
}

export function Leaderboard({ tr }) {
  const rows = byAccuracy();
  const best = rows[0].accuracy.mean;
  const th = 'px-3 py-3 text-right font-bold whitespace-nowrap';
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
      <h3 className="font-bold text-slate-900">{tr('ตารางผลรวม · เรียงตาม Accuracy', 'Summary table · sorted by accuracy')}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{tr('อันดับที่มีเครื่องหมาย = คือทายถูกจำนวนภาพรวมเท่ากัน · ', 'A rank marked = means the same total number of correct images · ')}{tr(`ค่าเฉลี่ย ± ส่วนเบี่ยงเบนมาตรฐานจาก ${data.seeds.length} seed บนภาพทดสอบ ${data.testSize} ภาพชุดเดียวกัน · ขนาดและเวลาวัดจากไฟล์ TFLite Float16 แบบที่แอปใช้ บน CPU โน้ตบุ๊ก 4 threads`, `Mean ± standard deviation over ${data.seeds.length} seeds on the same ${data.testSize} test images · size and latency are for the TFLite Float16 file the app uses, on a laptop CPU with 4 threads`)}</p>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[860px] border-collapse text-left text-sm">
      <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
        <th className="px-4 py-3 font-bold">#</th><th className="px-3 py-3 font-bold">{tr('โมเดล', 'Model')}</th>
        <th className={th}>Accuracy (%)</th><th className={th}>Macro F₁ (%)</th><th className={th}>AUC</th>
        <th className={th}>{tr('พารามิเตอร์', 'Params')}</th><th className={th}>GFLOPs</th><th className={th}>{tr('ไฟล์มือถือ', 'Phone file')}</th><th className={`${th} pr-4`}>{tr('เวลา/ภาพ', 'Time/image')}</th>
      </tr></thead>
      <tbody>{rows.map((m) => {
        const main = m.role === 'main';
        // Same number of correct images = same rank, shown as "1=".
        const rank = rows.findIndex((x) => Math.abs(x.accuracy.mean - m.accuracy.mean) < 1e-9) + 1;
        const shared = rows.filter((x) => Math.abs(x.accuracy.mean - m.accuracy.mean) < 1e-9).length > 1;
        return <tr key={m.key} className={`border-t border-slate-100 ${main ? 'bg-[#f2f5ed]' : ''}`}>
          <td className="px-4 py-3 tabular-nums text-slate-500">{rank}{shared ? '=' : ''}</td>
          <td className="px-3 py-3"><span className={`font-bold ${main ? 'text-emerald-950' : 'text-slate-900'}`}>{m.name}</span>{main && <span className="ml-2 rounded-full bg-emerald-900 px-2 py-0.5 text-[10px] font-bold text-white">{tr('ใช้ในระบบ', 'In Rice AI')}</span>}<div className="text-[11px] text-slate-500">{m.year}</div></td>
          <td className="px-3 py-3 text-right tabular-nums"><span className={`font-bold ${m.accuracy.mean === best ? 'text-emerald-900' : 'text-slate-800'}`}>{pm(m.accuracy)}</span></td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{pm(m.macroF1)}</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{m.auc.mean.toFixed(4)}</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{(m.params / 1e6).toFixed(1)}M</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{m.gflops.toFixed(2)}</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{m.tfliteMb.toFixed(1)} MB</td>
          <td className="px-3 py-3 pr-4 text-right tabular-nums text-slate-700">{m.tfliteMs.toFixed(1)} ms</td>
        </tr>;
      })}</tbody>
    </table></div>
  </div>;
}

// Accuracy against a cost axis the reader picks. Log x because the models span 10x in size and compute.
const AXES = {
  size: { key: 'tfliteMb', th: 'ขนาดไฟล์บนมือถือ (MB)', en: 'Phone file size (MB)', fmt: (v) => `${v.toFixed(1)} MB` },
  time: { key: 'tfliteMs', th: 'เวลาต่อภาพบน CPU (ms)', en: 'CPU time per image (ms)', fmt: (v) => `${v.toFixed(1)} ms` },
  flops: { key: 'gflops', th: 'การคำนวณต่อภาพ (GFLOPs)', en: 'Compute per image (GFLOPs)', fmt: (v) => `${v.toFixed(2)} GFLOPs` },
};

function useNarrow() {
  const query = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export function TradeoffChart({ tr, t }) {
  const [axis, setAxis] = useState('size');
  const [hover, setHover] = useState(null);
  const A = AXES[axis];
  const narrow = useNarrow();
  // A narrower drawing on phones keeps the 13px labels readable after the SVG is scaled down.
  const W = narrow ? 440 : 720, H = narrow ? 420 : 380, L = 56, R = narrow ? 12 : 24, T = 20, B = 52;
  const xs = data.models.map((m) => m[A.key]);
  const lo = Math.log10(Math.min(...xs) * 0.7), hi = Math.log10(Math.max(...xs) * 1.4);
  const ys = data.models.flatMap((m) => [m.accuracy.mean - m.accuracy.sd, m.accuracy.mean + m.accuracy.sd]);
  const yLo = Math.floor(Math.min(...ys) * 100 - 1), yHi = Math.min(100, Math.ceil(Math.max(...ys) * 100 + 0.5));
  const X = (v) => L + ((Math.log10(v) - lo) / (hi - lo)) * (W - L - R);
  const Y = (v) => T + (1 - (v * 100 - yLo) / (yHi - yLo)) * (H - T - B);
  const xTicks = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].filter((v) => Math.log10(v) >= lo && Math.log10(v) <= hi);
  const yStep = yHi - yLo > 12 ? 5 : yHi - yLo > 5 ? 2 : 1;
  const yTicks = []; for (let v = Math.ceil(yLo / yStep) * yStep; v <= yHi; v += yStep) yTicks.push(v);
  const h = hover && data.models.find((m) => m.key === hover);

  return <figure className="rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <figcaption><div className="text-sm font-bold text-slate-800">{tr('ความแม่นยำเทียบกับต้นทุน', 'Accuracy against cost')}</div><div className="text-xs text-slate-500">{tr('มุมซ้ายบนดีที่สุด: แม่นและเบา', 'Top-left is best: accurate and light')}</div></figcaption>
      <div role="tablist" aria-label={tr('เลือกแกนนอน', 'Choose x axis')} className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
        {Object.keys(AXES).map((k) => <button key={k} role="tab" aria-selected={axis === k} onClick={() => setAxis(k)} className={`rounded-lg px-3 py-1.5 transition ${axis === k ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{t({ th: { size: 'ขนาด', time: 'ความเร็ว', flops: 'การคำนวณ' }[k], en: { size: 'Size', time: 'Speed', flops: 'Compute' }[k] })}</button>)}
      </div>
    </div>
    <div className="relative px-2 pb-2 pt-3 sm:px-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tr('กราฟกระจายความแม่นยำกับต้นทุนของแต่ละโมเดล', 'Scatter of accuracy against cost per model')} onMouseLeave={() => setHover(null)}>
        {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v / 100)} y2={Y(v / 100)} stroke="#e8ece9" /><text x={L - 8} y={Y(v / 100) + 4} textAnchor="end" fontSize="12" fill="#64748b">{v}%</text></g>)}
        {xTicks.map((v) => <g key={v}><line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="#f1f4f2" /><text x={X(v)} y={H - B + 18} textAnchor="middle" fontSize="12" fill="#64748b">{v}</text></g>)}
        <text x={(L + W - R) / 2} y={H - 10} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#475569">{t(A)} · {tr('สเกล log', 'log scale')}</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#475569" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>{tr('Accuracy ชุดทดสอบ', 'Test accuracy')}</text>
        {data.models.map((m) => {
          const x = X(m[A.key]), y = Y(m.accuracy.mean), main = m.role === 'main', c = main ? GREEN : GRAY;
          return <g key={m.key} onMouseEnter={() => setHover(m.key)} onFocus={() => setHover(m.key)} onBlur={() => setHover(null)} tabIndex={0} className="cursor-pointer outline-none">
            <line x1={x} x2={x} y1={Y(m.accuracy.mean - m.accuracy.sd)} y2={Y(m.accuracy.mean + m.accuracy.sd)} stroke={c} strokeWidth="2" strokeLinecap="round" />
            <circle cx={x} cy={y} r={hover === m.key ? 10 : main ? 9 : 7} fill={c} stroke="#fff" strokeWidth="2" />
            <circle cx={x} cy={y} r="22" fill="transparent" />
          </g>;
        })}
        {/* Labels in a second pass so no error bar is painted over another model's name. */}
        <g pointerEvents="none">{data.models.map((m) => {
          const x = X(m[A.key]), y = Y(m.accuracy.mean), main = m.role === 'main';
          const span = m.name.length * 7.6 + 16;
          // Flip the label to the left when it would run off the plot or across another model's mark or ± bar.
          const blocked = (dir) => data.models.some((o) => {
            if (o.key === m.key) return false;
            const ox = X(o[A.key]);
            const inX = dir > 0 ? ox > x + 6 && ox < x + span : ox < x - 6 && ox > x - span;
            return inX && Y(o.accuracy.mean + o.accuracy.sd) - 8 < y + 6 && Y(o.accuracy.mean - o.accuracy.sd) + 8 > y - 8;
          });
          const right = x + span < W - R && !blocked(1) ? true : x - span > L && !blocked(-1) ? false : x + span < W - R;
          return <text key={m.key} x={right ? x + 14 : x - 14} y={y + 4} textAnchor={right ? 'start' : 'end'} fontSize="13" fontWeight={main ? 700 : 500} fill={main ? '#123326' : '#334155'} stroke="#fff" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">{m.name}</text>;
        })}</g>
      </svg>
      {h && <div className="pointer-events-none absolute left-1/2 top-3 w-60 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur sm:left-auto sm:right-5 sm:translate-x-0">
        <div className="font-bold text-slate-900">{h.name}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
          <span>Accuracy</span><span className="text-right font-semibold tabular-nums text-slate-900">{pm(h.accuracy)}%</span>
          <span>Macro F₁</span><span className="text-right tabular-nums">{pm(h.macroF1)}%</span>
          <span>{t(A)}</span><span className="text-right tabular-nums">{A.fmt(h[A.key])}</span>
        </div>
      </div>}
      <div className="flex flex-wrap items-center gap-4 px-3 pb-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: GREEN }} />{tr('โมเดลหลัก (EfficientNet-B0)', 'Main model (EfficientNet-B0)')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: GRAY }} />{tr('โมเดลเปรียบเทียบ', 'Comparison models')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-slate-400" />{tr('เส้นตั้ง = ± SD ของ 3 seed', 'Vertical bar = ± SD over 3 seeds')}</span>
      </div>
    </div>
  </figure>;
}

export function PerClassHeatmap({ tr, t }) {
  const rows = byAccuracy();
  const all = rows.flatMap((m) => data.classes.map((c) => m.perClassF1[c].mean));
  const min = Math.min(...all);
  const shade = (v) => {
    const k = Math.max(0, Math.min(1, (v - min) / (1 - min || 1)));
    return { backgroundColor: `rgba(31,77,58,${0.08 + k * 0.82})`, color: k > 0.55 ? '#fff' : '#1c2620' };
  };
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="font-bold text-slate-900">{tr('F₁ รายโรค (%)', 'Per-class F₁ (%)')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{tr('สีเข้มคือแม่นกว่า · เฉลี่ย 3 seed · ช่วยดูว่าโมเดลไหนอ่อนกับโรคไหน', 'Darker is better · mean of 3 seeds · shows which model struggles with which disease')}</p></div>
    <div className="overflow-x-auto p-3 sm:p-4"><table className="w-full min-w-[440px] border-separate border-spacing-1 text-sm">
      <thead><tr><th className="px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{tr('โมเดล', 'Model')}</th>
        {data.classes.map((c) => <th key={c} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">{c}<div className="font-medium normal-case tracking-normal text-slate-400">{t({ th: CLASS_TH[c][0], en: CLASS_TH[c][1] })}</div></th>)}</tr></thead>
      <tbody>{rows.map((m) => <tr key={m.key}>
        <td className={`whitespace-nowrap px-2 py-2 text-sm ${m.role === 'main' ? 'font-bold text-emerald-950' : 'font-semibold text-slate-700'}`}>{m.name}</td>
        {data.classes.map((c) => { const v = m.perClassF1[c]; return <td key={c} className="rounded-lg px-2 py-2.5 text-center font-bold tabular-nums" style={shade(v.mean)} title={`${m.name} · ${c}: ${pm(v)}%`}>{(v.mean * 100).toFixed(1)}</td>; })}
      </tr>)}</tbody>
    </table></div>
  </div>;
}

export function ConfusionExplorer({ tr }) {
  const [key, setKey] = useState(mainModel().key);
  const m = data.models.find((x) => x.key === key);
  const cm = m.confusion;
  const max = Math.max(...cm.flat());
  const correct = cm.reduce((s, r, i) => s + r[i], 0);
  const total = cm.flat().reduce((a, b) => a + b, 0);
  const worst = useMemo(() => {
    let w = null;
    cm.forEach((r, i) => r.forEach((v, j) => { if (i !== j && v > 0 && (!w || v > w.v)) w = { i, j, v }; }));
    return w;
  }, [cm]);
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
      <h3 className="font-bold text-slate-900">{tr('ตารางสับสน (Confusion matrix) · seed 42', 'Confusion matrix · seed 42')}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{tr('แถวคือโรคจริง คอลัมน์คือที่โมเดลทาย · ตัวเลขบนเส้นทแยงคือทายถูก นอกเส้นทแยงคือทายผิด', 'Rows are the true class, columns the prediction · the diagonal is correct, everything else is an error')}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{data.models.map((x) => <button key={x.key} onClick={() => setKey(x.key)} aria-pressed={key === x.key} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${key === x.key ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-800/40'}`}>{x.name}</button>)}</div>
    </div>
    <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[auto_1fr] md:items-center">
      <div className="overflow-x-auto"><table className="border-separate border-spacing-1 text-sm">
        <thead><tr><th className="p-1 text-[10px] font-bold text-slate-400">{tr('จริง ↓ / ทาย →', 'True ↓ / Pred →')}</th>{data.classes.map((c) => <th key={c} className="px-1 pb-1 text-[11px] font-bold text-slate-500">{c}</th>)}</tr></thead>
        <tbody>{cm.map((r, i) => <tr key={i}><th className="pr-2 text-right text-[11px] font-bold text-slate-500">{data.classes[i]}</th>
          {r.map((v, j) => <td key={j} className="h-14 w-16 rounded-lg text-center text-base font-bold tabular-nums sm:w-[4.5rem]" style={i === j ? { backgroundColor: `rgba(31,77,58,${0.15 + (v / max) * 0.8})`, color: v / max > 0.5 ? '#fff' : '#123326' } : { backgroundColor: v ? `rgba(180,83,9,${0.08 + Math.min(1, v / 20) * 0.35})` : '#f8faf9', color: v ? '#7c2d12' : '#cbd5e1' }}>{v}</td>)}
        </tr>)}</tbody>
      </table></div>
      <div className="space-y-3 text-sm leading-6 text-slate-600">
        <div className="font-display text-3xl font-bold text-slate-950">{correct}<span className="text-lg text-slate-400"> / {total}</span></div>
        <p>{tr(`${m.name} ทายถูก ${correct} ภาพ ผิด ${total - correct} ภาพ (Accuracy ${pct(correct / total)})`, `${m.name} got ${correct} images right and ${total - correct} wrong (accuracy ${pct(correct / total)})`)}</p>
        {worst && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">{tr(`จุดที่พลาดบ่อยที่สุด: ภาพ ${data.classes[worst.i]} ถูกทายเป็น ${data.classes[worst.j]} ${worst.v} ภาพ`, `Most common mistake: ${data.classes[worst.i]} predicted as ${data.classes[worst.j]} (${worst.v} images)`)}</p>}
      </div>
    </div>
  </div>;
}

export function Significance({ tr }) {
  const others = data.models.filter((m) => m.role !== 'main');
  const main = mainModel();
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
      <h3 className="font-bold text-slate-900">{tr('ต่างกันจริงหรือแค่บังเอิญ? · McNemar test', 'Real difference or chance? · McNemar test')}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{tr(`เทียบ ${main.name} กับแต่ละโมเดลทีละภาพ นับภาพที่ตัวหนึ่งถูกแต่อีกตัวผิด ถ้า p < 0.05 ถือว่าต่างกันอย่างมีนัยสำคัญทางสถิติ · ทดสอบแยกทุก seed`, `Compares ${main.name} with each model image by image, counting images one gets right and the other wrong. p < 0.05 means a statistically significant difference · tested per seed`)}</p>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse text-left text-sm">
      <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-bold">{tr('เทียบกับ', 'Versus')}</th><th className="px-3 py-3 text-right font-bold">{tr(`${main.name} ดีกว่า (ภาพ)`, `${main.name} better (images)`)}</th><th className="px-3 py-3 text-right font-bold">{tr('อีกตัวดีกว่า (ภาพ)', 'Other better (images)')}</th><th className="px-3 py-3 text-right font-bold">p-value</th><th className="px-4 py-3 font-bold">{tr('สรุป', 'Verdict')}</th></tr></thead>
      <tbody>{others.map((m) => {
        const a = m.mcnemar.reduce((s, x) => s + x.a_only, 0), b = m.mcnemar.reduce((s, x) => s + x.b_only, 0);
        const sig = m.mcnemar.filter((x) => x.p < 0.05).length, n = m.mcnemar.length;
        const winner = a > b ? 'main' : 'other';
        const verdict = sig === n
          ? (winner === 'main' ? tr(`${main.name} ดีกว่าอย่างมีนัยสำคัญ (${sig}/${n} seed)`, `${main.name} significantly better (${sig}/${n} seeds)`) : tr(`${m.name} ดีกว่าอย่างมีนัยสำคัญ (${sig}/${n} seed)`, `${m.name} significantly better (${sig}/${n} seeds)`))
          : sig === 0 ? tr(`ไม่ต่างกันอย่างมีนัยสำคัญ (0/${n} seed)`, `No significant difference (0/${n} seeds)`)
            : tr(`${winner === 'main' ? main.name : m.name} ดีกว่าใน ${sig}/${n} seed`, `${winner === 'main' ? main.name : m.name} better in ${sig}/${n} seeds`);
        return <tr key={m.key} className="border-t border-slate-100">
          <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{m.mcnemar.map((x) => x.a_only).join(' · ')}</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{m.mcnemar.map((x) => x.b_only).join(' · ')}</td>
          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{m.mcnemar.map((x) => (x.p < 0.001 ? '<0.001' : x.p.toFixed(3))).join(' · ')}</td>
          <td className="px-4 py-3 text-xs font-semibold"><span className={`rounded-full px-2.5 py-1 ${sig === n ? (winner === 'main' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900') : 'bg-slate-100 text-slate-600'}`}>{verdict}</span></td>
        </tr>;
      })}</tbody>
    </table></div>
    <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">{tr(`ตัวเลขแต่ละช่องเรียงตาม seed ${data.seeds.join(', ')}`, `Values in each cell follow seeds ${data.seeds.join(', ')}`)}</p>
  </div>;
}

// Each training run as a dot on one accuracy axis, a row per model: the spread between the three
// seeds is the point, so runs that sit on top of each other read as "stable" at a glance.
export function SeedSpread({ tr }) {
  const [hover, setHover] = useState(null);
  const rows = byAccuracy();
  const all = rows.flatMap((m) => m.runs.map((r) => r.accuracy * 100));
  const lo = Math.floor(Math.min(...all) - 0.3), hi = Math.min(100, Math.ceil(Math.max(...all) + 0.3));
  const W = 640, L = 132, R = 16, rowH = 34, T = 8, H = T + rows.length * rowH + 30;
  const X = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const ticks = []; for (let v = lo; v <= hi; v += 1) ticks.push(v);
  return <figure className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <figcaption className="text-sm font-bold text-slate-800">{tr('Accuracy ของแต่ละรอบ (seed)', 'Accuracy of each run (seed)')}</figcaption>
    <p className="mt-1 text-xs leading-5 text-slate-500">{tr('จุดเล็ก = 1 รอบ · ขีดตั้ง = ค่าเฉลี่ย · จุดอยู่ชิดกัน = ผลนิ่ง ไม่ขึ้นกับดวง · จุดที่ซ้อนกันคือได้ค่าเท่ากัน (EfficientNet-B0 ได้ 98.29% สองรอบ) · ชี้ที่จุดเพื่อดู seed', 'Small dot = one run · tick = mean · dots close together = a stable result, not luck · overlapping dots scored the same (EfficientNet-B0 hit 98.29% twice) · hover a dot for its seed')}</p>
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tr('ความแม่นยำของ 3 รอบการเทรนในแต่ละโมเดล', 'Accuracy of the three training runs per model')}>
        {ticks.map((v) => <g key={v}><line x1={X(v)} x2={X(v)} y1={T} y2={H - 26} stroke="#eef1ef" /><text x={X(v)} y={H - 10} textAnchor="middle" fontSize="11" fill="#64748b">{v}%</text></g>)}
        {rows.map((m, i) => {
          const y = T + i * rowH + rowH / 2, main = m.role === 'main', c = main ? GREEN : GRAY;
          const xs = m.runs.map((r) => X(r.accuracy * 100));
          return <g key={m.key}>
            <text x={L - 10} y={y + 4} textAnchor="end" fontSize="12" fontWeight={main ? 700 : 500} fill={main ? '#123326' : '#334155'}>{m.name}</text>
            <line x1={Math.min(...xs)} x2={Math.max(...xs)} y1={y} y2={y} stroke={c} strokeWidth="2" strokeLinecap="round" opacity=".55" />
            <line x1={X(m.accuracy.mean * 100)} x2={X(m.accuracy.mean * 100)} y1={y - 9} y2={y + 9} stroke={c} strokeWidth="2.5" strokeLinecap="round" />
            {m.runs.map((r) => <g key={r.seed} onMouseEnter={() => setHover({ m, r })} onMouseLeave={() => setHover(null)} className="cursor-pointer">
              <circle cx={X(r.accuracy * 100)} cy={y} r="5.5" fill={c} stroke="#fff" strokeWidth="2" />
              <circle cx={X(r.accuracy * 100)} cy={y} r="12" fill="transparent" />
            </g>)}
          </g>;
        })}
      </svg>
      {hover && <div className="pointer-events-none absolute right-2 top-0 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md"><span className="font-bold text-slate-900">{hover.m.name}</span> · seed {hover.r.seed}: <span className="font-semibold tabular-nums">{pct(hover.r.accuracy)}</span> ({hover.r.correct}/761)</div>}
    </div>
  </figure>;
}
