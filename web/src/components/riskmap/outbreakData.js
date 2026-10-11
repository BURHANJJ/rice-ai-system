import { useEffect, useMemo, useState } from 'react';
import { DISEASE_NAMES, useScans } from '../../lib/scanStore';
import { contains, districtFromText, loadProvinces, normalizeDistrict } from './geo';

export { DISEASE_NAMES };

/** Same thresholds as the mobile app and the researcher map. */
export const riskOf = (cases) => (cases >= 5 ? 'high' : cases >= 2 ? 'medium' : 'low');

export const RISK = {
  high: { label: 'เสี่ยงสูง', color: '#C0392B', pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-[#C0392B]', criteria: 'ตรวจพบโรค ≥ 5 จุด', action: 'แจ้งเจ้าหน้าที่เกษตรด่วน' },
  medium: { label: 'เฝ้าระวัง', color: '#E08A1E', pill: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-[#E08A1E]', criteria: 'ตรวจพบโรค 2–4 จุด', action: 'เฝ้าระวังแปลงนาใกล้ชิด' },
  low: { label: 'ปลอดภัย', color: '#7DB394', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-[#7DB394]', criteria: 'ตรวจพบโรค 0–1 จุด', action: 'สถานการณ์ปกติ' },
};

export const ADVICE = {
  high: ['แจ้งเจ้าหน้าที่เกษตรตำบลด่วน', 'แยก/ถอนต้นที่ติดโรคเผาทำลายทันที', 'ใช้สารป้องกันกำจัดโรคพืชตามคำแนะนำ'],
  medium: ['เฝ้าระวังแปลงนาอย่างใกล้ชิด (ทุก 3–5 วัน)', 'ฉีดพ่นชีวภัณฑ์ป้องกันเชื้อรา/แบคทีเรีย', 'ลดปริมาณการใส่ปุ๋ยไนโตรเจน'],
  low: ['ตรวจสอบแปลงนาทุก 7–10 วัน', 'ใส่ปุ๋ยตามค่าวิเคราะห์ดิน', 'รักษาระดับน้ำให้เหมาะสม'],
};

export const thaiDate = (d) => (d ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}` : '–');

/**
 * Province of a scan, by the province named in its saved location — the same
 * rule as the mobile app and the researcher/admin pages, so counts agree.
 */
export function provinceOf(scan, geo) {
  if (!scan.text) return null;
  return geo.find((g) => scan.text.includes(g.name)) || null;
}

/** Live public outbreak data: province geometry + scans aggregated per province. */
export function useOutbreakData() {
  const [geo, setGeo] = useState(null);
  const [geoError, setGeoError] = useState('');
  const { scans, error: scanError } = useScans();
  const error = geoError || scanError;

  useEffect(() => {
    loadProvinces().then(setGeo).catch(() => setGeoError('โหลดข้อมูลแผนที่ไม่สำเร็จ'));
  }, []);

  const stats = useMemo(() => {
    if (!geo || !scans) return null;
    const byCode = Object.fromEntries(geo.map((g) => [g.code, { geo: g, cases: 0, healthy: 0, diseases: {}, latest: null, scans: [] }]));
    for (const sc of scans) {
      const g = provinceOf(sc, geo);
      if (!g) continue;
      const st = byCode[g.code];
      st.scans.push(sc);
      if (sc.isDisease) {
        st.cases += 1;
        st.diseases[sc.disease] = (st.diseases[sc.disease] || 0) + 1;
        if (sc.date && (!st.latest || sc.date > st.latest)) st.latest = sc.date;
      } else {
        st.healthy += 1;
      }
    }
    for (const st of Object.values(byCode)) st.risk = riskOf(st.cases);
    return byCode;
  }, [geo, scans]);

  return { geo, stats, loading: !error && (!geo || !scans), error, updatedAt: scans ? new Date() : null };
}

/** Attributes a province's scans to its districts: GPS point first, then the address text. */
export function districtStats(provinceStat, districtGeo) {
  const out = Object.fromEntries(districtGeo.map((d) => [d.code, { geo: d, cases: 0, healthy: 0, diseases: {}, latest: null }]));
  const byName = Object.fromEntries(districtGeo.map((d) => [normalizeDistrict(d.name), d.code]));
  const findByName = (name) => {
    if (!name) return null;
    if (byName[name]) return byName[name];
    if (name === 'เมือง') return byName[`เมือง${provinceStat.geo.name}`] || null;
    const hit = Object.entries(byName).find(([k]) => k.includes(name) || name.includes(k));
    return hit ? hit[1] : null;
  };
  for (const sc of provinceStat.scans) {
    let code = null;
    if (sc.lat !== null && sc.lng !== null) code = districtGeo.find((d) => contains(d, sc.lng, sc.lat))?.code || null;
    if (!code) code = findByName(normalizeDistrict(sc.districtText)) || findByName(districtFromText(sc.text));
    if (!code) continue;
    const st = out[code];
    if (sc.isDisease) {
      st.cases += 1;
      st.diseases[sc.disease] = (st.diseases[sc.disease] || 0) + 1;
      if (sc.date && (!st.latest || sc.date > st.latest)) st.latest = sc.date;
    } else {
      st.healthy += 1;
    }
  }
  for (const st of Object.values(out)) st.risk = riskOf(st.cases);
  return out;
}

export const topDisease = (diseases) => Object.entries(diseases).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
