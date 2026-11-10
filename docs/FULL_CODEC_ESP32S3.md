# Đánh giá đưa toàn bộ CVNSS4.0 lên firmware ESP32-S3

**Trạng thái:** phương án kiến trúc và tiêu chí nghiệm thu, **chưa có full codec C/C++ đã được kiểm chứng trên bo mạch**. Phiên bản bộ chuyển đổi tham chiếu: [CVNSS4.0 v5.0.0-audit-safe](https://github.com/xulytiengviet/CVNSS4.0/blob/main/assets/cvnss-converter.js). Bộ chuyển đổi hiện công bố 56 nhóm nhập nhằng và cách chọn ứng viên canonical.

## 1. Nói chính xác "full codec on-device" là gì?

Một **full codec** không phải chỉ có `TOIY ↔ tôi`, Base27, trits hay CRC32. Ít nhất cần:

- CQN UTF-8 NFC → CVNSS4.0 theo đầy đủ quy tắc và các bản vá cùng phiên bản tham chiếu;
- CVNSS4.0 → CQN trả về canonical **và** API nêu rõ tập ứng viên cho các mã nhập nhằng;
- Xử lý chữ hoa/thường, tách âm tiết, khoảng trắng, chữ số, dấu câu, tên riêng/ngoại ngữ và ký tự không hỗ trợ theo chính sách strict/pass-through/escape rõ ràng;
- Kiểm tra UTF-8 lỗi, Unicode NFC/NFD đầu vào; nếu không triển khai NFC trong MCU thì giao thức **phải giới hạn đầu vào là NFC đã chuẩn hóa** và không tuyên bố hỗ trợ NFD hoàn chỉnh;
- Tương thích chính sách 56 nhóm nhập nhằng; không được gắn nhãn round-trip 100% cho canonical decode trên mọi CQN;
- Bảng và quy tắc có hash/phiên bản, golden vectors đối chiếu với tham chiếu JS, báo cáo các trường hợp sai khác và đo tài nguyên trên phần cứng.

## 2. Ưu điểm dự kiến

| Giá trị | Vì sao hữu ích | Cách kiểm chứng |
|---|---|---|
| **Offline, không phụ thuộc cloud** | Xử lý tiếng Việt ngay khi không có Wi-Fi | Thử tắt Wi-Fi và chạy USB/UART |
| **Độ trễ dễ dự đoán** | Không phụ thuộc network round-trip | Đo p50/p95/p99 theo số byte/âm tiết |
| **Kiểm soát dữ liệu** | Không cần gửi nội dung tiếng Việt lên server chỉ để chuyển đổi | Audit đường truyền, cấp phát, log |
| **Tích hợp UART/BLE/MQTT dễ hơn** | ASCII có thể tiện cho giao thức cũ và debug | Đo bytes/frame, lỗi và thông lượng |
| **Có thể dùng bảng hằng trong Flash** | ROM/Flash đọc lại các bảng mà không cấp phát động toàn bộ vào RAM | Map file, .rodata, heap trước/sau |
| **Hợp nhất biên dịch/kiểm thử** | C++ codec dễ tích hợp ESP-IDF và test host | So đối chiếu golden tests trên host và MCU |

**Không có ưu điểm nào về tốc độ, RAM, năng lượng hoặc tỷ lệ nén được xem là đã đo chỉ từ lập luận trên.**

## 3. Nhược điểm, rủi ro và cách kiểm soát

| Rủi ro | Tác động | Biện pháp |
|---|---|---|
| **56 nhóm nhập nhằng** | Hai CQN khác nhau có thể cùng CVNSS4.0, giải mã canonical không byte-exact | API candidates, strict mode, escape/sidecar có phiên bản |
| **Unicode phức tạp** | Dấu tổ hợp, chữ hoa, vị trí thanh, NFC/NFD khác biểu diễn | Chuẩn hóa NFC bằng thư viện đã kiểm thử hoặc yêu cầu input NFC |
| **RAM nội hạn chế** | Bộ đệm, bảng động, task khác tranh chấp heap | Bảng tĩnh Flash, bounded buffers, stream, không tạo object/string không giới hạn |
| **Dung lượng Flash** | Bộ chuyển đổi, Unicode tables, OTA và ứng dụng cùng dùng phân vùng | Kiểm `idf.py size`, map file, giới hạn bảng, thiết kế phân vùng |
| **Chi phí CPU/điện năng** | Decode theo ngữ cảnh hoặc tìm ứng viên có thể tốn chu kỳ | Benchmark p50/p95, energy per conversion trên board |
| **Độ phức tạp bảo trì** | JS gốc thay đổi khiến firmware lệch quy tắc | Generator versioned + hash + differential test CI |
| **Truyền thông dữ liệu** | VF1 với HEX sidecar **tăng byte**, Base27/trit không tự nén | Đo dung lượng với/không sidecar trước và sau nén |
| **An ninh & an toàn** | CRC32 không chống sửa đổi ác ý; đầu vào không tin cậy có thể gây lỗi | Xác thực transport, ràng buộc độ dài, fuzz, OTA signed/rollback |

## 4. Thông số phần cứng: đúng bản chất

ESP32-S3 có 2 lõi Xtensa LX7 (đến 240 MHz) và **512 KB SRAM nội toàn chip**. 512 KB *không phải* heap hoàn toàn dành cho codec: một phần dùng cho hệ thống, task, stack, cache và ngoại vi. Flash và PSRAM thực tế **phụ thuộc module/board**; không mặc định tất cả ESP32-S3 có PSRAM. Cần giữ bảng lớn trong hằng Flash và đo heap thực khi chạy.

Nguồn chính thức:
- https://www.espressif.com/en/products/socs/esp32-s3
- https://documentation.espressif.com/esp32_s3_datasheet_en.pdf
- https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/partition-tables.html

## 5. Ba chiến lược triển khai

**A — Native C++/C (ưu tiên):** rút quy tắc và candidate graph từ converter JS đã kiểm tra, sinh bảng hằng, parser UTF-8 và thuật toán xác định. Tách module `cvnss_utf8`, `cvnss_nfc`, `cvnss_lexer`, `cvnss_rules`, `cvnss_candidates`, `cvnss_transport`, `cvnss_test`. Cùng một core biên dịch với g++ (host) và ESP-IDF (Xtensa). Không cần VM JS trong MCU.

**B — Interpreter JS trên MCU (nghiên cứu):** tái sử dụng logic gần nguồn gốc, nhưng runtime JS/GC, chi phí bộ nhớ và tương thích ECMA/Unicode phải đo thực; không khẳng định sẽ nằm trong ngân sách bộ nhớ.

**C — Hybrid (đã có nguyên mẫu VF1):** host xử lý CVNSS4.0, MCU kiểm tra khung và dùng Base27/trit; dễ làm trước nhưng **không phải** full on-device codec, vẫn phụ thuộc host cho bước chuyển đổi.

BilaScript v4 có frontend sinh JavaScript: `*.bila → lexer/AST/semantic → JavaScript`, **chưa sinh firmware C++ trực tiếp**. Để dùng với firmware phải có backend mới, hoặc dùng để viết logic host/test generation; không được gọi là đã biên dịch BilaScript thành mã máy ESP32-S3.

## 6. Gates nghiệm thu đúng nghĩa

| Gate | Kết quả cần nộp | Chỉ được công bố khi |
|---|---|---|
| G0 — Freeze | Source SHA và manifest quy tắc CVNSS4.0 | Tái lập được từ upstream |
| G1 — Native parity | Bảng test encoder/decoder/candidates, chữ hoa và UTF-8 lỗi | Đối chứng JS đồng nhất trên miền hỗ trợ |
| G2 — Domain proof | Số âm tiết, nhóm nhập nhằng, fallback/escape, lỗi | Không có va chạm âm thầm |
| G3 — Build | `.bin`, map/size, ESP-IDF version, board/flash/PSRAM | Build thật, không chỉ giả lập |
| G4 — Hardware | UART logs, reset/watchdog, hash binary, heap min | Flash và chạy trên ESP32-S3 |
| G5 — Measurement | latency p50/p95/p99, KiB/s, byte-size, energy (nếu đo) | Báo cáo số thực + cấu hình đo |
| G6 — Robustness | fuzz malformed UTF-8, size bounds, watchdog, power cycle | Không crash, không mất dữ liệu trái hợp đồng |
| G7 — Field/OTA | OTA signed, fallback rollback, audit nhiều ngày | Được vận hành thử đúng môi trường |

**Phân biệt 3 loại kết quả:**
1. **CQN semantic/canonical preservation:** `NFC(D(E(s))) == NFC(s)` chỉ có thể yêu cầu trong miền ánh xạ đã chứng minh đơn trị.
2. **VF1 byte-exact:** `frame_decode(frame_encode(code, raw)) == raw` nhờ **sidecar raw**, không chứng minh codec CVNSS4.0 không nhập nhằng.
3. **Full firmware:** CPU thực thi encoder/decoder CVNSS4.0 thật; một chương trình dùng mã `TOIY` tính sẵn **không** đạt gate này.

## 7. Kế hoạch tối ưu theo thứ tự

1. Chuẩn hóa input contract NFC, định nghĩa strict/canonical/lossless với escape rõ ràng.
2. Sinh dữ liệu tĩnh từ v5, lưu version/hash; giữ candidate graph, không làm mất 56 nhóm nhập nhằng.
3. Viết core C++ cho host và ESP-IDF, hạn chế cấp phát động và hoạt động theo chunk/buffer có độ dài.
4. Chạy differential test corpus lớn, so sánh cả encode/decode/candidates, không chỉ một câu ví dụ.
5. Biên dịch ESP32-S3; đo thực flash partition, free heap/min heap, latency và độ bền.
6. Nếu đạt ngưỡng yêu cầu đã khai báo trước, mới đánh giá có nên dùng Full Codec hay Hybrid trong sản phẩm.

**Khuyến nghị:** Đưa full codec lên ESP32-S3 phù hợp cho thiết bị offline, kiosk tiếng Việt, cảm biến/robot điều khiển nhỏ hoặc text command đơn giản. Không có cơ sở kết luận nó làm TinyLLM nhanh hơn hay biến chip nhị phân thành tam phân; những đề tài đó phải được đo riêng.
