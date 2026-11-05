'use strict';
/* Utility generiche: date, formattazione, DOM */
const U = (() => {
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);

  const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const WD_SHORT_MON = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtLong = iso => { const d = fromISO(iso); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtMid = iso => { const d = fromISO(iso); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const fmtShort = iso => { const d = fromISO(iso); return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
  const relDay = iso => {
    const n = diffDays(todayISO(), iso);
    if (n === 0) return 'Oggi';
    if (n === 1) return 'Domani';
    if (n === -1) return 'Ieri';
    return null;
  };
  const fmtStamp = ts => {
    const d = new Date(ts);
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const timeToMin = t => (t ? (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)) : null);
  const timeRange = t => (t.start ? (t.end ? `${t.start}–${t.end}` : t.start) : '');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const initials = name => name.trim().split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w[0])).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  return { pad, toISO, fromISO, todayISO, addDays, diffDays, MONTHS, WEEKDAYS, WD_SHORT_MON, cap, fmtLong, fmtMid, fmtShort, relDay, fmtStamp, timeToMin, timeRange, esc, uid, initials, h };
})();
