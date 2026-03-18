(() => {
  const screens = {
    selection: document.getElementById("game-select-screen"),
    map: document.getElementById("map-screen"),
  };
  const launchButton = document.getElementById("launch-game");
  const canvas = document.getElementById("world-canvas");
  const ctx = canvas.getContext("2d");

  const state = window.SGZModel.createInitialState();
  const uiLayout = window.SGZModel.createUiLayout();

  const render = () => window.SGZRenderer.render(ctx, canvas, state, uiLayout);
  const controller = window.SGZController.createController({ screens, canvas, state, uiLayout, render });

  controller.bindEvents(launchButton);
  controller.resizeCanvas();
  controller.showDomScreen("selection");
})();
