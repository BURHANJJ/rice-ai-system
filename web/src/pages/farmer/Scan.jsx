import { useRef, useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';
import { 
  Camera, UploadCloud, MapPin, Loader2, AlertCircle, 
  Leaf, Info, ShieldAlert, Activity, CheckCircle2, FileSearch, Navigation, ServerCrash, Zap
} from 'lucide-react';

const DISEASE_COLORS = {
  'BLAST': 'text-rose-600 bg-rose-50 border-rose-200',
  'BLB': 'text-orange-600 bg-orange-50 border-orange-200',
  'TUNGRO': 'text-amber-600 bg-amber-50 border-amber-200',
  'HEALTHY': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'DEFAULT': 'text-slate-600 bg-slate-50 border-slate-200'
};

export default function Scan() {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  
  const [location, setLocation] = useState(null);
  const [locStatus, setLocStatus] = useState('idle'); // idle, loading, success, error
  const [locError, setLocError] = useState('');
  
  const [aiStatus, setAiStatus] = useState({ loading: true, online: false, data: null });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-request location & check AI Status on mount
  useEffect(() => {
    requestLocation();
    checkAiStatus();
    
    // Poll AI status every 15 seconds
    const interval = setInterval(checkAiStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkAiStatus = async () => {
    try {
      const { data } = await api.get('/ai-status');
      setAiStatus({
        loading: false,
        online: data.status === 'online',
        data: data
      });
    } catch (err) {
      setAiStatus({
        loading: false,
        online: false,
        data: { model_status: 'unreachable' }
      });
    }
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError('');
  };

  const requestLocation = () => {
    setLocStatus('loading');
    setLocError('');
    if (!navigator.geolocation) {
      setLocStatus('error');
      setLocError('อุปกรณ์นี้ไม่รองรับ GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocStatus('success');
      },
      () => {
        setLocStatus('error');
        setLocError('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง (ยังสามารถวิเคราะห์ภาพได้)');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const analyze = async () => {
    if (!file) { setError('กรุณาอัปโหลดภาพใบข้าวก่อน'); return; }
    if (!aiStatus.online) { setError('ระบบ AI ไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'); return; }
    
    setBusy(true);
    setError('');
    
    try {
      // 1. Compress image client-side (to match mobile app behavior and improve AI consistency)
      const compressedFile = await compressImage(file);

      // 2. Call Node Backend (which calls FastAPI AI)
      const fd = new FormData();
      fd.append('image', compressedFile);
      if (location) {
        fd.append('latitude', location.latitude);
        fd.append('longitude', location.longitude);
      }
      
      const { data } = await api.post('/diagnosis/predict', fd, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      // 2. Save directly to Firestore for Live Feed & Data Explorer synchronization
      const diagnosisData = {
        disease_code: data.disease_code,
        disease_name: data.disease_name,
        confidence: data.confidence,
        image_base64: data.compressed_base64,
        location: data.location || null,
        diag_date: serverTimestamp(),
        user_id: user?.uid || 'anonymous',
        source: data.ai_source
      };

      const docRef = await addDoc(collection(db, 'diagnoses'), diagnosisData);
      
      // Attach the new ID to the data we show
      data.diag_id = docRef.id;
      
      // 3. Set Result State for UI
      setResult(data);
      
      // Auto scroll to result on mobile
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || 'การวิเคราะห์ล้มเหลว ตรวจสอบการเชื่อมต่อหรือลองภาพอื่น';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Camera className="text-[var(--color-paddy)]" size={32} />
            ระบบวิเคราะห์โรคใบข้าวด้วย AI
          </h1>
          <p className="text-gray-500 text-sm mt-2 ml-11 leading-relaxed">
            ถ่ายภาพหรืออัปโหลดรูปใบข้าวที่มีอาการผิดปกติ ระบบ AI จะช่วยวินิจฉัยโรคและแนะนำวิธีการรักษาภายใน 5 วินาที
          </p>
        </div>
        
        {/* AI Status Badge */}
        <div className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm ${
          aiStatus.loading ? 'bg-gray-50 border-gray-200 text-gray-500' :
          aiStatus.online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {aiStatus.loading ? (
            <><Loader2 size={16} className="animate-spin" /> <span className="text-sm font-bold">กำลังเชื่อมต่อ AI...</span></>
          ) : aiStatus.online ? (
            <><Zap size={16} className="text-emerald-500" /> <span className="text-sm font-bold">AI พร้อมใช้งาน</span></>
          ) : (
            <><ServerCrash size={16} className="text-rose-500" /> <span className="text-sm font-bold">AI ออฟไลน์</span></>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Left Column: Upload */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-paddy)] text-white text-xs">1</span>
                อัปโหลดภาพใบข้าว
              </h2>
              {file && !busy && (
                <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors">
                  ล้างภาพ
                </button>
              )}
            </div>
            
            <div className="p-6">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onPick} className="hidden" />
              
              <div
                onClick={() => !busy && aiStatus.online && fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl h-72 flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
                  busy ? 'opacity-70 cursor-not-allowed border-gray-300 bg-gray-50' : 
                  !aiStatus.online ? 'opacity-50 cursor-not-allowed border-gray-300 bg-gray-100 grayscale' :
                  preview ? 'border-[var(--color-paddy)] bg-[var(--color-paddy)]/5 cursor-pointer' : 
                  'border-gray-300 bg-gray-50 hover:border-[var(--color-paddy)] hover:bg-[var(--color-paddy)]/5 cursor-pointer'
                }`}
              >
                {!aiStatus.online && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[2px]">
                    <ServerCrash size={32} className="text-rose-500 mb-2" />
                    <span className="font-bold text-gray-800">ระบบ AI ปิดปรับปรุงชั่วคราว</span>
                  </div>
                )}
                
                {preview ? (
                  <>
                    <img src={preview} alt="preview" className="h-full w-full object-contain z-10" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
                      <div className="bg-white/90 text-gray-900 px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <Camera size={18} /> เปลี่ยนรูปภาพ
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 flex flex-col items-center p-4">
                    <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-[var(--color-paddy)]">
                      <UploadCloud size={32} />
                    </div>
                    <p className="font-bold text-gray-700 text-lg">กดเพื่อถ่ายภาพ หรือเลือกจากเครื่อง</p>
                    <p className="text-xs text-gray-400 mt-2">รองรับไฟล์ JPG, PNG, WEBP แนะนำให้ถ่ายในที่แสงสว่างเพียงพอ</p>
                  </div>
                )}
              </div>

              {/* GPS Status */}
              <div className="mt-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation size={12} /> ข้อมูลพิกัด (GPS)
                  </span>
                  {locStatus === 'loading' && <span className="text-sm font-medium text-blue-600 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> กำลังค้นหาตำแหน่ง...</span>}
                  {locStatus === 'success' && <span className="text-sm font-semibold text-emerald-600 flex items-center gap-2"><CheckCircle2 size={16} /> ระบุตำแหน่งสำเร็จ</span>}
                  {locStatus === 'error' && <span className="text-sm font-medium text-amber-600 flex items-center gap-2"><AlertCircle size={16} /> {locError}</span>}
                  {locStatus === 'idle' && <span className="text-sm font-medium text-gray-500">ยังไม่ระบุตำแหน่ง</span>}
                </div>
                {locStatus !== 'success' && locStatus !== 'loading' && (
                  <button onClick={requestLocation} className="text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 text-gray-700">
                    ลองใหม่
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-2 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                onClick={analyze}
                disabled={busy || !file || !aiStatus.online}
                className="mt-6 w-full bg-[var(--color-paddy-dark)] hover:bg-[var(--color-paddy)] text-white rounded-xl py-4 text-base font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden"
              >
                {busy ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    กำลังประมวลผลด้วย AI...
                  </>
                ) : (
                  <>
                    <Activity size={20} />
                    เริ่มการวิเคราะห์โรค
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-paddy)] text-white text-xs">2</span>
                ผลการวินิจฉัย (Diagnosis Result)
              </h2>
            </div>
            
            <div className="p-0 flex-1 flex flex-col relative">
              {!result && !busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                  <FileSearch size={64} className="mb-4 opacity-20" />
                  <p className="text-lg font-bold text-gray-600">ยังไม่มีผลการวิเคราะห์</p>
                  <p className="text-sm mt-2">อัปโหลดภาพใบข้าวแล้วกด "เริ่มการวิเคราะห์โรค" เพื่อดูผลลัพธ์</p>
                </div>
              )}

              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <Loader2 size={48} className="animate-spin text-[var(--color-paddy)] mb-4" />
                  <div className="font-bold text-gray-700 animate-pulse">กำลังส่งข้อมูลให้ AI ประมวลผล...</div>
                  <div className="text-xs text-gray-500 mt-2">ใช้เวลาประมาณ 2-5 วินาที</div>
                </div>
              )}

              {result && !busy && (
                <div className="p-6 flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
                  {/* Header Result */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ตรวจพบโรค</div>
                      <h3 className="font-display text-2xl font-bold text-gray-900 leading-tight">
                        {result.disease_name}
                      </h3>
                      {result.disease_code && (
                        <div className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${DISEASE_COLORS[result.disease_code] || DISEASE_COLORS['DEFAULT']}`}>
                          {result.disease_code}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ความแม่นยำ AI</div>
                      <div className="flex flex-col items-end">
                        <div className="text-3xl font-black text-gray-800 flex items-baseline gap-1">
                          {result.confidence.toFixed(1)}<span className="text-lg">%</span>
                        </div>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${result.confidence >= 90 ? 'bg-emerald-500' : result.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${result.confidence}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning Box */}
                  {result.ai_warning && (
                    <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3 text-sm text-amber-800">
                      <ShieldAlert size={20} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">ข้อควรระวัง!</span>
                        {result.ai_warning}
                      </div>
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-6 flex-1">
                    {result.symptoms && (
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2 border-b border-gray-100 pb-2">
                          <AlertCircle size={16} className="text-rose-500" /> อาการที่พบ (Symptoms)
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                          {result.symptoms}
                        </p>
                      </div>
                    )}

                    {result.advice?.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2 border-b border-gray-100 pb-2">
                          <Leaf size={16} className="text-emerald-500" /> คำแนะนำเบื้องต้น (Treatments)
                        </h4>
                        <ul className="space-y-2">
                          {result.advice.map((a, i) => (
                            <li key={a.advice_id || i} className="text-sm text-gray-600 flex items-start gap-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0 mt-0.5">{i+1}</span>
                              <span className="leading-relaxed">{a.treatment || a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="mt-8 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin size={14} />
                      <span className="truncate">{result.location?.province || 'ไม่ระบุพื้นที่'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-xs text-gray-500 font-mono">
                      {new Date(result.diagnosis_date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  
                  {result.disclaimer && (
                    <div className="mt-4 flex items-start gap-2 text-[10px] text-gray-400 bg-gray-50 p-2.5 rounded-lg">
                      <Info size={12} className="shrink-0 mt-0.5" />
                      <span>{result.disclaimer}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
