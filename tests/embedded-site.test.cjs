const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const converter = require("../docs/assets/cvnss-converter.js");

test("Website provides linked embedded assessment and necessary local assets", () => {
  const home = read("docs/index.html"), detail = read("docs/embedded.html");
  assert.match(home, /href="\.\/embedded\.html"/);
  for (const p of ["embedded.css", "embedded.js", "assets/cvnss-converter.js"]) {
    assert.ok(detail.includes('src="./' + p + '"') || detail.includes('href="./' + p + '"'));
    assert.ok(fs.existsSync(path.join(root, "docs", p)));
  }
  for (const anchor of ["tradeoffs", "solutions", "gates", "bench"]) {
    assert.ok(detail.includes('id="' + anchor + '"'), "Missing section: " + anchor);
  }
  assert.match(detail, /CHỜ FLASH BOARD THẬT/i);
});

test("Assessment distinguishes reference converter from full on-device codec", () => {
  const doc = read("docs/FULL_CODEC_ESP32S3.md");
  assert.match(doc, /56 nhóm nhập nhằng/);
  assert.match(doc, /chưa có kết quả flash và chạy thực trên bo mạch/i);
  assert.match(doc, /CQN UTF-8 NFC/);
  assert.match(doc, /ESP-IDF/);
  const audit = converter.audit();
  assert.equal(audit.ambiguityGroups, 56);
  assert.equal(converter.selfTest().ok, true);
  assert.equal(converter.fromCqn("tôi").cvss.toUpperCase(), "TOIY");
});

test("Embedded page scripts use no remote JS runtime", () => {
  const html = read("docs/embedded.html");
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(scripts, ["./assets/cvnss-converter.js", "./embedded.js"]);
  assert.match(read("docs/embedded.js"), /Không đọc được converter v5/);
});
