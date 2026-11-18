/* Chapter 2 — Energy and range: the kWh, consumption vs speed, where the energy goes, hills as energy banks. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, G = P.G;

  EV.chapter({
    id: 'energy', n: '2', title: 'Energy and range', color: 's4',
    blurb: 'What a kilowatt-hour really is, why consumption has a sweet spot, and why hills cost less than you think.',
    lead: 'A battery is a tank of joules. Range is what remains after physics takes its cut: air, tyres, drivetrain losses and the comfort of the people inside. This chapter turns the forces of Chapter 1 into kilometres.',
    html(car) {
      const m = car.curb + 75, c100 = P.consumption(car, { v: 100 / 3.6 });
      const kwh = 3.6e6;
      let sweet = 20, wltpV = 60;
      for (let k = 12; k <= 120; k++) if (P.consumption(car, { v: k / 3.6 }).whkm < P.consumption(car, { v: sweet / 3.6 }).whkm) sweet = k;
      for (let k = 40; k <= 140; k++) if (P.range(car, { v: k / 3.6 }) >= car.pub.wltp) wltpV = k;      // steady speed with the same range as the WLTP figure
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>A kilowatt-hour is 3.6 million joules. Consumption in Wh/km is a force in disguise: resisting force ÷ 3.6, plus losses.</li>
        <li>Range = usable energy ÷ consumption. Nothing else.</li>
        <li>Loads that run on a clock (heating, electronics) cost more per km the slower you go. Loads that grow with speed (air) cost more the faster you go. The sum has a minimum.</li>
        <li>Height is a rechargeable energy store. A climb borrows energy and the descent pays most of it back.</li>
      </ul></div>

      <h2><span class="n">2.1</span>Getting a feel for the kilowatt-hour</h2>
      <p>Power is a rate, measured in watts (joules per second). Energy is an amount. Run one kilowatt for one hour and you have used one <em class="t">kilowatt-hour</em>: ${M`1 \text{ kWh} = 1000 \text{ W} \times 3600 \text{ s} = 3.6 \text{ MJ}`}. The ${car.name} carries ${car.usable} of them. Here is what a single one can do.</p>
      <div class="tiles">
        <div class="tile"><div class="k">Drive at 100 km/h</div><div class="v">${fmt(1000 / c100.whkm, 1)}<small>km</small></div><div class="d">at ${fmt(c100.whkm)} Wh/km</div></div>
        <div class="tile"><div class="k">Lift the car</div><div class="v">${fmt(kwh / (m * G))}<small>m</small></div><div class="d">straight up, ${M`E = m g h`}</div></div>
        <div class="tile"><div class="k">Accelerate it from rest to</div><div class="v">${fmt(Math.sqrt(2 * kwh / m) * 3.6)}<small>km/h</small></div><div class="d">${M`E = \frac{1}{2} m v^2`}, no losses</div></div>
        <div class="tile"><div class="k">Boil water in a 2 kW kettle for</div><div class="v">30<small>min</small></div><div class="d">about 9 litres from tap-cold</div></div>
        <div class="tile"><div class="k">Same energy as</div><div class="v">0.11<small>L petrol</small></div><div class="d">petrol holds about 8.9 kWh per litre</div></div>
      </div>
      <p>Notice how much mechanical work hides in one kilowatt-hour, and how little heat. The same energy that lifts two tonnes the height of a 50-storey tower only boils a few kettles. That asymmetry is why cabin heating matters so much in winter (Chapter 11) and why a petrol engine, which turns fuel into heat first, wastes most of it.</p>

      <h2><span class="n">2.2</span>Consumption and the sweet spot</h2>
      <p>The battery must supply the road load from Chapter 1, plus what the drivetrain loses on the way, plus everything that runs whether or not the car moves.</p>
      ${eq(String.raw`\frac{E}{d} = \frac{F_{road}}{\eta_{drive}} + \frac{P_{aux}}{v}`, '<b>F<sub>road</sub></b> road load · <b>η<sub>drive</sub></b> battery-to-wheel efficiency (about 0.9) · <b>P<sub>aux</sub></b> electronics and climate power · <b>v</b> speed')}
      <p>The second term is the interesting one. A constant ${fmt(car.auxW)} W of electronics costs ${fmt(car.auxW / 100)} Wh/km at 100 km/h but ${fmt(car.auxW / 10)} Wh/km at 10 km/h, because the slower you go the longer each kilometre takes. Meanwhile the air-drag term falls with the square of speed. Add them and the curve has a <em class="t">minimum</em>, at about ${sweet} km/h for this car. Turn on the heater and the minimum moves to a higher speed.</p>
      <div data-fig="range"></div>
      <div class="callout y"><h5>Why the official range is hard to reach on a motorway</h5>
        <p>The ${car.pub.wltp} km WLTP figure comes from a test cycle at 23 °C that averages only 46.5 km/h, with stops, gentle accelerations and a short phase up to 131 km/h. Its energy use works out the same as a steady ${wltpV} km/h on the curve above. A steady 130 km/h sits far to the right of that, where the same car needs ${fmt(P.consumption(car, { v: 130 / 3.6 }).whkm)} Wh/km and reaches about ${fmt(P.range(car, { v: 130 / 3.6 }))} km. The test is not wrong. It just measures a different point on the curve.</p></div>
      <h3>Rules of thumb you can now derive</h3>
      <ul>
        <li><strong>+10 km/h at motorway speed costs about ${fmt((P.consumption(car, { v: 130 / 3.6 }).whkm / P.consumption(car, { v: 120 / 3.6 }).whkm - 1) * 100)}% more energy</strong> (120 → 130 km/h). Drag dominates and scales with v².</li>
        <li><strong>A headwind is extra speed without the time saved.</strong> Drag depends on speed through the air: 110 km/h into a 20 km/h headwind has the drag, and the air energy per km, of 130 km/h.</li>
        <li><strong>Mass matters less than you expect at speed.</strong> It only enters through rolling resistance. Four passengers add roughly ${fmt((P.consumption(car, { v: 110 / 3.6, payload: 375 }).whkm / P.consumption(car, { v: 110 / 3.6 }).whkm - 1) * 100)}% at 110 km/h.</li>
      </ul>

      <h2><span class="n">2.3</span>Where the energy goes: electric versus petrol</h2>
      <p>An electric drivetrain converts electrical energy to mechanical energy directly, through magnetic fields. A combustion engine burns fuel to make hot gas and then extracts work from the heat, and the second law of thermodynamics limits how much of that heat can ever become work. The two diagrams use the same scale.</p>
      <div data-fig="flows"></div>
      <p>This efficiency gap is the reason electric cars work at all, because batteries are poor at storing energy by weight. Compare what a kilogram of each store holds, and then what each delivers to the wheels.</p>
      <div data-fig="density"></div>
      <p>Petrol stores roughly ${fmt(12000 / (car.gross * 1000 / car.packKg))} times more energy per kilogram than this battery pack. After the engine's losses the gap shrinks to about ${fmt(12000 * 0.22 / (car.gross * 1000 / car.packKg * 0.88))} times. The rest is closed by brute force: the car carries ${car.packKg} kg of battery where a petrol car carries 40 kg of fuel. That mass is the central design constraint of every electric car, and it is why efficiency (low drag, low rolling resistance, low losses) matters far more here than it ever did for combustion cars.</p>

      <h2><span class="n">2.4</span>Hills are an energy bank</h2>
      <p>Lifting the car stores <em class="t">potential energy</em>, ${M`E_p = m g h`}. For the ${car.name} with a driver, every 100 m of climb takes ${fmt(m * G * 100 / kwh, 2)} kWh, about ${fmt(m * G * 100 / kwh / car.usable * 100, 1)}% of the battery. A 1000 m mountain pass costs ${fmt(m * G * 1000 / kwh, 1)} kWh on top of normal driving.</p>
      <p>Unlike drag, that energy is not gone. On the way down gravity pushes the car, the motors act as generators, and most of the deposit comes back. A petrol car would turn it into brake heat.</p>
      <div data-fig="hill"></div>
      <div class="callout myth"><h5>Common misconception</h5><p>"Mountains destroy range." A climb drains the battery alarmingly fast, but a round trip over a pass costs only a little more than the same distance on the flat. On the way down, part of the stored energy pushes the car through the air directly and the rest flows back into the battery. What is truly lost is several percent in the drivetrain each way, plus anything the friction brakes had to absorb when the descent was too steep for regeneration alone.</p></div>`;
    },

    init(root, car) {
      /* ---------------------------------------------- range calculator ---- */
      const f = EV.fig(root, 'range', { side: true, title: 'Consumption and range calculator', hint: 'Energy drawn from the battery for each kilometre, split by where it ends up.',
        cap: '<b>Try this.</b> Find the speed of lowest consumption with climate off. Then set −10 °C and switch between heat pump and resistive heater: watch the sweet spot move right and the low-speed end of the curve lift.' });
      const plot = EV.plot(f.stage, { h: 300, x: { label: 'Speed (km/h)', min: 0, max: 200, unit: 'km/h' }, y: { label: 'Energy from the battery (Wh/km)', min: 0, max: 'auto', unit: 'Wh/km' } });
      const barHost = document.createElement('div'); barHost.style.marginTop = '10px'; f.stage.appendChild(barHost);
      const bar = EV.segbar(barHost, { title: 'Where each kilometre\'s energy goes at this speed', unit: 'Wh/km' });
      const R = EV.readouts(f.out, { c: ['Consumption', 'Wh/km'], r: ['Range, full to empty', 'km'], p: ['Battery power', 'kW'], t: ['Driving time', 'h'], best: ['Most efficient speed', 'km/h'], bestR: ['Range at that speed', 'km'] });
      const s = EV.controls(f.ctl, {
        speed: { label: 'Speed', min: 10, max: 200, step: 1, value: 110, unit: 'km/h' },
        temp: { label: 'Outside temperature', min: -20, max: 40, step: 1, value: 20, unit: '°C' },
        wind: { label: 'Headwind', min: -30, max: 30, step: 5, value: 0, unit: 'km/h' },
        load: { label: 'Passengers and cargo', min: 0, max: 450, step: 25, value: 75, unit: 'kg' },
        hvac: { type: 'seg', label: 'Cabin climate', options: [['off', 'Off'], ['heatpump', 'Heat pump'], ['resistive', 'Resistive']], value: 'off' },
        show: { type: 'seg', label: 'Graph shows', options: [['c', 'Consumption'], ['r', 'Range']], value: 'c' },
      }, update);
      function update() {
        const o = { tempC: s.temp, wind: s.wind / 3.6, payload: s.load, hvac: s.hvac };
        const at = (kmh) => P.consumption(car, Object.assign({ v: kmh / 3.6 }, o));
        const xs = EV.range(8, 200, 96), cs = xs.map(at), cur = at(s.speed);
        const eUse = car.usable * 1000 * P.usableTempFactor(s.temp);
        let best = 0; cs.forEach((c, i) => { if (c.whkm < cs[best].whkm) best = i; });
        if (s.show === 'c') {
          EV.$('.plot-y', plot.host).textContent = 'Energy from the battery (Wh/km)'; plot.opts.y.unit = 'Wh/km';
          plot.set({
            yMax: null,
            series: [
              { name: 'Tyres', color: 's2', stack: true, pts: xs.map((x, i) => [x, cs[i].parts.roll]) },
              { name: 'Air', color: 's1', stack: true, pts: xs.map((x, i) => [x, cs[i].parts.aero]) },
              { name: 'Drivetrain losses', color: 's5', stack: true, pts: xs.map((x, i) => [x, cs[i].parts.drivetrain]) },
              { name: 'Electronics and climate', color: 's7', stack: true, pts: xs.map((x, i) => [x, cs[i].parts.aux + cs[i].parts.hvac]) },
            ],
            vlines: [{ x: s.speed }], points: [{ x: s.speed, y: cur.whkm, label: `${fmt(cur.whkm)} Wh/km` }, { x: xs[best], y: cs[best].whkm, color: 'muted', r: 4, label: 'sweet spot', dy: 18 }],
          });
        } else {
          EV.$('.plot-y', plot.host).textContent = 'Range from a full battery (km)'; plot.opts.y.unit = 'km';
          plot.set({ yMax: null, series: [{ name: 'Range', color: 's1', area: true, pts: xs.map((x, i) => [x, eUse / cs[i].whkm]) }],
            vlines: [{ x: s.speed }], points: [{ x: s.speed, y: eUse / cur.whkm, label: `${fmt(eUse / cur.whkm)} km` }] });
        }
        bar([{ label: 'Tyres', value: cur.parts.roll, color: 's2' }, { label: 'Air', value: cur.parts.aero, color: 's1' }, { label: 'Drivetrain', value: cur.parts.drivetrain, color: 's5' }, { label: 'Electronics + climate', value: cur.parts.aux + cur.parts.hvac, color: 's7' }], `${fmt(cur.whkm)} Wh/km = ${fmt(cur.whkm / 10, 1)} kWh/100 km`);
        R({ c: fmt(cur.whkm), r: fmt(eUse / cur.whkm), p: fmt(cur.pBatt / 1000, 1), t: fmt(eUse / cur.pBatt, 1), best: fmt(xs[best]), bestR: fmt(eUse / cs[best].whkm) });
      }
      update();

      /* ------------------------------------------------ EV vs petrol flows -- */
      const g = EV.fig(root, 'flows', { tag: 'Energy flow · same scale', title: 'One hundred units of stored energy, two drivetrains', hint: 'Electric: computed for the selected car at 100 km/h. Petrol: typical mid-size car in mixed driving (US Department of Energy figures).' });
      const c = P.consumption(car, { v: 100 / 3.6 }), L = c.dt.loss, k = 100 / c.pBatt;
      g.stage.innerHTML = `<div class="small" style="margin:6px 0 2px"><b style="color:var(--ink)">Electric car</b> · energy leaving the battery</div>` + EV.art.sankey({
        input: { label: 'Battery', value: 100 }, unit: 'units', thick: 80,
        losses: [{ label: 'Motor + inverter heat', value: (L.cu + L.fe + L.mech + L.inv) * k, color: 's5' }, { label: 'Gearbox', value: L.gear * k, color: 's5' }, { label: 'Electronics', value: c.aux * k, color: 's7' }],
        out: { label: 'To the wheels', color: 's1' },
      }) + `<div class="small" style="margin:18px 0 2px"><b style="color:var(--ink)">Petrol car</b> · energy in the fuel</div>` + EV.art.sankey({
        input: { label: 'Fuel', value: 100 }, unit: 'units', thick: 80,
        losses: [{ label: 'Engine heat', value: 62, color: 's2' }, { label: 'Friction + pumping', value: 6, color: 's2' }, { label: 'Idling + accessories', value: 5, color: 's7' }, { label: 'Transmission', value: 5, color: 's5' }],
        out: { label: 'To the wheels', color: 's1' },
      });

      /* ---------------------------------------------------- energy density -- */
      const d = EV.fig(root, 'density', { tag: 'Comparison', title: 'Energy per kilogram of storage', hint: 'Left: what is stored. Right: what reaches the wheels after conversion losses.' });
      d.stage.innerHTML = '<div class="fig-row"><div><div class="small" style="margin-bottom:8px">Stored energy (Wh per kg)</div><div data-a></div></div><div><div class="small" style="margin-bottom:8px">Delivered to the wheels (Wh per kg)</div><div data-b></div></div></div>';
      const pack = car.gross * 1000 / car.packKg, cell = car.chem === 'LFP' ? 165 : 265;
      EV.bars(EV.$('[data-a]', d.stage), { unit: 'Wh/kg' })([
        { label: 'Petrol', value: 12000, color: 's2' }, { label: `Battery cell (${car.chem})`, value: cell, color: 's1' }, { label: 'Battery pack, this car', value: pack, color: 's1', hi: true }]);
      EV.bars(EV.$('[data-b]', d.stage), { unit: 'Wh/kg' })([
        { label: 'Petrol, 22% efficient', value: 12000 * 0.22, color: 's2' }, { label: 'Battery cell, 88%', value: cell * 0.88, color: 's1' }, { label: 'Battery pack, 88%', value: pack * 0.88, color: 's1', hi: true }]);

      /* ------------------------------------------------------------- hills -- */
      const h = EV.fig(root, 'hill', { title: 'Over the pass and down again', hint: 'Energy drawn from the battery along a climb and the matching descent, compared with the same distance on a flat road.',
        cap: '<b>Try this.</b> Make the descent steep and fast, then switch to a cold battery. The "wasted in friction brakes" readout fills: gravity is now delivering power faster than the cold cells may absorb it, and the discs must take the rest.' });
      const profile = EV.el('<svg viewBox="0 0 600 70" preserveAspectRatio="none" style="height:70px;padding:0 14px 0 48px;box-sizing:border-box" aria-hidden="true"><polygon points="0,68 300,6 600,68" fill="var(--s3)" fill-opacity=".18" stroke="var(--s3)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>');
      const cap2 = EV.el('<div class="small" style="text-align:center;margin:-46px 0 26px;position:relative"></div>');
      h.stage.append(profile, cap2);
      const hp = EV.plot(h.stage, { h: 250, x: { label: 'Distance (km)', min: 0, unit: 'km' }, y: { label: 'Energy drawn from the battery so far (kWh)', min: 0, max: 'auto', unit: 'kWh' } });
      const HR = EV.readouts(h.out, { up: ['Used on the climb', 'kWh', 's3'], dn: ['Recovered on the descent', 'kWh', 's6'], net: ['Round trip', 'kWh'], flat: ['Same distance, flat', 'kWh'], pen: ['Cost of the hill', 'kWh'], back: ['Extra versus flat road', '%'], fr: ['Wasted in friction brakes', 'kWh', 's8'] });
      const hs = EV.controls(h.ctl, {
        height: { label: 'Height of the pass', min: 100, max: 2500, step: 50, value: 1000, unit: 'm' },
        grade: { label: 'Gradient', min: 3, max: 14, step: 0.5, value: 7, unit: '%' },
        speed: { label: 'Speed', min: 30, max: 120, step: 5, value: 70, unit: 'km/h' },
        batt: { type: 'seg', label: 'Battery', options: [['w', 'Warm'], ['c', 'Cold: regeneration limited']], value: 'w' },
      }, hUpdate);
      function hUpdate() {
        const gr = hs.grade / 100, v = hs.speed / 3.6, Lkm = hs.height / Math.sin(Math.atan(gr)) / 1000;
        const up = P.consumption(car, { v, grade: gr }), fl = P.consumption(car, { v }), mass = car.curb + 75;
        // descent: gravity minus drag must be braked away; the motors take what the battery will accept, the discs take the rest
        const rlD = P.roadLoad(car, { v, grade: -gr, mass }), need = Math.max(0, -rlD.total);
        const lim = hs.batt === 'w' ? car.regenMax : P.regenLimitW(car, 0.6, -10);
        const Fr = Math.min(need, P.regenForce(car, v, mass, lim).F), Ffr = need - Fr;
        const pDn = (need > 0 ? P.drivetrain(car, -Fr, v).Pel : P.drivetrain(car, rlD.total, v).Pel) + car.auxW;
        const eUp = up.whkm * Lkm / 1000, eDn = pDn / v / 3.6 * Lkm / 1000, eFl = fl.whkm * Lkm / 1000;
        const fr = Ffr / 3.6 * Lkm / 1000;                                 // N -> Wh/km -> kWh over the descent
        hp.set({
          xMax: 2 * Lkm,
          series: [
            { name: 'Over the pass', color: 's3', pts: [[0, 0], [Lkm, eUp], [2 * Lkm, eUp + eDn]] },
            { name: 'Flat road, same distance', color: 'muted', dash: true, pts: [[0, 0], [2 * Lkm, 2 * eFl]] },
          ],
          points: [{ x: Lkm, y: eUp, color: 's3', label: `summit: ${fmt(eUp, 1)} kWh used` }, { x: 2 * Lkm, y: eUp + eDn, color: 's3', label: `${fmt(eUp + eDn, 1)} kWh`, align: 'left', dy: -12 }],
        });
        cap2.textContent = `summit ${fmt(hs.height)} m · ${fmt(Lkm, 1)} km up, ${fmt(Lkm, 1)} km down`;
        HR({ up: fmt(eUp, 1), dn: fmt(Math.max(0, -eDn), 1), net: fmt(eUp + eDn, 1), flat: fmt(2 * eFl, 1), pen: fmt(eUp + eDn - 2 * eFl, 1), back: '+' + fmt((eUp + eDn - 2 * eFl) / (2 * eFl) * 100), fr: fmt(fr, 1) });
      }
      hUpdate();
    },

    quiz: (car) => [
      { q: 'A car uses 150 Wh/km at 100 km/h. What average power is the battery delivering?', o: ['1.5 kW', '15 kW', '150 kW', '100 kW'], a: 1, why: 'Power = energy per distance × distance per time: 150 Wh/km × 100 km/h = 15 000 W. A hair-dryer is 2 kW; cruising takes about seven of them.' },
      { q: 'Why does consumption per km <em>rise</em> at very low speeds, for example in a traffic jam?', o: ['Air drag increases', 'The motor is less powerful', 'Always-on loads are spread over fewer kilometres', 'Rolling resistance grows sharply'], a: 2, why: 'Electronics and climate draw power per second, not per metre. The slower you go, the more seconds each kilometre takes, so their share per km grows as 1/v.' },
      { q: `You climb a 1000 m pass in the ${car.name} and descend the other side. Roughly how much of the ${fmt((car.curb + 75) * G * 1000 / 3.6e6, 1)} kWh of potential energy do you get back?`, o: ['None, it is lost as heat', 'About 10% flows back into the battery', 'Most of it: on a typical pass roughly half to three quarters flows back into the battery, and the rest pushes the car against drag on the way down', 'All of it flows back into the battery'], a: 2, why: 'Gravity returns the energy at the wheels. Some of it overcomes drag and rolling resistance during the descent (energy the battery would otherwise have supplied), and the remainder passes back through gearbox, motor and inverter into the battery. Only when the descent is steeper than the regeneration limit do friction brakes waste the excess.' },
      { q: `Petrol stores about ${fmt(12000 / (car.gross * 1000 / car.packKg))} times more energy per kilogram than this battery pack. Why are electric cars viable anyway?`, o: ['Electricity is cheaper', 'The electric drivetrain converts about four times more of its stored energy into motion, and regenerates when braking', 'Batteries are lighter than fuel tanks', 'Electric cars are much lighter overall'], a: 1, why: `Roughly 88% of battery energy reaches the wheels against about 20–25% of fuel energy. That cuts the gap from ${fmt(12000 / (car.gross * 1000 / car.packKg))}× to about ${fmt(12000 * 0.22 / (car.gross * 1000 / car.packKg * 0.88))}×, and a large, heavy pack covers the rest.` },
      { q: 'Driving 110 km/h into a 20 km/h headwind, the air-drag force is the same as driving in still air at…', o: ['110 km/h', '120 km/h', '130 km/h', '150 km/h'], a: 2, why: 'Drag depends on speed relative to the air: 110 + 20 = 130 km/h. The energy per km spent on air is the same as at 130 km/h in still air, but you arrive later.' },
    ],
  });
})();
