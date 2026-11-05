'use strict';
/* Avvio, navigazione, eventi globali, stato account/sincronizzazione */
const Theme = {
  get() { try { return localStorage.getItem('hs-theme') || 'auto'; } catch (e) { return 'auto'; } },
  set(v) { try { localStorage.setItem('hs-theme', v); } catch (e) { /* ignora */ } this.apply(); },
  apply() {
    const v = this.get();
    const dark = v === 'dark' || (v === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  },
};

const App = (() => {
  const NAV = [
    { id: 'dashboard',    label: 'Dashboard',    short: 'Home',     icon: 'home' },
    { id: 'posta',        label: 'Posta',        short: 'Posta',    icon: 'mail', soon: true },
    { id: 'agenda',       label: 'Agenda',       short: 'Agenda',   icon: 'book' },
    { id: 'calendario',   label: 'Calendario',   short: 'Calend.',  icon: 'calendar' },
    { id: 'impostazioni', label: 'Impostazioni', short: 'Opzioni',  icon: 'settings' },
  ];
  const VIEWS = { dashboard: DashboardView, posta: MailView, agenda: AgendaView, calendario: CalendarView, impostazioni: SettingsView };
  let current = null;
  let pendingRender = false;

  function parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = VIEWS[parts[0]] ? parts[0] : 'dashboard';
    return { name, arg: parts[1] };
  }

  function renderNav() {
    document.getElementById('nav').innerHTML = NAV.map(n =>
      `<a href="#/${n.id}" data-view="${n.id}"><span class="nv-ic">${icon(n.icon)}</span><span>${n.label}</span>${n.soon ? '<span class="soon">presto</span>' : ''}</a>`).join('');
    document.getElementById('bottom-nav').innerHTML = NAV.map(n =>
      `<a href="#/${n.id}" data-view="${n.id}"><span class="nv-ic">${icon(n.icon)}</span><span>${n.short}</span></a>`).join('');
  }

  /* Riquadro account nella barra laterale + avviso di rete su telefono */
  function renderChrome() {
    const acct = document.getElementById('acct');
    const pill = document.getElementById('net-pill');
    const d = Sync.describe();
    document.querySelectorAll('[data-sync-text]').forEach(el => { el.textContent = d.text; });
    document.querySelectorAll('[data-sync-tone]').forEach(el => { el.dataset.syncTone = d.tone; });
    document.getElementById('ver-pill').textContent = `v${CONFIG.version}${Auth.mode === 'local' ? ' · versione locale' : ''}`;
    if (Auth.needsLogin()) { acct.innerHTML = ''; pill.hidden = true; return; }

    if (Auth.mode === 'local') {
      acct.innerHTML = `<div class="acct-box"><div class="acct-local">${icon('monitor')}<span>Dati solo in questo browser. L'accesso e la sincronizzazione sono nella versione online.</span></div></div>`;
    } else {
      const a = Auth.account || {};
      const act = Sync.status === 'auth' ? 'relogin' : 'sync-now';
      acct.innerHTML = `<div class="acct-box">
        <div class="acct-row"><span class="avatar lg" style="--pc:#3B5BDB">${U.esc(U.initials(a.name || a.username || '?'))}</span>
          <div class="acct-id"><b>${U.esc(a.name || 'Account Microsoft')}</b><span>${U.esc(a.username || '')}</span></div></div>
        <button type="button" class="sync-line" data-act="${act}" data-sync-tone="${d.tone}" title="${act === 'relogin' ? 'Riconnetti' : 'Sincronizza ora'}">
          <i class="sync-dot"></i><span data-sync-text>${U.esc(d.text)}</span>${icon('refresh')}</button>
        ${PWA.canInstall ? `<button type="button" class="btn btn-sm install-btn" data-act="install">${icon('download')}Installa l'app</button>` : ''}
      </div>`;
    }
    const show = ['offline', 'error', 'auth'].includes(Sync.status);
    pill.hidden = !show;
    if (show) {
      const act = Sync.status === 'auth' ? 'relogin' : Sync.status === 'error' ? 'sync-now' : '';
      pill.dataset.syncTone = d.tone;
      pill.innerHTML = `<button type="button" ${act ? `data-act="${act}"` : 'disabled'}><i class="sync-dot"></i>${Sync.status === 'auth' ? 'Riconnetti' : Sync.status === 'error' ? 'Errore sync · riprova' : 'Offline'}</button>`;
    }
  }

  function render() {
    pendingRender = false;
    const main = document.getElementById('main');
    if (Auth.needsLogin()) {
      document.body.classList.add('locked');
      document.body.dataset.page = 'login';
      LoginView.render(main);
      renderChrome();
      return;
    }
    document.body.classList.remove('locked');
    const { name, arg } = parse();
    const changed = name !== current;
    current = name;
    document.body.dataset.page = name;
    document.querySelectorAll('[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    VIEWS[name].render(main, arg);
    if (changed) window.scrollTo(0, 0);
    document.title = `${NAV.find(n => n.id === name).label} · Dashboard H&S`;
    renderChrome();
  }

  const typingInMain = () => {
    const a = document.activeElement;
    return a && a.closest && a.closest('#main') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName);
  };

  function initEvents() {
    document.addEventListener('click', e => {
      const n = e.target.closest('[data-nav]');
      if (n) { const v = VIEWS[current]; if (v && v.nav) v.nav(n.dataset.nav); return; }
      const a = e.target.closest('[data-act]');
      if (a && Actions[a.dataset.act]) { e.preventDefault(); Actions[a.dataset.act](a.dataset.id, a, e); }
    });
    document.addEventListener('change', e => {
      const el = e.target.closest('[data-change]');
      if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el, e);
    });
    document.addEventListener('submit', e => {
      const f = e.target.closest('[data-form]');
      if (f && Forms[f.dataset.form]) { e.preventDefault(); Forms[f.dataset.form](f); }
    });
    document.getElementById('main').addEventListener('focusout', () => { setTimeout(() => { if (pendingRender && !typingInMain()) render(); }, 50); });

    // Tastiera: frecce per sfogliare, N per nuovo task
    document.addEventListener('keydown', e => {
      if (Auth.needsLogin() || UI.isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
      const v = VIEWS[current];
      if (e.key === 'ArrowLeft' && v.nav) { v.nav('prev'); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && v.nav) { v.nav('next'); e.preventDefault(); }
      else if (e.key.toLowerCase() === 'n') {
        UI.openTaskEditor(null, { date: current === 'agenda' ? AgendaView.date : U.todayISO() });
        e.preventDefault();
      }
    });

    // Swipe orizzontale (agenda: giorni; calendario: mesi)
    let sx = 0, sy = 0, st = 0;
    const main = document.getElementById('main');
    main.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    main.addEventListener('touchend', e => {
      const v = VIEWS[current]; if (!v || !v.swipe || UI.isModalOpen() || Auth.needsLogin()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy)) v.nav(dx < 0 ? 'next' : 'prev');
    }, { passive: true });

    window.addEventListener('hashchange', render);
    window.addEventListener('online', renderChrome);
    window.addEventListener('offline', () => { renderChrome(); if (Auth.needsLogin()) render(); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Theme.apply());
  }

  Object.assign(Actions, {
    'sync-now': () => Sync.syncNow(),
    relogin: () => Auth.login(),
    install: () => PWA.install(),
    logout: async () => {
      const ok = await UI.confirm('Vuoi uscire dall\'account? I dati restano su OneDrive e su questo dispositivo: al prossimo accesso ritrovi tutto.', { ok: 'Esci', title: 'Esci dall\'account' });
      if (ok) Auth.logout();
    },
  });

  async function start() {
    Theme.apply();
    await Auth.init();
    Store.load({ seed: Auth.mode === 'local' });
    renderNav();
    initEvents();
    Store.subscribe(source => {
      if (source === 'remote' && typingInMain()) { pendingRender = true; return; }
      render();
    });
    Auth.subscribe(render);
    Sync.subscribe(renderChrome);
    PWA.subscribe(() => { renderChrome(); if (current === 'impostazioni') render(); });
    Sync.init();
    PWA.init();
    render();
  }

  return { start, render, renderChrome, get current() { return current; } };
})();

App.start();
