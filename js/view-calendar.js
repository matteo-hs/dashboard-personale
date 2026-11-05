'use strict';
/* Calendario mensile con pannello di dettaglio della giornata selezionata */
const CalendarView = (() => {
  let ym = U.todayISO().slice(0, 7);
  let sel = U.todayISO();
  let lastYm = null;
  let scrollToPanel = false;

  const shiftMonth = (ymStr, n) => {
    const [y, m] = ymStr.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
  };

  function cell(iso, inMonth) {
    const T = U.todayISO();
    const d = U.fromISO(iso);
    const wd = (d.getDay() + 6) % 7;
    const items = Store.calendarTasksOn(iso);
    const max = 3;
    const itemsHTML = items.slice(0, max).map(t =>
      `<span class="cal-item st-${t.status}" style="--c:${UI.taskColor(t)}" title="${U.esc(t.title)} · ${STATUS[t.status].label}">${statusDot(t.status)}
        <span class="t">${t.start ? `<b>${t.start}</b> ` : ''}${U.esc(t.title)}</span></span>`).join('');
    const dots = items.slice(0, 5).map(t => `<i class="st-${t.status}" style="--c:${UI.taskColor(t)}"></i>`).join('');
    const cls = [inMonth ? '' : 'out', iso === T ? 'today' : '', iso === sel ? 'sel' : '', wd >= 5 ? 'weekend' : ''].join(' ');
    return `<button type="button" class="cal-cell ${cls}" data-act="cal-select" data-date="${iso}" aria-label="${U.cap(U.fmtLong(iso))}, ${items.length} attività">
      <span class="cal-num">${d.getDate()}</span>${itemsHTML}
      ${items.length > max ? `<span class="cal-more">+${items.length - max} altri</span>` : ''}
      <span class="cal-dots">${dots}</span></button>`;
  }

  function panelRow(t) {
    const ls = t.labels.map(Store.label).filter(Boolean);
    const ps = t.people.map(Store.person).filter(Boolean);
    return `<div class="dp-row st-${t.status} ${t.source === 'calendar' ? 'from-cal' : ''}" style="--c:${UI.taskColor(t)}">
      <div class="dp-time">${t.start ? `<strong>${t.start}</strong>${t.end ? `<span>${t.end}</span>` : ''}` : '<span>tutto il<br>giorno</span>'}</div>
      <div class="dp-main">
        <div class="dp-name">${statusDot(t.status)}<span>${U.esc(t.title)}</span></div>
        <div class="task-meta">${UI.sourceBadge(t)}${ls.map(l => UI.labelChip(l)).join('')}${ps.map(UI.personChip).join('')}</div>
        ${t.notes ? `<div class="dp-notes">${U.esc(t.notes)}</div>` : ''}
      </div>
      <div class="dp-ctrl">
        <select class="input input-sm" data-change="status" data-id="${t.id}" aria-label="Stato">
          ${STATUS_ORDER.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${STATUS[s].label}</option>`).join('')}</select>
        <button class="btn btn-sm btn-ghost btn-icon" data-act="edit" data-id="${t.id}" title="Modifica" aria-label="Modifica">${icon('edit')}</button>
        <button class="btn btn-sm btn-ghost btn-icon" data-act="cal" data-id="${t.id}" title="Rimuovi dal calendario (resta in agenda)" aria-label="Rimuovi dal calendario">${icon('calX')}</button>
        <button class="btn btn-sm btn-ghost btn-icon danger" data-act="delete" data-id="${t.id}" title="Elimina" aria-label="Elimina">${icon('trash')}</button>
      </div></div>`;
  }

  function render(root, arg) {
    if (arg && /^\d{4}-\d{2}$/.test(arg)) ym = arg;
    if (sel.slice(0, 7) !== ym) {
      const T = U.todayISO();
      sel = T.slice(0, 7) === ym ? T : `${ym}-01`;
    }
    const anim = lastYm && lastYm !== ym ? (ym > lastYm ? 'cal-anim-next' : 'cal-anim-prev') : '';
    lastYm = ym;

    const [y, m] = ym.split('-').map(Number);
    const first = `${ym}-01`;
    const offset = (U.fromISO(first).getDay() + 6) % 7;
    const dim = new Date(y, m, 0).getDate();
    const weeks = Math.ceil((offset + dim) / 7);
    const start = U.addDays(first, -offset);
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const iso = U.addDays(start, i);
      cells += cell(iso, iso.slice(0, 7) === ym);
    }

    const list = Store.calendarTasksOn(sel);
    const others = Store.tasksOn(sel).length - list.length;
    const rel = U.relDay(sel);

    root.innerHTML = `<div class="view calendar">
      <header class="page-head">
        <div><h1 class="page-title">Calendario</h1>
          <p class="page-sub">Clicca una giornata per vederne le attività e aggiungerne di nuove</p></div>
      </header>
      <div class="card cal-card">
        <div class="cal-head">
          <div class="cal-title"><span class="cal-month">${U.MONTHS[m - 1]}</span><span class="cal-year">${y}</span></div>
          <div class="cal-nav">
            <button class="btn btn-icon" data-nav="prev" aria-label="Mese precedente" title="Mese precedente">${icon('chevL')}</button>
            <button class="btn" data-nav="today">Oggi</button>
            <button class="btn btn-icon" data-nav="next" aria-label="Mese successivo" title="Mese successivo">${icon('chevR')}</button>
          </div>
        </div>
        <div class="cal-wds">${U.WD_SHORT_MON.map(w => `<div class="cal-wd">${w}</div>`).join('')}</div>
        <div class="cal-grid ${anim}">${cells}</div>
        <div class="cal-legend">
          <span>${statusDot('todo')}Da fare</span><span>${statusDot('doing')}In corso</span><span>${statusDot('waiting')}In attesa</span>
          <span>${statusDot('done')}Completato</span><span>${statusDot('cancelled')}Annullato</span>
        </div>
      </div>

      <section class="card day-panel" id="day-panel">
        <div class="dp-head">
          <div><div class="dp-title">${U.cap(U.fmtLong(sel))}${rel ? ` · <span class="muted">${rel}</span>` : ''}</div>
            <div class="dp-sub">${list.length ? `${list.length} ${list.length === 1 ? 'attività' : 'attività'} in calendario` : 'Nessuna attività in calendario'}</div></div>
          <div class="dp-actions">
            <button class="btn btn-primary" data-act="cal-add" data-date="${sel}">${icon('plus')}Aggiungi Task</button>
            <a class="btn" href="#/agenda/${sel}">${icon('book')}Apri agenda</a>
          </div>
        </div>
        <div class="dp-list">${list.length ? list.map(panelRow).join('') : '<div class="empty">Giornata libera. Usa «Aggiungi Task» per inserire un\'attività.</div>'}</div>
        ${others > 0 ? `<div class="dp-foot">${others} ${others === 1 ? 'altro task' : 'altri task'} in agenda non ${others === 1 ? 'è mostrato' : 'sono mostrati'} in calendario · <a href="#/agenda/${sel}">vai all'agenda</a></div>` : ''}
      </section>
    </div>`;

    if (scrollToPanel) {
      scrollToPanel = false;
      const p = root.querySelector('#day-panel');
      const r = p.getBoundingClientRect();
      if (r.top > window.innerHeight - 120) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function go(newYm) {
    const h = `#/calendario/${newYm}`;
    if (location.hash === h) App.render(); else location.hash = h;
  }
  function nav(v) {
    if (v === 'prev') go(shiftMonth(ym, -1));
    else if (v === 'next') go(shiftMonth(ym, 1));
    else if (v === 'today') { sel = U.todayISO(); go(sel.slice(0, 7)); }
  }
  Actions['cal-select'] = (id, el) => {
    sel = el.dataset.date;
    scrollToPanel = true;
    if (sel.slice(0, 7) !== ym) go(sel.slice(0, 7)); else App.render();
  };

  return { render, nav, swipe: true };
})();
