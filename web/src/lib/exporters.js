import { logExport } from './audit';

/** CSV download that opens cleanly in Excel (UTF-8 BOM, quoted cells). */
export function downloadCSV(filename, columns, rows, dataset = '') {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','));
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  logExport({ fileName: a.download, fileType: 'CSV', recordCount: rows.length, dataset });
}

export const stamp = (d = new Date()) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

export const thaiDateTime = (d) =>
  d ? d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
