(() => {
  const ROOM_MARGIN = 64;
  const PLAYER_RADIUS = 18;
  const PLAYER_SPEED = 280;
  const CAMERA_LERP = 0.12;
  const DEAD_ZONE = { x: 0.22, y: 0.18 };

  function createRoom(id, name, world, entrances = []) {
    return { id, name, world, entrances };
  }

  function createMovementDemoRoom() {
    return createRoom(
      "free-walk-room",
      "自由走動房",
      { width: 1680, height: 1180 },
      [
        { x: 1160, y: 880, width: 160, height: 120, target: "hub", label: "返回展示間" },
      ],
    );
  }

  function createHubRoom(rooms) {
    const world = { width: 1860, height: 1320 };
    const startX = 520;
    const startY = 420;
    const gap = 280;
    const entrances = rooms.map((room, index) => ({
      x: startX + (index % 3) * gap,
      y: startY + Math.floor(index / 3) * 240,
      width: 180,
      height: 132,
      target: room.id,
      label: room.name,
    }));
    return createRoom("hub", "展示間入口", world, entrances);
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

  function drawRoom(ctx, canvas, state) {
    const room = state.rooms[state.currentRoomId];
    const camera = state.camera;

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    ctx.fillStyle = "#152338";
    ctx.fillRect(0, 0, room.world.width, room.world.height);

    ctx.strokeStyle = "#9a7d4f";
    ctx.lineWidth = ROOM_MARGIN;
    ctx.strokeRect(ROOM_MARGIN / 2, ROOM_MARGIN / 2, room.world.width - ROOM_MARGIN, room.world.height - ROOM_MARGIN);

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

    ctx.fillStyle = "#f3d37c";
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
    ctx.fillRect(18, 18, 380, 122);
    ctx.strokeStyle = "rgba(175,198,231,0.4)";
    ctx.strokeRect(18, 18, 380, 122);
    ctx.fillStyle = "#ecf2ff";
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.font = "22px 'Noto Sans TC', sans-serif";
    ctx.fillText(room.name, 36, 52);
    ctx.font = "15px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#c7d9f8";
    ctx.fillText("WASD / 方向鍵移動，Backspace 退出展示間", 36, 82);
    ctx.fillText("鏡頭帶有死區：玩家在框內移動時鏡頭不跟，越界後平滑跟隨。", 36, 108);
    ctx.fillText(`目前房間：${room.id}`, 36, 130);
  }

  function createState(canvas, rooms) {
    return {
      rooms,
      currentRoomId: "hub",
      player: { x: 0, y: 0, radius: PLAYER_RADIUS },
      camera: { x: 0, y: 0 },
      keys: new Set(),
      lastTime: 0,
      running: false,
      frameId: null,
      canvas,
    };
  }

  function placePlayer(state, roomId, spawn = null) {
    state.currentRoomId = roomId;
    const room = state.rooms[roomId];
    const x = spawn?.x ?? room.world.width / 2;
    const y = spawn?.y ?? room.world.height / 2;
    const pos = resolveWallCollision({ x, y }, state.player.radius, room);
    state.player.x = pos.x;
    state.player.y = pos.y;

    state.camera.x = clamp(state.player.x - state.canvas.width / 2, 0, room.world.width - state.canvas.width);
    state.camera.y = clamp(state.player.y - state.canvas.height / 2, 0, room.world.height - state.canvas.height);
  }

  function updatePlayer(state, dt) {
    const room = state.rooms[state.currentRoomId];
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

  function tryTransitions(state) {
    const room = state.rooms[state.currentRoomId];
    const entrance = room.entrances.find((item) => rectContains(item, state.player.x, state.player.y));
    if (!entrance) return;

    const targetRoom = state.rooms[entrance.target];
    const spawn = entrance.target === "hub"
      ? { x: targetRoom.world.width / 2, y: targetRoom.world.height - 220 }
      : { x: ROOM_MARGIN + 180, y: targetRoom.world.height / 2 };
    placePlayer(state, entrance.target, spawn);
  }

  function createDemoSystem() {
    const showcaseRooms = [createMovementDemoRoom()];
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
