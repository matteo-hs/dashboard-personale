'use strict';
/* Avvio, navigazione, eventi globali */
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

  function render() {
    const { name, arg } = parse();
    const changed = name !== current;
    current = name;
    document.body.dataset.page = name;
    document.querySelectorAll('[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    VIEWS[name].render(document.getElementById('main'), arg);
    if (changed) window.scrollTo(0, 0);
    document.title = `${NAV.find(n => n.id === name).label} · Dashboard H&S`;
  }

  function initEvents() {
    document.addEventListener('click', e => {
      const n = e.target.closest('[data-nav]');
      if (n) { const v = VIEWS[current]; if (v.nav) v.nav(n.dataset.nav); return; }
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

    // Tastiera: frecce per sfogliare, N per nuovo task
    document.addEventListener('keydown', e => {
      if (UI.isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
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
      const v = VIEWS[current]; if (!v.swipe || UI.isModalOpen()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy)) v.nav(dx < 0 ? 'next' : 'prev');
    }, { passive: true });

    window.addEventListener('hashchange', render);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Theme.apply());
  }

  function start() {
    Theme.apply();
    Store.load();
    renderNav();
    initEvents();
    Store.subscribe(render);
    render();
  }

  return { start, render, get current() { return current; } };
})();

App.start();
