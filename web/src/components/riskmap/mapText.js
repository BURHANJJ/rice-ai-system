// English labels for the outbreak map. The map data (provinces, risk keys, disease names
// saved with each scan) is Thai; these turn it into English when the public site is in English.
import { RISK, ADVICE } from './outbreakData';

export const RISK_EN = {
  high: { label: 'High risk', criteria: 'Disease found at ≥ 5 points', action: 'Alert agricultural officers now' },
  medium: { label: 'Watch', criteria: 'Disease found at 2–4 points', action: 'Watch nearby fields closely' },
  low: { label: 'Safe', criteria: 'Disease found at 0–1 points', action: 'Normal situation' },
};

export const ADVICE_EN = {
  high: ['Alert the sub-district agricultural officer now', 'Pull out and burn infected plants right away', 'Apply plant-protection products as recommended'],
  medium: ['Inspect fields closely every 3–5 days', 'Spray biological products against fungi and bacteria', 'Cut back on nitrogen fertiliser'],
  low: ['Inspect fields every 7–10 days', 'Fertilise according to soil analysis', 'Keep water at the right level'],
};

export const REGION_EN = { North: 'North', Northeast: 'Northeast', Central: 'Central', East: 'East', West: 'West', South: 'South' };

/** Risk label/criteria/action in the current language. */
export const riskText = (key, field, lang) => (lang === 'en' ? RISK_EN[key][field] : RISK[key][field]);
export const adviceList = (key, lang) => (lang === 'en' ? ADVICE_EN[key] : ADVICE[key]);

/** Province or district name: Thai, or the English name from the map data. */
export const placeName = (geo, lang) => (lang === 'en' ? geo.nameEn || geo.name : geo.name);

/** Region label for a region key such as "South". */
export const regionName = (key, regionTh, lang) => (lang === 'en' ? `${REGION_EN[key] || key}` : `ภาค${regionTh}`);

/** Scans save the Thai disease name; map the four classes the AI reports to English. */
export function diseaseName(name, lang) {
  if (lang !== 'en' || !name) return name;
  if (name.includes('ขอบใบแห้ง')) return 'Bacterial leaf blight';
  if (name.includes('ใบสีส้ม')) return 'Rice tungro';
  if (name.includes('ไหม้')) return 'Rice blast';
  if (name.includes('ปกติ')) return 'Healthy';
  return name;
}

/** Date as d/m/yyyy: Buddhist year in Thai, Gregorian in English. */
export const mapDate = (d, lang) => (d ? `${d.getDate()}/${d.getMonth() + 1}/${lang === 'en' ? d.getFullYear() : d.getFullYear() + 543}` : '–');
