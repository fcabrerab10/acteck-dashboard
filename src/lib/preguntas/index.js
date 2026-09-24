// «Buscar o preguntar» (2026-09-24): la paleta ⌘K y la pestaña Buscar del celular aceptan preguntas
// en lenguaje natural y contestan con la cifra ahí mismo (más el botón para ir). Todo local: el
// intérprete es de reglas (interpretar.js) y las respuestas salen de las vistas del dashboard
// (responder.js). Nada se manda fuera.
export { interpretar, pareceP, SUGERENCIAS } from './interpretar';
export { responder } from './responder';
