import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import api from '../../lib/api';

export default function History() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/diagnosis/me').then(({ data }) => setRows(data.history)); }, []);

  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-paddy-dark)] mb-1">ประวัติการวินิจฉัย</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6">รายการวินิจฉัยของคุณ เรียงจากล่าสุด</p>
      <Card>
        {rows.length === 0 && <p className="text-sm text-[var(--color-muted)]">ยังไม่มีประวัติการวินิจฉัย</p>}
        <div className="divide-y divide-black/5">
          {rows.map((r) => (
            <div key={r.diag_id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{r.disease_name}</div>
                <div className="text-xs text-[var(--color-muted)] font-mono">
                  {new Date(r.diag_date).toLocaleString('th-TH')} · {r.province || 'ไม่ทราบจังหวัด'}
                </div>
              </div>
              <div className="text-sm font-mono text-[var(--color-paddy)]">{r.confidence}%</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
