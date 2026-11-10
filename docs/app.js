/* ViFirmware website, entirely local. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const sample = "Tôi yêu tiếng Việt";
  let lastFrame = "";
  const langs = {
    cpp: ["portable/cpp/vifirmware.cpp", 'c++ -std=c++17 -O2 portable/cpp/vifirmware.cpp -o vf\n./vf encode "TOIY" "tôi"\n# decode: ./vf decode "$FRAME"'],
    java: ["portable/java/ViFirmware.java", 'javac portable/java/ViFirmware.java\njava -cp portable/java ViFirmware encode "TOIY" "tôi"'],
    python: ["portable/python/vifirmware.py", 'python portable/python/vifirmware.py encode "TOIY" "tôi"\npython portable/python/vifirmware.py decode "$FRAME"'],
    swift: ["portable/swift/ViFirmware.swift", 'swiftc portable/swift/ViFirmware.swift -o vf_swift\n./vf_swift encode "TOIY" "tôi"'],
    bila: ["examples/bridge.bila", '---bila:strict---\nhaml_sob kitra_trit(gia_tri) {\n    neub (gia_tri >= 0 && gia_tri <= 2) {\n        trov_ved true;\n    }\n    trov_ved false;\n}\nbilb hop_le = kitra_trit(2);\n// BilaScript v4 -> JavaScript, KHÔNG -> native C++/Java/Python/Swift']
  };
  function status(label, error) {
    $("out-state").textContent = label;
    $("out-state").style.color = error ? "var(--red)" : "var(--green)";
  }
  function run() {
    try {
      if (!globalThis.CVNSSConverter || !globalThis.VF1)
        throw Error("Chưa tải được mã tham chiếu. Hãy kiểm tra các file JS của dự án.");
      const raw = $("source").value;
      if (!raw.trim()) throw Error("Vui lòng nhập văn bản.");
      const nfc = raw.normalize("NFC");
      const result = CVNSSConverter.fromCqn(nfc);
      const code = result.cvss.toUpperCase();
      if (!/^[A-Z ]{1,1024}$/.test(code))
        throw Error("CVNSS4.0 tạo ra ký tự ngoài A–Z + SPACE. VF1 strict không tự loại bỏ ký tự.");
      const frame = VF1.encode(code, raw);
      const decoded = VF1.decode(frame);
      const canonical = CVNSSConverter.fromCvss(result.cvss).cqn;
      if (CVNSSConverter.fromCqn(decoded.original.normalize("NFC")).cvss.toUpperCase() !== code)
        throw Error("Audit: CODE không khớp chuyển đổi từ văn bản gốc.");
      const exact = new TextEncoder().encode(raw);
      if (decoded.raw.length !== exact.length || decoded.raw.some((x, i) => x !== exact[i]))
        throw Error("Không khôi phục được byte gốc.");
      lastFrame = frame;
      $("out-code").textContent = code;
      $("out-trits").textContent = decoded.digits.match(/.{1,3}/g).join(" ");
      $("out-canonical").textContent = canonical;
      $("out-restored").textContent = decoded.original;
      $("out-frame").textContent = frame;
      const canonicalEqual = canonical.normalize("NFC") === nfc;
      $("proof").textContent =
        "VF1: PASS — byte gốc UTF-8 khôi phục đúng nhờ trường HEX. " +
        "CVNSS4.0 canonical: " + (canonicalEqual ? "trùng với CQN NFC ở ví dụ này." : "KHÁC CQN NFC; đây là minh chứng nhập nhằng, không phải lỗi VF1.");
      $("sizes").textContent = "UTF-8 gốc: " + exact.length + " B | CVNSS ASCII: " +
        code.length + " B | VF1 đầy đủ: " + new TextEncoder().encode(frame).length +
        " B (gồm sidecar, không phải dạng nén)";
      status("PASS / Byte-exact VF1" + (canonicalEqual ? " / Canonical match" : " / Canonical khác"), false);
    } catch (e) {
      lastFrame = "";
      $("out-code").textContent = "—";
      $("out-trits").textContent = "—";
      $("out-canonical").textContent = "—";
      $("out-restored").textContent = "—";
      $("out-frame").textContent = "Không tạo VF1: " + e.message;
      $("sizes").textContent = "Chưa có số liệu hợp lệ";
      $("proof").textContent = "Thất bại được báo lỗi tường minh. Không tự xóa hoặc thay dữ liệu.";
      status("FAIL / " + e.message, true);
    }
  }
  function init() {
    $("run").addEventListener("click", run);
    $("reset").addEventListener("click", () => { $("source").value = sample; run(); });
    $("copy").addEventListener("click", async () => {
      if (!lastFrame) return;
      try {
        await navigator.clipboard.writeText(lastFrame);
        $("copy").textContent = "Đã sao chép ✓";
      } catch { $("copy").textContent = "Không sao chép được"; }
    });
    document.querySelectorAll("[data-lang]").forEach(btn => btn.addEventListener("click", () => {
      const key = btn.dataset.lang;
      document.querySelectorAll("[data-lang]").forEach(x => {
        x.classList.toggle("selected", x === btn);
        x.setAttribute("aria-selected", String(x === btn));
      });
      const [path, command] = langs[key];
      $("lang-path").textContent = path;
      $("lang-code").textContent = command;
      $("lang-link").href = "https://github.com/xulytiengviet/vifirmware/blob/main/" + path;
    }));
    try {
      const audit = CVNSSConverter.audit();
      const test = CVNSSConverter.selfTest();
      $("stat-ambiguity").textContent = audit.ambiguityGroups;
      $("stat-tests").textContent = test.ok ? test.tests + " OK" : "FAIL";
    } catch {
      $("stat-tests").textContent = "LỖI";
    }
    run();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
