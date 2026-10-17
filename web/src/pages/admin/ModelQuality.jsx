import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, ClipboardCheck, Cpu, Gauge, Info, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { checkModel, MODEL } from '../../lib/systemStatus';
import { useScans } from '../../lib/scanStore';
import { useSettings } from '../../lib/settings';
import { Btn, ErrorNote, Kpi, PageHeader, Panel, Pill } from '../../components/admin/ui';
import { LABELS, MODEL_CLASSES, labelName, modelMetrics, pct, useReviews } from '../../components/admin/reviews';

const INK = '#1F4D3A';
const GRID = '#EEF0EC';
const AXIS = { fontSize: 11, fill: '#6B7568' };

function ChartTip({ active, payload, render }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl bg-gray-950 px-3 py-2 text-xs text-white shadow-xl">{render(payload[0].payload)}</div>;
}

function Matrix({ matrix, base }) {
  const max = Math.max(1, ...MODEL_CLASSES.flatMap((p) => LABELS.map((l) => matrix[p.code][l.code])));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th className="w-28 px-2 pb-1 text-left text-[11px] font-bold text-gray-400">AI ทาย ↓ / จริง →</th>
            {LABELS.map((l) => <th key={l.code} className="px-1 pb-1 text-[11px] font-extrabold text-gray-600">{l.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {MODEL_CLASSES.map((p) => (
            <tr key={p.code}>
              <th className="px-2 text-left text-[12px] font-extrabold text-gray-700">{p.name}</th>
              {LABELS.map((l) => {
                const v = matrix[p.code][l.code];
                const diag = p.code === l.code;
                const a = v / max;
                return (
                  <td
                    key={l.code}
                    title={`AI ทาย ${p.name} · จริง ${l.name}: ${v} ภาพ`}
                    className="h-12 rounded-lg font-extrabold tabular-nums"
                    style={{
                      background: v ? (diag ? `rgba(31,77,58,${0.12 + a * 0.78})` : `rgba(180,67,47,${0.1 + a * 0.6})`) : '#F6F6F3',
                      color: v && a > 0.45 ? '#fff' : v ? '#1C2620' : '#C4C7C2',
                    }}
                  >
                    <Link2Cell code={p.code} label={l.code} base={base} v={v} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'rgba(31,77,58,.7)' }} />ทายถูก (แนวทแยง)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'rgba(180,67,47,.55)' }} />ทายผิด — สีเข้ม = เกิดบ่อย</span>
        <span>คลิกช่องเพื่อเปิดภาพชุดนั้นในหน้าตรวจทาน</span>
      </div>
    </div>
  );
}

function Link2Cell({ code, label, base, v }) {
  if (!v) return <span>0</span>;
  return <Link to={`${base}/review?tab=done&ai=${code}&label=${label}`} className="flex h-full w-full items-center justify-center hover:underline">{v}</Link>;
}

function Meter({ value }) {
  if (value === null) return <span className="text-gray-300">–</span>;
  const tone = value >= 0.9 ? INK : value >= 0.75 ? '#C89B3C' : '#B4432F';
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 rounded-full bg-gray-100"><span className="block h-1.5 rounded-full" style={{ width: `${value * 100}%`, background: tone }} /></span>
      <span className="w-12 text-right font-bold tabular-nums text-gray-900">{pct(value)}</span>
    </span>
  );
}

export default function ModelQuality() {
  const base = '/admin';
  const { scans, loading, error } = useScans();
  const { reviews, error: reviewError } = useReviews();
  const { settings } = useSettings();
  const low = settings.review.lowConfidence;
  const m = useMemo(() => modelMetrics(scans, reviews, low), [scans, reviews, low]);
  const [ai, setAi] = useState({ state: 'checking' });
  useEffect(() => { checkModel().then(setAi); }, []);

  const hist = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({ lo: i * 10, label: `${i * 10}–${i * 10 + 10}`, n: 0 }));
    for (const s of scans || []) if (s.confidence !== null) bins[Math.min(9, Math.floor(s.confidence / 10))].n += 1;
    return bins.filter((b) => b.lo >= 30 || b.n);
  }, [scans]);

  const noReviews = !loading && !m.reviewed;

  return (
    <div className="pb-10">
      <PageHeader
        icon={BrainCircuit}
        eyebrow="Model monitoring"
        title="คุณภาพโมเดล AI"
        desc="ความแม่นยำจริงในการใช้งาน คำนวณจากผลสแกนที่ผู้เชี่ยวชาญตรวจทานแล้ว ไม่ใช่ตัวเลขจากชุดทดสอบตอนเทรน"
        actions={<Btn variant="primary" icon={ClipboardCheck} to={`${base}/review`}>ตรวจทานผล AI</Btn>}
      />
      <ErrorNote>{error || reviewError}</ErrorNote>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={loading} icon={Target} label="ความแม่นยำจริง" value={pct(m.accuracy)} sub={m.reviewed ? `ถูก ${m.correct.toLocaleString()} จาก ${m.reviewed.toLocaleString()} ภาพที่ตรวจทาน` : 'ยังไม่มีผลตรวจทาน'} />
        <Kpi loading={loading} icon={ClipboardCheck} tone="blue" label="ตรวจทานแล้ว" value={pct(m.coverage, 0)} sub={`${m.reviewed.toLocaleString()} จาก ${(scans?.length || 0).toLocaleString()} ผลสแกน`} to={`${base}/review`} />
        <Kpi loading={loading} icon={Gauge} tone="gray" label="ความมั่นใจเฉลี่ย" value={m.avgConfidence === null ? '–' : `${m.avgConfidence.toFixed(1)}%`} sub="ค่าที่โมเดลรายงานเอง" />
        <Kpi loading={loading} icon={AlertTriangle} tone="amber" label={`AI ไม่มั่นใจ (< ${low}%)`} value={pct(m.lowRate)} sub={`รอตรวจทาน ${m.lowUnreviewed.toLocaleString()} ภาพ`} to={`${base}/review?tab=low`} />
      </div>

      {noReviews && (
        <div className="mt-4 flex flex-col gap-3 rounded-[22px] bg-amber-50 p-5 ring-1 ring-amber-100 sm:flex-row sm:items-center">
          <Info size={20} className="shrink-0 text-amber-700" />
          <p className="flex-1 text-sm leading-6 text-amber-950">ยังไม่มีผลตรวจทาน ตัวเลขความแม่นยำ ตารางความสับสน และกราฟความสอดคล้องจะเริ่มแสดงเมื่อมีการตรวจทานอย่างน้อย 1 ภาพ แนะนำให้ตรวจทานภาพที่ AI ไม่มั่นใจก่อน</p>
          <Btn variant="primary" to={`${base}/review?tab=low`} icon={ArrowRight}>เริ่มตรวจทาน</Btn>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel title="ตารางความสับสน (Confusion matrix)" desc="แถว = สิ่งที่ AI ทาย, คอลัมน์ = ผลจริงจากผู้ตรวจทาน">
          <Matrix matrix={m.matrix} base={base} />
        </Panel>

        <Panel title="ความแม่นยำรายโรค" desc="Precision = ทายว่าเป็นโรคนี้แล้วถูก · Recall = เป็นโรคนี้จริงแล้ว AI จับได้" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-extrabold text-gray-500">
                <tr><th className="px-4 py-2.5 text-left">คลาส</th><th className="px-2 py-2.5 text-left">Precision</th><th className="px-2 py-2.5 text-left">Recall</th><th className="px-4 py-2.5 text-right">F1 · n</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {m.perClass.map((c) => (
                  <tr key={c.code}>
                    <td className="whitespace-nowrap px-4 py-3"><div className="font-extrabold text-gray-900">{c.name}</div><div className="text-[11px] text-gray-400">{c.en}</div></td>
                    <td className="px-2 py-3"><Meter value={c.precision} /></td>
                    <td className="px-2 py-3"><Meter value={c.recall} /></td>
                    <td className="px-4 py-3 text-right tabular-nums"><div className="font-bold text-gray-900">{c.f1 === null ? '–' : c.f1.toFixed(2)}</div><div className="text-[11px] text-gray-400">{c.predicted}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="mb-2 text-xs font-extrabold text-gray-700">AI สับสนบ่อยที่สุด</div>
            {!m.confusions.length ? <p className="text-xs text-gray-400">ยังไม่พบการทายผิด</p> : (
              <ul className="grid gap-1.5">
                {m.confusions.slice(0, 4).map((c) => (
                  <li key={`${c.ai}${c.label}`}>
                    <Link to={`${base}/review?tab=wrong&ai=${c.ai}&label=${c.label}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-gray-50">
                      <span className="font-bold text-gray-900">{labelName(c.ai)}</span><ArrowRight size={12} className="text-gray-400" /><span className="font-bold text-red-700">{labelName(c.label)}</span>
                      <span className="ml-auto text-xs font-bold tabular-nums text-gray-500">{c.n} ภาพ</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="ความมั่นใจสอดคล้องกับความจริงไหม" desc="สัดส่วนที่ AI ทายถูก แยกตามช่วงความมั่นใจ — โมเดลที่ดีควรถูกมากขึ้นเมื่อมั่นใจมากขึ้น">
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={m.buckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${v * 100}%`} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(31,77,58,.06)' }} content={<ChartTip render={(d) => <><b>ความมั่นใจ {d.label}</b><br />ถูก {d.ok}/{d.n} ภาพ ({pct(d.acc)})</>} />} />
                <Bar dataKey="acc" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {m.buckets.map((b) => <Cell key={b.lo} fill={b.lo < low ? '#C89B3C' : INK} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">แท่งสีทอง = ช่วงที่ต่ำกว่าเกณฑ์ “AI ไม่มั่นใจ” ({low}%) ซึ่งถูกส่งเข้าคิวตรวจทานก่อน</p>
        </Panel>

        <Panel title="การกระจายความมั่นใจ" desc={`ผลสแกนทั้งหมด ${(scans?.length || 0).toLocaleString()} ภาพ แยกตามช่วงความมั่นใจของ AI`}>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(31,77,58,.06)' }} content={<ChartTip render={(d) => <><b>ความมั่นใจ {d.label}%</b><br />{d.n.toLocaleString()} ภาพ</>} />} />
                <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {hist.map((b) => <Cell key={b.lo} fill={b.lo + 10 <= low ? '#C89B3C' : INK} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">ปรับเกณฑ์ “AI ไม่มั่นใจ” ได้ที่หน้าตั้งค่าระบบ</p>
        </Panel>
      </div>

      <Panel className="mt-4" title="ข้อมูลโมเดล (Model card)">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px]">
          <dl className="grid gap-2.5 text-sm">
            {[
              ['รุ่นโมเดล', `${MODEL.version} · ${MODEL.date}`],
              ['สถาปัตยกรรม', MODEL.architecture],
              ['คลาสที่ทำนาย', MODEL.classes],
              ['ทำงานบน', MODEL.runtimes],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-gray-500">{k}</dt><dd className="font-bold text-gray-900">{v}</dd></div>
            ))}
          </dl>
          <dl className="grid gap-2.5 text-sm">
            <div className="grid grid-cols-[150px_1fr] gap-2"><dt className="text-gray-500">แม่นยำบนชุดทดสอบ</dt><dd className="font-bold text-gray-900">{MODEL.accuracy} <span className="font-normal text-gray-400">Macro F1 {MODEL.macroF1} · {MODEL.testImages} ภาพ</span></dd></div>
            <div className="grid grid-cols-[150px_1fr] gap-2"><dt className="text-gray-500">เกณฑ์ความมั่นใจ</dt><dd className="font-bold text-gray-900">{MODEL.threshold}% <span className="font-normal text-gray-400">ต่ำกว่านี้ขอภาพใหม่</span></dd></div>
            <div className="grid grid-cols-[150px_1fr] gap-2"><dt className="text-gray-500">แม่นยำจริง (ตรวจทาน)</dt><dd className="font-bold text-gray-900">{pct(m.accuracy)} <span className="font-normal text-gray-400">n={m.reviewed}</span></dd></div>
            <div className="grid grid-cols-[150px_1fr] gap-2"><dt className="text-gray-500">ผลสแกนทั้งหมด</dt><dd className="font-bold text-gray-900">{(scans?.length || 0).toLocaleString()}</dd></div>
          </dl>
          <div className={`rounded-2xl p-4 ring-1 ${ai.state === 'online' ? 'bg-emerald-50 ring-emerald-100' : ai.state === 'checking' ? 'bg-gray-50 ring-gray-100' : 'bg-amber-50 ring-amber-100'}`}>
            <div className="flex items-center gap-2 text-sm font-extrabold text-gray-900"><Cpu size={16} />AI บนอุปกรณ์</div>
            <div className="mt-2">
              {ai.state === 'online' && <Pill tone="green" icon={CheckCircle2}>ไฟล์โมเดลพร้อม{ai.sizeMb ? ` · ${ai.sizeMb} MB` : ''}</Pill>}
              {ai.state === 'checking' && <Pill tone="gray">กำลังตรวจสอบ…</Pill>}
              {ai.state === 'offline' && <Pill tone="amber">เปิดไฟล์โมเดลไม่ได้</Pill>}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-gray-500">แอปใช้ไฟล์ TFLite ที่ติดมากับแอป ส่วนเว็บโหลด {MODEL.file} มารันในเบราว์เซอร์ ไม่มีเซิร์ฟเวอร์ AI ที่ต้องดูแล</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
