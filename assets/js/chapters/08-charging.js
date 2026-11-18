/* Chapter 8 — Charging: AC vs DC, the charging curve, why it tapers, losses, and road-trip strategy. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, { clamp } = P;

  const SOURCES = {
    s23: { name: 'Household socket', kw: 2.3, ac: true }, s11: { name: 'Wallbox 11 kW', kw: 11, ac: true },
    d50: { name: 'DC 50 kW', kw: 50 }, d150: { name: 'DC 150 kW', kw: 150 }, d250: { name: 'DC 250 kW', kw: 250 },
  };
  const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min` : `${Math.round(min)} min`);

  function pathSVG() {
    const box = (x, y, w, h, t, s, cls) => `<g class="${cls || ''}"><rect class="d-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text class="d-txt b" x="${x + w / 2}" y="${y + h / 2 + (s ? -3 : 5)}" text-anchor="middle">${t}</text>${s ? `<text class="d-txt s" x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle">${s}</text>` : ''}</g>`;
    const wave = (x0, x1, y) => { let d = `M${x0} ${y}`; for (let x = x0; x < x1; x += 20) d += ` q5 -9 10 0 q5 9 10 0`; return d; };
    return `<svg viewBox="0 0 900 330" role="img" aria-label="Two charging paths. AC: grid, wallbox, on-board charger, battery. DC: grid, fast-charger cabinet, battery.">
      <rect x="566" y="18" width="320" height="294" rx="18" fill="none" stroke="var(--body-line)" stroke-width="1.5" stroke-dasharray="6 6"/>
      <text class="d-txt s" x="726" y="38" text-anchor="middle">inside the car</text>
      <g data-row="ac">
        <text class="d-txt b" x="14" y="62">AC charging</text>
        <path d="${wave(120, 200, 100)}" fill="none" stroke="var(--s3)" stroke-width="3"/><path class="flowline" d="M120 100 H200" stroke="var(--s3)"/>
        <path d="${wave(330, 590, 100)}" fill="none" stroke="var(--s3)" stroke-width="3"/><path class="flowline" d="M330 100 H590" stroke="var(--s3)"/>
        <path d="M730 100 H770" stroke="var(--s1)" stroke-width="5" stroke-linecap="round"/><path class="flowline" d="M730 100 H770 V140" stroke="var(--s1)"/>
        <path d="M770 100 V140" stroke="var(--s1)" stroke-width="5" stroke-linecap="round"/>
        ${box(14, 72, 106, 56, 'Grid', '230 / 400 V AC')}${box(200, 72, 130, 56, 'Wallbox', 'a safe switch')}${box(590, 72, 140, 56, 'On-board charger', 'AC → DC · 11 kW max')}
      </g>
      <g data-row="dc">
        <text class="d-txt b" x="14" y="222">DC fast charging</text>
        <path d="${wave(120, 200, 260)}" fill="none" stroke="var(--s3)" stroke-width="3"/><path class="flowline" d="M120 260 H200" stroke="var(--s3)"/>
        <path d="M360 260 H770 V200" fill="none" stroke="var(--s1)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path class="flowline" d="M360 260 H770 V200" stroke="var(--surface)"/>
        ${box(14, 232, 106, 56, 'Grid', 'medium voltage')}${box(200, 232, 160, 56, 'Charger cabinet', 'AC → DC · up to 250 kW')}
      </g>
      <rect x="700" y="140" width="150" height="60" rx="8" fill="var(--s1)" fill-opacity=".18" stroke="var(--s1)" stroke-width="2"/>
      <text class="d-txt b" x="775" y="167" text-anchor="middle">Battery pack</text><text class="d-txt s" x="775" y="184" text-anchor="middle">accepts only DC</text>
      <g transform="translate(14 318)"><path d="M0 -4 q5 -9 10 0 q5 9 10 0" fill="none" stroke="var(--s3)" stroke-width="2.5"/><text class="d-txt s" x="28" y="0">alternating current</text><path d="M160 -4h24" stroke="var(--s1)" stroke-width="5" stroke-linecap="round"/><text class="d-txt s" x="192" y="0">direct current</text></g>
    </svg>`;
  }

  /** Whole-trip model: drive, stop when low, charge, repeat. Times in minutes. */
  function trip(car, D, kmh, o) {
    const c = P.consumption(car, { v: kmh / 3.6, tempC: 20 }), E = car.usable * 1000, perFrac = E / c.whkm;
    let remaining = D, reach = perFrac * (o.start - o.arr), tCharge = 0, stops = 0, kWh = 0;
    while (remaining > reach + 1e-6 && stops < 60) {
      remaining -= reach;
      const to = clamp(Math.min(o.dep, remaining / perFrac + o.arr), o.arr + 0.02, 1);
      const ses = P.chargeSession(car, { from: o.arr, to, charger: o.kw });
      tCharge += ses.minutes + 5; kWh += ses.kWh; stops++;
      reach = perFrac * (to - o.arr);
    }
    return { tDrive: D / kmh * 60, tCharge, stops, total: D / kmh * 60 + tCharge, whkm: c.whkm, kWh };
  }

  EV.chapter({
    id: 'charging', n: '8', title: 'Charging', color: 's6',
    blurb: 'AC or DC, why the last 20% takes so long, what limits the power, and how the chargers on your route decide the fastest way to drive a long trip.',
    lead: 'Charging is driving in reverse: push the lithium back uphill into the graphite. How fast that can happen is set by three things in turn. The source, the electronics, and finally the chemistry of the cells themselves.',
    html(car) {
      const c = P.consumption(car, { v: 110 / 3.6 }), kmPerKWh = 1000 / c.whkm;
      const s80 = P.chargeSession(car, { from: 0.1, to: 0.8 }), s100 = P.chargeSession(car, { from: 0.8, to: 1 });
      const plan = (kw, kmh) => trip(car, 800, kmh, { start: 1, arr: 0.1, dep: 0.65, kw }).total;
      const best = (kw) => { let b = 80; for (let k = 80; k <= 170; k += 2.5) if (plan(kw, k) < plan(kw, b)) b = k; return b; };
      const gain = (kw) => plan(kw, 100) - plan(kw, 130);                   // minutes saved by cruising at 130 instead of 100
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>A battery can only be charged with direct current. The question is <strong>where</strong> the AC from the grid is converted: in the car (AC charging, slow) or in the charger (DC charging, fast).</li>
        <li>Charging power = voltage × current, and time = energy ÷ power.</li>
        <li>Fast-charging power is not constant. It is highest on a nearly empty battery and <strong>tapers</strong> as the cells fill.</li>
        <li>The taper comes from the cells: a voltage ceiling that must not be exceeded, and a limit on how fast graphite can absorb lithium.</li>
        <li>On a long trip the quickest plan uses the fast bottom of the curve: arrive low, charge to about 60–70%, leave.</li>
      </ul></div>

      <h2><span class="n">8.1</span>AC or DC: where does the conversion happen?</h2>
      <p>The grid delivers alternating current. The cells need direct current at exactly the right voltage. Something must convert one into the other, and where that something sits decides everything about the charging speed.</p>
      <div data-fig="paths"></div>
      <p>With <strong>AC charging</strong> the converter is the on-board charger, a box of about 10 litres that had to be made light and cheap enough to carry around in every car. It handles 11 kW. A wallbox contains no converter at all. It is a contactor, a safety check and a signal that tells the car how much current the circuit allows.</p>
      <p>With <strong>DC fast charging</strong> the converter stays on the ground in a cabinet the size of a wardrobe, with its own grid connection and cooling. Its output goes straight to the pack terminals, bypassing the on-board charger. The car remains in charge: it tells the cabinet every fraction of a second exactly what voltage and current it wants.</p>
      <div class="tiles">
        <div class="tile"><div class="k">Household socket · 2.3 kW</div><div class="v">${fmt(2.0 * 0.92 * kmPerKWh)}<small>km per hour</small></div><div class="d">a full charge takes more than a day</div></div>
        <div class="tile"><div class="k">Wallbox · 11 kW</div><div class="v">${fmt(11 * 0.9 * kmPerKWh)}<small>km per hour</small></div><div class="d">empty to full overnight, ${fmt(P.chargeSession(car, { from: 0, to: 1, ac: true }).minutes / 60, 1)} h</div></div>
        <div class="tile"><div class="k">DC charger · 50 kW</div><div class="v">${fmt(50 * kmPerKWh)}<small>km per hour</small></div><div class="d">older roadside units</div></div>
        <div class="tile"><div class="k">Supercharger · ${car.dcPeak} kW peak</div><div class="v">${fmt(car.dcPeak * kmPerKWh / 10) * 10}<small>km per hour</small></div><div class="d">at the peak; it does not last</div></div>
      </div>
      <p class="small">Range added per hour of charging, at this car's motorway consumption of ${fmt(c.whkm)} Wh/km.</p>

      <h2><span class="n">8.2</span>The charging session</h2>
      <p>If power were constant, time would simply be energy divided by power: 10% to 80% of ${car.usable} kWh is ${fmt(0.7 * car.usable, 1)} kWh, and at ${car.dcPeak} kW that would take ${fmt(0.7 * car.usable / car.dcPeak * 60)} minutes. In reality it takes about ${fmt(s80.minutes)}, because the car asks for less and less power as the battery fills. Run a session and scrub through it.</p>
      <div data-fig="session"></div>
      <p>The last fifth is the slow part: 80% to 100% takes ${fmt(s100.minutes)} minutes, ${s100.minutes > s80.minutes * 1.12 ? 'longer than' : 'about as long as'} the whole of 10% to 80%. On AC the curve is flat almost to the end, because 11 kW is far below anything the cells would object to.</p>

      <h2><span class="n">8.3</span>Why the power tapers</h2>
      <p>Chapter 7 gave the relation between a cell's terminal voltage and its current. Charging reverses the sign: the terminal voltage sits <em>above</em> the resting voltage by I·R.</p>
      ${eq(String.raw`V = V_{oc}(\text{SoC}) + I \cdot R \le V_{max} \quad \Rightarrow \quad I \le \frac{V_{max} - V_{oc}(\text{SoC})}{R}`, '<b>V<sub>max</sub></b> the highest voltage the cells may ever see (' + (car.chem === 'LFP' ? '3.65' : '4.2') + ' V each, ' + fmt(car.s * (car.chem === 'LFP' ? 3.65 : 4.2)) + ' V for the pack)')}
      <p>As the cell fills, its resting voltage climbs toward the ceiling and the headroom for I·R shrinks. The permitted current falls with it. That one inequality already produces a taper. Engineers call the two phases <em class="t">constant current</em> (limited by something else) and <em class="t">constant voltage</em> (pinned at the ceiling while the current decays).</p>
      <p>The real limit is stricter still. Lithium arriving at the graphite faster than it can slide in between the layers piles up on the surface as metal instead. This <em class="t">lithium plating</em> permanently removes lithium from the cell and can grow into needles that pierce the separator. The risk rises when the graphite is nearly full and when the cell is cold, because both slow the insertion. So the car's requested power stays well below the simple voltage limit, and drops sharply in a cold battery.</p>
      <div data-fig="taper"></div>
      <div class="callout y"><h5>Preconditioning</h5><p>Navigate to a fast charger and the car starts heating its battery on the way, using the heat pump and deliberately inefficient motor operation, to arrive at 40–50 °C. Warm cells have lower resistance and faster lithium insertion, so they accept the full power. Arriving with a cold battery can easily double the stop.</p></div>

      <h2><span class="n">8.4</span>Losses and cables</h2>
      <p>Not all the energy you pay for ends up stored.</p>
      <ul>
        <li><strong>AC charging</strong> is about 88–92% efficient at 11 kW: the on-board charger loses a few percent, the cells a little more as I²R heat, and the car's computers and pumps draw roughly 200–300 W for as long as the session lasts. That fixed overhead is why a slow 2.3 kW charge is less efficient, around 80–85%: the same overhead is spread over much less charging power.</li>
        <li><strong>DC charging</strong> moves the converter losses to the charger's side of the meter. Inside the car the cells heat more, since current is 20 times higher, and the heat pump works to cool them.</li>
        <li><strong>The cable</strong> carries up to ${fmt(car.dcPeak * 1000 / (car.s * car.cellV))} A at peak. A plain copper cable for that current would be too heavy to handle, so Supercharger cables are thin and liquid-cooled. This is also the main argument for 800 V cars: the same cable and current deliver twice the power.</li>
      </ul>

      <h2><span class="n">8.5</span>The road-trip problem</h2>
      <p>On a trip longer than one battery, total time is driving time plus charging time, and the two pull in opposite directions. Drive faster and you spend less time on the road but burn energy with the square of speed (Chapter 1), which you must then buy back at the charger. And because of the taper, the energy is cheap in time at low charge and expensive near full.</p>
      <div data-fig="trip"></div>
      <p>Two robust lessons come out of the model. First, whatever the charger, arrive nearly empty and leave at 55–70%: many short stops beat a few long ones. Second, the weaker the chargers, the less it pays to drive fast, because every extra kilowatt-hour takes longer to replace. On an 800 km trip in this car, cruising at 130 instead of 100 km/h saves ${fmt(gain(250))} minutes with 250 kW chargers but only ${fmt(gain(50))} minutes with 50 kW ones, and the cruising speed that gives the shortest journey falls from ${best(250) >= 170 ? 'beyond 170' : 'about ' + fmt(best(250))} km/h to about ${fmt(best(50))} km/h.</p>`;
    },

    init(root, car) {
      /* ------------------------------------------------------------ paths -- */
      const f = EV.fig(root, 'paths', { tag: 'Diagram', title: 'Two routes from the grid to the cells', hint: 'The battery only ever sees DC. What differs is which box does the conversion and how big that box can be.' });
      f.stage.innerHTML = pathSVG();
      const svg = f.stage.firstElementChild, info = EV.el('<div class="info" style="min-height:0"></div>');
      const show = (k) => {
        EV.$$('[data-row]', svg).forEach((g) => { g.style.opacity = k === 'both' || g.dataset.row === k ? 1 : 0.22; });
        info.innerHTML = { both: '<p style="margin:0">Select a route to see its bottleneck.</p>',
          ac: '<p style="margin:0"><b style="color:var(--ink)">Bottleneck: the on-board charger.</b> It must fit in the car, so it is limited to 11 kW. A bigger wallbox changes nothing. Ideal for overnight charging at home, where time does not matter and electricity is cheapest.</p>',
          dc: `<p style="margin:0"><b style="color:var(--ink)">Bottleneck: the battery itself.</b> The cabinet can deliver ${car.dcPeak} kW and the cable is liquid-cooled. What limits the power is how fast the cells can safely absorb lithium, which is the subject of section 8.3.</p>` }[k];
      };
      f.ctl.style.gridTemplateColumns = '1fr';
      f.ctl.append(EV.seg([['both', 'Both'], ['ac', 'AC charging'], ['dc', 'DC fast charging']], 'both', show, 'Charging route'), info);
      show('both');

      /* ---------------------------------------------------------- session -- */
      const g = EV.fig(root, 'session', { side: true, title: 'Charging session simulator', hint: 'Top: power going into the battery over time. Bottom: state of charge. Drag the time slider, or press play.',
        cap: '<b>Try this.</b> Compare 10 → 80% with 10 → 100% on the fastest charger. Then try starting at 50%: the car never reaches peak power, because the cells are already too full to accept it.' });
      const p1 = EV.plot(g.stage, { h: 210, x: { label: '', min: 0, unit: 'min' }, y: { label: 'Power into the battery (kW)', min: 0, max: 'auto', unit: 'kW' }, legend: false, table: false });
      const p2 = EV.plot(g.stage, { h: 210, x: { label: 'Time since plugging in (minutes)', min: 0, unit: 'min' }, y: { label: 'State of charge (%)', min: 0, max: 100, unit: '%' }, legend: false });
      const GR = EV.readouts(g.out, { t: ['Total time', ''], e: ['Energy added', 'kWh'], avg: ['Average power', 'kW'], km: ['Range added', 'km'], now: ['Power at this moment', 'kW', 's1'], soc: ['Charge at this moment', '%'] });
      let ses = null, playing = false;
      const gs = EV.controls(g.ctl, {
        src: { type: 'seg', label: 'Charger', options: Object.entries(SOURCES).map(([k, v]) => [k, v.name]), value: 'd250' },
        from: { label: 'Start at', min: 0, max: 90, step: 5, value: 10, unit: '%' },
        to: { label: 'Stop at', min: 20, max: 100, step: 5, value: 80, unit: '%' },
        temp: { label: 'Battery temperature (DC only)', min: -10, max: 45, step: 1, value: 35, unit: '°C' },
        t: { label: 'Time', min: 0, max: 100, step: 0.5, value: 30, unit: '% of session' },
      }, (st, key) => { if (key !== 't') compute(); paint(); });
      const play = EV.el('<button type="button" class="btn pri">▶ Play the session</button>');
      play.addEventListener('click', () => { playing = !playing; if (playing && gs.t >= 100) gs.set('t', 0, true); play.textContent = playing ? '❚❚ Pause' : '▶ Play the session'; });
      g.ctl.appendChild(play);
      function compute() {
        const src = SOURCES[gs.src], from = gs.from / 100, to = Math.max(gs.to, gs.from + 5) / 100;
        ses = P.chargeSession(car, { from, to, charger: src.kw, ac: src.ac, tempC: gs.temp });
        if (src.ac && src.kw < 11) {   // household socket: the same on-board charger, limited by the socket
          const pw = (src.kw - 0.25) * 0.92, min = (to - from) * car.usable / pw * 60;
          ses = { t: [0, min], soc: [from * 100, to * 100], p: [pw, pw], minutes: min, kWh: (to - from) * car.usable, avgKW: pw };
        }
      }
      function paint() {
        const T = ses.minutes, tn = gs.t / 100 * T, unit = T > 180 ? 60 : 1, lab = T > 180 ? 'h' : 'min';
        const pts = (arr) => ses.t.map((x, i) => [x / unit, arr[i]]);
        const at = (arr) => P.interp(ses.t.map((x, i) => [x, arr[i]]), tn);
        p1.opts.x.unit = lab; p2.opts.x.unit = lab;
        EV.$('.plot-x', p2.host).textContent = `Time since plugging in (${T > 180 ? 'hours' : 'minutes'})`;
        p1.set({ xMax: T / unit, series: [{ name: 'Power', color: 's1', area: true, pts: pts(ses.p) }], vlines: [{ x: tn / unit }], points: [{ x: tn / unit, y: at(ses.p), color: 's1', label: `${fmt(at(ses.p), at(ses.p) < 20 ? 1 : 0)} kW` }] });
        p2.set({ xMax: T / unit, series: [{ name: 'State of charge', color: 's6', area: true, pts: pts(ses.soc) }], vlines: [{ x: tn / unit }], points: [{ x: tn / unit, y: at(ses.soc), color: 's6', label: `${fmt(at(ses.soc))}%`, dy: 18 }] });
        const kmPer = 1000 / P.consumption(car, { v: 110 / 3.6 }).whkm;
        GR({ t: hm(T), e: fmt(ses.kWh, 1), avg: fmt(ses.avgKW, ses.avgKW < 20 ? 1 : 0), km: fmt(ses.kWh * kmPer), now: fmt(at(ses.p), at(ses.p) < 20 ? 1 : 0), soc: fmt(at(ses.soc)) });
      }
      compute(); paint();
      EV.loop(g.host, (t, dt) => { if (!playing || dt === 0) return; const nt = gs.t + dt * 12; if (nt >= 100) { playing = false; play.textContent = '▶ Play the session'; gs.set('t', 100, true); } else gs.set('t', nt, true); paint(); });

      /* ------------------------------------------------------------ taper -- */
      const h = EV.fig(root, 'taper', { side: true, title: 'Where the taper comes from', hint: 'Dashed: the most the pack could take if the only rule were "never exceed the maximum cell voltage". Solid: what the car actually asks for.',
        cap: '<b>Try this.</b> Cool the battery to 0 °C. Internal resistance rises, so the voltage limit drops, and the plating limit drops further. The charger is the same; the cells have changed.' });
      const hp = EV.plot(h.stage, { h: 310, x: { label: 'State of charge (%)', min: 0, max: 100, unit: '%' }, y: { label: 'Charging power (kW)', min: 0, max: 400, unit: 'kW' } });
      const HR = EV.readouts(h.out, { v: ['Voltage-ceiling limit', 'kW'], c: ['Car requests', 'kW', 's1'], i: ['Current', 'A'], heat: ['Heat in the cells', 'kW', 's2'], r: ['Pack resistance', 'mΩ'], rate: ['Rate', 'C'] });
      const hs = EV.controls(h.ctl, {
        soc: { label: 'State of charge', min: 2, max: 99, step: 1, value: 50, unit: '%' },
        temp: { label: 'Battery temperature', min: -15, max: 45, step: 1, value: 35, unit: '°C' },
        kw: { type: 'seg', label: 'Charger', options: [['50', '50 kW'], ['150', '150 kW'], ['250', '250 kW']], value: '250' },
      }, hUpd);
      function hUpd() {
        const vmax = car.s * (car.chem === 'LFP' ? 3.65 : 4.2), R = P.packR(car, hs.temp), soc = hs.soc / 100;
        const vLim = (x) => { const i = Math.max(0, (vmax - P.packOcv(car, x)) / R); return i * vmax / 1000; };
        const req = (x) => Math.min(P.chargePower(car, x, { charger: +hs.kw, tempC: hs.temp }), vLim(x));
        const pw = req(soc), q = P.packAtPower(car, soc, -pw * 1000, hs.temp);
        hp.set({
          series: [{ name: 'Voltage-ceiling limit', color: 'muted', dash: true, pts: EV.sample((x) => vLim(x / 100), 0, 100, 100) }, { name: 'What the car requests', color: 's1', area: true, pts: EV.sample((x) => req(x / 100), 0, 100, 100) }],
          hlines: [{ y: +hs.kw, label: `charger limit ${hs.kw} kW` }], vlines: [{ x: hs.soc }], points: [{ x: hs.soc, y: pw, color: 's1', label: `${fmt(pw)} kW` }],
        });
        HR({ v: fmt(Math.min(999, vLim(soc))), c: fmt(pw), i: fmt(-q.I), heat: fmt(q.heat / 1000, 1), r: fmt(R * 1000), rate: fmt(-q.I / P.packAh(car), 1) });
      }
      hUpd();

      /* ------------------------------------------------------------- trip -- */
      const k = EV.fig(root, 'trip', { side: true, title: 'Road-trip planner', hint: 'Total journey time against cruising speed, for the charging strategy you choose. Start with a full battery, 20 °C, flat motorway, five minutes lost per stop.',
        cap: '<b>Try this.</b> With 250 kW chargers, find the cruising speed that gives the shortest journey. Then switch to 50 kW chargers: the best speed falls and the curve flattens, so hurrying buys much less. Finally compare leaving each stop at 60% with leaving at 100%.' });
      const kp = EV.plot(k.stage, { h: 300, x: { label: 'Cruising speed (km/h)', min: 80, max: 170, unit: 'km/h' }, y: { label: 'Journey time (hours)', min: 0, max: 'auto', unit: 'h' } });
      const barHost = document.createElement('div'); barHost.style.marginTop = '10px'; k.stage.appendChild(barHost);
      const kb = EV.segbar(barHost, { title: 'Where the time goes at this speed', unit: 'min' });
      const KR = EV.readouts(k.out, { tot: ['Journey time', ''], stops: ['Charging stops', ''], ch: ['Time charging', ''], avg: ['Average speed, door to door', 'km/h'], best: ['Fastest cruising speed', 'km/h'], e: ['Energy used', 'kWh'] });
      const ks = EV.controls(k.ctl, {
        D: { label: 'Trip distance', min: 200, max: 1500, step: 50, value: 800, unit: 'km' },
        v: { label: 'Cruising speed', min: 80, max: 170, step: 5, value: 130, unit: 'km/h' },
        kw: { type: 'seg', label: 'Chargers on the route', options: [['50', '50 kW'], ['150', '150 kW'], ['250', '250 kW']], value: '250' },
        arr: { label: 'Arrive at chargers with', min: 5, max: 30, step: 5, value: 10, unit: '%' },
        dep: { label: 'Leave chargers at', min: 40, max: 100, step: 5, value: 65, unit: '%' },
      }, kUpd);
      function kUpd() {
        const o = { start: 1, arr: ks.arr / 100, dep: Math.max(ks.dep, ks.arr + 15) / 100, kw: +ks.kw };
        const xs = EV.range(80, 170, 36), res = xs.map((x) => trip(car, ks.D, x, o)), cur = trip(car, ks.D, ks.v, o);
        let best = 0; res.forEach((r, i) => { if (r.total < res[best].total) best = i; });
        kp.set({
          series: [{ name: 'Total: driving + charging', color: 's1', pts: xs.map((x, i) => [x, res[i].total / 60]) }, { name: 'Driving only', color: 'muted', dash: true, pts: xs.map((x, i) => [x, res[i].tDrive / 60]) }],
          vlines: [{ x: ks.v }], points: [{ x: ks.v, y: cur.total / 60, color: 's1', label: hm(cur.total) }, { x: xs[best], y: res[best].total / 60, color: 'muted', r: 4, label: 'fastest', dy: 18 }],
        });
        kb([{ label: 'Driving', value: cur.tDrive, color: 's1' }, { label: 'Charging and stopping', value: cur.tCharge, color: 's6' }], hm(cur.total));
        KR({ tot: hm(cur.total), stops: String(cur.stops), ch: hm(cur.tCharge), avg: fmt(ks.D / (cur.total / 60)), best: fmt(xs[best]), e: fmt(ks.D * cur.whkm / 1000) });
      }
      kUpd();
    },

    quiz: (car) => [
      { q: 'You replace a 11 kW wallbox with a 22 kW one. How much faster does a Model Y charge?', o: ['Twice as fast', 'About 50% faster', 'No faster: the on-board charger is limited to 11 kW', 'It depends on the battery temperature'], a: 2, why: 'On AC, the conversion to DC happens in the car\'s on-board charger, which is rated at 11 kW. The wallbox is only a switch; offering more current than the charger can use changes nothing.' },
      { q: 'Why does a DC fast charger deliver less power at 80% than at 20%?', o: ['The charger overheats', 'The grid cannot supply the power for long', 'The cells\' voltage is near its ceiling and the graphite is nearly full, so the car requests less current to avoid over-voltage and lithium plating', 'To be fair to other drivers'], a: 2, why: 'The car, not the charger, sets the power. As resting voltage rises there is less headroom below the maximum cell voltage for the I·R drop, and lithium insertion into nearly full graphite slows down. Both force the current down.' },
      { q: `Charging the ${car.name} from 10% to 80% adds ${fmt(0.7 * car.usable, 1)} kWh in about ${fmt(P.chargeSession(car, { from: 0.1, to: 0.8 }).minutes)} minutes. The average power over the session is about…`, o: [`${car.dcPeak} kW`, `${fmt(0.7 * car.usable / (P.chargeSession(car, { from: 0.1, to: 0.8 }).minutes / 60) / 10) * 10} kW`, '50 kW', '11 kW'], a: 1, why: 'Average power = energy ÷ time. It is far below the peak because the peak is only held for the first few minutes.' },
      { q: 'A cold battery charges slowly mainly because…', o: ['Cold air cools the charging cable', 'Internal resistance is higher and lithium inserts into graphite more slowly, raising the risk of plating', 'The battery has less capacity when cold', 'The charger reduces power in winter'], a: 1, why: 'Both effects lower the current the cells can safely accept. That is why the car preheats the pack on the way to a fast charger.' },
      { q: 'On a long motorway trip with 250 kW chargers, which plan usually gives the shortest journey?', o: ['Charge to 100% at every stop to minimise the number of stops', 'Arrive at each charger nearly empty and leave at around 60–70%', 'Never go below 50%', 'Drive at 90 km/h to avoid charging'], a: 1, why: 'Charging power is highest at low state of charge. Using only the bottom part of the curve keeps the average charging power high, which more than pays for an extra stop.' },
    ],
  });
})();
