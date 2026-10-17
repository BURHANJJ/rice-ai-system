import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, Lightbulb, Mail, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { useAuth } from '../lib/AuthContext';
import { useDocTitle, useI18n } from '../lib/i18n';
import { CONTACT_EMAIL } from '../lib/legalContent';
import { db } from '../lib/firebase';

const CATEGORIES = [
  { value: 'suggestion', th: 'ข้อเสนอแนะเพื่อพัฒนาระบบ', en: 'Product suggestion' },
  { value: 'issue', th: 'ปัญหาการใช้งาน', en: 'Usability issue' },
  { value: 'data', th: 'ข้อมูลหรือผล AI ไม่ถูกต้อง', en: 'Incorrect information or AI result' },
  { value: 'other', th: 'เรื่องอื่น ๆ', en: 'Other' },
];
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100';

export default function Feedback() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const isEn = lang === 'en';
  const tr = (th, en) => (isEn ? en : th);
  useDocTitle({ th: 'ส่งข้อเสนอแนะ | Rice AI', en: 'Share feedback | Rice AI' });
  const [form, setForm] = useState({ category: 'suggestion', subject: '', message: '', name: '', email: '', consent: false, company: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: current.name || user?.full_name || '',
      email: current.email || user?.contact_email || user?.email || '',
    }));
  }, [user?.full_name, user?.contact_email, user?.email]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: key === 'consent' ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.company) return;
    if (form.message.trim().length < 20) {
      setError(tr('รายละเอียดควรมีอย่างน้อย 20 ตัวอักษร เพื่อให้ทีมเข้าใจและตรวจสอบได้', 'Please provide at least 20 characters so the team can understand and review the report.'));
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError(tr('รูปแบบอีเมลไม่ถูกต้อง', 'Please enter a valid email address.'));
      return;
    }
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, 'feedback'), {
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
        full_name: form.name.trim().slice(0, 80),
        email: form.email.trim().toLowerCase().slice(0, 254),
        user_id: user?.uid || '',
        source_path: window.location.pathname,
        status: 'new',
        admin_note: '',
        consent: true,
        consented_at: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setReceipt(`FB-${ref.id.slice(0, 8).toUpperCase()}`);
    } catch (err) {
      console.error('Feedback submission failed:', err);
      setError(tr('ส่งข้อเสนอแนะไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อทีมงานทางอีเมล', 'We could not submit your feedback. Please try again or contact us by email.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f1] text-slate-900">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900"><Lightbulb size={15} />{tr('เสียงจากผู้ใช้ช่วยให้ Rice AI ดีขึ้น', 'Your feedback helps improve Rice AI')}</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{tr('ส่งข้อเสนอแนะ', 'Share your feedback')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{tr('แจ้งปัญหา เสนอแนวคิด หรือชี้จุดที่ข้อมูลและผลวิเคราะห์ควรปรับปรุง ทีมงานจะนำเรื่องของคุณเข้าสู่คิวตรวจสอบ', 'Report a problem, suggest an improvement, or flag information and analysis that needs attention. Your message will be added to the team’s review queue.')}</p>

          {receipt ? (
            <section className="mt-8 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-9" aria-live="polite">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><CheckCircle2 size={26} /></div>
              <h2 className="mt-5 text-xl font-bold text-slate-900">{tr('รับข้อเสนอแนะแล้ว', 'Feedback received')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{tr('ทีมงานบันทึกเรื่องของคุณไว้เพื่อตรวจสอบ หากให้ที่อยู่อีเมลไว้ เราอาจใช้ติดต่อกลับเมื่อจำเป็น', 'The team has recorded your message for review. If you provided an email address, we may use it to follow up when needed.')}</p>
              <div className="mt-5 inline-flex rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">{tr('รหัสอ้างอิง', 'Reference')}</span><span className="ml-3 font-mono font-bold text-slate-900">{receipt}</span></div>
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1f4d3a] px-4 text-sm font-bold text-white">{tr('กลับหน้าหลัก', 'Back to home')}<ArrowRight size={15} /></Link><a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"><Mail size={15} />{tr('ติดต่อทางอีเมล', 'Email the team')}</a></div>
            </section>
          ) : (
            <form onSubmit={submit} className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><MessageSquareText size={19} /></span>
                <div><h2 className="font-bold text-slate-900">{tr('รายละเอียดข้อเสนอแนะ', 'Feedback details')}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{tr('กรอกข้อมูลที่จำเป็นให้ครบถ้วน เพื่อให้ทีมงานดำเนินการต่อได้', 'Include enough detail for the team to review and act on your message.')}</p></div>
              </div>

              {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{tr('ประเภทเรื่อง', 'Category')} <span className="text-red-600">*</span></span><select value={form.category} onChange={set('category')} className={inputClass}>{CATEGORIES.map((category) => <option key={category.value} value={category.value}>{tr(category.th, category.en)}</option>)}</select></label>
                <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{tr('หัวข้อ', 'Subject')} <span className="text-red-600">*</span></span><input value={form.subject} onChange={set('subject')} required minLength={4} maxLength={120} className={inputClass} placeholder={tr('สรุปเรื่องที่ต้องการแจ้ง', 'Summarise what you want to report')} /></label>
                <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{tr('รายละเอียด', 'Details')} <span className="text-red-600">*</span></span><textarea value={form.message} onChange={set('message')} required minLength={20} maxLength={3000} rows={6} className={`${inputClass} resize-y`} placeholder={tr('อธิบายสิ่งที่พบ ขั้นตอนที่ทำก่อนเกิดปัญหา และสิ่งที่คาดหวังให้ปรับปรุง', 'Describe what happened, the steps before the issue, and what you would like improved.')} /><span className="mt-1 block text-right text-[11px] text-slate-400">{form.message.length}/3000</span></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{tr('ชื่อผู้ติดต่อ', 'Your name')} <span className="text-xs font-normal text-slate-400">({tr('ไม่บังคับ', 'optional')})</span></span><input value={form.name} onChange={set('name')} maxLength={80} className={inputClass} autoComplete="name" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{tr('อีเมลสำหรับติดต่อกลับ', 'Email for follow-up')} <span className="text-xs font-normal text-slate-400">({tr('ไม่บังคับ', 'optional')})</span></span><input type="email" value={form.email} onChange={set('email')} maxLength={254} className={inputClass} autoComplete="email" placeholder="name@example.com" /></label>
              </div>

              <label aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><span>Company website</span><input tabIndex={-1} autoComplete="off" value={form.company} onChange={set('company')} /></label>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5 text-xs leading-5 text-slate-600"><input type="checkbox" checked={form.consent} onChange={set('consent')} required className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-800" /><span>{tr('ยินยอมให้ Rice AI เก็บข้อความและข้อมูลติดต่อที่ให้ไว้ เพื่อพิจารณาและตอบกลับข้อเสนอแนะนี้ ตาม', 'I agree that Rice AI may store this message and the contact details I provide to review and respond, as described in the')} <Link to="/privacy" className="font-bold text-emerald-800 underline underline-offset-2">{tr('นโยบายความเป็นส่วนตัว', 'Privacy Policy')}</Link></span></label>
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-800" />{tr('ข้อมูลนี้ส่งให้ทีมผู้ดูแลตรวจสอบเท่านั้น และไม่แสดงเป็นสาธารณะ', 'This message is sent to the administrator for review and is not public.')}</p><button type="submit" disabled={busy} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1f4d3a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#173d2e] disabled:cursor-wait disabled:opacity-60">{busy ? tr('กำลังส่ง…', 'Sending…') : tr('ส่งข้อเสนอแนะ', 'Submit feedback')}<ArrowRight size={16} /></button></div>
            </form>
          )}
          <p className="mt-5 text-center text-xs text-slate-500">{tr('ต้องการติดต่อโดยตรง?', 'Prefer direct contact?')} <a className="font-bold text-emerald-800 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
