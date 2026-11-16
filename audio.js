// Sonido de «El relojero»: todo sintetizado. Banda sonora con caja de música, bajo y colchón, marcada por el tic-tac del escape.
window.Snd = (function () {
  'use strict';
  let AC = null, master, comp, rev, bMusic, bSfx, bTick, mFilter, muted = false, vM = 1, vS = 1, scene = 'title', st = { bat: 100, danger: 0, dead: false, charging: false };
  let nextT = 0, step = 0, timer = null, intens = 0, tickSlow = 0, bBox, panL, panR, ar = 0, ambT = 0;
  const N = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }, hz = (n, o) => 440 * Math.pow(2, (N[n] - 9) / 12 + (o - 4));
  function init() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = AC.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(AC.destination);
    // reverberacion de garaje: respuesta generada
    const len = AC.sampleRate * 1.7, ir = AC.createBuffer(2, len, AC.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const x = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); lp += (x - lp) * 0.35; d[i] = lp; } }
    rev = AC.createConvolver(); rev.buffer = ir; const rg = AC.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(master);
    mFilter = AC.createBiquadFilter(); mFilter.type = 'lowpass'; mFilter.frequency.value = 9000; mFilter.connect(master); mFilter.connect(rev);
    bMusic = AC.createGain(); bMusic.gain.value = 0.5; bMusic.connect(mFilter);
    bSfx = AC.createGain(); bSfx.gain.value = 0.9; bSfx.connect(master); const sr = AC.createGain(); sr.gain.value = 0.22; bSfx.connect(sr); sr.connect(rev);
    bTick = AC.createGain(); bTick.gain.value = 0.55; bTick.connect(master); const tr = AC.createGain(); tr.gain.value = 0.3; bTick.connect(tr); tr.connect(rev);
    // la caja de musica va por su propio bus: un poco abierta a los lados y con un eco a negra con puntillo
    bBox = AC.createGain(); bBox.gain.value = 1; const mk = p => { if (!AC.createStereoPanner) return bBox; const n = AC.createStereoPanner(); n.pan.value = p; n.connect(bBox); return n; }; panL = mk(-0.38); panR = mk(0.38); bBox.connect(bMusic);
    const dl = AC.createDelay(1), fb = AC.createGain(), dlp = AC.createBiquadFilter(), dg = AC.createGain(); dl.delayTime.value = 0.4; fb.gain.value = 0.34; dlp.type = 'lowpass'; dlp.frequency.value = 2600; dg.gain.value = 0.3; bBox.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(dg); dg.connect(bMusic);
    nextT = AC.currentTime + 0.1; timer = setInterval(sched, 25);
  }
  // ---------------------------------------------------------------- instrumentos
  function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, a, d, v, out, f1, det) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d); if (det) o.detune.value = det; env(g, t, a, d, v); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.05); return o; }
  let nbuf = null; function noise(t, d, v, type, f, q, out, f1) { if (!nbuf) { nbuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const x = nbuf.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; }
    const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = nbuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + d); fl.Q.value = q || 1; env(g, t, 0.002, d, v); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + d + 0.05); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // caja de musica: lengüeta con su golpecito de pua, parciales inarmonicos y una pizca de desafinado
  const box = (f, t, v, o) => { const out = o || (step % 2 ? panL : panR), d = Math.pow(2, rnd(-4, 4) / 1200); osc('sine', f * d, t, 0.003, 1.3, v, out); osc('sine', f * 2.0 * d, t, 0.002, 0.5, v * 0.16, out); osc('sine', f * 3.01, t, 0.002, 0.38, v * 0.26, out); osc('sine', f * 5.4, t, 0.002, 0.13, v * 0.12, out); noise(t, 0.008, v * 0.5, 'highpass', 5200, 1, out); };
  // tren de clics de trinquete: el «prrrt» de un escape que pierde el contacto. Arranca muy rapido y se va frenando
  function prrt(t, n, g0, g1, f0, f1, v, out) { let x = t; for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) : 0, f = f0 * Math.pow(f1 / f0, k), vv = v * (1 - 0.5 * k) * rnd(0.75, 1.15); noise(x, 0.005 + 0.009 * k, vv, 'bandpass', f * rnd(0.9, 1.1), 5, out); osc('square', f * 0.5, x, 0.0008, 0.007 + 0.004 * k, vv * 0.16, out); osc('sine', f * 1.9, x, 0.0008, 0.012, vv * 0.1, out); x += g0 * Math.pow(g1 / g0, k) * rnd(0.88, 1.12); } return x; }
  // muelle que vibra: seno con vibrato rapido que se apaga
  function twang(t, f, f1, d, v, out) { const o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); l.frequency.setValueAtTime(46, t); l.frequency.exponentialRampToValueAtTime(18, t + d); lg.gain.setValueAtTime(f * 0.22, t); lg.gain.exponentialRampToValueAtTime(1, t + d); l.connect(lg); lg.connect(o.frequency); env(g, t, 0.003, d, v); o.connect(g); g.connect(out); o.start(t); l.start(t); o.stop(t + d + 0.1); l.stop(t + d + 0.1); }
  // chapa o laton golpeado: parciales inarmonicos
  const metal = (t, f, v, d, out) => [1, 1.48, 2.37, 3.42, 4.9, 6.3].forEach((r, i) => osc('sine', f * r * rnd(0.995, 1.005), t, 0.001, d * (1 - i * 0.13), v * (0.42 - i * 0.055), out || bSfx));
  const thud = (t, f, v, d) => { osc('sine', f, t, 0.002, d, v, bSfx, f * 0.36); noise(t, d * 0.5, v * 0.7, 'lowpass', 520, 1, bSfx); };
  const bass = (f, t, d, v) => { const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(220, t + d); env(g, t, 0.008, d, v); o.connect(fl); fl.connect(g); g.connect(bMusic); o.start(t); o.stop(t + d + 0.1); };
  const pad = (fs, t, d, v) => fs.forEach((f, i) => [-7, 6].forEach(dt => { const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt + i; fl.type = 'lowpass'; fl.frequency.value = 620; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + d * 1.05); o.connect(fl); fl.connect(g); g.connect(bMusic); o.start(t); o.stop(t + d * 1.1); }));
  const pluck = (f, t, v) => { const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(400, t + 0.14); env(g, t, 0.004, 0.16, v); o.connect(fl); fl.connect(g); g.connect(bMusic); o.start(t); o.stop(t + 0.25); };
  // el escape: «tic» agudo y «tac» grave, clic seco mas un pequeño timbre de laton
  function tick(t, tac, v) { const f = tac ? 1750 : 2500; noise(t, 0.018, v * 0.9, 'bandpass', f * 1.6, 3, bTick); osc('sine', f, t, 0.001, 0.05, v * 0.5, bTick); osc('sine', f * 2.76, t, 0.001, 0.025, v * 0.22, bTick); noise(t, 0.03, v * 0.25, 'lowpass', 500, 1, bTick); }
  // ---------------------------------------------------------------- partitura (re menor: Rem | Sib | Fa | Do, y un puente Solm | Rem | Sib | La)
  const CH = { Dm: ['D', 'F', 'A'], Bb: ['Bb', 'D', 'F'], F: ['F', 'A', 'C'], C: ['C', 'E', 'G'], Gm: ['G', 'Bb', 'D'], A: ['A', 'C#', 'E'] };
  const PROG = [['Dm', 'Bb', 'F', 'C'], ['Dm', 'Bb', 'F', 'C'], ['Gm', 'Dm', 'Bb', 'A'], ['Dm', 'Bb', 'F', 'C']];
  // melodia de caja de musica en corcheas, por compas de 4/4 (notas con octava; '.' = silencio)
  const MEL = [
    ['D5', '.', 'A5', 'F5', 'D5', '.', 'F5', 'A5', 'Bb5', '.', 'F5', 'D5', 'Bb4', '.', 'D5', 'F5', 'C6', '.', 'A5', 'F5', 'C5', '.', 'F5', 'A5', 'G5', '.', 'E5', 'C5', 'E5', 'G5', 'C6', '.'],
    ['D6', '.', 'A5', '.', 'F5', 'A5', 'D6', 'F6', 'D6', '.', 'Bb5', '.', 'F5', 'Bb5', 'D6', '.', 'C6', 'A5', 'F5', 'A5', 'C6', '.', 'F6', '.', 'E6', 'C6', 'G5', 'C6', 'E6', '.', 'D6', 'C6'],
    ['Bb5', '.', 'G5', 'D5', 'G5', 'Bb5', 'D6', '.', 'A5', '.', 'F5', 'D5', 'F5', 'A5', 'D6', '.', 'Bb5', 'D6', 'F6', 'D6', 'Bb5', '.', 'F5', '.', 'A5', 'C#6', 'E6', '.', 'C#6', 'A5', 'E5', '.'],
    ['D5', 'F5', 'A5', 'D6', 'A5', 'F5', 'D5', '.', 'Bb4', 'D5', 'F5', 'Bb5', 'F5', 'D5', 'Bb4', '.', 'C5', 'F5', 'A5', 'C6', 'A5', 'F5', 'C5', '.', 'C5', 'E5', 'G5', 'C6', 'E6', '.', 'D6', '.']];
  const pn = s => hz(s.slice(0, -1), +s.slice(-1)); let tr = 1, gbpm = 112; const mz = (n, o) => hz(n, o) * tr, AREA = [[0, 112], [-3, 104], [1, 140], [5, 92], [-2, 132], [3, 120], [-5, 134]];
  function sched() {
    if (!AC) return; const now = AC.currentTime; if (nextT < now - 0.5) nextT = now + 0.05;
    // estado: poca cuerda cierra el filtro y hace cojear el tic-tac; peligro sube la capa de cuerdas
    const low = st.bat < 25 && !st.dead && scene === 'game', tgtF = st.dead ? 500 : low ? 1500 : 9000; mFilter.frequency.setTargetAtTime(tgtF, now, 0.4);
    intens += ((scene === 'game' ? st.danger : 0) - intens) * 0.04; bMusic.gain.setTargetAtTime(muted ? 0 : (scene === 'intro' ? 0.36 : 0.5) * vM, now, 0.3); bTick.gain.setTargetAtTime(muted ? 0 : (st.dead ? 0.0 : scene === 'game' ? 0.6 : 0.32) * vS, now, st.dead ? 0.9 : 0.2); bSfx.gain.setTargetAtTime(muted ? 0 : 0.9 * vS, now, 0.05);
    const bpm = scene === 'game' ? gbpm : scene === 'intro' ? 76 : 88, e8 = 30 / bpm;   // duracion de una corchea
    while (nextT < now + 0.14) {
      const t = nextT, s8 = step % 8, bar = Math.floor(step / 8) % 16, sec = Math.floor(bar / 4), ch = CH[PROG[sec][bar % 4]], game = scene === 'game', full = game || scene === 'end';
      // tic-tac: tic en la corchea, tac en la semicorchea siguiente, como un escape de verdad
      const drag = low ? 0.035 * Math.sin(step * 1.7) : 0; tick(t + drag, false, s8 % 2 ? 0.2 : 0.3); tick(t + e8 / 2 + drag * 1.5, true, 0.2);
      if (st.charging && game) tick(t + e8 / 4, true, 0.12), tick(t + e8 * 0.75, false, 0.12);
      // caja de musica
      const m = MEL[sec][(bar % 4) * 8 + s8]; if (m !== '.' && (full || s8 % 2 === 0 || scene === 'title')) box(pn(m) * tr, t, full ? 0.11 : 0.085);
      if (s8 === 0) { pad(ch.map((n, i) => mz(n, i === 0 ? 3 : 4)), t, e8 * 8, full ? 0.022 : 0.028); if (bar % 4 === 0 && full) osc('sine', mz(ch[0], 6), t, 0.004, 1.6, 0.03, bMusic); }
      if (full) { if (s8 === 0 || s8 === 4) { bass(mz(ch[0], 2), t, e8 * 2.6, 0.2); osc('sine', mz(ch[0], 1), t, 0.01, e8 * 2.2, 0.1, bMusic); } if (s8 === 3 || s8 === 6) bass(mz(ch[s8 === 3 ? 2 : 1], 2), t, e8 * 1.2, 0.12);
        // percusion hecha de reloj: trinquete en el contratiempo, golpe de volante, y un arpegio de celesta en las vueltas pares
        if (s8 === 4) prrt(t, 3, 0.012, 0.02, 2600, 2000, 0.07, bMusic); if (s8 === 7 && bar % 2 === 1) prrt(t, 5, 0.02, 0.03, 2200, 2900, 0.05, bMusic); if (s8 === 5) osc('sine', 80, t, 0.003, 0.1, 0.09, bMusic, 44);
        if (sec % 2 === 1 && s8 % 2 === 1) box(mz(ch[(s8 >> 1) % 3], 6), t, 0.03);
        if (game) { if (ar === 1 && s8 % 4 === 2) noise(t, 0.16, 0.035, 'highpass', 4200, 0.7, bMusic, 7000); if (ar === 1 && s8 === 0 && bar % 2 === 0) osc('sawtooth', mz(ch[0], 1), t, 0.3, e8 * 14, 0.035, bMusic);
          if (ar === 3 && s8 === 0 && bar % 4 === 0) metal(t, mz(ch[0], 4), 0.05, 2.6, bMusic); if (ar === 5 && s8 === 0) noise(t, e8 * 7, 0.022, 'bandpass', 900, 0.6, bMusic, 1700); if (ar === 5 && s8 === 2) box(mz(ch[2], 7), t, 0.022);
          if ((ar === 6 || ar === 2) && s8 === 4) metal(t, 760, 0.035, 0.5, bMusic); if (ar === 4 && s8 % 2 === 0) osc('sawtooth', mz(ch[1], 5), t, 0.02, e8 * 0.8, 0.012, bMusic, mz(ch[1], 5) * 1.03); }
        if (s8 === 0) osc('sine', 95, t, 0.003, 0.16, 0.2, bMusic, 42); if (s8 === 4) noise(t, 0.07, 0.07, 'bandpass', 1900, 1.2, bMusic); if (s8 % 2 === 1) noise(t, 0.02, 0.03, 'highpass', 6000, 1, bMusic); }
      if (intens > 0.05 && game) { pluck(mz(ch[[0, 2, 1, 2, 0, 2, 1, 2][s8]], 3), t, 0.09 * intens); if (intens > 0.45 && (s8 === 2 || s8 === 6 || s8 === 7)) thudM(t, 0.16 * intens); if (intens > 0.45 && s8 === 0) pad(ch.map(n => mz(n, 5)), t, e8 * 8, 0.012 * intens); }
      if (scene === 'title' && s8 === 0 && bar % 4 === 0) metal(t, mz(ch[0], 5), 0.03, 3, bMusic);
      // ambiente del taller: de vez en cuando, algo metalico cruje lejos
      if (game && t > ambT) { ambT = t + rnd(7, 16); const f = rnd(160, 420); if (Math.random() < 0.5) metal(t + 0.1, f, 0.02, 1.2, rev); else { osc('sine', f, t, 0.2, 0.9, 0.018, rev, f * rnd(0.85, 1.2)); } }
      nextT += e8; step++;
    }
  }
  const thudM = (t, v) => { osc('sine', 110, t, 0.003, 0.2, v, bMusic, 55); noise(t, 0.06, v * 0.3, 'lowpass', 400, 1, bMusic); };
  // ---------------------------------------------------------------- efectos
  const clang = (t, p, v) => { metal(t, 520 * p * rnd(0.96, 1.04), v, 0.34); noise(t, 0.05, v * 0.8, 'bandpass', 3200, 0.8, bSfx); osc('sine', 150, t, 0.002, 0.14, v * 0.9, bSfx, 48); };
  let foot = 0;
  const FX = {
    swing: h => { const t = AC.currentTime, k = rnd(0.9, 1.12); noise(t, h ? 0.26 : 0.16, h ? 0.34 : 0.24, 'bandpass', (h ? 240 : 420) * k, 1.4, bSfx, (h ? 1700 : 2700) * k); noise(t + 0.02, h ? 0.2 : 0.12, 0.1, 'highpass', 3000, 0.7, bSfx, 6500); if (h) osc('sine', 90, t, 0.02, 0.22, 0.12, bSfx, 50); },
    hit: h => { const t = AC.currentTime; clang(t, (h ? 0.7 : 1) * rnd(0.94, 1.06), h ? 0.34 : 0.26); thud(t, h ? 120 : 170, h ? 0.4 : 0.26, h ? 0.2 : 0.12); prrt(t + 0.03, h ? 5 : 3, 0.012, 0.03, 3000, 2200, 0.12, bSfx); },
    kill: () => { const t = AC.currentTime; clang(t, 0.6, 0.3); thud(t, 110, 0.35, 0.22); noise(t, 0.3, 0.26, 'bandpass', 1500, 0.7, bSfx, 300); prrt(t + 0.04, 9, 0.01, 0.05, 3400, 1500, 0.22, bSfx); for (let i = 0; i < 6; i++) metal(t + 0.12 + i * rnd(0.05, 0.1), rnd(900, 2600), 0.06, rnd(0.12, 0.3)); twang(t + 0.05, 380, 120, 0.5, 0.1, bSfx); },
    jump: () => { const t = AC.currentTime; twang(t, 240, 620, 0.16, 0.12, bSfx); noise(t, 0.06, 0.06, 'highpass', 3000, 1, bSfx); noise(t, 0.012, 0.1, 'bandpass', 2200, 4, bSfx); },
    land: k => { const t = AC.currentTime; thud(t, 130, 0.1 + 0.22 * k, 0.12); noise(t, 0.05, 0.06 + 0.1 * k, 'bandpass', 700, 1.2, bSfx); prrt(t + 0.03, 2 + Math.round(3 * k), 0.018, 0.04, 2600, 1900, 0.05 + 0.08 * k, bSfx); },
    step: () => { const t = AC.currentTime, a = (foot ^= 1); noise(t, 0.03, 0.05, 'bandpass', (a ? 480 : 620) + rnd(0, 120), 2.5, bSfx); osc('sine', (a ? 1700 : 2200) + rnd(0, 250), t, 0.001, 0.02, 0.02, bSfx); noise(t + 0.035, 0.008, 0.03, 'bandpass', 3200, 5, bSfx); },
    cog: () => { const t = AC.currentTime, k = rnd(0.97, 1.06); osc('sine', hz('A', 5) * k, t, 0.002, 0.3, 0.1, bSfx); osc('sine', hz('E', 6) * k, t + 0.07, 0.002, 0.4, 0.1, bSfx); osc('sine', hz('E', 7) * k, t + 0.07, 0.002, 0.15, 0.03, bSfx); noise(t, 0.01, 0.08, 'highpass', 6000, 1, bSfx); },
    pila: () => { const t = AC.currentTime; ['D', 'F', 'A', 'D'].forEach((n, i) => { osc('sine', hz(n, i === 3 ? 6 : 5), t + i * 0.09, 0.003, 0.7, 0.11, bSfx); osc('triangle', hz(n, i === 3 ? 7 : 6), t + i * 0.09, 0.003, 0.3, 0.03, bSfx); }); noise(t + 0.3, 0.8, 0.04, 'highpass', 7000, 1, bSfx); },
    oil: () => { const t = AC.currentTime; for (let i = 0; i < 4; i++) osc('sine', 300 + i * 70, t + i * 0.07, 0.01, 0.07, 0.1, bSfx, 520 + i * 70); prrt(t + 0.3, 6, 0.05, 0.02, 1800, 2600, 0.06, bSfx); },
    weapon: () => { const t = AC.currentTime; clang(t, 1.2, 0.16); ['D', 'A', 'D'].forEach((n, i) => osc('triangle', hz(n, 4 + (i > 1 ? 1 : 0)), t + 0.1 + i * 0.1, 0.004, 0.5, 0.09, bSfx)); },
    ratchet: p => { const t = AC.currentTime; noise(t, 0.02, 0.16, 'bandpass', 1800 + p * 22, 4, bSfx); osc('square', 700 + p * 9, t, 0.001, 0.02, 0.03, bSfx); osc('sine', 2400 + p * 30, t, 0.001, 0.03, 0.02, bSfx); },
    full: () => { const t = AC.currentTime; osc('sine', hz('A', 6), t, 0.002, 0.9, 0.09, bSfx); osc('sine', hz('E', 7), t, 0.002, 0.5, 0.04, bSfx); },
    // te golpean: el ancora pierde la rueda de escape. Golpe seco, el tren corre libre («prrrt»), vibra el muelle y el ancora vuelve a engranar con un «clac»
    hurt: () => { const t = AC.currentTime; thud(t, 150, 0.4, 0.14); noise(t, 0.05, 0.3, 'bandpass', 2400, 0.8, bSfx); const e = prrt(t + 0.02, 17, 0.0065, 0.034, 4200, 1500, 0.5, bSfx); twang(t + 0.03, 520, 170, 0.42, 0.13, bSfx); noise(e + 0.02, 0.03, 0.4, 'bandpass', 1100, 2.5, bSfx); osc('sine', 760, e + 0.02, 0.001, 0.07, 0.16, bSfx); metal(e + 0.02, 1500, 0.07, 0.2); },
    // sin cuerda: el muelle se suelta del todo. El tren se desboca y se va frenando hasta el ultimo diente; despues, las piezas al suelo
    die: () => { const t = AC.currentTime; thud(t, 140, 0.4, 0.2); const e = prrt(t + 0.03, 44, 0.006, 0.17, 4400, 620, 0.5, bSfx); const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain(), d = e - t; o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(28, t + d); fl.type = 'lowpass'; fl.frequency.setValueAtTime(2400, t); fl.frequency.exponentialRampToValueAtTime(160, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl); fl.connect(g); g.connect(bSfx); o.start(t); o.stop(t + d + 0.1);
      twang(t + 0.05, 600, 90, 1.1, 0.12, bSfx); thud(e + 0.08, 95, 0.36, 0.3); for (let i = 0; i < 7; i++) metal(e + 0.1 + i * rnd(0.05, 0.13), rnd(700, 2400), 0.07, rnd(0.15, 0.4)); box(hz('D', 5), e + 0.5, 0.09, bSfx); box(hz('Bb', 4) * 0.985, e + 0.86, 0.07, bSfx); },
    save: () => { const t = AC.currentTime; osc('sine', hz('D', 6), t, 0.002, 0.25, 0.06, bSfx); osc('sine', hz('A', 6), t + 0.09, 0.002, 0.4, 0.06, bSfx); },
    ui: () => { const t = AC.currentTime; noise(t, 0.015, 0.14, 'bandpass', 2600, 3, bSfx); osc('sine', 1400, t, 0.001, 0.04, 0.05, bSfx); thud(t, 220, 0.08, 0.05); },
    hov: () => { const t = AC.currentTime; noise(t, 0.008, 0.06, 'bandpass', 3400, 4, bSfx); osc('sine', 2100, t, 0.001, 0.02, 0.02, bSfx); },
    talk: who => { const t = AC.currentTime, f = who === 'm' ? 150 : 520; for (let i = 0; i < 3; i++) osc(who === 'm' ? 'triangle' : 'sine', f * (1 + 0.12 * ((i * 7) % 3)) * rnd(0.97, 1.03), t + i * 0.055, 0.004, 0.05, 0.07, bSfx); },
    warn: () => { const t = AC.currentTime; osc('square', 620, t, 0.003, 0.07, 0.07, bSfx, 900); osc('square', 900, t + 0.1, 0.003, 0.09, 0.08, bSfx, 1300); },
    rev: () => { const t = AC.currentTime; osc('sawtooth', 70, t, 0.02, 0.5, 0.16, bSfx, 260); noise(t, 0.5, 0.1, 'bandpass', 500, 2, bSfx, 2200); prrt(t, 14, 0.05, 0.012, 1400, 2600, 0.08, bSfx); },
    shoot: () => { const t = AC.currentTime; thud(t, 210, 0.26, 0.16); noise(t, 0.09, 0.26, 'lowpass', 1400, 1, bSfx); twang(t, 300, 140, 0.18, 0.06, bSfx); },
    deflect: () => { const t = AC.currentTime; clang(t, 1.5, 0.3); metal(t, 1900, 0.1, 0.9); osc('sine', 1800, t, 0.002, 0.25, 0.08, bSfx, 2600); },
    boing: () => { const t = AC.currentTime; twang(t, 180, 720, 0.42, 0.2, bSfx); osc('triangle', 360, t, 0.004, 0.3, 0.06, bSfx, 1300); },
    dash: () => { const t = AC.currentTime; noise(t, 0.22, 0.3, 'bandpass', 900, 0.9, bSfx, 3800); noise(t, 0.3, 0.12, 'highpass', 5000, 0.7, bSfx); osc('sine', 500, t, 0.003, 0.12, 0.05, bSfx, 180); prrt(t, 8, 0.016, 0.007, 2000, 3600, 0.09, bSfx); },
    steam: () => { const t = AC.currentTime; noise(t, 0.9, 0.2, 'highpass', 2600, 0.7, bSfx, 5200); },
    power: () => { const t = AC.currentTime; thud(t, 90, 0.3, 0.4); osc('sawtooth', 60, t, 0.05, 1.2, 0.12, bSfx, 240); prrt(t + 0.05, 18, 0.07, 0.014, 1300, 2800, 0.1, bSfx); ['D', 'A', 'D', 'F#', 'A'].forEach((n, i) => { osc('sine', hz(n, 4 + (i > 1 ? 1 : 0)), t + 0.25 + i * 0.1, 0.004, 0.9, 0.1, bSfx); metal(t + 0.25 + i * 0.1, hz(n, 5 + (i > 1 ? 1 : 0)), 0.02, 0.8); }); noise(t + 0.2, 0.7, 0.05, 'highpass', 6000, 1, bSfx); },
    drop: () => { const t = AC.currentTime; osc('sine', 300, t, 0.002, 0.12, 0.14, bSfx, 110); noise(t, 0.05, 0.14, 'bandpass', 1200, 2, bSfx); metal(t + 0.12, 1300, 0.06, 0.25); metal(t + 0.25, 1500, 0.035, 0.18); },
    crumble: () => { const t = AC.currentTime; noise(t, 0.4, 0.22, 'bandpass', 420, 0.8, bSfx, 160); osc('sine', 90, t, 0.004, 0.3, 0.12, bSfx, 45); },
    inspect: () => { const t = AC.currentTime; osc('sine', hz('F', 5), t, 0.003, 0.2, 0.07, bSfx); osc('sine', hz('C', 6), t + 0.08, 0.003, 0.3, 0.07, bSfx); noise(t, 0.05, 0.05, 'bandpass', 1500, 1, bSfx, 2600); }
  };
  return { init: init, play: (n, a) => { if (AC && !muted && FX[n]) FX[n](a); }, scene: s => { if (s !== scene) { scene = s; step = Math.floor(step / 32) * 32; } }, state: o => Object.assign(st, o), area: i => { const v = AREA[i] || AREA[0]; tr = Math.pow(2, v[0] / 12); gbpm = v[1]; ar = AREA[i] ? i : 0; },
    mute: () => { muted = !muted; return muted; }, vol: (m, s) => { vM = m; vS = s; }, get on() { return !!AC; } };
})();
