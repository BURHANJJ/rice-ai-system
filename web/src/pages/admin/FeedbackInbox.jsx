import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { CheckCheck, Clock3, ExternalLink, Inbox, Mail, MessageSquareText, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { logAudit } from '../../lib/audit';
import { Btn, ConfirmDialog, Drawer, EmptyState, ErrorNote, Kpi, PageHeader, Pill, Segmented, inputCls, useToast } from '../../components/admin/ui';

const STATUS = {
  new: { label: 'ใหม่', tone: 'red' },
  reviewing: { label: 'กำลังพิจารณา', tone: 'amber' },
  resolved: { label: 'ดำเนินการแล้ว', tone: 'green' },
  closed: { label: 'ปิดเรื่อง', tone: 'gray' },
};
const CATEGORY = {
  suggestion: { label: 'ข้อเสนอแนะ', tone: 'blue' },
  issue: { label: 'ปัญหาการใช้งาน', tone: 'amber' },
  data: { label: 'ข้อมูล / ผล AI', tone: 'red' },
  other: { label: 'อื่น ๆ', tone: 'gray' },
};
const dateOf = (value) => value?.toDate?.() || (value instanceof Date ? value : null);
const dateLabel = (value) => dateOf(value)?.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) || 'กำลังบันทึกเวลา…';

export default function FeedbackInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [nextStatus, setNextStatus] = useState('new');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => onSnapshot(
    query(collection(db, 'feedback'), orderBy('created_at', 'desc'), limit(500)),
    (snapshot) => {
      setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      setLoading(false);
      setError('');
    },
    () => {
      setError('ไม่สามารถโหลดข้อเสนอแนะได้ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ Firestore');
      setLoading(false);
    },
  ), [refreshKey]);

  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter((item) => item.status === 'new').length,
    reviewing: items.filter((item) => item.status === 'reviewing').length,
    resolved: items.filter((item) => item.status === 'resolved').length,
    closed: items.filter((item) => item.status === 'closed').length,
  }), [items]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('th');
    return items.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!term) return true;
      return [item.subject, item.message, item.full_name, item.email, item.category]
        .some((value) => String(value || '').toLocaleLowerCase('th').includes(term));
    });
  }, [items, filter, search]);
  const active = items.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!active) return;
    setNextStatus(active.status || 'new');
    setAdminNote(active.admin_note || '');
  }, [active?.id]);

  const openItem = (item) => {
    setSelectedId(item.id);
    setNextStatus(item.status || 'new');
    setAdminNote(item.admin_note || '');
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'feedback', active.id), {
        status: nextStatus,
        admin_note: adminNote.trim().slice(0, 3000),
        updated_at: serverTimestamp(),
        updated_by: user?.full_name || user?.email || user?.uid || 'ผู้ดูแลระบบ',
      });
      await logAudit(user, 'จัดการข้อเสนอแนะ', 'info', `${active.id} · ${active.status} → ${nextStatus}`);
      showToast('บันทึกการดำเนินการแล้ว');
    } catch (err) {
      console.error('Feedback update failed:', err);
      showToast('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await logAudit(user, 'ลบข้อเสนอแนะ', 'warning', active.id);
      await deleteDoc(doc(db, 'feedback', active.id));
      setConfirmDelete(false);
      setSelectedId('');
      showToast('ลบข้อเสนอแนะแล้ว');
    } catch (err) {
      console.error('Feedback deletion failed:', err);
      showToast('ลบไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-8">
      <PageHeader icon={MessageSquareText} eyebrow="รับฟังผู้ใช้" title="ข้อเสนอแนะและแจ้งปัญหา" desc="รวบรวมข้อเสนอแนะ ปัญหาการใช้งาน และรายงานข้อมูลผิดพลาด พร้อมติดตามสถานะการดำเนินงานจากศูนย์กลาง" actions={<Btn icon={RefreshCw} onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }}>รีเฟรช</Btn>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Inbox} tone="blue" label="รายการที่โหลด" value={counts.all.toLocaleString()} sub="สูงสุด 500 รายการล่าสุด" loading={loading} />
        <Kpi icon={MessageSquareText} tone="red" label="รายการใหม่" value={counts.new.toLocaleString()} sub="รอผู้ดูแลตรวจสอบ" loading={loading} />
        <Kpi icon={Clock3} tone="amber" label="กำลังพิจารณา" value={counts.reviewing.toLocaleString()} sub="อยู่ระหว่างดำเนินการ" loading={loading} />
        <Kpi icon={CheckCheck} tone="green" label="ดำเนินการแล้ว" value={counts.resolved.toLocaleString()} sub="ปิดงานเรียบร้อย" loading={loading} />
      </div>

      <section className="overflow-hidden rounded-[22px] border border-emerald-900/10 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-extrabold text-gray-900">กล่องรับข้อเสนอแนะ</h2><p className="mt-1 text-xs text-gray-500">แสดงรายการล่าสุดสูงสุด 500 รายการ · คลิกเพื่อดูรายละเอียดและบันทึกการดำเนินการ</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block sm:w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputCls} pl-9`} placeholder="ค้นหาหัวข้อ รายละเอียด หรืออีเมล" /></label>
            <Segmented value={filter} onChange={setFilter} options={[
              { value: 'all', label: 'ทั้งหมด', count: counts.all },
              { value: 'new', label: 'ใหม่', count: counts.new },
              { value: 'reviewing', label: 'กำลังพิจารณา', count: counts.reviewing },
              { value: 'resolved', label: 'ดำเนินการแล้ว', count: counts.resolved },
              { value: 'closed', label: 'ปิดเรื่อง', count: counts.closed },
            ]} />
          </div>
        </div>

        <ErrorNote>{error}</ErrorNote>
        {loading ? <div className="p-10 text-center text-sm text-gray-500">กำลังโหลดข้อเสนอแนะ…</div> : error ? <div className="p-10 text-center text-sm text-gray-500">ไม่สามารถแสดงรายการได้ในขณะนี้</div> : visibleItems.length === 0 ? (
          <EmptyState icon={Inbox} title={search || filter !== 'all' ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีข้อเสนอแนะ'} desc={search || filter !== 'all' ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'เมื่อมีผู้ส่งข้อเสนอแนะ รายการจะปรากฏในหน้านี้'} />
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleItems.map((item) => {
              const status = STATUS[item.status] || STATUS.new;
              const category = CATEGORY[item.category] || CATEGORY.other;
              return <button key={item.id} type="button" onClick={() => openItem(item)} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-emerald-50/40 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><Pill tone={status.tone}>{status.label}</Pill><Pill tone={category.tone}>{category.label}</Pill><span className="text-[11px] text-gray-400">{dateLabel(item.created_at)}</span></span>
                  <span className="mt-2 block truncate text-sm font-extrabold text-gray-900">{item.subject || 'ไม่มีหัวข้อ'}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-gray-500">{item.message}</span>
                </span>
                <span className="flex items-center justify-between gap-3 text-xs text-gray-500 lg:justify-end"><span>{item.full_name || 'ไม่ระบุชื่อ'}{item.email ? ` · ${item.email}` : ''}</span><ExternalLink size={14} className="shrink-0 text-gray-400" /></span>
              </button>;
            })}
          </div>
        )}
      </section>

      <Drawer open={!!active} onClose={() => setSelectedId('')} title={active?.subject || 'รายละเอียดข้อเสนอแนะ'} subtitle={active ? `${CATEGORY[active.category]?.label || 'อื่น ๆ'} · รับเมื่อ ${dateLabel(active.created_at)}` : ''} width="sm:max-w-[620px]" footer={<><Btn onClick={() => setSelectedId('')}>ปิด</Btn><Btn icon={CheckCheck} variant="primary" busy={saving} onClick={save}>บันทึกการดำเนินการ</Btn></>}>
        {active && <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2"><Pill tone={(STATUS[active.status] || STATUS.new).tone}>{(STATUS[active.status] || STATUS.new).label}</Pill><Pill tone={(CATEGORY[active.category] || CATEGORY.other).tone}>{(CATEGORY[active.category] || CATEGORY.other).label}</Pill></div>
          <section><h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">รายละเอียดจากผู้ใช้</h3><p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-7 text-gray-800 ring-1 ring-gray-100">{active.message}</p></section>
          <section className="grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2">
            <div><div className="text-[11px] font-bold text-gray-400">ชื่อผู้ติดต่อ</div><div className="mt-1 text-sm font-semibold text-gray-800">{active.full_name || 'ไม่ระบุ'}</div></div>
            <div><div className="text-[11px] font-bold text-gray-400">อีเมล</div><div className="mt-1 break-all text-sm font-semibold text-gray-800">{active.email || 'ไม่ระบุ'}</div></div>
            <div><div className="text-[11px] font-bold text-gray-400">หน้าที่ส่งเรื่อง</div><div className="mt-1 text-sm text-gray-700">{active.source_path || 'ไม่ระบุ'}</div></div>
            <div><div className="text-[11px] font-bold text-gray-400">รหัสรายการ</div><div className="mt-1 font-mono text-xs text-gray-700">{active.id}</div></div>
          </section>
          {active.email && <a href={`mailto:${active.email}?subject=${encodeURIComponent(`Rice AI: ${active.subject || 'ข้อเสนอแนะ'}`)}`} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"><Mail size={14} />ตอบกลับทางอีเมล</a>}
          <label className="block"><span className="mb-1.5 block text-xs font-extrabold text-gray-700">สถานะการดำเนินงาน</span><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className={inputCls}>{Object.entries(STATUS).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-xs font-extrabold text-gray-700">บันทึกภายในสำหรับทีมผู้ดูแล</span><textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} maxLength={3000} rows={4} className={`${inputCls} resize-y`} placeholder="บันทึกผลตรวจสอบหรือขั้นตอนที่ดำเนินการ (ผู้ส่งเรื่องไม่เห็นข้อความนี้)" /><span className="mt-1 block text-right text-[11px] text-gray-400">{adminNote.length}/3000</span></label>
          {active.updated_by && <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><ShieldCheck size={13} />อัปเดตล่าสุดโดย {active.updated_by} · {dateLabel(active.updated_at)}</p>}
          <div className="border-t border-red-100 pt-4"><Btn variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>ลบรายการตามคำขอ</Btn><p className="mt-1.5 text-[11px] leading-5 text-gray-400">ใช้เมื่อต้องลบข้อมูลตามคำขอของผู้ส่ง หรือลบรายการซ้ำ/ไม่เหมาะสม</p></div>
        </div>}
      </Drawer>
      <ConfirmDialog open={confirmDelete} busy={saving} tone="danger" title="ลบข้อเสนอแนะนี้ถาวร?" desc="ข้อมูลและบันทึกภายในของรายการนี้จะถูกลบ และไม่สามารถกู้คืนได้ การลบจะถูกบันทึกใน Audit log" confirmLabel="ลบรายการถาวร" onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
      {toast}
    </div>
  );
}
