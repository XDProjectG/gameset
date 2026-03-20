(() => {
  function createController({ screens, canvas, state, uiLayout, render, isEnabled }) {
    const model = window.SGZModel;
    const renderer = window.SGZRenderer;
    let openingTimerId = null;
    let animationFrameId = null;

    function showDomScreen(name) {
      Object.entries(screens).forEach(([screenName, element]) => {
        element.classList.toggle("active", screenName === name);
      });
    }

    function switchToCanvasScene(scene) {
      showDomScreen("map");
      state.scene = scene;
      render();
    }

    function updateOpeningFrame() {
      if (state.scene !== "opening" || !isEnabled()) return;

      const elapsed = performance.now() - state.opening.startedAt;
      const totalChars = [...state.opening.text].length;
      const nextFadeProgress = Math.min(totalChars, elapsed / model.openingCharInterval);
      const nextVisibleCount = Math.min(totalChars, Math.ceil(nextFadeProgress));

      if (nextFadeProgress !== state.opening.fadeProgress || nextVisibleCount !== state.opening.visibleCount) {
        state.opening.fadeProgress = nextFadeProgress;
        state.opening.visibleCount = nextVisibleCount;
        render();
      }

      if (state.opening.fadeProgress >= totalChars) {
        if (!state.opening.completedAt) {
          state.opening.completedAt = performance.now();
          render();
        }
        if (!openingTimerId) {
          openingTimerId = window.setTimeout(() => {
            openingTimerId = null;
            goToTitle();
          }, model.openingAutoAdvanceDelay);
        }
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateOpeningFrame);
    }

    function startOpeningSequence() {
      if (openingTimerId) {
        window.clearTimeout(openingTimerId);
        openingTimerId = null;
      }
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      state.opening.visibleCount = 0;
      state.opening.fadeProgress = 0;
      state.opening.startedAt = performance.now();
      state.opening.completedAt = null;
      switchToCanvasScene("opening");
      animationFrameId = window.requestAnimationFrame(updateOpeningFrame);
    }

    function goToTitle() {
      if (openingTimerId) {
        window.clearTimeout(openingTimerId);
        openingTimerId = null;
      }
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      state.hoverTitleAction = null;
      state.titleMessage = "";
      switchToCanvasScene("title");
    }

    function stop() {
      if (openingTimerId) {
        window.clearTimeout(openingTimerId);
        openingTimerId = null;
      }
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      state.activeModal = null;
      state.modalMessage = "";
      state.hoverCommand = null;
      state.hoverTitleAction = null;
    }

    function startNewGame() {
      Object.assign(state, model.createNewGameState(state));
      switchToCanvasScene("map");
    }

    function handleTitleAction(actionKey) {
      if (actionKey === "new") {
        startNewGame();
        return;
      }
      if (actionKey === "load") {
        if (model.loadGame(state)) {
          switchToCanvasScene("map");
        } else {
          switchToCanvasScene("title");
        }
        render();
        return;
      }
      if (actionKey === "settings") {
        state.titleMessage = "設定已併入遊戲內『系統』指令。";
        render();
      }
    }

    function handleCommand(name) {
      const city = model.selectedCity(state);
      if (name === "系統") {
        state.activeModal = "system";
        state.modalMessage = "";
        render();
        return;
      }
      if (!city) return;

      if (name === "內政") {
        city.tax = Math.min(40, city.tax + 1);
        city.law = Math.min(10, city.law + 1);
      } else if (name === "人事") {
        city.literacy = Math.min(95, city.literacy + 2);
      } else if (name === "外交") {
        state.modalMessage = `${city.name}已派使節至鄰郡。`;
      } else if (name === "軍事") {
        if (city.money >= 3000 && city.pop >= 550000) {
          city.soldiers += 500;
          city.money -= 3000;
          city.pop -= 500;
        }
      } else if (name === "其他") {
        city.preparedness = Math.min(100, city.preparedness + 5);
      }
      render();
    }

    function handleModalClick(x, y) {
      const modal = uiLayout.modal;
      if (!modal) return;

      if (renderer.findHit([modal.close], x, y)) {
        state.activeModal = null;
        state.modalMessage = "";
        render();
        return;
      }

      const action = renderer.findHit(modal.actions, x, y);
      if (!action) return;

      if (action.key === "save") {
        model.saveGame(state);
        state.modalMessage = "已儲存目前進度。";
      }
      if (action.key === "next") {
        model.progressSeason(state);
        state.modalMessage = "時間已推進一季。";
      }
      if (action.key === "back") {
        state.activeModal = null;
        state.modalMessage = "";
        goToTitle();
        return;
      }
      render();
    }

    function getCanvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function handlePointerMove(event) {
      if (!isEnabled() || !screens.map.classList.contains("active")) return;
      const { x, y } = getCanvasPoint(event);

      if (state.scene === "title") {
        const hit = renderer.findHit(uiLayout.titleButtons, x, y);
        const nextHover = hit ? hit.key : null;
        if (nextHover !== state.hoverTitleAction) {
          state.hoverTitleAction = nextHover;
          render();
        }
        return;
      }

      if (state.scene !== "map" || state.activeModal) return;
      const hit = renderer.findHit(uiLayout.commandBlocks, x, y);
      const nextHover = hit ? hit.name : null;
      if (nextHover !== state.hoverCommand) {
        state.hoverCommand = nextHover;
        render();
      }
    }

    function handleCanvasClick(event) {
      if (!isEnabled() || !screens.map.classList.contains("active")) return;
      const { x, y } = getCanvasPoint(event);

      if (state.scene === "opening") {
        goToTitle();
        return;
      }

      if (state.scene === "title") {
        const action = renderer.findHit(uiLayout.titleButtons, x, y);
        if (action) handleTitleAction(action.key);
        return;
      }

      if (state.activeModal) {
        handleModalClick(x, y);
        return;
      }

      const command = renderer.findHit(uiLayout.commandBlocks, x, y);
      if (command) {
        handleCommand(command.name);
        return;
      }

      const cityHit = uiLayout.cityHit.find((city) => Math.hypot(x - city.x, y - city.y) <= city.r);
      if (cityHit) {
        state.selectedCityId = cityHit.id;
        render();
      }
    }

    function handleKeydown() {
      if (!isEnabled()) return;
      if (state.scene === "opening") {
        goToTitle();
      }
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (isEnabled()) render();
    }

    function bindEvents() {
      canvas.addEventListener("mousemove", handlePointerMove);
      canvas.addEventListener("click", handleCanvasClick);
      window.addEventListener("keydown", handleKeydown);
      window.addEventListener("resize", resizeCanvas);
    }

    return {
      bindEvents,
      resizeCanvas,
      showDomScreen,
      startOpeningSequence,
      stop,
    };
  }

  window.SGZController = {
    createController,
  };
})();
