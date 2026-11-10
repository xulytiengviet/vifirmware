// VF1 transport reference (C++17), not a CVNSS4.0 linguistic converter.
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

static void checkCode(const string& s) {
    if (s.empty() || s.size() > 1024) throw runtime_error("invalid CODE length");
    for (unsigned char c : s)
        if (c != ' ' && (c < 'A' || c > 'Z')) throw runtime_error("CODE requires A-Z or SPACE");
}
static string trits(const string& s) {
    checkCode(s);
    string out; out.reserve(s.size()*3);
    for (char c : s) {
        int n = c == ' ' ? 0 : c - 'A' + 1;
        out.push_back(char('0' + n/9));
        out.push_back(char('0' + (n/3)%3));
        out.push_back(char('0' + n%3));
    }
    return out;
}
static uint32_t crc32(const string& code, const string& raw) {
    uint32_t crc = 0xFFFFFFFFu;
    auto update = [&](unsigned char b) {
        crc ^= b;
        for (int i = 0; i < 8; ++i)
            crc = (crc >> 1) ^ ((crc & 1u) ? 0xEDB88320u : 0u);
    };
    for (unsigned char c : code) update(c);
    update(0);
    for (unsigned char c : raw) update(c);
    return crc ^ 0xFFFFFFFFu;
}
static string hexBytes(const string& s) {
    static const char* h = "0123456789ABCDEF";
    string out; out.reserve(s.size()*2);
    for (unsigned char c : s) { out += h[c>>4]; out += h[c&15]; }
    return out;
}
static int hexDigit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    throw runtime_error("invalid uppercase HEX");
}
static string unhex(const string& s) {
    if (s.size()%2) throw runtime_error("uneven HEX length");
    string out; out.reserve(s.size()/2);
    for (size_t i=0;i<s.size();i+=2) out.push_back(char(hexDigit(s[i])*16 + hexDigit(s[i+1])));
    return out;
}
static string crcHex(const string& code, const string& raw) {
    ostringstream os; os << uppercase << hex << setfill('0') << setw(8) << crc32(code,raw);
    return os.str();
}
static string encode(const string& code, const string& raw) {
    return "VF1|" + code + "|" + trits(code) + "|" + hexBytes(raw) + "|" + crcHex(code,raw);
}
static string decode(const string& frame) {
    vector<string> f;
    size_t start=0, pos;
    while ((pos=frame.find('|',start))!=string::npos) {f.push_back(frame.substr(start,pos-start));start=pos+1;}
    f.push_back(frame.substr(start));
    if (f.size()!=5 || f[0]!="VF1") throw runtime_error("invalid VF1 header or field count");
    if (trits(f[1])!=f[2]) throw runtime_error("CODE/TRITS mismatch");
    if (f[4].size()!=8) throw runtime_error("invalid checksum length");
    for (char c:f[4]) (void)hexDigit(c);
    string raw=unhex(f[3]);
    if (crcHex(f[1],raw)!=f[4]) throw runtime_error("CRC32 mismatch");
    return raw;
}
int main(int argc,char** argv) {
    try {
        if (argc==4 && string(argv[1])=="encode") cout << encode(argv[2],argv[3]) << '\n';
        else if (argc==3 && string(argv[1])=="decode") {
            string raw=decode(argv[2]); cout.write(raw.data(),streamsize(raw.size()));
        } else { cerr << "usage: vifirmware encode CODE ORIGINAL | decode FRAME\n";return 2; }
        return 0;
    } catch (const exception& e) { cerr << "VF1 error: "<<e.what()<<'\n';return 1; }
}
