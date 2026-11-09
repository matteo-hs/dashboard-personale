'use strict';
/* Componenti del recap condivisi tra Dashboard (versione compatta) e Posta (versione completa) */
const RecapUI = (() => {
  const TAG_COLORS = ['#0D9488', '#0284C7', '#7C3AED', '#D97706', '#DB2777', '#059669', '#2563EB', '#C2410C'];
  const PRIO_L = { alta: 'Alta', media: 'Media', bassa: 'Bassa' };
  const norm = s => s.replace(/[^\p{L}\p{N}_&-]/gu, '').toLowerCase();

  function tagColor(t) {
    const p = Store.projects().find(x => '#' + norm(x.name) === t.toLowerCase());
    if (p) return p.color;
    let h = 0; for (const c of t.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TAG_COLORS[h % TAG_COLORS.length];
  }
  function tagChips(tags, active) {
    if (!tags || !tags.length) return '';
    return `<span class="tags">${tags.map(t => `<button type="button" class="tag ${active && active.toLowerCase() === t.toLowerCase() ? 'on' : ''}" style="--c:${tagColor(t)}" data-act="tag-filter" data-tag="${U.esc(t)}" title="Mostra solo ${U.esc(t)}">${U.esc(t)}</button>`).join('')}</span>`;
  }
  function tagBar(active) {
    const all = Recap.allTags();
    if (!all.length) return '';
    return `<div class="tag-bar">${icon('tag', 'ic-xs')}${all.slice(0, 24).map(({ tag, n }) => `<button type="button" class="tag ${active && active.toLowerCase() === tag.toLowerCase() ? 'on' : ''}" style="--c:${tagColor(tag)}" data-act="tag-filter" data-tag="${U.esc(tag)}">${U.esc(tag)}<span class="tag-n">${n}</span></button>`).join('')}
      ${active ? `<button type="button" class="link-btn" data-act="tag-filter" data-tag="">togli il filtro</button>` : ''}</div>`;
  }

  function header() {
    const R = Recap.data; if (!R) return '';
    const g = R.generatedAt ? new Date(R.generatedAt) : null;
    const ok = g && !isNaN(g);
    const stale = ok && Date.now() - g.getTime() > 30 * 3600 * 1000;
    const u = R.updatedAt ? new Date(R.updatedAt) : null;
    const when = d => `${(U.relDay(U.toISO(d)) || U.fmtShort(U.toISO(d))).toLowerCase()} alle ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
    return `${ok ? `<div class="rc-gen ${stale ? 'stale' : ''}">${icon('sparkle', 'ic-xs')}Preparato ${when(g)}${u && !isNaN(u) && u > g ? ` · aggiornato dalla chat ${when(u)}` : ''}${stale ? ' · non aggiornato di recente' : ''}</div>` : ''}
      ${R.summary ? `<p class="rc-summary">${U.esc(R.summary)}</p>` : ''}`;
  }

  function card(x, { compact = false, tag = null } = {}) {
    const dr = (x.status === 'draft' ? { webLink: x.draftWebLink } : null) || (x.messageId ? Outlook.draftFor(x.messageId) : null);
    const due = x.due ? (U.relDay(x.due) || U.cap(U.fmtShort(x.due))) : '';
    const dl = dr && UI.safeUrl(dr.webLink);
    return `<div class="rc-card prio-${x.priority}">
      <div class="rc-top"><span class="prio-tag">${PRIO_L[x.priority]}</span><span class="rc-from">${U.esc(x.from)}</span>${due ? `<span class="rc-due">${icon('clock', 'ic-xs')}${due}</span>` : ''}</div>
      ${x.messageId ? `<a class="rc-subj" href="#/posta/${encodeURIComponent(x.messageId)}" title="Apri l'email">${U.esc(x.subject)}</a>` : `<div class="rc-subj">${U.esc(x.subject)}</div>`}
      ${x.reason ? `<div class="rc-reason">${U.esc(x.reason)}</div>` : ''}
      ${!compact ? tagChips(x.tags, tag) : ''}
      ${dr ? `<div class="rc-draft">${icon('check', 'ic-xs')}Bozza creata${dl ? ` · <a href="${U.esc(dl)}" target="_blank" rel="noopener">apri in Outlook</a>` : ''}</div>` : ''}
      <div class="rc-acts">
        ${x.messageId ? `<a class="act" href="#/posta/${encodeURIComponent(x.messageId)}" title="Apri l'email">${icon('mail')}<span>Apri</span></a>` : ''}
        ${x.category === 'reply' && x.messageId ? `<button type="button" class="act" data-act="reply-draft" data-mail="${U.esc(x.messageId)}" data-item="${U.esc(x.id)}" title="Prepara una bozza di risposta">${icon('message')}<span>Bozza</span></button>` : ''}
        <button type="button" class="act ok" data-act="recap-done" data-item="${U.esc(x.id)}" title="Segna come gestita: non comparirà più">${icon('check')}<span>Fatto</span></button>
      </div></div>`;
  }

  function columns({ limit = 6, compact = false, tag = null } = {}) {
    const col = (cat, cls, ic, title) => {
      const list = Recap.items(cat, tag);
      return `<div class="mail-col ${cls} rc-col"><h5>${ibadge(ic, 'sm')}${title}<span class="rc-n">${list.length}</span></h5>
        ${list.length ? list.slice(0, limit).map(x => card(x, { compact, tag })).join('') + (list.length > limit ? `<a class="rc-more" href="#/posta">e altre ${list.length - limit} →</a>` : '') : '<p>Niente da segnalare.</p>'}</div>`;
    };
    return `<div class="mail-ph">
      ${col('reply', 'mc-red', 'message', 'Risposte da inviare')}
      ${col('define', 'mc-amber', 'target', 'Cose da definire')}
      ${col('upcoming', 'mc-sky', 'calendar', 'Prossimi giorni')}
    </div>`;
  }

  function info(tag) {
    const list = Recap.items('info', tag);
    if (!list.length) return '';
    return `<div class="rc-info"><span class="rc-info-h">${icon('inbox', 'ic-xs')}Da sapere</span>${list.map(x => `<span class="rc-info-it">${x.messageId ? `<a href="#/posta/${encodeURIComponent(x.messageId)}">${U.esc(x.from)}: ${U.esc(x.subject)}</a>` : `${U.esc(x.from)}: ${U.esc(x.subject)}`}${x.reason ? ` <span class="muted">— ${U.esc(x.reason)}</span>` : ''} ${tagChips(x.tags, tag)}<button type="button" class="link-btn" data-act="recap-done" data-item="${U.esc(x.id)}" title="Nascondi">nascondi</button></span>`).join('')}</div>`;
  }

  function proposals() {
    if (Auth.mode === 'local') return '';
    const list = Recap.proposals();
    if (!list.length) return '';
    return `<section class="card toned tone-violet span-12 prop-section">
      <h3 class="card-title">${ibadge('sparkle')}<span>Task proposti dalla posta<span class="sub">Accettali per aggiungerli all'agenda (potrai modificarli prima di salvare), oppure scartali</span></span><span class="count">${list.length}</span></h3>
      <div class="prop-grid">${list.map(p => `<div class="prop-card">
        <div class="prop-title">${U.esc(p.title)}</div>
        <div class="prop-meta"><span class="chip static" style="--c:#7C3AED">${icon('calendar', 'ic-xs')}${U.relDay(p.date) || U.cap(U.fmtShort(p.date))}${p.start ? ' · ' + p.start : ''}</span>
          ${p.labels.map(id => Store.label(id)).filter(Boolean).map(l => UI.labelChip(l, false)).join('')}
          ${p.project ? `<span class="chip static" style="--c:#475569">${icon('folder', 'ic-xs')}${U.esc(p.project)}</span>` : ''}
          ${p.people.map(x => `<span class="person"><span class="avatar" style="--pc:#64748B">${U.esc(U.initials(x.name))}</span>${U.esc(x.name)}</span>`).join('')}</div>
        ${p.subject ? (p.messageId ? `<a class="prop-src" href="#/posta/${encodeURIComponent(p.messageId)}">${icon('mail', 'ic-xs')}<span>${U.esc(p.subject)}</span></a>` : `<div class="prop-src">${icon('mail', 'ic-xs')}<span>${U.esc(p.subject)}</span></div>`) : ''}
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

  return { tagColor, tagChips, tagBar, header, card, columns, info, proposals };
})();
