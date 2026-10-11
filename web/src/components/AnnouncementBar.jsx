import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Info, Siren, X } from 'lucide-react';
import { liveAnnouncement, useSettings } from '../lib/settings';

const TONE = {
  info: { cls: 'bg-[var(--color-paddy)] text-white', icon: Info },
  warning: { cls: 'bg-amber-400 text-amber-950', icon: AlertTriangle },
  danger: { cls: 'bg-red-600 text-white', icon: Siren },
};

const keyOf = (a) => `rb-ann:${a.text}`;

export function AnnouncementBar({ a, preview = false, onClose }) {
  const t = TONE[a.tone] || TONE.info;
  const Icon = t.icon;
  const external = /^https?:/.test(a.linkUrl || '');
  return (
    <div role="region" aria-label="ประกาศ" className={`relative ${t.cls}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-2 text-[13px] font-semibold leading-5 lg:px-6">
        <Icon size={16} className="shrink-0" />
        <p className="min-w-0 flex-1">
          {a.text}
          {a.linkUrl && a.linkLabel && (
            preview || external ? (
              <a href={a.linkUrl} target={external ? '_blank' : undefined} rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 font-extrabold underline underline-offset-2">{a.linkLabel}<ArrowRight size={13} /></a>
            ) : (
              <Link to={a.linkUrl} className="ml-2 inline-flex items-center gap-0.5 font-extrabold underline underline-offset-2">{a.linkLabel}<ArrowRight size={13} /></Link>
            )
          )}
        </p>
        {!preview && (
          <button type="button" onClick={onClose} aria-label="ปิดประกาศ" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-80 hover:bg-black/10 hover:opacity-100"><X size={15} /></button>
        )}
      </div>
    </div>
  );
}

/** Site-wide banner managed from Admin → ตั้งค่าระบบ. */
export default function SiteAnnouncement() {
  const { settings } = useSettings();
  const a = liveAnnouncement(settings.announcement);
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('rb-ann-hidden') || ''; } catch { return ''; }
  });
  if (!a || hidden === keyOf(a)) return null;
  const close = () => {
    setHidden(keyOf(a));
    try { sessionStorage.setItem('rb-ann-hidden', keyOf(a)); } catch { /* storage unavailable */ }
  };
  return <AnnouncementBar a={a} onClose={close} />;
}
