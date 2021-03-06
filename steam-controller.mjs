import EventEmitter from 'events';
import util from 'util';
import HID from 'node-hid';
import fs from 'fs';

const commands = JSON.parse(fs.readFileSync('./commands.json', 'utf8'));

var vid = 10462;
var pid = 4418;

var PREPROCESS_BASE = 0x08;
var PREPROCESS_RAW = 0x10;
var INPUT_MASK_ACCELERATION = 0x04;
var INPUT_MASK_ROTATION = 0x08;
var INPUT_MASK_ORIENTATION = 0x10;

//https://github.com/XanClic/g1/blob/master/include/steam_controller.hpp

let controllerStatusBinary = {
    0x04: 'idle',
    0x01: 'input',
    0x03: 'hotplug',
};

/*
{
  vendorId: 10462,
  productId: 4418,
  path: '\\\\?\\hid#vid_28de&pid_1142&mi_01#7&30b6336f&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}',
  manufacturer: 'Valve Software',
  product: 'Steam Controller',
  release: 1,
  interface: 1,
  usagePage: 65280,
  usage: 1
}
 */
function isWirelessDevice(device) {
    return device.vendorId === 10462 && device.productId === 4418 && device.interface === 1;
}

/*
{
  vendorId: 10462,
  productId: 4354,
  path: '\\\\?\\hid#vid_28de&pid_1102&mi_02#7&e316191&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}',
  manufacturer: 'Valve Software',
  product: 'Valve',
  release: 256,
  interface: 2,
  usagePage: 65280,
  usage: 1
}
 */
function isWiredDevice(device) {
    return device.vendorId === 10462 && device.productId === 4354 && device.interface === 2;
}

export class SteamController extends EventEmitter {
    constructor() {
        super();

        this.device = null;
    }

    connect() {
        const devices = HID.devices();
        const steamDevices = [];

        devices.forEach(function (device) {
            if (isWiredDevice(device)) {
                // Prefer wired
                steamDevices.unshift(device);
                console.log(device);
            }

            if (isWirelessDevice(device)) {
                steamDevices.push(device);
                console.log(device);
            }
        });

        if (steamDevices.length > 0) {
            this.device = new HID.HID(steamDevices[0].path);

            //console.log(this.device.getFeatureReport(0, 65));

            const init0 = new Array(65).fill(0);
            init0[1] = 0x83;

            console.log('init0');
            this.device.sendFeatureReport(init0);

            let received = this.device.getFeatureReport(0, 65);

            received[0] = 0;
            received[1] = 0xAE;
            received[2] = 0x15;
            received[3] = 0x01;
            received.fill(0, 24);

            console.log('received');
            this.device.sendFeatureReport(received);

            received = this.device.getFeatureReport(0, 65);

            const init1 = new Array(65).fill(0);
            init1[1] = 0x81;

            console.log('init1');
            this.device.sendFeatureReport(init1);

            let configureInputReport = [
                0,
                0x87,
                0x15, 0x32, 0x84, 0x03,
                PREPROCESS_BASE,
                0x00, 0x00, 0x31, 0x02, 0x00, 0x08, 0x07, 0x00, 0x07, 0x07, 0x00, 0x30,
                INPUT_MASK_ACCELERATION | INPUT_MASK_ROTATION | INPUT_MASK_ORIENTATION,
                0x2f, 0x01,
                0x00
            ];

            const length = configureInputReport.length;

            if (length < 65) {
                configureInputReport = configureInputReport.concat(new Array(65 - length).fill(0));
            }

            console.log(configureInputReport);

            this.device.sendFeatureReport(configureInputReport);

            console.log(this.device.getFeatureReport(0, 65));

            this.initEvents(this);
        }
    }

    initEvents(controller) {
        this.device.on("error", function (err) {
            console.log(err);
        });

        this.device.on("data", function (data) {
            const current = commands;

            //console.log(data);

            commands.status = controllerStatusBinary[data[2]] || 'idle';

            if (data.readUInt16BE(13) === 0x0C64) {
                return;
            }

            // buttons
            switch (data[8]) {
                case 128:
                    current.button.A = true;
                    break;
                case 32:
                    current.button.B = true;
                    break;
                case 16:
                    current.button.Y = true;
                    break;
                case 64:
                    current.button.X = true;
                    break;
                case 8:
                    current.button.LB = true;
                    break;
                case 4:
                    current.button.RB = true;
                    break;
                default:
                    current.button.RB = false;
                    current.button.LB = false;
                    current.button.A = false;
                    current.button.B = false;
                    current.button.Y = false;
                    current.button.X = false;
            }

            // Bottom buttons + center buttons

            switch (data[9]) {
                case 128:
                    current.bottom.left = true;
                    break;
                case 16:
                    current.center.L = true;
                    break;
                case 64:
                    current.center.R = true;
                    break;
                case 32:
                    current.center.STEAM = true;
                    break;
                case 8:
                    current.pad.value = 'DOWN';
                    break;
                case 2:
                    current.pad.value = 'RIGHT';
                    break;
                case 4:
                    current.pad.value = 'LEFT';
                    break;
                case 1:
                    current.pad.value = 'UP';
                    break;
                default:
                    current.pad.value = 'idle';
                    current.bottom.left = false;
                    current.center.L = false;
                    current.center.R = false;
                    current.center.STEAM = false;
            }

            switch (data[10]) {
                case 24:
                    current.mouse.touched = true;
                    current.pad.touched = true;
                    break;
                case 17:
                    current.mouse.touched = true;
                    current.bottom.right = true;
                    break;
                case 25:
                    current.mouse.touched = true;
                    current.bottom.right = true;
                    current.pad.touched = true;
                    break;
                case 2:
                    current.thumbstick.pressed = true;
                    break;
                case 1:
                    current.bottom.right = true;
                    break;
                case 16:
                    current.mouse.touched = true;
                case 8:
                    current.pad.touched = true;
                    break;
                default:
                    current.mouse.touched = false;
                    current.bottom.right = false;
                    current.pad.touched = false;
                    current.thumbstick.pressed = false;
            }

            // triggers
            current.trigger.left = data[11];
            current.trigger.right = data[12];

            // joystick
            current.joystick.x = data.readInt16LE(16);
            current.joystick.y = data.readInt16LE(18);

            current.thumbstick.x = data.readInt16LE(16);
            current.thumbstick.y = data.readInt16LE(18);

            // mouse
            current.mouse.x = data.readInt16LE(20);
            current.mouse.y = data.readInt16LE(22);

            current.acceleration.x = data.readInt16LE(0x1c);
            current.acceleration.y = data.readInt16LE(0x20);
            current.acceleration.z = data.readInt16LE(0x1e);

            current.rotation.x = data.readInt16LE(0x22);
            current.rotation.y = data.readInt16LE(0x26);
            current.rotation.z = data.readInt16LE(0x24);

            current.orientation.x = data.readInt16LE(0x2a);
            current.orientation.ya = data.readInt16LE(0x28);
            current.orientation.yb = data.readInt16LE(0x2e);
            current.orientation.z = data.readInt16LE(0x2c);

            //console.log(current);
            controller.emit('data', current);
        });
    }
}