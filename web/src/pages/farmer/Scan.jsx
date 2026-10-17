// Portal scanner (farmers, researchers, admins): the same in-browser V3 model and workspace as the
// public trial, with no daily limit. Each diagnosis is saved to Firestore exactly like the app does
// (diagnoses: compressed photo, result, advice, GPS + province), so it shows up in history, the
// live feed, the outbreak map and the data explorer.
import { useEffect, useState } from 'react';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { Cpu, Crosshair, History, Loader2, MapPin, MapPinOff, RadioTower, ShieldCheck } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useDocTitle, useI18n } from '../../lib/i18n';
import { thaiAddress } from '../../lib/geo';
import { storageImage } from '../../lib/trialScan';
import { ScanWorkspace } from '../TryScan';
import DISEASES from '../../data/trialDiseases.json';

function useLocation() {
  const [loc, setLoc] = useState({ status: 'idle' }); // idle | loading | ok | denied | unsupported
  const request = () => {
    if (!navigator.geolocation) { setLoc({ status: 'unsupported' }); return; }
    setLoc({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLoc({ status: 'ok', latitude, longitude });
        const place = await thaiAddress(latitude, longitude);
        if (place) setLoc((cur) => (cur.status === 'ok' ? { ...cur, ...place } : cur));
      },
      () => setLoc({ status: 'denied' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  useEffect(request, []);
  return [loc, request];
}

export default function Scan() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const tr = (th, en) => (lang === 'en' ? en : th);
  useDocTitle({ th: 'สแกนโรคใบข้าว | Rice AI', en: 'Scan a rice leaf | Rice AI' });
  const [loc, requestLoc] = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const links = role === 'admin'
    ? [{ to: '/admin/live-feed', label: tr('ดูในฟีดผลสแกนสด', 'Open in the live feed'), icon: RadioTower }]
    : role === 'researcher'
      ? [{ to: '/research/explorer', label: tr('ดูในสำรวจข้อมูล', 'Open in the data explorer'), icon: History }]
      : [{ to: '/app/history', label: tr('ดูประวัติการสแกน', 'Open scan history'), icon: History }];

  /** Save like the app: one diagnoses document per result. */
  const save = async (r, file) => {
    if (!user?.uid) throw new Error('not signed in');
    const info = DISEASES[r.code] || {};
    const ref = doc(collection(db, 'diagnoses'));
    const data = {
      user_id: user.uid,
      disease_code: r.code,
      disease_name: info.name || r.code,
      confidence: r.confidence,
      diag_date: serverTimestamp(),
      image_base64: await storageImage(file),
      advice: (info.advice || []).map((a) => ({ treatment: a.treatment, chemical_name: a.chemical, dosage: a.dosage })),
      ai_source: 'web-onnx',
      location: loc.status === 'ok'
        ? { latitude: loc.latitude, longitude: loc.longitude, province: loc.province || null, address: loc.address || null }
        : null,
    };
    // The write is applied locally at once; the server ack may never come without a connection.
    const write = setDoc(ref, data).then(() => 'saved');
    const state = await Promise.race([write, new Promise((ok) => setTimeout(() => ok('queued'), 8000))]);
    return { state, id: ref.id };
  };

  const gps = {
    idle: [MapPin, 'text-slate-500', tr('ยังไม่ได้ระบุตำแหน่ง', 'Location not set')],
    loading: [Loader2, 'text-sky-700', tr('กำลังหาตำแหน่ง…', 'Finding your location…')],
    ok: [Crosshair, 'text-emerald-700', loc.address || (loc.latitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : '')],
    denied: [MapPinOff, 'text-amber-700', tr('ไม่ได้อนุญาตตำแหน่ง ยังสแกนได้ แต่ผลจะไม่ขึ้นแผนที่', 'Location blocked: you can scan, but results won’t appear on the map')],
    unsupported: [MapPinOff, 'text-amber-700', tr('อุปกรณ์นี้ไม่รองรับตำแหน่ง', 'This device has no location')],
  }[loc.status];
  const [GpsIcon, gpsColor, gpsText] = gps;

  const gpsCard = (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100 ${gpsColor}`}><GpsIcon size={18} className={loc.status === 'loading' ? 'animate-spin' : ''} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tr('ตำแหน่งที่จะบันทึก', 'Location to save')}</div>
        <div className={`truncate text-[13.5px] font-semibold ${gpsColor}`}>{gpsText}</div>
      </div>
      {loc.status !== 'loading' && loc.status !== 'ok' && (
        <button type="button" onClick={requestLoc} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100">{tr('ลองอีกครั้ง', 'Retry')}</button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">{tr('สแกนโรคใบข้าว', 'Scan a rice leaf')}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{tr('ถ่ายหรือเลือกรูปใบข้าว AI รุ่น V3 ตัวเดียวกับในแอปจะวิเคราะห์ในเบราว์เซอร์ แล้วบันทึกผลพร้อมพิกัดเข้าระบบ', 'Take or choose a rice leaf photo. The same V3 AI as the app runs in your browser, then the result is saved with its location.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><Cpu size={14} />{tr('AI ในเบราว์เซอร์ · พร้อมใช้', 'In-browser AI · ready')}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"><ShieldCheck size={14} />{tr('ไม่จำกัดจำนวนครั้ง', 'No daily limit')}</span>
        </div>
      </div>
      <ScanWorkspace
        portal
        onDiagnosis={save}
        idleTop={gpsCard}
        resultLinks={links}
        privacyNote={tr('AI วิเคราะห์ในเบราว์เซอร์ เมื่อได้ผลวินิจฉัย ระบบจะบันทึกภาพย่อ ผล และพิกัดเข้าระบบเหมือนในแอป', 'The AI runs in your browser. When there is a result, a reduced photo, the result and the location are saved, as in the app.')}
      />
    </div>
  );
}
