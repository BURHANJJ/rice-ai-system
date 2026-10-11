import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../lib/AuthContext';
import api from '../../lib/api';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [settings, setSettings] = useState(null);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => { api.get('/me/settings').then(({ data }) => setSettings(data.settings)); }, []);

  const saveProfile = async () => {
    const { data } = await api.patch('/me', { full_name: fullName });
    setUser(data.user);
    setSavedMsg('บันทึกโปรไฟล์แล้ว');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const updateSetting = async (key, value) => {
    const { data } = await api.patch('/me/settings', { ...settings, [key]: value });
    setSettings(data.settings);
  };

  return (
    <div>
      <h1 className="font-display text-2xl text-[var(--color-paddy-dark)] mb-6">โปรไฟล์ / ตั้งค่า</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Card title="ข้อมูลส่วนตัว">
          <label className="block mb-3">
            <span className="block text-sm mb-1">ชื่อ-นามสกุล</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-black/15 rounded-md px-3 py-2 text-sm" />
          </label>
          <p className="text-xs text-[var(--color-muted)] mb-3">Username: {user?.username} · {user?.email}</p>
          <button onClick={saveProfile} className="text-sm px-4 py-2 rounded-md bg-[var(--color-paddy)] text-white hover:bg-[var(--color-paddy-dark)]">บันทึก</button>
          {savedMsg && <span className="ml-3 text-xs text-emerald-700">{savedMsg}</span>}
        </Card>
        <Card title="การตั้งค่า">
          {settings && (
            <div className="space-y-4">
              <div>
                <span className="block text-sm mb-1">ธีม (Theme)</span>
                <select value={settings.theme} onChange={(e) => updateSetting('theme', e.target.value)} className="border border-black/15 rounded-md px-3 py-2 text-sm w-full">
                  <option value="light">สว่าง</option>
                  <option value="dark">มืด</option>
                </select>
              </div>
              <div>
                <span className="block text-sm mb-1">ภาษา (Language)</span>
                <select value={settings.language} onChange={(e) => updateSetting('language', e.target.value)} className="border border-black/15 rounded-md px-3 py-2 text-sm w-full">
                  <option value="th">ไทย</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <span className="block text-sm mb-1">การแจ้งเตือน</span>
                <select value={settings.notification} onChange={(e) => updateSetting('notification', e.target.value)} className="border border-black/15 rounded-md px-3 py-2 text-sm w-full">
                  <option value="on">เปิด</option>
                  <option value="off">ปิด</option>
                </select>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
