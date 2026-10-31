// Full-screen branded loading state. Matches the pre-React splash in index.html so the hand-over is seamless.
export default function BrandSplash({ label = 'กำลังเตรียมระบบ', hint = '' }) {
  return (
    <div className="rb-splash" role="status" aria-live="polite">
      <div className="rb-splash-mark">
        <span className="rb-splash-ring" aria-hidden="true" />
        <img src="/brand/logo_mark_ondark.svg" alt="" width="84" height="84" decoding="async" />
      </div>
      <div className="rb-splash-name font-display">Rice AI</div>
      <div className="rb-splash-bar" aria-hidden="true"><i /></div>
      <div className="rb-splash-label">{label}</div>
      {hint && <div className="rb-splash-hint">{hint}</div>}
    </div>
  );
}
