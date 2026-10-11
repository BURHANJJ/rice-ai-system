/**
 * Rice AI — push delivery for outbreak broadcasts.
 *
 * The web portal's alert centre writes one `notifications` doc per farmer
 * (kind: "broadcast"). This trigger pushes each one to that farmer's phones
 * through FCM, prunes dead tokens, and keeps delivery counts on the broadcast.
 *
 * Needs the Blaze plan. Deploy: firebase deploy --only functions
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

exports.sendBroadcastPush = onDocumentCreated(
  // same region as the Firestore database
  { document: 'notifications/{id}', region: 'asia-southeast1', retry: false },
  async (event) => {
    const snap = event.data;
    const n = snap?.data();
    if (!n || n.kind !== 'broadcast' || !n.user_id) return;

    const db = getFirestore();
    const bump = (field) => (n.broadcast_id
      ? db.doc(`broadcasts/${n.broadcast_id}`).update({ [field]: FieldValue.increment(1) }).catch(() => {})
      : null);

    const userRef = db.doc(`users/${n.user_id}`);
    const user = await userRef.get();
    const tokens = [...new Set((user.get('fcm_tokens') || []).filter(Boolean))];
    if (!tokens.length) {
      await snap.ref.update({ push_status: 'no_device' });
      await bump('push_no_device');
      return;
    }

    const title = String(n.title || 'ประกาศจากเจ้าหน้าที่');
    const body = String(n.body || '');
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      // data-only on Android so the app shows it in its own high-priority channel
      data: { notification_id: event.params.id, title, body, level: String(n.level || ''), broadcast_id: String(n.broadcast_id || '') },
      android: { priority: 'high', ttl: 3 * 24 * 60 * 60 * 1000 },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { alert: { title, body }, sound: 'default' } },
      },
    });

    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success && DEAD_TOKEN.has(r.error?.code)) dead.push(tokens[i]);
    });
    if (dead.length) await userRef.update({ fcm_tokens: FieldValue.arrayRemove(...dead) });

    const ok = res.successCount > 0;
    await snap.ref.update({
      push_status: ok ? 'sent' : 'failed',
      push_sent_at: FieldValue.serverTimestamp(),
      push_devices: res.successCount,
    });
    await bump(ok ? 'push_sent' : 'push_failed');
    if (!ok) logger.warn('push failed', { id: event.params.id, codes: res.responses.map((r) => r.error?.code) });
  },
);
