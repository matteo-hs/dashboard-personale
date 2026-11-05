'use strict';
/* Accesso con account Microsoft aziendale: OAuth 2.0 "authorization code" con PKCE (standard per app web senza server).
   Modalità:
   - 'local': file aperto dal PC (file://) → niente accesso, niente sincronizzazione, dati solo nel browser;
   - 'test' : localhost con ?testauth → account fittizio per i test automatici;
   - 'ms'   : versione pubblicata → accesso Microsoft obbligatorio. */
const Auth = (() => {
  const C = CONFIG;
  const K = { tok: 'hs-auth', pkce: 'hs-auth-pkce', silent: 'hs-auth-silent' };
  const BASE = `https://login.microsoftonline.com/${C.tenantId}/oauth2/v2.0`;
  let mode = 'ms';
  let tok = null;      // { access, accessExp, refresh, refreshExp, account }
  let lastError = '';
  let refreshing = null;
  const listeners = new Set();

  const authError = msg => Object.assign(new Error(msg || 'Accesso scaduto'), { auth: true });
  const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); };
  const challenge = async v => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  function decodeJwt(t) {
    let p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    p += '='.repeat((4 - (p.length % 4)) % 4);
    const bin = atob(p);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function load() { try { tok = JSON.parse(localStorage.getItem(K.tok) || 'null'); } catch (e) { tok = null; } }
  function save() { try { if (tok) localStorage.setItem(K.tok, JSON.stringify(tok)); else localStorage.removeItem(K.tok); } catch (e) { /* ignora */ } }
  const notify = () => listeners.forEach(f => f());

  function friendly(err, desc = '') {
    if (/AADSTS50105/.test(desc)) return 'Questo account non è autorizzato a usare l\'app.';
    if (/AADSTS50020|AADSTS90072/.test(desc)) return 'Usa l\'account Microsoft di Hub&Start.';
    if (err === 'access_denied') return 'Accesso annullato.';
    if (err === 'consent_required') return 'Mancano le autorizzazioni dell\'app: contatta l\'amministratore.';
    return 'Accesso non riuscito. Riprova.' + (desc ? ` (${desc.split('\n')[0].slice(0, 140)})` : '');
  }

  function setTokens(j, { keepRefreshExp = false } = {}) {
    const t = Date.now();
    const claims = j.id_token ? decodeJwt(j.id_token) : null;
    const account = claims ? { name: claims.name || '', username: claims.preferred_username || '', tid: claims.tid, oid: claims.oid } : tok && tok.account;
    if (account && account.tid && account.tid !== C.tenantId) throw new Error('Account esterno a Hub&Start');
    tok = {
      access: j.access_token,
      accessExp: t + Math.max(60, (j.expires_in || 3600) - 120) * 1000,
      refresh: j.refresh_token || (tok && tok.refresh) || null,
      refreshExp: keepRefreshExp && tok ? tok.refreshExp : t + 23 * 3600 * 1000, // le app web hanno token di rinnovo da 24 ore
      account,
    };
    save();
  }

  async function login({ silent = false } = {}) {
    const verifier = rand(48), state = rand(16);
    try { localStorage.setItem(K.pkce, JSON.stringify({ verifier, state, silent, hash: location.hash || '#/dashboard' })); } catch (e) { /* ignora */ }
    const p = new URLSearchParams({
      client_id: C.clientId, response_type: 'code', redirect_uri: C.redirectUri, response_mode: 'query',
      scope: C.scopes.join(' '), state, code_challenge: await challenge(verifier), code_challenge_method: 'S256',
    });
    const hint = tok && tok.account && tok.account.username;
    if (hint) p.set('login_hint', hint);
    if (silent) p.set('prompt', 'none');
    else if (!hint) p.set('prompt', 'select_account');
    location.assign(`${BASE}/authorize?${p}`);
  }

  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(K.pkce) || 'null'); localStorage.removeItem(K.pkce); } catch (e) { /* ignora */ }
    const clean = () => history.replaceState(null, '', location.origin + location.pathname + ((saved && saved.hash) || '#/dashboard'));
    if (q.has('error')) {
      const err = q.get('error'), desc = q.get('error_description') || '';
      clean();
      if (saved && saved.silent && ['login_required', 'interaction_required', 'consent_required'].includes(err)) return; // serve un accesso manuale
      lastError = friendly(err, desc);
      return;
    }
    if (!saved || q.get('state') !== saved.state) { clean(); lastError = 'Risposta di accesso non valida. Riprova.'; return; }
    try {
      const body = new URLSearchParams({
        client_id: C.clientId, grant_type: 'authorization_code', code: q.get('code'),
        redirect_uri: C.redirectUri, code_verifier: saved.verifier, scope: C.scopes.join(' '),
      });
      const r = await fetch(`${BASE}/token`, { method: 'POST', body });
      const j = await r.json();
      if (!r.ok) throw new Error(friendly(j.error, j.error_description));
      setTokens(j);
      lastError = '';
      try { sessionStorage.removeItem(K.silent); } catch (e) { /* ignora */ }
    } catch (e) { lastError = e.message || 'Accesso non riuscito.'; }
    clean();
  }

  async function doRefresh() {
    const body = new URLSearchParams({ client_id: C.clientId, grant_type: 'refresh_token', refresh_token: tok.refresh, scope: C.scopes.join(' ') });
    let r, j;
    try { r = await fetch(`${BASE}/token`, { method: 'POST', body }); j = await r.json(); }
    catch (e) { throw new Error('Rete non disponibile'); }
    if (!r.ok) {
      if (['invalid_grant', 'interaction_required', 'login_required'].includes(j.error)) {
        tok.refresh = null; tok.refreshExp = 0; save(); notify();
        throw authError();
      }
      throw new Error(j.error_description || j.error || 'Errore di rinnovo');
    }
    setTokens(j, { keepRefreshExp: true });
  }

  async function getToken() {
    if (mode === 'test') return 'test-token';
    if (!tok) throw authError('Accesso necessario');
    if (tok.access && Date.now() < tok.accessExp) return tok.access;
    if (tok.refresh && Date.now() < (tok.refreshExp || 0)) {
      if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
      await refreshing;
      return tok.access;
    }
    throw authError();
  }
  function invalidateAccess() { if (tok) { tok.accessExp = 0; save(); } }

  const sessionValid = () => !!tok && ((tok.access && Date.now() < tok.accessExp) || (tok.refresh && Date.now() < (tok.refreshExp || 0)));

  async function init() {
    if (location.protocol === 'file:') { mode = 'local'; return; }
    if (['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]testauth\b/.test(location.search)) {
      mode = 'test';
      tok = { account: { name: 'Utente di prova', username: 'prova@hubstart.test', tid: C.tenantId } };
      return;
    }
    mode = 'ms';
    load();
    await handleRedirect();
    // Sessione scaduta ma account noto: rinnovo trasparente con un passaggio rapido da Microsoft (una volta per apertura)
    if (tok && tok.account && !sessionValid() && navigator.onLine) {
      let tried = false;
      try { tried = sessionStorage.getItem(K.silent) === '1'; sessionStorage.setItem(K.silent, '1'); } catch (e) { tried = true; }
      if (!tried) { await login({ silent: true }); return new Promise(() => {}); }
    }
  }

  function logout() { tok = null; save(); notify(); }

  return {
    init, login, logout, getToken, invalidateAccess, subscribe: f => listeners.add(f),
    get mode() { return mode; },
    get account() { return tok && tok.account ? tok.account : null; },
    get error() { return lastError; },
    clearError() { lastError = ''; },
    needsLogin() { return mode === 'ms' && !(tok && tok.account); },
    sessionValid() { return mode !== 'ms' || sessionValid(); },
  };
})();
