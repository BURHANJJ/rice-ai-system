import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, orderBy, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar 
} from 'recharts';
import { 
  Activity, Target, Clock, ShieldAlert, MapPin, Search,
  TrendingUp, Database, Zap, BookOpen, Microscope
} from 'lucide-react';
import { ALL_PROVINCES } from '../../lib/provinces';

// ==============================================================================
// 📊 จุดปรับแต่งสีกราฟสถิติโรคข้าวของนักวิชาการ (Researcher Chart Colors)
// ==============================================================================
const COLORS = {
  'BLAST': '#EF4444',     // สีแดง: โรคไหม้ (Rice Blast)
  'BLB': '#F97316',       // สีส้ม: โรคขอบใบแห้ง (Bacterial Leaf Blight)
  'TUNGRO': '#EAB308',    // สีเหลืองทอง: โรคใบสีส้ม (Tungro)
  'HEALTHY': '#22C55E'    // สีเขียวสด: ข้าวปกติ (Healthy)
};

const LABEL_MAP = {
  'BLAST': 'โรคไหม้ (Rice Blast)',
  'BLB': 'โรคขอบใบแห้ง (Bacterial Leaf Blight)',
  'TUNGRO': 'โรคใบสีส้ม (Tungro)',
  'HEALTHY': 'ข้าวปกติ (Healthy)'
};

export default function ResearchDashboard() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [stats, setStats] = useState({
    totalScans: 0,
    totalDiseased: 0,
    diseasesCount: 4,
    avgConfidence: 0,
    diseaseData: [],
    recentScans: [],
    chartData: [],
    confidenceTrend: [],
    riskData: { high: 0, medium: 0, low: 0 }
  });

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // 1. Quota-Saving Aggregations
        const [scansCountSnap, diseasedCountSnap] = await Promise.all([
          getCountFromServer(collection(db, 'diagnoses')),
          getCountFromServer(query(collection(db, 'diagnoses'), where('disease_code', '!=', 'HEALTHY')))
        ]);

        const totalScans = scansCountSnap.data().count;
        const totalDiseased = diseasedCountSnap.data().count;

        // 2. Fetch recent scans for detailed stats and feed
        const recentQuery = query(collection(db, 'diagnoses'), orderBy('diag_date', 'desc'), limit(150));
        const diagnosesSnap = await getDocs(recentQuery);
        
        let totalConf = 0;
        let validConfCount = 0;
        const diseaseCounts = { 'BLAST': 0, 'BLB': 0, 'TUNGRO': 0, 'HEALTHY': 0 };
        const provinceCounts = {};
        const allScans = [];
        
        diagnosesSnap.forEach(doc => {
          const data = doc.data();
          const date = data.diag_date?.toDate ? data.diag_date.toDate() : new Date(data.diag_date || Date.now());
          
          if (data.confidence) {
            totalConf += data.confidence;
            validConfCount++;
          }
          
          if (data.disease_code) {
            const code = data.disease_code.toUpperCase();
            if (diseaseCounts[code] !== undefined) {
              diseaseCounts[code]++;
            }
          }
          
          if (data.disease_code && data.disease_code !== 'HEALTHY') {
            let prov = data.location?.province || data.province || '';
            if (prov) {
              if (prov.includes('จ.')) prov = prov.split('จ.')[1].trim();
              else if (prov.includes('จังหวัด')) prov = prov.split('จังหวัด')[1].trim();
              
              // Validate province
              const matchedProv = ALL_PROVINCES.find(p => prov.includes(p));
              if (matchedProv) {
                provinceCounts[matchedProv] = (provinceCounts[matchedProv] || 0) + 1;
              }
            }
          }

          allScans.push({ id: doc.id, ...data, date });
        });

        // Calculate Risk Levels
        let riskData = { high: 0, medium: 0, low: 0 };
        const fullProvinceData = ALL_PROVINCES.map(prov => {
          const count = provinceCounts[prov] || 0;
          let risk_level = 'low';
          if (count >= 5) { risk_level = 'high'; riskData.high++; }
          else if (count >= 2) { risk_level = 'medium'; riskData.medium++; }
          else { riskData.low++; }
          
          return { province: prov, total_cases: count, risk_level };
        });

        // Top 10 Provinces Chart
        const chartData = fullProvinceData
          .filter((p) => p.total_cases > 0)
          .sort((a, b) => b.total_cases - a.total_cases)
          .slice(0, 10)
          .map((p) => ({ name: p.province, cases: p.total_cases }));

        // Confidence Trend (Last 20 scans)
        const confidenceTrend = allScans.slice(0, 20).reverse().map((scan, index) => ({
          name: scan.date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          index: index + 1,
          confidence: scan.confidence ? parseFloat(scan.confidence.toFixed(1)) : 0
        }));

        // Disease Proportions
        const diseaseData = Object.keys(diseaseCounts).map(key => ({
          name: LABEL_MAP[key] || key,
          code: key,
          value: diseaseCounts[key]
        })).filter(d => d.value > 0);

        setStats({
          totalScans,
          totalDiseased,
          diseasesCount: 4,
          avgConfidence: validConfCount > 0 ? (totalConf / validConfCount).toFixed(1) : 0,
          diseaseData,
          recentScans: allScans.slice(0, 12),
          chartData,
          confidenceTrend,
          riskData
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#10B981]"></div>
        <p className="text-gray-500 font-medium tracking-wide">AI Processing Data...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200 shadow-sm flex flex-col items-center justify-center h-40">
        <ShieldAlert size={32} className="mb-2" />
        <h2 className="text-lg font-bold">{errorMsg}</h2>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-10 max-w-7xl mx-auto">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#10B981] opacity-[0.03] rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="font-display text-3xl font-bold text-[#064E3B] tracking-tight flex items-center gap-3">
            <Microscope className="text-[#F59E0B]" size={32} /> 
            ภาพรวมงานวิจัย (Research Overview)
          </h1>
          <p className="text-gray-500 text-sm mt-2 ml-11 leading-relaxed">
            ระบบวิเคราะห์ภาพถ่ายและจำแนกโรคข้าวด้วย AI (อัปเดตข้อมูลแบบ Optimized)
          </p>
        </div>
        
        <div className="flex flex-col items-end relative z-10">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Researcher Mode
          </div>
          <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 font-mono uppercase tracking-wider">
            <Database size={10} className="text-[#F59E0B]" /> Cloud Synced
          </p>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-bold tracking-wide">เคสทั้งหมด</h3>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Activity size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.totalScans}</span>
              <span className="text-xs text-gray-500 font-medium">รายการ</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-bold tracking-wide">พบการติดเชื้อ</h3>
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Target size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.totalDiseased}</span>
              <span className="text-xs text-gray-500 font-medium">รายการ</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-bold tracking-wide">โมเดลโรค</h3>
              <div className="p-2 bg-green-100 text-green-600 rounded-lg"><BookOpen size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.diseasesCount}</span>
              <span className="text-xs text-gray-500 font-medium">ชนิด</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 text-sm font-bold tracking-wide">ความมั่นใจ AI</h3>
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Zap size={18} /></div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-gray-900">{stats.avgConfidence}%</span>
              <span className="text-xs text-gray-500 font-medium">เฉลี่ย</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* ── Top Provinces Chart ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2 text-lg">
                <MapPin size={20} className="text-[#F59E0B]" /> 10 จังหวัดที่พบเคสมากที่สุด
              </h3>
              <p className="text-xs text-gray-500">จำแนกตามจำนวนการตรวจพบโรค (ไม่นับข้าวปกติ)</p>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-[300px]">
            {stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorCases" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" allowDecimals={false} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={80} stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} fontWeight="600" />
                  <RechartsTooltip 
                    cursor={{fill: '#F8FAFC'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    formatter={(val) => [`${val} เคส`, 'จำนวนผู้ป่วยพืช']}
                  />
                  <Bar dataKey="cases" fill="url(#colorCases)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">ยังไม่มีข้อมูลเพียงพอ</div>
            )}
          </div>
        </div>
        
        {/* ── Risk Overview ── */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2 text-lg">
            <ShieldAlert size={20} className="text-red-500" /> สถานะความเสี่ยงพื้นที่
          </h3>
          <p className="text-xs text-gray-500 mb-6">ประเมินจากความถี่ในการระบาดของแต่ละจังหวัด</p>
          
          <div className="flex flex-col gap-4 mt-2">
            <div className="bg-gradient-to-br from-red-50 to-white border border-red-100 rounded-xl p-5 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 w-24 h-24 bg-red-500 opacity-[0.03] rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform"></div>
              <div className="flex items-end justify-between mb-2">
                <div className="text-red-600 text-sm font-bold uppercase tracking-wider">ความเสี่ยงสูง (High Risk)</div>
                <div className="text-red-700 font-display font-bold text-3xl">{stats.riskData.high} <span className="text-base font-sans font-medium text-red-500">จังหวัด</span></div>
              </div>
              <p className="text-red-500 text-xs leading-relaxed font-medium">ระบาดหนาแน่น ควรลงพื้นที่ตรวจสอบด่วน</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-xl p-5 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500 opacity-[0.03] rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform"></div>
              <div className="flex items-end justify-between mb-2">
                <div className="text-orange-600 text-sm font-bold uppercase tracking-wider">เฝ้าระวัง (Medium Risk)</div>
                <div className="text-orange-700 font-display font-bold text-3xl">{stats.riskData.medium} <span className="text-base font-sans font-medium text-orange-500">จังหวัด</span></div>
              </div>
              <p className="text-orange-500 text-xs leading-relaxed font-medium">มีแนวโน้มการระบาดเพิ่มขึ้น ควรติดตาม</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl p-5 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute right-0 top-0 w-24 h-24 bg-green-500 opacity-[0.03] rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform"></div>
              <div className="flex items-end justify-between mb-2">
                <div className="text-green-600 text-sm font-bold uppercase tracking-wider">ปกติ (Low Risk)</div>
                <div className="text-green-700 font-display font-bold text-3xl">{stats.riskData.low} <span className="text-base font-sans font-medium text-green-500">จังหวัด</span></div>
              </div>
              <p className="text-green-500 text-xs leading-relaxed font-medium">ไม่พบการระบาดหรืออยู่ในเกณฑ์ปกติ</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Donut Chart & Confidence */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-1 flex flex-col">
          <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2 text-lg">
            <Search size={20} className="text-blue-500" /> สัดส่วนการพบโรค (Disease Ratio)
          </h3>
          <p className="text-xs text-gray-500 mb-6">วิเคราะห์จากตัวอย่างภาพถ่ายทั้งหมดในระบบ</p>
          
          <div className="flex-1 flex items-center justify-center min-h-[220px]">
            {stats.diseaseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={stats.diseaseData} dataKey="value" nameKey="name" 
                    cx="50%" cy="50%" innerRadius={65} outerRadius={90} 
                    paddingAngle={5} stroke="none"
                  >
                    {stats.diseaseData.map((entry, i) => (
                      <Cell key={i} fill={COLORS[entry.code] || '#CBD5E1'} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
                <ShieldAlert size={32} className="opacity-50" /> ยังไม่มีข้อมูลเพียงพอ
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-2 mt-4">
            {stats.diseaseData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[d.code] || '#CBD5E1' }}></div>
                  <span className="font-semibold" title={d.name}>{d.name}</span>
                </div>
                <span className="font-mono text-gray-500">{d.value} เคส</span>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2 text-sm">
              <TrendingUp size={16} className="text-purple-600" /> AI Confidence Trend (20 ล่าสุด)
            </h3>
            <div className="w-full h-32 mt-4">
              {stats.confidenceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.confidenceTrend}>
                    <defs>
                      <linearGradient id="colorConfRes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333EA" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#9333EA" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="index" hide />
                    <YAxis domain={[0, 100]} hide />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                      labelFormatter={() => ''}
                      formatter={(val, name, props) => [`${val}%`, props.payload.name]}
                    />
                    <Area type="monotone" dataKey="confidence" stroke="#9333EA" strokeWidth={2} fillOpacity={1} fill="url(#colorConfRes)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Real-time AI Scan Feed ── */}
        <div className="bg-white rounded-2xl p-0 shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="text-gray-900 font-bold mb-1 flex items-center gap-2 text-lg">
                <Activity size={20} className="text-[#10B981]" /> AI Scan Feed (Field Data)
              </h3>
              <p className="text-xs text-gray-500">ข้อมูลภาพถ่ายใบข้าวและผลวิเคราะห์จาก AI ล่าสุด</p>
            </div>
            <div className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 shadow-sm">
              {stats.recentScans.length} ล่าสุด
            </div>
          </div>
          
          <div className="flex-1 overflow-auto max-h-[580px] p-2">
            {stats.recentScans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                {stats.recentScans.map((scan, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md hover:border-gray-200 transition-all group flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shadow-inner border border-gray-200 flex-shrink-0 relative">
                      {scan.image_base64 ? (
                        <img src={`data:image/jpeg;base64,${scan.image_base64}`} alt="Rice leaf" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : scan.image_url ? (
                        <img src={scan.image_url} alt="Rice leaf" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-200"><Microscope size={24}/></div>
                      )}
                      
                      {/* Status indicator overlay */}
                      <div className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                        scan.disease_code === 'HEALTHY' ? 'bg-green-500' : 
                        scan.disease_code === 'BLAST' ? 'bg-red-500' : 'bg-orange-500'
                      }`}></div>
                    </div>
                    
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="text-sm font-bold text-gray-900 truncate mb-1">
                        {LABEL_MAP[scan.disease_code] || scan.disease_name || scan.disease_code || 'ไม่ทราบโรค'}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide border whitespace-nowrap bg-gray-50 text-gray-600 border-gray-200">
                          AI มั่นใจ {scan.confidence?.toFixed(1) || 0}%
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 text-[10px] text-gray-500 font-medium">
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin size={10} className="text-gray-400" /> {scan.location?.province || scan.location?.address || 'ไม่ระบุตำแหน่ง'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={10} className="text-gray-400" /> {scan.date?.toLocaleString('th-TH') || 'เมื่อสักครู่'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
                <Microscope size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">กำลังรอข้อมูลสแกนจากแอปพลิเคชันมือถือ...</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
