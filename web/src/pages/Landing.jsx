import { Link } from 'react-router-dom';
import khaoHomMascot from '../../assets/khao_hom_scan.svg';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import AppTour from '../components/landing/AppTour';
import BetaDownload from '../components/landing/BetaDownload';
import PaddyField from '../components/landing/PaddyField';
import { Phone, CountUp } from '../components/landing/LandingKit';
import { spotlight, useCycle, useRevealAll, useTilt } from '../components/landing/landingHooks';
import { Cpu, Cloud, ArrowRight, ShieldCheck, PlayCircle, Apple, Smartphone, UserRoundCheck, CheckCircle2, Sparkles, MousePointerClick } from 'lucide-react';

const HERO_SCREENS = ['Scan', 'Result', 'Home'];
const HERO_CAPTION = ['วางใบข้าวในกรอบ', 'AI วิเคราะห์เสร็จ', 'หน้าหลัก · อากาศจริง'];

const GALLERY = [
  ['Main', 'เข้าสู่ระบบ'],
  ['Home', 'หน้าหลัก'],
  ['Scan', 'สแกนใบข้าว'],
  ['Result', 'ผลวิเคราะห์'],
  ['Outbreak3D', 'แผนที่ 3 มิติ'],
  ['Fields', 'สมุดแปลงนา'],
  ['FieldDetail', 'รายละเอียดแปลง'],
  ['Wiki', 'คลังโรคข้าว'],
  ['WikiDetail', 'ข้อมูลโรค'],
  ['Notifications', 'แจ้งเตือน'],
  ['Outbreak3DDistricts', 'รายอำเภอ'],
  ['Onboarding1', 'เริ่มต้นใช้งาน'],
];

const STATS = [
  { to: 4, label: 'ประเภทที่ AI ตรวจได้', sub: 'ใบไหม้ · ขอบใบแห้ง · ใบสีส้ม · ปกติ' },
  { to: 77, label: 'จังหวัดบนแผนที่ระบาด', sub: 'เจาะดูได้ถึงระดับอำเภอ' },
  { to: 6, label: 'ฟีเจอร์หลักในแอป', sub: 'สแกน อากาศ แผนที่ แปลงนา คลังโรค แจ้งเตือน' },
  { to: 3, label: 'บทบาทผู้ใช้งาน', sub: 'เกษตรกร · นักวิชาการ · ผู้ดูแลระบบ' },
];

const PILLARS = [
  {
    icon: Cpu, no: '01', tone: 'emerald', eyebrow: 'AI Vision Analysis', title: 'วิเคราะห์โรคจากภาพใบข้าว',
    body: 'คัดกรองอาการจากภาพถ่ายภาคสนาม แล้วสรุปผลให้อ่านง่าย เพื่อช่วยให้ตัดสินใจเบื้องต้นได้เร็วขึ้น',
    items: ['ตรวจจับอาการจากภาพ', 'สรุปผลแบบเข้าใจง่าย', 'เหมาะกับข้อมูลภาคสนาม'],
  },
  {
    icon: Cloud, no: '02', tone: 'blue', eyebrow: 'Cloud Sync & Monitoring', title: 'รวมข้อมูลภาคสนามแบบทันที',
    body: 'บันทึกผลการสแกนขึ้นระบบกลาง พร้อมข้อมูลพื้นที่และเวลา เพื่อดูภาพรวมและติดตามแนวโน้มการระบาด',
    items: ['ซิงก์ข้อมูลขึ้น Cloud', 'ดูสถานการณ์แบบรวมศูนย์', 'ใช้ติดตามแนวโน้มพื้นที่เสี่ยง'],
  },
  {
    icon: ShieldCheck, no: '03', tone: 'amber', eyebrow: 'Enterprise Security', title: 'ควบคุมสิทธิ์และข้อมูลอย่างรัดกุม',
    body: 'แยกบทบาทผู้ใช้งานอย่างเป็นระบบ เพื่อปกป้องข้อมูลผู้ใช้ ข้อมูลพื้นที่ และข้อมูลประกอบการวิเคราะห์',
    items: ['Role-Based Access', 'แยกสิทธิ์เจ้าหน้าที่/นักวิชาการ', 'ออกแบบเพื่อข้อมูลอ่อนไหว'],
  },
];

const PILLAR_TONE = {
  emerald: { bar: 'from-emerald-300 via-emerald-500 to-lime-300', icon: 'bg-emerald-100 text-emerald-600', chip: 'border-emerald-100 bg-emerald-50 text-emerald-700', eyebrow: 'text-emerald-700/75', check: 'text-emerald-500', spot: 'rgba(16,185,129,0.12)' },
  blue: { bar: 'from-sky-300 via-blue-500 to-cyan-300', icon: 'bg-blue-100 text-blue-600', chip: 'border-blue-100 bg-blue-50 text-blue-700', eyebrow: 'text-blue-700/75', check: 'text-blue-500', spot: 'rgba(59,130,246,0.12)' },
  amber: { bar: 'from-amber-300 via-orange-400 to-yellow-300', icon: 'bg-amber-100 text-amber-600', chip: 'border-amber-100 bg-amber-50 text-amber-700', eyebrow: 'text-amber-700/75', check: 'text-amber-500', spot: 'rgba(245,158,11,0.14)' },
};

function HeroStage() {
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
        <button type="button" onClick={() => setI((v) => (v + 1) % HERO_SCREENS.length)} aria-label="เปลี่ยนหน้าจอตัวอย่าง" className="absolute left-1/2 top-[7%] w-[38%] -translate-x-[36%] cursor-pointer">
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
              <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">ผลวิเคราะห์</span><span className="block text-sm font-extrabold text-gray-900">พบโรคใบไหม้</span></span>
            </>
          ) : i === 2 ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><Cloud size={22} /></span>
              <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">ความชื้น 91%</span><span className="block text-sm font-extrabold text-gray-900">เสี่ยงโรคระบาด</span></span>
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Cpu size={22} /></span>
              <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">AI พร้อม</span><span className="block text-sm font-extrabold text-gray-900">ตรวจได้ 4 ประเภท</span></span>
            </>
          )}
        </div>

        <div className="absolute left-[2%] top-[62%] hidden rounded-2xl border border-white bg-white/95 p-3.5 shadow-xl shadow-emerald-950/10 backdrop-blur sm:block rb-float-slow">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[var(--color-paddy)]"><ShieldCheck size={19} /></span>
            <span><span className="block text-[11px] font-extrabold uppercase text-gray-400">Rice Protection</span><span className="block text-sm font-extrabold text-gray-900">พร้อมเฝ้าระวังโรคข้าว</span></span>
          </div>
        </div>

        <img src="/app/khao_hom_hello.webp" alt="น้องข้าวหอม" className="rb-peek pointer-events-none absolute bottom-[9%] right-[2%] w-[25%] drop-shadow-[0_18px_24px_rgba(20,83,45,0.28)]" />
      </div>

      <div className="absolute -bottom-[1%] left-1/2 z-10 flex -translate-x-1/2 items-center whitespace-nowrap gap-2 rounded-full border border-emerald-100 bg-white/90 px-3 py-1.5 text-xs font-extrabold text-[var(--color-paddy)] shadow-md backdrop-blur">
        {HERO_SCREENS.map((s, k) => (
          <span key={s} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? 'w-5 bg-[var(--color-paddy)]' : 'w-1.5 bg-emerald-900/20'}`} />
        ))}
        <span className="ml-1">{HERO_CAPTION[i]}</span>
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
  const page = useRevealAll();
  return (
    <div ref={page} className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--color-paper)] font-sans text-gray-800">
      <PublicHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative w-full max-w-full overflow-hidden px-3 pb-[170px] pt-8 sm:px-5 sm:pb-[220px] sm:pt-14 lg:pb-[250px] lg:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_30%,rgba(252,211,77,0.18),transparent_30%),radial-gradient(circle_at_86%_26%,rgba(52,211,153,0.24),transparent_34%)]" />
        <div className="absolute inset-0 rb-soft-grid opacity-60 [mask-image:linear-gradient(to_bottom,black_55%,transparent_85%)]" />
        <PaddyField className="absolute inset-x-0 bottom-0 h-[220px] sm:h-[290px] lg:h-[340px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--color-paper)]" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div className="min-w-0 rb-reveal">
            <div className="rice-hero-kicker mb-4 sm:mb-5">
              <ShieldCheck size={16} />
              AI ตรวจโรคใบข้าว · แม่นยำ 97.9%
            </div>
            <h1 className="rice-hero-title">
              Rice AI<br />
              <span className="rb-shiny-text">ปกป้องนาข้าวด้วยปัญญาประดิษฐ์</span>
            </h1>
            <p className="rice-hero-copy">
              แพลตฟอร์มวิเคราะห์โรคข้าวสำหรับเกษตรกรและนักวิชาการ เชื่อมข้อมูลภาคสนามสู่ส่วนกลางแบบ Real-time เพื่อช่วยติดตาม วินิจฉัย และรับมือโรคระบาดได้แม่นยำขึ้น
            </p>

            <div className="mt-6 rounded-[1.25rem] border border-gray-100 bg-white p-2.5 shadow-xl shadow-emerald-950/5 sm:mt-8 sm:rounded-[1.75rem] sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <a href="#app" aria-label="ดูข้อมูลแอปมือถือสำหรับเกษตรกร" className="group rb-glare flex min-h-[64px] items-center gap-2 rounded-2xl bg-[var(--color-paddy)] px-3 py-3 text-left text-white shadow-md shadow-[#166534]/20 transition-all hover:-translate-y-1 hover:bg-[var(--color-paddy-dark)] hover:shadow-xl sm:min-h-[74px] sm:gap-4 sm:px-5 sm:py-4">
                  <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 min-[380px]:flex"><Smartphone size={22} /></span>
                  <span className="min-w-0"><span className="block text-[10px] font-extrabold uppercase tracking-normal text-emerald-100 sm:text-xs">Mobile App</span><span className="block text-sm font-extrabold leading-snug sm:text-base">สำหรับเกษตรกร</span></span>
                  <ArrowRight size={18} className="ml-auto hidden shrink-0 transition-transform group-hover:translate-x-1 min-[380px]:block" />
                </a>

                <Link to="/login" aria-label="เข้าสู่ระบบสำหรับเจ้าหน้าที่และนักวิชาการ" className="group rb-glare flex min-h-[64px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-left text-[var(--color-paddy)] shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-lg sm:min-h-[74px] sm:gap-4 sm:px-5 sm:py-4">
                  <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--color-paddy)] min-[380px]:flex"><UserRoundCheck size={22} /></span>
                  <span className="min-w-0"><span className="block text-[10px] font-extrabold uppercase tracking-normal text-emerald-700/70 sm:text-xs">Web Portal</span><span className="block text-sm font-extrabold leading-snug sm:text-base">เจ้าหน้าที่ / นักวิชาการ</span></span>
                  <ArrowRight size={18} className="ml-auto hidden shrink-0 transition-transform group-hover:translate-x-1 min-[380px]:block" />
                </Link>
              </div>
            </div>

            <a href="#tour" className="group mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--color-paddy)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-emerald-100 transition-transform group-hover:translate-y-0.5"><MousePointerClick size={15} /></span>
              ดูการทำงานของแอปจริง
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
            <div key={s.label} onPointerMove={spotlight} className="rv rb-spot rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-lg shadow-emerald-950/5 sm:p-6" style={{ '--rv-delay': `${k * 90}ms` }}>
              <div className="font-display text-4xl font-black text-[var(--color-paddy)] sm:text-5xl"><CountUp to={s.to} /></div>
              <div className="mt-2 text-sm font-extrabold text-gray-900 sm:text-base">{s.label}</div>
              <div className="mt-1 text-xs font-medium leading-5 text-gray-500 sm:text-sm">{s.sub}</div>
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
            badge="ทัวร์แอปจริง"
            icon={Smartphone}
            title={<>ทุกอย่างที่ชาวนาต้องใช้<br className="hidden sm:block" />อยู่ในแอปเดียว</>}
            copy="หน้าจอด้านล่างคือแอป Rice AI ที่ใช้งานจริง เลื่อนลงเพื่อดูทีละฟีเจอร์ ตั้งแต่สแกนใบข้าวไปจนถึงการแจ้งเตือนเมื่อมีโรคใกล้แปลง"
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
            title={<>ระบบนิเวศการเกษตร<br className="hidden sm:block" />ที่พร้อมใช้จริงในภาคสนาม</>}
            copy="เชื่อมข้อมูลจากเกษตรกร เจ้าหน้าที่ และนักวิชาการเข้าสู่ศูนย์กลางเดียว เพื่อให้การคัดกรองโรคข้าวรวดเร็ว ตรวจสอบย้อนกลับได้ และนำไปต่อยอดเชิงนโยบายได้อย่างเป็นระบบ"
          />

          <div className="grid gap-5 lg:grid-cols-3">
            {PILLARS.map((p, k) => {
              const t = PILLAR_TONE[p.tone];
              const Icon = p.icon;
              return (
                <div key={p.no} onPointerMove={spotlight} style={{ '--spot': t.spot, '--rv-delay': `${k * 110}ms` }} className="rv rb-spot group relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-emerald-950/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-emerald-950/10 sm:p-7">
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} />
                  <div className="relative mb-7 flex items-start justify-between gap-4">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner shadow-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${t.icon}`}><Icon size={28} /></div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${t.chip}`}>{p.no}</span>
                  </div>
                  <p className={`relative mb-2 text-xs font-extrabold uppercase tracking-normal ${t.eyebrow}`}>{p.eyebrow}</p>
                  <h3 className="relative mb-3 font-display text-2xl font-extrabold leading-snug text-gray-950">{p.title}</h3>
                  <p className="relative text-[15px] font-medium leading-7 text-gray-600">{p.body}</p>
                  <div className="relative mt-6 grid gap-3 border-t border-gray-100 pt-5">
                    {p.items.map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm font-bold text-gray-700"><CheckCircle2 size={17} className={t.check} />{item}</div>
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
          <SectionHead dark badge="หน้าจอจริงในแอป" icon={Sparkles} title="ออกแบบให้ใช้ง่ายในนาจริง" copy="ตัวหนังสือใหญ่ ปุ่มกดง่าย สีบอกระดับความเสี่ยงชัดเจน ใช้ได้แม้กลางแดด" />
        </div>
        <div className="rb-marquee rb-marquee-fade-dark relative">
          <div className="rb-marquee-track py-4" style={{ '--speed': '60s' }}>
            {[0, 1].map((n) => GALLERY.map(([s, label]) => (
              <figure key={`${n}${s}`} aria-hidden={n > 0} className="group mx-3 inline-flex w-[190px] shrink-0 flex-col items-center sm:mx-4 sm:w-[220px]">
                <div className="w-full transition-transform duration-500 group-hover:-translate-y-3 group-hover:scale-[1.04]">
                  <Phone screens={[s]} className="w-full" />
                </div>
                <figcaption className="mt-4 rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-emerald-100 ring-1 ring-white/10">{label}</figcaption>
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
            <img src="/app/khao_hom_joy.webp" alt="น้องข้าวหอม" className="rb-peek pointer-events-none absolute -bottom-[4%] left-[2%] z-10 w-[26%] drop-shadow-[0_18px_24px_rgba(20,83,45,0.28)]" />
          </div>

          <div className="rv order-1 min-w-0 text-center lg:order-2 lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
              เปิดทดสอบรุ่นเบต้า · Android
            </div>
            <h2 className="mb-6 font-display text-4xl font-bold leading-tight tracking-normal text-gray-950 sm:text-5xl">สำหรับเกษตรกร<br /><span className="rb-shiny-text">ทดลองใช้รุ่นเบต้าได้แล้ว</span></h2>
            <p className="mx-auto mb-7 max-w-lg text-lg leading-relaxed text-gray-600 lg:mx-0">
              ถ่ายรูปใบข้าวแล้วรู้ผลในไม่กี่วินาที AI ทำงานบนโทรศัพท์โดยตรง จึงใช้กลางแปลงนาที่ไม่มีสัญญาณได้ ผลที่บันทึกจะส่งขึ้นระบบเมื่อกลับมามีอินเทอร์เน็ต
            </p>

            <BetaDownload />

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-500"><Apple size={18} /> App Store · เร็ว ๆ นี้</span>
              <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-500"><PlayCircle size={18} className="text-emerald-500" /> Google Play · เร็ว ๆ นี้</span>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />

      <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="น้องข้าวหอม · กลับขึ้นด้านบน" className="group fixed bottom-4 right-3 z-40 hidden sm:block sm:bottom-5 sm:right-5 lg:bottom-7 lg:right-7">
        <span className="pointer-events-none absolute bottom-full right-2 mb-1 whitespace-nowrap rounded-2xl rounded-br-sm bg-white px-3 py-2 text-xs font-extrabold text-[var(--color-paddy)] opacity-0 shadow-xl ring-1 ring-emerald-100 transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
          สวัสดีครับ ผมน้องข้าวหอม 🌾
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
