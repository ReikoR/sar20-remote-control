import WebSocket from 'ws';
import express from 'express';
import spi from 'spi-device';
import {CRC} from 'crc-full';
import http from "http";

let robotConfig = {
    robotRadius: 0.067,
    wheelRadius: 0.0175,
    wheelFromCenter: 0.051,
    wheel1Angle: 120,
    wheel2Angle: 240,
    wheel3Angle: 0,
    wheel1AxisAngle: 30,
    wheel2AxisAngle: 150,
    wheel3AxisAngle: 270,
    metricToRobot: 1
};

robotConfig.metricToRobot = 1 / (robotConfig.wheelRadius * 2 * Math.PI);

const port = 8777;

const app = express();
const server = http.createServer(app);

let crc = new CRC("CRC32_MPEG2", 32, 0x04C11DB7, 0xFFFFFFFF, 0x00000000, false, false);

const device = spi.open(0, 0, err => {
    if (err) {
        throw err;
    }

    console.log('SPI opened');
});

app.use(express.static('web'))
app.use(express.json());

const wss = new WebSocket.Server({server}, () => {
    console.log('Opened websocket');
});

wss.on('connection', (ws, req) => {
    console.log('connection', req.connection.remoteAddress, req.connection.remotePort);

    ws.on('message', (message) => {
        console.log('received', message);

        handleMessage(message, ws);
    });
});

server.listen(port, function listening() {
    console.log('Listening on %d', server.address().port);
    console.log('http://localhost:' + server.address().port);
});

function handleMessage(message, socket) {
    try {
        let info = JSON.parse(message);

        console.log(info);

        if (Array.isArray(info.speeds) && info.speeds.length === 3) {
            setSpeeds(info.speeds);
        } else {
            setSpeeds(calcSpeeds(info.x, info.y, info.w));
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

function calcSpeeds(xSpeed = 0, ySpeed = 0, rotation = 0) {
    const rotationalSpeed = speedMetricToRobot(rotationRadiansToMetersPerSecond(rotation));
    const speed = Math.sqrt(xSpeed * xSpeed + ySpeed * ySpeed);
    const angle = Math.atan2(ySpeed, xSpeed);

    const speeds = [0, 0, 0];

    speeds[0] = speedMetricToRobot(wheelSpeed(speed, angle, robotConfig.wheel1Angle / 180 * Math.PI)) + rotationalSpeed;
    speeds[1] = speedMetricToRobot(wheelSpeed(speed, angle, robotConfig.wheel2Angle / 180 * Math.PI)) + rotationalSpeed;
    speeds[2] = speedMetricToRobot(wheelSpeed(speed, angle, robotConfig.wheel3Angle / 180 * Math.PI)) + rotationalSpeed;

    return speeds;
}
function wheelSpeed(robotSpeed, robotAngle, wheelAngle) {
    return robotSpeed * Math.cos(wheelAngle - robotAngle);
}

function speedMetricToRobot(metersPerSecond) {
    return metersPerSecond * robotConfig.metricToRobot;
}

function speedRobotToMetric(wheelSpeed) {
    if (robotConfig.metricToRobot === 0) {
        return 0;
    }

    return wheelSpeed / robotConfig.metricToRobot;
}

function rotationRadiansToMetersPerSecond(radiansPerSecond) {
    return radiansPerSecond * robotConfig.wheelFromCenter;
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