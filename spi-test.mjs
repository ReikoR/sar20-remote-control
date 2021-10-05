import spi from 'spi-device';
import {CRC} from 'crc-full';

let crc = new CRC("CRC32_MPEG2", 32, 0x04C11DB7, 0xFFFFFFFF, 0x00000000, false, false);

const speeds = [0, 0, 0.5];

const commandBuffer = Buffer.alloc(16, 0);

for (const [i, speed] of speeds.entries()) {
    commandBuffer.writeFloatLE(speed, i * 4);
}

const bufferForCRC = Buffer.from(commandBuffer.slice(0, -4)).swap32();

const crcValue = crc.compute(bufferForCRC) >>> 0;

commandBuffer.writeUInt32LE(crcValue, 12);

console.log(commandBuffer);

const device = spi.open(0, 0, err => {
    const message = [{
        sendBuffer: commandBuffer, // Sent to read channel 5
        receiveBuffer: Buffer.alloc(16),              // Raw data read from channel 5
        byteLength: 16,
        speedHz: 10000000 // Use a low bus speed to get a good reading from the TMP36
    }];

    if (err) throw err;

    device.transfer(message, (err, message) => {
        if (err) throw err;

        console.log(message[0].receiveBuffer);
    });
});