/* Chapter 6 — Power electronics: P = VI and I²R, the six-switch inverter, PWM, and the car's electrical architecture. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, { clamp } = P;
  const TAU = Math.PI * 2;
  const PHC = ['s1', 's2', 's3'], PHN = ['A', 'B', 'C'];
  const SIX = [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1]];

  function archSVG(car) {
    const awd = car.drive === 'AWD';
    const box = (x, y, w, h, t, s) => `<rect class="d-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text class="d-txt b" x="${x + w / 2}" y="${y + h / 2 + (s ? -3 : 5)}" text-anchor="middle">${t}</text>${s ? `<text class="d-txt s" x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle">${s}</text>` : ''}`;
    const hv = (d) => `<path d="${d}" fill="none" stroke="var(--s1)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const ac = (d) => `<path d="${d}" fill="none" stroke="var(--s3)" stroke-width="2.5" stroke-dasharray="1 0"/><path d="${d}" fill="none" stroke="var(--s3)" stroke-width="2.5" transform="translate(0 6)"/><path d="${d}" fill="none" stroke="var(--s3)" stroke-width="2.5" transform="translate(0 -6)"/>`;
    const lv = (d) => `<path d="${d}" fill="none" stroke="var(--s7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<svg viewBox="0 0 920 380" role="img" aria-label="Block diagram of the car's electrical system: charge port, on-board charger, battery, inverters, motors, DC-DC converter and low-voltage loads">
      ${hv('M190 190 H560')}${hv('M285 100 V190')}${hv('M335 280 V190')}${hv('M440 190 V310 H560')}${awd ? hv('M440 190 V70 H560') : ''}
      <path d="M95 100 V160" fill="none" stroke="var(--s1)" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"/>
      ${ac('M150 70 H250')}${ac('M680 190 H750')}${awd ? ac('M680 70 H750') : ''}
      ${lv('M250 320 H210')}${lv('M140 320 H110')}
      ${box(40, 40, 110, 60, 'Charge port', 'AC or DC in')}
      ${box(250, 40, 120, 60, 'On-board charger', 'AC → DC, 11 kW')}
      <rect x="40" y="160" width="150" height="60" rx="8" fill="var(--s1)" fill-opacity=".18" stroke="var(--s1)" stroke-width="2"/>
      <text class="d-txt b" x="115" y="187" text-anchor="middle">Battery pack</text><text class="d-txt s" x="115" y="204" text-anchor="middle">contactors + fuse inside</text>
      <text class="d-txt s" x="106" y="135">DC fast charging goes straight in</text>
      ${box(560, 160, 120, 60, 'Rear inverter', 'DC → 3-phase AC')}
      ${box(750, 160, 130, 60, 'Rear motor', 'permanent magnet')}
      ${awd ? box(560, 40, 120, 60, 'Front inverter', 'DC → 3-phase AC') + box(750, 40, 130, 60, 'Front motor', 'induction') : ''}
      ${box(560, 280, 160, 60, 'Heat-pump compressor', 'own small inverter')}
      ${box(250, 280, 120, 60, 'DC-DC converter', `${fmt(car.s * car.cellV)} V → 16 V`)}
      ${box(140, 290, 70, 60, '16 V', 'battery')}
      ${box(10, 290, 100, 60, 'Computers,', 'lights, pumps')}
      <text class="d-txt b" x="352" y="178">High-voltage bus</text>
      <text class="d-txt s" x="352" y="210">about ${fmt(car.s * car.cellV)} V DC</text>
      <g transform="translate(590 366)"><path d="M0 0h26" stroke="var(--s1)" stroke-width="5" stroke-linecap="round"/><text class="d-txt s" x="34" y="4">high-voltage DC</text>
        <path d="M134 -4h26M134 0h26M134 4h26" stroke="var(--s3)" stroke-width="1.6"/><text class="d-txt s" x="168" y="4">AC</text>
        <path d="M204 0h26" stroke="var(--s7)" stroke-width="2.5"/><text class="d-txt s" x="238" y="4">16 V DC</text></g>
    </svg>`;
  }

  EV.chapter({
    id: 'inverter', n: '6', title: 'Power electronics', color: 's7',
    blurb: 'Why the car runs at 400 volts, how six switches turn a battery into a three-phase supply, and the trick of making a sine wave out of on and off.',
    lead: 'A battery supplies steady direct current. A motor needs three alternating currents whose frequency and size change every instant with the driver\'s foot. Between them sits the inverter: six switches and a great deal of timing.',
    html(car) {
      const V = car.s * car.cellV, I300 = 250e3 / V;
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>Power is voltage times current. For the same power, higher voltage means less current, and heat in the wiring falls with the <strong>square</strong> of the current.</li>
        <li>An inverter is six electronic switches. Each motor terminal is connected either to battery plus or battery minus, nothing in between.</li>
        <li>Switching thousands of times a second and varying how long each switch stays on (<strong>PWM</strong>) makes the <em>average</em> voltage follow any shape you like, including a sine wave.</li>
        <li>The motor's own inductance smooths the pulses into a nearly perfect sinusoidal current.</li>
        <li>Because a switch that is fully on or fully off wastes almost nothing, the whole conversion is about 97–99% efficient.</li>
      </ul></div>

      <h2><span class="n">6.1</span>Volts, amps, and why the voltage is high</h2>
      <p>Electrical power is the product of voltage and current. Every conductor resists current a little, and the heat that resistance produces depends on the current alone:</p>
      ${eq(String.raw`P = V \cdot I \quad\quad P_{loss} = I^2 R`, '<b>V</b> voltage in volts · <b>I</b> current in amperes · <b>R</b> resistance of the conductor in ohms')}
      <p>The two together explain the architecture of every electric car. To deliver 250 kW you can use 250 V and 1000 A, or 500 V and 500 A. The second choice halves the current and so cuts the wiring loss to a quarter, or lets you use a quarter of the copper for the same loss. The ${car.name} runs at about ${fmt(V)} V, so 250 kW is ${fmt(I300)} A.</p>
      <div data-fig="cable"></div>
      <p>This is why starter-battery voltage is hopeless for traction, why most EVs sit near 400 V, and why some newer ones use 800 V: at twice the voltage the same charging cable can carry twice the power. The price is insulation, clearances and components rated for the higher voltage.</p>

      <h2><span class="n">6.2</span>Six switches</h2>
      <p>The motor has three terminals. The inverter gives each one a <em class="t">half-bridge</em>: two switches in series between battery plus and battery minus, with the motor terminal connected to the point between them. Close the upper switch and the terminal sits at battery plus. Close the lower one and it sits at battery minus. The two are never closed together, which would short the battery.</p>
      <p>With three legs and two positions each there are eight possible states. Six of them push current through the windings in six different directions, 60° apart. Two (all up, or all down) connect all three terminals together and apply no voltage. Set the switches yourself and watch where the field points.</p>
      <div data-fig="bridge"></div>
      <p>Stepping round the six states makes the field jump round the motor in six jerks. Early drives did exactly that. A modern inverter instead blends neighbouring states, spending a controlled fraction of each cycle in each, so the average field can point in <em>any</em> direction with <em>any</em> strength.</p>
      <div class="callout deep"><h5>What the switches are</h5><p>Each switch is a group of silicon-carbide MOSFETs: transistors that conduct in one state and block ${fmt(V)} V in the other, and that can change state in tens of nanoseconds. Silicon carbide wastes less energy per switching event and conducts with lower loss at part load than the silicon IGBTs it replaced. Tesla's Model 3 inverter in 2017 was the first in a mass-produced car to use it. A diode across each transistor gives current a path while the switches change over, and lets power flow backwards during regeneration.</p></div>

      <h2><span class="n">6.3</span>Making a sine wave from on and off</h2>
      <p>A switch has only two states, but the motor needs a smoothly varying voltage. The solution is to switch much faster than the motor can respond and control the <em>proportion</em> of time spent on. If a terminal is at +V for 70% of each short period and at −V for 30%, its average over that period is 40% of V. Vary that proportion sinusoidally and the average traces a sine wave. This is <em class="t">pulse-width modulation</em>.</p>
      <p>The classic way to generate the timing is to compare the wanted sine (the reference) with a fast triangular wave (the carrier). Whenever the reference is above the carrier the upper switch is on.</p>
      <div data-fig="pwm"></div>
      <p>The voltage is a train of pulses, but the motor windings are inductors, and an inductor resists changes in current: ${M`V = L \, dI/dt`}. The current cannot follow each pulse. It follows the average, with a small ripple on top. Two controls fall out of this picture:</p>
      <ul>
        <li><strong>Amplitude</strong> of the reference sets the size of the output voltage, and with it the motor current and <strong>torque</strong>.</li>
        <li><strong>Frequency</strong> of the reference sets how fast the field rotates, which is the motor <strong>speed</strong>.</li>
      </ul>
      <p>The same trick with a constant reference instead of a sine makes a DC-DC converter: chop ${fmt(V)} V with a small duty cycle, smooth it, and you have the 16 V supply for the low-voltage system.</p>
      <div class="callout y"><h5>In the Model Y</h5><p>At 100 km/h the motor needs ${fmt(P.wOf(car, 100 / 3.6) * 30 / Math.PI / 60 * 3)} Hz. The inverter switches at roughly 10 kHz and upward, so each electrical cycle is built from about ${fmt(10000 / (P.wOf(car, 100 / 3.6) * 30 / Math.PI / 60 * 3))} pulses. That switching is the faint whine you can hear from an electric car at low speed.</p></div>

      <h2><span class="n">6.4</span>Why it is so efficient</h2>
      <p>A resistor that dropped the battery voltage to what the motor needs would burn the difference as heat. A switch does not. When it is off, no current flows, so ${M`P = V \cdot 0 = 0`}. When it is on, almost no voltage is across it, so ${M`P \approx 0 \cdot I = 0`}. Loss only happens in two places: the small resistance while conducting, and the brief instants of changing over when voltage and current are both present. Faster switching devices shrink the second; silicon carbide shrinks both. The result is 97–99% efficiency across most of the operating range.</p>

      <h2><span class="n">6.5</span>The whole electrical system</h2>
      <p>The inverter is one of several power converters in the car, all hanging off the same high-voltage bus.</p>
      <div data-fig="arch"></div>
      <ul>
        <li><strong>Contactors</strong> are heavy relays inside the pack. They disconnect the high voltage whenever the car is off or a fault is detected. A pyrotechnic fuse cuts the circuit permanently in a crash.</li>
        <li><strong>The on-board charger</strong> runs the inverter idea in reverse: it rectifies grid AC and boosts it to pack voltage. It is covered in Chapter 8.</li>
        <li><strong>The DC-DC converter</strong> replaces the alternator of a combustion car, keeping the 16 V battery charged.</li>
        <li>The high-voltage system is electrically <strong>isolated</strong> from the car body. Touching one conductor and the body does nothing; the car continuously measures that isolation and shuts down if it degrades.</li>
      </ul>`;
    },

    init(root, car) {
      const Vdc = car.s * car.cellV;
      /* ------------------------------------------------------------ cable -- */
      const f = EV.fig(root, 'cable', { side: true, title: 'The same power at different voltages', hint: 'Copper needed to carry the current over 3 m and back at a normal current density. The circles are the conductor cross-sections, drawn to the same scale.',
        cap: '<b>Try this.</b> Hold the power at 250 kW and step the voltage down. At 12 V the conductor is thicker than your arm.' });
      const CC = EV.canvas(f.stage, { ratio: 0.5, minH: 240, maxH: 320, label: 'Battery connected to a motor by a cable whose thickness depends on the current' });
      const CR = EV.readouts(f.out, { I: ['Current', 'A'], a: ['Copper cross-section', 'mm²'], d: ['Conductor diameter', 'mm'], m: ['Copper mass, 3 m out and back', 'kg'], loss: ['Heat in a real 70 mm² cable', 'W'], pc: ['Share of power lost there', '%'] });
      const cs = EV.controls(f.ctl, {
        P: { label: 'Power to deliver', min: 10, max: 350, step: 10, value: 250, unit: 'kW' },
        V: { type: 'seg', label: 'System voltage', options: [['12', '12 V'], ['48', '48 V'], ['400', '400 V'], ['800', '800 V']], value: '400' },
      }, cUpd);
      let cst = {}, ct = 0;
      function cUpd() {
        const V = +cs.V, I = cs.P * 1000 / V, A = I / 5, d = 2 * Math.sqrt(A / Math.PI), mass = A * 8.96e-3 * 6;
        const R70 = 0.0172 * 6 / 70, loss = I * I * R70;
        cst = { V, I, A, d, loss };
        CR({ I: fmt(I), a: fmt(A), d: fmt(d, 1), m: fmt(mass, 1), loss: fmt(loss), pc: fmt(Math.min(100, loss / (cs.P * 1000) * 100), loss / (cs.P * 1000) < 0.1 ? 2 : 0) });
      }
      function cDraw(t, dt) {
        const { ctx, w, h } = CC, col = EV.col; ct += dt;
        ctx.clearRect(0, 0, w, h);
        const bw = Math.min(110, w * 0.18), y = h * 0.34, x0 = 14 + bw, x1 = w - 14 - bw;
        const th = clamp(cst.d * 0.9, 3, h * 0.42), heat = clamp(cst.loss / (cs.P * 1000) * 8, 0, 1);
        ctx.fillStyle = EV.mix('rim', 's2', heat); EV.rr(ctx, x0 - 4, y - th / 2, x1 - x0 + 8, th, Math.min(th / 2, 10)); ctx.fill();
        const n = Math.round(clamp(cst.I / 40, 4, 60)), sp = 20 + Math.min(260, cst.I * 0.05);
        ctx.fillStyle = col('s1');
        for (let i = 0; i < n; i++) { const u = ((ct * sp + i * (x1 - x0) / n) % (x1 - x0)), yy = y + ((i * 37) % 11 - 5) / 11 * Math.max(0, th - 7); ctx.beginPath(); ctx.arc(x0 + u, yy, 2.4, 0, TAU); ctx.fill(); }
        EV.rr(ctx, 14, y - 42, bw, 84, 9); ctx.fillStyle = col('surface-2'); ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
        EV.rr(ctx, x1, y - 42, bw, 84, 9); ctx.fill(); ctx.stroke();
        EV.text(ctx, 'Battery', 14 + bw / 2, y - 4, { size: 13, weight: 600, align: 'center', color: col('ink') });
        EV.text(ctx, `${fmt(cst.V)} V`, 14 + bw / 2, y + 15, { size: 12, align: 'center' });
        EV.text(ctx, 'Motor', x1 + bw / 2, y - 4, { size: 13, weight: 600, align: 'center', color: col('ink') });
        EV.text(ctx, `${fmt(cs.P)} kW`, x1 + bw / 2, y + 15, { size: 12, align: 'center' });
        EV.text(ctx, `${fmt(cst.I)} A`, w / 2, y - th / 2 - 9, { size: 13, weight: 600, align: 'center', color: col('ink'), halo: true });
        // cross-sections to scale
        const by = h * 0.8, k = Math.min(1.3, (h * 0.3) / 80);
        [[12, 'at 12 V'], [48, 'at 48 V'], [400, 'at 400 V'], [800, 'at 800 V']].forEach(([V, lab], i) => {
          const d = 2 * Math.sqrt(cs.P * 1000 / V / 5 / Math.PI), cx = w * (0.16 + i * 0.23), r = Math.max(1.2, d / 2 * k);
          ctx.beginPath(); ctx.arc(cx, by - Math.min(r, h * 0.16) + 0, Math.min(r, h * 0.19), 0, TAU);
          ctx.fillStyle = V === cst.V ? col('s2') : col('rim'); ctx.fill();
          EV.text(ctx, `${lab} · ${fmt(d, d < 10 ? 1 : 0)} mm`, cx, h - 6, { size: 11.5, align: 'center', weight: V === cst.V ? 700 : 500, color: col(V === cst.V ? 'ink' : 'ink-2') });
        });
      }
      cUpd(); CC.draw = () => cDraw(0, 0); EV.loop(CC.cv, cDraw);

      /* ----------------------------------------------------------- bridge -- */
      const g = EV.fig(root, 'bridge', { side: true, title: 'The three-phase bridge', hint: 'Each leg connects one motor terminal to battery plus or battery minus. Moving dots show current. The hexagon on the right shows the direction of the magnetic field that results.',
        cap: '<b>Try this.</b> Find the eight states by hand and note which two give no field. Then run the sequence: this "six-step" drive is the crudest way to make the field go round.' });
      const BC = EV.canvas(g.stage, { ratio: 0.56, minH: 280, maxH: 380, label: 'Inverter schematic with six switches, motor windings and a space-vector hexagon' });
      const BR = EV.readouts(g.out, { st: ['Switch state A B C', ''], va: ['Phase A voltage', 'V', 's1'], vb: ['Phase B voltage', 'V', 's2'], vc: ['Phase C voltage', 'V', 's3'], ang: ['Field direction', ''] });
      const legs = [1, 0, 0];
      const bs = EV.controls(g.ctl, {
        a: { type: 'seg', label: 'Leg A connects to', options: [['1', 'Plus'], ['0', 'Minus']], value: '1' },
        b: { type: 'seg', label: 'Leg B connects to', options: [['1', 'Plus'], ['0', 'Minus']], value: '0' },
        c: { type: 'seg', label: 'Leg C connects to', options: [['1', 'Plus'], ['0', 'Minus']], value: '0' },
        auto: { type: 'toggle', label: 'Step through the six-step sequence', value: false },
      }, () => { legs[0] = +bs.a; legs[1] = +bs.b; legs[2] = +bs.c; bUpd(); });
      let bt = 0, step = 0, stepT = 0;
      function bUpd() {
        const mean = (legs[0] + legs[1] + legs[2]) / 3, v = legs.map((s) => (s - mean) * Vdc);
        const al = (2 / 3) * (v[0] - v[1] / 2 - v[2] / 2), be = (2 / 3) * (Math.sqrt(3) / 2) * (v[1] - v[2]);
        const zero = Math.hypot(al, be) < 1;
        BR({ st: legs.join(' '), va: fmt(v[0]), vb: fmt(v[1]), vc: fmt(v[2]), ang: zero ? 'none' : fmt((Math.atan2(be, al) * 180 / Math.PI + 360) % 360) + '°' });
      }
      function bDraw(t, dt) {
        const { ctx, w, h } = BC, col = EV.col; bt += dt;
        if (bs.auto) { stepT += dt; if (stepT > 0.9) { stepT = 0; step = (step + 1) % 6; SIX[step].forEach((s, i) => { legs[i] = s; bs.set('abc'[i], String(s), true); }); bUpd(); } }
        ctx.clearRect(0, 0, w, h);
        const yT = 34, yB = h - 34, mid = h / 2, bx = w * 0.06, X = [w * 0.17, w * 0.27, w * 0.37], mY = [mid - 44, mid, mid + 44], xm = w * 0.46, xn = w * 0.64;
        const mean = (legs[0] + legs[1] + legs[2]) / 3, cur = legs.map((s) => s - mean);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // rails and battery
        ctx.strokeStyle = col('axis');
        ctx.beginPath(); ctx.moveTo(bx, mid - 14); ctx.lineTo(bx, yT); ctx.lineTo(X[2], yT); ctx.moveTo(bx, mid + 14); ctx.lineTo(bx, yB); ctx.lineTo(X[2], yB); ctx.stroke();
        ctx.strokeStyle = col('ink'); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bx - 14, mid - 14); ctx.lineTo(bx + 14, mid - 14); ctx.stroke();
        ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx - 8, mid - 5); ctx.lineTo(bx + 8, mid - 5); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - 14, mid + 5); ctx.lineTo(bx + 14, mid + 5); ctx.stroke();
        ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx - 8, mid + 14); ctx.lineTo(bx + 8, mid + 14); ctx.stroke();
        EV.text(ctx, '+', bx + 18, yT + 16, { size: 15, weight: 700, color: col('ink') }); EV.text(ctx, '−', bx + 18, yB - 8, { size: 15, weight: 700, color: col('ink') });
        EV.text(ctx, `${fmt(Vdc)} V`, bx + 20, mid + 5, { size: 11.5, color: col('muted') });
        // legs, switches, phase wires
        const sw = (x, y0, y1, closed, c) => {
          const g0 = (y0 + y1) / 2 - 13, g1 = (y0 + y1) / 2 + 13;
          ctx.strokeStyle = col(closed ? c : 'axis'); ctx.lineWidth = closed ? 3.5 : 2.5;
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, g0); ctx.moveTo(x, g1); ctx.lineTo(x, y1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, g1); ctx.lineTo(closed ? x : x + 13, g0 + (closed ? 0 : 4)); ctx.stroke();
          ctx.fillStyle = col(closed ? c : 'muted'); ctx.beginPath(); ctx.arc(x, g0, 3.2, 0, TAU); ctx.arc(x, g1, 3.2, 0, TAU); ctx.fill();
        };
        legs.forEach((s, k) => {
          sw(X[k], yT, mY[k], s === 1, PHC[k]); sw(X[k], mY[k], yB, s === 0, PHC[k]);
          ctx.strokeStyle = col(PHC[k]); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(X[k], mY[k]); ctx.lineTo(xm, mY[k]); ctx.stroke();
          // winding: a row of humps from the terminal toward the neutral point
          const dx = xn - xm - 14, dy = mid - mY[k], n = 5;
          ctx.beginPath();
          for (let i = 0; i < n; i++) { const xa = xm + dx * i / n, ya = mY[k] + dy * i / n, xb = xm + dx * (i + 1) / n, yb = mY[k] + dy * (i + 1) / n; ctx.moveTo(xa, ya); ctx.quadraticCurveTo((xa + xb) / 2, (ya + yb) / 2 - 15, xb, yb); }
          ctx.lineTo(xn, mid); ctx.stroke();
          EV.text(ctx, PHN[k], X[k] - 9, mY[k] + (k === 1 ? -7 : k === 0 ? -7 : 16), { size: 12, weight: 700, align: 'right', color: col('ink') });
          ctx.fillStyle = col(PHC[k]); ctx.beginPath(); ctx.arc(X[k], mY[k], 4, 0, TAU); ctx.fill();
        });
        ctx.fillStyle = col('ink'); ctx.beginPath(); ctx.arc(xn, mid, 4.5, 0, TAU); ctx.fill();
        EV.text(ctx, 'motor windings', (xm + xn) / 2, mY[0] - 26, { size: 11.5, align: 'center', color: col('muted') });
        EV.text(ctx, 'six switches', X[1], yT - 12, { size: 11.5, align: 'center', color: col('muted') });
        // moving charge along the conducting paths
        legs.forEach((s, k) => {
          const I = cur[k]; if (Math.abs(I) < 0.05) return;
          const path = I > 0 ? [[bx, yT], [X[k], yT], [X[k], mY[k]], [xm, mY[k]], [xn, mid]] : [[xn, mid], [xm, mY[k]], [X[k], mY[k]], [X[k], yB], [bx, yB]];
          let L = 0; const seg = []; for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); L += d; }
          ctx.fillStyle = col(PHC[k]);
          for (let u = (bt * 70 * Math.abs(I) * 1.5) % 22; u < L; u += 22) {
            let d = u, i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
            const a = path[i], b = path[i + 1], q = clamp(d / seg[i], 0, 1);
            ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, 3.3, 0, TAU); ctx.fill();
          }
        });
        // space-vector hexagon
        const hx = w * 0.825, hy = mid, R = Math.min(h * 0.3, w * 0.115);
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const a = i * TAU / 6, x = hx + R * Math.cos(a), y = hy - R * Math.sin(a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
        SIX.forEach((st, i) => { const a = i * TAU / 6, on = st.every((s, j) => s === legs[j]);
          ctx.beginPath(); ctx.arc(hx + R * Math.cos(a), hy - R * Math.sin(a), on ? 6 : 3.5, 0, TAU); ctx.fillStyle = col(on ? 'ink' : 'axis'); ctx.fill();
          EV.text(ctx, st.join(''), hx + (R + 16) * Math.cos(a), hy - (R + 16) * Math.sin(a) + 4, { size: 11, mono: true, align: 'center', color: col(on ? 'ink' : 'muted'), weight: on ? 700 : 500 }); });
        const v = cur, al = v[0] - v[1] / 2 - v[2] / 2, be = Math.sqrt(3) / 2 * (v[1] - v[2]);
        if (Math.hypot(al, be) > 0.05) EV.arrow(ctx, hx, hy, hx + al * R, hy - be * R, col('ink'), 4.5, 12);
        else { ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fillStyle = col('ink'); ctx.fill(); EV.text(ctx, 'no field', hx, hy + 22, { size: 11.5, align: 'center', color: col('ink-2') }); }
        EV.text(ctx, 'field direction', hx, hy - R - 30, { size: 11.5, align: 'center', color: col('muted') });
      }
      bUpd(); BC.draw = () => bDraw(0, 0); EV.loop(BC.cv, bDraw);

      /* -------------------------------------------------------------- PWM -- */
      const p = EV.fig(root, 'pwm', { side: true, title: 'Pulse-width modulation, one electrical cycle', hint: 'Top: the wanted sine and the triangular carrier. Middle: what the switches actually put on the motor terminal. Bottom: the current that flows through the winding.',
        cap: '<b>Try this.</b> Drop to 7 pulses per cycle and see how rough the current becomes. Raise it to 45 and the ripple almost disappears. Then change the amplitude: the pulses get wider and narrower, never taller.' });
      const PC = EV.canvas(p.stage, { ratio: 0.66, minH: 330, maxH: 460, label: 'PWM waveforms: reference and carrier, switched voltage, and resulting current' });
      const PR = EV.readouts(p.out, { v: ['Output voltage amplitude', 'V'], pc: ['Share of the maximum', '%'], rip: ['Current ripple', '%'] });
      const ps = EV.controls(p.ctl, {
        m: { label: 'Amplitude of the reference', min: 0, max: 1, step: 0.02, value: 0.8 },
        n: { label: 'Pulses per cycle', min: 5, max: 61, step: 2, value: 21 },
        L: { label: 'Winding inductance (smoothing)', min: 0.2, max: 2, step: 0.1, value: 1, unit: '×' },
      }, pDraw);
      function pDraw() {
        const { ctx, w, h } = PC, col = EV.col, N = 2400, m = ps.m, n = ps.n, tau = 0.55 * ps.L;
        const ref = new Float32Array(N), car_ = new Float32Array(N), pole = new Float32Array(N), cur = new Float32Array(N), ideal = new Float32Array(N);
        const tri = (x) => { const f = x - Math.floor(x); return f < 0.5 ? 1 - 4 * f : -3 + 4 * f; };
        let i0 = 0;
        for (let pass = 0; pass < 3; pass++) for (let i = 0; i < N; i++) {      // run to steady state, keep the last pass
          const th = i / N * TAU; ref[i] = m * Math.sin(th); car_[i] = tri(th / TAU * n); pole[i] = ref[i] > car_[i] ? 1 : -1;
          i0 += (pole[i] - i0) * (TAU / N) / tau; cur[i] = i0;
        }
        // ideal: the same low-pass filter driven by the pure sine. amplitude m / sqrt(1 + tau²), phase lag atan(tau)
        const gain = 1 / Math.sqrt(1 + tau * tau), lag = Math.atan(tau); let rip = 0;
        for (let i = 0; i < N; i++) { ideal[i] = m * gain * Math.sin(i / N * TAU - lag); rip = Math.max(rip, Math.abs(cur[i] - ideal[i])); }
        ctx.clearRect(0, 0, w, h);
        const x0 = 14, pw = w - 28, gap = 26, ph = (h - 3 * gap - 6) / 3, X = (i) => x0 + pw * i / N;
        const panel = (k, title) => { const y = gap + k * (ph + gap); ctx.strokeStyle = col('grid'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y + ph / 2); ctx.lineTo(x0 + pw, y + ph / 2); ctx.stroke(); EV.text(ctx, title, x0, y - 8, { size: 11.5, color: col('ink-2') }); return { mid: y + ph / 2, a: ph / 2 - 3 }; };
        const line = (arr, pn, c, lw, dash, scale = 1) => { ctx.beginPath(); for (let i = 0; i < N; i += 2) { const y = pn.mid - arr[i] * pn.a * scale; if (i) ctx.lineTo(X(i), y); else ctx.moveTo(X(i), y); } ctx.strokeStyle = col(c); ctx.lineWidth = lw; ctx.setLineDash(dash ? [5, 4] : []); ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]); };
        const p1 = panel(0, 'reference (wanted voltage) and carrier'); line(car_, p1, 'muted', 1.2); line(ref, p1, 'ink', 2.4);
        const p2 = panel(1, 'voltage on the motor terminal: only ever +V or −V');
        ctx.beginPath(); ctx.moveTo(X(0), p2.mid);
        for (let i = 0; i < N; i++) ctx.lineTo(X(i), p2.mid - pole[i] * p2.a * 0.86);
        ctx.lineTo(X(N - 1), p2.mid); ctx.closePath(); ctx.fillStyle = EV.rgba('s1', 0.18); ctx.fill();
        ctx.beginPath(); for (let i = 0; i < N; i++) { const y = p2.mid - pole[i] * p2.a * 0.86; if (i) ctx.lineTo(X(i), y); else ctx.moveTo(X(i), y); } ctx.strokeStyle = col('s1'); ctx.lineWidth = 1.5; ctx.stroke();
        line(ref, p2, 'ink', 1.6, true, 0.86);
        const p3 = panel(2, 'current in the winding: smoothed by inductance'); const sc = 0.92 / Math.max(0.3, m * gain + rip);
        line(ideal, p3, 'muted', 1.5, true, sc); line(cur, p3, 's3', 2.2, false, sc);
        PR({ v: fmt(m * Vdc / 2), pc: fmt(m * 100), rip: m > 0.02 ? fmt(rip / (m * gain) * 100) : '–' });
      }
      PC.draw = pDraw; pDraw();

      /* ------------------------------------------------------ architecture -- */
      const a = EV.fig(root, 'arch', { tag: 'Diagram', title: `Electrical architecture of the ${car.name}`, hint: 'One high-voltage bus, several converters. Line style shows what kind of electricity flows.' });
      a.stage.innerHTML = archSVG(car);
    },

    quiz: (car) => [
      { q: 'A car delivers the same power at 800 V instead of 400 V through the same cable. The heat produced in the cable is…', o: ['The same', 'Half', 'A quarter', 'Double'], a: 2, why: 'Same power at twice the voltage needs half the current. Cable heat is I²R, and (½)² = ¼.' },
      { q: 'How many switches are there in the inverter of one motor, and how many of them may be closed in the same leg at once?', o: ['Three switches, all at once', 'Six switches, one per leg at a time', 'Six switches, both in a leg', 'Twelve switches, two per leg'], a: 1, why: 'Three legs, each with an upper and a lower switch. Closing both in one leg would connect battery plus directly to battery minus: a short circuit.' },
      { q: 'With PWM, how does the inverter make the output voltage smaller?', o: ['It lowers the height of the pulses', 'It makes the pulses narrower so the average is lower', 'It adds a resistor in series', 'It reduces the battery voltage'], a: 1, why: 'The switches can only connect the terminal to full plus or full minus. What changes is the fraction of time spent at each, the duty cycle, and with it the average.' },
      { q: 'The terminal voltage is a train of rectangular pulses. Why is the motor current nevertheless close to a smooth sine?', o: ['A capacitor filters it', 'The winding inductance resists rapid changes in current', 'The battery smooths it', 'The pulses are sinusoidal in shape'], a: 1, why: 'For an inductor V = L·dI/dt: a voltage step changes only the slope of the current. If the pulses are fast enough the current just ripples slightly around the average.' },
      { q: 'Why does a switching converter waste so little energy compared with a resistor doing the same job?', o: ['Switches have no resistance at all', 'A switch is either off (no current) or fully on (almost no voltage across it), so V × I in the switch is near zero either way', 'It stores the excess energy in the battery', 'It runs at lower temperature'], a: 1, why: 'Dissipation is voltage across the device times current through it. In both steady states one of those factors is almost zero. Losses arise only in the on-resistance and during the brief changeovers.' },
    ],
  });
})();
