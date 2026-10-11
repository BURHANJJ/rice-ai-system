import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSettings } from '../../lib/settings';
import { useScans } from '../../lib/scanStore';
import { useOutbreakData } from '../riskmap/outbreakData';
import { computeAlerts, useAlertActions } from './alerts';
import { useReviews } from './reviews';

/** Things that need someone's attention — drives the bell, nav badges and the dashboard to-do strip. */
export function useAdminSignals(role) {
  const isAdmin = role === 'admin';
  const { settings } = useSettings();
  const { scans } = useScans();
  const { reviews } = useReviews();
  const { stats } = useOutbreakData();
  const { items: actions } = useAlertActions();
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    return onSnapshot(
      query(collection(db, 'users'), where('status', '==', 'pending')),
      (snap) => setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setPending([]),
    );
  }, [isAdmin]);

  return useMemo(() => {
    const low = settings.review.lowConfidence;
    const lowQueue = reviews && scans ? scans.filter((s) => s.confidence !== null && s.confidence < low && !reviews[s.id]) : [];
    const alerts = isAdmin ? computeAlerts(stats, settings.alerts, actions).filter((a) => a.status === 'new') : [];
    const items = [];
    for (const a of alerts) {
      items.push({ key: `alert-${a.geo.code}`, tone: a.level === 'high' ? 'red' : 'amber', title: `จ.${a.geo.name} ${a.level === 'high' ? 'เสี่ยงสูง' : 'เฝ้าระวัง'}`, body: `พบโรค ${a.recent} จุดใน ${settings.alerts.windowDays} วัน${a.top ? ` · ${a.top}` : ''}`, to: '/admin/alerts', at: a.latest });
    }
    if (isAdmin && pending?.length) {
      items.push({ key: 'pending', tone: 'blue', title: `คำขอนักวิชาการรออนุมัติ ${pending.length} รายการ`, body: pending.slice(0, 2).map((u) => u.full_name || u.email).join(', '), to: '/admin/approvals' });
    }
    if (lowQueue.length) {
      items.push({ key: 'review', tone: 'gray', title: `ผล AI ไม่มั่นใจรอตรวจทาน ${lowQueue.length} ภาพ`, body: `ความมั่นใจต่ำกว่า ${low}%`, to: '/admin/review?tab=low' });
    }
    return {
      items,
      count: alerts.length + (isAdmin ? pending?.length || 0 : 0) + (lowQueue.length ? 1 : 0),
      badges: {
        '/admin/alerts': alerts.length,
        '/admin/approvals': pending?.length || 0,
        '/admin/review': lowQueue.length,
      },
    };
  }, [settings, reviews, scans, stats, actions, pending, isAdmin]);
}
