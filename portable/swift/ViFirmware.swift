// VF1 reference client (Swift 5.7+). This validates the transport, not CVNSS4.0 orthography.
import Foundation

enum VFError: Error { case invalid(String) }
let alphabet = Array(" ABCDEFGHIJKLMNOPQRSTUVWXYZ")
func trits(_ code: String) throws -> String {
    let chars = Array(code)
    guard !chars.isEmpty && chars.count <= 1024 else { throw VFError.invalid("CODE length") }
    var result = ""
    for c in chars {
        guard let n=alphabet.firstIndex(of:c) else { throw VFError.invalid("CODE must be A-Z or SPACE") }
        result += String(n/9) + String((n/3)%3) + String(n%3)
    }
    return result
}
func crc(_ code: String, _ bytes: [UInt8]) -> String {
    var sum: UInt32 = 0xFFFFFFFF
    for b in Array(code.utf8) + [0] + bytes {
        sum ^= UInt32(b)
        for _ in 0..<8 {
            sum = (sum >> 1) ^ ((sum & 1) == 1 ? 0xEDB88320 : 0)
        }
    }
    return String(format: "%08X", sum ^ 0xFFFFFFFF)
}
func encode(_ code: String, _ raw: String) throws -> String {
    let t = try trits(code)
    let bytes = Array(raw.utf8)
    return "VF1|\(code)|\(t)|\(bytes.map { String(format:"%02X",$0) }.joined())|\(crc(code,bytes))"
}
func decode(_ frame: String) throws -> [UInt8] {
    let fields=frame.split(separator:"|", omittingEmptySubsequences:false).map(String.init)
    guard fields.count == 5 && fields[0]=="VF1" else { throw VFError.invalid("VF1 field count/header") }
    guard try trits(fields[1]) == fields[2] else { throw VFError.invalid("TRITS mismatch") }
    let h=Array(fields[3].utf8)
    guard h.count % 2 == 0 else { throw VFError.invalid("HEX length") }
    let digits = Array("0123456789ABCDEF".utf8)
    var bytes=[UInt8]()
    for i in stride(from:0,to:h.count,by:2) {
        guard let a=digits.firstIndex(of:h[i]), let b=digits.firstIndex(of:h[i+1]) else {
            throw VFError.invalid("invalid HEX")
        }
        bytes.append(UInt8(a*16+b))
    }
    guard fields[4].utf8.count==8 && fields[4].utf8.allSatisfy({digits.contains($0)}) else { throw VFError.invalid("CRC format") }
    guard crc(fields[1],bytes)==fields[4] else { throw VFError.invalid("CRC mismatch") }
    guard String(bytes:bytes,encoding:.utf8) != nil else { throw VFError.invalid("invalid UTF-8") }
    return bytes
}
let args=Array(CommandLine.arguments.dropFirst())
do {
    if args.count==3 && args[0]=="encode" {
        print(try encode(args[1],args[2]))
    } else if args.count==2 && args[0]=="decode" {
        FileHandle.standardOutput.write(Data(try decode(args[1])))
    } else {
        fputs("usage: ViFirmware encode CODE ORIGINAL | decode FRAME\n",stderr)
        exit(2)
    }
} catch {
    fputs("VF1 error: \(error)\n",stderr)
    exit(1)
}
