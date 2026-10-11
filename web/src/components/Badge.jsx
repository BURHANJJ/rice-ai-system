export default function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-black/5 text-[var(--color-ink)]',
    low: 'bg-[var(--color-risk-low)]/15 text-[var(--color-risk-low)]',
    medium: 'bg-[var(--color-risk-medium)]/20 text-[#8a6a1f]',
    high: 'bg-[var(--color-risk-high)]/15 text-[var(--color-risk-high)]',
    pending: 'bg-amber-500/15 text-amber-700',
    active: 'bg-emerald-600/15 text-emerald-700',
    suspended: 'bg-red-600/15 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}
