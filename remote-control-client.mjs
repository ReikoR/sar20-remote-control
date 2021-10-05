import {WebsocketManager} from './websocket-manager.mjs';
const wsManager = new WebsocketManager('192.168.1.235:8777');
import {SteamController} from "./steam-controller.mjs";

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

let speedSendInterval;
let speeds = [0, 0, 0];

let ySpeed = 0;
let xSpeed = 0;
let rotation = 0;

let prevButtons = {};

const defaultMaxSpeed = 0.1;
let maxSpeed = defaultMaxSpeed;
const defaultMaxRotation = 1;
let maxRotation = defaultMaxRotation;

const controller = new SteamController();

controller.connect();

controller.on('data', (data) => {
    //console.log(data.center);//, data.bottom);

    //console.log(data.status);

    if (data.status !== 'input') {
        return;
    }

    if (!prevButtons.A && data.button.A) {
        console.log('A');
        maxSpeed = defaultMaxSpeed;
        maxRotation = defaultMaxRotation;
        console.log(maxSpeed);
    }

    if (!prevButtons.X && data.button.X) {
        console.log('X');
        maxSpeed /= 2;
        maxRotation /= 2;
        console.log(maxSpeed);
    }

    if (!prevButtons.Y && data.button.Y) {
        console.log('Y');
        maxSpeed *= 2;
        maxRotation *= 2;
        console.log(maxSpeed);
    }

    prevButtons = clone({ ...data.button, ...data.center });

    xSpeed = data.joystick.x / 32768 * maxSpeed;
    ySpeed = data.joystick.y / 32768 * maxSpeed;

    rotation = -data.mouse.x / 32768 * maxRotation;

    //console.log(data);
});

wsManager.on('open', () => {
    setSpeeds([0, 0, 0])
});

wsManager.on('message', onMessage);

function onMessage(message) {
    console.log(message);
}

function clone(obj) {
    let cloned = {};

    for (let key in obj) {
        cloned[key] = obj[key];
    }

    return cloned;
}

function setSpeeds(speeds, callback) {
    wsManager.send({speeds}, callback);
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

function calcSpeeds(xSpeed, ySpeed, rotation) {
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

speedSendInterval = setInterval(() => {
    speeds = calcSpeeds(xSpeed, ySpeed, rotation);

    console.log(speeds);

    setSpeeds(speeds);
}, 50);