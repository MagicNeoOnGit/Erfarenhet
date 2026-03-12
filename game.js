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

let level;
let player;
let coins;
let deaths;
let collectedCoins;
let gameState;
let levelTimeRemaining;
let lostReason;
let bellAt16Played = false;
let lastTime = 0;
let audioContext;
let musicGainNode;
let musicLoopTimeoutId;
let sfxGainNode;

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

let platformTheme = "normal";

const arrowImage = new Image();
arrowImage.src = "arrow.png";

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

function getMusicGain() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!musicGainNode) {
    musicGainNode = ctx.createGain();
    musicGainNode.gain.value = 0.18 * musicVolume;
    musicGainNode.connect(ctx.destination);
  }
  return musicGainNode;
}

function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, value));
  if (musicGainNode) musicGainNode.gain.value = 0.18 * musicVolume;
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
  const ctx = getAudioContext();
  const gain = getMusicGain();
  if (!ctx || !gain) return;

  const bassRoots = [65.4, 98, 65.4, 87.3, 65.4, 98, 65.4, 65.4];
  const melodyNotes = [
    329.6, 392, 329.6,
    261.6, 293.7, 329.6,
    392, 329.6, 261.6,
    329.6, 392, 392,
    261.6, 329.6, 392,
    329.6, 261.6, 261.6,
    392, 392, 329.6,
    261.6, 261.6, 261.6
  ];

  for (let bar = 0; bar < MUSIC_LOOP_BARS; bar += 1) {
    const t0 = startTime + bar * BAR;
    const root = bassRoots[bar];
    const oscBass1 = ctx.createOscillator();
    const oscBass2 = ctx.createOscillator();
    const gainBass = ctx.createGain();
    oscBass1.type = "square";
    oscBass2.type = "square";
    oscBass1.frequency.setValueAtTime(root, t0);
    oscBass2.frequency.setValueAtTime(root * 1.5, t0);
    gainBass.gain.setValueAtTime(0, t0);
    gainBass.gain.linearRampToValueAtTime(0.2, t0 + 0.02);
    gainBass.gain.linearRampToValueAtTime(0, t0 + BEAT * 2);
    oscBass1.connect(gainBass);
    oscBass2.connect(gainBass);
    gainBass.connect(gain);
    oscBass1.start(t0);
    oscBass2.start(t0);
    oscBass1.stop(t0 + BEAT * 2);
    oscBass2.stop(t0 + BEAT * 2);

    const t1 = t0 + BEAT;
    const gainBass2 = ctx.createGain();
    gainBass2.gain.setValueAtTime(0, t1);
    gainBass2.gain.linearRampToValueAtTime(0.2, t1 + 0.02);
    gainBass2.gain.linearRampToValueAtTime(0, t1 + BEAT * 2);
    const ob1 = ctx.createOscillator();
    const ob2 = ctx.createOscillator();
    ob1.type = "square";
    ob2.type = "square";
    ob1.frequency.setValueAtTime(root, t1);
    ob2.frequency.setValueAtTime(root * 1.5, t1);
    ob1.connect(gainBass2);
    ob2.connect(gainBass2);
    gainBass2.connect(gain);
    ob1.start(t1);
    ob2.start(t1);
    ob1.stop(t1 + BEAT * 2);
    ob2.stop(t1 + BEAT * 2);
  }

  const noteLen = BEAT * 0.95;
  melodyNotes.forEach((freq, i) => {
    const bar = Math.floor(i / 3);
    const beatInBar = i % 3;
    const t = startTime + bar * BAR + beatInBar * BEAT;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.linearRampToValueAtTime(0, t + noteLen);
    osc.connect(g);
    g.connect(gain);
    osc.start(t);
    osc.stop(t + noteLen);
  });
}

function startBackgroundMusic() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  let nextStart = ctx.currentTime;
  scheduleBackgroundMusicLoop(nextStart);
  function scheduleNext() {
    nextStart += MUSIC_LOOP_DURATION;
    scheduleBackgroundMusicLoop(nextStart);
    musicLoopTimeoutId = setTimeout(scheduleNext, MUSIC_LOOP_DURATION * 1000);
  }
  musicLoopTimeoutId = setTimeout(scheduleNext, MUSIC_LOOP_DURATION * 1000);
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
    collected: false,
    bob: Math.random() * Math.PI * 2
  }));
}

function resetGame() {
  collectedCoins = 0;
  deaths = 0;
  levelTimeRemaining = LEVEL_TIME_SECONDS;
  bellAt16Played = false;
  gameState = "playing";
  player = {
    x: 0,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    vx: 0,
    vy: 0,
    onGround: false,
    squish: 0,
    crouching: false
  };
  respawnPlayer();
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

function killPlayer() {
  if (gameState !== "playing") {
    return;
  }

  deaths += 1;

  if (deaths >= MAX_DEATHS) {
    lostReason = "deaths";
    playLoseSound();
    gameState = "lost";
    return;
  }

  respawnPlayer();
}

function clampPlayerToWorld() {
  if (player.y > HEIGHT + 100) {
    killPlayer();
  }
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

function getPlayerRects() {
  const rects = [{ x: player.x, y: player.y, width: player.width, height: player.height }];
  if (player.x < 0) rects.push({ x: player.x + WIDTH, y: player.y, width: player.width, height: player.height });
  if (player.x + player.width > WIDTH) rects.push({ x: player.x - WIDTH, y: player.y, width: player.width, height: player.height });
  return rects;
}

function updatePlayer(dt) {
  if (gameState !== "playing") {
    player.vx = 0;
    return;
  }

  const wasOnGround = player.onGround;
  const bottom = player.y + player.height;

  if (input.crouch && !player.crouching) {
    player.crouching = true;
    player.height = CROUCH_HEIGHT;
    if (player.onGround) player.y = bottom - CROUCH_HEIGHT;
  } else if (!input.crouch && player.crouching) {
    if (player.onGround) {
      const standY = bottom - PLAYER_SIZE;
      const standingBox = { x: player.x, y: standY, width: player.width, height: PLAYER_SIZE };
      const ceiling = level.platforms.some(
        (p) => p.y < standY && rectsOverlap(standingBox, p)
      );
      if (!ceiling) {
        player.crouching = false;
        player.height = PLAYER_SIZE;
        player.y = standY;
      }
    } else {
      player.crouching = false;
      player.height = PLAYER_SIZE;
    }
  }

  player.vx = 0;
  const moveSpeed = player.crouching ? MOVE_SPEED * 0.5 : MOVE_SPEED;
  if (input.left) player.vx -= moveSpeed;
  if (input.right) player.vx += moveSpeed;

  if (input.jumpPressed && player.onGround && !player.crouching) {
    player.vy = -JUMP_SPEED;
    player.onGround = false;
    player.squish = 1;
    playJumpSound();
  }

  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;

  const horizontalBounds = { x: player.x, y: player.y, width: player.width, height: player.height };
  for (const platform of level.platforms) {
    if (!rectsOverlap(horizontalBounds, platform)) {
      continue;
    }

    if (player.vx > 0) {
      const newX = platform.x - player.width;
      if (player.x > WIDTH && newX <= WIDTH) continue;
      player.x = newX;
    } else if (player.vx < 0) {
      const newX = platform.x + platform.width;
      if (player.x + player.width < 0 && newX >= -player.width) continue;
      player.x = newX;
    }

    horizontalBounds.x = player.x;
  }

  player.y += player.vy * dt;
  player.onGround = false;

  const verticalBounds = { x: player.x, y: player.y, width: player.width, height: player.height };
  for (const platform of level.platforms) {
    if (!rectsOverlap(verticalBounds, platform)) {
      continue;
    }

    if (player.vy > 0) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.onGround = true;
    } else if (player.vy < 0) {
      player.y = platform.y + platform.height;
      player.vy = 0;
    }

    verticalBounds.y = player.y;
  }

  const ground = level.platforms.find((p) => p.type === "ground");
  if (ground && player.y + player.height > ground.y) {
    player.y = ground.y - player.height;
    player.vy = 0;
    player.onGround = true;
  }

  clampPlayerToWorld();

  if (player.x + player.width <= -2) {
    player.x += WIDTH;
  } else if (player.x >= WIDTH + 2) {
    player.x -= WIDTH;
  }

  if (!wasOnGround && player.onGround && player.vy === 0) {
    playLandSound();
  }

  player.squish = Math.max(0, player.squish - dt * 4);
  input.jumpPressed = false;
}

function updateCoins(dt) {
  for (const coin of coins) {
    coin.bob += dt * 4;

    if (coin.collected) continue;
    const rects = getPlayerRects();
    if (rects.some((r) => circleIntersectsRect(coin, r.x, r.y, r.width, r.height))) {
      coin.collected = true;
      collectedCoins += 1;
      playCoinSound();
    }
  }

  if (collectedCoins === TOTAL_COINS) {
    playWinSound();
    gameState = "won";
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
  const onGroundLevel = player.onGround && (player.y + player.height) >= GROUND_Y - 2;
  if (gameState === "playing" && onGroundLevel) {
    const beetleCx = b.x + b.width / 2;
    const playerCx = player.x + player.width / 2;
    const dx = playerCx - beetleCx;
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
  const rects = getPlayerRects();
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
        playSpikeDeathSound();
        killPlayer();
        return;
      }
    }

    for (const beetleRect of getBeetleRects()) {
      if (rectsOverlap(hurtbox, beetleRect)) {
        playSpikeDeathSound();
        killPlayer();
        return;
      }
    }
  }
}

function drawBackground() {
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

  ctx.fillStyle = "#71bb5e";
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
    if (coin.collected) {
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
    } else {
      ctx.fillStyle = "#ffd84d";
      ctx.beginPath();
      ctx.arc(x, y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c79800";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawPlayer(offsetX, offsetY) {
  offsetX = offsetX ?? 0;
  offsetY = offsetY ?? 0;
  const squashX = 1 + player.squish * 0.25;
  const squashY = 1 - player.squish * 0.2;
  const centerX = player.x + player.width / 2 + offsetX;
  const centerY = player.y + player.height / 2 + offsetY;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(squashX, squashY);

  const r = player.width / 2;
  const h = player.height / 2;
  const gradient = ctx.createRadialGradient(-r * 0.3, -h * 0.3, 0, 0, 0, r * 1.2);
  if (platformTheme === "orange") {
    gradient.addColorStop(0, "#e8a88a");
    gradient.addColorStop(0.4, "#dd9580");
    gradient.addColorStop(0.85, "#d58a75");
    gradient.addColorStop(1, "#b87262");
  } else {
    gradient.addColorStop(0, "#7ae8a8");
    gradient.addColorStop(0.4, "#5dd992");
    gradient.addColorStop(0.85, "#53d58d");
    gradient.addColorStop(1, "#3db872");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, h, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -h * 0.4, r * 0.4, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, -h * 0.5, r * 0.2, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = player.crouching ? 2 : -3;
  const eyeR = player.crouching ? 2.5 : 3.5;
  ctx.fillStyle = platformTheme === "orange" ? "#4a2020" : "#173927";
  ctx.beginPath();
  ctx.arc(-7, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(7, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = platformTheme === "orange" ? "#4a2020" : "#173927";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 4, 8, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

function formatTime(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function drawHud() {
  const fontFamily = platformTheme === "orange" ? "'Exo 2', sans-serif" : "Arial";
  ctx.fillStyle = "rgba(16, 25, 47, 0.72)";
  ctx.fillRect(18, 18, 220, 86);

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 24px ${fontFamily}`;
  ctx.textAlign = "start";
  const collected = getCollectedCoins();
  if (platformTheme === "orange") {
    const pct = Math.round((collected / TOTAL_COINS) * 100);
    ctx.fillText(`OEE: ${pct}%`, 32, 50);
  } else {
    ctx.fillText(`Coins: ${collected}/${TOTAL_COINS}`, 32, 50);
  }
  ctx.fillText(`Deaths: ${deaths}/${MAX_DEATHS}`, 32, 84);

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
  ctx.font = `bold 24px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.fillText(formatTime(levelTimeRemaining), WIDTH - 24, 48);
  ctx.textAlign = "start";
}

function drawOverlay() {
  if (gameState === "playing") {
    return;
  }

  const fontFamily = platformTheme === "orange" ? "'Exo 2', sans-serif" : "Arial";
  ctx.fillStyle = "rgba(10, 16, 30, 0.6)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `bold 54px ${fontFamily}`;
  ctx.fillText(gameState === "won" ? "You Win!" : "Game Over", WIDTH / 2, 210);

  ctx.font = `24px ${fontFamily}`;
  if (gameState === "won") {
    const collectibleName = platformTheme === "orange" ? "OEE" : "coins";
    ctx.fillText(`The blob grabbed all 10 ${collectibleName}.`, WIDTH / 2, 260);
  } else {
    ctx.fillText(
      lostReason === "time" ? "Time ran out." : "The blob died 3 times and lost the run.",
      WIDTH / 2,
      260
    );
  }

  ctx.fillText("Press R to restart.", WIDTH / 2, 310);
  ctx.textAlign = "start";
}

function update(dt) {
  cloudOffset += dt * CLOUD_SPEED;
  updatePlayer(dt);

  if (gameState === "playing") {
    levelTimeRemaining -= dt;
    if (levelTimeRemaining <= 0) {
      levelTimeRemaining = 0;
      lostReason = "time";
      playLoseSound();
      gameState = "lost";
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
  if (player.x + player.width > WIDTH) {
    drawPlayer(-WIDTH, 0);
  }
  if (player.x < 0) {
    drawPlayer(WIDTH, 0);
  }
  drawPlayer();
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
  if (event.code === "KeyR") {
    resetGame();
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyS"].includes(event.code)) {
    event.preventDefault();
  }

  setKeyState(event.code, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);
});

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
    if (saved === "normal" || saved === "orange") platformTheme = saved;
  } catch (_) {}
  function setTheme(theme) {
    platformTheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {}
    document.body.classList.toggle("theme-orange", theme === "orange");
    const normalBtn = document.getElementById("theme-normal");
    const orangeBtn = document.getElementById("theme-orange");
    if (normalBtn) normalBtn.setAttribute("aria-pressed", theme === "normal" ? "true" : "false");
    if (orangeBtn) orangeBtn.setAttribute("aria-pressed", theme === "orange" ? "true" : "false");
  }
  const normalBtn = document.getElementById("theme-normal");
  const orangeBtn = document.getElementById("theme-orange");
  document.body.classList.toggle("theme-orange", platformTheme === "orange");
  if (normalBtn) {
    normalBtn.setAttribute("aria-pressed", platformTheme === "normal" ? "true" : "false");
    normalBtn.addEventListener("click", () => setTheme("normal"));
  }
  if (orangeBtn) {
    orangeBtn.setAttribute("aria-pressed", platformTheme === "orange" ? "true" : "false");
    orangeBtn.addEventListener("click", () => setTheme("orange"));
  }
})();

startBackgroundMusic();
requestAnimationFrame(gameLoop);
