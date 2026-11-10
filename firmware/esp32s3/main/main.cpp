// ViFirmware ESP32-S3: native Unicode Vietnamese -> CVNSS4.0 -> canonical Unicode.
// Actual algorithm runs on the MCU; NO precomputed CVNSS strings or cloud calls.
// Proof-of-concept source, NOT a statement that the board has been flashed.
#include "cvnss_codec.h"
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_heap_caps.h"
#include "driver/uart.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static constexpr uart_port_t kUart=UART_NUM_0;
static const char* TAG="ViFirmware";

static void convertAndReport(const std::string& original){
    const size_t freeBefore=heap_caps_get_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
    const int64_t start=esp_timer_get_time();
    const auto code=cvnss::encode(original);
    const int64_t encodeUs=esp_timer_get_time()-start;
    if(!code.ok){
        ESP_LOGE(TAG,"ENC_FAIL: %s",code.error.c_str());
        return;
    }
    const int64_t mid=esp_timer_get_time();
    const auto decoded=cvnss::decodeCanonical(code.value);
    const int64_t decodeUs=esp_timer_get_time()-mid;
    if(!decoded.ok){
        ESP_LOGE(TAG,"DEC_FAIL: %s",decoded.error.c_str());
        return;
    }
    // Canonical decode may legitimately differ from input: see 56 ambiguity groups.
    const auto canonicalInput=cvnss::normalizeVietnameseNfc(original);
    const bool exact=canonicalInput.ok&&canonicalInput.value==decoded.value;
    const size_t freeAfter=heap_caps_get_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
    const size_t minimum=heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
    ESP_LOGI(TAG,"IN_UTF8: %s",original.c_str());
    ESP_LOGI(TAG,"CVNSS4: %s",code.value.c_str());
    ESP_LOGI(TAG,"DECODE: %s",decoded.value.c_str());
    ESP_LOGI(TAG,"NFC_EQ=%s AMBIG_TOKENS=%u",exact?"YES":"NO",
             static_cast<unsigned>(decoded.ambiguousTokens));
    ESP_LOGI(TAG,"ENC_US=%lld DEC_US=%lld FREE_INTERNAL_B=%u MIN_INTERNAL_B=%u BEFORE_B=%u",
             static_cast<long long>(encodeUs),static_cast<long long>(decodeUs),
             static_cast<unsigned>(freeAfter),static_cast<unsigned>(minimum),
             static_cast<unsigned>(freeBefore));
}
static void processLine(const std::string& line){
    if(line=="HELP"){
        ESP_LOGI(TAG,"Commands: ENC <UTF-8 Vietnamese> | DEC <CVNSS4 ASCII> | INS <CVNSS word> | NFC <input> | INFO | HELP");
        return;
    }
    if(line=="INFO"){
        ESP_LOGI(TAG,"Native tables=%u | reference=%s | maxUTF8Bytes=%u",
                static_cast<unsigned>(cvnss::nativeRuleCount()),
                cvnss::referenceVersion(),static_cast<unsigned>(cvnss::kMaxInputBytes));
        return;
    }
    if(line.rfind("ENC ",0)==0){convertAndReport(line.substr(4));return;}
    if(line.rfind("DEC ",0)==0){
        auto out=cvnss::decodeCanonical(line.substr(4));
        if(!out.ok)ESP_LOGE(TAG,"%s",out.error.c_str());
        else ESP_LOGI(TAG,"CANONICAL_CQN=%s AMBIG_TOKENS=%u",out.value.c_str(),static_cast<unsigned>(out.ambiguousTokens));
        return;
    }
    if(line.rfind("NFC ",0)==0){
        const auto out=cvnss::normalizeVietnameseNfc(line.substr(4));
        if(!out.ok)ESP_LOGE(TAG,"%s",out.error.c_str());
        else ESP_LOGI(TAG,"NFC_SUBSET=%s",out.value.c_str());
        return;
    }
    if(line.rfind("INS ",0)==0){
        const auto result=cvnss::inspect(line.substr(4));
        if(!result.ok){ESP_LOGE(TAG,"%s",result.error.c_str());return;}
        ESP_LOGI(TAG,"SELECTED=%s CANDIDATES=%u",
                 result.selected.c_str(),static_cast<unsigned>(result.candidates.size()));
        for(size_t i=0;i<result.candidates.size();i++){
            ESP_LOGI(TAG,"[%u] %s",static_cast<unsigned>(i),result.candidates[i].c_str());
        }
        return;
    }
    ESP_LOGW(TAG,"Unknown command; type HELP");
}
extern "C" void app_main(void){
    ESP_LOGI(TAG,"Native CVNSS4.0 codec boot; reference=%s rules=%u",
             cvnss::referenceVersion(),static_cast<unsigned>(cvnss::nativeRuleCount()));
    // Proof-of-concept computes the CVNSS encoding ON DEVICE, not a precomputed output.
    for(const auto& text: {"tôi","Tôi yêu tiếng Việt","nghiêng","nguyễn","ệ"}){
        convertAndReport(text);
    }
    ESP_LOGI(TAG,"Self-test and memory readings above are only authoritative if collected from real UART hardware logs.");

    // Native UART0 input. A USB-UART bridge connected to UART0 RX/TX may be needed
    // on boards whose USB Serial/JTAG is a separate console peripheral.
    uart_config_t cfg={};
    cfg.baud_rate=115200;
    cfg.data_bits=UART_DATA_8_BITS;
    cfg.parity=UART_PARITY_DISABLE;
    cfg.stop_bits=UART_STOP_BITS_1;
    cfg.flow_ctrl=UART_HW_FLOWCTRL_DISABLE;
    cfg.source_clk=UART_SCLK_DEFAULT;
    if(uart_param_config(kUart,&cfg)!=ESP_OK ||
       uart_driver_install(kUart,2048,0,0,nullptr,0)!=ESP_OK){
        ESP_LOGE(TAG,"Cannot initialize UART0. Check board console/pins.");return;
    }
    ESP_LOGI(TAG,"READY UART0 115200; send: ENC Tôi yêu tiếng Việt\\n");
    std::string buffer;
    buffer.reserve(cvnss::kMaxInputBytes+8);
    while(true){
        uint8_t byte=0;
        const int count=uart_read_bytes(kUart,&byte,1,pdMS_TO_TICKS(50));
        if(count<=0)continue;
        if(byte=='\r')continue;
        if(byte=='\n'){
            if(!buffer.empty())processLine(buffer);
            buffer.clear();continue;
        }
        if(buffer.size()<cvnss::kMaxInputBytes+8){
            buffer.push_back(static_cast<char>(byte));
        }else{
            ESP_LOGW(TAG,"UART line too long, discarded");
            buffer.clear();
        }
    }
}
