import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, Filter, Loader2, AlertCircle, ChevronDown, Activity, User, MapPin, Calendar, Target, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ALL_PROVINCES } from '../../lib/provinces';
import { ClipboardCheck, Download, Files } from 'lucide-react';
import { downloadCSV, stamp } from '../../lib/exporters';
import { Btn, PageHeader } from '../../components/admin/ui';

const LABEL_MAP = {
  'BLAST': 'โรคไหม้ (Rice Blast)',
  'BLB': 'โรคขอบใบแห้ง (Bacterial Leaf Blight)',
  'TUNGRO': 'โรคใบสีส้ม (Rice Tungro Virus)',
  'HEALTHY': 'ใบข้าวปกติ (Healthy Rice Leaf)'
};

const ITEMS_PER_PAGE = 15;

export default function AllReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({ disease_code: '', province: '', date_from: '', date_to: '' });
  
  // Pagination State
  const [page, setPage] = useState(1);

  // Lightbox State
  const [selectedImage, setSelectedImage] = useState(null);

  const getImageUrl = (data) => {
    const path = data.image_base64 || data.image_url;
    if (!path) return 'https://placehold.co/600x400/f1f5f9/94a3b8?text=No+Image';
    if (path.startsWith('http') || path.startsWith('data:image')) return path;
    return `data:image/jpeg;base64,${path}`;
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Fetch up to 1000 recent records to allow complex client-side filtering without Firestore composite index errors
      const q = query(collection(db, 'diagnoses'), orderBy('diag_date', 'desc'), limit(1000));
      const snap = await getDocs(q);
      
      const fetchedData = snap.docs.map(doc => {
        const data = doc.data();
        const prov = data.location?.province ? data.location.province.replace('จ.', '').trim() : 'ไม่ระบุพิกัด';
        return {
          id: doc.id,
          ...data,
          province: prov,
          date: data.diag_date?.toDate ? data.diag_date.toDate() : new Date(data.diag_date || Date.now())
        }
      });

      setReports(fetchedData);
    } catch (err) {
      console.error("Error fetching reports:", err);
      setErrorMsg("เกิดข้อผิดพลาดในการดึงข้อมูล: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getConfidenceColor = (conf) => {
    if (!conf) return 'bg-gray-100 text-gray-700 border-gray-200';
    if (conf >= 90) return 'bg-green-50 text-green-700 border-green-200';
    if (conf >= 70) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (conf >= 50) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  // Apply filters client-side
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (filters.disease_code && r.disease_code !== filters.disease_code) return false;
      if (filters.province && r.province !== filters.province) return false;
      if (filters.date_from) {
        const fromD = new Date(filters.date_from);
        fromD.setHours(0,0,0,0);
        if (r.date < fromD) return false;
      }
      if (filters.date_to) {
        const toD = new Date(filters.date_to);
        toD.setHours(23,59,59,999);
        if (r.date > toD) return false;
      }
      return true;
    });
  }, [reports, filters]);

  const exportCSV = () => downloadCSV(`rice-ai-reports-${stamp()}`, [
    { label: 'รหัสผลสแกน', value: 'id' },
    { label: 'วันเวลา', value: (r) => r.date?.toLocaleString('th-TH') },
    { label: 'ผลวินิจฉัย', value: (r) => LABEL_MAP[r.disease_code] || r.disease_name || r.disease_code },
    { label: 'รหัสโรค', value: 'disease_code' },
    { label: 'ความมั่นใจ (%)', value: (r) => (r.confidence ? r.confidence.toFixed(1) : '') },
    { label: 'จังหวัด', value: 'province' },
    { label: 'ละติจูด', value: (r) => r.location?.latitude ?? '' },
    { label: 'ลองจิจูด', value: (r) => r.location?.longitude ?? '' },
    { label: 'ผู้ใช้ (UID)', value: 'user_id' },
  ], filteredReports, 'รายงานผลวินิจฉัยทั้งหมด');

  // Client-side pagination logic
  const totalItems = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  
  // Ensure current page is valid after filter changes
  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages));
  }, [totalPages, page]);

  const currentReports = filteredReports.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const startItem = totalItems === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <PageHeader
        icon={Files}
        eyebrow="Verified source"
        title="รายงานการวินิจฉัย"
        desc="ประวัติการวิเคราะห์โรคทั้งหมดจากการสแกนใบข้าวของเกษตรกรผ่านแอปพลิเคชัน ข้อมูลจริงแบบเรียลไทม์"
        actions={(
          <>
            <Btn icon={ClipboardCheck} to="/admin/review">ตรวจทานผล AI</Btn>
            <Btn variant="primary" icon={Download} disabled={!filteredReports.length} onClick={exportCSV}>ส่งออก CSV ({filteredReports.length.toLocaleString()})</Btn>
          </>
        )}
      />

      {/* Modern Filter Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Filter size={16} /> กรองข้อมูลอัจฉริยะ (Smart Filter)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ประเภทโรค</label>
            <div className="relative">
              <select value={filters.disease_code} onChange={(e) => setFilters({ ...filters, disease_code: e.target.value })} className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none appearance-none transition-all">
                <option value="">ทุกประเภทโรค</option>
                {Object.entries(LABEL_MAP).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">จังหวัด (Province)</label>
            <div className="relative">
              <select value={filters.province} onChange={(e) => setFilters({ ...filters, province: e.target.value })} className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none appearance-none transition-all">
                <option value="">ทุกจังหวัด</option>
                {ALL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ตั้งแต่ (From)</label>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ถึง (To)</label>
            <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all" />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">ผู้ใช้งาน</th>
                <th className="px-6 py-4">ผลการวินิจฉัย</th>
                <th className="px-6 py-4">ความแม่นยำ (AI)</th>
                <th className="px-6 py-4">พื้นที่สแกน</th>
                <th className="px-6 py-4">วันเวลาที่บันทึก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="animate-spin text-gray-300" />
                      <p>กำลังโหลดข้อมูล...</p>
                    </div>
                  </td>
                </tr>
              ) : currentReports.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Activity size={32} className="opacity-20" />
                      <p>ไม่พบข้อมูลการสแกนตามเงื่อนไขที่กำหนด</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentReports.map((r, idx) => {
                  const confidence = r.confidence ? r.confidence.toFixed(1) : 0;
                  
                  return (
                    <tr key={r.id || idx} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                            <User size={16} />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">ผู้ใช้ระบบ</div>
                            <div className="text-xs text-gray-500 font-mono truncate max-w-[150px]">UID: {r.user_id?.substring(0,8) || 'Unknown'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setSelectedImage(r)}
                            className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 hover:border-[var(--color-paddy)] hover:ring-2 hover:ring-[var(--color-paddy)]/20 transition-all shrink-0 cursor-pointer shadow-sm relative group/btn bg-gray-100"
                            title="คลิกเพื่อดูรูปภาพเต็ม"
                          >
                            <img src={getImageUrl(r)} alt="Scan" className="w-full h-full object-cover group-hover/btn:scale-110 transition-transform duration-500" onError={(e) => e.target.src = 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Image+Not+Found'} />
                            <div className="absolute inset-0 bg-black/0 group-hover/btn:bg-black/20 transition-colors flex items-center justify-center">
                              <Search size={16} className="text-white opacity-0 group-hover/btn:opacity-100 drop-shadow-md" />
                            </div>
                          </button>
                          <div className="font-medium text-gray-900">
                            {LABEL_MAP[r.disease_code] || r.disease_name || r.disease_code || 'ไม่ทราบโรค'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Target size={14} className="text-gray-400" />
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getConfidenceColor(r.confidence)}`}>
                            {confidence}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="truncate max-w-[150px]" title={r.province}>
                            {r.province}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar size={14} className="text-gray-400" />
                          <span>{r.date?.toLocaleString('th-TH') || '-'}</span>
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
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft size={16} /> ก่อนหน้า
            </button>
            
            <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm">
              หน้า {page} / {totalPages}
            </div>
            
            <button 
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              ถัดไป <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-gray-800 text-lg">
                ภาพถ่ายการวิเคราะห์: <span className="text-[var(--color-paddy-dark)]">{LABEL_MAP[selectedImage.disease_code] || selectedImage.disease_name}</span>
              </h3>
              <button 
                onClick={() => setSelectedImage(null)}
                className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors border border-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-black p-4 md:p-8 flex items-center justify-center min-h-[400px] max-h-[80vh] overflow-hidden relative">
              <img 
                src={getImageUrl(selectedImage)} 
                alt="Scan Full" 
                className="max-w-full max-h-[75vh] object-contain rounded shadow-lg"
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t flex flex-wrap gap-4 items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-gray-400" /> ความแม่นยำ: <span className="font-bold text-gray-900">{selectedImage.confidence ? selectedImage.confidence.toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" /> พิกัด: <span className="font-medium text-gray-900">{selectedImage.province || 'ไม่ระบุ'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
