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
    const stats = `<p class="form-hint rc-stats">${icon('inbox', 'ic-xs')}Posta in arrivo: <a href="#/posta" data-act="recap-filter" data-v="unread">${inbox.filter(m => !m.isRead).length} non lette</a> · <a href="#/posta" data-act="recap-filter" data-v="flagged">${inbox.filter(m => m.flagged).length} contrassegnate</a> · <a href="#/posta" data-act="recap-filter" data-v="important">${inbox.filter(m => m.importance === 'high').length} importanza alta</a></p>`;
    const R = Recap.data;
    if (!R) {
      return `<div class="note-box" style="margin-top:0">${Recap.busy ? 'Caricamento del recap…' : 'Il recap intelligente non è ancora disponibile: viene preparato dall\'attività pianificata di Claude nei giorni feriali alle 7:40 e alle 13:40, e compare qui automaticamente.'}</div>${stats}`;
    }
    const g = R.generatedAt ? new Date(R.generatedAt) : null;
    const gOk = g && !isNaN(g);
    const stale = gOk && Date.now() - g.getTime() > 30 * 3600 * 1000;
    const col = (cat, cls, ic, title) => {
      const list = Recap.items(cat);
      return `<div class="mail-col ${cls} rc-col"><h5>${ibadge(ic, 'sm')}${title}<span class="rc-n">${list.length}</span></h5>
        ${list.length ? list.slice(0, 6).map(rcCard).join('') + (list.length > 6 ? `<p class="small" style="margin-top:8px">e altre ${list.length - 6}…</p>` : '') : '<p>Niente da segnalare.</p>'}</div>`;
    };
    return `${gOk ? `<div class="rc-gen ${stale ? 'stale' : ''}">${icon('sparkle', 'ic-xs')}Preparato ${(U.relDay(U.toISO(g)) || U.fmtShort(U.toISO(g))).toLowerCase()} alle ${U.pad(g.getHours())}:${U.pad(g.getMinutes())}${stale ? ' · non aggiornato di recente' : ''}</div>` : ''}
      ${R.summary ? `<p class="rc-summary">${U.esc(R.summary)}</p>` : ''}
      <div class="mail-ph">
        ${col('reply', 'mc-red', 'message', 'Risposte da inviare')}
        ${col('define', 'mc-amber', 'target', 'Cose da definire')}
        ${col('upcoming', 'mc-sky', 'calendar', 'Prossimi giorni')}
      </div>
      ${(() => { const info = Recap.items('info'); return info.length ? `<div class="rc-info"><span class="rc-info-h">${icon('inbox', 'ic-xs')}Da sapere</span>${info.map(x => `<span class="rc-info-it">${x.messageId ? `<a href="#/posta/${encodeURIComponent(x.messageId)}">${U.esc(x.from)}: ${U.esc(x.subject)}</a>` : `${U.esc(x.from)}: ${U.esc(x.subject)}`}${x.reason ? ` <span class="muted">— ${U.esc(x.reason)}</span>` : ''}<button type="button" class="link-btn" data-act="recap-done" data-item="${U.esc(x.id)}" title="Nascondi">nascondi</button></span>`).join('')}</div>` : ''; })()}
      ${stats}`;
  }

  const PRIO_L = { alta: 'Alta', media: 'Media', bassa: 'Bassa' };
  function rcCard(x) {
    const dr = x.messageId ? Outlook.draftFor(x.messageId) : null;
    const due = x.due ? (U.relDay(x.due) || U.cap(U.fmtShort(x.due))) : '';
    return `<div class="rc-card prio-${x.priority}">
      <div class="rc-top"><span class="prio-tag">${PRIO_L[x.priority]}</span><span class="rc-from">${U.esc(x.from)}</span>${due ? `<span class="rc-due">${icon('clock', 'ic-xs')}${due}</span>` : ''}</div>
      <div class="rc-subj">${U.esc(x.subject)}</div>
      ${x.reason ? `<div class="rc-reason">${U.esc(x.reason)}</div>` : ''}
      ${dr ? `<div class="rc-draft">${icon('check', 'ic-xs')}Bozza creata${UI.safeUrl(dr.webLink) ? ` · <a href="${U.esc(UI.safeUrl(dr.webLink))}" target="_blank" rel="noopener">apri</a>` : ''}</div>` : ''}
      <div class="rc-acts">
        ${x.messageId ? `<a class="act" href="#/posta/${encodeURIComponent(x.messageId)}" title="Apri l'email">${icon('mail')}<span>Apri</span></a>` : ''}
        ${x.category === 'reply' && x.messageId ? `<button type="button" class="act" data-act="reply-draft" data-mail="${U.esc(x.messageId)}" data-item="${U.esc(x.id)}" title="Prepara una bozza di risposta">${icon('message')}<span>Bozza</span></button>` : ''}
        <button type="button" class="act ok" data-act="recap-done" data-item="${U.esc(x.id)}" title="Segna come gestita: non comparirà più">${icon('check')}<span>Fatto</span></button>
      </div></div>`;
  }

  function proposalsHTML() {
    if (Auth.mode === 'local') return '';
    const list = Recap.proposals();
    if (!list.length) return '';
    return `<section class="card toned tone-violet span-12">
      <h3 class="card-title">${ibadge('sparkle')}<span>Task proposti dalla posta<span class="sub">Accettali per aggiungerli all'agenda (potrai modificarli prima di salvare), oppure scartali</span></span><span class="count">${list.length}</span></h3>
      <div class="prop-grid">${list.map(p => `<div class="prop-card">
        <div class="prop-title">${U.esc(p.title)}</div>
        <div class="prop-meta"><span class="chip static" style="--c:#7C3AED">${icon('calendar', 'ic-xs')}${U.relDay(p.date) || U.cap(U.fmtShort(p.date))}${p.start ? ' · ' + p.start : ''}</span>
          ${p.labels.map(id => Store.label(id)).filter(Boolean).map(l => UI.labelChip(l, false)).join('')}
          ${p.project ? `<span class="chip static" style="--c:#475569">${icon('folder', 'ic-xs')}${U.esc(p.project)}</span>` : ''}
          ${p.people.map(x => `<span class="person"><span class="avatar" style="--pc:#64748B">${U.esc(U.initials(x.name))}</span>${U.esc(x.name)}</span>`).join('')}</div>
        ${p.subject ? `<div class="prop-src">${icon('mail', 'ic-xs')}<span>${U.esc(p.subject)}</span></div>` : ''}
        ${p.notes ? `<div class="prop-notes">${U.esc(p.notes)}</div>` : ''}
        <div class="prop-acts"><button type="button" class="btn btn-sm btn-primary" data-act="prop-accept" data-item="${U.esc(p.id)}">${icon('check')}Accetta</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="prop-dismiss" data-item="${U.esc(p.id)}">Scarta</button></div>
      </div>`).join('')}</div></section>`;
  }

  Object.assign(Actions, {
    'recap-done': (id, el) => {
      const k = el.dataset.item;
      Store.markHandled(k, 'done');
      UI.toast('Segnata come gestita', { label: 'Annulla', run: () => Store.markHandled(k, null) });
    },
    'prop-dismiss': (id, el) => {
      const k = el.dataset.item;
      Store.markHandled(k, 'dismissed');
      UI.toast('Proposta scartata', { label: 'Annulla', run: () => Store.markHandled(k, null) });
    },
    'prop-accept': (id, el) => {
      const p = Recap.findProposal(el.dataset.item); if (!p) return;
      const labels = [...p.labels];
      let notes = p.notes;
      if (p.project) {
        const ex = Store.projects().find(x => x.name.toLowerCase() === p.project.toLowerCase());
        if (ex) labels.push(ex.id); else notes = (notes ? notes + '\n' : '') + `Progetto suggerito: ${p.project}`;
      }
      UI.openTaskEditor(null, {
        title: p.title, date: p.date, start: p.start, end: p.end, labels, notes, people: p.people,
        source: p.messageId ? 'email' : 'manual',
        extra: p.messageId ? { mailRef: { id: p.messageId, subject: p.subject, from: '', webLink: p.webLink } } : {},
        onSaved: () => Store.markHandled(p.id, 'accepted'),
      });
    },
  });

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
          <h3 class="card-title">${ibadge('mail')}<span>Recap posta<span class="sub">Dalla casella Outlook aziendale · preparato da Claude</span></span>
            ${Auth.mode !== 'local' ? `<a class="card-link" href="#/posta">Apri la posta${icon('arrowR', 'ic-xs')}</a>` : ''}</h3>
          ${recapHTML()}
        </section>

        ${proposalsHTML()}

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
