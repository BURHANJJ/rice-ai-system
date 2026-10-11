import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BookOpen, Camera, Check, Copy, Images, Maximize2, Bug, ChevronLeft, ChevronRight, ExternalLink, FlaskConical, Leaf, LogIn, MapPin,
  Microscope, Search, ShieldCheck, Smartphone, Sparkles, Sprout, UserPlus, Waves, X, CircleHelp, Mountain, CheckCircle2,
} from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import ChipScroller from '../components/riskmap/ChipScroller';
import { categories, practices, RKB_ACCESSED } from '../lib/riceDiseases';
import { isCaution, slugOf, useWikiDiseases } from '../lib/wikiContent';
import { useI18n, useDocTitle } from '../lib/i18n';

// Category names are Thai keys in the data; these are the English labels shown in English mode.
const CAT_EN = { ทั้งหมด: 'All', เชื้อรา: 'Fungal', แบคทีเรีย: 'Bacterial', ไวรัส: 'Viral', ไฟโตพลาสมา: 'Phytoplasma', ไส้เดือนฝอย: 'Nematode', ไม่ทราบสาเหตุชัดเจน: 'Cause unclear', ไม่มีเชื้อสาเหตุ: 'Non-infectious' };
const PRACTICES_EN = [
  'Photograph the leaf, stem or panicle so the symptom is clear in daylight',
  'Note the growth stage, such as seedling, tillering, booting or heading',
  'Describe field conditions before the symptom: rain, humidity, standing water, fertiliser and insect vectors',
  'If symptoms are severe or spreading fast, contact a local agricultural officer or researcher',
];

const ALL = categories[0];

const CAT = {
  เชื้อรา: { icon: Leaf, chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: '#D97706' },
  แบคทีเรีย: { icon: Microscope, chip: 'bg-sky-50 text-sky-800 ring-sky-200', dot: '#0284C7' },
  ไวรัส: { icon: Bug, chip: 'bg-rose-50 text-rose-800 ring-rose-200', dot: '#E11D48' },
  ไฟโตพลาสมา: { icon: FlaskConical, chip: 'bg-violet-50 text-violet-800 ring-violet-200', dot: '#7C3AED' },
  ไส้เดือนฝอย: { icon: Waves, chip: 'bg-teal-50 text-teal-800 ring-teal-200', dot: '#0D9488' },
  ไม่ทราบสาเหตุชัดเจน: { icon: CircleHelp, chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: '#64748B' },
  ไม่มีเชื้อสาเหตุ: { icon: Mountain, chip: 'bg-lime-50 text-lime-800 ring-lime-200', dot: '#65A30D' },
};

const RKB_HOME = 'https://rkb.ricethailand.go.th/web/content_page.php?code=A-VIVSO5ZWMG';

function Highlight({ text, term }) {
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-[var(--color-gold)]/25 px-0.5 text-inherit">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

function CategoryBadge({ category, className = '' }) {
  const { lang } = useI18n();
  const c = CAT[category];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${c.chip} ${className}`}>
      <Icon size={13} />{lang === 'en' ? CAT_EN[category] || category : category}
    </span>
  );
}

function DiseaseCard({ disease, index, term, onOpen }) {
  const { t, lang } = useI18n();
  const en = lang === 'en';
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-sm shadow-emerald-950/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-emerald-950/5">
      <div className="relative aspect-[16/10] overflow-hidden bg-emerald-950/5">
        <img src={disease.thumb} alt={en ? `${disease.tag} symptoms` : `อาการ${disease.name}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        <CategoryBadge category={disease.category} className="absolute left-3 top-3 shadow-sm" />
        <span className="absolute right-3 top-3 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-extrabold text-white/90 backdrop-blur">{String(index + 1).padStart(2, '0')}</span>
        {disease.images.length > 1 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur"><Images size={12} />{disease.images.length} {t({ th: 'ภาพ', en: 'photos' })}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 pt-4">
      <h3 className="font-display text-[1.35rem] font-extrabold leading-snug text-gray-950">
        <Highlight text={en ? disease.tag : disease.name} term={term} />
      </h3>
      <p lang={en ? 'th' : undefined} className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[var(--color-paddy)]/70">{en ? disease.name : disease.tag}</p>
      <p lang="th" className="mt-3 text-sm italic leading-6 text-gray-500 [overflow-wrap:anywhere]">{disease.cause}</p>

      <ul lang="th" className="mt-4 grid flex-1 content-start gap-2 border-t border-gray-100 pt-4">
        {disease.symptoms.slice(0, 2).map((s) => (
          <li key={s} className="flex gap-2 text-sm leading-6 text-gray-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CAT[disease.category].dot }} />
            <span className="line-clamp-2"><Highlight text={s} term={term} /></span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center">
        <button type="button" onClick={onOpen} className="group/btn -ml-3 inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold text-[var(--color-paddy)] transition hover:bg-emerald-50">
          {t({ th: 'ดูอาการและการป้องกัน', en: 'Symptoms and control' })} <ArrowRight size={15} className="transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
      </div>
    </article>
  );
}

function Section({ icon: Icon, title, tone, children }) {
  const tones = {
    green: 'text-[var(--color-paddy)] bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-700 bg-amber-50',
    sky: 'text-sky-700 bg-sky-50',
  };
  return (
    <section className="rounded-[1.25rem] border border-gray-100 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-900">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={15} /></span>{title}
      </h3>
      {children}
    </section>
  );
}

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { day: d, month: TH_MONTHS[m - 1], year: y + 543 };
};

/** Reference to the Rice Department page, in Thai APA style, with copy. */
function Citation({ disease }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const pub = thDate(disease.published);
  const acc = thDate(RKB_ACCESSED);
  const text = `กรมการข้าว. (${pub.year}, ${pub.day} ${pub.month}). ${disease.name}. ใน องค์ความรู้เรื่องข้าว (Rice Knowledge Bank). กองวิจัยและพัฒนาข้าว กรมการข้าว. สืบค้นเมื่อ ${acc.day} ${acc.month} ${acc.year}, จาก ${disease.source}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <section className="rounded-[1.25rem] border border-gray-200 bg-white/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><BookOpen size={15} /></span>{t({ th: 'แหล่งอ้างอิง', en: 'Source' })}
        </h3>
        <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-50 hover:text-[var(--color-paddy)]">
          {copied ? <><Check size={13} className="text-emerald-600" />{t({ th: 'คัดลอกแล้ว', en: 'Copied' })}</> : <><Copy size={13} />{t({ th: 'คัดลอกการอ้างอิง', en: 'Copy citation' })}</>}
        </button>
      </div>
      <p className="border-l-2 border-[var(--color-gold)] pl-3 text-[13px] leading-6 text-gray-600 [overflow-wrap:anywhere]">
        กรมการข้าว. ({pub.year}, {pub.day} {pub.month}). <i className="text-gray-800">{disease.name}</i>. ใน <i>องค์ความรู้เรื่องข้าว (Rice Knowledge Bank)</i>. กองวิจัยและพัฒนาข้าว กรมการข้าว. สืบค้นเมื่อ {acc.day} {acc.month} {acc.year}, จาก{' '}
        <a href={disease.source} target="_blank" rel="noreferrer" className="text-[var(--color-paddy)] underline decoration-emerald-200 underline-offset-2 hover:decoration-[var(--color-paddy)]">{disease.source.replace(/^https?:\/\//, '')}</a>
      </p>
      <p className="mt-3 text-[11.5px] leading-5 text-gray-400">{t({ th: 'เนื้อหาโรคข้าวในหน้านี้เรียบเรียงจากองค์ความรู้เรื่องข้าว ลิขสิทธิ์เป็นของกรมการข้าว กระทรวงเกษตรและสหกรณ์', en: 'Disease content on this page is compiled from the Rice Knowledge Bank, © Rice Department, Ministry of Agriculture and Cooperatives. The citation is kept in Thai, as published.' })}</p>
    </section>
  );
}

/** Photos of the disease from the Rice Department page: main photo + thumbnails. */
function Gallery({ disease, onOpen }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const img = disease.images[i];
  return (
    <figure className="overflow-hidden rounded-[1.25rem] border border-gray-100 bg-white">
      <button type="button" onClick={() => onOpen(i)} className="group relative block aspect-[4/3] w-full overflow-hidden bg-gray-900" aria-label={t({ th: 'ดูภาพขนาดเต็ม', en: 'View full size' })}>
        <img src={img.src} alt={img.caption || `อาการ${disease.name}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition group-hover:bg-black/70"><Maximize2 size={13} />{t({ th: 'ขยายภาพ', en: 'Enlarge' })}</span>
        {disease.images.length > 1 && <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{i + 1} / {disease.images.length}</span>}
      </button>
      {disease.images.length > 1 && (
        <ChipScroller className="p-2">
          {disease.images.map((im, k) => (
            <button
              key={im.src}
              type="button"
              onClick={(e) => {
                setI(k);
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
              }}
              aria-label={t({ th: `ภาพที่ ${k + 1}`, en: `Photo ${k + 1}` })}
              aria-pressed={k === i}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ring-inset transition ${k === i ? 'ring-[var(--color-paddy)]' : 'opacity-70 ring-transparent hover:opacity-100'}`}
            >
              <img src={im.src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </ChipScroller>
      )}
      <figcaption className="flex items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-[11.5px] text-gray-500">
        <Camera size={12} className="shrink-0" />
        <span className="min-w-0 truncate">{img.caption ? `${img.caption} · ` : ''}{t({ th: 'ภาพ: กรมการข้าว', en: 'Photo: Rice Department' })}</span>
      </figcaption>
    </figure>
  );
}

/** Full-screen photo viewer: arrows, swipe, Esc. */
function PhotoViewer({ disease, index, onIndex, onClose }) {
  const { t } = useI18n();
  const n = disease.images.length;
  const img = disease.images[index];
  const touch = useRef(null);
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index - 1 + n) % n);
      if (e.key === 'ArrowRight') onIndex((index + 1) % n);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, n, onIndex, onClose]);

  const go = (d) => (e) => {
    e.stopPropagation();
    onIndex((index + d + n) % n);
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (Math.abs(dx) > 50 && n > 1) onIndex((index + (dx < 0 ? 1 : -1) + n) % n);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t({ th: `ภาพ${disease.name}`, en: `${disease.tag} photos` })}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-extrabold">{disease.name}</div>
          <div className="text-xs text-white/60">{n > 1 ? `${index + 1} / ${n} · ` : ''}{t({ th: 'ภาพ: กรมการข้าว', en: 'Photo: Rice Department' })}</div>
        </div>
        <button type="button" onClick={onClose} aria-label={t({ th: 'ปิดภาพ', en: 'Close photo' })} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
        <img key={img.src} src={img.src} alt={img.caption || `อาการ${disease.name}`} onClick={(e) => e.stopPropagation()} className="rb-tour-in max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        {n > 1 && (
          <>
            <button type="button" aria-label={t({ th: 'ภาพก่อนหน้า', en: 'Previous photo' })} onClick={go(-1)} className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"><ChevronLeft size={24} /></button>
            <button type="button" aria-label={t({ th: 'ภาพถัดไป', en: 'Next photo' })} onClick={go(1)} className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"><ChevronRight size={24} /></button>
          </>
        )}
      </div>
      {img.caption && <p className="px-6 pb-5 text-center text-sm text-white/80">{img.caption}</p>}
    </div>
  );
}

/** Everything shown for one disease; also used by the admin editor's preview. */
export function DiseaseBody({ disease, onOpenPhoto, className = 'grid gap-3 px-5 py-5 sm:px-6' }) {
  const { t } = useI18n();
  return (
    <div className={className}>
      <Gallery key={disease.tag} disease={disease} onOpen={onOpenPhoto} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Section icon={Microscope} title={t({ th: 'เชื้อสาเหตุ', en: 'Cause' })} tone="sky"><p lang="th" className="text-sm italic leading-6 text-gray-700 [overflow-wrap:anywhere]">{disease.cause}</p></Section>
        <Section icon={MapPin} title={t({ th: 'พื้นที่ที่พบ', en: 'Where it occurs' })} tone="green"><p lang="th" className="text-sm leading-6 text-gray-700">{disease.found}</p></Section>
      </div>
      <Section icon={AlertTriangle} title={t({ th: 'สภาพที่เสี่ยงต่อการระบาด', en: 'Conditions that favour outbreaks' })} tone="amber"><p lang="th" className="text-sm leading-7 text-gray-700">{disease.risk}</p></Section>
      <Section icon={Bug} title={t({ th: 'อาการสำคัญ', en: 'Key symptoms' })} tone="red">
        <ul lang="th" className="grid gap-2">
          {disease.symptoms.map((s) => (
            <li key={s} className="flex gap-2.5 text-sm leading-6 text-gray-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{s}</li>
          ))}
        </ul>
      </Section>
      <Section icon={ShieldCheck} title={t({ th: 'การป้องกันกำจัด', en: 'Prevention and control' })} tone="green">
        <p className="-mt-1 mb-3 text-xs font-semibold text-gray-400">{t({ th: 'ตามคำแนะนำของกรมการข้าว', en: 'As recommended by the Rice Department' })}</p>
        <ol lang="th" className="grid gap-3">
          {disease.control.filter((c) => c.text).map((c, i) => {
            const caution = isCaution(c.text);
            return (
            <li key={c.text} className={`flex gap-2.5 text-sm leading-6 ${caution ? '-mx-2 rounded-xl bg-amber-50 px-2 py-2 text-amber-950 ring-1 ring-amber-100' : 'text-gray-700'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${caution ? 'bg-amber-500' : 'bg-[var(--color-paddy)]'}`}>{i + 1}</span>
              <div className="min-w-0">
                {caution && <span className="mr-1.5 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 align-[1px] text-[11px] font-extrabold text-amber-800"><AlertTriangle size={11} />{t({ th: 'ข้อควรระวัง', en: 'Caution' })}</span>}
                {c.text}
                {c.sub && (
                  <ul className="mt-1.5 grid gap-1">
                    {c.sub.map((sub) => <li key={sub} className="flex gap-2 text-[13px] text-gray-600"><span className="mt-2 h-1 w-2 shrink-0 rounded-full bg-emerald-400" />{sub}</li>)}
                  </ul>
                )}
              </div>
            </li>
            );
          })}
        </ol>
        {disease.control.filter((c) => c.note).map((c) => (
          <div key={c.note} className="mt-3 flex gap-2.5 rounded-xl bg-amber-50 p-3 text-[13px] leading-6 text-amber-950 ring-1 ring-amber-100">
            <AlertTriangle size={16} className="mt-1 shrink-0 text-amber-600" />
            <p><span className="font-extrabold text-amber-800">{t({ th: 'ข้อควรระวัง: ', en: 'Caution: ' })}</span>{c.note}</p>
          </div>
        ))}
      </Section>

      {disease.chemicals?.length > 0 && (
        <Section icon={FlaskConical} title={t({ th: 'สารเคมีที่แนะนำ', en: 'Recommended chemicals' })} tone="sky">
          <p className="-mt-1 mb-3 text-xs font-semibold text-gray-400">{t({ th: 'ใช้เมื่อจำเป็นและตามอัตราที่กำหนดเท่านั้น', en: 'Use only when needed, at the stated rate' })}</p>
          <div className="overflow-x-auto rounded-xl ring-1 ring-sky-100">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead className="bg-sky-50/80 text-[11px] font-extrabold text-sky-900">
                <tr><th className="px-3 py-2">{t({ th: 'สารเคมี', en: 'Chemical' })}</th><th className="px-3 py-2">{t({ th: 'อัตราการใช้', en: 'Rate' })}</th><th className="px-3 py-2">{t({ th: 'ช่วงเวลา / วิธีใช้', en: 'Timing / method' })}</th></tr>
              </thead>
              <tbody lang="th" className="divide-y divide-sky-50 bg-white">
                {disease.chemicals.map((c) => (
                  <tr key={c.name} className="align-top">
                    <td className="px-3 py-2 font-bold text-gray-900">{c.name}{c.note && <span className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-amber-700"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{c.note}</span>}</td>
                    <td className="px-3 py-2 text-gray-700">{c.rate || '–'}</td>
                    <td className="px-3 py-2 text-gray-700">{c.timing || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Citation disease={disease} />
      <p className="flex items-start gap-2 text-xs leading-5 text-gray-500"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{t({ th: 'หากพบอาการรุนแรงหรือระบาดเร็ว ควรยืนยันกับเจ้าหน้าที่ในพื้นที่ก่อนใช้สารเคมี', en: 'If symptoms are severe or spreading fast, confirm with a local officer before using chemicals.' })}</p>
    </div>
  );
}

function DiseaseDrawer({ disease, position, onClose, onPrev, onNext }) {
  const { t, lang } = useI18n();
  const panel = useRef(null);
  const [viewer, setViewer] = useState(null); // index of the photo shown full screen
  useEffect(() => { setViewer(null); }, [disease]);
  useEffect(() => {
    if (viewer !== null) return undefined; // the photo viewer handles keys while open
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext, viewer]);
  useEffect(() => { panel.current?.scrollTo({ top: 0 }); }, [disease]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-end bg-gray-950/40 backdrop-blur-sm sm:items-stretch" onClick={onClose}>
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={disease.name}
        onClick={(e) => e.stopPropagation()}
        className="rb-drawer flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-[var(--color-paper)] shadow-2xl sm:max-h-none sm:max-w-[560px] sm:rounded-none sm:rounded-l-[28px]"
      >
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-[var(--color-paper)]/95 px-5 pb-4 pt-4 backdrop-blur sm:px-6 sm:pt-6">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <CategoryBadge category={disease.category} />
              <h2 className="mt-3 font-display text-3xl font-black leading-tight text-gray-950">{lang === 'en' ? disease.tag : disease.name}</h2>
              <p className="mt-1 text-sm font-bold text-[var(--color-paddy)]/70">{lang === 'en' ? disease.name : disease.tag}</p>
              {lang === 'en' && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">Details below are in Thai, as published by Thailand's Rice Department.</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={t({ th: 'ปิด', en: 'Close' })} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-gray-900"><X size={18} /></button>
          </div>
        </div>

        <DiseaseBody disease={disease} onOpenPhoto={setViewer} />

        <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t border-gray-100 bg-[var(--color-paper)]/95 px-5 py-3 backdrop-blur sm:px-6">
          <button type="button" onClick={onPrev} disabled={!onPrev} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-extrabold text-gray-600 transition hover:bg-white disabled:opacity-30"><ChevronLeft size={17} />{t({ th: 'ก่อนหน้า', en: 'Previous' })}</button>
          <span className="text-xs font-bold text-gray-400">{position}</span>
          <button type="button" onClick={onNext} disabled={!onNext} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-extrabold text-gray-600 transition hover:bg-white disabled:opacity-30">{t({ th: 'ถัดไป', en: 'Next' })}<ChevronRight size={17} /></button>
        </div>
      </aside>
      {viewer !== null && <PhotoViewer disease={disease} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

export default function RiceDiseases() {
  const { t, lang } = useI18n();
  useDocTitle({ th: 'ความรู้โรคข้าว · Rice AI', en: 'Rice diseases · Rice AI' });
  const catLabel = (c) => (lang === 'en' ? CAT_EN[c] || c : c);
  const diseases = useWikiDiseases();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();

  const counts = useMemo(() => {
    const c = { [ALL]: diseases.length };
    for (const d of diseases) c[d.category] = (c[d.category] || 0) + 1;
    return c;
  }, [diseases]);

  const filtered = useMemo(() => diseases.filter((d) => {
    if (category !== ALL && d.category !== category) return false;
    if (!term) return true;
    return [d.name, d.tag, d.category, d.cause, d.found, d.risk, ...d.symptoms, ...d.prevention, ...d.control.flatMap((c) => [c.text, c.note, ...(c.sub || [])])].join(' ').toLowerCase().includes(term);
  }), [diseases, category, term]);

  const hasFilter = category !== ALL || term.length > 0;
  const clear = () => { setSearch(''); setCategory(ALL); };

  // Selected disease lives in the URL (?d=rice-blast) so it can be shared.
  const openSlug = params.get('d');
  const nav = filtered.some((d) => slugOf(d) === openSlug) ? filtered : diseases;
  const openIndex = nav.findIndex((d) => slugOf(d) === openSlug);
  const open = (d) => setParams((p) => { p.set('d', slugOf(d)); return p; }, { replace: !!openSlug, preventScrollReset: true });
  const close = () => setParams((p) => { p.delete('d'); return p; }, { replace: true, preventScrollReset: true });

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--color-paper)] text-gray-800">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(52,211,153,0.18),transparent_34%),radial-gradient(circle_at_88%_30%,rgba(212,168,75,0.16),transparent_30%)]" />
        <div className="absolute inset-0 rb-soft-grid opacity-50" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:pb-14 lg:pt-14">
          <div className="rb-reveal">
            <a href={RKB_HOME} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-[var(--color-paddy)] shadow-sm transition hover:border-emerald-300">
              <ShieldCheck size={14} />{t({ th: 'อ้างอิงข้อมูลจาก Rice Knowledge Bank กรมการข้าว', en: 'Source: Rice Department\'s Rice Knowledge Bank' })}<ExternalLink size={12} className="opacity-60" />
            </a>
            <h1 className="mt-4 font-display text-4xl font-black leading-[1.15] text-gray-950 sm:text-5xl lg:text-6xl">
              {lang === 'en' ? <>Rice <span className="rb-shiny-text">disease library</span></> : <>คลังความรู้<span className="rb-shiny-text">โรคข้าว</span></>}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-gray-600 sm:text-lg">
              {t({ th: `รู้จักอาการ สาเหตุ และวิธีป้องกันโรคข้าว ${diseases.length} โรค จัดหมวดตามเชื้อสาเหตุ อ่านง่ายทั้งเกษตรกรและนักวิชาการ`, en: `Symptoms, causes and control of ${diseases.length} rice diseases, grouped by cause, for farmers and researchers alike.` })}
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-gray-600">
              <span className="inline-flex items-center gap-2"><span className="font-display text-2xl font-black text-[var(--color-paddy)]">{diseases.length}</span>{t({ th: 'โรค', en: 'diseases' })}</span>
              <span className="inline-flex items-center gap-2"><span className="font-display text-2xl font-black text-[var(--color-paddy)]">{categories.length - 1}</span>{t({ th: 'หมวดเชื้อสาเหตุ', en: 'cause groups' })}</span>
              <span className="inline-flex items-center gap-2"><Sprout size={18} className="text-emerald-600" />{t({ th: 'อาการ · สาเหตุ · การป้องกัน', en: 'Symptoms · causes · control' })}</span>
            </div>
          </div>

          <div className="relative hidden lg:block rb-reveal rb-delay-2">
            <div className="relative rounded-[1.75rem] border border-emerald-100 bg-white/90 p-5 pr-28 shadow-2xl shadow-emerald-950/10 backdrop-blur">
              <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--color-paddy)]/70">{t({ th: 'ไม่แน่ใจว่าเป็นโรคอะไร?', en: 'Not sure what it is?' })}</div>
              <p className="mt-2 font-display text-lg font-extrabold leading-snug text-gray-950">{lang === 'en' ? <>Photograph the leaf<br />and let the AI check in seconds</> : <>ถ่ายรูปใบข้าว<br />ให้ AI ช่วยดูในไม่กี่วินาที</>}</p>
              <Link to="/#app" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-paddy)] px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5">
                <Smartphone size={16} />{t({ th: 'แอป Rice AI', en: 'Rice AI app' })}
              </Link>
              <img src="/app/khao_hom_hello.webp" alt={t({ th: 'น้องข้าวหอม', en: 'Khao Hom, the Rice AI mascot' })} className="rb-peek pointer-events-none absolute -bottom-4 -right-3 w-36 drop-shadow-[0_18px_24px_rgba(20,83,45,0.28)]" />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky search + categories (the only filter on the page) */}
      <div className="sticky top-16 z-30 border-y border-emerald-900/5 bg-[var(--color-paper)]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 shadow-sm transition focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100 lg:w-[360px] lg:shrink-0">
              <Search size={18} className="shrink-0 text-[var(--color-paddy)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t({ th: 'ค้นหาชื่อโรค อาการ หรือเชื้อสาเหตุ', en: 'Search by disease name (EN or TH), symptom or cause' })}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
                aria-label={t({ th: 'ค้นหาโรคข้าว', en: 'Search rice diseases' })}
              />
              {search && <button type="button" onClick={() => setSearch('')} aria-label={t({ th: 'ล้างคำค้นหา', en: 'Clear search' })} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={16} /></button>}
            </label>
            <div className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-wrap [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => {
                const on = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={on}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition ${on ? 'bg-[var(--color-paddy)] text-white shadow-md shadow-emerald-900/20' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-[var(--color-paddy)] hover:ring-emerald-200'}`}
                  >
                    {c !== ALL && <span className="h-2 w-2 rounded-full" style={{ background: on ? '#fff' : CAT[c].dot }} />}
                    {catLabel(c)}
                    <span className={`text-xs font-extrabold ${on ? 'text-emerald-100' : 'text-gray-400'}`}>{counts[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-4 flex min-h-8 items-center justify-between gap-3 text-sm font-bold text-gray-500">
          <span aria-live="polite">
            {lang === 'en'
              ? (hasFilter ? <><span className="text-gray-900">{filtered.length}</span> of {diseases.length} diseases</> : <>All {diseases.length} diseases</>)
              : (hasFilter ? <>พบ <span className="text-gray-900">{filtered.length}</span> จาก {diseases.length} โรค</> : <>ทั้งหมด {diseases.length} โรค</>)}
          </span>
          {hasFilter && <button type="button" onClick={clear} className="rounded-lg px-2 py-1 font-extrabold text-[var(--color-paddy)] hover:bg-emerald-50">{t({ th: 'ล้างตัวกรอง', en: 'Clear filters' })}</button>}
        </div>

        {lang === 'en' && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
            <BookOpen size={17} className="mt-0.5 shrink-0" />
            Disease names are shown in English. Descriptions, symptoms and control advice are in Thai, as published by Thailand's Rice Department; we have not machine-translated them to avoid errors in technical terms.
          </p>
        )}
        {filtered.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-emerald-200 bg-emerald-50/60 p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--color-paddy)] shadow-sm"><Search size={26} /></div>
            <h2 className="font-display text-2xl font-extrabold text-gray-950">{t({ th: 'ไม่พบโรคที่ตรงกับคำค้นหา', en: 'No diseases match your search' })}</h2>
            <p className="mt-2 text-sm font-medium leading-7 text-gray-600">{t({ th: 'ลองคำที่สั้นลง เช่น “ใบ” “เพลี้ย” “แบคทีเรีย” หรือเลือกหมวดอื่น', en: 'Try a shorter word, such as “blast”, “blight” or “virus”, or pick another group.' })}</p>
            <button type="button" onClick={clear} className="mt-5 inline-flex h-11 items-center rounded-xl bg-[var(--color-paddy)] px-5 text-sm font-extrabold text-white">{t({ th: 'ดูทั้งหมด', en: 'Show all' })}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {filtered.map((d) => (
              <DiseaseCard key={d.tag} disease={d} index={diseases.indexOf(d)} term={term} onOpen={() => open(d)} />
            ))}
          </div>
        )}
      </section>

      {/* Before asking for advice + researcher access */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-paper)_0%,#eef6ef_100%)] py-16 sm:py-20">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[var(--color-paddy)] shadow-sm ring-1 ring-emerald-100"><Sparkles size={14} />{t({ th: 'ก่อนขอคำแนะนำ', en: 'Before asking for advice' })}</div>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-gray-950 sm:text-4xl">{t({ th: 'เตรียมข้อมูลให้ครบ วินิจฉัยได้แม่นขึ้น', en: 'Better information, better diagnosis' })}</h2>
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {practices.map((p, i) => (
              <li key={p} className="group rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-950/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 font-display text-lg font-black text-[var(--color-paddy)] transition group-hover:bg-[var(--color-paddy)] group-hover:text-white">{i + 1}</span>
                <p className="mt-4 text-sm font-bold leading-7 text-gray-800">{lang === 'en' ? PRACTICES_EN[i] : p}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[2rem] bg-[var(--color-paddy-dark)] p-6 text-white shadow-2xl shadow-emerald-950/20 sm:p-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-200"><CheckCircle2 size={15} />{t({ th: 'สำหรับนักวิชาการและเจ้าหน้าที่', en: 'For researchers and staff' })}</div>
              <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t({ th: 'ต้องการข้อมูลภาคสนามเชิงลึก?', en: 'Need in-depth field data?' })}</h2>
              <p className="mt-2 text-sm leading-7 text-emerald-50/75">{t({ th: 'เข้าถึงสถิติการตรวจพบรายพื้นที่ แนวโน้มการระบาด และเครื่องมือวิเคราะห์ข้อมูลผ่าน Web Portal', en: 'Detection statistics by area, outbreak trends and analysis tools in the web portal.' })}</p>
            </div>
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
              <Link to="/apply-researcher" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-[var(--color-paddy-dark)] transition hover:-translate-y-0.5"><UserPlus size={16} />{t({ th: 'ขอสิทธิ์นักวิชาการ', en: 'Request researcher access' })}</Link>
              <Link to="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-white/15"><LogIn size={16} />{t({ th: 'เข้าสู่ระบบ', en: 'Sign in' })}</Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter subtitle={{ th: 'คลังความรู้และระบบวิเคราะห์โรคข้าวด้วย AI', en: 'Rice disease library and AI analysis' }} description={{ th: 'ข้อมูลความรู้โรคข้าวอ้างอิงจาก Rice Knowledge Bank กรมการข้าว ใช้ประกอบการเรียนรู้และการเฝ้าระวังโรคข้าว', en: "Disease knowledge from the Rice Department's Rice Knowledge Bank, for learning and disease monitoring." }} />

      {openIndex >= 0 && (
        <DiseaseDrawer
          disease={nav[openIndex]}
          position={`${openIndex + 1} / ${nav.length}`}
          onClose={close}
          onPrev={openIndex > 0 ? () => open(nav[openIndex - 1]) : null}
          onNext={openIndex < nav.length - 1 ? () => open(nav[openIndex + 1]) : null}
        />
      )}
    </main>
  );
}
