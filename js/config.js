'use strict';
/* Configurazione dell'app registrata in Microsoft Entra (nessun segreto: valori pubblici per app a pagina singola) */
const CONFIG = {
  version: '0.5.0',
  clientId: '0d21a902-24f7-4036-b33a-4473714e9a0b',
  tenantId: 'bb10a6a1-f75a-4e50-b913-eeb952ea92b2',
  redirectUri: 'https://matteo-hs.github.io/dashboard-personale/',
  scopes: ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Calendars.Read', 'Files.ReadWrite.AppFolder'],
  graph: 'https://graph.microsoft.com/v1.0',
  syncFile: 'dashboard-data.json',
  recapFile: 'recap.json',
};
