const test = require("node:test");
const assert = require("node:assert/strict");
const VF1 = require("../docs/frame.js");
const CVNSS = require("../docs/assets/cvnss-converter.js");

test("27 alphabet symbols map to unique exactly-three-trit strings", () => {
  for (const c of VF1.alphabet) {
    const t = VF1.encodeTrits(c);
    assert.match(t, /^[012]{3}$/);
    assert.equal(VF1.decodeTrits(t), c);
  }
  assert.equal(VF1.encodeTrits("A Z"), "001000222");
});

test("VF1 raw byte exactness and strict integrity", () => {
  for (const original of ["Xin chào", "ệ", "e\u0323\u0302", "Tôi yêu tiếng Việt", ""]) {
    const code = "XIN CHAO";
    const f = VF1.encode(code, original);
    const decoded = VF1.decode(f);
    assert.deepEqual(Buffer.from(decoded.raw), Buffer.from(original, "utf8"));
    assert.equal(decoded.original, original);
    assert.throws(() => VF1.decode(f.replace(/\|([0-9A-F]{8})$/, "|DEADBEEF")), /CRC32/);
  }
  assert.throws(() => VF1.encode("xin chao", "a"), /CODE/);
  assert.throws(() => VF1.encode("HELLO!", "a"), /CODE/);
  assert.throws(() => VF1.decode("VF1|XIN|bad|0A|12345678"), /CODE và TRITS/);
});

test("official CVNSS4.0 reference converter audit is visible", () => {
  assert.equal(CVNSS.VERSION, "5.0.0-audit-safe");
  assert.equal(CVNSS.selfTest().ok, true);
  const audit = CVNSS.audit();
  assert.equal(audit.ambiguityGroups, 56);
  assert.equal(audit.silentReverseOverwrite, 0);
  const original = "Tôi yêu tiếng Việt";
  const code = CVNSS.fromCqn(original.normalize("NFC")).cvss.toUpperCase();
  assert.match(code, /^[A-Z ]+$/);
  const frame = VF1.encode(code, original);
  assert.equal(VF1.decode(frame).original, original);
  // Canonical reverse is separate from byte-exact sidecar, not asserted lossless.
});
