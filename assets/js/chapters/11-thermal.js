/* Chapter 11 — Thermal management: why heat is costly, the heat pump, winter range, heat routing, the battery's temperature window. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, { clamp } = P;
  const TAU = Math.PI * 2;

  const ROUTES = {            // heat paths between the five thermal "places"; each is drawn from source to sink
    air_hp: 'M210 180 H380', hp_air: 'M380 200 H210',
    hp_cab: 'M520 162 C610 162 600 75 690 75', cab_hp: 'M690 92 C620 92 620 176 520 176',
    hp_bat: 'M520 186 H690', bat_hp: 'M690 204 H520',
    dr_hp: 'M690 295 C600 295 610 214 520 214',
  };
  const MODES = {
    cold: { label: 'Cold start', on: ['air_hp', 'dr_hp', 'hp_cab', 'hp_bat'], text: 'Everything is cold. The heat pump pulls what it can from the outside air, and the motors are deliberately run inefficiently, making heat without torque, to add more. Heat goes to the cabin first and to the battery so it can accept regeneration.' },
    cruise: { label: 'Winter cruise', on: ['dr_hp', 'bat_hp', 'air_hp', 'hp_cab'], text: 'After some minutes the motors and battery are warm and produce a kilowatt or two of waste heat. The system collects it instead of rejecting it, so the cabin is heated largely with energy that was already lost.' },
    charge: { label: 'Fast charging', on: ['bat_hp', 'hp_air', 'hp_cab'], text: 'Hundreds of amps heat the cells by 10–20 kW. The refrigerant circuit works as a chiller, carrying that heat to the radiator. In winter part of it warms the cabin for free while you wait.' },
    precon: { label: 'Heading to a charger', on: ['dr_hp', 'hp_bat'], text: 'With a fast charger set as destination, the car warms its battery in advance. The motors generate heat on purpose and the system delivers it to the pack, so the cells arrive at 40–50 °C, ready for full power.' },
    summer: { label: 'Hot day', on: ['cab_hp', 'bat_hp', 'hp_air'], text: 'The same machine runs as an air conditioner. Heat is taken from the cabin and, when needed, from the battery, and rejected to the outside air through the radiator.' },
  };
  function routeSVG() {
    const box = (x, y, w, h, t, s, tint) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ${tint ? `fill="var(--${tint})" fill-opacity=".16" stroke="var(--${tint})" stroke-width="2"` : 'class="d-box"'}/><text class="d-txt b" x="${x + w / 2}" y="${y + h / 2 + (s ? -3 : 5)}" text-anchor="middle">${t}</text>${s ? `<text class="d-txt s" x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle">${s}</text>` : ''}`;
    return `<svg viewBox="0 0 900 370" role="img" aria-label="Heat flows between outside air, heat pump, cabin, battery and drive units">
      ${Object.entries(ROUTES).map(([k, d]) => `<g data-route="${k}" style="display:none"><path d="${d}" fill="none" stroke="var(--s2)" stroke-width="7" stroke-linecap="round" opacity=".28"/><path class="flowline" d="${d}" stroke="var(--s2)"/></g>`).join('')}
      ${box(50, 140, 160, 80, 'Outside air', 'through the radiator')}
      ${box(380, 130, 140, 100, 'Heat pump', 'compressor + valves', 's7')}
      ${box(690, 44, 160, 66, 'Cabin', 'people')}
      ${box(690, 162, 160, 66, 'Battery', 'likes 20–40 °C', 's1')}
      ${box(690, 268, 160, 66, 'Drive units', 'motors + inverters')}
      <text class="d-txt s" x="450" y="356" text-anchor="middle">Orange dots move in the direction heat is flowing.</text>
    </svg>`;
  }

  EV.chapter({
    id: 'thermal', n: '11', title: 'Heat and thermal management', nav: 'Heat management', color: 's2',
    blurb: 'Why heating is the electric car\'s weak spot, how a heat pump delivers three units of heat for one of electricity, and why the battery wants to be warm.',
    lead: 'A petrol engine throws away two thirds of its fuel as heat, so warming the cabin costs nothing. An electric drivetrain wastes almost nothing, and so has almost nothing to give. Every watt of warmth must be found somewhere.',
    html(car) {
      const c0 = P.climate(0), cm10 = P.climate(-10), base = P.consumption(car, { v: 100 / 3.6 });
      const r = (t, h) => P.range(car, { v: 100 / 3.6, tempC: t, hvac: h });
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>Heat is a costly form of energy to make from electricity. A resistive heater turns 1 kWh into 1 kWh of heat, no more.</li>
        <li>A <strong>heat pump</strong> does not make heat. It moves it from a cold place to a warm one, and moving takes less energy than making: typically 2–4 units of heat per unit of electricity.</li>
        <li>That ratio, the <strong>COP</strong>, is capped by thermodynamics at ${M`T_{hot} / (T_{hot} - T_{cold})`} and falls as the outside gets colder.</li>
        <li>Winter range loss has four separate causes: denser air, stiffer tyres, cabin heating, and a cold battery.</li>
        <li>The battery is the most temperature-sensitive part of the car. Power, charging speed and lifetime all depend on keeping it between about 20 and 40 °C.</li>
      </ul></div>

      <h2><span class="n">11.1</span>The price of warmth</h2>
      <p>Keeping a cabin at 21 °C when it is ${M`0 \, °\text{C}`} outside takes about ${fmt(c0.q / 1000, 1)} kW of heat in steady state, and ${fmt(cm10.q / 1000, 1)} kW at −10 °C. Most of it leaves through the glass and with the fresh air the ventilation must keep exchanging.</p>
      <p>Compare that with driving. At 100 km/h the ${car.name} needs ${fmt(base.pBatt / 1000, 1)} kW in total. A plain resistive heater at −10 °C would add ${fmt(cm10.pResistive / 1000, 1)} kW to that, ${fmt(cm10.pResistive / base.pBatt * 100)}% more, and in slow traffic the heater can easily draw more than the motor. That is the problem this chapter is about.</p>

      <h2><span class="n">11.2</span>The heat pump: moving heat uphill</h2>
      <p>Even at −10 °C the outside air is 263 degrees above absolute zero and full of thermal energy. The difficulty is that heat flows by itself only from hot to cold. A heat pump is a machine that forces it the other way, using a fluid that boils and condenses at convenient temperatures. It works in four steps:</p>
      <ol>
        <li><strong>Evaporate.</strong> Cold liquid refrigerant at low pressure, colder than the outside air, flows through a heat exchanger. Heat flows into it from the air and it boils.</li>
        <li><strong>Compress.</strong> An electric compressor squeezes the vapour. Compression raises its temperature far above cabin temperature. This is where the electrical work goes in.</li>
        <li><strong>Condense.</strong> The hot vapour passes through a second heat exchanger in the cabin air stream. It gives up its heat and condenses back to liquid.</li>
        <li><strong>Expand.</strong> The liquid passes through a narrow valve. Its pressure drops, part of it flashes to vapour, and its temperature plunges below that of the outside air. The cycle repeats.</li>
      </ol>
      <div data-fig="pump"></div>
      <p>Energy is conserved: the heat delivered equals the heat collected outside <em>plus</em> the electrical work of the compressor. The figure of merit is the <em class="t">coefficient of performance</em>,</p>
      ${eq(String.raw`\text{COP} = \frac{Q_{delivered}}{W_{electric}} \quad\quad \text{COP}_{max} = \frac{T_{hot}}{T_{hot} - T_{cold}}`, 'Temperatures in kelvin. The second expression is the Carnot limit, which no heat pump can exceed. Real machines reach roughly 40–50% of it.')}
      <p>The limit explains everything about heat-pump behaviour. The smaller the temperature lift, the better: lifting heat by 30 degrees is far cheaper than lifting it by 60. So efficiency is excellent in mild cold and fades in deep cold, where the car supplements it by making heat directly.</p>
      <div class="callout y"><h5>In the Model Y</h5><p>The Model Y was the first Tesla with a heat pump, in 2020. Its refrigerant and coolant circuits meet in one valve block, nicknamed the octovalve, that can connect any heat source to any heat sink. There is no separate resistive cabin heater: when more heat is needed than the outside air can give, the compressor and the motors are driven in deliberately lossy ways and their waste heat is collected.</p></div>

      <h2><span class="n">11.3</span>Where winter range goes</h2>
      <p>Cold costs range through four separate mechanisms, each already met in an earlier chapter.</p>
      <ul>
        <li><strong>Denser air</strong> (Chapter 3). Drag is proportional to air density: +11% at −10 °C.</li>
        <li><strong>Stiffer tyres</strong> (Chapter 4). Cold rubber loses more energy on each flex: roughly +0.6% rolling resistance per degree below 20 °C.</li>
        <li><strong>Cabin heating</strong>. A constant power, so it hurts most at low speed and on short trips.</li>
        <li><strong>A cold battery</strong> (Chapter 7). Higher internal resistance, less of the stored energy can be extracted, and regeneration is restricted until the cells warm up.</li>
      </ul>
      <div data-fig="winter"></div>
      <p>At a steady 100 km/h, once everything has warmed up, this model gives ${fmt(r(20, 'off'))} km at 20 °C, ${fmt(r(-10, 'heatpump'))} km at −10 °C with the heat pump, and ${fmt(r(-10, 'resistive'))} km with a resistive heater. The first minutes of any winter trip are the worst, because the cabin and the battery themselves must be warmed up. Preheating while still plugged in moves that cost from the battery to the grid.</p>

      <h2><span class="n">11.4</span>One thermal system, many jobs</h2>
      <p>Cabin, battery and drive units each have a preferred temperature and each sometimes has heat to spare or heat to find. Instead of three separate systems the car has one, which routes heat wherever it is useful.</p>
      <div data-fig="routes"></div>

      <h2><span class="n">11.5</span>The battery's comfort zone</h2>
      <p>Chemistry slows down in the cold and side reactions speed up in the heat. The cells are happiest in about the same range as people.</p>
      <div data-fig="window"></div>
      <ul>
        <li><strong>Too cold</strong>: internal resistance rises steeply, so peak power falls and charging current must be cut to avoid lithium plating. Below freezing the car may refuse fast charging until the pack has warmed.</li>
        <li><strong>Too hot</strong>: calendar ageing accelerates, and above about 55 °C the car limits power to protect the cells.</li>
        <li><strong>Heat from within</strong>: every ampere heats the cells by I²R. At a fast charger that is 10–20 kW of heat that has to be removed continuously, more than a household oven at full power, flowing out of the floor of the car.</li>
      </ul>`;
    },

    init(root, car) {
      /* ------------------------------------------------------- heat pump -- */
      const f = EV.fig(root, 'pump', { side: true, title: 'The heat-pump cycle', hint: 'Refrigerant circulating between the outside heat exchanger (left) and the cabin heat exchanger (right). Colour shows its temperature.',
        cap: '<b>Try this.</b> Lower the outside temperature and watch the COP fall toward 1. Then switch to the resistive heater, which makes the same heat from electricity alone.' });
      const C = EV.canvas(f.stage, { ratio: 0.58, minH: 290, maxH: 400, label: 'Refrigerant loop with compressor, condenser, expansion valve and evaporator' });
      const bh = document.createElement('div'); bh.style.margin = '6px 0 10px'; f.stage.appendChild(bh);
      const bar = EV.segbar(bh, { title: 'Where the cabin\'s heat comes from', unit: 'kW', dec: 1 });
      const cp = EV.plot(f.stage, { h: 200, x: { label: 'Outside temperature (°C)', min: -30, max: 15, unit: '°C' }, y: { label: 'COP: units of heat per unit of electricity', min: 0, max: 9 } });
      const R = EV.readouts(f.out, { cop: ['COP', ''], car: ['Carnot limit', ''], q: ['Heat the cabin needs', 'kW'], e: ['Electricity used', 'kW', 's1'], free: ['Heat taken from outside', 'kW', 's2'], pc: ['Extra energy at 100 km/h', '%'] });
      const s = EV.controls(f.ctl, {
        t: { label: 'Outside temperature', min: -30, max: 15, step: 1, value: -5, unit: '°C' },
        mode: { type: 'seg', label: 'Heater', options: [['hp', 'Heat pump'], ['res', 'Resistive']], value: 'hp' },
      }, upd);
      let st = {};
      function upd() {
        const c = P.climate(s.t), hp = s.mode === 'hp', el = hp ? c.pHeatPump : c.pResistive, base = P.consumption(car, { v: 100 / 3.6, tempC: s.t }).pBatt;
        st = { c, hp, el };
        R({ cop: hp ? fmt(c.cop, 1) : '1.0', car: fmt(c.carnot, 1), q: fmt(c.q / 1000, 1), e: fmt(el / 1000, 1), free: fmt((c.q - el) / 1000, 1), pc: '+' + fmt(el / base * 100) });
        bar([{ label: 'Electricity', value: el / 1000, color: 's1' }, { label: 'Free heat from outside air', value: (c.q - el) / 1000, color: 's2' }], `${fmt(c.q / 1000, 1)} kW of heat`);
        cp.set({
          series: [{ name: 'Carnot limit', color: 'muted', dash: true, pts: EV.sample((x) => P.copHeat(x).carnot, -30, 15, 45) }, { name: 'Heat pump', color: 's2', pts: EV.sample((x) => P.copHeat(x).cop, -30, 15, 45), w: 2.5 }, { name: 'Resistive heater', color: 's1', pts: [[-30, 1], [15, 1]] }],
          vlines: [{ x: s.t }], points: [{ x: s.t, y: hp ? c.cop : 1, color: hp ? 's2' : 's1', label: `COP ${fmt(hp ? c.cop : 1, 1)}` }],
        });
      }
      const dots = Array.from({ length: 46 }, (_, i) => i / 46);
      function draw(t, dt) {
        const { ctx, w, h } = C, col = EV.col, hp = st.hp;
        ctx.clearRect(0, 0, w, h);
        const x0 = w * 0.3, x1 = w * 0.7, y0 = h * 0.2, y1 = h * 0.8, rr = 18;
        // outside and cabin zones
        ctx.fillStyle = EV.rgba('s1', 0.07); EV.rr(ctx, 8, 8, w * 0.36 - 8, h - 16, 12); ctx.fill();
        ctx.fillStyle = EV.rgba('s2', 0.08); EV.rr(ctx, w * 0.64, 8, w * 0.36 - 8, h - 16, 12); ctx.fill();
        EV.text(ctx, `Outside ${fmt(s.t)} °C`, 20, 28, { size: 12.5, weight: 600, color: col('ink') });
        EV.text(ctx, 'Cabin 21 °C', w - 20, 28, { size: 12.5, weight: 600, align: 'right', color: col('ink') });
        // loop path, counter-clockwise from the compressor at bottom centre
        const per = 2 * (x1 - x0) + 2 * (y1 - y0);
        const at = (u) => { let d = ((u % 1) + 1) % 1 * per; const half = (x1 - x0) / 2;
          if (d < half) return [w / 2 + d, y1]; d -= half;
          if (d < y1 - y0) return [x1, y1 - d]; d -= y1 - y0;
          if (d < x1 - x0) return [x1 - d, y0]; d -= x1 - x0;
          if (d < y1 - y0) return [x0, y0 + d]; d -= y1 - y0;
          return [x0 + d, y1]; };
        const uComp = 0, uCondA = (x1 - x0) / 2 / per, uCondB = uCondA + (y1 - y0) / per, uValve = uCondB + (x1 - x0) / 2 / per, uEvapA = uCondB + (x1 - x0) / per, uEvapB = uEvapA + (y1 - y0) / per;
        const tEv = s.t - 8, temp = (u) => {            // refrigerant temperature round the loop (°C)
          if (u < uCondA) return 75;
          if (u < uCondB) return 75 - 30 * (u - uCondA) / (uCondB - uCondA);
          if (u < uValve) return 42;
          if (u < uEvapB) return tEv;
          return tEv + 6; };
        const tint = (T) => (T > 20 ? EV.mix('muted', 's2', clamp((T - 20) / 45, 0, 1)) : EV.mix('muted', 's1', clamp((20 - T) / 40, 0, 1)));
        ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.strokeStyle = col(hp ? 'axis' : 'grid');
        EV.rr(ctx, x0, y0, x1 - x0, y1 - y0, rr); ctx.stroke();
        // heat exchangers (fins)
        ctx.lineWidth = 2; ctx.strokeStyle = col(hp ? 'body-line' : 'axis');
        for (let i = 0; i < 9; i++) { const y = y0 + (y1 - y0) * (0.14 + i * 0.09); ctx.beginPath(); ctx.moveTo(x0 - 17, y); ctx.lineTo(x0 + 17, y); ctx.moveTo(x1 - 17, y); ctx.lineTo(x1 + 17, y); ctx.stroke(); }
        if (hp) {
          const speed = 0.05 + st.c.q / 80000;
          for (let i = 0; i < dots.length; i++) { dots[i] = (dots[i] + dt * speed) % 1; const [x, y] = at(dots[i]); ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fillStyle = tint(temp(dots[i])); ctx.fill(); }
        }
        // compressor and expansion valve
        const comp = at(uComp), valve = at(uValve);
        ctx.beginPath(); ctx.arc(comp[0], comp[1], 21, 0, TAU); ctx.fillStyle = col('surface'); ctx.fill(); ctx.strokeStyle = col('s7'); ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = col('s7'); ctx.beginPath(); ctx.moveTo(comp[0] - 8, comp[1] - 9); ctx.lineTo(comp[0] + 10, comp[1]); ctx.lineTo(comp[0] - 8, comp[1] + 9); ctx.closePath(); ctx.fill();
        EV.text(ctx, 'compressor', comp[0], comp[1] + 38, { size: 11.5, weight: 600, align: 'center', color: col('ink') });
        ctx.fillStyle = col('surface'); ctx.strokeStyle = col('body-line'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(valve[0] - 15, valve[1] - 11); ctx.lineTo(valve[0] + 15, valve[1] + 11); ctx.lineTo(valve[0] + 15, valve[1] - 11); ctx.lineTo(valve[0] - 15, valve[1] + 11); ctx.closePath(); ctx.fill(); ctx.stroke();
        EV.text(ctx, 'expansion valve', valve[0], valve[1] - 18, { size: 11.5, weight: 600, align: 'center', color: col('ink') });
        EV.text(ctx, 'evaporator', x0 - 24, y0 - 6, { size: 11.5, weight: 600, align: 'right', color: col('ink') });
        EV.text(ctx, 'condenser', x1 + 24, y0 - 6, { size: 11.5, weight: 600, color: col('ink') });
        if (hp) {
          if (w >= 480) EV.text(ctx, 'hot gas', (w / 2 + x1) / 2, y1 + 22, { size: 11, align: 'center', color: col('ink-2') });
          if (w >= 480) EV.text(ctx, 'warm liquid', (w / 2 + x1) / 2 + 10, y0 + 20, { size: 11, align: 'center', color: col('ink-2') });
          if (w >= 480) EV.text(ctx, `cold mist ${fmt(tEv)} °C`, (w / 2 + x0) / 2 + 6, y0 + 20, { size: 11, align: 'center', color: col('ink-2') });
          if (w >= 480) EV.text(ctx, 'cool gas', (w / 2 + x0) / 2, y1 + 22, { size: 11, align: 'center', color: col('ink-2') });
          // heat in from outside, heat out to cabin, work in at the compressor
          const free = (st.c.q - st.el) / 1000, q = st.c.q / 1000, k = Math.min(18, (x0 - 50) / 5);
          for (let i = 0; i < 3; i++) { const y = y0 + (y1 - y0) * (0.28 + i * 0.22), ph = (t * 0.6 + i * 0.3) % 1; EV.arrow(ctx, x0 - 34 - free * k + ph * 6, y, x0 - 22 + ph * 6, y, col('s2'), 4, 10); EV.arrow(ctx, x1 + 22 + ph * 6, y, x1 + 34 + q * k + ph * 6, y, col('s2'), 4, 10); }
          EV.text(ctx, w < 480 ? `${fmt(free, 1)} kW in` : `${fmt(free, 1)} kW from the air`, 20, w < 480 ? y1 + 30 : y1 + 4, { size: 12, weight: 600, color: col('ink') });
          EV.text(ctx, w < 480 ? `${fmt(q, 1)} kW out` : `${fmt(q, 1)} kW into the cabin`, w - 20, w < 480 ? y1 + 30 : y1 + 4, { size: 12, weight: 600, align: 'right', color: col('ink') });
          EV.arrow(ctx, comp[0], h - 6, comp[0], comp[1] + 46, col('s1'), 4, 10);
          EV.text(ctx, `${fmt(st.el / 1000, 1)} kW electricity`, comp[0] + 10, h - 8, { size: 12, weight: 600, color: col('ink') });
        } else {
          const q = st.c.q / 1000, hx = x1 + 6, hy = h / 2;
          ctx.strokeStyle = col('s2'); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath();
          for (let i = 0; i <= 8; i++) { const yy = hy - 60 + i * 15, xx = hx + (i % 2 ? 16 : -16); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke();
          for (let i = 0; i < 3; i++) { const y = hy - 40 + i * 40, ph = (t * 0.6 + i * 0.3) % 1; EV.arrow(ctx, hx + 28 + ph * 6, y, hx + 40 + q * 14 + ph * 6, y, col('s2'), 4, 10); }
          EV.arrow(ctx, w / 2, hy, hx - 26, hy, col('s1'), 4, 10);
          EV.text(ctx, `${fmt(q, 1)} kW electricity in`, w / 2 - 8, hy + 4, { size: 12, weight: 600, align: 'right', color: col('ink'), halo: true });
          EV.text(ctx, `${fmt(q, 1)} kW of heat out`, w - 20, y1 + 4, { size: 12, weight: 600, align: 'right', color: col('ink') });
          EV.text(ctx, 'heat pump idle: a resistor turns current straight into heat', w / 2, h - 10, { size: 11.5, align: 'center', color: col('muted') });
        }
      }
      upd(); C.draw = () => draw(0, 0); EV.loop(C.cv, draw);

      /* ---------------------------------------------------------- winter -- */
      const g = EV.fig(root, 'winter', { side: true, title: 'Range against temperature', hint: 'Steady driving at the speed you choose. The bars compare where each kilometre\'s energy goes on a mild day and in your conditions.',
        cap: '<b>Try this.</b> Set −10 °C and compare 110 km/h with 40 km/h: at low speed the heater dominates. Then shorten the trip to 10 km and see what warming up from cold adds.' });
      const wp = EV.plot(g.stage, { h: 280, x: { label: 'Outside temperature (°C)', min: -25, max: 35, unit: '°C' }, y: { label: 'Range from a full battery (km)', min: 0, max: 'auto', unit: 'km' } });
      const b1 = document.createElement('div'), b2 = document.createElement('div'); b1.style.margin = '10px 0'; g.stage.append(b1, b2);
      const WR = EV.readouts(g.out, { c: ['Consumption', 'Wh/km'], r: ['Range', 'km'], loss: ['Range versus a 20 °C day', '%'], q: ['Cabin heat demand', 'kW'], e: ['Climate electricity', 'kW'] });
      const ws = EV.controls(g.ctl, {
        t: { label: 'Outside temperature', min: -25, max: 35, step: 1, value: -10, unit: '°C' },
        v: { label: 'Speed', min: 30, max: 150, step: 5, value: 100, unit: 'km/h' },
        hv: { type: 'seg', label: 'Cabin climate', options: [['heatpump', 'Heat pump'], ['resistive', 'Resistive'], ['off', 'Off']], value: 'heatpump' },
        trip: { label: 'Trip length, starting cold', min: 5, max: 300, step: 5, value: 100, unit: 'km' },
      }, wUpd);
      function wUpd() {
        const v = ws.v / 3.6;
        const warm = (t, hv) => { if (hv === 'off') return 0; const cabin = 0.03 * Math.max(0, 21 - t), batt = 0.04 * Math.max(0, 10 - t); return (cabin / (hv === 'resistive' ? 1 : P.copHeat(t).cop) + batt) * 1000 / ws.trip; };   // Wh/km, rough
        const cons = (t, hv) => { const c = P.consumption(car, { v, tempC: t, hvac: hv }); return { c, wh: c.whkm + warm(t, hv) }; };
        const rng = (t, hv) => car.usable * 1000 * P.usableTempFactor(t) / cons(t, hv).wh;
        const cur = cons(ws.t, ws.hv), ref = cons(20, 'off');
        wp.set({
          series: [{ name: 'No heating or cooling', color: 'muted', dash: true, pts: EV.sample((t) => rng(t, 'off'), -25, 35, 60) }, { name: 'Heat pump', color: 's2', pts: EV.sample((t) => rng(t, 'heatpump'), -25, 35, 60), w: ws.hv === 'heatpump' ? 3 : 1.6 }, { name: 'Resistive heater', color: 's1', pts: EV.sample((t) => rng(t, 'resistive'), -25, 35, 60), w: ws.hv === 'resistive' ? 3 : 1.6 }],
          vlines: [{ x: ws.t }], points: [{ x: ws.t, y: rng(ws.t, ws.hv), label: `${fmt(rng(ws.t, ws.hv))} km` }],
        });
        const parts = (o, extra) => [{ label: 'Tyres', value: o.c.parts.roll, color: 's2' }, { label: 'Air', value: o.c.parts.aero, color: 's1' }, { label: 'Drivetrain', value: o.c.parts.drivetrain, color: 's5' }, { label: 'Electronics, climate, warm-up', value: o.c.parts.aux + o.c.parts.hvac + extra, color: 's7' }];
        const max = Math.max(cur.wh, ref.wh);
        b1.textContent = ''; b2.textContent = '';
        EV.segbar(b1, { title: 'Mild day: 20 °C, climate off', unit: 'Wh/km', max })(parts(ref, 0), `${fmt(ref.wh)} Wh/km`);
        EV.segbar(b2, { title: `Your conditions: ${fmt(ws.t)} °C`, unit: 'Wh/km', max })(parts(cur, warm(ws.t, ws.hv)), `${fmt(cur.wh)} Wh/km`);
        const cl = P.climate(ws.t);
        WR({ c: fmt(cur.wh), r: fmt(rng(ws.t, ws.hv)), loss: fmt((rng(ws.t, ws.hv) / rng(20, 'off') - 1) * 100), q: fmt(Math.abs(cl.q) / 1000, 1), e: fmt(cur.c.hvac / 1000, 1) });
      }
      wUpd();

      /* ---------------------------------------------------------- routes -- */
      const k = EV.fig(root, 'routes', { tag: 'Interactive · heat routing', title: 'Where the heat goes in five situations', hint: 'One compressor, one set of valves, five different jobs.' });
      k.stage.innerHTML = routeSVG();
      const svg = k.stage.firstElementChild, info = EV.el('<div class="info" style="min-height:0"></div>');
      const show = (m) => { EV.$$('[data-route]', svg).forEach((el) => { el.style.display = MODES[m].on.includes(el.dataset.route) ? '' : 'none'; }); info.innerHTML = `<h5>${MODES[m].label}</h5><p style="margin:0">${MODES[m].text}</p>`; };
      k.ctl.style.gridTemplateColumns = '1fr';
      k.ctl.append(EV.seg(Object.entries(MODES).map(([key, m]) => [key, m.label]), 'cold', show, 'Situation'), info);
      show('cold');

      /* ---------------------------------------------------------- window -- */
      const a = EV.fig(root, 'window', { tag: 'Graph · illustrative', title: 'How much power the battery will give and take', hint: 'Fraction of full power the pack can deliver, and accept from a fast charger, against its own temperature.' });
      const ap = EV.plot(a.stage, { h: 260, x: { label: 'Battery temperature (°C)', min: -25, max: 60, unit: '°C' }, y: { label: 'Share of full power (%)', min: 0, max: 110, unit: '%' } });
      const hot = (t) => clamp(1 - (t - 50) / 14, 0.2, 1);
      ap.set({
        series: [{ name: 'Discharge: power to the motors', color: 's1', pts: EV.sample((t) => Math.min(100, 100 / P.tempRFactor(t)) * hot(t), -25, 60, 85) }, { name: 'Charge: power from a fast charger', color: 's6', pts: EV.sample((t) => P.interp(P.DC_TEMP, t) * 100 * (t > 55 ? clamp(1 - (t - 55) / 9, 0.3, 1) : 1), -25, 60, 85) }],
        bands: [{ x0: 20, x1: 40, color: 's6', alpha: 0.09, label: 'comfort zone' }],
      });
    },

    quiz: (car) => [
      { q: 'A heat pump delivers 3 kW of heat to the cabin while drawing 1 kW of electricity. Where do the other 2 kW come from?', o: ['Nowhere: it violates conservation of energy', 'From the outside air, which is cooled slightly', 'From the battery\'s chemical reactions', 'From friction in the compressor'], a: 1, why: 'A heat pump moves heat rather than creating it. Energy is conserved: heat delivered = heat collected from outside + electrical work. The outside air leaves the heat exchanger a little colder than it arrived.' },
      { q: 'Why does a heat pump become less efficient as the outside temperature falls?', o: ['The refrigerant freezes', 'The temperature difference it must lift heat across grows, and the theoretical limit T_hot/(T_hot − T_cold) shrinks', 'Cold air contains no heat', 'The battery supplies less voltage'], a: 1, why: 'Lifting heat through a bigger temperature difference takes more work per unit of heat, exactly as lifting water higher takes more work. Cold air still contains plenty of thermal energy; it is just harder to raise.' },
      { q: 'At −10 °C, which driving pattern loses the largest share of range to cabin heating?', o: ['A steady 130 km/h motorway run', 'A slow crawl through city traffic', 'They lose the same share', 'Fast charging'], a: 1, why: 'Heating is a constant power. Per kilometre it costs power ÷ speed, so the slower you travel the more kilometres\' worth of energy the heater consumes for each kilometre driven.' },
      { q: 'A petrol car heats its cabin at no extra fuel cost. Why can an electric car not do the same?', o: ['Electric cars have no heater', 'Its drivetrain is so efficient that it produces little waste heat', 'Batteries cannot power heaters', 'Regulations forbid it'], a: 1, why: 'An engine rejects about two thirds of its fuel energy as heat, far more than the cabin needs. An electric drivetrain loses only around a tenth, a kilowatt or two when cruising. The rest of the cabin\'s heat must be pumped or made.' },
      { q: 'Why does the car heat its battery on the way to a fast charger?', o: ['To increase range', 'Warm cells have lower resistance and absorb lithium faster, so they can accept full charging power safely', 'To dry the charge port', 'To reduce tyre wear'], a: 1, why: 'Charging current is limited by the risk of lithium plating and by I·R voltage rise, both of which are worse in cold cells. Arriving at 40–50 °C lets the pack follow its full charging curve.' },
    ],
  });
})();
