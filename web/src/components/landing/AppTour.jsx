import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScanLine, CloudRain, Map as MapIcon, NotebookPen, BookOpenText, BellRing, CheckCircle2 } from 'lucide-react';
import { Phone } from './LandingKit';
import { useCycle } from './landingHooks';
import { useI18n } from '../../lib/i18n';

const FEATURES = [
  {
    icon: ScanLine,
    tag: { th: 'สแกนใบข้าว', en: 'Leaf scan' },
    title: { th: 'ถ่ายภาพใบข้าว รู้ผลในไม่กี่วินาที', en: 'Photograph a leaf, get an answer in seconds' },
    body: { th: 'วางใบข้าวในกรอบแล้วกดถ่าย AI วิเคราะห์โรคใบไหม้ ขอบใบแห้ง และใบสีส้ม พร้อมบอกความมั่นใจและวิธีจัดการที่ทำตามได้ทันที', en: 'Frame the leaf and tap the shutter. The AI checks for blast, bacterial leaf blight and tungro, then shows its confidence and steps you can take right away.' },
    points: [{ th: 'ตรวจได้ 4 ประเภท', en: 'Detects 4 classes' }, { th: 'บอกอาการที่พบและวิธีป้องกัน', en: 'Symptoms and prevention' }, { th: 'บันทึกผลพร้อมพิกัด GPS', en: 'Saves results with GPS' }],
    screens: ['Scan', 'Result'],
    tint: 'emerald',
  },
  {
    icon: CloudRain,
    tag: { th: 'หน้าหลัก', en: 'Home' },
    title: { th: 'อากาศจริงตามพิกัด บอกเมื่อเสี่ยงโรค', en: 'Live weather for your field, with disease-risk alerts' },
    body: { th: 'พยากรณ์รายชั่วโมงจากตำแหน่งแปลงนา ระบบเตือนทันทีเมื่อฝนตกและความชื้นสูงจนเสี่ยงต่อโรคระบาด', en: "Hourly forecasts for your field's location. The app warns you as soon as rain and humidity push disease risk up." },
    points: [{ th: 'พยากรณ์รายชั่วโมง', en: 'Hourly forecast' }, { th: 'แถบเตือนพื้นที่เสี่ยง', en: 'Risk-area banner' }, { th: 'ทางลัดไปทุกฟีเจอร์', en: 'Shortcuts to every feature' }],
    screens: ['Home'],
    scroll: true,
    tint: 'sky',
  },
  {
    icon: MapIcon,
    tag: { th: 'แผนที่ระบาด', en: 'Outbreak map' },
    title: { th: 'แผนที่ 3 มิติ เจาะถึงระดับอำเภอ', en: 'A 3D map down to district level' },
    body: { th: 'เห็นความหนาแน่นของรายงานโรคทั่วประเทศเป็นแท่งสามมิติ แตะจังหวัดเพื่อดูรายอำเภอและระดับความเสี่ยง', en: 'See disease reports across the country as 3D bars. Tap a province to see its districts and risk levels.' },
    points: [{ th: '77 จังหวัด', en: '77 provinces' }, { th: 'กรองตามภูมิภาค', en: 'Filter by region' }, { th: 'ดูรายละเอียดรายอำเภอ', en: 'District details' }],
    screens: ['Outbreak3D', 'Outbreak3DDistricts'],
    tint: 'amber',
  },
  {
    icon: NotebookPen,
    tag: { th: 'สมุดแปลงนา', en: 'Field notebook' },
    title: { th: 'ปฏิทินงานตามอายุข้าว', en: "A task calendar that follows your crop's age" },
    body: { th: 'บอกพันธุ์และวันปลูก แอปคำนวณระยะการเติบโตและวันเก็บเกี่ยว พร้อมบอกว่าวันนี้ต้องดูแลอะไรในแปลง', en: 'Enter the variety and planting date. The app works out growth stages and harvest day, and tells you what the field needs today.' },
    points: [{ th: 'หลายแปลงในที่เดียว', en: 'Many fields in one place' }, { th: 'ระยะการเติบโตเป็นแถบสี', en: 'Colour-coded growth stages' }, { th: 'งานที่ต้องทำวันนี้', en: "Today's tasks" }],
    screens: ['Fields', 'FieldDetail'],
    tint: 'lime',
  },
  {
    icon: BookOpenText,
    tag: { th: 'คลังโรคข้าว', en: 'Disease library' },
    title: { th: 'ความรู้โรคข้าว อ่านง่าย ใช้ได้จริง', en: "Rice disease knowledge that's easy to use" },
    body: { th: 'ข้อมูลอ้างอิงจากกรมการข้าว อธิบายทั้งภาษาชาวบ้านและเชิงวิชาการ พร้อมภาพอาการและแนวทางป้องกัน', en: 'Based on the Rice Department, explained in plain words and in technical detail, with symptom photos and prevention steps.' },
    points: [{ th: 'ภาษาชาวบ้าน + เชิงลึก', en: 'Plain + in-depth' }, { th: 'ภาพอาการจริง', en: 'Real symptom photos' }, { th: 'แนวทางป้องกันกำจัด', en: 'Control measures' }],
    screens: ['Wiki', 'WikiDetail'],
    tint: 'teal',
  },
  {
    icon: BellRing,
    tag: { th: 'แจ้งเตือน', en: 'Alerts' },
    title: { th: 'เตือนทันทีเมื่อมีโรคใกล้แปลง', en: 'Alerts when disease is reported near your field' },
    body: { th: 'เมื่อมีรายงานโรคในรัศมีใกล้แปลงของคุณ น้องข้าวหอมจะแจ้งเตือนพร้อมคำแนะนำ รู้ก่อน ป้องกันก่อน', en: 'When disease is reported near your field, Khao Hom lets you know with advice, so you can act before it spreads.' },
    points: [{ th: 'แจ้งตามรัศมีจากแปลง', en: 'Radius-based alerts' }, { th: 'จัดลำดับความเร่งด่วน', en: 'Sorted by urgency' }, { th: 'ผลสแกนของคุณย้อนหลัง', en: 'Your past scans' }],
    screens: ['Notifications'],
    tint: 'rose',
  },
];

const TINT = {
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  lime: 'bg-lime-100 text-lime-700',
  teal: 'bg-teal-100 text-teal-700',
  rose: 'bg-rose-100 text-rose-700',
};

function TourPhone({ feature, className = '' }) {
  const [i] = useCycle(feature.screens.length, 2800);
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.28),transparent_62%)] blur-2xl" />
      <Phone key={feature.tag.th} screens={feature.screens} active={i} scroll={feature.scroll} glow className="relative mx-auto w-[250px] sm:w-[280px] lg:w-[min(280px,calc((100vh-210px)*0.462))] rb-tour-in" />
      {/* always reserve the row so the pinned phone keeps one height across features */}
      <div className={`mt-5 flex h-1.5 justify-center gap-1.5 ${feature.screens.length > 1 ? '' : 'invisible'}`}>
        {feature.screens.map((s, k) => (
          <span key={s} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? 'w-6 bg-[var(--color-paddy)]' : 'w-1.5 bg-emerald-900/20'}`} />
        ))}
      </div>
    </div>
  );
}

function Points({ items }) {
  const { t } = useI18n();
  return (
    <ul className="mt-5 grid gap-2.5">
      {items.map((p) => (
        <li key={p.th} className="flex items-center gap-2.5 text-sm font-bold text-gray-700"><CheckCircle2 size={17} className="shrink-0 text-emerald-500" />{t(p)}</li>
      ))}
    </ul>
  );
}

// The header covers the top 80px, so "the middle of the screen" is 40px below 50vh.
const HEADER = 80;
const centerLine = () => HEADER + (window.innerHeight - HEADER) / 2;

/**
 * Guided tour of the real app. Desktop: the phone stays pinned at the centre of the visible
 * area while the feature texts scroll past. Each text block is exactly as tall as the pinned
 * phone, so the first text reaches the centre the moment the phone pins and the last one is
 * centred the moment it unpins. The active feature is the block closest to the centre line,
 * which behaves the same scrolling down and up. Mobile/tablet: tabs.
 */
export default function AppTour() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [pinH, setPinH] = useState(0);
  const steps = useRef([]);
  const pin = useRef(null);

  useLayoutEffect(() => {
    const el = pin.current;
    if (!el || !('ResizeObserver' in window)) return undefined;
    const ro = new ResizeObserver(() => setPinH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const c = centerLine();
      let best = 0;
      let bestD = Infinity;
      steps.current.forEach((el, i) => {
        if (!el || !el.offsetParent) return; // hidden on mobile
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - c);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive((a) => (a === best ? a : best));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(pick); };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (i) => {
    const el = steps.current[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.scrollBy({ top: r.top + r.height / 2 - centerLine(), behavior: 'smooth' });
  };

  const f = FEATURES[active];
  const blockH = pinH ? `${pinH}px` : '58vh';

  return (
    <>
      {/* Desktop: scroll-driven */}
      <div className="hidden gap-16 lg:grid lg:grid-cols-[1fr_minmax(0,420px)]">
        <div className="relative pl-12">
          {/* progress rail */}
          <div aria-hidden="true" className="absolute bottom-0 left-[11px] top-0 w-[2px] rounded-full bg-emerald-900/10" style={{ top: `calc(${blockH} / 2)`, bottom: `calc(${blockH} / 2)` }}>
            <div className="w-full rounded-full bg-gradient-to-b from-[var(--color-paddy)] to-[var(--color-gold)] transition-[height] duration-500 ease-out" style={{ height: `${(active / (FEATURES.length - 1)) * 100}%` }} />
          </div>
          {FEATURES.map((ft, i) => {
            const Icon = ft.icon;
            const on = i === active;
            return (
              <div key={ft.tag.th} ref={(el) => { steps.current[i] = el; }} data-i={i} className="relative flex items-center" style={{ height: blockH }}>
                <button
                  type="button"
                  aria-label={t({ th: `ไปที่ ${ft.tag.th}`, en: `Go to ${ft.tag.en}` })}
                  onClick={() => goTo(i)}
                  className={`absolute -left-12 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-[var(--color-paper)] transition-all duration-300 ${on ? 'scale-110 border-[var(--color-gold)]' : i < active ? 'border-[var(--color-paddy)]' : 'border-emerald-900/20'}`}
                >
                  <span className={`h-2 w-2 rounded-full transition-colors ${on ? 'bg-[var(--color-gold)]' : i < active ? 'bg-[var(--color-paddy)]' : 'bg-transparent'}`} />
                </button>
                <div className={`max-w-xl transition-all duration-500 ease-out ${on ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-30'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${TINT[ft.tint]}`}><Icon size={24} /></span>
                    <span className="text-sm font-extrabold text-gray-400">{String(i + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}</span>
                    <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-extrabold text-[var(--color-paddy)]">{t(ft.tag)}</span>
                  </div>
                  <h3 className="mt-5 text-balance font-display text-3xl font-extrabold leading-snug text-gray-950 xl:text-4xl">{t(ft.title)}</h3>
                  <p className="mt-4 text-[17px] font-medium leading-8 text-gray-600">{t(ft.body)}</p>
                  <Points items={ft.points} />
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <div ref={pin} className="sticky flex flex-col items-center py-4" style={{ top: pinH ? `calc(${HEADER}px + (100vh - ${HEADER}px - ${pinH}px) / 2)` : `calc(50vh - 300px)` }}>
            <TourPhone feature={f} />
            <div className="mt-6 flex gap-2">
              {FEATURES.map((ft, i) => (
                <button
                  key={ft.tag.th}
                  type="button"
                  aria-label={t(ft.tag)}
                  onClick={() => goTo(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-[var(--color-gold)]' : 'w-2.5 bg-emerald-900/15 hover:bg-emerald-900/35'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet: tabs */}
      <div className="lg:hidden">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
          {FEATURES.map((ft, i) => {
            const Icon = ft.icon;
            return (
              <button
                key={ft.tag.th}
                type="button"
                onClick={() => setActive(i)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-extrabold transition-all ${i === active ? 'border-[var(--color-paddy)] bg-[var(--color-paddy)] text-white shadow-lg shadow-emerald-900/20' : 'border-gray-200 bg-white text-gray-600'}`}
              >
                <Icon size={16} />{t(ft.tag)}
              </button>
            );
          })}
        </div>
        <div className="mt-8 grid items-center gap-8 md:grid-cols-2">
          <TourPhone feature={f} />
          <div key={f.tag.th} className="rb-tour-in">
            <h3 className="font-display text-2xl font-extrabold leading-snug text-gray-950 sm:text-3xl">{t(f.title)}</h3>
            <p className="mt-3 text-base font-medium leading-7 text-gray-600">{t(f.body)}</p>
            <Points items={f.points} />
          </div>
        </div>
      </div>
    </>
  );
}
