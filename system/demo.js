const ROOM_MARGIN = 64;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 280;
const GRID_STEP_DURATION = 0.2;
const CAMERA_LERP = 0.12;
const DEAD_ZONE = { x: 0.22, y: 0.18 };
const GRID_CELL_SIZE = 72;
const RANGE_LIMIT = 4;
const FREE_NAV_CELL = 36;
const DEFAULT_TURN_BUDGET = RANGE_LIMIT;
const FREE_SPRINT_DEFAULTS = Object.freeze({
  baseSpeed: PLAYER_SPEED,
  mass: 1,
  acceleration: 860,
  deceleration: 940,
  speedTiers: [1, 1.14, 1.42, 1.75],
  staminaMax: 100,
  staminaRegenPerSecond: 10,
  staminaDrainPerSecond: [0, 9, 14, 21],
});
const TERRAIN_TYPES = Object.freeze({
  GARDEN: "garden",
  SAND: "sand",
});
const TEXT_DIRECTION = Object.freeze({
  VERTICAL_RL: "vertical-rl",
  HORIZONTAL_LTR: "horizontal-ltr",
});
const OPENING_SHOWCASE_ID = "opening-showcase";

function createClickObstacles() {
  return [
    { type: "rect", x: 784, y: 352, width: 432, height: 72 },
    { type: "rect", x: 784, y: 352, width: 72, height: 360 },
    { type: "rect", x: 1144, y: 352, width: 72, height: 360 },
    { type: "rect", x: 784, y: 640, width: 144, height: 72 },
    { type: "rect", x: 1072, y: 640, width: 144, height: 72 },
    { type: "rect", x: 928, y: 496, width: 144, height: 72 },
    { type: "circle", x: 1000, y: 856, radius: 54 },
  ];
}

function createRoom(id, name, world, options = {}) {
  return {
    id,
    name,
    world,
    movement: options.movement ?? "free",
    clickMove: options.clickMove ?? false,
    keyboardGraphMove: options.keyboardGraphMove ?? false,
    rangeLimited: options.rangeLimited ?? false,
    previewMove: options.previewMove ?? null,
    entrances: options.entrances ?? [],
    grid: options.grid ?? null,
    graph: options.graph ?? null,
    sprint: options.sprint ?? null,
    terrainZones: options.terrainZones ?? [],
    terrainMovementCosts: options.terrainMovementCosts ?? null,
    rangeBudget: options.rangeBudget ?? DEFAULT_TURN_BUDGET,
    notes: options.notes ?? [],
    obstacles: options.obstacles ?? [],
  };
}

function createOpeningShowcaseDemo() {
  return {
    id: OPENING_SHOWCASE_ID,
    name: "開場逐字輸出房",
    message: "天下大勢分久必合，合久必分。這裡展示可複用的逐字輸出函式，之後可用在劇情文本、角色對話或事件播報等場景。",
    textOptions: {
      speed: 80,
      gradient: true,
      direction: TEXT_DIRECTION.VERTICAL_RL,
      font: "'Noto Serif TC', 'Noto Sans TC', serif",
      fontSize: 38,
      lineGap: 44,
      columnGap: 56,
      top: 80,
      right: null,
      color: "#f5f7ff",
    },
  };
}

function normalizeTextLayoutOptions(options = {}) {
  return {
    text: options.text ?? "",
    speed: options.speed ?? 80,
    gradient: options.gradient ?? true,
    direction: options.direction ?? TEXT_DIRECTION.VERTICAL_RL,
    font: options.font ?? "'Noto Sans TC', sans-serif",
    fontSize: options.fontSize ?? 34,
    lineGap: options.lineGap ?? 40,
    columnGap: options.columnGap ?? options.lineGap ?? 40,
    color: options.color ?? "#f5f7ff",
    top: options.top ?? 80,
    right: options.right ?? null,
    left: options.left ?? 90,
    maxWidth: options.maxWidth ?? 820,
  };
}

function updateTypewriterPlayback(playback, timestamp) {
  if (!playback) return 0;
  if (!playback.startedAt) {
    playback.startedAt = timestamp;
    playback.lastTickAt = timestamp;
    playback.elapsed = 0;
    return 0;
  }
  const delta = Math.max(0, timestamp - playback.lastTickAt);
  const rate = playback.accelerating ? playback.accelerationRate : 1;
  playback.elapsed += delta * rate;
  playback.lastTickAt = timestamp;
  return playback.elapsed;
}

function buildHorizontalLines(ctx, text, maxWidth) {
  const lines = [];
  let current = "";
  [...text].forEach((char) => {
    const candidate = current + char;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = char;
      return;
    }
    current = candidate;
  });
  if (current.length > 0) lines.push(current);
  return lines;
}

function drawTypewriterText(ctx, canvas, elapsedMs, options = {}) {
  const config = normalizeTextLayoutOptions(options);
  const chars = [...config.text];
  const speed = Math.max(1, config.speed);
  const shownCount = Math.min(chars.length, Math.floor(elapsedMs / speed));
  const fadeWindow = 6;

  ctx.save();
  ctx.font = `${config.fontSize}px ${config.font}`;
  ctx.textBaseline = "top";

  if (config.direction === TEXT_DIRECTION.HORIZONTAL_LTR) {
    const lines = buildHorizontalLines(ctx, config.text, config.maxWidth);
    const visibleChars = [...config.text].slice(0, shownCount);
    let consumed = 0;
    ctx.textAlign = "left";
    lines.forEach((line, row) => {
      const lineChars = [...line];
      const showInLine = Math.max(0, Math.min(lineChars.length, visibleChars.length - consumed));
      if (showInLine <= 0) {
        consumed += lineChars.length;
        return;
      }
      const y = config.top + row * config.lineGap;
      const textToDraw = lineChars.slice(0, showInLine).join("");
      if (config.gradient) {
        const alpha = Math.max(0.25, Math.min(1, (shownCount - consumed) / fadeWindow));
        ctx.fillStyle = `rgba(245,247,255,${alpha})`;
      } else {
        ctx.fillStyle = config.color;
      }
      ctx.fillText(textToDraw, config.left, y);
      consumed += lineChars.length;
    });
  } else {
    const rightEdge = config.right ?? canvas.width - Math.max(72, config.fontSize * 1.8);
    const bottom = canvas.height - config.top;
    const usableHeight = Math.max(config.lineGap, bottom - config.top);
    const rowsPerColumn = Math.max(1, Math.floor(usableHeight / config.lineGap));
    ctx.textAlign = "center";
    chars.forEach((char, index) => {
      if (index >= shownCount) return;
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = rightEdge - column * config.columnGap;
      const y = config.top + row * config.lineGap;
      if (config.gradient) {
        const alpha = shownCount >= chars.length ? 1 : Math.max(0.2, Math.min(1, (shownCount - index) / fadeWindow));
        ctx.fillStyle = `rgba(245,247,255,${alpha})`;
      } else {
        ctx.fillStyle = config.color;
      }
      ctx.fillText(char, x, y);
    });
  }

  ctx.restore();
  return {
    shownCount,
    totalCount: chars.length,
    completed: shownCount >= chars.length,
  };
}

function createMovementDemoRoom() {
  return createRoom("free-walk-room", "自由走動房", { width: 1680, height: 1180 }, {
    movement: "free",
    entrances: [{ x: 1160, y: 880, width: 160, height: 120, target: "hub", label: "返回展示間" }],
    notes: ["自由連續空間移動。", "牆壁會阻擋玩家越界，鏡頭帶有死區並平滑跟隨。"],
  });
}

function createSprintDemoRoom() {
  return createRoom("free-sprint-room", "自由快跑房", { width: 1680, height: 1180 }, {
    movement: "free",
    sprint: { ...FREE_SPRINT_DEFAULTS },
    entrances: [{ x: 1160, y: 880, width: 160, height: 120, target: "hub", label: "返回展示間" }],
    notes: ["沿用自由走動房並追加 Shift 三段快跑與耐力表。", "速度切換會透過加速度平滑過渡，耐力歸零時自動回到走路。"],
  });
}

function createSprintTerrainRoom() {
  const terrainZones = [
    { type: TERRAIN_TYPES.GARDEN, x: ROOM_MARGIN + 110, y: 180, width: 300, height: 320 },
    { type: TERRAIN_TYPES.SAND, x: ROOM_MARGIN + 110, y: 610, width: 300, height: 320 },
  ];
  return createRoom("free-sprint-terrain-room", "快跑地形阻力房", { width: 1680, height: 1180 }, {
    movement: "free",
    sprint: {
      ...FREE_SPRINT_DEFAULTS,
      terrainResistance: {
        [TERRAIN_TYPES.GARDEN]: { mode: "constant", drag: 320, accelerationScale: 0.82, runningSpeedScale: 0.78, walkingSpeedScale: 0.92 },
        [TERRAIN_TYPES.SAND]: { mode: "speedScaled", linear: 0.85, quadratic: 0.0045, base: 40, accelerationScale: 0.62, runningSpeedScale: 0.58, walkingSpeedScale: 0.9 },
      },
    },
    terrainZones,
    entrances: [{ x: 1160, y: 880, width: 160, height: 120, target: "hub", label: "返回展示間" }],
    notes: ["左側花圃為均勻阻力減速，沙地速度越快阻力越強。", "慢速走路通過沙地只會感到輕微減速。"],
  });
}

function createGridMovementRoom() {
  return createRoom("grid-room", "方格移動房", { width: 1728, height: 1224 }, {
    movement: "grid",
    entrances: [{ x: 1296, y: 864, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    notes: ["按住方向鍵 / WASD 會持續逐格移動。", "沿用相同的鏡頭死區與平滑追蹤系統。"],
  });
}

function createRangeMovementRoom() {
  return createRoom("range-room", "移動力方格房", { width: 1728, height: 1224 }, {
    movement: "grid",
    rangeLimited: true,
    entrances: [{ x: 1224, y: 792, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    notes: ["每回合最多移動 4 格；可移動範圍會周期性變暗。", "只能在範圍內移動，按 Space 結束本次移動並重置移動力。"],
  });
}

function createFreeClickRoom() {
  return createRoom("free-click-room", "自由點擊尋路房", { width: 1820, height: 1260 }, {
    movement: "free",
    clickMove: true,
    entrances: [{ x: 1360, y: 900, width: 170, height: 120, target: "hub", label: "返回展示間" }],
    obstacles: createClickObstacles(),
    notes: ["滑鼠點擊地面後，玩家會繞開障礙物前往目的地。", "小房間、桌子與圓形建物都可用來測試避障。"],
  });
}

function createGridClickRoom() {
  return createRoom("grid-click-room", "方格點擊尋路房", { width: 1728, height: 1224 }, {
    movement: "grid",
    clickMove: true,
    entrances: [{ x: 1296, y: 864, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    obstacles: createClickObstacles(),
    notes: ["點擊任一可到達的格子後，玩家會按格子規則繞障礙物自動走過去。", "鍵盤按住也能持續逐格移動。"],
  });
}

function createRangeClickRoom() {
  return createRoom("range-click-room", "移動力點擊方格房", { width: 1728, height: 1224 }, {
    movement: "grid",
    clickMove: true,
    rangeLimited: true,
    entrances: [{ x: 1224, y: 792, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    obstacles: createClickObstacles(),
    notes: ["可點擊本次移動起點 4 格範圍內的格子，玩家會用格子路徑自動移動。", "按 Space 後才會把目前位置登記成新的移動起點。"],
  });
}

function createPreviewHoverRoom() {
  return createRoom("preview-hover-room", "預覽路徑方格房", { width: 1728, height: 1224 }, {
    movement: "grid",
    clickMove: true,
    rangeLimited: true,
    previewMove: "hover",
    entrances: [{ x: 1224, y: 792, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    obstacles: createClickObstacles(),
    notes: ["方向鍵只會建立暫時路徑；按下 Space 後才會依箭頭路徑移動。", "滑鼠移到可達格子上也會顯示路徑，左鍵可直接確認並開始移動。"],
  });
}

function createPreviewTerrainCostRoom() {
  const terrainZones = [
    { type: TERRAIN_TYPES.GARDEN, x: ROOM_MARGIN + GRID_CELL_SIZE * 2, y: ROOM_MARGIN + GRID_CELL_SIZE * 3, width: GRID_CELL_SIZE * 4, height: GRID_CELL_SIZE * 5 },
    { type: TERRAIN_TYPES.SAND, x: ROOM_MARGIN + GRID_CELL_SIZE * 8, y: ROOM_MARGIN + GRID_CELL_SIZE * 3, width: GRID_CELL_SIZE * 4, height: GRID_CELL_SIZE * 5 },
  ];
  return createRoom("preview-terrain-cost-room", "預覽地形耗力房", { width: 1728, height: 1224 }, {
    movement: "grid",
    clickMove: true,
    rangeLimited: true,
    previewMove: "hover",
    rangeBudget: 4,
    terrainZones,
    terrainMovementCosts: {
      [TERRAIN_TYPES.GARDEN]: 2,
      [TERRAIN_TYPES.SAND]: 3,
    },
    entrances: [{ x: 1224, y: 792, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    obstacles: createClickObstacles(),
    notes: ["沿用預覽路徑方格房，花圃每格消耗 2 點、沙地每格消耗 3 點移動力。", "可走範圍與預覽路徑會依地形消耗同步更新。"],
  });
}

function createPreviewClickRoom() {
  return createRoom("preview-click-room", "點擊確認路徑房", { width: 1728, height: 1224 }, {
    movement: "grid",
    clickMove: true,
    rangeLimited: true,
    previewMove: "click",
    entrances: [{ x: 1224, y: 792, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
    grid: { cellSize: GRID_CELL_SIZE },
    obstacles: createClickObstacles(),
    notes: ["方向鍵可先建立暫時路徑；滑鼠左鍵第一次是設定路徑，第二次點同格才會確認移動。", "若改點不同格子，路徑會先收回到玩家所在位置，回到未預覽狀態。"],
  });
}

function createNetworkConstraintRoom() {
  const nodes = [
    { id: 0, x: 280, y: 220 },
    { id: 1, x: 520, y: 180 },
    { id: 2, x: 820, y: 260 },
    { id: 3, x: 340, y: 510 },
    { id: 4, x: 620, y: 460 },
    { id: 5, x: 890, y: 560 },
    { id: 6, x: 420, y: 830 },
    { id: 7, x: 700, y: 760 },
    { id: 8, x: 1040, y: 840 },
    { id: 9, x: 1280, y: 620 },
  ];
  const edges = [
    [0, 1], [0, 3],
    [1, 2], [1, 4],
    [2, 5],
    [3, 4], [3, 6],
    [4, 5], [4, 7],
    [5, 8],
    [6, 7],
    [7, 8], [5, 9],
    [8, 9],
  ];
  const hubNode = nodes.find((node) => node.id === 9);
  return createRoom("network-room", "約束網狀地圖房", { width: 1760, height: 1240 }, {
    movement: "network",
    clickMove: true,
    entrances: [{
      x: hubNode.x - 78,
      y: hubNode.y - 58,
      width: 156,
      height: 116,
      target: "hub",
      label: "返回展示間",
    }],
    graph: { nodes, edges, hubNodeId: 9 },
    notes: ["玩家初始會隨機落在任一節點上，只能沿著節點與連線行走。", "在節點上會出現光圈，行走中的連線會高亮提示。"],
  });
}

function createNetworkKeyboardRoom() {
  const nodes = [
    { id: 0, x: 280, y: 220 },
    { id: 1, x: 520, y: 180 },
    { id: 2, x: 820, y: 260 },
    { id: 3, x: 340, y: 510 },
    { id: 4, x: 620, y: 460 },
    { id: 5, x: 890, y: 560 },
    { id: 6, x: 420, y: 830 },
    { id: 7, x: 700, y: 760 },
    { id: 8, x: 1040, y: 840 },
    { id: 9, x: 1280, y: 620 },
  ];
  const edges = [
    [0, 1], [0, 3],
    [1, 2], [1, 4],
    [2, 5],
    [3, 4], [3, 6],
    [4, 5], [4, 7],
    [5, 8], [5, 9],
    [6, 7],
    [7, 8],
    [8, 9],
  ];
  const hubNode = nodes.find((node) => node.id === 9);
  return createRoom("network-key-room", "網狀地圖鍵盤房", { width: 1760, height: 1240 }, {
    movement: "network",
    clickMove: true,
    keyboardGraphMove: true,
    entrances: [{
      x: hubNode.x - 78,
      y: hubNode.y - 58,
      width: 156,
      height: 116,
      target: "hub",
      label: "返回展示間",
    }],
    graph: { nodes, edges, hubNodeId: 9 },
    notes: ["沿用上一間網狀地圖並追加方向鍵移動。", "方向鍵會挑選該方向最接近的鄰接節點，路徑同樣受連線約束。"],
  });
}

function createHubRoom(rooms) {
  const world = { width: 2160, height: 1480 };
  const startX = 360;
  const startY = 320;
  const gapX = 280;
  const gapY = 220;
  const entrances = rooms.map((room, index) => ({
    x: startX + (index % 3) * gapX,
    y: startY + Math.floor(index / 3) * gapY,
    width: 210,
    height: 138,
    target: room.id,
    label: room.name,
  }));
  return createRoom("hub", "展示間入口", world, {
    movement: "free",
    entrances,
    notes: ["這一層會自動為所有展示房生成入口。", "可用自由走動方式靠近入口來進入各展示房。"],
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function terrainAtPoint(room, x, y) {
  return room.terrainZones.find((zone) => rectContains(zone, x, y)) ?? null;
}

function movementCostForCell(room, gridX, gridY) {
  const world = gridToWorld(room, gridX, gridY);
  const terrain = terrainAtPoint(room, world.x, world.y);
  if (!terrain) return 1;
  return room.terrainMovementCosts?.[terrain.type] ?? 1;
}

function gridMetrics(room) {
  const cellSize = room.grid.cellSize;
  return {
    cellSize,
    gridMinX: ROOM_MARGIN + cellSize / 2,
    gridMinY: ROOM_MARGIN + cellSize / 2,
    columns: Math.floor((room.world.width - ROOM_MARGIN * 2) / cellSize),
    rows: Math.floor((room.world.height - ROOM_MARGIN * 2) / cellSize),
  };
}

function toGridPoint(room, x, y) {
  const metrics = gridMetrics(room);
  const gridX = clamp(Math.round((x - metrics.gridMinX) / metrics.cellSize), 0, Math.max(0, metrics.columns - 1));
  const gridY = clamp(Math.round((y - metrics.gridMinY) / metrics.cellSize), 0, Math.max(0, metrics.rows - 1));
  return {
    gridX,
    gridY,
    x: metrics.gridMinX + gridX * metrics.cellSize,
    y: metrics.gridMinY + gridY * metrics.cellSize,
  };
}

function gridToWorld(room, gridX, gridY) {
  const metrics = gridMetrics(room);
  return {
    gridX,
    gridY,
    x: metrics.gridMinX + gridX * metrics.cellSize,
    y: metrics.gridMinY + gridY * metrics.cellSize,
  };
}

function pointHitsObstacle(x, y, obstacle, padding = 0) {
  if (obstacle.type === "rect") {
    return x >= obstacle.x - padding && x <= obstacle.x + obstacle.width + padding && y >= obstacle.y - padding && y <= obstacle.y + obstacle.height + padding;
  }
  return Math.hypot(x - obstacle.x, y - obstacle.y) <= obstacle.radius + padding;
}

function pointBlocked(room, x, y, padding = 0) {
  if (x < ROOM_MARGIN + padding || x > room.world.width - ROOM_MARGIN - padding || y < ROOM_MARGIN + padding || y > room.world.height - ROOM_MARGIN - padding) {
    return true;
  }
  return room.obstacles.some((obstacle) => pointHitsObstacle(x, y, obstacle, padding));
}

function resolveMovementWithObstacles(room, previous, next, radius) {
  const bounded = {
    x: clamp(next.x, ROOM_MARGIN + radius, room.world.width - ROOM_MARGIN - radius),
    y: clamp(next.y, ROOM_MARGIN + radius, room.world.height - ROOM_MARGIN - radius),
  };
  if (!pointBlocked(room, bounded.x, bounded.y, radius)) return bounded;

  const xOnly = { x: bounded.x, y: previous.y };
  if (!pointBlocked(room, xOnly.x, xOnly.y, radius)) return xOnly;

  const yOnly = { x: previous.x, y: bounded.y };
  if (!pointBlocked(room, yOnly.x, yOnly.y, radius)) return yOnly;

  return previous;
}

function createState(canvas, rooms) {
  return {
    rooms,
    currentRoomId: "hub",
    player: {
      x: 0,
      y: 0,
      radius: PLAYER_RADIUS,
      gridX: 0,
      gridY: 0,
      moveFrom: null,
      moveTo: null,
      moveProgress: 0,
      pathQueue: [],
      clickTarget: null,
      previewPath: [],
      previewTarget: null,
      graphNodeId: null,
      graphPath: [],
      graphActiveEdge: null,
      velocityX: 0,
      velocityY: 0,
      sprintTier: 0,
      stamina: FREE_SPRINT_DEFAULTS.staminaMax,
    },
    camera: { x: 0, y: 0 },
    keys: new Set(),
    previousKeys: new Set(),
    turn: { budget: DEFAULT_TURN_BUDGET, originX: 0, originY: 0 },
    pulseTime: 0,
    lastTime: 0,
    running: false,
    frameId: null,
    canvas,
    openingShowcase: null,
  };
}

function clearAutoMove(state) {
  state.player.pathQueue = [];
  state.player.clickTarget = null;
  state.player.graphPath = [];
  state.player.graphActiveEdge = null;
}

function clearPreviewPath(state) {
  state.player.previewPath = [];
  state.player.previewTarget = null;
}

function resetMotionState(state) {
  state.player.moveFrom = null;
  state.player.moveTo = null;
  state.player.moveProgress = 0;
  clearAutoMove(state);
  clearPreviewPath(state);
}

function resetTurnBudget(state, room = state.rooms[state.currentRoomId]) {
  state.turn.budget = room?.rangeBudget ?? DEFAULT_TURN_BUDGET;
  state.turn.originX = state.player.gridX;
  state.turn.originY = state.player.gridY;
}

function syncGridPosition(state, room) {
  if (room.movement !== "grid") return;
  const snapped = toGridPoint(room, state.player.x, state.player.y);
  state.player.gridX = snapped.gridX;
  state.player.gridY = snapped.gridY;
  state.player.x = snapped.x;
  state.player.y = snapped.y;
  resetMotionState(state);
  if (room.rangeLimited) resetTurnBudget(state, room);
}

function graphNodeById(room, nodeId) {
  return room.graph.nodes.find((node) => node.id === nodeId) ?? null;
}

function buildGraphAdjacency(room) {
  const adjacency = new Map();
  room.graph.nodes.forEach((node) => adjacency.set(node.id, []));
  room.graph.edges.forEach(([a, b]) => {
    adjacency.get(a)?.push(b);
    adjacency.get(b)?.push(a);
  });
  return adjacency;
}

function buildGraphPath(room, fromNodeId, toNodeId) {
  if (fromNodeId === toNodeId) return [];
  const adjacency = buildGraphAdjacency(room);
  const queue = [fromNodeId];
  const cameFrom = new Map([[fromNodeId, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === toNodeId) break;
    const neighbors = adjacency.get(current) ?? [];
    neighbors.forEach((next) => {
      if (cameFrom.has(next)) return;
      cameFrom.set(next, current);
      queue.push(next);
    });
  }

  if (!cameFrom.has(toNodeId)) return [];
  const path = [];
  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    path.unshift(cursor);
    cursor = cameFrom.get(cursor);
  }
  return path;
}

function nearestGraphNode(room, x, y, maxDistance = 44) {
  let best = null;
  let bestDistance = Infinity;
  room.graph.nodes.forEach((node) => {
    const distance = Math.hypot(x - node.x, y - node.y);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  });
  if (best && bestDistance <= maxDistance) return best;
  return null;
}

function directionalGraphNeighbor(room, nodeId, direction) {
  const fromNode = graphNodeById(room, nodeId);
  if (!fromNode) return null;
  const adjacency = buildGraphAdjacency(room);
  const neighbors = adjacency.get(nodeId) ?? [];
  let bestNodeId = null;
  let bestScore = 0.35;
  neighbors.forEach((nextId) => {
    const nextNode = graphNodeById(room, nextId);
    if (!nextNode) return;
    const vx = nextNode.x - fromNode.x;
    const vy = nextNode.y - fromNode.y;
    const length = Math.hypot(vx, vy) || 1;
    const dot = (vx / length) * direction.x + (vy / length) * direction.y;
    if (dot > bestScore) {
      bestScore = dot;
      bestNodeId = nextId;
    }
  });
  return bestNodeId;
}

function placePlayer(state, roomId, spawn = null) {
  state.currentRoomId = roomId;
  const room = state.rooms[roomId];
  const x = spawn?.x ?? room.world.width / 2;
  const y = spawn?.y ?? room.world.height / 2;
  resetMotionState(state);

  if (room.movement === "grid") {
    const snapped = toGridPoint(room, x, y);
    if (!pointBlocked(room, snapped.x, snapped.y, state.player.radius)) {
      state.player.x = snapped.x;
      state.player.y = snapped.y;
      syncGridPosition(state, room);
    }
  } else if (room.movement === "network") {
    const randomIndex = Math.floor(Math.random() * room.graph.nodes.length);
    const startNode = room.graph.nodes[randomIndex];
    state.player.graphNodeId = startNode.id;
    state.player.x = startNode.x;
    state.player.y = startNode.y;
  } else {
    const resolved = resolveMovementWithObstacles(room, { x, y }, { x, y }, state.player.radius);
    state.player.x = resolved.x;
    state.player.y = resolved.y;
  }

  state.player.velocityX = 0;
  state.player.velocityY = 0;
  state.player.sprintTier = 0;
  state.player.stamina = room.sprint?.staminaMax ?? FREE_SPRINT_DEFAULTS.staminaMax;

  if (!room.rangeLimited) state.turn.budget = room.rangeBudget ?? DEFAULT_TURN_BUDGET;
  state.camera.x = clamp(state.player.x - state.canvas.width / 2, 0, Math.max(0, room.world.width - state.canvas.width));
  state.camera.y = clamp(state.player.y - state.canvas.height / 2, 0, Math.max(0, room.world.height - state.canvas.height));
}

function primaryDirection(state) {
  if (state.keys.has("ArrowLeft") || state.keys.has("a")) return { x: -1, y: 0 };
  if (state.keys.has("ArrowRight") || state.keys.has("d")) return { x: 1, y: 0 };
  if (state.keys.has("ArrowUp") || state.keys.has("w")) return { x: 0, y: -1 };
  if (state.keys.has("ArrowDown") || state.keys.has("s")) return { x: 0, y: 1 };
  return null;
}

function freeDirection(state) {
  const horizontal = (state.keys.has("ArrowRight") || state.keys.has("d") ? 1 : 0) - (state.keys.has("ArrowLeft") || state.keys.has("a") ? 1 : 0);
  const vertical = (state.keys.has("ArrowDown") || state.keys.has("s") ? 1 : 0) - (state.keys.has("ArrowUp") || state.keys.has("w") ? 1 : 0);
  if (horizontal === 0 && vertical === 0) return null;
  return { x: horizontal, y: vertical };
}

function reachableCells(room, state) {
  if (!room.rangeLimited) return null;
  const metrics = gridMetrics(room);
  const visited = new Map();
  const queue = [{ x: state.turn.originX, y: state.turn.originY, cost: 0 }];
  visited.set(`${state.turn.originX},${state.turn.originY}`, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    neighbors.forEach((next) => {
      if (next.x < 0 || next.y < 0 || next.x >= metrics.columns || next.y >= metrics.rows) return;
      const nextCost = current.cost + movementCostForCell(room, next.x, next.y);
      const key = `${next.x},${next.y}`;
      const world = gridToWorld(room, next.x, next.y);
      if (nextCost > state.turn.budget || pointBlocked(room, world.x, world.y, state.player.radius)) return;
      if (visited.has(key) && visited.get(key) <= nextCost) return;
      visited.set(key, nextCost);
      queue.push({ x: next.x, y: next.y, cost: nextCost });
    });
  }

  return visited;
}

function canReachRangeCell(room, state, gridX, gridY) {
  const reachable = reachableCells(room, state);
  return reachable?.has(`${gridX},${gridY}`) ?? false;
}

function buildGridPath(room, fromX, fromY, toX, toY, allowedSet = null) {
  const metrics = gridMetrics(room);
  const startKey = `${fromX},${fromY}`;
  const goalKey = `${toX},${toY}`;
  const queue = [{ x: fromX, y: fromY, cost: 0 }];
  const cameFrom = new Map([[startKey, null]]);
  const bestCost = new Map([[startKey, 0]]);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (`${current.x},${current.y}` === goalKey) break;
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    neighbors.forEach((next) => {
      if (next.x < 0 || next.y < 0 || next.x >= metrics.columns || next.y >= metrics.rows) return;
      const key = `${next.x},${next.y}`;
      const world = gridToWorld(room, next.x, next.y);
      if (pointBlocked(room, world.x, world.y, PLAYER_RADIUS)) return;
      if (allowedSet && !allowedSet.has(key)) return;
      const nextCost = current.cost + movementCostForCell(room, next.x, next.y);
      if (bestCost.has(key) && bestCost.get(key) <= nextCost) return;
      bestCost.set(key, nextCost);
      cameFrom.set(key, { x: current.x, y: current.y });
      queue.push({ x: next.x, y: next.y, cost: nextCost });
    });
  }

  if (!cameFrom.has(goalKey)) return [];
  const path = [];
  let cursor = { x: toX, y: toY };
  while (`${cursor.x},${cursor.y}` !== startKey) {
    path.unshift({ gridX: cursor.x, gridY: cursor.y });
    cursor = cameFrom.get(`${cursor.x},${cursor.y}`);
  }
  return path;
}

function buildFreePath(room, fromX, fromY, toX, toY) {
  const columns = Math.floor(room.world.width / FREE_NAV_CELL);
  const rows = Math.floor(room.world.height / FREE_NAV_CELL);
  const start = { x: clamp(Math.round(fromX / FREE_NAV_CELL), 0, columns - 1), y: clamp(Math.round(fromY / FREE_NAV_CELL), 0, rows - 1) };
  const goal = { x: clamp(Math.round(toX / FREE_NAV_CELL), 0, columns - 1), y: clamp(Math.round(toY / FREE_NAV_CELL), 0, rows - 1) };
  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;
  const queue = [start];
  const cameFrom = new Map([[startKey, null]]);
  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (`${current.x},${current.y}` === goalKey) break;
    dirs.forEach((dir) => {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows) return;
      const key = `${next.x},${next.y}`;
      const wx = next.x * FREE_NAV_CELL;
      const wy = next.y * FREE_NAV_CELL;
      if (cameFrom.has(key) || pointBlocked(room, wx, wy, PLAYER_RADIUS + 4)) return;
      cameFrom.set(key, current);
      queue.push(next);
    });
  }

  if (!cameFrom.has(goalKey)) return [];
  const path = [];
  let cursor = goal;
  while (`${cursor.x},${cursor.y}` !== startKey) {
    path.unshift({ x: cursor.x * FREE_NAV_CELL, y: cursor.y * FREE_NAV_CELL });
    cursor = cameFrom.get(`${cursor.x},${cursor.y}`);
  }
  path.push({ x: toX, y: toY });
  return path;
}

function commitPreviewPath(state) {
  if (state.player.moveTo || state.player.clickTarget || !state.player.previewTarget) return false;
  if (state.player.previewPath.length === 0) {
    if (state.player.previewTarget.gridX !== state.player.gridX || state.player.previewTarget.gridY !== state.player.gridY) return false;
    clearPreviewPath(state);
    resetTurnBudget(state, state.rooms[state.currentRoomId]);
    return true;
  }
  state.player.pathQueue = state.player.previewPath.map((step) => ({ ...step }));
  clearPreviewPath(state);
  return true;
}

function setPreviewPath(state, path, target = null) {
  state.player.previewPath = path.map((step) => ({ ...step }));
  state.player.previewTarget = target ? { ...target } : null;
}

function previewEndpoint(state) {
  if (state.player.previewPath.length > 0) {
    const last = state.player.previewPath[state.player.previewPath.length - 1];
    return { gridX: last.gridX, gridY: last.gridY };
  }
  return { gridX: state.player.gridX, gridY: state.player.gridY };
}

function appendPreviewStep(state, room, dirX, dirY) {
  const metrics = gridMetrics(room);
  const reachable = reachableCells(room, state);
  const endpoint = state.player.previewTarget ?? previewEndpoint(state);
  const nextGridX = clamp(endpoint.gridX + dirX, 0, Math.max(0, metrics.columns - 1));
  const nextGridY = clamp(endpoint.gridY + dirY, 0, Math.max(0, metrics.rows - 1));
  if (nextGridX === endpoint.gridX && nextGridY === endpoint.gridY) return false;
  if (reachable && !reachable.has(`${nextGridX},${nextGridY}`)) return false;
  const nextWorld = gridToWorld(room, nextGridX, nextGridY);
  if (pointBlocked(room, nextWorld.x, nextWorld.y, state.player.radius)) return false;

  const path = buildGridPath(room, state.player.gridX, state.player.gridY, nextGridX, nextGridY, reachable);
  if (path.length === 0 && (nextGridX !== state.player.gridX || nextGridY !== state.player.gridY)) return false;
  setPreviewPath(state, path, { gridX: nextGridX, gridY: nextGridY });
  return true;
}

function startGridStep(state, room, nextGridX, nextGridY) {
  const target = gridToWorld(room, nextGridX, nextGridY);
  if (pointBlocked(room, target.x, target.y, state.player.radius)) return false;
  if (room.rangeLimited && !canReachRangeCell(room, state, nextGridX, nextGridY)) return false;
  if (nextGridX === state.player.gridX && nextGridY === state.player.gridY) return false;

  state.player.moveFrom = { x: state.player.x, y: state.player.y, gridX: state.player.gridX, gridY: state.player.gridY };
  state.player.moveTo = target;
  state.player.moveProgress = 0;
  return true;
}

function updateFreePlayer(state, room, dt) {
  if (state.player.clickTarget) {
    const dx = state.player.clickTarget.x - state.player.x;
    const dy = state.player.clickTarget.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      state.player.x = state.player.clickTarget.x;
      state.player.y = state.player.clickTarget.y;
      state.player.clickTarget = state.player.pathQueue.shift() ?? null;
      return;
    }
    const step = Math.min(distance, PLAYER_SPEED * dt);
    const next = { x: state.player.x + (dx / distance) * step, y: state.player.y + (dy / distance) * step };
    const resolved = resolveMovementWithObstacles(room, { x: state.player.x, y: state.player.y }, next, state.player.radius);
    state.player.x = resolved.x;
    state.player.y = resolved.y;
    return;
  }

  const direction = freeDirection(state);
  const sprint = room.sprint;
  if (!sprint) {
    if (!direction) return;
    const length = Math.hypot(direction.x, direction.y) || 1;
    const next = { x: state.player.x + (direction.x / length) * PLAYER_SPEED * dt, y: state.player.y + (direction.y / length) * PLAYER_SPEED * dt };
    const resolved = resolveMovementWithObstacles(room, { x: state.player.x, y: state.player.y }, next, state.player.radius);
    state.player.x = resolved.x;
    state.player.y = resolved.y;
    return;
  }

  const movingByInput = Boolean(direction);
  if (state.player.sprintTier > 0 && movingByInput) {
    const drain = sprint.staminaDrainPerSecond[state.player.sprintTier] ?? 0;
    state.player.stamina = Math.max(0, state.player.stamina - drain * dt);
    if (state.player.stamina <= 0) state.player.sprintTier = 0;
  } else {
    state.player.stamina = Math.min(sprint.staminaMax, state.player.stamina + sprint.staminaRegenPerSecond * dt);
  }

  const terrain = terrainAtPoint(room, state.player.x, state.player.y);
  const terrainResistance = terrain ? sprint.terrainResistance?.[terrain.type] : null;
  const terrainSpeedScale = terrainResistance
    ? (state.player.sprintTier > 0 ? terrainResistance.runningSpeedScale : terrainResistance.walkingSpeedScale) ?? 1
    : 1;
  const length = direction ? Math.hypot(direction.x, direction.y) || 1 : 0;
  const desiredSpeed = direction ? sprint.baseSpeed * (sprint.speedTiers[state.player.sprintTier] ?? 1) * terrainSpeedScale : 0;
  const desiredVx = direction ? (direction.x / length) * desiredSpeed : 0;
  const desiredVy = direction ? (direction.y / length) * desiredSpeed : 0;
  const dvx = desiredVx - state.player.velocityX;
  const dvy = desiredVy - state.player.velocityY;
  const accelScale = terrainResistance?.accelerationScale ?? 1;
  const accel = (desiredSpeed > 0 ? sprint.acceleration : sprint.deceleration) * accelScale;
  const maxDeltaV = (accel / Math.max(0.01, sprint.mass)) * dt;
  const deltaMag = Math.hypot(dvx, dvy);
  const ratio = deltaMag > maxDeltaV ? maxDeltaV / deltaMag : 1;
  state.player.velocityX += dvx * ratio;
  state.player.velocityY += dvy * ratio;

  if (terrainResistance) {
    const resistance = terrainResistance;
    const speed = Math.hypot(state.player.velocityX, state.player.velocityY);
    if (speed > 0.001) {
      const drag = resistance.mode === "speedScaled"
        ? (resistance.base ?? 0) + speed * (resistance.linear ?? 0) + speed * speed * (resistance.quadratic ?? 0)
        : resistance.drag ?? 0;
      const speedLoss = Math.min(speed, (drag / Math.max(0.01, sprint.mass)) * dt);
      const remain = (speed - speedLoss) / speed;
      state.player.velocityX *= remain;
      state.player.velocityY *= remain;
    }
  }

  const next = { x: state.player.x + state.player.velocityX * dt, y: state.player.y + state.player.velocityY * dt };
  const resolved = resolveMovementWithObstacles(room, { x: state.player.x, y: state.player.y }, next, state.player.radius);
  if (resolved.x === state.player.x) state.player.velocityX = 0;
  if (resolved.y === state.player.y) state.player.velocityY = 0;
  state.player.x = resolved.x;
  state.player.y = resolved.y;
}

function updateGridPlayer(state, room, dt) {
  if (state.player.moveTo) {
    state.player.moveProgress = Math.min(1, state.player.moveProgress + dt / GRID_STEP_DURATION);
    const t = state.player.moveProgress;
    state.player.x = state.player.moveFrom.x + (state.player.moveTo.x - state.player.moveFrom.x) * t;
    state.player.y = state.player.moveFrom.y + (state.player.moveTo.y - state.player.moveFrom.y) * t;
    if (t >= 1) {
      state.player.x = state.player.moveTo.x;
      state.player.y = state.player.moveTo.y;
      state.player.gridX = state.player.moveTo.gridX;
      state.player.gridY = state.player.moveTo.gridY;
      state.player.moveFrom = null;
      state.player.moveTo = null;
      state.player.moveProgress = 0;
      if (room.previewMove && state.player.pathQueue.length === 0) resetTurnBudget(state, room);
    }
    return;
  }

  if (state.player.pathQueue.length > 0) {
    const next = state.player.pathQueue.shift();
    if (!startGridStep(state, room, next.gridX, next.gridY)) state.player.pathQueue = [];
    return;
  }

  if (room.previewMove) return;

  const direction = primaryDirection(state);
  if (!direction) return;
  const metrics = gridMetrics(room);
  const nextGridX = clamp(state.player.gridX + direction.x, 0, Math.max(0, metrics.columns - 1));
  const nextGridY = clamp(state.player.gridY + direction.y, 0, Math.max(0, metrics.rows - 1));
  startGridStep(state, room, nextGridX, nextGridY);
}

function updateNetworkPlayer(state, room, dt) {
  if (state.player.moveTo) {
    state.player.moveProgress = Math.min(1, state.player.moveProgress + (PLAYER_SPEED * dt) / Math.max(1, Math.hypot(state.player.moveTo.x - state.player.moveFrom.x, state.player.moveTo.y - state.player.moveFrom.y)));
    const t = state.player.moveProgress;
    state.player.x = state.player.moveFrom.x + (state.player.moveTo.x - state.player.moveFrom.x) * t;
    state.player.y = state.player.moveFrom.y + (state.player.moveTo.y - state.player.moveFrom.y) * t;
    if (t >= 1) {
      state.player.x = state.player.moveTo.x;
      state.player.y = state.player.moveTo.y;
      state.player.graphNodeId = state.player.moveTo.nodeId;
      state.player.moveFrom = null;
      state.player.moveTo = null;
      state.player.moveProgress = 0;
      state.player.graphActiveEdge = null;
    }
    return;
  }

  if (room.keyboardGraphMove && state.player.graphPath.length === 0) {
    const direction = primaryDirection(state);
    if (direction) {
      const nextNodeId = directionalGraphNeighbor(room, state.player.graphNodeId, direction);
      if (nextNodeId !== null) state.player.graphPath = [nextNodeId];
    }
  }
  if (state.player.graphPath.length === 0) return;
  const nextNodeId = state.player.graphPath.shift();
  const fromNodeId = state.player.graphNodeId;
  const fromNode = graphNodeById(room, fromNodeId);
  const nextNode = graphNodeById(room, nextNodeId);
  if (!fromNode || !nextNode) {
    state.player.graphPath = [];
    state.player.graphActiveEdge = null;
    return;
  }
  state.player.moveFrom = { x: fromNode.x, y: fromNode.y, nodeId: fromNodeId };
  state.player.moveTo = { x: nextNode.x, y: nextNode.y, nodeId: nextNodeId };
  state.player.moveProgress = 0;
  state.player.graphActiveEdge = [fromNodeId, nextNodeId];
}

function updatePlayer(state, dt) {
  const room = state.rooms[state.currentRoomId];
  if (room.movement === "grid") updateGridPlayer(state, room, dt);
  else if (room.movement === "network") updateNetworkPlayer(state, room, dt);
  else updateFreePlayer(state, room, dt);
}

function updateCamera(state) {
  const room = state.rooms[state.currentRoomId];
  const viewHalfW = state.canvas.width / 2;
  const viewHalfH = state.canvas.height / 2;
  const deadHalfW = state.canvas.width * DEAD_ZONE.x / 2;
  const deadHalfH = state.canvas.height * DEAD_ZONE.y / 2;
  let targetX = state.camera.x;
  let targetY = state.camera.y;
  const playerScreenX = state.player.x - state.camera.x;
  const playerScreenY = state.player.y - state.camera.y;

  if (playerScreenX < viewHalfW - deadHalfW) targetX = state.player.x - (viewHalfW - deadHalfW);
  else if (playerScreenX > viewHalfW + deadHalfW) targetX = state.player.x - (viewHalfW + deadHalfW);
  if (playerScreenY < viewHalfH - deadHalfH) targetY = state.player.y - (viewHalfH - deadHalfH);
  else if (playerScreenY > viewHalfH + deadHalfH) targetY = state.player.y - (viewHalfH + deadHalfH);

  targetX = clamp(targetX, 0, Math.max(0, room.world.width - state.canvas.width));
  targetY = clamp(targetY, 0, Math.max(0, room.world.height - state.canvas.height));
  state.camera.x += (targetX - state.camera.x) * CAMERA_LERP;
  state.camera.y += (targetY - state.camera.y) * CAMERA_LERP;
}

function drawObstacles(ctx, room) {
  room.obstacles.forEach((obstacle) => {
    if (obstacle.type === "rect") {
      const isWall = obstacle.width < 50 || obstacle.height < 50;
      ctx.fillStyle = isWall ? "#6c5941" : "#7f633f";
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    } else {
      ctx.fillStyle = "#5c6a7d";
      ctx.beginPath();
      ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawGridOverlay(ctx, room, state) {
  if (room.movement !== "grid") return;
  const metrics = gridMetrics(room);
  const reachable = room.rangeLimited ? reachableCells(room, state) : null;

  if (reachable) {
    const pulse = 0.28 + (Math.sin(state.pulseTime * 3) + 1) * 0.18;
    reachable.forEach((_, key) => {
      const [x, y] = key.split(",").map(Number);
      const wx = ROOM_MARGIN + x * metrics.cellSize;
      const wy = ROOM_MARGIN + y * metrics.cellSize;
      ctx.fillStyle = `rgba(121, 188, 255, ${pulse})`;
      ctx.fillRect(wx, wy, metrics.cellSize, metrics.cellSize);
    });
  }

  ctx.strokeStyle = "rgba(220,235,255,0.18)";
  ctx.lineWidth = 1;
  for (let x = ROOM_MARGIN; x <= room.world.width - ROOM_MARGIN; x += metrics.cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, ROOM_MARGIN);
    ctx.lineTo(x, room.world.height - ROOM_MARGIN);
    ctx.stroke();
  }
  for (let y = ROOM_MARGIN; y <= room.world.height - ROOM_MARGIN; y += metrics.cellSize) {
    ctx.beginPath();
    ctx.moveTo(ROOM_MARGIN, y);
    ctx.lineTo(room.world.width - ROOM_MARGIN, y);
    ctx.stroke();
  }
}

function drawEntrances(ctx, state, room) {
  room.entrances.forEach((entrance) => {
    const active = rectContains(entrance, state.player.x, state.player.y);
    ctx.fillStyle = active ? "rgba(115, 178, 255, 0.9)" : "rgba(81, 123, 182, 0.72)";
    ctx.fillRect(entrance.x, entrance.y, entrance.width, entrance.height);
    ctx.strokeStyle = "rgba(216,234,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(entrance.x, entrance.y, entrance.width, entrance.height);
    ctx.fillStyle = "#ecf4ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "18px 'Noto Sans TC', sans-serif";
    ctx.fillText(entrance.label, entrance.x + entrance.width / 2, entrance.y + entrance.height / 2 - 10);
    ctx.font = "13px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "rgba(236,244,255,0.82)";
    ctx.fillText("踏入後自動轉場", entrance.x + entrance.width / 2, entrance.y + entrance.height / 2 + 18);
  });
}

function drawPreviewPath(ctx, room, state) {
  if (!room.previewMove || !state.player.previewTarget) return;
  if (state.player.previewPath.length === 0) {
    if (state.player.previewTarget.gridX !== state.player.gridX || state.player.previewTarget.gridY !== state.player.gridY) return;
    ctx.strokeStyle = "rgba(123, 207, 255, 0.95)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, PLAYER_RADIUS + 12, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const points = [{ x: state.player.x, y: state.player.y }, ...state.player.previewPath.map((step) => gridToWorld(room, step.gridX, step.gridY))];
  ctx.strokeStyle = "rgba(123, 207, 255, 0.9)";
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.stroke();

  ctx.fillStyle = "rgba(123, 207, 255, 0.26)";
  points.slice(1).forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  const end = points[points.length - 1];
  const previous = points[points.length - 2] ?? points[0];
  const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#7bcfff";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, -5);
  ctx.lineTo(-24, -5);
  ctx.lineTo(-24, 5);
  ctx.lineTo(-10, 5);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGraphLayer(ctx, room, state) {
  if (room.movement !== "network") return;
  const hubNodeId = room.graph.hubNodeId;
  const activeEdge = state.player.graphActiveEdge;

  room.graph.edges.forEach(([a, b]) => {
    const from = graphNodeById(room, a);
    const to = graphNodeById(room, b);
    if (!from || !to) return;
    const isActive = activeEdge && ((activeEdge[0] === a && activeEdge[1] === b) || (activeEdge[0] === b && activeEdge[1] === a));
    ctx.strokeStyle = isActive ? "rgba(123, 221, 255, 0.96)" : "rgba(170, 198, 231, 0.55)";
    ctx.lineWidth = isActive ? 10 : 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  room.graph.nodes.forEach((node) => {
    const isHubNode = node.id === hubNodeId;
    ctx.fillStyle = isHubNode ? "#8ef7c3" : "#d9e8ff";
    ctx.beginPath();
    ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0b1727";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  if (!state.player.moveTo) {
    const currentNode = graphNodeById(room, state.player.graphNodeId);
    if (currentNode) {
      const pulse = 0.38 + (Math.sin(state.pulseTime * 4) + 1) * 0.2;
      ctx.strokeStyle = `rgba(123, 214, 255, ${pulse})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(currentNode.x, currentNode.y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawRoom(ctx, canvas, state) {
  const room = state.rooms[state.currentRoomId];
  const camera = state.camera;
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = room.movement === "grid" ? "#14212f" : "#152338";
  ctx.fillRect(0, 0, room.world.width, room.world.height);
  ctx.strokeStyle = "#9a7d4f";
  ctx.lineWidth = ROOM_MARGIN;
  ctx.strokeRect(ROOM_MARGIN / 2, ROOM_MARGIN / 2, room.world.width - ROOM_MARGIN, room.world.height - ROOM_MARGIN);

  if (room.movement === "grid") drawGridOverlay(ctx, room, state);
  else {
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 120; x < room.world.width; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, ROOM_MARGIN);
      ctx.lineTo(x, room.world.height - ROOM_MARGIN);
      ctx.stroke();
    }
    for (let y = 120; y < room.world.height; y += 120) {
      ctx.beginPath();
      ctx.moveTo(ROOM_MARGIN, y);
      ctx.lineTo(room.world.width - ROOM_MARGIN, y);
      ctx.stroke();
    }
  }

  room.terrainZones.forEach((zone) => {
    if (zone.type === TERRAIN_TYPES.GARDEN) ctx.fillStyle = "rgba(108, 168, 96, 0.42)";
    else if (zone.type === TERRAIN_TYPES.SAND) ctx.fillStyle = "rgba(206, 176, 106, 0.42)";
    else ctx.fillStyle = "rgba(150,150,150,0.3)";
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeStyle = "rgba(225,235,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
  });

  drawObstacles(ctx, room);
  drawGraphLayer(ctx, room, state);
  drawEntrances(ctx, state, room);
  drawPreviewPath(ctx, room, state);

  ctx.fillStyle = room.rangeLimited ? "#9cd0ff" : room.movement === "grid" ? "#8ff0c4" : "#f3d37c";
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const deadZoneWidth = canvas.width * DEAD_ZONE.x;
  const deadZoneHeight = canvas.height * DEAD_ZONE.y;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(canvas.width / 2 - deadZoneWidth / 2, canvas.height / 2 - deadZoneHeight / 2, deadZoneWidth, deadZoneHeight);
  ctx.setLineDash([]);

  const infoPanelHeight = room.previewMove ? 220 : room.rangeLimited ? 176 : 152;
  ctx.fillStyle = "rgba(12,19,29,0.76)";
  ctx.fillRect(18, 18, 540, infoPanelHeight);
  ctx.strokeStyle = "rgba(175,198,231,0.4)";
  ctx.strokeRect(18, 18, 540, infoPanelHeight);
  ctx.fillStyle = "#ecf2ff";
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  ctx.font = "22px 'Noto Sans TC', sans-serif";
  ctx.fillText(room.name, 36, 52);
  ctx.font = "15px 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "#c7d9f8";
  const controlLine = room.movement === "free"
    ? room.sprint ? "WASD / 方向鍵移動，Shift 切換快跑檔位，Backspace 退出展示間" : room.clickMove ? "滑鼠點擊地面 / 方向鍵移動，Backspace 退出展示間" : "WASD / 方向鍵移動，Backspace 退出展示間"
    : room.movement === "network" ? room.keyboardGraphMove ? "方向鍵或滑鼠點節點移動，僅能沿連線前進，Backspace 退出" : "滑鼠點擊節點沿網路前進，僅能在節點與連線上移動，Backspace 退出"
    : room.previewMove === "hover" ? "方向鍵建立路徑、滑鼠懸停預覽，Space / 左鍵確認移動，Backspace 退出"
      : room.previewMove === "click" ? "方向鍵建立路徑、左鍵點選/再點確認，Space 也可移動，Backspace 退出"
        : room.clickMove ? "滑鼠點擊或按住方向鍵移動，Space 結束回合，Backspace 退出" : "按住方向鍵 / WASD 持續逐格移動，Backspace 退出展示間";
  ctx.fillText(controlLine, 36, 82);
  room.notes.forEach((line, index) => ctx.fillText(line, 36, 108 + index * 22));
  if (room.movement === "grid") ctx.fillText(`目前格位：(${state.player.gridX}, ${state.player.gridY})`, 36, room.rangeLimited ? 152 : 130);
  if (room.rangeLimited) ctx.fillText(`本次移動起點：(${state.turn.originX}, ${state.turn.originY})｜移動力上限 ${state.turn.budget}`, 36, 174);
  if (room.previewMove) ctx.fillText(`預覽步數：${state.player.previewPath.length}｜按 Space 依路徑移動`, 36, 196);

  if (room.sprint) {
    const gaugeX = 26;
    const gaugeY = canvas.height - 170;
    const gaugeW = 170;
    const gaugeH = 132;
    const staminaRatio = clamp(state.player.stamina / room.sprint.staminaMax, 0, 1);
    ctx.fillStyle = "rgba(10,16,26,0.78)";
    ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
    ctx.strokeStyle = "rgba(191,212,242,0.45)";
    ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);
    const barX = gaugeX + 12;
    const barY = gaugeY + 18;
    const barH = gaugeH - 32;
    ctx.fillStyle = "rgba(32,44,60,0.92)";
    ctx.fillRect(barX, barY, 16, barH);
    ctx.fillStyle = staminaRatio > 0.2 ? "#78e08f" : "#ff8f8f";
    ctx.fillRect(barX, barY + (1 - staminaRatio) * barH, 16, barH * staminaRatio);
    ctx.fillStyle = "#d7e7ff";
    ctx.font = "13px 'Noto Sans TC', sans-serif";
    ctx.fillText("耐力", barX - 2, gaugeY + gaugeH - 4);

    const speedBarX = gaugeX + 62;
    const speedBarY = gaugeY + 24;
    const segmentH = 24;
    const baseW = 46;
    const topGrow = 12;
    ["快", "中", "慢"].forEach((label, order) => {
      const tier = 3 - order;
      const active = state.player.sprintTier >= tier;
      const y = speedBarY + order * (segmentH + 6);
      const topW = baseW + topGrow * tier;
      const bottomW = baseW + topGrow * Math.max(0, tier - 1);
      const leftTop = speedBarX - topW / 2;
      const leftBottom = speedBarX - bottomW / 2;
      ctx.beginPath();
      ctx.moveTo(leftTop, y);
      ctx.lineTo(leftTop + topW, y);
      ctx.lineTo(leftBottom + bottomW, y + segmentH);
      ctx.lineTo(leftBottom, y + segmentH);
      ctx.closePath();
      ctx.fillStyle = active ? "#ffe98a" : "rgba(130,145,170,0.35)";
      ctx.fill();
      ctx.strokeStyle = "rgba(240,247,255,0.6)";
      ctx.stroke();
      ctx.fillStyle = "#dce9ff";
      ctx.fillText(label, speedBarX + 42, y + 16);
    });
    ctx.fillStyle = "#bfd6f7";
    ctx.fillText("Shift 切換檔位", gaugeX + 56, gaugeY + 18);
  }
}

function drawOpeningShowcase(ctx, canvas, state, timestamp) {
  const opening = state.openingShowcase;
  if (!opening?.active || !opening.config) return;
  const elapsed = updateTypewriterPlayback(opening.playback, timestamp);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const result = drawTypewriterText(ctx, canvas, elapsed, opening.config);
  opening.completed = result.completed;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "16px 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "rgba(220,228,240,0.9)";
  const hint = opening.completed ? "文字播放完成，按任意鍵返回展示間入口" : "文字播放中...";
  ctx.fillText(hint, canvas.width / 2, canvas.height - 40);
}

function computeSpawn(targetRoom) {
  if (targetRoom.id === "hub") return { x: targetRoom.world.width / 2, y: targetRoom.world.height - 220 };
  if (targetRoom.movement === "network") return null;
  if (targetRoom.movement === "grid") return { x: ROOM_MARGIN + GRID_CELL_SIZE * 2.5, y: targetRoom.world.height / 2 };
  return { x: ROOM_MARGIN + 180, y: targetRoom.world.height / 2 };
}

function tryTransitions(state) {
  if (state.openingShowcase?.active) return;
  const room = state.rooms[state.currentRoomId];
  const entrance = room.entrances.find((item) => rectContains(item, state.player.x, state.player.y));
  if (!entrance) return;
  if (entrance.target === OPENING_SHOWCASE_ID) {
    state.openingShowcase = {
      active: true,
      enteredAt: performance.now(),
      completed: false,
      config: state.openingShowcase?.config ?? null,
      playback: {
        startedAt: 0,
        lastTickAt: 0,
        elapsed: 0,
        accelerationRate: state.openingShowcase?.playback?.accelerationRate ?? 3,
        accelerating: false,
      },
    };
    return;
  }
  const targetRoom = state.rooms[entrance.target];
  placePlayer(state, entrance.target, computeSpawn(targetRoom));
}

function canvasToWorld(state, clientX, clientY) {
  const rect = state.canvas.getBoundingClientRect();
  return { x: clientX - rect.left + state.camera.x, y: clientY - rect.top + state.camera.y };
}

function handleCanvasClick(state, event) {
  const room = state.rooms[state.currentRoomId];
  if (!room.clickMove) return;
  const point = canvasToWorld(state, event.clientX, event.clientY);

  if (room.movement === "network") {
    if (state.player.moveTo) return;
    const targetNode = nearestGraphNode(room, point.x, point.y);
    if (!targetNode) return;
    const path = buildGraphPath(room, state.player.graphNodeId, targetNode.id);
    if (path.length === 0 && targetNode.id !== state.player.graphNodeId) return;
    state.player.graphPath = path;
    return;
  }

  if (room.movement === "free") {
    const target = resolveMovementWithObstacles(room, { x: point.x, y: point.y }, point, state.player.radius);
    const path = buildFreePath(room, state.player.x, state.player.y, target.x, target.y);
    if (path.length === 0) return;
    state.player.clickTarget = path.shift() ?? null;
    state.player.pathQueue = path;
    return;
  }

  const snapped = toGridPoint(room, point.x, point.y);
  if (pointBlocked(room, snapped.x, snapped.y, state.player.radius)) return;
  const reachable = room.rangeLimited ? reachableCells(room, state) : null;
  if (room.rangeLimited && !reachable.has(`${snapped.gridX},${snapped.gridY}`)) return;

  if (room.previewMove === "hover") {
    const path = buildGridPath(room, state.player.gridX, state.player.gridY, snapped.gridX, snapped.gridY, reachable);
    if (path.length === 0 && (snapped.gridX !== state.player.gridX || snapped.gridY !== state.player.gridY)) return;
    setPreviewPath(state, path, { gridX: snapped.gridX, gridY: snapped.gridY });
    commitPreviewPath(state);
    return;
  }

  if (room.previewMove === "click") {
    if (state.player.previewTarget && state.player.previewTarget.gridX === snapped.gridX && state.player.previewTarget.gridY === snapped.gridY) {
      commitPreviewPath(state);
      return;
    }
    const path = buildGridPath(room, state.player.gridX, state.player.gridY, snapped.gridX, snapped.gridY, reachable);
    if (path.length === 0 && (snapped.gridX !== state.player.gridX || snapped.gridY !== state.player.gridY)) return;
    setPreviewPath(state, path, { gridX: snapped.gridX, gridY: snapped.gridY });
    return;
  }

  const path = buildGridPath(room, state.player.gridX, state.player.gridY, snapped.gridX, snapped.gridY, reachable);
  if (path.length === 0 && (snapped.gridX !== state.player.gridX || snapped.gridY !== state.player.gridY)) return;
  state.player.pathQueue = path;
  state.player.clickTarget = null;
}

function createDemoSystem() {
  const openingShowcase = createOpeningShowcaseDemo();
  const showcaseRooms = [
    createMovementDemoRoom(),
    createSprintDemoRoom(),
    createSprintTerrainRoom(),
    createGridMovementRoom(),
    createRangeMovementRoom(),
    createFreeClickRoom(),
    createGridClickRoom(),
    createRangeClickRoom(),
    createPreviewHoverRoom(),
    createPreviewTerrainCostRoom(),
    createPreviewClickRoom(),
    createNetworkConstraintRoom(),
    createNetworkKeyboardRoom(),
  ];
  const rooms = Object.fromEntries([createHubRoom([...showcaseRooms, openingShowcase]), ...showcaseRooms].map((room) => [room.id, room]));
  let state = null;
  let cleanup = [];
  let onExit = null;

  function loop(timestamp) {
    if (!state?.running) return;
    const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0);
    state.lastTime = timestamp;
    if (!state.openingShowcase?.active) {
      state.pulseTime += dt;
      updatePlayer(state, dt);
      updateCamera(state);
      tryTransitions(state);
      drawRoom(state.canvas.getContext("2d"), state.canvas, state);
    } else {
      drawOpeningShowcase(state.canvas.getContext("2d"), state.canvas, state, timestamp);
    }
    state.previousKeys = new Set(state.keys);
    state.frameId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!state) return;
    state.running = false;
    if (state.frameId) cancelAnimationFrame(state.frameId);
    cleanup.forEach((fn) => fn());
    cleanup = [];
    state = null;
  }

  function start({ canvas, onExit: exitHandler }) {
    stop();
    onExit = exitHandler;
    state = createState(canvas, rooms);
    state.openingShowcase = {
      active: false,
      enteredAt: 0,
      completed: false,
      config: {
        text: openingShowcase.message,
        ...openingShowcase.textOptions,
      },
      playback: {
        startedAt: 0,
        lastTickAt: 0,
        elapsed: 0,
        accelerationRate: 3,
        accelerating: false,
      },
    };
    placePlayer(state, "hub", { x: rooms.hub.world.width / 2, y: rooms.hub.world.height - 220 });
    state.running = true;
    state.lastTime = performance.now();

    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "w", "a", "s", "d", " ", "Shift"].includes(key)) event.preventDefault();
      if (state.openingShowcase?.active) {
        if (!state.openingShowcase.completed && key === " ") {
          state.openingShowcase.playback.accelerating = true;
          return;
        }
        if (!state.openingShowcase.completed) return;
        state.openingShowcase.active = false;
        state.openingShowcase.enteredAt = 0;
        state.openingShowcase.completed = false;
        state.openingShowcase.playback.startedAt = 0;
        state.openingShowcase.playback.lastTickAt = 0;
        state.openingShowcase.playback.elapsed = 0;
        state.openingShowcase.playback.accelerating = false;
        placePlayer(state, "hub", { x: rooms.hub.world.width / 2, y: rooms.hub.world.height - 220 });
        return;
      }
      if (key === "Backspace") {
        stop();
        onExit?.();
        return;
      }
      if (key === "Shift") {
        const room = state.rooms[state.currentRoomId];
        if (room.sprint) {
          if (state.player.stamina <= 0) {
            state.player.sprintTier = 0;
          } else {
            state.player.sprintTier = (state.player.sprintTier + 1) % 4;
          }
        }
        return;
      }
      if (key === " ") {
        const room = state.rooms[state.currentRoomId];
        if (room.previewMove) {
          commitPreviewPath(state);
          return;
        }
        if (room.rangeLimited && !state.player.moveTo) {
          resetTurnBudget(state, room);
          clearAutoMove(state);
        }
        return;
      }
      const currentRoom = state.rooms[state.currentRoomId];
      if (currentRoom.previewMove) {
        const directionMap = {
          ArrowUp: { x: 0, y: -1 },
          w: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 },
          s: { x: 0, y: 1 },
          ArrowLeft: { x: -1, y: 0 },
          a: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 },
          d: { x: 1, y: 0 },
        };
        const direction = directionMap[key];
        if (direction && !state.player.moveTo && state.player.pathQueue.length === 0) appendPreviewStep(state, currentRoom, direction.x, direction.y);
        return;
      }
      if (currentRoom.clickMove) clearAutoMove(state);
      state.keys.add(key);
    };

    const handleKeyUp = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (state?.openingShowcase?.active && key === " ") state.openingShowcase.playback.accelerating = false;
      state?.keys.delete(key);
    };

    const handleResize = () => {
      if (!state) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateCamera(state);
    };

    const handleClick = (event) => {
      if (!state) return;
      if (state.openingShowcase?.active) return;
      handleCanvasClick(state, event);
    };

    const handleMouseMove = (event) => {
      if (!state) return;
      if (state.openingShowcase?.active) return;
      const room = state.rooms[state.currentRoomId];
      if (room.previewMove !== "hover" || state.player.moveTo || state.player.pathQueue.length > 0) return;
      const point = canvasToWorld(state, event.clientX, event.clientY);
      const snapped = toGridPoint(room, point.x, point.y);
      const reachable = reachableCells(room, state);
      if (pointBlocked(room, snapped.x, snapped.y, state.player.radius) || (reachable && !reachable.has(`${snapped.gridX},${snapped.gridY}`))) {
        clearPreviewPath(state);
        return;
      }
      const path = buildGridPath(room, state.player.gridX, state.player.gridY, snapped.gridX, snapped.gridY, reachable);
      if (path.length === 0 && (snapped.gridX !== state.player.gridX || snapped.gridY !== state.player.gridY)) {
        clearPreviewPath(state);
        return;
      }
      setPreviewPath(state, path, { gridX: snapped.gridX, gridY: snapped.gridY });
    };

    const handleMouseLeave = () => {
      if (!state) return;
      const room = state.rooms[state.currentRoomId];
      if (room.previewMove === "hover") clearPreviewPath(state);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", handleResize);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    cleanup = [
      () => window.removeEventListener("keydown", handleKeyDown),
      () => window.removeEventListener("keyup", handleKeyUp),
      () => window.removeEventListener("resize", handleResize),
      () => canvas.removeEventListener("click", handleClick),
      () => canvas.removeEventListener("mousemove", handleMouseMove),
      () => canvas.removeEventListener("mouseleave", handleMouseLeave),
    ];

    handleResize();
    drawRoom(canvas.getContext("2d"), canvas, state);
    state.frameId = requestAnimationFrame(loop);
  }

  return { start, stop };
}

export function startDemo(canvas, onExit) {
  const demoSystem = createDemoSystem();
  demoSystem.start({ canvas, onExit });
  return {
    stop() {
      demoSystem.stop();
    },
  };
}
