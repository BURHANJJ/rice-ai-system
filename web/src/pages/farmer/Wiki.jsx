import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import api from '../../lib/api';

export default function Wiki() {
  const [diseases, setDiseases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');

  const load = (query) => api.get('/diseases', { params: query ? { q: query } : {} }).then(({ data }) => setDiseases(data.diseases));
  useEffect(() => { load(''); }, []);

  const openDetail = (id) => api.get(`/diseases/${id}`).then(({ data }) => setSelected(data));

  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-paddy-dark)] mb-1">สารานุกรมโรคใบข้าว</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6">อาการ สาเหตุ และคำแนะนำการรักษา</p>

      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
        placeholder="ค้นหาชื่อโรค..."
        className="w-full max-w-sm border border-black/15 rounded-md px-3 py-2 text-sm mb-4 bg-white"
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          {diseases.map((d) => (
            <button
              key={d.disease_id}
              onClick={() => openDetail(d.disease_id)}
              className={`w-full text-left px-3 py-2.5 rounded-md border text-sm ${selected?.disease?.disease_id === d.disease_id ? 'border-[var(--color-paddy)] bg-[var(--color-paddy)]/5' : 'border-black/10 bg-white hover:bg-black/5'}`}
            >
              {d.disease_name}
            </button>
          ))}
        </div>
        <div className="md:col-span-2">
          <Card>
            {!selected && <p className="text-sm text-[var(--color-muted)]">เลือกโรคทางซ้ายเพื่อดูรายละเอียด</p>}
            {selected && (
              <div className="space-y-3">
                <div className="font-display text-xl text-[var(--color-paddy-dark)]">{selected.disease.disease_name}</div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-mono mb-1">อาการ</div>
                  <p className="text-sm">{selected.disease.symptoms}</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-mono mb-1">สาเหตุ</div>
                  <p className="text-sm">{selected.disease.cause}</p>
                </div>
                {selected.advice.map((a) => (
                  <div key={a.advice_id} className="border-t border-black/10 pt-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-mono mb-1">คำแนะนำการรักษา</div>
                    <p className="text-sm">{a.treatment}</p>
                    {a.chemical_name && <p className="text-xs text-[var(--color-muted)] mt-1">สารเคมี: {a.chemical_name} · {a.dosage}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
