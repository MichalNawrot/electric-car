/* ==========================================================================
   core.js — shared building blocks: DOM helpers, theme colours, maths
   typesetting, figure scaffolding, controls, canvases, animation loops,
   HTML bar charts and quizzes.
   ========================================================================== */
(function () {
  'use strict';
  const EV = (window.EV = window.EV || {});
  const { clamp } = EV.phys;

  /* ---------------------------------------------------------------- helpers */
  EV.$ = (sel, root) => (root || document).querySelector(sel);
  EV.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  EV.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  /** Number formatting with a real minus sign and thin thousands separators. */
  EV.fmt = (x, d = 0) => {
    if (x == null || !isFinite(x)) return '–';
    const s = Math.abs(x).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 && +x.toFixed(d) !== 0 ? '−' : '') + s;
  };
  EV.range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  EV.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  EV.store = {
    get(k, d) { try { const v = localStorage.getItem('evp.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('evp.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  /* ----------------------------------------------------------------- scopes */
  // Everything a chapter creates registers a cleanup, so leaving the chapter stops its loops and observers.
  let scope = [];
  EV.onCleanup = (fn) => { scope.push(fn); };
  EV.cleanup = () => { const s = scope; scope = []; s.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); };

  /* ------------------------------------------------------------------ theme */
  const colCache = new Map();
  const themeFns = new Set();
  EV.col = (name) => {
    let v = colCache.get(name);
    if (!v) { v = getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#888'; colCache.set(name, v); }
    return v;
  };
  /** Token colour with alpha (tokens are hex). */
  EV.rgba = (name, a) => {
    const h = EV.col(name);
    if (h[0] !== '#') return h;
    const n = h.length === 4 ? h.slice(1).split('').map((c) => c + c).join('') : h.slice(1, 7);
    return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
  };
  /** Blend two token colours (t = 0 -> a, 1 -> b); returns rgb() string. */
  EV.mix = (a, b, t) => {
    const p = (name) => { const h = EV.col(name).slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
    const A = p(a), B = p(b);
    return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`;
  };
  EV.onTheme = (fn) => { themeFns.add(fn); EV.onCleanup(() => themeFns.delete(fn)); };
  EV.setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    EV.store.set('theme', t);
    colCache.clear();
    themeFns.forEach((f) => f());
  };
  EV.paused = false;

  /* ------------------------------------------------------------------ maths */
  // A small TeX-like notation -> MathML, so formulas are typeset by the browser with no library.
  const SYM = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', rho: 'ρ', omega: 'ω', Omega: 'Ω', phi: 'φ', Phi: 'Φ', pi: 'π', tau: 'τ', kappa: 'κ', epsilon: 'ε', sigma: 'σ', psi: 'ψ', ell: 'ℓ' };
  const OPS = { cdot: '·', times: '×', approx: '≈', propto: '∝', le: '≤', ge: '≥', ne: '≠', pm: '±', to: '→', sum: '∑', int: '∫', partial: '∂', infty: '∞', deg: '°', ll: '≪', gg: '≫', Rightarrow: '⇒' };
  const FN = { sin: 1, cos: 1, tan: 1, ln: 1, min: 1, max: 1, exp: 1, log: 1 };
  function tex(src) {
    let i = 0;
    const group = () => { if (src[i] === '{') { i++; const r = seq('}'); i++; return r; } return atom() || '<mrow></mrow>'; };
    const seq = (end) => { let o = ''; while (i < src.length && src[i] !== end) o += scripted(); return `<mrow>${o}</mrow>`; };
    const subgroup = () => {
      if (src[i] === '{') {
        const j = src.indexOf('}', i), inner = src.slice(i + 1, j);
        if (/^[A-Za-z0-9][A-Za-z0-9 ,.\-]+$/.test(inner) && /[A-Za-z]{2}/.test(inner)) { i = j + 1; return `<mtext>${EV.esc(inner)}</mtext>`; }
      }
      return group();
    };
    const scripted = () => {
      const base = atom();
      let sub = null, sup = null;
      while (src[i] === '_' || src[i] === '^') { if (src[i++] === '_') sub = subgroup(); else sup = group(); }
      if (sub && sup) return `<msubsup>${base}${sub}${sup}</msubsup>`;
      if (sub) return `<msub>${base}${sub}</msub>`;
      if (sup) return `<msup>${base}${sup}</msup>`;
      return base;
    };
    const atom = () => {
      const c = src[i];
      if (c === ' ' || c === '\n') { i++; return ''; }
      if (c === '{') return group();
      if (c === '\\') {
        const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i)); i += m[0].length; const n = m[1];
        if (n === 'frac') { const a = group(), b = group(); return `<mfrac>${a}${b}</mfrac>`; }
        if (n === 'sqrt') return `<msqrt>${group()}</msqrt>`;
        if (n === 'text') { const j = src.indexOf('}', i), t = src.slice(i + 1, j); i = j + 1; return `<mtext>${EV.esc(t).replace(/^ | $/g, ' ')}</mtext>`; }
        if (n === 'quad') return '<mspace width="1.2em"></mspace>';
        if (n === 'left' || n === 'right') return '';
        if (n === ',') return '<mspace width="0.25em"></mspace>';
        if (SYM[n]) return `<mi>${SYM[n]}</mi>`;
        if (FN[n]) return `<mi>${n}</mi>`;
        if (OPS[n]) return `<mo>${OPS[n]}</mo>`;
        return `<mtext>${EV.esc(n)}</mtext>`;
      }
      if (/[0-9]/.test(c)) { const m = /^[0-9]+([.,][0-9]+)?/.exec(src.slice(i)); i += m[0].length; return `<mn>${m[0]}</mn>`; }
      if (/[A-Za-z]/.test(c)) { i++; return `<mi>${c}</mi>`; }
      i++;
      return `<mo>${EV.esc({ '-': '−', '*': '·' }[c] || c)}</mo>`;
    };
    return seq(undefined);
  }
  EV.tex = tex;
  /** Inline maths: EV.M`F = m a` */
  EV.M = (s, ...v) => `<math>${tex(String.raw(s, ...v))}</math>`;
  /** Display equation with an optional "where ..." line of HTML. */
  EV.eq = (src, where) => `<div class="eq"><math display="block">${tex(src)}</math>${where ? `<span class="where">${where}</span>` : ''}</div>`;

  /* ---------------------------------------------------------------- figures */
  /** Fill a <div data-fig="id"> placeholder with the standard figure layout. */
  EV.fig = (root, id, o = {}) => {
    const host = EV.$(`[data-fig="${id}"]`, root);
    if (!host) throw new Error('missing figure placeholder: ' + id);
    host.classList.add('fig');
    if (o.side) host.classList.add('side');
    host.innerHTML = `<div class="fig-h"><div class="fig-tag">${o.tag || 'Interactive'}</div><h4>${o.title || ''}</h4>${o.hint ? `<p>${o.hint}</p>` : ''}</div>
      <div class="fig-body"><div class="fig-stage"></div><div class="fig-ctl"></div><div class="fig-out"></div></div>
      ${o.cap ? `<div class="fig-cap">${o.cap}</div>` : ''}`;
    return { host, stage: EV.$('.fig-stage', host), ctl: EV.$('.fig-ctl', host), out: EV.$('.fig-out', host), cap: EV.$('.fig-cap', host) };
  };

  /** Segmented button group. options: [[value, label], ...] */
  EV.seg = (options, value, onChange, label) => {
    const box = EV.el(`<div class="seg" role="group"${label ? ` aria-label="${EV.esc(label)}"` : ''}></div>`);
    const set = (v) => EV.$$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    options.forEach(([v, l]) => {
      const b = EV.el(`<button type="button" data-v="${EV.esc(v)}">${l}</button>`);
      b.addEventListener('click', () => { set(v); onChange(v); });
      box.appendChild(b);
    });
    set(value);
    box.set = set;
    return box;
  };

  /**
   * Build controls from a spec and keep a plain state object in sync.
   * spec: { key: { label, min, max, step, value, unit, fmt } | { type:'seg', options, value } | { type:'toggle', value } }
   */
  EV.controls = (host, spec, onChange) => {
    const s = {}, setters = {};
    Object.entries(spec).forEach(([key, d]) => {
      if (key === 'set') throw new Error('"set" is reserved: it is the method that changes a control from code');
      s[key] = d.value;
      const type = d.type || 'range';
      if (type === 'range') {
        const dec = d.dec != null ? d.dec : (String(d.step || 1).split('.')[1] || '').length;
        const lab = EV.el(`<label class="ctl"><span class="ctl-l">${d.label}</span><output class="ctl-v"></output><input type="range" min="${d.min}" max="${d.max}" step="${d.step || 1}" value="${d.value}"></label>`);
        const inp = EV.$('input', lab), out = EV.$('output', lab);
        const sync = () => {
          out.textContent = (d.fmt ? d.fmt(s[key]) : EV.fmt(s[key], dec)) + (d.unit ? ' ' + d.unit : '');
          inp.style.setProperty('--p', ((s[key] - d.min) / (d.max - d.min) * 100) + '%');
        };
        inp.addEventListener('input', () => { s[key] = +inp.value; sync(); onChange(s, key); });
        setters[key] = (v) => { s[key] = clamp(v, d.min, d.max); inp.value = s[key]; sync(); };
        sync();
        host.appendChild(lab);
      } else if (type === 'seg') {
        const lab = EV.el(`<div class="ctl segc"><span class="ctl-l">${d.label || ''}</span></div>`);
        if (!d.label) lab.firstElementChild.remove();
        const box = EV.seg(d.options, d.value, (v) => { s[key] = v; onChange(s, key); }, d.label);
        setters[key] = (v) => { s[key] = v; box.set(v); };
        lab.appendChild(box);
        host.appendChild(lab);
      } else if (type === 'toggle') {
        const lab = EV.el(`<label class="ctl tog"><input type="checkbox"${d.value ? ' checked' : ''}><span class="ctl-l">${d.label}</span></label>`);
        const inp = EV.$('input', lab);
        inp.addEventListener('change', () => { s[key] = inp.checked; onChange(s, key); });
        setters[key] = (v) => { s[key] = !!v; inp.checked = !!v; };
        host.appendChild(lab);
      }
    });
    Object.defineProperty(s, 'set', { value: (k, v, silent) => { setters[k](v); if (!silent) onChange(s, k); } });
    return s;
  };

  /** Readout tiles. spec: { key: [label, unit, colourToken?] }. Returns an update function. */
  EV.readouts = (host, spec) => {
    const els = {};
    Object.entries(spec).forEach(([k, [label, unit, color]]) => {
      const d = EV.el(`<div class="ro"><div class="ro-l">${color ? `<i style="background:var(--${color})"></i>` : ''}${label}</div><div class="ro-v"><span>–</span><small>${unit || ''}</small></div></div>`);
      host.appendChild(d);
      els[k] = EV.$('span', d);
    });
    return (vals) => { for (const k in vals) if (els[k]) els[k].textContent = vals[k]; };
  };

  /* ----------------------------------------------------------------- canvas */
  /** A HiDPI canvas that tracks its container width. Set C.draw, it is called on resize and theme change. */
  EV.canvas = (host, o = {}) => {
    const cv = document.createElement('canvas');
    if (o.label) { cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', o.label); }
    host.appendChild(cv);
    const C = { cv, ctx: cv.getContext('2d'), w: 0, h: 0, draw: null };
    let lastW = -1;
    const size = () => {
      const w = Math.max(220, Math.floor(host.clientWidth));
      if (w === lastW) return;
      lastW = w;
      const h = Math.round(o.ratio ? clamp(w * o.ratio, o.minH || 180, o.maxH || 560) : (o.h || 300));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.height = h + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      C.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      C.w = w; C.h = h;
      if (C.draw) C.draw();
    };
    const ro = new ResizeObserver(size);
    ro.observe(host);
    EV.onCleanup(() => ro.disconnect());
    EV.onTheme(() => C.draw && C.draw());
    size();
    return C;
  };

  /** Animation loop that only runs while its element is on screen. fn(t, dt) with seconds; dt = 0 while paused. */
  EV.loop = (el, fn) => {
    let raf = 0, last = 0, t = 0, visible = false, dead = false;
    const frame = (now) => {
      raf = 0;
      if (dead || !visible || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const adv = EV.paused ? 0 : dt;
      t += adv;
      try { fn(t, adv); } catch (e) { console.error(e); dead = true; return; }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) start(); }, { rootMargin: '60px' });
    io.observe(el);
    document.addEventListener('visibilitychange', start);
    EV.onCleanup(() => { dead = true; io.disconnect(); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', start); });
  };

  /* canvas drawing helpers ------------------------------------------------- */
  /** Arrow from (x0,y0) to (x1,y1). */
  EV.arrow = (ctx, x0, y0, x1, y1, color, w = 3, head = 10, halo = false) => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    if (halo) {   // surface-coloured outline so the arrow stays readable over dark fills
      const hx = dx / len, hy = dy / len;
      EV.arrow(ctx, x0, y0, x1 + hx * 2.5, y1 + hy * 2.5, EV.col('surface'), w + 4, head + 5);
    }
    const ux = dx / len, uy = dy / len, hd = Math.min(head, len * 0.6);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hd * 0.8, y1 - uy * hd * 0.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * hd - uy * hd * 0.55, y1 - uy * hd + ux * hd * 0.55);
    ctx.lineTo(x1 - ux * hd + uy * hd * 0.55, y1 - uy * hd - ux * hd * 0.55);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  EV.text = (ctx, s, x, y, o = {}) => {
    ctx.save();
    ctx.font = `${o.weight || 500} ${o.size || 12}px ${o.mono ? 'ui-monospace, Consolas, monospace' : 'system-ui, "Segoe UI", sans-serif'}`;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.halo) { ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = EV.col('surface'); ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || EV.col('ink-2');
    ctx.fillText(s, x, y);
    ctx.restore();
  };
  EV.rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };

  /* -------------------------------------------------------------- HTML bars */
  /** Horizontal bars. rows: [{ label, value, color, text, hi }]. Call again with new rows to update. */
  EV.bars = (host, o = {}) => {
    const box = EV.el('<div class="bars"></div>');
    host.appendChild(box);
    let n = -1;
    return (rows) => {
      const max = o.max || Math.max(1e-9, ...rows.map((r) => r.value)) * 1.0;
      if (rows.length !== n) {
        n = rows.length;
        box.innerHTML = rows.map(() => '<div class="bar"><div class="bar-l"></div><div class="bar-t"><div class="bar-f"></div><div class="bar-v"></div></div></div>').join('');
      }
      rows.forEach((r, i) => {
        const el = box.children[i];
        el.classList.toggle('hi', !!r.hi);
        el.children[0].textContent = r.label;
        const f = el.children[1].children[0];
        f.style.width = `calc(${clamp(r.value / max, 0, 1) * 100}% * 0.62)`;
        f.style.background = `var(--${r.color || 's1'})`;
        el.children[1].children[1].textContent = r.text != null ? r.text : EV.fmt(r.value, o.dec || 0) + (o.unit ? ' ' + o.unit : '');
      });
    };
  };

  /** One stacked bar + legend. parts: [{ label, value, color }]. Returns update(parts, totalText). */
  EV.segbar = (host, o = {}) => {
    const box = EV.el(`<div class="segbar-wrap"><div class="segbar-h"><span>${o.title || ''}</span><b></b></div><div class="segbar" role="img"></div><div class="legend"></div></div>`);
    host.appendChild(box);
    const [head, bar, leg] = box.children;
    let n = -1;
    return (parts, totalText) => {
      const pos = parts.map((p) => Math.max(0, p.value));
      const total = o.max || pos.reduce((a, b) => a + b, 0) || 1;
      if (parts.length !== n) {
        n = parts.length;
        bar.innerHTML = parts.map(() => '<i></i>').join('');
        leg.innerHTML = parts.map(() => '<span><i class="box"></i><em style="font-style:normal"></em></span>').join('');
      }
      parts.forEach((p, i) => {
        const seg = bar.children[i];
        seg.style.flex = `0 0 ${pos[i] / total * 100}%`;
        seg.style.display = pos[i] / total < 0.002 ? 'none' : 'block';
        seg.style.background = `var(--${p.color})`;
        seg.title = `${p.label}: ${p.text || EV.fmt(p.value, o.dec || 0) + ' ' + (o.unit || '')}`;
        leg.children[i].firstElementChild.style.background = `var(--${p.color})`;
        leg.children[i].lastElementChild.textContent = `${p.label} ${p.text || EV.fmt(p.value, o.dec || 0) + (o.unit ? ' ' + o.unit : '')}`;
      });
      head.lastElementChild.textContent = totalText || '';
      bar.setAttribute('aria-label', parts.map((p) => `${p.label} ${EV.fmt(p.value, o.dec || 0)} ${o.unit || ''}`).join(', '));
    };
  };

  /* ------------------------------------------------------------------- quiz */
  /** Multiple-choice self-check. qs: [{ q, o: [options], a: index, why }] */
  EV.quiz = (root, chapterId, qs) => {
    const host = EV.$('[data-quiz]', root);
    if (!host) return;
    const saved = EV.store.get('quiz.' + chapterId, []);
    host.classList.add('quiz');
    host.innerHTML = `<h2>Check your understanding</h2><p>Answer from your mental picture first, then use the interactives above to check. Answers are saved in this browser.</p>
      ${qs.map((q, i) => `<div class="q" data-i="${i}"><div class="q-t">${i + 1}. ${q.q}</div><div class="q-o">${q.o.map((opt, j) => `<button type="button" data-j="${j}"><b>${'ABCD'[j]}</b><span>${opt}</span></button>`).join('')}</div><div class="q-w" hidden><b></b> ${q.why}</div></div>`).join('')}
      <div class="quiz-score"><span></span><button type="button" class="linkbtn">Reset answers</button></div>`;
    const score = EV.$('.quiz-score span', host);
    const paint = () => {
      let done = 0, right = 0;
      EV.$$('.q', host).forEach((qel, i) => {
        const pick = saved[i], q = qs[i], answered = pick != null;
        EV.$$('button', qel).forEach((b, j) => {
          b.disabled = answered;
          b.classList.toggle('right', answered && j === q.a);
          b.classList.toggle('wrong', answered && j === pick && j !== q.a);
        });
        const why = EV.$('.q-w', qel);
        why.hidden = !answered;
        if (answered) { done++; if (pick === q.a) right++; why.firstElementChild.textContent = pick === q.a ? 'Correct.' : 'Not quite.'; }
      });
      score.textContent = done ? `${right} of ${qs.length} correct${done < qs.length ? ` · ${qs.length - done} to go` : ''}` : '';
      if (done === qs.length) EV.markDone && EV.markDone(chapterId);
    };
    host.addEventListener('click', (e) => {
      const b = e.target.closest('.q-o button');
      if (b && !b.disabled) { saved[+b.closest('.q').dataset.i] = +b.dataset.j; EV.store.set('quiz.' + chapterId, saved); paint(); }
    });
    EV.$('.quiz-score button', host).addEventListener('click', () => { saved.length = 0; EV.store.set('quiz.' + chapterId, saved); EV.markDone && EV.markDone(chapterId, false); paint(); });
    paint();
  };

  /* --------------------------------------------------------------- chapters */
  EV.chapters = [];
  EV.chapter = (def) => { EV.chapters.push(def); };
})();
