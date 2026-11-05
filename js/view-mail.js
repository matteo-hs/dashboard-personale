'use strict';
/* Posta: pagina predisposta per la v0.3 (lettura Outlook) e v0.4 (recap) */
const MailView = (() => {
  function render(root) {
    const steps = [
      ['Registrazione app in Microsoft Entra', 'Con l\'account amministratore del tenant Hub&Start: permessi lettura posta, lettura calendario, cartella app su OneDrive.', false],
      ['Accesso con account Microsoft', 'Login solo con il tuo account aziendale (v0.2), sincronizzazione PC ↔ telefono tramite OneDrive.', false],
      ['Lettura posta e calendario Outlook', 'Elenco email recenti consultabile anche offline; eventi Outlook visibili in sola lettura nel calendario (v0.3).', false],
      ['Recap e task proposti', 'Attività Claude pianificata: risposte da inviare, cose da definire, priorità; i task arrivano come «proposti» da confermare (v0.4).', false],
    ];
    root.innerHTML = `<div class="view mail">
      <header class="page-head"><div><h1 class="page-title">Posta</h1>
        <p class="page-sub">Lettura della casella Outlook aziendale e recap delle priorità</p></div></header>
      <div class="dash-grid">
        <section class="card toned tone-cyan span-7">
          <h3 class="card-title">${ibadge('sparkle')}<span>Cosa troverai qui</span></h3>
          <div class="mail-ph">
            <div class="mail-col mc-red"><h5>${ibadge('message', 'sm')}Da rispondere</h5><p>Thread in cui l'ultimo messaggio non è tuo e contiene una richiesta.</p></div>
            <div class="mail-col mc-amber"><h5>${ibadge('target', 'sm')}Da definire</h5><p>Proposte di date, preventivi, conferme in attesa.</p></div>
            <div class="mail-col mc-sky"><h5>${ibadge('inbox', 'sm')}Informative</h5><p>Comunicazioni utili senza azioni richieste.</p></div>
          </div>
          <p class="note-box">Ogni elemento potrà diventare un task dell'agenda con un clic, con il riferimento all'email di origine (badge «Da email»).</p>
        </section>
        <section class="card toned tone-green span-5">
          <h3 class="card-title">${ibadge('shield')}<span>Stato del collegamento</span></h3>
          <div class="steps">${steps.map((s, i) => `<div class="step ${s[2] ? 'ok' : ''}"><span class="num">${i + 1}</span><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join('')}</div>
        </section>
      </div>
    </div>`;
  }
  return { render };
})();
