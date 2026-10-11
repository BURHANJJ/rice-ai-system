import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, orderBy, startAfter, where, documentId, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Download } from 'lucide-react';
import { downloadCSV, stamp } from '../../lib/exporters';
import { Btn, PageHeader } from '../../components/admin/ui';
import { Shield, ShieldAlert, AlertTriangle, Info, Loader2, ChevronDown, ChevronLeft, ChevronRight, Search, Activity, User, Clock, TerminalSquare } from 'lucide-react';

const ITEMS_PER_PAGE = 15;

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Pagination & Count State
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState([null]); 
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  // Users cache
  const [usersCache, setUsersCache] = useState({});

  const fetchUsersForLogs = async (logsList) => {
    const missingUserIds = [...new Set(logsList
      .map(l => l.user_id)
      .filter(id => id && !usersCache[id] && id !== 'system')
    )];

    if (missingUserIds.length === 0) return;

    const newUsers = {};
    for (let i = 0; i < missingUserIds.length; i += 10) {
      const chunk = missingUserIds.slice(i, i + 10);
      const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
      const snap = await getDocs(q);
      snap.forEach(doc => {
        newUsers[doc.id] = doc.data();
      });
    }

    setUsersCache(prev => ({ ...prev, ...newUsers }));
  };

  const [exporting, setExporting] = useState(false);
  const exportCSV = async () => {
    setExporting(true);
    try {
      const snap = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(1000)));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data(), date: d.data().timestamp?.toDate?.() || null }));
      await fetchUsersForLogs(rows);
      downloadCSV(`rice-ai-audit-${stamp()}`, [
        { label: 'เวลา', value: (l) => l.date?.toLocaleString('th-TH') },
        { label: 'ระดับ', value: 'severity' },
        { label: 'กิจกรรม', value: 'activity' },
        { label: 'รายละเอียด', value: 'details' },
        { label: 'ผู้ดำเนินการ (UID)', value: 'user_id' },
      ], rows, 'บันทึกเหตุการณ์ระบบ');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async (targetPage = 1, isNewFilter = false) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      let currentCursors = pageCursors;

      // 1. Fetch total count if it's a new filter or initial load
      if (isNewFilter) {
        const countQuery = severityFilter 
          ? query(collection(db, 'audit_logs'), where(severityFilter === 'export' ? 'category' : 'severity', '==', severityFilter)) 
          : collection(db, 'audit_logs');
          
        const snapCount = await getCountFromServer(countQuery);
        const count = snapCount.data().count;
        setTotalItems(count);
        currentCursors = [null]; // reset cursors
        setPageCursors(currentCursors);
        targetPage = 1;
      }

      if (targetPage > currentCursors.length) {
        targetPage = currentCursors.length;
      }

      // 2. Build Data Query
      let qArgs = [collection(db, 'audit_logs')];
      
      // If filtering, drop orderBy to avoid Firebase index error
      if (severityFilter) {
        qArgs.push(where(severityFilter === 'export' ? 'category' : 'severity', '==', severityFilter));
      } else {
        qArgs.push(orderBy('timestamp', 'desc'));
      }
      
      qArgs.push(limit(ITEMS_PER_PAGE));

      const cursor = currentCursors[targetPage - 1];
      if (cursor) {
        qArgs.push(startAfter(cursor));
      }

      const q = query(...qArgs);
      const snap = await getDocs(q);
      
      const fetchedData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp || doc.data().log_time || Date.now())
      }));

      await fetchUsersForLogs(fetchedData);
      setLogs(fetchedData);
      setPage(targetPage);

      // 3. Save the cursor for the NEXT page
      if (snap.docs.length === ITEMS_PER_PAGE) {
        const nextCursor = snap.docs[snap.docs.length - 1];
        setPageCursors(prev => {
          const newCursors = [...prev];
          newCursors[targetPage] = nextCursor; 
          return newCursors;
        });
      }

    } catch (err) {
      console.error("Error fetching logs:", err);
      if (err.message.includes('index')) {
        setErrorMsg("ฐานข้อมูลต้องการ Index พิเศษสำหรับการกรองข้อมูลนี้ กรุณาติดต่อผู้ดูแลระบบ Firebase");
      } else {
        setErrorMsg("เกิดข้อผิดพลาดในการดึงข้อมูล: " + err.message);
      }
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  useEffect(() => {
    loadData(1, true);
    // eslint-disable-next-line
  }, []);

  const handleApplyFilter = () => {
    setIsFiltering(true);
    loadData(1, true);
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200"><ShieldAlert size={12} /> CRITICAL</span>;
      case 'warning':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-orange-50 text-orange-700 border-orange-200"><AlertTriangle size={12} /> WARNING</span>;
      case 'info':
      default:
        return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200"><Info size={12} /> INFO</span>;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startItem = totalItems === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <PageHeader
        icon={Shield}
        eyebrow="Security"
        title="บันทึกความปลอดภัย"
        desc="บันทึกทุกกิจกรรมสำคัญในระบบ เช่น การเปลี่ยนสิทธิ์ การอนุมัติ การส่งประกาศ และการแก้ไขการตั้งค่า"
        actions={<Btn icon={Download} busy={exporting} onClick={exportCSV}>ส่งออก CSV (1,000 รายการล่าสุด)</Btn>}
      />

      {/* Filter Section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-gray-500 text-sm font-medium mr-2">ระดับความสำคัญ (Severity):</span>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {[
              { id: '', label: 'ทั้งหมด' },
              { id: 'info', label: 'Info' },
              { id: 'warning', label: 'Warning' },
              { id: 'critical', label: 'Critical' },
              { id: 'export', label: 'ประวัติส่งออก' }
            ].map((s) => (
              <button 
                key={s.id} 
                onClick={() => setSeverityFilter(s.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  severityFilter === s.id 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          onClick={handleApplyFilter} 
          disabled={loading || isFiltering}
          className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm disabled:opacity-70"
        >
          {isFiltering ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          ค้นหาบันทึก
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
          <ShieldAlert className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">ระดับ (Severity)</th>
                <th className="px-6 py-4">ผู้กระทำ (Actor / IP)</th>
                <th className="px-6 py-4 w-1/2">รายละเอียดกิจกรรม (Activity Details)</th>
                <th className="px-6 py-4">วันเวลา (Timestamp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="animate-spin text-gray-300" />
                      <p>กำลังโหลดบันทึกความปลอดภัย...</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Shield size={48} className="opacity-20 text-green-500" strokeWidth={1} />
                      <h3 className="text-gray-900 font-medium text-lg mt-2">ไม่พบเหตุการณ์ด้านความปลอดภัย</h3>
                      <p className="text-sm">ระบบปลอดภัย ไม่มีบันทึกในหมวดหมู่นี้ หรือยังไม่มีการเขียนข้อมูลจริงเข้ามา</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((l, idx) => {
                  const user = usersCache[l.user_id];
                  
                  return (
                    <tr key={l.id || idx} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getSeverityBadge(l.severity)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                            {l.user_id === 'system' ? <TerminalSquare size={14} /> : <User size={14} />}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-xs">
                              {l.user_id === 'system' ? 'SYSTEM' : (user?.full_name || l.user_id || 'Unknown')}
                            </div>
                            {(user?.email || l.ip_address) && (
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-[150px]">
                                {user?.email || l.ip_address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800 break-words">
                          {l.activity}
                        </div>
                        {l.details && (
                          <div className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 p-2 rounded border border-gray-100">
                            {l.details}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col justify-center text-gray-600">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                            <Clock size={12} className="text-gray-400" />
                            {l.date?.toLocaleTimeString('th-TH')}
                          </div>
                          <div className="text-[10px] text-gray-500 ml-4">
                            {l.date?.toLocaleDateString('th-TH')}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Enterprise Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="text-sm text-gray-500 mb-4 sm:mb-0">
            แสดง <span className="font-semibold text-gray-900">{startItem}</span> ถึง <span className="font-semibold text-gray-900">{endItem}</span> จากทั้งหมด <span className="font-semibold text-gray-900">{totalItems}</span> รายการ
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              disabled={page === 1 || loading}
              onClick={() => loadData(page - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft size={16} /> ก่อนหน้า
            </button>
            
            <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm">
              หน้า {page} / {totalPages}
            </div>
            
            <button 
              disabled={page >= totalPages || loading}
              onClick={() => loadData(page + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              ถัดไป <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
