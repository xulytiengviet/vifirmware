// Native C++ proof runner; exact same core is compiled by ESP-IDF.
#include "cvnss_codec.h"
#include <chrono>
#include <cstdio>
#include <iomanip>
#include <iostream>
#include <string>

static std::string jsonEscape(const std::string& s) {
    std::string result="\"";
    for(unsigned char c:s){
        if(c=='"'||c=='\\'){result+='\\';result+=static_cast<char>(c);}
        else if(c=='\n')result+="\\n";
        else if(c=='\r')result+="\\r";
        else if(c=='\t')result+="\\t";
        else if(c<0x20){char buf[7];std::snprintf(buf,sizeof(buf),"\\u%04X",c);result+=buf;}
        else result+=static_cast<char>(c);
    }
    return result+"\"";
}
static int usage() {
    std::cerr<<"Usage: cvnss_native encode|decode|nfc|inspect TEXT; or cvnss_native benchmark\n";
    return 2;
}
int main(int argc,char** argv){
    if(argc==2&&std::string(argv[1])=="benchmark"){
        const std::string input="Tôi yêu tiếng Việt và nghiên cứu CVNSS";
        const size_t loops=10000;
        const auto begin=std::chrono::steady_clock::now();
        size_t bytes=0;
        for(size_t i=0;i<loops;i++){
            const auto output=cvnss::encode(input);
            if(!output.ok)return 1;
            bytes+=output.value.size();
        }
        const auto elapsed=std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::steady_clock::now()-begin).count();
        std::cout<<"HOST_ONLY loops="<<loops<<" total_us="<<elapsed<<" output_bytes="<<bytes<<"\n";
        return 0;
    }
    if(argc!=3)return usage();
    const std::string mode=argv[1],text=argv[2];
    if(mode=="inspect"){
        const auto inspect=cvnss::inspect(text);
        if(!inspect.ok){std::cerr<<inspect.error<<"\n";return 1;}
        std::cout<<"{\"selected\":"<<jsonEscape(inspect.selected)
          <<",\"codeVowel\":"<<jsonEscape(inspect.codeVowel)
          <<",\"candidates\":[";
        for(size_t i=0;i<inspect.candidates.size();i++){
            if(i)std::cout<<",";
            std::cout<<jsonEscape(inspect.candidates[i]);
        }
        std::cout<<"]}\n";
        return 0;
    }
    const auto result=mode=="encode"?cvnss::encode(text):
       mode=="decode"?cvnss::decodeCanonical(text):
       mode=="nfc"?cvnss::normalizeVietnameseNfc(text):
       cvnss::Result{false,"","Unknown CLI command",0};
    if(!result.ok){std::cerr<<result.error<<"\n";return 1;}
    std::cout<<result.value<<"\n";
    return 0;
}
