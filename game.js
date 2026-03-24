const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GRAVITY = 1600;
const MOVE_SPEED = 290;
const JUMP_SPEED = 700;
const TOTAL_COINS = 10;
const MAX_DEATHS = 3;
const LEVEL_TIME_SECONDS = 3 * 60 + 1;
const GROUND_Y = 492;
const PLAYER_SIZE = 36;
const CROUCH_HEIGHT = 24;
const COIN_RADIUS = 12;
const MIN_PLATFORM_COUNT = 10;
const MAX_PLATFORM_COUNT = 16;
const MAX_PLATFORM_DISTANCE = 380;
const PLATFORM_PLACEMENT_ATTEMPTS = 40;
const PLATFORM_Y_MIN = 80;
const PLATFORM_Y_MAX = GROUND_Y - 25;
const SPAWN_RECT = { x: 80, y: GROUND_Y - PLAYER_SIZE, width: PLAYER_SIZE, height: PLAYER_SIZE };

const BEETLE_WIDTH = 34;
const BEETLE_HEIGHT = 36;
const BEETLE_CHASE_SPEED = MOVE_SPEED * 0.5;
const BEETLE_SPEED = BEETLE_CHASE_SPEED / 3;
const BEETLE_SPAWN_RECT = {
  x: WIDTH - SPAWN_RECT.x - BEETLE_WIDTH,
  y: GROUND_Y - BEETLE_HEIGHT - 8,
  width: BEETLE_WIDTH,
  height: BEETLE_HEIGHT
};

const PLATFORM_TEMPLATES = [
  { xRange: [50, 90], y: 420, yRange: [380, 460], widthRange: [170, 210] },
  { xRange: [260, 360], y: 410, yRange: [370, 450], widthRange: [140, 180] },
  { xRange: [150, 290], y: 325, yRange: [285, 365], widthRange: [125, 165] },
  { xRange: [360, 540], y: 275, yRange: [235, 315], widthRange: [130, 180] },
  { xRange: [640, 790], y: 390, yRange: [350, 430], widthRange: [130, 180] },
  { xRange: [650, 800], y: 235, yRange: [195, 275], widthRange: [115, 155] },
  { xRange: [430, 610], y: 170, yRange: [130, 210], widthRange: [110, 145] },
  { xRange: [220, 410], y: 225, yRange: [185, 265], widthRange: [120, 160] },
  { xRange: [95, 220], y: 145, yRange: [105, 185], widthRange: [110, 145] },
  { xRange: [520, 700], y: 445, yRange: [405, 467], widthRange: [120, 165] },
  { xRange: [720, 850], y: 335, yRange: [295, 375], widthRange: [110, 150] },
  { xRange: [60, 175], y: 285, yRange: [245, 325], widthRange: [110, 145] },
  { xRange: [500, 650], y: 350, yRange: [310, 390], widthRange: [120, 150] },
  { xRange: [760, 865], y: 165, yRange: [125, 205], widthRange: [95, 125] },
  { xRange: [300, 470], y: 120, yRange: [80, 160], widthRange: [110, 140] },
  { xRange: [560, 760], y: 95, yRange: [80, 135], widthRange: [95, 130] }
];

const COIN_PLATFORM_TEMPLATE = {
  xRange: [100, WIDTH - 120],
  y: 300,
  yRange: [PLATFORM_Y_MIN, PLATFORM_Y_MAX],
  widthRange: [56, 80]
};

const SPIKES_PLATFORM_TEMPLATE = {
  xRange: [120, WIDTH - 140],
  y: 350,
  yRange: [PLATFORM_Y_MIN, PLATFORM_Y_MAX],
  widthRange: [90, 140]
};

const input = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  crouch: false
};

const inputP1 = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  crouch: false
};
const inputP2 = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  crouch: false
};

const MP_STORAGE_KEY = "blobCoinDash_multiplayer";

/** Shown on win/lose end card instead of “You”. */
const DISPLAY_NAME_SOLO = "Blob";
const DISPLAY_NAME_P1 = "Arrow";
const DISPLAY_NAME_P2 = "WASD";

let multiplayerMode = false;
let deaths1 = 0;
let deaths2 = 0;
let coinsCollectedP1 = 0;
let coinsCollectedP2 = 0;

let level;
let player;
let player2;
let coins;
let deaths;
let collectedCoins;
let gameState;
let levelTimeRemaining;
let lostReason;
let lastDeathCause = null;
let bellAt16Played = false;
let lastTime = 0;
let pauseButtonEl = null;
let audioContext;
let musicGainNode;
let musicLoopTimeoutId;
let sfxGainNode;
let musicElement = null;
let musicStartListenersAdded = false;

let musicVolume = 1;
let sfxVolume = 1;

let cloudOffset = 0;
const CLOUD_SPEED = 38;
const CLOUD_WRAP = WIDTH + 400;

const BPM = 180;
const BEAT = 60 / BPM;
const BAR = BEAT * 3;
const MUSIC_LOOP_BARS = 8;
const MUSIC_LOOP_DURATION = BAR * MUSIC_LOOP_BARS;

const VOLUME_STORAGE_KEY_MUSIC = "blobCoinDash_musicVolume";
const VOLUME_STORAGE_KEY_SFX = "blobCoinDash_sfxVolume";
const THEME_STORAGE_KEY = "blobCoinDash_theme";

let platformTheme = "classic";

const arrowImage = new Image();
arrowImage.src = "assets/arrow.png";
const bottleImage = new Image();
bottleImage.src = "assets/bottle.png";
const bananaImage = new Image();
bananaImage.src = "assets/banana.png";

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function getSfxGain(context) {
  if (!context) return null;
  if (!sfxGainNode) {
    sfxGainNode = context.createGain();
    sfxGainNode.gain.value = sfxVolume;
    sfxGainNode.connect(context.destination);
  }
  return sfxGainNode;
}

function playSound({ frequency, duration, type, volume, endFrequency = frequency }) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume();
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);

  gainNode.gain.setValueAtTime(volume, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  const sfxGain = getSfxGain(context);
  if (sfxGain) gainNode.connect(sfxGain);
  else gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playJumpSound() {
  playSound({
    frequency: 340,
    endFrequency: 520,
    duration: 0.12,
    type: "square",
    volume: 0.05
  });
}

function playLandSound() {
  playSound({
    frequency: 220,
    endFrequency: 110,
    duration: 0.1,
    type: "triangle",
    volume: 0.06
  });
}

function playCoinSound() {
  playSound({
    frequency: 620,
    endFrequency: 880,
    duration: 0.08,
    type: "square",
    volume: 0.04
  });
}

function playSpikeDeathSound() {
  playSound({
    frequency: 240,
    endFrequency: 90,
    duration: 0.18,
    type: "sawtooth",
    volume: 0.06
  });
}

function playBellSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(gain);
  gain.connect(getSfxGain(ctx) || ctx.destination);
  osc.start(now);
  osc.stop(now + 0.8);
}

function playWinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  [440, 554, 659, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + i * 0.12;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    osc.connect(gain);
    gain.connect(getSfxGain(ctx) || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

function playLoseSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  const notes = [392, 349, 294, 262];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + i * 0.18;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + 0.28);
    osc.connect(gain);
    gain.connect(getSfxGain(ctx) || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  });
}

function clearInputState(inp) {
  inp.left = false;
  inp.right = false;
  inp.jump = false;
  inp.jumpPressed = false;
  inp.crouch = false;
}

function clearInput() {
  clearInputState(input);
  clearInputState(inputP1);
  clearInputState(inputP2);
}

function placePlayerAtSpawnSlot(p, slot) {
  const base = level.spawn.x;
  p.x = slot === 0 ? base : Math.min(base + 52, WIDTH - PLAYER_SIZE - 10);
  p.y = level.spawn.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.squish = 1;
  p.crouching = false;
  p.height = PLAYER_SIZE;
}

function checkMultiplayerAllEliminated() {
  if (!multiplayerMode || gameState !== "playing") return;
  if (!player.alive && !player2.alive && !multiplayerWinReached()) {
    lostReason = "deaths";
    playLoseSound();
    gameState = "lost";
    syncGameUiState();
  }
}

function killPlayerSlot(slot) {
  if (gameState !== "playing") {
    return;
  }
  const p = slot === 0 ? player : player2;
  if (!p.alive) {
    return;
  }

  if (slot === 0) {
    deaths1 += 1;
  } else {
    deaths2 += 1;
  }
  const d = slot === 0 ? deaths1 : deaths2;

  if (d >= MAX_DEATHS) {
    p.alive = false;
    p.vx = 0;
    p.vy = 0;
    checkMultiplayerAllEliminated();
    return;
  }

  placePlayerAtSpawnSlot(p, slot);
  clearInputState(slot === 0 ? inputP1 : inputP2);
}

function syncGameUiState() {
  const paused = gameState === "paused";
  const ended = gameState === "won" || gameState === "lost";
  document.body.classList.toggle("game-paused", paused);
  document.body.classList.toggle("game-ended", ended);

  if (pauseButtonEl) {
    const isPaused = paused;
    pauseButtonEl.textContent = isPaused ? "▶" : "⏸";
    pauseButtonEl.setAttribute("aria-label", isPaused ? "Resume" : "Pause");
  }
}

function setPaused(paused) {
  if (paused) {
    if (gameState !== "playing") return;
    gameState = "paused";
    clearInput();
  } else {
    if (gameState !== "paused") return;
    gameState = "playing";
  }

  syncGameUiState();
}

function togglePause() {
  setPaused(gameState !== "paused");
}

function getMusicGain() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!musicGainNode) {
    musicGainNode = ctx.createGain();
    musicGainNode.gain.value = 0.5 * musicVolume;
    musicGainNode.connect(ctx.destination);
  }
  return musicGainNode;
}

function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, value));
  if (musicGainNode) musicGainNode.gain.value = 0.5 * musicVolume;
  if (musicElement) musicElement.volume = 0.5 * musicVolume;
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY_MUSIC, String(musicVolume));
  } catch (_) {}
}

function setSfxVolume(value) {
  sfxVolume = Math.max(0, Math.min(1, value));
  if (sfxGainNode) sfxGainNode.gain.value = sfxVolume;
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY_SFX, String(sfxVolume));
  } catch (_) {}
}

function scheduleBackgroundMusicLoop(startTime) {
  // Music is now handled via a looping WAV track.
  // Keeping this function around avoids larger refactors elsewhere.
  void startTime;
}

function stopBackgroundMusic() {
  if (musicLoopTimeoutId) {
    clearTimeout(musicLoopTimeoutId);
    musicLoopTimeoutId = null;
  }
  if (musicElement) {
    try {
      musicElement.pause();
      musicElement.currentTime = 0;
    } catch (_) {}
  }
}

function startBackgroundMusic() {
  // Avoid overlapping music if this is called more than once.
  stopBackgroundMusic();

  let src = "assets/classic_theme.wav";
  if (platformTheme === "orange") {
    src = "assets/factory_theme.wav";
  } else if (platformTheme === "backrooms") {
    src = "assets/backrooms_theme.wav";
  } else if (platformTheme === "blank") {
    src = "assets/blank_theme.wav";
  } else if (platformTheme === "jungle") {
    src = "assets/jungle_theme.wav";
  }

  if (!musicElement) {
    musicElement = new Audio(src);
    musicElement.loop = true;
    musicElement.preload = "auto";
    musicElement.volume = 0.5 * musicVolume;
  } else if (musicElement.src.indexOf(src) === -1) {
    // Switch track if the theme changed.
    musicElement.pause();
    try {
      musicElement.currentTime = 0;
    } catch (_) {}
    musicElement.src = src;
    musicElement.loop = true;
    musicElement.preload = "auto";
    musicElement.volume = 0.5 * musicVolume;
  }

  const playPromise = musicElement.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      // Autoplay is commonly blocked until a user gesture.
      if (musicStartListenersAdded) return;
      musicStartListenersAdded = true;

      const tryStart = () => {
        musicStartListenersAdded = false;
        document.removeEventListener("pointerdown", tryStart, { capture: true });
        document.removeEventListener("keydown", tryStart, { capture: true });
        startBackgroundMusic();
      };

      document.addEventListener("pointerdown", tryStart, { capture: true, once: true });
      document.addEventListener("keydown", tryStart, { capture: true, once: true });
    });
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function createPlatform(template, existingPlatforms) {
  const tolerance = 2;
  const overlaps = (a, b) =>
    a.x < b.x + b.width + tolerance &&
    a.x + a.width + tolerance > b.x &&
    a.y < b.y + b.height + tolerance &&
    a.y + a.height + tolerance > b.y;
  const overlapsX = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x;
  const crouchGap = (above, below) => below.y - (above.y + above.height);
  const centerX = (p) => p.x + p.width / 2;
  const centerY = (p) => p.y + p.height / 2;
  const distance = (p, q) =>
    Math.hypot(centerX(p) - centerX(q), centerY(p) - centerY(q));
  const isWithinDistance = (platform) =>
    existingPlatforms.some((other) => distance(platform, other) <= MAX_PLATFORM_DISTANCE);
  const hasEnoughCrouchGap = (platform) =>
    !existingPlatforms.some((other) => {
      if (!overlapsX(platform, other)) return false;
      if (overlaps(platform, other)) return false;
      const gap = platform.y < other.y ? crouchGap(platform, other) : crouchGap(other, platform);
      return gap > 0 && gap < CROUCH_HEIGHT;
    });

  for (let attempt = 0; attempt < PLATFORM_PLACEMENT_ATTEMPTS; attempt += 1) {
    const width = randomInt(template.widthRange[0], template.widthRange[1]);
    const maxX = Math.min(template.xRange[1], WIDTH - width - 20);
    const x = randomInt(template.xRange[0], Math.max(template.xRange[0], maxX));
    const yMin = template.yRange ? template.yRange[0] : template.y;
    const yMax = template.yRange ? template.yRange[1] : template.y;
    const y = randomInt(
      Math.max(PLATFORM_Y_MIN, yMin),
      Math.min(PLATFORM_Y_MAX, yMax)
    );

    const platform = {
      x,
      y,
      width,
      height: 18,
      type: "platform"
    };

    const overlapping = existingPlatforms.some((other) => overlaps(platform, other));
    if (overlapping) continue;
    if (overlaps(platform, SPAWN_RECT)) continue;
    if (overlaps(platform, BEETLE_SPAWN_RECT)) continue;
    const gapAboveGround = GROUND_Y - (platform.y + platform.height);
    if (gapAboveGround > 0 && gapAboveGround < CROUCH_HEIGHT) continue;
    if (!hasEnoughCrouchGap(platform)) continue;
    if (!isWithinDistance(platform)) continue;

    return platform;
  }

  return null;
}

function getSpikesOnPlatform(platform, spikes) {
  return spikes.filter((spike) => spike.y === platform.y && spike.x < platform.x + platform.width && spike.x + spike.width > platform.x);
}

function getSafeSegments(platform, spikes) {
  let segments = [{ start: platform.x + 22, end: platform.x + platform.width - 22 }];

  for (const spike of spikes) {
    const blockedStart = spike.x - 18;
    const blockedEnd = spike.x + spike.width + 18;
    const nextSegments = [];

    for (const segment of segments) {
      if (blockedEnd <= segment.start || blockedStart >= segment.end) {
        nextSegments.push(segment);
        continue;
      }

      if (blockedStart > segment.start) {
        nextSegments.push({ start: segment.start, end: blockedStart });
      }

      if (blockedEnd < segment.end) {
        nextSegments.push({ start: blockedEnd, end: segment.end });
      }
    }

    segments = nextSegments;
  }

  return segments.filter((segment) => segment.end - segment.start >= 34);
}

function createLevel() {
  const allTemplates = shuffle([...PLATFORM_TEMPLATES]);
  const platformCount = randomInt(MIN_PLATFORM_COUNT, Math.min(MAX_PLATFORM_COUNT, PLATFORM_TEMPLATES.length));

  const ground = { x: 0, y: GROUND_Y, width: WIDTH, height: HEIGHT - GROUND_Y, type: "ground" };
  const platforms = [ground];

  for (let i = 0; i < platformCount; i += 1) {
    const template = allTemplates[i];
    const platform = createPlatform(template, platforms);
    if (platform) platforms.push(platform);
  }

  const spikes = [];

  const MIN_SPIKE_PLATFORMS = 3;
  const maxSpiked = Math.max(0, platforms.filter((p) => p.type === "platform").length - TOTAL_COINS);
  for (const platform of shuffle(platforms.filter((entry) => entry.type === "platform")).slice(0, maxSpiked)) {
    const maxWidth = Math.min(62, platform.width - 36);

    if (maxWidth < 36) {
      continue;
    }

    const width = randomInt(36, maxWidth);
    const x = randomInt(platform.x + 16, platform.x + platform.width - width - 16);
    spikes.push({ x, y: platform.y, width, height: 20 });
  }

  while (spikes.length < MIN_SPIKE_PLATFORMS) {
    const spikePlatform = createPlatform(SPIKES_PLATFORM_TEMPLATE, platforms);
    if (!spikePlatform) break;
    platforms.push(spikePlatform);
    const maxWidth = Math.min(62, spikePlatform.width - 36);
    if (maxWidth >= 36) {
      const width = randomInt(36, maxWidth);
      const x = randomInt(spikePlatform.x + 16, spikePlatform.x + spikePlatform.width - width - 16);
      spikes.push({ x, y: spikePlatform.y, width, height: 20 });
    }
  }

  return {
    groundY: GROUND_Y,
    spawn: {
      x: 80,
      y: GROUND_Y - PLAYER_SIZE
    },
    platforms,
    spikes,
    beetle: createBeetle()
  };
}

function createBeetle() {
  const x = BEETLE_SPAWN_RECT.x;
  const vx = Math.random() < 0.5 ? BEETLE_SPEED : -BEETLE_SPEED;
  return {
    x,
    y: BEETLE_SPAWN_RECT.y,
    width: BEETLE_WIDTH,
    height: BEETLE_HEIGHT,
    vx,
    leftBound: 0,
    rightBound: WIDTH
  };
}

function slotOverlapsPlatform(slot, platform) {
  const closestX = Math.max(platform.x, Math.min(slot.x, platform.x + platform.width));
  const closestY = Math.max(platform.y, Math.min(slot.y, platform.y + platform.height));
  const dx = slot.x - closestX;
  const dy = slot.y - closestY;
  return dx * dx + dy * dy < COIN_RADIUS * COIN_RADIUS;
}

function buildCoinSlots(currentLevel) {
  const slots = [];

  for (const platform of currentLevel.platforms) {
    const isFloating = platform.type !== "ground";
    const spikes = getSpikesOnPlatform(platform, currentLevel.spikes);
    if (!isFloating || spikes.length > 0) continue;
    const safeSegments = getSafeSegments(platform, spikes);
    const baseY = platform.y - 28;
    const platformSlots = [];

    for (const segment of safeSegments) {
      const width = segment.end - segment.start;
      const center = (segment.start + segment.end) / 2;
      platformSlots.push({ x: center, y: baseY });
    }

    const validSlots = platformSlots.filter(
      (slot) => !currentLevel.platforms.some((p) => slotOverlapsPlatform(slot, p))
    );

    if (validSlots.length > 0) {
      const pick = shuffle(validSlots)[0];
      slots.push(pick);
    }
  }

  return shuffle(slots);
}

function slotIntersectsSpawn(slot, currentLevel) {
  const closestX = Math.max(currentLevel.spawn.x, Math.min(slot.x, currentLevel.spawn.x + PLAYER_SIZE));
  const closestY = Math.max(currentLevel.spawn.y, Math.min(slot.y, currentLevel.spawn.y + PLAYER_SIZE));
  const dx = slot.x - closestX;
  const dy = slot.y - closestY;

  return dx * dx + dy * dy < COIN_RADIUS * COIN_RADIUS;
}

function createCoinsForLevel(currentLevel, remainingCoins) {
  let slots = buildCoinSlots(currentLevel).filter((slot) => !slotIntersectsSpawn(slot, currentLevel));

  while (slots.length < remainingCoins) {
    const platform = createPlatform(COIN_PLATFORM_TEMPLATE, currentLevel.platforms);
    if (!platform) break;
    currentLevel.platforms.push(platform);
    const slot = { x: platform.x + platform.width / 2, y: platform.y - 28 };
    if (!slotIntersectsSpawn(slot, currentLevel) && !currentLevel.platforms.some((p) => slotOverlapsPlatform(slot, p))) {
      slots.push(slot);
    }
  }

  return slots.slice(0, remainingCoins).map((slot) => ({
    x: Math.round(slot.x),
    y: Math.round(slot.y),
    radius: COIN_RADIUS,
    byP1: false,
    byP2: false,
    bob: Math.random() * Math.PI * 2
  }));
}

function resetGame() {
  collectedCoins = 0;
  coinsCollectedP1 = 0;
  coinsCollectedP2 = 0;
  deaths = 0;
  deaths1 = 0;
  deaths2 = 0;
  levelTimeRemaining = LEVEL_TIME_SECONDS;
  bellAt16Played = false;
  lastDeathCause = null;
  gameState = "playing";
  syncGameUiState();
  player = {
    x: 0,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    vx: 0,
    vy: 0,
    onGround: false,
    squish: 0,
    crouching: false,
    alive: true
  };
  player2 = {
    x: 0,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    vx: 0,
    vy: 0,
    onGround: false,
    squish: 0,
    crouching: false,
    alive: true
  };
  if (multiplayerMode) {
    level = createLevel();
    coins = createCoinsForLevel(level, TOTAL_COINS);
    placePlayerAtSpawnSlot(player, 0);
    placePlayerAtSpawnSlot(player2, 1);
    player.alive = true;
    player2.alive = true;
    input.jump = false;
    input.jumpPressed = false;
    input.crouch = false;
    clearInputState(inputP1);
    clearInputState(inputP2);
  } else {
    player2.alive = false;
    respawnPlayer();
  }
}

function respawnPlayer() {
  level = createLevel();
  coins = createCoinsForLevel(level, TOTAL_COINS - collectedCoins);
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.squish = 1;
  player.crouching = false;
  player.height = PLAYER_SIZE;
  input.jump = false;
  input.jumpPressed = false;
  input.crouch = false;
}

function getCollectedCoins() {
  return collectedCoins;
}

/** Multiplayer: every pickup needs both players; win when all 10 are claimed by both. */
function multiplayerAllCoinsClaimedByBoth() {
  return coins.length > 0 && coins.every((c) => c.byP1 && c.byP2);
}

function multiplayerOnePlayerClearedAllPickups() {
  return coinsCollectedP1 >= TOTAL_COINS || coinsCollectedP2 >= TOTAL_COINS;
}

function multiplayerWinReached() {
  return multiplayerAllCoinsClaimedByBoth() || multiplayerOnePlayerClearedAllPickups();
}

function multiplayerPairsDoneCount() {
  return coins.filter((c) => c.byP1 && c.byP2).length;
}

function drawMultiplayerCoinClaimRing(x, y, radius, coin) {
  if (!multiplayerMode || (coin.byP1 && coin.byP2)) {
    return;
  }
  const r = radius + 7;
  const dim = "rgba(55, 70, 90, 0.5)";
  const p1c = platformTheme === "orange" ? "#3db872" : platformTheme === "blank" ? "#37d14a" : "#3db872";
  const p2c = platformTheme === "orange" ? "#8a78c0" : platformTheme === "blank" ? "#4a9eff" : "#4890d8";
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = coin.byP1 ? p1c : dim;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.stroke();
  ctx.strokeStyle = coin.byP2 ? p2c : dim;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.restore();
}

function killPlayer() {
  if (gameState !== "playing") {
    return;
  }

  deaths += 1;

  if (deaths >= MAX_DEATHS) {
    lostReason = "deaths";
    playLoseSound();
    gameState = "lost";
    syncGameUiState();
    return;
  }

  respawnPlayer();
}


function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function circleIntersectsPlayer(circle) {
  const closestX = Math.max(player.x, Math.min(circle.x, player.x + player.width));
  const closestY = Math.max(player.y, Math.min(circle.y, player.y + player.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function circleIntersectsRect(circle, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(circle.x, rx + rw));
  const closestY = Math.max(ry, Math.min(circle.y, ry + rh));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function rectsForEntity(p) {
  const rects = [{ x: p.x, y: p.y, width: p.width, height: p.height }];
  if (p.x < 0) rects.push({ x: p.x + WIDTH, y: p.y, width: p.width, height: p.height });
  if (p.x + p.width > WIDTH) rects.push({ x: p.x - WIDTH, y: p.y, width: p.width, height: p.height });
  return rects;
}

function getPlayerRects() {
  return rectsForEntity(player);
}

/** deathSlot: 0 / 1 in multiplayer; ignored when not multiplayer (uses killPlayer). */
function updateSinglePlayer(p, inp, dt, deathSlot) {
  if (gameState !== "playing") {
    p.vx = 0;
    return;
  }
  if (multiplayerMode && !p.alive) {
    p.vx = 0;
    return;
  }

  const wasOnGround = p.onGround;
  const bottom = p.y + p.height;

  if (inp.crouch && !p.crouching) {
    p.crouching = true;
    p.height = CROUCH_HEIGHT;
    if (p.onGround) p.y = bottom - CROUCH_HEIGHT;
  } else if (!inp.crouch && p.crouching) {
    if (p.onGround) {
      const standY = bottom - PLAYER_SIZE;
      const standingBox = { x: p.x, y: standY, width: p.width, height: PLAYER_SIZE };
      const ceiling = level.platforms.some((plat) => plat.y < standY && rectsOverlap(standingBox, plat));
      if (!ceiling) {
        p.crouching = false;
        p.height = PLAYER_SIZE;
        p.y = standY;
      }
    } else {
      p.crouching = false;
      p.height = PLAYER_SIZE;
    }
  }

  p.vx = 0;
  const moveSpeed = p.crouching ? MOVE_SPEED * 0.5 : MOVE_SPEED;
  if (inp.left) p.vx -= moveSpeed;
  if (inp.right) p.vx += moveSpeed;

  if (inp.jumpPressed && p.onGround) {
    const jumpSpeed = p.crouching ? JUMP_SPEED * 0.88 : JUMP_SPEED;
    p.vy = -jumpSpeed;
    p.onGround = false;
    p.squish = 1;
    playJumpSound();
  }

  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;

  const horizontalBounds = { x: p.x, y: p.y, width: p.width, height: p.height };
  for (const platform of level.platforms) {
    if (!rectsOverlap(horizontalBounds, platform)) {
      continue;
    }

    if (p.vx > 0) {
      const newX = platform.x - p.width;
      if (p.x > WIDTH && newX <= WIDTH) continue;
      p.x = newX;
    } else if (p.vx < 0) {
      const newX = platform.x + platform.width;
      if (p.x + p.width < 0 && newX >= -p.width) continue;
      p.x = newX;
    }

    horizontalBounds.x = p.x;
  }

  p.y += p.vy * dt;
  p.onGround = false;

  const verticalBounds = { x: p.x, y: p.y, width: p.width, height: p.height };
  for (const platform of level.platforms) {
    if (!rectsOverlap(verticalBounds, platform)) {
      continue;
    }

    if (p.vy > 0) {
      p.y = platform.y - p.height;
      p.vy = 0;
      p.onGround = true;
    } else if (p.vy < 0) {
      p.y = platform.y + platform.height;
      p.vy = 0;
    }

    verticalBounds.y = p.y;
  }

  const ground = level.platforms.find((plat) => plat.type === "ground");
  if (ground && p.y + p.height > ground.y) {
    p.y = ground.y - p.height;
    p.vy = 0;
    p.onGround = true;
  }

  if (p.y > HEIGHT + 100) {
    if (multiplayerMode) {
      lastDeathCause = "fall";
      killPlayerSlot(deathSlot);
    } else {
      killPlayer();
    }
    inp.jumpPressed = false;
    return;
  }

  if (p.x + p.width <= -2) {
    p.x += WIDTH;
  } else if (p.x >= WIDTH + 2) {
    p.x -= WIDTH;
  }

  if (!wasOnGround && p.onGround && p.vy === 0) {
    playLandSound();
  }

  p.squish = Math.max(0, p.squish - dt * 4);
  inp.jumpPressed = false;
}

function updatePlayer(dt) {
  if (gameState !== "playing") {
    player.vx = 0;
    if (multiplayerMode) player2.vx = 0;
    return;
  }
  if (multiplayerMode) {
    updateSinglePlayer(player, inputP1, dt, 0);
    updateSinglePlayer(player2, inputP2, dt, 1);
  } else {
    updateSinglePlayer(player, input, dt, 0);
  }
}

function updateCoins(dt) {
  for (const coin of coins) {
    coin.bob += dt * 4;

    if (multiplayerMode) {
      if (coin.byP1 && coin.byP2) {
        continue;
      }
      if (
        player.alive &&
        !coin.byP1 &&
        rectsForEntity(player).some((r) => circleIntersectsRect(coin, r.x, r.y, r.width, r.height))
      ) {
        coin.byP1 = true;
        coinsCollectedP1 += 1;
        playCoinSound();
      }
      if (
        player2.alive &&
        !coin.byP2 &&
        rectsForEntity(player2).some((r) => circleIntersectsRect(coin, r.x, r.y, r.width, r.height))
      ) {
        coin.byP2 = true;
        coinsCollectedP2 += 1;
        playCoinSound();
      }
    } else {
      if (coin.byP1) {
        continue;
      }
      if (getPlayerRects().some((r) => circleIntersectsRect(coin, r.x, r.y, r.width, r.height))) {
        coin.byP1 = true;
        collectedCoins += 1;
        playCoinSound();
      }
    }
  }

  if (multiplayerMode) {
    if (multiplayerWinReached()) {
      playWinSound();
      gameState = "won";
      syncGameUiState();
    }
  } else if (collectedCoins === TOTAL_COINS) {
    playWinSound();
    gameState = "won";
    syncGameUiState();
  }
}

function getBeetleRects() {
  const b = level.beetle;
  if (!b) return [];
  const rects = [{ x: b.x, y: b.y, width: b.width, height: b.height }];
  if (b.x + b.width > WIDTH) rects.push({ x: b.x - WIDTH, y: b.y, width: b.width, height: b.height });
  if (b.x < 0) rects.push({ x: b.x + WIDTH, y: b.y, width: b.width, height: b.height });
  return rects;
}

function updateBeetle(dt) {
  const b = level.beetle;
  if (!b) return;

  let chaseCx = null;
  if (multiplayerMode) {
    const candidates = [];
    if (player.alive && player.onGround && player.y + player.height >= GROUND_Y - 2) {
      candidates.push(player.x + player.width / 2);
    }
    if (player2.alive && player2.onGround && player2.y + player2.height >= GROUND_Y - 2) {
      candidates.push(player2.x + player2.width / 2);
    }
    if (candidates.length > 0) {
      const beetleCx = b.x + b.width / 2;
      chaseCx = candidates[0];
      let bestD = Math.abs(chaseCx - beetleCx);
      for (let i = 1; i < candidates.length; i += 1) {
        const d = Math.abs(candidates[i] - beetleCx);
        if (d < bestD) {
          bestD = d;
          chaseCx = candidates[i];
        }
      }
    }
  } else if (player.onGround && player.y + player.height >= GROUND_Y - 2) {
    chaseCx = player.x + player.width / 2;
  }

  const onGroundLevel = chaseCx != null;
  if (gameState === "playing" && onGroundLevel) {
    const beetleCx = b.x + b.width / 2;
    const dx = chaseCx - beetleCx;
    b.vx = dx > 0 ? BEETLE_CHASE_SPEED : dx < 0 ? -BEETLE_CHASE_SPEED : b.vx;
  } else if (gameState === "playing") {
    b.vx = b.vx >= 0 ? BEETLE_SPEED : -BEETLE_SPEED;
  }
  b.x += b.vx * dt;
  if (onGroundLevel) {
    if (b.x <= 0) {
      b.x = 0;
      b.vx = -b.vx;
    }
    if (b.x + b.width >= WIDTH) {
      b.x = WIDTH - b.width;
      b.vx = -b.vx;
    }
  } else {
    if (b.x >= WIDTH) b.x -= WIDTH;
    if (b.x + b.width <= 0) b.x += WIDTH;
  }
  if (!onGroundLevel && !b.isDigging) {
    for (const rect of getBeetleRects()) {
      for (const platform of level.platforms) {
        if (platform.type !== "platform") continue;
        if (rectsOverlap(rect, platform)) {
          b.vx = -b.vx;
          b.x += b.vx * dt;
          if (b.x >= WIDTH) b.x -= WIDTH;
          if (b.x + b.width <= 0) b.x += WIDTH;
          return;
        }
      }
    }
  }
  const beetleRect = { x: b.x, y: b.y, width: b.width, height: b.height };
  const overlappingPlatform = level.platforms.some(
    (p) => p.type === "platform" && rectsOverlap(beetleRect, p)
  );
  b.isDigging = overlappingPlatform && (onGroundLevel || b.isDigging);
}

function updateSpikes() {
  const targets = multiplayerMode
    ? [
        { rects: rectsForEntity(player), slot: 0, alive: player.alive },
        { rects: rectsForEntity(player2), slot: 1, alive: player2.alive }
      ].filter((t) => t.alive)
    : [{ rects: getPlayerRects(), slot: null, alive: true }];

  for (const { rects, slot } of targets) {
    for (const r of rects) {
      const hurtbox = {
        x: r.x + 5,
        y: r.y + 5,
        width: r.width - 10,
        height: r.height - 5
      };

      for (const spike of level.spikes) {
        const spikeHitbox = {
          x: spike.x,
          y: spike.y - spike.height,
          width: spike.width,
          height: spike.height
        };

        if (rectsOverlap(hurtbox, spikeHitbox)) {
          lastDeathCause = "spikes";
          playSpikeDeathSound();
          if (multiplayerMode) killPlayerSlot(slot);
          else killPlayer();
          return;
        }
      }

      for (const beetleRect of getBeetleRects()) {
        if (rectsOverlap(hurtbox, beetleRect)) {
          lastDeathCause = "beetle";
          playSpikeDeathSound();
          if (multiplayerMode) killPlayerSlot(slot);
          else killPlayer();
          return;
        }
      }
    }
  }
}

function drawBackground() {
  if (platformTheme === "blank") {
    const blankBg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    blankBg.addColorStop(0, "#f0f0f3");
    blankBg.addColorStop(0.5, "#d5d5da");
    blankBg.addColorStop(1, "#b8b8c0");
    ctx.fillStyle = blankBg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#8a8a90";
    ctx.fillRect(0, level.groundY - 12, WIDTH, 12);
    return;
  }

  if (platformTheme === "jungle") {
    const jungleSky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    jungleSky.addColorStop(0, "#0b4f2d");
    jungleSky.addColorStop(0.5, "#0a6f3c");
    jungleSky.addColorStop(1, "#06361d");
    ctx.fillStyle = jungleSky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const horizonY = HEIGHT * 0.45;
    const t = Date.now() / 1000;

    const treeTop = -HEIGHT * 0.35; // off-screen
    const treeBottom = HEIGHT * 1.15; // off-screen (below)

    function drawJungleTree(x, scale, alpha, leafColor1, leafColor2) {
      const sway = Math.sin(t * 0.25 + x * 0.01) * 6 * scale;
      // Thicker bark.
      const trunkW = 16 * scale;
      const trunkTopY = treeTop - 60 * scale;
      const trunkH = treeBottom - trunkTopY;
      const trunkX = x + sway;
      const trunkAlpha = Math.min(1, alpha + 0.25);
      const leafAlpha = Math.max(0.05, alpha * 0.8);

      // Bark trunk
      ctx.save();
      ctx.globalAlpha = trunkAlpha;
      ctx.fillStyle = "#5b3a22";
      ctx.fillRect(trunkX - trunkW / 2, trunkTopY, trunkW, trunkH);
      ctx.fillStyle = "#6b4a2f";
      ctx.fillRect(trunkX - trunkW / 2 + 2 * scale, trunkTopY, trunkW * 0.25, trunkH);
      ctx.fillStyle = "#4b2f19";
      ctx.fillRect(trunkX + trunkW / 2 - 2 * scale, trunkTopY, trunkW * 0.25, trunkH);
      // Leaves use a slightly lower alpha so the bark remains visible.
      ctx.globalAlpha = leafAlpha;

      // Leaves: stretch beyond screen bounds while remaining visible.
      const leafYStart = horizonY + HEIGHT * 0.25;
      const leafYEnd = -HEIGHT * 0.35;
      const steps = 7;
      for (let j = 0; j < steps; j += 1) {
        const u = j / (steps - 1);
        const y = leafYStart + (leafYEnd - leafYStart) * u;
        // Wider leaves so canopies extend past the sides of the screen.
        const leafW = (70 + (steps - j) * 26) * scale;
        // Taller leaves so the top/bottom of canopies go off-screen.
        const leafH = (44 + (steps - j) * 22) * scale;
        ctx.fillStyle = leafColor1;
        ctx.beginPath();
        ctx.ellipse(trunkX + sway * 0.25, y, leafW, leafH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = leafColor2;
        ctx.beginPath();
        ctx.ellipse(
          trunkX + sway * 0.2,
          y + 8 * scale,
          leafW * 0.78,
          leafH * 0.72,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Redraw bark on top so the thick trunk stays visible.
      ctx.globalAlpha = trunkAlpha;
      ctx.fillStyle = "#5b3a22";
      ctx.fillRect(trunkX - trunkW / 2, trunkTopY, trunkW, trunkH);
      ctx.strokeStyle = "#2c1a10";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(trunkX - trunkW / 2, trunkTopY, trunkW, trunkH);

      ctx.restore();
    }

    // Back trees (behind moving mist/leaves).
    for (let i = -2; i <= Math.ceil(WIDTH / 140) + 2; i += 1) {
      const x = i * 140 + (i % 2 === 0 ? 20 : 0);
      const scale = 0.75 + (i % 4) * 0.05;
      drawJungleTree(x, scale, 0.38, "#0b7a3b", "#1ea14f");
    }

    // Front trees.
    for (let i = -3; i <= Math.ceil(WIDTH / 95) + 3; i += 1) {
      const x = i * 95 + (i % 3 === 0 ? 12 : -10);
      const scale = 0.95 + (i % 5) * 0.03;
      drawJungleTree(x, scale, 0.52, "#076a35", "#22b85c");
    }

    // Mist columns (subtle moving haze) drawn after trees so trees stay behind.
    for (let i = -2; i <= Math.ceil(WIDTH / 160) + 2; i += 1) {
      const x = i * 160 + Math.sin(t * 0.5 + i * 1.3) * 18;
      ctx.fillStyle = "rgba(210, 255, 220, 0.035)";
      ctx.fillRect(x, 0, 70, HEIGHT * 0.85);
    }

    // Small drifting leaf speckles drawn after trees so they appear in front.
    ctx.fillStyle = "rgba(38, 130, 60, 0.22)";
    for (let i = 0; i < 42; i += 1) {
      const baseX = (i * 83) % WIDTH;
      const baseY = (i * 47) % (HEIGHT * 0.8);
      const y = (baseY + (t * 18 + i * 13) % (HEIGHT * 0.8)) - HEIGHT * 0.2;
      const r = 1 + (i % 3) * 0.65;
      const dx = Math.sin(t * 0.9 + i) * 14;
      ctx.beginPath();
      ctx.arc(baseX + dx, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground: mossy strip with a darker base.
    const groundTop = level.groundY - 12;
    const groundGrad = ctx.createLinearGradient(0, groundTop, 0, level.groundY + 8);
    groundGrad.addColorStop(0, "#1a5f35");
    groundGrad.addColorStop(1, "#0f3b1f");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundTop, WIDTH, 12);

    // A few moss highlights.
    ctx.fillStyle = "rgba(120, 220, 140, 0.15)";
    for (let i = 0; i < 12; i += 1) {
      const x = (i * 97) % WIDTH;
      const w = 18 + (i % 4) * 10;
      ctx.fillRect(x, level.groundY - 9, w, 2);
    }
    return;
  }

  if (platformTheme === "backrooms") {
    const backroomsBg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    backroomsBg.addColorStop(0, "#d4c84c");
    backroomsBg.addColorStop(0.4, "#e0d460");
    backroomsBg.addColorStop(1, "#c4b038");
    ctx.fillStyle = backroomsBg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const roomWidth = 220;
    for (let i = -2; i <= Math.ceil(WIDTH / roomWidth) + 1; i += 1) {
      const rx = i * roomWidth;
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(rx, 0, 3, HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 220, 0.15)" : "rgba(200, 190, 100, 0.12)";
      ctx.fillRect(rx + 3, 0, roomWidth - 3, HEIGHT);
    }

    const lightSpacing = 180;
    for (let L = -1; L <= Math.ceil(WIDTH / lightSpacing) + 2; L += 1) {
      const lx = L * lightSpacing;
      ctx.fillStyle = "rgba(255, 255, 240, 0.5)";
      ctx.fillRect(lx, 28, 140, 14);
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillRect(lx + 4, 30, 132, 10);
      ctx.fillStyle = "rgba(255, 248, 200, 0.4)";
      ctx.fillRect(lx, 42, 140, 25);
    }

    ctx.fillStyle = "#4a4a48";
    ctx.fillRect(0, level.groundY - 12, WIDTH, 12);
    return;
  }

  if (platformTheme === "orange") {
    const factorySky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    factorySky.addColorStop(0, "#4a4a4a");
    factorySky.addColorStop(0.5, "#5c564e");
    factorySky.addColorStop(1, "#6b6258");
    ctx.fillStyle = factorySky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#3a3530";
    ctx.fillRect(120, 60, 200, 18);
    ctx.fillRect(520, 85, 180, 14);
    ctx.fillRect(380, 45, 160, 12);
    ctx.fillStyle = "#2d2822";
    ctx.fillRect(125, 55, 12, 80);
    ctx.fillRect(530, 78, 10, 65);
    ctx.fillRect(388, 38, 10, 55);
    ctx.fillStyle = "#454038";
    ctx.fillRect(700, 100, 90, 16);
    ctx.fillRect(250, 75, 70, 14);
    ctx.fillRect(750, 72, 12, 100);

    ctx.fillStyle = "#3d3832";
    const heights = [180, 220, 140, 260, 160, 200, 120];
    const widths = [70, 90, 55, 110, 65, 85, 50];
    for (let i = 0; i < 7; i += 1) {
      const bx = 60 + i * 135;
      const bh = heights[i];
      const bw = widths[i];
      ctx.fillRect(bx, level.groundY - bh, bw, bh);
      if (i % 2 === 0) {
        ctx.fillStyle = "#2d2822";
        ctx.fillRect(bx + bw - 18, level.groundY - bh, 12, bh * 0.6);
        ctx.fillStyle = "#3d3832";
      }
    }

    ctx.fillStyle = "#b8941f";
    ctx.fillRect(0, level.groundY - 12, WIDTH, 12);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#87d6ff");
  sky.addColorStop(0.7, "#8be1ff");
  sky.addColorStop(1, "#d2f5ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const wrap = (x) => ((x + cloudOffset) % CLOUD_WRAP) - 200;
  const c1x = wrap(130);
  ctx.beginPath();
  ctx.arc(c1x, 90, 40, 0, Math.PI * 2);
  ctx.arc(c1x + 35, 88, 30, 0, Math.PI * 2);
  ctx.arc(c1x + 70, 96, 24, 0, Math.PI * 2);
  ctx.fill();

  const c2x = wrap(720);
  ctx.beginPath();
  ctx.arc(c2x, 80, 32, 0, Math.PI * 2);
  ctx.arc(c2x + 32, 72, 24, 0, Math.PI * 2);
  ctx.arc(c2x + 63, 82, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = platformTheme === "backrooms" ? "#4a4a48" : "#71bb5e";
  ctx.fillRect(0, level.groundY - 12, WIDTH, 12);
}

function drawPlatforms() {
  for (const platform of level.platforms) {
    if (platform.type === "ground") {
      if (platformTheme === "orange") {
        ctx.fillStyle = "#c9a227";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#e8c547";
        ctx.fillRect(platform.x, platform.y, platform.width, 6);
      } else if (platformTheme === "backrooms") {
        ctx.fillStyle = "#4a4a48";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        const gSeed = 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(platform.x, platform.y, platform.width, platform.height);
        ctx.clip();
        const concreteColors = ["#424240", "#4a4a48", "#525250", "#3a3a38", "#5a5a58"];
        const tileW = 24;
        const tileH = 18;
        for (let ty = 0; ty < platform.height + tileH; ty += tileH) {
          for (let tx = 0; tx < platform.width + tileW; tx += tileW) {
            const idx = (Math.floor(tx / tileW) + Math.floor(ty / tileH) + gSeed) % concreteColors.length;
            ctx.fillStyle = concreteColors[idx];
            ctx.fillRect(platform.x + tx, platform.y + ty, tileW - 1, tileH - 1);
          }
        }
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 1;
        for (let tx = 0; tx <= platform.width; tx += tileW) {
          ctx.beginPath();
          ctx.moveTo(platform.x + tx, platform.y);
          ctx.lineTo(platform.x + tx, platform.y + platform.height);
          ctx.stroke();
        }
        for (let ty = 0; ty <= platform.height; ty += tileH) {
          ctx.beginPath();
          ctx.moveTo(platform.x, platform.y + ty);
          ctx.lineTo(platform.x + platform.width, platform.y + ty);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = "#5a5a58";
        ctx.fillRect(platform.x, platform.y, platform.width, 4);
      } else if (platformTheme === "blank") {
        ctx.fillStyle = "#f8f8f8";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(platform.x, platform.y, platform.width, 4);
      } else if (platformTheme === "jungle") {
        ctx.fillStyle = "#26562b";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#3a8b3f";
        ctx.fillRect(platform.x, platform.y, platform.width, 6);
      } else {
        ctx.fillStyle = "#5e4540";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#9be16e";
        ctx.fillRect(platform.x, platform.y, platform.width, 6);
      }
      continue;
    }

    const px = platform.x;
    const py = platform.y;
    const pw = platform.width;
    const ph = platform.height;
    const seed = (px * 11 + py * 7) % 12345;

    if (platformTheme === "orange") {
      ctx.fillStyle = "#2ab4c4";
      ctx.fillRect(px, py, pw, ph);

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();

      const stripeStep = 5;
      const carpetColors = ["#20a0b0", "#30c8d8", "#1898a8", "#2ab4c4", "#38d0e0"];
      for (let row = 0; row < ph + stripeStep * 2; row += stripeStep) {
        const shade = carpetColors[(Math.floor(row / stripeStep) + Math.floor(seed / 100)) % carpetColors.length];
        ctx.fillStyle = shade;
        ctx.fillRect(px, py + row, pw, stripeStep - 1);
      }
      for (let col = 0; col < pw + 8; col += 8) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
        ctx.fillRect(px + col, py, 2, ph);
      }

      ctx.restore();

      ctx.fillStyle = "#38c8d8";
      ctx.fillRect(px, py, pw, 5);
    } else if (platformTheme === "backrooms") {
      ctx.fillStyle = "#b8960f";
      ctx.fillRect(px, py, pw, ph);

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();

      const wallColors = ["#a08008", "#b8960f", "#c4a535", "#9a7b0a", "#d4b84a"];
      const gridStep = 12;
      for (let gy = 0; gy < ph + gridStep; gy += gridStep) {
        for (let gx = 0; gx < pw + gridStep; gx += gridStep) {
          const idx = (Math.floor(gx / gridStep) + Math.floor(gy / gridStep) + Math.floor(seed / 50)) % wallColors.length;
          ctx.fillStyle = wallColors[idx];
          ctx.fillRect(px + gx, py + gy, gridStep - 1, gridStep - 1);
        }
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
      for (let gx = 0; gx < pw; gx += gridStep * 2) {
        ctx.fillRect(px + gx, py, 1, ph);
      }
      for (let gy = 0; gy < ph; gy += gridStep * 2) {
        ctx.fillRect(px, py + gy, pw, 1);
      }

      ctx.restore();

      ctx.fillStyle = "#c4a535";
      ctx.fillRect(px, py, pw, 5);
    } else if (platformTheme === "blank") {
      ctx.fillStyle = "#f8f8f8";
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px, py, pw, 3);
    } else if (platformTheme === "jungle") {
      ctx.fillStyle = "#2c6a30";
      ctx.fillRect(px, py, pw, ph);
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      const vineStep = 12;
      ctx.strokeStyle = "rgba(10, 30, 14, 0.45)";
      ctx.lineWidth = 2;
      for (let vx = px - 10; vx < px + pw + 10; vx += vineStep) {
        ctx.beginPath();
        ctx.moveTo(vx, py - 4);
        ctx.quadraticCurveTo(vx + 6, py + ph * 0.4, vx - 4, py + ph + 6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#45a547";
      ctx.fillRect(px, py, pw, 4);
    } else {
      ctx.fillStyle = "#6a6a6a";
      ctx.fillRect(px, py, pw, ph);

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();

      const gravelColors = ["#5c5c5c", "#6a6a6a", "#787878", "#585858", "#727272", "#636363"];
      const count = Math.floor((pw * ph) / 85);
      for (let i = 0; i < count; i += 1) {
        const t = (seed + i * 7919) % 999999;
        const gx = px + 2 + (t % Math.max(1, Math.floor(pw - 4)));
        const gy = py + 2 + ((t * 31) % Math.max(1, Math.floor(ph - 4)));
        const r = 2.2 + ((t * 17) % 300) / 200;
        ctx.fillStyle = gravelColors[(t * 13 + i) % gravelColors.length];
        ctx.beginPath();
        ctx.ellipse(gx, gy, r, r * 1.1, (t % 100) / 50, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.fillStyle = "#8a8a8a";
      ctx.fillRect(px, py, pw, 5);
    }
  }
}

function drawSpikes() {
  if (platformTheme === "backrooms") {
    for (const spike of level.spikes) {
      const cx = spike.x + spike.width / 2;
      const baseY = spike.y;
      const trapW = spike.width;
      const trapH = spike.height;
      const left = spike.x;
      const right = spike.x + spike.width;
      const top = baseY - trapH;
      ctx.fillStyle = "#1a1a1a";
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, baseY);
      ctx.lineTo(left + trapW * 0.2, baseY);
      ctx.lineTo(cx, top + trapH * 0.4);
      ctx.lineTo(right - trapW * 0.2, baseY);
      ctx.lineTo(right, baseY);
      ctx.lineTo(right - trapW * 0.15, baseY - 3);
      ctx.lineTo(cx, top + trapH * 0.55);
      ctx.lineTo(left + trapW * 0.15, baseY - 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0d0d0d";
      ctx.beginPath();
      ctx.moveTo(left + trapW * 0.25, baseY - 2);
      ctx.lineTo(cx - trapW * 0.08, top + trapH * 0.5);
      ctx.lineTo(cx, top + trapH * 0.35);
      ctx.lineTo(cx + trapW * 0.08, top + trapH * 0.5);
      ctx.lineTo(right - trapW * 0.25, baseY - 2);
      ctx.lineTo(cx, baseY - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#252525";
      ctx.stroke();
      const teeth = 6;
      for (let i = 0; i <= teeth; i += 1) {
        const u = i / teeth;
        const tx = cx + (u - 0.5) * trapW * 0.5;
        const ty = top + trapH * (0.35 + u * 0.2);
        ctx.beginPath();
        ctx.moveTo(tx - 2, ty + 3);
        ctx.lineTo(tx, ty - 1);
        ctx.lineTo(tx + 2, ty + 3);
        ctx.stroke();
      }
    }
    return;
  }

  if (platformTheme === "blank") {
    for (const spike of level.spikes) {
      const baseY = spike.y;
      const segCount = Math.max(1, Math.floor(spike.width / 18));
      const segW = spike.width / segCount;
      for (let i = 0; i < segCount; i += 1) {
        const cx = spike.x + i * segW + segW / 2;
        const radius = (segW * 0.5);
        const bumpTop = baseY - spike.height * 0.9;
        const cy = bumpTop + radius;
        ctx.fillStyle = "#e03b2f";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, Math.PI, 0, false);
        ctx.lineTo(cx + radius, baseY);
        ctx.lineTo(cx - radius, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#b3241c";
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }
    return;
  }

  if (platformTheme === "jungle") {
    const t = Date.now() / 90;
    for (const spike of level.spikes) {
      const baseY = spike.y;
      const tipY = spike.y - spike.height;
      const count = Math.max(1, Math.floor(spike.width / 18));
      const baseWidth = spike.width / count;

      for (let i = 0; i < count; i += 1) {
        const x0 = spike.x + i * baseWidth + baseWidth / 2;
        const wave = Math.sin(t + i * 0.7 + spike.x * 0.01);

        const thickness = Math.max(2, baseWidth * 0.16);
        const outline = "#0f5f2b";
        const main = "#1ea14f";
        const headX = x0 + wave * 2;
        const headY = tipY + wave * 1.5;

        // Snake body path.
        const seg1Y = baseY - spike.height * 0.25;
        const seg2Y = baseY - spike.height * 0.55;
        const seg3Y = baseY - spike.height * 0.8;
        const off1 = baseWidth * 0.25 + wave * 2;
        const off2 = baseWidth * 0.18 - wave * 2;

        // Outline stroke.
        ctx.save();
        ctx.strokeStyle = outline;
        ctx.lineWidth = thickness * 1.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x0, baseY);
        ctx.quadraticCurveTo(x0 - off1, seg1Y, x0 + off2, seg2Y);
        ctx.quadraticCurveTo(x0 - off2 * 0.7, seg3Y, headX, headY);
        ctx.stroke();

        // Main stroke.
        ctx.strokeStyle = main;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(x0, baseY);
        ctx.quadraticCurveTo(x0 - off1, seg1Y, x0 + off2, seg2Y);
        ctx.quadraticCurveTo(x0 - off2 * 0.7, seg3Y, headX, headY);
        ctx.stroke();

        // Head.
        ctx.fillStyle = "#0f7f33";
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - thickness * 0.9, headY + thickness * 2.2);
        ctx.lineTo(headX + thickness * 0.9, headY + thickness * 2.2);
        ctx.closePath();
        ctx.fill();

        // Eyes.
        ctx.fillStyle = "#083a18";
        ctx.beginPath();
        ctx.arc(headX - thickness * 0.25, headY + thickness * 1.0, 1.2, 0, Math.PI * 2);
        ctx.arc(headX + thickness * 0.25, headY + thickness * 1.0, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Tongue.
        ctx.strokeStyle = "rgba(180, 40, 30, 0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(headX, headY + thickness * 1.4);
        ctx.lineTo(headX, headY + thickness * 2.2);
        ctx.stroke();

        ctx.restore();
      }
    }
    return;
  }

  const t = Date.now() / 80;
  for (const spike of level.spikes) {
    const count = Math.floor(spike.width / 18);
    const baseWidth = spike.width / count;

    for (let i = 0; i < count; i += 1) {
      const x = spike.x + i * baseWidth;
      const tipX = x + baseWidth / 2;
      const tipY = spike.y - spike.height;

      if (platformTheme === "orange") {
        const cx = tipX;
        const cy = spike.y - spike.height / 2;
        const r = baseWidth * 0.48;
        const teeth = 10;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((t * 0.02 + i * 0.3) % (Math.PI * 2));
        ctx.shadowColor = "rgba(180, 100, 255, 0.9)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "#4a2080";
        ctx.beginPath();
        for (let j = 0; j < teeth * 2; j += 1) {
          const angle = (j / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
          const rad = j % 2 === 0 ? r : r * 0.72;
          const px = Math.cos(angle) * rad;
          const py = Math.sin(angle) * rad;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#6b30b0";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#2d1048";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#5a28a0";
        ctx.lineWidth = 1;
        ctx.stroke();
        const flicker = 0.7 + Math.sin(t + i * 2) * 0.3;
        ctx.strokeStyle = `rgba(220, 180, 255, ${flicker})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let e = 0; e < 4; e += 1) {
          const a = (e / 4) * Math.PI * 2 + t * 0.5;
          const len = r * (0.4 + Math.sin(t + e) * 0.15);
          ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
          ctx.lineTo(Math.cos(a) * (r * 0.3 + len), Math.sin(a) * (r * 0.3 + len));
        }
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = "#ff5f8f";
        ctx.beginPath();
        ctx.moveTo(x, spike.y);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(x + baseWidth, spike.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.moveTo(x + 2, spike.y - 1);
        ctx.lineTo(tipX - 2, tipY + 3);
        ctx.lineTo(tipX + 1, tipY + 2);
        ctx.lineTo(x + baseWidth * 0.45, spike.y - 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawEntity(halfW, halfH, b) {
  const now = Date.now() / 1000;
  const t = now * 2;
  const glitchPhase = Math.sin(now * 7.3) * 0.5 + 0.5;
  const jitter = glitchPhase > 0.92 ? (Math.sin(now * 47) * 2) : 0;
  const legWave = (b.isDigging ? 0.35 : 0.18) * Math.sin(t);

  if (b.isDigging) {
    const tt = Math.floor(now * 24);
    const w = halfW * 2 + 32;
    const h = 36;
    const left = -halfW - 16;
    const top = halfH - 6;
    for (let i = 0; i < 120; i += 1) {
      const px = (i * 7919 + tt * 313) % 997;
      const py = (i * 503 + tt * 417 + px) % 499;
      const x = left + (px / 997) * w;
      const y = top + (py / 499) * h;
      const bright = ((i * 619 + tt * 257) % 100) / 100;
      const on = bright > 0.52;
      if (!on) continue;
      const shade = 6 + Math.floor(bright * 28);
      ctx.fillStyle = `rgb(${shade}, ${Math.max(0, shade - 3)}, ${shade + 5})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    if ((tt % 5) === 0 || (tt % 7) === 2) {
      const scanY = top + ((tt * 11) % Math.max(1, h - 4));
      ctx.fillStyle = "rgba(20, 12, 28, 0.4)";
      ctx.fillRect(left, scanY, w, 1);
      for (let j = 0; j < 25; j += 1) {
        const jx = (j * 401 + tt * 89) % 97;
        const on = ((j + tt) % 3) !== 0;
        if (on) {
          ctx.fillStyle = `rgba(${15 + (j % 3) * 8}, 10, 25, 0.7)`;
          ctx.fillRect(left + (jx / 97) * w, scanY, 2, 1);
        }
      }
    }
    ctx.fillStyle = "rgba(4, 2, 8, 0.6)";
    ctx.fillRect(-halfW - 10, halfH - 4, halfW * 2 + 20, 22);
  }

  ctx.save();
  ctx.translate(jitter * 0.5, jitter * 0.3);

  function boneLeg(side, along, phase) {
    const x = along * halfW * 0.85;
    const y = halfH * 0.38;
    const wave = legWave * phase;
    const out = side * (halfW * 0.48 + 5);
    const kneeOut = side * (halfW * 0.68 + 8);
    const footOut = side * (halfW * 0.74 + 10);
    ctx.strokeStyle = glitchPhase > 0.88 ? "rgba(35, 18, 45, 0.9)" : "#0f0d12";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + out + wave * 22, y + 8);
    ctx.lineTo(x + kneeOut + wave * 28, y + halfH * 0.55);
    ctx.lineTo(x + footOut + wave * 30, y + halfH + 2);
    ctx.stroke();
    const jx = x + out * 0.6 + wave * 18;
    const jy = y + 4;
    ctx.fillStyle = "#0a080c";
    ctx.beginPath();
    ctx.ellipse(jx, jy, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + kneeOut * 0.7 + wave * 22, y + halfH * 0.3, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  boneLeg(1, -0.58, 1);
  boneLeg(1, 0.02, 0.72);
  boneLeg(1, 0.58, 0.35);
  boneLeg(-1, -0.58, 0.82);
  boneLeg(-1, 0.02, 0.5);
  boneLeg(-1, 0.58, 0.2);

  const coreWobble = 0.98 + Math.sin(t * 1.7) * 0.05;
  const coreSquash = 0.96 + Math.cos(t * 0.9) * 0.06;
  ctx.fillStyle = "#050508";
  ctx.strokeStyle = glitchPhase > 0.9 ? "rgba(55, 22, 65, 0.7)" : "rgba(18, 14, 22, 0.95)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0.32 * halfW, 0, halfW * 0.3 * coreWobble, halfH * 0.88 * coreSquash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-0.48 * halfW, 0, halfW * 0.36 * coreWobble, halfH * 0.86 * coreSquash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-halfW * 0.12, 0, halfW * 0.38 * coreWobble, halfH * 0.8 * coreSquash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(0, -halfH * 0.08, halfW * 0.9 * coreWobble, halfH * 0.52 * coreSquash, t * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = glitchPhase > 0.88 ? "rgba(45, 20, 55, 0.6)" : "rgba(12, 10, 18, 0.9)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -halfH * 0.48);
  ctx.lineTo(0, halfH * 0.48);
  ctx.stroke();

  const headX = halfW * 0.7 + Math.sin(t * 0.6) * 2;
  ctx.fillStyle = "#08060a";
  ctx.strokeStyle = "rgba(22, 16, 28, 0.9)";
  ctx.beginPath();
  ctx.ellipse(headX, 0, halfW * 0.26 * (0.98 + Math.sin(t * 1.2) * 0.04), halfH * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(headX + halfW * 0.08, 0, halfW * 0.12, halfH * 0.35, -t * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 10, 22, 0.8)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headX + halfW * 0.2, -halfH * 0.15);
  ctx.lineTo(headX + halfW * 0.38 + Math.sin(t * 1.5) * 3, -halfH * 0.35);
  ctx.moveTo(headX + halfW * 0.2, halfH * 0.15);
  ctx.lineTo(headX + halfW * 0.36 + Math.sin(t * 1.5 + 1) * 3, halfH * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headX - halfW * 0.15, -halfH * 0.1);
  ctx.lineTo(headX - halfW * 0.28, -halfH * 0.28);
  ctx.moveTo(headX - halfW * 0.15, halfH * 0.1);
  ctx.lineTo(headX - halfW * 0.26, halfH * 0.26);
  ctx.stroke();

  ctx.restore();
}

function drawVirusRoach(halfW, halfH, b) {
  const t = Date.now() / 100;
  const legWave = (b.isDigging ? 0.4 : 0.2) * Math.sin(t);
  const glitch = Math.sin(t * 3) * 0.5 + 0.5;

  if (b.isDigging) {
    const tt = Date.now() * 0.012;
    for (let i = 0; i < 8; i += 1) {
      const rise = (Math.sin(tt + i * 1.3) * 0.5 + 0.5) * 14 + 4;
      const side = (i % 2 === 0 ? 1 : -1) * (halfW * 0.4 + (i % 3) * 6 + Math.sin(tt + i) * 4);
      const size = 3 + (i % 3) * 1.5 + Math.sin(tt * 2 + i) * 1;
      ctx.fillStyle = `rgba(40, 180, 80, ${0.85 - rise / 24})`;
      ctx.beginPath();
      ctx.ellipse(side, halfH + 4 - rise, size, size * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(40, 160, 70, 0.4)";
    ctx.fillRect(-halfW - 4, halfH - 2, halfW * 2 + 8, 10);
  }

  function leg(side, along, phase) {
    const x = along * halfW * 0.8;
    const y = halfH * 0.35;
    const out = side * (halfW * 0.45 + 3);
    const kneeOut = side * (halfW * 0.65 + 4);
    const footOut = side * (halfW * 0.7 + 5);
    const wave = legWave * phase;
    ctx.strokeStyle = "#1a5c2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + out + wave * 15, y + 5);
    ctx.lineTo(x + kneeOut + wave * 22, y + halfH * 0.55);
    ctx.lineTo(x + footOut + wave * 24, y + halfH + 1);
    ctx.stroke();
  }

  ctx.strokeStyle = "#1a5c2a";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  leg(1, -0.55, 1);
  leg(1, 0.05, 0.7);
  leg(1, 0.65, 0.3);
  leg(-1, -0.55, 0.8);
  leg(-1, 0.05, 0.5);
  leg(-1, 0.65, 0.2);

  ctx.fillStyle = "#0d3d18";
  ctx.beginPath();
  ctx.ellipse(0.3 * halfW, 0, halfW * 0.3, halfH * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a4d20";
  ctx.beginPath();
  ctx.ellipse(-0.45 * halfW, 0, halfW * 0.35, halfH * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#166b28";
  ctx.beginPath();
  ctx.ellipse(-0.1 * halfW, 0, halfW * 0.38, halfH * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0d3d18";
  ctx.beginPath();
  ctx.ellipse(0, -halfH * 0.08, halfW * 0.88, halfH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a5c2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -halfH * 0.45);
  ctx.lineTo(0, halfH * 0.45);
  ctx.stroke();

  const headX = halfW * 0.68;
  ctx.fillStyle = "#0a4d20";
  ctx.beginPath();
  ctx.ellipse(headX, 0, halfW * 0.26, halfH * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0d3d18";
  ctx.fillRect(headX - 5, -5, 6, 6);
  ctx.fillRect(headX + 2, -4, 6, 6);
  ctx.fillStyle = `rgba(80, 255, 120, ${0.4 + glitch * 0.3})`;
  ctx.fillRect(headX - 3, -3, 3, 3);
  ctx.fillRect(headX + 4, -2, 3, 3);

  ctx.strokeStyle = "#1a5c2a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(headX + 5, -1);
  ctx.lineTo(headX + 12, -5);
  ctx.lineTo(headX + 16, -6);
  ctx.moveTo(headX + 5, 1);
  ctx.lineTo(headX + 10, 3);
  ctx.moveTo(headX - 5, -1);
  ctx.lineTo(headX - 12, -5);
  ctx.moveTo(headX - 5, 1);
  ctx.lineTo(headX - 10, 3);
  ctx.stroke();

  ctx.fillStyle = "#0d3d18";
  ctx.fillRect(headX + halfW * 0.2, -2, 6, 4);

  ctx.fillStyle = "rgba(60, 220, 100, 0.25)";
  ctx.fillRect(-halfW * 0.6, -halfH * 0.3, 4, 4);
  ctx.fillRect(0.2 * halfW, -halfH * 0.2, 3, 3);
  ctx.fillRect(-0.3 * halfW, halfH * 0.2, 3, 3);
}

function drawBeetle(offsetX, offsetY) {
  offsetX = offsetX ?? 0;
  offsetY = offsetY ?? 0;
  const b = level.beetle;
  if (!b) return;
  const cx = b.x + b.width / 2 + offsetX;
  const cy = b.y + b.height / 2 + offsetY;
  const facing = b.vx >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(cx, cy);
  if (facing < 0) ctx.scale(-1, 1);

  const halfW = b.width / 2;
  const halfH = b.height / 2;

  if (platformTheme === "orange") {
    drawVirusRoach(halfW, halfH, b);
    ctx.restore();
    return;
  }

  if (platformTheme === "backrooms") {
    drawEntity(halfW, halfH, b);
    ctx.restore();
    return;
  }

  if (platformTheme === "jungle") {
    const t = Date.now() / 160;
    const step = Math.sin(t + (b.x + b.y) * 0.03) * 4;

    // Digging leaf particles.
    if (b.isDigging) {
      const tt = Date.now() * 0.012;
      for (let i = 0; i < 8; i += 1) {
        const phase = (i / 8) * Math.PI * 2 + tt * 0.6;
        const rise = (Math.sin(tt + i * 1.4) * 0.5 + 0.5) * 14 + 4;
        const side = (i % 2 === 0 ? 1 : -1) * (halfW * 0.45 + (i % 3) * 6);
        const leafW = 4 + (i % 3);
        const leafH = 7 + (i % 2) * 2;
        const alpha = 0.8 - rise / 28;
        ctx.save();
        ctx.translate(side, halfH + 4 - rise);
        ctx.rotate(Math.sin(phase) * 0.4);
        ctx.fillStyle = `rgba(96, 158, 66, ${Math.max(0.1, alpha)})`;
        ctx.beginPath();
        ctx.moveTo(0, -leafH * 0.5);
        ctx.quadraticCurveTo(leafW * 0.6, 0, 0, leafH * 0.5);
        ctx.quadraticCurveTo(-leafW * 0.6, 0, 0, -leafH * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "rgba(22, 60, 30, 0.5)";
      ctx.fillRect(-halfW - 4, halfH - 3, b.width + 8, 8);
    }

    ctx.translate(0, step * 0.1);

    // Spider body
    const bodyR = halfW * 0.6;
    const abdomenR = halfW * 0.9;

    // Abdomen
    ctx.fillStyle = "#2b221a";
    ctx.beginPath();
    ctx.ellipse(-halfW * 0.1, 0, abdomenR, halfH * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thorax / head
    ctx.fillStyle = "#3a2b1f";
    ctx.beginPath();
    ctx.ellipse(halfW * 0.55, -halfH * 0.05, bodyR * 0.7, halfH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#eee3c4";
    ctx.beginPath();
    ctx.arc(halfW * 0.65, -halfH * 0.15, 3, 0, Math.PI * 2);
    ctx.arc(halfW * 0.5, -halfH * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#181008";
    ctx.beginPath();
    ctx.arc(halfW * 0.65, -halfH * 0.15, 1.4, 0, Math.PI * 2);
    ctx.arc(halfW * 0.5, -halfH * 0.1, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Legs (8), crawling on all sides
    ctx.strokeStyle = "#1f150e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const legBaseY = halfH * 0.2;
    const legOffsets = [-0.8, -0.4, 0, 0.4, 0.8, -0.2, 0.2, 0.6];
    for (let i = 0; i < 8; i += 1) {
      const side = i < 4 ? -1 : 1;
      const along = legOffsets[i];
      const phase = i * 0.7;
      const swing = Math.sin(t + phase) * 0.3;
      const baseX = along * halfW * 0.9;
      ctx.beginPath();
      ctx.moveTo(baseX, legBaseY);
      ctx.lineTo(baseX + side * (halfW * (0.4 + swing * 0.3)), legBaseY + halfH * 0.4);
      ctx.lineTo(baseX + side * (halfW * (0.6 + swing * 0.4)), legBaseY + halfH * 0.9);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  if (platformTheme === "blank") {
    const t = Date.now() / 180;
    const crawl = Math.sin(t + (b.x + b.y) * 0.02) * 3;

    // Digging smoke effect for the Creature.
    if (b.isDigging) {
      const tt = Date.now() * 0.012;
      for (let i = 0; i < 8; i += 1) {
        const phase = (i / 8) * Math.PI * 2 + tt * 0.7;
        const rise = (Math.sin(tt + i * 1.3) * 0.5 + 0.5) * 14 + 4;
        const side = (i % 2 === 0 ? 1 : -1) * (halfW * 0.4 + (i % 3) * 6 + Math.sin(tt + i) * 4);
        const size = 3 + (i % 3) * 1.5 + Math.sin(tt * 2 + i) * 1;
        const alpha = 0.7 - rise / 30;
        ctx.fillStyle = `rgba(210, 215, 220, ${Math.max(0.08, alpha)})`;
        ctx.beginPath();
        ctx.ellipse(side, halfH + 4 - rise, size, size * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(40, 40, 45, 0.4)";
      ctx.fillRect(-halfW - 4, halfH - 3, b.width + 8, 9);
    }

    ctx.translate(0, crawl * 0.15);

    // Green bug body, sized similarly to the beetle.
    const bodyH = halfH * 0.7;
    const bodyW = halfW * 1.05;

    // Abdomen
    ctx.fillStyle = "#1c6b2a";
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.2, 0, bodyW * 0.7, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thorax
    ctx.fillStyle = "#228b3e";
    ctx.beginPath();
    ctx.ellipse(bodyW * 0.2, 0, bodyW * 0.55, bodyH * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = "#14521f";
    const headX = bodyW * 0.65;
    ctx.beginPath();
    ctx.ellipse(headX, -bodyH * 0.1, bodyW * 0.35, bodyH * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (six), low and crawling
    ctx.strokeStyle = "#0d3716";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const legBaseY = bodyH * 0.8;
    const legSpread = [ -0.6, -0.2, 0.2, 0.6, -0.1, 0.45 ];
    for (let i = 0; i < 6; i += 1) {
      const side = i < 3 ? -1 : 1;
      const along = legSpread[i];
      const phase = i * 0.8;
      const wave = Math.sin(t + phase) * 0.15;
      const baseX = along * bodyW * 0.8;
      ctx.beginPath();
      ctx.moveTo(baseX, legBaseY - 2);
      ctx.lineTo(baseX + side * (8 + wave * 10), legBaseY + 4);
      ctx.lineTo(baseX + side * (12 + wave * 12), legBaseY + 7);
      ctx.stroke();
    }

    // Back markings
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.5, -bodyH * 0.1);
    ctx.quadraticCurveTo(0, -bodyH * 0.5, bodyW * 0.4, -bodyH * 0.15);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = "#e9ffe9";
    ctx.beginPath();
    ctx.arc(headX - 4, -bodyH * 0.2, 3, 0, Math.PI * 2);
    ctx.arc(headX + 4, -bodyH * 0.18, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1b0b";
    ctx.beginPath();
    ctx.arc(headX - 4, -bodyH * 0.2, 1.4, 0, Math.PI * 2);
    ctx.arc(headX + 4, -bodyH * 0.18, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  const t = Date.now() / 120;
  const legWave = (b.isDigging ? 0.4 : 0.15) * Math.sin(t);

  if (b.isDigging) {
    const tt = Date.now() * 0.012;
    for (let i = 0; i < 8; i += 1) {
      const phase = (i / 8) * Math.PI * 2 + tt * 0.7;
      const rise = (Math.sin(tt + i * 1.3) * 0.5 + 0.5) * 14 + 4;
      const side = (i % 2 === 0 ? 1 : -1) * (halfW * 0.4 + (i % 3) * 6 + Math.sin(tt + i) * 4);
      const size = 3 + (i % 3) * 1.5 + Math.sin(tt * 2 + i) * 1;
      ctx.fillStyle = `rgba(94, 69, 64, ${0.85 - rise / 24})`;
      ctx.beginPath();
      ctx.ellipse(side, halfH + 4 - rise, size, size * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(94, 69, 64, 0.4)";
    ctx.fillRect(-halfW - 4, halfH - 2, b.width + 8, 10);
  }

  function leg(side, along, phase) {
    const x = along * halfW * 0.85;
    const y = halfH * 0.4;
    const out = side * (halfW * 0.5 + 4);
    const kneeOut = side * (halfW * 0.7 + 6);
    const footOut = side * (halfW * 0.75 + 8);
    const wave = legWave * phase;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + out + wave * 20, y + 6);
    ctx.lineTo(x + kneeOut + wave * 28, y + halfH * 0.6);
    ctx.lineTo(x + footOut + wave * 30, y + halfH + 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#3d0a0a";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  leg(1, -0.6, 1);
  leg(1, 0, 0.7);
  leg(1, 0.6, 0.3);
  leg(-1, -0.6, 0.8);
  leg(-1, 0, 0.5);
  leg(-1, 0.6, 0.2);

  ctx.fillStyle = "#5c0000";
  ctx.beginPath();
  ctx.ellipse(0.35 * halfW, 0, halfW * 0.32, halfH * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a0808";
  ctx.beginPath();
  ctx.ellipse(-0.5 * halfW, 0, halfW * 0.38, halfH * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b1010";
  ctx.beginPath();
  ctx.ellipse(-halfW * 0.15, 0, halfW * 0.4, halfH * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3d0a0a";
  ctx.beginPath();
  ctx.ellipse(0, -halfH * 0.1, halfW * 0.92, halfH * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2d0000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -halfH * 0.5);
  ctx.lineTo(0, halfH * 0.5);
  ctx.stroke();

  const headX = halfW * 0.72;
  ctx.fillStyle = "#5c0000";
  ctx.beginPath();
  ctx.ellipse(headX, 0, halfW * 0.28, halfH * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2d0000";
  ctx.beginPath();
  ctx.arc(headX - 4, -4, 5, 0, Math.PI * 2);
  ctx.arc(headX + 5, -3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0505";
  ctx.beginPath();
  ctx.arc(headX - 4, -4, 2, 0, Math.PI * 2);
  ctx.arc(headX + 5, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8b0000";
  ctx.beginPath();
  ctx.arc(headX - 4, -4, 1.2, 0, Math.PI * 2);
  ctx.arc(headX + 5, -3, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2d0000";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(headX + 6, -2);
  ctx.lineTo(headX + 14, -6);
  ctx.lineTo(headX + 18, -8);
  ctx.moveTo(headX + 6, 2);
  ctx.lineTo(headX + 12, 4);
  ctx.lineTo(headX + 16, 6);
  ctx.moveTo(headX - 6, -2);
  ctx.lineTo(headX - 14, -6);
  ctx.lineTo(headX - 18, -8);
  ctx.moveTo(headX - 6, 2);
  ctx.lineTo(headX - 12, 4);
  ctx.lineTo(headX - 16, 6);
  ctx.stroke();

  ctx.fillStyle = "#2d0000";
  ctx.beginPath();
  ctx.moveTo(headX + halfW * 0.22, 0);
  ctx.lineTo(headX + halfW * 0.35, -3);
  ctx.lineTo(headX + halfW * 0.35, 3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + halfW * 0.22, 0);
  ctx.lineTo(headX + halfW * 0.32, -2);
  ctx.lineTo(headX + halfW * 0.32, 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCoins() {
  const size = 26;
  for (const coin of coins) {
    const done = multiplayerMode ? coin.byP1 && coin.byP2 : coin.byP1;
    if (done) {
      continue;
    }

    const bobOffset = Math.sin(coin.bob) * 5;
    const x = coin.x;
    const y = coin.y + bobOffset;

    if (platformTheme === "orange" && arrowImage.complete && arrowImage.naturalWidth) {
      ctx.save();
      ctx.translate(x, y);
      ctx.drawImage(arrowImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      drawMultiplayerCoinClaimRing(x, y, coin.radius, coin);
    } else if (platformTheme === "backrooms" && bottleImage.complete && bottleImage.naturalWidth) {
      const bottleW = 18;
      const bottleH = 28;
      ctx.save();
      ctx.translate(x, y);
      ctx.drawImage(bottleImage, -bottleW / 2, -bottleH / 2, bottleW, bottleH);
      ctx.restore();
      drawMultiplayerCoinClaimRing(x, y, coin.radius, coin);
    } else if (platformTheme === "jungle") {
      ctx.save();
      ctx.translate(x, y);
      // Less rotation/bending in Jungle bananas.
      ctx.rotate(-0.15);

      if (bananaImage.complete && bananaImage.naturalWidth) {
        // Draw using the image's original aspect ratio to avoid stretching.
        const aspect = bananaImage.naturalWidth / bananaImage.naturalHeight;
        const targetH = coin.radius * 2.35;
        const targetW = targetH * aspect;
        ctx.drawImage(bananaImage, -targetW / 2, -targetH / 2, targetW, targetH);
      } else {
        // Fallback vector banana if image not loaded yet.
        const bananaLen = coin.radius * 3.2;
        const bananaWidth = coin.radius * 0.6;

        ctx.fillStyle = "#ffd86b";
        ctx.strokeStyle = "#d4a83a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bananaLen * 0.5, 0);
        ctx.quadraticCurveTo(0, -bananaWidth * 1.3, bananaLen * 0.5, 0);
        ctx.quadraticCurveTo(0, bananaWidth * 1.3, -bananaLen * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#7b4b13";
        ctx.beginPath();
        ctx.ellipse(-bananaLen * 0.58, -bananaWidth * 0.1, bananaWidth * 0.2, bananaWidth * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      drawMultiplayerCoinClaimRing(x, y, coin.radius, coin);
    } else if (platformTheme === "blank") {
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(x, y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#37d14a";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#37d14a";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("P", x, y + 0.5);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      drawMultiplayerCoinClaimRing(x, y, coin.radius, coin);
    } else {
      ctx.fillStyle = "#ffd84d";
      ctx.beginPath();
      ctx.arc(x, y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c79800";
      ctx.lineWidth = 3;
      ctx.stroke();
      drawMultiplayerCoinClaimRing(x, y, coin.radius, coin);
    }
  }
}

/** blobIndex 0 = player 1 (arrows), 1 = player 2 (WASD) — different colors in multiplayer. */
function drawPlayerBlob(p, offsetX, offsetY, blobIndex) {
  offsetX = offsetX ?? 0;
  offsetY = offsetY ?? 0;
  const p2 = multiplayerMode && blobIndex === 1;
  const squashX = 1 + p.squish * 0.25;
  const squashY = 1 - p.squish * 0.2;
  const centerX = p.x + p.width / 2 + offsetX;
  const centerY = p.y + p.height / 2 + offsetY;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(squashX, squashY);

  const r = p.width / 2;
  const h = p.height / 2;
  const gradient = ctx.createRadialGradient(-r * 0.3, -h * 0.3, 0, 0, 0, r * 1.2);
  if (platformTheme === "orange") {
    if (p2) {
      gradient.addColorStop(0, "#c4a8e8");
      gradient.addColorStop(0.4, "#a892d4");
      gradient.addColorStop(0.85, "#8a78c0");
      gradient.addColorStop(1, "#6e5aa0");
    } else {
      gradient.addColorStop(0, "#e8a88a");
      gradient.addColorStop(0.4, "#dd9580");
      gradient.addColorStop(0.85, "#d58a75");
      gradient.addColorStop(1, "#b87262");
    }
  } else if (platformTheme === "backrooms") {
    if (p2) {
      gradient.addColorStop(0, "#b0b0c8");
      gradient.addColorStop(0.4, "#9898b0");
      gradient.addColorStop(0.85, "#808098");
      gradient.addColorStop(1, "#606078");
    } else {
      gradient.addColorStop(0, "#d0d0d0");
      gradient.addColorStop(0.4, "#b8b8b8");
      gradient.addColorStop(0.85, "#a8a8a8");
      gradient.addColorStop(1, "#888888");
    }
  } else if (platformTheme === "jungle") {
    if (p2) {
      gradient.addColorStop(0, "#6ab86a");
      gradient.addColorStop(0.4, "#4a9848");
      gradient.addColorStop(0.85, "#3a7838");
      gradient.addColorStop(1, "#285828");
    } else {
      gradient.addColorStop(0, "#c38b4a");
      gradient.addColorStop(0.4, "#a86f32");
      gradient.addColorStop(0.85, "#8c5726");
      gradient.addColorStop(1, "#5b3816");
    }
  } else if (platformTheme === "blank") {
    if (p2) {
      gradient.addColorStop(0, "#1a2a28");
      gradient.addColorStop(0.4, "#0e1816");
      gradient.addColorStop(0.85, "#081010");
      gradient.addColorStop(1, "#040808");
    } else {
      gradient.addColorStop(0, "#2b2b2f");
      gradient.addColorStop(0.4, "#18181b");
      gradient.addColorStop(0.85, "#0c0c0e");
      gradient.addColorStop(1, "#000000");
    }
  } else {
    if (p2) {
      gradient.addColorStop(0, "#7ac4f0");
      gradient.addColorStop(0.4, "#5aa8e0");
      gradient.addColorStop(0.85, "#4890d0");
      gradient.addColorStop(1, "#2d70b0");
    } else {
      gradient.addColorStop(0, "#7ae8a8");
      gradient.addColorStop(0.4, "#5dd992");
      gradient.addColorStop(0.85, "#53d58d");
      gradient.addColorStop(1, "#3db872");
    }
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, h, 0, 0, Math.PI * 2);
  ctx.fill();

  if (platformTheme !== "blank") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -h * 0.4, r * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -h * 0.5, r * 0.2, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const eyeY = p.crouching ? 2 : -3;
  const eyeR = p.crouching ? 2.5 : 3.5;
  const eyeColor =
    platformTheme === "orange"
      ? "#4a2020"
      : platformTheme === "backrooms"
        ? "#505050"
        : platformTheme === "blank"
          ? p2
            ? "#6ec4a8"
            : "#f2f2f2"
          : "#173927";
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(-7, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(7, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 4, 8, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

function drawPlayer(offsetX, offsetY) {
  drawPlayerBlob(player, offsetX, offsetY, 0);
}

function formatTime(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function drawHud() {
  const fontFamily =
    platformTheme === "orange"
      ? "'Exo 2', sans-serif"
      : platformTheme === "backrooms"
        ? "'Builder Marker', 'Permanent Marker', sans-serif"
        : platformTheme === "blank"
          ? "'Press Start 2P', system-ui, monospace"
          : platformTheme === "jungle"
            ? "'Wild Jungle SVG', system-ui, sans-serif"
          : "sans-serif";
  ctx.fillStyle = "rgba(16, 25, 47, 0.72)";
  const hudH = multiplayerMode ? (platformTheme === "blank" ? 100 : 118) : platformTheme === "blank" ? 86 : 86;
  const hudW = multiplayerMode ? 340 : 220;
  ctx.fillRect(18, 18, hudW, hudH);

  ctx.fillStyle = "#ffffff";
  const hudFontSize = platformTheme === "blank" ? 14 : 24;
  const hudSmall = platformTheme === "blank" ? 11 : 17;
  ctx.font = `bold ${hudFontSize}px ${fontFamily}`;
  ctx.textAlign = "start";
  const collected = getCollectedCoins();
  if (multiplayerMode) {
    const pairs = multiplayerPairsDoneCount();
    if (platformTheme === "orange") {
      const pct = Math.round((pairs / TOTAL_COINS) * 100);
      ctx.fillText(`OEE: ${pct}% (both grabbed)`, 32, 46);
    } else if (platformTheme === "blank") {
      ctx.fillText(`Done: ${pairs}/${TOTAL_COINS} both`, 32, 42);
    } else if (platformTheme === "backrooms") {
      ctx.fillText(`Both: ${pairs}/${TOTAL_COINS}`, 32, 46);
    } else if (platformTheme === "jungle") {
      ctx.fillText(`Both: ${pairs}/${TOTAL_COINS} bananas`, 32, 46);
    } else {
      ctx.fillText(`Both grabbed: ${pairs}/${TOTAL_COINS}`, 32, 46);
    }
    ctx.font = `bold ${hudSmall}px ${fontFamily}`;
    ctx.fillText(
      `P1 ↑ ${coinsCollectedP1}/10 · P2 WASD ${coinsCollectedP2}/10 · ring 1|2`,
      32,
      platformTheme === "blank" ? 62 : 72
    );
    ctx.font = `bold ${hudFontSize}px ${fontFamily}`;
    const l1 = player.alive ? MAX_DEATHS - deaths1 : 0;
    const l2 = player2.alive ? MAX_DEATHS - deaths2 : 0;
    const out1 = !player.alive ? " (out)" : "";
    const out2 = !player2.alive ? " (out)" : "";
    ctx.fillText(`P1 lives: ${l1}${out1}   P2 lives: ${l2}${out2}`, 32, platformTheme === "blank" ? 82 : 98);
  } else if (platformTheme === "orange") {
    const pct = Math.round((collected / TOTAL_COINS) * 100);
    ctx.fillText(`OEE: ${pct}%`, 32, 50);
  } else if (platformTheme === "blank") {
    ctx.fillText(`Points: ${collected}/${TOTAL_COINS}`, 32, 50);
  } else if (platformTheme === "backrooms") {
    ctx.fillText(`Bottles: ${collected}/${TOTAL_COINS}`, 32, 50);
  } else if (platformTheme === "jungle") {
    ctx.fillText(`Bananas: ${collected * 2}/${TOTAL_COINS * 2}`, 32, 50);
  } else {
    ctx.fillText(`Coins: ${collected}/${TOTAL_COINS}`, 32, 50);
  }
  if (!multiplayerMode) {
    ctx.fillText(`Lives: ${MAX_DEATHS - deaths}`, 32, platformTheme === "blank" ? 72 : 84);
  }

  ctx.fillStyle = "rgba(16, 25, 47, 0.72)";
  ctx.fillRect(WIDTH - 88, 18, 70, 40);
  const t = levelTimeRemaining;
  if (t > 60) {
    ctx.fillStyle = "#ffffff";
  } else {
    const ratio = Math.max(0, 1 - t / 60);
    const r = 255;
    const g = Math.round(255 * (1 - ratio));
    const b = Math.round(255 * (1 - ratio));
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  }
  ctx.font = `bold ${hudFontSize}px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.fillText(formatTime(levelTimeRemaining), WIDTH - 24, 48);
  ctx.textAlign = "start";
}

function drawOverlay() {
  if (gameState === "playing") {
    return;
  }

  const fontFamily =
    platformTheme === "orange"
      ? "'Exo 2', sans-serif"
      : platformTheme === "backrooms"
        ? "'Builder Marker', 'Permanent Marker', sans-serif"
        : platformTheme === "blank"
          ? "'Press Start 2P', system-ui, monospace"
          : platformTheme === "jungle"
            ? "'Wild Jungle SVG', system-ui, sans-serif"
          : "sans-serif";
  ctx.fillStyle = "rgba(10, 16, 30, 0.6)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const titleSize = platformTheme === "blank" ? 32 : 54;
  const bodySize = platformTheme === "blank" ? 14 : 24;
  ctx.font = `bold ${titleSize}px ${fontFamily}`;
  if (gameState === "paused") {
    ctx.fillText("Paused", WIDTH / 2, 210);
    ctx.font = `${bodySize}px ${fontFamily}`;
    ctx.fillText("Adjust settings below.", WIDTH / 2, 260);
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    ctx.fillText(
      isMobile ? "Tap ▶ to resume." : "Press the Space key to Resume.",
      WIDTH / 2,
      310
    );
    ctx.textAlign = "start";
    return;
  }

  if (gameState === "won") {
    const winTitle = multiplayerMode
      ? multiplayerAllCoinsClaimedByBoth()
        ? `${DISPLAY_NAME_P1} & ${DISPLAY_NAME_P2} win!`
        : coinsCollectedP1 >= TOTAL_COINS
          ? `${DISPLAY_NAME_P1} wins!`
          : `${DISPLAY_NAME_P2} wins!`
      : `${DISPLAY_NAME_SOLO} wins!`;
    ctx.fillText(winTitle, WIDTH / 2, 210);
  } else {
    ctx.fillText("Game Over", WIDTH / 2, 210);
  }

  ctx.font = `${bodySize}px ${fontFamily}`;
  if (gameState === "won") {
    let whoGrabbed = DISPLAY_NAME_SOLO;
    if (multiplayerMode) {
      if (multiplayerAllCoinsClaimedByBoth()) {
        whoGrabbed = `${DISPLAY_NAME_P1} & ${DISPLAY_NAME_P2}`;
      } else if (coinsCollectedP1 >= TOTAL_COINS) {
        whoGrabbed = DISPLAY_NAME_P1;
      } else {
        whoGrabbed = DISPLAY_NAME_P2;
      }
    }
    let winMsg =
      platformTheme === "orange"
        ? `${whoGrabbed} grabbed all GS Arrows.`
        : platformTheme === "backrooms"
          ? `${whoGrabbed} grabbed all Bottles.`
          : platformTheme === "blank"
            ? `${whoGrabbed} grabbed all Points.`
            : platformTheme === "jungle"
              ? `${whoGrabbed} grabbed all Bananas.`
              : `${whoGrabbed} grabbed all Coins.`;
    if (multiplayerMode) {
      if (multiplayerAllCoinsClaimedByBoth()) {
        winMsg += ` Perfect — every pickup by both. (${DISPLAY_NAME_P1}: ${coinsCollectedP1} · ${DISPLAY_NAME_P2}: ${coinsCollectedP2})`;
      } else if (coinsCollectedP1 >= TOTAL_COINS) {
        winMsg += ` ${DISPLAY_NAME_P1} cleared all ${TOTAL_COINS} pickups! (${DISPLAY_NAME_P2}: ${coinsCollectedP2})`;
      } else {
        winMsg += ` ${DISPLAY_NAME_P2} cleared all ${TOTAL_COINS} pickups! (${DISPLAY_NAME_P1}: ${coinsCollectedP1})`;
      }
    }
    ctx.fillText(winMsg, WIDTH / 2, 260);
  } else {
    let loseMsg = multiplayerMode
      ? `${DISPLAY_NAME_P1} & ${DISPLAY_NAME_P2} ran out of time.`
      : `${DISPLAY_NAME_SOLO} ran out of time.`;
    if (lostReason === "deaths") {
      if (multiplayerMode) {
        const both = `${DISPLAY_NAME_P1} & ${DISPLAY_NAME_P2}`;
        loseMsg =
          lastDeathCause === "spikes"
            ? `${both} are out of lives. Last hit: spikes.`
            : lastDeathCause === "beetle"
              ? `${both} are out of lives. Last hit: the chaser.`
              : lastDeathCause === "fall"
                ? `${both} are out of lives. Last hit: fell off the map.`
                : `${both} are out of lives before finishing.`;
      } else if (platformTheme === "orange") {
        loseMsg =
          lastDeathCause === "spikes"
            ? `${DISPLAY_NAME_SOLO} died by the saws.`
            : lastDeathCause === "beetle"
              ? `The Virus got ${DISPLAY_NAME_SOLO}.`
              : `${DISPLAY_NAME_SOLO} died 3 times and lost the run.`;
      } else if (platformTheme === "backrooms") {
        loseMsg =
          lastDeathCause === "spikes"
            ? `${DISPLAY_NAME_SOLO} died by the traps.`
            : lastDeathCause === "beetle"
              ? `The Entity got ${DISPLAY_NAME_SOLO}.`
              : `${DISPLAY_NAME_SOLO} died 3 times and lost the run.`;
      } else if (platformTheme === "blank") {
        loseMsg =
          lastDeathCause === "spikes"
            ? `${DISPLAY_NAME_SOLO} died by the objects.`
            : lastDeathCause === "beetle"
              ? `The Creature got ${DISPLAY_NAME_SOLO}.`
              : `${DISPLAY_NAME_SOLO} died 3 times and lost the run.`;
      } else if (platformTheme === "jungle") {
        loseMsg =
          lastDeathCause === "spikes"
            ? `${DISPLAY_NAME_SOLO} died by the snakes.`
            : lastDeathCause === "beetle"
              ? `The Spider got ${DISPLAY_NAME_SOLO}.`
              : `${DISPLAY_NAME_SOLO} died 3 times and lost the run.`;
      } else {
        loseMsg =
          lastDeathCause === "spikes"
            ? `${DISPLAY_NAME_SOLO} died by the spikes.`
            : lastDeathCause === "beetle"
              ? `The Beetle got ${DISPLAY_NAME_SOLO}.`
              : `${DISPLAY_NAME_SOLO} died 3 times and lost the run.`;
      }
    }
    ctx.fillText(loseMsg, WIDTH / 2, 260);
  }

  ctx.fillText("Press R to restart.", WIDTH / 2, 310);
  ctx.textAlign = "start";
}

function update(dt) {
  if (gameState === "paused") {
    return;
  }
  cloudOffset += dt * CLOUD_SPEED;
  updatePlayer(dt);

  if (gameState === "playing") {
    levelTimeRemaining -= dt;
    if (levelTimeRemaining <= 0) {
      levelTimeRemaining = 0;
      lostReason = "time";
      playLoseSound();
      gameState = "lost";
      syncGameUiState();
    }
    if (!bellAt16Played && levelTimeRemaining <= 16) {
      bellAt16Played = true;
      playBellSound();
    }
    updateCoins(dt);
    updateBeetle(dt);
    updateSpikes();
  }
}

function render() {
  drawBackground();
  drawPlatforms();
  drawCoins();
  drawSpikes();
  if (level.beetle) {
    if (level.beetle.x + level.beetle.width > WIDTH) drawBeetle(-WIDTH, 0);
    if (level.beetle.x < 0) drawBeetle(WIDTH, 0);
  }
  drawBeetle();
  if (multiplayerMode) {
    if (player.alive) {
      if (player.x + player.width > WIDTH) drawPlayerBlob(player, -WIDTH, 0, 0);
      if (player.x < 0) drawPlayerBlob(player, WIDTH, 0, 0);
      drawPlayerBlob(player, 0, 0, 0);
    }
    if (player2.alive) {
      if (player2.x + player2.width > WIDTH) drawPlayerBlob(player2, -WIDTH, 0, 1);
      if (player2.x < 0) drawPlayerBlob(player2, WIDTH, 0, 1);
      drawPlayerBlob(player2, 0, 0, 1);
    }
  } else {
    if (player.x + player.width > WIDTH) {
      drawPlayer(-WIDTH, 0);
    }
    if (player.x < 0) {
      drawPlayer(WIDTH, 0);
    }
    drawPlayer();
  }
  drawHud();
  drawOverlay();
}

function gameLoop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }

  const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30);
  lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function setKeyState(code, pressed) {
  if (multiplayerMode) {
    if (code === "ArrowLeft") inputP1.left = pressed;
    if (code === "ArrowRight") inputP1.right = pressed;
    if (code === "ArrowUp") {
      if (pressed && !inputP1.jump) inputP1.jumpPressed = true;
      inputP1.jump = pressed;
    }
    if (code === "ArrowDown") inputP1.crouch = pressed;

    if (code === "KeyA") inputP2.left = pressed;
    if (code === "KeyD") inputP2.right = pressed;
    if (code === "KeyW") {
      if (pressed && !inputP2.jump) inputP2.jumpPressed = true;
      inputP2.jump = pressed;
    }
    if (code === "KeyS") inputP2.crouch = pressed;
    return;
  }

  if (code === "ArrowLeft" || code === "KeyA") {
    input.left = pressed;
  }

  if (code === "ArrowRight" || code === "KeyD") {
    input.right = pressed;
  }

  if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
    if (pressed && !input.jump) {
      input.jumpPressed = true;
    }

    input.jump = pressed;
  }

  if (code === "ArrowDown" || code === "KeyS") {
    input.crouch = pressed;
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" || event.code === "KeyP" || event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (event.code === "KeyR") {
    resetGame();
    return;
  }

  const soloKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyS"];
  const mpKeys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD"
  ];
  if (multiplayerMode ? mpKeys.includes(event.code) : soloKeys.includes(event.code)) {
    event.preventDefault();
  }

  if (gameState !== "paused") {
    setKeyState(event.code, true);
  }
});

window.addEventListener("keyup", (event) => {
  if (gameState !== "paused") {
    setKeyState(event.code, false);
  }
});

(function initMobileControls() {
  const canvasEl = document.getElementById("game");
  if (canvasEl) {
    canvasEl.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    canvasEl.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  }

  function setPointerState(left, right, jump, crouch, restart) {
    if (multiplayerMode) {
      if (left !== undefined) inputP1.left = left;
      if (right !== undefined) inputP1.right = right;
      if (jump !== undefined) {
        if (jump && !inputP1.jump) inputP1.jumpPressed = true;
        inputP1.jump = !!jump;
      }
      if (crouch !== undefined) inputP1.crouch = crouch;
    } else {
      if (left !== undefined) input.left = left;
      if (right !== undefined) input.right = right;
      if (jump !== undefined) {
        if (jump && !input.jump) input.jumpPressed = true;
        input.jump = !!jump;
      }
      if (crouch !== undefined) input.crouch = crouch;
    }
    if (restart) resetGame();
  }

  function handlePointerDown(e) {
    if (e.pointerType === "touch") e.preventDefault();
    const t = e.target;
    if (t.classList.contains("mobile-btn-left")) setPointerState(true);
    else if (t.classList.contains("mobile-btn-right")) setPointerState(undefined, true);
    else if (t.classList.contains("mobile-btn-jump")) setPointerState(undefined, undefined, true);
    else if (t.classList.contains("mobile-btn-crouch")) setPointerState(undefined, undefined, undefined, true);
    else if (t.classList.contains("mobile-btn-pause")) togglePause();
    else if (t.classList.contains("mobile-btn-restart")) setPointerState(undefined, undefined, undefined, undefined, true);
  }

  function handlePointerUp(e) {
    const t = e.target;
    if (t.classList.contains("mobile-btn-left")) setPointerState(false);
    else if (t.classList.contains("mobile-btn-right")) setPointerState(undefined, false);
    else if (t.classList.contains("mobile-btn-jump")) setPointerState(undefined, undefined, false);
    else if (t.classList.contains("mobile-btn-crouch")) setPointerState(undefined, undefined, undefined, false);
  }

  document.querySelectorAll(".mobile-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", handlePointerDown, { passive: false });
    btn.addEventListener("pointerup", handlePointerUp);
    btn.addEventListener("pointerleave", handlePointerUp);
    btn.addEventListener("pointercancel", handlePointerUp);
  });

  pauseButtonEl = document.querySelector(".mobile-btn-pause");
  // Sync initial UI state.
  syncGameUiState();
})();

(function initMultiplayerToggle() {
  try {
    if (localStorage.getItem(MP_STORAGE_KEY) === "1") multiplayerMode = true;
  } catch (_) {}
  const el = document.getElementById("multiplayer-mode");
  if (el) {
    el.checked = multiplayerMode;
    el.addEventListener("change", () => {
      multiplayerMode = el.checked;
      try {
        localStorage.setItem(MP_STORAGE_KEY, multiplayerMode ? "1" : "0");
      } catch (_) {}
      resetGame();
    });
  }
})();

resetGame();

(function initVolumeSettings() {
  try {
    const m = localStorage.getItem(VOLUME_STORAGE_KEY_MUSIC);
    if (m != null) {
      const v = parseFloat(m);
      if (!Number.isNaN(v)) musicVolume = Math.max(0, Math.min(1, v));
    }
    const s = localStorage.getItem(VOLUME_STORAGE_KEY_SFX);
    if (s != null) {
      const v = parseFloat(s);
      if (!Number.isNaN(v)) sfxVolume = Math.max(0, Math.min(1, v));
    }
  } catch (_) {}
  const musicSlider = document.getElementById("music-volume");
  const sfxSlider = document.getElementById("sfx-volume");
  if (musicSlider) {
    musicSlider.value = String(Math.round(musicVolume * 100));
    musicSlider.addEventListener("input", function () {
      setMusicVolume(parseInt(this.value, 10) / 100);
    });
  }
  if (sfxSlider) {
    sfxSlider.value = String(Math.round(sfxVolume * 100));
    sfxSlider.addEventListener("input", function () {
      setSfxVolume(parseInt(this.value, 10) / 100);
    });
  }
})();

(function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "classic" || saved === "orange" || saved === "backrooms" || saved === "blank" || saved === "jungle") platformTheme = saved;
  } catch (_) {}
  function setTheme(theme) {
    platformTheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {}
    document.body.classList.toggle("theme-orange", theme === "orange");
    document.body.classList.toggle("theme-backrooms", theme === "backrooms");
    document.body.classList.toggle("theme-blank", theme === "blank");
    document.body.classList.toggle("theme-jungle", theme === "jungle");
  // Restart background music so the track matches the theme.
  try {
    startBackgroundMusic();
  } catch (_) {}
    const classicBtn = document.getElementById("theme-classic");
    const orangeBtn = document.getElementById("theme-orange");
    const backroomsBtn = document.getElementById("theme-backrooms");
    const blankBtn = document.getElementById("theme-blank");
    const jungleBtn = document.getElementById("theme-jungle");
    if (classicBtn) classicBtn.setAttribute("aria-pressed", theme === "classic" ? "true" : "false");
    if (orangeBtn) orangeBtn.setAttribute("aria-pressed", theme === "orange" ? "true" : "false");
    if (backroomsBtn) backroomsBtn.setAttribute("aria-pressed", theme === "backrooms" ? "true" : "false");
    if (blankBtn) blankBtn.setAttribute("aria-pressed", theme === "blank" ? "true" : "false");
    if (jungleBtn) jungleBtn.setAttribute("aria-pressed", theme === "jungle" ? "true" : "false");
  }
  const classicBtn = document.getElementById("theme-classic");
  const orangeBtn = document.getElementById("theme-orange");
  const backroomsBtn = document.getElementById("theme-backrooms");
  const blankBtn = document.getElementById("theme-blank");
  const jungleBtn = document.getElementById("theme-jungle");
  document.body.classList.toggle("theme-orange", platformTheme === "orange");
  document.body.classList.toggle("theme-backrooms", platformTheme === "backrooms");
  document.body.classList.toggle("theme-blank", platformTheme === "blank");
  document.body.classList.toggle("theme-jungle", platformTheme === "jungle");
  if (classicBtn) {
    classicBtn.setAttribute("aria-pressed", platformTheme === "classic" ? "true" : "false");
    classicBtn.addEventListener("click", () => setTheme("classic"));
  }
  if (orangeBtn) {
    orangeBtn.setAttribute("aria-pressed", platformTheme === "orange" ? "true" : "false");
    orangeBtn.addEventListener("click", () => setTheme("orange"));
  }
  if (backroomsBtn) {
    backroomsBtn.setAttribute("aria-pressed", platformTheme === "backrooms" ? "true" : "false");
    backroomsBtn.addEventListener("click", () => setTheme("backrooms"));
  }
  if (blankBtn) {
    blankBtn.setAttribute("aria-pressed", platformTheme === "blank" ? "true" : "false");
    blankBtn.addEventListener("click", () => setTheme("blank"));
  }
  if (jungleBtn) {
    jungleBtn.setAttribute("aria-pressed", platformTheme === "jungle" ? "true" : "false");
    jungleBtn.addEventListener("click", () => setTheme("jungle"));
  }
})();

startBackgroundMusic();
requestAnimationFrame(gameLoop);
