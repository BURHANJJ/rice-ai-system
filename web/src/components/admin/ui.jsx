import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

/* Shared building blocks for the admin / researcher portal. */

export function PageHeader({ icon: Icon, eyebrow, title, desc, actions, children }) {
  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-paddy)] ring-1 ring-emerald-100">
              {Icon && <Icon size={12} strokeWidth={2.5} />}
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-gray-950 sm:text-[32px]">{title}</h1>
          {desc && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-gray-500">{desc}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Panel({ title, desc, actions, children, className = '', bodyClass = 'p-5', id }) {
  return (
    <section id={id} className={`rounded-[22px] border border-emerald-900/10 bg-white shadow-sm shadow-emerald-950/[0.03] ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-extrabold text-gray-900">{title}</h2>}
            {desc && <p className="mt-0.5 text-xs leading-5 text-gray-500">{desc}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  dark: 'bg-[var(--color-paddy)] text-white ring-[var(--color-paddy)]',
};

export function Pill({ tone = 'gray', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ${TONES[tone]} ${className}`}>
      {Icon && <Icon size={11} strokeWidth={2.6} />}
      {children}
    </span>
  );
}

const KPI_ICON = {
  green: 'bg-emerald-50 text-[var(--color-paddy)]',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-sky-50 text-sky-700',
  gray: 'bg-gray-100 text-gray-600',
};

export function Kpi({ label, value, sub, icon: Icon, tone = 'green', to, loading }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold text-gray-500">{label}</span>
        {Icon && <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${KPI_ICON[tone]}`}><Icon size={16} /></span>}
      </div>
      <div className="mt-2 font-display text-[28px] font-bold leading-none tracking-tight text-gray-950 tabular-nums">
        {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded-lg bg-gray-100 align-middle" /> : value}
      </div>
      {sub && <div className="mt-2 text-xs leading-5 text-gray-500">{sub}</div>}
    </>
  );
  const cls = 'block rounded-[20px] border border-emerald-900/10 bg-white p-4 shadow-sm shadow-emerald-950/[0.03]';
  return to ? <Link to={to} className={`${cls} transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md`}>{body}</Link> : <div className={cls}>{body}</div>;
}

const BTN = {
  primary: 'bg-[var(--color-paddy)] text-white shadow-sm shadow-emerald-950/20 hover:bg-[var(--color-paddy-dark)]',
  secondary: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-950',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  soft: 'bg-emerald-50 text-[var(--color-paddy)] ring-1 ring-emerald-100 hover:bg-emerald-100',
};

export function Btn({ variant = 'secondary', size = 'md', icon: Icon, busy, to, className = '', children, ...rest }) {
  const sz = size === 'sm' ? 'h-8 gap-1.5 rounded-lg px-2.5 text-xs' : 'h-10 gap-2 rounded-xl px-3.5 text-sm';
  const cls = `inline-flex shrink-0 items-center justify-center font-bold transition disabled:pointer-events-none disabled:opacity-50 ${sz} ${BTN[variant]} ${className}`;
  const inner = (
    <>
      {busy ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" /> : Icon && <Icon size={size === 'sm' ? 13 : 15} />}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  return <button type="button" className={cls} disabled={busy || rest.disabled} {...rest}>{inner}</button>;
}

export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div role="tablist" className={`inline-flex max-w-full overflow-x-auto rounded-xl bg-gray-100 p-1 [scrollbar-width:none] ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition ${on ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`rounded-md px-1.5 text-[10px] tabular-nums ${on ? 'bg-emerald-50 text-[var(--color-paddy)]' : 'bg-gray-200/70 text-gray-500'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--color-paddy)]"><Icon size={22} /></span>}
      <div className="text-[15px] font-extrabold text-gray-900">{title}</div>
      {desc && <p className="mt-1 max-w-sm text-sm leading-6 text-gray-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'sm:max-w-[520px]' }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-end bg-gray-950/40 backdrop-blur-sm sm:items-stretch" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`rb-drawer flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[26px] bg-[var(--color-paper)] shadow-2xl sm:max-h-none sm:rounded-none sm:rounded-l-[26px] ${width}`}
      >
        <div className="flex items-start gap-3 border-b border-gray-200/70 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-extrabold text-gray-950">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 hover:text-gray-900"><X size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200/70 bg-white/60 px-5 py-3 sm:px-6">{footer}</div>}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className={`rb-dialog w-full overflow-hidden rounded-[24px] bg-white shadow-2xl ${width}`}>
        {title && <div className="border-b border-gray-100 px-6 py-4 text-base font-extrabold text-gray-950">{title}</div>}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, desc, confirmLabel = 'ยืนยัน', tone = 'primary', busy, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      footer={(
        <>
          <Btn onClick={onCancel} disabled={busy}>ยกเลิก</Btn>
          <Btn variant={tone === 'danger' ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>{confirmLabel}</Btn>
        </>
      )}
    >
      {desc && <p className="text-sm leading-6 text-gray-600">{desc}</p>}
      {children}
    </Modal>
  );
}

/** `const [toast, show] = useToast()` → render {toast}; show('บันทึกแล้ว') or show('ผิดพลาด', 'error'). */
export function useToast() {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, type = 'success') => {
    setT({ message, type, id: Date.now() });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const el = t && (
    <div key={t.id} role="status" className={`rb-dialog fixed bottom-5 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold shadow-2xl ${t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-950 text-white'}`}>
      {t.type === 'error' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} className="text-emerald-300" />}
      {t.message}
    </div>
  );
  return [el, show];
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-extrabold text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-5 text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-500';

export function Toggle({ checked, onChange, label, desc, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-2xl p-1 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-gray-900">{label}</span>
        {desc && <span className="mt-0.5 block text-xs leading-5 text-gray-500">{desc}</span>}
      </span>
      <span className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[var(--color-paddy)]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}
