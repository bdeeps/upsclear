// Chapter 6: inside the battery. Six lead-acid cells in series (about 2.1 V each), tubular
// positive plates, sulfate ions moving in and out of the plates, the acid's specific gravity as
// a fuel gauge, and water loss. Or: four LiFePO4 cells (3.2 V each) with a BMS.
// Cell voltage ≈ specific gravity + 0.84 (see ups.js).
import { THREE, M, box, rod, sphere, clamp, lerp, approach } from '../kit.js';
import { sgOf, leadCellV, lfpCellV, CHEM, board, panelBg, pcb, bench, COL } from '../ups.js';

const W = 5.0, H = 2.6, D = 1.4, BX = -0.7;       // the lead-acid battery (scene units)
const PLATE_BOT = 0.35, PLATE_TOP = 1.95;
const hash = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };

export default {
  id: 'battery',
  short: 'Inside the battery',
  title: 'Inside the battery',
  subtitle: 'Lead, lead dioxide and acid: a chemical reaction you can run forwards and backwards.',
  view: { pos: [0.7, 5.6, 9.0], target: [0.3, 2.75, 0] },
  learn: `<p>An inverter battery is six <b>cells</b> in a row. Each has <b>lead</b> plates (grey, negative) and <b>lead dioxide</b> plates (brown, positive) standing in dilute <b>sulfuric acid</b>. Each cell makes about <b>2.1 V</b>, and six in series make <b>12.6 V</b>.</p>
    <p>As it gives out current, both kinds of plate soak up sulfate from the acid and turn into <b>lead sulfate</b>. The acid gets weaker and more watery: Pb + PbO₂ + 2 H₂SO₄ → 2 PbSO₄ + 2 H₂O. Charging drives the reaction backwards. That's why you can check the charge with a <b>hydrometer</b>: strong acid is denser. A reading of about <b>1.26</b> is full; about 1.12 is flat.</p>
    <p>Charging also splits a little water into hydrogen and oxygen, so the level drops. Top it up with <b>distilled water</b> only, never acid or tap water. <b>Tubular</b> batteries hold the positive paste in little fabric tubes, so it can't flake off. They last about <b>1,200 to 1,500</b> deep cycles, far more than flat plates.</p>
    <p><b>LiFePO₄</b> (lithium iron phosphate) batteries use 3.2 V cells, four in series. They weigh about a third as much, need no water, can be used more deeply and last several thousand cycles. They cost more up front.</p>
    <p class="tip"><b>Try it:</b> drain the battery and watch the plates turn white with sulfate and the hydrometer float sink. Skip a few months, then top up.</p>`,
  terms: [
    { t: 'Cell', d: 'One unit of a battery. A lead-acid cell makes about 2.1 V.' },
    { t: 'Electrolyte', d: 'The liquid (or gel) that carries ions between the plates. Here, dilute sulfuric acid.' },
    { t: 'Specific gravity', d: 'How dense a liquid is compared with water. Stronger acid means a fuller battery.' },
    { t: 'Hydrometer', d: 'A float in a glass tube that measures specific gravity.' },
    { t: 'Tubular plate', d: 'A positive plate whose active paste sits in rows of porous tubes, so it lasts longer.' },
    { t: 'BMS', d: 'Battery management system: the circuit that protects a lithium battery’s cells.' },
  ],
  defaults: { chem: 'lead', soc: 1, mode: 'discharge' },
  controls: [
    { key: 'chem', type: 'seg', label: 'Battery type', options: [{ v: 'lead', label: 'Lead-acid tubular' }, { v: 'lfp', label: 'LiFePO₄' }] },
    { key: 'mode', type: 'seg', label: 'Right now it is', options: [{ v: 'discharge', label: 'Powering a load' }, { v: 'rest', label: 'Resting' }, { v: 'charge', label: 'Charging' }] },
    { key: 'soc', type: 'range', label: 'State of charge', min: 0, max: 1, step: 0.01, ends: ['flat', 'full'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'water', type: 'buttons', label: 'Water (lead-acid)', items: [{ label: 'Skip 3 months', act: (s, inst) => inst.age() }, { label: 'Top up with distilled water', act: (s, inst) => inst.topUp() }] },
  ],
  quiz: [
    { q: 'Why does a lead-acid battery need topping up with distilled water?', options: ['The acid evaporates in the sun', 'Charging splits some water into hydrogen and oxygen gas', 'The plates drink it', 'It doesn’t'], answer: 1, why: 'Near the end of charging, a little water is split into gas and bubbles away. Only water is lost, so only water goes back.' },
    { q: 'A hydrometer reads 1.13. What does that tell you?', options: ['The battery is full', 'The battery is nearly flat', 'The water is too hot', 'The battery is a LiFePO₄'], answer: 1, why: 'As it discharges, sulfate leaves the acid for the plates, so the acid gets less dense.' },
    { q: 'How many LiFePO₄ cells make a 12 V battery?', options: ['6', '4', '12', '1'], answer: 1, why: 'Each cell is about 3.2 V, so four in series make 12.8 V.' },
  ],
  reel: [
    { ms: 5800, caption: 'Six lead-acid cells of 2.1 V make 12.6 V. Draining it turns the plates to lead sulfate.', set: { chem: 'lead', mode: 'discharge' }, anim: { soc: [1, 0.1] }, view: { pos: [0.9, 4.9, 8.2], target: [0.1, 2.45, 0] }, spin: 0.15 },
  ],

  build({ stage }) {
    const scene = new THREE.Group(); stage.root.add(scene);
    const LIFT = 1.3;
    scene.add(bench(8.4, 2.2, LIFT));
    const root = new THREE.Group(); root.position.set(0.4, LIFT, 0); scene.add(root);

    // ---------------- lead-acid battery
    const lead = new THREE.Group(); lead.position.x = BX; root.add(lead);
    const shell = box(W, H, D, M.clear(0xdfeaff, 0.12)); shell.position.y = H / 2; shell.castShadow = false; lead.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), new THREE.LineBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.6 })); edges.position.copy(shell.position); lead.add(edges);
    const lid = box(W + 0.05, 0.12, D + 0.05, M.plastic(0x2a2e37)); lid.position.y = H + 0.06; lead.add(lid);
    const acidMat = M.clear(0xffe7a0, 0.2); const acid = box(W - 0.08, 1, D - 0.08, acidMat); acid.castShadow = false; lead.add(acid);
    const cw = (W - 0.08) / 6;
    const posMat = M.matte(0x6b3a1e), negMat = M.matte(0x7d848f);
    const tubeGeo = new THREE.CylinderGeometry(0.035, 0.035, PLATE_TOP - PLATE_BOT, 10);
    const tubes = new THREE.InstancedMesh(tubeGeo, posMat, 6 * 2 * 9); tubes.castShadow = true; lead.add(tubes);
    const gaps = [];                               // x centres of the gaps between plates
    const o = new THREE.Object3D(); let ti = 0;
    const floats = [], minor = [];
    for (let c = 0; c < 6; c++) {
      const x0 = -W / 2 + 0.04 + c * cw;
      if (c) { const wall = box(0.02, H - 0.1, D - 0.06, M.clear(0xe8eef8, 0.25)); wall.position.set(x0, H / 2, 0); wall.castShadow = false; lead.add(wall); }
      const xs = [0.14, 0.32, 0.5, 0.68, 0.86].map((f) => x0 + f * cw);
      xs.forEach((x, p) => {
        if (p % 2 === 0) { const pl = box(0.05, PLATE_TOP - PLATE_BOT, D * 0.78, negMat); pl.position.set(x, (PLATE_TOP + PLATE_BOT) / 2, 0); lead.add(pl); }
        else for (let k = 0; k < 9; k++) { o.position.set(x, (PLATE_TOP + PLATE_BOT) / 2, -D * 0.36 + (k * D * 0.72) / 8); o.updateMatrix(); tubes.setMatrixAt(ti++, o.matrix); }
        if (p < 4) gaps.push((x + xs[p + 1]) / 2);
      });
      // Straps joining the cells in series.
      if (c < 5) { const st = box(cw * 0.5, 0.06, 0.1, M.metal(0x8a919c)); st.position.set(x0 + cw * 0.95, PLATE_TOP + 0.12, -D * 0.3); lead.add(st); }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 16), M.plastic(0xffd35a)); cap.position.set(x0 + cw / 2, H + 0.17, 0.25); lead.add(cap);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), M.plastic(0x5ce1a9)); fl.position.set(x0 + cw / 2, H + 0.3, 0.25); lead.add(fl); floats.push(fl);
    }
    tubes.instanceMatrix.needsUpdate = true;
    const term = (x, col) => { const t = rod(0, 0.25, 0.12, 0.12, M.metal(0x9aa0aa), 18); t.rotation.z = Math.PI / 2; t.position.set(x, H + 0.12, -0.35); t.position.set(x, H + 0.12, -0.35); const c = box(0.3, 0.05, 0.3, M.plastic(col)); c.position.set(x, H + 0.14, -0.35); lead.add(t, c); };
    term(W / 2 - 0.35, 0xd7263d); term(-W / 2 + 0.35, 0x2a2e37);
    // Max/min marks on the case.
    for (const [y, t] of [[2.3, 'max'], [2.0, 'min']]) { const m = box(0.25, 0.02, 0.01, M.glow(0xffffff, { transparent: true, opacity: 0.6 })); m.position.set(W / 2 - 0.2, y, D / 2 + 0.01); lead.add(m); minor.push(stage.label(t, [W / 2 + 0.2, y, D / 2], lead)); }

    // Sulfate ions in the acid.
    const NI = 200;
    const ions = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), M.glow(COL.dc), NI); ions.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lead.add(ions);
    const ion = Array.from({ length: NI }, (_, i) => ({ g: i % gaps.length, u: ((i * 0.618) % 2) - 1, y: PLATE_BOT + 0.1 + ((i * 0.377) % 1) * (PLATE_TOP - PLATE_BOT - 0.2), z: -D * 0.35 + ((i * 0.713) % 1) * D * 0.7 }));

    // Hydrometer: a glass tube with a float that rides higher in denser acid.
    const hyd = new THREE.Group(); hyd.position.set(BX + W / 2 + 0.9, 0, 0.3); root.add(hyd);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 24, 1, true), M.clear(0xdfeaff, 0.18)); glass.position.y = 1.3; hyd.add(glass);
    const bulbTop = sphere(0.24, M.matte(0x2a2e37)); bulbTop.position.y = 2.5; bulbTop.scale.y = 1.3; hyd.add(bulbTop);
    const hacid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.5, 24), M.clear(0xffe7a0, 0.35)); hacid.position.y = 0.95; hyd.add(hacid);
    const nozzle = rod(0, 0.4, 0.05, 0.02, M.plastic(0x2a2e37), 10); nozzle.rotation.z = -Math.PI / 2; nozzle.position.set(0, 0.08, 0); hyd.add(nozzle);
    const flt = new THREE.Group(); hyd.add(flt);
    const fb = sphere(0.12, M.plastic(0xf2f4f7)); fb.scale.y = 1.8; flt.add(fb);
    const fs = rod(0, 0.8, 0.03, 0.03, M.plastic(0xf2f4f7), 8); fs.rotation.z = Math.PI / 2; fs.position.set(0, 0.55, 0); flt.add(fs);
    const band = rod(0, 0.1, 0.034, 0.034, M.glow(0xff5a4f), 8); band.rotation.z = Math.PI / 2; band.position.set(0, 0.62, 0); flt.add(band);
    const lHyd = stage.label('', [0, 3.05, 0], hyd, 'hot');

    // ---------------- LiFePO4 pack
    const lfp = new THREE.Group(); lfp.position.x = -0.4; root.add(lfp);
    const cells = [];
    for (let i = 0; i < 4; i++) {
      const c = box(0.8, 2.0, 1.2, M.plastic(0x2a5dd6, { roughness: 0.35 })); c.position.set(-1.35 + i * 0.9, 1.0, 0); lfp.add(c); cells.push(c);
      const lab = box(0.6, 0.5, 0.01, M.plastic(0xf2f4f7)); lab.position.set(-1.35 + i * 0.9, 1.1, 0.61); lfp.add(lab);
      for (const dz of [-0.35, 0.35]) { const t = box(0.22, 0.06, 0.22, M.metal(dz < 0 ? 0xd8dde6 : 0xd07a45)); t.position.set(-1.35 + i * 0.9, 2.03, dz); lfp.add(t); }
      minor.push(stage.label('3.2 V', [-1.35 + i * 0.9, 0.55, 0.7], lfp));
    }
    for (let i = 0; i < 3; i++) { const b = box(0.9, 0.04, 0.2, M.metal(0xc9ced8)); b.position.set(-0.9 + i * 0.9, 2.08, i % 2 ? 0.35 : -0.35); lfp.add(b); }
    const bms = pcb(2.6, 0.5); bms.position.set(0, 2.3, 0); lfp.add(bms);
    minor.push(stage.label('BMS', [1.4, 2.4, 0], lfp));
    const lfpGauge = [];
    cells.forEach((c) => { const gm = box(0.1, 1, 0.1, M.glow(COL.ok)); gm.position.set(c.position.x + 0.3, 0.2, 0.62); lfp.add(gm); lfpGauge.push(gm); });

    // Board: the reaction.
    let cur = { chem: 'lead', mode: 'discharge' };
    const brd = board(stage, scene, 6.0, 1.3, 1100, 238, (g, w, h) => {
      panelBg(g, w, h);
      g.textAlign = 'center';
      const dis = cur.mode === 'discharge', chg = cur.mode === 'charge';
      g.fillStyle = '#e8eef8'; g.font = 'bold 22px sans-serif';
      g.fillText(cur.chem === 'lead' ? 'Lead-acid: the reaction runs both ways' : 'LiFePO₄: lithium ions shuttle between the plates', w / 2, 34);
      g.font = '38px serif'; g.fillStyle = '#ffd35a';
      g.fillText(cur.chem === 'lead' ? 'Pb + PbO₂ + 2 H₂SO₄  ⇌  2 PbSO₄ + 2 H₂O' : 'LiFePO₄ + C₆  ⇌  FePO₄ + LiC₆', w / 2, 112);
      g.font = 'bold 22px sans-serif';
      g.fillStyle = dis ? '#5ce1a9' : 'rgba(255,255,255,.35)'; g.fillText('discharging  →', w / 2 - 190, 170);
      g.fillStyle = chg ? '#8ef0ff' : 'rgba(255,255,255,.35)'; g.fillText('←  charging', w / 2 + 190, 170);
      g.font = '18px sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)';
      g.fillText(cur.chem === 'lead' ? 'lead + lead dioxide + sulfuric acid  ⇌  lead sulfate + water' : 'lithium moves from the iron-phosphate side into the graphite when charging, and back when discharging', w / 2, 212);
      g.textAlign = 'left';
    }, [0.0, 0.62, 1.3]);

    let water = 1, shownWater = 1, t = 0, key = '';
    const api = { age: () => { water = Math.max(0, water - 0.35); }, topUp: () => { water = 1; } };
    const col = new THREE.Color(), white = new THREE.Color(0xe6e2d8);
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        const isLead = s.chem === 'lead';
        lead.visible = isLead; hyd.visible = isLead; lfp.visible = !isLead;
        const narrow = stage.host.clientWidth < 560;
        minor.forEach((l) => { l.visible = !narrow; });
        const k = `${s.chem}|${s.mode}`; if (k !== key) { key = k; cur = { chem: s.chem, mode: s.mode }; brd.redraw(); }
        if (isLead) {
          shownWater = approach(shownWater, water, 3, dt);
          const top = 1.75 + 0.55 * shownWater;
          acid.scale.y = top - 0.08; acid.position.y = 0.04 + (top - 0.08) / 2;
          // Sulfate on the plates grows as it discharges.
          const sulf = (1 - s.soc) * 0.65;
          posMat.color.copy(col.setHex(0x6b3a1e).lerp(white, sulf)); negMat.color.copy(col.setHex(0x7d848f).lerp(white, sulf));
          const sg = sgOf(s.soc);
          acidMat.opacity = 0.1 + 0.25 * (sg - 1.1) / 0.16;
          floats.forEach((f) => f.material.color.setHex(shownWater > 0.3 ? 0x5ce1a9 : 0xff5a4f));
          // Ions: towards the plates when discharging, back out when charging.
          const dir = s.mode === 'discharge' ? 1 : s.mode === 'charge' ? -1 : 0;
          const halfGap = cw * 0.09 - 0.03;
          for (let i = 0; i < NI; i++) {
            const q = ion[i];
            if (dir === 0) q.u += Math.sin(t * 3 + i) * dt * 0.2;
            else { q.u += Math.sign(q.u || 0.01) * dir * dt * 0.8; if (Math.abs(q.u) > 1) q.u = dir > 0 ? (hash(i + t) - 0.5) * 0.2 : 0; if (dir < 0 && Math.abs(q.u) < 0.02) q.u = hash(i * 7 + t) < 0.5 ? -1 : 1; }
            q.u = clamp(q.u, -1, 1);
            const show = q.y < top - 0.05 && i < NI * (0.35 + 0.65 * s.soc);
            o.position.set(gaps[q.g] + q.u * halfGap, q.y, q.z); o.scale.setScalar(show ? 1 : 0); o.updateMatrix(); ions.setMatrixAt(i, o.matrix);
          }
          ions.instanceMatrix.needsUpdate = true;
          flt.position.y = 0.95 + (sg - 1.1) * 4.5;
          lHyd.element.innerHTML = `Hydrometer <b>${sg.toFixed(3)}</b>`;
        } else {
          lfpGauge.forEach((gm) => { const f = Math.max(0.02, s.soc); gm.scale.y = f * 1.6; gm.position.y = 0.2 + (f * 1.6) / 2; gm.material.color.setHex(s.soc > 0.2 ? COL.ok : COL.hot); });
        }
      },
      readout: (s) => {
        const c = CHEM[s.chem];
        if (s.chem === 'lead') {
          const v = leadCellV(s.soc), low = water < 0.3;
          return `<div class="big">${(v * 6).toFixed(2)} V · ${Math.round(s.soc * 100)}% charged</div>
            <div class="row"><span>Each cell</span><b>${v.toFixed(2)} V × 6</b></div>
            <div class="row"><span>Acid specific gravity</span><b>${sgOf(s.soc).toFixed(3)}</b></div>
            <div class="row"><span>Water level</span><b>${low ? 'LOW: plates drying out' : water > 0.9 ? 'full' : 'OK'}</b></div>
            <small>150 Ah tubular: about ${Math.round(c.kgPerAh * 150)} kg, ${c.cycles} cycles.</small>`;
        }
        const v = lfpCellV(s.soc);
        return `<div class="big">${(v * 4).toFixed(2)} V · ${Math.round(s.soc * 100)}% charged</div>
          <div class="row"><span>Each cell</span><b>${v.toFixed(2)} V × 4</b></div>
          <div class="row"><span>150 Ah weighs</span><b>${Math.round(c.kgPerAh * 150)} kg, not ${Math.round(CHEM.lead.kgPerAh * 150)}</b></div>
          <div class="row"><span>Water to top up</span><b>none</b></div>
          <small>About ${c.cycles} cycles. Its voltage hardly moves, so the BMS counts charge.</small>`;
      },
    };
  },
};
