/**
 * Thailand province / district boundaries (simplified from OpenGISData-Thailand),
 * the same files the mobile app bundles: /public/geo/provinces.json and
 * /public/geo/districts/<provinceCode>.json. Each region: {c, n, e, r, p} where
 * p is a list of rings as flat [lon, lat, lon, lat, …] arrays.
 */

export const REGION_TH = {
  North: 'เหนือ',
  Northeast: 'อีสาน',
  Central: 'กลาง',
  East: 'ตะวันออก',
  West: 'ตะวันตก',
  South: 'ใต้',
};

function prepare(raw) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let best = -1, cx = 0, cy = 0;
  for (const r of raw.p) {
    let a = 0, sx = 0, sy = 0;
    for (let i = 0; i < r.length; i += 2) {
      const x = r[i], y = r[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const j = (i + 2) % r.length;
      const cross = x * r[j + 1] - r[j] * y;
      a += cross;
      sx += (x + r[j]) * cross;
      sy += (y + r[j + 1]) * cross;
    }
    if (Math.abs(a) > best && a !== 0) {
      best = Math.abs(a);
      cx = sx / (3 * a);
      cy = sy / (3 * a);
    }
  }
  return {
    code: raw.c,
    name: raw.n,
    nameEn: raw.e || '',
    region: raw.r || '',
    regionTh: REGION_TH[raw.r] || '',
    rings: raw.p,
    bounds: { minX, minY, maxX, maxY },
    label: best > 0 ? [cx, cy] : [(minX + maxX) / 2, (minY + maxY) / 2],
  };
}

const cache = new Map();
function load(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`geo ${r.status}`);
      return r.json();
    }).then((list) => list.map(prepare)).catch((e) => {
      cache.delete(url);
      throw e;
    }));
  }
  return cache.get(url);
}

export const loadProvinces = () => load('/geo/provinces.json');
export const loadDistricts = (provinceCode) => load(`/geo/districts/${provinceCode}.json`);

export function contains(region, lon, lat) {
  const b = region.bounds;
  if (lon < b.minX || lon > b.maxX || lat < b.minY || lat > b.maxY) return false;
  let inside = false;
  for (const r of region.rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** "อ.เมืองปัตตานี" / "เขตบางรัก" / "อำเภอเมือง" → bare district name. */
export const normalizeDistrict = (s = '') => String(s).replace(/^(อำเภอ|กิ่งอำเภอ|อ\.|เขต)\s*/, '').trim();

/** District label inside a free-text Thai address, if any. */
export function districtFromText(text = '') {
  const m = /(?:อ\.|อำเภอ|เขต)\s*([^\s,]+)/.exec(text);
  return m ? normalizeDistrict(m[1]) : null;
}
