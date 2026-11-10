// ViFirmware ESP-IDF reference experiment — precomputed CVNSS4.0 code.
// This is a VF1 transport proof, NOT a complete on-chip CVNSS4.0 converter.
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_system.h"

static const char* TAG = "ViFirmware";
static std::string trits(const std::string& s) {
    std::string r;
    for (char c : s) {
        if (c!=' ' && (c<'A' || c>'Z')) return {};
        const int n = c==' ' ? 0 : c-'A'+1;
        r.push_back(char('0'+n/9));
        r.push_back(char('0'+(n/3)%3));
        r.push_back(char('0'+n%3));
    }
    return r;
}
static uint32_t crc32(const std::string& code, const std::string& raw) {
    uint32_t value = 0xFFFFFFFFu;
    auto feed = [&](uint8_t b) {
        value ^= b;
        for(int i=0;i<8;i++) value=(value>>1)^((value&1u)?0xEDB88320u:0u);
    };
    for(unsigned char b:code) feed(b);
    feed(0);
    for(unsigned char b:raw) feed(b);
    return value^0xFFFFFFFFu;
}
static std::string hexdump(const std::string& raw) {
    static const char* h="0123456789ABCDEF";
    std::string r;
    for(unsigned char b:raw){r+=h[b>>4];r+=h[b&15];}
    return r;
}
static int digit(char c) {
    if(c>='0'&&c<='9')return c-'0';
    if(c>='A'&&c<='F')return c-'A'+10;
    return -1;
}
static bool verify(const std::string& frame, const std::string& expected) {
    std::vector<std::string> f;
    size_t pos=0, next;
    while((next=frame.find('|',pos))!=std::string::npos){
        f.push_back(frame.substr(pos,next-pos));pos=next+1;
    }
    f.push_back(frame.substr(pos));
    if(f.size()!=5||f[0]!="VF1"||f[1].empty())return false;
    if(trits(f[1])!=f[2]||f[3].size()%2)return false;
    std::string raw;
    for(size_t i=0;i<f[3].size();i+=2){
        int a=digit(f[3][i]),b=digit(f[3][i+1]);
        if(a<0||b<0)return false;
        raw.push_back(char((a<<4)|b));
    }
    char buf[9];
    std::snprintf(buf,sizeof(buf),"%08lX",
                  static_cast<unsigned long>(crc32(f[1],raw)));
    return raw==expected&&f[4]==buf;
}
extern "C" void app_main(void){
    const std::string cqn="tôi";   // UTF-8 NFC golden vector
    const std::string cvnss="TOIY"; // CVNSS4.0 v5 reference for "tôi"
    char crc[9];
    std::snprintf(crc,sizeof(crc),"%08lX",
                  static_cast<unsigned long>(crc32(cvnss,cqn)));
    const int64_t begin=esp_timer_get_time();
    const std::string frame="VF1|"+cvnss+"|"+trits(cvnss)+"|"+hexdump(cqn)+"|"+crc;
    const bool ok=verify(frame,cqn);
    const int64_t elapsed=esp_timer_get_time()-begin;
    ESP_LOGI(TAG,"precomputed CVNSS4.0: %s -> %s",cqn.c_str(),cvnss.c_str());
    ESP_LOGI(TAG,"VF1=%s frame_bytes=%u latency_us=%lld free_heap=%lu",
             ok?"PASS":"FAIL",static_cast<unsigned>(frame.size()),
             static_cast<long long>(elapsed),
             static_cast<unsigned long>(esp_get_free_heap_size()));
    if(!ok)ESP_LOGE(TAG,"Transport check failed");
}
