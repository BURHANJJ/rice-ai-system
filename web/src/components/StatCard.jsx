export default function StatCard({ label, value, sub, nodeType = 'process' }) {
  return (
    <div className="bg-white border border-black/5 rounded-lg shadow-sm p-5 flex items-start gap-3">
      <div className={nodeType === 'store' ? 'dfd-node-store text-[var(--color-gold)]' : 'dfd-node-process text-[var(--color-paddy)]'}>
        {nodeType === 'store' ? '▭' : '●'}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-mono">{label}</div>
        <div className="font-display text-2xl text-[var(--color-paddy-dark)] mt-0.5">{value}</div>
        {sub && <div className="text-xs text-[var(--color-muted)] mt-1">{sub}</div>}
      </div>
    </div>
  );
}
