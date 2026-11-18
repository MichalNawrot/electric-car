/* Chapter 7 — The battery: inside a cell, voltage vs charge, internal resistance, series/parallel, chemistries, ageing. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, { clamp } = P;
  const TAU = Math.PI * 2;
  const CELLS = {
    nmc: { name: '2170 NMC', v: 3.72, ah: 4.76, kg: 0.069, vmax: 4.2, chem: 'NMC', imax: 30 },
    lfp: { name: 'LFP prismatic', v: 3.2, ah: 184, kg: 3.6, vmax: 3.65, chem: 'LFP', imax: 500 },
    c4680: { name: '4680 NMC', v: 3.7, ah: 23.5, kg: 0.355, vmax: 4.2, chem: 'NMC', imax: 120 },
  };

  EV.chapter({
    id: 'battery', n: '7', title: 'The battery', color: 's1',
    blurb: 'How lithium ions shuttle between two electrodes, why voltage sags under load, how 4,416 small cells become one pack, and what makes a battery age.',
    lead: 'The pack is the heaviest, most expensive and most misunderstood part of the car. Inside it there is no combustion and nothing moves except lithium ions, a few thousandths of a millimetre at a time.',
    html(car) {
      const V = car.s * car.cellV, R = P.packR(car), full = P.packAtPower(car, 0.8, car.pPeak / 0.93);
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>A lithium-ion cell stores energy by holding lithium in the electrode where it has <strong>higher energy</strong> (the anode). Discharging lets it move to where its energy is lower (the cathode); the difference comes out as electrical work.</li>
        <li>Ions travel inside the cell, electrons travel outside through the circuit. One electron per lithium ion.</li>
        <li>Cell voltage depends on how full the electrodes are, and it <strong>sags under load</strong> because of internal resistance: ${M`V = V_{oc} - I R`}.</li>
        <li>Cells in <strong>series</strong> add voltage. Cells in <strong>parallel</strong> add capacity. The pack is both.</li>
        <li>Batteries age from time and from use. Heat, high state of charge and fast charging in the cold are what hurt most.</li>
      </ul></div>

      <h2><span class="n">7.1</span>Inside a cell</h2>
      <p>Every cell has the same four parts. Two <em class="t">electrodes</em> that can absorb lithium: a graphite <em class="t">anode</em> and a metal-oxide or iron-phosphate <em class="t">cathode</em>. A liquid <em class="t">electrolyte</em> that lets lithium ions through but not electrons. And a porous plastic <em class="t">separator</em> that stops the electrodes touching.</p>
      <p>Lithium sits more comfortably in the cathode than in graphite: it is at lower energy there. Charging forces it uphill into the graphite. Discharging lets it run back down. But a lithium <em>atom</em> cannot cross the electrolyte. It must leave its outer electron behind and travel as an ion, Li⁺. The stranded electron takes the only other route, through the external circuit, and does work on the way. That detour is the entire point of a battery.</p>
      <div data-fig="cell"></div>
      <p>The lithium is never consumed. It slides in and out of gaps in the crystal structure of each electrode, a process called <em class="t">intercalation</em>, which is why the cell can be cycled thousands of times. The amount of charge that moves is the <em class="t">capacity</em>, measured in ampere-hours; multiplied by the voltage it gives energy: ${M`E = V \cdot Q`}. One ${car.chem === 'LFP' ? 'prismatic LFP' : '2170'} cell holds about ${fmt(car.cellV * car.cellAh, car.chem === 'LFP' ? 0 : 1)} Wh.</p>

      <h2><span class="n">7.2</span>Voltage, state of charge and sag</h2>
      <p>As lithium fills the cathode and empties the anode, the energy difference between the two sides shrinks. The cell's resting voltage, the <em class="t">open-circuit voltage</em>, therefore falls as the cell discharges. The shape of that curve is a fingerprint of the chemistry.</p>
      <p>Draw current and the terminal voltage drops further. Ions take effort to push through the electrolyte and into the electrodes, and that shows up as an <em class="t">internal resistance</em>:</p>
      ${eq(String.raw`V = V_{oc}(\text{SoC}) - I \cdot R \quad\quad P_{heat} = I^2 R`, '<b>V<sub>oc</sub></b> open-circuit voltage · <b>I</b> current, positive when discharging · <b>R</b> internal resistance, about ' + fmt(R * 1000) + ' mΩ for this pack when warm')}
      <div data-fig="ocv"></div>
      <p>Two consequences matter every day. First, <strong>peak power depends on charge and temperature</strong>. A cold or nearly empty pack has less voltage to give and more resistance, so the car limits acceleration. At full throttle the ${car.name} draws about ${fmt(full.I)} A, the pack voltage sags by ${fmt(full.V0 - full.V)} V, and ${fmt(full.heat / 1000)} kW of heat appears inside the cells. Second, the resistance works in both directions: when charging, the terminal voltage is <em>higher</em> than the resting voltage, which is one reason fast charging must slow down as the cells approach their voltage ceiling (Chapter 8).</p>
      <div class="callout y"><h5>Why LFP cars ask to be charged to 100%</h5><p>The RWD model's iron-phosphate cells have an almost flat voltage curve between 20% and 90%. The car cannot tell 40% from 70% by voltage alone. It estimates charge by counting the current that has gone in and out, and that count drifts. A full charge takes the cells to the steep end of the curve, where voltage is a reliable reading again, and resets the estimate.</p></div>

      <h2><span class="n">7.3</span>From cell to pack: series and parallel</h2>
      <p>One cell gives under 4 V and a few amps. The motor wants ${fmt(V)} V and hundreds of amps. Two connection rules get there:</p>
      <ul>
        <li><strong>Series</strong>: plus to minus in a chain. Voltages add, capacity stays that of one cell. A chain is only as good as its weakest link.</li>
        <li><strong>Parallel</strong>: plus to plus, minus to minus. Capacities and currents add, voltage stays that of one cell.</li>
      </ul>
      <p>The ${car.name} pack is written <strong>${car.s}s${car.p}p</strong>: ${car.p > 1 ? `${car.p} cells in parallel form a "brick" that behaves like one big cell, and ${car.s} bricks in series make up the voltage. That is ${fmt(car.s * car.p)} cells in all.` : `${car.s} large cells in a single series chain.`} Build it yourself.</p>
      <div data-fig="pack"></div>
      <p>The energy is always cells × volts × amp-hours, however they are arranged. What the arrangement decides is the split between voltage and current. Chapter 6 showed why that split is pushed toward voltage.</p>

      <h2><span class="n">7.4</span>Two chemistries</h2>
      <p>The Model Y uses two families of cathode. The trade-offs between them explain why the versions of the car behave differently.</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th></th><th>NMC / NCA (nickel-based)</th><th>LFP (iron phosphate)</th></tr></thead>
        <tbody>
          <tr><td>Used in</td><td>Long Range, Performance</td><td>RWD</td></tr>
          <tr><td>Nominal cell voltage</td><td>3.6–3.7 V</td><td>3.2 V</td></tr>
          <tr><td>Energy per kg of cell</td><td>about 240–280 Wh/kg</td><td>about 150–190 Wh/kg</td></tr>
          <tr><td>Cycle life to 80% capacity</td><td>roughly 1,000–2,000 full cycles</td><td>roughly 3,000–6,000 full cycles</td></tr>
          <tr><td>Raw materials</td><td>nickel, cobalt: costly</td><td>iron, phosphate: cheap and abundant</td></tr>
          <tr><td>Thermal stability</td><td>needs more protection</td><td>very stable, hard to ignite</td></tr>
          <tr><td>In the cold</td><td>loses some power and charge rate</td><td>loses more of both</td></tr>
          <tr><td>Voltage curve</td><td>sloped: charge level easy to read</td><td>flat: charge level hard to read</td></tr>
          <tr><td>Recommended daily charge limit</td><td>about 80%</td><td>100%</td></tr>
        </tbody></table></div>
      <p>Nickel chemistry packs more energy into each kilogram, so it goes where range and performance matter. Iron phosphate is heavier for the same energy but cheaper, longer-lived and happier sitting full.</p>

      <h2><span class="n">7.5</span>Why batteries age</h2>
      <p>A lithium-ion cell slowly loses capacity through side reactions that permanently trap lithium. Two clocks run at once.</p>
      <ul>
        <li><strong>Calendar ageing</strong> happens even when the car is parked. Electrolyte reacts at the graphite surface and thickens a film called the SEI, consuming lithium. It runs faster when the cell is hot and when it is full. It also slows down with time, roughly as the square root of age, because the film protects what lies beneath it.</li>
        <li><strong>Cycle ageing</strong> comes from use. Electrode particles swell and shrink with every cycle and slowly crack. Charging too fast, especially when cold, can deposit metallic lithium on the graphite instead of inserting it (<em class="t">lithium plating</em>), which is lost for good.</li>
      </ul>
      <div data-fig="aging"></div>
      <p>The practical rules follow directly from the chemistry: keep a nickel-based pack between about 20% and 80% for daily use, avoid leaving it full in the heat, and let the car warm the battery before fast charging. In the fleet data Tesla publishes, packs retain roughly 85% of their capacity after 300,000 km.</p>

      <h2><span class="n">7.6</span>The battery management system</h2>
      <p>No cell is ever connected to the car without supervision. The battery management system (BMS) measures every brick's voltage, dozens of temperatures and the pack current, many times a second, and uses them to:</p>
      <ul>
        <li><strong>Estimate state of charge</strong>, by integrating current (coulomb counting) and correcting against the voltage curve when the car rests.</li>
        <li><strong>Set power limits</strong> for discharge, regeneration and charging, from temperature and charge level. These are the limits you feel as reduced power or reduced regen on a cold morning.</li>
        <li><strong>Balance the cells</strong>, bleeding a little charge from the fullest bricks so that all reach the top together.</li>
        <li><strong>Protect</strong>: open the contactors if any cell goes outside its safe voltage or temperature window.</li>
      </ul>`;
    },

    init(root, car) {
      /* ------------------------------------------------------------- cell -- */
      const f = EV.fig(root, 'cell', { side: true, title: 'A lithium-ion cell at work', hint: 'Violet dots are lithium ions crossing the electrolyte. Blue dots are electrons, which must go round the outside.',
        cap: '<b>What to look for.</b> Ions and electrons always leave the same electrode and arrive at the same electrode, by different routes. Switch to charging and both reverse.' });
      const C = EV.canvas(f.stage, { ratio: 0.62, minH: 300, maxH: 400, label: 'Cross-section of a lithium-ion cell with ions moving between anode and cathode' });
      const R = EV.readouts(f.out, { soc: ['State of charge', '%'], v: ['Cell voltage', 'V'], ocv: ['Resting voltage', 'V'], i: ['Current', 'A'] });
      const COLS = 5, ROWS = 9, N = COLS * ROWS;
      const ions = [], electrons = [];
      for (let i = 0; i < N; i++) ions.push({ side: i < N * 0.8 ? 'a' : 'c', site: i, x: 0, y: 0, moving: false });
      let acc = 0;
      const s = EV.controls(f.ctl, {
        mode: { type: 'seg', label: 'The cell is', options: [['d', 'Discharging'], ['r', 'Resting'], ['c', 'Charging']], value: 'd' },
        rate: { label: 'Rate', min: 0.2, max: 3, step: 0.1, value: 1, unit: 'C' },
      }, () => {});
      const reset = EV.el('<button type="button" class="btn">Reset to 80%</button>');
      reset.addEventListener('click', () => ions.forEach((q, i) => { q.side = i < N * 0.8 ? 'a' : 'c'; q.site = i; q.moving = false; }));
      f.ctl.appendChild(reset);
      function draw(t, dt) {
        const { ctx, w, h } = C, col = EV.col;
        const top = 78, bot = h - 34, xa0 = w * 0.1, xa1 = w * 0.4, xc0 = w * 0.6, xc1 = w * 0.9, wy = 30;
        const siteXY = (side, k) => { const c = k % COLS, r = Math.floor(k / COLS), x0 = side === 'a' ? xa0 : xc0, x1 = side === 'a' ? xa1 : xc1; return [x0 + (x1 - x0) * (c + 0.5) / COLS, top + (bot - top) * (r + 0.5) / ROWS]; };
        const count = (side) => ions.filter((q) => q.side === side).length;
        const soc = count('a') / N, dir = s.mode === 'd' ? 1 : s.mode === 'c' ? -1 : 0;
        // launch ions
        if (dir && dt > 0) {
          acc += dt * s.rate * 1.6;
          const from = dir > 0 ? 'a' : 'c', to = dir > 0 ? 'c' : 'a';
          while (acc >= 1) {
            acc -= 1;
            const cand = ions.filter((q) => q.side === from && !q.moving);
            if (!cand.length) break;
            // the ion nearest the separator leaves first
            cand.sort((p, q) => (from === 'a' ? (q.site % COLS) - (p.site % COLS) : (p.site % COLS) - (q.site % COLS)));
            const ion = cand[Math.floor(Math.random() * Math.min(4, cand.length))];
            const used = new Set(ions.filter((q) => q.side === to).map((q) => q.site));
            const free = []; for (let k = 0; k < N; k++) if (!used.has(k)) free.push(k);
            free.sort((p, q) => (to === 'c' ? (p % COLS) - (q % COLS) : (q % COLS) - (p % COLS)));
            ion.site = free[Math.floor(Math.random() * Math.min(5, free.length))]; ion.side = to; ion.moving = true;
            electrons.push({ u: 0, dir });
          }
        }
        ctx.clearRect(0, 0, w, h);
        // electrolyte, electrodes, collectors
        EV.rr(ctx, xa0 - 14, top - 10, xc1 - xa0 + 28, bot - top + 20, 10); ctx.fillStyle = EV.rgba('s7', 0.07); ctx.fill();
        ctx.fillStyle = EV.rgba('ink', 0.08); ctx.fillRect(xa0, top, xa1 - xa0, bot - top);
        ctx.fillStyle = EV.rgba('s1', 0.1); ctx.fillRect(xc0, top, xc1 - xc0, bot - top);
        ctx.strokeStyle = EV.rgba('ink', 0.22); ctx.lineWidth = 1.5;
        for (let r = 0; r <= ROWS; r++) { const y = top + (bot - top) * r / ROWS; ctx.beginPath(); ctx.moveTo(xa0, y); ctx.lineTo(xa1, y); ctx.stroke(); }   // graphite layers
        ctx.strokeStyle = EV.rgba('s1', 0.3);
        for (let r = 0; r <= ROWS; r++) { const y = top + (bot - top) * r / ROWS; ctx.beginPath(); ctx.moveTo(xc0, y); ctx.lineTo(xc1, y); ctx.stroke(); }
        for (let c = 0; c <= COLS; c++) { const x = xc0 + (xc1 - xc0) * c / COLS; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }   // oxide lattice
        ctx.fillStyle = col('s2'); ctx.fillRect(xa0 - 14, top - 10, 9, bot - top + 20);          // copper collector
        ctx.fillStyle = col('rim'); ctx.fillRect(xc1 + 5, top - 10, 9, bot - top + 20);          // aluminium collector
        ctx.setLineDash([5, 5]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, top - 6); ctx.lineTo(w / 2, bot + 6); ctx.stroke(); ctx.setLineDash([]);
        // external circuit
        const xa = xa0 - 9.5, xc = xc1 + 9.5, path = [[xa, top - 10], [xa, wy], [xc, wy], [xc, top - 10]], L = (top - 10 - wy) * 2 + (xc - xa);
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        EV.rr(ctx, w / 2 - 62, wy - 15, 124, 30, 8); ctx.fillStyle = col('surface'); ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
        EV.text(ctx, dir > 0 ? 'motor: work out' : dir < 0 ? 'charger: work in' : 'circuit open', w / 2, wy + 4.5, { size: 12, weight: 600, align: 'center', color: col('ink') });
        const at = (u) => { let d = u * L; const segs = [top - 10 - wy, xc - xa, top - 10 - wy]; for (let i = 0; i < 3; i++) { if (d <= segs[i] || i === 2) { const a = path[i], b = path[i + 1], q = clamp(d / segs[i], 0, 1); return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; } d -= segs[i]; } };
        for (let i = electrons.length - 1; i >= 0; i--) {
          const e = electrons[i]; e.u += dt * 0.55;
          if (e.u >= 1) { electrons.splice(i, 1); continue; }
          const [x, y] = at(e.dir > 0 ? e.u : 1 - e.u);
          if (Math.abs(x - w / 2) < 62 && y < wy + 16) continue;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = col('s1'); ctx.fill();
        }
        // ions
        for (const q of ions) {
          const [tx, ty] = siteXY(q.side, q.site);
          if (!q.moving) { q.x = tx; q.y = ty; }                         // resting ions sit exactly on their lattice site, at any canvas size
          else {
            const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy), sp = 150 * dt;
            if (d <= sp + 0.5) { q.x = tx; q.y = ty; q.moving = false; } else { q.x += dx / d * sp; q.y += dy / d * sp + Math.sin(t * 9 + q.site) * 0.5 * (dt > 0 ? 1 : 0); }
          }
          ctx.beginPath(); ctx.arc(q.x, q.y, Math.min(7, (bot - top) / ROWS * 0.3), 0, TAU); ctx.fillStyle = col('s7'); ctx.fill();
        }
        // labels
        EV.text(ctx, 'Anode: graphite', (xa0 + xa1) / 2, bot + 24, { size: 12, weight: 600, align: 'center', color: col('ink') });
        EV.text(ctx, `Cathode: ${car.chem === 'LFP' ? 'iron phosphate' : 'nickel oxide'}`, (xc0 + xc1) / 2, bot + 24, { size: 12, weight: 600, align: 'center', color: col('ink') });
        EV.text(ctx, 'separator', w / 2, bot + 24, { size: 11, align: 'center', color: col('muted') });
        EV.text(ctx, '−', xa - 16, wy + 6, { size: 18, weight: 700, align: 'center', color: col('ink') });
        EV.text(ctx, '+', xc + 16, wy + 6, { size: 16, weight: 700, align: 'center', color: col('ink') });
        if (dir) { const x0 = w / 2 - dir * 24, x1 = w / 2 + dir * 24, ya = (top + bot) / 2; EV.arrow(ctx, x0, ya, x1, ya, col('s7'), 2.5, 8); EV.text(ctx, 'Li⁺', w / 2, ya - 9, { size: 11.5, align: 'center', color: col('ink-2'), halo: true }); }
        if (dir) EV.text(ctx, dir > 0 ? 'electrons →' : '← electrons', w * 0.25, wy - 8, { size: 11.5, align: 'center', color: col('ink-2') });
        const ocv = P.cellOcv(car.chem, soc), I = dir * s.rate * car.cellAh, v = ocv - I * car.cellR;
        if (dt > 0 || t === 0) R({ soc: fmt(soc * 100), v: fmt(v, 2), ocv: fmt(ocv, 2), i: (I > 0 ? '−' : I < 0 ? '+' : '') + fmt(Math.abs(I), car.cellAh > 50 ? 0 : 1) });
        if (soc <= 0 && dir > 0) EV.text(ctx, 'Empty: all the lithium is in the cathode', w / 2, h - 2, { size: 11.5, align: 'center', color: col('ink-2') });
        if (soc >= 1 && dir < 0) EV.text(ctx, 'Full: the graphite can hold no more', w / 2, h - 2, { size: 11.5, align: 'center', color: col('ink-2') });
      }
      C.draw = () => draw(0, 0); draw(0, 0); EV.loop(C.cv, draw);

      /* -------------------------------------------------------------- OCV -- */
      const g = EV.fig(root, 'ocv', { side: true, title: 'Resting voltage and voltage under load', hint: `Top: one cell of each chemistry at rest. Bottom: the whole ${car.name} pack, at rest and with the power you choose.`,
        cap: '<b>Try this.</b> Ask for full power at 10% charge and −10 °C. The voltage collapses and the pack turns a large share of its output into heat. That is why the car limits power when cold or nearly empty.' });
      const p1 = EV.plot(g.stage, { h: 210, x: { label: '', min: 0, max: 100, unit: '%' }, y: { label: 'Cell voltage at rest (V)', min: 2.4, max: 4.4, unit: 'V' }, table: false });
      const p2 = EV.plot(g.stage, { h: 250, x: { label: 'State of charge (%)', min: 0, max: 100, unit: '%' }, y: { label: 'Pack voltage (V)', min: 'auto', max: 'auto', unit: 'V' } });
      const GR = EV.readouts(g.out, { i: ['Pack current', 'A'], v: ['Terminal voltage', 'V'], sag: ['Sag from rest', 'V'], heat: ['Heat inside the pack', 'kW', 's2'], eta: ['Share of energy delivered', '%'], c: ['Rate', 'C'] });
      const gs = EV.controls(g.ctl, {
        soc: { label: 'State of charge', min: 2, max: 100, step: 1, value: 60, unit: '%' },
        pw: { label: 'Power: discharge (+) / charge (−)', min: -250, max: Math.round(car.pPeak / 0.93 / 1000 / 10) * 10, step: 10, value: 100, unit: 'kW' },
        temp: { label: 'Battery temperature', min: -20, max: 45, step: 1, value: 25, unit: '°C' },
      }, gUpd);
      function gUpd() {
        const soc = gs.soc / 100, Pw = gs.pw * 1000, st = P.packAtPower(car, soc, Pw, gs.temp);
        p1.set({
          series: [{ name: 'NMC (nickel)', color: 's1', pts: EV.sample((x) => P.cellOcv('NMC', x / 100), 0, 100, 100), w: car.chem === 'NMC' ? 3 : 1.6 }, { name: 'LFP (iron phosphate)', color: 's2', pts: EV.sample((x) => P.cellOcv('LFP', x / 100), 0, 100, 100), w: car.chem === 'LFP' ? 3 : 1.6 }],
          vlines: [{ x: gs.soc }], points: [{ x: gs.soc, y: P.cellOcv(car.chem, soc), color: car.chem === 'NMC' ? 's1' : 's2', label: `${fmt(P.cellOcv(car.chem, soc), 2)} V` }],
        });
        const load = EV.sample((x) => { const q = P.packAtPower(car, x / 100, Pw, gs.temp); return q.ok ? q.V : null; }, 1, 100, 99);
        p2.set({
          series: [{ name: 'At rest', color: 'muted', dash: true, pts: EV.sample((x) => P.packOcv(car, x / 100), 0, 100, 100) }, { name: `At ${fmt(Math.abs(gs.pw))} kW ${gs.pw >= 0 ? 'discharge' : 'charge'}`, color: 's1', pts: load }],
          vlines: [{ x: gs.soc }], points: st.ok ? [{ x: gs.soc, y: st.V, color: 's1', label: `${fmt(st.V)} V` }] : [],
        });
        GR({ i: st.ok ? fmt(st.I) : 'too much', v: st.ok ? fmt(st.V) : '–', sag: st.ok ? fmt(st.V0 - st.V) : '–', heat: st.ok ? fmt(st.heat / 1000, 1) : '–', eta: st.ok ? fmt(Pw >= 0 ? Pw / (Pw + st.heat) * 100 : (1 - st.heat / (-Pw)) * 100, 1) : '–', c: st.ok ? fmt(Math.abs(st.I) / P.packAh(car), 1) : '–' });
      }
      gUpd();

      /* ------------------------------------------------------------- pack -- */
      const k = EV.fig(root, 'pack', { side: true, title: 'Pack builder', hint: 'Each column is one group of cells in parallel. Columns are chained in series from left to right.',
        cap: `<b>Try this.</b> Keep the number of cells about the same and trade series for parallel. Energy stays put; voltage and current swap. Then press the button to load the real ${car.name} layout.` });
      const KC = EV.canvas(k.stage, { ratio: 0.42, minH: 220, maxH: 300, label: 'Grid of battery cells arranged in series and parallel' });
      const KR = EV.readouts(k.out, { n: ['Cells', ''], v: ['Nominal voltage', 'V'], vmax: ['Voltage when full', 'V'], ah: ['Capacity', 'Ah'], e: ['Energy', 'kWh'], m: ['Mass of cells', 'kg'], i: ['Current for 250 kW', 'A'] });
      const ks = EV.controls(k.ctl, {
        cell: { type: 'seg', label: 'Cell type', options: Object.entries(CELLS).map(([key, c]) => [key, c.name]), value: car.chem === 'LFP' ? 'lfp' : 'nmc' },
        s: { label: 'In series', min: 1, max: 220, step: 1, value: car.s },
        p: { label: 'In parallel', min: 1, max: 80, step: 1, value: car.p },
      }, kUpd);
      const real = EV.el(`<button type="button" class="btn">Load the ${car.name} pack · ${car.s}s${car.p}p</button>`);
      real.addEventListener('click', () => { ks.set('cell', car.chem === 'LFP' ? 'lfp' : 'nmc', true); ks.set('s', car.s, true); ks.set('p', car.p); });
      k.ctl.appendChild(real);
      function kUpd() {
        const c = CELLS[ks.cell], n = ks.s * ks.p, v = ks.s * c.v;
        KR({ n: fmt(n), v: fmt(v), vmax: fmt(ks.s * c.vmax), ah: fmt(ks.p * c.ah), e: fmt(n * c.v * c.ah / 1000, 1), m: fmt(n * c.kg), i: fmt(250e3 / v) });
        kDraw();
      }
      function kDraw() {
        const { ctx, w, h } = KC, col = EV.col, m = 26, aw = w - 2 * m, ah = h - 88;
        ctx.clearRect(0, 0, w, h);
        const pitch = Math.min(aw / ks.s, ah / ks.p, 26), gw = pitch * ks.s, gh = pitch * ks.p, x0 = (w - gw) / 2, y0 = 34 + (ah - gh) / 2, r = Math.max(0.7, pitch * 0.38);
        ctx.fillStyle = EV.rgba('s1', 0.08); EV.rr(ctx, x0 - 6, y0 - 6, gw + 12, gh + 12, 6); ctx.fill();
        ctx.fillStyle = col('s1');
        if (pitch >= 2.2) { for (let i = 0; i < ks.s; i++) for (let j = 0; j < ks.p; j++) { ctx.beginPath(); ctx.arc(x0 + (i + 0.5) * pitch, y0 + (j + 0.5) * pitch, r, 0, TAU); ctx.fill(); } }
        else { ctx.globalAlpha = 0.7; ctx.fillRect(x0, y0, gw, gh); ctx.globalAlpha = 1; }
        if (pitch >= 7) { ctx.strokeStyle = EV.rgba('ink', 0.35); ctx.lineWidth = 1; for (let i = 0; i < ks.s; i++) { ctx.beginPath(); ctx.moveTo(x0 + (i + 0.5) * pitch, y0 + pitch * 0.5); ctx.lineTo(x0 + (i + 0.5) * pitch, y0 + gh - pitch * 0.5); ctx.stroke(); } }
        EV.text(ctx, '−', x0 - 16, y0 + gh / 2 + 6, { size: 18, weight: 700, align: 'center', color: col('ink') });
        EV.text(ctx, '+', x0 + gw + 16, y0 + gh / 2 + 6, { size: 16, weight: 700, align: 'center', color: col('ink') });
        EV.arrow(ctx, x0, y0 + gh + 18, x0 + gw, y0 + gh + 18, col('ink-2'), 1.5, 7);
        EV.text(ctx, `${ks.s} in series: voltage adds up to ${fmt(ks.s * CELLS[ks.cell].v)} V`, w / 2, y0 + gh + 34, { size: 11.5, align: 'center', color: col('ink-2') });
        EV.text(ctx, `${ks.p} in parallel: ${fmt(ks.p * CELLS[ks.cell].ah)} Ah`, w / 2, y0 - 12, { size: 11.5, align: 'center', color: col('ink-2') });
      }
      KC.draw = kDraw; kUpd();

      /* ------------------------------------------------------------ ageing -- */
      const a = EV.fig(root, 'aging', { side: true, tag: 'Interactive · illustrative model', title: 'How the way you use a battery shapes its life', hint: 'A simple model of the two ageing mechanisms. It shows directions and rough sizes, not a prediction for any particular car.' });
      const ap = EV.plot(a.stage, { h: 300, x: { label: 'Age (years)', min: 0, max: 15, unit: 'yr' }, y: { label: 'Capacity lost (%)', min: 0, max: 40, unit: '%' } });
      const AR = EV.readouts(a.out, { cap: ['Capacity left after 10 years', '%'], km: ['Distance by then', 'km'], cyc: ['Full cycles by then', ''], cal: ['Lost to time', '%', 's4'], use: ['Lost to use', '%', 's1'] });
      const as = EV.controls(a.ctl, {
        soc: { label: 'Typical charge level when parked', min: 30, max: 100, step: 5, value: car.chem === 'LFP' ? 90 : 70, unit: '%' },
        temp: { label: 'Typical battery temperature', min: 5, max: 45, step: 1, value: 20, unit: '°C' },
        km: { label: 'Distance per year', min: 5000, max: 60000, step: 1000, value: 20000, unit: 'km' },
        fast: { label: 'Share of fast charging', min: 0, max: 100, step: 5, value: 15, unit: '%' },
      }, aUpd);
      function aUpd() {
        const lfp = car.chem === 'LFP';
        const fT = Math.pow(2, (as.temp - 25) / 13), fS = lfp ? 0.75 + 0.35 * (as.soc / 100) ** 2 : 0.55 + 0.9 * (as.soc / 100) ** 3;
        const kCal = (lfp ? 1.9 : 2.4) * fT * fS;                                    // % per sqrt(year)
        const efcYr = as.km * 0.165 / car.usable, kCyc = (lfp ? 0.004 : 0.01) * (1 + 0.6 * as.fast / 100);   // % per full cycle
        const cal = (y) => kCal * Math.sqrt(y), use = (y) => kCyc * efcYr * y;
        ap.set({
          series: [{ name: 'Lost to time (calendar ageing)', color: 's4', stack: true, pts: EV.sample(cal, 0, 15, 60) }, { name: 'Lost to use (cycle ageing)', color: 's1', stack: true, pts: EV.sample(use, 0, 15, 60) }],
          hlines: [{ y: 30, label: '70% left: typical warranty threshold', left: true }], vlines: [{ x: 10 }],
        });
        AR({ cap: fmt(100 - cal(10) - use(10), 1), km: fmt(as.km * 10), cyc: fmt(efcYr * 10), cal: fmt(cal(10), 1), use: fmt(use(10), 1) });
      }
      aUpd();
    },

    quiz: (car) => [
      { q: 'While a lithium-ion cell discharges, lithium ions move…', o: ['From cathode to anode through the external wire', 'From anode to cathode through the electrolyte, while electrons take the external circuit', 'Nowhere; only electrons move', 'Out of the cell into the motor'], a: 1, why: 'The ions cross inside the cell. Electrons cannot pass through the electrolyte, so they go round through the circuit and deliver the work. Both end up in the cathode.' },
      { q: 'A pack rests at 380 V and has 0.06 Ω internal resistance. What is its terminal voltage while delivering 1000 A?', o: ['380 V', '374 V', '320 V', '440 V'], a: 2, why: 'V = V_oc − I·R = 380 − 1000 × 0.06 = 320 V. And 1000² × 0.06 = 60 kW is turned into heat inside the cells while that lasts.' },
      { q: `The ${car.name} pack is ${car.s}s${car.p}p. If you rewired the same cells as ${Math.round(car.s / 2)}s${car.p * 2}p, what would change?`, o: ['Energy would halve', 'Voltage would halve and capacity in Ah would double; energy stays the same', 'Voltage would double', 'Nothing measurable'], a: 1, why: 'Series sets voltage, parallel sets capacity. The same cells store the same energy, but the car would need twice the current for the same power, with four times the wiring loss.' },
      { q: 'Why are LFP-equipped cars told to charge to 100% regularly?', o: ['LFP cells are damaged by partial charging', 'Their flat voltage curve makes charge level hard to read, and a full charge recalibrates the estimate', 'They have a memory effect', 'To heat the battery'], a: 1, why: 'Between about 20% and 90% an LFP cell\'s voltage barely changes, so the car relies on counting current, which drifts. At full charge the voltage rises sharply and gives a fixed reference point. LFP also tolerates sitting full much better than nickel chemistry.' },
      { q: 'Which habit ages a nickel-based pack fastest?', o: ['Charging to 60% every night', 'Leaving it at 100% for weeks in summer heat', 'Driving gently in cool weather', 'Using regenerative braking'], a: 1, why: 'Calendar ageing accelerates with both temperature and state of charge. Hot and full is the worst combination. Shallow cycles in the middle of the range are the gentlest use there is.' },
    ],
  });
})();
