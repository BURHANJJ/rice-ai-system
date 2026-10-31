// Promote an existing account to admin. Run it once, after you have signed up in your own project.
//
//   1. Firebase console -> Project settings -> Service accounts -> Generate new private key
//      (keep that file private: it is a full-access credential and is git-ignored here)
//   2. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/that-key.json
//   3. node make-admin.mjs you@example.com
//
// It uses the Admin SDK on purpose: the security rules do not let any client, including a
// signed-in user, give themselves the admin role.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node make-admin.mjs <email>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

const user = await getAuth().getUserByEmail(email);
await getFirestore().doc(`users/${user.uid}`).set(
  { email, role: 'admin', status: 'active', updated_at: FieldValue.serverTimestamp() },
  { merge: true },
);
console.log(`${email} (${user.uid}) is now an admin.`);
