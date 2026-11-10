#include "cvnss_codec.h"
#include "cvnss_tables.generated.h"
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <utility>
#include <vector>

namespace cvnss {
namespace {
using cvnss_data::Pair;
struct Unit { uint32_t cp; std::string utf8; };
bool prefix(const std::string& s,const std::string& p){return s.size()>=p.size()&&s.compare(0,p.size(),p)==0;}
bool utf8Units(const std::string& text,std::vector<Unit>& out) {
    out.clear();
    for(size_t i=0;i<text.size();) {
        const uint8_t b=static_cast<uint8_t>(text[i]);
        int length=0;
        uint32_t cp=0;
        if(b<0x80){length=1;cp=b;}
        else if(b>=0xC2&&b<=0xDF){length=2;cp=b&0x1Fu;}
        else if(b>=0xE0&&b<=0xEF){length=3;cp=b&0x0Fu;}
        else if(b>=0xF0&&b<=0xF4){length=4;cp=b&0x07u;}
        else return false;
        if(i+static_cast<size_t>(length)>text.size())return false;
        for(int k=1;k<length;k++){
            const uint8_t c=static_cast<uint8_t>(text[i+k]);
            if((c&0xC0u)!=0x80u)return false;
            cp=(cp<<6)|(c&0x3Fu);
        }
        if((length==2&&cp<0x80u)||(length==3&&cp<0x800u)||
           (length==4&&cp<0x10000u)||(cp>=0xD800u&&cp<=0xDFFFu)||
           cp>0x10FFFFu)return false;
        out.push_back({cp,text.substr(i,static_cast<size_t>(length))});
        i+=static_cast<size_t>(length);
    }
    return true;
}
template<size_t N>
const char* find(const Pair (&data)[N],const std::string& key){
    for(const auto& item:data)if(key==item.from)return item.to;
    return nullptr;
}
template<size_t N>
bool containsCode(const Pair (&data)[N],const std::string& code){
    for(const auto& item:data)if(code==item.to)return true;
    return false;
}
std::string first(const std::string& s){
    if(s.empty())return "";
    uint8_t b=static_cast<uint8_t>(s[0]);
    size_t n=b<0x80u?1:(b<0xE0u?2:(b<0xF0u?3:4));
    return s.substr(0,std::min(n,s.size()));
}
std::string rest(const std::string& s){return s.substr(first(s).size());}
bool letter(uint32_t cp){
    return (cp>='a'&&cp<='z')||(cp>='A'&&cp<='Z')||
           (cp>=0x00C0u&&cp<=0x024Fu)||
           (cp>=0x1E00u&&cp<=0x1EFFu);
}
bool combining(uint32_t cp){return cp>=0x0300u&&cp<=0x036Fu;}
int combiningClass(uint32_t cp){
    if(cp==0x031Bu)return 216; // horn
    if(cp==0x0323u)return 220; // dot below
    return 230; // common Vietnamese tone, breve, circumflex
}
std::string lowercase(const std::string& text){
    std::vector<Unit> units;
    if(!utf8Units(text,units))return "";
    std::string out;
    for(const auto& u:units){
        if(u.cp>='A'&&u.cp<='Z'){out.push_back(static_cast<char>(u.cp+32));continue;}
        const char* mapped=find(cvnss_data::kLower,u.utf8);
        out+=mapped?mapped:u.utf8;
    }
    return out;
}
std::string uppercase(const std::string& text){
    std::vector<Unit> units;
    if(!utf8Units(text,units))return "";
    std::string out;
    for(const auto& u:units){
        if(u.cp>='a'&&u.cp<='z'){out.push_back(static_cast<char>(u.cp-32));continue;}
        const char* mapped=nullptr;
        for(const auto& x:cvnss_data::kLower)if(u.utf8==x.to){mapped=x.from;break;}
        out+=mapped?mapped:u.utf8;
    }
    return out;
}
std::string applyCase(const std::string& source,const std::string& converted){
    if(converted.empty())return converted;
    if(source==uppercase(source))return uppercase(converted);
    const std::string s0=first(source);
    if(s0==uppercase(s0)&&s0!=lowercase(s0)){
        const std::string r0=first(converted);
        return uppercase(r0)+rest(converted);
    }
    return converted;
}
std::string baseVowel(const std::string& ch){
    const std::string lower=lowercase(ch);
    const char* mapped=find(cvnss_data::kBaseVowel,lower);
    return mapped?mapped:lower;
}
const char* rule(const std::string& vowel){
    const char* x=find(cvnss_data::kRules,vowel);
    if(x)return x;
    return find(cvnss_data::kAliases,vowel);
}
bool hasCode(const std::string& code){return containsCode(cvnss_data::kRules,code);}
std::vector<std::string> candidateVowels(const std::string& code){
    std::vector<std::string> result;
    for(const auto& x:cvnss_data::kRules){
        if(code==x.to&&std::find(result.begin(),result.end(),x.from)==result.end())result.push_back(x.from);
    }
    return result;
}
std::pair<std::string,std::string> splitCqn(const std::string& word){
    for(const auto& x:cvnss_data::kInitials){
        if(prefix(word,x.from))return {x.from,word.substr(std::strlen(x.from))};
    }
    return {"",word};
}
std::pair<std::string,std::string> normalizeParts(std::string onset,std::string vowel){
    const std::string vfirst=baseVowel(first(vowel));
    if(onset=="gi"&&vowel!="a"&&rule("i"+vowel))vowel="i"+vowel;
    if(onset=="qu"&&vfirst=="y")vowel="u"+vowel;
    if(onset=="g"&&vfirst=="i")onset="gi";
    if(onset=="g"&&(vfirst=="e"||vfirst=="ê"))onset="gh";
    if(onset=="c"&&(vfirst=="i"||vfirst=="ê"||vfirst=="e"))onset="k";
    if(onset=="ng"&&(vfirst=="i"||vfirst=="ê"||vfirst=="e"))onset="ngh";
    return {onset,vowel};
}
std::string onsetCode(const std::string& onset){
    const char* value=find(cvnss_data::kInitials,onset);
    return value?value:onset;
}
std::string encodeWord(const std::string& word){
    auto split=splitCqn(lowercase(word));
    auto p=normalizeParts(split.first,split.second);
    const char* value=rule(p.second);
    return applyCase(word,onsetCode(p.first)+(value?std::string(value):p.second));
}
std::pair<std::string,std::string> splitCode(const std::string& word){
    const std::string lower=lowercase(word);
    if(hasCode(lower))return {"",lower};
    for(const char* x:cvnss_data::kCodeInitials){
        const std::string code=x;
        if(prefix(lower,code)){
            const std::string remainder=lower.substr(code.size());
            if(!remainder.empty()&&hasCode(remainder))return {code,remainder};
        }
    }
    for(const char* x:cvnss_data::kCodeInitials){
        const std::string code=x;
        if(prefix(lower,code))return {code,lower.substr(code.size())};
    }
    return {"",lower};
}
std::string restoreInitial(const std::string& onset,const std::string& vowel){
    const std::string b=baseVowel(first(vowel));
    if(onset=="q")return "qu";
    if(onset=="j")return "gi";
    if(onset=="z")return "d";
    if(onset=="d")return "đ";
    if(onset=="f")return "ph";
    if(onset=="k")return "kh";
    if(onset=="w")return (b=="i"||b=="ê"||b=="e")?"ngh":"ng";
    if(onset=="g")return (b=="i"||b=="ê"||b=="e")?"gh":"g";
    if(onset=="c")return (b=="i"||b=="ê"||b=="e")?"k":"c";
    return onset;
}
bool giShortVowel(const std::string& v){
    const std::string ch=first(v);
    if(ch!="i"&&ch!="ì"&&ch!="ỉ"&&ch!="ĩ"&&ch!="í"&&ch!="ị")return false;
    const std::string c=rest(v);
    return c==""||c=="m"||c=="n"||c=="p"||c=="t"||c=="c"||
           c=="ch"||c=="ng"||c=="nh";
}
std::string joinCqn(const std::string& codeInitial,std::string v){
    std::string onset=restoreInitial(codeInitial,v);
    if(onset.empty()&&!prefix(v,"ia")){
        const std::string f=first(v);
        const char* alias=find(cvnss_data::kIToY,f);
        if(alias)v=std::string(alias)+rest(v);
    }
    if(onset=="gi"&&baseVowel(first(v))=="i"){
        if(giShortVowel(v))return "g"+v;
        const std::string r=rest(v);
        if(!r.empty())v=r;
    }
    if(onset=="qu"&&baseVowel(first(v))=="u"&&!rest(v).empty())v=rest(v);
    return onset+v;
}
std::string decodeWord(const std::string& word,size_t* ambiguity){
    const auto split=splitCode(word);
    std::vector<std::string> options=candidateVowels(split.second);
    std::string chosen=split.second;
    if(!options.empty()){
        chosen=options.front();
        if(options.size()>1){
            if(ambiguity)++*ambiguity;
            const char* preferred=find(cvnss_data::kPreferred,split.second);
            if(preferred&&std::find(options.begin(),options.end(),preferred)!=options.end())
                chosen=preferred;
        }
    }
    return applyCase(word,joinCqn(split.first,chosen));
}
Result tokenTransform(const std::string& text,bool doEncode){
    if(text.size()>kMaxInputBytes)return {false,"","Input exceeds 1024 UTF-8 bytes",0};
    const auto norm=normalizeVietnameseNfc(text);
    if(!norm.ok)return norm;
    std::vector<Unit> units;
    if(!utf8Units(norm.value,units))return {false,"","Invalid UTF-8",0};
    Result result{true,"","",0};
    std::string current;bool currentLetter=false,have=false;
    const auto flush=[&](){
        if(current.empty())return;
        if(currentLetter){
            if(doEncode)result.value+=encodeWord(current);
            else result.value+=decodeWord(current,&result.ambiguousTokens);
        }else result.value+=current;
        current.clear();
    };
    for(const auto& u:units){
        const bool kind=letter(u.cp);
        if(have&&kind!=currentLetter)flush();
        currentLetter=kind;
        have=true;
        current+=u.utf8;
    }
    flush();
    return result;
}
} // namespace

bool isValidUtf8(const std::string& text){
    std::vector<Unit> units;
    return utf8Units(text,units);
}
Result normalizeVietnameseNfc(const std::string& input){
    if(input.size()>kMaxInputBytes)return {false,"","Input exceeds 1024 UTF-8 bytes",0};
    std::vector<Unit> units;
    if(!utf8Units(input,units))return {false,"","Invalid UTF-8",0};
    std::string output;
    std::vector<Unit> cluster;
    const auto flush=[&](){
        if(cluster.empty())return;
        std::string expanded=cluster.front().utf8;
        const char* decomp=find(cvnss_data::kDecompositions,expanded);
        if(decomp)expanded=decomp;
        std::vector<Unit> parts;
        if(!utf8Units(expanded,parts)){cluster.clear();return;}
        std::vector<Unit> marks;
        for(size_t i=1;i<parts.size();i++)marks.push_back(parts[i]);
        for(size_t i=1;i<cluster.size();i++)marks.push_back(cluster[i]);
        std::stable_sort(marks.begin(),marks.end(),[](const Unit& a,const Unit& b){
            return combiningClass(a.cp)<combiningClass(b.cp);
        });
        std::string candidate=parts.front().utf8;
        for(const auto& m:marks)candidate+=m.utf8;
        const char* composed=nullptr;
        for(const auto& x:cvnss_data::kDecompositions){
            if(candidate==x.to){composed=x.from;break;}
        }
        output+=composed?composed:candidate;
        cluster.clear();
    };
    for(const auto& u:units){
        if(combining(u.cp)&&!cluster.empty())cluster.push_back(u);
        else{flush();cluster.push_back(u);}
    }
    flush();
    return {true,output,"",0};
}
Result encode(const std::string& cqn){return tokenTransform(cqn,true);}
Result decodeCanonical(const std::string& cvss){return tokenTransform(cvss,false);}
CandidateResult inspect(const std::string& cvssWord){
    if(cvssWord.empty()||cvssWord.size()>kMaxInputBytes||!isValidUtf8(cvssWord))
        return {false,"","",{},"Invalid code word"};
    const auto split=splitCode(cvssWord);
    auto vowels=candidateVowels(split.second);
    if(vowels.empty())vowels.push_back(split.second);
    CandidateResult output;
    output.ok=true;output.codeVowel=split.second;
    for(const auto& v:vowels){
        std::string word=applyCase(cvssWord,joinCqn(split.first,v));
        if(std::find(output.candidates.begin(),output.candidates.end(),word)==output.candidates.end())
            output.candidates.push_back(word);
    }
    output.selected=decodeWord(cvssWord,nullptr);
    return output;
}
const char* referenceVersion(){return cvnss_data::kReferenceVersion;}
size_t nativeRuleCount(){return cvnss_data::kRuleCount;}
} // namespace cvnss
