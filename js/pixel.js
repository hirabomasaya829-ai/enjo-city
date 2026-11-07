// 炎上市 — ピクセルアート描画ヘルパー・スプライト・背景
'use strict';

window.PX = (() => {
  const W = 480, H = 270, GROUND = 198;

  // ---------- 基本図形 ----------
  function R(c, x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    c.fillStyle = col;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  // ドット絵っぽい塗りつぶし円
  function circ(c, cx, cy, r, col) {
    c.fillStyle = col;
    r = Math.max(1, Math.round(r));
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6));
      c.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }

  // 文字列グリッド → canvas
  function gridCanvas(grid, pal, scale = 1) {
    const h = grid.length, w = grid[0].length;
    const cv = document.createElement('canvas');
    cv.width = w * scale; cv.height = h * scale;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === '.' || !pal[ch]) continue;
      c.fillStyle = pal[ch];
      c.fillRect(x * scale, y * scale, scale, scale);
    }
    return cv;
  }
  function flipped(cv) {
    const f = document.createElement('canvas');
    f.width = cv.width; f.height = cv.height;
    const c = f.getContext('2d');
    c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0);
    return f;
  }
  // 文字列グリッド → SVG data URI（HUD アイコン用）
  function gridSVG(grid, pal) {
    const h = grid.length, w = grid[0].length;
    let rects = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === '.' || !pal[ch]) continue;
      rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[ch]}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }

  // ---------- HUD アイコン ----------
  const ICONS = {
    flame: [[
      '....r.....',
      '....rr....',
      '...rrr....',
      '...roor...',
      '..rroor.r.',
      '.rrooyorr.',
      '.rooyyyorr',
      'rroyyyyyor',
      'royyywyyor',
      'royyyyyyor',
      '.royyyyor.',
      '..rrrrrr..',
    ], { r: '#e8321e', o: '#ff8a1f', y: '#ffd84a', w: '#fff6c8' }],
    drop: [[
      '....b.....',
      '...bbb....',
      '...bbb....',
      '..bLbbb...',
      '..bLbbb...',
      '.bLbbbbb..',
      '.bLbbbbbb.',
      'bLbbbbbbbb',
      'bbbbbbbbDb',
      'bbbbbbbbDb',
      '.bbbbbbDb.',
      '..bbbbbb..',
    ], { b: '#3b9cf0', L: '#c9ecff', D: '#1f6fc4' }],
    crown: [[
      'y....y....y',
      'yy..yyy..yy',
      'yyy.yyy.yyy',
      'yyyyyyyyyyy',
      'yyrrryBByyy',
      'yyyyyyyyyyy',
      'OOOOOOOOOOO',
    ], { y: '#ffc21f', O: '#d98500', r: '#e8433a', B: '#3c90e6' }],
    heart: [[
      '.kk...kk.',
      'krrk.krrk',
      'krwrkrrrk',
      'krrrrrrrk',
      '.krrrrrk.',
      '..krrrk..',
      '...krk...',
      '....k....',
    ], { k: '#1b2333', r: '#ff4d5e', w: '#ffd0d6' }],
    heartGold: [[
      '.kk...kk.',
      'krrk.krrk',
      'krwrkrrrk',
      'krrrrrrrk',
      '.krrrrrk.',
      '..krrrk..',
      '...krk...',
      '....k....',
    ], { k: '#1b2333', r: '#ffc21f', w: '#fff3b0' }],
    heartEmpty: [[
      '.kk...kk.',
      'krrk.krrk',
      'krrrkrrrk',
      'krrrrrrrk',
      '.krrrrrk.',
      '..krrrk..',
      '...krk...',
      '....k....',
    ], { k: '#1b2333', r: '#8d97a8' }],
    star: [[
      '....k....',
      '....k....',
      '...kwk...',
      'kkkkwkkkk',
      '.kwwwwwk.',
      '..kwwwk..',
      '..kwkwk..',
      '.kwk.kwk.',
      '.kk...kk.',
    ], { k: '#d6dbe4', w: '#28324a' }],
    search: [[
      '..kkkk....',
      '.kLLbbk...',
      'kLbbbbbk..',
      'kbbbbbbk..',
      'kbbbbbbk..',
      '.kbbbbk...',
      '..kkkkoo..',
      '......ooo.',
      '.......ooo',
      '........oo',
    ], { k: '#28324a', L: '#ffffff', b: '#8fd0ff', o: '#c07a2c' }],
    shield: [[
      'kkkkkkkkk',
      'kgggggGGk',
      'kgLggggGk',
      'kgLgggwGk',
      'kggggwgGk',
      'kgwgwggGk',
      '.kgwggGk.',
      '..kgggk..',
      '...kgk...',
      '....k....',
    ], { k: '#1b5e34', g: '#34b45c', G: '#24884a', L: '#9ff0b8', w: '#ffffff' }],
    check: [[
      '........gg',
      '.......ggg',
      'gg....ggg.',
      'ggg..ggg..',
      '.gggggg...',
      '..gggg....',
      '...gg.....',
    ], { g: '#23a050' }],
    cross: [[
      'rr....rr',
      'rrr..rrr',
      '.rrrrrr.',
      '..rrrr..',
      '.rrrrrr.',
      'rrr..rrr',
      'rr....rr',
    ], { r: '#e8433a' }],
    book: [[
      'kkkkk.kkkkk',
      'kwwwwkwwwwk',
      'kwbbwkwbbwk',
      'kwwwwkwwwwk',
      'kwbbwkwbbwk',
      'kwwwwkwwwwk',
      'kkkkkkkkkkk',
    ], { k: '#8a5a2c', w: '#fff8ec', b: '#c9b79a' }],
    pad: [[
      '.kkkkkkkkk.',
      'kggggggggGk',
      'kgwgggggrgk',
      'kwwwgggrgrk',
      'kgwgggggrgk',
      'kggggggggGk',
      '.kGk...kGk.',
    ], { k: '#28324a', g: '#7c8aa6', G: '#5b6884', w: '#ffffff', r: '#ffd21f' }],
    bulb: [[
      '..yyyy..',
      '.yywyyy.',
      'yywyyyyy',
      'yyyyyyyy',
      '.yyyyyy.',
      '..kkkk..',
      '..kkkk..',
    ], { y: '#ffd21f', w: '#fff8c8', k: '#7c8aa6' }],
    hands: [[
      'ss......ss',
      'sss.ss.sss',
      '.ssssssss.',
      '..ssssss..',
      '...cccc...',
      '..cc..cc..',
    ], { s: '#ffcf9a', c: '#e6a35a' }],
    target: [[
      '..rrrrr..',
      '.rwwwwwr.',
      'rwrrrrrwr',
      'rwrwwwrwr',
      'rwrwrwrwr',
      'rwrwwwrwr',
      'rwrrrrrwr',
      '.rwwwwwr.',
      '..rrrrr..',
    ], { r: '#e8433a', w: '#ffffff' }],
    building: [[
      '....rrrr....',
      '..rrrrrrrr..',
      'rrrrrrrrrrrr',
      'wwwwwwwwwwww',
      'wbbwwbbwwbbw',
      'wbbwwbbwwbbw',
      'wwwwwddwwwww',
      'wbbwwddwwbbw',
      'wwwwwddwwwww',
    ], { r: '#c8553d', w: '#efe3cf', b: '#5b97cf', d: '#8a5a3c' }],
  };
  function installIcons() {
    const root = document.documentElement;
    for (const [name, [grid, pal]] of Object.entries(ICONS)) {
      root.style.setProperty(`--ico-${name}`, gridSVG(grid, pal));
    }
  }

  // ---------- スプライト ----------
  const FF_PAL = {
    k: '#2a1f2e', y: '#ffd21f', Y: '#e2a400', w: '#ffffff', h: '#2b1d1a', s: '#ffd9b8',
    e: '#2a1f2e', p: '#ff9c9c', r: '#e2412b', R: '#a92d22', l: '#ffe066', g: '#3a3a46', b: '#3a2a2a',
  };
  const FF_HEAD = [
    '...kkkkkk...',
    '..kyyyyyyk..',
    '.kyyyywwyyk.',
    '.kyyyywwyyk.',
    'kYyyyyyyyyYk',
    'kkYYYYYYYYkk',
    '.khhhhhhhhk.',
    '.khhssssshk.',
    '.khsesssesk.',
    '.kspssssspk.',
    '..kkrrrrkk..',
    '.krrlrrlrrk.',
    'kgrrrrrrrrgk',
    '.kllllllllk.',
  ];
  const FF_A = FF_HEAD.concat(['.kRRRkkRRRk.', '.kbbk..kbbk.']);
  const FF_B = FF_HEAD.concat(['..kRRkkRRRk.', '..kbbk..kbbk']);
  const FF_C = FF_HEAD.concat(['.kRRRkkRRk..', 'kbbk..kbbk..']);
  const PLAYER_PAL = Object.assign({}, FF_PAL, { y: '#ff5a4a', Y: '#c8322a', w: '#ffffff' });

  const CONE = [
    '...oo...',
    '...oo...',
    '..wwww..',
    '..oooo..',
    '..oooo..',
    '.wwwwww.',
    '.oooooo.',
    '.oooooo.',
    'kkkkkkkk',
  ];

  let SPR = null;
  function buildSprites() {
    const mk = (g, pal) => { const c = gridCanvas(g, pal, 2); return [c, flipped(c)]; };
    SPR = {
      ff: [mk(FF_A, FF_PAL), mk(FF_B, FF_PAL), mk(FF_C, FF_PAL)],
      player: [mk(FF_A, PLAYER_PAL), mk(FF_B, PLAYER_PAL), mk(FF_C, PLAYER_PAL)],
      cone: gridCanvas(CONE, { o: '#ff6a2a', w: '#ffffff', k: '#9a4b2a' }, 2),
    };
    return SPR;
  }

  // ---------- 背景 ----------
  function win(c, x, y, w, h, frame = '#f4ead8') {
    R(c, x - 1, y - 1, w + 2, h + 2, '#6e5444');
    R(c, x, y, w, h, frame);
    R(c, x + 2, y + 2, w - 4, h - 4, '#5b97cf');
    R(c, x + 2, y + 2, w - 4, Math.floor((h - 4) / 2), '#78b0e2');
    R(c, x + Math.floor(w / 2) - 1, y + 2, 2, h - 4, frame);
    R(c, x + 2, y + Math.floor(h / 2), w - 4, 1, frame);
    R(c, x + 3, y + 3, 2, 3, '#d4ecfc');
    R(c, x - 2, y + h + 1, w + 4, 2, '#cdbca2');
  }

  function cloud(c, x, y, s) {
    const parts = [[0, 8, 8], [10, 3, 10], [22, 6, 9], [31, 10, 7], [-8, 11, 6]];
    parts.forEach(([dx, dy, r]) => circ(c, x + dx * s, y + dy * s + 2, r * s, '#d7e8f6'));
    parts.forEach(([dx, dy, r]) => circ(c, x + dx * s, y + dy * s, r * s, '#ffffff'));
    R(c, x - 13 * s, y + 12 * s, 50 * s, 4 * s, '#ffffff');
    R(c, x - 12 * s, y + 16 * s, 48 * s, 2 * s, '#d7e8f6');
  }

  function tree(c, x, y, r) {
    R(c, x - 2, y, 5, GROUND - y + 2, '#7a4f2f');
    R(c, x + 1, y, 2, GROUND - y + 2, '#5d3a22');
    circ(c, x - r * 0.55, y - r * 0.1, r * 0.75, '#2f7d32');
    circ(c, x + r * 0.55, y - r * 0.05, r * 0.75, '#2f7d32');
    circ(c, x, y - r * 0.6, r * 0.85, '#2f7d32');
    circ(c, x - r * 0.45, y - r * 0.25, r * 0.6, '#47a64a');
    circ(c, x + r * 0.35, y - r * 0.2, r * 0.6, '#47a64a');
    circ(c, x - r * 0.1, y - r * 0.7, r * 0.65, '#47a64a');
    circ(c, x - r * 0.3, y - r * 0.85, r * 0.3, '#7cc95a');
    circ(c, x - r * 0.65, y - r * 0.35, r * 0.22, '#7cc95a');
    circ(c, x + r * 0.3, y - r * 0.5, r * 0.2, '#7cc95a');
  }

  function bush(c, x, y, r) {
    circ(c, x, y, r, '#2c7a35');
    circ(c, x - r * 0.3, y - r * 0.3, r * 0.65, '#3f9a45');
    circ(c, x - r * 0.4, y - r * 0.5, r * 0.25, '#6fc35a');
    circ(c, x + r * 0.3, y - r * 0.2, r * 0.18, '#6fc35a');
  }

  // 主要な建物（燃える可能性のある建物）
  const BUILDINGS = [
    { name: 'ひので荘', type: 'house', x: 130, w: 84, top: 52, roofBase: 84, wall: '#ecd3ae', wallD: '#d2b48a', wallL: '#e0c49c', roof: '#c8553d', roofD: '#9b3d2e' },
    { name: '炎上商店', type: 'shop', x: 252, w: 104, top: 96, wall: '#e8c595', wallD: '#cfa676', wallL: '#d9b17f' },
    { name: 'やまだ', type: 'house', x: 360, w: 58, top: 92, roofBase: 112, wall: '#d9dde6', wallD: '#bcc2ce', wallL: '#cdd2dc', roof: '#c8553d', roofD: '#9b3d2e' },
    { name: 'コーポ炎上', type: 'apt', x: 422, w: 58, top: 80, wall: '#e9cfa6', wallD: '#cdb08a', wallL: '#dcc098', roof: '#b84f3a', roofD: '#8f3b2c' },
  ];

  function roofYAt(b, x) {
    if (b.type !== 'house') return b.top;
    const cx = b.x + b.w / 2, topHalf = b.w * 0.24, baseHalf = b.w / 2 + 5;
    const d = Math.abs(x - cx);
    if (d <= topHalf) return b.top;
    const k = Math.min(1, (d - topHalf) / (baseHalf - topHalf));
    return b.top + k * (b.roofBase - b.top);
  }

  function drawHouse(c, b) {
    const { x, w } = b;
    R(c, x, b.roofBase, w, GROUND - b.roofBase, b.wall);
    for (let y = b.roofBase + 5; y < GROUND; y += 5) R(c, x, y, w, 1, b.wallL);
    R(c, x + w - 4, b.roofBase, 4, GROUND - b.roofBase, b.wallD);
    // 屋根（台形）
    const rh = b.roofBase - b.top, cx = x + w / 2;
    const topHalf = w * 0.24, baseHalf = w / 2 + 5;
    for (let i = 0; i <= rh; i++) {
      const half = Math.round(topHalf + (baseHalf - topHalf) * (i / rh));
      R(c, cx - half, b.top + i, half * 2, 1, (i % 4 === 3) ? b.roofD : b.roof);
    }
    R(c, cx - topHalf - 1, b.top - 2, topHalf * 2 + 2, 2, b.roofD);
    R(c, x - 6, b.roofBase, w + 12, 3, b.roofD);
    // 窓
    b.windows = [];
    const ww = w > 70 ? 22 : 16, wh = w > 70 ? 20 : 16;
    const cols = w > 70 ? [x + 10, x + w - 10 - ww] : [x + 6, x + w - 6 - ww];
    const rows = w > 70 ? [b.roofBase + 10, b.roofBase + 44] : [b.roofBase + 8];
    rows.forEach(ry => cols.forEach(cxw => { win(c, cxw, ry, ww, wh); b.windows.push({ x: cxw, y: ry, w: ww, h: wh }); }));
    // 看板とドア
    const sw = Math.min(58, w - 14);
    b.sign = { x: x + (w - sw) / 2, y: GROUND - 44, w: sw, h: 14 };
    const dw = 14;
    R(c, x + w / 2 - dw / 2 - 1, GROUND - 26, dw + 2, 26, '#5d3a26');
    R(c, x + w / 2 - dw / 2, GROUND - 25, dw, 25, '#8a5a3c');
    R(c, x + w / 2 + dw / 2 - 4, GROUND - 13, 2, 2, '#ffd21f');
    R(c, x - 1, GROUND - 3, w + 2, 3, '#9d8a74');
  }

  function drawShop(c, b) {
    const { x, w, top } = b;
    R(c, x, top, w, GROUND - top, b.wall);
    for (let y = top + 4, i = 0; y < GROUND; y += 5, i++) {
      R(c, x, y, w, 1, b.wallL);
      for (let bx = x + (i % 2 ? 4 : 10); bx < x + w; bx += 12) R(c, bx, y - 4, 1, 4, b.wallL);
    }
    R(c, x + w - 4, top, 4, GROUND - top, b.wallD);
    // 胸壁
    R(c, x - 3, top - 4, w + 6, 6, '#a9533b');
    R(c, x - 3, top + 1, w + 6, 1, '#7d3a28');
    for (let mx = x - 3; mx < x + w; mx += 12) { R(c, mx, top - 10, 7, 6, '#a9533b'); R(c, mx, top - 10, 7, 1, '#c8735a'); }
    // 看板
    b.sign = { x: x + 9, y: top + 12, w: w - 18, h: 26 };
    R(c, b.sign.x - 3, b.sign.y - 3, b.sign.w + 6, b.sign.h + 6, '#4a2f25');
    R(c, b.sign.x - 1, b.sign.y - 1, b.sign.w + 2, b.sign.h + 2, '#d9c6c0');
    R(c, b.sign.x, b.sign.y, b.sign.w, b.sign.h, '#fbeeee');
    // ひさし
    b.windows = [];
    const aw = [[x + 6, 38], [x + w - 44, 38]];
    aw.forEach(([ax, awid]) => {
      R(c, ax - 2, top + 50, awid + 4, 3, '#7d3a28');
      for (let i = 0; i < awid; i += 6) R(c, ax + i, top + 53, 3, 6, '#c9673f'), R(c, ax + i + 3, top + 53, 3, 6, '#f0b07c');
      win(c, ax + 3, top + 62, awid - 6, 24);
      b.windows.push({ x: ax + 3, y: top + 62, w: awid - 6, h: 24 });
    });
    // ドア
    R(c, x + w / 2 - 9, top + 58, 18, GROUND - top - 58, '#5d3a26');
    R(c, x + w / 2 - 8, top + 59, 16, GROUND - top - 59, '#8a5a3c');
    R(c, x + w / 2 - 6, top + 62, 12, 14, '#78b0e2');
  }

  function drawApt(c, b) {
    const { x, w, top } = b;
    R(c, x, top, w, GROUND - top, b.wall);
    R(c, x + w - 4, top, 4, GROUND - top, b.wallD);
    R(c, x - 3, top - 6, w + 6, 6, b.roof);
    R(c, x - 3, top - 1, w + 6, 2, b.roofD);
    for (let i = 0; i < w + 6; i += 6) R(c, x - 3 + i, top - 6, 3, 1, '#d8705a');
    b.windows = [];
    [top + 8, top + 36, top + 64].forEach(ry => {
      R(c, x, ry + 22, w, 2, b.wallD);
      [x + 6, x + w - 24].forEach(rx => { win(c, rx, ry, 18, 18); b.windows.push({ x: rx, y: ry, w: 18, h: 18 }); });
    });
    b.sign = { x: x + 7, y: GROUND - 26, w: w - 14, h: 13 };
    R(c, x + w / 2 - 6, GROUND - 12, 12, 12, '#8a5a3c');
  }

  function drawSign(c, b) {
    if (b.type === 'shop') return;
    const s = b.sign;
    R(c, s.x - 2, s.y - 2, s.w + 4, s.h + 4, '#4a2f25');
    R(c, s.x, s.y, s.w, s.h, '#fbeeee');
  }

  function buildBackground() {
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const c = bg.getContext('2d');
    // 空
    const bands = ['#4b9ce4', '#55a4e8', '#61adec', '#6eb6ef', '#7cbff2', '#8ac8f4', '#98d0f6', '#a6d8f8', '#b4dff9', '#c2e6fb'];
    const bh = Math.ceil(GROUND / bands.length);
    bands.forEach((col, i) => R(c, 0, i * bh, W, bh, col));
    cloud(c, 112, 12, 1);
    cloud(c, 384, 34, 0.85);
    cloud(c, 172, 44, 0.45);
    // 遠景のビル
    const far = [[0, 36, 54], [44, 30, 70], [150, 36, 66], [188, 30, 18], [222, 30, 50], [300, 34, 36], [336, 30, 58], [388, 34, 26], [426, 44, 44]];
    far.forEach(([fx, fw, ft]) => {
      R(c, fx, ft, fw, GROUND - ft, '#93b4d4');
      R(c, fx + fw - 4, ft, 4, GROUND - ft, '#7f9fc2');
      R(c, fx, ft, fw, 2, '#a9c4de');
      for (let wy = ft + 6; wy < GROUND - 10; wy += 9)
        for (let wx = fx + 4; wx < fx + fw - 7; wx += 8) R(c, wx, wy, 4, 5, '#bcd3ea');
    });
    // 左奥の建物（パネルの裏）
    R(c, 0, 90, 118, GROUND - 90, '#e3cfb0');
    R(c, 0, 86, 122, 5, '#b84f3a');
    for (let ry = 98; ry < GROUND - 30; ry += 30) [8, 44, 80].forEach(rx => win(c, rx, ry, 22, 18));
    // 電柱
    R(c, 38, 30, 5, GROUND - 26, '#9aa0a8');
    R(c, 41, 30, 2, GROUND - 26, '#7d838b');
    R(c, 28, 44, 26, 3, '#7d838b');
    // 木（奥）
    tree(c, 112, 150, 22);
    tree(c, 233, 146, 20);
    // 建物
    BUILDINGS.forEach(b => {
      if (b.type === 'house') drawHouse(c, b);
      else if (b.type === 'shop') drawShop(c, b);
      else drawApt(c, b);
      drawSign(c, b);
      b.cx = b.x + b.w / 2;
    });
    // 歩道
    R(c, 0, GROUND, W, 24, '#d8d3ca');
    for (let y = GROUND + 8; y < GROUND + 24; y += 8) R(c, 0, y, W, 1, '#c4beb4');
    for (let y = GROUND, i = 0; y < GROUND + 24; y += 8, i++)
      for (let x = (i % 2) * 8; x < W; x += 16) R(c, x, y, 1, 8, '#c4beb4');
    R(c, 0, GROUND, W, 2, '#bdb6aa');
    // 店の階段
    const shop = BUILDINGS[1];
    R(c, shop.x + 22, GROUND - 6, shop.w - 44, 3, '#c9c5be');
    R(c, shop.x + 18, GROUND - 3, shop.w - 36, 4, '#b3afa8');
    R(c, shop.x + 14, GROUND + 1, shop.w - 28, 4, '#c9c5be');
    R(c, shop.x + 14, GROUND + 5, shop.w - 28, 1, '#9a968f');
    // 縁石と車道
    R(c, 0, GROUND + 24, W, 3, '#aaa69e');
    R(c, 0, GROUND + 27, W, 1, '#8a8780');
    R(c, 0, GROUND + 28, W, H - GROUND - 28, '#7f8289');
    for (let i = 0; i < 260; i++) R(c, (i * 97) % W, GROUND + 30 + ((i * 53) % (H - GROUND - 30)), 2, 1, i % 2 ? '#878a91' : '#767980');
    return bg;
  }

  function buildForeground() {
    const fg = document.createElement('canvas');
    fg.width = W; fg.height = H;
    const c = fg.getContext('2d');
    bush(c, 10, 262, 16); bush(c, 34, 268, 14); bush(c, 58, 272, 12);
    bush(c, 470, 258, 18); bush(c, 446, 266, 14); bush(c, 424, 272, 12);
    return fg;
  }

  // ---------- 消防車 ----------
  function drawTruck(c, x, y, t) {
    // y = 車輪の接地位置
    const body = '#d8342a', dark = '#a8241d', light = '#f25a4a';
    R(c, x + 2, y - 4, 104, 3, 'rgba(0,0,0,0.18)');
    // はしご
    R(c, x + 30, y - 50, 74, 3, '#e8ecf2'); R(c, x + 30, y - 44, 74, 3, '#e8ecf2');
    for (let i = x + 32; i < x + 104; i += 6) R(c, i, y - 47, 2, 3, '#b9c1cc');
    R(c, x + 30, y - 41, 74, 1, '#9aa3ae');
    // 後部
    R(c, x + 30, y - 40, 74, 30, body);
    R(c, x + 30, y - 40, 74, 2, light);
    for (let i = 0; i < 3; i++) {
      const sx = x + 34 + i * 23;
      R(c, sx, y - 36, 20, 20, '#d9dde4');
      for (let ly = y - 34; ly < y - 16; ly += 3) R(c, sx + 1, ly, 18, 1, '#aeb5c0');
    }
    // 運転席
    R(c, x + 2, y - 36, 30, 26, body);
    R(c, x + 4, y - 40, 26, 5, body);
    R(c, x + 6, y - 34, 20, 10, '#9fd0f2'); R(c, x + 7, y - 33, 6, 3, '#e2f3ff');
    R(c, x + 2, y - 36, 2, 26, light);
    R(c, x + 28, y - 30, 2, 10, dark);
    // ライン
    R(c, x + 2, y - 16, 102, 3, '#ffe066');
    R(c, x + 2, y - 13, 102, 4, dark);
    R(c, x - 1, y - 12, 6, 4, '#c9cdd4');
    R(c, x + 1, y - 22, 3, 3, '#fff6b0');
    // 回転灯
    const on = Math.floor(t * 6) % 2;
    R(c, x + 8, y - 43, 16, 3, '#3a3a46');
    R(c, x + 9, y - 46, 6, 3, on ? '#ff3a3a' : '#7a2020');
    R(c, x + 17, y - 46, 6, 3, on ? '#3a3a46' : '#ff3a3a');
    // 車輪
    [x + 20, x + 84].forEach(wx => { circ(c, wx, y - 6, 6, '#26262e'); circ(c, wx, y - 6, 3, '#b9c1cc'); R(c, wx - 1, y - 7, 2, 2, '#ffffff'); });
  }

  // ---------- マスコット（ヒヨコ隊長） ----------
  function drawMascot(c, t) {
    c.clearRect(0, 0, 32, 32);
    const bob = Math.round(Math.sin(t * 5) * 0.8);
    const k = '#2a1f2e';
    // 足
    R(c, 9, 29, 3, 2, '#ff9a1f'); R(c, 15, 29, 3, 2, '#ff9a1f');
    // 体
    circ(c, 13, 20 + bob, 9, k);
    circ(c, 13, 20 + bob, 8, '#ffffff');
    R(c, 7, 24 + bob, 12, 3, '#e6edf5');
    // ヘルメット
    circ(c, 13, 12 + bob, 8, k);
    circ(c, 13, 12 + bob, 7, '#e2412b');
    R(c, 4, 13 + bob, 19, 7, '#ffffff');
    R(c, 3, 12 + bob, 21, 2, k);
    R(c, 4, 11 + bob, 19, 1, '#b72e1f');
    R(c, 11, 6 + bob, 4, 4, '#ffffff'); R(c, 12, 7 + bob, 2, 2, '#ff9fb2');
    // 顔
    R(c, 15, 15 + bob, 2, 3, k);
    R(c, 9, 15 + bob, 2, 3, k);
    R(c, 7, 18 + bob, 3, 2, '#ffb3c1'); R(c, 17, 18 + bob, 3, 2, '#ffb3c1');
    R(c, 11, 18 + bob, 4, 2, '#ffb21f'); R(c, 12, 20 + bob, 2, 1, '#e08a00');
    // 羽とメガホン
    R(c, 18, 21 + bob, 4, 4, '#e6edf5');
    R(c, 20, 18 + bob, 4, 6, '#e3a000');
    R(c, 24, 15 + bob, 2, 12, '#ffd21f');
    R(c, 26, 13 + bob, 2, 16, '#ffd21f');
    R(c, 28, 12 + bob, 2, 18, '#ffe680');
    R(c, 22, 19 + bob, 2, 4, '#ffd21f');
    const w = Math.floor(t * 4) % 2;
    if (w) { R(c, 30, 14 + bob, 1, 3, '#ffffff'); R(c, 30, 23 + bob, 1, 3, '#ffffff'); }
  }

  return {
    W, H, GROUND, R, circ, gridCanvas, installIcons, buildSprites, buildBackground, buildForeground,
    BUILDINGS, roofYAt, drawTruck, drawMascot, get SPR() { return SPR; },
  };
})();
