'use strict';
/* Archivio dati locale (v0.1: localStorage del browser).
   Nella v0.2 lo stesso modello verrà sincronizzato su OneDrive. */

const BASE_LABELS = [
  { id: 'didattica',    name: 'Attività Didattica', type: 'base', color: '#0D9488', autoCal: true },
  { id: 'personale',    name: 'Personale',          type: 'base', color: '#DB2777', autoCal: false },
  { id: 'sede',         name: 'Lavoro in sede',     type: 'base', color: '#EA580C', autoCal: false },
  { id: 'appuntamento', name: 'Appuntamento',       type: 'base', color: '#2563EB', autoCal: true },
];
const PROJECT_COLORS = ['#059669', '#CA8A04', '#0891B2', '#BE123C', '#4D7C0F', '#C026D3', '#475569', '#B45309'];
const PERSON_COLORS = ['#3B5BDB', '#0D9488', '#C2410C', '#7C3AED', '#BE185D', '#15803D', '#0369A1', '#A16207'];

const STATUS = {
  todo:      { label: 'Da fare' },
  doing:     { label: 'In corso' },
  waiting:   { label: 'In attesa' },
  done:      { label: 'Completato' },
  cancelled: { label: 'Annullato' },
};
const STATUS_ORDER = ['todo', 'doing', 'waiting', 'done', 'cancelled'];
const STORE_KEY = 'hs-dashboard-v1';

const Store = (() => {
  let state = null;
  let persistOK = true;
  const listeners = new Set();

  const defaultState = () => ({
    schema: 1,
    tasks: [],
    labels: BASE_LABELS.map(l => ({ ...l })),
    people: [],
    dayPrefs: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  function normalize(s) {
    s = Object.assign(defaultState(), s || {});
    if (!s.dayPrefs || typeof s.dayPrefs !== 'object') s.dayPrefs = {};
    for (const b of BASE_LABELS) if (!s.labels.find(l => l.id === b.id)) s.labels.unshift({ ...b });
    s.tasks = (s.tasks || []).map(t => ({
      labels: [], people: [], links: [], comments: [], notes: '', status: 'todo',
      start: '', end: '', inCalendar: false, source: 'manual', ...t,
    }));
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { state = normalize(JSON.parse(raw)); return; }
    } catch (e) { persistOK = false; }
    state = defaultState();
    seedDemo();
    save();
  }
  function save() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); persistOK = true; }
    catch (e) { persistOK = false; }
  }
  function commit() { save(); listeners.forEach(f => f()); }
  const subscribe = f => listeners.add(f);

  /* Ordinamenti */
  const byTime = (a, b) => {
    const ta = a.start || '99:99', tb = b.start || '99:99';
    return ta < tb ? -1 : ta > tb ? 1 : (a.createdAt - b.createdAt);
  };
  const byDateTime = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byTime(a, b));

  /* Etichette */
  const label = id => state.labels.find(l => l.id === id);
  const labels = () => state.labels;
  const baseLabels = () => state.labels.filter(l => l.type === 'base');
  const projects = () => state.labels.filter(l => l.type === 'project');
  const autoCal = ids => ids.some(id => { const l = label(id); return !!(l && l.autoCal); });
  function addProject(name, extra = {}) {
    const n = name.trim();
    const ex = projects().find(p => p.name.toLowerCase() === n.toLowerCase());
    if (ex) return ex;
    const l = { id: U.uid(), name: n, type: 'project', color: PROJECT_COLORS[projects().length % PROJECT_COLORS.length], autoCal: false, ...extra };
    state.labels.push(l);
    commit();
    return l;
  }
  function updateLabel(id, patch) { const l = label(id); if (l) { Object.assign(l, patch); commit(); } }
  function deleteLabel(id) {
    state.labels = state.labels.filter(l => l.id !== id);
    state.tasks.forEach(t => { t.labels = t.labels.filter(x => x !== id); });
    commit();
  }
  const tasksWithLabel = id => state.tasks.filter(t => t.labels.includes(id)).sort(byDateTime);

  /* Persone */
  const person = id => state.people.find(p => p.id === id);
  const people = () => [...state.people].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  function ensurePerson(name, extra = {}) { // non salva: lo fa chi chiama
    const n = name.trim();
    if (!n) return null;
    let p = state.people.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (!p) {
      p = { id: U.uid(), name: n, role: '', email: '', color: PERSON_COLORS[state.people.length % PERSON_COLORS.length], ...extra, name: n };
      state.people.push(p);
    }
    return p;
  }
  function addPerson(data) { const p = ensurePerson(data.name, data); if (p) commit(); return p; }
  function updatePerson(id, patch) { const p = person(id); if (p) { Object.assign(p, patch); commit(); } }
  function deletePerson(id) {
    state.people = state.people.filter(p => p.id !== id);
    state.tasks.forEach(t => { t.people = t.people.filter(x => x !== id); });
    commit();
  }
  const tasksWithPerson = id => state.tasks.filter(t => t.people.includes(id)).sort(byDateTime);

  /* Task */
  const task = id => state.tasks.find(t => t.id === id);
  const allTasks = () => state.tasks;
  const tasksOn = iso => state.tasks.filter(t => t.date === iso).sort(byTime);
  const calendarTasksOn = iso => tasksOn(iso).filter(t => t.inCalendar);
  const tasksBetween = (a, b) => state.tasks.filter(t => t.date >= a && t.date <= b).sort(byDateTime);

  function syncLinks(id, oldL, newL) { // i collegamenti diretti sono sempre reciproci
    for (const o of oldL) if (!newL.includes(o)) { const x = task(o); if (x) x.links = x.links.filter(i => i !== id); }
    for (const n of newL) { const x = task(n); if (x && !x.links.includes(id)) x.links.push(id); }
  }
  function addTask(data) {
    const now = Date.now();
    const t = {
      id: U.uid(), title: '', date: U.todayISO(), start: '', end: '', labels: [], people: [], notes: '',
      comments: [], status: 'todo', source: 'manual', links: [], createdAt: now, updatedAt: now, ...data,
    };
    if (t.inCalendar === undefined) t.inCalendar = autoCal(t.labels);
    state.tasks.push(t);
    syncLinks(t.id, [], t.links);
    commit();
    return t;
  }
  function updateTask(id, patch) {
    const t = task(id); if (!t) return null;
    const oldLinks = [...t.links];
    Object.assign(t, patch, { updatedAt: Date.now() });
    if (patch.links) syncLinks(id, oldLinks, patch.links);
    commit();
    return t;
  }
  function deleteTask(id) {
    const t = task(id); if (!t) return null;
    syncLinks(id, t.links, []);
    state.tasks = state.tasks.filter(x => x.id !== id);
    commit();
    return t;
  }
  function restoreTask(t) {
    t.links = t.links.filter(i => task(i));
    state.tasks.push(t);
    syncLinks(t.id, [], t.links);
    commit();
  }
  const setStatus = (id, s) => updateTask(id, { status: s });
  const toggleDone = id => { const t = task(id); return updateTask(id, { status: t.status === 'done' ? 'todo' : 'done' }); };
  const toggleCalendar = id => { const t = task(id); return updateTask(id, { inCalendar: !t.inCalendar }); };
  function addComment(id, text) {
    const t = task(id); if (!t || !text.trim()) return;
    t.comments.push({ id: U.uid(), text: text.trim(), ts: Date.now() });
    t.updatedAt = Date.now();
    commit();
  }
  function deleteComment(id, cid) { const t = task(id); if (!t) return; t.comments = t.comments.filter(c => c.id !== cid); commit(); }

  /* Task collegati: diretti + stessa etichetta di progetto */
  function related(id) {
    const t = task(id); if (!t) return { direct: [], byProject: [] };
    const direct = t.links.map(task).filter(Boolean).sort(byDateTime);
    const byProject = t.labels.map(label).filter(l => l && l.type === 'project')
      .map(l => ({ label: l, tasks: tasksWithLabel(l.id).filter(x => x.id !== id) }));
    return { direct, byProject };
  }
  function relatedCount(id) {
    const r = related(id);
    const s = new Set(r.direct.map(x => x.id));
    r.byProject.forEach(g => g.tasks.forEach(x => s.add(x.id)));
    return s.size;
  }

  /* Preferenze per giornata: slittamento di 30' di mattina (m) e pomeriggio (a) */
  const dayPref = iso => ({ m: 0, a: 0, ...(state.dayPrefs[iso] || {}) });
  function setDayPref(iso, patch) {
    const p = { ...dayPref(iso), ...patch };
    if (!p.m && !p.a) delete state.dayPrefs[iso]; else state.dayPrefs[iso] = p;
    commit();
  }

  /* Dati */
  const exportJSON = () => JSON.stringify(state, null, 2);
  function importJSON(text) {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.tasks) || !Array.isArray(obj.labels)) throw new Error('File non valido');
    state = normalize(obj);
    commit();
  }
  const hasDemo = () => state.tasks.some(t => t.demo) || state.people.some(p => p.demo) || state.labels.some(l => l.demo);
  function removeDemo() {
    const ids = new Set(state.tasks.filter(t => t.demo).map(t => t.id));
    const demoLabels = new Set(state.labels.filter(l => l.demo).map(l => l.id));
    const demoPeople = new Set(state.people.filter(p => p.demo).map(p => p.id));
    state.tasks = state.tasks.filter(t => !t.demo);
    state.labels = state.labels.filter(l => !l.demo);
    state.people = state.people.filter(p => !p.demo);
    state.tasks.forEach(t => {
      t.links = t.links.filter(i => !ids.has(i));
      t.labels = t.labels.filter(x => !demoLabels.has(x));
      t.people = t.people.filter(x => !demoPeople.has(x));
    });
    commit();
  }
  function resetAll() { state = defaultState(); commit(); }

  /* Dati dimostrativi (relativi alla data del primo avvio) */
  function seedDemo() {
    const T = U.todayISO(), D = n => U.addDays(T, n);
    const P = name => addProject(name, { demo: true }).id;
    const campus = P('Campus Natale'), bando = P('Bando STEM'), tact = P('TACTIVITY');
    const pp = (n, role) => ensurePerson(n, { role, demo: true }).id;
    const giulia = pp('Giulia Rossi', 'Formatrice'), bianchi = pp('Prof. Bianchi', 'Docente referente'),
      conti = pp('Prof.ssa Conti', 'Dirigente scolastica'), luca = pp('Luca', 'Socio'), marco = pp('Marco Verdi', 'Tutor');
    const add = o => addTask({ demo: true, ...o }).id;

    add({ title: 'Laboratorio robotica LEGO SPIKE Prime – classe 2ª media', date: T, start: '08:30', end: '10:30', labels: ['didattica'], people: [giulia, bianchi], notes: 'Portare 6 kit con hub carichi. Attività: sensore di colore e percorsi.' });
    add({ title: 'Call con dirigente – proposta percorso coding 2026/27', date: T, start: '11:00', end: '11:45', labels: ['appuntamento'], people: [conti] });
    add({ title: 'Preparare kit SPIKE per il laboratorio di domani', date: T, start: '14:30', labels: ['sede'], status: 'done' });
    const bud = add({ title: 'Revisione budget Campus Natale', date: T, start: '16:00', end: '17:00', labels: ['sede', campus], people: [luca], status: 'doing' });
    add({ title: 'Rispondere ai docenti sul calendario dei laboratori', date: T, status: 'waiting', notes: 'In attesa della conferma delle date dalla segreteria.' });
    add({ title: 'Palestra', date: T, start: '19:00', labels: ['personale'] });
    add({ title: 'Laboratorio Scratch – 4ª primaria', date: D(1), start: '09:00', end: '11:00', labels: ['didattica'], people: [marco] });
    const bz = add({ title: 'Bozza progetto per Bando STEM', date: D(1), start: '15:00', labels: [bando], people: [luca] });
    add({ title: 'Incontro formatori – pianificazione Campus', date: D(4), start: '10:00', end: '11:30', labels: ['appuntamento', campus], people: [giulia, marco, luca], source: 'calendar', inCalendar: true });
    add({ title: 'Webinar fornitore stampanti 3D', date: D(5), start: '17:00', labels: ['appuntamento'], status: 'cancelled' });
    add({ title: 'Scadenza invio domanda Bando STEM', date: D(6), labels: [bando], source: 'calendar', inCalendar: true, links: [bz] });
    add({ title: 'Playtest TACTIVITY con classe pilota', date: D(7), start: '10:00', labels: ['didattica', tact], people: [bianchi] });
    add({ title: 'Sopralluogo aula per il Campus', date: D(-1), start: '12:00', labels: ['sede', campus], status: 'done', links: [bud] });
    add({ title: 'Simulazione Monte Carlo – regole v3', date: D(-2), start: '15:00', labels: [tact], status: 'done', comments: [{ id: U.uid(), text: 'Bilanciamento ok, rivedere la durata media della partita.', ts: Date.now() - 2 * 86400000 }] });
    add({ title: 'Inviare preventivo extracurricolare', date: D(-1), labels: ['sede'], status: 'todo' });
  }

  return {
    load, subscribe, get persistOK() { return persistOK; },
    byTime, byDateTime,
    label, labels, baseLabels, projects, autoCal, addProject, updateLabel, deleteLabel, tasksWithLabel,
    person, people, ensurePerson, addPerson, updatePerson, deletePerson, tasksWithPerson,
    task, allTasks, tasksOn, calendarTasksOn, tasksBetween, addTask, updateTask, deleteTask, restoreTask,
    setStatus, toggleDone, toggleCalendar, addComment, deleteComment, related, relatedCount, dayPref, setDayPref,
    exportJSON, importJSON, hasDemo, removeDemo, resetAll,
  };
})();
