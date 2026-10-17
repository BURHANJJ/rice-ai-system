import { Link } from 'react-router-dom';
import { BookOpen, FileText, LockKeyhole, LogIn, MessageSquareText, UserPlus } from 'lucide-react';
import FooterScene from './landing/FooterScene';
import { useI18n } from '../lib/i18n';

const DEFAULT_SUB = { th: 'ระบบสนับสนุนการวินิจฉัยโรคข้าวด้วย AI', en: 'AI-assisted rice disease diagnosis' };
const DEFAULT_DESC = {
  th: 'แพลตฟอร์มสำหรับเชื่อมโยงข้อมูลภาคสนาม นักวิชาการ และผู้ดูแลระบบ เพื่อสนับสนุนการเฝ้าระวังโรคข้าวอย่างเป็นระบบ',
  en: 'A platform that connects field data, researchers and administrators to monitor rice diseases systematically.',
};

export default function PublicFooter({ subtitle = DEFAULT_SUB, description = DEFAULT_DESC }) {
  const { t } = useI18n();
  return (
    <footer className="relative overflow-hidden bg-[#0f172a] text-white">
      <FooterScene />
      <div className="absolute inset-x-0 top-[170px] bottom-0 opacity-[0.04] rb-soft-grid sm:top-[220px] lg:top-[260px]" />

      <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-5 sm:py-12 lg:px-6">
        <div className="grid gap-7 lg:grid-cols-[1.25fr_auto] lg:items-start">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <div className="flex items-center justify-center gap-3 sm:justify-start">
              <img src="/brand/app_icon.svg" alt="Rice AI logo" className="h-11 w-11 shrink-0 rounded-[0.85rem] object-contain shadow-xl shadow-black/25 ring-1 ring-white/10 sm:h-12 sm:w-12" />
              <div className="min-w-0 text-left">
                <div className="font-display text-xl font-bold leading-tight tracking-normal text-white sm:text-2xl">Rice AI</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-emerald-200/75 sm:text-sm">{t(subtitle)}</div>
              </div>
            </div>
            <p className="max-w-xl text-center text-xs font-medium leading-6 text-slate-400 sm:text-left sm:text-sm sm:leading-relaxed">
              {t(description)}
            </p>
            <div className="mt-1 w-full max-w-xl self-center text-left sm:self-auto">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold leading-5 text-slate-200">{t({ th: 'โครงงานวิชา', en: 'Course project' })}</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-extrabold tracking-[.14em] text-emerald-200">INDEPENDENT PROJECT</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">{t({ th: 'ผู้จัดทำ นายบุรฮาน จิ้วจวบ · อาจารย์ที่ปรึกษา ดร.ดารานาถ แต่นสุ่ย', en: 'Author: Mr. Burhan Jewjoub · Advisor: ดร.ดารานาถ แต่นสุ่ย' })}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{t({ th: 'สาขาวิชาคอมพิวเตอร์และวิทยาการสารสนเทศเพื่อการจัดการ · คณะวิทยาการสื่อสาร · มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี', en: 'Computer and Information Science for Management · Faculty of Communication Sciences · Prince of Songkla University, Pattani Campus' })}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            <p className="text-center text-[11px] font-extrabold uppercase tracking-normal text-slate-500 sm:text-right sm:text-xs">{t({ th: 'สำหรับผู้ใช้งานระบบ', en: 'For system users' })}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end sm:gap-3">
              <Link to="/apply-researcher" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 text-xs font-extrabold text-emerald-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20 sm:px-3 sm:text-sm">
                <UserPlus size={15} />
                {t({ th: 'ขอสิทธิ์นักวิชาการ', en: 'Request researcher access' })}
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 text-xs font-extrabold text-white transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/25 sm:px-3 sm:text-sm">
                <LogIn size={15} />
                {t({ th: 'เข้าสู่ระบบ', en: 'Sign in' })}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 text-center sm:mt-10 lg:grid-cols-[1fr_auto] lg:items-center lg:pr-28 lg:text-left">
          <div>
            <p className="text-xs font-medium text-slate-300 sm:text-sm">© 2026 Rice AI Project. All rights reserved.</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">Powered by Burhan Jewjoub</p>
            <p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-500 sm:text-[11px]">
              {t({
                th: 'หากนำรูปแบบเว็บไซต์นี้ไปใช้หรือดัดแปลง โปรดให้เครดิต Rice AI Project',
                en: 'If you reuse or adapt this website design, please credit Rice AI Project.',
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-slate-400 sm:justify-end">
            <Link to="/feedback" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20">
              <MessageSquareText size={14} />
              {t({ th: 'ส่งข้อเสนอแนะ', en: 'Share feedback' })}
            </Link>
            <Link to="/research-study" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20">
              <BookOpen size={14} />
              {t({ th: 'การค้นคว้าและการศึกษา', en: 'Research & Education' })}
            </Link>
            <Link to="/terms" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20">
              <FileText size={14} />
              {t({ th: 'เงื่อนไขการให้บริการ', en: 'Terms of Service' })}
            </Link>
            <Link to="/privacy" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20">
              <LockKeyhole size={14} />
              {t({ th: 'นโยบายความเป็นส่วนตัว', en: 'Privacy Policy' })}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}


