"use strict";

(() => {
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const scoreLabel = document.querySelector("#score");
  const startScreen = document.querySelector("#start-screen");
  const endScreen = document.querySelector("#game-over");
  const restartButton = document.querySelector("#restart-button");
  const winScreen = document.querySelector("#win-screen");
  const winRestartButton = document.querySelector("#win-restart-button");
  const WIN_SCORE = 1000;
  const PHASE_TWO_SCORE = 500;
  const DASH_DURATION = 0.5;
  const DASH_COOLDOWN = 2; // İki dash başlangıcı arasında en az iki saniye.
  const DASH_SPEED = 1100;
  const WIND_SPEED = -115;
  const MAX_FEVER_OBJECTS = 40;
  const dashStatus = document.querySelector("#dash-status");
  const windNotice = document.querySelector("#wind-notice");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dashTime = 0, dashCooldown = 0, dashDirection = 1, lastDirection = 1;
  let dashTrailTimer = 0, dashGhosts = [], lastTap = null;
  let shakeTime = 0, flashTime = 0, windActive = false, windNoticeTime = 0;
  let elapsed = 0;
  const startButton = document.querySelector("#start-button");
  const assetStatus = document.querySelector("#asset-status");
  const phaseNotice = document.querySelector("#phase-notice");
  const phaseLabel = document.querySelector("#phase-label");
  const assets = {};
  let assetsReady = false, assetsLoading = false;
  let gamePhase = 1, phaseTimer = 0;
  const stageNotice = document.querySelector("#stage-notice");
  const feverNotice = document.querySelector("#fever-notice");
  let stage = 0, stageTimer = 0, feverTime = 0, trailTimer = 0;
  let stars = [];
  const goodSprites = ["heart", "flower", "chocolate"];
  const foodSprites = ["burger", "waffle"];
  const badSprites = ["book"]; // Eski iki düşman türü de artık piksel kitap olarak görünür.

  // Her satır tam 16 hücredir. Nokta saydamdır; diğer harfler palet rengidir.
  // Bunlar font glifleri değil, doğrudan fillRect ile çizilen özgün sprite'lardır.
  const pixelPalette = {
    k: "#20152f", h: "#58324b", t: "#f4bc8c", s: "#dc8b73",
    w: "#fff4da", p: "#ff6ca8", r: "#da356b", v: "#a06bea",
    y: "#ffd66e", o: "#df8c3e", b: "#70422b", g: "#69d68a", c: "#7edaf2"
  };
  const pixelSprites = {
    girl: [
      ".....kkkkkk.....", "....khhhhhhk....", "...khhhhhhhhk...", "...khhhttthhk...",
      "...khtttttthk...", "...khtktktttk...", "...khtttttthk...", "...khstsstshk...",
      "....kttttttk....", ".....kppppk.....", "...ktpppppptk...", "...ktppwppptk...",
      "....kppppppk....", "....krrrrrrk....", ".....ktkktk.....", "....kkk..kkk...."
    ],
    heart: [
      "................", "................", "...kkkk..kkkk...", "..kppppkkppppk..",
      ".kpwwpppppppppk.", ".kpwppppppppppk.", ".kppppppppppppk.", ".krpppppppppprk.",
      "..krpppppppprk..", "...krpppppprk...", "....krpppprk....", ".....krpprk.....",
      "......krrk......", ".......kk.......", "................", "................"
    ],
    flower: [
      "......kkkk......", ".....kpwwpk.....", ".....kppppk.....", "..kkkkppppkkkk..",
      ".kpwwppppppwwpk.", ".kppppkyykppppk.", "..kppkyyyykppk..", ".kppppkyykppppk.",
      ".kppppppppppppk.", "..kkkkppppkkkk..", ".....kppppk.....", "......kggk......",
      "...kk.kggk......", "...kggkggk......", "....kggggk......", "......kkkk......"
    ],
    chocolate: [
      "................", "...kkkkkkkkkk...", "...kobbbobbbk...", "...kbybbbybbk...",
      "...kbbbbbbbbk...", "...koooobbbbk...", "...kobbbobbbk...", "...kbybbbybbk...",
      "...kbbbbbbbbk...", "...kwwwwwwwwk...", "...kvvvvvvvvk...", "...kvvppppvvk...",
      "...kvvppppvvk...", "...kvvvvvvvvk...", "...kkkkkkkkkk...", "................"
    ],
    book: [
      "................", "..kkkkkkkkkk....", "..kvvvvvvvvkk...", "..kvwwwwvvvkwk..",
      "..kvvvvvvvvkwk..", "..kvwwwwwvvkwk..", "..kvvvvvvvvkwk..", "..kvwwwwvvvkwk..",
      "..kvvvvvvvvkwk..", "..kvvvvvvvvkwk..", "..kvvvvvvvvkwk..", "..kkkkkkkkkkwk..",
      "...kwwwwwwwwk...", "...kkkkkkkkkk...", "................", "................"
    ],
    coffee: [
      ".....w..w.......", "....w..w........", ".....w..w.......", "................",
      "..kkkkkkkkkk....", "..kbbbbbbbbkkk..", "..kwwwwwwwwkwk..", "..kwwppppwwkwk..",
      "..kwwppppwwkwk..", "..kwwwwwwwwkkk..", "..kwwwwwwwwk....", "...kwwwwwwk.....",
      "....kkkkkk......", "..kkkkkkkkkkk...", "..kccccccccck...", "...kkkkkkkkk...."
    ],
    burger: [
      "................", ".....kkkkkk.....", "...kkooooookk...", "..koyoooyooook..",
      ".kooooyooooyoook", ".koooooooooooook", ".kkkkkkkkkkkkkkk", ".kgggggggggggggk",
      ".krrrrrrrrrrrrrk", ".kbbbbbbbbbbbbbk", ".kyyyyyyyyyyyyyk", ".koooooooooooook",
      "..koooooooooook.", "...kkkkkkkkkkk..", "................", "................"
    ],
    waffle: [
      "................", "...kkkkkkkkkk...", "..kooooooooook..", ".koyyoyyoyyoyyok",
      ".koyyoyyoyyoyyok", ".koooooooooooook", ".koyyoyyoyyoyyok", ".koyyoyyoyyoyyok",
      ".koooooooooooook", ".koyyoyyoyyoyyok", ".koyyoyyoyyoyyok", ".koooooooooooook",
      "..koooooooooook.", "...kkkkkkkkkkk..", "................", "................"
    ],
    sparkle: [
      "................", ".......yy.......", ".......yy.......", ".......yy.......",
      "......yyyy......", "......ywwy......", "....yyywwyyy....", ".yyyywwwwwwyyyy.",
      ".yyyywwwwwwyyyy.", "....yyywwyyy....", "......ywwy......", "......yyyy......",
      ".......yy.......", ".......yy.......", ".......yy.......", "................"
    ]
  };

  // Görsel rastgelelik oyun objelerinin RNG akışını etkilemez.
  // Uzak yıldızlar küçük/yavaş, yakın yıldızlar büyük/hızlıdır.
  const pixelCache = new Map();
  const imageSizeCache = new Map();
  const skyColors = [["#474c80", "#888ac5", "#dae6ff"], ["#c53a27", "#ff9138", "#ffe36e"]];
  const skySpeeds = [5, 12, 24];
  let cachedDifficultyScore = -1, cachedDifficulty = null;
  let starfieldTime = 0;
  const skyStars = Array.from({ length: 60 }, (_, i) => ({
    x: ((i * 137 + 41) % 997) / 997,
    y: ((i * 211 + 17) % 991) / 991,
    layer: i % 3
  }));
  const keys = new Set();
  const touches = new Map();
  const player = { x: 0, y: 0, size: 48, speed: 390 };
  let width = 0, height = 0, score = 0;
  let objects = [], particles = [];
  let state = "ready", lastTime = 0, spawnTimer = 0;

  // Sesler kendi durumunu yönetir; oyun fiziği veya RAF döngüsü ses beklemez.
  const sound = createSoundController();

  function createSoundController() {
    const makeAudio = (file, volume, loop = false) => {
      const audio = new Audio(`assets/${encodeURIComponent(file)}`);
      audio.preload = "auto";
      audio.volume = volume;
      audio.loop = loop;
      return audio;
    };
    const tracks = {
      background: makeAudio("arkaplan music.mp3", 0.3, true),
      transition: makeAudio("phase 2 gecis.mp3", 0.8),
      finale: makeAudio("son duzluk.mp3", 0.3, true),
      hit: makeAudio("carpma sound.mp3", 0.8),
      gameOver: makeAudio("game over sound.mp3", 0.8)
    };
    // Önceden oluşturulan beş ses kanalı, kalp/yemek yağmurunda üst üste çalar.
    // Hepsi ilk kullanıcı etkileşiminde hazırlanır; her yakalamada yeni dosya açılmaz.
    const pickups = Array.from({ length: 5 }, () => makeAudio("kalp top sound.mp3", 0.2));
    const all = [...Object.values(tracks), ...pickups];
    let mode = "idle", primed = false, generation = 0, nextVoice = 0;

    function stop(audio) {
      audio.pause();
      try { audio.currentTime = 0; } catch { /* Henüz metadata yoksa bekleme. */ }
    }
    function stopAll() {
      generation++;
      all.forEach(stop);
      mode = "idle";
    }
    function play(audio, onFailure) {
      const version = generation;
      try {
        const result = audio.play();
        if (result && result.catch) result.catch(error => {
          if (version === generation && onFailure) onFailure(error);
        });
      } catch (error) {
        if (version === generation && onFailure) onFailure(error);
      }
    }

    function startFinale() {
      // Eski bir ended/error olayı kazanma ya da tekrar oynama sonrası müzik açamaz.
      if (mode !== "transition" || state !== "playing" || gamePhase !== 2) return;
      stop(tracks.transition);
      mode = "finale";
      resumeMusic();
    }
    function resumeMusic() {
      if (state !== "playing") return;
      const track = mode === "background" ? tracks.background
        : mode === "transition" ? tracks.transition : mode === "finale" ? tracks.finale : null;
      if (!track || !track.paused) return;
      play(track, error => {
        // Autoplay reddinde sonraki dokunma tekrar dener. Bozuk geçiş dosyası
        // ise oyunu sessiz geçişte takılı bırakmaz; Faz 2 müziğine devam edilir.
        if (track === tracks.transition && error.name !== "NotAllowedError" && error.name !== "AbortError") startFinale();
      });
    }
    function unlock() {
      if (!primed) {
        primed = true;
        for (const audio of all) {
          const volume = audio.volume;
          audio.volume = 0;
          play(audio);
          stop(audio);
          audio.volume = volume;
        }
      }
      resumeMusic();
    }
    tracks.transition.addEventListener("ended", () => {
      if (tracks.transition.ended) startFinale();
    });
    tracks.transition.addEventListener("error", startFinale);
    // Başla dışında, tarayıcı sesi engellediyse sonraki gerçek girişte de dene.
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("keydown", unlock);

    return {
      start() {
        stopAll();
        unlock();
        mode = "background";
        resumeMusic();
      },
      phaseTwo() {
        stop(tracks.background);
        stop(tracks.finale);
        stop(tracks.transition);
        mode = "transition";
        resumeMusic();
      },
      collect() {
        const voice = pickups.find(audio => audio.paused || audio.ended) || pickups[nextVoice];
        nextVoice = (nextVoice + 1) % pickups.length;
        stop(voice);
        play(voice);
      },
      hit() { stop(tracks.hit); play(tracks.hit); },
      finish(lost) {
        stopAll();
        if (lost) play(tracks.gameOver);
      }
    };
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Image yüklemesi ve decode bitmeden Başla düğmesi açılmaz.
  // PNG saydamlığı korunur; dosyalar faz geçişinde tekrar yüklenmez.
  async function preloadAssets() {
    if (assetsLoading) return;
    assetsLoading = true;
    startButton.disabled = true;
    assetStatus.textContent = "Sürprizler hazırlanıyor…";
    try {
      const files = { player: "Konu.png", enemy: "IMG_6121.jpg", cat: "Konu 2.png", reward: "6c6e7712-8406-4f26-920a-956dbcf3d62b.JPG" };
      const loaded = await Promise.all(Object.entries(files).map(([key, file]) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = async () => {
            try {
              if (image.decode) await image.decode();
              resolve([key, image]);
            } catch (error) { reject(error); }
          };
          image.onerror = () => reject(new Error(`${file} yüklenemedi`));
          image.src = `assets/${encodeURIComponent(file)}`;
        })
      ));
      Object.assign(assets, Object.fromEntries(loaded));
      // Yüklenip decode edilen aynı Image nesnesini ödül ekranına yerleştir.
      assets.reward.id = "reward-photo";
      assets.reward.className = "reward-photo";
      assets.reward.alt = "Birlikte mutlu bir anımız";
      document.querySelector("#reward-photo-frame").replaceChildren(assets.reward);
      assetsReady = true;
      assetStatus.textContent = "Hazır! 500 puanda lezzetli bir sürpriz var.";
      startButton.textContent = "Hadi Başlayalım";
    } catch {
      assetStatus.textContent = "Görseller yüklenemedi. Tekrar deneyebilirsin.";
      startButton.textContent = "Görselleri Tekrar Yükle";
    } finally {
      assetsLoading = false;
      startButton.disabled = false;
    }
  }

  function updatePlayerSize() {
    player.size = gamePhase === 2 ? (width < 400 ? 76 : 84) : (width < 400 ? 44 : 48);
    player.y = height - 42 - player.size / 2 - 8;
    player.x = clamp(player.x, player.size / 2, width - player.size / 2);
  }

  function enterPhaseTwo() {
    gamePhase = 2; // Kalıcı kilit: -50 puan fazı geri almaz.
    sound.phaseTwo();
    document.body.dataset.phase = "2";
    phaseLabel.textContent = "Faz 2 · Lezzet Yağmuru";
    phaseTimer = 2.4;
    phaseNotice.hidden = false;
    stageNotice.hidden = true;
    stageTimer = 0;
    // Eski faz objeleri kaldırılır; yeni karaktere güvenli giriş süresi verilir.
    objects = [];
    spawnTimer = 1.4;
    updatePlayerSize();
    feverNotice.textContent = "Kedi Geldi, Sıkıntı Bitti!";
  }

  // CSS piksel koordinatlarını korurken Retina ekranlarda net çizim yap.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const previousWidth = width, previousHeight = height;
    width = rect.width;
    height = rect.height;
    // Yalnızca çizim çözünürlüğü düşer: dünya/çarpışma koordinatları CSS
    // pikseli olarak aynı kalır. CSS her çizim pikselini keskin 2× blok yapar.
    const ratio = 0.5;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    updatePlayerSize();
    player.x = clamp(previousWidth ? player.x / previousWidth * width : width / 2, player.size / 2, width - player.size / 2);
    player.y = height - 42 - player.size / 2 - 8;
    objects.forEach(object => {
      object.x = clamp(object.x / previousWidth * width, object.size / 2, width - object.size / 2);
      if (object.bad) {
        object.amplitude = Math.min(60, width * 0.16);
        object.baseX = clamp(object.baseX / previousWidth * width,
          object.size / 2 + object.amplitude, width - object.size / 2 - object.amplitude);
        object.x = object.baseX + Math.sin(object.phase) * object.amplitude;
      }
      object.y *= previousHeight ? height / previousHeight : 1;
    });
  }

  function clearInput() { keys.clear(); touches.clear(); lastTap = null; }

  function movementDirection() {
    let left = keys.has("arrowleft") || keys.has("a");
    let right = keys.has("arrowright") || keys.has("d");
    for (const side of touches.values()) {
      if (side === "left") left = true;
      else right = true;
    }
    return Number(right) - Number(left);
  }

  function requestDash(direction = movementDirection() || lastDirection) {
    if (state !== "playing" || gamePhase !== 2 || dashCooldown > 0 || dashTime > 0) return false;
    dashDirection = direction < 0 ? -1 : 1;
    lastDirection = dashDirection;
    dashTime = DASH_DURATION;
    dashCooldown = DASH_COOLDOWN;
    dashTrailTimer = 0;
    updateDashStatus();
    return true;
  }

  function updateDashStatus() {
    setHidden(dashStatus, gamePhase !== 2 || state !== "playing");
    const text = dashTime > 0 ? "DASH · Hasar almaz" : dashCooldown > 0
      ? `Dash: ${dashCooldown.toFixed(1)} sn` : "Dash hazır · Space / çift dokun";
    if (dashStatus.textContent !== text) dashStatus.textContent = text;
  }

  function setHidden(element, hidden) {
    if (element.hidden !== hidden) element.hidden = hidden;
  }

  function resetActionEffects() {
    dashTime = dashCooldown = dashTrailTimer = shakeTime = flashTime = 0;
    windActive = false;
    windNoticeTime = elapsed = 0;
    dashDirection = lastDirection = 1;
    dashGhosts = [];
    lastTap = null;
    canvas.style.transform = "";
    dashStatus.hidden = windNotice.hidden = true;
  }

  function stopActionEffects() {
    dashTime = dashCooldown = shakeTime = flashTime = 0;
    dashGhosts = [];
    canvas.style.transform = "";
    dashStatus.hidden = windNotice.hidden = true;
  }

  function startGame() {
    if (!assetsReady) return;
    gamePhase = 1;
    resetActionEffects();
    phaseTimer = 0;
    phaseNotice.hidden = true;
    document.body.dataset.phase = "1";
    phaseLabel.textContent = "Faz 1 · Aşk Yağmuru";
    feverNotice.textContent = "Kahve Molası!";
    updatePlayerSize();
    score = 0;
    scoreLabel.textContent = "0";
    objects = [];
    particles = [];
    stars = [];
    stage = stageTimer = feverTime = trailTimer = 0;
    document.body.dataset.stage = "0";
    phaseNotice.hidden = stageNotice.hidden = feverNotice.hidden = true;
    spawnTimer = 0.7;
    player.x = width / 2;
    clearInput();
    state = "playing";
    sound.start();
    startScreen.hidden = true;
    endScreen.hidden = true;
    winScreen.hidden = true;
    lastTime = 0;
    canvas.focus({ preventScroll: true });
  }

  function gameOver() {
    state = "over";
    sound.finish(true);
    stopActionEffects();
    phaseNotice.hidden = stageNotice.hidden = feverNotice.hidden = true;
    clearInput();
    document.querySelector("#final-score").textContent = score;
    endScreen.hidden = false;
    restartButton.focus({ preventScroll: true });
  }

  function winGame() {
    state = "won";
    sound.finish(false);
    stopActionEffects();
    phaseNotice.hidden = stageNotice.hidden = feverNotice.hidden = true;
    clearInput();
    winScreen.hidden = false;
    winRestartButton.focus({ preventScroll: true });
  }

  // 300'e kadar kademeli; sonrasında hız ve saniyedeki obje sayısı
  // log1p ile kesintisiz ama çok daha sert artar. Aralık, sıklığın tersidir.
  function difficulty() {
    if (cachedDifficultyScore === score) return cachedDifficulty;
    cachedDifficultyScore = score;
    const early = Math.min(score, 300) / 300;
    const surge = Math.log1p(Math.max(0, score - 300) / 100);
    cachedDifficulty = { speed: 115 + early * 130 + surge * 145,
      interval: 1 / (1.05 + early * 0.85 + surge * 1.8) };
    return cachedDifficulty;
  }

  function spawnObject(kind = "random") {
    if (kind === "heart") {
      let activeGood = 0;
      for (const object of objects) {
        if (!object.bad && ++activeGood >= MAX_FEVER_OBJECTS) return;
      }
    }
    const roll = Math.random();
    const bonus = kind === "random" && roll < 0.05; // Nadir espresso: %5, +50 puan.
    const bad = kind === "enemy" || (kind === "random" && score <= 300 && roll >= 0.05 && roll < 0.27);
    const choices = bad ? badSprites : gamePhase === 2 ? foodSprites : goodSprites;
    const imageKey = gamePhase === 2 ? (bad ? "enemy" : bonus ? "cat" : null) : null;
    const size = imageKey ? (width < 400 ? 48 : 54) : (width < 400 ? 30 : 34);
    const amplitude = bad ? Math.min(60, width * 0.16) : 0;
    const margin = size / 2 + amplitude;
    const baseX = margin + Math.random() * Math.max(0, width - margin * 2);
    const phase = Math.random() * Math.PI * 2;
    objects.push({ x: baseX + Math.sin(phase) * amplitude, y: -size,
      baseX, amplitude, phase, frequency: 3 + Math.random() * 2,
      size, imageKey, sprite: kind === "heart" && gamePhase === 1 ? "heart" : bonus ? "coffee" : choices[Math.floor(Math.random() * choices.length)],
      bad, bonus, points: bonus ? 50 : 10, speedFactor: bonus || kind === "heart" ? 2 : 1 });
  }

  // Fontun boş kenarlarını dışarıda bırakan görsel boyuta uygun kutular.
  function collides(object) {
    const playerWidth = gamePhase === 2 ? imageDimensions("player", player.size).width * 0.8 : player.size * 0.66;
    const objectBox = object.imageKey ? imageDimensions(object.imageKey, object.size) : null;
    return Math.abs(object.x - player.x) < (playerWidth + (objectBox ? objectBox.width : object.size) * 0.76) / 2
      && Math.abs(object.y - player.y) < (player.size * 0.80 + (objectBox ? objectBox.height : object.size) * 0.76) / 2;
  }

  function update(dt) {
    if (state !== "playing") return;
    elapsed += dt;
    const direction = movementDirection();
    if (direction) lastDirection = direction;
    const oldX = player.x;
    // Bir alt adım dash'in sonuna denk gelirse kalan süre normal hızla ilerler.
    const dashStep = Math.min(dt, dashTime);
    const protectedThisStep = dashTime > 0;
    player.x = clamp(player.x + dashDirection * DASH_SPEED * dashStep
      + direction * player.speed * (dt - dashStep), player.size / 2, width - player.size / 2);
    dashTime = Math.max(0, dashTime - dt);
    dashCooldown = Math.max(0, dashCooldown - dt);
    dashTrailTimer -= dt;
    for (let i = dashGhosts.length - 1; i >= 0; i--) {
      dashGhosts[i].life -= dt;
      if (dashGhosts[i].life <= 0) dashGhosts.splice(i, 1);
    }
    if (protectedThisStep && dashTrailTimer <= 0 && oldX !== player.x) {
      dashGhosts.push({ x: oldX, y: player.y, size: player.size, life: 0.25 });
      dashTrailTimer = 0.03;
    }
    shakeTime = Math.max(0, shakeTime - dt);
    flashTime = Math.max(0, flashTime - dt);
    windNoticeTime = Math.max(0, windNoticeTime - dt);
    setHidden(windNotice, windNoticeTime === 0);
    trailTimer -= dt;
    if (player.x !== oldX && trailTimer <= 0) {
      stars.push({ x: oldX, y: player.y + 12 + Math.random() * 10, life: 0.45 });
      trailTimer = 0.045;
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      star.life -= dt; star.y -= 12 * dt;
      if (star.life <= 0) stars.splice(i, 1);
    }
    phaseTimer = Math.max(0, phaseTimer - dt);
    setHidden(phaseNotice, phaseTimer === 0);
    stageTimer = Math.max(0, stageTimer - dt);
    setHidden(stageNotice, stageTimer === 0);
    feverTime = Math.max(0, feverTime - dt);
    setHidden(feverNotice, feverTime === 0);
    const level = difficulty();
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObject(feverTime > 0 ? "heart" : "random");
      spawnTimer += feverTime > 0 ? 0.085 : level.interval;
    }

    for (let i = objects.length - 1; i >= 0; i--) {
      const object = objects[i];
      // Sinüsün merkezi de rüzgârla kayar; düşman hareketi rüzgârı ezmez.
      if (windActive) {
        if (object.bad) object.baseX += WIND_SPEED * dt;
        else object.x += WIND_SPEED * dt;
      }
      if (object.bad) {
        object.phase += object.frequency * dt;
        object.x = object.baseX + Math.sin(object.phase) * object.amplitude;
      }
      object.y += level.speed * object.speedFactor * dt;
      // Fizik CSS pikseli kullanır; canvas.height yarım çözünürlüktedir.
      // Alt kenarı geçenler hemen kaldırılır, çarpışma/çizime taşınmaz.
      if (object.y > height || object.x < -object.size) objects.splice(i, 1);
    }

    // Önce bonusu değerlendir: aynı karedeki düşman teması da temizlenir.
    let coffee;
    for (const object of objects) {
      if (object.bonus && collides(object)) { coffee = object; break; }
    }
    if (coffee) {
      feverTime = 5;
      feverNotice.hidden = false;
      objects = objects.filter(object => !object.bad && object !== coffee);
      spawnTimer = 0;
      const phaseChanged = collect(coffee);
      if (phaseChanged || state !== "playing") return;
    }
    for (let i = objects.length - 1; i >= 0; i--) {
      const object = objects[i];
      if (collides(object)) {
        if (object.bad) {
          // Dash sırasında düşmana temas ceza veya hasar efekti oluşturmaz.
          if (protectedThisStep) continue;
          if (gamePhase === 1) { gameOver(); return; }
          // Her düşman tek kez ceza verir ve kaldırılır; skor negatif olmaz.
          objects.splice(i, 1);
          score = Math.max(0, score - 50);
          sound.hit();
          shakeTime = 0.25;
          flashTime = 0.25;
          scoreLabel.textContent = score;
          particles.push({ x: object.x, y: object.y, life: 0.9, points: -50 });
          continue;
        }
        objects.splice(i, 1);
        const phaseChanged = collect(object);
        if (phaseChanged || state !== "playing") return;
      }
    }
    // 300'den sonra üç, 400'den itibaren dört düşman; kahve molasında sıfır.
    // Takviyeler yalnızca üst kenardan girer, oyuncunun yanında belirmez.
    if (score > 300 && feverTime === 0) {
      const target = score >= 400 ? 4 : 3;
      let count = 0;
      for (const object of objects) if (object.bad) count++;
      while (count < target) {
        spawnObject("enemy");
        objects[objects.length - 1].y = objects[objects.length - 1].size / 2;
        count++;
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.y -= 35 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function collect(object) {
    sound.collect();
    score += object.points;
    scoreLabel.textContent = score;
    particles.push({ x: object.x, y: object.y, life: 0.65, points: object.points });
    const nextStage = Math.min(4, Math.floor(score / 100));
    if (nextStage > stage) {
      stage = nextStage;
      document.body.dataset.stage = String(stage);
      stageTimer = 1.8;
      stageNotice.hidden = false;
    }
    const phaseChanged = gamePhase === 1 && score >= PHASE_TWO_SCORE;
    if (phaseChanged) enterPhaseTwo();
    if (!windActive && gamePhase === 2 && score >= 750) {
      windActive = true; // Ceza skoru düşürse de son düzlüğün rüzgârı sürer.
      windNoticeTime = 3;
      windNotice.hidden = false;
    }
    if (score >= WIN_SCORE) winGame();
    return phaseChanged;
  }

  function imageDimensions(key, size) {
    let sizes = imageSizeCache.get(key);
    if (!sizes) { sizes = new Map(); imageSizeCache.set(key, sizes); }
    if (sizes.has(size)) return sizes.get(size);
    const image = assets[key];
    const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
    const dimensions = { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
    sizes.set(size, dimensions);
    return dimensions;
  }

  function drawSprite(key, x, y, size, alpha = 1) {
    if (!assetsReady) return;
    const box = imageDimensions(key, size);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(assets[key], x - box.width / 2, y - box.height / 2, box.width, box.height);
    ctx.restore();
  }

  function cachePixelArt(name, size) {
    let sizes = pixelCache.get(name);
    if (!sizes) { sizes = new Map(); pixelCache.set(name, sizes); }
    if (sizes.has(size)) return sizes.get(size);
    const grid = pixelSprites[name];
    if (!grid) return null;
    const bitmap = document.createElement("canvas");
    bitmap.width = bitmap.height = Math.round(size / 2);
    const buffer = bitmap.getContext("2d");
    buffer.imageSmoothingEnabled = false;
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const color = pixelPalette[grid[row][col]];
        if (!color) continue;
        buffer.fillStyle = color;
        // Önceki snap(...)/2 ile birebir aynı hücre sınırları.
        const x = Math.round(col * size / 32), y = Math.round(row * size / 32);
        buffer.fillRect(x, y, Math.round((col + 1) * size / 32) - x,
          Math.round((row + 1) * size / 32) - y);
      }
    }
    sizes.set(size, bitmap);
    return bitmap;
  }

  function preparePixelArt() {
    // Oyunda kullanılan tüm boyutlar önceden hazırlanır; RAF içinde yeni
    // Canvas veya 256 hücrelik matris taraması yapılmaz. Fotoğraflar değişmez.
    for (const name of Object.keys(pixelSprites)) {
      for (const size of [16, 30, 34, 44, 48]) cachePixelArt(name, size);
    }
  }

  function drawPixelArt(name, x, y, size, alpha = 1) {
    const bitmap = pixelCache.get(name)?.get(size);
    if (!bitmap) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const left = Math.round((x - size / 2) / 2) * 2;
    const top = Math.round((y - size / 2) / 2) * 2;
    ctx.drawImage(bitmap, left, top, bitmap.width * 2, bitmap.height * 2);
    ctx.restore();
  }

  function drawStarfield() {
    ctx.save();
    ctx.globalAlpha = 1;
    const colors = skyColors[gamePhase === 2 ? 1 : 0];
    for (const star of skyStars) {
      const size = star.layer === 2 ? 4 : 2;
      const drift = reducedMotion.matches ? 0 : starfieldTime * skySpeeds[star.layer];
      const x = Math.floor(star.x * width / 2) * 2;
      const y = Math.floor(((star.y * (height + 8) + drift) % (height + 8) - 4) / 2) * 2;
      ctx.fillStyle = colors[star.layer];
      ctx.fillRect(x, y, size, size);
      if (star.layer === 2) {
        ctx.fillRect(x - 2, y + 2, 8, 2);
        ctx.fillRect(x + 2, y - 2, 2, 8);
      }
    }
    ctx.restore();
  }

  function draw() {
    updateDashStatus();
    ctx.clearRect(0, 0, width, height);
    drawStarfield();
    // Efektler yalnızca çizimi etkiler; çarpışma koordinatları sabit kalır.
    const shaking = shakeTime > 0 && !reducedMotion.matches;
    const transform = shaking
      ? `translate(${(Math.random() * 24 - 12).toFixed(2)}px, ${(Math.random() * 24 - 12).toFixed(2)}px)` : "";
    if (canvas.style.transform !== transform) canvas.style.transform = transform;
    if (flashTime > 0) {
      ctx.save();
      ctx.globalAlpha = (reducedMotion.matches ? 0.25 : 0.7) * (flashTime / 0.25) ** 2;
      ctx.fillStyle = "#ff1744";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (windActive && state === "playing") {
      ctx.save();
      ctx.strokeStyle = "#fff3c6";
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const x = ((i * 113 - elapsed * 210) % (width + 80) + width + 80) % (width + 80);
        const y = 70 + (i * 83) % Math.max(1, height - 140);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 28, y + 8); ctx.stroke();
      }
      ctx.restore();
    }
    for (const object of objects) {
      if (object.imageKey) drawSprite(object.imageKey, object.x, object.y, object.size);
      else drawPixelArt(object.sprite, object.x, object.y, object.size);
    }
    ctx.fillStyle = "#b47b9a20";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.size / 2 + 3, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Partiküller de aynı 16×16 piksel çizim sistemini kullanır.
    for (const star of stars) {
      drawPixelArt("sparkle", star.x, star.y, 16, star.life / 0.45);
    }
    for (const ghost of dashGhosts) {
      drawSprite("player", ghost.x, ghost.y, ghost.size, 0.4 * ghost.life / 0.25);
    }
    if (gamePhase === 2) drawSprite("player", player.x, player.y, player.size);
    else drawPixelArt("girl", player.x, player.y, player.size);
    particles.forEach(p => {
      ctx.fillStyle = p.points < 0 ? "#c11232" : "#be527b";
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText(`${p.points > 0 ? "+" : ""}${p.points}`, p.x, p.y);
    });
  }

  function frame(time) {
    // Küçük alt adımlar, düşük FPS'de objelerin oyuncunun içinden geçmesini önler.
    let remaining = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    // Hız çarpanı yalnızca arka plan saatine uygulanır. Konum sıçramaz;
    // obje hızları, fizik ve tüm mekanik zamanlayıcılar aynı kalır.
    if (!document.hidden) starfieldTime += remaining * (gamePhase === 2 ? 4 : 1);
    lastTime = time;
    while (remaining > 0 && state === "playing" && !document.hidden) {
      const step = Math.min(remaining, 1 / 120);
      update(step);
      remaining -= step;
    }
    if (!document.hidden) draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (state === "playing" && (event.code === "Space" || key === " ")) {
      event.preventDefault();
      if (!event.repeat) requestDash();
      return;
    }
    if (state === "playing" && ["arrowleft", "arrowright", "a", "d"].includes(key)) {
      event.preventDefault(); keys.add(key);
    }
  });
  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));

  // Ekranın sol/sağ yarısını basılı tut; parmak sürüklenince yön değişir.
  function updateTouches(event) {
    if (state !== "playing") return;
    event.preventDefault();
    touches.clear();
    for (const touch of event.touches) {
      touches.set(touch.identifier, touch.clientX < window.innerWidth / 2 ? "left" : "right");
    }
  }
  function handleTouchStart(event) {
    if (state !== "playing") return;
    // Aynı yarıda iki ayrı dokunuş; çoklu parmak başlangıcı çift dokunma değildir.
    const singleTap = touches.size === 0 && event.touches.length === 1 && event.changedTouches.length === 1;
    updateTouches(event);
    if (!singleTap) { lastTap = null; return; }
    const side = event.changedTouches[0].clientX < window.innerWidth / 2 ? "left" : "right";
    const now = event.timeStamp;
    const gap = lastTap ? now - lastTap.time : Infinity;
    if (lastTap && lastTap.side === side && gap >= 0 && gap <= 300) {
      requestDash(side === "left" ? -1 : 1);
      lastTap = null;
    } else lastTap = { side, time: now };
  }
  document.addEventListener("touchstart", handleTouchStart, { passive: false });
  document.addEventListener("touchcancel", () => { lastTap = null; });
  for (const type of ["touchmove", "touchend", "touchcancel"]) {
    document.addEventListener(type, updateTouches, { passive: false });
  }
  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", () => { clearInput(); lastTime = 0; });
  window.addEventListener("resize", () => { clearInput(); resize(); });
  new ResizeObserver(resize).observe(canvas);
  startButton.addEventListener("click", () => assetsReady ? startGame() : preloadAssets());
  restartButton.addEventListener("click", startGame);
  winRestartButton.addEventListener("click", startGame);
  preparePixelArt();
  resize();
  preloadAssets();
  requestAnimationFrame(frame);
})();
