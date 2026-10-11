export default function FormField({ label, ...props }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-[var(--color-ink)] mb-1">{label}</span>
      <input
        {...props}
        className="w-full border border-black/15 rounded-md px-3 py-2 text-sm bg-white focus:border-[var(--color-paddy)] outline-none"
      />
    </label>
  );
}
