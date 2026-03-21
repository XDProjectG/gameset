(() => {
  const ROOM_MARGIN = 64;
  const PLAYER_RADIUS = 18;
  const PLAYER_SPEED = 280;
  const GRID_STEP_DURATION = 0.2;
  const CAMERA_LERP = 0.12;
  const DEAD_ZONE = { x: 0.22, y: 0.18 };
  const GRID_CELL_SIZE = 72;
  const RANGE_LIMIT = 4;
  const FREE_NAV_CELL = 36;

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
      rangeLimited: options.rangeLimited ?? false,
      entrances: options.entrances ?? [],
      grid: options.grid ?? null,
      notes: options.notes ?? [],
      obstacles: options.obstacles ?? [],
    };
  }

  function createMovementDemoRoom() {
    return createRoom("free-walk-room", "自由走動房", { width: 1680, height: 1180 }, {
      movement: "free",
      entrances: [{ x: 1160, y: 880, width: 160, height: 120, target: "hub", label: "返回展示間" }],
      notes: ["自由連續空間移動。", "牆壁會阻擋玩家越界，鏡頭帶有死區並平滑跟隨。"],
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
      },
      camera: { x: 0, y: 0 },
      keys: new Set(),
      previousKeys: new Set(),
      turn: { budget: RANGE_LIMIT, originX: 0, originY: 0 },
      pulseTime: 0,
      lastTime: 0,
      running: false,
      frameId: null,
      canvas,
    };
  }

  function clearAutoMove(state) {
    state.player.pathQueue = [];
    state.player.clickTarget = null;
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

  function resetTurnBudget(state) {
    state.turn.budget = RANGE_LIMIT;
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
    if (room.rangeLimited) resetTurnBudget(state);
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
    } else {
      const resolved = resolveMovementWithObstacles(room, { x, y }, { x, y }, state.player.radius);
      state.player.x = resolved.x;
      state.player.y = resolved.y;
    }

    if (!room.rangeLimited) state.turn.budget = RANGE_LIMIT;
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
      const current = queue.shift();
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];
      neighbors.forEach((next) => {
        if (next.x < 0 || next.y < 0 || next.x >= metrics.columns || next.y >= metrics.rows) return;
        const nextCost = current.cost + 1;
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
    const queue = [{ x: fromX, y: fromY }];
    const cameFrom = new Map([[startKey, null]]);

    while (queue.length > 0) {
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
        if (cameFrom.has(key) || pointBlocked(room, world.x, world.y, PLAYER_RADIUS)) return;
        if (allowedSet && !allowedSet.has(key)) return;
        cameFrom.set(key, current);
        queue.push(next);
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
    if (!state.player.previewPath.length || state.player.moveTo || state.player.clickTarget) return false;
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
    const endpoint = previewEndpoint(state);
    const nextGridX = clamp(endpoint.gridX + dirX, 0, Math.max(0, metrics.columns - 1));
    const nextGridY = clamp(endpoint.gridY + dirY, 0, Math.max(0, metrics.rows - 1));
    if (nextGridX === endpoint.gridX && nextGridY === endpoint.gridY) return false;
    const reachable = reachableCells(room, state);
    if (reachable && !reachable.has(`${nextGridX},${nextGridY}`)) return false;
    const nextWorld = gridToWorld(room, nextGridX, nextGridY);
    if (pointBlocked(room, nextWorld.x, nextWorld.y, state.player.radius)) return false;

    const existingIndex = state.player.previewPath.findIndex((step) => step.gridX === nextGridX && step.gridY === nextGridY);
    if (existingIndex === state.player.previewPath.length - 2) {
      state.player.previewPath.pop();
      if (state.player.previewPath.length === 0) state.player.previewTarget = null;
      else {
        const last = state.player.previewPath[state.player.previewPath.length - 1];
        state.player.previewTarget = { gridX: last.gridX, gridY: last.gridY };
      }
      return true;
    }
    if (existingIndex !== -1 || state.player.previewPath.length >= state.turn.budget) return false;
    state.player.previewPath.push({ gridX: nextGridX, gridY: nextGridY });
    state.player.previewTarget = { gridX: nextGridX, gridY: nextGridY };
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
    if (!direction) return;
    const length = Math.hypot(direction.x, direction.y) || 1;
    const next = { x: state.player.x + (direction.x / length) * PLAYER_SPEED * dt, y: state.player.y + (direction.y / length) * PLAYER_SPEED * dt };
    const resolved = resolveMovementWithObstacles(room, { x: state.player.x, y: state.player.y }, next, state.player.radius);
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
        if (room.rangeLimited) state.turn.budget = RANGE_LIMIT;
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

  function updatePlayer(state, dt) {
    const room = state.rooms[state.currentRoomId];
    if (room.movement === "grid") updateGridPlayer(state, room, dt);
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
    if (!room.previewMove) return;
    const visiblePath = state.player.previewPath.length > 0
      ? state.player.previewPath
      : [
        ...(state.player.moveTo ? [{ gridX: state.player.moveTo.gridX, gridY: state.player.moveTo.gridY }] : []),
        ...state.player.pathQueue,
      ];
    if (visiblePath.length === 0) return;
    const points = [{ x: state.player.x, y: state.player.y }, ...visiblePath.map((step) => gridToWorld(room, step.gridX, step.gridY))];
    ctx.strokeStyle = "rgba(255, 216, 97, 0.9)";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 216, 97, 0.24)";
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
    ctx.fillStyle = "#ffd861";
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

    drawObstacles(ctx, room);
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
      ? room.clickMove ? "滑鼠點擊地面 / 方向鍵移動，Backspace 退出展示間" : "WASD / 方向鍵移動，Backspace 退出展示間"
      : room.previewMove === "hover" ? "方向鍵建立路徑、滑鼠懸停預覽，Space / 左鍵確認移動，Backspace 退出"
        : room.previewMove === "click" ? "方向鍵建立路徑、左鍵點選/再點確認，Space 也可移動，Backspace 退出"
          : room.clickMove ? "滑鼠點擊或按住方向鍵移動，Space 結束回合，Backspace 退出" : "按住方向鍵 / WASD 持續逐格移動，Backspace 退出展示間";
    ctx.fillText(controlLine, 36, 82);
    room.notes.forEach((line, index) => ctx.fillText(line, 36, 108 + index * 22));
    if (room.movement === "grid") ctx.fillText(`目前格位：(${state.player.gridX}, ${state.player.gridY})`, 36, room.rangeLimited ? 152 : 130);
    if (room.rangeLimited) ctx.fillText(`本次移動起點：(${state.turn.originX}, ${state.turn.originY})｜移動力上限 ${state.turn.budget}`, 36, 174);
    if (room.previewMove) {
      const visibleSteps = state.player.previewPath.length + state.player.pathQueue.length + (state.player.moveTo ? 1 : 0);
      ctx.fillText(`預覽步數：${visibleSteps}｜按 Space 依路徑移動`, 36, 196);
    }
  }

  function computeSpawn(targetRoom) {
    if (targetRoom.id === "hub") return { x: targetRoom.world.width / 2, y: targetRoom.world.height - 220 };
    if (targetRoom.movement === "grid") return { x: ROOM_MARGIN + GRID_CELL_SIZE * 2.5, y: targetRoom.world.height / 2 };
    return { x: ROOM_MARGIN + 180, y: targetRoom.world.height / 2 };
  }

  function tryTransitions(state) {
    const room = state.rooms[state.currentRoomId];
    const entrance = room.entrances.find((item) => rectContains(item, state.player.x, state.player.y));
    if (!entrance) return;
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
      if (state.player.previewTarget) {
        clearPreviewPath(state);
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
    const showcaseRooms = [
      createMovementDemoRoom(),
      createGridMovementRoom(),
      createRangeMovementRoom(),
      createFreeClickRoom(),
      createGridClickRoom(),
      createRangeClickRoom(),
      createPreviewHoverRoom(),
      createPreviewClickRoom(),
    ];
    const rooms = Object.fromEntries([createHubRoom(showcaseRooms), ...showcaseRooms].map((room) => [room.id, room]));
    let state = null;
    let cleanup = [];
    let onExit = null;

    function loop(timestamp) {
      if (!state?.running) return;
      const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0);
      state.lastTime = timestamp;
      state.pulseTime += dt;
      updatePlayer(state, dt);
      updateCamera(state);
      tryTransitions(state);
      drawRoom(state.canvas.getContext("2d"), state.canvas, state);
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
      placePlayer(state, "hub", { x: rooms.hub.world.width / 2, y: rooms.hub.world.height - 220 });
      state.running = true;
      state.lastTime = performance.now();

      const handleKeyDown = (event) => {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "w", "a", "s", "d", " "].includes(key)) event.preventDefault();
        if (key === "Backspace") {
          stop();
          onExit?.();
          return;
        }
        if (key === " ") {
          const room = state.rooms[state.currentRoomId];
          if (room.previewMove) {
            commitPreviewPath(state);
            return;
          }
          if (room.rangeLimited && !state.player.moveTo) {
            resetTurnBudget(state);
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
        handleCanvasClick(state, event);
      };

      const handleMouseMove = (event) => {
        if (!state) return;
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

  window.DemoSystem = createDemoSystem();
})();
