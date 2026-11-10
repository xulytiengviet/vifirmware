/* ViFirmware VF1 — browser/Node transport reference; not the linguistic CVNSS4.0 converter. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VF1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const alphabet = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function checkCode(code) {
    if (typeof code !== "string" || !/^[A-Z ]{1,1024}$/.test(code))
      throw Error("CODE chỉ nhận 1–1024 ký tự ASCII A–Z hoặc SPACE.");
    return code;
  }
  function encodeTrits(code) {
    return Array.from(checkCode(code), c => {
      const n = alphabet.indexOf(c);
      return String(Math.floor(n / 9)) + String(Math.floor(n / 3) % 3) + String(n % 3);
    }).join("");
  }
  function decodeTrits(digits) {
    if (!/^(?:[012]{3})+$/.test(digits)) throw Error("TRITS không hợp lệ.");
    let code = "";
    for (let i = 0; i < digits.length; i += 3) {
      const n = (+digits[i]) * 9 + (+digits[i + 1]) * 3 + (+digits[i + 2]);
      code += alphabet[n];
    }
    return checkCode(code);
  }
  function crc32(code, bytes) {
    let value = 0xFFFFFFFF;
    const feed = b => {
      value = (value ^ b) >>> 0;
      for (let k = 0; k < 8; k++)
        value = ((value >>> 1) ^ ((value & 1) ? 0xEDB88320 : 0)) >>> 0;
    };
    for (const b of new TextEncoder().encode(checkCode(code))) feed(b);
    feed(0);
    for (const b of bytes) feed(b);
    return ((value ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }
  function toHex(bytes) {
    return Array.from(bytes, b => b.toString(16).toUpperCase().padStart(2, "0")).join("");
  }
  function encode(code, original) {
    const digits = encodeTrits(code);
    const raw = new TextEncoder().encode(original);
    return "VF1|" + code + "|" + digits + "|" + toHex(raw) + "|" + crc32(code, raw);
  }
  function decode(frame) {
    if (typeof frame !== "string") throw Error("FRAME phải là chuỗi ASCII.");
    const fields = frame.split("|");
    if (fields.length !== 5 || fields[0] !== "VF1") throw Error("VF1: sai header hoặc số trường.");
    const [, code, digits, hex, crc] = fields;
    checkCode(code);
    if (digits !== encodeTrits(code) || decodeTrits(digits) !== code)
      throw Error("CODE và TRITS không nhất quán.");
    if (!/^(?:[0-9A-F]{2})*$/.test(hex)) throw Error("HEX không đúng định dạng byte.");
    if (!/^[0-9A-F]{8}$/.test(crc)) throw Error("CRC32 không đúng định dạng.");
    const raw = new Uint8Array(hex.length / 2);
    for (let i = 0; i < raw.length; i++) raw[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (crc32(code, raw) !== crc) throw Error("CRC32 không khớp.");
    const original = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    return Object.freeze({ code, digits, raw, original, crc });
  }
  return Object.freeze({ VERSION: "VF1", alphabet, encodeTrits, decodeTrits, encode, decode, crc32 });
});
