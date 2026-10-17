// Portal scanner (researchers and admins): the same in-browser V3 model and workspace as the
// public trial, with no daily limit. Each diagnosis is saved to Firestore exactly like the app does
// (diagnoses: compressed photo, result, advice, GPS + province), so it shows up in history, the
// live feed, the outbreak map and the data explorer.
import { useEffect, useState } from 'react';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { Cpu, Crosshair, History, MapPinOff, RadioTower, ShieldCheck } from 'lucide-react';
import GpsCard from '../components/scan/GpsCard';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { useDocTitle, useI18n } from '../lib/i18n';
import { thaiAddress } from '../lib/geo';
import { storageImage } from '../lib/trialScan';
import { ScanWorkspace } from './TryScan';
import DISEASES from '../data/trialDiseases.json';

function useLocation() {
  const [loc, setLoc] = useState({ status: 'idle' }); // idle | loading | ok | denied | unsupported
  const request = (fresh = false) => {
    if (!navigator.geolocation) { setLoc({ status: 'unsupported' }); return; }
    setLoc({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLoc({ status: 'ok', latitude, longitude, accuracy, at: pos.timestamp || Date.now() });
        const place = await thaiAddress(latitude, longitude);
        if (place) setLoc((cur) => (cur.status === 'ok' && cur.latitude === latitude ? { ...cur, ...place } : cur));
      },
      () => setLoc({ status: 'denied' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: fresh ? 0 : 60000 },
    );
  };
  useEffect(() => request(false), []);
  return [loc, () => request(true)];
}

export default function Scan() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const tr = (th, en) => (lang === 'en' ? en : th);
  useDocTitle({ th: 'สแกนโรคใบข้าว | Rice AI', en: 'Scan a rice leaf | Rice AI' });
  const [loc, requestLoc] = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const links = role === 'admin'
    ? [{ to: '/admin/live-feed', label: tr('ดูในคลังภาพ AI', 'Open in the AI image feed'), icon: RadioTower }]
    : [{ to: '/research/explorer', label: tr('ดูในสำรวจข้อมูล', 'Open in the data explorer'), icon: History }];

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
        ? { latitude: loc.latitude, longitude: loc.longitude, accuracy_m: loc.accuracy ? Math.round(loc.accuracy) : null, province: loc.province || null, address: loc.address || null }
        : null,
    };
    // The write is applied locally at once; the server ack may never come without a connection.
    const write = setDoc(ref, data).then(() => 'saved');
    const state = await Promise.race([write, new Promise((ok) => setTimeout(() => ok('queued'), 8000))]);
    return { state, id: ref.id };
  };

  const gpsCard = <GpsCard loc={loc} onRefresh={requestLoc} tr={tr} />;
  // Under a result: where it was recorded (or that it has no location).
  const resultTop = loc.status === 'ok' ? (
    <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600 ring-1 ring-slate-100">
      <Crosshair size={15} className="shrink-0 text-emerald-700" />
      <span className="min-w-0 flex-1 truncate"><span className="font-semibold text-slate-800">{loc.address || tr('พิกัดปัจจุบัน', 'Current position')}</span><span className="ml-1.5 font-mono text-[11.5px] text-slate-500">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</span></span>
      {loc.accuracy ? <span className="shrink-0 text-[11px] text-slate-400">±{Math.round(loc.accuracy)} {tr('ม.', 'm')}</span> : null}
    </div>
  ) : (
    <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800 ring-1 ring-amber-100">
      <MapPinOff size={15} className="shrink-0" />{tr('บันทึกโดยไม่มีพิกัด ผลนี้จะไม่ขึ้นแผนที่การระบาด', 'Saved without a location; it won’t appear on the outbreak map')}
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
        resultTop={resultTop}
        resultLinks={links}
        privacyNote={tr('AI วิเคราะห์ในเบราว์เซอร์ เมื่อได้ผลวินิจฉัย ระบบจะบันทึกภาพย่อ ผล และพิกัดเข้าระบบเหมือนในแอป', 'The AI runs in your browser. When there is a result, a reduced photo, the result and the location are saved, as in the app.')}
      />
    </div>
  );
}
