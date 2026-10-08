// Acteck Ciudad · sonido ambiente (3.90.76, Etapa 7): apagado por defecto; se arma sólo al prender el interruptor (el navegador
// exige un gesto para el audio). Todo sintetizado con WebAudio, sin archivos: rumor de ciudad, lluvia, pájaros de día y grillos
// de noche (capas de capasSonido()). Si el navegador no tiene audio, regresa null y el botón no hace nada.
import { capasSonido } from './modelo';

function ruido(ac, segundos = 2, cafe = true) {
  const b = ac.createBuffer(1, ac.sampleRate * segundos, ac.sampleRate); const d = b.getChannelData(0); let ult = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (cafe) { ult = (ult + .02 * w) / 1.02; d[i] = ult * 3.5; } else d[i] = w; }
  const s = ac.createBufferSource(); s.buffer = b; s.loop = true; return s;
}

export function crearAmbiente(clima) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return null;
  const ac = new AC(); const capas = capasSonido(clima || {});
  const salida = ac.createGain(); salida.gain.value = 0; salida.connect(ac.destination);
  salida.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5); // entra suave
  const fuentes = []; const timers = [];
  const capa = (src, filtro, frec, vol) => { const f = ac.createBiquadFilter(); f.type = filtro; f.frequency.value = frec; const g = ac.createGain(); g.gain.value = vol; src.connect(f).connect(g).connect(salida); src.start(); fuentes.push(src); };
  capa(ruido(ac, 3, true), 'lowpass', 420, capas.ruido);
  if (capas.lluvia) capa(ruido(ac, 2, false), 'highpass', 1200, capas.lluvia);
  // pío: barrido corto de un oscilador; cri-cri: tres pulsos agudos
  const pio = () => { const t = ac.currentTime; const o = ac.createOscillator(); const g = ac.createGain(); const f0 = 2400 + Math.random() * 1600; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + .12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.025, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g).connect(salida); o.start(t); o.stop(t + .2); };
  const cri = () => { const t = ac.currentTime; for (let k = 0; k < 3; k++) { const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = 4300; const t0 = t + k * .07; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.012, t0 + .01); g.gain.linearRampToValueAtTime(0, t0 + .045); o.connect(g).connect(salida); o.start(t0); o.stop(t0 + .06); } };
  const cada = (seg, f) => { if (!seg) return; const h = { id: 0 }; timers.push(h); const sig = () => { h.id = setTimeout(() => { try { f(); } catch { /* sin audio */ } sig(); }, seg * 1000 * (.5 + Math.random())); }; sig(); }; // un timer vivo por capa
  cada(capas.pajaros, () => { pio(); if (Math.random() < .5) setTimeout(() => { try { pio(); } catch { /* sin audio */ } }, 180); });
  cada(capas.grillos, cri);
  return {
    detener() { timers.forEach((h) => clearTimeout(h.id)); try { salida.gain.linearRampToValueAtTime(0, ac.currentTime + .3); } catch { /* ya cerrado */ } setTimeout(() => { fuentes.forEach((s) => { try { s.stop(); } catch { /* ya parado */ } }); ac.close().catch(() => {}); }, 400); },
  };
}
