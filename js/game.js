// 炎上市 — ゲーム本体
(() => {
  'use strict';
  const { W, H, GROUND, R, circ } = PX;
  const LANE_MIN = 204, LANE_MAX = 222, RANGE = 180;
  const $ = s => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = n => Math.round(n).toLocaleString('ja-JP');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  PX.installIcons();
  const SPR = PX.buildSprites();
  const BG = PX.buildBackground();
  const FG = PX.buildForeground();
  const B = PX.BUILDINGS;

  const cv = $('#scene');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const mascotCtx = $('#mascot').getContext('2d');
  const spark = $('#spark'), sctx = spark.getContext('2d');
  const hud = $('#hud'), overlay = $('#overlay');

  const WAVES = [
    { name: '第1出動', sub: '話題の火元を消せ！', spawns: [0, 9, 18, 27], growth: 2.6, spread: 0.06, smolder: 0.5 },
    { name: '第2出動', sub: '延焼に注意！ 防火壁を使おう', spawns: [0, 5, 11, 11, 18, 25, 31], growth: 3.7, spread: 0.1, smolder: 0.5 },
    { name: '第3出動', sub: '大規模炎上！ 協力して鎮火せよ', spawns: [0, 0, 6, 10, 10, 16, 21, 21, 28, 33], growth: 4.7, spread: 0.13, smolder: 0.45 },
  ];
  const TRUCK = { x: 34, y: 224 };
  const GAPS = [0, 1, 2].map(i => ({ i, x: (B[i].x + B[i].w + B[i + 1].x) / 2 }));

  // ---------- 状態 ----------
  let S;
  function freshState(mode) {
    B.forEach(b => Object.assign(b, { fire: 0, peak: 0, topic: null, burnt: 0, overT: 0, smolder: 0, pending: null, lastHit: -9, lastHitByPlayer: -9 }));
    return {
      mode, t: 0, wave: -1, waveT: 0, spawnIdx: 0, hearts: 4, score: 0, walls: 3,
      activeWalls: [], topics: {}, topicQueue: shuffle(TOPICS), particles: [], water: [], smoke: [], embers: [],
      stats: { dispatch: 0, extinguished: 0, prevented: 0, invCount: 0, claimTotal: 0, claimRight: 0, quizTotal: 0, quizRight: 0, blocked: 0 },
      player: { x: 150, y: 214, dir: 1, aimX: 300, aimY: 140, spraying: false, walkT: 0, moving: false },
      crew: makeCrew(mode),
      waveClearT: 0, lastSpreadMsg: -9, paused: false,
    };
  }
  function makeCrew(mode) {
    if (mode === 'title') {
      return [
        { x: 128, y: 226, side: -1, static: true, idle: true, hose: true },
        { x: 156, y: 210, side: -1, aimDx: -24 },
        { x: 180, y: 200, side: -1, aimDx: -8 },
        { x: 204, y: 216, side: -1, aimDx: 6 },
        { x: 396, y: 208, side: 1, aimDx: 26 },
        { x: 432, y: 212, side: 1, aimDx: 30, idle: true },
        { x: 26, y: 232, side: -1, static: true, idle: true },
      ].map(c => Object.assign({ dir: 1, walkT: 0, target: null, spraying: false, rate: 60, power: 0 }, c));
    }
    return [
      { x: 150, y: 210 }, { x: 172, y: 220 }, { x: 194, y: 206 },
    ].map(c => Object.assign({ dir: 1, walkT: 0, target: null, spraying: false, rate: 40, power: 0.05, side: 1, offset: rand(40, 80), think: 0 }, c));
  }

  // ---------- 入力 ----------
  const keys = {};
  const pointer = { down: false, x: 0, y: 0 };
  addEventListener('keydown', e => {
    if (S.mode === 'modal' || S.mode === 'result') return;
    keys[e.code] = true;
    if (S.mode === 'play') {
      if (e.code === 'KeyE') investigateNearest();
      if (e.code === 'KeyF') placeWall();
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    } else if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault(); startGame();
    }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  function toLogical(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointerdown', e => { const p = toLogical(e); pointer.down = true; pointer.x = p.x; pointer.y = p.y; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { const p = toLogical(e); pointer.x = p.x; pointer.y = p.y; });
  const up = () => { pointer.down = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  $('#startBtn').onclick = startGame;
  $('#howBtn').onclick = () => showHowTo(false);
  $('#btnInvestigate').onclick = investigateNearest;
  $('#btnWall').onclick = placeWall;
  $('#pauseBtn').onclick = togglePause;
  $('#trendToggle').onclick = () => $('#trend').classList.toggle('collapsed');

  // ---------- 看板（HTML） ----------
  const signEls = B.map((b, i) => {
    const el = document.createElement('div');
    el.className = 'sign idle';
    const s = b.sign;
    el.style.left = (s.x / W * 100) + '%';
    el.style.top = (s.y / H * 100) + '%';
    el.style.width = (s.w / W * 100) + '%';
    el.style.height = (s.h / H * 100) + '%';
    el.addEventListener('pointerdown', e => { e.stopPropagation(); if (S.mode === 'play' && b.fire > 0) openInvestigation(b); });
    $('#signs').appendChild(el);
    return el;
  });
  function updateSigns() {
    B.forEach((b, i) => {
      const el = signEls[i], s = b.sign;
      let text = '', cls = 'sign idle';
      const tp = b.topic && S.topics[b.topic];
      if (tp && (b.fire > 0 || b.smolder > 0)) {
        text = tp.debunked ? 'デマと判明' : tp.def.tag;
        cls = 'sign' + (b.fire > 0 ? ' burning' : '') + (tp.investigated ? ' done' : '') + (tp.debunked ? ' debunked' : '');
      } else {
        text = b.name; cls = 'sign idle';
      }
      if (S.mode === 'title' && cls !== 'sign idle') cls += ' done';
      if (el.textContent !== text) {
        el.textContent = text;
        const wcq = s.w / W * 100, hcq = s.h / H * 56.25;
        el.style.fontSize = Math.min(wcq / Math.max(3.4, text.length * 1.12), hcq * 0.62) + 'cqw';
      }
      if (el.className !== cls) el.className = cls;
    });
  }

  // ---------- 話題（トピック） ----------
  function getTopic(def) {
    if (!S.topics[def.id]) {
      const base = Math.round(rand(2000, 9000));
      S.topics[def.id] = { def, posts: base, base, hist: [base], investigated: false, debunked: false, out: false, outT: 0, histT: 0 };
    }
    const tp = S.topics[def.id];
    tp.out = false;
    return tp;
  }
  function burningOf(tid) { return B.filter(b => b.topic === tid && b.fire > 0); }

  function ignite(b, def, f) {
    const tp = getTopic(def);
    b.topic = def.id; b.fire = f; b.peak = f; b.overT = 0; b.smolder = 0;
    S.stats.dispatch += (S.mode === 'play') ? 1 : 0;
  }

  function extinguish(b, byPlayer) {
    const tid = b.topic;
    b.fire = 0; b.peak = 0; b.overT = 0;
    if (S.mode !== 'play') return;
    S.stats.extinguished++;
    addScore(100);
    burst(b.cx, b.top + 20, 18, ['#ffffff', '#bfe8ff', '#8fd0ff']);
    const tp = S.topics[tid];
    if (tp && burningOf(tid).length === 0) {
      tp.out = true; tp.outT = S.t;
      announce(`${tp.def.tag} を鎮火しました！`, 'drop');
    }
  }

  // ---------- ゲーム進行 ----------
  function startGame() {
    S = freshState('play');
    overlay.classList.remove('show'); overlay.innerHTML = '';
    hud.classList.add('playing');
    startWave(0);
  }
  function startWave(i) {
    S.wave = i; S.waveT = 0; S.spawnIdx = 0; S.waveClearT = 0; S.mode = 'play';
    const w = WAVES[i];
    banner(`${w.name}！`, w.sub);
    announce(i === 0 ? '話題が急増！　消防隊が出動しました！' : `${w.name}！ ${w.sub}`);
  }
  function addScore(n) { S.score += n; }

  function scheduleSpawn() {
    const w = WAVES[S.wave];
    if (S.spawnIdx >= w.spawns.length || S.waveT < w.spawns[S.spawnIdx]) return;
    const free = B.filter(b => b.fire <= 0 && b.smolder <= 0);
    if (!free.length) return;
    const b = free[Math.floor(Math.random() * free.length)];
    if (!S.topicQueue.length) S.topicQueue = shuffle(TOPICS);
    b.pending = S.topicQueue.pop();
    b.topic = b.pending.id;
    b.patrol = 0;
    getTopic(b.pending);
    const first = S.spawnIdx === 0;
    S.spawnIdx++;
    if (!first && Math.random() < w.smolder) {
      b.smolder = 3.6;
      announce(`くすぶり発見！ ${b.pending.tag} — 建物の前でパトロールして未然に防ごう！`, 'search');
    } else {
      ignite(b, b.pending, first ? 40 : 50);
      announce(`${b.pending.tag} が炎上！ 消火せよ！`);
      b.pending = null;
    }
  }

  function update(dt) {
    S.t += dt;
    if (S.mode === 'play' && !S.paused) {
      S.waveT += dt;
      scheduleSpawn();
      updatePlayer(dt);
      updateFires(dt, WAVES[S.wave]);
      checkWaveClear(dt);
    } else if (S.mode === 'title') {
      updateTitleDemo(dt);
    }
    if (!S.paused && S.mode !== 'modal') {
      updateCrew(dt);
      updateParticles(dt);
      updateTopics(dt);
    }
  }

  function updateTitleDemo(dt) {
    const b = B[1];
    if (!b.topic) { b.topic = 'hatsugen'; getTopic(TOPICS[0]); b.peak = 100; }
    b.fire = 74 + Math.sin(S.t * 0.7) * 10;
    b.peak = 100;
    b.lastHit = S.t;
    const tp = S.topics.hatsugen;
    if (!tp.demo) {
      tp.demo = true; tp.base = 15000;
      tp.hist = Array.from({ length: 40 }, (_, i) => 2000 + 70000 * Math.pow(i / 39, 1.6) + Math.sin(i * 1.9) * 2500);
    }
    tp.posts = 72000 + S.t * 120;
  }

  function updatePlayer(dt) {
    const p = S.player;
    let mx = 0, my = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
    p.spraying = false;
    if (pointer.down) {
      p.aimX = pointer.x; p.aimY = pointer.y;
      p.spraying = true;
      // 届かないときは近づく
      const handX = p.x + p.dir * 12, d = Math.hypot(p.aimX - handX, p.aimY - (p.y - 13));
      if (mx === 0 && d > RANGE - 10 && pointer.y < GROUND) mx = Math.sign(p.aimX - p.x);
      if (pointer.y >= LANE_MIN - 6 && mx === 0) { // 道路をタップ → 移動
        p.spraying = false;
        if (Math.abs(pointer.x - p.x) > 3) mx = Math.sign(pointer.x - p.x);
        if (Math.abs(pointer.y - p.y) > 2) my = Math.sign(pointer.y - p.y);
      }
    } else if (keys.Space || keys.KeyJ) {
      const tgt = autoTarget(p);
      if (tgt) { p.aimX = tgt.x; p.aimY = tgt.y; } else { p.aimX = p.x + p.dir * 80; p.aimY = p.y - 60; }
      p.spraying = true;
    }
    const sp = 72;
    p.x = clamp(p.x + mx * sp * dt, 8, W - 8);
    p.y = clamp(p.y + my * sp * 0.6 * dt, LANE_MIN, LANE_MAX);
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) p.walkT += dt;
    if (p.spraying) p.dir = p.aimX >= p.x ? 1 : -1; else if (mx) p.dir = mx;
    if (p.spraying) emitWater(p, p.aimX, p.aimY, 80, 0.25, dt, true);

    // パトロール：くすぶりを未然に防ぐ
    B.forEach(b => {
      if (b.smolder <= 0) return;
      if (Math.abs(p.x - b.cx) < b.w / 2 + 10) b.patrol = (b.patrol || 0) + dt; else b.patrol = Math.max(0, (b.patrol || 0) - dt);
      if (b.patrol >= 1.2) {
        b.smolder = 0; b.patrol = 0;
        S.stats.prevented++; S.stats.dispatch++;
        addScore(80);
        burst(b.cx, b.top + 30, 16, ['#9ff0b8', '#ffffff', '#34b45c']);
        toast('パトロールで未然に防いだ！ +80');
        announce(`パトロール成功！ ${b.pending.tag} の延焼を未然に防ぎました`, 'shield');
        b.topic = null; b.pending = null;
      }
    });
  }

  function autoTarget(p) {
    let best = null, bd = 1e9;
    B.forEach(b => {
      if (b.fire <= 0) return;
      const tx = clamp(p.x, b.x + 6, b.x + b.w - 6);
      const ty = PX.roofYAt(b, tx) + 18;
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d < bd) { bd = d; best = { x: tx, y: ty }; }
    });
    return best;
  }

  function wallBetween(i, j) {
    const g = Math.min(i, j);
    return S.activeWalls.some(w => w.gap === g);
  }

  function updateFires(dt, w) {
    B.forEach((b, i) => {
      if (b.smolder > 0) {
        b.smolder -= dt;
        if (b.smolder <= 0) {
          ignite(b, b.pending, 45);
          announce(`${b.pending.tag} が炎上！ 消火せよ！`);
          b.pending = null;
        }
        return;
      }
      if (b.fire <= 0) return;
      const tp = S.topics[b.topic];
      const g = w.growth * (tp && tp.debunked ? 0.35 : 1);
      b.fire = Math.min(100, b.fire + g * dt);
      b.peak = Math.max(b.peak, b.fire);
      b.burnt = Math.min(1, b.burnt + dt * 0.004 * b.fire / 100);
      // 延焼
      if (b.fire >= 70) {
        [i - 1, i + 1].forEach(j => {
          const n = B[j];
          if (!n || n.fire > 0 || n.smolder > 0) return;
          if (Math.random() < w.spread * dt * (b.fire / 100)) {
            if (wallBetween(i, j)) {
              S.stats.blocked++;
              if (S.t - S.lastSpreadMsg > 3) { toast('防火壁が延焼をブロック！'); S.lastSpreadMsg = S.t; addScore(30); }
            } else {
              ignite(n, tp.def, 35);
              announce(`延焼！ ${tp.def.tag} がとなりに燃え広がった！`);
            }
          }
        });
      }
      // 全焼で街の信頼ダウン
      if (b.fire >= 95) {
        b.overT += dt;
        if (b.overT > 5) {
          b.overT = 0;
          S.hearts--;
          toast('街の信頼が下がった…');
          announce('炎上が長引いて、街の信頼が下がっています！');
          if (S.hearts <= 0) endGame(false);
        }
      } else b.overT = Math.max(0, b.overT - dt);
    });
    // 防火壁の時間切れ
    S.activeWalls = S.activeWalls.filter(wl => (wl.t -= dt) > 0);
  }

  function checkWaveClear(dt) {
    const w = WAVES[S.wave];
    const busy = B.some(b => b.fire > 0 || b.smolder > 0);
    if (S.spawnIdx >= w.spawns.length && !busy) {
      if (S.waveClearT === 0) {
        addScore(200 + S.hearts * 50);
        banner('鎮火完了！', S.wave < WAVES.length - 1 ? '防火訓練クイズで次に備えよう' : 'すべての炎上を鎮火した！');
        announce('鎮火完了！ おつかれさまでした！', 'drop');
      }
      S.waveClearT += dt;
      if (S.waveClearT > 2.2) {
        S.waveClearT = -999;
        if (S.wave < WAVES.length - 1) openQuiz(2, () => startWave(S.wave + 1));
        else openQuiz(1, () => endGame(true));
      }
    }
  }

  // ---------- 仲間の消防士 ----------
  function updateCrew(dt) {
    S.crew.forEach(c => {
      if (S.mode === 'title') {
        c.spraying = !c.idle && !c.static;
        if (c.static && !c.idle) { c.spraying = false; }
        if (c.spraying) {
          const b = B[1];
          c.dir = b.cx > c.x ? 1 : -1;
          emitWater(c, b.cx + c.aimDx + Math.sin(S.t * 2 + c.x) * 8, b.top + 40 + Math.sin(S.t * 1.3 + c.y) * 10, c.rate, 0, dt, false);
        } else c.dir = 1;
        return;
      }
      if (S.mode !== 'play' || S.paused) return;
      c.think -= dt;
      if (c.think <= 0 || !c.target || c.target.fire <= 0) {
        c.think = rand(2, 4);
        const burning = B.filter(b => b.fire > 0).sort((a, b) => b.fire - a.fire);
        // 仲間ごとに担当を分散
        const idx = S.crew.indexOf(c);
        c.target = burning.length ? burning[idx % burning.length] : null;
        if (c.target) { c.side = idx % 2 ? 1 : -1; c.offset = c.target.w / 2 + rand(14, 46); c.lane = rand(LANE_MIN, LANE_MAX); }
      }
      let tx;
      if (c.lane !== undefined) c.y += clamp(c.lane - c.y, -20 * dt, 20 * dt);
      if (c.target) tx = c.target.cx + c.side * c.offset;
      else tx = TRUCK.x + 120 + S.crew.indexOf(c) * 26;
      tx = clamp(tx, 10, W - 10);
      const dx = tx - c.x;
      c.moving = Math.abs(dx) > 3;
      if (c.moving) { c.x += Math.sign(dx) * 50 * dt; c.walkT += dt; c.dir = Math.sign(dx); }
      c.spraying = false;
      if (c.target && c.target.fire > 0 && Math.abs(dx) < 50) {
        const b = c.target;
        c.dir = b.cx > c.x ? 1 : -1;
        c.spraying = true;
        emitWater(c, b.cx + Math.sin(S.t * 1.7 + c.x) * b.w * 0.3, PX.roofYAt(b, b.cx) + 22 + Math.sin(S.t * 2.3 + c.y) * 8, c.rate, c.power, dt, false);
      }
    });
  }

  // ---------- 放水 ----------
  function emitWater(f, tx, ty, rate, power, dt, isPlayer) {
    f.acc = (f.acc || 0) + rate * dt;
    const hx = f.x + f.dir * 14, hy = f.y - 13;
    f.stream = { hx, hy, dx: 0, dy: 0, t: S.t };
    let dx = tx - hx, dy = ty - hy;
    const d = Math.hypot(dx, dy) || 1;
    if (d > RANGE) { dx *= RANGE / d; dy *= RANGE / d; }
    f.stream.dx = dx; f.stream.dy = dy;
    while (f.acc >= 1) {
      f.acc -= 1;
      const spread = 3 + Math.hypot(dx, dy) * 0.05;
      const jx = dx + rand(-spread, spread), jy = dy + rand(-spread, spread);
      const dist = Math.hypot(jx, jy);
      const T = Math.max(0.18, dist / 230);
      const G = 160;
      S.water.push({ x: hx, y: hy, vx: jx / T, vy: (jy - 0.5 * G * T * T) / T, G, t: 0, T, power, isPlayer, s: Math.random() < 0.4 ? 3 : 2 });
    }
  }

  function updateParticles(dt) {
    // 水
    for (let i = S.water.length - 1; i >= 0; i--) {
      const w = S.water[i];
      w.t += dt; w.px = w.x; w.py = w.y;
      w.x += w.vx * dt; w.y += w.vy * dt; w.vy += w.G * dt;
      if (w.t >= w.T) {
        S.water.splice(i, 1);
        const b = B.find(b => w.x >= b.x - 4 && w.x <= b.x + b.w + 4 && w.y >= b.top - 30 && w.y <= GROUND);
        if (b && b.fire > 0 && w.power > 0) {
          b.fire -= w.power;
          b.lastHit = S.t;
          if (w.isPlayer) b.lastHitByPlayer = S.t;
          if (b.fire <= 0) extinguish(b, w.isPlayer);
          if (Math.random() < 0.3) S.particles.push(steam(w.x, w.y));
        } else if (b && b.fire > 0) {
          b.lastHit = S.t;
        }
        if (Math.random() < 0.5) S.particles.push({ x: w.x, y: w.y, vx: rand(-20, 20), vy: rand(-30, 0), life: 0.3, max: 0.3, col: '#ffffff', s: 1, g: 120 });
      }
    }
    // 炎・煙
    B.forEach(b => {
      if (b.fire <= 0 && b.smolder <= 0) return;
      const f = b.fire / 100;
      b.smokeAcc = (b.smokeAcc || 0) + (b.smolder > 0 ? 3 : 6 + 22 * f) * dt;
      while (b.smokeAcc >= 1) {
        b.smokeAcc -= 1;
        const x = rand(b.x + 4, b.x + b.w - 4);
        S.smoke.push({ x, y: PX.roofYAt(b, x) - 14 - 34 * f, vx: rand(2, 12), vy: rand(-20, -10), r: rand(5, 9) * (0.5 + f * 0.8), life: 0, max: rand(3, 5) * (b.smolder > 0 ? 0.4 : 1), gray: Math.random() });
      }
      const nEmb = 30 * f * dt;
      for (let k = 0; k < Math.floor(nEmb) + (Math.random() < nEmb % 1 ? 1 : 0); k++) {
        const x = rand(b.x, b.x + b.w);
        S.embers.push({ x, y: PX.roofYAt(b, x) - rand(0, 30 * f), vx: rand(-6, 6), vy: rand(-40, -18), life: 0, max: rand(0.4, 0.9) });
      }
    });
    [S.smoke, S.embers, S.particles].forEach(arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life += dt;
        if (p.life >= p.max) { arr.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.g) p.vy += p.g * dt;
      }
    });
    if (S.smoke.length > 320) S.smoke.splice(0, S.smoke.length - 320);
  }
  function steam(x, y) { return { x, y, vx: rand(-10, 10), vy: rand(-30, -15), life: 0, max: 0.6, col: '#eef6ff', s: 2 }; }
  function burst(x, y, n, cols) {
    for (let i = 0; i < n; i++) S.particles.push({ x, y, vx: rand(-60, 60), vy: rand(-80, -10), g: 140, life: 0, max: rand(0.5, 0.9), col: cols[i % cols.length], s: 2 });
  }

  // ---------- トレンド ----------
  function updateTopics(dt) {
    Object.values(S.topics).forEach(tp => {
      const bs = B.filter(b => b.topic === tp.def.id && b.fire > 0);
      const heat = bs.reduce((a, b) => a + b.fire, 0);
      if (S.mode !== 'title') tp.posts += heat * (tp.debunked ? 3 : 12) * dt;
      tp.histT += dt;
      if (tp.histT > 0.5) { tp.histT = 0; tp.hist.push(tp.posts); if (tp.hist.length > 48) tp.hist.shift(); }
    });
  }

  // ---------- 描画 ----------
  function render() {
    ctx.drawImage(BG, 0, 0);
    // 焦げ・照り返し
    B.forEach(b => {
      if (b.burnt > 0) { ctx.globalAlpha = b.burnt * 0.55; R(ctx, b.x, b.top, b.w, GROUND - b.top, '#3a2a28'); ctx.globalAlpha = 1; }
      if (b.fire > 0) {
        ctx.globalAlpha = 0.1 + 0.16 * b.fire / 100 + 0.03 * Math.sin(S.t * 18 + b.x);
        R(ctx, b.x - 8, b.top - 14, b.w + 16, GROUND - b.top + 14, '#ff7a1f');
        ctx.globalAlpha = 1;
      }
    });
    // 煙
    S.smoke.forEach(p => {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, 1.25 * (1 - k)) * Math.min(1, p.life * 3);
      const col = p.gray < 0.33 ? '#2b2b31' : p.gray < 0.66 ? '#3d3d44' : '#55555c';
      circ(ctx, p.x, p.y, p.r * (1 + k * 1.8), col);
    });
    ctx.globalAlpha = 1;
    // 炎
    B.forEach(b => drawSmokeMass(b));
    B.forEach(b => drawFire(b));
    S.embers.forEach(p => {
      const k = p.life / p.max;
      R(ctx, p.x, p.y, k < 0.5 ? 2 : 1, k < 0.5 ? 2 : 1, k < 0.3 ? '#fff3a0' : k < 0.6 ? '#ffb21f' : '#e5391e');
    });
    // くすぶり警告
    B.forEach(b => { if (b.smolder > 0) drawSmolder(b); });
    // 防火壁（シールド）
    S.activeWalls.forEach(wl => drawWallShield(wl));
    // エンティティ（y順）
    const ents = [];
    ents.push({ y: 211, d: () => PX.drawCar(ctx, -14, 214) });
    ents.push({ y: TRUCK.y - 2, d: () => PX.drawTruck(ctx, TRUCK.x, TRUCK.y, S.t) });
    ents.push({ y: 203.5, d: drawHoses });
    [[258, 219], [290, 220], [372, 218], [416, 221], [460, 219]].forEach(([x, y]) => ents.push({ y, d: () => ctx.drawImage(SPR.cone, x - 8, y - 18) }));
    S.crew.forEach(c => ents.push({ y: c.y, d: () => drawFF(c, SPR.ff) }));
    if (S.mode === 'play' || S.mode === 'modal' || S.mode === 'result') ents.push({ y: S.player.y + 0.1, d: () => drawFF(S.player, SPR.player, true) });
    S.activeWalls.forEach(wl => ents.push({ y: 214, d: () => drawBarricade(wl) }));
    ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    // 水
    drawStreams();
    S.water.forEach(w => {
      if (w.t > w.T * 0.6) R(ctx, w.x - 1, w.y - 1, w.s + 2, w.s + 2, '#8fd6ff');
    });
    S.water.forEach(w => { if (w.t > w.T * 0.6) R(ctx, w.x, w.y, w.s, w.s, '#ffffff'); });
    S.particles.forEach(p => { ctx.globalAlpha = 1 - p.life / p.max; R(ctx, p.x, p.y, p.s, p.s, p.col); });
    ctx.globalAlpha = 1;
    ctx.drawImage(FG, 0, 0);
  }

  const FLAME_LAYERS = [['#c92a1a', 1], ['#ff5a1f', 0.8], ['#ff9a1f', 0.6], ['#ffd23f', 0.4], ['#fff3a8', 0.2]];
  function tongue(x, base, h, w, phase) {
    if (h < 2) return;
    for (const [col, k] of FLAME_LAYERS) {
      const hh = h * k, ww = w * (0.35 + 0.65 * k);
      if (hh < 2) continue;
      for (let r = 0; r < hh; r += 2) {
        const u = r / hh;
        const half = (ww / 2) * Math.pow(1 - u, 0.75);
        const sway = Math.sin(S.t * 7 + phase + u * 3) * u * 3.5;
        R(ctx, x - half + sway, base - r - 2, Math.max(1, half * 2), 2, col);
      }
    }
  }
  const PUFFS = [[-0.42, -30, 15], [0.38, -32, 16], [-0.05, -46, 22], [-0.4, -64, 17], [0.36, -62, 20], [0.05, -84, 21], [0.55, -90, 15], [-0.3, -100, 16], [0.25, -116, 18], [0.6, -124, 13]];
  function drawSmokeMass(b) {
    const f = b.fire / 100;
    if (f < 0.2) return;
    const a = Math.min(1, (f - 0.2) / 0.4), t = S.t;
    const scale = (0.55 + 0.45 * f) * (0.7 + 0.3 * b.w / 104);
    const pts = PUFFS.map(([rx, dy, r], i) => ({
      x: b.cx + rx * b.w + Math.sin(t * 0.6 + i * 1.3) * 3 + (-dy) * 0.12,
      y: b.top + dy * (0.55 + 0.45 * f) + Math.cos(t * 0.5 + i * 2) * 2,
      r: r * scale,
    }));
    ctx.globalAlpha = 0.96 * a;
    pts.forEach(p => circ(ctx, p.x + 2, p.y + 3, p.r, '#25252b'));
    pts.forEach(p => circ(ctx, p.x, p.y, p.r, '#3a3a42'));
    pts.forEach(p => circ(ctx, p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.62, '#4d4d56'));
    pts.forEach(p => circ(ctx, p.x - p.r * 0.4, p.y - p.r * 0.5, p.r * 0.28, '#62626b'));
    ctx.globalAlpha = 1;
  }

  function drawFire(b) {
    if (b.fire <= 0) return;
    const f = b.fire / 100, t = S.t;
    // 窓の炎
    if (f > 0.3) {
      const a = (f - 0.3) / 0.7;
      b.windows.forEach((w, k) => {
        R(ctx, w.x + 1, w.y + 1, w.w - 2, w.h - 2, '#b8301a');
        R(ctx, w.x + 2, w.y + w.h * 0.3, w.w - 4, w.h * 0.7 - 2, '#ff7a1f');
        R(ctx, w.x + 4, w.y + w.h * 0.55, w.w - 8, w.h * 0.45 - 3, '#ffd23f');
        tongue(w.x + w.w / 2, w.y + 4, a * 22 * (0.75 + 0.25 * Math.sin(t * 9 + k * 2.1)), w.w * 0.9, k * 1.7);
      });
    }
    // 1階の炎
    if (f > 0.5) {
      for (let x = b.x + 6; x < b.x + b.w - 2; x += 11) {
        const h = (f - 0.5) * 50 * (0.6 + 0.4 * Math.sin(t * 8 + x * 1.3));
        tongue(x, GROUND + 1, h, 12, x);
      }
    }
    // 側面の炎
    if (f > 0.6) {
      const wt = b.type === 'house' ? b.roofBase : b.top;
      [b.x + 1, b.x + b.w - 1].forEach((sx, k) => {
        for (let y = wt + 14; y < GROUND - 10; y += 22) tongue(sx, y + 10, (f - 0.6) * 55 * (0.7 + 0.3 * Math.sin(t * 8 + y + k)), 9, y + k * 3);
      });
    }
    // 屋根の炎
    const step = 8;
    for (let x = b.x - 2; x <= b.x + b.w + 2; x += step) {
      const rel = (x - b.x) / b.w;
      const ry = PX.roofYAt(b, clamp(x, b.x, b.x + b.w));
      const n = 0.5 + 0.25 * Math.sin(t * 6 + x * 0.9) + 0.25 * Math.sin(t * 4.1 + x * 0.37);
      const env = 0.5 + 0.5 * Math.sin(clamp(rel, 0, 1) * Math.PI);
      const h = (12 + 76 * f) * (0.55 + 0.45 * n) * env;
      tongue(x, ry + 8, h, 15 + 6 * f, x * 0.7);
    }
  }

  function drawSmolder(b) {
    const x = Math.round(b.cx), y = Math.round(b.top - 20 + Math.sin(S.t * 6) * 2);
    R(ctx, x - 6, y - 8, 12, 14, '#141a28');
    R(ctx, x - 5, y - 7, 10, 12, '#ffd21f');
    R(ctx, x - 1, y - 5, 2, 6, '#141a28');
    R(ctx, x - 1, y + 2, 2, 2, '#141a28');
    R(ctx, x - 2, y + 6, 4, 2, '#141a28');
    // 残り時間とパトロール進行
    const k = clamp(b.smolder / 3.6, 0, 1);
    R(ctx, x - 12, y + 10, 24, 3, '#141a28');
    R(ctx, x - 11, y + 11, 22 * k, 1, '#ff6a1f');
    if (b.patrol > 0) { R(ctx, x - 12, y + 14, 24, 3, '#141a28'); R(ctx, x - 11, y + 15, 22 * clamp(b.patrol / 1.2, 0, 1), 1, '#34b45c'); }
  }

  function drawFF(c, set, isPlayer) {
    const frame = c.moving ? 1 + (Math.floor(c.walkT * 8) % 2) : 0;
    const img = set[frame][c.dir < 0 ? 1 : 0];
    const x = Math.round(c.x - 14), y = Math.round(c.y - 36);
    R(ctx, x + 3, c.y - 2, 22, 3, 'rgba(0,0,0,0.18)');
    ctx.drawImage(img, x, y);
    if (c.spraying || c.hose) {
      const hx = c.x + c.dir * 12, hy = c.y - 11;
      R(ctx, hx - 2, hy - 2, 5, 5, '#3a3a46');
      R(ctx, hx + c.dir * 3 - 1, hy - 4, 4, 4, '#c9cdd4');
    }
    if (isPlayer) {
      const by = Math.round(c.y - 48 + Math.sin(S.t * 6) * 1.5);
      R(ctx, c.x - 4, by, 9, 3, '#141a28'); R(ctx, c.x - 3, by + 3, 7, 2, '#141a28'); R(ctx, c.x - 1, by + 5, 3, 2, '#141a28');
      R(ctx, c.x - 3, by + 1, 7, 2, '#3c90e6'); R(ctx, c.x - 2, by + 3, 5, 1, '#3c90e6'); R(ctx, c.x, by + 4, 1, 2, '#3c90e6');
      if (c.spraying) {
        // 狙いのマーカー
        let dx = c.aimX - c.x, dy = c.aimY - (c.y - 13);
        const d = Math.hypot(dx, dy); if (d > RANGE) { dx *= RANGE / d; dy *= RANGE / d; }
        const ax = Math.round(c.x + dx), ay = Math.round(c.y - 13 + dy);
        ctx.globalAlpha = 0.8;
        R(ctx, ax - 4, ay, 3, 1, '#ffffff'); R(ctx, ax + 2, ay, 3, 1, '#ffffff'); R(ctx, ax, ay - 4, 1, 3, '#ffffff'); R(ctx, ax, ay + 2, 1, 3, '#ffffff');
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawHoses() {
    const list = S.crew.filter(c => c.spraying || c.hose);
    if (S.mode !== 'title' && S.player.spraying) list.push(S.player);
    const ox = TRUCK.x + 100, oy = TRUCK.y - 4;
    list.forEach(c => {
      const ex = c.x - c.dir * 3, ey = c.y - 1;
      const mx = (ox + ex) / 2, my = Math.max(oy, ey) + 6;
      const n = Math.ceil(Math.abs(ex - ox) / 2) + 6;
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = (1 - u) * (1 - u) * ox + 2 * u * (1 - u) * mx + u * u * ex, y = (1 - u) * (1 - u) * oy + 2 * u * (1 - u) * my + u * u * ey;
        R(ctx, x, y + 2, 2, 1, '#9aa3ae'); R(ctx, x, y, 2, 2, '#f4f6f9');
      }
    });
  }
  function drawStreams() {
    const list = S.crew.filter(c => c.spraying && c.stream && S.t - c.stream.t < 0.1);
    if (S.player.spraying && S.player.stream && S.mode !== 'title') list.push(S.player);
    const G = 160, arcs = [];
    list.forEach((c, ci) => {
      const { hx, hy, dx, dy } = c.stream;
      const dist = Math.hypot(dx, dy); if (dist < 5) return;
      const T = Math.max(0.18, dist / 230), vx = dx / T, vy = (dy - 0.5 * G * T * T) / T;
      const pts = [];
      for (let k = 0; k <= 22; k++) {
        const u = k / 22, tt = u * T;
        pts.push([hx + vx * tt, hy + vy * tt + 0.5 * G * tt * tt + Math.sin(S.t * 24 + u * 7 + ci) * u * 1.6, 1 + u * 2.6]);
      }
      arcs.push(pts);
    });
    arcs.forEach(pts => pts.forEach(([x, y, r]) => circ(ctx, x, y, r + 1, '#7cc8ff')));
    arcs.forEach(pts => pts.forEach(([x, y, r], k) => { if (k > 1) circ(ctx, x, y, Math.max(1, r - 0.6), '#ffffff'); }));
    arcs.forEach(pts => { const [x, y] = pts[pts.length - 1]; for (let i = 0; i < 4; i++) R(ctx, x + rand(-7, 7), y + rand(-6, 4), 2, 2, i % 2 ? '#ffffff' : '#bfe8ff'); });
  }

  function drawHose() {
    return;
    const c = S.crew[0];
    const pts = [[TRUCK.x + 100, TRUCK.y - 14], [TRUCK.x + 102, TRUCK.y + 2], [c.x - 14, c.y - 2], [c.x - 10, c.y - 9]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let k = 0; k <= n; k++) { const x = x1 + (x2 - x1) * k / n, y = y1 + (y2 - y1) * k / n; R(ctx, x, y, 2, 2, '#f2f4f7'); R(ctx, x, y + 2, 2, 1, '#b9c1cc'); }
    }
  }

  function drawWallShield(wl) {
    const g = GAPS[wl.gap];
    const top = Math.min(B[wl.gap].top, B[wl.gap + 1].top) - 30;
    ctx.globalAlpha = 0.28 + 0.08 * Math.sin(S.t * 5);
    R(ctx, g.x - 6, top, 12, GROUND - top, '#8fd0ff');
    ctx.globalAlpha = 0.7;
    R(ctx, g.x - 6, top, 1, GROUND - top, '#ffffff'); R(ctx, g.x + 5, top, 1, GROUND - top, '#ffffff');
    for (let y = top + ((S.t * 40) % 12); y < GROUND; y += 12) R(ctx, g.x - 5, y, 10, 1, '#ffffff');
    ctx.globalAlpha = 1;
  }
  function drawBarricade(wl) {
    const g = GAPS[wl.gap], x = Math.round(g.x - 12), y = 204;
    R(ctx, x, y, 24, 7, '#141a28');
    for (let i = 0; i < 22; i += 4) { R(ctx, x + 1 + i, y + 1, 2, 5, '#ffd21f'); R(ctx, x + 3 + i, y + 1, 2, 5, '#2a2a33'); }
    R(ctx, x + 2, y + 7, 2, 8, '#6b7487'); R(ctx, x + 20, y + 7, 2, 8, '#6b7487');
    // 残り時間ゲージ
    R(ctx, x, y - 4, 24, 2, '#141a28'); R(ctx, x, y - 4, 24 * clamp(wl.t / 25, 0, 1), 2, '#34b45c');
  }

  // ---------- HUD 更新 ----------
  let hudTimer = 0;
  function updateHUD(dt) {
    PX.drawMascot(mascotCtx, S.t);
    updateSigns();
    // 炎上度の吹き出し
    const hot = B.filter(b => b.fire > 0).sort((a, b) => b.fire - a.fire)[0];
    const heat = $('#heat');
    if (hot) {
      heat.classList.add('show');
      const n = Math.min(5, Math.max(1, Math.ceil(hot.fire / 20 - 0.01)));
      const icons = '<i class="ico flame"></i>'.repeat(n) + '<i class="ico star"></i>'.repeat(5 - n);
      if (heat.dataset.n !== String(n)) { $('#heatIcons').innerHTML = icons; heat.dataset.n = n; }
      $('#heatBar').style.width = hot.fire + '%';
      const cx = clamp(hot.cx + 26, 150, 300);
      heat.style.left = (cx / W * 100) + '%';
      heat.style.top = (Math.max(10, hot.top - 62) / H * 100) + '%';
    } else heat.classList.remove('show');
    // 鎮火中の吹き出し
    const cool = $('#cool');
    let cb = null;
    if (S.mode === 'title') cb = B[1];
    else cb = B.filter(b => b.fire > 0 && S.t - b.lastHitByPlayer < 0.6)[0] || B.filter(b => b.fire > 0 && S.t - b.lastHit < 0.6).sort((a, b) => b.fire - a.fire)[0];
    if (cb) {
      cool.classList.add('show');
      const pct = S.mode === 'title' ? Math.round(56 + Math.sin(S.t * 0.7) * -4) : Math.round(clamp((1 - cb.fire / Math.max(1, cb.peak)) * 100, 0, 99));
      $('#coolPct').textContent = pct + '%';
      $('#coolBar').style.width = pct + '%';
      let lx = cb.cx > 340 ? 136 : 362;
      if (S.mode === 'title') lx = 360;
      cool.style.left = (lx / W * 100) + '%';
      cool.style.top = (Math.max(90, GROUND - 74) / H * 100) + '%';
    } else cool.classList.remove('show');

    hudTimer -= dt;
    if (hudTimer > 0) return;
    hudTimer = 0.2;
    updateTrend();
    // ステータス
    if (S.mode !== 'title') {
      let hs = '';
      for (let i = 0; i < 4; i++) hs += `<i class="ico ${i < S.hearts ? (i === S.hearts - 1 && S.hearts < 4 ? 'heartGold' : 'heart') : 'heartEmpty'}"></i>`;
      $('#hearts').innerHTML = hs + '<span style="margin-left:.3em">街の信頼</span>';
      $('#waveName').textContent = S.wave >= 0 ? `${WAVES[S.wave].name} (${S.wave + 1}/${WAVES.length})` : '';
      $('#score').textContent = fmt(S.score);
      $('#wallCount').textContent = S.walls;
      $('#pauseBtn').textContent = S.paused ? '▶' : 'Ⅱ';
      const near = nearestInvestigable();
      $('#btnInvestigate').disabled = !near;
      $('#btnWall').disabled = S.walls <= 0;
    }
  }

  function updateTrend() {
    const list = Object.values(S.topics).filter(tp => {
      const burning = burningOf(tp.def.id).length > 0;
      return burning || (tp.out && S.t - tp.outT < 8);
    }).map(tp => {
      const heat = burningOf(tp.def.id).reduce((a, b) => a + b.fire, 0);
      return { tp, heat };
    }).sort((a, b) => b.heat - a.heat);
    const top = list[0];
    const name = $('#tTopName'), tag = $('#tTopTag');
    if (top) {
      const tp = top.tp;
      name.textContent = tp.def.tag;
      const pct = Math.round((tp.posts / tp.base - 1) * 100);
      $('#tTopCount').textContent = fmt(tp.posts);
      const pe = $('#tTopPct');
      if (top.heat > 0) {
        tag.className = 'tag fire'; tag.innerHTML = (tp.debunked ? 'デマ判明' : '炎上中') + '<i class="ico flame"></i>';
        pe.className = 'pct'; pe.textContent = `(↑+${pct}%)`;
      } else {
        tag.className = 'tag out'; tag.innerHTML = '鎮火<i class="ico drop"></i>';
        pe.className = 'pct out'; pe.textContent = '(→ 0%)';
      }
      drawSpark(tp.hist, top.heat > 0);
    } else {
      name.textContent = '#今日のおやつ';
      tag.className = 'tag calm'; tag.textContent = '平和';
      $('#tTopCount').textContent = '1,284';
      const pe = $('#tTopPct'); pe.className = 'pct out'; pe.textContent = '(→ +2%)';
      drawSpark([1200, 1210, 1230, 1220, 1250, 1260, 1270, 1284], false);
    }
    // 2位以下
    const rows = [];
    list.slice(1, 3).forEach(({ tp, heat }) => {
      const pct = Math.round((tp.posts / tp.base - 1) * 100);
      rows.push(`<div class="trow"><span>${esc(tp.def.tag)}</span>${heat > 0 ? `<span class="hot">炎上中 ↗+${pct}%</span>` : '<span class="done">鎮火</span>'}</div>`);
    });
    NEUTRAL_TOPICS.slice(0, Math.max(0, 2 - rows.length)).forEach(n => {
      rows.push(`<div class="trow"><span>${esc(n.tag)}</span><span class="up">↗+${n.pct}%</span></div>`);
    });
    const html = rows.join('');
    const el = $('#tRows');
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  function drawSpark(hist, hot) {
    const w = spark.width, h = spark.height;
    sctx.clearRect(0, 0, w, h);
    sctx.fillStyle = '#eef1f6';
    for (let y = 6; y < h; y += 14) sctx.fillRect(0, y, w, 1);
    if (hist.length < 2) return;
    const mn = Math.min(...hist), mx = Math.max(...hist);
    const span = Math.max(1, mx - mn);
    $('#yMax').textContent = mx >= 10000 ? Math.round(mx / 1000) + 'k' : fmt(mx);
    $('#yMin').textContent = mn >= 10000 ? Math.round(mn / 1000) + 'k' : fmt(mn);
    const pts = hist.map((v, i) => [4 + (w - 12) * i / (hist.length - 1), h - 6 - (h - 14) * (v - mn) / span]);
    sctx.fillStyle = hot ? 'rgba(232,67,58,0.12)' : 'rgba(60,144,230,0.12)';
    sctx.beginPath(); sctx.moveTo(pts[0][0], h);
    pts.forEach(p => sctx.lineTo(p[0], p[1])); sctx.lineTo(pts[pts.length - 1][0], h); sctx.fill();
    sctx.strokeStyle = hot ? '#e8433a' : '#3c90e6'; sctx.lineWidth = 3; sctx.lineJoin = 'round';
    sctx.beginPath(); pts.forEach((p, i) => i ? sctx.lineTo(p[0], p[1]) : sctx.moveTo(p[0], p[1])); sctx.stroke();
    const l = pts[pts.length - 1];
    sctx.fillStyle = hot ? '#e8433a' : '#3c90e6'; sctx.beginPath(); sctx.arc(l[0], l[1], 4.5, 0, Math.PI * 2); sctx.fill();
  }

  // ---------- 演出 ----------
  let annTimer = 0;
  function announce(text, icon = 'flame') {
    const a = $('#announcer');
    $('#annText').textContent = text;
    a.querySelector('.msg .ico').className = 'ico ' + icon;
    a.classList.remove('flash'); void a.offsetWidth; a.classList.add('flash');
    annTimer = 0;
  }
  let bannerTO, toastTO;
  function banner(text, sub) {
    const el = $('#waveBanner');
    el.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    el.classList.add('show');
    clearTimeout(bannerTO); bannerTO = setTimeout(() => el.classList.remove('show'), 2000);
  }
  function toast(text) {
    const el = $('#toast');
    el.textContent = text; el.classList.add('show');
    clearTimeout(toastTO); toastTO = setTimeout(() => el.classList.remove('show'), 1600);
  }
  function togglePause() {
    if (S.mode !== 'play') return;
    S.paused = !S.paused;
    if (S.paused) banner('一時停止中', 'P / Esc で再開'); else $('#waveBanner').classList.remove('show');
  }

  // ---------- 防火壁 ----------
  function placeWall() {
    if (S.mode !== 'play' || S.paused || S.walls <= 0) return;
    const g = GAPS.slice().sort((a, b) => Math.abs(a.x - S.player.x) - Math.abs(b.x - S.player.x))[0];
    const ex = S.activeWalls.find(w => w.gap === g.i);
    if (ex) ex.t = 25; else S.activeWalls.push({ gap: g.i, t: 25 });
    S.walls--;
    burst(g.x, 200, 12, ['#8fd0ff', '#ffffff', '#ffd21f']);
    toast('防火壁 設置！');
    announce('防火壁を設置！ となりへの延焼を防ぎます', 'shield');
  }

  // ---------- 火元調査 ----------
  function nearestInvestigable() {
    if (S.mode !== 'play') return null;
    const c = B.filter(b => b.fire > 0 && S.topics[b.topic] && !S.topics[b.topic].investigated)
      .sort((a, b) => Math.abs(a.cx - S.player.x) - Math.abs(b.cx - S.player.x));
    return c[0] || null;
  }
  function investigateNearest() {
    if (S.paused) return;
    const b = nearestInvestigable();
    if (b) openInvestigation(b);
  }

  function openModal(html, cls = '') {
    S.prevMode = S.mode === 'modal' ? S.prevMode : S.mode;
    S.mode = 'modal';
    pointer.down = false;
    Object.keys(keys).forEach(k => keys[k] = false);
    overlay.innerHTML = `<div class="modal px-box ${cls}">${html}</div>`;
    overlay.classList.add('show');
    return overlay.firstElementChild;
  }
  function closeModal() {
    overlay.classList.remove('show'); overlay.innerHTML = '';
    S.mode = S.prevMode || 'play';
  }

  function openInvestigation(b) {
    const tp = S.topics[b.topic];
    if (!tp || tp.investigated) { toast('この話題は調査済みです'); return; }
    const def = tp.def;
    const claims = shuffle(def.claims);
    const m = openModal(`
      <div class="mhead"><i class="ico search"></i>火元調査ミッション　<span style="opacity:.8;font-size:.8em">${esc(def.tag)}</span></div>
      <div class="inv-grid">
        <div>
          <div class="post">
            <div class="who"><div class="avatar">？</div>${esc(def.user)} <small>${esc(def.handle)}</small></div>
            <div class="body">${esc(def.post)}</div>
            <div class="meta"><span>リポスト ${fmt(tp.posts * 0.31)}</span><span>いいね ${fmt(tp.posts * 0.82)}</span><span>投稿数 ${fmt(tp.posts)}</span></div>
          </div>
          <div class="claims">
            ${claims.map((c, i) => `
              <div class="claim" data-i="${i}">
                <div class="ct"><span class="mark"></span>${esc(c.text)}</div>
                <div class="opts">${LABELS.map(l => `<button class="opt" data-v="${l.key}">${l.key}</button>`).join('')}</div>
                <div class="why">${esc(c.why)}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="side-card">
          <h4>情報の確認</h4>
          <ul>
            <li><i class="ico check"></i>一次情報を探す</li>
            <li><i class="ico check"></i>出典をチェック</li>
            <li><i class="ico check"></i>文脈を読む</li>
          </ul>
          <div class="legend">
            ${LABELS.map(l => `<div><b>${l.key}</b>${esc(l.desc)}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="result-line" id="invResult">拡散中の話題を調べ、それぞれ「事実・推測・不明」を見分けよう</div>
      <div class="mbtns"><button class="btn light" id="invCancel">あとで</button><button class="btn orange" id="invJudge" disabled>判定する</button></div>
    `, 'wide');
    const sel = {};
    m.querySelectorAll('.claim').forEach(el => {
      el.querySelectorAll('.opt').forEach(btn => btn.onclick = () => {
        if (m.dataset.judged) return;
        el.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
        btn.classList.add('sel');
        sel[el.dataset.i] = btn.dataset.v;
        m.querySelector('#invJudge').disabled = Object.keys(sel).length < claims.length;
      });
    });
    m.querySelector('#invCancel').onclick = closeModal;
    m.querySelector('#invJudge').onclick = () => {
      if (m.dataset.judged) { closeModal(); return; }
      m.dataset.judged = '1';
      let right = 0;
      m.querySelectorAll('.claim').forEach(el => {
        const c = claims[el.dataset.i];
        const ok = sel[el.dataset.i] === c.ans;
        if (ok) right++;
        el.classList.add('judged');
        el.querySelectorAll('.opt').forEach(btn => {
          if (btn.dataset.v === c.ans) btn.classList.add('right');
          else if (btn.classList.contains('sel')) btn.classList.add('wrong');
        });
        el.querySelector('.mark').innerHTML = `<i class="ico ${ok ? 'check' : 'cross'}"></i>`;
      });
      tp.investigated = true;
      S.stats.invCount++; S.stats.claimTotal += claims.length; S.stats.claimRight += right;
      const r = right / claims.length;
      const bs = burningOf(tp.def.id);
      let msg;
      if (r === 1) {
        tp.debunked = true;
        bs.forEach(x => { x.fire = Math.max(1, x.fire - 55); });
        addScore(150);
        msg = '火元特定！ デマと判明し、炎が一気に弱まった！ +150';
        announce(`${def.tag} はデマと判明！ 炎が弱まりました`, 'search');
      } else if (r > 0) {
        bs.forEach(x => { x.fire = Math.max(1, x.fire - 55 * r); });
        addScore(Math.round(150 * r));
        msg = `${right}/${claims.length} 正解！ 炎が少し弱まった`;
        announce(`調査で ${def.tag} の炎が少し弱まりました`, 'search');
      } else {
        bs.forEach(x => { x.fire = Math.min(100, x.fire + 10); });
        msg = '見分けられず… 炎が勢いを増した！ 解説を読んでみよう';
        announce(`${def.tag} の炎が勢いを増しています！`);
      }
      m.querySelector('#invResult').textContent = msg;
      m.querySelector('#invCancel').style.display = 'none';
      m.querySelector('#invJudge').textContent = '現場に戻る';
    };
  }

  // ---------- 防火訓練クイズ ----------
  let quizPool = [];
  function openQuiz(count, done) {
    let n = 0;
    const next = () => {
      if (n >= count) { closeModal(); done(); return; }
      n++;
      if (!quizPool.length) quizPool = shuffle(QUIZZES);
      const qz = quizPool.pop();
      const order = shuffle([0, 1, 2]);
      const m = openModal(`
        <div class="mhead"><i class="ico book"></i>防火訓練クイズ　<span style="opacity:.8;font-size:.8em">${n} / ${count}</span></div>
        <div class="quiz-grid">
          <div class="quiz-card">
            <div class="q">${esc(qz.q)}</div>
            ${order.map((oi, k) => `<button class="qopt" data-oi="${oi}"><span class="dot"></span><b>${'ABC'[k]}</b> ${esc(qz.options[oi])}</button>`).join('')}
          </div>
          <div class="qfeed" id="qfeed"></div>
        </div>
        <div class="three">
          <div><i class="ico search"></i> 調べる力<small>出典の確認</small></div>
          <div><i class="ico shield"></i> 見分ける力<small>事実・推測・不明の区別</small></div>
          <div><i class="ico bulb"></i> 考える力<small>多様な意見の理解</small></div>
        </div>
        <div class="mbtns"><button class="btn orange" id="qNext" style="visibility:hidden">${n >= count ? '次へ進む' : '次の問題'}</button></div>
      `);
      m.querySelectorAll('.qopt').forEach(btn => btn.onclick = () => {
        if (m.dataset.done) return;
        m.dataset.done = '1';
        const ok = Number(btn.dataset.oi) === qz.answer;
        S.stats.quizTotal++;
        if (ok) { S.stats.quizRight++; addScore(100); S.walls = Math.min(3, S.walls + 1); }
        m.querySelectorAll('.qopt').forEach(b2 => { if (Number(b2.dataset.oi) === qz.answer) b2.classList.add('right'); });
        if (!ok) btn.classList.add('wrong');
        const fb = m.querySelector('#qfeed');
        fb.innerHTML = `<span class="badge ${ok ? 'ok' : 'ng'}">${ok ? '正解！' : 'ざんねん…'}</span>
          <div class="box"><b>${esc(qz.head)}</b><span>${esc(qz.why)}</span>${ok ? '<div style="margin-top:.4em;font-weight:900;color:#23a050">防火壁 +1</div>' : ''}</div>`;
        fb.classList.add('show');
        m.querySelector('#qNext').style.visibility = 'visible';
      });
      m.querySelector('#qNext').onclick = next;
    };
    S.mode = 'play';
    next();
    S.prevMode = 'play';
  }

  // ---------- 遊び方 ----------
  function showHowTo(fromGame) {
    const m = openModal(`
      <div class="mhead"><i class="ico pad"></i>ゲームの遊び方</div>
      <div class="how-row"><i class="ico drop big"></i><div><h3>消火アクション</h3><p>消防士を操作して、デマの火を鎮火！ 仲間の消防士と協力して、大規模な延焼にも対応しよう。</p></div></div>
      <div class="how-row"><i class="ico search big"></i><div><h3>火元調査ミッション</h3><p>燃えている建物の看板をタップ（またはEキー）。拡散中の話題を調べ、「事実・推測・不明」を見分けると、炎が一気に弱まる！</p></div></div>
      <div class="how-row"><i class="ico shield big"></i><div><h3>延焼防止・予防活動</h3><p>「！」のくすぶりに近づいてパトロールすれば、炎上を未然に防げる。防火壁（Fキー）で、となりへの延焼をブロック！</p></div></div>
      <div class="how-row"><i class="ico book big"></i><div><h3>防火訓練クイズ</h3><p>出動のあいだにクイズで特訓。正解すると防火壁がもらえるよ。</p></div></div>
      <div class="keys">
        <kbd>←→↑↓</kbd>/<kbd>WASD</kbd> 移動　<kbd>マウス長押し</kbd> ねらって放水　<kbd>Space</kbd> 近くの火に放水<br>
        <kbd>E</kbd> 火元調査　<kbd>F</kbd> 防火壁　<kbd>P</kbd> 一時停止　｜ スマホ：建物を長押しで放水、道路をタップで移動
      </div>
      <div class="mbtns"><button class="btn light" id="howClose">とじる</button>${fromGame ? '' : '<button class="btn orange" id="howStart">出動する！</button>'}</div>
    `);
    m.querySelector('#howClose').onclick = closeModal;
    const st = m.querySelector('#howStart');
    if (st) st.onclick = () => { closeModal(); startGame(); };
  }

  // ---------- 結果 ----------
  function endGame(cleared) {
    if (S.mode === 'result') return;
    const st = S.stats;
    const claimAcc = st.claimTotal ? Math.round(st.claimRight / st.claimTotal * 100) : 0;
    const quizAcc = st.quizTotal ? Math.round(st.quizRight / st.quizTotal * 100) : 0;
    const stars = v => '★'.repeat(v) + '☆'.repeat(3 - v);
    const research = st.invCount >= 4 ? 3 : st.invCount >= 2 ? 2 : st.invCount >= 1 ? 1 : 0;
    const discern = claimAcc >= 90 ? 3 : claimAcc >= 60 ? 2 : claimAcc > 0 ? 1 : 0;
    const think = quizAcc >= 90 ? 3 : quizAcc >= 60 ? 2 : quizAcc > 0 ? 1 : 0;
    const m = openModal(`
      <div class="res-title ${cleared ? 'ok' : 'ng'}">${cleared ? '🎉 炎上市を守りきった！' : '街の信頼が尽きてしまった…'}</div>
      <div class="res-sub">SCORE <b style="font-size:1.4em;color:#e8433a">${fmt(S.score)}</b></div>
      <div class="res-grid">
        <div class="res-card">
          <h4><i class="ico building"></i>街の統計（炎上市 消防本部）</h4>
          <div class="stat-table">
            <div>今回の出動数<b>${st.dispatch}<small>件</small></b></div>
            <div>鎮火数<b>${st.extinguished}<small>件</small></b></div>
            <div>未然に防いだ<b>${st.prevented}<small>件</small></b></div>
            <div>延焼ブロック<b>${st.blocked}<small>回</small></b></div>
            <div>調査の正答率<b>${claimAcc}<small>%</small></b></div>
            <div>クイズ正答率<b>${quizAcc}<small>%</small></b></div>
          </div>
          <h4 style="margin-top:.7em">プレイで身につく 3つの力</h4>
          <div class="three" style="margin-top:0">
            <div>調べる力<small>出典の確認</small><span class="stars">${stars(research)}</span></div>
            <div>見分ける力<small>事実・推測・不明</small><span class="stars">${stars(discern)}</span></div>
            <div>考える力<small>多様な意見の理解</small><span class="stars">${stars(think)}</span></div>
          </div>
        </div>
        <div class="res-card">
          <h4><i class="ico check"></i>プレイ後のアクション提案</h4>
          <ul class="checks">
            <li><i class="ico check"></i>気になる情報はまず出典を確認</li>
            <li><i class="ico check"></i>不確かな情報は拡散を控える</li>
            <li><i class="ico check"></i>公式・信頼できる情報源をチェック</li>
            <li><i class="ico check"></i>異なる意見も一度読んでみる</li>
          </ul>
          <h4 style="margin-top:.5em;background:#e8433a"><i class="ico target"></i>目指す効果</h4>
          <ul class="checks">
            <li><i class="ico check"></i>デマの拡散を減らす</li>
            <li><i class="ico check"></i>冷静に判断する習慣を育てる</li>
            <li><i class="ico check"></i>健全なネットの空気をつくる</li>
          </ul>
        </div>
      </div>
      <div class="mbtns"><button class="btn light" id="resTitle">タイトルへ</button><button class="btn orange" id="resRetry">もう一度出動！</button></div>
    `, 'wide');
    S.mode = 'result'; S.prevMode = 'result';
    m.querySelector('#resRetry').onclick = () => { closeModal(); startGame(); };
    m.querySelector('#resTitle').onclick = () => { closeModal(); toTitle(); };
  }

  function toTitle() {
    S = freshState('title');
    hud.classList.remove('playing');
    announce('話題が急増！　消防隊が出動しました！');
  }

  // ---------- ループ ----------
  const DEBUG = { speed: 1 };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let k = 0; k < (DEBUG.speed || 1); k++) update(dt);
    render();
    updateHUD(dt);
    requestAnimationFrame(frame);
  }
  toTitle();
  // テスト・デバッグ用
  window.__enjo = { get S() { return S; }, startGame, B, DEBUG, keys };
  requestAnimationFrame(frame);
})();
