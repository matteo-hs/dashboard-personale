'use strict';
/* Schermata di accesso (solo versione pubblicata, finché non si è entrati la prima volta) */
const LoginView = (() => {
  function render(root) {
    const offline = !navigator.onLine;
    root.innerHTML = `<div class="login-wrap"><div class="login-card">
      <div class="brand-mark lg">H&amp;S</div>
      <h1>Dashboard H&amp;S</h1>
      <p class="login-sub">La tua dashboard di lavoro: posta, agenda e calendario, su PC e telefono.</p>
      ${Auth.error ? `<div class="login-err">${icon('alert')}<span>${U.esc(Auth.error)}</span></div>` : ''}
      <button class="btn btn-primary btn-lg" data-act="login" ${offline ? 'disabled' : ''}>${icon('user')}Accedi con l'account Microsoft</button>
      ${offline ? '<p class="small muted" style="margin:10px 0 0">Serve una connessione a internet per il primo accesso.</p>' : ''}
      <ul class="login-points">
        <li>${icon('shield')}<span>Accesso riservato al tuo account Hub&amp;Start</span></li>
        <li>${icon('refresh')}<span>Dati salvati nel tuo OneDrive, uguali su PC e telefono</span></li>
        <li>${icon('inbox')}<span>Consultabile e modificabile anche offline</span></li>
      </ul>
    </div></div>`;
  }
  Actions.login = () => { Auth.clearError(); Auth.login(); };
  return { render };
})();
