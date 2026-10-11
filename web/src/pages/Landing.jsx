import { Link } from 'react-router-dom';
import khaoHomMascot from '../../assets/khao_hom_scan.svg';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import AppTour from '../components/landing/AppTour';
import BetaDownload from '../components/landing/BetaDownload';
import PaddyField from '../components/landing/PaddyField';
import { Phone, CountUp } from '../components/landing/LandingKit';
import { spotlight, useCycle, useRevealAll, useTilt } from '../components/landing/landingHooks';
import { useI18n, useDocTitle } from '../lib/i18n';
import { Cpu, Cloud, ArrowRight, ShieldCheck, PlayCircle, Apple, Smartphone, UserRoundCheck, CheckCircle2, Sparkles, MousePointerClick } from 'lucide-react';

const HERO_SCREENS = ['Scan', 'Result', 'Home'];
const HERO_CAPTION = [{ th: 'วางใบข้าวในกรอบ', en: 'Frame the leaf' }, { th: 'AI วิเคราะห์เสร็จ', en: 'AI result ready' }, { th: 'หน้าหลัก · อากาศจริง', en: 'Home · live weather' }];

const GALLERY = [
  ['Main', { th: 'เข้าสู่ระบบ', en: 'Sign in' }],
  ['Home', { th: 'หน้าหลัก', en: 'Home' }],
  ['Scan', { th: 'สแกนใบข้าว', en: 'Leaf scan' }],
  ['Result', { th: 'ผลวิเคราะห์', en: 'Result' }],
  ['Outbreak3D', { th: 'แผนที่ 3 มิติ', en: '3D map' }],
  ['Fields', { th: 'สมุดแปลงนา', en: 'Field notebook' }],
  ['FieldDetail', { th: 'รายละเอียดแปลง', en: 'Field details' }],
  ['Wiki', { th: 'คลังโรคข้าว', en: 'Disease library' }],
  ['WikiDetail', { th: 'ข้อมูลโรค', en: 'Disease details' }],
  ['Notifications', { th: 'แจ้งเตือน', en: 'Alerts' }],
  ['Outbreak3DDistricts', { th: 'รายอำเภอ', en: 'Districts' }],
  ['Onboarding1', { th: 'เริ่มต้นใช้งาน', en: 'Getting started' }],
];

const STATS = [
  { to: 4, label: { th: 'ประเภทที่ AI ตรวจได้', en: 'classes the AI detects' }, sub: { th: 'ใบไหม้ · ขอบใบแห้ง · ใบสีส้ม · ปกติ', en: 'Blast · Leaf blight · Tungro · Healthy' } },
  { to: 77, label: { th: 'จังหวัดบนแผนที่ระบาด', en: 'provinces on the outbreak map' }, sub: { th: 'เจาะดูได้ถึงระดับอำเภอ', en: 'Drill down to districts' } },
  { to: 6, label: { th: 'ฟีเจอร์หลักในแอป', en: 'core app features' }, sub: { th: 'สแกน อากาศ แผนที่ แปลงนา คลังโรค แจ้งเตือน', en: 'Scan, weather, map, fields, library, alerts' } },
  { to: 3, label: { th: 'บทบาทผู้ใช้งาน', en: 'user roles' }, sub: { th: 'เกษตรกร · นักวิชาการ · ผู้ดูแลระบบ', en: 'Farmers · Researchers · Administrators' } },
];

const PILLARS = [
  {
    icon: Cpu, no: '01', tone: 'emerald', eyebrow: 'AI Vision Analysis', title: { th: 'วิเคราะห์โรคจากภาพใบข้าว', en: 'Disease analysis from leaf photos' },
    body: { th: 'คัดกรองอาการจากภาพถ่ายภาคสนาม แล้วสรุปผลให้อ่านง่าย เพื่อช่วยให้ตัดสินใจเบื้องต้นได้เร็วขึ้น', en: 'Screens symptoms in field photos and summarises the result clearly, so first decisions come faster.' },
    items: [{ th: 'ตรวจจับอาการจากภาพ', en: 'Detects symptoms from photos' }, { th: 'สรุปผลแบบเข้าใจง่าย', en: 'Plain-language results' }, { th: 'เหมาะกับข้อมูลภาคสนาม', en: 'Built for field conditions' }],
  },
  {
    icon: Cloud, no: '02', tone: 'blue', eyebrow: 'Cloud Sync & Monitoring', title: { th: 'รวมข้อมูลภาคสนามแบบทันที', en: 'Field data, gathered instantly' },
    body: { th: 'บันทึกผลการสแกนขึ้นระบบกลาง พร้อมข้อมูลพื้นที่และเวลา เพื่อดูภาพรวมและติดตามแนวโน้มการระบาด', en: 'Scan results reach a central system with place and time, giving an overview and outbreak trends.' },
    items: [{ th: 'ซิงก์ข้อมูลขึ้น Cloud', en: 'Synced to the cloud' }, { th: 'ดูสถานการณ์แบบรวมศูนย์', en: 'One shared picture' }, { th: 'ใช้ติดตามแนวโน้มพื้นที่เสี่ยง', en: 'Tracks at-risk areas' }],
  },
  {
    icon: ShieldCheck, no: '03', tone: 'amber', eyebrow: 'Enterprise Security', title: { th: 'ควบคุมสิทธิ์และข้อมูลอย่างรัดกุม', en: 'Tight control of access and data' },
    body: { th: 'แยกบทบาทผู้ใช้งานอย่างเป็นระบบ เพื่อปกป้องข้อมูลผู้ใช้ ข้อมูลพื้นที่ และข้อมูลประกอบการวิเคราะห์', en: 'Clear user roles protect personal data, location data and analysis records.' },
    items: ['Role-Based Access', { th: 'แยกสิทธิ์เจ้าหน้าที่/นักวิชาการ', en: 'Separate staff and researcher rights' }, { th: 'ออกแบบเพื่อข้อมูลอ่อนไหว', en: 'Designed for sensitive data' }],
  },
];

const PILLAR_TONE = {
  emerald: { bar: 'from-emerald-300 via-emerald-500 to-lime-300', icon: 'bg-emerald-100 text-emerald-600', chip: 'border-emerald-100 bg-emerald-50 text-emerald-700', eyebrow: 'text-emerald-700/75', check: 'text-emerald-500', spot: 'rgba(16,185,129,0.12)' },
  blue: { bar: 'from-sky-300 via-blue-500 to-cyan-300', icon: 'bg-blue-100 text-blue-600', chip: 'border-blue-100 bg-blue-50 text-blue-700', eyebrow: 'text-blue-700/75', check: 'text-blue-500', spot: 'rgba(59,130,246,0.12)' },
  amber: { bar: 'from-amber-300 via-orange-400 to-yellow-300', icon: 'bg-amber-100 text-amber-600', chip: 'border-amber-100 bg-amber-50 text-amber-700', eyebrow: 'text-amber-700/75', check: 'text-amber-500', spot: 'rgba(245,158,11,0.14)' },
};

function HeroStage() {
  const { t } = useI18n();
  const tilt = useTilt(7);
  const [i, setI] = useCycle(HERO_SCREENS.length, 3200);
  return (
    <div ref={tilt} className="rb-stage relative mx-auto aspect-[1/1.02] w-full max-w-[560px]">
      <div className="absolute inset-[6%] rounded-[2.5rem] bg-gradient-to-br from-emerald-100/90 via-white to-amber-50 shadow-2xl shadow-emerald-950/10 ring-1 ring-emerald-100" />
      <div className="absolute inset-[6%] overflow-hidden rounded-[2.5rem]">
        <div className="absolute inset-0 rb-soft-grid opacity-50" />
        <div className="rb-stage-glare absolute inset-0" />
      </div>

      <div className="rb-stage-layer absolute inset-0" style={{ '--d': '30px' }}>
        {/* back phone */}
        <Phone screens={['Outbreak3D']} className="absolute left-[9%] top-[17%] w-[34%] -rotate-[9deg] opacity-95 shadow-xl" />
      </div>

      <div className="rb-stage-layer absolute inset-0" style={{ '--d': '60px' }}>
        <button type="button" onClick={() => setI((v) => (v + 1) % HERO_SCREENS.length)} aria-label={t({ th: 'เปลี่ยนหน้าจอตัวอย่าง', en: 'Show next screen' })} className="absolute left-1/2 top-[7%] w-[38%] -translate-x-[36%] cursor-pointer">
          <Phone screens={HERO_SCREENS} active={i} glow>
            {i === 0 && <span className="rb-scanline" />}
          </Phone>
        </button>
      </div>

      <div className="rb-stage-layer absolute inset-0" style={{ '--d': '95px' }}>
        <div key={`c${i}`} className="rb-pop absolute right-[3%] top-[30%] flex items-center gap-3 rounded-2xl border border-white bg-white/95 p-3 pr-4 shadow-xl shadow-emerald-950/15 backdrop-blur">
          {i === 1 ? (
            <>
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-xs font-black text-red-700 ring-4 ring-red-100">92%</span>
              <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">{t({ th: 'ผลวิเคราะห์', en: 'Result' })}</span><span className="block text-sm font-extrabold text-gray-900">{t({ th: 'พบโรคใบไหม้', en: 'Rice blast found' })}</span></span>
            </>
          ) : i === 2 ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><Cloud size={22} /></span>
              <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">{t({ th: 'ความชื้น 91%', en: 'Humidity 91%' })}</span><span className="block text-sm font-extrabold text-gray-900">{t({ th: 'เสี่ยงโรคระบาด', en: 'Outbreak risk' })}</span></span>
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Cpu size={22} /></span>
              <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">{t({ th: 'AI พร้อม', en: 'AI ready' })}</span><span className="block text-sm font-extrabold text-gray-900">{t({ th: 'ตรวจได้ 4 ประเภท', en: 'Detects 4 classes' })}</span></span>
            </>
          )}
        </div>

        <div className="absolute left-[2%] top-[62%] hidden rounded-2xl border border-white bg-white/95 p-3.5 shadow-xl shadow-emerald-950/10 backdrop-blur sm:block rb-float-slow">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-paddy)]"><ShieldCheck size={19} /></span>
            <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">Rice Protection</span><span className="block text-sm font-extrabold text-gray-900">{t({ th: 'พร้อมเฝ้าระวังโรคข้าว', en: 'Watching over your rice' })}</span></span>
          </div>
        </div>

        <img src="/app/khao_hom_hello.webp" alt={t({ th: 'น้องข้าวหอม', en: 'Khao Hom, the Rice AI mascot' })} className="rb-peek pointer-events-none absolute bottom-[9%] right-[2%] w-[25%] drop-shadow-[0_18px_24px_rgba(20,83,45,0.28)]" />
      </div>

      <div className="absolute -bottom-[1%] left-1/2 z-10 flex -translate-x-1/2 items-center whitespace-nowrap gap-2 rounded-full border border-emerald-100 bg-white/90 px-3 py-1.5 text-xs font-extrabold text-[var(--color-paddy)] shadow-md backdrop-blur">
        {HERO_SCREENS.map((s, k) => (
          <span key={s} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? 'w-5 bg-[var(--color-paddy)]' : 'w-1.5 bg-emerald-900/20'}`} />
        ))}
        <span className="ml-1">{t(HERO_CAPTION[i])}</span>
      </div>
    </div>
  );
}

function SectionHead({ badge, icon: Icon = Sparkles, title, copy, dark = false }) {
  return (
    <div className="rv mx-auto mb-12 max-w-3xl text-center">
      <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold uppercase ${dark ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-emerald-100 bg-white text-[var(--color-paddy)] shadow-sm shadow-emerald-950/5'}`}>
        <Icon size={15} /> {badge}
      </div>
      <h2 className={`font-display text-3xl font-extrabold leading-tight sm:text-5xl ${dark ? 'text-white' : 'text-gray-950'}`}>{title}</h2>
      {copy && <p className={`mx-auto mt-5 max-w-2xl text-base font-medium leading-8 lg:text-lg ${dark ? 'text-emerald-100/75' : 'text-gray-600'}`}>{copy}</p>}
    </div>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  useDocTitle({ th: 'Rice AI | ระบบวินิจฉัยโรคข้าวอัจฉริยะ', en: 'Rice AI | Smart rice disease diagnosis' });
  const page = useRevealAll();
  return (
    <div ref={page} className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--color-paper)] font-sans text-gray-800">
      <PublicHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="rice-hero relative w-full max-w-full overflow-hidden px-3 pt-8 sm:px-5 sm:pt-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_30%,rgba(252,211,77,0.18),transparent_30%),radial-gradient(circle_at_86%_26%,rgba(52,211,153,0.24),transparent_34%)]" />
        <div className="absolute inset-0 rb-soft-grid opacity-60 [mask-image:linear-gradient(to_bottom,black_55%,transparent_85%)]" />
        <PaddyField className="rice-hero-field absolute inset-x-0 bottom-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--color-paper)]" />
        <div className="rice-hero-inner relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div className="min-w-0 rb-reveal">
            <div className="rice-hero-kicker mb-4 sm:mb-5">
              <ShieldCheck size={16} />
              {t({ th: 'AI ตรวจโรคใบข้าว · แม่นยำ 97.9%', en: 'AI rice-leaf diagnosis · 97.9% accurate' })}
            </div>
            <h1 className="rice-hero-title">
              Rice AI<br />
              <span className="rb-shiny-text">{t({ th: 'ปกป้องนาข้าวด้วยปัญญาประดิษฐ์', en: 'Protecting rice fields with AI' })}</span>
            </h1>
            <p className="rice-hero-copy">
              {t({ th: 'แพลตฟอร์มวิเคราะห์โรคข้าวสำหรับเกษตรกรและนักวิชาการ เชื่อมข้อมูลภาคสนามสู่ส่วนกลางแบบ Real-time เพื่อช่วยติดตาม วินิจฉัย และรับมือโรคระบาดได้แม่นยำขึ้น', en: 'A rice disease platform for farmers and researchers. Field data flows to one place in real time, so outbreaks are tracked, diagnosed and handled more precisely.' })}
            </p>

            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
              <a
                href="#app"
                aria-label={t({ th: 'แอปมือถือสำหรับเกษตรกร ดาวน์โหลดรุ่นเบต้า', en: 'Mobile app for farmers: download the beta' })}
                className="group rb-glare relative flex items-center gap-4 overflow-hidden rounded-2xl bg-[var(--color-paddy)] p-4 pr-5 text-white shadow-lg shadow-emerald-900/25 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--color-paddy-dark)] hover:shadow-xl hover:shadow-emerald-900/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105"><Smartphone size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-normal text-emerald-100/90">{t({ th: 'แอปมือถือ · Android', en: 'Mobile app · Android' })}</span>
                  <span className="mt-0.5 block whitespace-nowrap text-base font-extrabold leading-snug">{t({ th: 'สำหรับเกษตรกร', en: 'For farmers' })}</span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-emerald-100/80">{t({ th: 'ดาวน์โหลดรุ่นเบต้า', en: 'Download the beta' })}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 opacity-80 transition-transform duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </a>

              <Link
                to="/login"
                aria-label={t({ th: 'เว็บพอร์ทัลสำหรับนักวิชาการและเจ้าหน้าที่ เข้าสู่ระบบ', en: 'Web portal for researchers and staff: sign in' })}
                className="group rb-glare relative flex items-center gap-4 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white p-4 pr-5 text-gray-900 shadow-lg shadow-emerald-950/5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-950/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-paddy)] ring-1 ring-emerald-100 transition-transform duration-300 group-hover:scale-105"><UserRoundCheck size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-normal text-[var(--color-paddy)]/70">{t({ th: 'เว็บพอร์ทัล', en: 'Web portal' })}</span>
                  <span className="mt-0.5 block whitespace-nowrap text-base font-extrabold leading-snug">{t({ th: 'สำหรับนักวิชาการ', en: 'For researchers' })}</span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-gray-500">{t({ th: 'และเจ้าหน้าที่ · เข้าสู่ระบบ', en: 'and staff · Sign in' })}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-[var(--color-paddy)] opacity-70 transition-transform duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </div>

            <a href="#tour" className="group mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--color-paddy)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-emerald-100 transition-transform group-hover:translate-y-0.5"><MousePointerClick size={15} /></span>
              {t({ th: 'ดูการทำงานของแอปจริง', en: 'See the real app in action' })}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <div className="rb-reveal rb-delay-2">
            <HeroStage />
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 py-14 lg:px-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {STATS.map((s, k) => (
            <div key={s.to} onPointerMove={spotlight} className="rv rb-spot rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-lg shadow-emerald-950/5 sm:p-6" style={{ '--rv-delay': `${k * 90}ms` }}>
              <div className="font-display text-4xl font-black text-[var(--color-paddy)] sm:text-5xl"><CountUp to={s.to} /></div>
              <div className="mt-2 text-sm font-extrabold text-gray-900 sm:text-base">{t(s.label)}</div>
              <div className="mt-1 text-xs font-medium leading-5 text-gray-500 sm:text-sm">{t(s.sub)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Guided app tour (real screens) ──────────────────── */}
      <section id="tour" className="relative scroll-mt-20 overflow-x-clip bg-[linear-gradient(180deg,var(--color-paper)_0%,#f2f7f1_50%,var(--color-paper)_100%)] py-16 sm:py-20">
        <div className="absolute left-[-10%] top-40 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute right-[-8%] bottom-40 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-6">
          <SectionHead
            badge={t({ th: 'ทัวร์แอปจริง', en: 'Real app tour' })}
            icon={Smartphone}
            title={lang === 'en' ? <>Everything a rice farmer needs<br className="hidden sm:block" />in one app</> : <>ทุกอย่างที่ชาวนาต้องใช้<br className="hidden sm:block" />อยู่ในแอปเดียว</>}
            copy={t({ th: 'หน้าจอด้านล่างคือแอป Rice AI ที่ใช้งานจริง เลื่อนลงเพื่อดูทีละฟีเจอร์ ตั้งแต่สแกนใบข้าวไปจนถึงการแจ้งเตือนเมื่อมีโรคใกล้แปลง', en: 'These are real Rice AI screens. Scroll to walk through each feature, from scanning a leaf to alerts when disease appears near your field.' })}
          />
          <AppTour />
        </div>
      </section>

      {/* ── Ecosystem pillars ────────────────────────────────── */}
      <section id="features" className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#fbfaf6_48%,#ffffff_100%)] py-20 sm:py-24">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
        <div className="absolute left-1/2 top-12 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04] rb-soft-grid" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-6">
          <SectionHead
            badge="Smart Agri-Ecosystem"
            icon={ShieldCheck}
            title={lang === 'en' ? <>An agricultural ecosystem<br className="hidden sm:block" />ready for the field</> : <>ระบบนิเวศการเกษตร<br className="hidden sm:block" />ที่พร้อมใช้จริงในภาคสนาม</>}
            copy={t({ th: 'เชื่อมข้อมูลจากเกษตรกร เจ้าหน้าที่ และนักวิชาการเข้าสู่ศูนย์กลางเดียว เพื่อให้การคัดกรองโรคข้าวรวดเร็ว ตรวจสอบย้อนกลับได้ และนำไปต่อยอดเชิงนโยบายได้อย่างเป็นระบบ', en: 'Farmers, staff and researchers share one hub, so rice disease screening is fast, traceable and ready to inform policy.' })}
          />

          <div className="grid gap-5 lg:grid-cols-3">
            {PILLARS.map((p, k) => {
              const tone = PILLAR_TONE[p.tone];
              const Icon = p.icon;
              return (
                <div key={p.no} onPointerMove={spotlight} style={{ '--spot': tone.spot, '--rv-delay': `${k * 110}ms` }} className="rv rb-spot group relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-emerald-950/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-emerald-950/10 sm:p-7">
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.bar}`} />
                  <div className="relative mb-7 flex items-start justify-between gap-4">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner shadow-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tone.icon}`}><Icon size={28} /></div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${tone.chip}`}>{p.no}</span>
                  </div>
                  <p className={`relative mb-2 text-xs font-extrabold uppercase tracking-normal ${tone.eyebrow}`}>{p.eyebrow}</p>
                  <h3 className="relative mb-3 font-display text-2xl font-extrabold leading-snug text-gray-950">{t(p.title)}</h3>
                  <p className="relative text-[15px] font-medium leading-7 text-gray-600">{t(p.body)}</p>
                  <div className="relative mt-6 grid gap-3 border-t border-gray-100 pt-5">
                    {p.items.map((item, ik) => (
                      <div key={ik} className="flex items-center gap-3 text-sm font-bold text-gray-700"><CheckCircle2 size={17} className={tone.check} />{t(item)}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Screen gallery marquee ───────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--color-paddy-dark)] py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(134,239,172,0.16),transparent_40%),radial-gradient(circle_at_85%_100%,rgba(212,168,75,0.16),transparent_40%)]" />
        <div className="relative px-5">
          <SectionHead dark badge={t({ th: 'หน้าจอจริงในแอป', en: 'Real app screens' })} icon={Sparkles} title={t({ th: 'ออกแบบให้ใช้ง่ายในนาจริง', en: 'Designed for real fields' })} copy={t({ th: 'ตัวหนังสือใหญ่ ปุ่มกดง่าย สีบอกระดับความเสี่ยงชัดเจน ใช้ได้แม้กลางแดด', en: 'Large text, easy buttons and clear risk colours, readable even in bright sun.' })} />
        </div>
        <div className="rb-marquee rb-marquee-fade-dark relative">
          <div className="rb-marquee-track py-4" style={{ '--speed': '60s' }}>
            {[0, 1].map((n) => GALLERY.map(([s, label]) => (
              <figure key={`${n}${s}`} aria-hidden={n > 0} className="group mx-3 inline-flex w-[190px] shrink-0 flex-col items-center sm:mx-4 sm:w-[220px]">
                <div className="w-full transition-transform duration-500 group-hover:-translate-y-3 group-hover:scale-[1.04]">
                  <Phone screens={[s]} className="w-full" />
                </div>
                <figcaption className="mt-4 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-emerald-100 ring-1 ring-white/10">{t(label)}</figcaption>
              </figure>
            )))}
          </div>
        </div>
      </section>

      {/* ── Mobile app ───────────────────────────────────────── */}
      <section id="app" className="relative scroll-mt-24 overflow-hidden bg-[var(--color-paper)] py-20 sm:py-24">
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-6">
          <div className="rv relative order-2 mx-auto aspect-[1/0.95] w-full max-w-[520px] lg:order-1">
            <div className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.25),transparent_65%)] blur-xl" />
            <div className="rb-fan absolute inset-0">
              <Phone screens={['Fields']} className="rb-fan-l absolute left-[6%] top-[16%] w-[33%]" />
              <Phone screens={['Notifications']} className="rb-fan-r absolute right-[6%] top-[16%] w-[33%]" />
              <Phone screens={['Result']} glow className="rb-fan-c absolute left-1/2 top-[2%] w-[38%]" />
            </div>
            <img src="/app/khao_hom_joy.webp" alt={t({ th: 'น้องข้าวหอม', en: 'Khao Hom, the Rice AI mascot' })} className="rb-peek pointer-events-none absolute -bottom-[4%] left-[2%] z-10 w-[26%] drop-shadow-[0_18px_24px_rgba(20,83,45,0.28)]" />
          </div>

          <div className="rv order-1 min-w-0 text-center lg:order-2 lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
              {t({ th: 'เปิดทดสอบรุ่นเบต้า · Android', en: 'Open beta · Android' })}
            </div>
            <h2 className="mb-6 font-display text-4xl font-bold leading-tight tracking-normal text-gray-950 sm:text-5xl">{t({ th: 'สำหรับเกษตรกร', en: 'For farmers' })}<br /><span className="rb-shiny-text">{t({ th: 'ทดลองใช้รุ่นเบต้าได้แล้ว', en: 'Try the beta today' })}</span></h2>
            <p className="mx-auto mb-7 max-w-lg text-lg leading-relaxed text-gray-600 lg:mx-0">
              {t({ th: 'ถ่ายรูปใบข้าวแล้วรู้ผลในไม่กี่วินาที AI ทำงานบนโทรศัพท์โดยตรง จึงใช้กลางแปลงนาที่ไม่มีสัญญาณได้ ผลที่บันทึกจะส่งขึ้นระบบเมื่อกลับมามีอินเทอร์เน็ต', en: 'Photograph a leaf and get an answer in seconds. The AI runs on the phone, so it works in fields with no signal, and results sync once you are back online.' })}
            </p>

            <BetaDownload />

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-500"><Apple size={18} /> App Store · {t({ th: 'เร็ว ๆ นี้', en: 'coming soon' })}</span>
              <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-500"><PlayCircle size={18} className="text-emerald-500" /> Google Play · {t({ th: 'เร็ว ๆ นี้', en: 'coming soon' })}</span>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />

      <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={t({ th: 'น้องข้าวหอม · กลับขึ้นด้านบน', en: 'Khao Hom · back to top' })} className="group fixed bottom-4 right-3 z-40 hidden sm:block sm:bottom-5 sm:right-5 lg:bottom-7 lg:right-7">
        <span className="pointer-events-none absolute bottom-full right-2 mb-1 whitespace-nowrap rounded-2xl rounded-br-sm bg-white px-3 py-2 text-xs font-extrabold text-[var(--color-paddy)] opacity-0 shadow-xl ring-1 ring-emerald-100 transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
          {t({ th: 'สวัสดีครับ ผมน้องข้าวหอม 🌾', en: 'Hi, I\'m Khao Hom 🌾' })}
        </span>
        <img
          src={khaoHomMascot}
          alt=""
          className="h-24 w-24 object-contain drop-shadow-2xl transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:rotate-[-3deg] group-hover:scale-110 group-hover:drop-shadow-[0_22px_28px_rgba(20,83,45,0.28)] motion-reduce:transition-none lg:h-28 lg:w-28"
        />
      </a>
    </div>
  );
}
