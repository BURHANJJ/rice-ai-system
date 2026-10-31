// ==============================================================================
// 🏷️ จุดปรับแต่งสีป้ายสถานะและระดับความเสี่ยง (Web Badge & Status Pill Colors)
// ==============================================================================
// แก้ไขสีข้อความและสีพื้นหลังของ Badge แต่ละสถานะได้ที่นี่:
// ==============================================================================
export default function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-black/5 text-[var(--color-ink)]',                       // สถานะทั่วไป (สีเทาหมึก)
    low: 'bg-[var(--color-risk-low)]/15 text-[var(--color-risk-low)]',   // ความเสี่ยงต่ำ / ปลอดภัย (สีเขียว)
    medium: 'bg-[var(--color-risk-medium)]/20 text-[#8a6a1f]',           // ระดับเฝ้าระวัง (สีส้ม/เหลืองมัสตาร์ด)
    high: 'bg-[var(--color-risk-high)]/15 text-[var(--color-risk-high)]',// ระดับเสี่ยงสูง / อันตราย (สีแดง)
    pending: 'bg-amber-500/15 text-amber-700',                           // รอการตรวจสอบ (สีส้มอำพัน)
    active: 'bg-emerald-600/15 text-emerald-700',                        // กำลังใช้งาน / ปกติ (สีเขียวมรกต)
    suspended: 'bg-red-600/15 text-red-700',                             // ถูกระงับ / บล็อก (สีแดงเข้ม)
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}
