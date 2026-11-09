'use strict';
/* Posta = centro del recap: recap di Claude, email più importanti, ultime ricevute; elenco completo apribile.
   Lettura protetta delle email, bozze di risposta, task da email. */
const MailView = (() => {
  let folder = 'inbox', filter = 'all', q = '', sel = null, tag = null, showAll = false;
  const showImages = new Set();
  const bodyMem = new Map();
  const FILTERS = [
    ['all', 'Tutte'], ['unread', 'Non lette'], ['flagged', 'Contrassegnate'], ['important', 'Importanti'], ['attach', 'Con allegati'],
  ];

  const pcolor = s => { let h = 0; for (const c of s || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return PERSON_COLORS[h % PERSON_COLORS.length]; };
  const dt = m => new Date(folder === 'sent' ? (m.sent || m.received) : (m.received || m.sent));
  function shortDate(d) {
    const iso = U.toISO(d), rel = U.relDay(iso);
    if (rel === 'Oggi') return `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
    if (rel === 'Ieri') return 'Ieri';
    const diff = U.diffDays(iso, U.todayISO());
    if (diff < 7) return U.WEEKDAYS[d.getDay()].slice(0, 3);
    return `${d.getDate()} ${U.MONTHS[d.getMonth()].slice(0, 3)}`;
  }
  const longDate = d => `${U.cap(U.fmtLong(U.toISO(d)))}, ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
  const who = a => a ? (a.name || a.address) : '';

  function filtered() {
    let list = Outlook.messages(folder);
    if (filter === 'unread') list = list.filter(m => !m.isRead);
    if (filter === 'flagged') list = list.filter(m => m.flagged);
    if (filter === 'important') list = list.filter(m => m.importance === 'high');
    if (filter === 'attach') list = list.filter(m => m.hasAttachments);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(m => [m.subject, m.preview, m.from.name, m.from.address, ...m.to.map(who)].join(' ').toLowerCase().includes(s));
    }
    return list;
  }

  function listHTML() {
    const list = filtered();
    if (!list.length) {
      const all = Outlook.messages(folder).length;
      return `<div class="empty">${all ? 'Nessuna email corrisponde ai filtri.' : (Outlook.busy ? 'Caricamento della posta…' : 'Nessuna email salvata. Premi «Aggiorna».')}</div>`;
    }
    let out = '', lastDay = '';
    for (const m of list) {
      const d = dt(m), iso = U.toISO(d);
      if (iso !== lastDay) {
        lastDay = iso;
        out += `<div class="mail-day">${U.relDay(iso) || U.cap(U.fmtMid(iso))}</div>`;
      }
      const person = folder === 'sent' ? (m.to[0] || { name: '', address: '' }) : m.from;
      const name = folder === 'sent' ? `A: ${m.to.map(who).join(', ') || '—'}` : who(m.from);
      out += `<a class="mail-item ${!m.isRead && folder === 'inbox' ? 'unread' : ''} ${m.id === sel ? 'sel' : ''}" href="#/posta/${encodeURIComponent(m.id)}">
        <span class="avatar lg" style="--pc:${pcolor(person.address)}">${U.esc(U.initials(who(person) || '?'))}</span>
        <span class="mi-main">
          <span class="mi-top"><span class="mi-from">${U.esc(name)}</span><span class="mi-date">${shortDate(d)}</span></span>
          <span class="mi-subj">${m.flagged ? `<i class="mi-flag" title="Contrassegnata">${icon('flag')}</i>` : ''}${m.importance === 'high' ? '<i class="mi-imp" title="Importanza alta">!</i>' : ''}${m.hasAttachments ? `<i class="mi-att" title="Allegati">${icon('clip')}</i>` : ''}<span>${U.esc(m.subject)}</span></span>
          <span class="mi-prev">${U.esc(m.preview)}</span>
        </span></a>`;
    }
    if (Outlook.hasMore(folder) && !q && filter === 'all') out += `<button type="button" class="btn btn-sm mail-more" data-act="mail-more">${icon('chevDown')}Carica altre email</button>`;
    return out;
  }

  function readHTML(m) {
    if (!m) return `<div class="mr-empty">${ibadge('mail')}<p>Seleziona un'email per leggerla.</p><p class="small muted">Da ogni email puoi creare un task collegato con «Crea task».</p></div>`;
    const d = dt(m);
    const linked = Store.allTasks().filter(t => t.mailRef && t.mailRef.id === m.id);
    const rc = Recap.forMessage(m.id);
    const dr = Outlook.draftFor(m.id);
    const CAT = { reply: 'Risposta da inviare', define: 'Da definire', upcoming: 'Prossimi giorni', info: 'Informativa' };
    return `<div class="mr-head">
        <h2 class="mr-subj">${U.esc(m.subject)}</h2>
        ${RecapUI.tagChips(Recap.tagsFor(m.id))}
        <div class="mr-meta"><span class="avatar lg" style="--pc:${pcolor(m.from.address)}">${U.esc(U.initials(who(m.from) || '?'))}</span>
          <div class="mr-who"><b>${U.esc(who(m.from))}</b> <span class="muted">&lt;${U.esc(m.from.address)}&gt;</span>
            <div class="mr-to">A: ${U.esc(m.to.map(who).join(', ') || '—')}${m.cc.length ? ` · Cc: ${U.esc(m.cc.map(who).join(', '))}` : ''}</div>
            <div class="mr-to">${longDate(d)}</div></div></div>
        <div class="mr-badges">${m.flagged ? `<span class="status-pill st-cancelled">${icon('flag', 'ic-xs')}Contrassegnata</span>` : ''}${m.importance === 'high' ? '<span class="status-pill st-doing">Importanza alta</span>' : ''}${!m.isRead && folder === 'inbox' ? '<span class="status-pill st-waiting">Non letta in Outlook</span>' : ''}</div>
        ${rc ? `<div class="mr-recap prio-${rc.priority}">${icon('sparkle')}<div><b>Recap: ${CAT[rc.category]} · priorità ${rc.priority}${rc.due ? ` · entro ${U.fmtShort(rc.due)}` : ''}</b><span>${U.esc(rc.reason)}</span></div></div>` : ''}
        ${dr ? `<div class="mr-draft">${icon('check')}<span>Bozza di risposta creata alle ${U.pad(new Date(dr.ts).getHours())}:${U.pad(new Date(dr.ts).getMinutes())}</span>${UI.safeUrl(dr.webLink) ? `<a href="${U.esc(UI.safeUrl(dr.webLink))}" target="_blank" rel="noopener">Apri la bozza in Outlook</a>` : ''}</div>` : ''}
        <div class="mr-actions">
          ${folder !== 'sent' ? `<button type="button" class="btn btn-primary btn-sm" data-act="reply-draft" data-mail="${U.esc(m.id)}">${icon('message')}Rispondi (bozza)</button>` : ''}
          <button type="button" class="btn btn-sm" data-act="mail-to-task" data-mail="${U.esc(m.id)}">${icon('calPlus')}Crea task</button>
          ${UI.safeUrl(m.webLink) ? `<a class="btn btn-sm" href="${U.esc(UI.safeUrl(m.webLink))}" target="_blank" rel="noopener">${icon('external')}Apri in Outlook</a>` : ''}
          <button type="button" class="btn btn-sm btn-ghost" data-act="mail-images" data-mail="${U.esc(m.id)}">${icon('image')}${showImages.has(m.id) ? 'Nascondi immagini' : 'Mostra immagini'}</button>
        </div>
        ${linked.length ? `<div class="mr-linked"><span class="sub-title" style="margin:0 0 6px">Task collegati</span>${linked.map(t => `<a class="mini st-${t.status}" style="--c:${UI.taskColor(t)}" href="#/agenda/${t.date}">${statusDot(t.status)}<span class="mini-time">${U.fromISO(t.date).getDate()} ${U.MONTHS[U.fromISO(t.date).getMonth()].slice(0, 3)}</span><span class="mini-title">${U.esc(t.title)}</span></a>`).join('')}</div>` : ''}
      </div>
      <div class="mr-body" id="mr-body"><div class="muted small">Caricamento del messaggio…</div></div>`;
  }

  function mountBody(m) {
    const host = document.getElementById('mr-body');
    if (!host || !m) return;
    const paint = b => {
      if (!document.body.contains(host)) return;
      if (!b) { host.innerHTML = `<div class="note-box">${U.esc(m.preview)}<br><br><em>Testo completo non disponibile offline: aprilo quando sei connesso.</em></div>`; return; }
      const imgs = showImages.has(m.id);
      const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src ${imgs ? 'https: data:' : 'data:'};`;
      const content = b.type === 'text' ? `<pre>${U.esc(b.html)}</pre>` : b.html;
      const frame = document.createElement('iframe');
      frame.className = 'mr-frame';
      frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('title', 'Testo dell\'email');
      frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
        <style>html,body{margin:0;background:#fff;color:#1b2333}body{padding:18px 20px;font:14.5px/1.55 "Segoe UI",system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%!important}pre{white-space:pre-wrap;font:inherit}a{color:#2f4ac0}</style></head><body>${content}</body></html>`;
      const fit = () => { try { frame.style.height = (frame.contentDocument.documentElement.scrollHeight + 4) + 'px'; } catch (e) { /* ignora */ } };
      frame.addEventListener('load', () => {
        fit();
        try { new ResizeObserver(fit).observe(frame.contentDocument.body); } catch (e) { /* ignora */ }
      });
      host.innerHTML = '';
      host.append(frame);
      if (b.attachments && b.attachments.length) {
        host.append(U.h(`<div class="mr-att">${icon('clip')}<span>${b.attachments.map(a => `${U.esc(a.name)} <span class="muted">(${Math.max(1, Math.round(a.size / 1024))} KB)</span>`).join(' · ')}</span><span class="muted small">· apri gli allegati da Outlook</span></div>`));
      }
    };
    if (bodyMem.has(m.id)) { paint(bodyMem.get(m.id)); return; }
    Outlook.body(m.id).then(b => { if (b) bodyMem.set(m.id, b); if (sel === m.id) paint(b); })
      .catch(() => { if (sel === m.id) paint(null); });
  }

  /* Riga email per «Le più importanti» e «Ultime ricevute» */
  function erow(e, { live = false } = {}) {
    const d = new Date(e.received);
    const ok = !isNaN(d);
    const info = Recap.emailInfo(e.messageId);
    const tags = Recap.tagsFor(e.messageId);
    const g = Recap.data && Recap.data.generatedAt ? new Date(Recap.data.generatedAt) : null;
    const fresh = live && !info && !Recap.forMessage(e.messageId) && g && ok && d > g;
    const awaiting = info ? info.awaitingReply : e.awaitingReply, inst = info ? info.institution : e.institution;
    return `<a class="erow ${e.unread ? 'unread' : ''}" href="#/posta/${encodeURIComponent(e.messageId)}">
      <span class="avatar lg" style="--pc:${pcolor(e.fromAddress)}">${U.esc(U.initials(e.from || e.fromAddress || '?'))}</span>
      <span class="er-main">
        <span class="er-top"><span class="er-from">${U.esc(e.from || e.fromAddress)}</span>
          ${awaiting ? '<span class="er-badge wait">In attesa di risposta</span>' : ''}${inst ? '<span class="er-badge inst">Scuola / ente</span>' : ''}
          <span class="er-date">${ok ? shortDate(d) : ''}</span></span>
        <span class="er-subj">${U.esc(e.subject)}</span>
        ${(info && info.why) || e.why ? `<span class="er-why">${U.esc((info && info.why) || e.why)}</span>` : (e.preview ? `<span class="er-why muted">${U.esc(e.preview)}</span>` : '')}
        ${fresh ? '<span class="er-new">Arrivata dopo l\'ultimo recap: verrà analizzata al prossimo</span>' : ''}
      </span></a>${tags.length ? `<div class="er-tags">${RecapUI.tagChips(tags, tag)}</div>` : ''}`;
  }
  const liveRow = m => ({ messageId: m.id, from: m.from.name || m.from.address, fromAddress: m.from.address, subject: m.subject, received: m.received, preview: m.preview, unread: !m.isRead });

  function readPage(root, m) {
    root.innerHTML = `<div class="view mail">
      <header class="page-head"><div><button type="button" class="btn btn-sm" data-act="mail-back">${icon('chevL')}Torna al recap</button></div></header>
      <section class="card mail-read">${readHTML(m)}</section></div>`;
    mountBody(m);
  }

  function render(root, arg) {
    sel = arg ? decodeURIComponent(arg) : null;
    if (Auth.mode === 'local') {
      root.innerHTML = `<div class="view mail"><header class="page-head"><div><h1 class="page-title">Posta</h1></div></header>
        <section class="card toned tone-cyan"><h3 class="card-title">${ibadge('mail')}<span>Disponibile nella versione online</span></h3>
        <p class="note-box" style="margin:0">Questa è la versione locale aperta dal file: il recap e la posta Outlook sono nella versione online, dopo l'accesso con il tuo account Microsoft:
        <a href="${CONFIG.redirectUri}" target="_blank" rel="noopener">${CONFIG.redirectUri}</a></p></section></div>`;
      return;
    }
    if (sel) {
      const m = Outlook.message(sel);
      if (m) {
        folder = Outlook.messages('sent').some(x => x.id === m.id) && !Outlook.messages('inbox').some(x => x.id === m.id) ? 'sent' : 'inbox';
        readPage(root, m);
      } else {
        root.innerHTML = `<div class="view mail"><header class="page-head"><div><button type="button" class="btn btn-sm" data-act="mail-back">${icon('chevL')}Torna al recap</button></div></header>
          <section class="card mail-read"><div class="mr-empty"><p>${navigator.onLine ? 'Caricamento dell\'email…' : 'Email non disponibile offline.'}</p></div></section></div>`;
        Outlook.fetchMessage(sel);
      }
      return;
    }

    const at = Outlook.mailAt ? new Date(Outlook.mailAt) : null;
    const offline = !navigator.onLine;
    const R = Recap.data;
    const imp = Recap.important(tag);
    const recent = Outlook.messages('inbox').slice(0, 5).map(liveRow).filter(e => !tag || Recap.tagsFor(e.messageId).some(t => t.toLowerCase() === tag.toLowerCase()));
    const unread = Outlook.messages('inbox').filter(x => !x.isRead).length;

    root.innerHTML = `<div class="view mail">
      <header class="page-head">
        <div><h1 class="page-title">Posta</h1>
          <p class="page-sub">Recap di Claude e email da tenere d'occhio${at ? ` · posta aggiornata alle ${U.pad(at.getHours())}:${U.pad(at.getMinutes())}` : ''}</p></div>
        <div class="head-actions"><button class="btn" data-act="outlook-refresh" ${offline ? 'disabled' : ''}>${icon('refresh')}<span>${Outlook.busy || Recap.busy ? 'Aggiornamento…' : 'Aggiorna'}</span></button></div>
      </header>
      ${Outlook.error ? `<div class="banner">${U.esc(Outlook.error)}</div>` : ''}
      ${Recap.error ? `<div class="banner">${U.esc(Recap.error)}</div>` : ''}
      ${offline ? '<div class="banner">Sei offline: vedi il recap e le email salvate sul dispositivo.</div>' : ''}
      <div class="dash-grid">
        <section class="card toned tone-violet span-12 recap-main">
          <h3 class="card-title">${ibadge('sparkle')}<span>Recap della posta<span class="sub">Preparato da Claude · giorni feriali alle 7:40 e 13:40</span></span></h3>
          ${R ? `${RecapUI.header()}${RecapUI.tagBar(tag)}${tag ? `<div class="tag-active">Filtro attivo: <b>${U.esc(tag)}</b></div>` : ''}${RecapUI.columns({ limit: 50, tag })}${RecapUI.info(tag)}`
            : `<div class="note-box" style="margin-top:0">${Recap.busy ? 'Caricamento del recap…' : 'Il recap non è ancora disponibile: compare qui dopo la prossima esecuzione dell\'attività pianificata.'}</div>`}
        </section>
        ${RecapUI.proposals()}
        <section class="card toned tone-rose span-7">
          <h3 class="card-title">${ibadge('flag')}<span>Le più importanti<span class="sub">Scuole ed enti · in attesa di una tua risposta</span></span><span class="count">${imp.length}</span></h3>
          ${imp.length ? `<div class="erows">${imp.slice(0, 10).map(e => erow(e)).join('')}</div>` : `<div class="empty">${R ? 'Nessuna email importante in sospeso.' : 'Disponibile con il recap.'}</div>`}
        </section>
        <section class="card toned tone-sky span-5">
          <h3 class="card-title">${ibadge('inbox')}<span>Ultime ricevute<span class="sub">${unread} non lette nella Posta in arrivo</span></span></h3>
          ${recent.length ? `<div class="erows">${recent.map(e => erow(e, { live: true })).join('')}</div>` : `<div class="empty">${Outlook.busy ? 'Caricamento…' : 'Nessuna email salvata. Premi «Aggiorna».'}</div>`}
        </section>
        <section class="card span-12 all-mail ${showAll ? 'open' : ''}">
          <button type="button" class="all-toggle" data-act="mail-all">${icon(showAll ? 'chevUp' : 'chevDown')}<span>${showAll ? 'Nascondi l\'elenco completo' : 'Mostra tutte le email salvate'}</span><span class="muted small">(${Outlook.messages('inbox').length} in arrivo · ${Outlook.messages('sent').length} inviate)</span></button>
          ${showAll ? `<div class="all-body">
            <div class="seg mail-tabs">
              <button type="button" class="seg-btn ${folder === 'inbox' ? 'on' : ''}" data-act="mail-folder" data-v="inbox">${icon('inbox', 'ic-xs')}Posta in arrivo${unread ? ` <span class="n-badge">${unread}</span>` : ''}</button>
              <button type="button" class="seg-btn ${folder === 'sent' ? 'on' : ''}" data-act="mail-folder" data-v="sent">${icon('arrowR', 'ic-xs')}Inviata</button>
            </div>
            <div class="mail-search"><input class="input input-sm" type="search" placeholder="Cerca in oggetto, mittente, testo…" value="${U.esc(q)}" data-role="mail-q" aria-label="Cerca nella posta"></div>
            <div class="mail-filters">${FILTERS.map(([k, l]) => `<button type="button" class="chip ${filter === k ? 'on' : ''}" style="--c:#0891B2" data-act="mail-filter" data-v="${k}">${l}</button>`).join('')}</div>
            <div class="mail-list" data-role="mail-list">${listHTML()}</div></div>` : ''}
        </section>
      </div>
    </div>`;
    const qi = root.querySelector('[data-role="mail-q"]');
    if (qi) qi.addEventListener('input', () => { q = qi.value.trim(); root.querySelector('[data-role="mail-list"]').innerHTML = listHTML(); });
  }

  Object.assign(Actions, {
    'mail-folder': (id, el) => { folder = el.dataset.v; showAll = true; if (location.hash === '#/posta') App.render(); else location.hash = '#/posta'; },
    'mail-all': () => { showAll = !showAll; App.render(); },
    'tag-filter': (id, el) => {
      const t = el.dataset.tag || null;
      tag = t && tag && t.toLowerCase() === tag.toLowerCase() ? null : t;
      if (App.current === 'posta' && location.hash === '#/posta') { App.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else location.hash = '#/posta';
    },
    'mail-filter': (id, el) => { filter = el.dataset.v; App.render(); },
    'mail-more': () => Outlook.refreshMail({ folder, more: true }),
    'mail-back': () => { location.hash = '#/posta'; },
    'recap-filter': (id, el) => { filter = el.dataset.v; folder = 'inbox'; q = ''; showAll = true; if (location.hash === '#/posta') App.render(); else location.hash = '#/posta'; },
    'outlook-refresh': () => { Outlook.refreshAll({ force: true }); Recap.refresh(); },
    'mail-images': (id, el) => { const mid = el.dataset.mail; if (showImages.has(mid)) showImages.delete(mid); else showImages.add(mid); App.render(); },
    'reply-draft': (id, el) => {
      const mid = el.dataset.mail;
      const rc = Recap.forMessage(mid) || (el.dataset.item ? Recap.findItem(el.dataset.item) : null);
      UI.openReplyComposer({ messageId: mid, subject: rc ? rc.subject : '', toName: rc ? rc.from : '', toAddress: rc ? rc.fromAddress : '', suggested: rc ? rc.suggestedReply : '' });
    },
    'open-mail': (id, el) => { location.hash = `#/posta/${encodeURIComponent(el.dataset.mail)}`; },
    'mail-to-task': (id, el) => {
      const m = Outlook.message(el.dataset.mail); if (!m) return;
      const d = new Date(m.received || m.sent);
      const sender = folder === 'sent' ? m.to[0] : m.from;
      UI.openTaskEditor(null, {
        date: U.todayISO(), source: 'email', title: m.subject,
        notes: `${folder === 'sent' ? 'Email inviata a' : 'Email da'} ${who(sender)}${sender && sender.address ? ` <${sender.address}>` : ''} del ${d.getDate()} ${U.MONTHS[d.getMonth()]}.`,
        people: sender && (sender.name || sender.address) ? [{ name: sender.name || sender.address, email: sender.address }] : [],
        extra: { mailRef: { id: m.id, subject: m.subject, from: who(m.from), webLink: m.webLink } },
      });
    },
  });

  return { render };
})();
