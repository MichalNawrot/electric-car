/* ==========================================================================
   app.js — page chrome and hash router. Loaded last, after every chapter
   has registered itself with EV.chapter({...}).
   ========================================================================== */
(function () {
  'use strict';
  const EV = window.EV, $ = EV.$, $$ = EV.$$;
  const main = $('#main'), toc = $('#toc'), crumb = $('#crumb');
  const PARTS = [
    ['', ['home']],
    ['What the car must overcome', ['forces', 'energy', 'aero', 'tires']],
    ['What makes it move', ['motor', 'inverter', 'battery', 'charging']],
    ['Putting it to work', ['accel', 'regen', 'thermal', 'sim']],
    ['Reference', ['ref']],
  ];
  const byId = (id) => EV.chapters.find((c) => c.id === id);
  const order = () => PARTS.flatMap((p) => p[1]).map(byId).filter(Boolean);
  let seen = new Set(EV.store.get('seen', [])), done = new Set(EV.store.get('done', []));
  let current = null;

  function buildToc() {
    toc.innerHTML = PARTS.map(([name, ids]) => {
      const items = ids.map(byId).filter(Boolean);
      if (!items.length) return '';
      return (name ? `<h6>${name}</h6>` : '') + items.map((c) => `<a href="#/${c.id}" data-id="${c.id}"><span class="n">${c.n || '·'}</span><span>${c.nav || c.title}</span><i class="tick"></i></a>`).join('');
    }).join('');
    paintToc();
  }
  function paintToc() {
    const chapters = order().filter((c) => c.quiz);
    $$('a', toc).forEach((a) => {
      const id = a.dataset.id;
      a.classList.toggle('seen', seen.has(id));
      a.classList.toggle('done', done.has(id));
      if (current && id === current.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      const state = done.has(id) ? 'quiz complete' : seen.has(id) ? 'visited' : 'not visited';
      $('.tick', a).title = state;
    });
    const nDone = chapters.filter((c) => done.has(c.id)).length;
    $('#progress-text').textContent = `${nDone} of ${chapters.length} chapter quizzes complete`;
    $('#progress-bar').style.width = (chapters.length ? nDone / chapters.length * 100 : 0) + '%';
  }
  EV.markDone = (id, yes = true) => {
    if (yes === done.has(id)) return;
    if (yes) done.add(id); else done.delete(id);
    EV.store.set('done', [...done]);
    paintToc();
  };

  function render(ch, keepScroll) {
    EV.cleanup();
    current = ch;
    const car = EV.car(), list = order(), i = list.indexOf(ch);
    const prev = list[i - 1], next = list[i + 1];
    const part = (PARTS.find((p) => p[1].includes(ch.id)) || [''])[0];
    const head = ch.custom ? '' : `<header class="ch-head"><div class="kicker">${ch.n ? 'Chapter ' + ch.n : 'Reference'}${part ? ' · ' + part : ''}</div><h1>${ch.title}</h1><p class="lead">${ch.lead || ''}</p></header>`;
    let body;
    try { body = ch.html(car); } catch (e) { console.error(e); body = `<div class="callout myth"><h5>Something broke</h5><p>${EV.esc(e.message)}</p></div>`; }
    main.innerHTML = `<article class="page" data-ch="${ch.id}">${head}${body}${ch.quiz ? '<section data-quiz></section>' : ''}
      <nav class="ch-nav" aria-label="Chapter">${prev ? `<a class="prev" href="#/${prev.id}"><span>← Previous</span><b>${prev.title}</b></a>` : '<i></i>'}${next ? `<a class="next" href="#/${next.id}"><span>Next →</span><b>${next.title}</b></a>` : ''}</nav></article>`;
    const root = main.firstElementChild;
    try { if (ch.init) ch.init(root, car); } catch (e) { console.error(e); root.prepend(EV.el(`<div class="callout myth"><h5>An interactive failed to start</h5><p>${EV.esc(e.message)}</p></div>`)); }
    if (ch.quiz) EV.quiz(root, ch.id, typeof ch.quiz === 'function' ? ch.quiz(car) : ch.quiz);
    document.title = (ch.id === 'home' ? '' : ch.title + ' — ') + 'Electric Car Physics';
    crumb.innerHTML = ch.id === 'home' ? '<b>Start here</b>' : `${ch.n ? 'Chapter ' + ch.n : 'Reference'} · <b>${ch.title}</b>`;
    if (!seen.has(ch.id)) { seen.add(ch.id); EV.store.set('seen', [...seen]); }
    paintToc();
    document.body.classList.remove('nav-open');
    if (!keepScroll) { window.scrollTo(0, 0); }
  }

  function route() {
    const id = location.hash.replace(/^#\/?/, '').split(/[?#]/)[0] || 'home';
    render(byId(id) || byId('home'));
  }

  /* chrome ---------------------------------------------------------------- */
  const variantBox = EV.seg(Object.values(EV.variants).map((v) => [v.key, v.name]), EV.store.get('variant', 'lr'), (k) => { EV.store.set('variant', k); EV.setVariant(k); }, 'Model Y variant');
  $('#variant').appendChild(variantBox);
  EV.setVariant(EV.store.get('variant', 'lr'));
  EV.onVariant(() => { const y = window.scrollY; render(current, true); window.scrollTo(0, y); });

  const themeBtn = $('#theme'), motionBtn = $('#motion');
  themeBtn.addEventListener('click', () => EV.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  const setPaused = (p) => {
    EV.paused = p;
    document.body.classList.toggle('paused', p);
    motionBtn.setAttribute('aria-pressed', String(p));
    motionBtn.title = p ? 'Animations paused — click to play' : 'Pause all animations';
    motionBtn.innerHTML = p ? '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
  };
  motionBtn.addEventListener('click', () => setPaused(!EV.paused));
  setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  $('#menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('.scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });

  buildToc();
  window.addEventListener('hashchange', route);
  route();
})();
