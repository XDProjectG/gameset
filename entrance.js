import { startGame } from './games/game1/game.js'
import { startDemo } from './system/demo.js'

const screens = {
  selection: document.getElementById("game-select-screen"),
  map: document.getElementById("map-screen"),
}

const canvas = document.getElementById("world-canvas")

let currentRuntime = null

function showSelection() {
  screens.selection.classList.add("active")
  screens.map.classList.remove("active")

  if (currentRuntime?.stop) {
    currentRuntime.stop()
    currentRuntime = null
  }
}

function showMap() {
  screens.selection.classList.remove("active")
  screens.map.classList.add("active")
}

document.getElementById("launch-game").addEventListener("click", () => {
  showMap()
  currentRuntime = startGame(canvas, showSelection)
})

document.getElementById("launch-demo").addEventListener("click", () => {
  showMap()
  currentRuntime = startDemo(canvas, showSelection)
})

showSelection()
