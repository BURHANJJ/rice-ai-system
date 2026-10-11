import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import api from '../../lib/api';

export default function Outbreak() {
  const [provinces, setProvinces] = useState([]);
  const [coverage, setCoverage] = useState(0);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/outbreak/provinces').then(({ data }) => { setProvinces(data.provinces); setCoverage(data.coverage); });
  }, []);

  const filtered = provinces.filter((p) => p.province.includes(q));

  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-paddy-dark)] mb-1">พื้นที่เฝ้าระวังการระบาด</h1>
      <p className="text-sm text-[var(--color-muted)] mb-1">ครอบคลุม {coverage} จาก 77 จังหวัด</p>
      <p className="text-xs text-amber-700 mb-6">* ระดับความเสี่ยงคำนวณจากสูตร placeholder ที่ยังไม่ผ่านการรับรองทางวิชาการ (ดู docs/ASSUMPTIONS_AND_TODOS.md)</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาจังหวัด..."
        className="w-full max-w-sm border border-black/15 rounded-md px-3 py-2 text-sm mb-4 bg-white"
      />

      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((p) => (
            <div key={p.province} className="flex items-center justify-between border border-black/10 rounded-md px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{p.province}</div>
                <div className="text-xs text-[var(--color-muted)]">{p.total_cases} เคส</div>
              </div>
              <Badge tone={p.risk_level}>{p.risk_level}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
