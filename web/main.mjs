import {WebsocketManager} from "./websocket-manager.mjs";

let sendInterval;
const wsManager = new WebsocketManager();

function wsSend(info) {
    wsManager.send(info);
}

function startSendInterval() {
    clearInterval(sendInterval);

    sendInterval = setInterval(() => {
        wsSend({x: 0, y: 0.05, w: 0});
    }, 200);
}

function stopSendInterval() {
    clearInterval(sendInterval);
    sendInterval = null;

    wsSend({speeds: [0, 0, 0]});
}


startSendInterval();