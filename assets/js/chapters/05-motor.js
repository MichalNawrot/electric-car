/* Chapter 5 — The electric motor: force on a current, the rotating field, two rotor types, back-EMF, efficiency. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, { clamp } = P;
  const TAU = Math.PI * 2, POLE_PAIRS = 3;
  const PH = [['A', 's1', Math.PI / 2], ['B', 's2', Math.PI / 2 + TAU / 3], ['C', 's3', Math.PI / 2 + 2 * TAU / 3]];   // name, colour, axis angle

  /** Draw a stator ring with three coil pairs and return nothing. cur = [ia, ib, ic] in -1..1 */
  function drawStator(ctx, cx, cy, Ro, Ri, cur, on) {
    const col = EV.col;
    ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.arc(cx, cy, Ri, 0, TAU, true);
    ctx.fillStyle = col('surface-2'); ctx.fill('evenodd');
    ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, TAU); ctx.stroke();
    const rm = (Ro + Ri) / 2, rc = (Ro - Ri) * 0.36;
    PH.forEach(([name, c, ax], i) => {
      [1, -1].forEach((sgn) => {
        const a = ax + sgn * Math.PI / 2, x = cx + rm * Math.cos(a), y = cy - rm * Math.sin(a), I = (on[i] ? cur[i] : 0) * sgn;
        ctx.beginPath(); ctx.arc(x, y, rc, 0, TAU); ctx.fillStyle = EV.rgba(c, 0.18 + 0.6 * Math.abs(I)); ctx.fill();
        ctx.strokeStyle = col(c); ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = col('ink'); ctx.fillStyle = col('ink'); ctx.lineWidth = 1.6;
        if (Math.abs(I) > 0.06) {
          if (I > 0) { ctx.beginPath(); ctx.arc(x, y, rc * 0.28, 0, TAU); ctx.fill(); }            // current toward you
          else { const d = rc * 0.45; ctx.beginPath(); ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); ctx.stroke(); }
        }
        const lx = cx + (Ro + 11) * Math.cos(a), ly = cy - (Ro + 11) * Math.sin(a);
        EV.text(ctx, name + (sgn > 0 ? '' : '′'), lx, ly + 4, { size: 11.5, weight: 600, align: 'center', color: col('ink-2') });
      });
    });
  }
  /** Two-pole magnet rotor at angle a (north pole direction). */
  function drawMagnetRotor(ctx, cx, cy, r, a) {
    const col = EV.col;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-a);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = col('surface'); ctx.fill(); ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r - 3, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = col('ink'); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r - 3, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fillStyle = col('axis'); ctx.fill();
    ctx.restore();
    const nx = cx + r * 0.52 * Math.cos(a), ny = cy - r * 0.52 * Math.sin(a);
    EV.text(ctx, 'N', nx, ny + 5, { size: 14, weight: 700, align: 'center', color: col('surface') });
    EV.text(ctx, 'S', cx - (nx - cx), cy - (ny - cy) + 5, { size: 14, weight: 700, align: 'center', color: col('ink') });
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fillStyle = col('surface'); ctx.fill();
  }

  EV.chapter({
    id: 'motor', n: '5', title: 'The electric motor', color: 's3',
    blurb: 'How three wires and a spinning magnetic field turn current into torque, why there are two kinds of motor in the car, and where the losses go.',
    lead: 'An electric motor has one moving part. Three sets of copper coils make a magnetic field that rotates without anything rotating, and a rotor follows it. This chapter builds that idea from the force on a single wire.',
    html(car) {
      const rpm100 = P.wOf(car, 100 / 3.6) * 30 / Math.PI;
      const wBase = car.pPeak / car.tPeak, vBase = P.vOf(car, wBase) * 3.6;
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>A current in a magnetic field feels a force, ${M`F = B I L`}. Every motor is an arrangement of that one effect.</li>
        <li>Three coils, 120° apart, fed with three currents 120° out of step, make a magnetic field of <strong>constant strength that rotates</strong>.</li>
        <li>A magnet rotor locks onto that field (synchronous motor). A plain conducting rotor is dragged by it with a small slip (induction motor).</li>
        <li>A spinning rotor generates a voltage of its own, the <strong>back-EMF</strong>, that grows with speed. It is why torque is constant at low speed and falls at high speed.</li>
        <li>The same machine is a generator: push the rotor faster than the field and power flows back.</li>
      </ul></div>

      <h2><span class="n">5.1</span>The force on a current</h2>
      <p>Moving charges in a magnetic field are pushed sideways (the Lorentz force). In a wire carrying current <em>I</em> through a field <em>B</em> over a length <em>L</em>, all those pushes add up to</p>
      ${eq(String.raw`F = B \, I \, L`, '<b>B</b> field in tesla · <b>I</b> current in amperes · <b>L</b> length of wire inside the field. The force is perpendicular to both the wire and the field.')}
      <div data-fig="lorentz"></div>
      <p>The reverse also holds. Move a wire through a field and a voltage appears along it: ${M`E = B L v`}. This is Faraday's law of induction, and it is the same physics seen from the wire's point of view. Hold on to that symmetry. It reappears in section 5.4 as the back-EMF, and it is the whole reason a motor can also be a generator.</p>
      <p>Put many such wires around a cylinder, arrange the field so each one is pushed the same way round, and you have torque. A real traction motor uses a field of about 0.8 T in the gap between stator and rotor, several hundred amperes, and enough turns of copper to produce ${fmt(car.tPeak / (car.motors || 1))} N·m per motor.</p>

      <h2><span class="n">5.2</span>A magnetic field that rotates</h2>
      <p>A coil carrying current is an electromagnet whose strength follows the current. Feed it alternating current and its field grows, shrinks, reverses, but always along the same line. One coil alone only makes a field that pulses back and forth.</p>
      <p>Now take three coils with their axes 120° apart around a ring, and feed them three alternating currents that peak one after another, a third of a cycle apart. At every instant the three pulsing fields add up to a single field of <em>constant</em> strength, 1.5 times one coil's peak, whose direction turns steadily around the ring. Nothing mechanical moves, yet the magnetic field rotates. This is the <em class="t">rotating magnetic field</em>, the idea Nikola Tesla patented in 1888.</p>
      <div data-fig="field"></div>
      <p>The field turns once per electrical cycle for each pair of poles. The Model Y's motors are wound with ${POLE_PAIRS} pole pairs, so the mechanical speed is</p>
      ${eq(String.raw`n = \frac{60 \, f}{p}`, '<b>n</b> rotor speed in rpm · <b>f</b> electrical frequency in Hz · <b>p</b> number of pole pairs (' + POLE_PAIRS + ')')}
      <p>At 100 km/h the wheels turn ${fmt(rpm100 / car.gear)} times a minute and the motor, through the ${car.gear}:1 gearbox, ${fmt(rpm100 / 10) * 10} times. The inverter is then producing three-phase current at ${fmt(rpm100 / 60 * POLE_PAIRS)} Hz. Speed is controlled by frequency, torque by the size of the current. Chapter 6 shows how the inverter makes both.</p>

      <h2><span class="n">5.3</span>Two ways to follow the field</h2>
      <p>Put a magnet inside the rotating field and it is dragged round with it, like a compass needle chasing a moving magnet. That is a <em class="t">permanent-magnet synchronous motor</em>. The rotor turns exactly as fast as the field, lagging behind by an angle that grows with load, the way a rubber band stretches as you pull harder.</p>
      <p>Put a plain cage of aluminium or copper bars there instead and something subtler happens. If the cage turned as fast as the field, nothing would change from the cage's point of view and nothing would happen. But if it lags, the field sweeps past the bars, induces currents in them (Faraday), and those currents feel a force in the field (Lorentz) that drags the cage along. That is an <em class="t">induction motor</em>. It must always run a little slower than the field: the difference is called <em class="t">slip</em>.</p>
      <div data-fig="rotors"></div>
      <div class="grid2">
        <div class="card"><h4>Rear: permanent-magnet rotor</h4><p>Neodymium magnets buried in a steel rotor. No current flows in the rotor, so no rotor heating: the most efficient choice for the motor that works all the time. The steel between the magnets is shaped so the rotor is also pulled round by plain magnetic attraction (reluctance torque), which adds torque at high speed.</p><p class="small">Drawback: the magnets never switch off. A spinning rotor always generates voltage and always causes some drag.</p></div>
        <div class="card"><h4>Front: induction rotor${car.drive === 'AWD' ? '' : ' (AWD cars only)'}</h4><p>A copper cage with no magnets. Slightly less efficient under load, because the rotor currents heat the cage by a fraction of the power equal to the slip. But with the stator switched off it is just a lump of metal spinning freely.</p><p class="small">That makes it ideal as the second motor: it coasts with almost no loss on the motorway and joins in when you ask for full power or traction.</p></div>
      </div>

      <h2><span class="n">5.4</span>Back-EMF: why torque fades with speed</h2>
      <p>A magnet rotor spinning inside copper coils is a generator whether you want it to be or not. It induces a voltage in the stator that opposes the supply and grows in proportion to speed, the <em class="t">back-EMF</em>. Motor torque and back-EMF are tied together by one constant <em>k</em>:</p>
      ${eq(String.raw`T = k \, I \quad\quad E = k \, \omega \quad\quad \Rightarrow \quad E \cdot I = T \cdot \omega`, 'Electrical power absorbed by the back-EMF equals mechanical power delivered. The motor is an exact converter; what is lost is lost in resistance and iron, not here.')}
      <p>The inverter can push current only while its voltage exceeds the back-EMF, and its voltage is capped by the battery. That creates two regimes:</p>
      <ul>
        <li><strong>Below the base speed</strong> (about ${fmt(vBase)} km/h for the ${car.name}) there is voltage to spare. Current, and therefore torque, is limited only by heating: <em class="t">constant torque</em>.</li>
        <li><strong>Above it</strong> the back-EMF would exceed the battery voltage. The inverter then shifts the timing of its currents so that part of the stator field opposes the magnets and holds the back-EMF down. This <em class="t">field weakening</em> lets the motor keep spinning faster, but less of the current makes torque. Torque falls roughly as 1/speed: <em class="t">constant power</em>.</li>
      </ul>
      <div data-fig="envelope"></div>
      <p>This shape, flat torque from zero and then a long plateau of power, is why the car needs no gears. A petrol engine makes useful power only in a narrow band of rpm and needs a gearbox to keep it there. The motor delivers its full power from ${fmt(vBase)} km/h to well past the legal limit in one fixed ratio.</p>

      <h2><span class="n">5.5</span>Where the losses go</h2>
      <p>The conversion ${M`E \cdot I = T \cdot \omega`} is perfect. The motor around it is not. Four mechanisms turn part of the input into heat:</p>
      <ul>
        <li><strong>Copper loss</strong>, ${M`I^2 R`}: current heating the windings. Proportional to torque squared, so it dominates at high torque and low speed.</li>
        <li><strong>Iron loss</strong>: the steel core is magnetised back and forth hundreds of times a second. Hysteresis and eddy currents heat it. Grows with speed.</li>
        <li><strong>Mechanical loss</strong>: bearings, seals, and air churned in the gap. Grows with speed.</li>
        <li><strong>Inverter loss</strong>: conduction and switching in the transistors (Chapter 6).</li>
      </ul>
      <p>The result is an efficiency that depends on where the motor is working. Engineers draw it as a map over speed and torque, with a broad island of high efficiency in the middle.</p>
      <div data-fig="effmap"></div>
      <div class="callout y"><h5>Reading the map</h5><p>Cruising sits low on the map, at small torque, where fixed losses (iron, bearings) are a visible share of a small output. Full-throttle launch sits top-left, where copper loss is enormous: the motor may be only 70–80% efficient there, but only for a second or two. The gear ratio is chosen so that everyday driving stays near the island.</p></div>`;
    },

    init(root, car) {
      /* ---------------------------------------------------------- F = BIL -- */
      const f = EV.fig(root, 'lorentz', { side: true, title: 'A wire between two magnet poles', hint: 'You are looking along the wire. A dot means current flowing toward you, a cross means away from you.' });
      const LC = EV.canvas(f.stage, { ratio: 0.5, minH: 220, maxH: 300, label: 'Wire in a magnetic field with a force arrow' });
      const LR = EV.readouts(f.out, { F: ['Force on the wire', 'N'], T: ['Torque on an 8 cm rotor', 'N·m'] });
      const ls = EV.controls(f.ctl, {
        B: { label: 'Magnetic field B', min: 0, max: 1.5, step: 0.05, value: 0.8, unit: 'T' },
        I: { label: 'Current I', min: -600, max: 600, step: 20, value: 300, unit: 'A' },
        L: { label: 'Length in the field L', min: 0.05, max: 0.3, step: 0.01, value: 0.15, unit: 'm' },
      }, lUpd);
      let lt = 0;
      function lUpd() { const F = ls.B * ls.I * ls.L; LR({ F: fmt(F, 1), T: fmt(F * 0.08, 1) }); }
      function lDraw(t, dt) {
        const { ctx, w, h } = LC, col = EV.col, cx = w / 2, cy = h / 2, pw = Math.min(90, w * 0.16), F = ls.B * ls.I * ls.L;
        lt += dt;
        ctx.clearRect(0, 0, w, h);
        // pole faces
        EV.rr(ctx, 14, 30, pw, h - 60, 8); ctx.fillStyle = col('ink'); ctx.fill();
        EV.rr(ctx, w - 14 - pw, 30, pw, h - 60, 8); ctx.fillStyle = col('axis'); ctx.fill();
        EV.text(ctx, 'N', 14 + pw / 2, cy + 9, { size: 26, weight: 700, align: 'center', color: col('surface') });
        EV.text(ctx, 'S', w - 14 - pw / 2, cy + 9, { size: 26, weight: 700, align: 'center', color: col('ink') });
        // field lines, more of them for a stronger field
        const n = Math.round(ls.B * 8);
        ctx.strokeStyle = EV.rgba('s7', 0.55); ctx.fillStyle = EV.rgba('s7', 0.8); ctx.lineWidth = 1.5;
        for (let i = 0; i < n; i++) {
          const y = 42 + (h - 84) * (i + 0.5) / n, x0 = 20 + pw, x1 = w - 20 - pw, ph = ((lt * 60 + i * 37) % 90);
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
          for (let x = x0 + ph; x < x1 - 8; x += 90) { ctx.beginPath(); ctx.moveTo(x + 7, y); ctx.lineTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill(); }
        }
        // the wire, nudged in the direction of the force
        const off = clamp(-F * 0.25, -h * 0.16, h * 0.16), wy = cy + off, r = 20;
        ctx.beginPath(); ctx.arc(cx, wy, r, 0, TAU); ctx.fillStyle = col('s2'); ctx.fill();
        ctx.strokeStyle = col('surface'); ctx.fillStyle = col('surface'); ctx.lineWidth = 3;
        if (ls.I > 0) { ctx.beginPath(); ctx.arc(cx, wy, 6, 0, TAU); ctx.fill(); }
        else if (ls.I < 0) { ctx.beginPath(); ctx.moveTo(cx - 8, wy - 8); ctx.lineTo(cx + 8, wy + 8); ctx.moveTo(cx + 8, wy - 8); ctx.lineTo(cx - 8, wy + 8); ctx.stroke(); }
        if (Math.abs(F) > 0.5) {
          const len = clamp(Math.abs(F) * 0.45, 12, h * 0.3), dir = F > 0 ? -1 : 1;
          EV.arrow(ctx, cx, wy + dir * (r + 4), cx, wy + dir * (r + 4 + len), col('ink'), 4, 12);
          EV.text(ctx, `F = ${fmt(Math.abs(F), 1)} N`, cx + 14, wy + dir * (r + 10 + len / 2), { size: 12.5, weight: 600, color: col('ink'), halo: true });
        }
        EV.text(ctx, 'field B →', 24 + pw, 24, { size: 11.5, color: col('muted') });
      }
      lUpd(); LC.draw = () => lDraw(0, 0); EV.loop(LC.cv, lDraw);

      /* ------------------------------------------------- rotating field ---- */
      const g = EV.fig(root, 'field', { side: true, title: 'Three currents make one rotating field', hint: 'Left: the three phase currents. Right: the stator from the end, each coil\'s field as a coloured arrow and their sum as the black arrow.',
        cap: '<b>Try this.</b> Switch off two phases: the field only pulses along one line. Switch on two: it rotates, but lopsidedly. With all three it is a perfect circle. Then swap two phases and watch the direction reverse. That is how the car selects reverse gear.' });
      const FC = EV.canvas(g.stage, { ratio: 0.52, minH: 290, maxH: 400, label: 'Three sinusoidal currents and the rotating magnetic field they produce in the stator' });
      const FR = EV.readouts(g.out, { ang: ['Field direction', '°'], mag: ['Field strength', '× one coil'] });
      const fs = EV.controls(g.ctl, {
        speed: { label: 'Rotation speed', min: 0, max: 100, step: 5, value: 35, unit: '%' },
        ang: { label: 'Electrical angle (when stopped)', min: 0, max: 360, step: 2, value: 40, unit: '°' },
        a: { type: 'toggle', label: 'Phase A', value: true }, b: { type: 'toggle', label: 'Phase B', value: true }, c: { type: 'toggle', label: 'Phase C', value: true },
        swap: { type: 'toggle', label: 'Swap phases B and C', value: false },
        rotor: { type: 'toggle', label: 'Show a magnet rotor', value: true },
      }, () => { if (fs.speed === 0) th = fs.ang * Math.PI / 180; fDraw(0, 0); });
      let th = 40 * Math.PI / 180, rotA = 0, trail = [];
      function fDraw(t, dt) {
        const { ctx, w, h } = FC, col = EV.col;
        if (fs.speed > 0 && dt > 0) { th = (th + dt * fs.speed / 100 * 2.6) % TAU; }
        const on = [fs.a, fs.b, fs.c];
        const shift = fs.swap ? [0, 2, 1] : [0, 1, 2];
        const cur = [0, 1, 2].map((i) => Math.cos(th - shift[i] * TAU / 3));
        let bx = 0, by = 0;
        PH.forEach(([, , ax], i) => { if (on[i]) { bx += cur[i] * Math.cos(ax); by += cur[i] * Math.sin(ax); } });
        const mag = Math.hypot(bx, by), ang = Math.atan2(by, bx);
        ctx.clearRect(0, 0, w, h);
        // ---- left: waveforms
        const narrow = w < 520, pw = narrow ? w - 30 : w * 0.5 - 30, px0 = 22, py0 = 24, ph = narrow ? h * 0.3 : h - 62, mid = py0 + ph / 2, amp = ph / 2 - 6;
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px0, mid); ctx.lineTo(px0 + pw, mid); ctx.stroke();
        EV.text(ctx, 'phase currents', px0, 14, { size: 11.5, color: col('muted') });
        PH.forEach(([name, c], i) => {
          if (!on[i]) return;
          ctx.beginPath();
          for (let k = 0; k <= 90; k++) { const a = k / 90 * TAU, y = mid - amp * Math.cos(a - shift[i] * TAU / 3), x = px0 + pw * k / 90; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.strokeStyle = col(c); ctx.lineWidth = 2; ctx.stroke();
          const x = px0 + pw * th / TAU, y = mid - amp * cur[i];
          ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fillStyle = col('surface'); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = col(c); ctx.fill();
          EV.text(ctx, name, px0 + pw * ((shift[i] / 3 + 0.02) % 1) + 4, mid - amp - 0 + 12 + i * 0, { size: 12, weight: 700, color: col('ink') });
        });
        const cxl = px0 + pw * th / TAU;
        ctx.strokeStyle = col('muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cxl, py0); ctx.lineTo(cxl, py0 + ph); ctx.stroke();
        if (!narrow) { EV.text(ctx, '0°', px0, py0 + ph + 14, { size: 11, color: col('muted') }); EV.text(ctx, 'one electrical cycle', px0 + pw / 2, py0 + ph + 14, { size: 11, color: col('muted'), align: 'center' }); EV.text(ctx, '360°', px0 + pw, py0 + ph + 14, { size: 11, color: col('muted'), align: 'right' }); }
        // ---- right: stator
        const cx = narrow ? w / 2 : w * 0.76, cy = narrow ? h * 0.67 : h / 2, Ro = Math.min(narrow ? h * 0.3 : h * 0.43, w * (narrow ? 0.4 : 0.215)), Ri = Ro * 0.74, u = Ri * 0.56;
        drawStator(ctx, cx, cy, Ro, Ri, cur, on);
        if (fs.rotor) { if (dt > 0 || !rotA) rotA = ang - 0.3; drawMagnetRotor(ctx, cx, cy, Ri * 0.5, mag > 0.1 ? ang - 0.3 : rotA); }
        // trace of the tip of the resultant
        if (dt > 0) { trail.push([bx, by]); if (trail.length > 140) trail.shift(); } else if (fs.speed === 0) trail = [];
        ctx.strokeStyle = EV.rgba('ink', 0.3); ctx.lineWidth = 1.5; ctx.beginPath();
        trail.forEach(([x, y], i) => { const X = cx + x * u, Y = cy - y * u; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke();
        PH.forEach(([, c, ax], i) => { if (on[i]) EV.arrow(ctx, cx, cy, cx + cur[i] * u * Math.cos(ax), cy - cur[i] * u * Math.sin(ax), col(c), 3, 8, true); });
        EV.arrow(ctx, cx, cy, cx + bx * u, cy - by * u, col('ink'), 5, 13, true);
        FR({ ang: fmt(((ang * 180 / Math.PI) + 360) % 360), mag: fmt(mag, 2) });
        if (fs.speed > 0 && dt > 0 && Math.round(t * 10) % 2 === 0) fs.set('ang', Math.round(th * 180 / Math.PI / 2) * 2, true);
      }
      FC.draw = () => fDraw(0, 0); EV.loop(FC.cv, fDraw);

      /* ------------------------------------------------------ rotor types -- */
      const r = EV.fig(root, 'rotors', { side: true, title: 'Magnet rotor and cage rotor under load', hint: 'The black arrow is the rotating stator field. Add load and see how each rotor responds.',
        cap: '<b>What to look for.</b> The magnet rotor keeps perfect pace and only falls behind in <em>angle</em>. The cage rotor falls behind in <em>speed</em>: the field keeps overtaking it, and the bars glow where the induced current is largest.' });
      const RC = EV.canvas(r.stage, { ratio: 0.62, minH: 280, maxH: 400, label: 'Rotor following a rotating magnetic field' });
      const RR = EV.readouts(r.out, { ns: ['Field speed', 'rpm'], n: ['Rotor speed', 'rpm'], x: ['Lag', ''], loss: ['Rotor heating, share of power', '%'] });
      const rs = EV.controls(r.ctl, {
        type: { type: 'seg', label: 'Rotor', options: [['pm', 'Permanent magnet'], ['im', 'Induction cage']], value: 'pm' },
        load: { label: 'Load torque', min: 0, max: 100, step: 1, value: 40, unit: '%' },
      }, rUpd);
      let fa = 0, ra = 0;
      function rUpd() {
        if (rs.type === 'pm') { const d = Math.asin(rs.load / 100 * 0.94) * 180 / Math.PI; RR({ ns: '6 000', n: '6 000', x: fmt(d) + '° behind', loss: '0' }); }
        else { const sl = 0.004 + rs.load / 100 * 0.056; RR({ ns: '6 000', n: fmt(6000 * (1 - sl)), x: fmt(sl * 100, 1) + '% slip', loss: fmt(sl * 100, 1) }); }
      }
      function rDraw(t, dt) {
        const { ctx, w, h } = RC, col = EV.col, cx = w / 2, cy = h / 2 + 4, Ro = Math.min(h * 0.42, w * 0.3), Ri = Ro * 0.76, Rr = Ri * 0.8;
        const wf = 1.5;                                                   // visual field speed, rad/s
        fa = (fa + wf * dt) % TAU;
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.arc(cx, cy, Ri, 0, TAU, true); ctx.fillStyle = col('surface-2'); ctx.fill('evenodd');
        ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, TAU); ctx.stroke();
        for (let i = 0; i < 18; i++) { const a = i * TAU / 18; ctx.beginPath(); ctx.arc(cx + (Ro + Ri) / 2 * Math.cos(a), cy + (Ro + Ri) / 2 * Math.sin(a), (Ro - Ri) * 0.22, 0, TAU); ctx.fillStyle = EV.rgba('s2', 0.35); ctx.fill(); }
        if (rs.type === 'pm') {
          const d = Math.asin(rs.load / 100 * 0.94); ra = fa - d;
          drawMagnetRotor(ctx, cx, cy, Rr, ra);
          // the "rubber band": arc between field direction and the rotor's north pole
          ctx.beginPath(); ctx.arc(cx, cy, Rr + (Ri - Rr) / 2, -fa, -ra); ctx.strokeStyle = col('s4'); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
          EV.text(ctx, `load angle ${fmt(d * 180 / Math.PI)}°`, cx, cy + Ro + 18, { size: 12, weight: 600, align: 'center', color: col('ink') });
        } else {
          const sl = 0.004 + rs.load / 100 * 0.056;
          ra = (ra + wf * (1 - sl * 6) * dt) % TAU;                      // slip drawn 6x so the eye can follow it
          ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.fillStyle = col('surface'); ctx.fill(); ctx.strokeStyle = col('body-line'); ctx.stroke();
          for (let i = 0; i < 16; i++) {
            const a = ra + i * TAU / 16, x = cx + Rr * 0.84 * Math.cos(a), y = cy - Rr * 0.84 * Math.sin(a);
            const I = Math.sin(a - fa) * rs.load / 100;                   // induced current is largest in bars the field is cutting fastest
            ctx.beginPath(); ctx.arc(x, y, Rr * 0.085, 0, TAU);
            ctx.fillStyle = EV.mix('axis', 's2', clamp(Math.abs(I) * 1.2, 0, 1)); ctx.fill();
          }
          ctx.beginPath(); ctx.arc(cx + Rr * 0.6 * Math.cos(ra), cy - Rr * 0.6 * Math.sin(ra), 5, 0, TAU); ctx.fillStyle = col('ink-2'); ctx.fill();
          ctx.strokeStyle = col('axis'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, Rr * 0.6, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx + Rr * 0.6 * Math.cos(ra), cy - Rr * 0.6 * Math.sin(ra), 5, 0, TAU); ctx.fillStyle = col('ink-2'); ctx.fill();
          EV.text(ctx, 'grey dot: a mark on the rotor · slip drawn 6× larger than real', cx, cy + Ro + 18, { size: 11.5, align: 'center', color: col('muted') });
        }
        EV.arrow(ctx, cx, cy, cx + Ri * 0.98 * Math.cos(fa), cy - Ri * 0.98 * Math.sin(fa), col('ink'), 4.5, 13, true);
        EV.text(ctx, 'stator field', cx + (Ro + 8) * Math.cos(fa), cy - (Ro + 8) * Math.sin(fa) + 4, { size: 11.5, weight: 600, align: Math.cos(fa) > 0 ? 'left' : 'right', color: col('ink'), halo: true });
      }
      rUpd(); RC.draw = () => rDraw(0, 0); EV.loop(RC.cv, rDraw);

      /* --------------------------------------------- torque-speed envelope -- */
      const e = EV.fig(root, 'envelope', { side: true, title: 'What the motors can deliver at every speed', hint: 'Peak combined torque and mechanical power of the selected car against motor speed. Two graphs because they are two different quantities.' });
      const kKmh = P.vOf(car, Math.PI / 30) * 3.6;                         // km/h per rpm
      const rpmAxis = Math.ceil(P.wOf(car, car.vMax / 3.6) * 30 / Math.PI * 1.06 / 1000) * 1000;
      const tp = EV.plot(e.stage, { h: 200, x: { label: '', min: 0, max: rpmAxis, unit: 'rpm' }, y: { label: 'Peak torque at the motor shafts (N·m)', min: 0, max: 'auto', unit: 'N·m' }, legend: false, table: false });
      const pp = EV.plot(e.stage, { h: 230, x: { label: 'Motor speed (rpm) · road speed (km/h)', min: 0, max: rpmAxis, unit: 'rpm' }, x2: { label: 'km/h', k: kKmh }, y: { label: 'Peak mechanical power (kW)', min: 0, max: 'auto', unit: 'kW' }, legend: false });
      const ER = EV.readouts(e.out, { t: ['Torque available', 'N·m'], p: ['Power available', 'kW'], F: ['Force at the wheels', 'kN'], f: ['Electrical frequency', 'Hz'], rpm: ['Motor speed', 'rpm'], regime: ['Regime', ''] });
      const es = EV.controls(e.ctl, {
        v: { label: 'Road speed', min: 0, max: car.vMax, step: 1, value: 60, unit: 'km/h' },
        soc: { label: 'Battery state of charge', min: 5, max: 100, step: 5, value: 90, unit: '%' },
      }, eUpd);
      function eUpd() {
        const soc = es.soc / 100, rpmTop = P.wOf(car, car.vMax / 3.6) * 30 / Math.PI;
        const T = (rpm) => (rpm > rpmTop ? null : P.torqueMax(car, rpm * Math.PI / 30, soc));
        const tPts = EV.sample(T, 0, 18000, 180), pPts = tPts.map(([x, y]) => [x, y == null ? null : y * x * Math.PI / 30 / 1000]);
        const ref = EV.sample((rpm) => (rpm > rpmTop ? null : P.torqueMax(car, rpm * Math.PI / 30, 0.9)), 0, 18000, 180);
        const rpm = es.v / kKmh, w = rpm * Math.PI / 30, t = P.torqueMax(car, w, soc), base = car.pPeak * clamp(P.packOcv(car, soc) / P.packOcv(car, 0.9), 0.6, 1.05) / car.tPeak * 30 / Math.PI;
        const bands = [{ x0: 0, x1: base, color: 's4', alpha: 0.1, label: 'constant torque' }, { x0: base, x1: rpmTop, color: 's1', alpha: 0.07, label: 'field weakening' }];
        tp.set({ series: [{ name: 'Torque', color: 's3', pts: tPts, area: true }, { name: 'at 90% charge', color: 'muted', dash: true, pts: ref }], bands, vlines: [{ x: rpm }], points: [{ x: rpm, y: t, color: 's3', label: `${fmt(t)} N·m`, dy: 20 }] });
        pp.set({ series: [{ name: 'Power', color: 's4', pts: pPts, area: true }], bands: bands.map((b) => Object.assign({}, b, { label: '' })), vlines: [{ x: rpm }, { x: rpmTop, label: `top speed ${car.vMax} km/h`, color: 'muted' }], points: [{ x: rpm, y: t * w / 1000, color: 's4', label: `${fmt(t * w / 1000)} kW`, dy: 20 }] });
        ER({ t: fmt(t), p: fmt(t * w / 1000), F: fmt(t * car.gear * car.etaGear / car.rWheel / 1000, 1), f: fmt(rpm / 60 * POLE_PAIRS), rpm: fmt(Math.round(rpm / 10) * 10), regime: rpm < base ? 'constant torque' : 'constant power' });
      }
      eUpd();

      /* -------------------------------------------------- efficiency map ---- */
      const m = EV.fig(root, 'effmap', { side: true, title: 'Efficiency map of the motor and inverter', hint: 'Darker means more of the electrical input reaches the shaft. The black line is the torque limit. Place the operating point with the sliders, or hover the map.',
        cap: '<b>Try this.</b> Cruise at 50, 100 and 130 km/h on the flat and note where the point sits. Then add a 10% hill at 60 km/h: the point climbs into the island and the efficiency <em>improves</em>, even though the losses grow.' });
      const CLS = [0, 0.75, 0.85, 0.9, 0.93, 0.95, 0.96], NAMES = ['under 75%', '75–85%', '85–90%', '90–93%', '93–95%', '95–96%', 'over 96%'];
      const clsOf = (eta) => { let k = 0; for (let i = 0; i < CLS.length; i++) if (eta >= CLS[i]) k = i; return k; };
      const tMaxAxis = Math.ceil(car.tPeak * 1.08 / 50) * 50;
      const mp = EV.plot(m.stage, {
        h: 340, legend: false, table: false,
        x: { label: 'Motor speed (rpm) · road speed (km/h)', min: 0, max: rpmAxis, unit: 'rpm' }, x2: { label: 'km/h', k: kKmh },
        y: { label: 'Torque at the motor shafts (N·m)', min: 0, max: tMaxAxis, unit: 'N·m' },
        under(ctx, Pl) {
          const nx = 90, ny = 56, A = Pl.area(), cw = A.w / nx, chh = A.h / ny, cols = CLS.map((_, i) => EV.mix('seq-lo', 'seq-hi', i / (CLS.length - 1)));
          const rpmTop = P.wOf(car, car.vMax / 3.6) * 30 / Math.PI;
          for (let i = 0; i < nx; i++) {
            const rpm = (i + 0.5) / nx * rpmAxis, w = rpm * Math.PI / 30;
            if (rpm > rpmTop) break;
            const tm = P.torqueMax(car, w);
            for (let j = 0; j < ny; j++) {
              const T = (j + 0.5) / ny * tMaxAxis; if (T > tm) break;
              ctx.fillStyle = cols[clsOf(P.motorEff(car, T, w))];
              ctx.fillRect(A.x + i * cw, A.y + A.h - (j + 1) * chh, cw + 0.6, chh + 0.6);
            }
          }
        },
        tipExtra(x, y) { const w = x * Math.PI / 30; return y > 0 && y <= P.torqueMax(car, w) && x < P.wOf(car, car.vMax / 3.6) * 30 / Math.PI ? [['efficiency at ' + fmt(y) + ' N·m', fmt(P.motorEff(car, y, w) * 100, 1) + '%']] : []; },
      });
      const lg = EV.el(`<div class="legend" style="margin-top:6px"><span style="color:var(--muted)">Efficiency:</span></div>`);
      NAMES.forEach((n, i) => { const sp = EV.el(`<span><i class="box" data-i="${i}"></i>${n}</span>`); lg.appendChild(sp); });
      m.stage.appendChild(lg);
      const paintLegend = () => EV.$$('i', lg).forEach((el) => { el.style.background = EV.mix('seq-lo', 'seq-hi', +el.dataset.i / (CLS.length - 1)); });
      paintLegend(); EV.onTheme(paintLegend);
      const lossHost = document.createElement('div'); lossHost.style.marginTop = '12px'; m.stage.appendChild(lossHost);
      const lossBar = EV.segbar(lossHost, { title: 'Losses at the operating point', unit: 'W' });
      const MR = EV.readouts(m.out, { eta: ['Motor + inverter efficiency', '%'], T: ['Torque', 'N·m'], rpm: ['Motor speed', 'rpm'], pm: ['Mechanical power', 'kW'], pl: ['Total loss', 'kW'] });
      const ms = EV.controls(m.ctl, {
        v: { label: 'Road speed', min: 5, max: car.vMax, step: 1, value: 100, unit: 'km/h' },
        grade: { label: 'Road grade', min: 0, max: 15, step: 0.5, value: 0, unit: '%' },
        acc: { label: 'Acceleration', min: 0, max: 0.9, step: 0.02, value: 0, unit: 'g' },
      }, mUpd);
      function mUpd() {
        const v = ms.v / 3.6, mass = car.curb + 75, w = P.wOf(car, v);
        const rl = P.roadLoad(car, { v, grade: ms.grade / 100, mass });
        const Fw = rl.total + mass * car.rot * ms.acc * P.G;
        const Tm = Math.min(Fw * car.rWheel / (car.gear * car.etaGear), P.torqueMax(car, w));
        const L = P.motorLoss(car, Tm, w), rpm = w * 30 / Math.PI;
        const line = EV.sample((x) => { const vv = P.vOf(car, x * Math.PI / 30); return vv * 3.6 > car.vMax ? null : P.roadLoad(car, { v: vv, mass }).total * car.rWheel / (car.gear * car.etaGear); }, 100, 18000, 120);
        mp.set({
          series: [{ name: 'Torque limit', color: 'ink', pts: EV.sample((x) => (P.vOf(car, x * Math.PI / 30) * 3.6 > car.vMax ? null : P.torqueMax(car, x * Math.PI / 30)), 0, 18000, 180), w: 2.5 },
            { name: 'Steady cruising on a flat road', color: 'ink', dash: true, pts: line, w: 1.5 }],
          points: [{ x: rpm, y: Tm, color: 's4', r: 6, label: `${fmt(P.motorEff(car, Tm, w) * 100, 1)}%` }],
        });
        lossBar([{ label: 'Iron', value: L.fe, color: 's1' }, { label: 'Copper', value: L.cu, color: 's2' }, { label: 'Bearings + air', value: L.mech, color: 's3' }, { label: 'Inverter', value: L.inv, color: 's4' }], `${fmt(L.total / 1000, 2)} kW`);
        MR({ eta: fmt(P.motorEff(car, Tm, w) * 100, 1), T: fmt(Tm, 1), rpm: fmt(Math.round(rpm / 10) * 10), pm: fmt(Tm * w / 1000, 1), pl: fmt(L.total / 1000, 2) });
      }
      mUpd();
    },

    quiz: (car) => [
      { q: 'What do three coils fed with three-phase current produce inside the stator?', o: ['A field that pulses in strength along a fixed direction', 'A field of constant strength whose direction rotates', 'Three separate rotating fields', 'No net field: the three cancel'], a: 1, why: 'Each coil alone gives a pulsing field. Spaced 120° apart in both angle and timing, the three add to a vector of constant length (1.5 × one coil\'s peak) that turns once per cycle.' },
      { q: 'How does the car make the motor turn backwards?', o: ['A reverse gear in the gearbox', 'Reversing the battery polarity', 'Swapping the order in which two of the three phases are energised', 'Mechanically braking the rotor'], a: 2, why: 'Exchanging two phases reverses the direction in which the field rotates, and the rotor follows it. The inverter does this in software; there is no reverse gear.' },
      { q: 'Why must an induction motor\'s rotor turn slightly slower than the rotating field?', o: ['Friction slows it down', 'Without relative motion no current is induced in the rotor, so there is no torque', 'The magnets are weaker than the stator field', 'To keep the inverter cool'], a: 1, why: 'Rotor current comes from induction, which needs the field to be changing as seen from the rotor. At exactly synchronous speed the rotor sees a constant field, no current flows and torque is zero. Slip is not a defect; it is how the machine works.' },
      { q: `Above about ${fmt(P.vOf(car, car.pPeak / car.tPeak) * 3.6)} km/h the ${car.name}'s maximum torque falls. Why?`, o: ['The gearbox slips', 'Air resistance acts on the rotor', 'The back-EMF approaches the battery voltage, so less current can be pushed into the windings to make torque', 'The battery runs out of energy'], a: 2, why: 'Back-EMF grows with speed. Once it nears what the inverter can supply from the battery, the control weakens the field to keep the motor spinning. Torque then falls roughly as 1/speed while power stays about constant.' },
      { q: 'At a full-throttle launch from standstill the motor is very inefficient. Which loss dominates?', o: ['Iron loss', 'Bearing friction', 'Copper loss, I²R', 'Aerodynamic loss in the air gap'], a: 2, why: 'Torque needs current, and winding heat grows with current squared. At low speed the mechanical output (torque × speed) is still small, so the large copper loss is a big fraction of the input.' },
    ],
  });
})();
