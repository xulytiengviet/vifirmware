# Build and reproducibility

Recommended versions: Python 3.10+, Node.js 20+, C++17 compiler, Java 17+, Swift 5.7+. Windows 10/11, Linux or macOS.

## 1. Browser
Configure GitHub Pages: Settings → Pages → Build and deployment → Deploy from a branch → branch: main → folder: /docs → Save. This requires a one-time repository setting change by its administrator. Open the GitHub Pages URL. No backend, CDN or API key required.

## 2. Python and Node
\`\`\`sh
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
python portable/python/vifirmware.py encode "TOIY" "tôi"
\`\`\`

## 3. C++
\`\`\`sh
c++ -std=c++17 -O2 -Wall -Wextra -pedantic portable/cpp/vifirmware.cpp -o vifirmware_cpp
./vifirmware_cpp encode "TOIY" "tôi"
\`\`\`

## 4. Java
\`\`\`sh
javac portable/java/ViFirmware.java
java -cp portable/java ViFirmware encode "TOIY" "tôi"
\`\`\`

## 5. Swift
\`\`\`sh
swiftc portable/swift/ViFirmware.swift -o vifirmware_swift
./vifirmware_swift encode "TOIY" "tôi"
\`\`\`

## Cross-language equivalence

The four clients must output the same ASCII VF1 line for identical CODE and original UTF-8 arguments. Running decode with a valid frame must recover the exact original UTF-8 bytes (without adding newline). A malformed checksum must fail. The CI builds C++ and Java on Ubuntu and Swift on macOS, running the same vector checks.

## ESP32-S3 / MCU target

This repository now contains an ESP-IDF project that calls a native C++ CVNSS4.0 encoder and decoder. Host and cross-compiler results are available in GitHub Actions, but a hardware flash log is still missing. To port: replace iostream/CLI with ESP-IDF UART, use bounded fixed buffers (CODE max 1024, full frame length bound), run golden vectors on device, measure .bin size, free heap, encoding latency and error counters.

Raw sidecars are intentionally redundant and expensive. For telemetry where only the canonical CVNSS4.0 code is required, a different versioned lossy/canonical-only packet may be used but must never claim byte-exact recovery.

## Documentation and measurement

Do not label source code parity as TRL 5 or claim firmware operation until a compiled MCU binary and on-device UART logs are recorded. Tests and browser verification are distinct from hardware validation.


## ESP32-S3 reference source (unverified)

An ESP-IDF C++ reference app is in \`firmware/esp32s3/\`. It transports the precomputed CVNSS4.0 reference vector \`tôi → TOIY\` as VF1 and checks trits, CRC32 and UTF-8 bytes. This source does not yet implement the full CVNSS4.0 language codec on ESP32-S3.

\`\`\`sh
cd firmware/esp32s3
idf.py set-target esp32s3
idf.py build
idf.py -p COM5 flash monitor
\`\`\`

Replace COM5 with the actual serial port. Do not claim measured hardware performance until real flash logs and a successful binary build have been recorded.

## Full CVNSS4.0 native-port readiness

Trang đánh giá: [embedded.html](embedded.html) · Báo cáo chuyên sâu: [FULL_CODEC_ESP32S3.md](FULL_CODEC_ESP32S3.md).

Để công bố "full codec trên ESP32-S3", cần encoder và decoder thực thi trên MCU; bộ firmware mẫu hiện tại mới vận chuyển mã tính sẵn. Kiểm thử hiện hành của CI chỉ xác nhận các client VF1 và converter tham chiếu JS; không chứng minh hiệu năng firmware.

## Generate reference vectors for a future C/C++ full-codec port

Run `node tools/export_reference_vectors.cjs > golden-reference.json`. The vectors come from the official JavaScript converter and expose canonical differences and candidates; this does **not** test a native MCU encoder or prove universal losslessness. Keep the generated file next to native-port comparison logs.


## Native core verification & UART0 live experiment

1. Regenerate static table: \`node tools/gen_native_tables.cjs\`.
2. Build host: \`g++ -std=c++17 -O2 -I native/include native/src/cvnss_codec.cpp native/src/cvnss_cli.cpp -o build/cvnss_native\` (create \`build/\` first).
3. Host differential parity: \`node tools/native-parity.cjs\`. View report \`build/native-parity-report.json\`.
4. Cross-build: GitHub Actions workflow \`.github/workflows/esp-idf.yml\`, or use ESP-IDF command lines in \`firmware/esp32s3/README.md\`.
5. Physical UART0 115200: \`ENC Tôi yêu tiếng Việt\`, \`DEC toiy\`, \`INS es\`; record \`CVNSS4\`, \`DECODE\`, \`ENC_US\`, \`DEC_US\`, heap.

Interactive web lab: \`docs/native-lab.html\` simulates the JS reference. Where supported, Web Serial can connect to an actual ESP32-S3 UART0 port and capture logs; it does not fake MCU measurements.

**Scientific boundary:** The host and cross-build tests are not real board runtime measurements. For all-uppercase and name case or non-Vietnamese Unicode, run strict domain audits; canonical decoding is not universally lossless.
