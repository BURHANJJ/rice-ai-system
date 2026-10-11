import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Download, FileText, Printer } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useSettings } from '../../lib/settings';
import { useScans } from '../../lib/scanStore';
import { downloadCSV } from '../../lib/exporters';
import { useOutbreakData, provinceOf, riskOf, RISK, topDisease } from '../../components/riskmap/outbreakData';
import { REGION_TH } from '../../components/riskmap/geo';
import { useReviews, pct } from '../../components/admin/reviews';
import { useBroadcasts } from '../../components/admin/alerts';
import { Btn, ErrorNote, Field, PageHeader, inputCls } from '../../components/admin/ui';

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}`; };
const longDate = (d) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
const inMonth = (d, key) => d && monthKey(d) === key;
const prevKey = (key) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 2, 1)); };

function Delta({ now, before, invert = false, unit = '' }) {
  if (before === null || before === undefined) return null;
  if (!before && !now) return <span className="text-gray-400">เท่าเดิม</span>;
  if (!before) return <span className="text-gray-400">เดือนก่อนไม่มีข้อมูล</span>;
  const d = (now - before) / before;
  const good = invert ? d < 0 : d > 0;
  if (Math.abs(d) < 0.005) return <span className="text-gray-400">เท่าเดิม</span>;
  return <span className={`font-bold ${good ? 'text-emerald-700' : 'text-red-700'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d * 100).toFixed(0)}%{unit} จากเดือนก่อน</span>;
}

function Stat({ label, value, children }) {
  return (
    <div className="rb-print-avoid rounded-2xl border border-gray-200 p-3.5">
      <div className="text-[11px] font-bold text-gray-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums text-gray-950">{value}</div>
      <div className="mt-1 text-[11px]">{children}</div>
    </div>
  );
}

function DailyChart({ days }) {
  const W = 720; const H = 190; const P = { l: 30, r: 6, t: 10, b: 24 };
  const max = Math.max(1, ...days.map((d) => d.total));
  const step = (W - P.l - P.r) / days.length;
  const bw = Math.max(4, step - 3);
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="จำนวนผลสแกนรายวัน">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#EEF0EC" />
          <text x={P.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#6B7568">{t}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = P.l + i * step + (step - bw) / 2;
        const hTot = y(0) - y(d.total);
        const hDis = y(0) - y(d.disease);
        return (
          <g key={d.day}>
            <title>{`${d.day} — สแกน ${d.total} · พบโรค ${d.disease}`}</title>
            {d.total > d.disease && <rect x={x} y={y(d.total)} width={bw} height={Math.max(0, hTot - hDis - (d.disease ? 1.5 : 0))} rx="2" fill="#B9D3C4" />}
            {d.disease > 0 && <rect x={x} y={y(d.disease)} width={bw} height={hDis} rx="2" fill="#B4432F" />}
            {(i === 0 || (i + 1) % 5 === 0) && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#6B7568">{d.day}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function MonthlyReport() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { geo, loading, error } = useOutbreakData();
  const { scans } = useScans();
  const { reviews } = useReviews();
  const { items: broadcasts } = useBroadcasts();
  const [users, setUsers] = useState(null);
  const [key, setKey] = useState(() => monthKey(new Date()));
  const [preparedBy, setPreparedBy] = useState('');

  useEffect(() => {
    getDocs(collection(db, 'users')).then((snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data(), created: d.data().created_at?.toDate?.() || null })))).catch(() => setUsers([]));
  }, []);
  useEffect(() => { setPreparedBy(settings.organization.preparedBy || user?.full_name || user?.email || ''); }, [settings.organization.preparedBy, user]);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }, []);
  const perMonth = useMemo(() => {
    const c = {};
    for (const s of scans || []) if (s.date) c[monthKey(s.date)] = (c[monthKey(s.date)] || 0) + 1;
    return c;
  }, [scans]);
  // open on the latest month that has data, once
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current || !scans) return;
    picked.current = true;
    if (!perMonth[key]) { const latest = months.find((k) => perMonth[k]); if (latest) setKey(latest); }
  }, [scans, perMonth, months, key]);

  const r = useMemo(() => {
    if (!scans || !geo) return null;
    const sum = (k) => {
      const list = scans.filter((s) => inMonth(s.date, k));
      const sick = list.filter((s) => s.isDisease);
      const prov = {};
      for (const s of sick) {
        const g = provinceOf(s, geo);
        if (!g) continue;
        const p = (prov[g.name] ||= { name: g.name, region: g.region, cases: 0, diseases: {} });
        p.cases += 1;
        p.diseases[s.disease] = (p.diseases[s.disease] || 0) + 1;
      }
      const diseases = {};
      for (const s of sick) diseases[s.disease] = (diseases[s.disease] || 0) + 1;
      const conf = list.filter((s) => s.confidence !== null);
      return {
        list,
        sick,
        diseases,
        provinces: Object.values(prov).sort((a, b) => b.cases - a.cases),
        users: new Set(list.map((s) => s.userId).filter(Boolean)).size,
        avgConf: conf.length ? conf.reduce((a, s) => a + s.confidence, 0) / conf.length : null,
      };
    };
    const cur = sum(key);
    const prev = sum(prevKey(key));
    const [y, m] = key.split('-').map(Number);
    const nDays = new Date(y, m, 0).getDate();
    const days = Array.from({ length: nDays }, (_, i) => ({ day: i + 1, total: 0, disease: 0 }));
    for (const s of cur.list) { const d = days[s.date.getDate() - 1]; d.total += 1; if (s.isDisease) d.disease += 1; }
    const rv = Object.values(reviews || {}).filter((x) => inMonth(x.at, key));
    const bc = (broadcasts || []).filter((b) => inMonth(b.at, key));
    const newUsers = (users || []).filter((u) => inMonth(u.created, key));
    return { cur, prev, days, rv, bc, newUsers };
  }, [scans, geo, key, reviews, broadcasts, users]);

  const label = monthLabel(key);
  const generated = new Date();
  const top = r ? topDisease(r.cur.diseases) : null;
  const rate = r && r.cur.list.length ? r.cur.sick.length / r.cur.list.length : null;
  const high = r ? r.cur.provinces.filter((p) => riskOf(p.cases) === 'high') : [];

  const exportCSV = () => downloadCSV(`rice-ai-report-${key}`, [
    { label: 'วันที่', value: (s) => s.date?.toLocaleString('th-TH') },
    { label: 'ผลวินิจฉัย', value: 'disease' },
    { label: 'รหัส', value: 'code' },
    { label: 'ความมั่นใจ (%)', value: (s) => s.confidence?.toFixed(1) },
    { label: 'จังหวัด', value: (s) => provinceOf(s, geo)?.name || '' },
    { label: 'ผลตรวจทาน', value: (s) => reviews?.[s.id]?.label || '' },
  ], r.cur.list, 'รายงานประจำเดือน');

  return (
    <div className="pb-10">
      <div className="rb-print-hide">
        <PageHeader
          icon={FileText}
          eyebrow="Reporting"
          title="รายงานประจำเดือน"
          desc="สรุปสถานการณ์โรคข้าว พื้นที่เสี่ยง คุณภาพ AI และการดำเนินการ พร้อมพิมพ์หรือบันทึกเป็น PDF เพื่อส่งหน่วยงาน"
          actions={(
            <>
              <Btn icon={Download} disabled={!r} onClick={exportCSV}>CSV ข้อมูลดิบ</Btn>
              <Btn variant="primary" icon={Printer} disabled={!r} onClick={() => window.print()}>พิมพ์ / บันทึก PDF</Btn>
            </>
          )}
        />
        <ErrorNote>{error}</ErrorNote>
        <div className="mb-5 grid gap-3 sm:grid-cols-[220px_minmax(0,320px)]">
          <Field label="เดือน">
            <select value={key} onChange={(e) => setKey(e.target.value)} className={inputCls}>
              {months.map((k) => <option key={k} value={k}>{monthLabel(k)}{perMonth[k] ? ` · ${perMonth[k].toLocaleString()} ผลสแกน` : ' · ไม่มีข้อมูล'}</option>)}
            </select>
          </Field>
          <Field label="ผู้จัดทำ"><input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className={inputCls} /></Field>
        </div>
      </div>

      <article className="rb-print-sheet mx-auto max-w-[900px] rounded-[22px] border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        {loading || !r ? (
          <div className="grid gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--color-paddy)] pb-5">
              <div className="flex items-center gap-3">
                <img src="/brand/app_icon.svg" alt="" className="h-12 w-12 rounded-xl" />
                <div>
                  <div className="text-xs font-bold text-gray-500">{settings.organization.name}</div>
                  <h1 className="font-display text-2xl font-bold leading-tight text-gray-950">รายงานสถานการณ์โรคข้าว</h1>
                  <div className="text-sm font-bold text-[var(--color-paddy)]">ประจำเดือน{label}</div>
                </div>
              </div>
              <div className="text-right text-[11px] leading-5 text-gray-500">
                <div>ข้อมูล ณ {longDate(generated)}</div>
                <div>ผู้จัดทำ: {preparedBy || '–'}</div>
              </div>
            </header>

            <section className="rb-print-avoid mt-6">
              <h2 className="text-sm font-extrabold text-gray-950">1. สรุปสำหรับผู้บริหาร</h2>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[13.5px] leading-6 text-gray-700">
                <li>เดือน{label} มีผลสแกนจากแอปทั้งหมด <b>{r.cur.list.length.toLocaleString()}</b> ครั้ง จากผู้ใช้ {r.cur.users.toLocaleString()} คน พบโรค <b>{r.cur.sick.length.toLocaleString()}</b> ครั้ง{rate !== null && ` (${pct(rate)})`}</li>
                <li>{top ? <>โรคที่พบมากที่สุดคือ <b>{top}</b> ({r.cur.diseases[top]} ครั้ง)</> : 'ไม่พบรายงานโรคในเดือนนี้'}{r.cur.provinces.length ? <> กระจายใน <b>{r.cur.provinces.length}</b> จังหวัด</> : ''}</li>
                <li>{high.length ? <>จังหวัดเสี่ยงสูง (พบ ≥ 5 จุด): <b>{high.map((p) => p.name).join(', ')}</b></> : 'ไม่มีจังหวัดที่อยู่ในระดับเสี่ยงสูง'}</li>
                <li>ตรวจทานผล AI {r.rv.length.toLocaleString()} ภาพ{r.rv.length ? <> AI ทายถูก <b>{pct(r.rv.filter((x) => x.correct).length / r.rv.length)}</b></> : ''} · ส่งประกาศถึงเกษตรกร {r.bc.length} ครั้ง</li>
              </ul>
            </section>

            <section className="mt-6">
              <h2 className="text-sm font-extrabold text-gray-950">2. ตัวชี้วัดหลัก</h2>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Stat label="ผลสแกนทั้งหมด" value={r.cur.list.length.toLocaleString()}><Delta now={r.cur.list.length} before={r.prev.list.length} /></Stat>
                <Stat label="พบโรค" value={r.cur.sick.length.toLocaleString()}><Delta now={r.cur.sick.length} before={r.prev.sick.length} invert /></Stat>
                <Stat label="จังหวัดที่พบโรค" value={r.cur.provinces.length}><Delta now={r.cur.provinces.length} before={r.prev.provinces.length} invert /></Stat>
                <Stat label="ผู้ใช้ที่สแกน" value={r.cur.users.toLocaleString()}><Delta now={r.cur.users} before={r.prev.users} /></Stat>
                <Stat label="ผู้ใช้ใหม่" value={r.newUsers.length.toLocaleString()}><span className="text-gray-500">{r.newUsers.filter((u) => u.role === 'researcher').length} นักวิชาการ</span></Stat>
                <Stat label="ความมั่นใจเฉลี่ยของ AI" value={r.cur.avgConf === null ? '–' : `${r.cur.avgConf.toFixed(1)}%`}><span className="text-gray-500">ค่าที่โมเดลรายงาน</span></Stat>
              </div>
            </section>

            <section className="rb-print-avoid mt-6">
              <h2 className="text-sm font-extrabold text-gray-950">3. จำนวนผลสแกนรายวัน</h2>
              <div className="mt-2 rounded-2xl border border-gray-200 p-3">
                <DailyChart days={r.days} />
                <div className="mt-1 flex gap-4 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#B4432F]" />พบโรค</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#B9D3C4]" />ปกติ</span>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section className="rb-print-avoid">
                <h2 className="text-sm font-extrabold text-gray-950">4. โรคที่พบ</h2>
                <table className="mt-2 w-full text-[13px]">
                  <thead className="border-b border-gray-200 text-[11px] text-gray-500"><tr><th className="py-1.5 text-left">โรค</th><th className="py-1.5 text-right">ครั้ง</th><th className="py-1.5 text-right">สัดส่วน</th><th className="py-1.5 text-right">เดือนก่อน</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(r.cur.diseases).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
                      <tr key={name}>
                        <td className="py-2 font-bold text-gray-900">{name}</td>
                        <td className="py-2 text-right tabular-nums">{n}</td>
                        <td className="py-2 text-right tabular-nums">{pct(n / r.cur.sick.length, 0)}</td>
                        <td className="py-2 text-right tabular-nums text-gray-500">{r.prev.diseases[name] || 0}</td>
                      </tr>
                    ))}
                    {!r.cur.sick.length && <tr><td colSpan={4} className="py-4 text-center text-gray-400">ไม่พบรายงานโรค</td></tr>}
                  </tbody>
                </table>
              </section>

              <section className="rb-print-avoid">
                <h2 className="text-sm font-extrabold text-gray-950">5. พื้นที่ที่พบโรคมากที่สุด</h2>
                <table className="mt-2 w-full text-[13px]">
                  <thead className="border-b border-gray-200 text-[11px] text-gray-500"><tr><th className="py-1.5 text-left">จังหวัด</th><th className="py-1.5 text-left">ระดับ</th><th className="py-1.5 text-right">จุด</th><th className="py-1.5 text-left pl-3">โรคหลัก</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {r.cur.provinces.slice(0, 10).map((p) => {
                      const lv = RISK[riskOf(p.cases)];
                      return (
                        <tr key={p.name}>
                          <td className="py-2"><div className="font-bold text-gray-900">{p.name}</div><div className="text-[10.5px] text-gray-400">{REGION_TH[p.region] || ''}</div></td>
                          <td className="py-2"><span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: lv.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: lv.color }} />{lv.label}</span></td>
                          <td className="py-2 text-right font-bold tabular-nums">{p.cases}</td>
                          <td className="py-2 pl-3 text-gray-600">{topDisease(p.diseases)}</td>
                        </tr>
                      );
                    })}
                    {!r.cur.provinces.length && <tr><td colSpan={4} className="py-4 text-center text-gray-400">ไม่มีพื้นที่ที่พบโรค</td></tr>}
                  </tbody>
                </table>
              </section>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section className="rb-print-avoid">
                <h2 className="text-sm font-extrabold text-gray-950">6. คุณภาพการวินิจฉัยของ AI</h2>
                <dl className="mt-2 grid gap-1.5 text-[13px]">
                  <div className="flex justify-between border-b border-gray-100 py-1.5"><dt className="text-gray-500">ตรวจทานในเดือนนี้</dt><dd className="font-bold tabular-nums">{r.rv.length.toLocaleString()} ภาพ</dd></div>
                  <div className="flex justify-between border-b border-gray-100 py-1.5"><dt className="text-gray-500">AI ทายถูก</dt><dd className="font-bold tabular-nums">{r.rv.length ? pct(r.rv.filter((x) => x.correct).length / r.rv.length) : '–'}</dd></div>
                  <div className="flex justify-between border-b border-gray-100 py-1.5"><dt className="text-gray-500">ผลสแกนความมั่นใจ &lt; {settings.review.lowConfidence}%</dt><dd className="font-bold tabular-nums">{r.cur.list.filter((s) => s.confidence !== null && s.confidence < settings.review.lowConfidence).length.toLocaleString()} ภาพ</dd></div>
                </dl>
              </section>
              <section className="rb-print-avoid">
                <h2 className="text-sm font-extrabold text-gray-950">7. การดำเนินการ</h2>
                {!r.bc.length ? <p className="mt-2 text-[13px] text-gray-500">ไม่มีการส่งประกาศในเดือนนี้</p> : (
                  <ul className="mt-2 grid gap-2 text-[13px]">
                    {r.bc.map((b) => (
                      <li key={b.id} className="border-b border-gray-100 pb-2">
                        <div className="font-bold text-gray-900">{b.title}</div>
                        <div className="text-[11.5px] text-gray-500">{b.at ? longDate(b.at) : '–'} · {(b.provinces || []).join(', ')} · ผู้รับ {b.recipients || 0} คน</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <footer className="rb-print-avoid mt-8 border-t border-gray-200 pt-4 text-[11px] leading-5 text-gray-500">
              <b className="text-gray-700">หมายเหตุวิธีการ:</b> ข้อมูลจากผลสแกนใบข้าวผ่านแอป Rice AI ที่บันทึกในระบบ นับจังหวัดตามชื่อจังหวัดในตำแหน่งที่บันทึกกับผลสแกน ระดับความเสี่ยงใช้เกณฑ์เดียวกับแอป (เสี่ยงสูง ≥ 5 จุด, เฝ้าระวัง 2–4 จุด)
              ผลวินิจฉัยของ AI เป็นการคัดกรองเบื้องต้น ควรยืนยันกับเจ้าหน้าที่ก่อนตัดสินใจใช้สารเคมี · จัดทำโดยระบบ Rice AI
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

