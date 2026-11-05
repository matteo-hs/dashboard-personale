'use strict';
/* Componenti condivisi: icone, modali, card task, editor, popup collegamenti */

const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calX: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m10 14 4 4M14 14l-4 4"/>',
  calPlus: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M12 13v6M9 16h6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  chevUp: '<path d="m18 15-6-6-6 6"/>',
  coffee: '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v3M10 2v3M14 2v3"/>',
  list: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  hourglass: '<path d="M6 2h12M6 22h12"/><path d="M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  cornerDR: '<path d="M4 4v7a4 4 0 0 0 4 4h12"/><path d="m15 10 5 5-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  sunrise: '<path d="M12 2v6M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M16 18a4 4 0 0 0-8 0"/><path d="m9 5 3-3 3 3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
};
const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
/* Icona del titolo di sezione in riquadro colorato (la tonalità arriva dalla classe tone-* del contenitore) */
const ibadge = (name, cls = '') => `<span class="ibadge ${cls}">${icon(name)}</span>`;

function statusDot(s) {
  const a = `class="sdot st-${s}" viewBox="0 0 16 16" aria-hidden="true"`;
  switch (s) {
    case 'done': return `<svg ${a}><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.8 8.2l2.1 2.1 4.3-4.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'doing': return `<svg ${a}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4Z" fill="currentColor"/></svg>`;
    case 'waiting': return `<svg ${a}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.6 1.9"/><path d="M6.5 5.6v4.8M9.5 5.6v4.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
    case 'cancelled': return `<svg ${a}><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    default: return `<svg ${a}><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
}

/* Registri di azioni delegate (click / change / submit) */
const Actions = {};
const Changes = {};
const Forms = {};

const UI = (() => {
  const expanded = new Set(); // task con commenti aperti
  let stack = [];

  /* ---------- Modali ---------- */
  function openModal({ title, body, footer, cls = '', onClose, headExtra = '' }) {
    const bd = U.h(`<div class="modal-backdrop"><div class="modal ${cls}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2 class="modal-title"></h2>${headExtra}
        <button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Chiudi">${icon('x')}</button></div>
      <div class="modal-body ${footer ? '' : 'pb'}"></div>${footer ? '<div class="modal-foot"></div>' : ''}</div></div>`);
    bd.querySelector('.modal-title').textContent = title;
    const bodyEl = bd.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.append(body);
    if (footer) bd.querySelector('.modal-foot').append(...footer);
    let closed = false;
    const api = { el: bd, body: bodyEl, close };
    function close() {
      if (closed) return; closed = true;
      bd.remove();
      stack = stack.filter(m => m !== api);
      document.removeEventListener('keydown', onKey);
      if (!stack.length) document.body.style.overflow = '';
      onClose && onClose();
    }
    function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === api) close(); }
    bd.addEventListener('mousedown', e => { if (e.target === bd) close(); });
    bd.querySelector('[data-close]').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.append(bd);
    document.body.style.overflow = 'hidden';
    stack.push(api);
    setTimeout(() => { const f = bodyEl.querySelector('[autofocus]'); if (f && window.matchMedia('(pointer: fine)').matches) f.focus(); }, 40);
    return api;
  }
  const isModalOpen = () => stack.length > 0;
  const closeAll = () => [...stack].forEach(m => m.close());

  function btn(label, cls, onClick, ic) {
    const b = U.h(`<button type="button" class="btn ${cls || ''}">${ic ? icon(ic) : ''}<span>${U.esc(label)}</span></button>`);
    b.addEventListener('click', onClick);
    return b;
  }
  function confirm(message, { ok = 'Conferma', danger = false, title = 'Conferma' } = {}) {
    return new Promise(res => {
      let answered = false;
      const m = openModal({
        title, cls: 'modal-sm', body: `<p class="confirm-msg">${U.esc(message)}</p>`,
        footer: [
          btn('Annulla', '', () => { answered = true; m.close(); res(false); }),
          btn(ok, danger ? 'btn-danger' : 'btn-primary', () => { answered = true; m.close(); res(true); }),
        ],
        onClose: () => { if (!answered) res(false); },
      });
    });
  }
  function toast(msg, action) {
    const t = U.h('<div class="toast"><span></span></div>');
    t.firstChild.textContent = msg;
    if (action) {
      const b = U.h(`<button class="toast-btn">${U.esc(action.label)}</button>`);
      b.addEventListener('click', () => { action.run(); t.remove(); });
      t.append(b);
    }
    document.getElementById('toasts').append(t);
    setTimeout(() => t.classList.add('out'), action ? 5200 : 2600);
    setTimeout(() => t.remove(), action ? 5600 : 3000);
  }

  /* ---------- Frammenti ---------- */
  function labelChip(l, clickable = true) {
    const inner = `${l.type === 'project' ? icon('folder', 'ic-xs') : '<span class="dot"></span>'}${U.esc(l.name)}`;
    return clickable
      ? `<button type="button" class="chip" style="--c:${l.color}" data-act="label" data-label="${l.id}" title="Mostra i task con questa etichetta">${inner}</button>`
      : `<span class="chip static" style="--c:${l.color}">${inner}</span>`;
  }
  const personChip = p => `<span class="person" title="${U.esc(p.role || '')}"><span class="avatar" style="--pc:${p.color}">${U.esc(U.initials(p.name))}</span>${U.esc(p.name)}</span>`;
  const statusPill = s => `<span class="status-pill st-${s}">${statusDot(s)}${STATUS[s].label}</span>`;
  const taskColor = t => { const l = t.labels.map(Store.label).find(Boolean); return l ? l.color : 'var(--border-strong)'; };
  const sourceBadge = t => t.source === 'calendar' ? `<span class="source-badge" title="Inserito dal calendario">${icon('calendar')}Da calendario</span>`
    : t.source === 'email' ? `<span class="source-badge mail">${icon('mail')}Da email</span>` : '';

  /* Riga task compatta per l'agenda a righe.
     La casella a sinistra è il comando "completa"; a destra: modifica, elimina, calendario, commenti, collegati. */
  function taskLine(t) {
    const ls = t.labels.map(Store.label).filter(Boolean);
    const ps = t.people.map(Store.person).filter(Boolean);
    const time = U.timeRange(t);
    const done = t.status === 'done';
    const nRel = Store.relatedCount(t.id);
    const open = expanded.has(t.id);
    return `<article class="ln st-${t.status} ${t.source === 'calendar' ? 'from-cal' : ''}" style="--c:${taskColor(t)}" data-task="${t.id}">
      <button type="button" class="check" data-act="toggle-done" data-id="${t.id}" aria-label="${done ? 'Riapri' : 'Segna come completato'}" title="${done ? 'Riapri' : 'Segna come completato'}">${icon('check')}</button>
      <div class="ln-main">
        <div class="ln-head">${time ? `<span class="ln-time">${time}</span>` : ''}<span class="ln-title">${U.esc(t.title)}</span></div>
        <div class="ln-meta">${sourceBadge(t)}${['doing', 'waiting', 'cancelled'].includes(t.status) ? statusPill(t.status) : ''}${ls.map(l => labelChip(l)).join('')}${ps.map(personChip).join('')}</div>
        ${t.notes ? `<div class="ln-notes">${U.esc(t.notes)}</div>` : ''}
        ${open ? commentsBlock(t) : ''}
      </div>
      <div class="ln-acts">
        <button type="button" class="act" data-act="edit" data-id="${t.id}" title="Modifica" aria-label="Modifica">${icon('edit')}</button>
        <button type="button" class="act danger" data-act="delete" data-id="${t.id}" title="Elimina" aria-label="Elimina">${icon('trash')}</button>
        <button type="button" class="act ${t.inCalendar ? 'on' : ''}" data-act="cal" data-id="${t.id}" title="${t.inCalendar ? 'In calendario: clic per rimuovere' : 'Invia al calendario'}" aria-label="Calendario">${icon(t.inCalendar ? 'calendar' : 'calPlus')}</button>
        <button type="button" class="act" data-act="comments" data-id="${t.id}" title="Commenti" aria-label="Commenti">${icon('message')}${t.comments.length ? `<span class="n">${t.comments.length}</span>` : ''}</button>
        <button type="button" class="act" data-act="links" data-id="${t.id}" title="Task collegati" aria-label="Collegati">${icon('link')}${nRel ? `<span class="n">${nRel}</span>` : ''}</button>
      </div>
    </article>`;
  }

  function commentsBlock(t) {
    const list = t.comments.map(c => `<div class="comment"><div class="comment-text">${U.esc(c.text)}</div>
      <div class="comment-meta"><time>${U.fmtStamp(c.ts)}</time><button type="button" class="link-btn" data-act="del-comment" data-id="${t.id}" data-cid="${c.id}">elimina</button></div></div>`).join('');
    return `<div class="comments">${list || '<div class="muted small">Nessun commento.</div>'}
      <form class="comment-form" data-form="comment" data-id="${t.id}">
        <input class="input" name="text" placeholder="Aggiungi un commento…" autocomplete="off">
        <button class="btn btn-sm btn-primary" type="submit">Aggiungi</button>
      </form></div>`;
  }

  /* ---------- Timeline task (popup etichette / collegati) ---------- */
  function timeline(list) {
    if (!list.length) return '<div class="empty">Nessun task.</div>';
    const T = U.todayISO();
    let out = '', marker = false;
    const nowLine = `<div class="tl-now">Oggi · ${U.fmtShort(T)}</div>`;
    for (const t of list) {
      if (!marker && t.date >= T) { out += nowLine; marker = true; }
      const rel = U.relDay(t.date);
      const time = U.timeRange(t);
      out += `<div class="tl-item st-${t.status} ${t.date === T ? 'is-today' : ''}">${statusDot(t.status)}
        <div class="tl-main"><div class="tl-title">${U.esc(t.title)}</div>
          <div class="tl-sub">${U.cap(U.fmtShort(t.date))}${rel ? ' · ' + rel : ''}${time ? ' · ' + time : ''} · ${STATUS[t.status].label}</div></div>
        <button type="button" class="btn btn-sm" data-act="goto" data-date="${t.date}">Apri${icon('arrowR')}</button></div>`;
    }
    if (!marker) out += nowLine;
    return `<div class="timeline">${out}</div>`;
  }
  function statsBlock(list) {
    const done = list.filter(t => t.status === 'done').length;
    const canc = list.filter(t => t.status === 'cancelled').length;
    const open = list.length - done - canc;
    const pct = list.length - canc ? Math.round(done / (list.length - canc) * 100) : 0;
    return `<div class="stats-row">
      <div class="stat s-done"><b>${done}</b><span>Completati</span></div>
      <div class="stat s-open"><b>${open}</b><span>Aperti</span></div>
      <div class="stat s-canc"><b>${canc}</b><span>Annullati</span></div></div>
      <div class="bar" title="${pct}% completato"><span style="width:${pct}%"></span></div>`;
  }
  function showLabelTasks(labelId) {
    const l = Store.label(labelId); if (!l) return;
    const list = Store.tasksWithLabel(labelId);
    openModal({
      title: l.type === 'project' ? `Progetto ${l.name}` : l.name, cls: 'modal-md',
      headExtra: `<span class="chip static" style="--c:${l.color}"><span class="dot"></span>${list.length} task</span>`,
      body: `${statsBlock(list)}<div class="tl-section">${timeline(list)}</div>`,
    });
  }
  function showRelated(taskId) {
    const t = Store.task(taskId); if (!t) return;
    const r = Store.related(taskId);
    let html = `<div class="tl-section"><h3>${icon('link', 'ic-xs')}Collegamenti diretti</h3>${r.direct.length ? timeline(r.direct)
      : '<div class="empty">Nessun collegamento diretto. Puoi aggiungerli con «Modifica».</div>'}</div>`;
    r.byProject.forEach(g => {
      html += `<div class="tl-section"><h3>${icon('folder', 'ic-xs')}Progetto ${U.esc(g.label.name)}</h3>${timeline(g.tasks)}</div>`;
    });
    if (!r.byProject.length) html += '<p class="form-hint" style="margin-top:14px">Suggerimento: assegna un\'etichetta di progetto per collegare automaticamente tutti i task che la condividono.</p>';
    openModal({ title: `Collegati a «${t.title}»`, cls: 'modal-md', body: html });
  }

  /* ---------- Editor task ---------- */
  function openTaskEditor(task, defaults = {}) {
    const isNew = !task;
    const d = isNew
      ? { title: '', date: defaults.date || U.todayISO(), start: defaults.start || '', end: defaults.end || '', labels: [...(defaults.labels || [])],
          people: [], notes: '', status: 'todo', source: defaults.source || 'manual', links: [], inCalendar: defaults.inCalendar }
      : JSON.parse(JSON.stringify(task));
    let calTouched = !isNew || defaults.inCalendar !== undefined;
    if (d.inCalendar === undefined) d.inCalendar = Store.autoCal(d.labels);
    let peopleSel = d.people.map(Store.person).filter(Boolean).map(p => ({ id: p.id, name: p.name, color: p.color }));
    const newProjects = [];

    const form = U.h(`<form class="form" novalidate autocomplete="off">
      ${d.source === 'calendar' ? `<div class="form-note cal">${icon('calendar')}Task inserito dal calendario: comparirà anche nell'agenda del giorno.</div>` : ''}
      <div class="field"><label for="f-title">Titolo</label>
        <input id="f-title" class="input input-lg" name="title" autofocus placeholder="Cosa devi fare?" value="${U.esc(d.title)}"></div>
      <div class="row3">
        <div class="field"><label>Data</label><input type="date" class="input" name="date" value="${d.date}"></div>
        <div class="field"><label>Inizio</label><input type="time" class="input" name="start" value="${d.start}"></div>
        <div class="field"><label>Fine</label><input type="time" class="input" name="end" value="${d.end}"></div>
      </div>
      <div class="field"><span class="flabel">Stato</span><div class="seg" data-role="status"></div></div>
      <div class="field"><span class="flabel">Etichette</span>
        <div class="chip-select" data-role="labels"></div>
        <div class="inline-add"><input class="input input-sm" data-role="proj-name" placeholder="Nuovo progetto (es. Campus Estate)">
          <button type="button" class="btn btn-sm" data-role="proj-add">${icon('plus')}Progetto</button></div></div>
      <div class="field"><span class="flabel">Persone coinvolte</span>
        <div class="people-sel" data-role="people"></div>
        <div class="inline-add"><input class="input input-sm" data-role="person-name" list="dl-people" placeholder="Nome, poi Invio">
          <button type="button" class="btn btn-sm" data-role="person-add">${icon('plus')}Aggiungi</button></div>
        <datalist id="dl-people">${Store.people().map(p => `<option value="${U.esc(p.name)}">`).join('')}</datalist></div>
      <label class="switch-row"><input type="checkbox" name="inCalendar" ${d.inCalendar ? 'checked' : ''}><span class="switch"></span>
        <span><strong>Mostra nel calendario</strong><small>Automatico per «Attività Didattica» e «Appuntamento»</small></span></label>
      <div class="field"><label>Note</label><textarea class="input" name="notes" rows="3" placeholder="Dettagli, materiali, riferimenti…">${U.esc(d.notes)}</textarea></div>
      <div class="field"><span class="flabel">Collegato a</span>
        <div class="links-sel" data-role="links"></div>
        <div class="suggest"><input class="input input-sm" data-role="link-search" placeholder="Cerca un task da collegare…">
          <div class="suggest-list" data-role="link-results" hidden></div></div></div>
    </form>`);
    const $ = r => form.querySelector(`[data-role="${r}"]`);
    const calBox = form.elements.inCalendar;

    function renderStatus() {
      $('status').innerHTML = STATUS_ORDER.map(s => `<button type="button" class="seg-btn ${d.status === s ? 'on' : ''}" data-v="${s}">${statusDot(s)}${STATUS[s].label}</button>`).join('');
    }
    function allLabelOptions() {
      return [...Store.baseLabels(), ...Store.projects(), ...newProjects];
    }
    function renderLabels() {
      $('labels').innerHTML = allLabelOptions().map(l =>
        `<button type="button" class="chip ${d.labels.includes(l.id) ? 'on' : ''}" style="--c:${l.color}" data-v="${l.id}">${l.type === 'project' ? icon('folder', 'ic-xs') : '<span class="dot"></span>'}${U.esc(l.name)}</button>`).join('');
    }
    function renderPeople() {
      $('people').innerHTML = peopleSel.map((p, i) => `<span class="person"><span class="avatar" style="--pc:${p.color || '#8892A6'}">${U.esc(U.initials(p.name))}</span>${U.esc(p.name)}
        <button type="button" class="rm" data-i="${i}" aria-label="Rimuovi">${icon('x')}</button></span>`).join('');
    }
    function renderLinks() {
      $('links').innerHTML = d.links.map(Store.task).filter(Boolean).map(x => `<div class="link-item">${statusDot(x.status)}
        <span class="li-title">${U.esc(x.title)}</span><span class="li-date">${U.fmtShort(x.date)}</span>
        <button type="button" class="rm" data-v="${x.id}" aria-label="Rimuovi collegamento">${icon('x')}</button></div>`).join('');
    }
    function syncCal() { if (!calTouched) { d.inCalendar = Store.autoCal(d.labels); calBox.checked = d.inCalendar; } }

    $('status').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { d.status = b.dataset.v; renderStatus(); } });
    $('labels').addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const id = b.dataset.v;
      d.labels = d.labels.includes(id) ? d.labels.filter(x => x !== id) : [...d.labels, id];
      renderLabels(); syncCal();
    });
    calBox.addEventListener('change', () => { calTouched = true; d.inCalendar = calBox.checked; });

    function addProjectFromInput() {
      const inp = $('proj-name'); const name = inp.value.trim(); if (!name) return;
      const ex = allLabelOptions().find(l => l.type === 'project' && l.name.toLowerCase() === name.toLowerCase());
      let id;
      if (ex) id = ex.id;
      else {
        id = 'tmp:' + U.uid();
        newProjects.push({ id, name, type: 'project', color: PROJECT_COLORS[(Store.projects().length + newProjects.length) % PROJECT_COLORS.length] });
      }
      if (!d.labels.includes(id)) d.labels.push(id);
      inp.value = ''; renderLabels(); syncCal();
    }
    $('proj-add').addEventListener('click', addProjectFromInput);
    $('proj-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addProjectFromInput(); } });

    function addPersonFromInput() {
      const inp = $('person-name'); const name = inp.value.trim(); if (!name) return;
      if (!peopleSel.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        const ex = Store.people().find(p => p.name.toLowerCase() === name.toLowerCase());
        peopleSel.push(ex ? { id: ex.id, name: ex.name, color: ex.color } : { id: null, name });
      }
      inp.value = ''; renderPeople();
    }
    $('person-add').addEventListener('click', addPersonFromInput);
    $('person-name').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPersonFromInput(); } });
    $('people').addEventListener('click', e => { const b = e.target.closest('.rm'); if (b) { peopleSel.splice(+b.dataset.i, 1); renderPeople(); } });

    // Ricerca task da collegare
    const res = $('link-results'), search = $('link-search');
    function showResults() {
      const q = search.value.trim().toLowerCase();
      const selfId = task ? task.id : null;
      let cand = Store.allTasks().filter(x => x.id !== selfId && !d.links.includes(x.id));
      if (q) cand = cand.filter(x => x.title.toLowerCase().includes(q)).sort(Store.byDateTime);
      else cand = cand.sort((a, b) => Math.abs(U.diffDays(d.date, a.date)) - Math.abs(U.diffDays(d.date, b.date)));
      cand = cand.slice(0, 8);
      res.innerHTML = cand.length ? cand.map(x => `<button type="button" class="suggest-item" data-v="${x.id}">${statusDot(x.status)}
        <span class="li-title">${U.esc(x.title)}</span><span class="li-date">${U.fmtShort(x.date)}</span></button>`).join('')
        : '<div class="suggest-empty">Nessun task trovato</div>';
      res.hidden = false;
    }
    search.addEventListener('focus', showResults);
    search.addEventListener('input', showResults);
    search.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); if (e.key === 'Escape') { e.stopPropagation(); res.hidden = true; } });
    search.addEventListener('blur', () => setTimeout(() => { res.hidden = true; }, 180));
    res.addEventListener('mousedown', e => e.preventDefault());
    res.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      d.links.push(b.dataset.v); search.value = ''; res.hidden = true; renderLinks(); search.blur();
    });
    $('links').addEventListener('click', e => { const b = e.target.closest('.rm'); if (b) { d.links = d.links.filter(x => x !== b.dataset.v); renderLinks(); } });

    renderStatus(); renderLabels(); renderPeople(); renderLinks();

    function save() {
      const titleIn = form.elements.title;
      const title = titleIn.value.trim();
      if (!title) { titleIn.classList.add('invalid'); titleIn.focus(); return; }
      let start = form.elements.start.value, end = form.elements.end.value;
      if (!start) end = '';
      if (start && end && end < start) [start, end] = [end, start];
      const labelIds = d.labels.map(id => {
        if (!id.startsWith('tmp:')) return id;
        const np = newProjects.find(p => p.id === id);
        return Store.addProject(np.name, { color: np.color }).id;
      });
      const peopleIds = peopleSel.map(p => p.id || Store.ensurePerson(p.name).id);
      const data = {
        title, date: form.elements.date.value || d.date, start, end, labels: labelIds, people: peopleIds,
        notes: form.elements.notes.value.trim(), status: d.status, inCalendar: calBox.checked, links: d.links.filter(id => Store.task(id)),
      };
      if (isNew) { Store.addTask({ ...data, source: d.source }); toast(data.inCalendar ? 'Task creato e visibile in calendario' : 'Task creato'); }
      else { Store.updateTask(task.id, data); toast('Modifiche salvate'); }
      m.close();
    }
    form.addEventListener('submit', e => { e.preventDefault(); save(); });
    form.elements.title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    form.elements.title.addEventListener('input', e => e.target.classList.remove('invalid'));

    const m = openModal({
      title: isNew ? (d.source === 'calendar' ? 'Nuovo task in calendario' : 'Nuovo task') : 'Modifica task',
      body: form,
      footer: [btn('Annulla', '', () => m.close()), btn(isNew ? 'Crea task' : 'Salva', 'btn-primary', save, 'check')],
    });
  }

  return {
    openModal, isModalOpen, closeAll, confirm, toast, btn, expanded,
    labelChip, personChip, statusPill, taskColor, sourceBadge, taskLine, timeline, statsBlock,
    showLabelTasks, showRelated, openTaskEditor,
  };
})();

/* ---------- Azioni comuni ---------- */
Object.assign(Actions, {
  'toggle-done': id => {
    const t = Store.toggleDone(id);
    if (t && t.status === 'done') UI.toast('Task completato');
  },
  edit: id => UI.openTaskEditor(Store.task(id)),
  delete: async id => {
    const t = Store.task(id); if (!t) return;
    const ok = await UI.confirm(`Eliminare «${t.title}»?`, { ok: 'Elimina', danger: true, title: 'Elimina task' });
    if (!ok) return;
    const copy = JSON.parse(JSON.stringify(t));
    Store.deleteTask(id);
    UI.toast('Task eliminato', { label: 'Annulla', run: () => Store.restoreTask(copy) });
  },
  cal: id => {
    const t = Store.toggleCalendar(id);
    if (t) UI.toast(t.inCalendar ? 'Inviato al calendario' : 'Rimosso dal calendario');
  },
  comments: id => {
    const ex = UI.expanded;
    if (ex.has(id)) ex.delete(id); else ex.add(id);
    App.render();
    if (ex.has(id)) setTimeout(() => { const i = document.querySelector(`.comment-form[data-id="${id}"] input`); if (i) i.focus(); }, 20);
  },
  'del-comment': (id, el) => Store.deleteComment(id, el.dataset.cid),
  links: id => UI.showRelated(id),
  label: (id, el) => UI.showLabelTasks(el.dataset.label),
  goto: (id, el) => { UI.closeAll(); location.hash = `#/agenda/${el.dataset.date}`; },
  'new-task': (id, el) => UI.openTaskEditor(null, { date: el.dataset.date, start: el.dataset.start || '', end: el.dataset.end || '' }),
  'cal-add': (id, el) => UI.openTaskEditor(null, { date: el.dataset.date, source: 'calendar', inCalendar: true }),
  'move-today': id => { Store.updateTask(id, { date: U.todayISO() }); UI.toast('Spostato a oggi'); },
});
Object.assign(Changes, {
  status: el => Store.setStatus(el.dataset.id, el.value),
});
Object.assign(Forms, {
  comment: f => {
    const input = f.elements.text;
    if (!input.value.trim()) return;
    const id = f.dataset.id;
    Store.addComment(id, input.value);
    setTimeout(() => { const i = document.querySelector(`.comment-form[data-id="${id}"] input`); if (i) i.focus(); }, 20);
  },
});
