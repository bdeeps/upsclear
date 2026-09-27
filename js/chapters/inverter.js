// Chapter 3: DC → AC. An H-bridge of four MOSFETs flips the battery across the transformer's
// primary 50 times a second; the transformer steps 12 V up to 230 V (turns ratio 1 : 19).
// Waveforms and their distortion come from ups.js (quasi-square Fourier series; SPWM).
import { THREE, M, box, spring, clamp } from '../kit.js';
import { transformer, mosfet, capacitor, makeBattery, bulb, pathOf, flowDots, cable, board, panelBg, bench, bridgeState, waveRaw, waveOut, quasiTHD, WAVES, INV, MAINS, COL } from '../ups.js';

const TAU = Math.PI * 2;
const CARRIER = 24;             // PWM pulses per cycle shown (1.2 kHz). Real inverters switch at about 5–20 kHz.
const RATIO = MAINS.V / 12;     // turns ratio ≈ 19
const THD = { square: quasiTHD(Math.PI), modified: quasiTHD((2 * Math.PI) / 3) };

export default {
  id: 'inverter',
  short: 'DC into AC',
  title: 'Turning DC back into AC',
  subtitle: 'Four switches flip the battery back and forth, and a transformer lifts 12 V to 230 V.',
  view: { pos: [0.5, 5.9, 10.0], target: [0.3, 2.85, 0] },
  learn: `<p>A battery pushes current one way only. To make AC, the inverter uses four fast electronic switches called <b>MOSFETs</b>, wired in a square called an <b>H-bridge</b>. Switch on the top-left and bottom-right pair, and current flows through the transformer one way. Switch on the other pair, and it flows the other way. Do that 50 times a second and you have AC.</p>
    <p>Flipping hard gives a <b>square wave</b>. Fans hum and some gadgets dislike it. Pausing between flips gives a <b>modified sine</b>, a bit closer. A <b>pure sine</b> inverter switches thousands of times a second, making pulses that are wide at the top of the wave and thin near zero (<b>PWM</b>), then smooths them with a coil and a capacitor into a clean sine wave, just like the mains.</p>
    <p>The <b>transformer</b> lifts 12 V to 230 V: its high-voltage coil has about <b>19 times</b> as many turns. Energy can't be made from nothing, so the current goes <b>down</b> 19 times. Power is volts × amps: 230 V × 1.3 A on one side needs 12 V × about 29 A on the other, plus losses.</p>
    <p class="tip"><b>Try it:</b> switch between the three waveforms and watch which switches light up. Then turn up the load and look at the battery current.</p>`,
  terms: [
    { t: 'MOSFET', d: 'A transistor used as a very fast switch with no moving parts.' },
    { t: 'H-bridge', d: 'Four switches in an H shape that can connect a load either way round to a battery.' },
    { t: 'PWM', d: 'Pulse-width modulation: making a smooth average from fast on-off pulses of changing width.' },
    { t: 'Turns ratio', d: 'How many more turns one transformer coil has than the other. It sets how much the voltage steps up.' },
    { t: 'THD', d: 'Total harmonic distortion: how far a wave is from a pure sine, as a percentage.' },
  ],
  defaults: { wave: 'sine', load: 300, slow: 150 },
  controls: [
    { key: 'wave', type: 'seg', label: 'Waveform', options: [{ v: 'square', label: 'Square' }, { v: 'modified', label: 'Modified sine' }, { v: 'sine', label: 'Pure sine' }] },
    { key: 'load', type: 'range', label: 'Load', min: 0, max: INV.W, step: 10, ends: ['nothing', 'full 720 W'], fmt: (v) => Math.round(v) + ' W' },
    { key: 'slow', type: 'range', label: 'Slow motion', min: 50, max: 400, step: 1, ends: ['faster', 'slower'], fmt: (v) => Math.round(v) + '× slower' },
  ],
  quiz: [
    { q: 'How does an H-bridge make AC from a battery?', options: ['It spins a magnet', 'It connects the battery one way round, then the other, over and over', 'It heats the battery', 'It stores AC in a capacitor'], answer: 1, why: 'Swapping which pair of switches is on reverses the current through the load.' },
    { q: 'A transformer steps 12 V up to 230 V. What happens to the current?', options: ['It goes up 19 times', 'It goes down about 19 times', 'It stays the same', 'It becomes DC'], answer: 1, why: 'Power in ≈ power out. Nineteen times the voltage means about a nineteenth of the current.' },
    { q: 'How does a pure sine inverter make its smooth wave?', options: ['With a bigger battery', 'By switching thousands of times a second in pulses of changing width, then filtering', 'By using a motor', 'It uses mains'], answer: 1, why: 'PWM pulses average out to a sine, and a coil and capacitor smooth away the switching.' },
  ],
  reel: [
    { ms: 5600, caption: 'Four switches flip the battery back and forth fifty times a second: that makes AC.', set: { wave: 'square', load: 300, slow: 200 }, view: { pos: [-0.3, 5.2, 7.6], target: [-0.7, 3.1, 0] }, spin: 0.1 },
    { ms: 5600, caption: 'Pure sine inverters switch thousands of times a second, then smooth the pulses into a clean wave.', set: { wave: 'sine', load: 300, slow: 200 }, view: { pos: [0.5, 5.9, 10.0], target: [0.3, 2.85, 0] }, spin: 0.15 },
  ],

  build({ stage }) {
    const scene = new THREE.Group(); stage.root.add(scene);
    const LIFT = 1.55;
    scene.add(bench(10.2, 1.9, LIFT));
    const root = new THREE.Group(); root.position.set(0.5, LIFT, 0); scene.add(root);
    const XL = -2.3, XR = -0.2, YT = 3.2, YB = 0.35, YM = 1.8, YS1 = 2.55, YS2 = 1.1;

    // Battery (small scale) on the left.
    const bat = makeBattery({ W: 1.3, H: 1.1, D: 0.6 }); bat.position.set(-4.1, 0, 0); root.add(bat);
    bat.setXray(false); bat.inner.visible = false; bat.setGauge(0.8);
    const bp = bat.plusTop.clone().add(bat.position), bm = bat.minusTop.clone().add(bat.position);

    // The four switches.
    const S = {};
    for (const [k, x, y] of [['S1', XL, YS1], ['S3', XR, YS1], ['S2', XL, YS2], ['S4', XR, YS2]]) {
      const f = mosfet(1.4); f.position.set(x, y, 0); root.add(f); S[k] = f;
      stage.label(k, [x + (x < -1 ? -0.55 : 0.55), y, 0], root);
    }
    // Transformer: primary (few thick turns) on the left, secondary (many thin turns) on the right.
    const TX = 1.55;
    const tr = transformer(1.35, { primaryTurns: 4, secondaryTurns: 16 }); tr.position.set(TX, YM, 0); root.add(tr);
    const tw = tr.userData, xl = TX - (tw.W - tw.t) / 2, xr = TX + (tw.W - tw.t) / 2, hy = (tw.H - 2 * tw.t) * 0.45;
    tr.iron.emissive = new THREE.Color(0x3a7bd5); tr.iron.emissiveIntensity = 0;

    // Output filter (coil + capacitor) and the bulb.
    const coil = spring(0, 0.6, 0.12, 0.025, 7, M.metal(COL.copper)); coil.position.set(xr + 0.55, YM + hy + 0.35, 0); root.add(coil);
    const fcap = capacitor(0.14, 0.4, 0x3a404d); fcap.position.set(xr + 1.45, 0.3, 0); root.add(fcap);
    const lamp = bulb(0.34); lamp.position.set(xr + 2.15, 0.12, 0); root.add(lamp);

    const wire = (pts, color, r = 0.035) => { const p = pathOf(pts); root.add(cable(p, r, color)); return p; };
    const P = {
      bplus: wire([bp, [bp.x, YT, 0], [XL, YT, 0]], 0xd7263d, 0.045),
      rail: wire([[XL, YT, 0], [XR, YT, 0]], 0xd7263d, 0.045),
      l1: wire([[XL, YT, 0], [XL, YM, 0]], 0xd8dde6), r1: wire([[XR, YT, 0], [XR, YM, 0]], 0xd8dde6),
      l2: wire([[XL, YM, 0], [XL, YB, 0]], 0xd8dde6), r2: wire([[XR, YM, 0], [XR, YB, 0]], 0xd8dde6),
      nrail: wire([[XR, YB, 0], [XL, YB, 0]], 0x3a404d, 0.045),
      bminus: wire([[XL, YB, 0], [-3.1, YB, 0], [-3.1, YB, -0.55], [bm.x, YB, -0.55], [bm.x, bm.y + 0.25, -0.55], [bm.x, bm.y + 0.25, bm.z], [bm.x, bm.y, bm.z]], 0x3a404d, 0.045),
      // Primary loop: left midpoint → primary top ... primary bottom → right midpoint.
      pA: wire([[XL, YM, 0], [XL, YM, 0.55], [xl - 0.4, YM + hy, 0.55], [xl - 0.4, YM + hy, 0], [xl, YM + hy, 0]], COL.copper, 0.04),
      pB: wire([[xl, YM - hy, 0], [xl - 0.4, YM - hy, 0], [XR + 0.3, YM, 0], [XR, YM, 0]], COL.copper, 0.04),
      // Secondary → coil → bulb, and back.
      sA: wire([[xr, YM + hy, 0], [xr + 0.55, YM + hy + 0.35, 0]], COL.copper, 0.025),
      sA2: wire([[xr + 1.15, YM + hy + 0.35, 0], [xr + 2.6, YM + hy + 0.35, 0], [xr + 2.6, 0.25, 0], [xr + 2.3, 0.25, 0]], COL.copper, 0.025),
      sB: wire([[xr + 2.0, 0.25, 0], [xr + 0.3, 0.25, 0], [xr + 0.3, YM - hy, 0], [xr, YM - hy, 0]], COL.copper, 0.025),
    };
    wire([[xr + 1.45, YM + hy + 0.35, 0], [xr + 1.45, 0.72, 0]], COL.copper, 0.02);
    const D = {};
    const add = (k, n, col, r) => { D[k] = flowDots(P[k], n, col, r); root.add(D[k]); };
    add('bplus', 12, COL.dc, 0.055); add('rail', 8, COL.dc, 0.055); add('l1', 6, COL.dc, 0.055); add('r1', 6, COL.dc, 0.055);
    add('l2', 6, COL.dc, 0.055); add('r2', 6, COL.dc, 0.055); add('nrail', 8, COL.dc, 0.055); add('bminus', 16, COL.dc, 0.055);
    add('pA', 12, COL.dc, 0.055); add('pB', 10, COL.dc, 0.055);
    add('sA', 4, COL.ac, 0.04); add('sA2', 10, COL.ac, 0.04); add('sB', 14, COL.ac, 0.04);

    stage.label('<b>Battery</b> 12 V DC', [-4.1, -0.25, 0.4], root, 'hot');
    const minor = [stage.label('H-bridge', [(XL + XR) / 2, YB - 0.12, 0.45], root)];
    const lTr = stage.label('', [TX, YM - 1.3, 0.3], root);
    const lOut = stage.label('', [xr + 2.15, 1.55, 0.3], root, 'hot');
    const lFil = stage.label('LC filter', [xr + 1.0, YM + hy + 0.75, 0], root);
    minor.push(lTr);

    // Scope: one cycle, the raw bridge output (scaled to the 230 V side) and the filtered wave.
    let ph = 0, kind = 'sine';
    const brd = board(stage, scene, 6.3, 1.78, 1100, 310, (g, w, h) => {
      panelBg(g, w, h);
      const x0 = 70, x1 = w - 30, y0 = h / 2 + 18, A = (h - 90) / 2 / 380, X = (f) => x0 + f * (x1 - x0), Yv = (v) => y0 - v * A;
      g.fillStyle = '#e8eef8'; g.font = 'bold 22px sans-serif'; g.fillText(`Output · one cycle, 20 ms · ${WAVES[kind].name}`, 20, 32);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
      for (const v of [-325, 0, 325]) { g.beginPath(); g.moveTo(x0, Yv(v)); g.lineTo(x1, Yv(v)); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '16px sans-serif'; g.fillText('+325', 12, Yv(325) + 5); g.fillText('0 V', 20, Yv(0) + 5); g.fillText('−325', 12, Yv(-325) + 5);
      const trace = (fn, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let i = 0; i <= 1100; i++) { const f = i / 1100, y = Yv(fn(f * TAU)); i ? g.lineTo(X(f), y) : g.moveTo(X(f), y); } g.stroke(); };
      if (kind === 'sine') { trace((t) => waveRaw('sine', t, CARRIER), 'rgba(255,211,90,.45)', 2); trace((t) => waveOut('sine', t), '#8ef0ff', 4); }
      else trace((t) => waveRaw(kind, t), '#ffd35a', 4);
      trace((t) => MAINS.peak * Math.sin(t), 'rgba(255,255,255,.25)', 1.5);
      const cx = X((ph % TAU) / TAU); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 44); g.lineTo(cx, h - 10); g.stroke();
      g.font = '16px sans-serif'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('faint line: mains sine', x1 - 180, h - 12);
      if (kind === 'sine') { g.fillStyle = 'rgba(255,211,90,.8)'; g.fillText('PWM pulses', x0 + 10, h - 12); }
    }, [0.3, 0.7, 1.2]);

    let redraw = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        kind = s.wave;
        ph = (ph + (dt * TAU) / (s.slow / MAINS.f)) % TAU;
        const st = bridgeState(s.wave, ph, CARRIER);
        const on = { S1: st > 0, S4: st > 0, S3: st < 0, S2: st < 0 };
        for (const k in S) S[k].setOn(on[k] ? 1 : 0);
        const I = s.load > 0 ? 1 : 0.25, sp = 1.6 * I;
        const flow = st !== 0;
        D.bplus.visible = D.rail.visible = D.nrail.visible = D.bminus.visible = flow;
        if (flow) { D.bplus.step(dt, sp); D.rail.step(dt, st > 0 ? 0.001 : sp); D.nrail.step(dt, st > 0 ? sp : 0.001); D.bminus.step(dt, sp); }
        D.rail.visible = flow && st < 0; D.nrail.visible = flow && st > 0;
        D.l1.visible = st > 0; D.r2.visible = st > 0; D.r1.visible = st < 0; D.l2.visible = st < 0;
        if (st > 0) { D.l1.step(dt, sp); D.r2.step(dt, sp); } else if (st < 0) { D.r1.step(dt, sp); D.l2.step(dt, sp); }
        D.pA.visible = D.pB.visible = flow;
        if (flow) { D.pA.step(dt, sp * st); D.pB.step(dt, sp * st); }
        // Secondary: current follows the (filtered) output wave.
        const vo = waveOut(s.wave, ph, CARRIER) / MAINS.peak;
        const ss = 1.4 * vo * (s.load > 0 ? 1 : 0.2);
        D.sA.step(dt, ss); D.sA2.step(dt, ss); D.sB.step(dt, ss);
        const mag = Math.abs(waveRaw(s.wave, ph, CARRIER)) / 360;
        tr.iron.emissiveIntensity = 0.5 * mag;
        tr.cuP.emissive.setHex(0xff7a3d); tr.cuP.emissiveIntensity = 0.5 * mag * clamp(s.load / 400, 0.1, 1);
        lamp.setOn(clamp(s.load / 300, 0, 1) * (s.wave === 'sine' ? 0.6 + 0.4 * Math.abs(vo) : 0.55 + 0.45 * mag));
        const narrow = stage.host.clientWidth < 560;
        minor.forEach((l) => { l.visible = !narrow; });
        lFil.visible = s.wave === 'sine' && !narrow;
        lTr.element.innerHTML = `Transformer <b>1 : ${RATIO.toFixed(0)}</b>`;
        lOut.element.innerHTML = `<b>230 V AC</b> · ${Math.round(s.load)} W`;
        redraw += dt; if (redraw > 0.05) { redraw = 0; brd.redraw(); }
      },
      readout: (s) => {
        const Pin = s.load / INV.eff, Ib = Pin / 12, Io = s.load / MAINS.V;
        const thd = s.wave === 'sine' ? 'under 3%' : THD[s.wave].toFixed(0) + '%';
        return `<div class="big">${WAVES[s.wave].name} · ${thd} distortion</div>
          <div class="row"><span>Battery side</span><b>12 V × ${Ib.toFixed(1)} A = ${Math.round(Pin)} W</b></div>
          <div class="row"><span>230 V side</span><b>230 V × ${Io.toFixed(2)} A = ${Math.round(s.load)} W</b></div>
          <div class="row"><span>Lost as heat</span><b>${Math.round(Pin - s.load)} W</b></div>
          <small>Every wave here is 230 V RMS; this one peaks at ${Math.round(WAVES[s.wave].peak)} V.</small>`;
      },
    };
  },
};
