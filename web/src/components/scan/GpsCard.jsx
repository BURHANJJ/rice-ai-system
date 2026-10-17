// Where the next scan will be recorded: Thai address, coordinates, accuracy, a small map, and how
// to fix it when the browser blocks location. Used by the portal scanner (pages/Scan.jsx).
import { useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Copy, Crosshair, ExternalLink, Loader2, MapPinOff, RefreshCw } from 'lucide-react';

/** Accuracy band for the pill: phones outdoors are ~5–15 m, desktops on Wi-Fi often 50–1000 m. */
function quality(m, tr) {
  if (m == null) return { tone: 'bg-slate-100 text-slate-600', label: tr('ไม่ทราบความแม่นยำ', 'Accuracy unknown') };
  if (m <= 30) return { tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200', label: tr(`แม่นยำ ±${Math.round(m)} ม.`, `±${Math.round(m)} m`) };
  if (m <= 150) return { tone: 'bg-amber-50 text-amber-800 ring-amber-200', label: tr(`พอใช้ ±${Math.round(m)} ม.`, `Fair ±${Math.round(m)} m`) };
  return { tone: 'bg-red-50 text-red-700 ring-red-200', label: tr(`หยาบ ±${m >= 1000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m)} ม.`}`, `Rough ±${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`}`) };
}

export default function GpsCard({ loc, onRefresh, tr }) {
  const [copied, setCopied] = useState(false);
  const ok = loc.status === 'ok';
  const q = ok ? quality(loc.accuracy, tr) : null;
  const coords = ok ? `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(coords); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_-18px_rgba(15,45,31,.5)]" aria-label={tr('ตำแหน่ง GPS', 'GPS location')}>
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ok ? 'bg-emerald-50 text-emerald-700' : loc.status === 'loading' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
          {loc.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : ok ? <Crosshair size={15} /> : <MapPinOff size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-slate-900">{tr('ตำแหน่งที่จะบันทึก (GPS)', 'Location to record (GPS)')}</div>
        </div>
        {ok && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${q.tone}`}>{q.label}</span>}
        {loc.status !== 'loading' && (
          <button type="button" onClick={onRefresh} title={tr('หาตำแหน่งใหม่', 'Locate again')} aria-label={tr('หาตำแหน่งใหม่', 'Locate again')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><RefreshCw size={15} /></button>
        )}
      </div>

      {loc.status === 'loading' && (
        <div className="space-y-2 p-4" aria-live="polite">
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          <p className="text-[12px] text-slate-500">{tr('กำลังหาตำแหน่ง ถ้าเบราว์เซอร์ถาม ให้กด "อนุญาต"', 'Finding your location. If the browser asks, choose "Allow".')}</p>
        </div>
      )}

      {ok && (
        <div className="grid gap-0 sm:grid-cols-[150px_1fr]">
          <div className="relative h-32 border-b border-slate-100 sm:h-auto sm:min-h-[132px] sm:border-b-0 sm:border-r">
            <MapContainer
              key={coords}
              center={[loc.latitude, loc.longitude]}
              zoom={loc.accuracy && loc.accuracy > 400 ? 13 : 16}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
              attributionControl={false}
              className="h-full w-full"
              style={{ minHeight: 128 }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {loc.accuracy ? <Circle center={[loc.latitude, loc.longitude]} radius={loc.accuracy} pathOptions={{ color: '#1f4d3a', weight: 1, fillColor: '#34a86c', fillOpacity: 0.15 }} /> : null}
              <CircleMarker center={[loc.latitude, loc.longitude]} radius={6} pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#1f4d3a', fillOpacity: 1 }} />
            </MapContainer>
            <span className="pointer-events-none absolute bottom-1 right-1.5 z-[400] rounded bg-white/80 px-1 text-[9px] text-slate-500">© OpenStreetMap</span>
          </div>
          <dl className="grid content-center gap-2 px-4 py-3 text-[12.5px]">
            <div>
              <dt className="text-[11px] font-semibold text-slate-400">{tr('ที่อยู่', 'Address')}</dt>
              <dd className="font-semibold leading-5 text-slate-900">{loc.address || <span className="font-normal text-slate-500">{tr('กำลังค้นหาชื่อตำบล อำเภอ…', 'Looking up the district…')}</span>}</dd>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold text-slate-400">{tr('พิกัด (ละติจูด, ลองจิจูด)', 'Coordinates (lat, lng)')}</dt>
                <dd className="truncate font-mono text-[12.5px] font-semibold tabular-nums text-slate-800">{coords}</dd>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={copy} title={tr('คัดลอกพิกัด', 'Copy coordinates')} className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50">{copied ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}{copied ? tr('คัดลอกแล้ว', 'Copied') : tr('คัดลอก', 'Copy')}</button>
                <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer" title={tr('เปิดใน Google Maps', 'Open in Google Maps')} className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"><ExternalLink size={12} />Maps</a>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              {tr('อัปเดต', 'Updated')} {new Date(loc.at).toLocaleTimeString(tr('th-TH', 'en-GB'), { hour: '2-digit', minute: '2-digit' })}
              {loc.accuracy > 150 && <span className="text-amber-700"> · {tr('ตำแหน่งจากเครือข่าย อาจคลาดเคลื่อน ใช้มือถือที่เปิด GPS จะแม่นกว่า', 'Network-based, may be off; a phone with GPS is more precise')}</span>}
            </div>
          </dl>
        </div>
      )}

      {(loc.status === 'denied' || loc.status === 'unsupported' || loc.status === 'idle') && (
        <div className="px-4 py-3 text-[12.5px] leading-5 text-slate-600">
          {loc.status === 'unsupported'
            ? tr('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับตำแหน่ง ยังสแกนได้ แต่ผลจะไม่ขึ้นแผนที่การระบาด', 'This device or browser has no location. You can still scan, but results won’t appear on the outbreak map.')
            : (
              <>
                <p className="font-semibold text-amber-800">{tr('ยังไม่ได้รับอนุญาตให้ใช้ตำแหน่ง', 'Location permission is off')}</p>
                <p className="mt-1">{tr('ยังสแกนได้ แต่ผลจะไม่ขึ้นแผนที่การระบาด เปิดสิทธิ์ได้โดยกดไอคอนแม่กุญแจหน้าช่องที่อยู่เว็บ → ตำแหน่ง → อนุญาต แล้วกด "ลองอีกครั้ง"', 'You can still scan, but results won’t appear on the outbreak map. Click the padlock beside the address bar → Location → Allow, then try again.')}</p>
                <button type="button" onClick={onRefresh} className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1f4d3a] px-3 text-xs font-bold text-white transition hover:bg-[#173d2e]"><RefreshCw size={13} />{tr('ลองอีกครั้ง', 'Try again')}</button>
              </>
            )}
        </div>
      )}
    </section>
  );
}
