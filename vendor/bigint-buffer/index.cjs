'use strict';

function decode(buffer, littleEndian) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('Expected Buffer');
  let result = 0n;
  for (let position = 0; position < buffer.length; position++) {
    const index = littleEndian ? buffer.length - position - 1 : position;
    result = (result << 8n) | BigInt(buffer[index]);
  }
  return result;
}

function encode(value, width, littleEndian) {
  if (typeof value !== 'bigint') throw new TypeError('Expected bigint');
  if (!Number.isSafeInteger(width) || width < 0 || width > 1024) throw new RangeError('Width must be 0..1024 bytes');
  if (value < 0n || value >> BigInt(width * 8) !== 0n) throw new RangeError('Unsigned bigint does not fit width');
  const result = Buffer.alloc(width);
  for (let position = 0; position < width; position++) {
    result[littleEndian ? position : width - position - 1] = Number(value & 255n);
    value >>= 8n;
  }
  return result;
}

exports.toBigIntLE = buffer => decode(buffer, true);
exports.toBigIntBE = buffer => decode(buffer, false);
exports.toBufferLE = (value, width) => encode(value, width, true);
exports.toBufferBE = (value, width) => encode(value, width, false);
