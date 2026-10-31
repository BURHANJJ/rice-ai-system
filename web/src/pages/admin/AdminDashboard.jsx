import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, ClipboardCheck, FileText, Siren, UserCheck } from 'lucide-react';
import { Btn, Kpi, PageHeader } from '../../components/admin/ui';
import { useAdminSignals } from '../../components/admin/signals';
import { modelMetrics, pct, useReviews } from '../../components/admin/reviews';
import { useScans } from '../../lib/scanStore';
import { useSettings } from '../../lib/settings';
import { collection, getDocs, query, limit, orderBy, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { checkAppRelease, checkFirestore, checkModel, MODEL } from '../../lib/systemStatus';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar 
} from 'recharts';
import { 
  Activity, Users, Target, Clock, ShieldAlert, 
  MapPin, UserCog, TrendingUp, Smartphone, Database, Zap, CheckCircle2, AlertTriangle
} from 'lucide-react';

const STATE_LABEL = {
  checking: <span className="text-xs font-bold text-amber-500">กำลังตรวจสอบ…</span>,
  online: <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14} /> ปกติ</span>,
  offline: <span className="flex items-center gap-1 text-xs font-bold text-red-500"><AlertTriangle size={14} /> ติดต่อไม่ได้</span>,
};

// ==============================================================================
// 📊 จุดปรับแต่งสีกราฟสถิติโรคข้าว (Chart Disease Colors - Pie & Bar Charts)
// ==============================================================================
const COLORS = {
  'BLAST': '#EF4444',     // สีแดง: โรคไหม้ (Rice Blast)
  'BLB': '#F97316',       // สีส้ม: โรคขอบใบแห้ง (Bacterial Leaf Blight)
  'TUNGRO': '#EAB308',    // สีเหลืองทอง: โรคใบสีส้ม (Tungro)
  'HEALTHY': '#22C55E'    // สีเขียวสด: ข้าวสุขภาพดี ปกติ (Healthy)
};

const LABEL_MAP = {
  'BLAST': 'โรคไหม้',
  'BLB': 'โรคขอบใบแห้ง',
  'TUNGRO': 'โรคใบสีส้ม',
  'HEALTHY': 'ข้าวปกติ'
};

function ActionCenter() {
  const signals = useAdminSignals('admin');
  const { scans } = useScans();
  const { reviews } = useReviews();
  const { settings } = useSettings();
  const m = useMemo(() => modelMetrics(scans, reviews, settings.review.lowConfidence), [scans, reviews, settings.review.lowConfidence]);
  const b = signals.badges;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-900">สิ่งที่ต้องดำเนินการ</h2>
        {signals.count === 0 && <span className="text-xs font-bold text-emerald-700">เรียบร้อยทั้งหมด</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Siren} tone={b['/admin/alerts'] ? 'red' : 'green'} label="การระบาดที่ยังไม่รับทราบ" value={b['/admin/alerts'] || 0} sub={b['/admin/alerts'] ? 'จังหวัด · กดเพื่อรับทราบหรือส่งประกาศ' : 'ไม่มีจังหวัดใหม่ที่ถึงเกณฑ์'} to="/admin/alerts" />
        <Kpi icon={UserCheck} tone={b['/admin/approvals'] ? 'amber' : 'green'} label="คำขอรออนุมัติ" value={b['/admin/approvals'] || 0} sub="นักวิชาการ" to="/admin/approvals" />
        <Kpi icon={ClipboardCheck} tone="blue" label="ผล AI ไม่มั่นใจ รอตรวจทาน" value={(b['/admin/review'] || 0).toLocaleString()} sub={`ความมั่นใจต่ำกว่า ${settings.review.lowConfidence}%`} to="/admin/review?tab=low" />
        <Kpi icon={BrainCircuit} tone="gray" label="ความแม่นยำจริงของ AI" value={pct(m.accuracy)} sub={m.reviewed ? `จาก ${m.reviewed.toLocaleString()} ภาพที่ตรวจทาน` : 'ยังไม่มีผลตรวจทาน'} to="/admin/model" />
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [stats, setStats] = useState({
    totalScans: 0,
    totalFarmers: 0,
    totalResearchers: 0,
    avgConfidence: 0,
    diseaseData: [],
    recentScans: [],
    topProvinces: [],
    confidenceTrend: [],
    usageGraph: []
  });

  // Real checks, not placeholders: Firestore round trip, model file served, latest app build.
  const [systemStatus, setSystemStatus] = useState({
    model: { state: 'checking' },
    firebase: { state: 'checking' },
    app: { state: 'checking' },
  });
  useEffect(() => {
    checkFirestore().then((firebase) => setSystemStatus((s) => ({ ...s, firebase })));
    checkModel().then((model) => setSystemStatus((s) => ({ ...s, model })));
    checkAppRelease().then((app) => setSystemStatus((s) => ({ ...s, app })));
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const startTime = performance.now();

        // 1. Quota-Saving Aggregations (Only 3 reads total!)
        const [scansCountSnap, usersCountSnap, researchersCountSnap, adminsCountSnap] = await Promise.all([
          getCountFromServer(collection(db, 'diagnoses')),
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'researcher'))),
          getCountFromServer(query(collection(db, 'users'), where('role', '==', 'admin'))),
        ]);

        const totalScans = scansCountSnap.data().count;
        const totalUsers = usersCountSnap.data().count;
        const totalResearchers = researchersCountSnap.data().count;
        // The app treats an account without a role as a farmer, so count everyone who isn't staff.
        const totalFarmers = totalUsers - totalResearchers - adminsCountSnap.data().count;

        // 2. Fetch only the last 100 scans for graphs and recent list (Max 100 reads)
        const recentQuery = query(collection(db, 'diagnoses'), orderBy('diag_date', 'desc'), limit(100));
        const diagnosesSnap = await getDocs(recentQuery);
        
        let totalConf = 0;
        let validConfCount = 0;
        const diseaseCounts = { 'BLAST': 0, 'BLB': 0, 'TUNGRO': 0, 'HEALTHY': 0 };
        const provinceCounts = {};
        const allScans = [];
        
        // For usage graph (Group by day)
        const usageByDay = {};

        diagnosesSnap.forEach(doc => {
          const data = doc.data();
          const date = data.diag_date?.toDate ? data.diag_date.toDate() : new Date(data.diag_date || Date.now());
          
          if (data.confidence) {
            totalConf += data.confidence;
            validConfCount++;
          }
          
          if (data.disease_code && diseaseCounts[data.disease_code] !== undefined) {
            diseaseCounts[data.disease_code]++;
          }
          
          if (data.location?.province) {
            let prov = data.location.province;
            if (prov.includes('จ.')) prov = prov.split('จ.')[1].trim();
            else if (prov.includes('จังหวัด')) prov = prov.split('จังหวัด')[1].trim();
            provinceCounts[prov] = (provinceCounts[prov] || 0) + 1;
          }

          const dayKey = date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
          usageByDay[dayKey] = (usageByDay[dayKey] || 0) + 1;

          allScans.push({ id: doc.id, ...data, date });
        });

        // Format Usage Graph Data
        const usageGraph = Object.keys(usageByDay).map(date => ({
          date,
          scans: usageByDay[date]
        })).reverse(); // Oldest to newest for the chart

        // Confidence Trend (Last 20 scans)
        const confidenceTrend = allScans.slice(0, 20).reverse().map((scan, index) => ({
          name: scan.date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
          index: index + 1,
          confidence: scan.confidence ? parseFloat(scan.confidence.toFixed(1)) : 0
        }));

        const diseaseData = Object.keys(diseaseCounts).map(key => ({
          name: LABEL_MAP[key] || key,
          code: key,
          value: diseaseCounts[key]
        })).filter(d => d.value > 0);

        const topProvinces = Object.keys(provinceCounts)
          .map(prov => ({ name: prov, count: provinceCounts[prov] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStats({
          totalScans,
          totalFarmers,
          totalResearchers,
          avgConfidence: validConfCount > 0 ? (totalConf / validConfCount).toFixed(1) : 0,
          diseaseData,
          recentScans: allScans.slice(0, 10),
          topProvinces,
          confidenceTrend,
          usageGraph
        });

      } catch (error) {
        console.error("Dashboard error:", error);
        setErrorMsg("ไม่สามารถโหลดข้อมูลได้ โปรดตรวจสอบการเชื่อมต่อ");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-[70vh] items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <p className="text-gray-500 font-medium">กำลังโหลดและคำนวณข้อมูล...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200">
        <h2 className="text-lg font-bold flex items-center gap-2"><ShieldAlert /> {errorMsg}</h2>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-10 max-w-7xl mx-auto">
      
      <PageHeader
        icon={Activity}
        eyebrow="Live · Firestore"
        title="แดชบอร์ดผู้ดูแลระบบ"
        desc="ภาพรวมการใช้งาน สถานะระบบ และสิ่งที่ต้องดำเนินการ ดึงข้อมูลสดจากฐานข้อมูลกลาง"
        actions={<Btn icon={FileText} to="/admin/report">รายงานประจำเดือน</Btn>}
      />

      <ActionCenter />

      {/* ── System Infrastructure Status ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Firebase */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Database size={24} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ฐานข้อมูล</div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">Firebase Firestore</span>
              {STATE_LABEL[systemStatus.firebase.state]}
            </div>
            <div className="text-xs text-gray-400 mt-1">{systemStatus.firebase.ms != null ? `ตอบกลับ ${systemStatus.firebase.ms} ms` : 'วัดจากการอ่านข้อมูลจริง 1 รายการ'}</div>
          </div>
        </div>

        {/* AI model, served to browsers; the app carries its own copy */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${systemStatus.model.state === 'offline' ? 'bg-red-50 text-red-500' : 'bg-purple-50 text-purple-600'}`}>
            <Target size={24} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">AI บนอุปกรณ์</div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">โมเดล {MODEL.version} · {MODEL.accuracy}</span>
              {STATE_LABEL[systemStatus.model.state]}
            </div>
            <div className="text-xs text-gray-400 mt-1">{systemStatus.model.sizeMb ? `ไฟล์เว็บ ${systemStatus.model.sizeMb} MB · ` : ''}ทำงานในแอปและเบราว์เซอร์ ไม่ใช้เซิร์ฟเวอร์</div>
          </div>
        </div>

        {/* Mobile app build people download */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <Smartphone size={24} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">แอปมือถือ (Android)</div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800">{systemStatus.app.version ? `รุ่นเบต้า ${systemStatus.app.version}` : 'รุ่นเบต้า'}</span>
              {STATE_LABEL[systemStatus.app.state]}
            </div>
            <div className="text-xs text-gray-400 mt-1">{systemStatus.app.released ? `เผยแพร่ ${new Date(systemStatus.app.released).toLocaleDateString('th-TH', { dateStyle: 'medium' })}` : 'จากข้อมูลหน้าดาวน์โหลด'}</div>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">การวินิจฉัยรวม (All-time)</h3>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Activity size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.totalScans}</span>
              <span className="text-xs text-gray-500 font-medium">ครั้ง</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">ผู้ใช้งาน (เกษตรกร)</h3>
              <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Users size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.totalFarmers}</span>
              <span className="text-xs text-gray-500 font-medium">บัญชี</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">นักวิชาการ</h3>
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><UserCog size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.totalResearchers}</span>
              <span className="text-xs text-gray-500 font-medium">บัญชี</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-medium">ความมั่นใจเฉลี่ยของ AI</h3>
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Target size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.avgConfidence}%</span>
              <span className="text-xs text-gray-500 font-medium">100 ผลล่าสุด</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-gray-400">ค่าที่โมเดลรายงานเอง ไม่ใช่ความแม่นยำ ความแม่นยำจริงดูที่การ์ดด้านบนซึ่งคิดจากผลตรวจทาน</p>
          </div>
        </div>
      </div>

      {/* ── Main Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* AI Model Usage Graph */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2">
                <Activity size={18} className="text-blue-600" /> กราฟการใช้โมเดล AI (Usage Traffic)
              </h3>
              <p className="text-xs text-gray-500">ปริมาณการส่งภาพให้ AI วิเคราะห์ (ประมวลผลจาก 100 รายการล่าสุด)</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[260px]">
            {stats.usageGraph.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.usageGraph} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <RechartsTooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val) => [`${val} ครั้ง`, 'จำนวนสแกน']}
                  />
                  <Bar dataKey="scans" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">ยังไม่มีข้อมูลเพียงพอ</div>
            )}
          </div>
        </div>

        {/* AI Confidence Trend Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2">
                <TrendingUp size={18} className="text-purple-600" /> ความเสถียรของโมเดล (Confidence Trend)
              </h3>
              <p className="text-xs text-gray-500">ค่าความมั่นใจของ AI จาก 20 การสแกนล่าสุด</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[260px]">
            {stats.confidenceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.confidenceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333EA" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#9333EA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="index" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={() => ''}
                    formatter={(val, name, props) => [`${val}%`, `${props.payload.name}`]}
                  />
                  <Area type="monotone" dataKey="confidence" stroke="#9333EA" strokeWidth={3} fillOpacity={1} fill="url(#colorConf)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
            )}
          </div>
        </div>

      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Donut Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 flex flex-col">
          <h3 className="text-gray-900 font-bold mb-1">สัดส่วนการพบโรค</h3>
          <p className="text-xs text-gray-500 mb-6">จำแนกจากตัวอย่าง 100 รายการล่าสุด</p>
          
          <div className="flex-1 flex items-center justify-center min-h-[220px]">
            {stats.diseaseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={stats.diseaseData} dataKey="value" nameKey="name" 
                    cx="50%" cy="50%" innerRadius={60} outerRadius={85} 
                    paddingAngle={5} stroke="none"
                  >
                    {stats.diseaseData.map((entry, i) => (
                      <Cell key={i} fill={COLORS[entry.code] || '#CBD5E1'} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
                <ShieldAlert size={32} className="opacity-50" /> ยังไม่มีข้อมูล
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            {stats.diseaseData.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[d.code] || '#CBD5E1' }}></div>
                <span className="truncate" title={d.name}>{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white rounded-2xl p-0 shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 pb-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-gray-900 font-bold mb-1">Log สแกนล่าสุด (Real-time Feed)</h3>
              <p className="text-xs text-gray-500">แสดงข้อมูลล่าสุดจากแอปพลิเคชันมือถือและเว็บแอป</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto max-h-[350px]">
            {stats.recentScans.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {stats.recentScans.map((scan, idx) => (
                  <li key={idx} className="p-4 hover:bg-gray-50/80 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shadow-inner border border-gray-200 flex-shrink-0">
                        {scan.image_base64 ? (
                          <img src={`data:image/jpeg;base64,${scan.image_base64}`} alt="Scan" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : scan.image_url ? (
                          <img src={scan.image_url} alt="Scan" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-200"><Activity size={20}/></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 truncate">
                            {LABEL_MAP[scan.disease_code] || scan.disease_name || scan.disease_code || 'ไม่ทราบโรค'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide border whitespace-nowrap ${
                            scan.disease_code === 'HEALTHY' ? 'bg-green-50 text-green-700 border-green-200' : 
                            scan.disease_code === 'BLAST' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            มั่นใจ {scan.confidence?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Clock size={12}/> {scan.date?.toLocaleString('th-TH') || 'เมื่อสักครู่'}
                          </span>
                          {scan.location && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              • <MapPin size={12}/> {scan.location.province || scan.location.address || 'ระบุไม่ได้'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
                <Activity size={32} className="mb-3 opacity-20" />
                <p className="text-sm">รอรับข้อมูลสแกนแรก...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
