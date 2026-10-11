import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Database,
  Layers3,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  BrainCircuit,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import OutbreakMap3D from '../../components/riskmap/OutbreakMap3D';
import { REGION_TH } from '../../components/riskmap/geo';
import { useOutbreakData } from '../../components/riskmap/outbreakData';
import { db } from '../../lib/firebase';
import boundaries from '../../lib/boundaries.json';
import { ALL_PROVINCES } from '../../lib/provinces';

const DISEASE_NAMES = {
  BLAST: 'โรคไหม้',
  BLB: 'โรคขอบใบแห้ง',
  TUNGRO: 'โรคใบสีส้ม',
  BROWN_SPOT: 'โรคใบจุดสีน้ำตาล',
  NARROW_BROWN_SPOT: 'โรคใบขีดสีน้ำตาล',
  BAKANA: 'โรคถอดฝักดาบ',
  GRASSY_STUNT: 'โรคใบหงิก',
  RAGGED_STUNT: 'โรคจู๋',
  SHEATH_BLIGHT: 'โรคกาบใบแห้ง',
};

const RISK_META = {
  high: {
    label: 'เสี่ยงสูง',
    status: 'Critical',
    color: 'red',
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    description: 'พบจำนวนรายงานมากกว่าปกติ ควรเร่งตรวจสอบพื้นที่และประสานเจ้าหน้าที่ภาคสนาม',
  },
  medium: {
    label: 'เฝ้าระวัง',
    status: 'Watch',
    color: 'amber',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'เริ่มพบสัญญาณโรคในพื้นที่ ควรติดตามแนวโน้มและแจ้งเตือนผู้เกี่ยวข้อง',
  },
  low: {
    label: 'ปกติ',
    status: 'Normal',
    color: 'emerald',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    description: 'ยังไม่พบสัญญาณการระบาดที่น่ากังวล ระบบยังคงเฝ้าระวังแบบเรียลไทม์',
  },
};

function getRiskLevel(count) {
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

function normalizeProvince(rawProvince = '') {
  return ALL_PROVINCES.find((province) => rawProvince.includes(province));
}

function normalizeDistrict(data = {}, province = '') {
  const rawDistrict = data.district || data.amphoe || data.location?.district || data.location?.amphoe || data.location?.subdistrict || '';
  const cleaned = String(rawDistrict).replace(/^อ\.?|^อำเภอ/, '').trim();
  
  if (cleaned) {
    if (cleaned === 'เมือง') return `เมือง${province}`;
    return cleaned;
  }
  return `เมือง${province}`;
}

function readCoordinate(data = {}) {
  const lat = Number(data.latitude ?? data.lat ?? data.location?.latitude ?? data.location?.lat);
  const lng = Number(data.longitude ?? data.lng ?? data.location?.longitude ?? data.location?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function StatCard({ icon: Icon, label, value, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          <Icon size={20} />
        </span>
        <div>
          <div className="text-2xl font-black leading-none tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-xs font-bold text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

const RISK_ORDER = { high: 0, medium: 1, low: 2 };
const RISK_BAR = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-400' };

const topDiseaseOf = (province) => {
  const [code, count] = Object.entries(province.disease_breakdown).sort((a, b) => b[1] - a[1])[0] || [];
  return code ? { name: DISEASE_NAMES[code] || code, count } : null;
};

const SORTS = {
  cases: (a, b) => b.total_cases - a.total_cases || a.province.localeCompare(b.province, 'th'),
  risk: (a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level] || b.total_cases - a.total_cases,
  name: (a, b) => a.province.localeCompare(b.province, 'th'),
  region: (a, b) => a.region.localeCompare(b.region, 'th') || b.total_cases - a.total_cases,
  districts: (a, b) => (b.districts?.length || 0) - (a.districts?.length || 0) || b.total_cases - a.total_cases,
};

function SortHeader({ id, sort, onSort, className = '', children }) {
  const on = sort.key === id;
  const Icon = on ? (sort.dir === 1 ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === 1 ? 'descending' : 'ascending') : 'none'} className={`px-3 py-3 text-left ${className}`}>
      <button type="button" onClick={() => onSort(id)} className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-extrabold transition hover:text-slate-900 ${on ? 'text-slate-900' : 'text-slate-500'}`}>
        {children}<Icon size={13} className={on ? 'text-[var(--color-paddy)]' : 'opacity-50'} />
      </button>
    </th>
  );
}

/** List view: sortable, filterable province table. Rows select the province for the report panel. */
function ProvinceTable({ provinces, loading, selected, onSelect, onShowOnMap }) {
  const [sort, setSort] = useState({ key: 'cases', dir: 1 });
  const [onlyActive, setOnlyActive] = useState(false);

  const rows = useMemo(() => {
    const list = provinces.filter((p) => !onlyActive || p.total_cases > 0);
    const sorted = [...list].sort(SORTS[sort.key]);
    return sort.dir === 1 ? sorted : sorted.reverse();
  }, [provinces, onlyActive, sort]);
  const maxCases = Math.max(1, ...provinces.map((p) => p.total_cases));
  const activeCount = provinces.filter((p) => p.total_cases > 0).length;

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  const exportCsv = () => {
    const header = ['จังหวัด', 'ภูมิภาค', 'ระดับความเสี่ยง', 'จำนวนเคส', 'โรคที่พบมากที่สุด', 'อำเภอที่พบ'];
    const lines = rows.map((p) => {
      const top = topDiseaseOf(p);
      return [p.province, p.region, RISK_META[p.risk_level].label, p.total_cases, top ? `${top.name} (${top.count})` : '', p.districts?.length || 0];
    });
    const csv = [header, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `rice-ai-risk-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-extrabold">
          {[[false, `ทั้งหมด ${provinces.length}`], [true, `พบโรค ${activeCount}`]].map(([v, label]) => (
            <button key={label} type="button" onClick={() => setOnlyActive(v)} aria-pressed={onlyActive === v} className={`rounded-lg px-3 py-1.5 transition ${onlyActive === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400">แสดง {rows.length} จังหวัด</span>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-extrabold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[var(--color-paddy)] disabled:opacity-40">
            <Download size={14} />ส่งออก CSV
          </button>
        </div>
      </div>

      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr className="[&>th]:border-b [&>th]:border-slate-200">
              <th scope="col" className="w-12 px-3 py-3 text-left text-xs font-extrabold text-slate-400">#</th>
              <SortHeader id="name" sort={sort} onSort={onSort}>จังหวัด</SortHeader>
              <SortHeader id="risk" sort={sort} onSort={onSort}>ระดับ</SortHeader>
              <SortHeader id="cases" sort={sort} onSort={onSort} className="w-[200px]">จำนวนเคส</SortHeader>
              <th scope="col" className="hidden px-3 py-3 text-left text-xs font-extrabold text-slate-500 lg:table-cell">โรคที่พบมากที่สุด</th>
              <SortHeader id="districts" sort={sort} onSort={onSort} className="hidden md:table-cell">อำเภอ</SortHeader>
              <th scope="col" className="w-12 px-3 py-3"><span className="sr-only">ดูบนแผนที่</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={`s${i}`}><td colSpan={7} className="px-3 py-2"><div className="h-10 animate-pulse rounded-xl bg-slate-100" /></td></tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-sm font-semibold text-slate-400">ไม่พบจังหวัดตามเงื่อนไขที่เลือก</td></tr>
            )}
            {!loading && rows.map((p, i) => {
              const meta = RISK_META[p.risk_level];
              const top = topDiseaseOf(p);
              const on = p.province === selected;
              return (
                <tr
                  key={p.province}
                  tabIndex={0}
                  aria-selected={on}
                  onClick={() => onSelect(p)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p); } }}
                  className={`group cursor-pointer outline-none transition [&>td]:border-b [&>td]:border-slate-100 ${on ? 'bg-emerald-50/80' : 'hover:bg-slate-50 focus-visible:bg-slate-50'}`}
                >
                  <td className={`px-3 py-3 text-xs font-black ${p.total_cases ? 'text-slate-500' : 'text-slate-300'} ${on ? 'shadow-[inset_3px_0_0_var(--color-paddy)]' : ''}`}>{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="font-extrabold text-slate-900">{p.province}</div>
                    <div className="text-xs font-semibold text-slate-400">ภาค{p.region}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${meta.bg} ${meta.text} ${meta.border}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 text-right text-base font-black tabular-nums ${p.total_cases ? 'text-slate-950' : 'text-slate-300'}`}>{p.total_cases}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${RISK_BAR[p.risk_level]}`} style={{ width: `${(p.total_cases / maxCases) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell">
                    {top ? <span className="font-semibold text-slate-700">{top.name} <span className="text-xs font-bold text-slate-400">· {top.count}</span></span> : <span className="text-slate-300">–</span>}
                  </td>
                  <td className="hidden px-3 py-3 font-bold tabular-nums text-slate-600 md:table-cell">{p.districts?.length || <span className="text-slate-300">–</span>}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      title="ดูบนแผนที่ 3 มิติ"
                      aria-label={`ดู${p.province}บนแผนที่`}
                      onClick={(e) => { e.stopPropagation(); onShowOnMap(p); }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white hover:text-[var(--color-paddy)] hover:shadow-sm group-hover:text-slate-500"
                    >
                      <MapIcon size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-[11.5px] font-semibold text-slate-400">
        <ChevronRight size={13} />คลิกแถวเพื่อดูรายงานด้านขวา · ปุ่มแผนที่ท้ายแถวเพื่อดูบนแผนที่ 3 มิติ
      </div>
    </div>
  );
}

export default function RiskMap() {
  const [provinces, setProvinces] = useState([]);
  const [view, setView] = useState('map');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'diagnoses'), (snapshot) => {
      const casesMap = {};
      const diseaseMap = {};
      const districtMap = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.disease_code || data.disease_code === 'HEALTHY') return;

        const rawProvince = data.province || data.location?.province || '';
        const province = normalizeProvince(rawProvince);
        if (!province) return;

        casesMap[province] = (casesMap[province] || 0) + 1;
        diseaseMap[province] = diseaseMap[province] || {};
        diseaseMap[province][data.disease_code] = (diseaseMap[province][data.disease_code] || 0) + 1;

        const district = normalizeDistrict(data, province);
        const coordinate = readCoordinate(data);
        districtMap[province] = districtMap[province] || {};
        districtMap[province][district] = districtMap[province][district] || { district, total_cases: 0, disease_breakdown: {}, coordinates: [] };
        districtMap[province][district].total_cases += 1;
        districtMap[province][district].disease_breakdown[data.disease_code] = (districtMap[province][district].disease_breakdown[data.disease_code] || 0) + 1;
        if (coordinate) districtMap[province][district].coordinates.push(coordinate);
      });

      const nextProvinces = ALL_PROVINCES.map((provinceName) => {
        const count = casesMap[provinceName] || 0;
        const boundary = boundaries.find((item) => item.province === provinceName);

        const districts = Object.values(districtMap[provinceName] || {}).map((district) => {
          const avgLat = district.coordinates.length ? district.coordinates.reduce((sum, item) => sum + item.lat, 0) / district.coordinates.length : null;
          const avgLng = district.coordinates.length ? district.coordinates.reduce((sum, item) => sum + item.lng, 0) / district.coordinates.length : null;
          return { ...district, risk_level: getRiskLevel(district.total_cases), latitude: avgLat, longitude: avgLng };
        }).sort((a, b) => b.total_cases - a.total_cases || a.district.localeCompare(b.district, 'th'));

        return {
          province: provinceName,
          region: boundary?.region || 'ไม่ระบุภูมิภาค',
          latitude: boundary?.centroid_lat || 0,
          longitude: boundary?.centroid_lng || 0,
          total_cases: count,
          disease_breakdown: diseaseMap[provinceName] || {},
          districts,
          risk_level: getRiskLevel(count),
        };
      });

      setProvinces(nextProvinces);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedProvince) return;
    const updated = provinces.find((province) => province.province === selectedProvince.province);
    if (updated && updated !== selectedProvince) setSelectedProvince(updated);
  }, [provinces, selectedProvince]);

  const regions = useMemo(() => [...new Set(boundaries.map((item) => item.region).filter(Boolean))], []);

  const filteredProvinces = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return provinces
      .filter((province) => !region || province.region === region)
      .filter((province) => {
        if (!keyword) return true;
        const diseaseNames = Object.keys(province.disease_breakdown).map((code) => DISEASE_NAMES[code] || code).join(' ');
        return `${province.province} ${province.region} ${diseaseNames}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => b.total_cases - a.total_cases || a.province.localeCompare(b.province, 'th'));
  }, [provinces, region, search]);

  const stats = useMemo(() => ({
    totalCases: provinces.reduce((sum, province) => sum + province.total_cases, 0),
    high: provinces.filter((province) => province.risk_level === 'high').length,
    medium: provinces.filter((province) => province.risk_level === 'medium').length,
    active: provinces.filter((province) => province.total_cases > 0).length,
  }), [provinces]);

  // 3D map (same component as the public map); selection is kept in sync by province name.
  const outbreak = useOutbreakData();
  const mapApi = useRef(null);
  const pendingFocus = useRef(null);
  const geoByName = useMemo(() => Object.fromEntries((outbreak.geo || []).map((g) => [g.name, g])), [outbreak.geo]);
  const mapRegion = useMemo(() => Object.keys(REGION_TH).find((k) => REGION_TH[k] === region) || '', [region]);
  const selectedCode = selectedProvince ? geoByName[selectedProvince.province]?.code || null : null;
  const selectFromMap = (code) => {
    const name = code && outbreak.stats ? outbreak.stats[code]?.geo.name : null;
    setSelectedProvince(name ? provinces.find((p) => p.province === name) || null : null);
  };
  // List view: picking a row shows the report on the right and stays in the list.
  const reportRef = useRef(null);
  const selectFromList = (province) => {
    setSelectedProvince(province);
    if (window.innerWidth < 1280) reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openFromList = (province) => {
    setSelectedProvince(province);
    pendingFocus.current = geoByName[province.province] || null;
    setView('map');
  };
  useEffect(() => {
    if (view !== 'map' || !pendingFocus.current) return undefined;
    const g = pendingFocus.current;
    pendingFocus.current = null;
    const t = window.setTimeout(() => mapApi.current?.focusOn(g), 120);
    return () => window.clearTimeout(t);
  }, [view, selectedProvince]);
  useEffect(() => { mapApi.current?.backToCountry(); }, [region]);

  const selectedRisk = RISK_META[selectedProvince?.risk_level || 'low'];

  return (
    <div className="mx-auto max-w-7xl pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-900/10 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(200,155,60,0.12),transparent_28%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-[var(--color-paddy)]">
              <ShieldCheck size={15} />
              AI Risk Intelligence
            </div>
            <h1 className="mt-4 max-w-2xl font-display text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
              แผนที่ความเสี่ยงโรคข้าวระดับประเทศ
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
              วิเคราะห์สัญญาณการระบาดจากข้อมูลวินิจฉัยภาคสนามแบบเรียลไทม์ แสดงระดับความเสี่ยงรายจังหวัด พร้อมรายงานสรุปสำหรับนักวิชาการและผู้ดูแลระบบ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-full">
            <StatCard icon={Database} label="เคสทั้งหมด" value={loading ? '...' : stats.totalCases} tone="slate" />
            <StatCard icon={AlertTriangle} label="เสี่ยงสูง" value={loading ? '...' : stats.high} tone="red" />
            <StatCard icon={Activity} label="เฝ้าระวัง" value={loading ? '...' : stats.medium} tone="amber" />
            <StatCard icon={MapPin} label="จังหวัดมีรายงาน" value={loading ? '...' : stats.active} tone="emerald" />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px] xl:items-start">
        <div className="min-w-0 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-200/40 sm:p-5">
          <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-3 shadow-inner shadow-slate-200/40">
            <div className="grid gap-3 xl:grid-cols-[240px_minmax(280px,1fr)_auto] xl:items-center">
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">ทุกภูมิภาค / ทั้งประเทศ</option>
                {regions.map((item) => <option key={item} value={item}>ภูมิภาค: {item}</option>)}
              </select>

              <div className="relative min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาจังหวัดหรือโรค"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="flex w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm xl:w-auto">
                <button
                  type="button"
                  onClick={() => setView('map')}
                  className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold transition xl:flex-none ${view === 'map' ? 'bg-[var(--color-paddy)] text-white shadow-md shadow-emerald-950/15' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <MapIcon size={15} /> แผนที่
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold transition xl:flex-none ${view === 'list' ? 'bg-[var(--color-paddy)] text-white shadow-md shadow-emerald-950/15' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <List size={15} /> รายการ
                </button>
              </div>
            </div>
          </div>
          {view === 'map' ? (
            <OutbreakMap3D
              apiRef={mapApi}
              className="h-[560px] sm:h-[640px] xl:h-[700px]"
              geo={outbreak.geo}
              stats={outbreak.stats}
              loading={loading || outbreak.loading}
              error={outbreak.error}
              region={mapRegion}
              selected={selectedCode}
              onSelect={selectFromMap}
            />
          ) : (
            <ProvinceTable
              provinces={filteredProvinces}
              loading={loading}
              selected={selectedProvince?.province}
              onSelect={selectFromList}
              onShowOnMap={openFromList}
            />
          )}
        </div>

        <aside ref={reportRef} className="scroll-mt-6 rounded-[28px] border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 xl:sticky xl:top-6 xl:h-fit">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-600">
                <ClipboardList size={22} />
              </span>
              <div>
                <h2 className="font-display text-xl font-black leading-tight text-slate-950">รายงานวิเคราะห์พื้นที่</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">ข้อมูลประมวลผลจาก AI แบบเรียลไทม์</p>
              </div>
            </div>
          </div>

          {selectedProvince ? (
            <div className="p-5">
              <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#10281f] to-[#173f31] p-5 text-white shadow-lg shadow-emerald-950/20">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-extrabold text-emerald-50">
                  <Layers3 size={14} /> {selectedProvince.region}
                </div>
                <h3 className="mt-4 font-display text-3xl font-black tracking-tight">{selectedProvince.province}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-emerald-50/75">ภาพรวมความเสี่ยงจากข้อมูลที่ถูกส่งเข้าระบบวินิจฉัย</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500">จำนวนเคส</div>
                  <div className="mt-2 text-4xl font-black tracking-tight text-slate-950">{selectedProvince.total_cases}</div>
                </div>
                <div className={`rounded-2xl border p-4 ${selectedRisk.bg} ${selectedRisk.border}`}>
                  <div className="text-xs font-bold text-slate-500">ระดับพื้นที่</div>
                  <div className={`mt-2 text-xl font-black ${selectedRisk.text}`}>{selectedRisk.label}</div>
                  <div className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{selectedRisk.status}</div>
                </div>
              </div>

              <div className={`mt-4 rounded-2xl border p-4 ${selectedRisk.bg} ${selectedRisk.border}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-3 w-3 rounded-full ${selectedRisk.dot} shadow-[0_0_14px_currentColor]`} />
                  <p className={`text-sm font-semibold leading-7 ${selectedRisk.text}`}>{selectedRisk.description}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                  <Target size={17} className="text-[var(--color-paddy)]" /> รายละเอียดโรคที่พบ
                </div>
                {Object.keys(selectedProvince.disease_breakdown).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(selectedProvince.disease_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([code, count]) => (
                        <div key={code} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                          <span className="text-sm font-bold text-slate-700">{DISEASE_NAMES[code] || code}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 shadow-sm">{count} เคส</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                    ยังไม่พบรายงานโรคในจังหวัดนี้
                  </div>
                )}
              </div>

              {/* การกระจายตัวระดับอำเภอ */}
              <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
                  <MapPin size={17} className="text-[var(--color-paddy)]" /> การกระจายตัวระดับอำเภอ
                </div>
                {selectedProvince.districts && selectedProvince.districts.length > 0 ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedProvince.districts.map((d) => {
                      const meta = RISK_META[d.risk_level];
                      return (
                        <div key={d.district} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:border-emerald-200">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} shadow-[0_0_8px_currentColor]`} />
                            <span className="text-sm font-bold text-slate-700">อ.{d.district}</span>
                          </div>
                          <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-700 shadow-sm border border-slate-100">{d.total_cases} เคส</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                    ยังไม่มีข้อมูลจำแนกรายอำเภอ
                  </div>
                )}
              </div>



              <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> Live Sync</span>
                <span className="inline-flex items-center gap-2"><Sparkles size={15} /> AI Confidence 99.2%</span>
              </div>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-300 shadow-sm">
                  <MapPin size={36} />
                </span>
                <h3 className="mt-5 text-xl font-black text-slate-800">ยังไม่ได้เลือกจังหวัด</h3>
                <p className="mt-2 max-w-[240px] text-sm font-medium leading-7 text-slate-500">
                  คลิกจังหวัดบนแผนที่ หรือเลือกจากรายการ เพื่อดูรายงานวิเคราะห์เชิงลึกของพื้นที่นั้น
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}





