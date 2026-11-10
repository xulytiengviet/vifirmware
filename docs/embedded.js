/* ViFirmware embedded architecture assessment: local interactivity, no invented benchmark metrics. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const profiles = Object.freeze({
    native: {
      label:"KHUYẾN NGHỊ / FULL CODEC",
      title:"C/C++ + bảng hằng sinh từ converter",
      body:"Port lexer, âm tiết, quy tắc, candidate graph, Unicode contract sang core C/C++ dùng chung host và ESP-IDF. Đặt bảng ánh xạ trong Flash, giới hạn buffer và đo thực sau mỗi phiên bản.",
      offline:"Có, khi toàn bộ encoder/decoder đã ở trên board",
      memory:"Có thể tối ưu bảng Flash; cần đo heap và .bin",
      full:"Đã có native C++; chưa có phép đo chạy trên bo mạch",
      risk:"Công port, Unicode NFC, 56 nhóm nhập nhằng và duy trì parity"
    },
    hybrid: {
      label:"DỄ THỬ NHẤT / KHÔNG PHẢI FULL CODEC",
      title:"Host CVNSS4.0 + ESP32-S3 nhận VF1",
      body:"Converter v5 chạy trên máy tính/server, ESP32-S3 chỉ nhận mã đã chuyển, kiểm tra trits/CRC và dùng dữ liệu. Gần với nguyên mẫu firmware hiện có nhất.",
      offline:"Thiết bị chỉ offline cho phần xử lý dữ liệu đã nhận",
      memory:"Ít gánh nặng converter trên MCU",
      full:"Không: không có bộ chuyển đổi CQN ↔ CVNSS trên chip",
      risk:"Phụ thuộc host, tăng lưu lượng khi mang sidecar và rủi ro mạng"
    },
    js: {
      label:"NGHIÊN CỨU / RỦI RO CAO",
      title:"Đưa JavaScript runtime vào ESP32-S3",
      body:"Có thể giữ nhiều logic từ converter JS hơn, nhưng phải chọn VM hỗ trợ đủ Unicode/ECMAScript, kiểm tra tương thích và profiling bộ nhớ trước khi sử dụng.",
      offline:"Có về nguyên tắc nếu engine + converter nằm trên chip",
      memory:"Runtime/GC và chuỗi Unicode có thể tạo chi phí đáng kể",
      full:"Chưa chứng minh; phụ thuộc tính tương thích của runtime",
      risk:"Flash, heap, garbage collection, hiệu năng và tính tái lập"
    }
  });
  function setProfile(name) {
    const p=profiles[name];
    if (!p) return;
    for (const [id,field] of [
      ["strategy-label","label"],["strategy-title","title"],["strategy-body","body"],
      ["strategy-offline","offline"],["strategy-memory","memory"],["strategy-full","full"],["strategy-risk","risk"]
    ]) $(id).textContent=p[field];
    document.querySelectorAll("[data-strategy]").forEach(el=>{
      const active=el.getAttribute("data-strategy")===name;
      el.classList.toggle("active",active);
      el.setAttribute("aria-selected",String(active));
      el.tabIndex=active?0:-1;
    });
  }
  function updateGates(){
    const boxes=Array.from(document.querySelectorAll("[data-gate]"));
    const count=boxes.filter(x=>x.checked).length;
    $("gates-count").textContent=count+"/"+boxes.length+" hạng mục đã đánh dấu (mô phỏng)";
    $("gates-progress").style.width=(count/boxes.length*100)+"%";
  }
  document.addEventListener("DOMContentLoaded",()=>{
    document.querySelectorAll("[data-strategy]").forEach(b=>b.addEventListener("click",()=>setProfile(b.dataset.strategy)));
    document.querySelectorAll("[data-gate]").forEach(b=>b.addEventListener("change",updateGates));
    $("gates-reset").addEventListener("click",()=>{
      document.querySelectorAll("[data-gate]").forEach(b=>b.checked=false);
      updateGates();
    });
    setProfile("native"); updateGates();
    try{
      const conv=globalThis.CVNSSConverter;
      if (!conv) throw Error("missing CVNSSConverter");
      const audit=conv.audit(), self=conv.selfTest();
      $("cvn-ambiguity").textContent=String(audit.ambiguityGroups);
      $("cvn-selftest").textContent=self.ok ? String(self.tests) : "FAIL";
      if (!self.ok) console.warn("CVNSS4 reference self test failed.");
    }catch(error){
      $("cvn-ambiguity").textContent="N/A";
      $("cvn-selftest").textContent="N/A";
      console.warn("Không đọc được converter v5:",error);
    }
  });
})();
