// Chapter 2: AC to DC. Mains → step-down transformer → four-diode bridge → smoothing capacitor
// → charge controller → battery. Current is shown as conventional current (+ to −).
// The scope is a real simulation: 15 V RMS secondary (21.2 V peak), two silicon diode drops
// (0.7 V each), and a capacitor discharged by the charging current between peaks:
// ripple ≈ I / (2 f C) for a full-wave rectifier.
import { THREE, M, box, tube, clamp } from '../kit.js';
import { transformer, diode, capacitor, makeBattery, pathOf, flowDots, cable, board, panelBg, chargeStage, bench, MAINS, CHARGE, COL } from '../ups.js';

const TAU = Math.PI * 2;
const VSEC = 15, VPK = VSEC * Math.SQRT2, VD = 0.7;   // secondary RMS and peak, diode drop
const N = 400;                                        // samples per cycle

// Steady-state capacitor voltage over one cycle, for load current I (A) and capacitance C (µF).
function simulate(I, C) {
  const dt = 1 / MAINS.f / N, dv = (I * dt) / (C * 1e-6);
  const rect = new Float32Array(N), vc = new Float32Array(N), on = new Uint8Array(N);
  for (let i = 0; i < N; i++) rect[i] = Math.max(0, Math.abs(VPK * Math.sin((TAU * i) / N)) - 2 * VD);
  let v = VPK;
  for (let cyc = 0; cyc < 6; cyc++) for (let i = 0; i < N; i++) {
    v -= dv; let c = 0;
    if (rect[i] >= v) { v = rect[i]; c = 1; }
    if (cyc === 5) { vc[i] = v; on[i] = c; }
  }
  let lo = Infinity, hi = 0; vc.forEach((x) => { lo = Math.min(lo, x); hi = Math.max(hi, x); });
  return { rect, vc, on, lo, hi, ripple: hi - lo };
}

export default {
  id: 'ac-dc',
  short: 'AC into DC',
  title: 'Turning AC into DC',
  subtitle: 'Four diodes flip the backwards half of every wave, and a capacitor smooths the bumps.',
  view: { pos: [0.2, 4.6, 10.2], target: [0.0, 2.7, 0] },
  learn: `<p>Mains electricity is <b>AC</b>. In India it swings between <b>+325 V and −325 V</b> fifty times a second (we call it 230 V, which is its average "strength", the <b>RMS</b> value). A battery is <b>DC</b>: a steady 12 V, always the same way round. To charge it, the charger has three jobs.</p>
    <p><b>1. Step down.</b> A transformer turns 230 V into about 15 V AC.</p>
    <p><b>2. Rectify.</b> Four <b>diodes</b>, one-way valves for current, are wired in a diamond called a <b>bridge rectifier</b>. Whichever way the AC pushes, two of them steer the current out of the same end. The backwards half of every wave is flipped forwards: now it's bumpy DC, 100 bumps a second.</p>
    <p><b>3. Smooth.</b> A big <b>capacitor</b> fills up at each bump and tops up the gaps, like a water tank under a dripping tap. The bigger it is, the smaller the leftover <b>ripple</b>.</p>
    <p>Then a control circuit charges the battery in stages: <b>bulk</b> (a steady current, about 15 A), <b>absorption</b> (held at about 14.4 V while the current tapers off), then <b>float</b> (about 13.5 V, just enough to keep it full).</p>
    <p class="tip"><b>Try it:</b> shrink the capacitor and watch the ripple grow. Then fill the battery and watch the charger change stage.</p>`,
  terms: [
    { t: 'Diode', d: 'A one-way valve for electric current.' },
    { t: 'Bridge rectifier', d: 'Four diodes in a diamond that turn both halves of an AC wave into current flowing one way.' },
    { t: 'Capacitor', d: 'A part that stores charge and gives it back quickly, smoothing out bumps in voltage.' },
    { t: 'Ripple', d: 'The leftover wobble in DC after smoothing.' },
    { t: 'RMS', d: 'Root mean square: the steady DC voltage that would heat a bulb just as much. 230 V RMS peaks at 325 V.' },
    { t: 'Float charge', d: 'A gentle voltage that keeps a full battery full without overcharging it.' },
  ],
  defaults: { soc: 0.4, cap: 47000, slow: 100 },
  controls: [
    { key: 'soc', type: 'range', label: 'Battery charge', min: 0, max: 1, step: 0.01, ends: ['flat', 'full'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'cap', type: 'log', label: 'Smoothing capacitor', min: 2200, max: 150000, ends: ['small', 'huge'], fmt: (v) => Math.round(v).toLocaleString('en-IN') + ' µF' },
    { key: 'slow', type: 'range', label: 'Slow motion', min: 25, max: 400, step: 1, ends: ['faster', 'slower'], fmt: (v) => Math.round(v) + '× slower' },
  ],
  quiz: [
    { q: 'What does a bridge rectifier do?', options: ['Makes the voltage higher', 'Turns both halves of an AC wave into current flowing one way', 'Stores energy', 'Changes 50 Hz into 60 Hz'], answer: 1, why: 'Four diodes steer the current so it always leaves by the same terminal.' },
    { q: 'Mains in India is called 230 V. What is its peak voltage?', options: ['230 V', 'About 325 V', '115 V', '12 V'], answer: 1, why: '230 V is the RMS value. A sine wave peaks √2 times higher: about 325 V.' },
    { q: 'Why does the charger switch to a lower "float" voltage when the battery is full?', options: ['To save the fan', 'To keep it full without overcharging and boiling off its water', 'Because mains drops at night', 'It doesn’t'], answer: 1, why: 'Holding a full lead-acid battery at 14.4 V would split its water into gas. About 13.5 V just tops it up.' },
  ],
  reel: [
    { ms: 5800, caption: 'Four diodes flip the backwards half of every AC wave, and a capacitor smooths the bumps into DC.', set: { soc: 0.4, slow: 120 }, anim: { cap: [3300, 68000, true] }, view: { pos: [0.4, 4.4, 9.4], target: [0.3, 2.75, 0] }, spin: 0.1 },
  ],

  build({ stage }) {
    const scene = new THREE.Group(); stage.root.add(scene);
    const LIFT = 2.3;
    scene.add(bench(10.4, 1.9, LIFT));
    const root = new THREE.Group(); root.position.y = LIFT; scene.add(root);
    const Y = 1.55;

    // Mains plug on the left, then the step-down transformer.
    const plug = box(0.45, 0.6, 0.35, M.plastic(0xf2f4f7)); plug.position.set(-4.5, Y, 0); root.add(plug);
    for (const dy of [-0.12, 0.12]) { const pin = box(0.2, 0.05, 0.05, M.metal(0xd8b25a)); pin.position.set(-4.75, Y + dy, 0); root.add(pin); }
    const tr = transformer(0.95, { primaryTurns: 12, secondaryTurns: 4 }); tr.position.set(-3.0, Y, 0); root.add(tr);
    // (A step-down transformer has many turns on the mains side and few on the low side.)
    const tw = tr.userData, xl = -3.0 - (tw.W - tw.t) / 2, xr = -3.0 + (tw.W - tw.t) / 2, hy = (tw.H - 2 * tw.t) * 0.45;

    // The bridge: a diamond of four diodes. + comes out on the right, − on the left.
    const C = [-0.6, Y], R0 = 0.85;
    const T = [C[0], C[1] + R0, 0], B = [C[0], C[1] - R0, 0], Lf = [C[0] - R0, C[1], 0], Rt = [C[0] + R0, C[1], 0];
    const dio = (a, k) => {                         // anode a → cathode k
      const d = diode(0.52, 0.09);
      d.position.set((a[0] + k[0]) / 2, (a[1] + k[1]) / 2, 0);
      d.rotation.z = Math.atan2(k[1] - a[1], k[0] - a[0]);
      root.add(d); return d;
    };
    const D1 = dio(T, Rt), D2 = dio(B, Rt), D3 = dio(Lf, T), D4 = dio(Lf, B);
    for (const p of [T, B, Lf, Rt]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), M.metal(0xd8dde6)); n.position.set(...p); root.add(n); }

    // Capacitor, charge controller and battery.
    const CX = 1.35;
    const cap = capacitor(0.36, 1.0); cap.position.set(CX, 0.25, 0); root.add(cap);
    const ctrl = box(0.7, 0.55, 0.45, M.plastic(0x1e7a4a)); ctrl.position.set(2.55, Y, 0); root.add(ctrl);
    const chip = box(0.3, 0.05, 0.3, M.plastic(0x15171c)); chip.position.set(2.55, Y + 0.3, 0); root.add(chip);
    const bat = makeBattery({ W: 1.4, H: 1.2, D: 0.6 }); bat.position.set(4.1, 0, 0); root.add(bat);
    bat.setXray(false); bat.inner.visible = false;

    // Wires.
    const wire = (pts, color = 0xd8dde6, r = 0.03) => { const p = pathOf(pts); root.add(cable(p, r, color)); return p; };
    const mainsP = wire([[-4.3, Y + 0.12, 0], [xl - 0.35, Y + 0.12, 0], [xl - 0.35, Y + hy, 0], [xl, Y + hy, 0]], 0x2a2e37);
    wire([[-4.3, Y - 0.12, 0], [xl - 0.35, Y - 0.12, 0], [xl - 0.35, Y - hy, 0], [xl, Y - hy, 0]], 0x2a2e37);
    const secTop = wire([[xr, Y + hy, 0], [xr + 0.45, Y + hy, 0], [xr + 0.45, T[1] + 0.35, 0], [T[0], T[1] + 0.35, 0], T], COL.copper);
    const secBot = wire([B, [B[0], B[1] - 0.35, 0], [xr + 0.45, B[1] - 0.35, 0], [xr + 0.45, Y - hy, 0], [xr, Y - hy, 0]], COL.copper);
    const bt = bat.plusTop.clone().add(bat.position), bm = bat.minusTop.clone().add(bat.position);
    const plusRail = wire([Rt, [CX, Y, 0], [2.2, Y, 0]], 0xd7263d, 0.035);
    wire([[CX, Y, 0], [CX, 1.27, 0]], 0xd7263d, 0.03);
    const toBatt = wire([[2.9, Y, 0], [bt.x, Y, 0], [bt.x, bt.y, bt.z]], 0xd7263d, 0.035);
    const minusRail = wire([[bm.x, bm.y, bm.z], [bm.x, 0.12, bm.z], [bm.x, 0.12, 0], [Lf[0] - 0.4, 0.12, 0], [Lf[0] - 0.4, Lf[1], 0], Lf], 0x3a404d, 0.035);

    const ac1 = flowDots(mainsP, 10, COL.ac, 0.045), acT = flowDots(secTop, 14, COL.ac, 0.05), acB = flowDots(secBot, 14, COL.ac, 0.05);
    const dP = (a, k) => flowDots(pathOf([a, k]), 5, COL.dc, 0.05);
    const d1 = dP(T, Rt), d2 = dP(B, Rt), d3 = dP(Lf, T), d4 = dP(Lf, B);
    const dc1 = flowDots(plusRail, 12, COL.dc, 0.05), dc2 = flowDots(toBatt, 12, COL.dc, 0.05), dc3 = flowDots(minusRail, 22, COL.dc, 0.05);
    [ac1, acT, acB, d1, d2, d3, d4, dc1, dc2, dc3].forEach((d) => root.add(d));

    // Capacitor charge gauge (a glowing column beside it).
    const gauge = box(0.08, 1, 0.08, M.glow(COL.dc)); gauge.position.set(CX + 0.5, 0.25, 0); root.add(gauge);

    const lab = {
      mains: stage.label('<b>Mains</b> 230 V AC', [-4.5, Y + 0.7, 0], root),
      tr: stage.label('Step-down transformer', [-3.0, Y - 1.0, 0.2], root),
      br: stage.label('<b>4 diodes</b>: bridge rectifier', [C[0], B[1] - 0.6, 0.2], root),
      cap: stage.label('Capacitor', [CX, -0.1, 0.4], root),
      ctrl: stage.label('Charge controller', [2.55, Y + 0.65, 0], root),
      bat: stage.label('', [4.1, 1.9, 0], root, 'hot'),
    };

    // The scope and charging chart.
    let sim = simulate(15, 47000), key = '', ph = 0, cur = { soc: 0.4, st: chargeStage(0.4) };
    const brd = board(stage, scene, 8.0, 2.2, 1400, 412, (g, w, h) => {
      panelBg(g, w, h);
      // Left: the scope, two cycles.
      const x0 = 70, x1 = 790, Xs = (i) => x0 + (i / (2 * N)) * (x1 - x0);
      const row = (k) => 70 + k * 112, Yv = (k, v, span) => row(k) + 45 - (v / span) * 45;
      g.font = 'bold 22px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText('Oscilloscope · 2 cycles, 40 ms', 20, 32);
      const labels = [['After the transformer: 15 V AC', '#8ef0ff'], ['After the 4 diodes: bumpy DC', '#ffb547'], ['After the capacitor: smooth DC', '#ffd35a']];
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, Yv(k, 0, 25)); g.lineTo(x1, Yv(k, 0, 25)); g.stroke();
        g.fillStyle = labels[k][1]; g.font = '17px sans-serif'; g.fillText(labels[k][0], x0 + 4, row(k) - 4);
        g.strokeStyle = labels[k][1]; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i < 2 * N; i++) {
          const j = i % N, v = k === 0 ? VPK * Math.sin((TAU * j) / N) : k === 1 ? sim.rect[j] : sim.vc[j];
          const y = Yv(k, v, 25); i ? g.lineTo(Xs(i), y) : g.moveTo(Xs(i), y);
        }
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '15px sans-serif';
        g.fillText(k === 0 ? '±21 V' : k === 1 ? '0–20 V' : `${sim.lo.toFixed(1)}–${sim.hi.toFixed(1)} V`, 6, row(k) + 50);
      }
      // Battery voltage line on the smooth trace.
      g.setLineDash([8, 6]); g.strokeStyle = 'rgba(92,225,169,.9)'; g.lineWidth = 2; const yb = Yv(2, cur.st.V, 25); g.beginPath(); g.moveTo(x0, yb); g.lineTo(x1, yb); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#5ce1a9'; g.font = '15px sans-serif'; g.fillText(`battery ${cur.st.V.toFixed(1)} V`, x1 - 130, yb + 18);
      // Time cursor.
      const cx = Xs(((ph / TAU) % 2) * N); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 50); g.lineTo(cx, h - 20); g.stroke();

      // Right: the charging stages.
      const a0 = 890, a1 = w - 80, b0 = h - 60, b1 = 70, XS = (s) => a0 + s * (a1 - a0);
      const YV = (v) => b0 - ((v - 11.5) / 3.5) * (b0 - b1), YI = (i) => b0 - (i / 16) * (b0 - b1);
      g.font = 'bold 22px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText('Charging a 150 Ah battery', 870, 32);
      const bands = [[0, 0.8, 'Bulk'], [0.8, 0.98, 'Absorb'], [0.98, 1, 'Float']];
      bands.forEach(([a, b, t], i) => { g.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)'; g.fillRect(XS(a), b1, XS(b) - XS(a), b0 - b1); g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '16px sans-serif'; if (i < 2) g.fillText(t, XS(a) + 8, b1 + 20); });
      g.fillText('Float', XS(0.98) - 12, b0 + 42);
      const line = (fn, Yf, col) => { g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 200; i++) { const s = i / 200, y = Yf(fn(chargeStage(s))); i ? g.lineTo(XS(s), y) : g.moveTo(XS(s), y); } g.stroke(); };
      line((st) => st.V, YV, '#5ce1a9'); line((st) => st.I, YI, '#ffb547');
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '15px sans-serif';
      for (const v of [12, 13, 14, 15]) g.fillText(v + ' V', a0 - 50, YV(v) + 5);
      for (const i of [0, 5, 10, 15]) g.fillText(i + ' A', a1 + 10, YI(i) + 5);
      g.fillText('flat', a0, b0 + 22); g.fillText('full', a1 - 26, b0 + 22);
      g.fillStyle = '#5ce1a9'; g.fillText('voltage', a0 + 10, YV(14.4) - 10); g.fillStyle = '#ffb547'; g.fillText('current', a0 + 90, YI(15) - 10);
      const s = cur.soc, st = cur.st;
      for (const [y, c] of [[YV(st.V), '#5ce1a9'], [YI(st.I), '#ffb547']]) { g.fillStyle = c; g.beginPath(); g.arc(XS(s), y, 9, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    }, [0.1, 1.12, 1.15]);

    let lastDraw = 0;
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        const st = chargeStage(s.soc);
        const k = `${Math.round(st.I * 10)}|${Math.round(s.cap)}`;
        if (k !== key) { key = k; sim = simulate(st.I, s.cap); }
        cur = { soc: s.soc, st };
        ph += (dt * TAU) / (s.slow / MAINS.f);        // one cycle takes slow × 20 ms on screen
        const j = Math.floor(((ph / TAU) % 1) * N);
        const v = Math.sin(ph);                          // secondary: +1 when the top terminal is positive
        const cond = sim.on[j] === 1;
        const sp = 2.2 * v;
        ac1.step(dt, sp * 0.6); acT.step(dt, sp); acB.step(dt, sp);
        const pos = v > 0;
        const active = [[d1, D1, pos], [d4, D4, pos], [d2, D2, !pos], [d3, D3, !pos]];
        for (const [dots, dd, which] of active) {
          const on = cond && which;
          dots.visible = on; if (on) dots.step(dt, 1.2);
          dd.mat.emissive.setHex(on ? 0xffb547 : 0x000000); dd.mat.emissiveIntensity = on ? 0.9 : 0;
        }
        const Irel = st.I / CHARGE.bulkA;
        const dcs = 0.4 + 1.4 * Irel;
        dc1.step(dt, dcs * (cond ? 1.4 : 0.8)); dc2.step(dt, dcs); dc3.step(dt, dcs);
        const f = clamp(sim.vc[j] / 22, 0, 1); gauge.scale.y = Math.max(0.02, f); gauge.position.y = 0.25 + f / 2;
        bat.setGauge(s.soc);
        const narrow = stage.host.clientWidth < 560;
        [lab.tr, lab.ctrl, lab.mains].forEach((l) => { l.visible = !narrow; });
        lab.bat.element.innerHTML = `<b>Battery</b> ${Math.round(s.soc * 100)}% · ${st.stage.toLowerCase()}`;
        lastDraw += dt; if (lastDraw > 0.06) { lastDraw = 0; brd.redraw(); }
      },
      readout: (s) => {
        const st = chargeStage(s.soc), r = simulate(st.I, s.cap);
        const tight = r.lo < st.V + 1.0;
        return `<div class="big">${st.stage}: ${st.V.toFixed(1)} V, ${st.I.toFixed(1)} A</div>
          <div class="row"><span>Mains → transformer</span><b>230 → ${VSEC} V AC</b></div>
          <div class="row"><span>After the diodes</span><b>peak ${(VPK - 2 * VD).toFixed(1)} V</b></div>
          <div class="row"><span>Ripple left</span><b>${r.ripple.toFixed(1)} V${tight ? ': too much!' : ''}</b></div>`;
      },
    };
  },
};
