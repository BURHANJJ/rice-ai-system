// Security tests for firestore.rules. Run with `npm test` in this folder (starts the Firestore emulator).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

let env;

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rice-ai',
    firestore: { rules: readFileSync(process.env.RULES_FILE || new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin'), { role: 'admin', status: 'active', full_name: 'Admin' });
    await setDoc(doc(db, 'users/farmer'), { role: 'farmer', status: 'active', full_name: 'Farmer' });
    await setDoc(doc(db, 'users/other'), { role: 'farmer', status: 'active', full_name: 'Other' });
    await setDoc(doc(db, 'users/blocked'), { role: 'farmer', status: 'suspended', full_name: 'Blocked' });
    await setDoc(doc(db, 'users/pending'), { role: 'researcher', status: 'pending', full_name: 'Pending' });
    await setDoc(doc(db, 'diagnoses/d1'), { user_id: 'farmer', disease_code: 'BLAST', location: null });
    await setDoc(doc(db, 'fields/f1'), { user_id: 'farmer', name: 'Plot' });
  });
});

describe('users: nobody can grant themselves privileges', () => {
  it('a signed-in user cannot make themselves admin', async () => {
    await assertFails(updateDoc(doc(as('farmer'), 'users/farmer'), { role: 'admin' }));
  });

  it('a suspended user cannot reactivate themselves', async () => {
    await assertFails(updateDoc(doc(as('blocked'), 'users/blocked'), { status: 'active' }));
  });

  it('a pending researcher cannot approve themselves', async () => {
    await assertFails(updateDoc(doc(as('pending'), 'users/pending'), { status: 'active' }));
    await assertFails(updateDoc(doc(as('pending'), 'users/pending'), { role: 'admin' }));
  });

  it('merge-writing role or status onto your own profile is refused', async () => {
    await assertFails(setDoc(doc(as('farmer'), 'users/farmer'), { role: 'admin' }, { merge: true }));
  });

  it('a new account cannot be created as admin, or as an approved researcher', async () => {
    await assertFails(setDoc(doc(as('new1'), 'users/new1'), { role: 'admin', status: 'active' }));
    await assertFails(setDoc(doc(as('new2'), 'users/new2'), { role: 'researcher', status: 'active' }));
  });

  it('nobody can create a profile under someone else\'s uid', async () => {
    await assertFails(setDoc(doc(as('farmer'), 'users/victim'), { role: 'farmer', status: 'active' }));
  });
});

describe('users: normal sign-up and profile edits still work', () => {
  it('mobile sign-up creates a farmer profile', async () => {
    await assertSucceeds(setDoc(doc(as('new'), 'users/new'), { username: 'n', email: 'n@x.co', full_name: 'N', role: 'farmer', status: 'active', created_at: serverTimestamp() }));
  });

  it('web application creates a pending researcher profile', async () => {
    await assertSucceeds(setDoc(doc(as('res'), 'users/res'), { email: 'r@x.ac.th', role: 'researcher', status: 'pending', institution: 'PSU', created_at: serverTimestamp() }));
  });

  it('owners edit their profile, settings and push tokens', async () => {
    const db = as('farmer');
    await assertSucceeds(updateDoc(doc(db, 'users/farmer'), { full_name: 'New Name', phone: '0000000000', updated_at: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'users/farmer'), { 'settings.language': 'th' }));
    await assertSucceeds(setDoc(doc(db, 'users/farmer'), { fcm_tokens: arrayUnion('t'), notifications_enabled: true }, { merge: true }));
    await assertSucceeds(updateDoc(doc(db, 'users/farmer'), { last_login_at: serverTimestamp() }));
  });

  it('re-saving the same role and status is not a change', async () => {
    await assertSucceeds(setDoc(doc(as('pending'), 'users/pending'), { role: 'researcher', status: 'pending', institution: 'PSU' }, { merge: true }));
  });

  it('admins can change roles, status and delete accounts', async () => {
    const db = as('admin');
    await assertSucceeds(updateDoc(doc(db, 'users/pending'), { status: 'active' }));
    await assertSucceeds(updateDoc(doc(db, 'users/other'), { role: 'researcher' }));
    await assertSucceeds(deleteDoc(doc(db, 'users/blocked')));
  });

  it('profiles are private: owner and admin only', async () => {
    await assertSucceeds(getDoc(doc(as('farmer'), 'users/farmer')));
    await assertSucceeds(getDoc(doc(as('admin'), 'users/farmer')));
    await assertFails(getDoc(doc(as('other'), 'users/farmer')));
    await assertFails(getDoc(doc(anon(), 'users/farmer')));
  });

  it('users cannot delete accounts', async () => {
    await assertFails(deleteDoc(doc(as('farmer'), 'users/farmer')));
  });
});

describe('audit_logs: append-only', () => {
  const entry = () => ({ activity: 'x', severity: 'info', details: '', user_id: 'farmer', timestamp: serverTimestamp() });

  it('signed-in users can add an entry, anonymous cannot', async () => {
    await assertSucceeds(addDoc(collection(as('farmer'), 'audit_logs'), entry()));
    await assertFails(addDoc(collection(anon(), 'audit_logs'), entry()));
  });

  it('no one can edit or delete an entry, admins included', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'audit_logs/a1'), entry()));
    for (const uid of ['farmer', 'admin']) {
      await assertFails(updateDoc(doc(as(uid), 'audit_logs/a1'), { details: 'tampered' }));
      await assertFails(deleteDoc(doc(as(uid), 'audit_logs/a1')));
    }
  });

  it('only admins can read the log', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'audit_logs/a1'), entry()));
    await assertSucceeds(getDoc(doc(as('admin'), 'audit_logs/a1')));
    await assertFails(getDoc(doc(as('farmer'), 'audit_logs/a1')));
  });
});

describe('diagnoses, fields and everything else', () => {
  it('a scan must be saved under your own user_id', async () => {
    await assertSucceeds(setDoc(doc(as('farmer'), 'diagnoses/new'), { user_id: 'farmer', disease_code: 'BLB' }));
    await assertFails(setDoc(doc(as('farmer'), 'diagnoses/forged'), { user_id: 'other', disease_code: 'BLB' }));
    await assertFails(setDoc(doc(anon(), 'diagnoses/anon'), { user_id: 'farmer', disease_code: 'BLB' }));
  });

  it('owners may only attach a location to their scan', async () => {
    await assertSucceeds(updateDoc(doc(as('farmer'), 'diagnoses/d1'), { location: { latitude: 6.8, longitude: 101.2 } }));
    await assertFails(updateDoc(doc(as('farmer'), 'diagnoses/d1'), { disease_code: 'HEALTHY' }));
    await assertFails(updateDoc(doc(as('other'), 'diagnoses/d1'), { location: { latitude: 0, longitude: 0 } }));
  });

  it('only admins can delete scans', async () => {
    await assertFails(deleteDoc(doc(as('farmer'), 'diagnoses/d1')));
    await assertSucceeds(deleteDoc(doc(as('admin'), 'diagnoses/d1')));
  });

  it('the field notebook is private to its owner', async () => {
    await assertSucceeds(getDoc(doc(as('farmer'), 'fields/f1')));
    await assertFails(getDoc(doc(as('other'), 'fields/f1')));
    await assertFails(getDoc(doc(as('admin'), 'fields/f1')));
    await assertFails(updateDoc(doc(as('farmer'), 'fields/f1'), { user_id: 'other' }));
  });

  it('human review of AI results is admin-only', async () => {
    await assertFails(setDoc(doc(as('farmer'), 'reviews/d1'), { verdict: 'ok' }));
    await assertSucceeds(setDoc(doc(as('admin'), 'reviews/d1'), { verdict: 'ok' }));
  });

  it('system settings: public read, admin write', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'settings/site')));
    await assertFails(setDoc(doc(as('farmer'), 'settings/site'), { banner: 'x' }));
    await assertSucceeds(setDoc(doc(as('admin'), 'settings/site'), { banner: 'x' }));
  });

  it('feedback: anyone can submit a valid report, only admins read it', async () => {
    const report = (over = {}) => ({
      category: 'issue', subject: 'Map is slow', message: 'The outbreak map takes a long time to load.', full_name: 'A', email: '',
      user_id: '', source_path: '/', status: 'new', admin_note: '', consent: true,
      consented_at: serverTimestamp(), created_at: serverTimestamp(), updated_at: serverTimestamp(), ...over,
    });
    await assertSucceeds(setDoc(doc(anon(), 'feedback/ok'), report()));
    await assertFails(setDoc(doc(anon(), 'feedback/noconsent'), report({ consent: false })));
    await assertFails(setDoc(doc(anon(), 'feedback/elevated'), report({ status: 'resolved' })));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'feedback/seen'), { subject: 's' }));
    await assertFails(getDoc(doc(anon(), 'feedback/seen')));
    await assertFails(getDoc(doc(as('farmer'), 'feedback/seen')));
    await assertSucceeds(getDoc(doc(as('admin'), 'feedback/seen')));
  });

  it('collections that are not listed are denied', async () => {
    await assertFails(setDoc(doc(as('admin'), 'secrets/x'), { v: 1 }));
    await assertFails(getDoc(doc(as('admin'), 'secrets/x')));
  });
});
