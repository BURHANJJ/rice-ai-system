import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Printer, Mail, ArrowRight, Info } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { privacy, terms, CONTACT_EMAIL } from '../lib/legalContent';

const PAGES = {
  privacy: { ...privacy, icon: ShieldCheck, other: { to: '/terms', label: 'เงื่อนไขการให้บริการ' } },
  terms: { ...terms, icon: FileText, other: { to: '/privacy', label: 'นโยบายความเป็นส่วนตัว' } },
};

function Block({ b }) {
  if (b.p) return <p className="leading-[1.85] text-gray-700">{b.p}</p>;
  if (b.note) {
    return (
      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[15px] leading-relaxed text-amber-950">
        <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <p>{b.note}</p>
      </div>
    );
  }
  if (b.list) {
    return (
      <ul className="space-y-2.5">
        {b.list.map((t) => (
          <li key={t} className="flex gap-3 leading-[1.75] text-gray-700">
            <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-paddy)]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (b.table) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
          <thead className="bg-emerald-50/70 text-[var(--color-paddy-dark)]">
            <tr>{b.table.head.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {b.table.rows.map((r) => (
              <tr key={r[0]} className="border-t border-gray-100 align-top">
                {r.map((c, i) => <td key={i} className={`px-4 py-3 leading-relaxed ${i === 0 ? 'min-w-[8.5rem] font-semibold text-gray-900' : 'text-gray-600'}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function LegalPage({ type }) {
  const page = PAGES[type] || PAGES.terms;
  const Icon = page.icon;
  const [active, setActive] = useState(page.sections[0].id);

  useEffect(() => {
    document.title = `${page.title} · Rice AI`;
    window.scrollTo(0, 0);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' },
    );
    page.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [page]);

  return (
    <>
      <div className="print:hidden"><PublicHeader /></div>
      <main className="min-h-screen bg-[var(--color-paper)] text-gray-800 print:bg-white">
        {/* Title */}
        <section className="border-b border-emerald-900/10 bg-white/70 print:border-0">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-paddy)]">
              <Icon size={18} /> เอกสารทางกฎหมาย
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold text-gray-950 sm:text-5xl">{page.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
              <span>มีผลตั้งแต่ {page.updated}</span>
              <span>ฉบับที่ {page.version}</span>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-paddy-dark)] hover:underline print:hidden">
                <Printer size={15} /> พิมพ์ / บันทึกเป็น PDF
              </button>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-14">
          {/* Table of contents */}
          <nav aria-label="สารบัญ" className="hidden lg:block print:hidden">
            <div className="sticky top-28">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">สารบัญ</div>
              <ol className="space-y-1 border-l border-gray-200">
                {page.sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                      className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm leading-snug transition ${active === s.id ? 'border-[var(--color-paddy)] font-semibold text-[var(--color-paddy-dark)]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                    >
                      {i + 1}. {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="min-w-0">
            {/* Summary */}
            <div className="mb-12 rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-8 print:shadow-none">
              <h2 className="font-display text-xl font-bold text-gray-950">สรุปสั้น ๆ</h2>
              <ul className="mt-4 space-y-3">
                {page.summary.map((t) => (
                  <li key={t} className="flex gap-3 leading-relaxed text-gray-700">
                    <span className="mt-[0.65em] h-2 w-2 shrink-0 rounded-full bg-[var(--color-gold)]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-gray-500">สรุปนี้ช่วยให้อ่านง่ายขึ้น เนื้อหาที่มีผลบังคับคือรายละเอียดด้านล่าง</p>
            </div>

            <div className="space-y-12">
              {page.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-28 break-inside-avoid-page">
                  <h2 className="mb-5 flex items-baseline gap-3 font-display text-2xl font-bold text-gray-950">
                    <span className="text-base font-semibold text-[var(--color-paddy)]">{String(i + 1).padStart(2, '0')}</span>
                    {s.heading}
                  </h2>
                  <div className="space-y-4">
                    {s.blocks.map((b, k) => <Block key={k} b={b} />)}
                  </div>
                </section>
              ))}
            </div>

            {/* Contact */}
            <div className="mt-14 grid gap-4 rounded-3xl bg-[var(--color-paddy-dark)] p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-8 print:bg-white print:text-gray-900">
              <div>
                <h2 className="font-display text-xl font-bold">มีคำถามหรือต้องการใช้สิทธิ์เกี่ยวกับข้อมูล</h2>
                <p className="mt-1.5 text-sm text-emerald-100/90 print:text-gray-600">ส่งอีเมลจากบัญชีที่ลงทะเบียนไว้ เราจะตอบภายใน 30 วัน</p>
              </div>
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Rice AI: ' + page.title)}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[var(--color-paddy-dark)] transition hover:bg-emerald-50 print:border print:border-gray-300">
                <Mail size={16} /> {CONTACT_EMAIL}
              </a>
            </div>

            <Link to={page.other.to} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-paddy-dark)] hover:underline print:hidden">
              อ่าน{page.other.label} <ArrowRight size={15} />
            </Link>
          </article>
        </div>
      </main>
      <div className="print:hidden"><PublicFooter /></div>
    </>
  );
}
