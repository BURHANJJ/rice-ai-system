// Khao Hom's chat window: answers questions about Rice AI and rice diseases.
// Opens from the Khao Hom quick-action dial. Desktop: a card above the corner;
// phones: a bottom sheet. The conversation survives page changes within the tab.
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUp, RotateCcw, Sparkles, X } from 'lucide-react';
import khaoHom from '../../../assets/khao_hom_scan.svg';
import { ask, cloudEnabled } from '../../lib/chatbot/client';
import { SUGGESTIONS } from '../../lib/chatbot/knowledge';

const STORE = 'riceai-chat-v1';
const MAX = 500;
const WELCOME = {
  role: 'assistant',
  content: 'สวัสดีครับ ผมน้องข้าวหอม ผู้ช่วยของ Rice AI\nถามได้ทั้งเรื่องการใช้งานแอป ความแม่นยำของ AI งานวิจัย ความเป็นส่วนตัว และอาการหรือการป้องกันโรคข้าวครับ',
  suggestions: SUGGESTIONS,
};

const load = () => {
  try { const v = JSON.parse(sessionStorage.getItem(STORE)); return Array.isArray(v) && v.length ? v : [WELCOME]; } catch { return [WELCOME]; }
};

/** **bold**, *italic* and "- " / "1. " lists; everything else is plain text (no HTML from answers). */
function Rich({ text }) {
  const inline = (s, key) => s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={`${key}-${i}`} className="font-bold text-emerald-950">{part.slice(2, -2)}</strong>
      : part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>
        : <Fragment key={`${key}-${i}`}>{part}</Fragment>);
  const blocks = [];
  text.split('\n').forEach((line, i) => {
    const bullet = line.match(/^(\s*)(-|\d+\.)\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      const item = { indent: bullet[1].length > 0, mark: bullet[2], body: bullet[3], key: i };
      if (last?.type === 'list') last.items.push(item); else blocks.push({ type: 'list', items: [item], key: i });
    } else if (line.trim()) blocks.push({ type: 'p', body: line, key: i });
  });
  return blocks.map((b) => (b.type === 'list'
    ? <ul key={b.key} className="my-1.5 space-y-1">{b.items.map((it) => <li key={it.key} className={`flex gap-2 ${it.indent ? 'pl-4 text-[12.5px] text-slate-600' : ''}`}><span className="mt-[1px] shrink-0 font-bold text-emerald-700">{it.mark === '-' ? '•' : it.mark}</span><span>{inline(it.body, it.key)}</span></li>)}</ul>
    : <p key={b.key} className="my-1 first:mt-0 last:mb-0">{inline(b.body, b.key)}</p>));
}

function Chips({ items, onPick, disabled }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      {items.map((s) => (
        <button key={s} type="button" disabled={disabled} onClick={() => onPick(s)} className="shrink-0 rounded-full border border-emerald-800/15 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:border-emerald-700/40 hover:bg-emerald-100 disabled:opacity-50">
          {s}
        </button>
      ))}
    </div>
  );
}

export default function ChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState(load);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef(null);
  const input = useRef(null);

  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40))); } catch { /* storage may be blocked */ } }, [messages]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy, open]);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => input.current?.focus(), 250);
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(t); document.removeEventListener('keydown', esc); };
  }, [open, onClose]);

  // phones: the sheet is modal, so the page behind it must not scroll
  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 639px)').matches) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const send = async (text) => {
    const q = (text ?? draft).trim().slice(0, MAX);
    if (!q || busy) return;
    setDraft('');
    if (input.current) input.current.style.height = '';
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const history = next.filter((m) => m.content !== WELCOME.content).map(({ role, content }) => ({ role, content }));
      const a = await ask(history);
      setMessages((m) => [...m, { role: 'assistant', content: a.text, links: a.links, suggestions: a.suggestions, source: a.source }]);
    } finally {
      setBusy(false);
      setTimeout(() => input.current?.focus(), 50);
    }
  };
  const reset = () => setMessages([WELCOME]);
  const lastBot = [...messages].reverse().find((m) => m.role === 'assistant');

  // portalled to <body> so no ancestor stacking context (the dial, the page) can sit above it
  return createPortal(
    <>
    {/* phones: dim the page behind the sheet; tap it to close */}
    <div aria-hidden="true" onClick={onClose} className={`fixed inset-0 z-[10000] bg-emerald-950/40 backdrop-blur-[2px] transition-opacity duration-300 sm:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
    <div
      role="dialog"
      aria-modal={open || undefined}
      aria-label="แชทกับน้องข้าวหอม"
      aria-hidden={!open}
      inert={!open}
      className={`fixed z-[10000] flex flex-col overflow-hidden bg-[#fbfaf5] shadow-[0_30px_80px_-24px_rgba(15,45,31,.55)] transition-[transform,opacity] duration-300 ease-out
        inset-x-0 bottom-0 h-[min(88dvh,760px)] rounded-t-[1.75rem] max-[520px]:max-h-[calc(100dvh-env(safe-area-inset-top)-.5rem)]
        sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[min(400px,calc(100vw-2.5rem))] sm:rounded-[1.75rem] sm:border sm:border-emerald-900/10
        lg:bottom-7 lg:right-7 lg:h-[min(680px,calc(100dvh-8.5rem))] 2xl:w-[430px] 2xl:h-[min(760px,calc(100dvh-9rem))]
        [@media(max-height:560px)]:bottom-2 [@media(max-height:560px)]:h-[calc(100dvh-1rem)] [@media(max-height:560px)]:rounded-[1.25rem]
        ${open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
    >
      {/* header */}
      <div className="relative flex shrink-0 items-center gap-3 bg-gradient-to-br from-[#1b4332] via-[#1f5a40] to-[#2d6a4f] px-4 pb-3 pt-2.5 text-white sm:py-3.5 [@media(max-height:520px)]:py-2">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(212,168,75,.35),transparent_55%)]" />
        {/* drag-handle cue on phones */}
        <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/35 sm:hidden" />
        <span className="relative mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-md sm:mt-0 sm:h-12 sm:w-12 [@media(max-height:520px)]:h-9 [@media(max-height:520px)]:w-9"><img src={khaoHom} alt="" className="h-[82%] w-[82%] object-contain" /></span>
        <div className="relative mt-1.5 min-w-0 flex-1 sm:mt-0">
          <div className="font-extrabold leading-tight">น้องข้าวหอม</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-100/90">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" /></span>
            ผู้ช่วยของ Rice AI
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{cloudEnabled ? <><Sparkles size={10} /> AI</> : 'คลังความรู้'}</span>
          </div>
        </div>
        <button type="button" onClick={reset} title="เริ่มคุยใหม่" aria-label="เริ่มคุยใหม่" className="relative mt-1.5 flex h-9 w-9 sm:mt-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"><RotateCcw size={16} /></button>
        <button type="button" onClick={onClose} title="ปิด" aria-label="ปิดแชท" className="relative mt-1.5 flex h-9 w-9 sm:mt-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"><X size={18} /></button>
      </div>

      {/* messages */}
      <div ref={list} aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-4 [scrollbar-color:rgba(27,67,50,.25)_transparent] [scrollbar-width:thin] sm:px-4">
        {messages.map((m, i) => (m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#1b4332] px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">{m.content}</div>
          </div>
        ) : (
          <div key={i} className="flex items-end gap-2">
            <img src={khaoHom} alt="" className="mb-1 h-7 w-7 shrink-0 object-contain" />
            <div className="min-w-0 max-w-[86%]">
              <div className="rounded-2xl rounded-bl-md border border-emerald-900/10 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-700 shadow-[0_4px_14px_-8px_rgba(15,45,31,.25)]">
                <Rich text={m.content} />
                {m.links?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {m.links.map((l) => (l.to.includes('#')
                      ? <a key={l.to} href={l.to} onClick={onClose} className="rounded-lg bg-emerald-800 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-900">{l.label} →</a>
                      : <Link key={l.to} to={l.to} onClick={onClose} className="rounded-lg bg-emerald-800 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-900">{l.label} →</Link>))}
                  </div>
                )}
              </div>
              {m === lastBot && !busy && <Chips items={m.suggestions} onPick={send} disabled={busy} />}
            </div>
          </div>
        )))}
        {busy && (
          <div className="flex items-end gap-2" aria-label="น้องข้าวหอมกำลังพิมพ์">
            <img src={khaoHom} alt="" className="mb-1 h-7 w-7 shrink-0 object-contain" />
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-emerald-900/10 bg-white px-4 py-3.5">
              {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-emerald-700/70" style={{ animationDelay: `${d * 140}ms` }} />)}
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="shrink-0 border-t border-emerald-900/10 bg-white px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2.5">
        <div className="flex items-end gap-2 rounded-2xl border border-emerald-900/15 bg-[#fbfaf5] p-1.5 pl-3 transition focus-within:border-emerald-700/45 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(45,106,79,.12)]">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            maxLength={MAX}
            onChange={(e) => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            placeholder="ถามเรื่อง Rice AI หรือโรคข้าว…"
            aria-label="พิมพ์คำถาม"
            className="rc-input max-h-28 min-h-[2.25rem] min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base leading-6 text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm"
          />
          <button type="submit" disabled={!draft.trim() || busy} aria-label="ส่งคำถาม" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1b4332] text-white shadow transition hover:bg-[#2d6a4f] disabled:cursor-not-allowed disabled:bg-slate-300">
            <ArrowUp size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10.5px] leading-4 text-slate-500 [@media(max-height:520px)]:hidden">
          <span>ผู้ช่วยอัตโนมัติ คำตอบอาจคลาดเคลื่อน ไม่แทนคำแนะนำของเจ้าหน้าที่เกษตร</span>
          {draft.length > MAX - 80 && <span className="tabular-nums">{draft.length}/{MAX}</span>}
        </div>
      </form>
    </div>
    </>,
    document.body,
  );
}
