'use strict';
/* Archivio dati: copia completa nel browser (localStorage) + sincronizzazione su OneDrive (v0.2).
   Regole di sincronizzazione:
   - ogni task, etichetta e persona ha updatedAt; in caso di modifiche su due dispositivi vince la più recente;
   - le eliminazioni lasciano una "lapide" in state.deleted (id → istante) così si propagano agli altri dispositivi;
   - lo slittamento orario per giornata (dayPrefs) ha il suo istante ts. */

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
/* Vocabolario hashtag predefinito (modificabile in Impostazioni; letto anche dall'attività di Claude) */
const DEFAULT_HASHTAGS = ['#robotica', '#coding', '#stampa3D', '#tagliolaser', '#laboratorio', '#campus', '#extracurricolare',
  '#formazionedocenti', '#bando', '#finanziamento', '#preventivo', '#proposta', '#contratto', '#fattura', '#pagamenti', '#iscrizioni',
  '#scadenza', '#riunione', '#calendario', '#logistica', '#materiali', '#formatori', '#scuola', '#famiglie', '#fornitori', '#team', '#TACTIVITY'];
const DEFAULT_SIGNATURE = 'Matteo Filippetti\nHub&Start srl';
const TOMBSTONE_DAYS = 120;

const Store = (() => {
  let state = null;
  let persistOK = true;
  let version = 0; // contatore delle modifiche locali (serve alla sincronizzazione)
  const listeners = new Set();
  const now = () => Date.now();

  const defaultState = () => ({
    schema: 2,
    tasks: [],
    labels: BASE_LABELS.map(l => ({ ...l, updatedAt: 0 })),
    people: [],
    dayPrefs: {},
    handled: {},
    settings: { hashtags: [...DEFAULT_HASHTAGS], signature: DEFAULT_SIGNATURE, ts: 0 },
    deleted: {},
    createdAt: now(),
    updatedAt: now(),
  });

  function normalize(s) {
    s = Object.assign(defaultState(), JSON.parse(JSON.stringify(s || {})));
    if (!s.dayPrefs || typeof s.dayPrefs !== 'object') s.dayPrefs = {};
    if (!s.deleted || typeof s.deleted !== 'object') s.deleted = {};
    if (!s.handled || typeof s.handled !== 'object') s.handled = {};
    if (!s.settings || typeof s.settings !== 'object') s.settings = {};
    s.settings = { hashtags: [...DEFAULT_HASHTAGS], signature: DEFAULT_SIGNATURE, ts: 0, ...s.settings };
    for (const b of BASE_LABELS) if (!s.labels.find(l => l.id === b.id)) s.labels.unshift({ ...b, updatedAt: 0 });
    s.labels = s.labels.map(l => ({ updatedAt: 0, ...l }));
    s.people = (s.people || []).map(p => ({ role: '', email: '', updatedAt: 0, ...p }));
    s.tasks = (s.tasks || []).map(t => ({
      labels: [], people: [], links: [], comments: [], notes: '', status: 'todo',
      start: '', end: '', inCalendar: false, source: 'manual', updatedAt: 0, ...t,
    }));
    for (const [k, v] of Object.entries(s.dayPrefs)) s.dayPrefs[k] = { m: 0, a: 0, ts: 0, ...v };
    s.schema = 2;
    return s;
  }

  function load({ seed = true } = {}) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { state = normalize(JSON.parse(raw)); return; }
    } catch (e) { persistOK = false; }
    state = defaultState();
    if (seed) seedDemo();
    save();
  }
  function save() {
    state.updatedAt = now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); persistOK = true; }
    catch (e) { persistOK = false; }
  }
  function commit(source = 'local') {
    save();
    if (source === 'local') version++;
    listeners.forEach(f => { try { f(source); } catch (e) { console.error('[store listener]', e); } });
  }
  const subscribe = f => listeners.add(f);
  const tomb = id => { state.deleted[id] = now(); };
  const touch = x => { if (x) x.updatedAt = now(); };

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
    const l = { id: U.uid(), name: n, type: 'project', color: PROJECT_COLORS[projects().length % PROJECT_COLORS.length], autoCal: false, ...extra, updatedAt: now() };
    state.labels.push(l);
    commit();
    return l;
  }
  function updateLabel(id, patch) { const l = label(id); if (l) { Object.assign(l, patch); touch(l); commit(); } }
  function deleteLabel(id) {
    state.labels = state.labels.filter(l => l.id !== id);
    tomb(id);
    state.tasks.forEach(t => { if (t.labels.includes(id)) { t.labels = t.labels.filter(x => x !== id); touch(t); } });
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
      p = { id: U.uid(), name: n, role: '', email: '', color: PERSON_COLORS[state.people.length % PERSON_COLORS.length], ...extra, name: n, updatedAt: now() };
      state.people.push(p);
    }
    return p;
  }
  function addPerson(data) { const p = ensurePerson(data.name, data); if (p) commit(); return p; }
  function updatePerson(id, patch) { const p = person(id); if (p) { Object.assign(p, patch); touch(p); commit(); } }
  function deletePerson(id) {
    state.people = state.people.filter(p => p.id !== id);
    tomb(id);
    state.tasks.forEach(t => { if (t.people.includes(id)) { t.people = t.people.filter(x => x !== id); touch(t); } });
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
    for (const o of oldL) if (!newL.includes(o)) { const x = task(o); if (x) { x.links = x.links.filter(i => i !== id); touch(x); } }
    for (const n of newL) { const x = task(n); if (x && !x.links.includes(id)) { x.links.push(id); touch(x); } }
  }
  function addTask(data) {
    const t = {
      id: U.uid(), title: '', date: U.todayISO(), start: '', end: '', labels: [], people: [], notes: '',
      comments: [], status: 'todo', source: 'manual', links: [], createdAt: now(), ...data, updatedAt: now(),
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
    Object.assign(t, patch, { updatedAt: now() });
    if (patch.links) syncLinks(id, oldLinks, patch.links);
    commit();
    return t;
  }
  function deleteTask(id) {
    const t = task(id); if (!t) return null;
    syncLinks(id, t.links, []);
    state.tasks = state.tasks.filter(x => x.id !== id);
    tomb(id);
    commit();
    return t;
  }
  function restoreTask(t) {
    delete state.deleted[t.id];
    t.links = t.links.filter(i => task(i));
    t.updatedAt = now();
    state.tasks.push(t);
    syncLinks(t.id, [], t.links);
    commit();
  }
  const setStatus = (id, s) => updateTask(id, { status: s });
  const toggleDone = id => { const t = task(id); return updateTask(id, { status: t.status === 'done' ? 'todo' : 'done' }); };
  const toggleCalendar = id => { const t = task(id); return updateTask(id, { inCalendar: !t.inCalendar }); };
  function addComment(id, text) {
    const t = task(id); if (!t || !text.trim()) return;
    t.comments.push({ id: U.uid(), text: text.trim(), ts: now() });
    touch(t);
    commit();
  }
  function deleteComment(id, cid) { const t = task(id); if (!t) return; t.comments = t.comments.filter(c => c.id !== cid); touch(t); commit(); }

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
  const dayPref = iso => { const p = state.dayPrefs[iso] || {}; return { m: p.m || 0, a: p.a || 0 }; };
  function setDayPref(iso, patch) {
    state.dayPrefs[iso] = { ...dayPref(iso), ...patch, ts: now() };
    commit();
  }

  /* Elementi del recap / task proposti già gestiti (sincronizzati tra dispositivi) */
  const handledInfo = id => { const h = state.handled[id]; return h && h.a ? h : null; };
  const isHandled = id => !!handledInfo(id);
  function markHandled(id, a) { state.handled[id] = { a: a || null, ts: now() }; commit(); }

  /* Impostazioni condivise tra dispositivi */
  const settings = () => state.settings;
  function setSettings(patch) { state.settings = { ...state.settings, ...patch, ts: now() }; commit(); }
  const wasDeleted = id => !!state.deleted[id];

  /* ---------- Sincronizzazione: unione di due stati ---------- */
  function signature(s) {
    const out = [];
    s.tasks.forEach(t => out.push(`t${t.id}:${t.updatedAt || 0}`));
    s.labels.forEach(l => out.push(`l${l.id}:${l.updatedAt || 0}`));
    s.people.forEach(p => out.push(`p${p.id}:${p.updatedAt || 0}`));
    Object.entries(s.dayPrefs).forEach(([k, v]) => out.push(`d${k}:${v.ts || 0}`));
    Object.keys(s.deleted).forEach(k => out.push(`x${k}`));
    Object.entries(s.handled || {}).forEach(([k, v]) => out.push(`h${k}:${v.ts || 0}`));
    out.push(`s:${(s.settings && s.settings.ts) || 0}`);
    return out.sort().join('|');
  }
  function mergeStates(a, b) {
    const deleted = { ...b.deleted };
    for (const [k, v] of Object.entries(a.deleted)) deleted[k] = Math.max(deleted[k] || 0, v);
    const limit = now() - TOMBSTONE_DAYS * 86400000;
    for (const [k, v] of Object.entries(deleted)) if (v < limit) delete deleted[k];
    const coll = (x, y) => {
      const map = new Map();
      for (const r of y) map.set(r.id, r);
      for (const r of x) { const o = map.get(r.id); if (!o || (r.updatedAt || 0) > (o.updatedAt || 0)) map.set(r.id, r); }
      return [...map.values()].filter(r => !(deleted[r.id] && deleted[r.id] >= (r.updatedAt || 0)));
    };
    const m = {
      ...a,
      tasks: coll(a.tasks, b.tasks).map(t => ({ ...t, links: [...t.links] })),
      labels: coll(a.labels, b.labels),
      people: coll(a.people, b.people),
      dayPrefs: { ...b.dayPrefs },
      deleted,
    };
    for (const [k, v] of Object.entries(a.dayPrefs)) if (!m.dayPrefs[k] || (v.ts || 0) > (m.dayPrefs[k].ts || 0)) m.dayPrefs[k] = v;
    m.handled = { ...(b.handled || {}) };
    for (const [k, v] of Object.entries(a.handled || {})) if (!m.handled[k] || (v.ts || 0) > (m.handled[k].ts || 0)) m.handled[k] = v;
    m.settings = ((a.settings && a.settings.ts) || 0) >= ((b.settings && b.settings.ts) || 0) ? a.settings : b.settings;
    const hLimit = now() - 90 * 86400000;
    for (const [k, v] of Object.entries(m.handled)) if ((v.ts || 0) < hLimit) delete m.handled[k];
    for (const b0 of BASE_LABELS) if (!m.labels.find(l => l.id === b0.id)) m.labels.unshift({ ...b0, updatedAt: 0 });
    // coerenza dei riferimenti
    const ids = new Set(m.tasks.map(t => t.id));
    const lids = new Set(m.labels.map(l => l.id));
    const pids = new Set(m.people.map(p => p.id));
    m.tasks.forEach(t => {
      t.links = t.links.filter(i => ids.has(i) && i !== t.id);
      t.labels = t.labels.filter(i => lids.has(i));
      t.people = t.people.filter(i => pids.has(i));
    });
    const byId = new Map(m.tasks.map(t => [t.id, t]));
    m.tasks.forEach(t => t.links.forEach(i => { const o = byId.get(i); if (o && !o.links.includes(t.id)) o.links.push(t.id); }));
    return m;
  }
  /* Unisce i dati arrivati da OneDrive in quelli locali. Ritorna se il remoto va aggiornato. */
  function mergeIn(remoteRaw) {
    if (!remoteRaw) return { remoteChanged: true, localChanged: false };
    const remote = normalize(remoteRaw);
    const merged = mergeStates(state, remote);
    const sigM = signature(merged);
    const localChanged = sigM !== signature(state);
    const remoteChanged = sigM !== signature(remote);
    if (localChanged) { state = merged; commit('remote'); }
    return { remoteChanged, localChanged };
  }
  const snapshot = () => JSON.parse(JSON.stringify(state));

  /* Dati */
  const exportJSON = () => JSON.stringify(state, null, 2);
  function importJSON(text) {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.tasks) || !Array.isArray(obj.labels)) throw new Error('File non valido');
    const incoming = normalize(obj);
    const keep = new Set([...incoming.tasks, ...incoming.labels, ...incoming.people].map(x => x.id));
    const deleted = { ...state.deleted };
    [...state.tasks, ...state.labels, ...state.people].forEach(x => { if (!keep.has(x.id) && x.type !== 'base') deleted[x.id] = now(); });
    const t = now();
    [...incoming.tasks, ...incoming.labels, ...incoming.people].forEach(x => { x.updatedAt = t; delete deleted[x.id]; });
    Object.values(incoming.dayPrefs).forEach(v => { v.ts = t; });
    incoming.deleted = deleted;
    state = incoming;
    commit();
  }
  const hasDemo = () => state.tasks.some(t => t.demo) || state.people.some(p => p.demo) || state.labels.some(l => l.demo);
  function removeDemo() {
    const ids = new Set(state.tasks.filter(t => t.demo).map(t => t.id));
    const demoLabels = new Set(state.labels.filter(l => l.demo).map(l => l.id));
    const demoPeople = new Set(state.people.filter(p => p.demo).map(p => p.id));
    [...ids, ...demoLabels, ...demoPeople].forEach(tomb);
    state.tasks = state.tasks.filter(t => !t.demo);
    state.labels = state.labels.filter(l => !l.demo);
    state.people = state.people.filter(p => !p.demo);
    state.tasks.forEach(t => {
      const before = JSON.stringify([t.links, t.labels, t.people]);
      t.links = t.links.filter(i => !ids.has(i));
      t.labels = t.labels.filter(x => !demoLabels.has(x));
      t.people = t.people.filter(x => !demoPeople.has(x));
      if (JSON.stringify([t.links, t.labels, t.people]) !== before) touch(t);
    });
    commit();
  }
  function resetAll() {
    const deleted = { ...state.deleted };
    [...state.tasks, ...state.people, ...state.labels.filter(l => l.type !== 'base')].forEach(x => { deleted[x.id] = now(); });
    state = defaultState();
    state.deleted = deleted;
    state.labels.forEach(touch);
    commit();
  }

  /* Dati dimostrativi (solo nella versione locale da file) */
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
    add({ title: 'Simulazione Monte Carlo – regole v3', date: D(-2), start: '15:00', labels: [tact], status: 'done', comments: [{ id: U.uid(), text: 'Bilanciamento ok, rivedere la durata media della partita.', ts: now() - 2 * 86400000 }] });
    add({ title: 'Inviare preventivo extracurricolare', date: D(-1), labels: ['sede'], status: 'todo' });
  }

  return {
    load, subscribe, get persistOK() { return persistOK; }, get version() { return version; },
    byTime, byDateTime,
    label, labels, baseLabels, projects, autoCal, addProject, updateLabel, deleteLabel, tasksWithLabel,
    person, people, ensurePerson, addPerson, updatePerson, deletePerson, tasksWithPerson,
    task, allTasks, tasksOn, calendarTasksOn, tasksBetween, addTask, updateTask, deleteTask, restoreTask,
    setStatus, toggleDone, toggleCalendar, addComment, deleteComment, related, relatedCount, dayPref, setDayPref,
    handledInfo, isHandled, markHandled, settings, setSettings, wasDeleted,
    mergeIn, snapshot, mergeStates, normalize, signature,
    exportJSON, importJSON, hasDemo, removeDemo, resetAll,
  };
})();
