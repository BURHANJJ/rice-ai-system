import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Clock3, Leaf, Mail, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import PaddyField from '../components/landing/PaddyField';
import { useDocTitle } from '../lib/i18n';
import { CONTACT_EMAIL } from '../lib/legalContent';

function expectedTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  }).format(date);
}

export default function MaintenancePage({ maintenance }) {
  useDocTitle({ th: 'กำลังปรับปรุงระบบ | Rice AI', en: 'Scheduled maintenance | Rice AI' });
  const reopening = expectedTime(maintenance?.expectedAt);

  useEffect(() => {
    document.documentElement.lang = 'th';
  }, []);

  return (
    <main className="rice-maintenance relative isolate flex min-h-screen items-center overflow-hidden bg-[#f6f7f1] px-5 pt-10 pb-32 text-[#172d23] sm:px-8 sm:py-10">
      <div aria-hidden="true" className="rice-maintenance-lines pointer-events-none absolute inset-0 opacity-[0.38]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#dce9d9] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 -left-40 h-[32rem] w-[32rem] rounded-full bg-[#f1e8cf] blur-3xl" />
      <div aria-hidden="true" className="rice-maintenance-paddy pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[88px] opacity-55 sm:h-[180px] sm:opacity-85 lg:h-[220px]">
        <PaddyField />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <section className="order-1 max-w-2xl lg:order-1">
          <div className="mb-10 flex items-center gap-3">
            <img src="/brand/app_icon.svg" alt="" className="h-12 w-12 rounded-2xl shadow-lg shadow-emerald-950/10" />
            <div>
              <div className="font-display text-lg font-extrabold tracking-tight">Rice AI</div>
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#718277]">Rice health intelligence</div>
            </div>
          </div>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6e1d4] bg-white/80 px-3.5 py-2 text-xs font-extrabold text-[#315b43] shadow-sm shadow-emerald-950/[0.03]">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#78a86c] opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#5b8e57]" /></span>
            <Wrench size={14} /> กำลังปรับปรุงระบบ
          </div>

          <h1 className="font-display max-w-xl text-4xl font-extrabold leading-[1.2] tracking-tight text-[#183b2b] sm:text-5xl lg:text-[3.5rem]">
            เรากำลังทำให้ Rice AI <span className="text-[#648b55]">ดียิ่งขึ้น</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#627168] sm:text-lg">
            {maintenance?.message || 'เรากำลังปรับปรุงระบบเพื่อให้บริการได้ดียิ่งขึ้น ขออภัยในความไม่สะดวก และขอบคุณที่รอเรา'}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-[#1f4d3a] px-5 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-[#143327]">
              <RefreshCw size={16} /> ตรวจสอบอีกครั้ง
            </button>
            <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[#51675a] transition hover:bg-white hover:text-[#1f4d3a]">
              สำหรับผู้ดูแลระบบ <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="mt-12 flex items-center gap-3 border-t border-[#dce3d9] pt-5 text-xs font-semibold text-[#75847a]">
            <ShieldCheck size={16} className="text-[#72966b]" />
            <span>ข้อมูลของคุณยังปลอดภัยระหว่างการปรับปรุงระบบ</span>
          </div>
        </section>

        <section aria-label="สถานะการปรับปรุง" className="relative order-2 mx-auto w-full max-w-[480px] lg:order-2">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-white/90 via-[#e8eee5]/80 to-[#f1e8cf]/70 blur-xl" />
          <div className="rice-maintenance-card relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_30px_90px_-36px_rgba(27,58,39,.3)] backdrop-blur-xl sm:p-8">
            <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-[#dce8d8]" />
            <div aria-hidden="true" className="absolute -right-8 -top-12 h-40 w-40 rounded-full border border-[#e5ecdf]" />
            <div className="relative flex items-start justify-between gap-5">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#819087]">Service update</div>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#1e3b2c]">สถานะระบบ</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#4d7950]"><Leaf size={22} /></div>
            </div>

            <div className="relative mt-7 rounded-2xl bg-[#f5f7f2] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4eddf] text-[#50784e]"><Wrench size={18} /></span>
                <div>
                  <div className="text-sm font-extrabold text-[#284332]">อยู่ระหว่างดำเนินการ</div>
                  <div className="mt-0.5 text-xs font-medium text-[#7a897d]">ทีมงานกำลังดูแลระบบ</div>
                </div>
                <span className="ml-auto rounded-full bg-[#e8f0e4] px-2.5 py-1 text-[10px] font-extrabold text-[#517b50]">IN PROGRESS</span>
              </div>
              <div className="ml-5 mt-4 h-8 border-l border-dashed border-[#b9cbb4]" />
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#8a9c8a] ring-1 ring-[#e4e9df]"><Check size={18} /></span>
                <div>
                  <div className="text-sm font-bold text-[#53675a]">เปิดให้บริการอีกครั้ง</div>
                  <div className="mt-0.5 text-xs font-medium text-[#89968c]">{reopening ? reopening : 'จะแจ้งให้ทราบเมื่อพร้อมใช้งาน'}</div>
                </div>
                <Clock3 size={16} className="ml-auto text-[#9aaa9a]" />
              </div>
            </div>

            <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-[#e8ece4] bg-white/75 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f0e4] text-[#9a7a3f]"><Clock3 size={16} /></div>
              <p className="text-xs leading-5 text-[#77847a]">ขออภัยในความไม่สะดวก เราจะกลับมาให้บริการโดยเร็วที่สุด</p>
            </div>

            <div aria-hidden="true" className="rice-maintenance-field pointer-events-none absolute -bottom-2 right-0 h-24 w-40 opacity-30" />
          </div>
          <div className="relative mt-4 text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#96a297]">Rice AI · Better insights for healthier fields</div>
        </section>

        <footer className="order-3 flex flex-col gap-3 border-t border-[#dce3d9] pt-5 text-sm sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
          <div>
            <div className="font-extrabold text-[#385342]">ต้องการความช่วยเหลือ?</div>
            <p className="mt-0.5 text-xs leading-5 text-[#77847a]">ติดต่อทีมงาน Rice AI ได้ทางอีเมล เราจะช่วยดูแลและตอบกลับโดยเร็ว</p>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('สอบถามเกี่ยวกับ Rice AI')}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-[#d8e2d5] bg-white/80 px-4 py-2.5 text-sm font-bold text-[#315b43] shadow-sm transition hover:border-[#b9cdb5] hover:bg-white sm:self-auto"
          >
            <Mail size={16} /> {CONTACT_EMAIL} <ArrowUpRight size={14} className="text-[#829587]" />
          </a>
        </footer>
      </div>
    </main>
  );
}
