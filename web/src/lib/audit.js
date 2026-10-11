import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/** Writes one entry to audit_logs, same shape as the existing admin pages. Never throws. */
export async function logAudit(user, activity, severity = 'info', details = '') {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      activity,
      severity,
      details,
      user_id: user?.uid || user?.email || 'system_admin',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

/**
 * Export history (D10): one audit_logs entry per downloaded file, tagged
 * category "export" so the audit page can filter it. Never throws.
 */
export async function logExport({ fileName, fileType, recordCount, dataset = '' }) {
  const u = auth.currentUser;
  try {
    await addDoc(collection(db, 'audit_logs'), {
      activity: 'ส่งออกข้อมูล',
      category: 'export',
      severity: 'info',
      details: `${dataset ? `${dataset} · ` : ''}${fileName} · ${recordCount} รายการ`,
      dataset,
      file_name: fileName,
      file_type: fileType,
      record_count: recordCount,
      user_id: u?.uid || 'anonymous',
      user_email: u?.email || '',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Export log failed:', err);
  }
}
