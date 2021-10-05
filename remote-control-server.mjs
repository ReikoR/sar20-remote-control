import WebSocket from 'ws';
import spi from 'spi-device';
import {CRC} from 'crc-full';

const port = 8777;

let crc = new CRC("CRC32_MPEG2", 32, 0x04C11DB7, 0xFFFFFFFF, 0x00000000, false, false);

const device = spi.open(0, 0, err => {
    if (err) {
        throw err;
    }

    console.log('SPI opened');
});

const wss = new WebSocket.Server({port}, () => {
    console.log('Opened websocket');
});

wss.on('connection', (ws, req) => {
    console.log('connection', req.connection.remoteAddress, req.connection.remotePort);

    ws.on('message', (message) => {
        console.log('received', message);

        handleMessage(message, ws);
    });
});

function handleMessage(message, socket) {
    try {
        let info = JSON.parse(message);

        console.log(info);

        if (Array.isArray(info.speeds) && info.speeds.length === 3) {
            setSpeeds(info.speeds);
        }
    } catch (e) {
        console.error(e);
    }
}

function setSpeeds(speeds, callback) {
    const commandBuffer = Buffer.alloc(16, 0);

    for (const [i, speed] of speeds.entries()) {
        commandBuffer.writeFloatLE(speed, i * 4);
    }

    const bufferForCRC = Buffer.from(commandBuffer.slice(0, -4)).swap32();

    const crcValue = crc.compute(bufferForCRC) >>> 0;

    commandBuffer.writeUInt32LE(crcValue, 12);

    console.log(commandBuffer);

    const message = [{
        sendBuffer: commandBuffer,
        receiveBuffer: Buffer.alloc(16),
        byteLength: 16,
        speedHz: 10000000
    }];

    device.transfer(message, (err, message) => {
        if (err) throw err;

        console.log(message[0].receiveBuffer);

        if (typeof callback === 'function') {
            callback();
        }
    });
}

function exitHandler(options, err) {
    console.log('exitHandler', options);

    if (err) {
        console.log(err.stack);
    }

    setSpeeds([0, 0, 0], () => {
       process.exit();
    });
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {cleanup: true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit: true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit: true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit: true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit: true}));