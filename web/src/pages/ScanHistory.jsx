// "My scan history" for researchers and administrators: every scan this account saved from the
// portal scanner (pages/Scan.jsx), live from Firestore, with search, filters, a detail drawer
// (photo, result, advice, GPS) and CSV export.
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CalendarDays, Crosshair, Download, ExternalLink, History, Leaf, MapPin, MapPinOff, ScanLine, Search, ShieldAlert, Stethoscope,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { useDocTitle } from '../lib/i18n';
import { downloadCSV, stamp, thaiDateTime } from '../lib/exporters';
import { Btn, Drawer, EmptyState, ErrorNote, Kpi, PageHeader, Panel, Pill, Segmented, Skeleton, inputCls } from '../components/admin/ui';
import { labelName, useReviews } from '../components/admin/reviews';
import DISEASES from '../data/trialDiseases.json';

const CODES = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY'];
const TONE = { BLAST: 'red', BLB: 'amber', TUNGRO: 'amber', HEALTHY: 'green' };
const DOT = { BLAST: '#c0392b', BLB: '#d4892a', TUNGRO: '#e07b39', HEALTHY: '#2d8a5b' };
const PERIODS = [
  { value: '7', label: '7 วัน', days: 7 },
  { value: '30', label: '30 วัน', days: 30 },
  { value: 'all', label: 'ทั้งหมด', days: null },
];

const placeOf = (s) => s.location?.address || (s.location?.province ? `จ.${String(s.location.province).replace(/^จ\.|^จังหวัด/, '').trim()}` : '');

function useMyScans(uid) {
  const [state, setState] = useState({ scans: null, error: '' });
  useEffect(() => {
    if (!uid) return undefined;
    // No orderBy: sorting here avoids needing a composite index for user_id + diag_date.
    return onSnapshot(
      query(collection(db, 'diagnoses'), where('user_id', '==', uid)),
      (snap) => {
        const scans = snap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, ...x, date: x.diag_date?.toDate?.() || null };
        }).sort((a, b) => (b.date?.getTime() || Infinity) - (a.date?.getTime() || Infinity));
        setState({ scans, error: '' });
      },
      () => setState({ scans: [], error: 'โหลดประวัติไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง' }),
    );
  }, [uid]);
  return state;
}

export default function ScanHistory() {
  const { user } = useAuth();
  useDocTitle({ th: 'ประวัติการสแกน | Rice AI', en: 'Scan history | Rice AI' });
  const { scans, error } = useMyScans(user?.uid);
  const { reviews } = useReviews();
  const [code, setCode] = useState('all');
  const [period, setPeriod] = useState('all');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(null);
  const scanPath = String(user?.role).toLowerCase() === 'admin' ? '/admin/scan' : '/research/scan';
  const loading = scans === null;

  const inPeriod = useMemo(() => {
    const days = PERIODS.find((p) => p.value === period)?.days;
    if (!days || !scans) return scans || [];
    const from = Date.now() - days * 86400e3;
    return scans.filter((s) => s.date && s.date.getTime() >= from);
  }, [scans, period]);

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return inPeriod.filter((s) => (code === 'all' || s.disease_code === code)
      && (!t || [s.disease_name, labelName(s.disease_code), placeOf(s)].join(' ').toLowerCase().includes(t)));
  }, [inPeriod, code, term]);

  const stats = useMemo(() => {
    const all = scans || [];
    const diseased = all.filter((s) => s.disease_code && s.disease_code !== 'HEALTHY').length;
    const provinces = new Set(all.map((s) => s.location?.province).filter(Boolean)).size;
    const withGps = all.filter((s) => s.location?.latitude).length;
    return { total: all.length, diseased, healthy: all.length - diseased, provinces, withGps, last: all[0]?.date || null };
  }, [scans]);

  const counts = useMemo(() => Object.fromEntries(CODES.map((c) => [c, inPeriod.filter((s) => s.disease_code === c).length])), [inPeriod]);

  const exportCsv = () => downloadCSV(`rice-ai-my-scans-${stamp()}`, [
    { value: 'date', label: 'วันเวลา' },
    { value: 'disease', label: 'ผลวินิจฉัย' },
    { value: 'code', label: 'รหัส' },
    { value: 'confidence', label: 'ความมั่นใจ (%)' },
    { value: 'place', label: 'ที่อยู่' },
    { value: 'lat', label: 'ละติจูด' },
    { value: 'lng', label: 'ลองจิจูด' },
    { value: 'accuracy', label: 'ความแม่นยำ GPS (ม.)' },
    { value: 'review', label: 'ผลตรวจทาน' },
    { value: 'id', label: 'รหัสอ้างอิง' },
  ], rows.map((s) => ({
    date: s.date, disease: labelName(s.disease_code), code: s.disease_code, confidence: s.confidence?.toFixed?.(2) ?? '',
    place: placeOf(s), lat: s.location?.latitude ?? '', lng: s.location?.longitude ?? '', accuracy: s.location?.accuracy_m ?? '',
    review: reviews?.[s.id] ? labelName(reviews[s.id].label) : '', id: s.id,
  })), 'my-scans');

  const sel = open ? scans?.find((s) => s.id === open) : null;
  const info = sel ? DISEASES[sel.disease_code] : null;
  const rev = sel ? reviews?.[sel.id] : null;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <PageHeader
        icon={History}
        eyebrow="เครื่องมือ"
        title="ประวัติการสแกนของฉัน"
        desc="ผลสแกนทุกครั้งที่บัญชีนี้บันทึกจากหน้าสแกนใบข้าว พร้อมภาพ ผลวินิจฉัย และพิกัด อัปเดตทันทีเมื่อสแกนเพิ่ม"
        actions={<><Btn icon={Download} onClick={exportCsv} disabled={!rows.length}>ส่งออก CSV</Btn><Btn variant="primary" icon={ScanLine} to={scanPath}>สแกนใบข้าว</Btn></>}
      />
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={loading} icon={ScanLine} label="สแกนทั้งหมด" value={stats.total.toLocaleString()} sub={stats.last ? `ล่าสุด ${thaiDateTime(stats.last)}` : 'ยังไม่มีการสแกน'} />
        <Kpi loading={loading} icon={Stethoscope} tone="red" label="พบโรค" value={stats.diseased.toLocaleString()} sub={stats.total ? `${Math.round((stats.diseased / stats.total) * 100)}% ของการสแกน` : '–'} />
        <Kpi loading={loading} icon={Leaf} label="ใบปกติ" value={stats.healthy.toLocaleString()} sub="ไม่พบอาการของ 3 โรค" />
        <Kpi loading={loading} icon={MapPin} tone="blue" label="พื้นที่" value={`${stats.provinces} จังหวัด`} sub={`${stats.withGps.toLocaleString()} ผลมีพิกัด GPS`} />
      </div>

      <Panel className="mt-5" bodyClass="p-0">
        {/* filters */}
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ค้นหาโรคหรือสถานที่" className={`${inputCls} pl-9`} />
          </label>
          <Segmented value={code} onChange={setCode} options={[{ value: 'all', label: 'ทุกผล', count: inPeriod.length }, ...CODES.map((c) => ({ value: c, label: labelName(c), count: counts[c] }))]} />
          <Segmented value={period} onChange={setPeriod} options={PERIODS.map(({ value, label }) => ({ value, label }))} />
        </div>

        {loading ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : !scans.length ? (
          <EmptyState icon={History} title="ยังไม่มีประวัติการสแกน" desc="ผลที่สแกนจากหน้าสแกนใบข้าวในพอร์ทัลจะแสดงที่นี่ พร้อมภาพและพิกัด" action={<Btn variant="primary" icon={ScanLine} to={scanPath}>เริ่มสแกนใบข้าว</Btn>} />
        ) : !rows.length ? (
          <EmptyState icon={Search} title="ไม่พบผลที่ตรงกับตัวกรอง" desc="ลองเปลี่ยนช่วงเวลา ประเภทผล หรือคำค้นหา" action={<Btn onClick={() => { setCode('all'); setPeriod('all'); setTerm(''); }}>ล้างตัวกรอง</Btn>} />
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((s) => {
              const r = reviews?.[s.id];
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setOpen(s.id)} className="group flex w-full gap-3 rounded-2xl border border-gray-100 bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                    <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {s.image_base64 ? <img src={`data:image/jpeg;base64,${s.image_base64}`} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <Leaf className="m-auto mt-8 text-gray-300" />}
                    </span>
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[s.disease_code] || '#94a3b8' }} />
                        <span className="truncate text-[14px] font-extrabold text-gray-900">{labelName(s.disease_code)}</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-[var(--color-paddy)]" style={{ width: `${Math.min(100, s.confidence || 0)}%` }} /></span>
                        <span className="text-[11px] font-bold tabular-nums text-gray-600">{s.confidence?.toFixed?.(1) ?? '–'}%</span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] text-gray-500">{s.location?.latitude ? <MapPin size={12} className="shrink-0" /> : <MapPinOff size={12} className="shrink-0" />}<span className="truncate">{placeOf(s) || 'ไม่มีพิกัด'}</span></span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><CalendarDays size={11} />{thaiDateTime(s.date)}</span>
                        {r && <Pill tone={r.correct ? 'green' : 'amber'}>{r.correct ? 'ตรวจทานแล้ว ✓' : `ตรวจทาน: ${labelName(r.label)}`}</Pill>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && rows.length > 0 && <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">แสดง {rows.length.toLocaleString()} จาก {scans.length.toLocaleString()} ผล</div>}
      </Panel>

      <Drawer
        open={!!sel}
        onClose={() => setOpen(null)}
        title={sel ? labelName(sel.disease_code) : ''}
        subtitle={sel ? `${thaiDateTime(sel.date)} · #${sel.id.slice(0, 8)}` : ''}
      >
        {sel && (
          <div className="space-y-5">
            {sel.image_base64 && <img src={`data:image/jpeg;base64,${sel.image_base64}`} alt="ภาพที่สแกน" className="w-full rounded-2xl object-cover" />}
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={TONE[sel.disease_code] || 'gray'}>{sel.disease_name || labelName(sel.disease_code)}</Pill>
              <Pill tone="gray">ความมั่นใจ {sel.confidence?.toFixed?.(1) ?? '–'}%</Pill>
              <Pill tone="gray">{sel.ai_source === 'web-onnx' ? 'สแกนบนเว็บ' : sel.ai_source === 'on-device-tflite' ? 'สแกนในแอป' : 'แหล่งไม่ระบุ'}</Pill>
              {rev && <Pill tone={rev.correct ? 'green' : 'amber'} icon={rev.correct ? undefined : ShieldAlert}>{rev.correct ? 'ผู้เชี่ยวชาญยืนยันว่าถูก' : `ผู้เชี่ยวชาญแก้เป็น ${labelName(rev.label)}`}</Pill>}
            </div>

            <section className="rounded-2xl border border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900"><Crosshair size={15} className="text-[var(--color-paddy)]" />ตำแหน่งที่สแกน</h3>
              {sel.location?.latitude ? (
                <dl className="mt-2.5 grid gap-1.5 text-[13px]">
                  <div className="grid grid-cols-[88px_1fr] gap-2"><dt className="text-gray-500">ที่อยู่</dt><dd className="font-semibold text-gray-900">{placeOf(sel) || '–'}</dd></div>
                  <div className="grid grid-cols-[88px_1fr] gap-2"><dt className="text-gray-500">พิกัด</dt><dd className="font-mono tabular-nums text-gray-800">{Number(sel.location.latitude).toFixed(6)}, {Number(sel.location.longitude).toFixed(6)}</dd></div>
                  {sel.location.accuracy_m ? <div className="grid grid-cols-[88px_1fr] gap-2"><dt className="text-gray-500">ความแม่นยำ</dt><dd className="text-gray-800">±{sel.location.accuracy_m} ม.</dd></div> : null}
                  <a href={`https://www.google.com/maps?q=${sel.location.latitude},${sel.location.longitude}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-[var(--color-paddy)] hover:underline"><ExternalLink size={13} />เปิดใน Google Maps</a>
                </dl>
              ) : <p className="mt-2 text-[13px] text-gray-500">บันทึกโดยไม่มีพิกัด ผลนี้ไม่แสดงบนแผนที่การระบาด</p>}
            </section>

            {info && (
              <section className="space-y-3 text-[13.5px] leading-6">
                {info.symptoms && <div><h4 className="text-xs font-bold text-gray-500">อาการ</h4><p className="text-gray-700">{info.symptoms}</p></div>}
                {sel.disease_code !== 'HEALTHY' && info.cause && <div><h4 className="text-xs font-bold text-gray-500">สาเหตุ</h4><p className="text-gray-700">{info.cause}</p></div>}
                {info.advice?.[0]?.treatment && <div><h4 className="text-xs font-bold text-gray-500">{sel.disease_code === 'HEALTHY' ? 'คำแนะนำ' : 'วิธีจัดการ'}</h4><p className="text-gray-700">{info.advice[0].treatment}</p></div>}
              </section>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
