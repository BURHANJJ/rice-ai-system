import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PageHeader, Pill } from '../../components/admin/ui';
import { useAuth } from '../../lib/AuthContext';
import { UserCheck, Loader2, ShieldCheck, XCircle, AlertCircle, CheckCircle, ShieldAlert, Mail, Building, Clock, FileBadge, FileText } from 'lucide-react';

export default function PendingResearchers() {
  const { user: currentUser } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const logAudit = async (activity, severity, details = '') => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        activity,
        severity,
        details,
        user_id: currentUser?.uid || currentUser?.email || 'system_admin',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Audit log failed:", err);
    }
  };

  const loadPending = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'researcher'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      setErrorMsg("ดึงข้อมูลคำขอไม่สำเร็จ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleAction = async (targetUser, newStatus) => {
    if (!window.confirm(`ยืนยันการ${newStatus === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอของ ${targetUser.email} หรือไม่?`)) return;
    
    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'users', targetUser.id), { status: newStatus });
      await logAudit(
        `${newStatus === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอนักวิชาการ`,
        newStatus === 'active' ? 'info' : 'warning',
        `เป้าหมาย (Target): ${targetUser.email || targetUser.id}`
      );
      showToast(`${newStatus === 'active' ? 'อนุมัติ' : 'ปฏิเสธ'}สำเร็จ`);
      setPendingUsers(prev => prev.filter(u => u.id !== targetUser.id));
    } catch (err) {
      showToast("ดำเนินการไม่สำเร็จ: " + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10 relative min-h-screen">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border ${
          toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-gray-900 text-white border-gray-800'
        }`}>
          {toast.type === 'error' ? <ShieldAlert size={20} className="text-red-500" /> : <CheckCircle size={20} className="text-green-400" />}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      <PageHeader
        icon={UserCheck}
        eyebrow="Approvals"
        title="คำขออนุมัตินักวิชาการ"
        desc="ตรวจสอบข้อมูล วัตถุประสงค์ และหน่วยงานของผู้สมัคร ก่อนอนุมัติสิทธิ์เข้าใช้เว็บพอร์ทัล"
        actions={<Pill tone={pendingUsers.length ? 'amber' : 'green'} icon={Clock}>รออนุมัติ {pendingUsers.length} รายการ</Pill>}
      />

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center text-gray-400 gap-4">
          <Loader2 size={40} className="animate-spin text-[var(--color-gold)]" />
          <p className="font-medium">กำลังโหลดคำขอใหม่...</p>
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 flex flex-col items-center justify-center text-gray-400 gap-4">
          <FileBadge size={64} className="opacity-20 text-gray-500" strokeWidth={1} />
          <h3 className="text-gray-900 font-medium text-xl mt-2">ยังไม่มีคำขอใหม่</h3>
          <p className="text-sm">นักวิชาการทุกคนในระบบได้รับการพิจารณาเรียบร้อยแล้ว</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {pendingUsers.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-6 flex flex-col sm:flex-row gap-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-gold)]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-paddy-light)] border border-[var(--color-paddy)]/30 flex items-center justify-center text-[var(--color-paddy-dark)] font-bold text-2xl shrink-0 shadow-sm relative z-10">
                {u.full_name?.charAt(0) || u.email?.charAt(0) || 'R'}
              </div>
              
              <div className="flex-1 relative z-10">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-lg text-gray-900">{u.full_name || 'ไม่ระบุชื่อ (No Name)'}</h3>
                  <span className="text-[10px] font-bold tracking-widest text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase">Pending</span>
                </div>
                
                <div className="space-y-2 mb-6 mt-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} className="text-gray-400 shrink-0" /> 
                    <span className="font-mono truncate">{u.email || u.username || 'No Email'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building size={14} className="text-gray-400 shrink-0" /> 
                    <span className="truncate">{u.institution || 'ไม่ได้ระบุสถาบัน/สังกัด'}</span>
                  </div>
                </div>

                {/* Access Purpose Block */}
                <div className="mb-6 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    <FileText size={12} /> วัตถุประสงค์การเข้าถึง
                  </div>
                  <p className="text-sm text-gray-700 italic break-words">
                    "{u.access_purpose || 'ไม่ได้ระบุวัตถุประสงค์'}"
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => handleAction(u, 'active')}
                    disabled={actionLoading}
                    className="flex-1 inline-flex justify-center items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50"
                  >
                    <ShieldCheck size={16} /> อนุมัติเข้าระบบ
                  </button>
                  <button 
                    onClick={() => handleAction(u, 'rejected')}
                    disabled={actionLoading}
                    className="flex-1 inline-flex justify-center items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-600 font-semibold transition-all border border-gray-200 hover:border-red-200 shadow-sm disabled:opacity-50"
                  >
                    <XCircle size={16} /> ปฏิเสธคำขอ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
