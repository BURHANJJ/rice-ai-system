import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowRight, CornerDownLeft, MapPin, Search, User, Zap } from 'lucide-react';
import { db } from '../../lib/firebase';
import { ALL_PROVINCES } from '../../lib/provinces';

let usersCache = null;

/** Ctrl/⌘ + K: jump to any page, run common actions, find a user or a province. */
export default function CommandPalette({ open, onClose, pages, actions, role }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [users, setUsers] = useState(usersCache);
  const input = useRef(null);
  const list = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setI(0);
    setTimeout(() => input.current?.focus(), 0);
    if (role === 'admin' && !usersCache) {
      getDocs(collection(db, 'users')).then((snap) => {
        usersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(usersCache);
      }).catch(() => {});
    }
  }, [open, role]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const match = (s) => !t || s.toLowerCase().includes(t);
    const out = [];
    pages.filter((p) => match(`${p.label} ${p.group || ''} ${p.keywords || ''}`)).forEach((p) => out.push({ type: 'หน้า', icon: p.icon, label: p.label, hint: p.group, to: p.to }));
    actions.filter((a) => match(`${a.label} ${a.keywords || ''}`)).forEach((a) => out.push({ type: 'คำสั่ง', icon: Zap, label: a.label, hint: a.hint, to: a.to }));
    if (t) {
      if (role === 'admin') {
        (users || []).filter((u) => match(`${u.full_name || ''} ${u.email || ''} ${u.institution || ''}`)).slice(0, 6)
          .forEach((u) => out.push({ type: 'ผู้ใช้', icon: User, label: u.full_name || u.email, hint: u.email, to: `/admin/users?u=${u.id}` }));
      }
      ALL_PROVINCES.filter((p) => match(p)).slice(0, 5)
        .forEach((p) => out.push({ type: 'จังหวัด', icon: MapPin, label: `จ.${p}`, hint: role === 'admin' ? 'ส่งประกาศถึงจังหวัดนี้' : 'แผนที่ความเสี่ยง', to: role === 'admin' ? `/admin/alerts?compose=1&p=${encodeURIComponent(p)}` : '/research/risk-map' }));
    }
    return out;
  }, [q, pages, actions, users, role]);

  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' }); }, [i]);

  if (!open) return null;
  const go = (r) => { if (!r) return; onClose(); navigate(r.to); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); go(results[i]); }
    if (e.key === 'Escape') onClose();
  };

  let lastType = '';
  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center bg-gray-950/40 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="ค้นหาและคำสั่ง" onClick={(e) => e.stopPropagation()} className="rb-dialog w-full max-w-xl overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-black/5">
        <label className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search size={18} className="text-gray-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={role === 'admin' ? 'ค้นหาหน้า คำสั่ง ผู้ใช้ หรือจังหวัด…' : 'ค้นหาหน้า คำสั่ง หรือจังหวัด…'}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-400"
            role="combobox"
            aria-expanded="true"
            aria-controls="rb-cmd-list"
          />
          <span className="rb-kbd">Esc</span>
        </label>
        <ul ref={list} id="rb-cmd-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {!results.length && <li className="px-3 py-10 text-center text-sm text-gray-400">ไม่พบผลลัพธ์สำหรับ “{q}”</li>}
          {results.map((r, k) => {
            const head = r.type !== lastType;
            lastType = r.type;
            const Icon = r.icon;
            return (
              <li key={`${r.type}${r.to}${k}`}>
                {head && <div className="px-3 pb-1 pt-2 text-[11px] font-extrabold text-gray-400">{r.type}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={k === i}
                  data-on={k === i}
                  onMouseMove={() => setI(k)}
                  onClick={() => go(r)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${k === i ? 'bg-emerald-50 text-gray-950' : 'text-gray-700'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${k === i ? 'bg-[var(--color-paddy)] text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.label}</span>
                    {r.hint && <span className="block truncate text-[11px] text-gray-500">{r.hint}</span>}
                  </span>
                  {k === i ? <CornerDownLeft size={14} className="text-gray-400" /> : <ArrowRight size={14} className="text-gray-300" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/70 px-4 py-2 text-[11px] text-gray-500">
          <span className="rb-kbd">↑</span><span className="rb-kbd">↓</span> เลือก <span className="rb-kbd">Enter</span> เปิด
        </div>
      </div>
    </div>
  );
}
