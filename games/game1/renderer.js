(() => {
  function fillRoundRect(ctx, x, y, w, h, r, fill, stroke = null) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const chars = [...text];
    const lines = [];
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function findHit(list, x, y) {
    return list.find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) || null;
  }

  function drawOpeningScene(ctx, canvas, state) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const chars = [...state.opening.text];
    const fontSize = Math.max(28, Math.min(42, canvas.height * 0.045));
    const lineGap = fontSize * 1.15;
    const columnGap = fontSize * 1.35;
    const top = 72;
    const bottom = canvas.height - 120;
    const usableHeight = Math.max(lineGap, bottom - top);
    const rowsPerColumn = Math.max(1, Math.floor(usableHeight / lineGap));
    const totalColumns = Math.ceil(chars.length / rowsPerColumn);
    const right = canvas.width - 110;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `${fontSize}px 'Noto Serif TC', 'Noto Sans TC', serif`;

    chars.forEach((char, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = right - column * columnGap;
      const y = top + row * lineGap;
      const alpha = Math.max(0, Math.min(1, state.opening.fadeProgress - index));
      if (alpha <= 0) return;

      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(char, x, y);
    });

    const titleAlpha = Math.min(1, 0.25 + state.opening.fadeProgress / 14);
    ctx.fillStyle = `rgba(255,255,255,${titleAlpha})`;
    ctx.font = "28px 'Noto Serif TC', 'Noto Sans TC', serif";
    ctx.fillText("三國志：州郡經略", Math.max(120, right - totalColumns * columnGap - 100), top);

    ctx.font = "16px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "rgba(220,228,240,0.9)";
    const hint = state.opening.completedAt ? "任意鍵或點擊滑鼠可立即進入主畫面" : "開場白播放中，亦可按任意鍵跳過";
    ctx.fillText(hint, canvas.width / 2, canvas.height - 48);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function drawTitleScene(ctx, canvas, state, uiLayout) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#1a2537");
    gradient.addColorStop(0.55, "#101726");
    gradient.addColorStop(1, "#080b12");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let i = 0; i < 7; i += 1) {
      ctx.fillRect(70 + i * 120, 90 + (i % 2) * 36, 56, canvas.height - 220);
    }

    ctx.fillStyle = "#f3f5fa";
    ctx.textAlign = "center";
    ctx.font = "40px 'Noto Serif TC', 'Noto Sans TC', serif";
    ctx.fillText("三國志：州郡經略", canvas.width / 2, 140);
    ctx.font = "18px 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "#b8c9e8";
    ctx.fillText("以正史《三國志》為背景的 2D Canvas 策略原型", canvas.width / 2, 180);

    const panel = {
      x: canvas.width / 2 - 220,
      y: 230,
      w: 440,
      h: 250,
    };
    fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 18, "rgba(15,23,37,0.84)", "rgba(125,153,196,0.5)");

    uiLayout.titleButtons = [];
    window.SGZModel.titleActions.forEach((action, idx) => {
      const button = {
        key: action.key,
        x: panel.x + 60,
        y: panel.y + 44 + idx * 62,
        w: panel.w - 120,
        h: 44,
      };
      const isHover = state.hoverTitleAction === action.key;
      fillRoundRect(ctx, button.x, button.y, button.w, button.h, 10, isHover ? "rgba(66,96,132,0.92)" : "rgba(31,50,76,0.85)", "rgba(109,134,172,0.88)");
      ctx.fillStyle = "#ecf2ff";
      ctx.font = "18px 'Noto Sans TC', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(action.label, button.x + button.w / 2, button.y + button.h / 2);
      uiLayout.titleButtons.push(button);
    });

    if (state.titleMessage) {
      ctx.font = "16px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#cde6ff";
      ctx.fillText(state.titleMessage, canvas.width / 2, panel.y + panel.h - 26);
    }

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function drawMapBackground(ctx, canvas) {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "#2f4d36");
    g.addColorStop(0.5, "#496447");
    g.addColorStop(1, "#2f5063");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(220,240,255,0.08)";
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, (canvas.height / 8) * i + 30);
      ctx.bezierCurveTo(canvas.width * 0.3, (canvas.height / 8) * i, canvas.width * 0.7, (canvas.height / 8) * i + 50, canvas.width, (canvas.height / 8) * i + 20);
      ctx.stroke();
    }
  }

  function cityToPixel(canvas, city) {
    return { x: city.x * canvas.width, y: city.y * canvas.height };
  }

  function drawCities(ctx, canvas, state, uiLayout) {
    uiLayout.cityHit = [];

    window.SGZModel.passes.forEach((pass) => {
      const x = pass.x * canvas.width;
      const y = pass.y * canvas.height;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ad6f4f";
      ctx.strokeStyle = "#2d1a11";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    });

    state.cities.forEach((city) => {
      const { x, y } = cityToPixel(canvas, city);
      const radius = city.major ? 12 : 9;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = city.major ? "#f0ba53" : "#e4d7b4";
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (city.id === state.selectedCityId) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = "#f7fbff";
      ctx.font = "15px 'Noto Sans TC', sans-serif";
      ctx.fillText(city.name, x - 18, y + 24);

      uiLayout.cityHit.push({ id: city.id, x, y, r: radius + 8 });
    });
  }

  function drawCanvasPanels(ctx, canvas, state, uiLayout) {
    const city = window.SGZModel.selectedCity(state);

    const timePanel = { x: 18, y: 18, w: 250, h: 90 };
    fillRoundRect(ctx, timePanel.x, timePanel.y, timePanel.w, timePanel.h, 12, "rgba(20,32,48,0.72)", "rgba(125,153,196,0.45)");
    ctx.fillStyle = "#ecf2ff";
    ctx.font = "18px 'Noto Sans TC', sans-serif";
    ctx.fillText("時間", timePanel.x + 16, timePanel.y + 28);
    ctx.font = "16px 'Noto Sans TC', sans-serif";
    ctx.fillText(window.SGZModel.formatDate(state), timePanel.x + 16, timePanel.y + 58);

    const cityPanel = { x: canvas.width - 430, y: 18, w: 412, h: canvas.height - 36 };
    fillRoundRect(ctx, cityPanel.x, cityPanel.y, cityPanel.w, cityPanel.h, 14, "rgba(20,32,48,0.72)", "rgba(125,153,196,0.45)");

    ctx.fillStyle = "#ecf2ff";
    ctx.font = "18px 'Noto Sans TC', sans-serif";
    const title = city ? `${city.name}｜太守：${city.ruler}` : "請點擊城池";
    ctx.fillText(title, cityPanel.x + 14, cityPanel.y + 28);

    if (city) {
      ctx.font = "14px 'Noto Sans TC', sans-serif";
      const rows = [
        `人口 ${city.pop.toLocaleString()}   士兵 ${city.soldiers.toLocaleString()}`,
        `錢 ${city.money.toLocaleString()}   糧 ${city.grain.toLocaleString()}`,
        `士${Math.round(city.workforce.scholar * 100)}% 農${Math.round(city.workforce.farmer * 100)}% 工${Math.round(city.workforce.artisan * 100)}% 商${Math.round(city.workforce.merchant * 100)}%`,
        `文教 ${city.literacy}  戰備 ${city.preparedness}  稅率 ${city.tax}%  法律 ${city.law}`,
        `文人：講學、說書、政令宣導（季增文教）`,
        `農業：${city.geo}/${city.crop}，生產係數 ${window.SGZModel.cropMultiplier(state, city).toFixed(2)}`,
        `工業：採礦、伐木、器具生產`,
        `商業：糧材書器轉賣，商稅受稅率影響`,
        `內府：${city.offices.map((o) => `${o.role}:${o.assigned}`).join(" / ")}`,
      ];

      let y = cityPanel.y + 54;
      for (const row of rows) {
        const lines = wrapText(ctx, row, cityPanel.w - 28);
        for (const line of lines) {
          ctx.fillText(line, cityPanel.x + 14, y);
          y += 22;
        }
      }
    }

    const menuX = 18;
    const menuY = canvas.height - 238;
    const blockW = 118;
    const blockH = 102;
    const gap = 10;
    uiLayout.commandBlocks = [];

    ctx.font = "16px 'Noto Sans TC', sans-serif";
    window.SGZModel.commands.forEach((name, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = menuX + col * (blockW + gap);
      const y = menuY + row * (blockH + gap);
      const isHover = state.hoverCommand === name;
      fillRoundRect(ctx, x, y, blockW, blockH, 10, isHover ? "rgba(66,96,132,0.8)" : "rgba(20,32,48,0.72)", "rgba(125,153,196,0.45)");
      ctx.fillStyle = "#ecf2ff";
      ctx.fillText(name, x + 36, y + 56);
      uiLayout.commandBlocks.push({ name, x, y, w: blockW, h: blockH });
    });
  }

  function drawModalIfNeeded(ctx, canvas, state, uiLayout) {
    if (!state.activeModal) return;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const modal = {
      x: canvas.width / 2 - 250,
      y: canvas.height / 2 - 160,
      w: 500,
      h: 320,
      close: { x: canvas.width / 2 + 210, y: canvas.height / 2 - 130, w: 24, h: 24 },
      actions: [
        { key: "save", label: "儲存遊戲", x: canvas.width / 2 - 180, y: canvas.height / 2 - 40, w: 360, h: 46 },
        { key: "next", label: "推進一季", x: canvas.width / 2 - 180, y: canvas.height / 2 + 22, w: 360, h: 46 },
        { key: "back", label: "返回主畫面", x: canvas.width / 2 - 180, y: canvas.height / 2 + 84, w: 360, h: 46 },
      ],
    };
    uiLayout.modal = modal;

    fillRoundRect(ctx, modal.x, modal.y, modal.w, modal.h, 14, "rgba(20,32,48,0.94)", "rgba(171,195,231,0.6)");
    ctx.fillStyle = "#ecf2ff";
    ctx.font = "22px 'Noto Sans TC', sans-serif";
    ctx.fillText("系統選單", modal.x + 20, modal.y + 40);

    fillRoundRect(ctx, modal.close.x, modal.close.y, modal.close.w, modal.close.h, 6, "rgba(116,68,68,0.8)");
    ctx.font = "14px 'Noto Sans TC', sans-serif";
    ctx.fillText("X", modal.close.x + 8, modal.close.y + 17);

    modal.actions.forEach((action) => {
      fillRoundRect(ctx, action.x, action.y, action.w, action.h, 8, "rgba(39,63,92,0.88)", "rgba(171,195,231,0.45)");
      ctx.fillStyle = "#ecf2ff";
      ctx.font = "18px 'Noto Sans TC', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(action.label, action.x + action.w / 2, action.y + action.h / 2);
    });
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    if (state.modalMessage) {
      ctx.font = "14px 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "#cde6ff";
      ctx.fillText(state.modalMessage, modal.x + 20, modal.y + modal.h - 20);
    }
  }

  function render(ctx, canvas, state, uiLayout) {
    if (state.scene === "opening") {
      drawOpeningScene(ctx, canvas, state);
      return;
    }
    if (state.scene === "title") {
      drawTitleScene(ctx, canvas, state, uiLayout);
      return;
    }

    drawMapBackground(ctx, canvas);
    drawCities(ctx, canvas, state, uiLayout);
    drawCanvasPanels(ctx, canvas, state, uiLayout);
    drawModalIfNeeded(ctx, canvas, state, uiLayout);
  }

  window.SGZRenderer = {
    render,
    findHit,
  };
})();
