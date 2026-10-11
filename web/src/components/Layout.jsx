import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { adoptPreferences, useApplyPreferences } from '../lib/preferences';
import {
  Activity, Bell, BookOpen, BrainCircuit, ChevronRight, ClipboardCheck, Database, FileText, Files, History, LayoutDashboard, LogOut, Map,
  Megaphone, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, ScanLine, Search, Settings, Settings2, ShieldAlert, Siren, UserCheck, UserRound, Users,
} from 'lucide-react';
import CommandPalette from './admin/CommandPalette';
import { useAdminSignals } from './admin/signals';

const NAV = {
  farmer: [
    {
      group: '',
      items: [
        { to: '/app/scan', label: 'สแกนใบข้าว', icon: ScanLine },
        { to: '/app/history', label: 'ประวัติการวินิจฉัย', icon: History },
        { to: '/app/wiki', label: 'สารานุกรมโรค', icon: BookOpen },
        { to: '/app/outbreak', label: 'พื้นที่ระบาด', icon: Map },
        { to: '/app/profile', label: 'โปรไฟล์ / ตั้งค่า', icon: Settings },
      ],
    },
  ],
  researcher: [
    {
      group: 'ภาพรวม',
      items: [
        { to: '/research/dashboard', label: 'ภาพรวมงานวิจัย', icon: LayoutDashboard },
        { to: '/research/risk-map', label: 'แผนที่ความเสี่ยง', icon: Map },
      ],
    },
    {
      group: 'ข้อมูล',
      items: [
        { to: '/research/explorer', label: 'สำรวจและส่งออกข้อมูล', icon: Database },
      ],
    },
    {
      group: 'เครื่องมือ',
      items: [
        { to: '/research/scan', label: 'สแกนใบข้าว', icon: ScanLine },
        { to: '/research/wiki', label: 'สารานุกรมโรค', icon: BookOpen },
      ],
    },
    {
      group: 'บัญชี',
      items: [
        { to: '/research/account', label: 'บัญชีของฉัน', icon: UserRound, keywords: 'โปรไฟล์ รหัสผ่าน 2fa ธีม' },
      ],
    },
  ],
  admin: [
    {
      group: 'ภาพรวม',
      items: [
        { to: '/admin/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
        { to: '/admin/risk-map', label: 'แผนที่ความเสี่ยง', icon: Map },
        { to: '/admin/alerts', label: 'แจ้งเตือนการระบาด', icon: Siren, badgeTone: 'red', keywords: 'ประกาศ broadcast' },
      ],
    },
    {
      group: 'ข้อมูลและ AI',
      items: [
        { to: '/admin/reports', label: 'รายงานทั้งหมด', icon: Files },
        { to: '/admin/live-feed', label: 'คลังภาพ AI', icon: Activity },
        { to: '/admin/review', label: 'ตรวจทานผล AI', icon: ClipboardCheck, keywords: 'label ยืนยัน' },
        { to: '/admin/model', label: 'คุณภาพโมเดล AI', icon: BrainCircuit, keywords: 'accuracy ความแม่นยำ' },
        { to: '/admin/explorer', label: 'สำรวจและส่งออกข้อมูล', icon: Database },
      ],
    },
    {
      group: 'รายงานและเนื้อหา',
      items: [
        { to: '/admin/report', label: 'รายงานประจำเดือน', icon: FileText, keywords: 'pdf พิมพ์' },
        { to: '/admin/wiki', label: 'จัดการสารานุกรม', icon: BookOpen },
      ],
    },
    {
      group: 'ผู้ใช้และระบบ',
      items: [
        { to: '/admin/approvals', label: 'คำขออนุมัติ', icon: UserCheck, badgeTone: 'red' },
        { to: '/admin/users', label: 'จัดการผู้ใช้งาน', icon: Users },
        { to: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings2 },
        { to: '/admin/logs', label: 'บันทึกความปลอดภัย', icon: ShieldAlert },
        { to: '/admin/account', label: 'บัญชีของฉัน', icon: UserRound, keywords: 'โปรไฟล์ รหัสผ่าน 2fa ธีม' },
      ],
    },
  ],
};

const ACTIONS = {
  admin: [
    { label: 'ส่งประกาศถึงเกษตรกร', hint: 'ศูนย์แจ้งเตือนการระบาด', to: '/admin/alerts?compose=1', keywords: 'broadcast แจ้งเตือน' },
    { label: 'ตรวจทานผล AI ที่ไม่มั่นใจ', hint: 'คิวตรวจทาน', to: '/admin/review?tab=low' },
    { label: 'ออกรายงานประจำเดือน (PDF)', hint: 'รายงานประจำเดือน', to: '/admin/report' },
    { label: 'แก้ไขประกาศบนเว็บไซต์', hint: 'ตั้งค่าระบบ', to: '/admin/settings#announcement' },
    { label: 'ปรับเกณฑ์การแจ้งเตือน', hint: 'ตั้งค่าระบบ', to: '/admin/settings#alerts' },
  ],
  researcher: [],
  farmer: [],
};

const roleLabel = { farmer: 'เกษตรกร', researcher: 'นักวิชาการ', admin: 'ผู้ดูแลระบบ' };
const EMPTY_SIGNALS = { items: [], count: 0, badges: {} };

function SignalsBridge({ role, onChange }) {
  const s = useAdminSignals(role);
  useEffect(() => { onChange(s); }, [s, onChange]);
  return null;
}

function Badge({ n, tone, collapsed }) {
  if (!n) return null;
  if (collapsed) return <span className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-[#0f2a20] ${tone === 'red' ? 'bg-red-400' : 'bg-emerald-300'}`} />;
  return <span className={`ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold tabular-nums ${tone === 'red' ? 'bg-red-500 text-white' : 'bg-white/10 text-emerald-100'}`}>{n > 99 ? '99+' : n}</span>;
}

function SidebarContent({ user, groups, badges, currentRoleLabel, currentNavGroup, collapsed = false, onToggle, onNavigate, onLogout }) {
  return (
    <div className="flex h-full flex-col bg-[#0f2a20] text-white">
      <div className={`shrink-0 border-b border-white/10 ${collapsed ? 'px-3 py-4' : 'px-5 py-5'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-3'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'min-w-0 gap-3'}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xl shadow-black/20">
              <img src="/brand/logo_mark.svg" alt="Rice AI logo" className="h-full w-full object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display text-xl font-bold leading-none tracking-tight text-white">Rice AI</div>
                <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-200/75">Web Portal</div>
              </div>
            )}
          </div>
          {onToggle && !collapsed && (
            <button type="button" onClick={onToggle} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-50/80 transition-all hover:bg-white/10 hover:text-white" aria-label="ซ่อนเมนู" title="ซ่อนเมนู">
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>
        {onToggle && collapsed && (
          <button type="button" onClick={onToggle} className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-50/80 transition-all hover:bg-white/10 hover:text-white" aria-label="แสดงเมนู" title="แสดงเมนู">
            <PanelLeftOpen size={17} />
          </button>
        )}
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] ${collapsed ? 'px-3 py-3' : 'px-3 py-4'}`}>
        {groups.map((g, gi) => (
          <div key={g.group || gi} className={gi ? 'mt-4' : ''}>
            {g.group && (collapsed
              ? <div className="mx-auto mb-2 h-px w-8 bg-white/10" aria-hidden="true" />
              : <div className="mb-1.5 px-3 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-emerald-100/40">{g.group}</div>)}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const n = badges[item.to] || 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? `${item.label}${n ? ` (${n})` : ''}` : undefined}
                    onClick={onNavigate}
                    className={({ isActive }) => `group relative flex items-center rounded-xl text-[13px] font-bold transition-all duration-200 ${collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'} ${isActive ? 'bg-white/10 text-white shadow-inner shadow-white/5' : 'text-emerald-50/70 hover:bg-white/5 hover:text-white'}`}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${isActive ? 'bg-[var(--color-paddy)] text-white shadow-md shadow-black/20' : 'bg-transparent text-emerald-100/60 group-hover:bg-white/10 group-hover:text-white'}`}>
                          <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                        </span>
                        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                        <Badge n={n} tone={item.badgeTone} collapsed={collapsed} />
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`shrink-0 border-t border-white/10 bg-black/10 ${collapsed ? 'p-3' : 'p-4'}`}>
        {user?.role === 'admin' && (
          <button
            onClick={() => onNavigate(currentNavGroup === 'admin' ? '/research/dashboard' : '/admin/dashboard')}
            title={currentNavGroup === 'admin' ? 'สลับไปโหมดนักวิชาการ' : 'กลับไปโหมดผู้ดูแลระบบ'}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-emerald-50/85 transition-all hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={14} />
            {!collapsed && (currentNavGroup === 'admin' ? 'สลับไปโหมดนักวิชาการ' : 'กลับไปโหมดผู้ดูแลระบบ')}
          </button>
        )}
        <button onClick={onLogout} title="ออกจากระบบ" className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-emerald-50/80 transition-all hover:bg-red-500/15 hover:text-red-100">
          <LogOut size={14} />
          {!collapsed && 'ออกจากระบบ'}
        </button>
      </div>
    </div>
  );
}

const DOT = { red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-sky-500', gray: 'bg-gray-400' };

function BellMenu({ signals, isAdmin }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`การแจ้งเตือน ${signals.count} รายการ`} aria-expanded={open} className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/10 bg-white text-gray-600 shadow-sm transition hover:text-gray-950">
        <Bell size={18} />
        {signals.count > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-extrabold leading-[18px] text-white ring-2 ring-[var(--color-paper)]">{signals.count > 9 ? '9+' : signals.count}</span>}
      </button>
      {open && (
        <div className="rb-dialog absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-extrabold text-gray-950">สิ่งที่ต้องดำเนินการ</span>
            {signals.count > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-red-700">{signals.count}</span>}
          </div>
          {!signals.items.length ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">ไม่มีเรื่องที่ต้องดำเนินการ</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {signals.items.map((it) => (
                <li key={it.key}>
                  <Link to={it.to} className="flex gap-3 px-4 py-3 hover:bg-gray-50">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[it.tone]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-gray-900">{it.title}</span>
                      {it.body && <span className="block truncate text-xs text-gray-500">{it.body}</span>}
                    </span>
                    <ChevronRight size={15} className="mt-1 shrink-0 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {isAdmin && <Link to="/admin/alerts?view=history" className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs font-bold text-[var(--color-paddy)] hover:bg-gray-50"><Megaphone size={13} />ประวัติประกาศ</Link>}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('rb-sidebar') === '1'; } catch { return false; }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [signals, setSignals] = useState(EMPTY_SIGNALS);

  let currentNavGroup = user?.role;
  if (user?.role === 'admin') {
    if (location.pathname.startsWith('/research')) currentNavGroup = 'researcher';
    if (location.pathname.startsWith('/app')) currentNavGroup = 'farmer';
  }
  const groups = NAV[currentNavGroup] || [];
  const currentRoleLabel = roleLabel[currentNavGroup] || 'ระบบ';
  const portal = currentNavGroup === 'admin' || currentNavGroup === 'researcher';
  const flat = groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
  const accountPath = user?.role === 'admin' ? '/admin/account' : '/research/account';
  useApplyPreferences(portal);
  useEffect(() => { adoptPreferences(user?.preferences); }, [user?.preferences]);
  const current = flat.find((it) => location.pathname === it.to || location.pathname.startsWith(`${it.to}/`));

  useEffect(() => {
    try { localStorage.setItem('rb-sidebar', sidebarCollapsed ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!portal) return undefined;
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
      else if (e.key === '/' && !e.target.closest?.('input, textarea, select, [contenteditable]')) { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [portal]);

  useEffect(() => { document.title = current ? `${current.label} · Rice AI` : 'Rice AI'; }, [current]);

  const handleNavigate = (to) => {
    setMobileMenuOpen(false);
    if (typeof to === 'string') navigate(to);
  };
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const badges = signals.badges;
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  return (
    <div className="rb-shell flex h-screen overflow-hidden bg-[var(--color-paper)] font-sans text-gray-800">
      {currentNavGroup === 'admin' && <SignalsBridge role="admin" onChange={setSignals} />}
      <aside className={`rb-print-hide hidden h-full shrink-0 overflow-hidden border-r border-emerald-900/10 shadow-2xl transition-[width] duration-300 ease-out lg:block ${sidebarCollapsed ? 'w-[84px]' : 'w-72'}`}>
        <SidebarContent
          user={user}
          groups={groups}
          badges={badges}
          currentRoleLabel={currentRoleLabel}
          currentNavGroup={currentNavGroup}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </aside>

      {mobileMenuOpen && (
        <div className="rb-print-hide fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(86vw,320px)] overflow-hidden rounded-r-[28px] shadow-2xl shadow-black/30 rb-menu-pop">
            <SidebarContent user={user} groups={groups} badges={badges} currentRoleLabel={currentRoleLabel} currentNavGroup={currentNavGroup} onNavigate={handleNavigate} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="rb-print-hide relative z-30 flex min-h-16 shrink-0 items-center gap-3 border-b border-emerald-900/10 bg-[var(--color-paper)]/92 px-4 backdrop-blur-xl lg:px-8">
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/10 bg-white text-[var(--color-paddy)] shadow-sm lg:hidden" aria-label="เปิดเมนูระบบ">
            <Menu size={20} />
          </button>
          <img src="/brand/app_icon.svg" alt="" className="h-9 w-9 rounded-[0.7rem] lg:hidden" />
          <nav aria-label="breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              <li className="hidden shrink-0 font-bold text-gray-400 sm:block">{currentRoleLabel}</li>
              {current?.group && <><li className="hidden text-gray-300 sm:block"><ChevronRight size={14} /></li><li className="hidden shrink-0 font-bold text-gray-400 md:block">{current.group}</li><li className="hidden text-gray-300 md:block"><ChevronRight size={14} /></li></>}
              {!current?.group && current && <li className="hidden text-gray-300 sm:block"><ChevronRight size={14} /></li>}
              <li className="truncate font-extrabold text-gray-900">{current?.label || 'Rice AI'}</li>
            </ol>
          </nav>
          {portal && (
            <>
              <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-emerald-900/10 bg-white px-3 text-sm text-gray-400 shadow-sm transition hover:border-emerald-200 hover:text-gray-600 md:flex" aria-label="ค้นหา">
                <Search size={16} />
                <span className="flex-1 text-left">ค้นหาหรือสั่งงาน…</span>
                <span className="rb-kbd">{mac ? '⌘' : 'Ctrl'}</span><span className="rb-kbd">K</span>
              </button>
              <button type="button" onClick={() => setPaletteOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/10 bg-white text-gray-600 shadow-sm md:hidden" aria-label="ค้นหา"><Search size={18} /></button>
              {currentNavGroup === 'admin' && <BellMenu signals={signals} isAdmin />}
            </>
          )}
          <Link to={portal ? accountPath : '/app/profile'} title="บัญชีของฉัน" className="hidden items-center gap-2.5 rounded-xl border-l border-emerald-900/10 pl-3 transition hover:opacity-80 sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-paddy)] text-sm font-extrabold text-white">{(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</span>
            <span className="hidden min-w-0 xl:block">
              <span className="block max-w-[160px] truncate text-[13px] font-bold text-gray-900">{user?.full_name || user?.email || 'ผู้ใช้งาน'}</span>
              <span className="block text-[11px] font-bold text-gray-500">{roleLabel[user?.role] || user?.role}</span>
            </span>
          </Link>
        </header>

        <main className="h-full min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      {portal && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          role={currentNavGroup}
          pages={flat}
          actions={ACTIONS[currentNavGroup] || []}
        />
      )}
    </div>
  );
}
