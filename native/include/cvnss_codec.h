#pragma once
#include <cstddef>
#include <string>
#include <vector>

// CQN <-> CVNSS4.0 v5 native on-device preliminary reference.
// The core runs without JS/Python/cloud and uses static tables in Flash.
// Strictly bounded line length; Vietnamese Unicode NFC/NFD subset (not full Unicode ICU).
namespace cvnss {
static constexpr size_t kMaxInputBytes = 1024;
struct Result {
    bool ok = false;
    std::string value;
    std::string error;
    size_t ambiguousTokens = 0;
};
struct CandidateResult {
    bool ok = false;
    std::string selected;
    std::string codeVowel;
    std::vector<std::string> candidates;
    std::string error;
};
bool isValidUtf8(const std::string& text);
Result normalizeVietnameseNfc(const std::string& input);
Result encode(const std::string& cqn);
Result decodeCanonical(const std::string& cvss);
CandidateResult inspect(const std::string& cvssWord);
const char* referenceVersion();
size_t nativeRuleCount();
}
