import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen px-4 py-10" style={{ background: 'var(--color-paddy-dark)' }}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/10">
            <img src="/brand/logo_mark.svg" alt="Rice AI logo" className="h-11 w-11 object-contain" />
          </div>
          <div className="font-display text-3xl font-bold text-white">Rice AI</div>
          <div className="mt-1 text-xs font-medium text-white/60">ระบบวินิจฉัยโรคใบข้าวด้วย AI</div>
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-[var(--color-paper)] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <Link
            to="/"
            className="group mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[var(--color-paddy)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </Link>

          <h1 className="mb-2 font-display text-2xl font-bold text-[var(--color-paddy-dark)]">{title}</h1>
          {subtitle && <p className="mb-6 text-sm leading-relaxed text-[var(--color-muted)]">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
