import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Database, Search, FileJson, FileSpreadsheet, Loader2, AlertCircle, Calendar, MapPin, Target, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { ALL_PROVINCES } from '../../lib/provinces';
import { logExport } from '../../lib/audit';

const LABEL_MAP = {
  'BLAST': 'โรคไหม้ (Rice Blast)',
  'BLB': 'โรคขอบใบแห้ง (Bacterial Leaf Blight)',
  'TUNGRO': 'โรคใบสีส้ม (Rice Tungro Virus)',
  'HEALTHY': 'ใบข้าวปกติ (Healthy Rice Leaf)'
};

// Simple region mapping
const getRegion = (province) => {
  if (!province) return 'ไม่ระบุ';
  const n = province.replace('จ.', '').trim();
  const north = ['เชียงใหม่','เชียงราย','ลำปาง','ลำพูน','แม่ฮ่องสอน','น่าน','พะเยา','แพร่','อุตรดิตถ์'];
  const isan = ['กาฬสินธุ์','ขอนแก่น','ชัยภูมิ','นครพนม','นครราชสีมา','บึงกาฬ','บุรีรัมย์','มหาสารคาม','มุกดาหาร','ยโสธร','ร้อยเอ็ด','เลย','สกลนคร','สุรินทร์','ศรีสะเกษ','หนองคาย','หนองบัวลำภู','อุดรธานี','อุบลราชธานี','อำนาจเจริญ'];
  const south = ['กระบี่','ชุมพร','ตรัง','นครศรีธรรมราช','นราธิวาส','ปัตตานี','พังงา','พัทลุง','ภูเก็ต','ระนอง','สตูล','สงขลา','สุราษฎร์ธานี','ยะลา'];
  const east = ['จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ตราด','ปราจีนบุรี','ระยอง','สระแก้ว'];
  const west = ['กาญจนบุรี','ตาก','ประจวบคีรีขันธ์','เพชรบุรี','ราชบุรี'];
  
  if (north.includes(n)) return 'ภาคเหนือ';
  if (isan.includes(n)) return 'ภาคตะวันออกเฉียงเหนือ';
  if (south.includes(n)) return 'ภาคใต้';
  if (east.includes(n)) return 'ภาคตะวันออก';
  if (west.includes(n)) return 'ภาคตะวันตก';
  return 'ภาคกลาง';
};

export default function DataExplorer() {
  const [filters, setFilters] = useState({ disease_code: '', province: '', region: '', date_from: '', date_to: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      let qArgs = [collection(db, 'diagnoses')];
      
      // We can only use where() on disease_code easily without composite indexes
      if (filters.disease_code) {
        qArgs.push(where('disease_code', '==', filters.disease_code));
      } else {
        qArgs.push(orderBy('diag_date', 'desc'));
      }
      
      qArgs.push(limit(1000)); 

      const q = query(...qArgs);
      const snap = await getDocs(q);
      
      let fetchedRows = snap.docs.map(doc => {
        const data = doc.data();
        const prov = data.location?.province ? data.location.province.replace('จ.', '').trim() : 'ไม่ระบุ';
        return {
          id: doc.id,
          diagnosis_ref: 'REF-' + doc.id.substring(0, 8).toUpperCase(),
          disease_code: data.disease_code || 'UNKNOWN',
          disease_name: LABEL_MAP[data.disease_code] || data.disease_name || 'ไม่ทราบโรค',
          confidence: data.confidence || 0,
          province: prov,
          region: getRegion(prov),
          date: data.diag_date?.toDate ? data.diag_date.toDate() : new Date(data.diag_date || Date.now())
        }
      });
      
      // Client-side filtering for dates and province to avoid missing index errors in Firestore
      if (filters.province) {
        fetchedRows = fetchedRows.filter(r => r.province === filters.province);
      }
      if (filters.region) {
        fetchedRows = fetchedRows.filter(r => r.region === filters.region);
      }
      if (filters.date_from) {
        const fromD = new Date(filters.date_from);
        fromD.setHours(0,0,0,0);
        fetchedRows = fetchedRows.filter(r => r.date >= fromD);
      }
      if (filters.date_to) {
        const toD = new Date(filters.date_to);
        toD.setHours(23, 59, 59, 999);
        fetchedRows = fetchedRows.filter(r => r.date <= toD);
      }
      
      setRows(fetchedRows);
      setTotal(fetchedRows.length);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถโหลดข้อมูลจากระบบได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []); // eslint-disable-line

  const exportData = async (type) => {
    setExporting(true);
    try {
      let blob;
      let filename = `rice_ai_export_${new Date().getTime()}`;
      
      if (type === 'csv') {
        const header = ['Ref', 'Disease', 'Confidence (%)', 'Province', 'Region', 'Date'];
        const csvContent = [
          header.join(','),
          ...rows.map(r => `"${r.diagnosis_ref}","${r.disease_name}",${r.confidence.toFixed(2)},"${r.province}","${r.region}","${r.date.toLocaleString('th-TH')}"`)
        ].join('\n');
        blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        filename += '.csv';
      } else {
        const jsonContent = JSON.stringify(rows.map(r => ({
          ...r,
          date: r.date.toISOString()
        })), null, 2);
        blob = new Blob([jsonContent], { type: 'application/json' });
        filename += '.json';
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      logExport({ fileName: filename, fileType: type.toUpperCase(), recordCount: rows.length, dataset: 'สำรวจข้อมูลวิจัย' });
    } catch (err) {
      console.error(err);
      setError('ส่งออกข้อมูลไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  const regionsList = ['ภาคเหนือ', 'ภาคกลาง', 'ภาคตะวันออกเฉียงเหนือ', 'ภาคใต้', 'ภาคตะวันออก', 'ภาคตะวันตก'];

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages));
  }, [totalPages, page]);

  const currentRows = rows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const startItem = total === 0 ? 0 : ((page - 1) * ITEMS_PER_PAGE) + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, total);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Database className="text-[var(--color-gold)]" size={32} /> 
            สำรวจ / ส่งออกข้อมูล
          </h1>
          <p className="text-gray-500 text-sm mt-2 ml-11 leading-relaxed">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-100 text-xs mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              Verified Source
            </span>
            ข้อมูลทั้งหมดผ่านการลบข้อมูลส่วนบุคคล (Anonymized) และเป็นข้อมูลจริงที่รวบรวมแบบเรียลไทม์จากการสแกนใบข้าวของเกษตรกรทั่วประเทศผ่านแอปพลิเคชัน
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Search size={16} /> ตัวกรองข้อมูล
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ประเภทโรค</label>
            <select value={filters.disease_code} onChange={(e) => setFilters({ ...filters, disease_code: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all">
              <option value="">ทุกโรค (All Diseases)</option>
              {Object.entries(LABEL_MAP).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">จังหวัด (Province)</label>
            <select value={filters.province} onChange={(e) => setFilters({ ...filters, province: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all">
              <option value="">ทุกจังหวัด</option>
              {ALL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ภูมิภาค (Region)</label>
            <select value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all">
              <option value="">ทุกภูมิภาค</option>
              {regionsList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ตั้งแต่วันที่ (From)</label>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ถึงวันที่ (To)</label>
            <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[var(--color-paddy)] outline-none transition-all" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-100">
          <button onClick={search} disabled={loading} className="px-5 py-2.5 rounded-lg bg-[var(--color-paddy)] text-white text-sm font-semibold hover:bg-[var(--color-paddy-dark)] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} ค้นหาข้อมูล
          </button>
          <button onClick={() => exportData('csv')} disabled={exporting || rows.length === 0} className="px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} ส่งออก CSV
          </button>
          <button onClick={() => exportData('json')} disabled={exporting || rows.length === 0} className="px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileJson size={16} />} ส่งออก JSON
          </button>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-start gap-2 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Activity size={18} className="text-[var(--color-paddy)]" /> ผลลัพธ์การค้นหา
          </h3>
          <span className="text-xs font-semibold bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-600 shadow-sm">
            พบ {total} รายการ
          </span>
        </div>
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-white text-gray-400 font-medium border-b border-gray-100 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4">Ref ID</th>
                <th className="px-6 py-4">โรค (Disease)</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">จังหวัด</th>
                <th className="px-6 py-4">ภูมิภาค</th>
                <th className="px-6 py-4">ช่วงเวลา (Date)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-3 text-gray-300" />
                    กำลังดึงข้อมูลจากระบบ...
                  </td>
                </tr>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-gray-400">
                    <Database size={48} className="opacity-20 mx-auto mb-4" />
                    <p className="font-medium text-gray-900 text-base">ไม่พบข้อมูล</p>
                    <p className="text-sm mt-1">ลองปรับเปลี่ยนเงื่อนไขการค้นหาใหม่</p>
                  </td>
                </tr>
              ) : (
                currentRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{r.diagnosis_ref}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{r.disease_name}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <Target size={12} className="text-gray-400" />
                        <span className={`font-mono text-xs font-bold ${r.confidence >= 80 ? 'text-green-600' : 'text-orange-500'}`}>{r.confidence.toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-gray-400" /> {r.province}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">{r.region}</td>
                    <td className="px-6 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" /> {r.date.toLocaleString('th-TH')}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Enterprise Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="text-sm text-gray-500 mb-4 sm:mb-0">
            แสดง <span className="font-semibold text-gray-900">{startItem}</span> ถึง <span className="font-semibold text-gray-900">{endItem}</span> จากทั้งหมด <span className="font-semibold text-gray-900">{total}</span> รายการ
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
    </div>
  );
}
