/* Generate reference vectors for future native full-codec parity tests.
 * The output is from the official CVNSS4.0 v5 JS reference, NOT ESP32-S3 measurements.
 * Run: node tools/export_reference_vectors.cjs > golden-reference.json
 */
"use strict";
const converter = require("../docs/assets/cvnss-converter.js");
const audit = converter.audit();
const selfTest = converter.selfTest();
if (!selfTest.ok || audit.ambiguityGroups !== 56) {
  throw Error("Reference version, test status or ambiguity count changed; inspect upstream");
}
const samples = [
  "tôi","yêu","tiếng","Việt","hoà","hòa","sẽ","hề","mồ","mộ","võ",
  "nghiêng","quốc","Nguyễn","ệ","e\u0323\u0302","Tôi yêu tiếng Việt"
];
const vectors = samples.map(original => {
  const nfc = original.normalize("NFC");
  const result = converter.fromCqn(nfc);
  const canonical = converter.fromCvss(result.cvss).cqn;
  let candidates = null;
  if (!nfc.includes(" ")) {
    candidates = converter.candidatesForWord(result.cvss).slice();
  }
  return {
    input: original, inputNFC: nfc, encoded: result.cvss,
    canonical, candidates,
    canonicalNFCEqual: canonical.normalize("NFC") === nfc
  };
});
const payload = {
  note: "Generated JS reference vectors, not native MCU measurements or universal lossless evidence",
  version: converter.VERSION, audit,
  vectors
};
process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
