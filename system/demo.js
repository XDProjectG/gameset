(() => {
  const ROOM_MARGIN = 64;
  const PLAYER_RADIUS = 18;
  const PLAYER_SPEED = 280;
  const GRID_STEP_DURATION = 0.2;
  const CAMERA_LERP = 0.12;
  const DEAD_ZONE = { x: 0.22, y: 0.18 };
  const GRID_CELL_SIZE = 72;
  const RANGE_LIMIT = 4;

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
      notes: ["滑鼠點擊地面後，玩家會沿合理路徑持續走向目的地。", "仍保留自由空間與平滑鏡頭。"],
    });
  }

  function createGridClickRoom() {
    return createRoom("grid-click-room", "方格點擊尋路房", { width: 1728, height: 1224 }, {
      movement: "grid",
      clickMove: true,
      entrances: [{ x: 1296, y: 864, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
      grid: { cellSize: GRID_CELL_SIZE },
      notes: ["點擊任一可到達的格子後，玩家會按格子規則自動走過去。", "鍵盤按住也能持續逐格移動。"],
    });
  }

  function createRangeClickRoom() {
    return createRoom("range-click-room", "移動力點擊方格房", { width: 1728, height: 1224 }, {
      movement: "grid",
      clickMove: true,
      rangeLimited: true,
      entrances: [{ x: 1224, y: 792, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" }],
      grid: { cellSize: GRID_CELL_SIZE },
      notes: ["可點擊本回合移動範圍內的格子，玩家會用格子路徑自動移動。", "移動力用完或想提前結束時，按 Space 開啟下一回合。"],
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

  function resolveWallCollision(pos, radius, room) {
    return {
      x: clamp(pos.x, ROOM_MARGIN + radius, room.world.width - ROOM_MARGIN - radius),
      y: clamp(pos.y, ROOM_MARGIN + radius, room.world.height - ROOM_MARGIN - radius),
    };
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
      },
      camera: { x: 0, y: 0 },
      keys: new Set(),
      previousKeys: new Set(),
      turn: {
        anchorX: 0,
        anchorY: 0,
        budget: RANGE_LIMIT,
      },
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

  function resetMotionState(state) {
    state.player.moveFrom = null;
    state.player.moveTo = null;
    state.player.moveProgress = 0;
    clearAutoMove(state);
  }

  function resetTurnBudget(state) {
    state.turn.anchorX = state.player.gridX;
    state.turn.anchorY = state.player.gridY;
    state.turn.budget = RANGE_LIMIT;
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
    const pos = resolveWallCollision({ x, y }, state.player.radius, room);
    resetMotionState(state);
    state.player.x = pos.x;
    state.player.y = pos.y;
    syncGridPosition(state, room);
    if (!room.rangeLimited) state.turn.budget = RANGE_LIMIT;

    state.camera.x = clamp(state.player.x - state.canvas.width / 2, 0, Math.max(0, room.world.width - state.canvas.width));
    state.camera.y = clamp(state.player.y - state.canvas.height / 2, 0, Math.max(0, room.world.height - state.canvas.height));
  }

  function justPressed(state, key) {
    return state.keys.has(key) && !state.previousKeys.has(key);
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

  function withinRange(state, gridX, gridY) {
    return Math.abs(gridX - state.turn.anchorX) + Math.abs(gridY - state.turn.anchorY) <= RANGE_LIMIT;
  }

  function buildManhattanPath(fromX, fromY, toX, toY) {
    const steps = [];
    let x = fromX;
    let y = fromY;
    while (x !== toX) {
      x += x < toX ? 1 : -1;
      steps.push({ gridX: x, gridY: y });
    }
    while (y !== toY) {
      y += y < toY ? 1 : -1;
      steps.push({ gridX: x, gridY: y });
    }
    return steps;
  }

  function startGridStep(state, room, nextGridX, nextGridY) {
    if (room.rangeLimited && !withinRange(state, nextGridX, nextGridY)) return false;
    if (nextGridX === state.player.gridX && nextGridY === state.player.gridY) return false;

    const target = gridToWorld(room, nextGridX, nextGridY);
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
        state.player.clickTarget = null;
        return;
      }
      const step = Math.min(distance, PLAYER_SPEED * dt);
      const next = {
        x: state.player.x + (dx / distance) * step,
        y: state.player.y + (dy / distance) * step,
      };
      const resolved = resolveWallCollision(next, state.player.radius, room);
      state.player.x = resolved.x;
      state.player.y = resolved.y;
      return;
    }

    const direction = freeDirection(state);
    if (!direction) return;
    const length = Math.hypot(direction.x, direction.y) || 1;
    const next = {
      x: state.player.x + (direction.x / length) * PLAYER_SPEED * dt,
      y: state.player.y + (direction.y / length) * PLAYER_SPEED * dt,
    };
    const resolved = resolveWallCollision(next, state.player.radius, room);
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
      }
      return;
    }

    if (state.player.pathQueue.length > 0) {
      const next = state.player.pathQueue.shift();
      if (!startGridStep(state, room, next.gridX, next.gridY)) {
        state.player.pathQueue = [];
      }
      return;
    }

    const direction = primaryDirection(state);
    if (!direction) return;

    const metrics = gridMetrics(room);
    const nextGridX = clamp(state.player.gridX + direction.x, 0, Math.max(0, metrics.columns - 1));
    const nextGridY = clamp(state.player.gridY + direction.y, 0, Math.max(0, metrics.rows - 1));
    startGridStep(state, room, nextGridX, nextGridY);
  }

  function updatePlayer(state, dt) {
    const room = state.rooms[state.currentRoomId];
    if (room.movement === "grid") {
      updateGridPlayer(state, room, dt);
    } else {
      updateFreePlayer(state, room, dt);
    }
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

  function drawGridOverlay(ctx, room, state) {
    if (room.movement !== "grid") return;
    const metrics = gridMetrics(room);

    if (room.rangeLimited) {
      const pulse = 0.32 + (Math.sin(state.pulseTime * 3) + 1) * 0.18;
      for (let y = 0; y < metrics.rows; y += 1) {
        for (let x = 0; x < metrics.columns; x += 1) {
          if (!withinRange(state, x, y)) continue;
          const wx = ROOM_MARGIN + x * metrics.cellSize;
          const wy = ROOM_MARGIN + y * metrics.cellSize;
          ctx.fillStyle = `rgba(121, 188, 255, ${pulse})`;
          ctx.fillRect(wx, wy, metrics.cellSize, metrics.cellSize);
        }
      }
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

    drawEntrances(ctx, state, room);

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

    ctx.fillStyle = "rgba(12,19,29,0.76)";
    ctx.fillRect(18, 18, 500, room.rangeLimited ? 176 : 152);
    ctx.strokeStyle = "rgba(175,198,231,0.4)";
    ctx.strokeRect(18, 18, 500, room.rangeLimited ? 176 : 152);
    ctx.fillStyle = "#ecf2ff";
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.font = "22px 'Noto Sans TC', sans-serif";
    ctx.fillText(room.name, 36, 52);
    ctx.font = "15px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#c7d9f8";

    const controlLine = room.movement === "free"
      ? room.clickMove ? "滑鼠點擊地面 / 方向鍵移動，Backspace 退出展示間" : "WASD / 方向鍵移動，Backspace 退出展示間"
      : room.clickMove ? "滑鼠點擊或按住方向鍵移動，Space 結束回合，Backspace 退出" : "按住方向鍵 / WASD 持續逐格移動，Backspace 退出展示間";
    ctx.fillText(controlLine, 36, 82);
    room.notes.forEach((line, index) => ctx.fillText(line, 36, 108 + index * 22));
    if (room.movement === "grid") ctx.fillText(`目前格位：(${state.player.gridX}, ${state.player.gridY})`, 36, room.rangeLimited ? 152 : 130);
    if (room.rangeLimited) ctx.fillText(`剩餘移動力：${state.turn.budget}`, 36, 174);
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
    return {
      x: clientX - rect.left + state.camera.x,
      y: clientY - rect.top + state.camera.y,
    };
  }

  function handleCanvasClick(state, event) {
    const room = state.rooms[state.currentRoomId];
    if (!room.clickMove) return;
    const point = canvasToWorld(state, event.clientX, event.clientY);

    if (room.movement === "free") {
      const target = resolveWallCollision(point, state.player.radius, room);
      state.player.clickTarget = target;
      state.player.pathQueue = [];
      return;
    }

    const snapped = toGridPoint(room, point.x, point.y);
    if (room.rangeLimited && !withinRange(state, snapped.gridX, snapped.gridY)) return;
    const path = buildManhattanPath(state.player.gridX, state.player.gridY, snapped.gridX, snapped.gridY);
    if (room.rangeLimited && path.length > state.turn.budget) return;
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

      const room = state.rooms[state.currentRoomId];
      if (room.rangeLimited && state.player.moveFrom && !state.player.moveTo) {
        state.turn.budget = Math.max(0, RANGE_LIMIT - (Math.abs(state.player.gridX - state.turn.anchorX) + Math.abs(state.player.gridY - state.turn.anchorY)));
      } else if (room.rangeLimited && !state.player.moveTo) {
        state.turn.budget = Math.max(0, RANGE_LIMIT - (Math.abs(state.player.gridX - state.turn.anchorX) + Math.abs(state.player.gridY - state.turn.anchorY)));
      }

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
          if (room.rangeLimited && !state.player.moveTo) {
            resetTurnBudget(state);
            clearAutoMove(state);
          }
          return;
        }
        clearAutoMove(state);
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

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("resize", handleResize);
      canvas.addEventListener("click", handleClick);
      cleanup = [
        () => window.removeEventListener("keydown", handleKeyDown),
        () => window.removeEventListener("keyup", handleKeyUp),
        () => window.removeEventListener("resize", handleResize),
        () => canvas.removeEventListener("click", handleClick),
      ];

      handleResize();
      drawRoom(canvas.getContext("2d"), canvas, state);
      state.frameId = requestAnimationFrame(loop);
    }

    return { start, stop };
  }

  window.DemoSystem = createDemoSystem();
})();
