import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import thailandGeoJSON from '../lib/thailand.json';
import amphoeGeoJSON from '../lib/amphoe.json';
import { EN_TO_TH_PROVINCE_MAP } from '../lib/provinces';
import { Map, Crosshair } from 'lucide-react';

/* ─── helpers ─── */

function provinceNameFromFeature(feature) {
  const englishName = feature?.properties?.name;
  return EN_TO_TH_PROVINCE_MAP[englishName] || englishName;
}

function getBounds(geoJsonData) {
  const layer = L.geoJSON(geoJsonData);
  const bounds = layer.getBounds();
  return bounds.isValid() ? bounds : null;
}

// ==============================================================================
// 🗺️ จุดปรับแต่งสีแผนที่ 2D บนเว็บ (Leaflet Map Risk Colors)
// ==============================================================================
// หากต้องการเปลี่ยนสีจังหวัด/อำเภอตามระดับความเสี่ยง ให้แก้รหัส Hex ในฟังก์ชันนี้:
// ==============================================================================
function riskColor(riskLevel, hasCases) {
  if (riskLevel === 'high') return '#ef4444';    // สีแดง (ระดับเสี่ยงสูง: พบโรค >= 5 จุด)
  if (riskLevel === 'medium') return '#f59e0b';  // สีส้ม (ระดับเฝ้าระวัง: พบโรค 2-4 จุด)
  return hasCases ? '#10b981' : '#22c55e';        // สีเขียว (ระดับปกติ: 0-1 จุด / เขียวมรกตเมื่อมีรายงานประปราย)
}

function riskLabel(riskLevel) {
  if (riskLevel === 'high') return 'เสี่ยงสูง';
  if (riskLevel === 'medium') return 'เฝ้าระวัง';
  return 'ปกติ';
}

/* ─── Map Viewport Controller ─── */

function MapViewport({ countryData, selectedProvince }) {
  const map = useMap();
  useEffect(() => {
    if (!countryData) return;
    const selectedFeature = selectedProvince?.province
      ? countryData.features.find((f) => provinceNameFromFeature(f) === selectedProvince.province)
      : null;
    const targetBounds = selectedFeature ? getBounds(selectedFeature) : getBounds(countryData);
    if (!targetBounds?.isValid()) return;
    window.requestAnimationFrame(() => {
      map.fitBounds(targetBounds, {
        animate: true,
        duration: 0.9,
        paddingTopLeft: selectedFeature ? [40, 80] : [18, 18],
        paddingBottomRight: selectedFeature ? [40, 100] : [18, 92],
        maxZoom: selectedFeature ? 10 : 6,
      });
    });
  }, [map, countryData, selectedProvince?.province]);
  return null;
}

/* ─── Main Component ─── */

export default function RiskMapLeaflet({ provinces, activeRegion, selectedProvince, onProvinceClick }) {
  const geojsonRef = useRef();
  const amphoeGeojsonRef = useRef();

  const selectedFeature = useMemo(() => {
    if (!selectedProvince?.province) return null;
    return thailandGeoJSON.features.find((f) => provinceNameFromFeature(f) === selectedProvince.province) || null;
  }, [selectedProvince?.province]);

  const displayGeoJson = useMemo(() => {
    if (!selectedFeature) return thailandGeoJSON;
    return { type: 'FeatureCollection', features: [selectedFeature] };
  }, [selectedFeature]);

  const displayAmphoeGeoJson = useMemo(() => {
    if (!selectedProvince?.province) return null;
    const amphoeFeatures = amphoeGeoJSON.features.filter(
      (f) => f.properties.pro_th === selectedProvince.province || f.properties.pro_th?.includes(selectedProvince.province)
    );
    return { type: 'FeatureCollection', features: amphoeFeatures };
  }, [selectedProvince?.province]);

  const getProvinceData = (feature) => {
    const englishName = feature.properties.name;
    const thaiName = provinceNameFromFeature(feature);
    const data = provinces.find((p) => p.province === thaiName);
    return { englishName, thaiName, data };
  };

  const getProvinceStyle = (feature) => {
    const { thaiName, data } = getProvinceData(feature);
    const isInActiveRegion = !activeRegion || data?.region === activeRegion || selectedProvince?.province === thaiName;
    const isSelected = selectedProvince?.province === thaiName;
    const hasCases = (data?.total_cases || 0) > 0;

    if (isSelected) {
      // Hide the province polygon completely so it doesn't conflict with amphoe shapes
      return {
        fillOpacity: 0,
        opacity: 0,
        interactive: false
      };
    }

    return {
      // สีพื้นหลังจังหวัด: ถ้าอยู่ในภูมิภาคที่เลือกจะใช้สีตามระดับความเสี่ยง ถ้าอยู่นอกเขตใช้สีเทา #cbd5e1
      fillColor: isInActiveRegion ? riskColor(data?.risk_level || 'low', hasCases) : '#cbd5e1',
      fillOpacity: isInActiveRegion ? 0.82 : 0.22,
      color: '#ffffff', // เส้นขอบเขตจังหวัดสีขาว
      weight: 1,
      opacity: 1,
    };
  };

  const onEachProvinceFeature = (feature, layer) => {
    const { thaiName, data } = getProvinceData(feature);
    const isInActiveRegion = !activeRegion || data?.region === activeRegion || selectedProvince?.province === thaiName;
    const cases = data?.total_cases || 0;
    const level = data?.risk_level || 'low';
    const color = riskColor(level, cases > 0);

    if (!isInActiveRegion) {
      layer.on({ click: () => onProvinceClick?.(null) });
      return;
    }

    // Only bind tooltip for country view (not when a province is selected)
    if (!selectedProvince) {
      layer.bindTooltip(
        `<div style="min-width:132px;text-align:center;font-family:'IBM Plex Sans Thai','IBM Plex Sans',sans-serif;">
            <div style="font-weight:900;font-size:14px;color:#0f172a;margin-bottom:4px;">${thaiName}</div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:${color};">
              <span style="width:8px;height:8px;border-radius:999px;background:${color};display:inline-block;"></span>
              ${riskLabel(level)} · ${cases} เคส
            </div>
            <div style="margin-top:5px;font-size:11px;font-weight:700;color:#64748b;">คลิกเพื่อโฟกัสจังหวัด</div>
          </div>`,
        { sticky: true, className: 'rice-map-tooltip', direction: 'top', offset: [0, -10] }
      );
    }

    layer.on({
      mouseover: (e) => {
        if (!selectedProvince) {
          e.target.setStyle({ weight: 2.4, fillOpacity: 1 });
          e.target.bringToFront();
        }
      },
      mouseout: (e) => {
        if (!selectedProvince) {
          geojsonRef.current?.resetStyle(e.target);
        }
      },
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        if (selectedProvince?.province === thaiName) {
          onProvinceClick?.(null);
        } else {
          onProvinceClick?.(data || { province: thaiName, total_cases: 0, region: 'ไม่ระบุภูมิภาค', risk_level: 'low', disease_breakdown: {}, districts: [] });
        }
      },
    });
  };

  const getAmphoeData = (feature) => {
    const districtName = feature.properties.amp_th.replace(/^อำเภอ/, '').replace(/^กิ่งอำเภอ/, '');
    const districtData = selectedProvince?.districts?.find((d) => d.district === districtName);
    return { districtName, districtData };
  };

  const getAmphoeStyle = (feature) => {
    const { districtData } = getAmphoeData(feature);
    const cases = districtData?.total_cases || 0;
    const level = districtData?.risk_level || 'low';
    
    return {
      fillColor: riskColor(level, cases > 0),
      fillOpacity: 0.75,
      color: '#064E3B', // Dark green border
      weight: 1.5,
      opacity: 0.9,
    };
  };

  const onEachAmphoeFeature = (feature, layer) => {
    const { districtName, districtData } = getAmphoeData(feature);
    const cases = districtData?.total_cases || 0;
    const level = districtData?.risk_level || 'low';
    const color = riskColor(level, cases > 0);

    layer.bindTooltip(
      `<div style="min-width:110px;text-align:center;font-family:'IBM Plex Sans Thai','IBM Plex Sans',sans-serif;">
          <div style="font-weight:900;font-size:13px;color:#0f172a;margin-bottom:4px;">อ.${districtName}</div>
          <div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:${color};">
            <span style="width:8px;height:8px;border-radius:999px;background:${color};display:inline-block;"></span>
            ${cases} เคส
          </div>
        </div>`,
      { sticky: true, className: 'rice-map-tooltip', direction: 'top', offset: [0, -10] }
    );

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 2.5, fillOpacity: 0.9, color: '#064E3B' });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        amphoeGeojsonRef.current?.resetStyle(e.target);
      },
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        // Deselect back to country view if clicking an amphoe
        onProvinceClick?.(null);
      },
    });
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[13.2, 100.5]}
        zoom={5.5}
        zoomControl
        zoomSnap={0}
        zoomDelta={0.5}
        attributionControl={false}
        scrollWheelZoom
        dragging
        style={{ height: '100%', width: '100%', background: 'transparent' }}
      >
        <MapViewport countryData={thailandGeoJSON} selectedProvince={selectedProvince} />

        {/* Render Province Layer (always rendered first so it sits behind amphoes) */}
        <GeoJSON
          key={`${selectedProvince?.province || 'country'}-${activeRegion}-border`}
          ref={geojsonRef}
          data={displayGeoJson}
          style={getProvinceStyle}
          onEachFeature={onEachProvinceFeature}
        />

        {/* Render Amphoe Layer (rendered second so it sits on top and captures hover events) */}
        {selectedProvince && displayAmphoeGeoJson && (
          <GeoJSON
            key={`amphoe-${selectedProvince.province}`}
            ref={amphoeGeojsonRef}
            data={displayAmphoeGeoJson}
            style={getAmphoeStyle}
            onEachFeature={onEachAmphoeFeature}
          />
        )}

      </MapContainer>

      {/* Province focus badge */}
      {selectedProvince && (
        <div className="absolute right-4 top-4 z-[1000] flex max-w-[calc(100%-5rem)] items-center gap-2 rounded-2xl border border-white/70 bg-white/95 px-3 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-md sm:right-6 sm:top-6 sm:px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-paddy)] shadow-[0_0_12px_rgba(31,77,58,.45)]" />
          <span className="truncate text-xs font-extrabold text-slate-700 sm:text-sm">กำลังดูจังหวัด: {selectedProvince.province}</span>
          <button
            type="button"
            onClick={() => onProvinceClick?.(null)}
            className="ml-1 rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
          >
            มุมมองประเทศ
          </button>
        </div>
      )}

      {/* Province focus info */}
      {selectedProvince && (() => {
        const totalAmphoes = displayAmphoeGeoJson?.features?.length || 1;
        const activeAmphoes = selectedProvince.districts?.length || 0;
        const percent = Math.min(100, Math.round((activeAmphoes / totalAmphoes) * 100));
        return (
          <div className="pointer-events-none absolute left-4 bottom-4 z-[1000] w-[210px] rounded-[20px] border border-white/60 bg-white/85 p-3 shadow-xl shadow-emerald-950/5 backdrop-blur-md sm:left-6 sm:bottom-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-[var(--color-paddy)] shadow-inner shadow-white">
                <Map size={14} strokeWidth={2.5} />
              </span>
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--color-paddy)]/70">Focus Mode</div>
                <div className="text-[11px] font-black leading-tight text-slate-800">แบ่งขอบเขตอำเภอจริง</div>
              </div>
            </div>
            <div className="mt-2.5 flex items-end justify-between text-[10px] font-bold">
              <span className="text-slate-500">พื้นที่แจ้งเตือนความเสี่ยง</span>
              <span className="text-slate-700">
                <span className="text-[13px] font-black text-emerald-600">{activeAmphoes}</span> / {totalAmphoes}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100/80 shadow-inner">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-[var(--color-paddy)] shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out" 
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] flex items-center gap-3.5 rounded-2xl border border-white/70 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-md sm:bottom-6 sm:right-6">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-700 sm:text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.4)]" />
          เสี่ยงสูง (≥5 เคส)
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-700 sm:text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,.4)]" />
          เฝ้าระวัง (2-4 เคส)
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-700 sm:text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,.4)]" />
          ปกติ (0-1 เคส)
        </div>
      </div>
    </div>
  );
}
