// Tarayıcı gerektirmeyen davranış testleri: node tests/game-mechanics.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

async function game() {
  const elements = new Map(), handlers = { window: {}, document: {} }, frames = [];
  let audioTime = 0;
  const bitmaps = [], blits = [];
  const stack = [], rects = [], labels = [], colors = [], audios = [], audible = [];
  const ctx = { globalAlpha: 1, fillStyle: '#000',
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    restore() { Object.assign(this, stack.pop()); } };
  for (const method of ['setTransform','clearRect','fillRect','drawImage','fillText','beginPath','ellipse','fill','stroke','moveTo','lineTo']) ctx[method] = () => {};
  ctx.fillRect = (...args) => { rects.push(args); colors.push(ctx.fillStyle); };
  ctx.fillText = (text) => labels.push(text);
  ctx.drawImage = (...args) => blits.push(args);
  const createElement = tag => {
    assert.equal(tag, 'canvas');
    const commands = [];
    const buffer = { fillStyle: '', fillRect(...args) { commands.push({ color: this.fillStyle, args }); } };
    const bitmap = { commands, getContext: () => buffer };
    bitmaps.push(bitmap);
    return bitmap;
  };
  for (const [, id] of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)) {
    elements.set('#' + id, { hidden: true, style: {}, textContent: '', addEventListener() {}, focus() {}, replaceChildren() {}, getContext: () => ctx, getBoundingClientRect: () => ({ width: 375, height: 600 }) });
  }
  const listen = group => (name, callback) => (handlers[group][name] ??= []).push(callback);
  class Image {
    naturalWidth = 910; naturalHeight = 1020;
    set src(value) { this.source = value; queueMicrotask(() => this.onload()); }
    async decode() {}
  }
  class Audio {
    constructor(src) { this.src=src; this.paused=true; this.ended=false; this.volume=1; this.currentTime=0; this.listeners={}; audios.push(this); }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    emit(type) { if(type==='ended'){this.ended=true;this.paused=true;} for(const fn of this.listeners[type] || [])fn(); }
    play() {
      if(this.block){this.paused=true;return Promise.reject(Object.assign(new Error('Blocked'),{name:'NotAllowedError'}));}
      this.paused=false;this.ended=false;
      if(this.volume>0)audible.push(this);
      return Promise.resolve();
    }
    pause() { this.paused=true; }
  }
  const scope = { performance: { now: () => audioTime }, Image, Audio, document: { createElement, body: { dataset: {} }, hidden: false, querySelector: id => elements.get(id), addEventListener: listen('document') },
    window: { innerWidth: 375, devicePixelRatio: 2, matchMedia: () => ({ matches: false }), addEventListener: listen('window') },
    ResizeObserver: class { observe() {} }, requestAnimationFrame: callback => frames.push(callback) };
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  // Test erişimi yalnızca VM kopyasına eklenir; üretim koduna debug API konmaz.
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `
    globalThis.api = { startGame, collect, update, draw, requestDash, spawnObject, player, keys, drawPixelArt, drawStarfield, pixelSprites, pixelPalette, skyStars,
      get ready(){return assetsReady}, get score(){return score}, get state(){return state},
      get phase(){return gamePhase}, get skyTime(){return starfieldTime}, get dash(){return dashTime}, get cooldown(){return dashCooldown},
      get shake(){return shakeTime}, get flash(){return flashTime}, get wind(){return windActive},
      get ghosts(){return dashGhosts}, get objects(){return objects}, get particles(){return particles},
      get touches(){return touches}, get fever(){return feverTime},
      setScore(value){score=value}, clear(){objects=[];spawnTimer=Infinity}, add(object){objects.push(object)}
    }; })();`), scope);
  await new Promise(setImmediate);
  assert.equal(scope.api.ready, true);
  const g = scope.api;
  g.fire = (group, type, data = {}) => {
    const event = { type, preventDefault() {}, ...data };
    for (const fn of handlers[group][type] || []) fn(event);
  };
  g.tick = duration => { while (duration > 1e-9) { const dt = Math.min(duration, 1 / 120); g.update(dt); duration -= dt; } };
  g.phaseTwo = () => { g.startGame(); g.setScore(490); g.collect({ points: 10, x: 100, y: 100 }); g.setScore(200); g.clear(); };
  g.enemy = () => ({ x: g.player.x, baseX: g.player.x, y: g.player.y, phase: 0, frequency: 0, amplitude: 0, size: 48, bad: true, imageKey: 'enemy', speedFactor: 0 });
  g.advanceAudio = ms => { audioTime += ms; };
  g.bitmaps = bitmaps; g.blits = blits; g.document = scope.document;
  g.elements = elements; g.frames = frames; g.ctx = ctx; g.rects = rects; g.labels = labels; g.colors = colors; g.audios = audios; g.audible = audible;
  g.audio = file => audios.find(a => decodeURIComponent(a.src) === `assets/${file}`);
  return g;
}

test('Faz 1 dash açılmaz; düşman hâlâ oyunu bitirir', async () => {
  const g = await game(); g.startGame();
  assert.equal(g.requestDash(), false);
  g.add(g.enemy()); g.update(0); assert.equal(g.state, 'over');
});

test('Space yönü, 0.5 sn dokunulmazlık ve başlangıçtan 2 sn cooldown', async () => {
  const g = await game(); g.phaseTwo();
  g.keys.add('a');
  g.fire('window', 'keydown', { key: ' ', code: 'Space', repeat: false });
  assert.equal(g.dash, .5); assert.equal(g.cooldown, 2);
  const x = g.player.x; g.tick(.1); assert(g.player.x < x - 50); assert(g.ghosts.length > 0);
  const cooldown = g.cooldown;
  g.fire('window', 'keydown', { key: ' ', code: 'Space', repeat: true });
  assert.equal(g.cooldown, cooldown);
  // Sol duvara dayanmışken sürekli temas: dash sırasında sıfır ceza.
  g.tick(.1); g.add(g.enemy()); g.tick(.28);
  assert.equal(g.score, 200); assert.equal(g.shake, 0);
  assert.equal(g.requestDash(), false);
  g.tick(.04); assert.equal(g.dash, 0); assert.equal(g.score, 150);
  assert(g.particles.some(p => p.points === -50)); assert(g.shake > 0);
  g.clear(); g.tick(1.49); assert.equal(g.requestDash(1), true);
});

test('Double Tap: aynı yarı, 300 ms sınırı; hareket ve çoklu dokunma', async () => {
  const g = await game();
  const down = (x, time) => g.fire('document', 'touchstart', { timeStamp: time, touches: [{ identifier: 1, clientX: x }], changedTouches: [{ identifier: 1, clientX: x }] });
  const up = () => g.fire('document', 'touchend', { touches: [] });
  g.phaseTwo(); down(300, 0); up(); down(300, 300); assert.equal(g.dash, .5);
  const x = g.player.x; g.tick(.05); assert(g.player.x > x); up(); assert.equal(g.touches.size, 0);
  g.phaseTwo(); down(20, 0); up(); down(20, 301); assert.equal(g.dash, 0);
  g.phaseTwo(); down(20, 0); up(); down(300, 100); assert.equal(g.dash, 0);
  g.phaseTwo(); down(20, 0);
  g.fire('document', 'touchstart', { timeStamp: 100, touches: [{identifier:1,clientX:20},{identifier:2,clientX:20}], changedTouches: [{identifier:2,clientX:20}] });
  assert.equal(g.dash, 0);
  g.fire('document', 'touchcancel', { touches: [] }); down(20, 150); assert.equal(g.dash, 0);
});

test('Ceza efekti 0.25 sn; titreme ±12px, çizim opaklığı geri yüklenir', async () => {
  const g = await game(); g.phaseTwo(); g.add(g.enemy()); g.update(0);
  assert.equal(g.score, 150); assert.equal(g.shake, .25); assert.equal(g.flash, .25);
  g.draw(); const transform = g.elements.get('#game').style.transform;
  const coords = [...transform.matchAll(/(-?[\d.]+)px/g)].map(m => Number(m[1]));
  assert.equal(coords.length, 2); assert(coords.every(n => Math.abs(n) <= 12)); assert.equal(g.ctx.globalAlpha, 1);
  g.tick(.24); assert(g.shake > 0); g.tick(.02); g.draw(); assert.equal(g.shake, 0); assert.equal(g.flash, 0); assert.equal(g.elements.get('#game').style.transform, '');
});

test('750 eşiği, tüm obje tiplerinde sola rüzgâr ve skor düşünce kalıcılık', async () => {
  const g = await game(); g.phaseTwo(); g.setScore(740); assert.equal(g.wind, false);
  g.collect({ points: 10, x: 100, y: 100 }); assert.equal(g.wind, true);
  assert.equal(g.elements.get('#wind-notice').hidden, false);
  g.setScore(200); g.clear();
  g.add({x:200,y:0,size:30,speedFactor:1,bad:false,sprite:'burger',points:10});
  g.add({x:200,y:0,size:48,speedFactor:2,bad:false,bonus:true,imageKey:'cat',points:50});
  g.add({...g.enemy(),x:200,baseX:200,y:0,speedFactor:1});
  g.tick(.1); assert(g.objects.every(o => o.x < 200 && o.y > 0)); assert.equal(g.wind, true);
  g.clear(); g.add({x:-50,y:0,size:30,speedFactor:1,bad:false});g.update(0); assert.equal(g.objects.length,0);
  g.tick(3); assert.equal(g.elements.get('#wind-notice').hidden,true); assert.equal(g.wind,true);
});

test('Kedi molası, kazanma ve yeniden başlatma yeni efektleri temizler', async () => {
  const g = await game(); g.phaseTwo();g.setScore(750);g.collect({points:10,x:100,y:100});g.clear();
  g.add(g.enemy());g.add({x:g.player.x,y:g.player.y,size:48,speedFactor:2,bonus:true,bad:false,imageKey:'cat',points:50});g.update(0);
  assert.equal(g.fever,5);assert(g.objects.every(o=>!o.bad));assert.equal(g.shake,0);
  g.requestDash();g.tick(.05);g.setScore(990);g.collect({points:10,x:100,y:100});
  assert.equal(g.state,'won');assert.equal(g.dash,0);assert.equal(g.ghosts.length,0);assert.equal(g.elements.get('#wind-notice').hidden,true);
  g.startGame();assert.equal(g.phase,1);assert.equal(g.wind,false);assert.equal(g.cooldown,0);assert.equal(g.fever,0);
  assert.equal(g.frames.length,1); // Oyun tekrar başlarken ikinci RAF döngüsü açılmaz.
});


test('Piksel görselleri 16×16; karakter ve objeler emoji fontu kullanmaz', async () => {
  const g = await game();
  for (const [name, grid] of Object.entries(g.pixelSprites)) {
    assert.equal(grid.length, 16, `${name}: satır sayısı`);
    grid.forEach((row, i) => assert.equal(row.length, 16, `${name}: satır ${i}`));
    g.drawPixelArt(name, 100, 100, 48);
  }
  assert.equal(g.blits.length, Object.keys(g.pixelSprites).length);
  assert(g.blits.every(([, ...coords]) => coords.every(n => n % 2 === 0)));
  assert.equal(g.labels.length, 0);
  g.startGame(); g.draw(); assert.equal(g.labels.length, 0);
  g.collect({points:10,x:100,y:100});g.draw();assert(g.labels.every(text => /^[-+]\d+$/.test(text)));
});

test('Üç yıldız katmanı başlangıç ekranında da aşağı akar', async () => {
  const g = await game();assert.equal(new Set(g.skyStars.map(star=>star.layer)).size,3);
  g.drawStarfield();const before=g.rects.map(r=>[...r]);g.rects.length=0;
  // Tek RAF zincirinin zamanını ilerlet; oyun başlamadan gökyüzü hareket eder.
  for(let i=0;i<61;i++)g.frames.shift()(1000+i*16.67);
  g.rects.length=0;g.drawStarfield();const after=g.rects;
  assert.equal(before.length,after.length);
  assert(after.some((r,i)=>r[1]>before[i][1]));assert(after.every((r,i)=>r[0]===before[i][0]));
  assert.equal(g.state,'ready');assert.equal(g.score,0);
});


test('Faz 2 kızıl yıldızları 4× hızlandırır; Faz 1 ve yeniden başlatma korunur', async () => {
  const first = await game(), second = await game();
  first.startGame(); second.phaseTwo();
  // Arka plan zamanı faz değişimi anında zıplamaz.
  assert.equal(second.skyTime, first.skyTime);
  for(let i=0;i<21;i++) {
    first.frames.shift()(1000+i*16);
    second.frames.shift()(1000+i*16);
  }
  assert(Math.abs(second.skyTime-first.skyTime*4)<1e-9);
  first.colors.length=0;second.colors.length=0;
  first.drawStarfield();second.drawStarfield();
  assert.deepEqual([...new Set(first.colors)].sort(), ['#474c80','#888ac5','#dae6ff'].sort());
  assert.deepEqual([...new Set(second.colors)].sort(), ['#c53a27','#ff9138','#ffe36e'].sort());
  second.startGame();second.frames.shift()(1336);const before=second.skyTime;second.frames.shift()(1352);
  assert(Math.abs(second.skyTime-before-.016)<1e-9);
});


test('Başlangıçta sessiz; Başla ile 0.3 sesli loop, Faz 2 sıralaması ve tekrar oyna', async () => {
  const g = await game();assert.equal(g.audible.length,0);
  const background=g.audio('arkaplan music.mp3'), transition=g.audio('phase 2 gecis.mp3'), finale=g.audio('son duzluk.mp3');
  assert(g.audios.every(a=>a.preload==='auto'));
  g.startGame();assert.equal(background.volume,.3);assert.equal(background.loop,true);assert.equal(background.paused,false);
  g.setScore(490);g.collect({points:10,x:100,y:100});assert.equal(background.paused,true);assert.equal(transition.paused,false);assert.equal(transition.loop,false);assert.equal(finale.paused,true);
  transition.emit('ended');assert.equal(finale.paused,false);assert.equal(finale.loop,true);
  g.startGame();assert.equal(finale.paused,true);assert.equal(transition.paused,true);assert.equal(background.paused,false);
  const plays=g.audible.length;transition.emit('ended');assert.equal(g.audible.length,plays);
});

test('Toplama 100 ms aralıkla çalar; hasar sesi yalnızca gerçek cezada çalar', async () => {
  const g=await game();g.phaseTwo();g.advanceAudio(100);g.audible.length=0;
  g.collect({points:10,x:100,y:100});g.advanceAudio(100);g.collect({points:10,x:100,y:100});
  assert.equal(g.audible.length,2);assert.notEqual(g.audible[0],g.audible[1]);assert(g.audible.every(a=>!a.paused));
  g.add(g.enemy());g.update(0);assert.equal(g.audible.at(-1),g.audio('carpma sound.mp3'));
  const plays=g.audible.length;g.requestDash();g.add(g.enemy());g.update(0);assert.equal(g.audible.length,plays);
});

test('Kaybetmede yalnızca game over; kazanmada tüm sesler susar', async () => {
  const g=await game();const over=g.audio('game over sound.mp3');g.startGame();g.add(g.enemy());g.update(0);
  assert.equal(over.paused,false);assert(g.audios.filter(a=>a!==over).every(a=>a.paused));
  g.phaseTwo();assert.equal(over.paused,true);g.setScore(990);g.audible.length=0;g.collect({points:10,x:100,y:100});
  assert.equal(g.state,'won');assert(g.audios.every(a=>a.paused));assert(!g.audible.includes(over));
  const plays=g.audible.length;g.audio('phase 2 gecis.mp3').emit('ended');assert.equal(g.audible.length,plays);
});

test('Autoplay reddi sonraki dokunuşta tekrar denenir; oyun akışı durmaz', async () => {
  const g=await game();const background=g.audio('arkaplan music.mp3');background.block=true;g.startGame();await new Promise(setImmediate);
  assert.equal(g.state,'playing');assert.equal(background.paused,true);background.block=false;g.fire('document','pointerdown');assert.equal(background.paused,false);
  const transition=g.audio('phase 2 gecis.mp3');transition.block=true;g.setScore(490);g.collect({points:10,x:100,y:100});await new Promise(setImmediate);
  assert.equal(g.phase,2);assert.equal(g.audio('son duzluk.mp3').paused,true);
  transition.block=false;g.fire('document','pointerdown');assert.equal(transition.paused,false);transition.emit('ended');assert.equal(g.audio('son duzluk.mp3').paused,false);
});

test('Beş toplama kanalı tekrar kullanılır; yakalama/hasar yeni Audio oluşturmaz', async () => {
  const g = await game();
  const pool = g.audios.filter(a => decodeURIComponent(a.src).endsWith('kalp top sound.mp3'));
  assert.equal(pool.length, 5); assert.equal(g.audios.length, 10);
  g.phaseTwo();
  for (let i = 0; i < 100; i++) {
    g.setScore(200); g.collect({points:10,x:100,y:100});
    g.add(g.enemy()); g.update(0);
  }
  g.startGame();
  assert.equal(g.audios.length, 10);
  assert(pool.every(a => a.volume === .2));
});

test('Kedi yağmuru 18 objeyi aşmaz; boşalan yer tekrar kullanılabilir', async () => {
  const g = await game(); g.phaseTwo();
  for (let i = 0; i < 200; i++) g.spawnObject('heart');
  assert.equal(g.objects.length, 18);
  g.objects[0].y = 601; g.update(0);
  assert.equal(g.objects.length, 17);
  g.spawnObject('heart'); assert.equal(g.objects.length, 18);
  g.spawnObject('enemy'); assert.equal(g.objects.length, 19);
  assert.equal(g.objects.filter(o => o.bad).length, 1);
});

test('Alt kenarı geçen her obje silinir; yarım çözünürlük görünür objeleri silmez', async () => {
  const g = await game(); g.phaseTwo();
  const visible = {x:50,y:400,size:30,speedFactor:0,bad:false,sprite:'heart'};
  g.add(visible);
  g.add({...visible,y:601});
  g.add({...g.enemy(),y:601});
  g.add({...visible,y:601,bonus:true,imageKey:'cat'});
  g.update(0);
  assert.equal(g.objects.length, 1); assert.equal(g.objects[0], visible);
});

test('Önbellekteki piksel hücreleri eski çizimle aynı; karelerde yeniden üretilmez', async () => {
  const g = await game();
  const initial = g.bitmaps.length;
  for (const [name, grid] of Object.entries(g.pixelSprites)) {
    for (const size of [16,30,34,44,48]) {
      g.drawPixelArt(name, 101, 99, size);
      const [bitmap, left, top, width, height] = g.blits.at(-1);
      assert.equal(left, Math.round((101-size/2)/2)*2);
      assert.equal(top, Math.round((99-size/2)/2)*2);
      assert.equal(width,size); assert.equal(height,size);
      const expected = [];
      for (let r=0;r<16;r++) for (let c=0;c<16;c++) {
        const color=g.pixelPalette[grid[r][c]]; if(!color)continue;
        const x=Math.round(c*size/32), y=Math.round(r*size/32);
        expected.push({color,args:[x,y,Math.round((c+1)*size/32)-x,Math.round((r+1)*size/32)-y]});
      }
      assert.deepEqual(bitmap.commands,expected);
    }
  }
  for(let i=0;i<100;i++)g.drawPixelArt('girl',100,100,44);
  assert.equal(g.bitmaps.length,initial);
  assert.equal(g.rects.length,0); // Hücreler ana canvas'a tek tek çizilmez.
});

test('Gizli sekmede çizim ve fizik durur; tek RAF zinciri korunur', async () => {
  const g = await game(); g.startGame(); g.clear();
  g.frames.shift()(1000);
  const before = g.rects.length, time = g.skyTime;
  g.document.hidden = true;
  for(let i=1;i<=60;i++)g.frames.shift()(1000+i*16);
  assert.equal(g.rects.length,before); assert.equal(g.skyTime,time);
  assert.equal(g.objects.length,0); assert.equal(g.frames.length,1);
  g.document.hidden=false;g.frames.shift()(2000);
  assert(g.rects.length>before); assert.equal(g.frames.length,1);
});

test('Ses freni 99/100 ms sınırını korur; puanları ve yeniden başlamayı etkilemez', async () => {
  const g = await game(); g.startGame(); g.audible.length = 0;
  for(let i=0;i<10;i++)g.collect({points:10,x:100,y:100});
  assert.equal(g.audible.length,1); assert.equal(g.score,100);
  g.advanceAudio(99);g.collect({points:10,x:100,y:100});
  assert.equal(g.audible.length,1);
  g.advanceAudio(1);g.collect({points:10,x:100,y:100});
  assert.equal(g.audible.length,2);assert.equal(g.score,120);
  g.startGame();g.audible.length=0;g.collect({points:10,x:100,y:100});
  assert.equal(g.audible.length,1);
});

test('Yalnız kedi yağmuru +30 verir; kahve ve normal objeler aynı kalır', async () => {
  const g=await game();g.startGame();g.clear();
  for(let i=0;i<50;i++)g.spawnObject('heart');
  assert.equal(g.objects.length,40);assert(g.objects.every(o=>o.points===10));
  g.phaseTwo();g.spawnObject('heart');
  assert.equal(g.objects[0].points,30);
  g.collect(g.objects[0]);assert.equal(g.score,230);
  g.clear();g.spawnObject();
  assert.equal(g.objects[0].points,g.objects[0].bonus?50:10);
});

test('Kedi yağmuru beş saniyede en fazla 20 yeni obje üretir', async () => {
  const g=await game();g.phaseTwo();
  g.add({x:g.player.x,y:g.player.y,size:48,speedFactor:0,bonus:true,bad:false,imageKey:'cat',points:50});
  g.update(0);assert.equal(g.fever,5);
  // Objeleri her adımda kaldırarak kapasite sınırından bağımsız spawn sayısını ölç.
  let spawned=0;
  for(let i=0;i<599;i++){
    g.update(1/120);spawned+=g.objects.length;g.objects.length=0;
  }
  assert(spawned>=19 && spawned<=20);
});
