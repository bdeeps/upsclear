// UPSClear's shared physics and parts: mains and battery numbers, the backup-time model,
// lead-acid and LiFePO4 cell voltages, inverter waveforms, and 3D builders for a home
// inverter, a tall tubular battery, a computer UPS and the things they power.
import { THREE, M, rod, box, beam, tube, torus, sphere, canvasTexture, clamp, lerp } from './kit.js';

// ---------------------------------------------------------------- mains and battery
// India's mains: 230 V RMS at 50 Hz (IS 12360; the Central Electricity Authority's supply code).
// Peak = 230 × √2 ≈ 325 V. One cycle lasts 20 ms.
export const MAINS = { V: 230, f: 50, peak: 230 * Math.SQRT2, period: 20 };

// A tall tubular inverter battery: 12 V, 150 Ah at the 20-hour rate (C20), about 53.5 kg filled,
// 50 × 19 × 44 cm (Luminous ILTT18000N listing; Exide InvaTubular and others are similar).
// Makers quote about 1,200–1,500 cycles at 80% depth of discharge for tubular plates.
// LiFePO4: 3.2 V cells, four in series make a 12.8 V pack. About 90–160 Wh/kg against
// 30–40 Wh/kg for lead-acid, and 2,000–6,000 cycles (datasheets; Battery University BU-205, BU-216).
export const CHEM = {
  lead: { name: 'Tubular lead-acid', short: 'Lead-acid', V: 12, cells: 6, cellV: 2.1, dod: 0.8, k: 1.2, kgPerAh: 53.5 / 150, cycles: '1,200–1,500' },
  lfp: { name: 'LiFePO₄ (lithium iron phosphate)', short: 'LiFePO₄', V: 12.8, cells: 4, cellV: 3.2, dod: 0.9, k: 1.05, kgPerAh: 16 / 150, cycles: '3,000–6,000' },
};
export const RATE_H = 20;   // capacity is quoted at the 20-hour rate (C20)

// The home inverter: 900 VA, 720 W at power factor 0.8 (a common Indian size), about 85%
// efficient at useful loads, plus about 12 W to keep its own electronics, fan and transformer
// going (a no-load draw of roughly 1 A from the battery is typical for this size).
export const INV = { VA: 900, W: 720, eff: 0.85, idleW: 12 };

// Backup time. The simple rule: hours = V × Ah × usable depth of discharge × efficiency ÷ load.
// The better model adds the inverter's own draw and Peukert's law: the faster you drain a battery,
// the less of its rated capacity you get. Capacity at current I = C × (I_rated / I)^(k − 1),
// where I_rated = C / 20 h; k ≈ 1.2 for lead-acid, ≈ 1.05 for LiFePO4 (Battery University BU-503).
// We never credit more than the rated capacity at light loads.
export function backup(loadW, Ah = 150, chem = 'lead') {
  const c = CHEM[chem];
  const Pin = loadW / INV.eff + INV.idleW;          // watts drawn from the battery
  const I = Pin / c.V;                              // amps
  const Irated = Ah / RATE_H;
  const capFactor = Math.min(1, Math.pow(Irated / Math.max(1e-6, I), c.k - 1));
  const usableAh = Ah * capFactor * c.dod;
  const hours = usableAh / I;
  const simple = loadW > 0 ? (c.V * Ah * c.dod * INV.eff) / loadW : Infinity;
  return { Pin, I, capFactor, usableAh, hours, simple, energyWh: c.V * Ah, usableWh: c.V * usableAh };
}
export function fmtHours(h) {
  if (!isFinite(h) || h > 99) return 'days';
  const H = Math.floor(h), m = Math.round((h - H) * 60);
  return m === 60 ? `${H + 1} h 0 min` : `${H} h ${m} min`;
}

// Lead-acid: open-circuit cell voltage ≈ specific gravity + 0.84 (a long-standing rule of thumb,
// e.g. Battery University BU-903; Crompton, Battery Reference Book). Specific gravity falls from
// about 1.26 (full) to about 1.12 (flat) as sulfuric acid is used up. Inverter tubular batteries
// are filled to 1.24–1.28 depending on the maker.
export const sgOf = (soc) => 1.12 + 0.14 * clamp(soc, 0, 1);
export const leadCellV = (soc) => sgOf(soc) + 0.84;
// LiFePO4 resting cell voltage against state of charge: famously flat (typical datasheet curve).
const LFP_OCV = [[0, 2.8], [0.05, 3.1], [0.1, 3.2], [0.2, 3.24], [0.4, 3.27], [0.6, 3.3], [0.8, 3.32], [0.95, 3.35], [1, 3.4]];
export function lfpCellV(soc) {
  soc = clamp(soc, 0, 1);
  for (let i = 1; i < LFP_OCV.length; i++) if (soc <= LFP_OCV[i][0]) { const [a, va] = LFP_OCV[i - 1], [b, vb] = LFP_OCV[i]; return lerp(va, vb, (soc - a) / (b - a)); }
  return 3.4;
}

// Lead-acid charging in three stages for a 150 Ah battery (the usual IU0 profile):
// bulk at a constant 15 A (C/10) while the voltage climbs, absorption held at 14.4 V while
// the current tapers, then float at 13.5 V to keep it topped up without boiling off water.
export const CHARGE = { bulkA: 15, absorbV: 14.4, floatV: 13.5, floatA: 0.5 };
export function chargeStage(soc) {
  soc = clamp(soc, 0, 1);
  if (soc < 0.8) return { stage: 'Bulk', V: lerp(12.2, 14.4, Math.pow(soc / 0.8, 1.6)), I: CHARGE.bulkA };
  if (soc < 0.98) { const k = (soc - 0.8) / 0.18; return { stage: 'Absorption', V: CHARGE.absorbV, I: lerp(CHARGE.bulkA, 1.2, 1 - Math.pow(1 - k, 2)) }; }
  return { stage: 'Float', V: CHARGE.floatV, I: CHARGE.floatA };
}

// ---------------------------------------------------------------- waveforms
// θ is the phase in radians. Each wave has the same 230 V RMS.
const TAU = Math.PI * 2;
export const WAVES = {
  // Square: +V for half a cycle, −V for the other half. RMS = V, so V = 230.
  square: { name: 'Square wave', peak: 230, thd: 48.3 },
  // Modified (quasi) sine: on for 120° of each half, off for 60° (the setting with the least distortion;
  // no 3rd, 9th... harmonics). RMS = V·√(2/3), so V = 282 V for 230 V RMS.
  modified: { name: 'Modified sine', peak: 230 / Math.sqrt(2 / 3), thd: 31.1 },
  // Pure sine: PWM at kHz, smoothed by an inductor-capacitor filter. Datasheets quote under 3–5% THD.
  sine: { name: 'Pure sine', peak: MAINS.peak, thd: 3 },
};
// THD of a quasi-square wave with pulse width w per half-cycle: harmonics bn = (4/nπ)·sin(n w/2).
// Square (w = π): √(π²/8 − 1) = 48.3%; w = 2π/3: 31.1%. Computed here so the readout uses the maths.
export function quasiTHD(w) {
  let s = 0; const b1 = Math.sin(w / 2);
  for (let n = 3; n < 4001; n += 2) { const b = Math.sin((n * w) / 2) / n; s += b * b; }
  return (Math.sqrt(s) / Math.abs(b1)) * 100;
}
const ph = (t) => ((t % TAU) + TAU) % TAU;
// Triangle carrier in 0..1 with n peaks per cycle.
const tri = (t, n) => { const x = (ph(t) / TAU) * n; return 1 - Math.abs(2 * (x - Math.floor(x)) - 1); };
export const MOD_INDEX = 0.9;
// Switch pattern for an H-bridge at phase t: +1 (S1+S4 on), −1 (S3+S2 on) or 0 (off / freewheel).
export function bridgeState(kind, t, carrier = 24) {
  const p = ph(t), s = Math.sin(p);
  if (kind === 'square') return p < Math.PI ? 1 : -1;
  if (kind === 'modified') { const q = p % Math.PI; return Math.abs(q - Math.PI / 2) < Math.PI / 3 ? (p < Math.PI ? 1 : -1) : 0; }
  // Unipolar sine PWM: switch on whenever the sine (scaled by the modulation index) is above the carrier.
  return Math.abs(s) * MOD_INDEX > tri(t, carrier) ? Math.sign(s) : 0;
}
// Output voltage at the transformer's 230 V side before the filter, and after it.
export function waveRaw(kind, t, carrier) {
  const b = bridgeState(kind, t, carrier);
  if (kind === 'sine') return b * (MAINS.peak / MOD_INDEX);
  return b * WAVES[kind].peak;
}
export function waveOut(kind, t, carrier) { return kind === 'sine' ? MAINS.peak * Math.sin(ph(t)) : waveRaw(kind, t, carrier); }

// ---------------------------------------------------------------- colours
export const COL = { ac: 0x8ef0ff, dc: 0xffd35a, hot: 0xff7a59, ok: 0x5ce1a9, plus: 0xff5a4f, minus: 0x2a2e37, copper: 0xd07a45 };

// ---------------------------------------------------------------- paths and flowing dots
// A polyline sampled by arc length, so dots can travel along it at a steady speed.
export function pathOf(points) {
  const P = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = Math.max(1e-6, L[L.length - 1]);
  return {
    points: P, total,
    at(u, out = new THREE.Vector3()) {
      const d = (((u % 1) + 1) % 1) * total;
      let lo = 0, hi = L.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= d) lo = m; else hi = m; }
      const k = (d - L[lo]) / Math.max(1e-9, L[hi] - L[lo]);
      return out.copy(P[lo]).lerp(P[hi], k);
    },
  };
}
// Dots that stream along a path. step(dt, speed): positive speed runs start → end, negative runs back.
export function flowDots(path, count, color = COL.dc, r = 0.05) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), M.glow(color), count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const u = Float32Array.from({ length: count }, (_, i) => i / count);
  const o = new THREE.Object3D(), p = new THREE.Vector3();
  m.step = (dt, speed) => {
    for (let i = 0; i < count; i++) {
      u[i] = (((u[i] + (dt * speed) / path.total) % 1) + 1) % 1;
      path.at(u[i], p); o.position.copy(p); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };
  m.step(0, 0);
  return m;
}
// A cable drawn along a path.
export const cable = (path, r = 0.035, color = 0x2a2e37) => tube(path.points, r, M.plastic(color, { roughness: 0.6 }), false, Math.max(40, path.points.length * 20));

// ---------------------------------------------------------------- see-through casing
export function casing(w, h, d, color = 0xf2f4f7, o = {}) {
  const mat = M.plastic(color, { transparent: true, opacity: 1, roughness: 0.35, side: THREE.DoubleSide, ...o });
  const m = box(w, h, d, mat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.6 }));
  m.add(edges);
  m.setXray = (on) => { mat.opacity = on ? 0.1 : 1; mat.depthWrite = !on; m.castShadow = !on; };
  return m;
}

// ---------------------------------------------------------------- electronic parts
// A transformer: a laminated iron core (a square ring) with a coil on each side limb.
// Origin at its centre; limbs run along Y; the coils sit on the left (primary) and right (secondary).
export function transformer(s = 1, { primaryTurns = 5, secondaryTurns = 14 } = {}) {
  const g = new THREE.Group();
  const iron = M.metal(0x59606c, { roughness: 0.55, metalness: 0.6 });
  const W = 1.2 * s, H = 1.2 * s, t = 0.3 * s, D = 0.42 * s;
  const top = box(W, t, D, iron); top.position.y = (H - t) / 2;
  const bot = box(W, t, D, iron); bot.position.y = -(H - t) / 2;
  const left = box(t, H - 2 * t, D, iron); left.position.x = -(W - t) / 2;
  const right = box(t, H - 2 * t, D, iron); right.position.x = (W - t) / 2;
  // Laminations: thin lines across the front face.
  const lam = new THREE.Group();
  for (let i = 0; i < 7; i++) { const l = box(W + 0.004, H + 0.004, 0.004, M.matte(0x3a404b)); l.position.z = -D / 2 + ((i + 0.5) * D) / 7; l.scale.set(1, 1, 1); l.castShadow = false; lam.add(l); }
  lam.visible = false;
  g.add(top, bot, left, right, lam);
  const cu = M.metal(COL.copper, { roughness: 0.35, emissive: new THREE.Color(0), emissiveIntensity: 1 });
  const cu2 = M.metal(0xe09a5a, { roughness: 0.35, emissive: new THREE.Color(0), emissiveIntensity: 1 });
  const coil = (x, turns, mat, r) => {
    const c = new THREE.Group();
    const n = turns, hh = (H - 2 * t) * 0.9;
    for (let i = 0; i < n; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, r, 8, 28), mat);
      ring.rotation.x = Math.PI / 2; ring.scale.set(t * 0.5 + r * 2.2, D * 0.5 + r * 2.2, 1);
      ring.position.y = -hh / 2 + ((i + 0.5) * hh) / n; ring.castShadow = true; c.add(ring);
    }
    c.position.x = x; g.add(c); return c;
  };
  const pri = coil(-(W - t) / 2, primaryTurns, cu, 0.05 * s);
  const sec = coil((W - t) / 2, secondaryTurns, cu2, 0.018 * s);
  g.userData = { W, H, D, t };
  return Object.assign(g, { pri, sec, cuP: cu, cuS: cu2, iron });
}

// A power MOSFET in a TO-220 package: black body, metal tab with a hole, three legs.
export function mosfet(s = 1) {
  const g = new THREE.Group();
  const body = box(0.4 * s, 0.36 * s, 0.18 * s, M.plastic(0x1b1e24, { roughness: 0.5 }));
  const tab = box(0.4 * s, 0.26 * s, 0.05 * s, M.metal(0xc9ced8)); tab.position.set(0, 0.3 * s, -0.065 * s);
  g.add(body, tab);
  for (const x of [-0.13, 0, 0.13]) { const leg = box(0.04 * s, 0.3 * s, 0.02 * s, M.metal(0xd8dde6)); leg.position.set(x * s, -0.33 * s, 0); g.add(leg); }
  // A glow plate that shows when the switch is on.
  const lamp = box(0.3 * s, 0.26 * s, 0.01 * s, M.glow(COL.ok, { transparent: true, opacity: 0.0 })); lamp.position.z = 0.1 * s; lamp.castShadow = false; g.add(lamp);
  g.setOn = (k) => { lamp.material.opacity = 0.85 * k; };
  return g;
}

// An aluminium heatsink with fins, lying along X.
export function heatsink(w = 1.2, h = 0.5, fins = 10) {
  const g = new THREE.Group(), al = M.metal(0xb8c0cc, { roughness: 0.4 });
  const base = box(w, h, 0.05, al); g.add(base);
  for (let i = 0; i < fins; i++) { const f = box(0.02, h, 0.22, al); f.position.set(-w / 2 + 0.04 + (i * (w - 0.08)) / (fins - 1), 0, -0.13); g.add(f); }
  return g;
}

// A green circuit board with a chip, a few parts and copper traces.
export function pcb(w = 1.1, d = 0.7) {
  const g = new THREE.Group();
  const board = box(w, 0.03, d, M.plastic(0x1e7a4a, { roughness: 0.6 })); g.add(board);
  const chip = box(0.26, 0.05, 0.26, M.plastic(0x15171c)); chip.position.set(-w * 0.15, 0.04, 0); g.add(chip);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 14), M.plastic(0x2a5dd6)); c.position.set(w * 0.2 + (i % 3) * 0.1, 0.08, -d * 0.25 + Math.floor(i / 3) * 0.18); g.add(c); }
  for (let i = 0; i < 6; i++) { const r = box(0.1, 0.03, 0.035, M.plastic(0xc9a86a)); r.position.set(-w * 0.35 + (i % 2) * 0.14, 0.03, -d * 0.3 + Math.floor(i / 2) * 0.16); g.add(r); }
  const led = sphere(0.03, M.glow(COL.ok)); led.position.set(w * 0.4, 0.04, d * 0.35); g.add(led);
  g.chip = chip;
  return g;
}

// A sealed relay: a small box. (The chapter on switchover builds an open one.)
export function relayBox(s = 1) {
  const g = new THREE.Group();
  const b = box(0.32 * s, 0.26 * s, 0.22 * s, M.plastic(0x2d6fd6, { roughness: 0.35 })); g.add(b);
  return g;
}

// An open relay: coil, iron armature on a hinge, and a moving contact between two fixed contacts.
// setK(k): 0 = resting on the "mains" contact (NC), 1 = pulled onto the "inverter" contact (NO).
export function openRelay(s = 1) {
  const g = new THREE.Group();
  const base = box(1.4 * s, 0.08 * s, 0.6 * s, M.plastic(0x2a2e37)); base.position.y = 0.04 * s; g.add(base);
  const core = rod(-0.45 * s, 0.05 * s, 0.1 * s, 0.1 * s, M.metal(0x59606c)); core.rotation.z = Math.PI / 2; core.position.set(-0.35 * s, 0.35 * s, 0); g.add(core);
  const wind = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.34 * s, 24), M.metal(COL.copper, { roughness: 0.35, emissive: new THREE.Color(0), emissiveIntensity: 1 }));
  wind.position.set(-0.35 * s, 0.3 * s, 0); g.add(wind);
  const yoke = box(0.06 * s, 0.6 * s, 0.26 * s, M.metal(0x59606c)); yoke.position.set(-0.62 * s, 0.35 * s, 0); g.add(yoke);
  // Armature: hinged at the top of the yoke, a plate above the core, with a long spring contact arm.
  const arm = new THREE.Group(); arm.position.set(-0.62 * s, 0.67 * s, 0); g.add(arm);
  const plate = box(0.5 * s, 0.05 * s, 0.24 * s, M.metal(0x7a8394)); plate.position.set(0.28 * s, 0, 0); arm.add(plate);
  const blade = box(0.75 * s, 0.025 * s, 0.08 * s, M.metal(0xd8b25a)); blade.position.set(0.85 * s, 0, 0); arm.add(blade);
  const tip = sphere(0.04 * s, M.metal(0xe8c56a)); tip.position.set(1.22 * s, 0, 0); arm.add(tip);
  // Fixed contacts: upper (mains, normally closed) and lower (inverter, normally open).
  const post = (y) => { const p = box(0.08 * s, 0.08 * s, 0.1 * s, M.metal(0xe8c56a)); p.position.set(0.62 * s, y, 0); g.add(p); return p; };
  const nc = post(0.73 * s), no = post(0.45 * s);
  const mk = (y) => { const b = beam([0.62 * s, y, 0], [0.62 * s, 0.08 * s, 0], 0.015 * s, M.metal(0xe8c56a)); g.add(b); };
  mk(0.45 * s);
  const ncStem = box(0.03 * s, 0.1 * s, 0.03 * s, M.metal(0xe8c56a)); ncStem.position.set(0.62 * s, 0.8 * s, 0); g.add(ncStem);
  const spark = sphere(0.06 * s, M.glow(0xfff2a0, { transparent: true, opacity: 0 })); spark.position.set(0.62 * s, 0.59 * s, 0); g.add(spark);
  // Angles that put the tip (radius 0.04) on each contact: the tip is 1.22·s from the hinge.
  const R = 1.22, aNC = Math.asin((0.65 - 0.67) / R), aNO = Math.asin((0.53 - 0.67) / R);
  g.setK = (k) => { arm.rotation.z = lerp(aNC, aNO, k); };
  g.setK(0);
  return Object.assign(g, { wind, spark, nc, no, arm });
}

// A diode: black body, silver band at the cathode end. Axis along X; cathode at +X.
export function diode(len = 0.5, r = 0.09) {
  const g = new THREE.Group();
  const mat = M.plastic(0x1b1e24, { emissive: new THREE.Color(0), emissiveIntensity: 1 });
  g.add(rod(-len / 2, len / 2, r, r, mat, 20));
  const band = rod(len / 2 - 0.1, len / 2 - 0.04, r * 1.02, r * 1.02, M.metal(0xd8dde6), 20); g.add(band);
  g.add(rod(-len / 2 - 0.2, -len / 2, 0.018, 0.018, M.metal(0xd8dde6), 8), rod(len / 2, len / 2 + 0.2, 0.018, 0.018, M.metal(0xd8dde6), 8));
  g.mat = mat;
  return g;
}

// An electrolytic capacitor standing up: blue can, silver top with a vent cross, a stripe.
export function capacitor(r = 0.35, h = 0.9, color = 0x2a5dd6) {
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), M.plastic(color, { roughness: 0.35 })); can.position.y = h / 2; can.castShadow = true; g.add(can);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, 0.02, 32), M.metal(0xc9ced8)); top.position.y = h + 0.005; g.add(top);
  const stripe = box(r * 0.5, h * 0.9, 0.02, M.plastic(0xd8dde6)); stripe.position.set(0, h / 2, r * 0.99); g.add(stripe);
  // A charge fill inside the glassy can shows how full it is.
  return g;
}

// ---------------------------------------------------------------- the battery
// A tall tubular inverter battery. Origin at the middle of its base; long side along X.
// Six cells in a row, each with a vent cap and a float indicator (the little red/green flag
// that tells you when to top up with distilled water), and two chunky terminals.
export function makeBattery({ W = 2.0, H = 1.76, D = 0.76, color = 0xf2f4f7 } = {}) {
  const g = new THREE.Group();
  const shell = casing(W, H, D, color); shell.position.y = H / 2; g.add(shell);
  const lid = box(W + 0.04, 0.1, D + 0.04, M.plastic(0x2a2e37, { transparent: true, opacity: 1 })); lid.position.y = H + 0.05; g.add(lid);
  lid.setXray = (on) => { lid.material.opacity = on ? 0.25 : 1; lid.material.depthWrite = !on; };
  const band = box(W + 0.01, 0.34, D + 0.01, M.plastic(0xd7263d, { transparent: true, opacity: 1 })); band.position.y = H * 0.62; g.add(band);
  band.setXray = (on) => { band.material.opacity = on ? 0.12 : 1; band.material.depthWrite = !on; };
  // Inside: electrolyte and plates (brown positives, grey negatives) in each of six cells.
  const inner = new THREE.Group(); g.add(inner);
  const cw = (W - 0.1) / 6;
  const acid = box(W - 0.08, H * 0.82, D - 0.08, M.clear(0xbfe3ff, 0.22)); acid.position.y = H * 0.44; acid.castShadow = false; inner.add(acid);
  for (let c = 0; c < 6; c++) {
    const x0 = -W / 2 + 0.05 + c * cw;
    if (c) { const wall = box(0.015, H * 0.9, D - 0.06, M.clear(0xe8eef8, 0.25)); wall.position.set(x0, H * 0.46, 0); wall.castShadow = false; inner.add(wall); }
    for (let p = 0; p < 5; p++) {
      const pos = p % 2 === 1;
      const pl = box(0.025, H * 0.62, D * 0.8, M.matte(pos ? 0x7a4a2a : 0x8a919c)); pl.position.set(x0 + cw * (0.15 + 0.175 * p), H * 0.4, 0); inner.add(pl);
    }
  }
  // Caps with float indicators, and the terminals.
  const floats = [];
  for (let c = 0; c < 6; c++) {
    const x = -W / 2 + 0.05 + (c + 0.5) * cw;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 16), M.plastic(0xffd35a)); cap.position.set(x, H + 0.14, -0.1); g.add(cap);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), M.plastic(0x5ce1a9)); fl.position.set(x, H + 0.22, -0.1); g.add(fl); floats.push(fl);
  }
  const term = (x, col) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.2, 18), M.metal(0x9aa0aa)); t.position.set(x, H + 0.2, D * 0.28); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 18), M.plastic(col)); c.position.set(x, H + 0.13, D * 0.28); g.add(t, c); return t; };
  const plus = term(W / 2 - 0.25, 0xd7263d), minus = term(-W / 2 + 0.25, 0x2a2e37);
  const handle = (x) => { const h = torus(0.14, 0.025, M.plastic(0x2a2e37), 24); h.rotation.x = Math.PI / 2; h.scale.set(1, 0.6, 1); h.position.set(x, H + 0.12, -D * 0.3); g.add(h); };
  handle(-0.45); handle(0.45);
  // A charge gauge on the front face: a bar that can glow from green to red.
  const gaugeBg = box(W * 0.6, 0.12, 0.02, M.plastic(0x1b1e24)); gaugeBg.position.set(0, H * 0.3, D / 2 + 0.012); g.add(gaugeBg);
  const gauge = box(W * 0.58, 0.08, 0.02, M.glow(COL.ok)); gauge.position.set(0, H * 0.3, D / 2 + 0.025); g.add(gauge);
  g.setGauge = (k) => { k = clamp(k, 0.001, 1); gauge.scale.x = k; gauge.position.x = -W * 0.29 * (1 - k); gauge.material.color.setHex(k > 0.5 ? COL.ok : k > 0.2 ? 0xffb547 : COL.hot); };
  g.setXray = (on) => { shell.setXray(on); lid.setXray(on); band.setXray(on); };
  const plusTop = new THREE.Vector3(W / 2 - 0.25, H + 0.3, D * 0.28), minusTop = new THREE.Vector3(-W / 2 + 0.25, H + 0.3, D * 0.28);
  return Object.assign(g, { shell, lid, band, inner, acid, floats, plus, minus, plusTop, minusTop, W, H, D });
}

// ---------------------------------------------------------------- the home inverter
// Origin at the middle of its base; front (display) faces +Z; long side along X.
export function makeInverter({ W = 1.5, H = 1.15, D = 0.7 } = {}) {
  const g = new THREE.Group();
  const shell = casing(W, H, D, 0xe9edf3); shell.position.y = H / 2; g.add(shell);
  // Front display: a small screen that says what it is doing.
  const screen = canvasTexture(256, 96, (c, w, h, text = 'MAINS', sub = 'CHARGING', col = '#5ce1a9') => {
    c.fillStyle = '#0b1a14'; c.fillRect(0, 0, w, h); c.fillStyle = col; c.font = 'bold 40px monospace'; c.fillText(text, 16, 46); c.font = '24px monospace'; c.fillText(sub, 16, 82);
  });
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.21), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  disp.position.set(-W * 0.18, H * 0.72, D / 2 + 0.006); g.add(disp);
  const led = sphere(0.04, M.glow(COL.ok)); led.position.set(W * 0.2, H * 0.72, D / 2 + 0.01); g.add(led);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 18), M.plastic(0x2a2e37)); knob.rotation.x = Math.PI / 2; knob.position.set(W * 0.34, H * 0.72, D / 2 + 0.02); g.add(knob);

  // Inside: the heavy transformer, the MOSFET bank on a heatsink, the control board, relay, fan.
  const tr = transformer(0.62 * W / 1.5, { primaryTurns: 4, secondaryTurns: 10 }); tr.position.set(-W * 0.22, 0.42 * W / 1.5, -0.02); g.add(tr);
  const hs = heatsink(0.62, 0.36, 8); hs.position.set(W * 0.22, 0.3, -D * 0.15); g.add(hs);
  const fets = new THREE.Group(); hs.add(fets);
  for (let i = 0; i < 4; i++) { const f = mosfet(0.55); f.position.set(-0.22 + i * 0.145, 0.02, 0.07); fets.add(f); }
  const board = pcb(0.62, 0.34); board.position.set(W * 0.22, 0.72, 0.05); g.add(board);
  const relay = relayBox(0.8); relay.position.set(W * 0.22, 0.2, D * 0.25); g.add(relay);
  const fanRing = torus(0.17, 0.02, M.plastic(0x2a2e37), 24); fanRing.position.set(W * 0.36, H * 0.45, -D / 2 + 0.03); g.add(fanRing);
  const fan = new THREE.Group(); fan.position.copy(fanRing.position);
  for (let i = 0; i < 5; i++) { const b = box(0.14, 0.05, 0.01, M.plastic(0x3a404d)); b.position.x = 0.08; const h = new THREE.Group(); h.rotation.z = (i / 5) * Math.PI * 2; b.rotation.x = 0.4; h.add(b); fan.add(h); }
  g.add(fan);
  const sock = box(0.3, 0.2, 0.03, M.plastic(0xf7f8fa)); sock.position.set(W * 0.5 + 0.015, H * 0.3, 0); sock.rotation.y = Math.PI / 2; g.add(sock);
  return Object.assign(g, { shell, screen, led, tr, hs, fets, board, relay, fan, fanRing, W, H, D });
}

// A small computer UPS (600 VA line-interactive or offline type). Origin at base centre; front +Z.
export function makeUPS({ W = 0.5, H = 0.7, D = 1.25 } = {}) {
  const g = new THREE.Group();
  const shell = casing(W, H, D, 0x23262f, { roughness: 0.4 }); shell.position.y = H / 2; g.add(shell);
  shell.material.color.setHex(0x2a2e37);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 18), M.plastic(0x3a404d)); btn.rotation.x = Math.PI / 2; btn.position.set(0, H * 0.7, D / 2 + 0.015); g.add(btn);
  const led = sphere(0.025, M.glow(COL.ok)); led.position.set(0, H * 0.45, D / 2 + 0.01); g.add(led);
  // Its own little sealed battery: 12 V 7 Ah (151 × 65 × 94 mm), a small transformer and a board.
  const batt = box(W * 0.62, H * 0.6, D * 0.45, M.plastic(0x1b1e24)); batt.position.set(0, H * 0.33, D * 0.18); g.add(batt);
  const bl = box(W * 0.64, 0.12, 0.02, M.plastic(0x2a5dd6)); bl.position.set(0, H * 0.45, D * 0.18 + D * 0.225 + 0.012); g.add(bl);
  const tr = transformer(0.3, { primaryTurns: 3, secondaryTurns: 7 }); tr.rotation.y = Math.PI / 2; tr.position.set(0, H * 0.28, -D * 0.25); g.add(tr);
  const board = pcb(W * 0.8, 0.3); board.position.set(0, H * 0.78, -D * 0.2); g.add(board);
  for (const z of [-0.12, 0.12]) { const s = box(0.16, 0.12, 0.02, M.plastic(0x1b1e24)); s.position.set(0, H * 0.5, -D / 2 - 0.012 + z * 0); s.position.x = z; g.add(s); }
  return Object.assign(g, { shell, batt, tr, board, led, W, H, D });
}

// ---------------------------------------------------------------- things it powers
// A bulb: glass sphere that glows, on a base. Origin at the base.
export function bulb(r = 0.18) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.5, r * 0.8, 16), M.metal(0xc9ced8)); base.position.y = r * 0.4; g.add(base);
  const glass = sphere(r, new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: new THREE.Color(0xfff0b0), emissiveIntensity: 1, roughness: 0.3 }));
  glass.position.y = r * 0.8 + r * 0.85; g.add(glass);
  g.setOn = (k) => { glass.material.emissiveIntensity = 0.05 + 1.6 * k; glass.material.color.setHex(k > 0.1 ? 0xfff6d8 : 0x9aa0aa); };
  return g;
}
// A small ceiling fan hanging from a rod. Origin at the ceiling mount; blades spin about Y.
export function ceilingFan(R = 0.9, bladeColor = 0xe8d7b8) {
  const g = new THREE.Group();
  const down = rod(-0.35, 0, 0.025, 0.025, M.metal(0xc9ced8), 10); down.rotation.z = Math.PI / 2; down.position.set(0, -0.175, 0); g.add(down);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 24), M.plastic(0x8a6a4a)); motor.position.y = -0.42; g.add(motor);
  const spin = new THREE.Group(); spin.position.y = -0.44; g.add(spin);
  for (let i = 0; i < 3; i++) { const b = box(R, 0.015, 0.16, M.plastic(bladeColor)); b.position.x = R / 2 + 0.12; b.rotation.x = 0.12; const h = new THREE.Group(); h.rotation.y = (i / 3) * Math.PI * 2; h.add(b); spin.add(h); }
  return Object.assign(g, { spin });
}
// A flat TV on a stand. Origin at base centre; screen faces +Z.
export function tv(w = 1.3) {
  const g = new THREE.Group(), h = w * 0.58;
  const frame = box(w, h, 0.06, M.plastic(0x15171c)); frame.position.y = 0.2 + h / 2; g.add(frame);
  const scr = box(w * 0.94, h * 0.9, 0.01, new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: new THREE.Color(0x3a7bd5), emissiveIntensity: 0.9 })); scr.position.set(0, 0.2 + h / 2, 0.035); g.add(scr);
  const st = box(0.35, 0.03, 0.2, M.plastic(0x15171c)); st.position.y = 0.015; const neck = box(0.05, 0.2, 0.04, M.plastic(0x15171c)); neck.position.y = 0.1; g.add(st, neck);
  g.setOn = (k) => { scr.material.emissiveIntensity = 0.9 * k; };
  return g;
}
// A Wi-Fi router with two antennas and a blinking light.
export function router() {
  const g = new THREE.Group();
  const b = box(0.55, 0.1, 0.36, M.plastic(0xf2f4f7)); b.position.y = 0.05; g.add(b);
  for (const x of [-0.2, 0.2]) { const a = rod(0, 0.4, 0.02, 0.015, M.plastic(0x2a2e37), 8); a.rotation.z = Math.PI / 2; a.position.set(x, 0.3, -0.15); g.add(a); }
  const led = sphere(0.02, M.glow(COL.ok)); led.position.set(0.12, 0.1, 0.18); g.add(led);
  g.setOn = (k, t = 0) => { led.visible = k > 0.1 && Math.sin(t * 13) > -0.3; };
  return g;
}
// A PC tower and a monitor. Origin at base centre; front faces +Z.
export function pc() {
  const g = new THREE.Group();
  const tower = box(0.5, 1.1, 1.1, M.plastic(0x23262f)); tower.position.set(0.95, 0.55, 0); g.add(tower);
  const pl = sphere(0.025, M.glow(0x8ef0ff)); pl.position.set(0.95, 0.95, 0.56); g.add(pl);
  const mon = box(1.4, 0.85, 0.06, M.plastic(0x15171c)); mon.position.set(-0.25, 0.95, 0); g.add(mon);
  const scr = box(1.32, 0.77, 0.01, new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: new THREE.Color(0x3a7bd5), emissiveIntensity: 1 })); scr.position.set(-0.25, 0.95, 0.035); g.add(scr);
  const st = box(0.4, 0.03, 0.25, M.plastic(0x15171c)); st.position.set(-0.25, 0.015, 0); const neck = box(0.06, 0.52, 0.04, M.plastic(0x15171c)); neck.position.set(-0.25, 0.27, -0.02); g.add(st, neck);
  g.setOn = (k) => { scr.material.emissiveIntensity = 1 * k; pl.visible = k > 0.5; };
  return g;
}

// ---------------------------------------------------------------- boards
// A flat board carrying a canvas, facing +Z.
export function board(stage, root, w, h, pxW, pxH, draw, pos) {
  const tex = canvasTexture(pxW, pxH, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex.tex, transparent: true, toneMapped: false }));
  m.position.set(...pos); root.add(m);
  return Object.assign(tex, { mesh: m });
}
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h); }

// A workbench: the model sits on it and the chart stands in front of it, below the model,
// so the readout in the stage's upper-left corner never hides the chart.
export function bench(w, d, y) {
  const g = new THREE.Group();
  const top = box(w, 0.1, d, M.matte(0x3a3f4b, { roughness: 0.7 })); top.position.y = y - 0.05; g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = box(0.1, y - 0.1, 0.1, M.metal(0x4a505c)); l.position.set(sx * (w / 2 - 0.15), (y - 0.1) / 2, sz * (d / 2 - 0.15)); g.add(l); }
  return g;
}
