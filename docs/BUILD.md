# Build and reproducibility

Recommended versions: Python 3.10+, Node.js 20+, C++17 compiler, Java 17+, Swift 5.7+. Windows 10/11, Linux or macOS.

## 1. Browser
Configure GitHub Pages: Settings → Pages → Build and deployment → Deploy from a branch → branch: main → folder: /docs → Save. This requires a one-time repository setting change by its administrator. Open the GitHub Pages URL. No backend, CDN or API key required.

## 2. Python and Node
\`\`\`sh
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
python portable/python/vifirmware.py encode "XIN CHAO" "Xin chào"
\`\`\`

## 3. C++
\`\`\`sh
c++ -std=c++17 -O2 -Wall -Wextra -pedantic portable/cpp/vifirmware.cpp -o vifirmware_cpp
./vifirmware_cpp encode "XIN CHAO" "Xin chào"
\`\`\`

## 4. Java
\`\`\`sh
javac portable/java/ViFirmware.java
java -cp portable/java ViFirmware encode "XIN CHAO" "Xin chào"
\`\`\`

## 5. Swift
\`\`\`sh
swiftc portable/swift/ViFirmware.swift -o vifirmware_swift
./vifirmware_swift encode "XIN CHAO" "Xin chào"
\`\`\`

## Cross-language equivalence

The four clients must output the same ASCII VF1 line for identical CODE and original UTF-8 arguments. Running decode with a valid frame must recover the exact original UTF-8 bytes (without adding newline). A malformed checksum must fail. The CI builds C++ and Java on Ubuntu and Swift on macOS, running the same vector checks.

## ESP32-S3 / MCU target

This repository currently contains portable C++17 **host code**, not an ESP-IDF firmware project or a hardware flash log. To port: replace iostream/CLI with ESP-IDF UART, use bounded fixed buffers (CODE max 1024, full frame length bound), run golden vectors on device, measure .bin size, free heap, encoding latency and error counters.

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
