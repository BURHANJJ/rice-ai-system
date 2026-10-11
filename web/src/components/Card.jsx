export default function Card({ title, eyebrow, action, children, className = '' }) {
  return (
    <div className={`bg-white border border-black/5 rounded-lg shadow-sm ${className}`}>
      {(title || eyebrow || action) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            {eyebrow && <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-mono">{eyebrow}</div>}
            {title && <h3 className="font-display text-lg text-[var(--color-paddy-dark)]">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}
