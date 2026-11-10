const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root=path.resolve(__dirname,"..");
const read=x=>fs.readFileSync(path.join(root,x),"utf8");
test("Native lab is linked and all local assets exist",()=>{
  const html=read("docs/native-lab.html");
  assert.match(read("docs/index.html"),/href="\.\/native-lab\.html"/);
  assert.match(read("docs/embedded.html"),/href="\.\/native-lab\.html"/);
  for(const file of ["native-lab.css","native-lab.js","assets/cvnss-converter.js"]){
    assert.ok(fs.existsSync(path.join(root,"docs",file)));
    assert.ok(html.includes("./"+file),"Missing local link "+file);
  }
  assert.match(html,/MÔ PHỎNG|Mô phỏng/);
  assert.match(html,/ACTUAL BOARD SERIAL LOG/);
  assert.match(html,/Chỉ khi thiết bị thật/);
});
test("Firmware receives user Unicode and really runs native algorithms (no cached CVNSS result)",()=>{
  const cpp=read("firmware/esp32s3/main/main.cpp");
  const core=read("native/src/cvnss_codec.cpp");
  assert.match(cpp,/uart_read_bytes/);
  assert.match(cpp,/ENC /);
  assert.match(cpp,/cvnss::encode\(original\)/);
  assert.match(cpp,/cvnss::decodeCanonical\(code.value\)/);
  assert.doesNotMatch(cpp,/const std::string cvnss\s*=\s*"TOIY"/);
  assert.match(core,/kRules/);
  assert.match(core,/normalizeVietnameseNfc/);
});
test("Physical board proof is not simulated or automatically asserted",()=>{
  const js=read("docs/native-lab.js");
  assert.match(js,/navigator\.serial\.requestPort/);
  assert.match(js,/new TextEncoder/);
  assert.match(js,/receivedCode/);
  assert.match(js,/verifiedCases/);
  assert.match(js,/WebSerial logs are user-captured/);
});
