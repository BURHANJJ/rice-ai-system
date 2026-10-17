// Khao Hom's floating quick-action dial, shared by the public pages.
// Closed: the mascot sits in the corner with a speech bubble that types short messages.
// Open: a menu card rises above him with every shortcut as a labelled row (icon, name, hint),
// chat first and "back to top" last. Arrow keys move between rows. Closes on a second tap,
// a tap anywhere else, or Esc. Phones skip the menu: tapping him opens the chat.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircleMore, X } from 'lucide-react';
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
 * actions: [{ key, icon, label, hint?, accent?, onClick? | href? | to? }] — key 'top' is listed last.
 * bubble: messages the speech bubble types in turn. bubbleTo: optional route the bubble links to
 * (otherwise tapping the bubble opens the dial).
 */
export default function KhaoHomDial({ actions: pageActions, bubble, bubbleTo, revealAfter = 0, chat = true }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // The chat assistant is the last (top-most) action on every page that uses the dial.
  const actions = chat
    ? [...pageActions, { key: 'chat', icon: MessageCircleMore, label: t({ th: 'คุยกับน้องข้าวหอม', en: 'Chat with Khao Hom' }), hint: t({ th: 'ถามเรื่องแอปและโรคข้าว', en: 'Ask about the app and rice diseases' }), onClick: () => setChatOpen(true), accent: true }]
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

  // Menu order: chat first (the main thing he does), page shortcuts, "back to top" last after a divider.
  const menu = [
    ...actions.filter((a) => a.key === 'chat'),
    ...actions.filter((a) => a.key !== 'chat' && a.key !== 'top'),
    ...actions.filter((a) => a.key === 'top').map((a) => ({ ...a, divider: true })),
  ];
  const menuRef = useRef(null);
  const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
  useEffect(() => {
    if (!open) return undefined;
    const tm = setTimeout(() => items()[0]?.focus({ preventScroll: true }), 120);
    return () => clearTimeout(tm);
  }, [open]);
  const onMenuKey = (e) => {
    const list = items();
    const at = list.indexOf(document.activeElement);
    const go = (i) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
  };
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

      {/* Menu card above the mascot: every action is a labelled row, nothing covers the page. */}
      <div
        ref={menuRef}
        role="menu"
        aria-label={t({ th: 'เมนูทางลัด', en: 'Quick actions' })}
        aria-hidden={!open}
        onKeyDown={onMenuKey}
        className={`kh-menu absolute bottom-full right-0 mb-3 w-[min(19rem,calc(100vw-1.5rem))] origin-bottom-right overflow-hidden rounded-[1.4rem] border border-emerald-900/10 bg-white/95 shadow-[0_28px_70px_-24px_rgba(15,45,31,.55)] backdrop-blur-xl ${open ? 'kh-menu-open' : 'pointer-events-none'}`}
      >
        <div className="flex items-center gap-2.5 border-b border-emerald-900/5 bg-gradient-to-br from-[#f3f8f2] to-white px-4 py-3">
          <img src={khaoHomMascot} alt="" className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold leading-tight text-emerald-950">{t({ th: 'ให้น้องข้าวหอมช่วยอะไรดี', en: 'How can Khao Hom help?' })}</div>
            <div className="text-[11px] text-slate-500">{t({ th: 'เลือกทางลัดได้เลยครับ', en: 'Pick a shortcut' })}</div>
          </div>
        </div>
        <div className="p-1.5">
          {menu.map((a, i) => {
            const Icon = a.icon;
            const inner = (
              <>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${a.accent ? 'bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-[0_8px_18px_-8px_rgba(6,78,59,.8)]' : 'bg-emerald-50 text-emerald-800 group-hover/item:bg-emerald-100'}`}>
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-slate-900">{a.label}</span>
                  {a.hint && <span className="block truncate text-[11.5px] text-slate-500">{a.hint}</span>}
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover/item:translate-x-0.5 group-hover/item:text-emerald-700" />
              </>
            );
            const props = {
              role: 'menuitem',
              tabIndex: open ? 0 : -1,
              style: { transitionDelay: open ? `${60 + i * 35}ms` : '0ms' },
              className: `kh-item group/item flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left outline-none transition hover:bg-emerald-50/70 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-700/30 ${a.divider ? 'mt-1 border-t border-slate-100 pt-2.5' : ''}`,
            };
            const close = () => setOpen(false);
            if (a.to) return <Link key={a.key} to={a.to} onClick={close} {...props}>{inner}</Link>;
            if (a.href) return <a key={a.key} href={a.href} onClick={close} {...props}>{inner}</a>;
            return <button key={a.key} type="button" onClick={() => { close(); a.onClick?.(); }} {...props}>{inner}</button>;
          })}
        </div>
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
