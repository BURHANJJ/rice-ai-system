import { useSyncExternalStore } from 'react';
import { collection, doc, getCountFromServer, getDocs, increment, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ADVICE, topDisease } from '../riskmap/outbreakData';

const DAY = 86_400_000;

/** Tiny shared onSnapshot store per collection. */
function collectionStore(name, map = (id, d) => ({ id, ...d })) {
  let state = { items: null, error: '' };
  let unsub = null;
  const ls = new Set();
  const sub = (l) => {
    ls.add(l);
    if (!unsub) {
      unsub = onSnapshot(
        collection(db, name),
        (snap) => {
          const items = [];
          snap.forEach((d) => items.push(map(d.id, d.data())));
          state = { items, error: '' };
          ls.forEach((x) => x());
        },
        (err) => {
          state = { items: [], error: err?.code === 'permission-denied' ? `ยังไม่ได้เปิดสิทธิ์ใน Firestore rules สำหรับ ${name}` : `โหลด ${name} ไม่สำเร็จ` };
          ls.forEach((x) => x());
        },
      );
    }
    return () => {
      ls.delete(l);
      if (!ls.size && unsub) { unsub(); unsub = null; state = { items: null, error: '' }; }
    };
  };
  return () => useSyncExternalStore(sub, () => state);
}

const ts = (v) => v?.toDate?.() || null;

/** alert_actions/{provinceName}: acknowledged_at, last_broadcast_at, broadcasts */
export const useAlertActions = collectionStore('alert_actions', (id, d) => ({ id, ...d, ackAt: ts(d.acknowledged_at), lastBroadcastAt: ts(d.last_broadcast_at) }));
/** broadcasts/{id}: title, body, provinces, recipients, sent_by_name, sent_at */
export const useBroadcasts = collectionStore('broadcasts', (id, d) => ({ id, ...d, at: ts(d.sent_at) }));

/**
 * Alerts from live scans: provinces whose disease reports in the last
 * `windowDays` reach the alert thresholds. A province is "new" until someone
 * acknowledges it, and becomes new again when a case arrives after that.
 */
export function computeAlerts(stats, cfg, actions, now = Date.now()) {
  if (!stats) return [];
  const byName = Object.fromEntries((actions || []).map((a) => [a.id, a]));
  const from = now - cfg.windowDays * DAY;
  const prevFrom = from - cfg.windowDays * DAY;
  const out = [];
  for (const st of Object.values(stats)) {
    const sick = st.scans.filter((s) => s.isDisease && s.date);
    const recent = sick.filter((s) => s.date.getTime() >= from);
    if (recent.length < cfg.medium) continue;
    const prev = sick.filter((s) => s.date.getTime() >= prevFrom && s.date.getTime() < from).length;
    const diseases = {};
    for (const s of recent) diseases[s.disease] = (diseases[s.disease] || 0) + 1;
    const latest = recent.reduce((a, s) => (!a || s.date > a ? s.date : a), null);
    const act = byName[st.geo.name];
    const acked = act?.ackAt && act.ackAt >= latest;
    out.push({
      geo: st.geo,
      level: recent.length >= cfg.high ? 'high' : 'medium',
      recent: recent.length,
      prev,
      change: prev ? (recent.length - prev) / prev : null,
      diseases,
      top: topDisease(diseases),
      latest,
      users: new Set(st.scans.map((s) => s.userId).filter(Boolean)),
      action: act || null,
      status: !acked ? 'new' : act.lastBroadcastAt && act.lastBroadcastAt >= latest ? 'sent' : 'ack',
    });
  }
  return out.sort((a, b) => (a.level === b.level ? b.recent - a.recent : a.level === 'high' ? -1 : 1));
}

export function acknowledge(alert, user) {
  return setDoc(doc(db, 'alert_actions', alert.geo.name), {
    province: alert.geo.name,
    level: alert.level,
    acknowledged_at: serverTimestamp(),
    acknowledged_by: user?.full_name || user?.email || '',
  }, { merge: true });
}

export function template(kind, provinces, disease) {
  const where = provinces.length === 1 ? `จ.${provinces[0]}` : provinces.length ? `${provinces.length} จังหวัด` : 'พื้นที่ของคุณ';
  const what = disease || 'โรคข้าว';
  if (kind === 'high') {
    return {
      title: `เตือนภัย: พบ${what}ระบาดใน ${where}`,
      body: `ระบบตรวจพบ${what}เพิ่มขึ้นในพื้นที่ของคุณ ขอให้${ADVICE.high[0]} ${ADVICE.high[1]} และ${ADVICE.high[2]}`,
    };
  }
  if (kind === 'medium') {
    return {
      title: `เฝ้าระวัง: พบ${what}ใน ${where}`,
      body: `มีรายงาน${what}ในพื้นที่ใกล้เคียง ขอให้${ADVICE.medium[0]} ${ADVICE.medium[1]} และ${ADVICE.medium[2]}`,
    };
  }
  return { title: '', body: '' };
}

/**
 * Sends one notification per recipient. The mobile app shows it in its bell,
 * pops it up on the phone (live listener / 15-min background check) and, when
 * the `sendBroadcastPush` Cloud Function is deployed, pushes it instantly via FCM.
 * The broadcast doc is written first so delivery counters can land on it.
 */
export async function sendBroadcast({ provinces, recipients, title, body, level, audience = 'provinces', test = false }, user) {
  const ids = [...recipients];
  const ref = doc(collection(db, 'broadcasts'));
  const place = audience === 'all' ? 'ทุกพื้นที่' : provinces.length === 1 ? `จ.${provinces[0]}` : provinces.join(', ');
  await setDoc(ref, {
    title,
    body,
    level: level || 'custom',
    audience,
    provinces,
    recipients: ids.length,
    test,
    status: 'sending',
    sent_by: user?.uid || '',
    sent_by_name: user?.full_name || user?.email || '',
    sent_at: serverTimestamp(),
  });
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const uid of ids.slice(i, i + 400)) {
      batch.set(doc(collection(db, 'notifications')), {
        user_id: uid,
        // older app builds key the red "urgent" style off this type
        type: 'disease_alert',
        kind: 'broadcast',
        level: level || 'custom',
        title,
        body,
        is_read: false,
        location: place,
        broadcast_id: ref.id,
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  const batch = writeBatch(db);
  batch.update(ref, { status: 'sent' });
  if (!test) {
    for (const p of provinces) {
      batch.set(doc(db, 'alert_actions', p), {
        province: p,
        last_broadcast_at: serverTimestamp(),
        acknowledged_at: serverTimestamp(),
        acknowledged_by: user?.full_name || user?.email || '',
        broadcasts: increment(1),
      }, { merge: true });
    }
  }
  await batch.commit();
  return ref.id;
}

/** Delivery for one broadcast: how many notifications were read / pushed. */
export async function deliveryStats(broadcastId) {
  const base = [collection(db, 'notifications'), where('broadcast_id', '==', broadcastId)];
  const [total, read, pushed, noDevice] = await Promise.all([
    getCountFromServer(query(...base)),
    getCountFromServer(query(...base, where('is_read', '==', true))),
    getCountFromServer(query(...base, where('push_status', '==', 'sent'))),
    getCountFromServer(query(...base, where('push_status', '==', 'no_device'))),
  ]);
  return { total: total.data().count, read: read.data().count, pushed: pushed.data().count, noDevice: noDevice.data().count };
}

/** Recipient list for one broadcast (for the detail drawer). */
export async function deliveryList(broadcastId) {
  const snap = await getDocs(query(collection(db, 'notifications'), where('broadcast_id', '==', broadcastId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
