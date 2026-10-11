// Android beta download: build info (public/downloads/rice-ai-beta.json) and a public
// download counter (Firestore stats/app_beta, rules only allow +1 per write).
import { useEffect, useState } from 'react';
import { doc, increment, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const COUNTER = doc(db, 'stats', 'app_beta');
const COUNTED_KEY = 'rice-ai-beta-counted';

export function useBetaApp() {
  const [info, setInfo] = useState(null);
  const [downloads, setDownloads] = useState(null);

  useEffect(() => {
    let live = true;
    fetch('/downloads/rice-ai-beta.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setInfo(j))
      .catch(() => {});
    const unsub = onSnapshot(COUNTER, (s) => setDownloads(s.exists() ? s.data().downloads || 0 : 0), () => setDownloads(null));
    return () => { live = false; unsub(); };
  }, []);

  return { info, downloads };
}

// Counts one download per browser per version, so reloading and clicking again doesn't inflate it.
export function countDownload(version) {
  try {
    if (localStorage.getItem(COUNTED_KEY) === version) return;
    localStorage.setItem(COUNTED_KEY, version);
  } catch { /* private mode: still count */ }
  setDoc(COUNTER, { downloads: increment(1), last_download_at: serverTimestamp() }, { merge: true }).catch(() => {});
}
