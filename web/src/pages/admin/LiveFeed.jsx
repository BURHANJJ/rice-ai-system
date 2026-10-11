import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Filter, ChevronDown, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ALL_PROVINCES } from '../../lib/provinces';
import { ClipboardCheck, Download, Images, RefreshCw } from 'lucide-react';
import { downloadCSV, stamp } from '../../lib/exporters';
import { Btn, PageHeader } from '../../components/admin/ui';

const DISEASE_NAMES = {
  'BLAST': 'โรคไหม้ (Rice Blast)',
  'BLB': 'โรคขอบใบแห้ง (Bacterial Leaf Blight)',
  'TUNGRO': 'โรคใบสีส้ม (Rice Tungro Virus)',
  'BROWN_SPOT': 'โรคใบจุดสีน้ำตาล (Brown Spot)',
  'NARROW_BROWN_SPOT': 'โรคใบขีดสีน้ำตาล (Narrow Brown Spot)',
  'BAKANA': 'โรคหลาว (Bakanae)',
  'GRASSY_STUNT': 'โรคใบหงิก (Grassy Stunt)',
  'RAGGED_STUNT': 'โรคจู๋ (Ragged Stunt)',
  'SHEATH_BLIGHT': 'โรคกาบใบแห้ง (Sheath Blight)',
  'HEALTHY': 'ใบข้าวปกติ (Healthy Rice Leaf)'
};

const DISEASE_COLORS = {
  'BLAST': 'text-rose-500 bg-rose-50 border-rose-100',
  'BLB': 'text-orange-500 bg-orange-50 border-orange-100',
  'TUNGRO': 'text-amber-500 bg-amber-50 border-amber-100',
  'HEALTHY': 'text-emerald-500 bg-emerald-50 border-emerald-100',
  'DEFAULT': 'text-slate-500 bg-slate-50 border-slate-100'
};

export default function ImageGallery() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Smart Filters
  const [filters, setFilters] = useState({ disease_code: '', province: '', date_from: '', date_to: '' });
  
  // Pagination
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 16;
  
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchRealData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'diagnoses'), orderBy('diag_date', 'desc'), limit(1000));
      const snapshot = await getDocs(q);
      
      const realData = snapshot.docs.map(doc => {
        const data = doc.data();
        const prov = data.location?.province ? data.location.province.replace('จ.', '').trim() : 'ไม่ระบุพิกัด';
        return {
          diag_id: doc.id,
          disease_code: data.disease_code || 'UNKNOWN',
          disease_name: data.disease_name || DISEASE_NAMES[data.disease_code] || 'Unknown',
          confidence: data.confidence || 0,
          image_url: data.image_base64 || data.image_url,
          province: prov,
          username: data.user_id || 'Mobile User',
          diag_date: data.diag_date?.toDate ? data.diag_date.toDate() : (data.diag_date ? new Date(data.diag_date) : new Date())
        };
      });
      
      setFeed(realData);
    } catch (err) {
      console.error("Error fetching real data from Firestore:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealData();
  }, []);

  const getImageUrl = (path) => {
    if (!path) return 'https://placehold.co/600x400/f1f5f9/94a3b8?text=No+Image';
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:image')) return path;
    return `data:image/jpeg;base64,${path}`;
  };

  const filteredFeed = useMemo(() => {
    return feed.filter(f => {
      if (filters.disease_code && f.disease_code !== filters.disease_code) return false;
      if (filters.province && f.province !== filters.province) return false;
      if (filters.date_from) {
        const fromD = new Date(filters.date_from);
        fromD.setHours(0,0,0,0);
        if (f.diag_date < fromD) return false;
      }
      if (filters.date_to) {
        const toD = new Date(filters.date_to);
        toD.setHours(23,59,59,999);
        if (f.diag_date > toD) return false;
      }
      return true;
    });
  }, [feed, filters]);

  // Pagination logic
  const totalItems = filteredFeed.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  
  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages));
  }, [totalPages, page]);

  const currentFeed = filteredFeed.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const exportCSV = () => downloadCSV(`rice-ai-images-${stamp()}`, [
    { label: 'รหัสผลสแกน', value: 'diag_id' },
    { label: 'วันเวลา', value: (r) => r.diag_date?.toLocaleString('th-TH') },
    { label: 'ผลวินิจฉัย', value: (r) => DISEASE_NAMES[r.disease_code] || r.disease_name },
    { label: 'รหัสโรค', value: 'disease_code' },
    { label: 'ความมั่นใจ (%)', value: (r) => (r.confidence ? Number(r.confidence).toFixed(1) : '') },
    { label: 'จังหวัด', value: 'province' },
    { label: 'ผู้ใช้ (UID)', value: 'username' },
  ], filteredFeed, 'คลังภาพสแกน');

  const startItem = totalItems === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <PageHeader
        icon={Images}
        eyebrow="Verified source"
        title="คลังภาพ AI"
        desc="ภาพถ่ายใบข้าวที่ AI วิเคราะห์แล้ว จากการใช้งานแอปของเกษตรกรทั่วประเทศ แบบเรียลไทม์"
        actions={(
          <>
            <Btn icon={RefreshCw} busy={loading} onClick={fetchRealData}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</Btn>
            <Btn icon={ClipboardCheck} to="/admin/review">ตรวจทานผล AI</Btn>
            <Btn variant="primary" icon={Download} disabled={!filteredFeed.length} onClick={exportCSV}>ส่งออก CSV ({filteredFeed.length.toLocaleString()})</Btn>
          </>
        )}
      />

      {/* Modern Filter Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter size={16} /> กรองข้อมูลอัจฉริยะ (Smart Filter)
          </h3>
          <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full border border-gray-200">
            พบ {filteredFeed.length} รูปภาพ
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ประเภทโรค</label>
            <div className="relative">
              <select value={filters.disease_code} onChange={(e) => setFilters({ ...filters, disease_code: e.target.value })} className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none appearance-none transition-all">
                <option value="">ทุกประเภทโรค</option>
                {Object.entries(DISEASE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
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

      {loading && feed.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 size={48} className="animate-spin text-[var(--color-paddy)]" />
        </div>
      ) : filteredFeed.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white mb-8">
          <Search size={48} className="opacity-20 mb-4" />
          <p className="font-semibold text-gray-700 text-lg">ไม่พบรูปภาพ</p>
          <p className="text-sm mt-1">ลองเปลี่ยนเงื่อนไขการค้นหาใหม่</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {currentFeed.map(item => {
              const isHighConfidence = item.confidence >= 90;
              const colorClass = DISEASE_COLORS[item.disease_code] || DISEASE_COLORS['DEFAULT'];

            return (
              <div 
                key={item.diag_id} 
                className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
                onClick={() => setSelectedImage(item)}
              >
                {/* Image Section */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img 
                    src={getImageUrl(item.image_url)} 
                    alt={item.disease_name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={(e) => { e.target.src = 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Image+Not+Found'; }}
                  />
                  
                  {/* Floating Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                    <div className={`px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-black tracking-wider uppercase border shadow-sm ${colorClass}`}>
                      {item.disease_code}
                    </div>
                    {isHighConfidence && (
                      <div className="bg-emerald-500/90 text-white backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {item.confidence.toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Hover Actions */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
                    </div>
                  </div>
                </div>

                {/* Metadata Section */}
                <div className="p-4 flex-1 flex flex-col justify-between z-10 bg-white">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate">
                      {DISEASE_NAMES[item.disease_code] || item.disease_name}
                    </h3>
                    <div className="flex items-center text-xs text-slate-500 gap-1.5 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {item.province}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400">
                        {item.username.substring(0,2).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 truncate max-w-[80px]">User #{item.username.substring(0,4)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.diag_date.toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border border-gray-200 bg-white rounded-2xl shadow-sm">
          <div className="text-sm text-gray-500 mb-4 sm:mb-0">
            แสดงรูปภาพ <span className="font-semibold text-gray-900">{startItem}</span> ถึง <span className="font-semibold text-gray-900">{endItem}</span> จากทั้งหมด <span className="font-semibold text-gray-900">{totalItems}</span> รูปภาพ
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              disabled={page === 1 || loading}
              onClick={() => {
                setPage(page - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft size={16} /> ก่อนหน้า
            </button>
            
            <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm">
              หน้า {page} / {totalPages}
            </div>
            
            <button 
              disabled={page >= totalPages || loading}
              onClick={() => {
                setPage(page + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
            >
              ถัดไป <ChevronRight size={16} />
            </button>
          </div>
        </div>
        </>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors z-10"
            onClick={() => setSelectedImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <div className="max-w-6xl w-full max-h-[90vh] flex flex-col md:flex-row bg-white rounded-2xl overflow-hidden shadow-2xl">
            {/* Image Side */}
            <div className="md:w-2/3 bg-black flex items-center justify-center relative min-h-[300px]">
              <img 
                src={getImageUrl(selectedImage.image_url)} 
                alt={selectedImage.disease_name}
                className="max-w-full max-h-[90vh] object-contain"
              />
              <div className="absolute top-4 left-4">
                <div className={`px-3 py-1.5 rounded-lg backdrop-blur-md text-xs font-black tracking-wider uppercase border shadow-lg ${DISEASE_COLORS[selectedImage.disease_code] || DISEASE_COLORS['DEFAULT']}`}>
                  {selectedImage.disease_code}
                </div>
              </div>
            </div>
            
            {/* Details Side */}
            <div className="md:w-1/3 p-6 md:p-8 flex flex-col overflow-y-auto max-h-[90vh]">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {DISEASE_NAMES[selectedImage.disease_code] || selectedImage.disease_name}
              </h2>
              <div className="text-sm text-slate-500 mb-8 border-b border-slate-100 pb-4">
                รหัสวิเคราะห์: #{selectedImage.diag_id?.substring(0,8)}
              </div>
              
              <div className="space-y-6 flex-1">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">ความมั่นใจของ AI</div>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black text-slate-800">{selectedImage.confidence.toFixed(1)}%</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${selectedImage.confidence >= 90 ? 'bg-emerald-500' : selectedImage.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${selectedImage.confidence}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">สถานที่ตรวจพบ</div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    {selectedImage.province}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">ผู้อัปโหลด</div>
                    <div className="text-sm font-semibold text-slate-700 truncate">User #{selectedImage.username.substring(0,6)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">วันที่และเวลา</div>
                    <div className="text-sm font-semibold text-slate-700">
                      {selectedImage.diag_date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <button className="w-full bg-[var(--color-paddy-dark)] hover:bg-[var(--color-paddy)] text-white font-bold py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  ดาวน์โหลดรายงาน (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
