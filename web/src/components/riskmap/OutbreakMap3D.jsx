import { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Box, Bug, ChevronRight, Compass, Globe2, Loader2, MapPin, Maximize2, Minus, Plus, ShieldCheck, ZoomIn } from 'lucide-react';
import Map3D from './Map3D';
import ChipScroller from './ChipScroller';
import { loadDistricts, REGION_TH } from './geo';
import { RISK, districtStats, thaiDate, topDisease } from './outbreakData';

export function RiskPill({ risk, className = '' }) {
  const m = RISK[risk];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${m.pill} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}
    </span>
  );
}

export function MiniStat({ value, label, color }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-lg font-black" style={{ color }}>{value}</div>
      <div className="text-[11.5px] font-semibold text-gray-500">{label}</div>
    </div>
  );
}

function MapButton({ label, onClick, active = false, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-black shadow-md shadow-black/5 transition hover:-translate-y-0.5 ${active ? 'border-[var(--color-paddy)] bg-[var(--color-paddy)] text-white' : 'border-gray-200 bg-white/95 text-gray-800 backdrop-blur hover:bg-white'}`}
    >
      {children}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold text-gray-500">
      {['high', 'medium', 'low'].map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RISK[k].color }} />{RISK[k].label}</span>
      ))}
      <span className="ml-auto inline-flex items-center gap-1 text-gray-400"><BarChart3 size={13} />ความสูง = จุดที่พบโรค</span>
    </div>
  );
}

function Panel({ children }) {
  return <div className="rb-tour-in rounded-[22px] border border-gray-100 bg-white/95 p-4 shadow-2xl shadow-emerald-950/15 backdrop-blur">{children}</div>;
}

/**
 * The 3D outbreak map with its overlays (breadcrumb, camera controls, hover
 * tooltip, bottom panel) and province → district drill-down. Shared by the
 * public map and the researcher / admin map.
 *
 * `apiRef` exposes { focusOn(geo), openDrill(geo), backToCountry(), isDrilled() }.
 * `onDetail(stat)` adds a "รายละเอียด" button to the province panel.
 */
export default function OutbreakMap3D({ geo, stats, loading, error, region = '', selected, onSelect, onDetail, apiRef, className = '' }) {
  const [drill, setDrill] = useState(null); // { province: geo, districts: geo[] }
  const [drillLoading, setDrillLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [hover, setHover] = useState(null);
  const [cam, setCam] = useState({ is3D: true, rotation: 0 });
  const map = useRef(null);

  const list = useMemo(() => (stats ? Object.values(stats) : []), [stats]);
  const inRegion = (st) => !region || st.geo.region === region;
  const dStats = useMemo(() => (drill && stats ? districtStats(stats[drill.province.code], drill.districts) : null), [drill, stats]);

  const { regions, context } = useMemo(() => {
    if (!geo || !stats) return { regions: [], context: [] };
    if (drill && dStats) {
      const vals = Object.values(dStats);
      const max = Math.max(1, ...vals.map((d) => d.cases));
      const b = drill.province.bounds;
      return {
        regions: vals.map((d) => ({ geo: d.geo, height: d.cases === 0 ? 0.04 : 0.2 + (0.8 * d.cases) / max, color: RISK[d.risk].color, label: d.geo.name })),
        context: geo.filter((g) => g.code !== drill.province.code && g.bounds.maxX > b.minX - 0.6 && g.bounds.minX < b.maxX + 0.6 && g.bounds.maxY > b.minY - 0.6 && g.bounds.minY < b.maxY + 0.6),
      };
    }
    const max = Math.max(1, ...list.map((s) => s.cases));
    return {
      regions: geo.map((g) => {
        const s = stats[g.code];
        const on = inRegion(s);
        return {
          geo: g,
          height: s.cases === 0 ? 0.03 : 0.18 + (0.82 * s.cases) / max,
          color: RISK[s.risk].color,
          dimmed: !on,
          label: on && (s.cases > 0 || g.code === selected) ? g.name : null,
        };
      }),
      context: [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, stats, list, drill, dStats, region, selected]);

  const openDrill = async (g) => {
    onSelect?.(g.code);
    setDrillLoading(true);
    try {
      const d = await loadDistricts(g.code);
      setDrill({ province: g, districts: d });
      setSelectedDistrict(null);
    } finally {
      setDrillLoading(false);
    }
  };
  const backToCountry = () => { setDrill(null); setSelectedDistrict(null); };
  const focusProvince = (g) => {
    onSelect?.(g.code);
    requestAnimationFrame(() => map.current?.focusOn(g));
  };

  useImperativeHandle(apiRef, () => ({
    focusOn: focusProvince,
    openDrill,
    backToCountry,
    isDrilled: () => !!drill,
  }));

  const selStat = selected && stats ? stats[selected] : null;
  const selDistrict = selectedDistrict && dStats ? dStats[selectedDistrict] : null;
  const hoverStat = hover?.geo && (drill ? dStats?.[hover.geo.code] : stats?.[hover.geo.code]);

  let panel = null;
  if (stats && !drill && !selStat) {
    const top = list.filter((s) => s.cases > 0 && inRegion(s)).sort((a, b) => b.cases - a.cases);
    panel = (
      <Panel key="overview">
        <Legend />
        {top.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-600"><ShieldCheck size={20} className="text-emerald-600" />ยังไม่พบพื้นที่ระบาด แตะจังหวัดเพื่อดูรายอำเภอ</div>
        ) : (
          <ChipScroller className="mt-3">
            {top.map((s) => (
              <button key={s.geo.code} type="button" onClick={() => focusProvince(s.geo)} className={`shrink-0 rounded-xl px-3 py-2 text-[12.5px] font-extrabold ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${RISK[s.risk].pill}`}>
                {s.geo.name} · {s.cases}
              </button>
            ))}
          </ChipScroller>
        )}
      </Panel>
    );
  } else if (selStat && !drill) {
    panel = (
      <Panel key={`p${selStat.geo.code}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-black text-gray-950">{selStat.geo.name}</div>
            <div className="text-xs font-semibold text-gray-500">ภาค{selStat.geo.regionTh} · {selStat.geo.nameEn}</div>
          </div>
          <div className="text-right">
            <RiskPill risk={selStat.risk} />
            <div className="mt-1 text-xs font-bold text-gray-600">พบโรค {selStat.cases} จุด</div>
          </div>
        </div>
        {topDisease(selStat.diseases) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700"><Bug size={15} />โรคที่พบมากที่สุด: {topDisease(selStat.diseases)}</div>
        )}
        <div className={`mt-3 grid gap-2 ${onDetail ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button type="button" onClick={() => openDrill(selStat.geo)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-paddy)] text-sm font-extrabold text-white transition hover:bg-[var(--color-paddy-dark)]"><ZoomIn size={16} />ดูรายอำเภอ</button>
          {onDetail && <button type="button" onClick={() => onDetail(selStat)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-extrabold text-[var(--color-paddy)] transition hover:bg-emerald-50">รายละเอียด<ChevronRight size={16} /></button>}
        </div>
      </Panel>
    );
  } else if (drill && dStats && selDistrict) {
    panel = (
      <Panel key={`d${selDistrict.geo.code}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${RISK[selDistrict.risk].color}22`, color: RISK[selDistrict.risk].color }}><MapPin size={19} /></span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-black text-gray-950">อ.{selDistrict.geo.name}</div>
            <div className="text-xs font-semibold text-gray-500">จ.{drill.province.name} · {selDistrict.geo.nameEn}</div>
          </div>
          <RiskPill risk={selDistrict.risk} />
        </div>
        <div className="mt-3 flex divide-x divide-gray-100">
          <MiniStat value={selDistrict.cases} label="จุดที่พบโรค" color={RISK[selDistrict.risk].color} />
          <MiniStat value={selDistrict.healthy} label="สแกนปกติ" color="#2D6A4F" />
          <MiniStat value={thaiDate(selDistrict.latest)} label="พบล่าสุด" color="#1C211E" />
        </div>
        {topDisease(selDistrict.diseases) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700"><Bug size={15} />โรคที่พบมากที่สุด: {topDisease(selDistrict.diseases)}</div>
        )}
      </Panel>
    );
  } else if (drill && dStats) {
    const vals = Object.values(dStats).sort((a, b) => b.cases - a.cases || a.geo.name.localeCompare(b.geo.name, 'th'));
    const total = vals.reduce((n, d) => n + d.cases, 0);
    const affected = vals.filter((d) => d.cases > 0).length;
    panel = (
      <Panel key={`list${drill.province.code}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-black text-gray-950">{vals.length} อำเภอ</div>
            <div className="text-xs font-semibold text-gray-500">{affected === 0 ? 'ยังไม่พบโรคในจังหวัดนี้' : `พบโรค ${total} จุด ใน ${affected} อำเภอ`}</div>
          </div>
          {onDetail && <button type="button" onClick={() => onDetail(stats[drill.province.code])} className="text-sm font-extrabold text-[var(--color-paddy)] hover:underline">รายละเอียดจังหวัด</button>}
        </div>
        <ChipScroller className="mt-3">
          {vals.map((d) => (
            <button key={d.geo.code} type="button" onClick={() => setSelectedDistrict(d.geo.code)} className={`w-[118px] shrink-0 rounded-xl px-3 py-2 text-left ${d.cases > 0 ? RISK[d.risk].pill + ' ring-1' : 'bg-gray-50'}`}>
              <div className="truncate text-[12.5px] font-extrabold text-gray-900">{d.geo.name}</div>
              <div className={`text-[11.5px] font-bold ${d.cases > 0 ? '' : 'text-gray-400'}`}>{d.cases > 0 ? `พบโรค ${d.cases} จุด` : 'ไม่พบโรค'}</div>
            </button>
          ))}
        </ChipScroller>
      </Panel>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-[28px] border border-emerald-900/10 bg-[radial-gradient(120%_90%_at_50%_30%,#FFFFFF_0%,#F4F1E8_70%)] shadow-xl shadow-emerald-950/5 ${className}`}>
      <div className="pointer-events-none absolute inset-0 rb-soft-grid opacity-40" />
      {regions.length > 0 && (
        <div className="absolute inset-0">
          <Map3D
            apiRef={map}
            regions={regions}
            context={context}
            fitKey={drill ? `p:${drill.province.code}` : `th:${region}`}
            selectedCode={drill ? selectedDistrict : selected}
            maxHeight={drill ? 46 : 70}
            padding={{ top: 60, right: 60, bottom: 150, left: 12 }}
            onSelect={(g) => (drill ? setSelectedDistrict(g?.code || null) : onSelect?.(g?.code || null))}
            onDrill={drill ? undefined : openDrill}
            onHover={(g, x, y) => setHover(g ? { geo: g, x, y } : null)}
            onCamera={setCam}
          />
        </div>
      )}

      {(loading || drillLoading) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--color-paper)]/50 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[var(--color-paddy)] shadow-xl"><Loader2 size={18} className="animate-spin" />{drillLoading ? 'กำลังโหลดรายอำเภอ…' : 'กำลังโหลดข้อมูลการระบาด…'}</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center"><div className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-xl">{error}</div></div>
      )}

      {/* breadcrumb */}
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-5rem)] items-center gap-2 rounded-full border border-gray-200 bg-white/95 p-1 pr-4 shadow-md backdrop-blur sm:left-4 sm:top-4">
        <button type="button" onClick={drill ? backToCountry : undefined} aria-label={drill ? 'กลับมุมมองประเทศ' : 'ประเทศไทย'} className={`flex h-8 w-8 items-center justify-center rounded-full ${drill ? 'bg-[var(--color-paddy)] text-white' : 'bg-emerald-50 text-[var(--color-paddy)]'}`}>
          {drill ? <ArrowLeft size={16} /> : <Globe2 size={16} />}
        </button>
        <span className="truncate text-sm">
          <span className={drill ? 'font-medium text-gray-500' : 'font-extrabold text-gray-900'}>ประเทศไทย</span>
          {drill && <><span className="mx-2 text-gray-300">›</span><span className="font-extrabold text-gray-900">{drill.province.name}</span></>}
          {!drill && region && <><span className="mx-2 text-gray-300">›</span><span className="font-extrabold text-gray-900">ภาค{REGION_TH[region]}</span></>}
        </span>
      </div>

      {/* controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 sm:right-4 sm:top-4">
        <MapButton label={cam.is3D ? 'มุมมอง 2 มิติ' : 'มุมมอง 3 มิติ'} onClick={() => map.current?.toggle3D()} active={cam.is3D}>{cam.is3D ? '3D' : <Box size={18} />}</MapButton>
        <MapButton label="หันทิศเหนือขึ้น" onClick={() => map.current?.resetRotation()}>
          <Compass size={18} className="text-red-600 transition-transform" style={{ transform: `rotate(${cam.rotation}rad)` }} />
        </MapButton>
        <MapButton label="ซูมเข้า" onClick={() => map.current?.zoomBy(1.4)}><Plus size={18} /></MapButton>
        <MapButton label="ซูมออก" onClick={() => map.current?.zoomBy(1 / 1.4)}><Minus size={18} /></MapButton>
        <MapButton label="จัดแผนที่ให้พอดี" onClick={() => map.current?.resetView()}><Maximize2 size={17} /></MapButton>
      </div>

      {/* hover tooltip (desktop) */}
      {hover && hoverStat && (
        <div className="pointer-events-none absolute z-10 rounded-xl bg-white/95 px-3 py-2 text-center shadow-xl ring-1 ring-gray-100" style={{ left: hover.x, top: hover.y, transform: 'translate(-50%, calc(-100% - 14px))' }}>
          <div className="text-[13.5px] font-black text-gray-900">{drill ? `อ.${hover.geo.name}` : hover.geo.name}</div>
          <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs font-extrabold" style={{ color: RISK[hoverStat.risk].color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: RISK[hoverStat.risk].color }} />{RISK[hoverStat.risk].label} · {hoverStat.cases} จุด
          </div>
          {!drill && <div className="mt-0.5 text-[11px] font-semibold text-gray-400">{hover.geo.code === selected ? 'คลิกอีกครั้งเพื่อดูรายอำเภอ' : 'คลิกเพื่อเลือก'}</div>}
        </div>
      )}

      {/* bottom panel */}
      <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-4 sm:bottom-4 lg:right-auto lg:w-[480px]">{panel}</div>

      <div className="pointer-events-none absolute bottom-4 right-5 z-0 hidden text-right text-[11px] font-semibold text-gray-400 lg:block">ลากเพื่อเลื่อน · ล้อเมาส์ซูม · คลิกขวาลากเพื่อหมุน/เอียง</div>
    </div>
  );
}
