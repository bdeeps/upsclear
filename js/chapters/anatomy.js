// Chapter 1: inside a home inverter, its battery, and a small computer UPS.
// Energy flows as dots: mains → your home and mains → battery (charging); in a power cut,
// battery → inverter → your home. Numbers come from backup() in ups.js.
import { THREE, M, box, exploder, approach } from '../kit.js';
import { makeBattery, makeInverter, makeUPS, bulb, ceilingFan, pathOf, flowDots, cable, backup, fmtHours, COL, INV } from '../ups.js';

const LOAD = 2 * 75 + 4 * 9;   // two ordinary ceiling fans and four 9 W LED bulbs = 186 W

export default {
  id: 'anatomy',
  short: 'Inside an inverter',
  title: 'Inside a home inverter and a UPS',
  subtitle: 'A battery, a charger and an inverter: store electricity now, give it back in a power cut.',
  view: { pos: [2.4, 3.6, 7.3], target: [0.3, 2.3, 0] },
  learn: `<p>When the power goes out and the fans keep turning, thank the box in the corner. A <b>home inverter</b> has a simple job: <b>store</b> electricity while the mains is on, and <b>give it back</b> when it goes off.</p>
    <p>It can't store electricity as it comes from the wall. Mains is <b>AC</b>: it flips direction 50 times a second. A battery only takes <b>DC</b>, which flows one way. So the box turns AC into DC to charge the battery (the <b>charger</b>), and DC back into AC to run your home (the <b>inverter</b>).</p>
    <p>Inside you'll find a heavy <b>transformer</b> (most of the weight), a row of <b>MOSFET</b> switches on a <b>heatsink</b>, a <b>control board</b> that watches the mains, a <b>change-over relay</b> that clicks when the power goes, and a small <b>fan</b>. In many home inverters the same switches and transformer do both jobs: run one way they charge, run the other way they invert.</p>
    <p>The tall <b>battery</b> is a 12 V lead-acid tubular type, about 150 Ah and over 50 kg. A <b>computer UPS</b> is the same idea shrunk down, with a small 12 V, 7 Ah battery inside.</p>
    <p class="tip"><b>Try it:</b> cut the power and watch the yellow dots reverse: the battery stops filling and starts emptying.</p>`,
  terms: [
    { t: 'AC', d: 'Alternating current: electricity that keeps reversing direction. Indian mains does it 50 times a second.' },
    { t: 'DC', d: 'Direct current: electricity that flows one way only, like the current from a battery.' },
    { t: 'Inverter', d: 'A circuit that turns DC into AC. The whole box is named after it.' },
    { t: 'Charger', d: 'A circuit that turns AC into DC to fill the battery.' },
    { t: 'UPS', d: 'Uninterruptible power supply: a battery backup that switches over fast enough for a computer.' },
  ],
  defaults: { mains: true, xray: true, explode: 0 },
  controls: [
    { key: 'mains', type: 'toggle', label: 'Mains power on', hint: 'Switch it off for a power cut.' },
    { key: 'xray', type: 'toggle', label: 'X-ray casings' },
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
  ],
  quiz: [
    { q: 'Why does an inverter need a charger as well?', options: ['To make the fans faster', 'A battery can only be filled with DC, and mains is AC', 'To cool the transformer', 'It doesn’t need one'], answer: 1, why: 'The charger turns mains AC into DC so the battery can store it.' },
    { q: 'What is the heaviest part inside a home inverter?', options: ['The display', 'The transformer', 'The fan', 'The relay'], answer: 1, why: 'Its iron core and copper coils make it the heavy lump in the box.' },
    { q: 'In a power cut, which way does energy flow?', options: ['Mains → battery', 'Battery → inverter → your fans and lights', 'Fans → battery', 'Nowhere'], answer: 1, why: 'The battery’s DC is turned back into AC for your home.' },
  ],
  reel: [
    { ms: 5400, caption: 'A home inverter stores electricity in a battery while the mains is on.', set: { mains: true, xray: false }, anim: { explode: [0, 0.8] }, spin: 0.4 },
    { ms: 5400, caption: 'When the power cuts out, the battery’s DC is turned back into AC for your fans and lights.', set: { mains: false, xray: true, explode: 0 }, spin: 0.25 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);

    // Back wall with the mains socket, a trolley, the battery and the inverter standing on it.
    const wall = box(9.5, 5.2, 0.1, M.matte(0x2a3140, { transparent: true, opacity: 0.5 })); wall.position.set(0.6, 2.6, -1.3); wall.castShadow = false; root.add(wall);
    const socket = box(0.5, 0.5, 0.06, M.plastic(0xf2f4f7)); socket.position.set(-3.4, 1.4, -1.22); root.add(socket);
    const sLamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.glow(0xff5a4f)); sLamp.position.set(-3.25, 1.55, -1.18); root.add(sLamp);
    const trolley = box(2.2, 0.12, 0.95, M.metal(0x4a505c)); trolley.position.set(-1.2, 0.12, 0); root.add(trolley);
    const bat = makeBattery(); bat.position.set(-1.2, 0.18, 0); root.add(bat);
    const inv = makeInverter({ W: 1.95, H: 1.4, D: 0.85 }); inv.scale.setScalar(1); inv.position.set(-1.2, 0.18 + bat.H + 0.35, 0.02); root.add(inv);
    const ups = makeUPS(); ups.scale.setScalar(1.5); ups.position.set(2.9, 0, 0.3); root.add(ups);

    // Your home: a ceiling fan and two bulbs on the right, fed from the inverter's output.
    const ceil = box(3.2, 0.06, 1.8, M.clear(0xcfe0ff, 0.08)); ceil.position.set(1.7, 4.6, -0.2); ceil.castShadow = false; root.add(ceil);
    const fan = ceilingFan(0.8); fan.position.set(1.5, 4.57, -0.2); root.add(fan);
    const bulbs = [0.6, 2.6].map((x) => { const b = bulb(0.15); b.position.set(x, 4.57, 0.2); b.rotation.x = Math.PI; root.add(b); return b; });

    root.updateMatrixWorld(true);
    const iy = 0.18 + bat.H + 0.35, ix = -1.2;
    // Cables: mains in (left side of the inverter), battery leads (back), output to the house (right side).
    const mainsPath = pathOf([[-3.4, 1.3, -1.18], [-3.4, 1.2, -0.9], [-2.6, 1.2, -0.6], [-2.4, iy + 0.35, -0.2], [ix - inv.W / 2, iy + 0.35, -0.1]]);
    const plusT = bat.plusTop.clone().add(bat.position), minusT = bat.minusTop.clone().add(bat.position);
    const battPlus = pathOf([[ix + 0.35, iy + 0.1, inv.D / 2 + 0.02], [plusT.x, iy - 0.05, inv.D / 2 + 0.05], [plusT.x, plusT.y + 0.05, plusT.z]]);
    const battMinus = pathOf([[ix - 0.35, iy + 0.1, inv.D / 2 + 0.02], [minusT.x, iy - 0.05, inv.D / 2 + 0.05], [minusT.x, minusT.y + 0.05, minusT.z]]);
    const outPath = pathOf([[ix + inv.W / 2 + 0.03, iy + 0.35, 0], [0.4, iy + 0.35, 0], [0.4, 4.2, -0.2], [0.4, 4.52, -0.2], [2.8, 4.52, -0.2]]);
    root.add(cable(mainsPath, 0.035, 0x2a2e37), cable(battPlus, 0.05, 0xd7263d), cable(battMinus, 0.05, 0x1b1e24), cable(outPath, 0.035, 0xf2f4f7));
    const upsIn = pathOf([[2.9, 0.6, -0.65], [2.9, 0.6, -0.95], [2.9, 1.0, -1.18]]);
    root.add(cable(upsIn, 0.03, 0x2a2e37));

    const fl = {
      mains: flowDots(mainsPath, 16, COL.ac, 0.05),
      plus: flowDots(battPlus, 10, COL.dc, 0.055),
      minus: flowDots(battMinus, 10, COL.dc, 0.055),
      out: flowDots(outPath, 26, COL.ac, 0.05),
    };
    Object.values(fl).forEach((d) => root.add(d));

    const setExplode = exploder([
      { obj: inv.shell, off: [0, 1.4, 0] },
      { obj: inv.tr, off: [-0.6, 0.2, 1.4] },
      { obj: inv.hs, off: [0.9, 0.1, 0.9] },
      { obj: inv.board, off: [0.9, 0.9, 0.6] },
      { obj: inv.relay, off: [1.2, -0.1, 1.4] },
      { obj: bat.shell, off: [0, 0, 1.4] },
      { obj: bat.band, off: [0, 0, 1.4] },
      { obj: ups.shell, off: [0, 1.1, 0] },
      { obj: ups.batt, off: [0, 0, 1.3] },
    ]);

    const minor = [];
    const L = (t, parent, p, cls, main) => { const l = stage.label(t, p, parent, cls); if (!main) minor.push(l); return l; };
    L('Battery · 12 V, 150 Ah', bat, [0, bat.H * 0.62, bat.D / 2 + 0.1], 'hot', true);
    L('Inverter', inv.shell, [0, inv.H / 2 + 0.15, 0], '', true);
    L('Transformer', inv.tr, [-0.1, 0.55, 0.3]);
    L('MOSFET switches', inv.hs, [0.55, 0.05, 0.1]);
    L('Control board', inv.board, [0.2, 0.15, 0.3]);
    L('Change-over relay', inv.relay, [0.1, -0.3, 0.3]);
    L('Fan', inv.fanRing, [0.2, 0.45, 0]);
    L('Mains in: 230 V AC', root, [-3.4, 1.95, -1.1], '', true);
    L('To your fans and lights', root, [1.7, 3.55, 0.2], '', true);
    L('Computer UPS', ups.shell, [0, ups.H / 2 + 0.2, 0], '', true);
    L('UPS battery · 12 V, 7 Ah', ups.batt, [0, -0.2, 0.4]);

    let fanA = 0, fanSpin = 1, cut = 0, time = 0, shownMains = null;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        time += dt;
        setExplode(s.explode);
        const narrow = stage.host.clientWidth < 560;
        minor.forEach((l) => { l.visible = !narrow; });
        [inv.shell, ups.shell].forEach((m) => m.setXray(s.xray));
        bat.setXray(s.xray);
        cut = approach(cut, s.mains ? 0 : 1, 10, dt);
        fanA += dt * 9 * fanSpin; fan.spin.rotation.y = -fanA;
        inv.fan.rotation.z -= dt * 20;
        bulbs.forEach((b) => b.setOn(1));
        sLamp.material.color.setHex(s.mains ? 0xff5a4f : 0x3a2020);
        const show = s.explode < 0.05;
        // Mains → home and mains → battery while on; battery → home in a cut.
        fl.mains.visible = show && s.mains; fl.mains.step(dt, 1.4);
        fl.out.visible = show; fl.out.step(dt, 1.4);
        // Conventional current: into + when charging, out of + when discharging.
        const dir = s.mains ? 1 : -1;
        fl.plus.visible = fl.minus.visible = show;
        fl.plus.step(dt, 0.6 * dir * (s.mains ? 0.6 : 1));
        fl.minus.step(dt, -0.6 * dir * (s.mains ? 0.6 : 1));
        const blink = Math.sin(time * 5) > 0;
        bat.setGauge(s.mains ? 0.62 + 0.38 * ((time * 0.15) % 1) : 0.62);
        if (shownMains !== s.mains) {
          shownMains = s.mains;
          inv.screen.redraw(s.mains ? 'MAINS' : 'BATTERY', s.mains ? 'CHARGING' : 'BACKUP ON', s.mains ? '#5ce1a9' : '#ffb547');
          inv.led.material.color.setHex(s.mains ? COL.ok : 0xffb547);
          ups.led.material.color.setHex(s.mains ? COL.ok : 0xffb547);
        }
        ups.led.visible = s.mains || blink;
      },
      readout: (s) => {
        const b = backup(LOAD);
        return s.mains
          ? `<div class="big">Mains on: charging</div>
            <div class="row"><span>Your home runs on</span><b>mains, 230 V AC</b></div>
            <div class="row"><span>Battery</span><b>filling with DC, up to 14.4 V</b></div>
            <small>Two fans and four LED bulbs: ${LOAD} W.</small>`
          : `<div class="big">Power cut: on battery</div>
            <div class="row"><span>Load: 2 fans + 4 bulbs</span><b>${LOAD} W</b></div>
            <div class="row"><span>Drawn from the 12 V battery</span><b>${b.I.toFixed(0)} A</b></div>
            <div class="row"><span>Backup from a full battery</span><b>about ${fmtHours(b.hours)}</b></div>
            <small>${INV.VA} VA inverter, 150 Ah tubular battery, 80% usable.</small>`;
      },
    };
  },
};
