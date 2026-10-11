import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ChevronRight, Cpu, Database, Info, Loader2,
  Map as MapIcon, MapPin, Search, ShieldAlert, ShieldCheck, Sparkles, X, ZoomIn,
} from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import OutbreakMap3D, { MiniStat, RiskPill } from '../components/riskmap/OutbreakMap3D';
import { loadDistricts, REGION_TH } from '../components/riskmap/geo';
import { ADVICE, RISK, districtStats, thaiDate, topDisease, useOutbreakData } from '../components/riskmap/outbreakData';

const REGIONS = [['', 'ทั้งหมด'], ...Object.entries(REGION_TH)];

function Kpi({ icon: Icon, value, label, tone }) {
  const tones = {
    ink: 'bg-white text-[var(--color-paddy)] ring-emerald-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm shadow-emerald-950/5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon size={19} /></span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-black leading-none text-gray-950">{value}</div>
        <div className="mt-1 text-xs font-bold leading-4 text-gray-500">{label}</div>
      </div>
    </div>
  );
}

/* ── Province detail drawer ─────────────────────────────── */

function DetailDrawer({ stat, onClose, onDrill }) {
  const [districts, setDistricts] = useState(null);
  useEffect(() => {
    let alive = true;
    setDistricts(null);
    loadDistricts(stat.geo.code).then((d) => alive && setDistricts(Object.values(districtStats(stat, d)))).catch(() => alive && setDistricts([]));
    return () => { alive = false; };
  }, [stat]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const m = RISK[stat.risk];
  const severity = stat.cases === 0 ? 5 : Math.min(100, stat.cases * 10);
  const diseases = Object.entries(stat.diseases).sort((a, b) => b[1] - a[1]);
  const maxD = diseases[0]?.[1] || 1;
  const ranked = (districts || []).filter((d) => d.cases > 0).sort((a, b) => b.cases - a.cases);

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-end bg-gray-950/40 backdrop-blur-sm sm:items-stretch" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`รายละเอียดจังหวัด${stat.geo.name}`}
        onClick={(e) => e.stopPropagation()}
        className="rb-drawer max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] bg-[var(--color-paper)] p-5 shadow-2xl sm:max-h-none sm:max-w-[440px] sm:rounded-none sm:rounded-l-[28px] sm:p-6"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-gray-400">ภาค{stat.geo.regionTh} · {stat.geo.nameEn}</div>
            <h2 className="mt-1 font-display text-3xl font-black text-gray-950">{stat.geo.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-gray-900"><X size={18} /></button>
        </div>

        <div className="mt-5 rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-gray-700">ความรุนแรงการระบาด</span>
            <RiskPill risk={stat.risk} />
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${severity}%`, background: `linear-gradient(90deg, #7DB394, ${m.color})` }} />
          </div>
          <div className="mt-4 flex divide-x divide-gray-100">
            <MiniStat value={stat.cases} label="จุดที่พบโรค" color={m.color} />
            <MiniStat value={stat.healthy} label="สแกนปกติ" color="#2D6A4F" />
            <MiniStat value={thaiDate(stat.latest)} label="พบล่าสุด" color="#1C211E" />
          </div>
        </div>

        <h3 className="mt-6 mb-2 text-sm font-extrabold text-gray-800">โรคที่ตรวจพบ</h3>
        {diseases.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><ShieldCheck size={18} />ยังไม่พบโรคในจังหวัดนี้</div>
        ) : (
          <div className="grid gap-2.5 rounded-[22px] border border-gray-100 bg-white p-4">
            {diseases.map(([name, n]) => (
              <div key={name}>
                <div className="flex justify-between text-[13px] font-bold text-gray-700"><span>{name}</span><span>{n} จุด</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#C0392B]/80" style={{ width: `${(n / maxD) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}

        <h3 className="mt-6 mb-2 text-sm font-extrabold text-gray-800">อำเภอที่พบโรค</h3>
        <div className="rounded-[22px] border border-gray-100 bg-white p-2">
          {districts === null ? (
            <div className="flex items-center gap-2 p-3 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />กำลังโหลดรายอำเภอ…</div>
          ) : ranked.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">ยังไม่มีรายงานที่ระบุอำเภอได้</div>
          ) : ranked.slice(0, 8).map((d) => (
            <div key={d.geo.code} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50">
              <MapPin size={16} style={{ color: RISK[d.risk].color }} />
              <span className="flex-1 text-sm font-bold text-gray-800">อ.{d.geo.name}</span>
              <span className="text-xs font-bold text-gray-500">{d.cases} จุด</span>
              <RiskPill risk={d.risk} />
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-2 text-sm font-extrabold text-gray-800">คำแนะนำการดูแลพื้นที่</h3>
        <ol className="grid gap-2 rounded-[22px] border border-gray-100 bg-white p-4">
          {ADVICE[stat.risk].map((a, i) => (
            <li key={a} className="flex gap-3 text-sm leading-6 text-gray-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ background: m.color }}>{i + 1}</span>{a}
            </li>
          ))}
        </ol>

        <button type="button" onClick={() => { onDrill(stat.geo); onClose(); }} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-paddy)] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5">
          <ZoomIn size={17} />ดูรายอำเภอบนแผนที่ 3 มิติ
        </button>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-500"><Info size={14} className="mt-0.5 shrink-0" />ข้อมูลจากระบบ AI วิเคราะห์โรคข้าว ใช้ประกอบการเฝ้าระวัง ไม่ใช่ข้อมูลทางราชการ</p>
      </aside>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function PublicRiskMap() {
  const { geo, stats, loading, error } = useOutbreakData();
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // province code
  const [detail, setDetail] = useState(null);
  const mapApi = useRef(null);
  const mapBox = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const list = useMemo(() => (stats ? Object.values(stats) : []), [stats]);
  const inRegion = (st) => !region || st.geo.region === region;

  const kpi = useMemo(() => ({
    cases: list.reduce((n, s) => n + s.cases, 0),
    high: list.filter((s) => s.risk === 'high').length,
    medium: list.filter((s) => s.risk === 'medium').length,
    active: list.filter((s) => s.cases > 0).length,
  }), [list]);

  const ranked = useMemo(() => {
    const k = search.trim();
    return list
      .filter(inRegion)
      .filter((s) => !k || s.geo.name.includes(k) || s.geo.nameEn.toLowerCase().includes(k.toLowerCase()) || Object.keys(s.diseases).some((d) => d.includes(k)))
      .sort((a, b) => b.cases - a.cases || a.geo.name.localeCompare(b.geo.name, 'th'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, region, search]);

  const pickFromList = (s) => {
    const drilled = mapApi.current?.isDrilled();
    if (drilled) mapApi.current.backToCountry();
    const leaveRegion = region && s.geo.region !== region;
    if (leaveRegion) setRegion('');
    if (drilled || leaveRegion) setTimeout(() => mapApi.current?.focusOn(s.geo), 950);
    else mapApi.current?.focusOn(s.geo);
    if (window.innerWidth < 1024) mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <PublicHeader />

      <main className="flex-1 pb-16">
        {/* Title + KPIs */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(52,211,153,0.16),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(212,168,75,0.14),transparent_30%)]" />
          <div className="relative mx-auto max-w-[1440px] px-4 pb-4 pt-6 sm:px-6 lg:pt-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-[var(--color-paddy)] shadow-sm">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                  อัปเดตสด · เปิดให้ทุกคนดูได้
                </div>
                <h1 className="mt-3 font-display text-3xl font-black leading-tight text-gray-950 sm:text-4xl lg:text-[2.6rem]">แผนที่การระบาดโรคข้าว</h1>
                <p className="mt-2 text-sm font-medium leading-7 text-gray-600 sm:text-base">ข้อมูลจากการสแกนใบข้าวของเกษตรกรผ่านแอป Rice AI ทั่ว 77 จังหวัด แตะจังหวัดเพื่อดูรายละเอียดและเจาะลึกถึงระดับอำเภอ</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:w-[640px]">
                <Kpi icon={Activity} value={stats ? kpi.cases : '–'} label="จุดที่พบโรค" tone="ink" />
                <Kpi icon={ShieldAlert} value={stats ? kpi.high : '–'} label="จ. เสี่ยงสูง" tone="red" />
                <Kpi icon={AlertTriangle} value={stats ? kpi.medium : '–'} label="จ. เฝ้าระวัง" tone="amber" />
                <Kpi icon={MapIcon} value={stats ? kpi.active : '–'} label="จ. ที่พบโรค" tone="green" />
              </div>
            </div>

            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {REGIONS.map(([key, label]) => (
                <button
                  key={key || 'all'}
                  type="button"
                  onClick={() => { setRegion(key); mapApi.current?.backToCountry(); setSelected(null); }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition ${region === key ? 'border-[var(--color-paddy)] bg-[var(--color-paddy)] text-white shadow-md shadow-emerald-900/20' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200 hover:text-[var(--color-paddy)]'}`}
                >
                  {key ? `ภาค${label}` : label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Workspace */}
        <section className="mx-auto grid max-w-[1440px] gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Map */}
          <div ref={mapBox} className="scroll-mt-24">
            <OutbreakMap3D
              apiRef={mapApi}
              className="h-[72vh] min-h-[520px] lg:h-[calc(100vh-110px)] lg:max-h-[880px]"
              geo={geo}
              stats={stats}
              loading={loading}
              error={error}
              region={region}
              selected={selected}
              onSelect={setSelected}
              onDetail={setDetail}
            />
          </div>

          {/* Ranking list */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-xl shadow-emerald-950/5 lg:h-[calc(100vh-110px)] lg:max-h-[880px]">
            <div className="border-b border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-black text-gray-950">อันดับพื้นที่เสี่ยง</h2>
                <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-500">{ranked.length} จังหวัด</span>
              </div>
              <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:border-emerald-300 focus-within:bg-white">
                <Search size={17} className="text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาจังหวัด หรือชื่อโรค" className="h-full flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="ล้างคำค้น" className="text-gray-400 hover:text-gray-700"><X size={16} /></button>}
              </label>
            </div>
            <div className="max-h-[520px] flex-1 overflow-y-auto p-2 lg:max-h-none">
              {!stats && Array.from({ length: 8 }).map((_, i) => <div key={i} className="m-1 h-14 animate-pulse rounded-2xl bg-gray-100" />)}
              {stats && ranked.length === 0 && <div className="p-6 text-center text-sm font-semibold text-gray-500">ไม่พบจังหวัดที่ค้นหา</div>}
              {ranked.map((s, i) => {
                const on = s.geo.code === selected;
                const top = topDisease(s.diseases);
                return (
                  <button
                    key={s.geo.code}
                    type="button"
                    onClick={() => pickFromList(s)}
                    onDoubleClick={() => setDetail(s)}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${on ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`w-6 text-center text-xs font-black ${s.cases > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{i + 1}</span>
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: RISK[s.risk].color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-gray-900">{s.geo.name}</span>
                      <span className="block truncate text-xs font-semibold text-gray-400">ภาค{s.geo.regionTh}{top ? ` · ${top}` : ''}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-black" style={{ color: s.cases ? RISK[s.risk].color : '#9CA3AF' }}>{s.cases}</span>
                      <span className="block text-[10.5px] font-bold text-gray-400">จุด</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); setDetail(s); }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition group-hover:bg-white group-hover:text-[var(--color-paddy)]"
                      aria-label={`รายละเอียด${s.geo.name}`}
                    >
                      <ChevronRight size={17} />
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </section>

        {/* Criteria + source */}
        <section className="mx-auto mt-6 grid max-w-[1440px] gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-paddy)]"><Sparkles size={19} /></span>
              <div>
                <h2 className="font-display text-lg font-black text-gray-950">เกณฑ์การประเมินระดับความเสี่ยง</h2>
                <p className="text-xs font-semibold text-gray-500">นับเฉพาะผลสแกนที่พบโรค (ไม่รวมใบข้าวปกติ)</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {['high', 'medium', 'low'].map((k) => (
                <div key={k} className="rounded-2xl border border-gray-100 p-4" style={{ background: `${RISK[k].color}10` }}>
                  <RiskPill risk={k} />
                  <div className="mt-3 text-sm font-black text-gray-900">{RISK[k].criteria}</div>
                  <div className="mt-1 text-sm font-medium text-gray-600">{RISK[k].action}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Database size={19} /></span>
              <div><div className="text-sm font-black text-gray-900">แหล่งที่มาข้อมูล</div><div className="mt-0.5 text-sm text-gray-500">การสแกนภาพใบข้าวของเกษตรกรผ่านแอป Rice AI</div></div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Cpu size={19} /></span>
              <div><div className="text-sm font-black text-gray-900">การประมวลผล</div><div className="mt-0.5 text-sm text-gray-500">AI คัดกรองโรคจากภาพถ่าย อัปเดตแผนที่ทันทีที่มีรายงานใหม่</div></div>
            </div>
            <p className="flex items-start gap-2 text-xs leading-5 text-gray-400"><Info size={14} className="mt-0.5 shrink-0" />แสดงเป็นสถิติรายจังหวัด/อำเภอเท่านั้น ไม่เปิดเผยพิกัดแปลงนาของเกษตรกร ข้อมูลใช้ประกอบการเฝ้าระวัง ไม่ใช่ข้อมูลทางราชการ</p>
          </div>
        </section>
      </main>

      {detail && <DetailDrawer stat={detail} onClose={() => setDetail(null)} onDrill={(g) => { setRegion(''); mapApi.current?.openDrill(g); mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />}

      <PublicFooter />
    </div>
  );
}
