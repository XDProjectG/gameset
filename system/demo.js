(() => {
  const ROOM_MARGIN = 64;
  const PLAYER_RADIUS = 18;
  const PLAYER_SPEED = 280;
  const GRID_STEP_DURATION = 0.2;
  const CAMERA_LERP = 0.12;
  const DEAD_ZONE = { x: 0.22, y: 0.18 };
  const GRID_CELL_SIZE = 72;

  function createRoom(id, name, world, options = {}) {
    return {
      id,
      name,
      world,
      movement: options.movement ?? "free",
      entrances: options.entrances ?? [],
      grid: options.grid ?? null,
      notes: options.notes ?? [],
    };
  }

  function createMovementDemoRoom() {
    return createRoom("free-walk-room", "自由走動房", { width: 1680, height: 1180 }, {
      movement: "free",
      entrances: [
        { x: 1160, y: 880, width: 160, height: 120, target: "hub", label: "返回展示間" },
      ],
      notes: [
        "自由連續空間移動。",
        "牆壁會阻擋玩家越界，鏡頭帶有死區並平滑跟隨。",
      ],
    });
  }

  function createGridMovementRoom() {
    return createRoom("grid-room", "方格移動房", { width: 1728, height: 1224 }, {
      movement: "grid",
      entrances: [
        { x: 1296, y: 864, width: GRID_CELL_SIZE * 2, height: GRID_CELL_SIZE * 2, target: "hub", label: "返回展示間" },
      ],
      grid: { cellSize: GRID_CELL_SIZE },
      notes: [
        "戰盤式方格移動：一次走一格，但位移動畫保持平滑。",
        "沿用相同的鏡頭死區與平滑追蹤系統。",
      ],
    });
  }

  function createHubRoom(rooms) {
    const world = { width: 1860, height: 1320 };
    const startX = 420;
    const startY = 360;
    const gapX = 280;
    const gapY = 220;
    const entrances = rooms.map((room, index) => ({
      x: startX + (index % 3) * gapX,
      y: startY + Math.floor(index / 3) * gapY,
      width: 200,
      height: 132,
      target: room.id,
      label: room.name,
    }));
    return createRoom("hub", "展示間入口", world, {
      movement: "free",
      entrances,
      notes: [
        "這一層會自動為所有展示房生成入口。",
        "可用自由走動方式進入任何展示房。",
      ],
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

  function toGridPoint(room, x, y) {
    const cellSize = room.grid.cellSize;
    const gridMinX = ROOM_MARGIN + cellSize / 2;
    const gridMinY = ROOM_MARGIN + cellSize / 2;
    const columns = Math.floor((room.world.width - ROOM_MARGIN * 2) / cellSize);
    const rows = Math.floor((room.world.height - ROOM_MARGIN * 2) / cellSize);
    const gridX = clamp(Math.round((x - gridMinX) / cellSize), 0, Math.max(0, columns - 1));
    const gridY = clamp(Math.round((y - gridMinY) / cellSize), 0, Math.max(0, rows - 1));
    return {
      gridX,
      gridY,
      x: gridMinX + gridX * cellSize,
      y: gridMinY + gridY * cellSize,
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
      },
      camera: { x: 0, y: 0 },
      keys: new Set(),
      previousKeys: new Set(),
      lastTime: 0,
      running: false,
      frameId: null,
      canvas,
    };
  }

  function syncGridPosition(state, room) {
    if (room.movement !== "grid") return;
    const snapped = toGridPoint(room, state.player.x, state.player.y);
    state.player.gridX = snapped.gridX;
    state.player.gridY = snapped.gridY;
    state.player.x = snapped.x;
    state.player.y = snapped.y;
    state.player.moveFrom = null;
    state.player.moveTo = null;
    state.player.moveProgress = 0;
  }

  function placePlayer(state, roomId, spawn = null) {
    state.currentRoomId = roomId;
    const room = state.rooms[roomId];
    const x = spawn?.x ?? room.world.width / 2;
    const y = spawn?.y ?? room.world.height / 2;
    const pos = resolveWallCollision({ x, y }, state.player.radius, room);
    state.player.x = pos.x;
    state.player.y = pos.y;
    syncGridPosition(state, room);

    state.camera.x = clamp(state.player.x - state.canvas.width / 2, 0, Math.max(0, room.world.width - state.canvas.width));
    state.camera.y = clamp(state.player.y - state.canvas.height / 2, 0, Math.max(0, room.world.height - state.canvas.height));
  }

  function justPressed(state, key) {
    return state.keys.has(key) && !state.previousKeys.has(key);
  }

  function updateFreePlayer(state, room, dt) {
    const left = state.keys.has("ArrowLeft") || state.keys.has("a");
    const right = state.keys.has("ArrowRight") || state.keys.has("d");
    const up = state.keys.has("ArrowUp") || state.keys.has("w");
    const down = state.keys.has("ArrowDown") || state.keys.has("s");

    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    if (dx === 0 && dy === 0) return;

    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;

    const next = {
      x: state.player.x + dx * PLAYER_SPEED * dt,
      y: state.player.y + dy * PLAYER_SPEED * dt,
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

    const direction =
      justPressed(state, "ArrowLeft") || justPressed(state, "a") ? { x: -1, y: 0 } :
      justPressed(state, "ArrowRight") || justPressed(state, "d") ? { x: 1, y: 0 } :
      justPressed(state, "ArrowUp") || justPressed(state, "w") ? { x: 0, y: -1 } :
      justPressed(state, "ArrowDown") || justPressed(state, "s") ? { x: 0, y: 1 } :
      null;

    if (!direction) return;

    const cellSize = room.grid.cellSize;
    const columns = Math.floor((room.world.width - ROOM_MARGIN * 2) / cellSize);
    const rows = Math.floor((room.world.height - ROOM_MARGIN * 2) / cellSize);
    const nextGridX = clamp(state.player.gridX + direction.x, 0, Math.max(0, columns - 1));
    const nextGridY = clamp(state.player.gridY + direction.y, 0, Math.max(0, rows - 1));

    if (nextGridX === state.player.gridX && nextGridY === state.player.gridY) return;

    const gridMinX = ROOM_MARGIN + cellSize / 2;
    const gridMinY = ROOM_MARGIN + cellSize / 2;
    state.player.moveFrom = { x: state.player.x, y: state.player.y, gridX: state.player.gridX, gridY: state.player.gridY };
    state.player.moveTo = {
      x: gridMinX + nextGridX * cellSize,
      y: gridMinY + nextGridY * cellSize,
      gridX: nextGridX,
      gridY: nextGridY,
    };
    state.player.moveProgress = 0;
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

    if (playerScreenX < viewHalfW - deadHalfW) {
      targetX = state.player.x - (viewHalfW - deadHalfW);
    } else if (playerScreenX > viewHalfW + deadHalfW) {
      targetX = state.player.x - (viewHalfW + deadHalfW);
    }

    if (playerScreenY < viewHalfH - deadHalfH) {
      targetY = state.player.y - (viewHalfH - deadHalfH);
    } else if (playerScreenY > viewHalfH + deadHalfH) {
      targetY = state.player.y - (viewHalfH + deadHalfH);
    }

    targetX = clamp(targetX, 0, Math.max(0, room.world.width - state.canvas.width));
    targetY = clamp(targetY, 0, Math.max(0, room.world.height - state.canvas.height));

    state.camera.x += (targetX - state.camera.x) * CAMERA_LERP;
    state.camera.y += (targetY - state.camera.y) * CAMERA_LERP;
  }

  function drawGridOverlay(ctx, room) {
    if (room.movement !== "grid") return;
    const cellSize = room.grid.cellSize;
    ctx.strokeStyle = "rgba(220,235,255,0.18)";
    ctx.lineWidth = 1;
    for (let x = ROOM_MARGIN; x <= room.world.width - ROOM_MARGIN; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, ROOM_MARGIN);
      ctx.lineTo(x, room.world.height - ROOM_MARGIN);
      ctx.stroke();
    }
    for (let y = ROOM_MARGIN; y <= room.world.height - ROOM_MARGIN; y += cellSize) {
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

    if (room.movement === "grid") {
      drawGridOverlay(ctx, room);
    } else {
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

    ctx.fillStyle = room.movement === "grid" ? "#8ff0c4" : "#f3d37c";
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const deadZoneWidth = canvas.width * DEAD_ZONE.x;
    const deadZoneHeight = canvas.height * DEAD_ZONE.y;
    const deadZoneX = canvas.width / 2 - deadZoneWidth / 2;
    const deadZoneY = canvas.height / 2 - deadZoneHeight / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(deadZoneX, deadZoneY, deadZoneWidth, deadZoneHeight);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(12,19,29,0.76)";
    ctx.fillRect(18, 18, 420, 148);
    ctx.strokeStyle = "rgba(175,198,231,0.4)";
    ctx.strokeRect(18, 18, 420, 148);
    ctx.fillStyle = "#ecf2ff";
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.font = "22px 'Noto Sans TC', sans-serif";
    ctx.fillText(room.name, 36, 52);
    ctx.font = "15px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#c7d9f8";
    ctx.fillText(room.movement === "grid" ? "方向鍵 / WASD 逐格移動，Backspace 退出展示間" : "WASD / 方向鍵移動，Backspace 退出展示間", 36, 82);
    room.notes.forEach((line, index) => ctx.fillText(line, 36, 108 + index * 22));
    if (room.movement === "grid") {
      ctx.fillText(`目前格位：(${state.player.gridX}, ${state.player.gridY})`, 36, 152);
    }
  }

  function computeSpawn(targetRoom, sourceRoomId) {
    if (targetRoom.id === "hub") {
      return { x: targetRoom.world.width / 2, y: targetRoom.world.height - 220 };
    }
    if (targetRoom.movement === "grid") {
      return { x: ROOM_MARGIN + GRID_CELL_SIZE * 2.5, y: targetRoom.world.height / 2 };
    }
    return sourceRoomId === "hub"
      ? { x: ROOM_MARGIN + 180, y: targetRoom.world.height / 2 }
      : { x: targetRoom.world.width / 2, y: targetRoom.world.height / 2 };
  }

  function tryTransitions(state) {
    const room = state.rooms[state.currentRoomId];
    const entrance = room.entrances.find((item) => rectContains(item, state.player.x, state.player.y));
    if (!entrance) return;
    const targetRoom = state.rooms[entrance.target];
    placePlayer(state, entrance.target, computeSpawn(targetRoom, room.id));
  }

  function createDemoSystem() {
    const showcaseRooms = [createMovementDemoRoom(), createGridMovementRoom()];
    const rooms = Object.fromEntries([createHubRoom(showcaseRooms), ...showcaseRooms].map((room) => [room.id, room]));
    let state = null;
    let cleanup = [];
    let onExit = null;

    function loop(timestamp) {
      if (!state?.running) return;
      const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0);
      state.lastTime = timestamp;
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
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "w", "a", "s", "d"].includes(key)) {
          event.preventDefault();
        }
        if (key === "Backspace") {
          stop();
          onExit?.();
          return;
        }
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

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("resize", handleResize);
      cleanup = [
        () => window.removeEventListener("keydown", handleKeyDown),
        () => window.removeEventListener("keyup", handleKeyUp),
        () => window.removeEventListener("resize", handleResize),
      ];

      handleResize();
      drawRoom(canvas.getContext("2d"), canvas, state);
      state.frameId = requestAnimationFrame(loop);
    }

    return { start, stop };
  }

  window.DemoSystem = createDemoSystem();
})();
