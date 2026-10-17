// Khao Hom's floating quick-action dial, shared by the public pages.
// Closed: the mascot sits in the corner with a speech bubble that types short messages.
// Open: round actions spring out along an arc beside him; each shows its name on hover,
// keyboard focus, and (on touch screens, which cannot hover) for as long as the dial is open.
// Closes on a second tap, a tap anywhere else, or Esc.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircleMore, X } from 'lucide-react';
import ChatPanel from './chat/ChatPanel';
import khaoHomMascot from '../../assets/khao_hom_scan.svg';
import { useI18n } from '../lib/i18n';

const PHONE = '(max-width: 639px)';
const reducedMotion =() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const scrollToTop = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });

function useTyping(messages, paused) {
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(true);
  useEffect(() => {
    if (paused) return undefined;
    if (reducedMotion()) {
      setText(messages[0]);
      setTyping(false);
      return undefined;
    }
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
    const split = (s) => (segmenter ? [...segmenter.segment(s)].map(({ segment }) => segment) : Array.from(s));
    let phrase = 0;
    let chars = split(messages[phrase]);
    let length = 0;
    let deleting = false;
    let timer;
    setText('');
    setTyping(true);
    const tick = () => {
      if (!deleting) {
        length += 1;
        setText(chars.slice(0, length).join(''));
        if (length >= chars.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1500);
          return;
        }
        timer = window.setTimeout(tick, 105);
        return;
      }
      length -= 1;
      setText(chars.slice(0, length).join(''));
      setTyping(true);
      if (length <= 0) {
        deleting = false;
        phrase = (phrase + 1) % messages.length;
        chars = split(messages[phrase]);
        timer = window.setTimeout(tick, 320);
        return;
      }
      timer = window.setTimeout(tick, 58);
    };
    timer = window.setTimeout(tick, 450);
    return () => window.clearTimeout(timer);
  }, [paused, ...messages]); // eslint-disable-line react-hooks/exhaustive-deps
  return [text, typing];
}

/**
 * actions: [{ key, icon, label, onClick? | href? | to? }] — drawn from the bottom of the arc (left) to the top.
 * bubble: messages the speech bubble types in turn. bubbleTo: optional route the bubble links to
 * (otherwise tapping the bubble opens the dial).
 */
export default function KhaoHomDial({ actions: pageActions, bubble, bubbleTo, revealAfter = 0, chat = true }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // The chat assistant is the last (top-most) action on every page that uses the dial.
  const actions = chat
    ? [...pageActions, { key: 'chat', icon: MessageCircleMore, label: t({ th: 'คุยกับน้องข้าวหอม', en: 'Chat with Khao Hom' }), onClick: () => setChatOpen(true), accent: true }]
    : pageActions;
  const ref = useRef(null);
  // Phones: the arc of labels crowds a small screen, so tapping Khao Hom goes straight to the chat.
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const chatFirst = chat && phone;
  useEffect(() => { if (chatFirst) setOpen(false); }, [chatFirst]);
  // revealAfter: px to scroll before he shows up (e.g. past a hero that already has a mascot in it)
  const [shown, setShown] = useState(revealAfter === 0);
  useEffect(() => {
    if (!revealAfter) return undefined;
    const check = () => setShown(window.scrollY > revealAfter);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [revealAfter]);
  useEffect(() => { if (!shown) setOpen(false); }, [shown]);
  const [typed, typing] = useTyping(bubble, open || !shown || chatOpen);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // Spread the buttons over a quarter circle; the radius grows with their number so they never touch.
  const radius = Math.max(104, ((actions.length - 1) * 58) / (Math.PI / 2));
  const bubbleClass = 'rs-typing-bubble absolute bottom-full right-8 mb-2 flex min-h-10 w-max max-w-[min(208px,calc(100vw-5rem))] items-center rounded-2xl rounded-br-sm border border-emerald-900/10 bg-white px-3 py-2 text-left text-xs font-bold leading-5 text-emerald-950 shadow-[0_10px_28px_-12px_rgba(15,45,31,.4)] transition hover:-translate-y-0.5 hover:border-emerald-700/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20';
  const bubbleText = <span className="min-w-0 whitespace-normal break-words">{typed}{typing && <span aria-hidden="true" className="rs-typing-caret ml-0.5 inline-block h-4 align-middle" />}</span>;

  return (
    <>
      {/* Soft scrim so the open dial reads clearly over busy content; tapping it closes the dial.
          Kept outside the sliding container: a transformed parent would clip a fixed child to its own box. */}
      <div aria-hidden="true" onClick={() => setOpen(false)} className={`fixed inset-0 z-40 bg-[radial-gradient(circle_at_100%_100%,rgba(6,40,28,.28),rgba(6,40,28,.10)_45%,transparent_75%)] transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <div ref={ref} aria-hidden={!shown || chatOpen} className={`group fixed bottom-4 right-3 z-40 transition duration-500 ease-out sm:bottom-5 sm:right-5 lg:bottom-7 lg:right-7 ${shown && !chatOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'}`}>
      {!open && (bubbleTo
        ? <Link to={bubbleTo} aria-label={bubble[0]} className={bubbleClass}>{bubbleText}</Link>
        : <button type="button" onClick={() => (chat ? setChatOpen(true) : setOpen(true))} aria-label={chat ? t({ th: 'คุยกับน้องข้าวหอม', en: 'Chat with Khao Hom' }) : t({ th: 'เปิดเมนูน้องข้าวหอม', en: 'Open Khao Hom menu' })} className={bubbleClass}>{bubbleText}</button>)}

      <div role="menu" aria-label={t({ th: 'เมนูทางลัด', en: 'Quick actions' })} aria-hidden={!open} className="pointer-events-none absolute left-1/2 top-1/2">
        {actions.map((a, i) => {
          const angle = (180 - (90 / Math.max(1, actions.length - 1)) * i) * (Math.PI / 180);
          const style = {
            '--dx': `${Math.cos(angle) * radius}px`,
            '--dy': `${-Math.sin(angle) * radius}px`,
            transitionDelay: `${open ? i * 55 : (actions.length - 1 - i) * 35}ms`,
          };
          const Icon = a.icon;
          const inner = (
            <>
              <span className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_12px_28px_-10px_rgba(15,45,31,.5)] ring-4 ring-white/60 transition group-hover/dial:scale-110 group-focus-visible/dial:scale-110 ${a.accent ? 'border-emerald-900 bg-gradient-to-br from-emerald-600 to-emerald-900 text-white' : 'border-emerald-900/10 bg-white text-emerald-900 group-hover/dial:bg-emerald-800 group-hover/dial:text-white group-focus-visible/dial:bg-emerald-800 group-focus-visible/dial:text-white'}`}>
                <Icon size={19} strokeWidth={2.2} />
              </span>
              <span className="rs-dial-label pointer-events-none absolute right-full top-1/2 mr-3 whitespace-nowrap rounded-full bg-emerald-950 px-3 py-1.5 text-xs font-bold text-white shadow-lg">{a.label}</span>
            </>
          );
          const props = {
            role: 'menuitem',
            'aria-label': a.label,
            title: a.label,
            tabIndex: open ? 0 : -1,
            style,
            className: `rs-dial group/dial absolute -ml-6 -mt-6 block rounded-full focus-visible:outline-none ${open ? 'rs-dial-open pointer-events-auto' : ''}`,
          };
          const close = () => setOpen(false);
          if (a.to) return <Link key={a.key} to={a.to} onClick={close} {...props}>{inner}</Link>;
          if (a.href) return <a key={a.key} href={a.href} onClick={close} {...props}>{inner}</a>;
          return <button key={a.key} type="button" onClick={() => { close(); a.onClick?.(); }} {...props}>{inner}</button>;
        })}
      </div>

      <button
        type="button"
        onClick={() => (chatFirst ? setChatOpen(true) : setOpen((v) => !v))}
        aria-label={chatFirst ? t({ th: 'คุยกับน้องข้าวหอม', en: 'Chat with Khao Hom' }) : open ? t({ th: 'ปิดเมนูน้องข้าวหอม', en: 'Close Khao Hom menu' }) : t({ th: 'เปิดเมนูน้องข้าวหอม', en: 'Open Khao Hom menu' })}
        aria-expanded={chatFirst ? chatOpen : open}
        aria-haspopup={chatFirst ? 'dialog' : 'menu'}
        className="relative flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25"
      >
        <img src={khaoHomMascot} alt="" aria-hidden="true" className="rs-quick-mascot h-20 w-20 object-contain transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:rotate-[-3deg] group-hover:scale-110 motion-reduce:transition-none sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
        <span aria-hidden="true" className={`absolute right-0 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-950 text-white shadow-lg ring-2 ring-white transition duration-300 ${open ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <X size={14} strokeWidth={2.6} />
        </span>
      </button>
    </div>
      {chat && <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />}
    </>
  );
}
