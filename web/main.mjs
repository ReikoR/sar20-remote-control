import { WebsocketManager } from "./websocket-manager.mjs";
import { runGui, state } from "./gui.mjs";

let sendInterval;
const wsManager = new WebsocketManager();

function wsSend(info) {
  wsManager.send(info);
}

function startSendInterval() {
  clearInterval(sendInterval);

  sendInterval = setInterval(() => {
    // wsSend({ x: 0, y: 0.05, w: 0 });
    const { x, y, w } = state.input;
    wsSend({ x, y: -y, w });
  }, 200);
}

function stopSendInterval() {
  clearInterval(sendInterval);
  sendInterval = null;

  wsSend({ speeds: [0, 0, 0] });
}

startSendInterval();

runGui(wsManager);
