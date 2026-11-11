'use strict';
/* Agenda personale: una "pagina" per giornata, con righe orarie da un'ora.
   Mattina 9–13 e pomeriggio 14–18; ogni fascia può slittare di 30' per la singola giornata. */
const AgendaView = (() => {
  let date = U.todayISO();
  let lastDate = null;

  const fmt = m => `${U.pad(Math.floor(m / 60))}:${U.pad(m % 60)}`;
  const sMin = t => U.timeToMin(t.start);
  const eMin = t => (t.end ? U.timeToMin(t.end) : sMin(t));
  const ND_COLORS = ['#0D9488', '#0284C7', '#7C3AED', '#D97706', '#DB2777'];

  function layout(pref) {
    const mStart = 9 * 60 + (pref.m || 0);
    const aStart = 14 * 60 + (pref.a || 0);
    const slots = s => [0, 1, 2, 3].map(i => ({ from: s + 60 * i, to: s + 60 * (i + 1) }));
    return { mStart, mEnd: mStart + 240, aStart, aEnd: aStart + 240, morning: slots(mStart), afternoon: slots(aStart) };
  }

  /* ---------- Striscia settimanale ---------- */
  function weekStrip() {
    const d = U.fromISO(date);
    const monday = U.addDays(date, -((d.getDay() + 6) % 7));
    const T = U.todayISO();
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const iso = U.addDays(monday, i);
      const list = Store.tasksOn(iso).filter(t => t.status !== 'cancelled');
      const dots = list.slice(0, 4).map(t => `<i style="--c:${UI.taskColor(t)}"></i>`).join('');
      cells += `<a class="wday ${iso === date ? 'active' : ''} ${iso === T ? 'today' : ''} ${i >= 5 ? 'weekend' : ''}" href="#/agenda/${iso}" title="${U.cap(U.fmtLong(iso))} · ${list.length} task">
        <span class="wd">${U.WD_SHORT_MON[i]}</span><span class="dn">${U.fromISO(iso).getDate()}</span><span class="dots">${dots}</span></a>`;
    }
    return `<div class="week-strip">
      <button class="btn wk-nav" data-nav="prevw" title="Settimana precedente" aria-label="Settimana precedente">${icon('chevL')}</button>
      ${cells}
      <button class="btn wk-nav" data-nav="nextw" title="Settimana successiva" aria-label="Settimana successiva">${icon('chevR')}</button></div>`;
  }

  /* ---------- Foglio a righe ---------- */
  function sheetHTML(tasks, events) {
    const pref = Store.dayPref(date);
    const L = layout(pref);
    // elementi con orario: task + eventi Outlook (sola lettura)
    const timed = [
      ...tasks.filter(t => t.start).map(t => ({ kind: 'task', o: t, s: sMin(t), e: eMin(t), title: t.title, end: t.end, color: UI.taskColor(t), off: t.status === 'cancelled' })),
      ...events.filter(e => !e.allDay).map(e => {
        const st = U.timeToMin(Outlook.evTime(e)), en = Outlook.evEnd(e);
        return { kind: 'ev', o: e, s: st, e: en ? U.timeToMin(en) : (e.end.slice(0, 10) > e.start.slice(0, 10) ? 24 * 60 : st), title: e.subject, end: en || '24:00', color: 'var(--ol)', off: e.cancelled };
      }),
    ];
    const line = it => (it.kind === 'task' ? UI.taskLine(it.o) : UI.eventLine(it.o));
    const isToday = date === U.todayISO();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    const startingIn = (from, to) => timed.filter(t => t.s >= from && t.s < to).sort((a, b) => a.s - b.s);
    const continuing = from => timed.filter(t => !t.off && t.s < from && t.e > from);
    const contHTML = t => `<div class="ln-cont" style="--c:${t.color}">${icon('cornerDR')}<b>${U.esc(t.title)}</b><span class="c-long">· prosegue fino alle ${t.end}</span><span class="c-short">→ ${t.end}</span></div>`;
    const addBtn = (from, to, label) => `<button type="button" class="slot-add" data-act="new-task" data-date="${date}" data-start="${fmt(from)}" data-end="${fmt(to)}">${icon('plus')}<span>${label}</span></button>`;
    const plusBtn = (from, to) => `<button type="button" class="slot-plus" data-act="new-task" data-date="${date}" data-start="${fmt(from)}" data-end="${fmt(to)}" title="Aggiungi alle ${fmt(from)}" aria-label="Aggiungi alle ${fmt(from)}">${icon('plus')}</button>`;

    function slotHTML(s, i, band) {
      const own = startingIn(s.from, s.to);
      const cont = continuing(s.from);
      const now = isToday && nowMin >= s.from && nowMin < s.to;
      const shifted = !!pref[band];
      const shift = i === 0
        ? `<button type="button" class="shift-btn" data-act="shift" data-band="${band}" title="${shifted ? `Riporta l'inizio alle ${fmt(s.from - 30)}` : `Sposta l'inizio alle ${fmt(s.from + 30)}`}">${icon(shifted ? 'chevUp' : 'chevDown')}30′</button>` : '';
      return `<div class="slot ${now ? 'now' : ''}" data-slot="${fmt(s.from)}">
        <div class="slot-time"><b>${fmt(s.from)}</b><span>${fmt(s.to)}</span>${shift}${own.length ? plusBtn(s.from, s.to) : ''}</div>
        <div class="slot-body">${cont.map(contHTML).join('')}${own.map(line).join('')}${own.length ? '' : addBtn(s.from, s.to, `Libero · aggiungi alle ${fmt(s.from)}`)}</div>
      </div>`;
    }

    function secHead(cls, ic, name, range, n, preset) {
      return `<div class="sec-head"><span class="band-icon">${icon(ic)}</span>
        <div><div class="band-name">${name}</div><div class="band-range">${range}</div></div>
        ${n ? `<span class="band-count">${n} ${n === 1 ? 'impegno' : 'impegni'}</span>` : ''}
        <button class="btn btn-sm btn-ghost band-add" data-act="new-task" data-date="${date}" data-start="${preset}">${icon('plus')}Aggiungi</button></div>`;
    }

    // Mattina
    const early = timed.filter(t => t.s < L.mStart).sort((a, b) => a.s - b.s);
    const mCount = early.length + startingIn(L.mStart, L.mEnd).length;
    const earlyRow = early.length ? `<div class="slot early"><div class="slot-time"><b>Prima</b><span>delle ${fmt(L.mStart)}</span></div>
      <div class="slot-body">${early.map(line).join('')}</div></div>` : '';
    const morning = `<div class="sec sec-morning">${secHead('morning', 'sunrise', 'Mattina', `${fmt(L.mStart)} – ${fmt(L.mEnd)}`, mCount, fmt(L.mStart))}
      <div class="slots">${earlyRow}${L.morning.map((s, i) => slotHTML(s, i, 'm')).join('')}</div></div>`;

    // Pausa
    const lunchT = startingIn(L.mEnd, L.aStart);
    const lunchCont = continuing(L.mEnd);
    const lunch = `<div class="slot lunch"><div class="slot-time"><b>${fmt(L.mEnd)}</b><span>${fmt(L.aStart)}</span>${plusBtn(L.mEnd, L.aStart)}</div>
      <div class="slot-body">${lunchCont.map(contHTML).join('')}${lunchT.map(line).join('')}${lunchT.length ? '' : `<span class="lunch-lbl">${icon('coffee')}Pausa</span>`}</div></div>`;

    // Pomeriggio
    const aCount = startingIn(L.aStart, L.aEnd).length;
    const afternoon = `<div class="sec sec-afternoon">${secHead('afternoon', 'sun', 'Pomeriggio', `${fmt(L.aStart)} – ${fmt(L.aEnd)}`, aCount, fmt(L.aStart))}
      <div class="slots">${L.afternoon.map((s, i) => slotHTML(s, i, 'a')).join('')}</div></div>`;

    // Sera
    const eve = timed.filter(t => t.s >= L.aEnd).sort((a, b) => a.s - b.s);
    const eveCont = continuing(L.aEnd);
    const evening = `<div class="sec sec-evening">${secHead('evening', 'moon', 'Sera', `dalle ${fmt(L.aEnd)}`, eve.length, '19:00')}
      <div class="slots"><div class="slot"><div class="slot-time"><b>${fmt(L.aEnd)}</b><span>in poi</span>${eve.length ? plusBtn(19 * 60, 20 * 60) : ''}</div>
        <div class="slot-body">${eveCont.map(contHTML).join('')}${eve.map(line).join('')}${eve.length ? '' : addBtn(19 * 60, 20 * 60, 'Serata libera · aggiungi')}</div></div></div></div>`;

    return `<section class="card toned sheet ag-sheet tone-teal">
      <div class="sheet-head">${ibadge('clock')}<div><div class="ttl">Agenda della giornata</div>
        <div class="sub">Clicca una riga libera per aggiungere un impegno · la freccia «30′» sposta di mezz'ora le fasce di questa giornata</div></div></div>
      ${morning}${lunch}${afternoon}${evening}
    </section>`;
  }

  /* ---------- Card affiancate ---------- */
  function todoHTML(tasks, events) {
    const list = tasks.filter(t => !t.start);
    const allDay = events.filter(e => e.allDay);
    return `<section class="card toned tone-pink ag-todo">
      <h3 class="card-title">${ibadge('list')}<span>In giornata<span class="sub">Attività senza orario</span></span>
        <button class="btn btn-sm btn-ghost band-add" data-act="new-task" data-date="${date}" data-start="">${icon('plus')}Aggiungi</button></h3>
      ${allDay.length ? `<div class="todo-list" style="margin-bottom:8px">${allDay.map(UI.eventLine).join('')}</div>` : ''}
      ${list.length ? `<div class="todo-list">${list.map(UI.taskLine).join('')}</div>`
        : `<button type="button" class="slot-add" style="border:1.5px dashed var(--border-strong)" data-act="new-task" data-date="${date}" data-start="">${icon('plus')}<span style="opacity:1">Nessuna attività senza orario · aggiungi</span></button>`}
    </section>`;
  }

  function peopleHTML(tasks) {
    const pmap = new Map();
    tasks.forEach(t => t.people.forEach(id => pmap.set(id, (pmap.get(id) || 0) + 1)));
    const people = [...pmap.entries()].map(([id, n]) => ({ p: Store.person(id), n })).filter(x => x.p)
      .sort((a, b) => b.n - a.n)
      .map(({ p, n }) => `<div class="side-person"><span class="avatar lg" style="--pc:${p.color}">${U.esc(U.initials(p.name))}</span>
        <div><div>${U.esc(p.name)}</div>${p.role ? `<div class="role">${U.esc(p.role)}</div>` : ''}</div><span class="cnt">${n} task</span></div>`).join('');
    const lset = new Set();
    tasks.forEach(t => t.labels.forEach(id => lset.add(id)));
    const labels = [...lset].map(Store.label).filter(Boolean).map(l => UI.labelChip(l)).join('');
    const nP = pmap.size;
    const nT = tasks.filter(t => t.people.some(id => Store.person(id))).length;
    const summary = nP ? `${nP} ${nP === 1 ? 'persona coinvolta' : 'persone coinvolte'} in ${nT} task` : 'Nessuna persona coinvolta';
    const open = Prefs.get('agPeopleOpen') !== false;
    return `<section class="card toned tone-violet ag-people${open ? '' : ' collapsed'}">
      <h3 class="card-title pl-head" data-act="toggle-people" role="button" tabindex="0" aria-expanded="${open}">${ibadge('users')}<span>Persone ed etichette<span class="sub pl-sub-open">Coinvolte nei task della giornata</span><span class="sub pl-sub-closed">${summary}</span></span>
        <span class="collapse-btn" title="${open ? 'Comprimi' : 'Espandi'}" aria-hidden="true">${icon('chevDown')}</span></h3>
      <div class="pl-body">
        <div class="pl-list">${people || '<div class="muted small">Nessuna persona associata ai task di questa giornata.</div>'}</div>
        <div class="sub-title">Etichette</div>
        <div class="side-chips">${labels || '<span class="muted small">Nessuna etichetta.</span>'}</div>
        ${labels ? '<p class="form-hint" style="margin:10px 0 0">Clicca un\'etichetta per vedere tutti i task collegati.</p>' : ''}
      </div>
    </section>`;
  }

  function nextHTML() {
    let cards = '';
    for (let i = 1; i <= 5; i++) {
      const iso = U.addDays(date, i);
      const d = U.fromISO(iso);
      const list = Store.tasksOn(iso).filter(t => t.status !== 'cancelled');
      const open = list.filter(t => t.status !== 'done').length;
      cards += `<a class="nd-card" href="#/agenda/${iso}" style="--ndc:${ND_COLORS[(i - 1) % ND_COLORS.length]}">
        <div class="nd-top"><b>${d.getDate()}</b><span>${U.relDay(iso) || U.WEEKDAYS[d.getDay()]}</span></div>
        <div class="nd-count">${list.length ? `${open} da fare · ${list.length} in tutto` : 'Giornata libera'}</div>
        ${list.slice(0, 3).map(t => `<div class="nd-item" style="--c:${UI.taskColor(t)}"><i></i><span>${t.start ? t.start + ' ' : ''}${U.esc(t.title)}</span></div>`).join('')}
      </a>`;
    }
    return `<section class="card toned tone-blue ag-next">
      <h3 class="card-title">${ibadge('calendar')}<span>Prossimi giorni<span class="sub">Clicca un giorno per aprirne la pagina</span></span></h3>
      <div class="next-grid">${cards}</div></section>`;
  }

  /* ---------- Render ---------- */
  function render(root, arg) {
    if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) date = arg;
    const anim = lastDate && lastDate !== date ? (date > lastDate ? 'flip-next' : 'flip-prev') : '';
    lastDate = date;

    const tasks = Store.tasksOn(date);
    const events = Prefs.get('outlookAgenda') ? Outlook.eventsOn(date) : [];
    Outlook.ensureMonth(date.slice(0, 7));
    const doneN = tasks.filter(t => t.status === 'done').length;
    const active = tasks.filter(t => t.status !== 'cancelled').length;
    const pct = active ? Math.round(doneN / active * 100) : 0;
    const d = U.fromISO(date);
    const rel = U.relDay(date);
    const count = s => tasks.filter(t => t.status === s).length;
    const stats = STATUS_ORDER.map(s => `<span class="dh-stat ${count(s) ? '' : 'zero'}">${statusDot(s)}${STATUS[s].label}<b>${count(s)}</b></span>`).join('');

    root.innerHTML = `<div class="view agenda">
      <header class="page-head">
        <div><h1 class="page-title">Agenda personale</h1>
          <p class="page-sub">Sfoglia le giornate con le frecce, con i tasti ← → o con uno swipe sul telefono</p></div>
        <div class="head-actions">
          <button class="btn" data-nav="today">Oggi</button>
          <span class="date-pick"><button class="btn btn-icon" data-act="pick-date" title="Vai a una data" aria-label="Vai a una data">${icon('calendar')}</button>
            <input type="date" value="${date}" data-change="jump-agenda" tabindex="-1" aria-hidden="true"></span>
          <button class="btn btn-primary" data-act="new-task" data-date="${date}">${icon('plus')}<span>Nuovo task</span></button>
        </div>
      </header>
      ${weekStrip()}
      <div class="page-wrap"><div class="agenda-grid ${anim}">
        <div class="card day-hero ag-hero${date === U.todayISO() ? ' is-today' : ''}">
          <div class="dh-top">
            <button class="btn btn-icon pager" data-nav="prev" aria-label="Giorno precedente" title="Giorno precedente">${icon('chevL')}</button>
            <div class="dh-date"><div class="dh-num">${d.getDate()}</div>
              <div class="dh-txt"><div class="dh-wd">${U.WEEKDAYS[d.getDay()]}${rel ? `<span class="rel">${rel}</span>` : ''}</div>
              <div class="dh-my">${U.MONTHS[d.getMonth()]} ${d.getFullYear()}</div></div></div>
            <button class="btn btn-icon pager" data-nav="next" aria-label="Giorno successivo" title="Giorno successivo">${icon('chevR')}</button>
          </div>
          <div class="dh-foot">
            <div class="dh-stats">${stats}</div>
            <div class="dh-progress"><div class="dh-pl"><strong>${doneN}</strong> di ${active} completati</div>
              <div class="bar"><span style="width:${pct}%"></span></div></div>
          </div>
        </div>
        ${todoHTML(tasks, events)}
        ${peopleHTML(tasks)}
        ${sheetHTML(tasks, events)}
        ${nextHTML()}
      </div></div>
    </div>`;
  }

  const go = iso => { location.hash = `#/agenda/${iso}`; };
  function nav(v) {
    const step = { prev: -1, next: 1, prevw: -7, nextw: 7 }[v];
    if (v === 'today') go(U.todayISO());
    else if (step) go(U.addDays(date, step));
  }

  Actions['pick-date'] = (id, el) => {
    const inp = el.parentElement.querySelector('input');
    try { inp.showPicker(); } catch (e) { inp.focus(); inp.click(); }
  };
  Actions.shift = (id, el) => {
    const band = el.dataset.band;
    const p = Store.dayPref(date);
    Store.setDayPref(date, { [band]: p[band] ? 0 : 30 });
  };
  /* Riquadro «Persone ed etichette»: compatto o espanso, scelta ricordata su questo dispositivo */
  Actions['toggle-people'] = (id, el) => {
    const sec = el.closest('.ag-people');
    const open = sec.classList.toggle('collapsed') === false;
    Prefs.set('agPeopleOpen', open);
    el.setAttribute('aria-expanded', String(open));
    const b = el.querySelector('.collapse-btn'); if (b) b.title = open ? 'Comprimi' : 'Espandi';
  };
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pl-head')) { e.preventDefault(); e.target.click(); }
  });
  Changes['jump-agenda'] = el => { if (el.value) go(el.value); };

  return { render, nav, swipe: true, get date() { return date; } };
})();
