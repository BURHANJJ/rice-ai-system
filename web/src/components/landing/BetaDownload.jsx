import { useState } from 'react';
import { Download, CheckCircle2, MinusCircle, ShieldCheck, Copy, Check, Smartphone, ChevronDown } from 'lucide-react';
import { useBetaApp, countDownload } from '../../lib/betaApp';
import { useI18n } from '../../lib/i18n';

const WORKS = [
  { th: 'สแกนใบข้าว แยก 4 แบบ: ใบไหม้ ขอบใบแห้ง ใบสีส้ม ใบปกติ', en: 'Scan a leaf and tell 4 types apart: blast, bacterial leaf blight, tungro, healthy' },
  { th: 'AI ทำงานบนเครื่อง ไม่ต้องมีอินเทอร์เน็ตก็วิเคราะห์ได้', en: 'AI runs on the phone, so it works without internet' },
  { th: 'คำแนะนำการจัดการและสารเคมีตามกรมการข้าว', en: 'Management and chemical advice from the Rice Department' },
  { th: 'บันทึกผลพร้อมพิกัด GPS และดูประวัติย้อนหลัง', en: 'Save results with GPS location and see your history' },
  { th: 'แผนที่ระบาด 3 มิติ ระดับจังหวัดและอำเภอ', en: '3D outbreak map by province and district' },
  { th: 'คลังโรคข้าว สมุดแปลงนา และสภาพอากาศ', en: 'Disease library, field notebook and weather' },
  { th: 'เข้าสู่ระบบด้วยอีเมลหรือบัญชี Google', en: 'Sign in with email or Google' },
];

const NOT_YET = [
  { th: 'ต้องเข้าสู่ระบบครั้งแรกตอนมีอินเทอร์เน็ต หลังจากนั้นสแกนแบบออฟไลน์ได้', en: 'The first sign-in needs internet; after that you can scan offline' },
  { th: 'iPhone (iOS) ยังไม่มีรุ่นทดสอบ', en: 'No iPhone (iOS) beta yet' },
  { th: 'ยังไม่อยู่บน Google Play ต้องติดตั้งจากไฟล์ APK', en: 'Not on Google Play yet; install from the APK file' },
  { th: 'ประกาศเตือนการระบาดจะเข้ากล่องแจ้งเตือนในแอป อาจช้าได้ถึง 15 นาที (ยังไม่มี Push ทันที)', en: 'Outbreak notices arrive in the in-app inbox and can take up to 15 minutes (no instant push yet)' },
  { th: 'ความแม่นยำ 96.9% วัดจากชุดภาพทดสอบ รูปจากนาไทยอาจได้ผลต่างไป', en: '96.9% accuracy was measured on a test set; photos from Thai fields may score differently' },
];

const STEPS = [
  { th: 'กดดาวน์โหลดไฟล์ APK บนโทรศัพท์ Android', en: 'Download the APK on your Android phone' },
  { th: 'เปิดไฟล์ ถ้าเครื่องถาม ให้อนุญาต “ติดตั้งแอปที่ไม่รู้จัก” สำหรับเบราว์เซอร์', en: 'Open it; if asked, allow “Install unknown apps” for your browser' },
  { th: 'กดติดตั้ง แล้วเปิดแอป Rice AI สมัครหรือเข้าสู่ระบบ', en: 'Tap Install, open Rice AI, then sign up or sign in' },
];

const thaiDate = (iso, lang) => {
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

export default function BetaDownload() {
  const { t, lang } = useI18n();
  const { info, downloads } = useBetaApp();
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(info.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg overflow-hidden rounded-3xl border border-emerald-100 bg-white text-left shadow-xl shadow-emerald-950/5 lg:mx-0">
      {/* Download */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <img src="/brand/app_icon-512.png" alt="" className="h-14 w-14 shrink-0 rounded-2xl shadow-md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-bold text-gray-950">Rice AI</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">Beta</span>
            </div>
            <div className="mt-0.5 text-sm text-gray-500">
              {info ? t({ th: `เวอร์ชัน ${info.version} · ${info.size_mb} MB · Android ${info.min_android} ขึ้นไป`, en: `Version ${info.version} · ${info.size_mb} MB · Android ${info.min_android}+` }) : t({ th: 'กำลังโหลดข้อมูลรุ่น…', en: 'Loading release info…' })}
            </div>
          </div>
        </div>

        <a
          href={info?.file || '#'}
          download
          onClick={() => info && countDownload(info.version)}
          aria-disabled={!info}
          className={`mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--color-paddy-dark)] px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 ${info ? '' : 'pointer-events-none opacity-60'}`}
        >
          <Download size={20} /> {t({ th: 'ดาวน์โหลดรุ่นเบต้า (APK)', en: 'Download beta (APK)' })}
        </a>
        {info?.file_32bit && (
          <p className="mt-2 text-center text-xs text-gray-500">
            {t({ th: 'ติดตั้งไม่ได้บนเครื่องรุ่นเก่า?', en: 'Older phone?' })}{' '}
            <a href={info.file_32bit} download onClick={() => countDownload(info.version)} className="font-semibold text-[var(--color-paddy-dark)] underline underline-offset-2 hover:no-underline">
              {t({ th: `ดาวน์โหลดรุ่น 32 บิต (${info.size_mb_32bit} MB)`, en: `Get the 32-bit build (${info.size_mb_32bit} MB)` })}
            </a>
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50/70 px-3 py-2.5">
            <div className="font-display text-xl font-bold text-[var(--color-paddy-dark)]">{downloads == null ? '–' : downloads.toLocaleString(lang === 'en' ? 'en-US' : 'th-TH')}</div>
            <div className="text-xs font-medium text-gray-500">{t({ th: 'ครั้งที่ดาวน์โหลดแล้ว', en: 'Downloads' })}</div>
          </div>
          <div className="rounded-xl bg-emerald-50/70 px-3 py-2.5">
            <div className="font-display text-xl font-bold text-[var(--color-paddy-dark)]">{info ? thaiDate(info.released, lang) : '–'}</div>
            <div className="text-xs font-medium text-gray-500">{t({ th: 'อัปเดตล่าสุด', en: 'Last updated' })}</div>
          </div>
        </div>
      </div>

      {/* What works / not yet */}
      <div className="grid gap-5 border-t border-gray-100 bg-[var(--color-paper)]/60 p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <div className="mb-2.5 text-sm font-extrabold text-gray-900">{t({ th: 'ใช้ได้ในรุ่นนี้', en: 'In this release' })}</div>
          <ul className="space-y-2">
            {WORKS.map((w) => (
              <li key={w.th} className="flex gap-2 text-[13px] leading-snug text-gray-600"><CheckCircle2 size={16} className="mt-px shrink-0 text-emerald-600" />{t(w)}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2.5 text-sm font-extrabold text-gray-900">{t({ th: 'ยังไม่รองรับ / ข้อควรรู้', en: 'Not yet / good to know' })}</div>
          <ul className="space-y-2">
            {NOT_YET.map((w) => (
              <li key={w.th} className="flex gap-2 text-[13px] leading-snug text-gray-600"><MinusCircle size={16} className="mt-px shrink-0 text-amber-600" />{t(w)}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Install steps + integrity */}
      <div className="border-t border-gray-100 p-5 sm:px-6">
        <button type="button" onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps} className="flex w-full items-center justify-between text-sm font-bold text-gray-800">
          <span className="inline-flex items-center gap-2"><Smartphone size={16} className="text-[var(--color-paddy)]" /> {t({ th: 'วิธีติดตั้ง 3 ขั้นตอน', en: 'Install in 3 steps' })}</span>
          <ChevronDown size={18} className={`transition ${showSteps ? 'rotate-180' : ''}`} />
        </button>
        {showSteps && (
          <ol className="mt-3 space-y-2">
            {STEPS.map((w, i) => (
              <li key={w.th} className="flex gap-3 text-[13px] leading-snug text-gray-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">{i + 1}</span>{t(w)}
              </li>
            ))}
          </ol>
        )}
        {info?.sha256 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
            <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
            <span className="shrink-0 font-semibold">SHA-256</span>
            <code className="min-w-0 truncate font-mono">{info.sha256}</code>
            <button type="button" onClick={copyHash} aria-label={t({ th: 'คัดลอก SHA-256', en: 'Copy SHA-256' })} className="ml-auto shrink-0 rounded-md p-1 hover:bg-gray-200">
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
        )}
        {info?.release_page && (
          <a href={info.release_page} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-[var(--color-paddy-dark)] underline underline-offset-2 hover:no-underline">
            {t({ th: 'ดูรายละเอียดรุ่นและแจ้งปัญหาบน GitHub', en: 'Release notes and issue reports on GitHub' })}
          </a>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          {t({ th: 'รุ่นทดสอบสำหรับเก็บความคิดเห็นก่อนเปิดให้บริการจริง ผลจาก AI เป็นเครื่องมือช่วยตัดสินใจเบื้องต้น ควรปรึกษาเจ้าหน้าที่เกษตรก่อนใช้สารเคมี', en: 'A test release for gathering feedback before launch. AI results are a first-pass aid; consult an agricultural officer before using chemicals.' })}
        </p>
      </div>
    </div>
  );
}
