'use strict';
/* Impostazioni: etichette, progetti, persone, dati, aspetto */
const SettingsView = (() => {
  function render(root) {
    const theme = Theme.get();
    const base = Store.baseLabels().map(l => `<div class="set-row">
      <input type="color" class="color-in" value="${l.color}" data-change="label-color" data-id="${l.id}" title="Colore">
      <span class="grow">${UI.labelChip(l)}</span>
      <label class="chk"><input type="checkbox" data-change="label-autocal" data-id="${l.id}" ${l.autoCal ? 'checked' : ''}>In calendario di default</label>
      <span class="cnt">${Store.tasksWithLabel(l.id).length} task</span></div>`).join('');

    const projects = Store.projects().map(l => `<div class="set-row">
      <input type="color" class="color-in" value="${l.color}" data-change="label-color" data-id="${l.id}" title="Colore">
      <input class="input input-sm grow" value="${U.esc(l.name)}" data-change="label-name" data-id="${l.id}" aria-label="Nome progetto">
      <span class="cnt">${Store.tasksWithLabel(l.id).length} task</span>
      <button class="btn btn-sm btn-ghost btn-icon danger" data-act="del-label" data-id="${l.id}" title="Elimina progetto">${icon('trash')}</button></div>`).join('');

    const people = Store.people().map(p => `<div class="set-row">
      <span class="avatar lg" style="--pc:${p.color}">${U.esc(U.initials(p.name))}</span>
      <div class="person-fields">
        <input class="input input-sm" value="${U.esc(p.name)}" data-change="person-field" data-field="name" data-id="${p.id}" placeholder="Nome" aria-label="Nome">
        <input class="input input-sm" value="${U.esc(p.role || '')}" data-change="person-field" data-field="role" data-id="${p.id}" placeholder="Ruolo / ente" aria-label="Ruolo">
        <input class="input input-sm" type="email" value="${U.esc(p.email || '')}" data-change="person-field" data-field="email" data-id="${p.id}" placeholder="Email" aria-label="Email">
      </div>
      <span class="cnt">${Store.tasksWithPerson(p.id).length} task</span>
      <button class="btn btn-sm btn-ghost btn-icon danger" data-act="del-person" data-id="${p.id}" title="Elimina persona">${icon('trash')}</button></div>`).join('');

    const themeBtn = (v, l, ic) => `<button type="button" class="seg-btn ${theme === v ? 'on' : ''}" data-act="theme" data-v="${v}">${icon(ic, 'ic-xs')}${l}</button>`;

    const d = Sync.describe();
    const a = Auth.account || {};
    const acctCard = Auth.mode === 'local'
      ? `<section class="card toned tone-green span-12">
          <h3 class="card-title">${ibadge('shield')}<span>Account e sincronizzazione<span class="sub">Versione locale aperta dal file sul PC</span></span></h3>
          <p class="note-box" style="margin-top:0">I dati di questa versione restano <strong>solo in questo browser</strong>. L'accesso Microsoft, la sincronizzazione su OneDrive e l'installazione come app sono nella versione online:
            <a href="${CONFIG.redirectUri}" target="_blank" rel="noopener">${CONFIG.redirectUri}</a>.<br>
            Per portarci i dati: «Esporta backup» qui sotto, poi «Importa backup» nella versione online.</p>
        </section>`
      : `<section class="card toned tone-green span-12">
          <h3 class="card-title">${ibadge('shield')}<span>Account e sincronizzazione<span class="sub">I dati sono nel tuo OneDrive, cartella «Apps/Dashboard Personale»</span></span></h3>
          <div class="acct-panel">
            <div class="acct-row"><span class="avatar lg" style="--pc:#3B5BDB">${U.esc(U.initials(a.name || a.username || '?'))}</span>
              <div class="acct-id"><b>${U.esc(a.name || 'Account Microsoft')}</b><span>${U.esc(a.username || '')}</span></div></div>
            <div class="sync-status" data-sync-tone="${d.tone}"><i class="sync-dot"></i><span data-sync-text>${U.esc(d.text)}</span></div>
            <div class="data-actions">
              ${Sync.status === 'auth' ? `<button class="btn btn-primary" data-act="relogin">${icon('user')}Riconnetti</button>` : `<button class="btn" data-act="sync-now">${icon('refresh')}Sincronizza ora</button>`}
              ${PWA.canInstall ? `<button class="btn btn-primary" data-act="install">${icon('download')}Installa l'app</button>` : PWA.standalone ? `<span class="chip static" style="--c:#16A34A"><span class="dot"></span>App installata</span>` : ''}
              <button class="btn btn-ghost" data-act="logout">Esci</button>
            </div>
          </div>
        </section>`;

    const oAt = Outlook.mailAt ? new Date(Outlook.mailAt) : null;
    const outlookCard = Auth.mode === 'local' ? '' : `<section class="card toned tone-cyan span-12">
        <h3 class="card-title">${ibadge('mail')}<span>Outlook<span class="sub">Posta e calendario in sola lettura${oAt ? ` · aggiornati alle ${U.pad(oAt.getHours())}:${U.pad(oAt.getMinutes())}` : ''}</span></span></h3>
        ${Outlook.error ? `<div class="banner">${U.esc(Outlook.error)}</div>` : ''}
        <div class="acct-panel">
          <label class="chk"><input type="checkbox" data-change="pref" data-key="outlookAgenda" ${Prefs.get('outlookAgenda') ? 'checked' : ''}>Mostra le riunioni Outlook nell'agenda e in «Oggi»</label>
          <label class="chk"><input type="checkbox" data-change="pref" data-key="outlookCal" ${Prefs.get('outlookCal') ? 'checked' : ''}>Mostra le riunioni Outlook nel calendario</label>
          <div class="data-actions"><button class="btn" data-act="outlook-refresh">${icon('refresh')}Aggiorna posta e calendario</button></div>
        </div>
        <p class="form-hint" style="margin:12px 0 0">Le email e gli eventi restano salvati su questo dispositivo per la consultazione offline. L'app non modifica nulla in Outlook.</p>
      </section>`;

    root.innerHTML = `<div class="view settings">
      <header class="page-head"><div><h1 class="page-title">Impostazioni</h1>
        <p class="page-sub">Account, etichette, progetti, persone e gestione dei dati</p></div></header>
      ${Store.persistOK ? '' : '<div class="banner">Attenzione: il browser non consente il salvataggio locale. Le modifiche andranno perse alla chiusura.</div>'}
      <div class="set-grid dash-grid">
        ${acctCard}
        ${outlookCard}
        <section class="card toned tone-teal span-6">
          <h3 class="card-title">${ibadge('tag')}<span>Etichette base</span></h3>${base}
          <p class="form-hint" style="margin:10px 0 0">Le etichette con «In calendario di default» inviano automaticamente il task al calendario (modificabile sul singolo task).</p>
        </section>
        <section class="card toned tone-violet span-6">
          <h3 class="card-title">${ibadge('folder')}<span>Progetti</span></h3>
          ${projects || '<div class="muted small">Nessun progetto.</div>'}
          <form class="add-row" data-form="add-project"><input class="input input-sm" name="name" placeholder="Nome nuovo progetto" autocomplete="off">
            <button class="btn btn-sm btn-primary" type="submit">${icon('plus')}Aggiungi</button></form>
        </section>
        <section class="card toned tone-indigo span-12">
          <h3 class="card-title">${ibadge('users')}<span>Persone</span><span class="count">${Store.people().length} contatti</span></h3>
          ${people || '<div class="muted small">Nessuna persona. Puoi aggiungerle qui o direttamente dai task.</div>'}
          <form class="add-row" data-form="add-person">
            <input class="input input-sm" name="name" placeholder="Nome e cognome" autocomplete="off">
            <input class="input input-sm" name="role" placeholder="Ruolo / ente (facoltativo)" autocomplete="off">
            <button class="btn btn-sm btn-primary" type="submit">${icon('plus')}Aggiungi</button></form>
        </section>
        <section class="card toned tone-sky span-6">
          <h3 class="card-title">${ibadge('download')}<span>Dati</span></h3>
          <div class="data-actions">
            <button class="btn" data-act="export">${icon('download')}Esporta backup</button>
            <span class="date-pick"><button class="btn" data-act="import-pick">${icon('upload')}Importa backup</button>
              <input type="file" accept="application/json,.json" data-change="import" tabindex="-1" aria-hidden="true"></span>
            ${Store.hasDemo() ? `<button class="btn" data-act="remove-demo">${icon('trash')}Rimuovi dati dimostrativi</button>` : ''}
            <button class="btn btn-ghost danger" data-act="reset-all">${icon('alert')}Azzera tutto</button>
          </div>
          ${Auth.mode === 'local'
            ? '<p class="note-box warn">In questa versione locale i dati restano <strong>solo in questo browser, su questo dispositivo</strong>. Esporta un backup per portarli nella versione online.</p>'
            : '<p class="note-box">Ogni modifica viene salvata subito su questo dispositivo e inviata a OneDrive appena c\'è rete. Il backup resta utile come copia di sicurezza, o per importare i dati dalla versione locale. «Azzera tutto» cancella i dati anche dagli altri dispositivi.</p>'}
        </section>
        <section class="card toned tone-amber span-6">
          <h3 class="card-title">${ibadge('sun')}<span>Aspetto</span></h3>
          <div class="seg">${themeBtn('auto', 'Automatico', 'monitor')}${themeBtn('light', 'Chiaro', 'sun')}${themeBtn('dark', 'Scuro', 'moon')}</div>
          <p class="form-hint" style="margin:12px 0 0">«Automatico» segue l'impostazione del sistema operativo.</p>
        </section>
      </div>
    </div>`;
  }

  Object.assign(Changes, {
    pref: el => { Prefs.set(el.dataset.key, el.checked); App.render(); },
    'label-color': el => Store.updateLabel(el.dataset.id, { color: el.value }),
    'label-autocal': el => Store.updateLabel(el.dataset.id, { autoCal: el.checked }),
    'label-name': el => { const v = el.value.trim(); if (v) Store.updateLabel(el.dataset.id, { name: v }); else App.render(); },
    'person-field': el => {
      const v = el.value.trim();
      if (el.dataset.field === 'name' && !v) { App.render(); return; }
      Store.updatePerson(el.dataset.id, { [el.dataset.field]: v });
    },
    import: el => {
      const f = el.files && el.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = async () => {
        const ok = await UI.confirm('Importare il backup? I dati attuali verranno sostituiti.', { ok: 'Importa', title: 'Importa backup' });
        if (!ok) return;
        try { Store.importJSON(r.result); UI.toast('Backup importato'); }
        catch (e) { UI.toast('File non valido: impossibile importare'); }
      };
      r.readAsText(f);
      el.value = '';
    },
  });
  Object.assign(Forms, {
    'add-project': f => { const n = f.elements.name.value.trim(); if (n) { Store.addProject(n); UI.toast('Progetto creato'); } },
    'add-person': f => {
      const n = f.elements.name.value.trim(); if (!n) return;
      Store.addPerson({ name: n, role: f.elements.role.value.trim() });
      UI.toast('Persona aggiunta');
    },
  });
  Object.assign(Actions, {
    'del-label': async id => {
      const l = Store.label(id); const n = Store.tasksWithLabel(id).length;
      if (await UI.confirm(`Eliminare il progetto «${l.name}»? ${n ? `L'etichetta verrà tolta da ${n} task (i task restano).` : ''}`, { ok: 'Elimina', danger: true, title: 'Elimina progetto' })) Store.deleteLabel(id);
    },
    'del-person': async id => {
      const p = Store.person(id);
      if (await UI.confirm(`Eliminare «${p.name}» dai contatti? Verrà tolta dai task associati.`, { ok: 'Elimina', danger: true, title: 'Elimina persona' })) Store.deletePerson(id);
    },
    export: () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dashboard-hs-backup-${U.todayISO()}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    'import-pick': (id, el) => el.parentElement.querySelector('input').click(),
    'remove-demo': async () => {
      if (await UI.confirm('Rimuovere tutti i task, i progetti e le persone dimostrativi? I dati inseriti da te restano.', { ok: 'Rimuovi', danger: true, title: 'Dati dimostrativi' })) {
        Store.removeDemo(); UI.toast('Dati dimostrativi rimossi');
      }
    },
    'reset-all': async () => {
      if (await UI.confirm('Eliminare TUTTI i dati (task, progetti, persone)? L\'operazione non è reversibile: esporta prima un backup.', { ok: 'Azzera', danger: true, title: 'Azzera tutto' })) {
        Store.resetAll(); UI.toast('Dati azzerati');
      }
    },
    theme: (id, el) => { Theme.set(el.dataset.v); App.render(); },
  });

  return { render };
})();
