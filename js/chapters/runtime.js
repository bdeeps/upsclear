// Chapter 5: backup time. hours ≈ V × Ah × usable depth of discharge × efficiency ÷ load,
// refined by the inverter's own draw and Peukert's law (see backup() in ups.js).
// Appliance powers are typical Indian figures: an ordinary 1200 mm ceiling fan 70–75 W (BEE),
// a BLDC fan 28–35 W, a 9 W LED bulb, a 32–43 inch LED TV about 60 W, a Wi-Fi router about 10 W.
// Power factors (for VA) are typical and vary by model: induction fan 0.95, BLDC fan 0.9,
// LED bulb 0.7, TV 0.7, router adapter 0.5.
import { THREE, M, box, clamp } from '../kit.js';
import { makeBattery, makeInverter, ceilingFan, bulb, tv, router, board, panelBg, backup, fmtHours, CHEM, INV } from '../ups.js';

const ITEMS = { fanI: [75, 0.95], fanB: [30, 0.9], bulb: [9, 0.7], tv: [60, 0.7], router: [10, 0.5] };
export function loadOf(s) {
  const fan = s.bldc ? ITEMS.fanB : ITEMS.fanI;
  const parts = [[s.fans, fan], [s.bulbs, ITEMS.bulb], [s.tv ? 1 : 0, ITEMS.tv], [s.router ? 1 : 0, ITEMS.router]];
  let W = 0, VA = 0;
  for (const [n, [w, pf]] of parts) { W += n * w; VA += (n * w) / pf; }
  return { W, VA };
}
const LAPSE = 1800;      // time-lapse: one real second is 30 minutes

export default {
  id: 'runtime',
  short: 'How long will it last?',
  title: 'How long will the backup last?',
  subtitle: 'Battery energy divided by what you switch on, with a few real-world catches.',
  view: { pos: [1.0, 5.4, 9.0], target: [0.7, 1.95, 0] },
  learn: `<p>A battery's label gives its <b>voltage</b> and its <b>amp-hours</b> (Ah). Multiply them for the energy inside: 12 V × 150 Ah = <b>1,800 watt-hours</b>. Run 180 W of fans and lights and you might hope for 10 hours. You'll get far less, for three reasons.</p>
    <p><b>1. You can't use it all.</b> Draining a lead-acid battery flat shortens its life, so the inverter cuts off with about 20% left: <b>80% usable</b>. <b>2. The inverter isn't perfect.</b> About 15% turns to heat, and it needs a few watts just to stay on. <b>3. Fast draining wastes capacity.</b> The 150 Ah is measured over 20 hours. Pull current faster and less comes out: <b>Peukert's law</b>.</p>
    <p>Inverters are sold in <b>VA</b> (volt-amps), not watts. Fans, TVs and chargers don't draw current perfectly in step with the voltage, so a load needs a bit more VA than W. The ratio is the <b>power factor</b>. A 900 VA inverter can run about 720 W.</p>
    <p>The cheapest way to stretch your backup? Swap old 75 W fans for 30 W <b>BLDC</b> fans. With fans and lights alone, that more than doubles it.</p>
    <p class="tip"><b>Try it:</b> switch on everything, press play on the power cut, then switch to BLDC fans and compare.</p>`,
  terms: [
    { t: 'Amp-hour (Ah)', d: 'How much charge a battery holds: 150 Ah could give 7.5 A for 20 hours.' },
    { t: 'Watt-hour (Wh)', d: 'Energy: one watt for one hour. Volts × amp-hours gives watt-hours.' },
    { t: 'Depth of discharge', d: 'How much of the battery’s capacity you use before recharging.' },
    { t: 'Peukert’s law', d: 'The faster you drain a battery, the less of its rated capacity you get.' },
    { t: 'VA and power factor', d: 'VA is volts × amps; watts are what does useful work. Power factor = W ÷ VA.' },
  ],
  defaults: { fans: 2, bldc: false, bulbs: 4, tv: true, router: true, ah: 150, chem: 'lead' },
  controls: [
    { key: 'fans', type: 'range', label: 'Ceiling fans', min: 0, max: 4, step: 1, fmt: (v, s) => `${v} × ${s.bldc ? 30 : 75} W` },
    { key: 'bldc', type: 'toggle', label: 'BLDC fans (30 W instead of 75 W)' },
    { key: 'bulbs', type: 'range', label: 'LED bulbs', min: 0, max: 10, step: 1, fmt: (v) => `${v} × 9 W` },
    { key: 'tv', type: 'toggle', label: 'TV (60 W)' },
    { key: 'router', type: 'toggle', label: 'Wi-Fi router (10 W)' },
    { key: 'ah', type: 'seg', label: 'Battery size', options: [{ v: 100, label: '100 Ah' }, { v: 150, label: '150 Ah' }, { v: 200, label: '200 Ah' }] },
    { key: 'chem', type: 'seg', label: 'Battery type', options: [{ v: 'lead', label: 'Lead-acid' }, { v: 'lfp', label: 'LiFePO₄' }] },
    { key: 'go', type: 'buttons', label: 'Time-lapse', items: [{ label: 'Play a power cut', act: (s, inst) => inst.play() }] },
  ],
  quiz: [
    { q: 'A 12 V, 150 Ah battery holds about how much energy?', options: ['150 Wh', '1,800 Wh', '12 Wh', '18,000 Wh'], answer: 1, why: 'Volts × amp-hours = watt-hours: 12 × 150 = 1,800 Wh.' },
    { q: 'Why does a heavy load give less backup than simple maths says?', options: ['The fans get tired', 'Draining faster wastes some capacity (Peukert) and the inverter loses energy as heat', 'Batteries fill up again', 'It doesn’t'], answer: 1, why: 'Faster drain means less usable capacity, and 10–20% is lost in the inverter.' },
    { q: 'An inverter is rated 900 VA. Why not 900 W?', options: ['VA is a bigger unit', 'Many loads draw a little more current than their watts suggest, so VA is the honest limit', 'It only works at night', 'It is a typo'], answer: 1, why: 'Power factor below 1 means more volt-amps than watts. At 0.8, 900 VA is about 720 W.' },
  ],
  reel: [
    { ms: 6200, caption: 'Backup time is battery energy divided by what you switch on. BLDC fans can nearly double it.', set: { fans: 3, bulbs: 4, tv: true, router: true, ah: 150, chem: 'lead', bldc: false }, act: (s, inst) => inst.play(), anim: { bldc: [false, true] }, spin: 0.15 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const bat = makeBattery({ W: 1.7, H: 1.5, D: 0.65 }); bat.position.set(-3.1, 0, 0.3); bat.setXray(false); bat.inner.visible = false; root.add(bat);
    const inv = makeInverter({ W: 1.5, H: 1.05, D: 0.6 }); inv.position.set(-3.1, 1.95, 0.3); inv.shell.setXray(false); root.add(inv);
    const lBat = stage.label('', [-3.1, -0.3, 0.7], root, 'hot');

    // A room: ceiling, four fans, ten bulbs, a TV and a router.
    const ceil = box(6.4, 0.06, 2.2, M.clear(0xcfe0ff, 0.08)); ceil.position.set(1.5, 3.55, -0.4); ceil.castShadow = false; root.add(ceil);
    const fans = [-0.75, 0.75, 2.25, 3.75].map((x) => { const f = ceilingFan(0.62); f.position.set(x, 3.52, -0.5); root.add(f); return f; });
    const bulbs = Array.from({ length: 10 }, (_, i) => { const b = bulb(0.11); b.position.set(-1.35 + i * 0.63, 3.52, 0.45); b.rotation.x = Math.PI; root.add(b); return b; });
    const shelf = box(3.0, 0.1, 0.8, M.matte(0x6a5a4a)); shelf.position.set(1.4, 0.7, -0.2); root.add(shelf);
    for (const x of [0.0, 2.8]) { const l = box(0.08, 0.7, 0.7, M.matte(0x6a5a4a)); l.position.set(x, 0.35, -0.2); root.add(l); }
    const tele = tv(1.6); tele.position.set(1.0, 0.75, -0.3); root.add(tele);
    const rt = router(); rt.position.set(2.35, 0.75, -0.1); root.add(rt);

    // Chart: backup hours against load, for the chosen battery, with the "simple maths" line.
    let cur = { W: 250, ah: 150, chem: 'lead' };
    const brd = board(stage, root, 3.7, 2.11, 760, 434, (g, w, h) => {
      panelBg(g, w, h);
      const x0 = 70, x1 = w - 24, y0 = h - 52, y1 = 64, X = (W) => x0 + (W / 720) * (x1 - x0), Y = (hr) => y0 - (clamp(hr, 0, 16) / 16) * (y0 - y1);
      g.fillStyle = '#e8eef8'; g.font = 'bold 22px sans-serif'; g.fillText(`Backup vs load · ${cur.ah} Ah ${CHEM[cur.chem].short}`, 16, 32);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '16px sans-serif';
      for (const hr of [0, 4, 8, 12, 16]) { g.beginPath(); g.moveTo(x0, Y(hr)); g.lineTo(x1, Y(hr)); g.stroke(); g.fillText(hr + ' h', 18, Y(hr) + 5); }
      for (const W of [0, 200, 400, 600]) g.fillText(W + ' W', X(W) - 16, h - 22);
      const curve = (fn, col, dash) => { g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); for (let W = 20; W <= 720; W += 5) { const y = Y(fn(W)); W === 20 ? g.moveTo(X(W), y) : g.lineTo(X(W), y); } g.stroke(); g.setLineDash([]); };
      curve((W) => backup(W, cur.ah, cur.chem).simple, 'rgba(142,240,255,.45)', [8, 8]);
      curve((W) => backup(W, cur.ah, cur.chem).hours, '#8ef0ff', []);
      g.fillStyle = 'rgba(142,240,255,.8)'; g.font = '16px sans-serif'; g.fillText('simple maths', X(330), Y(backup(330, cur.ah, cur.chem).simple) - 12);
      g.fillStyle = '#8ef0ff'; g.fillText('with losses + Peukert', X(420), Y(backup(420, cur.ah, cur.chem).hours) + 30);
      if (cur.W > 0) { const hr = backup(cur.W, cur.ah, cur.chem).hours; g.fillStyle = '#ffb547'; g.beginPath(); g.arc(X(Math.min(720, cur.W)), Y(hr), 10, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
      if (cur.W > INV.W) { g.fillStyle = '#ff7a59'; g.font = 'bold 18px sans-serif'; g.fillText('Overload! More than 720 W', x0 + 180, y1 + 16); }
    }, [3.55, 1.35, 1.0]);
    brd.mesh.rotation.y = -0.3;

    // Time-lapse of a power cut.
    let lapse = null, spin = 0, key = '', blink = 0, shown = '';
    const api = { play: () => { lapse = { t: 0 }; } };
    return {
      ...api,
      update(dt, s, time) {
        dt = Math.max(0, dt);
        const { W } = loadOf(s), b = backup(W, s.ah, s.chem);
        const k = `${W}|${s.ah}|${s.chem}`;
        if (k !== key) { key = k; cur = { W, ah: s.ah, chem: s.chem }; brd.redraw(); }
        let left = 1, on = 1;
        if (lapse) {
          lapse.t += (dt * LAPSE) / 3600;               // hours of cut so far
          left = clamp(1 - lapse.t / Math.max(0.01, b.hours), 0, 1);
          if (left <= 0) { on = 0; if (lapse.t > b.hours + 1.5) lapse = null; }
        }
        bat.setGauge(0.02 + 0.98 * left);
        blink += dt;
        const fanOn = (i) => on && i < s.fans;
        spin += dt * 7;
        fans.forEach((f, i) => { f.visible = true; if (fanOn(i)) f.spin.rotation.y = -spin - i; f.spin.children.forEach((h) => h.children[0].material.color.setHex(i < s.fans ? 0xe8d7b8 : 0x55575c)); });
        bulbs.forEach((bb, i) => bb.setOn(on && i < s.bulbs ? 1 : 0));
        tele.setOn(on && s.tv ? 1 : 0); rt.setOn(on && s.router ? 1 : 0, time || blink);
        const mode = lapse ? (left > 0 ? 'b' : 'e') : 'm';
        if (mode !== shown) { shown = mode; inv.screen.redraw(mode === 'm' ? 'MAINS' : mode === 'b' ? 'BATTERY' : 'LOW BATT', mode === 'm' ? 'CHARGING' : mode === 'b' ? 'BACKUP ON' : 'SHUT DOWN', mode === 'm' ? '#5ce1a9' : mode === 'b' ? '#ffb547' : '#ff7a59'); }
        lBat.element.innerHTML = lapse
          ? `Power cut: <b>${fmtHours(Math.min(lapse.t, b.hours))}</b> ${left > 0 ? 'so far' : '· battery empty'}`
          : `<b>${s.ah} Ah ${CHEM[s.chem].short}</b> · ${Math.round(CHEM[s.chem].V * s.ah).toLocaleString('en-IN')} Wh`;
      },
      readout: (s) => {
        const { W, VA } = loadOf(s), b = backup(W, s.ah, s.chem), over = W > INV.W || VA > INV.VA;
        return `<div class="big">${W ? (over ? 'Overload!' : 'About ' + fmtHours(b.hours)) : 'Nothing switched on'}</div>
          <div class="row"><span>Load</span><b>${W} W · ${Math.round(VA)} VA of ${INV.VA}</b></div>
          <div class="row"><span>Battery current</span><b>${b.I.toFixed(1)} A</b></div>
          <div class="row"><span>Simple maths says</span><b>${W ? fmtHours(b.simple) : '–'}</b></div>
          <small>At this drain you get ${Math.round(b.capFactor * 100)}% of ${s.ah} Ah, ${Math.round(CHEM[s.chem].dod * 100)}% usable, 85% efficient.</small>`;
      },
    };
  },
};
