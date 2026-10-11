import { useMemo, useSyncExternalStore } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { diseases as BASE } from './riceDiseases';

/**
 * The encyclopedia ships with the Rice Department content in riceDiseases.js.
 * Admin edits are stored per disease in wiki_content/{slug} and laid over it,
 * so "reset" simply deletes the override.
 */

export const slugOf = (d) => d.tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const isCaution = (text) => /^(ไม่ควร|ไม่ใช้|หลีกเลี่ยง|ห้าม)/.test(text);

export const EDITABLE = ['name', 'category', 'cause', 'found', 'risk', 'symptoms', 'prevention', 'control', 'chemicals', 'published', 'source'];

let state = { overrides: {}, loaded: false };
let unsub = null;
const ls = new Set();
function sub(l) {
  ls.add(l);
  if (!unsub) {
    unsub = onSnapshot(
      collection(db, 'wiki_content'),
      (snap) => {
        const o = {};
        snap.forEach((d) => { const x = d.data(); o[d.id] = { ...x, at: x.updated_at?.toDate?.() || null }; });
        state = { overrides: o, loaded: true };
        ls.forEach((x) => x());
      },
      () => { state = { overrides: {}, loaded: true }; ls.forEach((x) => x()); },
    );
  }
  return () => ls.delete(l);
}

export function useWikiOverrides() {
  return useSyncExternalStore(sub, () => state);
}

export function applyOverride(d, o) {
  if (!o) return { chemicals: [], ...d };
  const merged = { chemicals: [], ...d };
  for (const k of EDITABLE) if (o[k] !== undefined) merged[k] = o[k];
  if (Array.isArray(o.images)) {
    merged.images = o.images.filter((im) => !im.hidden).map(({ hidden: _hidden, ...im }) => im);
    const cover = merged.images[0];
    merged.thumb = cover && cover.src === d.images[0]?.src ? d.thumb : cover?.src || d.thumb;
  }
  merged.hidden = !!o.hidden;
  return merged;
}

/** A disease added by an admin lives entirely in wiki_content/{slug} with custom: true. */
export function customToDisease(o) {
  const images = (o.images || []).filter((im) => !im.hidden).map(({ hidden: _hidden, ...im }) => im);
  return {
    name: o.name || '',
    tag: o.tag || '',
    category: o.category || 'เชื้อรา',
    cause: o.cause || '',
    found: o.found || '',
    risk: o.risk || '',
    symptoms: o.symptoms || [],
    prevention: o.prevention || [],
    control: o.control || [],
    chemicals: o.chemicals || [],
    published: o.published || '',
    source: o.source || '',
    images,
    thumb: images[0]?.src || '',
    hidden: !!o.hidden,
    custom: true,
  };
}

export const customEntries = (overrides) =>
  Object.entries(overrides).filter(([, o]) => o.custom).sort(([, a], [, b]) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));

/** Encyclopedia as the public sees it: defaults + published edits + added diseases, hidden entries removed. */
export function useWikiDiseases({ includeHidden = false } = {}) {
  const { overrides } = useWikiOverrides();
  return useMemo(() => {
    const list = [
      ...BASE.map((d) => applyOverride(d, overrides[slugOf(d)])),
      ...customEntries(overrides).map(([, o]) => customToDisease(o)).filter((d) => d.images.length),
    ];
    return includeHidden ? list : list.filter((d) => !d.hidden);
  }, [overrides, includeHidden]);
}

export function createDisease(slug, data, user) {
  return setDoc(doc(db, 'wiki_content', slug), {
    ...data,
    custom: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    updated_by: user?.full_name || user?.email || '',
  });
}

export function saveWiki(slug, data, user) {
  return setDoc(doc(db, 'wiki_content', slug), { ...data, updated_at: serverTimestamp(), updated_by: user?.full_name || user?.email || '' }, { merge: !!data.custom });
}

/** Downscales a photo to a JPEG data URL small enough to keep a document under Firestore's 1 MiB limit. */
export function imageToDataUrl(file, max = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * k);
      const h = Math.round(img.height * k);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ src: c.toDataURL('image/jpeg', quality), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์ภาพไม่ได้')); };
    img.src = url;
  });
}

/** Reset for a Rice Department entry (drops the edits); permanent delete for an added disease. */
export const resetWiki = (slug) => deleteDoc(doc(db, 'wiki_content', slug));
