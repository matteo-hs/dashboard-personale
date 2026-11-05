'use strict';
/* Dashboard: panoramica di oggi, recap posta (predisposto), prossimi giorni, sospesi, progetti */
const DashboardView = (() => {
  function mini(t, { showDate = false, moveToday = false } = {}) {
    const d = U.fromISO(t.date);
    return `<div class="mini st-${t.status}" style="--c:${UI.taskColor(t)}">
      <button type="button" class="check" data-act="toggle-done" data-id="${t.id}" aria-label="Completa" title="${t.status === 'done' ? 'Riapri' : 'Completa'}">${icon('check')}</button>
      <span class="mini-time">${showDate ? d.getDate() + ' ' + U.MONTHS[d.getMonth()].slice(0, 3) : (t.start || '—')}</span>
      <a class="mini-title" href="#/agenda/${t.date}" title="${U.esc(t.title)}">${U.esc(t.title)}</a>
      ${t.status === 'doing' || t.status === 'waiting' || t.status === 'cancelled' ? statusDot(t.status) : ''}
      ${moveToday ? `<button class="btn btn-sm" data-act="move-today" data-id="${t.id}" title="Sposta a oggi">${icon('arrowR')}Oggi</button>` : ''}
    </div>`;
  }

  function evMini(e) {
    const u = UI.safeUrl(e.webLink);
    return `<div class="mini ev ${e.cancelled ? 'st-cancelled' : ''}" style="--c:var(--ol)">
      <span class="ev-ic sm">${icon('calendar')}</span>
      <span class="mini-time">${Outlook.evTime(e) || 'giornata'}</span>
      ${u ? `<a class="mini-title" href="${U.esc(u)}" target="_blank" rel="noopener" title="Apri in Outlook">${U.esc(e.subject)}</a>` : `<span class="mini-title">${U.esc(e.subject)}</span>`}
      <span class="source-badge ol">Outlook</span></div>`;
  }

  function recapHTML() {
    if (Auth.mode === 'local') {
      return `<div class="mail-ph">
        <div class="mail-col mc-red"><h5>${ibadge('message', 'sm')}Risposte da inviare</h5><p>Disponibile nella versione online, dopo l'accesso Microsoft.</p></div>
        <div class="mail-col mc-amber"><h5>${ibadge('target', 'sm')}Cose da definire</h5><p>Richieste aperte, date da fissare, conferme in sospeso.</p></div>
        <div class="mail-col mc-sky"><h5>${ibadge('calendar', 'sm')}Prossimi giorni</h5><p>Scadenze e appuntamenti emersi dalla posta.</p></div></div>`;
    }
    const inbox = Outlook.messages('inbox');
    const col = (cls, ic, title, list, filter) => `<div class="mail-col ${cls}">
      <h5>${ibadge(ic, 'sm')}${title}<span class="rc-n">${list.length}</span></h5>
      ${list.length ? list.slice(0, 3).map(m => `<a class="rc-item" href="#/posta/${encodeURIComponent(m.id)}"><b>${U.esc(m.from.name || m.from.address)}</b><span>${U.esc(m.subject)}</span></a>`).join('')
        : `<p>${inbox.length ? 'Nessuna.' : (Outlook.busy ? 'Caricamento…' : 'Nessun dato: apri la Posta e premi «Aggiorna».')}</p>`}
      ${list.length > 3 ? `<a class="rc-more" href="#/posta" data-act="recap-filter" data-v="${filter}">e altre ${list.length - 3} →</a>` : ''}</div>`;
    return `<div class="mail-ph">
        ${col('mc-red', 'mail', 'Non lette', inbox.filter(m => !m.isRead), 'unread')}
        ${col('mc-amber', 'flag', 'Contrassegnate', inbox.filter(m => m.flagged), 'flagged')}
        ${col('mc-sky', 'alert', 'Importanza alta', inbox.filter(m => m.importance === 'high'), 'important')}
      </div>
      <p class="form-hint" style="margin:12px 0 0">Calcolato sulle ultime ${inbox.length} email della Posta in arrivo. Il recap con priorità e risposte da inviare arriva con la v0.4.</p>`;
  }

  function render(root) {
    const T = U.todayISO();
    const today = Store.tasksOn(T);
    const todayEv = Prefs.get('outlookAgenda') ? Outlook.eventsOn(T) : [];
    const all = Store.allTasks();
    const open = s => ['todo', 'doing', 'waiting'].includes(s);
    const activeToday = today.filter(t => t.status !== 'cancelled').length;
    const doneToday = today.filter(t => t.status === 'done').length;
    const overdue = all.filter(t => t.date < T && open(t.status)).sort(Store.byDateTime);
    const pending = all.filter(t => (t.status === 'doing' || t.status === 'waiting') && t.date >= T).sort(Store.byDateTime);
    const upcoming = Store.tasksBetween(U.addDays(T, 1), U.addDays(T, 7)).filter(t => open(t.status));
    const hour = new Date().getHours();
    const greet = hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

    const groups = {};
    upcoming.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
    const upcomingHTML = Object.keys(groups).sort().map(iso => `<div class="day-group">
      <h4><a href="#/agenda/${iso}">${U.relDay(iso) || U.cap(U.fmtMid(iso))}</a><span class="muted">· ${groups[iso].length}</span></h4>
      <div class="mini-list">${groups[iso].map(t => mini(t)).join('')}</div></div>`).join('');

    const projHTML = Store.projects().map(p => {
      const list = Store.tasksWithLabel(p.id);
      const done = list.filter(t => t.status === 'done').length;
      const valid = list.filter(t => t.status !== 'cancelled').length;
      const next = list.find(t => t.date >= T && open(t.status));
      const pct = valid ? Math.round(done / valid * 100) : 0;
      return `<button type="button" class="proj-card" style="--c:${p.color}" data-act="label" data-label="${p.id}">
        <div class="pc-name">${icon('folder')}${U.esc(p.name)}</div>
        <div class="pc-sub">${done}/${valid} completati${next ? ` · prossimo: ${U.fmtShort(next.date)}` : ''}</div>
        <div class="bar"><span style="width:${pct}%"></span></div></button>`;
    }).join('');

    const hs = (ic, n, l) => `<div class="hero-stat"><span class="hs-ic">${icon(ic)}</span><b>${n}</b><span>${l}</span></div>`;

    root.innerHTML = `<div class="view dashboard">
      <section class="card dash-hero">
        <div><h1>${greet}, Matteo</h1><p>${U.fmtLong(T)}</p></div>
        <div class="hero-stats">
          ${hs('list', activeToday, 'oggi')}
          ${hs('check', doneToday, 'completati')}
          ${hs('hourglass', pending.length, 'in corso / attesa')}
          ${hs('history', overdue.length, 'da recuperare')}
        </div>
      </section>

      <div class="dash-grid">
        <section class="card toned tone-sky span-12">
          <h3 class="card-title">${ibadge('mail')}<span>Recap posta<span class="sub">Dalla casella Outlook aziendale</span></span>
            ${Auth.mode !== 'local' ? `<a class="card-link" href="#/posta">Apri la posta${icon('arrowR', 'ic-xs')}</a>` : ''}</h3>
          ${recapHTML()}
        </section>

        <section class="card toned tone-amber span-12">
          <h3 class="card-title">${ibadge('sun')}<span>Oggi<span class="sub">${activeToday ? `${doneToday} di ${activeToday} task completati` : 'Nessun task in programma'}${todayEv.length ? ` · ${todayEv.length} ${todayEv.length === 1 ? 'evento' : 'eventi'} Outlook` : ''}</span></span>
            <a class="card-link" href="#/agenda/${T}">Apri agenda${icon('arrowR', 'ic-xs')}</a></h3>
          ${todayEv.length || today.length ? `<div class="mini-grid">${todayEv.map(evMini).join('')}${today.map(t => mini(t)).join('')}</div>` : '<div class="empty">Nessun impegno per oggi.</div>'}
        </section>

        <section class="card toned tone-teal span-6">
          <h3 class="card-title">${ibadge('calendar')}<span>Prossimi 7 giorni</span><span class="count">${upcoming.length} da fare</span></h3>
          ${upcomingHTML || '<div class="empty">Niente in programma nei prossimi giorni.</div>'}
        </section>

        <section class="card toned tone-rose span-6">
          <h3 class="card-title">${ibadge('history')}<span>Da recuperare</span><span class="count">giorni passati, non chiusi</span></h3>
          ${overdue.length ? `<div class="mini-list">${overdue.map(t => mini(t, { showDate: true, moveToday: true })).join('')}</div>` : '<div class="empty">Tutto in pari.</div>'}
          <h3 class="card-title tone-orange" style="margin-top:24px">${ibadge('hourglass')}<span>In corso e in attesa</span></h3>
          ${pending.length ? `<div class="mini-list">${pending.map(t => mini(t, { showDate: true })).join('')}</div>` : '<div class="empty">Nessuna attività sospesa.</div>'}
        </section>

        <section class="card toned tone-violet span-12">
          <h3 class="card-title">${ibadge('folder')}<span>Progetti</span><span class="count">clicca per la cronologia dei task</span></h3>
          ${projHTML ? `<div class="proj-grid">${projHTML}</div>` : '<div class="empty">Nessun progetto. Creane uno da un task o dalle Impostazioni.</div>'}
        </section>
      </div>
    </div>`;
  }
  return { render };
})();
