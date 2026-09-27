// Chapter 4: the power cut. Offline (standby), line-interactive and online (double-conversion)
// UPSes against a PC's power supply. The PSU rides through a gap on the energy in its bulk
// capacitor: E = ½·C·(V0² − Vmin²). With active PFC the bus sits near 380 V and the DC-DC stage
// works down to about 300 V; a 330 µF capacitor then carries a 500 W PC for about 16 ms,
// close to the ATX12V design guide's 17 ms hold-up requirement at full load.
// Transfer times: offline about 10 ms (typically 5–15 ms), line-interactive about 4 ms
// (2–4 ms), online 0 ms (it is always running on its inverter). Home inverters in "UPS mode"
// switch in about 10 ms; "normal/eco" mode is slower but accepts a wider range of mains voltage.
import { THREE, M, box, clamp, smooth } from '../kit.js';
import { openRelay, makeBattery, pc, pathOf, flowDots, cable, board, panelBg, casing, bench, COL, MAINS } from '../ups.js';
import { sfx } from '../ui.js';

const TAU = Math.PI * 2;
const TYPES = {
  offline: { name: 'Offline (standby)', T: 10 },
  line: { name: 'Line-interactive', T: 4 },
  online: { name: 'Online (double conversion)', T: 0 },
};
const PSU = { good: { C: 330, name: 'good power supply, 330 µF' }, cheap: { C: 120, name: 'cheap power supply, 120 µF' } };
const V0 = 380, VMIN = 300, PSU_EFF = 0.88, CUT = 20, WIN = 110, MS_PER_S = 20, HOLD = 2.6;

export const holdUp = (C, W) => ((C * 1e-6 * (V0 * V0 - VMIN * VMIN)) / 2 / (W / PSU_EFF)) * 1000;   // ms

// Run the whole cut once and return traces sampled every 0.1 ms.
function runCut(type, C, W) {
  const T = TYPES[type].T, n = Math.round(WIN * 10), P = W / PSU_EFF;
  const mains = new Float32Array(n), out = new Float32Array(n), bus = new Float32Array(n);
  let v = V0, dead = -1;
  for (let i = 0; i < n; i++) {
    const t = i / 10, s = MAINS.peak * Math.sin((TAU * t) / MAINS.period);
    mains[i] = t < CUT ? s : 0;
    const gap = type !== 'online' && t >= CUT && t < CUT + T;
    out[i] = gap ? 0 : s;
    if (gap || dead >= 0) v = Math.sqrt(Math.max(0, v * v - (2 * P * 1e-4) / (C * 1e-6)));
    else v = Math.min(V0, v + 25);                   // PFC stage recharges quickly
    if (v < VMIN && dead < 0) dead = t;
    if (dead >= 0) v = Math.max(0, v);
    bus[i] = v;
  }
  return { mains, out, bus, dead, T };
}

export default {
  id: 'switchover',
  short: 'Power cut!',
  title: 'Power cut! Switching in milliseconds',
  subtitle: 'How fast the backup takes over decides whether your computer notices.',
  view: { pos: [0.3, 5.7, 9.6], target: [0.1, 2.7, 0] },
  learn: `<p>Most UPSes for computers are <b>offline</b> (standby): while the mains is fine, your PC runs straight off it through a <b>relay</b>. The UPS watches the wave. When it disappears, it starts its inverter and the relay <b>clicks</b> over. That takes about <b>5 to 15 milliseconds</b>. A home inverter in <b>UPS mode</b> does the same in about 10 ms.</p>
    <p>A <b>line-interactive</b> UPS keeps its inverter ready and also evens out high and low mains voltage, so it switches in 2 to 4 ms. An <b>online</b> (double-conversion) UPS never switches at all: it turns mains into DC and back into AC all the time, so a cut changes nothing. That costs some energy, which is why it is used for servers and hospitals.</p>
    <p>Why can a PC survive even 10 ms of nothing? Its <b>power supply</b> has a big <b>capacitor</b> charged to about 380 V. It keeps the computer running for a few milliseconds on its own: the <b>hold-up time</b>. The ATX design guide asks for about 17 ms at full load. A cheap supply with a small capacitor may not make it.</p>
    <p class="tip"><b>Try it:</b> pick an offline UPS and a cheap power supply, then turn the PC load up until the screen goes dark.</p>`,
  terms: [
    { t: 'Transfer time', d: 'The gap between the mains failing and the backup taking over.' },
    { t: 'Relay', d: 'A switch flipped by an electromagnet. It clicks when it moves.' },
    { t: 'Offline UPS', d: 'Passes mains straight through, and only starts its inverter when the mains fails.' },
    { t: 'Online UPS', d: 'Always runs your load from its inverter, so there is no switchover at all.' },
    { t: 'Hold-up time', d: 'How long a power supply keeps working on its own stored energy after its input stops.' },
  ],
  defaults: { type: 'offline', W: 300, psu: 'good' },
  controls: [
    { key: 'type', type: 'seg', label: 'UPS type', options: [{ v: 'offline', label: 'Offline' }, { v: 'line', label: 'Line-interactive' }, { v: 'online', label: 'Online' }], fmt: (v) => (TYPES[v].T ? `switches in ${TYPES[v].T} ms` : 'no switchover') },
    { key: 'psu', type: 'seg', label: 'PC power supply', options: [{ v: 'good', label: 'Good (330 µF)' }, { v: 'cheap', label: 'Cheap (120 µF)' }] },
    { key: 'W', type: 'range', label: 'PC load', min: 100, max: 500, step: 10, ends: ['office', 'gaming'], fmt: (v) => Math.round(v) + ' W' },
    { key: 'go', type: 'buttons', label: 'Mains', items: [{ label: 'Cut the power again', act: (s, inst) => inst.restart() }] },
  ],
  quiz: [
    { q: 'An offline UPS takes about 10 ms to switch over. Why does the PC usually not notice?', options: ['PCs don’t use electricity', 'The power supply’s capacitor keeps it running for longer than that', 'The monitor stores energy', 'The UPS sends power by Wi-Fi'], answer: 1, why: 'A good power supply rides through about 16 ms or more on its capacitor: its hold-up time.' },
    { q: 'Which UPS type has no switchover gap at all?', options: ['Offline', 'Line-interactive', 'Online (double conversion)', 'None of them'], answer: 2, why: 'It always runs your load from its inverter, so a cut only changes where the DC comes from.' },
    { q: 'What is the click you hear when a UPS takes over?', options: ['The fan starting', 'A relay switching the output over to the inverter', 'The battery cracking', 'A speaker beep'], answer: 1, why: 'An electromagnet pulls the relay’s contact from the mains side to the inverter side.' },
  ],
  reel: [
    { ms: 5800, caption: 'Power cut! An offline UPS senses it and its relay clicks over in about 10 milliseconds.', set: { type: 'offline', W: 300, psu: 'good' }, act: (s, inst) => inst.restart(), view: { pos: [0.4, 5.6, 9.0], target: [0.0, 2.85, 0] }, spin: 0 },
    { ms: 5400, caption: 'The PC’s power supply bridges the gap on its capacitor. An online UPS never has a gap at all.', set: { type: 'online', W: 300, psu: 'good' }, act: (s, inst) => inst.restart(), view: { pos: [0.3, 5.7, 9.6], target: [0.1, 2.7, 0] }, spin: 0.1 },
  ],

  build({ stage, s: s0 }) {
    const scene = new THREE.Group(); stage.root.add(scene);
    const LIFT = 1.5;
    scene.add(bench(10.8, 2.1, LIFT));
    const root = new THREE.Group(); root.position.y = LIFT; scene.add(root);

    // Wall socket on a post, the UPS case, and the PC.
    const post = box(0.12, 2.0, 0.12, M.metal(0x4a505c)); post.position.set(-4.6, 1.0, 0); root.add(post);
    const sock = box(0.5, 0.5, 0.2, M.plastic(0xf2f4f7)); sock.position.set(-4.6, 2.1, 0); root.add(sock);
    const sLamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.glow(0xff5a4f)); sLamp.position.set(-4.5, 2.25, 0.11); root.add(sLamp);
    const shell = casing(5.0, 3.2, 1.8, 0x2a2e37); shell.position.set(-0.55, 1.6, 0); shell.setXray(true); root.add(shell);

    const N = [-2.75, 2.1, 0];
    const chg = box(0.8, 0.5, 0.5, M.plastic(0x2d6fd6)); chg.position.set(-2.0, 0.75, 0); root.add(chg);
    const bat = makeBattery({ W: 0.9, H: 0.6, D: 0.45 }); bat.position.set(-0.95, 0.05, 0); bat.setXray(false); bat.inner.visible = false; bat.setGauge(1); root.add(bat);
    const inv = box(0.8, 0.5, 0.5, M.plastic(0xd7263d)); inv.position.set(0.05, 0.75, 0); root.add(inv);
    const RS = 1.3, RX = 0.35, RY = 1.5;
    const relay = openRelay(RS); relay.position.set(RX, RY, 0); root.add(relay);
    const cX = RX + 0.62 * RS, ncY = RY + 0.8 * RS + 0.05, noY = RY + 0.08 * RS, hX = RX - 0.62 * RS, hY = RY + 0.08 * RS;
    const comp = pc(); comp.position.set(3.4, 0, 0); root.add(comp);

    const wire = (pts, color = 0xd8dde6, r = 0.035) => { const p = pathOf(pts); root.add(cable(p, r, color)); return p; };
    const P = {
      mains: wire([[-4.6, 1.9, 0.1], [-4.6, 1.9, 0.4], [-3.4, 2.1, 0.4], [-3.4, 2.1, 0], N], 0x2a2e37, 0.04),
      bypass: wire([N, [N[0], 2.95, 0], [cX, 2.95, 0], [cX, ncY, 0]]),
      toChg: wire([N, [N[0], 0.75, 0], [-2.4, 0.75, 0]]),
      toBat: wire([[-1.6, 0.75, 0], [-0.95 + 0.2, 0.75, 0], [-0.95 + 0.2, 0.72, 0]], 0xd7263d),
      toInv: wire([[-0.95 + 0.2, 0.75, 0], [-0.35, 0.75, 0]], 0xd7263d),
      invOut: wire([[0.45, 0.75, 0], [cX, 0.75, 0], [cX, noY, 0]]),
      out: wire([[hX, hY, 0], [hX, hY, -0.55], [hX, 0.3, -0.55], [4.35, 0.3, -0.55], [4.35, 0.5, -0.55]], 0x2a2e37, 0.04),
    };
    const D = {};
    for (const [k, n, c] of [['mains', 14, COL.ac], ['bypass', 16, COL.ac], ['toChg', 8, COL.ac], ['toBat', 5, COL.dc], ['toInv', 5, COL.dc], ['invOut', 10, COL.ac], ['out', 22, COL.ac]]) { D[k] = flowDots(P[k], n, c, 0.05); root.add(D[k]); }

    const minor = [stage.label('Mains', [-4.6, 2.65, 0], root), stage.label('Charger', [-2.0, 1.2, 0.3], root), stage.label('Battery', [-0.95, -0.2, 0.4], root), stage.label('Inverter', [0.05, 0.3, 0.4], root)];
    const lRelay = stage.label('Relay', [RX - 0.35, RY + 1.3, 0.3], root, 'hot');
    const lPC = stage.label('', [3.3, 1.75, 0.3], root);
    const lUPS = stage.label('', [-0.55, 3.45, 0], root);
    minor.push(lUPS);

    // Scope.
    let run = runCut(s0.type || 'offline', PSU[s0.psu || 'good'].C, s0.W || 300), t = 0, clicked = false, key = '';
    const brd = board(stage, scene, 6.8, 1.99, 1300, 380, (g, w, h) => {
      panelBg(g, w, h);
      const x0 = 110, x1 = w - 30, X = (tm) => x0 + (tm / WIN) * (x1 - x0), n = run.mains.length, upto = Math.min(n, Math.round(t * 10));
      g.fillStyle = '#e8eef8'; g.font = 'bold 22px sans-serif'; g.fillText('The cut, slowed 50×: 110 milliseconds', 20, 32);
      const rows = [['Mains in', '#8ef0ff', run.mains, (v) => v / 340], ['UPS out', '#5ce1a9', run.out, (v) => v / 340], ['PC capacitor', '#ffb547', run.bus, (v) => (v - 290) / 100]];
      rows.forEach(([name, col, arr, norm], k) => {
        const yc = 100 + k * 105, A = 38;
        g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '17px sans-serif'; g.fillText(name, 12, yc + 6);
        g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yc); g.lineTo(x1, yc); g.stroke();
        if (k === 2) { const yv = yc - ((VMIN - 290) / 100 - 0.5) * 2 * A; g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,90,79,.8)'; g.beginPath(); g.moveTo(x0, yv); g.lineTo(x1, yv); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff7a59'; g.font = '14px sans-serif'; g.fillText('PC shuts down below 300 V', x1 - 200, yv + 16); }
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i < upto; i += 2) { const v = norm(arr[i]), y = k === 2 ? yc - (clamp(v, -0.1, 1.1) - 0.5) * 2 * A : yc - v * A; i ? g.lineTo(X(i / 10), y) : g.moveTo(X(i / 10), y); }
        g.stroke();
      });
      g.strokeStyle = 'rgba(255,90,79,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(CUT), 50); g.lineTo(X(CUT), h - 20); g.stroke();
      g.fillStyle = '#ff7a59'; g.font = 'bold 16px sans-serif'; g.fillText('power cut', X(CUT) + 6, 56);
      if (run.T) { g.fillStyle = 'rgba(255,211,90,.18)'; g.fillRect(X(CUT), 60, X(CUT + run.T) - X(CUT), h - 80); g.fillStyle = '#ffd35a'; g.fillText(`${run.T} ms gap`, X(CUT + run.T) + 6, 76); }
    }, [0.0, 1.0, 1.3]);

    const api = { restart: () => { t = 0; clicked = false; } };
    let redraw = 0;
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        const k = `${s.type}|${s.psu}|${s.W}`;
        if (k !== key) { key = k; run = runCut(s.type, PSU[s.psu].C, s.W); t = 0; clicked = false; }
        t += dt * MS_PER_S;
        if (t > WIN + HOLD * MS_PER_S) { t = 0; clicked = false; }
        const tm = Math.min(t, WIN), i = Math.min(run.mains.length - 1, Math.round(tm * 10));
        const mainsOn = tm < CUT, T = run.T;
        // Relay: offline and line-interactive flip over during the last part of the transfer time.
        let rk = 0;
        if (s.type === 'online') rk = 1;
        else if (!mainsOn) rk = smooth((tm - (CUT + T * 0.55)) / Math.max(0.5, T * 0.45));
        relay.setK(rk);
        if (s.type !== 'online' && rk > 0.98 && !clicked) { clicked = true; try { sfx('click'); } catch { /* no audio */ } }
        relay.spark.material.opacity = s.type !== 'online' && rk > 0.05 && rk < 0.95 ? 0.9 : 0;
        relay.wind.material.emissive.setHex(0xff7a3d); relay.wind.material.emissiveIntensity = rk > 0.02 ? 0.5 : 0;
        const dead = run.dead >= 0 && tm >= run.dead;
        const outOn = Math.abs(run.out[i]) > 0 || (tm >= CUT + T);
        const ph = Math.sin((TAU * tm) / MAINS.period), sp = 2.2 * ph;
        D.mains.visible = mainsOn; D.mains.step(dt, sp);
        D.bypass.visible = mainsOn && s.type !== 'online'; D.bypass.step(dt, sp);
        D.toChg.visible = mainsOn; D.toChg.step(dt, s.type === 'online' ? 1.2 : 0.6);
        const invRun = s.type === 'online' || (!mainsOn && tm >= CUT + T * 0.5);
        D.toBat.visible = mainsOn; D.toBat.step(dt, 0.8);
        D.toInv.visible = invRun; D.toInv.step(dt, 1.2);
        D.invOut.visible = invRun && rk > 0.5; D.invOut.step(dt, sp);
        D.out.visible = outOn && !dead && (s.type === 'online' || rk < 0.05 || rk > 0.95); D.out.step(dt, sp);
        const narrow = stage.host.clientWidth < 560;
        minor.forEach((l) => { l.visible = !narrow; });
        sLamp.material.color.setHex(mainsOn ? 0xff5a4f : 0x3a2020);
        comp.setOn(dead ? 0 : 1);
        lPC.element.innerHTML = dead ? '<b>PC shut down!</b>' : `PC ${Math.round(s.W)} W · <b>running</b>`;
        lPC.element.classList.toggle('hot', dead);
        lUPS.element.innerHTML = `<b>${TYPES[s.type].name} UPS</b>`;
        lRelay.element.innerHTML = s.type === 'online' ? 'Relay (stays on inverter)' : rk > 0.5 ? 'Relay: <b>on inverter</b>' : 'Relay: <b>on mains</b>';
        redraw += dt; if (redraw > 0.05) { redraw = 0; brd.redraw(); }
      },
      readout: (s) => {
        const hu = holdUp(PSU[s.psu].C, s.W), T = TYPES[s.type].T, ok = hu > T;
        return `<div class="big">${ok ? 'The PC stays on' : 'The PC reboots'}</div>
          <div class="row"><span>UPS switchover gap</span><b>${T ? T + ' ms' : 'none'}</b></div>
          <div class="row"><span>PC can hold on for</span><b>${hu.toFixed(1)} ms</b></div>
          <small>${PSU[s.psu].C} µF capacitor, ${V0} → ${VMIN} V: ${((PSU[s.psu].C * 1e-6 * (V0 * V0 - VMIN * VMIN)) / 2).toFixed(1)} J to spend.</small>`;
      },
    };
  },
};
