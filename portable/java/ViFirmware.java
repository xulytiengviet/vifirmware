// VF1 transport reference (Java 17+), not the full CVNSS4.0 linguistic converter.
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.CRC32;

public final class ViFirmware {
    static void checkCode(String code) {
        if (code.length() < 1 || code.length() > 1024 || !code.matches("[A-Z ]+"))
            throw new IllegalArgumentException("CODE requires 1..1024 ASCII A-Z or SPACE");
    }
    static String trits(String code) {
        checkCode(code);
        StringBuilder out = new StringBuilder(code.length()*3);
        for (char c : code.toCharArray()) {
            int v = c == ' ' ? 0 : c-'A'+1;
            out.append(v/9).append((v/3)%3).append(v%3);
        }
        return out.toString();
    }
    static String crc(String code, byte[] raw) {
        CRC32 crc = new CRC32();
        crc.update(code.getBytes(StandardCharsets.US_ASCII));
        crc.update(0);
        crc.update(raw);
        return String.format(Locale.ROOT, "%08X", crc.getValue());
    }
    static String hex(byte[] raw) {
        final char[] digits="0123456789ABCDEF".toCharArray();
        StringBuilder result=new StringBuilder(raw.length*2);
        for (byte b : raw) {
            result.append(digits[(b & 255) >>> 4]).append(digits[b & 15]);
        }
        return result.toString();
    }
    static byte[] unhex(String value) {
        if ((value.length()&1)!=0 || !value.matches("[0-9A-F]*"))
            throw new IllegalArgumentException("invalid uppercase HEX");
        byte[] bytes=new byte[value.length()/2];
        for (int i=0;i<bytes.length;i++) bytes[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);
        return bytes;
    }
    static String encode(String code, String original) {
        byte[] raw=original.getBytes(StandardCharsets.UTF_8);
        return "VF1|"+code+"|"+trits(code)+"|"+hex(raw)+"|"+crc(code,raw);
    }
    static byte[] decode(String frame) {
        String[] f=frame.split("\\|",-1);
        if (f.length!=5 || !f[0].equals("VF1")) throw new IllegalArgumentException("invalid VF1 frame");
        if (!trits(f[1]).equals(f[2])) throw new IllegalArgumentException("CODE/TRITS mismatch");
        if (!f[4].matches("[0-9A-F]{8}")) throw new IllegalArgumentException("invalid checksum");
        byte[] raw=unhex(f[3]);
        if (!crc(f[1],raw).equals(f[4])) throw new IllegalArgumentException("CRC32 mismatch");
        return raw;
    }
    public static void main(String[] args) {
        try {
            if (args.length==3 && args[0].equals("encode")) System.out.println(encode(args[1],args[2]));
            else if (args.length==2 && args[0].equals("decode")) System.out.write(decode(args[1]));
            else { System.err.println("usage: java ViFirmware encode CODE ORIGINAL | decode FRAME");System.exit(2); }
        } catch (Exception e) { System.err.println("VF1 error: "+e.getMessage());System.exit(1); }
    }
}
