import { ArrowDown, ArrowRight, ArrowUp, BookOpen, Check, ChevronRight, Database, ExternalLink, FlaskConical, Info, Layers3, MessageSquareText, Microscope, Play, Target, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import khaoHomMascot from '../../assets/khao_hom_scan.svg';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import PromoVideo from '../components/landing/PromoVideo';
import explainer from '../data/explainerChapters.json';
import { useDocTitle, useI18n } from '../lib/i18n';
import { ConfusionExplorer, Leaderboard, ModelCards, PerClassHeatmap, SeedSpread, Significance, TradeoffChart, data as cmp, mainModel, pct, pm } from '../components/research/ModelComparison';

const GREEN = '#1f4d3a';

const datasetClasses = [
  { key: 'BLAST', th: 'โรคไหม้', en: 'Rice blast', count: 1738, pct: 34.3 },
  { key: 'BLB', th: 'โรคขอบใบแห้ง', en: 'Bacterial leaf blight', count: 479, pct: 9.4 },
  { key: 'TUNGRO', th: 'โรคใบสีส้ม', en: 'Rice tungro', count: 1088, pct: 21.5 },
  { key: 'HEALTHY', th: 'ใบปกติ', en: 'Healthy rice leaf', count: 1764, pct: 34.8 },
];

const classResults = [
  { name: 'BLAST', th: 'โรคไหม้', en: 'Rice blast', support: 261, precisionV1: '86.27%', recallV1: '67.43%', precisionV2: '99.61%', recallV2: '97.32%', f1Initial: '75.70%', f1Tuned: '98.45%', delta: '+22.75' },
  { name: 'BLB', th: 'โรคขอบใบแห้ง', en: 'Bacterial leaf blight', support: 72, precisionV1: '41.30%', recallV1: '79.17%', precisionV2: '98.59%', recallV2: '97.22%', f1Initial: '54.29%', f1Tuned: '97.90%', delta: '+43.62' },
  { name: 'TUNGRO', th: 'โรคใบสีส้ม', en: 'Rice tungro', support: 163, precisionV1: '68.39%', recallV1: '65.03%', precisionV2: '96.34%', recallV2: '96.93%', f1Initial: '66.67%', f1Tuned: '96.64%', delta: '+29.97' },
  { name: 'HEALTHY', th: 'ใบปกติ', en: 'Healthy rice leaf', support: 265, precisionV1: '89.02%', recallV1: '88.68%', precisionV2: '97.05%', recallV2: '99.25%', f1Initial: '88.85%', f1Tuned: '98.13%', delta: '+9.29' },
];

function Eyebrow({ children }) {
  return <div className="text-[11px] font-extrabold uppercase tracking-[.2em] text-emerald-800">{children}</div>;
}

function SectionHeading({ eyebrow, title, body }) {
  return <div className="max-w-3xl">
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
    {body && <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{body}</p>}
  </div>;
}

function Figure({ src, alt, title, caption }) {
  return <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <figcaption className="text-sm font-bold text-slate-800">{title}</figcaption>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">{alt}</span>
    </div>
    <div className="flex min-h-48 items-center justify-center bg-[#fffefa] p-3 sm:p-5">
      <img src={src} alt={title} loading="lazy" className="h-auto max-h-[440px] w-full object-contain" />
    </div>
    {caption && <p className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">{caption}</p>}
  </figure>;
}

function MetricCard({ title, v1, v2, delta, tr }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">{title}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900">{delta}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-slate-50 p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">V1 · {tr('ประเมินซ้ำ', 'Rescored')}</div><div className="mt-2 font-display text-3xl font-bold text-slate-800">{v1}</div></div>
      <div className="rounded-xl border border-emerald-900/10 bg-[#f2f5ed] p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-emerald-900">V2 · {tr('ชุดทดสอบ', 'Test set')}</div><div className="mt-2 font-display text-3xl font-bold text-emerald-950">{v2}</div></div>
    </div>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">{tr('ทั้งคู่ประเมินบนรายชื่อภาพ test 761 ภาพเดียวกัน · V1 เป็นการวัดซ้ำภายหลัง', 'Both use the same 761-image test list · V1 was rescored after its original training.')}</p>
  </article>;
}

// Headline conclusions. Numbers come from the measured results; the wording follows what they showed:
// the top accuracy is shared, so the case for EfficientNet-B0 rests on size, speed and stability.
const sig = (m) => m.mcnemar.filter((x) => x.p < 0.05).length;

function useFindings(tr, main) {
  const others = cmp.models.filter((m) => m.role !== 'main');
  const rival = [...others].sort((a, b) => b.accuracy.mean - a.accuracy.mean)[0];
  const tie = Math.abs(rival.accuracy.mean - main.accuracy.mean) < 0.0015 && sig(rival) === 0;
  const smallest = [...cmp.models].sort((a, b) => a.tfliteMb - b.tfliteMb)[0];
  const sizeX = rival.tfliteMb / main.tfliteMb, speedX = rival.tfliteMs / main.tfliteMs;
  const beaten = others.filter((m) => sig(m) === m.mcnemar.length && m.mcnemar.every((x) => x.a_only > x.b_only));
  const mostly = others.filter((m) => !beaten.includes(m) && sig(m) >= 2 && m.mcnemar.every((x) => x.a_only >= x.b_only));
  const equal = others.filter((m) => sig(m) === 0);
  const names = (l) => l.map((m) => m.name).join(', ');
  const stable = [...cmp.models].sort((a, b) => a.accuracy.sd - b.accuracy.sd)[0].key === main.key;

  const summaryTitle = tie
    ? tr(`${main.name} แม่นเท่าโมเดลที่ดีที่สุด แต่เล็กกว่า ${sizeX.toFixed(0)} เท่าและเร็วกว่า ${speedX.toFixed(0)} เท่า`, `${main.name} matches the most accurate model while being ${sizeX.toFixed(0)}× smaller and ${speedX.toFixed(0)}× faster`)
    : tr(`${main.name} ให้สมดุลระหว่างความแม่นกับขนาดดีที่สุดสำหรับมือถือ`, `${main.name} gives the best balance of accuracy and size for phones`);
  const findings = [
    [tr('ความแม่นยำ', 'Accuracy'), tie
      ? tr(`${main.name} ได้ ${pm(main.accuracy)}% เท่ากับ ${rival.name} (${pm(rival.accuracy)}%) เป็นอันดับสูงสุดร่วมกัน${stable ? ` และผลแกว่งน้อยที่สุดในทั้ง 6 โมเดล` : ''}`, `${main.name} scored ${pm(main.accuracy)}%, level with ${rival.name} (${pm(rival.accuracy)}%) at the top${stable ? ', with the smallest spread of all six models' : ''}.`)
      : tr(`${main.name} ได้ ${pm(main.accuracy)}% ส่วน ${rival.name} ได้ ${pm(rival.accuracy)}%`, `${main.name} scored ${pm(main.accuracy)}%; ${rival.name} scored ${pm(rival.accuracy)}%.`)],
    [tr('ขนาดและความเร็ว', 'Size & speed'), tr(`บนมือถือ ${main.name} ใช้ไฟล์ ${main.tfliteMb.toFixed(1)} MB และ ${main.tfliteMs.toFixed(1)} ms ต่อภาพ ขณะที่ ${rival.name} ใช้ ${rival.tfliteMb.toFixed(1)} MB และ ${rival.tfliteMs.toFixed(1)} ms${smallest.key !== main.key ? ` ตัวที่เบาที่สุดคือ ${smallest.name} (${smallest.tfliteMb.toFixed(1)} MB, ${smallest.tfliteMs.toFixed(1)} ms) แต่แม่นน้อยกว่าเฉลี่ย ${((main.accuracy.mean - smallest.accuracy.mean) * 100).toFixed(2)} จุด` : ''}`, `On the phone ${main.name} is ${main.tfliteMb.toFixed(1)} MB and ${main.tfliteMs.toFixed(1)} ms per image, against ${rival.tfliteMb.toFixed(1)} MB and ${rival.tfliteMs.toFixed(1)} ms for ${rival.name}.${smallest.key !== main.key ? ` The lightest, ${smallest.name} (${smallest.tfliteMb.toFixed(1)} MB, ${smallest.tfliteMs.toFixed(1)} ms), averages ${((main.accuracy.mean - smallest.accuracy.mean) * 100).toFixed(2)} points lower.` : ''}`)],
    [tr('ทดสอบทางสถิติ', 'Statistical test'), tr(`McNemar test: ${main.name} ดีกว่า ${names(beaten)} อย่างมีนัยสำคัญทุก seed${mostly.length ? ` และดีกว่า ${names(mostly)} ใน 2 จาก 3 seed` : ''} ส่วนกับ ${names(equal)} ไม่ต่างกันอย่างมีนัยสำคัญ จึงเลือกตัวที่เบาและนิ่งกว่าสำหรับวิเคราะห์บนมือถือ`, `McNemar: ${main.name} is significantly better than ${names(beaten)} in every seed${mostly.length ? ` and better than ${names(mostly)} in 2 of 3 seeds` : ''}; it is not significantly different from ${names(equal)}, so the lighter, steadier model is the choice for on-device use.`)],
  ];
  const reading = [
    tr('ตัวเลข ± คือส่วนเบี่ยงเบนมาตรฐานจากการเทรน 3 ครั้ง ถ้าช่วง ± ของสองโมเดลซ้อนกัน แปลว่าความต่างอาจเกิดจากการสุ่ม', 'The ± is the standard deviation over three runs. Overlapping ranges mean the gap may be chance.'),
    tr('ตารางสถิติ McNemar ตอบว่าความต่างนั้นเกิดจริงหรือบังเอิญ โดยดูจากภาพที่โมเดลหนึ่งถูกแต่อีกโมเดลผิด', 'The McNemar table tells real differences from chance by looking at images one model gets right and the other wrong.'),
    tr('สำหรับแอปที่วิเคราะห์บนมือถือ ขนาดไฟล์และเวลาต่อภาพสำคัญพอ ๆ กับความแม่นยำ เพราะกระทบพื้นที่เครื่องและความลื่นของแอปโดยตรง', 'For an on-device app, file size and time per image matter as much as accuracy, because they affect storage and responsiveness directly.'),
    tr('MobileNetV3-Large เป็นทางเลือกที่สมเหตุสมผลถ้าต้องรองรับมือถือสเปกต่ำมาก เพราะเร็วที่สุดและไม่ต่างจาก EfficientNet-B0 อย่างมีนัยสำคัญ แต่ค่าเฉลี่ยต่ำกว่าและแกว่งมากกว่า', 'MobileNetV3-Large is a reasonable option for very low-end phones: it is the fastest and not significantly different from EfficientNet-B0, though its average is lower and less stable.'),
  ];
  return { summaryTitle, findings, reading };
}

// The six Paddy Doctor classes V3 learns as "other": key, Thai, English, image count.
const OTHER_DISEASES = [['brown_spot', 'ใบจุดสีน้ำตาล', 'Brown spot', 965], ['hispa', 'แมลงดำหนาม', 'Hispa', 1594], ['dead_heart', 'ยอดเหี่ยว (หนอนกอ)', 'Dead heart', 1442], ['downy_mildew', 'ราน้ำค้าง', 'Downy mildew', 620], ['bacterial_leaf_streak', 'ใบขีดโปร่งแสง', 'Bacterial leaf streak', 380], ['bacterial_panicle_blight', 'รวงไหม้จากแบคทีเรีย', 'Bacterial panicle blight', 337]];

export default function ResearchStudy() {
  const { t } = useI18n();
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [typedBubble, setTypedBubble] = useState('');
  const [isTypingBubble, setIsTypingBubble] = useState(true);
  const quickMenuRef = useRef(null);
  useDocTitle({ th: 'การค้นคว้าและการศึกษา | Rice AI', en: 'Research & Study | Rice AI' });
  const tr = (th, en) => t({ th, en });
  const main = mainModel();
  const dep = cmp.deployed;
  const nSeeds = cmp.seeds.length;
  const nRuns = cmp.models.length * nSeeds;
  const { summaryTitle, findings, reading } = useFindings(tr, main);
  const bubbleMessages = [
    tr('ส่งข้อเสนอแนะได้เลย', 'Send feedback'),
    tr('มีไอเดีย? บอกเราได้', 'Have an idea? Tell us.'),
  ];

  useEffect(() => {
    if (quickMenuOpen) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTypedBubble(bubbleMessages[0]);
      setIsTypingBubble(false);
      return undefined;
    }
    const segmenter = typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('th', { granularity: 'grapheme' })
      : null;
    const splitCharacters = (text) => segmenter
      ? [...segmenter.segment(text)].map(({ segment }) => segment)
      : Array.from(text);

    let phraseIndex = 0;
    let characters = splitCharacters(bubbleMessages[phraseIndex]);
    let length = 0;
    let deleting = false;
    let timer;
    setTypedBubble('');
    setIsTypingBubble(true);

    const tick = () => {
      if (!deleting) {
        length += 1;
        setTypedBubble(characters.slice(0, length).join(''));
        if (length >= characters.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1500);
          return;
        }
        timer = window.setTimeout(tick, 105);
        return;
      }

      length -= 1;
      setTypedBubble(characters.slice(0, length).join(''));
      setIsTypingBubble(true);
      if (length <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % bubbleMessages.length;
        characters = splitCharacters(bubbleMessages[phraseIndex]);
        timer = window.setTimeout(tick, 320);
        return;
      }
      timer = window.setTimeout(tick, 58);
    };

    timer = window.setTimeout(tick, 450);
    return () => window.clearTimeout(timer);
  }, [quickMenuOpen, bubbleMessages[0], bubbleMessages[1]]);

  useEffect(() => {
    if (!quickMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!quickMenuRef.current?.contains(event.target)) setQuickMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setQuickMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [quickMenuOpen]);

  return <div className="min-h-screen bg-[#faf8f1] text-slate-900">
    <PublicHeader />
    <main>
      <section className="relative isolate overflow-hidden border-b border-emerald-900/10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(181,224,197,.42),transparent_37%),linear-gradient(135deg,#faf8f1_0%,#f5f4e9_58%,#edf5e9_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[.16] rb-soft-grid" />
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-10 sm:px-8 sm:pb-12 sm:pt-14 lg:px-10 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/15 bg-white/75 px-3 py-1.5 text-xs font-bold text-emerald-900"><BookOpen size={14} /> Rice AI <span className="text-emerald-800/40">/</span> {tr('การค้นคว้าและการศึกษา', 'Research & study')}</div>
              <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.18] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem]">{tr('การพัฒนาโมเดล AI จำแนกโรคใบข้าว', 'Building the rice leaf disease model')}</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{tr('จากรุ่นแรกใน Colab ถึงรุ่นที่ใช้งานจริง: ปรับวิธีฝึก (V1 → V2) เปรียบเทียบ 6 สถาปัตยกรรมเพื่อยืนยันการเลือก EfficientNet-B0 แล้วเพิ่มคลาส "โรคอื่น" ให้รู้ว่าภาพไหนอยู่นอกขอบเขต (V3) ทุกตัวเลขวัดจากภาพทดสอบที่โมเดลไม่เคยเห็น', 'From the first Colab model to the one in service: better training (V1 → V2), a six-architecture comparison confirming EfficientNet-B0, then an "other" class so the model knows when a photo is out of scope (V3). Every number comes from test images the model never saw.')}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#deployed" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-800/25" style={{ backgroundColor: GREEN }}>{tr('ดูโมเดลที่ใช้งานจริง', 'See the deployed model')} <ArrowDown size={16} /></a>
                <a href="#results" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-800 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-800/20">{tr('ผลเปรียบเทียบ 6 โมเดล', 'Six-model comparison')} <ArrowRight size={16} /></a>
              </div>
              <p className="mt-5 max-w-xl text-xs leading-5 text-slate-500">{tr('ผลที่รายงานเป็นผลจำแนกภาพในชุดข้อมูลทดลอง ไม่ใช่ผลวินิจฉัยจากแปลงนาจริง', 'Reported results are image-classification results on the study dataset, not field diagnoses.')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                [Layers3, '3', tr('รุ่นของโมเดล V1 → V3', 'Model releases, V1 → V3')],
                [FlaskConical, '6', tr(`สถาปัตยกรรมที่เปรียบเทียบ (${nRuns} การเทรน)`, `Architectures compared (${nRuns} runs)`)],
                [Target, pct(dep.accuracy), tr('Accuracy 4 โรค · V3 ใช้งานจริง', '4-disease accuracy · V3 in service')],
                [Check, pct(dep.other.rejected, 1), tr('ภาพโรคอื่นที่ V3 ไม่ตอบชื่อโรค', 'Other-disease photos V3 declines to name')],
              ].map(([Icon, value, label]) => <div key={label} className="rounded-2xl border border-emerald-900/10 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,.04)] sm:p-5"><Icon size={18} className="text-emerald-800" /><div className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{value}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500 sm:text-sm">{label}</div></div>)}
            </div>
          </div>
          <nav aria-label={tr('สารบัญงานศึกษา', 'Study contents')} className="mt-10 flex flex-wrap gap-2 border-t border-emerald-900/10 pt-5">
            {[['#summary', tr('สรุป', 'Summary')], ['#video', tr('▶ คลิปอธิบาย', '▶ Video')], ['#study', tr('01 ข้อมูล เงื่อนไข และตัวชี้วัด', '01 Data, setup & metrics')], ['#history', tr('02 V1 → V2', '02 V1 → V2')], ['#method', tr('03 วิธีเปรียบเทียบ', '03 Comparison method')], ['#results', tr('04 ผลเปรียบเทียบ', '04 Comparison results')], ['#deployed', tr('05 V3 ใช้งานจริง', '05 V3 in service')], ['#scope', tr('06 ข้อจำกัดและอ้างอิง', '06 Limits & references')]].map(([href, label]) => <a key={href} href={href} className="rounded-full border border-emerald-900/10 bg-white/70 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-800/40 hover:text-emerald-900">{label}</a>)}
          </nav>
        </div>
      </section>

      <section id="summary" className="scroll-mt-28 mx-auto max-w-7xl px-5 pt-12 sm:px-8 sm:pt-14 lg:px-10">
        <div className="rounded-3xl border border-emerald-900/15 bg-white p-6 shadow-[0_18px_48px_-24px_rgba(31,77,58,.35)] sm:p-8">
          <Eyebrow>{tr('สรุปสำหรับผู้อ่านเร็ว', 'In short')}</Eyebrow>
          <h2 className="mt-3 font-display text-2xl font-bold leading-snug text-slate-950 sm:text-3xl">{tr('สามขั้นตอนที่ทำให้ได้โมเดลปัจจุบัน', 'Three steps to the current model')}</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['#history', 'V1 → V2', tr('ปรับวิธีฝึก', 'Better training'), tr('สถาปัตยกรรมเดิม แต่ปลดล็อกให้ทั้งโมเดลได้เรียนรู้และแยกชุดทดสอบออกมาตั้งแต่แรก Accuracy บนภาพ 761 ภาพเดียวกันขึ้นจาก 75.43% เป็น 97.90%', 'Same architecture, but the whole network is fine-tuned and a test set is held out from the start. Accuracy on the same 761 images rose from 75.43% to 97.90%.')],
              ['#results', tr('เปรียบเทียบ', 'Comparison'), tr('ยืนยันการเลือก EfficientNet-B0', 'EfficientNet-B0 confirmed'), summaryTitle],
              ['#deployed', 'V3', tr('รู้ว่าโรคไหนที่ตัวเองไม่รู้จัก', 'Knows what it does not know'), tr(`เพิ่มคลาส "โรคอื่น" ภาพโรคอื่น ${dep.otherSplit.test} ภาพที่ได้ชื่อโรคผิดลดจาก ${dep.previous.other.given_wrong_diagnosis} เหลือ ${dep.other.given_wrong_diagnosis} ภาพ แลกกับ Accuracy 4 โรคที่ลดเป็น ${pct(dep.accuracy)}`, `An "other" class: wrong names on ${dep.otherSplit.test} other-disease photos fall from ${dep.previous.other.given_wrong_diagnosis} to ${dep.other.given_wrong_diagnosis}, for four-disease accuracy of ${pct(dep.accuracy)}.`)],
            ].map(([href, tag, title, body], i) => <li key={href}><a href={href} className="group flex h-full flex-col rounded-2xl bg-[#f6f7f1] p-5 transition hover:bg-[#eef2e7]"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ backgroundColor: GREEN }}>{i + 1}</span><span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">{tag}</span></div><h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3><p className="mt-1.5 flex-1 text-sm leading-6 text-slate-600">{body}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-800">{tr('อ่านส่วนนี้', 'Read this part')} <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span></a></li>)}
          </ol>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="font-bold text-slate-900">{tr('เทียบทั้ง 3 รุ่นบนภาพทดสอบชุดเดียวกัน', 'All three releases on the same test images')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{tr(`ภาพ 4 โรค 761 ภาพ และภาพโรคอื่น ${cmp.versions.v3.other_size} ภาพ · "ตอบผล" และ "ผิด" ใช้เกณฑ์ความมั่นใจของแต่ละรุ่น (V1, V2 = 75% · V3 = ${Math.round(cmp.versions.v3.threshold * 100)}%) · V1 ไม่มีชุดทดสอบแยกตอนฝึก ภาพบางส่วนอาจเคยอยู่ในชุดฝึกของ V1`, `761 four-disease images and ${cmp.versions.v3.other_size} other-disease images · "answered" and "wrong" use each release's own cut-off (V1, V2 = 75% · V3 = ${Math.round(cmp.versions.v3.threshold * 100)}%) · V1 had no separate test set, so some images may have been in its training data`)}</p></div>
            <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm">
              <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-bold">{tr('ตัวชี้วัด', 'Measure')}</th>{['V1', 'V2', 'V3'].map((v) => <th key={v} className={`px-2 py-3 sm:px-4 text-right font-bold ${v === 'V3' ? 'text-emerald-900' : ''}`}>{v}</th>)}</tr></thead>
              <tbody>{[
                [tr('จำนวนคลาส', 'Classes'), (v) => String(v.classes)],
                [tr('Accuracy 4 โรค', 'Four-disease accuracy'), (v) => pct(v.accuracy)],
                ['Macro F₁', (v) => pct(v.macro_f1)],
                ['AUC', (v) => v.auc.toFixed(4)],
                [tr('ภาพ 4 โรคที่ระบบตอบผล', 'Four-disease photos answered'), (v) => pct(v.answered, 1)],
                [tr('ภาพ 4 โรคที่ตอบผิดโรค', 'Four-disease photos named wrongly'), (v) => String(v.wrong_answers)],
                [tr(`ภาพโรคอื่น ${cmp.versions.v3.other_size} ภาพที่ได้ชื่อโรคผิด`, `Other-disease photos (${cmp.versions.v3.other_size}) named wrongly`), (v) => String(v.other_wrong)],
              ].map(([label, f]) => <tr key={label} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700">{label}</td>{['v1', 'v2', 'v3'].map((k) => <td key={k} className={`px-2 py-3 text-right tabular-nums sm:px-4 ${k === 'v3' ? 'font-bold text-emerald-900' : 'text-slate-600'}`}>{f(cmp.versions[k])}</td>)}</tr>)}</tbody>
            </table></div>
            <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">{tr('V1 → V2 ทำให้แม่นขึ้นมาก · V2 → V3 แลก Accuracy เล็กน้อย เพื่อไม่ให้ชื่อโรคผิดกับภาพโรคที่ระบบยังไม่รองรับ', 'V1 → V2 made the model far more accurate · V2 → V3 trades a little accuracy so photos of unsupported diseases are not given a wrong name')}</p>
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3"><Info size={18} className="mt-0.5 shrink-0 text-amber-800" /><div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-amber-950">{tr('อ่านตัวเลขให้ถูก: แต่ละค่ามาจากคนละการทดลอง', 'Reading the numbers: each comes from a different experiment')}</h3>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs leading-5 text-amber-950/90 sm:grid-cols-2">
                {[
                  [pct(dep.accuracy), tr('V3 ที่ใช้งานจริง บนภาพ 4 โรค 761 ภาพ ภาพที่ถูกจัดเป็น "โรคอื่น" นับว่าผิด', 'V3 in service, on the 761 four-disease images; photos filed as "other" count as wrong')],
                  [`${pm(main.accuracy)}%`, tr('EfficientNet-B0 ในการเปรียบเทียบ 6 โมเดล (4 คลาส เทรน 3 รอบ) ใช้เทียบสถาปัตยกรรม ไม่ได้ติดตั้งใช้งาน', 'EfficientNet-B0 in the six-model comparison (4 classes, 3 runs), used to compare architectures, not deployed')],
                  ['97.90%', tr('V2 รุ่นก่อนหน้า (4 คลาส) บนภาพ 761 ภาพเดียวกัน', 'V2, the previous release (4 classes), on the same 761 images')],
                  ['70.26%', tr('V1 บน validation ของ Colab คนละชุดกับภาพทดสอบ จึงเทียบตรง ๆ ไม่ได้', 'V1 on its Colab validation set, a different subset, so not directly comparable')],
                ].map(([v, d]) => <div key={v} className="grid gap-0.5 sm:grid-cols-[124px_1fr] sm:gap-2"><dt className="font-display text-base font-bold tabular-nums text-amber-950">{v}</dt><dd>{d}</dd></div>)}
              </dl>
            </div></div>
          </div>
        </div>
      </section>

      {/* The whole study as a narrated clip (built in video/, see video/README.md). */}
      <section id="video" className="scroll-mt-28 mx-auto max-w-7xl px-5 pt-14 sm:px-8 sm:pt-16 lg:px-10">
        <SectionHeading eyebrow={tr('คลิปอธิบาย', 'Video walkthrough')} title={tr(`ดูทั้งหมดในคลิป ${Math.round(explainer.duration / 60)} นาที`, `The whole study in ${Math.round(explainer.duration / 60)} minutes`)} body={tr('น้องข้าวหอมพาดูตั้งแต่ข้อมูล การแบ่งชุด V1 → V2 การเปรียบเทียบ 6 โมเดล จนถึง V3 และการใช้งานในแอป มีเสียงบรรยายและซับไทยทุกประโยค ตัวเลขในคลิปตรงกับหน้านี้', 'Khao Hom walks through the data, the split, V1 → V2, the six-model comparison, V3 and the app, with narration and Thai subtitles throughout. Every figure matches this page.')} />
        <div className="mt-20 pb-4 sm:mt-28">
          <PromoVideo
            src="/media/rice-ai-model-explainer-720p.mp4"
            poster="/media/rice-ai-model-explainer-poster.jpg"
            duration={explainer.duration}
            title={{ th: 'คลิปอธิบายการพัฒนาโมเดล AI จำแนกโรคใบข้าว', en: 'How the rice-disease AI model was built' }}
            subtitled
            chapters={explainer.chapters}
          />
        </div>
      </section>

      <section id="study" className="scroll-mt-28">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
        <SectionHeading eyebrow={tr('01 · ข้อมูล เงื่อนไข และตัวชี้วัด', '01 · Data, setup & metrics')} title={tr('ภาพชุดเดียวกันตลอดทุกการทดลอง', 'The same images throughout')} body={tr('ภาพทั้งหมดมาจาก Paddy Doctor การแบ่ง train / validation / test ทำครั้งเดียวและใช้ซ้ำตั้งแต่ V2 ภาพทดสอบ 761 ภาพของ 4 โรคจึงเป็นชุดเดียวกันในทุกตาราง ตัวเลขข้ามรุ่นจึงเทียบกันได้', 'All images come from Paddy Doctor. The train / validation / test split was made once and reused from V2 on, so the 761 four-disease test images are the same in every table and numbers compare across releases.')} />
        <div className="mt-8 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Database size={17} className="text-emerald-800" />{tr('ชุดข้อมูลที่ใช้', 'Dataset')}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{tr('ใช้ภาพจากชุดข้อมูล Paddy Doctor ที่เผยแพร่ในการแข่งขันบน Kaggle (10 คลาส) โดยเลือกเฉพาะ 4 คลาสที่อยู่ในขอบเขตการศึกษา รวม 5,069 ภาพ', 'Images come from the Paddy Doctor dataset as released in the Kaggle competition (10 classes), filtered to the four categories in scope, for 5,069 images total.')}</p>
            <div className="mt-5 space-y-4">
              {datasetClasses.map((item) => <div key={item.key}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-slate-800">{item.key} <span className="font-medium text-slate-500">· {tr(item.th, item.en)}</span></span><span className="shrink-0 tabular-nums text-slate-600">{item.count.toLocaleString()} · {item.pct.toFixed(1)}%</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${item.key} ${item.th}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.pct}><div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: GREEN }} /></div>
              </div>)}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">{tr('BLB มีภาพน้อยที่สุด จึงใช้ class weight ระหว่างฝึกทุกโมเดล', 'BLB is the smallest class, so every model was trained with class weights.')}</p>
          </article>
          <article className="rounded-2xl border border-emerald-900/10 bg-[#f2f5ed] p-5 sm:p-6">
            <Eyebrow>{tr('การแบ่งข้อมูล', 'Data split')}</Eyebrow>
            <h3 className="mt-2 text-base font-bold text-slate-900">{tr('Stratified 70 : 15 : 15 · seed 42', 'Stratified 70 : 15 : 15 · seed 42')}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{tr('ทุกชุดมีสัดส่วนของแต่ละโรคเท่ากับข้อมูลทั้งหมด', 'Each subset keeps the class proportions of the full dataset.')}</p>
            {/* One bar, widths to scale, read like a student: study, practice quiz, final exam. */}
            <div className="mt-5 flex h-12 overflow-hidden rounded-xl text-xs font-bold" role="img" aria-label={tr('สัดส่วนการแบ่งข้อมูล ฝึก 70% ตรวจสอบ 15% ทดสอบ 15%', 'Split proportions: train 70%, validation 15%, test 15%')}>
              <div className="flex items-center justify-center bg-[#1f4d3a] text-white" style={{ width: '70%' }}>{tr('เรียน', 'Train')} 70% · 3,548</div>
              <div className="flex items-center justify-center border-l-2 border-white bg-[#c89b3c] text-[#3a2a08]" style={{ width: '15%' }}>760</div>
              <div className="flex items-center justify-center border-l-2 border-white bg-[#8fb5a0] text-[#123326]" style={{ width: '15%' }}>761</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ['#1f4d3a', tr('ชุดเรียน · Train 70%', 'Train · 70%'), tr('โมเดลดูรูปพร้อมเฉลยซ้ำหลายรอบ แล้วปรับตัวเองให้ทายถูก', 'The model sees these with their labels, round after round, and adjusts itself')],
                ['#c89b3c', tr('ชุดสอบย่อย · Validation 15%', 'Practice quiz · Validation 15%'), tr('ใช้ระหว่างเทรน ดูว่าเก่งขึ้นไหม และเลือกรอบที่ดีที่สุดเก็บไว้', 'Checked during training to see progress and keep the best round')],
                ['#8fb5a0', tr('ชุดสอบจริง · Test 15%', 'Final exam · Test 15%'), tr('ซ่อนไว้จนจบ ไม่เคยให้โมเดลเห็นเลย ตัวเลขความแม่นยำทั้งหมดมาจากกองนี้', 'Hidden until the end and never shown to the model; every accuracy figure comes from here')],
              ].map(([c, title, desc]) => <div key={title} className="rounded-xl bg-white p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-800"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />{title}</div><p className="mt-1.5 text-[11px] leading-5 text-slate-500">{desc}</p></div>)}
            </div>
            {/* V1 is the exception: two piles only, so it never had an untouched exam. */}
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-amber-950"><span>{tr('ยกเว้น V1 (Colab): แบ่งแค่ 2 กอง', 'Except V1 (Colab): only two piles')}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-amber-900">{tr('V2 · V3 · การเปรียบเทียบ ใช้ 3 กองด้านบน', 'V2 · V3 · the comparison use the three piles above')}</span></div>
              <div className="mt-2 flex h-8 overflow-hidden rounded-lg text-[11px] font-bold" role="img" aria-label={tr('V1 แบ่งเรียน 85% สอบย่อย 15% ไม่มีชุดสอบจริง', 'V1 split: train 85%, validation 15%, no test set')}>
                <div className="flex items-center justify-center bg-slate-400 text-white" style={{ width: '85%' }}>{tr('เรียน 85% · ≈4,309', 'Train 85% · ≈4,309')}</div>
                <div className="flex items-center justify-center border-l-2 border-white bg-[#c89b3c] text-[#3a2a08]" style={{ width: '15%' }}>≈760</div>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-amber-950/85">{tr('ไม่มีชุดสอบจริงแยก ตัวเลข 70.26% ของ V1 จึงมาจากชุดสอบย่อยของมันเอง ภายหลังเราเอา V1 มาสอบกับชุดสอบจริง 761 รูปของ V2 ได้ 75.43% แต่บางรูปอาจเคยอยู่ในกองเรียนของ V1 ตัวเลขนี้จึงอาจดีกว่าความจริง', 'With no separate test set, V1’s 70.26% comes from its own validation pile. Rescored later on V2’s 761 test images it reached 75.43%, but some of those images may have been in V1’s training pile, so that figure may flatter it.')}</p>
            </div>
            {/* V3 keeps the same three piles; each pile simply gains the other-disease photos. */}
            <div className="mt-3 rounded-xl border border-emerald-900/15 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-950"><span>{tr('V3: ยัง 3 กองเดิม แต่เพิ่มรูปโรคอื่นเข้าไปทุกกอง', 'V3: the same three piles, each with other-disease photos added')}</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-900">{tr('4 โรคเป็นรูปชุดเดิมทุกรูป', 'The four-disease images are unchanged')}</span></div>
              <div className="mt-2 flex h-11 overflow-hidden rounded-lg text-[10px] font-bold sm:text-[11px]" role="img" aria-label={tr('V3 แบ่ง เรียน 7,284 สอบย่อย 1,561 สอบจริง 1,562 แต่ละกองมีรูป 4 โรคเดิมและรูปโรคอื่น', 'V3 split: train 7,284, validation 1,561, test 1,562, each pile holding the original four-disease images plus other-disease images')}>
                {[['70%', 3548, 3736, '#1f4d3a', '#4f7a63', '#fff'], ['15%', 760, 801, '#c89b3c', '#dcbd78', '#3a2a08'], ['15%', 761, 801, '#8fb5a0', '#b9d2c4', '#123326']].map(([w, a, b, c1, c2, fg], k) => <div key={k} className={`flex flex-col ${k ? 'border-l-2 border-white' : ''}`} style={{ width: w }}>
                  <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: c1, color: fg }}>{a.toLocaleString()}</div>
                  <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: c2, color: fg }}>+{b.toLocaleString()}</div>
                </div>)}
              </div>
              <div className="mt-1.5 flex text-center text-[10px] font-semibold leading-4 text-slate-600 sm:text-[11px]">
                <span style={{ width: '70%' }}>{tr('เรียน 7,284', 'Train 7,284')}</span><span style={{ width: '15%' }}>{tr('สอบย่อย', 'Val')}<br />1,561</span><span style={{ width: '15%' }}>{tr('สอบจริง', 'Test')}<br />1,562</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-600">{tr('แถวบน = รูป 4 โรคชุดเดิม · แถวล่าง = รูปโรคอื่น 6 ชนิด (5,338 รูป) แบ่ง 70/15/15 แยกตามชนิดโรค ตัวเลข Accuracy 4 โรคของ V3 จึงยังวัดจากกองสอบจริง 761 รูปเดิม ส่วนอีก 801 รูปใช้วัดว่าระบบปฏิเสธโรคอื่นได้แค่ไหน', 'Top row = the original four-disease images · bottom row = 5,338 other-disease images, split 70/15/15 within each disease. V3’s four-disease accuracy still comes from the same 761 test images; the extra 801 measure how well it declines other diseases.')}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-600">{tr('ภาพทั้งหมดถูกย่อเป็น 224 × 224 พิกเซลด้วยวิธีเดียวกับที่ระบบใช้จริง รายชื่อภาพทดสอบ 761 ภาพตรวจแล้วว่าตรงกันทุกภาพในทุกการทดลอง', 'All images are resized to 224 × 224 exactly as the live system does. The 761 test filenames were checked to match one for one in every experiment.')}</p>
          </article>
        </div>
        <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><Eyebrow>{tr('ใช้เฉพาะ V3', 'V3 only')}</Eyebrow><h3 className="mt-2 text-base font-bold text-slate-900">{tr('ภาพโรคอื่น 5,338 ภาพ 6 ชนิด (คลาส OTHER)', 'Other diseases: 5,338 images, 6 kinds (class OTHER)')}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{tr('อีก 6 คลาสใน Paddy Doctor ชุดเดียวกัน ระบบยังไม่ให้คำแนะนำโรคเหล่านี้ จึงสอนให้โมเดลจำว่าอยู่นอกขอบเขต แบ่ง 70/15/15 ตามชนิดโรค: train 3,736 · validation 801 · test 801', 'The remaining six Paddy Doctor classes. The app has no advice for them, so the model learns to flag them as out of scope. Split 70/15/15 by disease: train 3,736 · validation 801 · test 801.')}</p></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {OTHER_DISEASES.map(([k, th, en, n]) => <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"><span className="font-semibold text-slate-700">{tr(th, en)}</span><span className="tabular-nums text-slate-500">{n.toLocaleString()}</span></div>)}
          </div>
        </article>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Microscope size={17} className="text-emerald-800" />{tr('ตัวชี้วัด', 'Metrics')}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Accuracy', tr('สัดส่วนภาพทั้งหมดที่จำแนกถูก', 'Share of all images classified correctly')],
                  ['Precision', tr('ในภาพที่โมเดลทายว่าเป็นโรคนี้ ทายถูกกี่ภาพ', 'Of images predicted as this class, how many are right')],
                  ['Recall', tr('ในภาพที่เป็นโรคนี้จริง โมเดลหาเจอกี่ภาพ', 'Of images truly in this class, how many the model finds')],
                  ['Macro F₁', tr('เฉลี่ย F₁ ของ 4 คลาสโดยให้น้ำหนักเท่ากัน คลาสที่มีภาพน้อยจึงไม่ถูกกลบ', 'Average F₁ over four classes with equal weight, so small classes count')],
                  ['AUC · One-vs-rest', tr('ความสามารถแยกแต่ละคลาสออกจากคลาสอื่น (1.0 = แยกได้สมบูรณ์)', 'How well each class separates from the rest (1.0 = perfect)')],
                  [tr('ขนาดและความเร็ว', 'Size & speed'), tr('ขนาดไฟล์ TFLite Float16, GFLOPs ต่อภาพ และเวลาต่อภาพบน CPU', 'TFLite Float16 file size, GFLOPs per image and CPU time per image')],
                ].map(([name, desc]) => <div key={name} className="border-l-2 border-emerald-700/30 pl-3"><div className="text-xs font-bold text-emerald-900">{name}</div><p className="mt-1 text-xs leading-5 text-slate-600">{desc}</p></div>)}
              </div>
            </article>
            <article className="rounded-2xl border border-emerald-900/10 bg-[#f2f5ed] p-5 sm:p-6">
              <h3 className="text-sm font-bold text-slate-900">{tr('สูตรที่ใช้คำนวณ F₁', 'F₁ score formulas')}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{tr('F₁ เป็นค่าเฉลี่ยฮาร์มอนิกของ Precision และ Recall', 'F₁ is the harmonic mean of precision and recall.')}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-4 py-3"><div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">F₁-score</div><math display="block" aria-label="F one equals two times precision times recall divided by precision plus recall" className="my-3 block max-w-full text-base font-semibold text-slate-800 sm:text-lg"><mrow><msub><mi>F</mi><mn>1</mn></msub><mo>=</mo><mfrac><mrow><mn>2</mn><mo>×</mo><mtext>Precision</mtext><mo>×</mo><mtext>Recall</mtext></mrow><mrow><mtext>Precision</mtext><mo>+</mo><mtext>Recall</mtext></mrow></mfrac></mrow></math><p className="text-[11px] leading-5 text-slate-500">P = TP/(TP+FP) · R = TP/(TP+FN)</p></div>
                <div className="rounded-xl bg-white px-4 py-3"><div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Macro F₁</div><math display="block" aria-label="Macro F one equals one over C times sum of class F one" className="my-3 block max-w-full text-base font-semibold text-slate-800 sm:text-lg"><mrow><mtext>Macro-</mtext><msub><mi>F</mi><mn>1</mn></msub><mo>=</mo><mfrac><mn>1</mn><mi>C</mi></mfrac><munderover><mo>∑</mo><mrow><mi>c</mi><mo>=</mo><mn>1</mn></mrow><mi>C</mi></munderover><msub><mi>F</mi><mrow><mn>1</mn><mo>,</mo><mi>c</mi></mrow></msub></mrow></math><p className="text-[11px] leading-5 text-slate-500">{tr('C = 4 คลาส · เฉลี่ย F₁ ของทุกคลาสเท่ากัน', 'C = 4 classes · each class F₁ contributes equally')}</p></div>
              </div>
            </article>
          </div>

          {/* Every experiment on the page in one grid: what stayed the same and what changed. */}
          <div id="setup" className="mt-8 scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="font-bold text-slate-900">{tr('ทุกการทดลองในหน้านี้ ใช้อะไรเหมือนกัน อะไรต่างกัน', 'Every experiment on this page: what was the same, what changed')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{tr('ช่องสีเขียว = เหมือนการเปรียบเทียบ 6 โมเดล · ช่องสีเหลือง = ต่างออกไป · ส่วนเครื่องมือที่ใช้เทรนไม่มีสี เพราะไม่มีผลกับความแม่นยำ', 'Green = same as the six-model comparison · amber = different · training tools are left plain because they do not affect accuracy')}<span className="sm:hidden">{tr(' · เลื่อนตารางไปทางขวาเพื่อดูครบ', ' · swipe the table sideways to see all')}</span></p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-bold">{tr('เรื่อง', 'Item')}</th><th className="px-3 py-3 font-bold">V1</th><th className="px-3 py-3 font-bold">V2</th><th className="px-3 py-3 font-bold text-emerald-900">{tr('เปรียบเทียบ 6 โมเดล', 'Six-model comparison')}</th><th className="px-3 py-3 font-bold">V3</th></tr></thead>
              <tbody>{[
                [tr('สถาปัตยกรรม', 'Architecture'), ['EfficientNet-B0', 1], ['EfficientNet-B0', 1], [tr('6 แบบ (ส่วนที่ต่าง)', '6 kinds (the variable)'), 1], ['EfficientNet-B0', 1]],
                [tr('คลาส', 'Classes'), [tr('4 โรค', '4'), 1], [tr('4 โรค', '4'), 1], [tr('4 โรค', '4'), 1], [tr('4 โรค + โรคอื่น', '4 + other'), 0]],
                [tr('การแบ่งข้อมูล', 'Split'), [tr('85/15 ไม่มีชุดทดสอบ', '85/15, no test set'), 0], [tr('70/15/15 · seed 42', '70/15/15 · seed 42'), 1], [tr('70/15/15 · seed 42', '70/15/15 · seed 42'), 1], [tr('เดิม + ภาพโรคอื่น', 'Same + other-disease images'), 0]],
                [tr('ชุดทดสอบ 761 ภาพ', '761 test images'), [tr('วัดซ้ำภายหลัง', 'Rescored later'), 0], [tr('ชุดเดียวกัน', 'Same set'), 1], [tr('ชุดเดียวกัน', 'Same set'), 1], [tr('ชุดเดียวกัน (+801 ภาพโรคอื่น)', 'Same set (+801 other)'), 1]],
                [tr('น้ำหนักเริ่มต้น · ขนาดภาพ', 'Start weights · image size'), ['ImageNet · 224×224', 1], ['ImageNet · 224×224', 1], ['ImageNet · 224×224', 1], ['ImageNet · 224×224', 1]],
                [tr('สูตรเทรน', 'Recipe'), [tr('ปลดล็อก 20% · lr 0.00001', 'Top 20% · lr 0.00001'), 0], [tr('สูตร V2', 'V2 recipe'), 1], [tr('สูตร V2 (VGG-16 ใช้ lr 0.00001)', 'V2 recipe (VGG-16 at lr 0.00001)'), 1], [tr('สูตร V2', 'V2 recipe'), 1]],
                [tr('จำนวนรอบเทรน', 'Training runs'), ['1', 0], ['1', 0], [tr('3 seed ต่อโมเดล', '3 seeds each'), 1], [tr('3 seed เลือกด้วย validation', '3 seeds, picked on validation'), 1]],
                [tr('เกณฑ์ความมั่นใจ', 'Confidence cut-off'), ['75%', 0], ['75%', 0], [tr('ไม่ใช้ (วัด Accuracy ตรง ๆ)', 'None (plain accuracy)'), 1], [tr('60% เลือกด้วย validation', '60%, chosen on validation'), 0]],
              ].map(([label, ...cells]) => <tr key={label} className="border-t border-slate-100"><td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-bold text-slate-800">{label}</td>{cells.map(([v, same], j) => <td key={j} className="px-3 py-2.5"><span className={`inline-block rounded-md px-2 py-1 leading-4 ${j === 2 ? 'bg-emerald-50 font-semibold text-emerald-950' : same ? 'bg-emerald-50/60 text-emerald-950' : 'bg-amber-50 text-amber-950'}`}>{v}</span></td>)}</tr>)}</tbody>
              {/* Tools rather than conditions: shown plain, because a different machine does not change the result. */}
              <tbody>
                <tr className="border-t-2 border-slate-200 bg-slate-50"><td colSpan={5} className="sticky left-0 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{tr('เครื่องมือที่ใช้เทรน', 'Training tools')}</td></tr>
                {[
                  [tr('ข้อมูลที่ใช้เทรน', 'Training data'), tr('Paddy Doctor 4 โรค 5,069 ภาพ', 'Paddy Doctor, 4 classes, 5,069 images'), tr('Paddy Doctor 4 โรค 5,069 ภาพ', 'Paddy Doctor, 4 classes, 5,069 images'), tr('Paddy Doctor 4 โรค 5,069 ภาพ', 'Paddy Doctor, 4 classes, 5,069 images'), tr('5,069 ภาพเดิม + โรคอื่น 6 ชนิด 5,338 ภาพ', 'The 5,069 + 5,338 images of 6 other diseases')],
                  [tr('เครื่องที่เทรน', 'Hardware'), tr('Google Colab (GPU คลาวด์)', 'Google Colab (cloud GPU)'), 'CPU Intel Core i5-12450H', 'GPU NVIDIA RTX 4070 Laptop 8 GB', 'GPU NVIDIA RTX 4070 Laptop 8 GB'],
                  [tr('ซอฟต์แวร์ที่เทรน', 'Training software'), 'TensorFlow 2.20 · Keras 3.13 · Python 3.12', 'TensorFlow 2.21 · Keras 3.15 · Python 3.13', 'Keras 3.15 + PyTorch 2.11 (CUDA 12.8) · Python 3.13', 'Keras 3.15 + PyTorch 2.11 (CUDA 12.8) · Python 3.13'],
                  [tr('เวลาเทรน', 'Training time'), tr('≈ 7 นาที (25 epochs)', '≈ 7 min (25 epochs)'), tr('≈ 45 นาที', '≈ 45 min'), tr('13–31 นาทีต่อรอบ · รวม 18 รอบ ≈ 6 ชม.', '13–31 min per run · 18 runs ≈ 6 h'), tr('≈ 2 ชม. (3 seed)', '≈ 2 h (3 seeds)')],
                  [tr('วัดผลด้วย', 'Scored with'), tr('TensorFlow 2.21 · CPU เดียวกัน (วัดซ้ำ)', 'TensorFlow 2.21 · same CPU (rescored)'), 'TensorFlow 2.21 · CPU i5-12450H', 'TensorFlow 2.21 · CPU i5-12450H', 'TensorFlow 2.21 · CPU i5-12450H'],
                ].map(([label, ...cells]) => <tr key={label} className="border-t border-slate-100"><td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-bold text-slate-800">{label}</td>{cells.map((v, j) => <td key={j} className={`px-3 py-2.5 leading-5 ${j === 2 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{v}</td>)}</tr>)}
              </tbody>
            </table></div>
            <div className="space-y-1.5 border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">
              <p>{tr('การเปรียบเทียบจึงเปลี่ยนแค่สถาปัตยกรรม ทุกอย่างที่เหลือเหมือนกัน ส่วน EfficientNet-B0 ในการเปรียบเทียบเป็นการเทรนใหม่บน GPU ไม่ใช่ไฟล์ V2 ที่ใช้งาน จึงได้ตัวเลขต่างจาก V2 เล็กน้อย (98.25% กับ 97.90%)', 'So the comparison changes only the architecture. Its EfficientNet-B0 is a fresh GPU run, not the deployed V2 file, which is why its figure differs slightly (98.25% vs 97.90%).')}</p>
              <p>{tr('ทำไมเทรนด้วย PyTorch แต่วัดผลด้วย TensorFlow: TensorFlow บน Windows ใช้ GPU ไม่ได้ จึงเทรนด้วย Keras 3 ที่รันบน PyTorch ไฟล์ .keras ที่ได้เปิดใน TensorFlow ได้ตรงกัน ทุกรุ่นจึงถูกวัดด้วยโปรแกรมและเครื่องเดียวกัน เครื่องที่ต่างกันมีผลแค่เวลาเทรน ไม่มีผลกับความแม่นยำ', 'Why train on PyTorch but score with TensorFlow: TensorFlow on Windows has no GPU support, so training ran on Keras 3 over PyTorch. The saved .keras files load unchanged in TensorFlow, so every version is scored by the same software on the same machine. The machine only changes training time, not accuracy.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="history" className="scroll-mt-28 border-y border-slate-200 bg-white/60">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <SectionHeading eyebrow={tr('02 · จาก V1 สู่ V2', '02 · From V1 to V2')} title={tr('สถาปัตยกรรมเดิม ปรับวิธีฝึก', 'Same architecture, better training')} body={tr('Rice AI ใช้ EfficientNet-B0 ตั้งแต่รุ่นแรก V1 ฝึกใน Colab ปลดล็อกแค่ 20% ของชั้นบนและใช้ learning rate ต่ำมาก V2 ปลดล็อกทุกชั้นและแยกชุดทดสอบตั้งแต่แรก สูตรของ V2 คือสูตรที่ใช้ต่อในการเปรียบเทียบ (ส่วน 03) และใน V3 (ส่วน 05) ซึ่งเปลี่ยนแค่จำนวนคลาส ไม่ได้เปลี่ยนวิธีฝึก', 'Rice AI has used EfficientNet-B0 from the start. V1 was trained in Colab with only the top 20% unfrozen and a very low learning rate. V2 fine-tunes every layer and holds out a test set from the start; its recipe is the one used in the comparison (section 03) and in V3 (section 05), which changes the classes, not the training.')} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['V1 · COLAB', tr('แนวทางเริ่มต้น', 'Initial approach'), [
                [tr('การแบ่งข้อมูล', 'Split'), tr('train/validation 85:15 · ไม่มี test set แยก', 'Train/validation 85:15 · no separate test set')],
                [tr('ช่วงที่ 1', 'Stage 1'), tr('ล็อก backbone สูงสุด 15 epochs · lr 0.001', 'Frozen backbone, up to 15 epochs · lr 0.001')],
                [tr('ช่วงที่ 2', 'Stage 2'), tr('ปลดล็อก 20% บนสุด สูงสุด 10 epochs · lr 0.00001', 'Top 20% unfrozen, up to 10 epochs · lr 0.00001')],
                [tr('อื่น ๆ', 'Other'), tr('dropout 0.3 · class weight · ไม่มี label smoothing', 'Dropout 0.3 · class weights · no label smoothing')],
              ], false],
              ['V2 · FINE-TUNED', tr('แนวทางปรับปรุง (รุ่นก่อนหน้า)', 'Refined approach (previous release)'), [
                [tr('การแบ่งข้อมูล', 'Split'), tr('stratified train/validation/test 70:15:15', 'Stratified train/validation/test 70:15:15')],
                [tr('ช่วงที่ 1', 'Stage 1'), tr('ล็อก backbone สูงสุด 6 epochs · lr 0.001', 'Frozen backbone, up to 6 epochs · lr 0.001')],
                [tr('ช่วงที่ 2', 'Stage 2'), tr('ปลดล็อกทุกชั้นยกเว้น BatchNorm สูงสุด 18 epochs · lr 0.0001', 'All layers except BatchNorm, up to 18 epochs · lr 0.0001')],
                [tr('อื่น ๆ', 'Other'), tr('dropout 0.3 · class weight · label smoothing 0.1', 'Dropout 0.3 · class weights · label smoothing 0.1')],
              ], true],
            ].map(([tag, title, items, isV2]) => <article key={tag} className={`rounded-2xl border bg-white p-5 sm:p-6 ${isV2 ? 'border-emerald-900/15 shadow-[0_10px_28px_rgba(31,77,58,.08)]' : 'border-slate-200'}`}>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider ${isV2 ? 'text-white' : 'bg-slate-100 text-slate-700'}`} style={isV2 ? { backgroundColor: GREEN } : undefined}>{tag}</span>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
              <dl className="mt-3 space-y-2 text-sm leading-6">{items.map(([k, v]) => <div key={k} className="grid grid-cols-[88px_1fr] gap-3"><dt className="font-bold text-slate-800">{k}</dt><dd className="text-slate-600">{v}</dd></div>)}</dl>
            </article>)}
          </div>

          <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
            <div className="flex items-start gap-3"><Info size={18} className="mt-0.5 shrink-0 text-amber-800"/><div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-amber-950">{tr('70.26% ของ V1 กับ 97.90% ของ V2 วัดคนละชุด', 'V1’s 70.26% and V2’s 97.90% come from different subsets')}</h3>
              <p className="mt-1 text-xs leading-5 text-amber-950/85">{tr('V1 ไม่มีชุดทดสอบแยก (ดูแถบแบ่งข้อมูลในส่วน 01) 70.26% จึงเป็นผลบนชุดสอบย่อยของ V1 เอง การ์ดด้านล่างใช้ V1 ที่วัดซ้ำบนภาพทดสอบ 761 ภาพเดียวกับ V2 (75.43%) เพื่อเทียบบนข้อสอบชุดเดียวกัน', 'V1 had no separate test set (see the split in section 01), so 70.26% is its own validation score. The cards below use V1 rescored on V2’s 761 test images (75.43%) so both sit the same exam.')}</p>
            </div></div>
          </aside>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <MetricCard title="Accuracy" v1="75.43%" v2="97.90%" delta={tr('+22.47 จุดเปอร์เซ็นต์', '+22.47 percentage points')} tr={tr}/>
            <MetricCard title="Macro F₁" v1="71.37%" v2="97.78%" delta={tr('+26.41 จุดเปอร์เซ็นต์', '+26.41 percentage points')} tr={tr}/>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="font-bold text-slate-900">{tr('ผลแยกตามคลาส · V1 เทียบ V2', 'Per-class results · V1 vs V2')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{tr('วัดบนภาพทดสอบ 761 ภาพเดียวกัน · Δ คือผลต่าง F₁ หน่วยจุดเปอร์เซ็นต์ คำนวณจากค่าก่อนปัดเศษ จึงอาจต่างจากการลบตัวเลขที่แสดง 0.01', 'Same 761 test images · Δ is the F₁ difference in percentage points, computed from unrounded values, so it can differ by 0.01 from subtracting the displayed numbers.')}</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[940px] border-collapse text-left text-sm">
              <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-bold">{tr('คลาส', 'Class')}</th><th className="px-3 py-3 text-right font-bold">n</th><th className="px-3 py-3 text-right font-bold">Precision · V1</th><th className="px-3 py-3 text-right font-bold">Recall · V1</th><th className="px-3 py-3 text-right font-bold">Precision · V2</th><th className="px-3 py-3 text-right font-bold">Recall · V2</th><th className="px-3 py-3 text-right font-bold">F₁ · V1</th><th className="px-3 py-3 text-right font-bold">F₁ · V2</th><th className="px-4 py-3 text-right font-bold">Δ pp</th></tr></thead>
              <tbody>{classResults.map((row) => <tr key={row.name} className="border-t border-slate-100"><td className="px-4 py-3"><span className="font-bold text-slate-900">{row.name}</span><span className="ml-2 text-xs text-slate-500">· {tr(row.th, row.en)}</span></td><td className="px-3 py-3 text-right text-slate-600">{row.support}</td><td className="px-3 py-3 text-right text-slate-700">{row.precisionV1}</td><td className="px-3 py-3 text-right text-slate-700">{row.recallV1}</td><td className="px-3 py-3 text-right text-slate-700">{row.precisionV2}</td><td className="px-3 py-3 text-right text-slate-700">{row.recallV2}</td><td className="px-3 py-3 text-right text-slate-500">{row.f1Initial}</td><td className="px-3 py-3 text-right font-bold text-emerald-900">{row.f1Tuned}</td><td className="px-4 py-3 text-right font-semibold text-emerald-800">{row.delta}</td></tr>)}</tbody>
            </table></div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Figure src="/research-study/confusion-matrix-initial.png" alt="V1 · rescored" title={tr('ตารางสับสน · V1 · วัดซ้ำ', 'Confusion matrix · V1 · rescored')} caption={tr('วัดซ้ำบนภาพทดสอบ 761 ภาพชุดเดียวกับ V2 · ถูก 574 ภาพ · แถวคือคลาสจริง คอลัมน์คือผลทำนาย', 'Rescored on V2’s 761 test images · 574 correct · rows are actual classes, columns are predictions.')}/>
            <Figure src="/research-study/confusion-matrix-finetuned.png" alt="V2" title={tr('ตารางสับสน · V2', 'Confusion matrix · V2')} caption={tr('ถูก 745 จาก 761 ภาพ · ผิดรวม 16 ภาพ จุดที่พลาดมากสุดคือ TUNGRO ถูกทายเป็น HEALTHY 5 ภาพ', '745 of 761 correct · 16 errors, the largest being TUNGRO predicted as HEALTHY (5 images).')}/>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Figure src="/research-study/training-curves-v1.png" alt="V1 · Colab" title={tr('กราฟระหว่างการฝึก V1', 'Training curves · V1')} caption={tr('Accuracy และ Loss จากบันทึกการรัน Colab · เส้นประคือจุดเริ่ม fine-tuning', 'Accuracy and loss from the saved Colab run · dashed line marks the start of fine-tuning.')}/>
            <Figure src="/research-study/training-curves.png" alt="V2" title={tr('กราฟระหว่างการฝึก V2', 'Training curves · V2')} caption={tr('Accuracy และ Loss ของชุดฝึกกับชุดตรวจสอบ · เส้นประคือจุดเริ่ม fine-tuning', 'Training and validation accuracy and loss · dashed line marks the start of fine-tuning.')}/>
          </div>
        </div>
      </section>

      <section id="method" className="scroll-mt-28">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <SectionHeading eyebrow={tr('03 · วิธีเปรียบเทียบ', '03 · Comparison method')} title={tr('EfficientNet-B0 คือตัวเลือกที่ถูกไหม', 'Was EfficientNet-B0 the right choice?')} body={tr('ก่อนพัฒนาต่อ เราเทรนโมเดลยอดนิยม 6 ตัวด้วยภาพ 4 คลาส สูตรของ V2 และภาพทดสอบชุดเดียวกัน ทุกตัวเริ่มจากน้ำหนัก ImageNet เปลี่ยนแค่สถาปัตยกรรม', 'Before going further we trained six popular models on the four classes with the V2 recipe and the same test images. All start from ImageNet weights; only the architecture changes.')} />

          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [tr('ข้อมูลเดียวกัน', 'Same data'), tr('ภาพฝึก ตรวจสอบ และทดสอบชุดเดียวกันทุกภาพ', 'Identical train, validation and test images')],
              [tr('สูตรเดียวกัน', 'Same recipe'), tr('สูตรของ V2 ทุกตัว เครื่องและซอฟต์แวร์เดียวกัน (รายละเอียดในตารางด้านล่าง)', 'The V2 recipe for every model, on the same machine and software (details in the tables below)')],
              [tr(`เทรนซ้ำ ${nSeeds} รอบ`, `${nSeeds} repeats`), tr(`seed ${cmp.seeds.join(', ')} รายงานค่าเฉลี่ย ± SD ไม่ใช่รอบที่ดีที่สุด (อธิบายด้านล่าง)`, `Seeds ${cmp.seeds.join(', ')}; we report mean ± SD, not the best run (explained below)`)],
              [tr('วัดมากกว่าความแม่น', 'More than accuracy'), tr('วัดขนาดไฟล์ การคำนวณ และเวลาต่อภาพของไฟล์ที่แอปมือถือใช้', 'File size, compute and per-image time of the file the app uses')],
            ].map(([title, body], i) => <li key={i} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-800">{tr('ขั้นที่', 'Step')} {i + 1}</div><h3 className="mt-2 text-sm font-bold text-slate-900">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-600">{body}</p></li>)}
          </ol>

          <h3 className="mt-10 text-lg font-bold text-slate-900">{tr('โมเดลที่นำมาเปรียบเทียบ', 'The models in this study')}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{tr('เลือกให้ครอบคลุมทั้งโมเดลสำหรับมือถือ baseline มาตรฐาน และโมเดลสมัยใหม่ขนาดใหญ่', 'Chosen to cover mobile models, standard baselines and a large modern model.')}</p>
          <div className="mt-5"><ModelCards tr={tr} t={t} /></div>

          {/* Inside the six-model column: what every model shared and the few per-model settings. */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="font-bold text-slate-900">{tr('ภายใน 6 โมเดลที่นำมาเปรียบเทียบ: อะไรเหมือน อะไรต่าง', 'Inside the six-model comparison: what was shared, what differed')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{tr('เงื่อนไขของทุกการทดลอง (V1, V2, 6 โมเดล, V3) อยู่ในตารางส่วน 01 ตารางนี้ขยายคอลัมน์ "เปรียบเทียบ 6 โมเดล" ออกเป็นรายโมเดล', 'The setup of every experiment (V1, V2, six models, V3) is in the section 01 table; this one opens its "six-model comparison" column model by model')} <a href="#setup" className="font-bold text-emerald-800 hover:underline">{tr('ดูตาราง', 'See table')}</a></p></div>
            <p className="border-b border-slate-100 bg-emerald-50/50 px-4 py-3 text-xs leading-5 text-emerald-950 sm:px-5"><span className="font-bold">{tr('เหมือนกันทุกตัว: ', 'Same for all: ')}</span>{tr('ทุกอย่างในคอลัมน์ "เปรียบเทียบ 6 โมเดล" ของตารางส่วน 01 และสูตรการเทรนด้านล่าง ต่างกันแค่ 3 ค่าในตารางนี้', 'everything in the "six-model comparison" column of the section 01 table and the training recipe below. Only the three settings in this table differ.')}</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-bold">{tr('โมเดล', 'Model')}</th><th className="px-3 py-3 font-bold">{tr('ขนาด (พารามิเตอร์)', 'Size (params)')}</th><th className="px-3 py-3 font-bold">{tr('การปรับค่าพิกเซล', 'Pixel scaling')}</th><th className="px-3 py-3 font-bold">{tr('ป้อนภาพต่อครั้ง', 'Images per step')}</th><th className="px-3 py-3 font-bold">{tr('lr ช่วงที่ 2', 'Stage-2 lr')}</th></tr></thead>
              <tbody>{cmp.models.map((m) => {
                const pre = { densenet121: ['torch', 0], vgg16: ['caffe', 0], resnet50: ['caffe', 0] }[m.key] || [tr('อยู่ในโมเดล', 'Built into model'), 1];
                const micro = ['densenet121', 'vgg16', 'resnet50', 'convnext_tiny'].includes(m.key) ? [tr(`16 × 2 (= ${cmp.recipe.batch})`, `16 × 2 (= ${cmp.recipe.batch})`), 0] : [String(cmp.recipe.batch), 1];
                const lr = m.finetuneLr && m.finetuneLr !== cmp.recipe.finetune.lr ? [String(m.finetuneLr), 0] : [String(cmp.recipe.finetune.lr), 1];
                const cell = ([v, same]) => <span className={`inline-block rounded-md px-2 py-1 leading-4 ${same ? 'bg-emerald-50/60 text-emerald-950' : 'bg-amber-50 text-amber-950'}`}>{v}</span>;
                return <tr key={m.key} className="border-t border-slate-100"><td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-bold text-slate-800">{m.name}</td><td className="px-3 py-2.5 tabular-nums text-slate-700">{(m.params / 1e6).toFixed(1)} M</td><td className="px-3 py-2.5">{cell(pre)}</td><td className="px-3 py-2.5">{cell(micro)}</td><td className="px-3 py-2.5">{cell(lr)}</td></tr>;
              })}</tbody>
            </table></div>
            <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">{tr('สีเหลืองคือค่าที่ต่างจากตัวอื่น และไม่ได้ทำให้ได้เปรียบ: การปรับค่าพิกเซลต้องตรงกับที่น้ำหนัก ImageNet ของแต่ละโมเดลถูกฝึกมา · 16 × 2 คือป้อนทีละ 16 ภาพสองครั้งแล้วค่อยปรับน้ำหนัก เพราะ GPU 8 GB ไม่พอ ผลเท่ากับ 32 · VGG-16 ใช้ lr ต่ำกว่าเพราะค่าปกติทำให้โมเดลพัง (ดูกล่องด้านล่าง)', 'Amber marks a per-model setting, none of which gives an edge: pixel scaling must match how each model’s ImageNet weights were trained · 16 × 2 means two batches of 16 per update because 8 GB of GPU memory was not enough, equal to 32 · VGG-16 uses a lower lr because the usual one broke it (see below).')}</p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><FlaskConical size={17} className="text-emerald-800" />{tr('สูตรการเทรน', 'Training recipe')}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4"><div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{tr('ช่วงที่ 1 · ฝึกหัวจำแนก', 'Stage 1 · train the head')}</div><p className="mt-2 text-sm leading-6 text-slate-700">{tr(`ล็อกโมเดลฐานไว้ ฝึกเฉพาะชั้นสุดท้าย สูงสุด ${cmp.recipe.head.epochs} epochs · learning rate ${cmp.recipe.head.lr}`, `Freeze the backbone and train only the last layer for up to ${cmp.recipe.head.epochs} epochs · learning rate ${cmp.recipe.head.lr}`)}</p></div>
                <div className="rounded-xl bg-[#f2f5ed] p-4"><div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">{tr('ช่วงที่ 2 · Fine-tune ทั้งโมเดล', 'Stage 2 · fine-tune all')}</div><p className="mt-2 text-sm leading-6 text-slate-700">{tr(`ปลดล็อกทุกชั้นยกเว้น BatchNorm สูงสุด ${cmp.recipe.finetune.epochs} epochs · learning rate ${cmp.recipe.finetune.lr}`, `Unfreeze every layer except BatchNorm for up to ${cmp.recipe.finetune.epochs} epochs · learning rate ${cmp.recipe.finetune.lr}`)}</p></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">{tr(`หยุดก่อนกำหนดเมื่อ validation accuracy ไม่ดีขึ้น (patience ${cmp.recipe.head.patience}/${cmp.recipe.finetune.patience}) และคืนค่าน้ำหนักรอบที่ดีที่สุด · batch ${cmp.recipe.batch} · ใช้กับ V2, ทั้ง 6 โมเดล และ V3`, `Early stopping on validation accuracy (patience ${cmp.recipe.head.patience}/${cmp.recipe.finetune.patience}) with best weights restored · batch ${cmp.recipe.batch} · used for V2, all six models and V3`)}</p>
            </article>
            <aside className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6">
              <div className="flex items-start gap-3"><Info size={18} className="mt-0.5 shrink-0 text-amber-800" /><div>
                <h3 className="text-sm font-bold text-amber-950">{tr('ข้อยกเว้นเดียว: VGG-16', 'One exception: VGG-16')}</h3>
                <p className="mt-2 text-xs leading-6 text-amber-950/85">{tr('VGG-16 ไม่มี BatchNorm เมื่อ fine-tune ด้วย learning rate 0.0001 โมเดลพังภายใน 1 รอบ (validation accuracy ตกจาก 60% เหลือ 35% และทายทุกคลาสเท่ากัน) จึงใช้ 0.00001 เฉพาะช่วงที่ 2 ของ VGG-16 ซึ่งเป็นค่าที่นิยมใช้กับโมเดลนี้ บันทึกการทดลองที่พังเก็บไว้เป็นหลักฐาน', 'VGG-16 has no BatchNorm. Fine-tuning at learning rate 0.0001 collapsed it within one epoch (validation accuracy fell from 60% to 35% and it predicted every class equally), so its stage 2 uses 0.00001, the usual value for this model. The failed run is kept as evidence.')}</p>
              </div></div>
            </aside>
          </div>

          <div id="seed" className="mt-5 grid scroll-mt-28 gap-5 lg:grid-cols-[.9fr_1.1fr]">
            <article className="rounded-2xl border border-emerald-900/15 bg-white p-5 sm:p-6">
              <Eyebrow>{tr('Seed คืออะไร', 'What is a seed?')}</Eyebrow>
              <h3 className="mt-2 text-base font-bold text-slate-900">{tr('เลขตั้งต้นของการสุ่มระหว่างเทรน', 'The starting number for the randomness in training')}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{tr('การเทรนมีการสุ่ม 3 จุด: ค่าเริ่มต้นของชั้นสุดท้าย ลำดับรูปที่ป้อนในแต่ละรอบ และการพลิก หมุน ซูมรูป seed เดิมให้ผลสุ่มเหมือนเดิมทุกครั้ง จึงทำซ้ำได้ เปลี่ยน seed คือให้โมเดลได้ "จับฉลาก" ชุดใหม่', 'Training has three random parts: the last layer’s starting weights, the order images arrive in, and the flips, turns and zooms. The same seed repeats the same draws, so a run can be reproduced; a new seed is a fresh draw.')}</p>
              <p className="mt-3 rounded-xl bg-[#f6f7f1] px-4 py-3 text-sm leading-6 text-slate-700">{tr('เปรียบเหมือนให้นักเรียนคนเดิม อ่านหนังสือเล่มเดิม แต่สลับลำดับหน้า 3 แบบ แล้วสอบข้อสอบชุดเดิม 3 ครั้ง คะแนนใกล้กันทุกครั้ง = เก่งจริง ไม่ใช่ฟลุก', 'Like one student reading the same book in three different page orders, then sitting the same exam three times: close scores every time mean real skill, not luck.')}</p>
              <dl className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
                <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="font-bold text-slate-800">{tr('42, 7, 2026', '42, 7, 2026')}</dt><dd>{tr('เป็นแค่ชื่อเรียกการสุ่มแต่ละชุด ไม่มีความหมายพิเศษ (42 คือรอบหลักที่ใช้มาตั้งแต่ V2, 2026 คือปีที่ทำ)', 'Just names for each draw, with no special meaning (42 is the main run used since V2; 2026 is the year)')}</dd></div>
                <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="font-bold text-slate-800">{tr('ไม่เปลี่ยน', 'Unchanged')}</dt><dd>{tr('การแบ่งรูป 70/15/15 ใช้ seed 42 ชุดเดียวตลอด ทุกโมเดลจึงสอบข้อสอบชุดเดียวกัน', 'The 70/15/15 split always uses seed 42, so every model sits the same exam')}</dd></div>
                <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="font-bold text-slate-800">± SD</dt><dd>{tr('ความแกว่งระหว่าง 3 รอบ ยิ่งน้อยยิ่งเชื่อถือได้', 'How much the three runs differ; smaller is more trustworthy')}</dd></div>
              </dl>
            </article>
            <div className="space-y-3">
              <SeedSpread tr={tr} />
              <p className="px-1 text-xs leading-5 text-slate-500">{tr('ตัวอย่าง: ResNet-50 รอบหนึ่งได้ 98.16% แต่อีกรอบได้ 96.45% ถ้าเทรนรอบเดียวแล้วบังเอิญได้รอบดี อาจสรุปผิดว่าเท่ากับ EfficientNet-B0 ซึ่งได้ 98.16–98.29% ทุกรอบ', 'For example, ResNet-50 scored 98.16% in one run and 96.45% in another. One lucky run could suggest it matches EfficientNet-B0, which scored 98.16–98.29% every time.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="results" className="scroll-mt-28 border-y border-slate-200 bg-white/60">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <SectionHeading eyebrow={tr('04 · ผลเปรียบเทียบ', '04 · Comparison results')} title={tr('ความแม่นยำ ต้นทุน และความต่างทางสถิติ', 'Accuracy, cost and statistical difference')} body={tr(`ผลทั้งหมดวัดบนภาพทดสอบ ${cmp.testSize} ภาพที่ไม่มีโมเดลใดเคยเห็นระหว่างเทรน`, `All results are on the ${cmp.testSize} test images no model saw during training.`)} />
          <div className="mt-8 rounded-2xl border border-emerald-900/15 bg-white p-5 sm:p-6">
            <Eyebrow>{tr('สรุปผลเปรียบเทียบ', 'Comparison in short')}</Eyebrow>
            <h3 className="mt-2 font-display text-xl font-bold leading-snug text-slate-950 sm:text-2xl">{summaryTitle}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {findings.map(([title, body]) => <div key={title} className="rounded-xl bg-[#f6f7f1] p-4"><h4 className="text-sm font-bold text-slate-900">{title}</h4><p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p></div>)}
            </div>
          </div>
        <div className="mt-6"><Leaderboard tr={tr} /></div>
        <div className="mt-6"><TradeoffChart tr={tr} t={t} /></div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <PerClassHeatmap tr={tr} t={t} />
          <ConfusionExplorer tr={tr} />
        </div>
        <div className="mt-6"><Significance tr={tr} /></div>
        <article className="mt-6 rounded-2xl border border-emerald-900/10 bg-[#f2f5ed] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Check size={17} />{tr('อ่านผลอย่างไร', 'How to read this')}</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {reading.map((line) => <li key={line} className="flex gap-2"><ChevronRight size={16} className="mt-1 shrink-0 text-emerald-800" />{line}</li>)}
          </ul>
        </article>
        </div>
      </section>

      <section id="deployed" className="scroll-mt-28">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <SectionHeading eyebrow={tr('05 · โมเดลที่ใช้งานจริง (V3)', '05 · The model in service (V3)')} title={tr('V3: รู้ว่าโรคไหนที่ตัวเองไม่รู้จัก', 'V3: knowing which diseases it does not know')} body={tr('V2 รู้จักแค่ 4 คำตอบ เมื่อเจอใบข้าวที่เป็นโรคอื่นจึงต้องเดาเป็นหนึ่งใน 4 โรคเสมอ V3 ใช้สถาปัตยกรรมและสูตรเดิม แต่เพิ่มคลาสที่ 5 "โรคอื่น" ฝึกจากภาพโรคอีก 6 ชนิด เมื่อเจอภาพลักษณะนี้ ระบบจะบอกว่าอยู่นอกขอบเขตและแนะนำให้ปรึกษาเจ้าหน้าที่ แทนการให้ชื่อโรคที่ผิด', 'V2 knew only four answers, so a leaf with any other disease was always forced into one of them. V3 keeps the architecture and recipe but adds a fifth class, "other", trained on six more diseases. When a photo looks like one of these, the system says it is out of scope and suggests asking an extension officer instead of naming the wrong disease.')} />

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <article className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-white shadow-[0_10px_28px_rgba(31,77,58,.08)]">
              <div className="border-b border-slate-100 px-5 py-4"><span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white" style={{ backgroundColor: GREEN }}>{tr('ใช้งานจริง', 'DEPLOYED')} · {dep.version}</span><h3 className="mt-3 font-bold text-slate-900">{tr('สิ่งที่ผู้ใช้เจอจริง: V2 เทียบ V3', 'What users actually get: V2 vs V3')}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{tr(`ภาพทดสอบที่โมเดลไม่เคยเห็น · V2 ใช้เกณฑ์ความมั่นใจ 75% · V3 ใช้ ${Math.round(dep.threshold * 100)}% ซึ่งเลือกจากชุด validation`, `Held-out test images · V2 answers at ≥75% confidence · V3 at ≥${Math.round(dep.threshold * 100)}%, chosen on the validation set`)}</p></div>
              <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm">
                <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3 font-bold">{tr('ตัวชี้วัด', 'Measure')}</th><th className="px-3 py-3 text-right font-bold">V2</th><th className="px-5 py-3 text-right font-bold text-emerald-900">V3</th></tr></thead>
                <tbody>{[
                  [tr(`ภาพโรคอื่น ${dep.otherSplit.test} ภาพ ที่ได้ชื่อโรคผิด`, `Other-disease photos (${dep.otherSplit.test}) given a wrong diagnosis`), String(dep.previous.other.given_wrong_diagnosis), String(dep.other.given_wrong_diagnosis), true],
                  [tr('ภาพ 4 โรคที่รองรับ: ระบบตอบผล', 'Supported photos: system gives an answer'), pct(dep.previous.userView.answered, 1), pct(dep.userView.answered, 1), true],
                  [tr('ภาพ 4 โรคที่รองรับ: ตอบผิดโรค', 'Supported photos: wrong disease named'), String(dep.previous.userView.wrong_answers), String(dep.userView.wrong_answers), false],
                  [tr('Accuracy 4 คลาส (761 ภาพ)', 'Accuracy on 4 classes (761 images)'), pct(dep.previous.accuracy), pct(dep.accuracy), false],
                ].map(([k, v2, v3, better]) => <tr key={k} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-700 sm:px-5">{k}</td><td className="px-3 py-3 text-right tabular-nums text-slate-500">{v2}</td><td className={`px-4 py-3 sm:px-5 text-right font-bold tabular-nums ${better ? 'text-emerald-900' : 'text-slate-800'}`}>{v3}</td></tr>)}</tbody>
              </table></div>
              <p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-5 text-slate-500">{tr(`ผลวินิจฉัยผิดที่ผู้ใช้ได้รับรวมกันลดจาก ${dep.previous.other.given_wrong_diagnosis + dep.previous.userView.wrong_answers} เหลือ ${dep.other.given_wrong_diagnosis + dep.userView.wrong_answers} ครั้ง`, `Wrong diagnoses shown to users fall from ${dep.previous.other.given_wrong_diagnosis + dep.previous.userView.wrong_answers} to ${dep.other.given_wrong_diagnosis + dep.userView.wrong_answers} in total`)}</p>
            </article>
            <div className="space-y-4">
              <aside className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                <div className="flex items-start gap-3"><Info size={18} className="mt-0.5 shrink-0 text-amber-800" /><div>
                  <h3 className="text-sm font-bold text-amber-950">{tr('สิ่งที่ต้องแลก', 'The trade-off')}</h3>
                  <p className="mt-2 text-xs leading-6 text-amber-950/85">{tr(`Accuracy 4 คลาสลดจาก ${pct(dep.previous.accuracy)} เป็น ${pct(dep.accuracy)} เพราะภาพโรคที่รองรับ ${dep.sentToOther} ภาพถูกจัดเป็น "โรคอื่น" ผู้ใช้จึงได้คำแนะนำให้ปรึกษาเจ้าหน้าที่แทนชื่อโรค ไม่ใช่ชื่อโรคที่ผิด ทดสอบ McNemar แล้วความต่างนี้ไม่มีนัยสำคัญทางสถิติ (p = ${dep.previous.mcnemar.p.toFixed(3)})`, `Four-class accuracy moves from ${pct(dep.previous.accuracy)} to ${pct(dep.accuracy)} because ${dep.sentToOther} supported photos are filed as "other": the user is told to ask an officer rather than shown a wrong name. McNemar finds this gap not statistically significant (p = ${dep.previous.mcnemar.p.toFixed(3)}).`)}</p>
                </div></div>
              </aside>
              <aside className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-900">{tr('ข้อมูลรุ่น', 'Release details')}</h3>
                <dl className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">{[
                  [tr('สถาปัตยกรรม', 'Architecture'), 'EfficientNet-B0 · 5 classes'],
                  [tr('ภาพ 4 โรค', 'Four-disease images'), tr('5,069 ภาพชุดเดิมของ V2 (BLAST, BLB, TUNGRO, HEALTHY)', 'The same 5,069 images as V2 (BLAST, BLB, TUNGRO, HEALTHY)')],
                  [tr('ภาพโรคอื่น', 'Other-disease images'), <>{tr(`${(dep.otherSplit.train + dep.otherSplit.val + dep.otherSplit.test).toLocaleString()} ภาพ 6 ชนิด`, `${(dep.otherSplit.train + dep.otherSplit.val + dep.otherSplit.test).toLocaleString()} images, 6 diseases`)}<ul className="mt-1 space-y-0.5">{OTHER_DISEASES.map(([k, th, en, n]) => <li key={k} className="flex justify-between gap-3"><span>{tr(th, en)}</span><span className="tabular-nums text-slate-500">{n.toLocaleString()}</span></li>)}</ul></>],
                  [tr('แบ่งข้อมูล', 'Split'), tr(`ฝึก ${(3548 + dep.otherSplit.train).toLocaleString()} · ตรวจสอบ ${(760 + dep.otherSplit.val).toLocaleString()} · ทดสอบ ${(761 + dep.otherSplit.test).toLocaleString()} ภาพ (ภาพ 4 โรคอยู่กองเดิม)`, `Train ${(3548 + dep.otherSplit.train).toLocaleString()} · val ${(760 + dep.otherSplit.val).toLocaleString()} · test ${(761 + dep.otherSplit.test).toLocaleString()} (four-disease images stay in their piles)`)],
                  [tr('การเลือกรุ่น', 'Selection'), tr('เทรน 3 seed เลือกด้วย validation accuracy', '3 seeds, picked by validation accuracy')],
                  [tr('ไฟล์บนมือถือ', 'Phone file'), `${dep.tflite.size_mb.toFixed(1)} MB · ${dep.tflite.cpu_ms_median_4_threads.toFixed(0)} ms`],
                  ['AUC (4 classes)', dep.auc.toFixed(4)],
                ].map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="font-semibold text-slate-800">{k}</dt><dd>{v}</dd></div>)}</dl>
              </aside>
            </div>
          </div>


          <h3 className="mt-12 text-lg font-bold text-slate-900">{tr('ผลละเอียดของ V3', 'V3 in detail')}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{tr(`การ์ดและตารางเทียบ V2 กับ V3 บนภาพ 4 คลาส 761 ภาพชุดเดียวกัน (ภาพที่ V3 จัดเป็น "โรคอื่น" นับว่าผิด) ส่วนแถว OTHER และตารางสับสนใช้ภาพทดสอบทั้งหมด ${dep.test5.size.toLocaleString()} ภาพ`, `Cards and table compare V2 and V3 on the same 761 four-class images (photos V3 files as "other" count as wrong). The OTHER row and the confusion matrix use all ${dep.test5.size.toLocaleString()} test images.`)}</p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {[
              ['Accuracy', dep.previous.accuracy, dep.accuracy],
              ['Macro F₁', dep.previousMacroF1, dep.macroF1],
            ].map(([title, v2v, v3v]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">{title} · {tr('4 คลาส', '4 classes')}</h4><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{((v3v - v2v) * 100).toFixed(2)} {tr('จุดเปอร์เซ็นต์', 'points')}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">V2 · {tr('รุ่นก่อนหน้า', 'previous')}</div><div className="mt-2 font-display text-3xl font-bold text-slate-800">{pct(v2v)}</div></div>
                <div className="rounded-xl border border-emerald-900/10 bg-[#f2f5ed] p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-emerald-900">V3 · {tr('ใช้งานจริง', 'deployed')}</div><div className="mt-2 font-display text-3xl font-bold text-emerald-950">{pct(v3v)}</div></div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">{tr('ภาพทดสอบ 761 ภาพชุดเดียวกัน · ลดลงเพราะ V3 ส่งภาพบางส่วนไปเป็น "โรคอื่น" แทนการเดาชื่อโรค', 'Same 761 test images · lower because V3 files some photos as "other" instead of guessing a name')}</p>
            </article>)}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h4 className="font-bold text-slate-900">{tr('ผลแยกตามคลาส · V2 เทียบ V3', 'Per-class results · V2 vs V3')}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{tr('4 คลาสแรกวัดบนภาพ 761 ภาพเดียวกัน · แถว OTHER วัดบนภาพโรคอื่น 801 ภาพ (Precision ของ OTHER คิดจากภาพทดสอบทั้งหมด) · ยังไม่ใช้เกณฑ์ความมั่นใจ · Δ คือผลต่าง F₁ หน่วยจุดเปอร์เซ็นต์', 'First four rows use the same 761 images · OTHER uses the 801 other-disease images (its precision counts all test images) · before the confidence cut-off · Δ is the F₁ difference in percentage points')}</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-bold">{tr('คลาส', 'Class')}</th><th className="px-3 py-3 text-right font-bold">n</th><th className="px-3 py-3 text-right font-bold">Precision · V2</th><th className="px-3 py-3 text-right font-bold">Recall · V2</th><th className="px-3 py-3 text-right font-bold">Precision · V3</th><th className="px-3 py-3 text-right font-bold">Recall · V3</th><th className="px-3 py-3 text-right font-bold">F₁ · V2</th><th className="px-3 py-3 text-right font-bold">F₁ · V3</th><th className="px-4 py-3 text-right font-bold">Δ pp</th></tr></thead>
              <tbody>
                {classResults.map((row) => { const a = dep.previousPerClass[row.name], b = dep.perClass[row.name]; const dd = (b.f1 - a.f1) * 100; return <tr key={row.name} className="border-t border-slate-100"><td className="px-4 py-3"><span className="font-bold text-slate-900">{row.name}</span><span className="ml-2 text-xs text-slate-500">· {tr(row.th, row.en)}</span></td><td className="px-3 py-3 text-right text-slate-600">{b.support}</td><td className="px-3 py-3 text-right text-slate-500">{pct(a.precision)}</td><td className="px-3 py-3 text-right text-slate-500">{pct(a.recall)}</td><td className="px-3 py-3 text-right text-slate-700">{pct(b.precision)}</td><td className="px-3 py-3 text-right text-slate-700">{pct(b.recall)}</td><td className="px-3 py-3 text-right text-slate-500">{pct(a.f1)}</td><td className="px-3 py-3 text-right font-bold text-emerald-900">{pct(b.f1)}</td><td className={`px-4 py-3 text-right font-semibold ${dd < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>{dd > 0 ? '+' : ''}{dd.toFixed(2)}</td></tr>; })}
                <tr className="border-t border-slate-200 bg-[#f6f7f1]"><td className="px-4 py-3"><span className="font-bold text-slate-900">OTHER</span><span className="ml-2 text-xs text-slate-500">· {tr('โรคอื่น (6 ชนิด)', 'Other diseases (6)')}</span></td><td className="px-3 py-3 text-right text-slate-600">{dep.test5.per_class.OTHER.support}</td><td className="px-3 py-3 text-right text-slate-400">—</td><td className="px-3 py-3 text-right text-slate-400">—</td><td className="px-3 py-3 text-right text-slate-700">{pct(dep.test5.per_class.OTHER.precision)}</td><td className="px-3 py-3 text-right text-slate-700">{pct(dep.test5.per_class.OTHER.recall)}</td><td className="px-3 py-3 text-right text-slate-400">—</td><td className="px-3 py-3 text-right font-bold text-emerald-900">{pct(dep.test5.per_class.OTHER.f1)}</td><td className="px-4 py-3 text-right text-slate-400">{tr('ใหม่', 'new')}</td></tr>
              </tbody>
            </table></div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
            <Figure src="/research-study/confusion-matrix-v3.png" alt="V3 · 5 classes" title={tr('ตารางสับสน · V3 · ใช้งานจริง', 'Confusion matrix · V3 · deployed')} caption={tr(`ภาพทดสอบ ${dep.test5.size.toLocaleString()} ภาพ ถูก ${dep.test5.correct.toLocaleString()} ภาพ · คอลัมน์โรคอื่นคือภาพที่ระบบตอบว่าอยู่นอกขอบเขต · แถวโรคอื่นที่ทายเป็นโรคใดโรคหนึ่ง ${dep.test5.confusion_matrix[4].slice(0, 4).reduce((s, v) => s + v, 0)} ภาพ ในจำนวนนี้ ${dep.other.given_wrong_diagnosis} ภาพผ่านเกณฑ์ความมั่นใจ ${Math.round(dep.threshold * 100)}% ออกไปเป็นผลวินิจฉัย`, `${dep.test5.size.toLocaleString()} test images, ${dep.test5.correct.toLocaleString()} correct · the "other" column is what users are told is out of scope · ${dep.test5.confusion_matrix[4].slice(0, 4).reduce((s, v) => s + v, 0)} other-disease photos were named as a disease, of which ${dep.other.given_wrong_diagnosis} passed the ${Math.round(dep.threshold * 100)}% cut-off`)}/>
            <Figure src="/research-study/training-curves-v3.png" alt="V3 · seed 2026" title={tr('กราฟระหว่างการฝึก V3', 'Training curves · V3')} caption={tr('Accuracy และ Loss ของชุดฝึกกับชุดตรวจสอบ (5 คลาส) ของ seed ที่เลือก · เส้นประคือจุดเริ่ม fine-tuning', 'Training and validation accuracy and loss (5 classes) for the selected seed · dashed line marks the start of fine-tuning.')}/>
          </div>
        </div>
      </section>

      <section id="scope" className="scroll-mt-28 border-y border-slate-200 bg-white/60">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <SectionHeading eyebrow={tr('06 · ข้อจำกัดและแหล่งอ้างอิง', '06 · Limits & references')} title={tr('สิ่งที่ผลนี้บอกได้ และบอกไม่ได้', 'What these results do and do not show')} body={tr('ทุกผลวัดบนชุดข้อมูลที่ใช้ศึกษา ไม่ใช่หลักฐานยืนยันความแม่นยำในแปลงนาจริง', 'Every result is measured on the study dataset; none establishes performance in real fields.')} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            tr('ทุกโมเดลใช้สูตรเทรนเดียวกันซึ่งปรับมาสำหรับ EfficientNet-B0 โมเดลอื่นอาจทำได้ดีขึ้นถ้าปรับค่าเฉพาะตัว ผลนี้จึงเทียบภายใต้เงื่อนไขเดียวกัน ไม่ใช่ขีดสูงสุดของแต่ละโมเดล', 'Every model uses one recipe tuned for EfficientNet-B0. Others might improve with their own tuning, so this compares equal conditions, not each model’s ceiling.'),
            tr(`ใช้การแบ่งข้อมูลชุดเดียว (seed 42) แต่เทรนซ้ำ ${nSeeds} seed ความแปรปรวนที่รายงานจึงมาจากการเทรน ไม่รวมความแปรปรวนจากการแบ่งข้อมูล`, `One data split (seed 42) with ${nSeeds} training seeds, so the reported spread covers training randomness, not split randomness.`),
            tr('เวลาต่อภาพวัดบน CPU โน้ตบุ๊ก Intel Core i5-12450H ด้วย TFLite 4 threads บนมือถือจริงจะช้ากว่า แต่ลำดับเร็ว-ช้าระหว่างโมเดลควรคล้ายกัน', 'Per-image time is measured on an Intel Core i5-12450H laptop CPU with TFLite at 4 threads. Phones are slower, but the ranking should be similar.'),
            tr('คลาส "โรคอื่น" ของ V3 รู้จักเฉพาะ 6 ชนิดที่มีใน Paddy Doctor ภาพที่ไม่ใช่ใบข้าวเลยยังอาศัยเกณฑ์ความมั่นใจ จึงควรมีคำแนะนำการถ่ายภาพในแอปควบคู่', 'V3’s "other" class only knows the six diseases in Paddy Doctor; photos that are not rice leaves at all still rely on the confidence cut-off, so in-app photo guidance remains important.'),
            tr('ข้อมูลมาจาก Paddy Doctor ไม่ใช่ภาพเก็บจากแปลงนาไทย จึงต้องทดสอบภาคสนามเพิ่ม และตรวจสิทธิ์ใช้ชุดข้อมูลก่อนเผยแพร่เชิงวิชาการ', 'Data comes from Paddy Doctor, not Thai fields; field testing is still needed, and dataset rights should be checked before academic publication.'),
          ].map((item) => <div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-900"><Check size={13} /></span><p className="text-sm leading-6 text-slate-700">{item}</p></div>)}
        </div>
        <div className="mt-10 border-t border-slate-200 pt-7">
          <h3 className="text-sm font-bold text-slate-900">{tr('เอกสารอ้างอิง', 'References')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Paddy Doctor · Kaggle', 'https://www.kaggle.com/competitions/paddy-disease-classification/data', tr('ชุดข้อมูลและรายละเอียดการแข่งขัน (ฉบับ 10 คลาสที่ใช้ศึกษา)', 'Dataset and competition (the 10-class release used here)')],
              ['Paddy Doctor · paper', 'https://arxiv.org/abs/2205.11108', tr('บทความอธิบายชุดข้อมูลฉบับเต็ม 16,225 ภาพ 13 คลาส', 'Paper on the full dataset: 16,225 images, 13 classes')],
              ['EfficientNet · Tan & Le, 2019', 'https://proceedings.mlr.press/v97/tan19a.html', 'ICML 2019'],
              ['MobileNetV3 · Howard et al., 2019', 'https://arxiv.org/abs/1905.02244', 'ICCV 2019'],
              ['DenseNet · Huang et al., 2017', 'https://arxiv.org/abs/1608.06993', 'CVPR 2017'],
              ['VGG · Simonyan & Zisserman, 2015', 'https://arxiv.org/abs/1409.1556', 'ICLR 2015'],
              ['ResNet · He et al., 2016', 'https://arxiv.org/abs/1512.03385', 'CVPR 2016'],
              ['ConvNeXt · Liu et al., 2022', 'https://arxiv.org/abs/2201.03545', 'CVPR 2022'],
              ['McNemar test · Dietterich, 1998', 'https://doi.org/10.1162/089976698300017197', tr('การทดสอบทางสถิติสำหรับเปรียบเทียบตัวจำแนก', 'Statistical tests for comparing classifiers')],
            ].map(([title, href, desc]) => <a key={title} href={href} target="_blank" rel="noreferrer" className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-800/40 hover:shadow-md"><span className="flex items-center justify-between gap-3 text-sm font-bold text-slate-800">{title}<ExternalLink size={14} className="shrink-0 text-slate-400 group-hover:text-emerald-800" /></span><span className="mt-2 block text-xs leading-5 text-slate-500">{desc}</span></a>)}
          </div>
        </div>
        <aside className="mt-7 rounded-2xl border border-emerald-900/10 bg-[#f2f5ed] p-5 sm:p-6">
          <div className="flex items-start gap-3"><Info size={18} className="mt-0.5 shrink-0 text-emerald-800"/><div><h3 className="text-sm font-bold text-slate-900">{tr('ทำซ้ำผลได้', 'Reproducible')}</h3><p className="mt-2 text-xs leading-6 text-slate-700">{tr('สคริปต์เทรน วัดผล ผลรายรอบ และความน่าจะเป็นที่ทุกโมเดลทายภาพทดสอบ เก็บไว้ในโฟลเดอร์ ai-service/model-comparison ของโปรเจกต์ ตัวเลขบนหน้านี้สร้างจากไฟล์ผลนั้นโดยตรง', 'Training and scoring scripts, per-run results and every model’s test-image probabilities live in the project’s ai-service/model-comparison folder. The numbers on this page are generated from those files directly.')} · {tr('วัดผลเมื่อ', 'Scored on')} {cmp.evaluated}</p></div></div>
        </aside>
        </div>
      </section>
    </main>
    <PublicFooter subtitle={{ th: 'การค้นคว้าและการศึกษา', en: 'Research & Education' }} />
    <div ref={quickMenuRef} className="group fixed bottom-4 right-3 z-40 sm:bottom-5 sm:right-5 lg:bottom-7 lg:right-7">
      {!quickMenuOpen && <Link to="/feedback" aria-label={bubbleMessages[0]} className="rs-typing-bubble absolute bottom-full right-8 mb-2 flex min-h-10 w-max max-w-[min(208px,calc(100vw-5rem))] items-center rounded-2xl rounded-br-sm border border-emerald-900/10 bg-white px-3 py-2 text-xs font-bold leading-5 text-emerald-950 shadow-[0_10px_28px_-12px_rgba(15,45,31,.4)] transition hover:-translate-y-0.5 hover:border-emerald-700/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20">
        <span className="min-w-0 whitespace-normal break-words">{typedBubble}{isTypingBubble && <span aria-hidden="true" className="rs-typing-caret ml-0.5 inline-block h-4 align-middle" />}</span>
      </Link>}
      {/* Speed dial: round actions fan out beside Khao Hom; each says what it does on hover, focus or (on touch screens) while open. */}
      <div role="menu" aria-label={tr('เมนูทางลัด', 'Quick actions')} aria-hidden={!quickMenuOpen} className="pointer-events-none absolute left-1/2 top-1/2">
        {[
          { key: 'top', icon: ArrowUp, label: tr('กลับขึ้นด้านบน', 'Back to top'), onClick: () => window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) },
          { key: 'video', icon: Play, label: tr('ดูคลิปอธิบาย', 'Watch the video'), href: '#video' },
          { key: 'feedback', icon: MessageSquareText, label: tr('ส่งข้อเสนอแนะ', 'Send feedback'), to: '/feedback' },
        ].map((a, i, all) => {
          const angle = (180 - (90 / (all.length - 1)) * i) * (Math.PI / 180);
          const style = { '--dx': `${Math.cos(angle) * 104}px`, '--dy': `${-Math.sin(angle) * 104}px`, transitionDelay: `${quickMenuOpen ? i * 55 : (all.length - 1 - i) * 35}ms` };
          const Icon = a.icon;
          const inner = <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-900/10 bg-white text-emerald-900 shadow-[0_12px_28px_-10px_rgba(15,45,31,.5)] ring-4 ring-white/60 transition group-hover/dial:scale-110 group-hover/dial:bg-emerald-800 group-hover/dial:text-white group-focus-visible/dial:scale-110 group-focus-visible/dial:bg-emerald-800 group-focus-visible/dial:text-white"><Icon size={19} strokeWidth={2.2} /></span>
            <span className="rs-dial-label pointer-events-none absolute right-full top-1/2 mr-3 whitespace-nowrap rounded-full bg-emerald-950 px-3 py-1.5 text-xs font-bold text-white shadow-lg">{a.label}</span>
          </>;
          const props = { role: 'menuitem', 'aria-label': a.label, title: a.label, tabIndex: quickMenuOpen ? 0 : -1, style, className: `rs-dial group/dial absolute -ml-6 -mt-6 block rounded-full focus-visible:outline-none ${quickMenuOpen ? 'rs-dial-open pointer-events-auto' : ''}` };
          const close = () => setQuickMenuOpen(false);
          if (a.to) return <Link key={a.key} to={a.to} onClick={close} {...props}>{inner}</Link>;
          if (a.href) return <a key={a.key} href={a.href} onClick={close} {...props}>{inner}</a>;
          return <button key={a.key} type="button" onClick={() => { close(); a.onClick(); }} {...props}>{inner}</button>;
        })}
      </div>
      <button type="button" onClick={() => setQuickMenuOpen((open) => !open)} aria-label={quickMenuOpen ? tr('ปิดเมนูน้องข้าวหอม', 'Close Khao Hom menu') : tr('เปิดเมนูน้องข้าวหอม', 'Open Khao Hom menu')} aria-expanded={quickMenuOpen} aria-haspopup="menu" className="relative flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25">
        <img src={khaoHomMascot} alt="" aria-hidden="true" className="rs-quick-mascot h-20 w-20 object-contain drop-shadow-2xl transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:rotate-[-3deg] group-hover:scale-110 group-hover:drop-shadow-[0_22px_28px_rgba(20,83,45,0.28)] motion-reduce:transition-none sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
        <span aria-hidden="true" className={`absolute right-0 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-950 text-white shadow-lg ring-2 ring-white transition duration-300 ${quickMenuOpen ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}><X size={14} strokeWidth={2.6} /></span>
      </button>
    </div>
  </div>;
}
