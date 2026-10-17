// Coordinates -> Thai address, the same way the app does it (mobile/lib/services/location_helper.dart):
// OpenStreetMap Nominatim, Thai names, "ต.… อ.… จ.…". Province is stored without the "จ." prefix.

const clean = (s, words) => words.reduce((v, w) => v.replaceAll(w, ''), s || '').trim();

/** Resolves to { address, province } or null when the lookup fails (no network, rate limit). */
export async function thaiAddress(latitude, longitude) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=th`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const a = (await res.json())?.address;
    if (!a) return null;
    const sub = clean(a.suburb || a.village || a.neighbourhood || a.town || a.hamlet, ['ตำบล', 'แขวง', 'ต.']);
    const district = clean(a.county || a.city_district || a.district, ['อำเภอ', 'เขต', 'อ.']);
    const province = clean(a.state || a.province || a.city, ['จังหวัด', 'จ.']);
    const address = [sub && `ต.${sub}`, district && `อ.${district}`, province && `จ.${province}`].filter(Boolean).join(' ');
    return { address: address || null, province: province || null };
  } catch {
    return null;
  }
}
