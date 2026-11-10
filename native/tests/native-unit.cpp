#include "cvnss_codec.h"
#include <cassert>
#include <cstdio>
#include <string>
int main(){
  assert(cvnss::nativeRuleCount()==1094);
  assert(cvnss::isValidUtf8("Tôi yêu tiếng Việt"));
  assert(!cvnss::isValidUtf8(std::string("\xC3\x28",2)));
  const auto a=cvnss::encode("tôi");
  assert(a.ok&&a.value=="toiy");
  const auto b=cvnss::decodeCanonical(a.value);
  assert(b.ok&&b.value=="tôi");
  const auto text=cvnss::encode("Tôi yêu tiếng Việt");
  assert(text.ok&&!text.value.empty());
  const auto round=cvnss::decodeCanonical(text.value);
  assert(round.ok);
  const auto nfd=cvnss::normalizeVietnameseNfc(std::string("e\xCC\xA3\xCC\x82"));
  assert(nfd.ok&&nfd.value=="ệ");
  const auto broken=cvnss::encode(std::string("\xFF",1));
  assert(!broken.ok);
  const auto huge=cvnss::encode(std::string(1025,'a'));
  assert(!huge.ok);
  const auto amb=cvnss::inspect("es");
  assert(amb.ok&&amb.candidates.size()>1);
  printf("PASS native C++ codec: on-device-compatible algorithm, UTF-8, NFD Vietnamese, 1094 rules and ambiguity candidates\n");
}
