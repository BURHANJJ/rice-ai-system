import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';

const content = {
  terms: {
    title: 'เงื่อนไขการให้บริการ',
    subtitle: 'ข้อกำหนดเบื้องต้นสำหรับการใช้งานระบบ Rice AI',
    icon: FileText,
    sections: [
      {
        heading: 'การใช้งานระบบ',
        body: 'ผู้ใช้งานควรใช้ระบบเพื่อสนับสนุนการวิเคราะห์ ติดตาม และจัดการข้อมูลโรคข้าวตามบทบาทที่ได้รับอนุมัติเท่านั้น'
      },
      {
        heading: 'สิทธิ์การเข้าถึงข้อมูล',
        body: 'บัญชีนักวิชาการและเจ้าหน้าที่ต้องผ่านการตรวจสอบจากผู้ดูแลระบบก่อนเข้าใช้งาน ข้อมูลที่เข้าถึงได้อาจแตกต่างกันตามบทบาทและระดับสิทธิ์'
      },
      {
        heading: 'ความถูกต้องของข้อมูล',
        body: 'ผลวิเคราะห์จาก AI เป็นข้อมูลสนับสนุนการตัดสินใจ ผู้ใช้งานควรใช้ร่วมกับการตรวจสอบภาคสนามและดุลยพินิจของผู้เชี่ยวชาญ'
      },
      {
        heading: 'การใช้งานอย่างรับผิดชอบ',
        body: 'ห้ามนำข้อมูลหรือผลวิเคราะห์ไปใช้ในทางที่ทำให้เกิดความเสียหายต่อเกษตรกร หน่วยงาน หรือผู้เกี่ยวข้องโดยไม่มีการตรวจสอบที่เหมาะสม'
      }
    ]
  },
  privacy: {
    title: 'นโยบายความเป็นส่วนตัว',
    subtitle: 'แนวทางการดูแลข้อมูลผู้ใช้งานและข้อมูลภาคสนามในระบบ Rice AI',
    icon: ShieldCheck,
    sections: [
      {
        heading: 'ข้อมูลที่จัดเก็บ',
        body: 'ระบบอาจจัดเก็บข้อมูลบัญชีผู้ใช้ ข้อมูลสถาบัน/หน่วยงาน วัตถุประสงค์การเข้าถึงข้อมูล ประวัติการสแกน และข้อมูลประกอบการวิเคราะห์โรคข้าว'
      },
      {
        heading: 'วัตถุประสงค์การใช้ข้อมูล',
        body: 'ข้อมูลถูกใช้เพื่อยืนยันตัวตน จัดการสิทธิ์ วิเคราะห์สถานการณ์โรคข้าว และปรับปรุงคุณภาพของระบบบริการ'
      },
      {
        heading: 'การควบคุมสิทธิ์',
        body: 'การเข้าถึงข้อมูลถูกจำกัดตามบทบาทของผู้ใช้ เช่น เกษตรกร นักวิชาการ และผู้ดูแลระบบ เพื่อลดความเสี่ยงจากการเข้าถึงข้อมูลเกินความจำเป็น'
      },
      {
        heading: 'การรักษาความปลอดภัย',
        body: 'ระบบใช้การยืนยันตัวตนและการจัดการสิทธิ์เพื่อช่วยปกป้องข้อมูล อย่างไรก็ตาม ผู้ใช้งานควรรักษาบัญชีและรหัสผ่านของตนเองอย่างปลอดภัย'
      }
    ]
  }
};

export default function LegalPage({ type }) {
  const page = content[type] || content.terms;
  const Icon = page.icon;

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[var(--color-paper)] px-5 py-10 text-gray-800">
        <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[var(--color-paddy)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100">
          <ArrowLeft size={16} />
          กลับหน้าหลัก
        </Link>

        <section className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-2xl shadow-emerald-950/5 backdrop-blur sm:p-8">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--color-paddy)]">
              <Icon size={24} />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-[var(--color-paddy-dark)]">{page.title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{page.subtitle}</p>
            </div>
          </div>

          <div className="space-y-5">
            {page.sections.map((section) => (
              <article key={section.heading} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                <h2 className="text-base font-bold text-gray-950">{section.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{section.body}</p>
              </article>
            ))}
          </div>

          <p className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
            หมายเหตุ: เอกสารนี้เป็นข้อความประกอบระบบต้นแบบ หากนำไปใช้งานจริงควรให้ผู้รับผิดชอบโครงการหรือฝ่ายกฎหมายตรวจสอบเนื้อหาอีกครั้ง
          </p>
        </section>
      </div>
      </main>
    </>
  );
}

