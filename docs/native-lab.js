/* ViFirmware Native Lab: reference simulator + optional real Web Serial. No mock hardware claims.
 * JavaScript reference runs in-browser; independent native C++ runs in CI/ESP-IDF.
 */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const sample="Tôi yêu tiếng Việt";
  const reference=()=>globalThis.CVNSSConverter;
  const encoder=new TextEncoder();
  const decoder=new TextDecoder("utf-8",{fatal:false});
  let lastExpected=null,port=null,reader=null,connected=false;
  let pending=null,verifiedCases=[],serialBuffer="",deviceLines=[];
  const append=(id,line)=>{
    const area=$(id);
    if(area.textContent.includes("Chưa ")&&area.textContent.length<120)area.textContent="";
    area.textContent+=(area.textContent?"\n":"")+line;
    const lines=area.textContent.split("\n");
    if(lines.length>220)area.textContent=lines.slice(-220).join("\n");
    area.scrollTop=area.scrollHeight;
  };
  const bytes=s=>encoder.encode(s).length;
  function inspectTokens(code){
    const tokens=code.match(/[\p{L}]+/gu)||[];
    const examples=[];
    for(const token of tokens){
      const inf=reference().inspectWord(token.toLowerCase(),"cvss");
      if(inf.ambiguous)examples.push(token+" → "+inf.candidates.join(" / "));
    }
    return {count:examples.length,examples:examples.slice(0,5)};
  }
  function runReference(){
    try{
      const src=$("proof-input").value;
      if(!src.trim())throw Error("Chưa nhập văn bản");
      const conv=reference();if(!conv)throw Error("Thiếu converter v5");
      const normalized=src.normalize("NFC");
      const encoded=conv.fromCqn(normalized).cvss;
      const canonical=conv.fromCvss(encoded).cqn;
      const ambiguity=inspectTokens(encoded);
      const exact=canonical.normalize("NFC")===normalized;
      $("out-nfc").textContent=normalized;
      $("out-cvn").textContent=encoded;
      $("out-decoded").textContent=canonical;
      $("out-equal").textContent=exact?"TRÙNG CHUẨN TẮC TRONG VÍ DỤ":"KHÁC — CẦN LƯU ỨNG VIÊN / METADATA";
      $("out-equal").style.color=exact?"var(--proof-lime)":"var(--proof-orange)";
      $("out-ambiguity").textContent=ambiguity.count+" token có nhiều ứng viên"+(ambiguity.examples.length?"\n"+ambiguity.examples.join("\n"):"");
      const ratio=(bytes(encoded)/Math.max(1,bytes(normalized))*100).toFixed(1);
      $("out-bytes").textContent="CQN NFC: "+bytes(normalized)+" B | CVNSS UTF-8: "+bytes(encoded)+" B | tỉ lệ: "+ratio+"% (chưa tính framing)";
      $("reference-status").textContent="THAM CHIẾU JS / PASS";
      const ts=new Date().toLocaleTimeString("vi-VN");
      append("sim-log","[SIM/JS "+ts+"] INPUT: "+src);
      append("sim-log","[SIM/JS] NFC: "+normalized);
      append("sim-log","[SIM/JS] CVNSS4: "+encoded);
      append("sim-log","[SIM/JS] DECODE: "+canonical);
      append("sim-log","[SIM/JS] ROUND_TRIP_NFC="+(exact?"MATCH":"DIFF")+"; AMBIG_TOKENS="+ambiguity.count);
      lastExpected={source:src,nfc:normalized,code:encoded,canonical};
      return lastExpected;
    }catch(error){
      $("reference-status").textContent="THAM CHIẾU JS / FAIL";
      append("sim-log","[SIM/JS ERROR] "+error.message);
      return null;
    }
  }
  function logReal(line){
    const clean=line.replace(/\x1B\[[0-9;]*[A-Za-z]/g,"").trim();
    if(!clean)return;
    deviceLines.push({at:new Date().toISOString(),line:clean});
    if(deviceLines.length>3000)deviceLines.shift();
    append("device-log",clean);
    if(!pending)return;
    const code=/\bCVNSS4:\s*(.+)$/.exec(clean);
    const result=/\bDECODE:\s*(.+)$/.exec(clean);
    if(code){
      pending.receivedCode=code[1].trim();
      if(pending.receivedCode!==pending.expected.code){
        $("board-comparison").textContent="SAI KHÁC: mã CVNSS từ board không khớp converter JS tham chiếu cho đầu vào này.";
        $("board-comparison").style.color="var(--proof-red)";
      }
    }
    if(result)pending.receivedDecode=result[1].trim();
    if(pending.receivedCode!==undefined&&pending.receivedDecode!==undefined){
      const pass=pending.receivedCode===pending.expected.code&&pending.receivedDecode===pending.expected.canonical;
      verifiedCases.push({
        input:pending.expected.source,expectedCode:pending.expected.code,
        actualCode:pending.receivedCode,expectedCanonical:pending.expected.canonical,
        actualCanonical:pending.receivedDecode,pass,at:new Date().toISOString()
      });
      $("device-status-metric").textContent=verifiedCases.filter(x=>x.pass).length+" ca";
      $("metric-detail").textContent=verifiedCases.length+" ca có log phản hồi từ thiết bị trong phiên";
      $("board-comparison").textContent=pass
        ?"ĐÃ ĐỐI CHIẾU 1 CA: UART board khớp JS reference. Chưa chứng minh tính đúng đắn toàn bộ hoặc thông số RAM/Flash."
        :"FAIL: Có khác biệt giữa board và tham chiếu. Xuất log để phân tích.";
      $("board-comparison").style.color=pass?"var(--proof-lime)":"var(--proof-red)";
      pending=null;
    }
  }
  async function serialReadLoop(){
    if(!port?.readable)return;
    const textDecoder=new TextDecoder();
    try{
      reader=port.readable.getReader();
      while(connected){
        const {value,done}=await reader.read();
        if(done)break;
        serialBuffer+=textDecoder.decode(value,{stream:true});
        if(serialBuffer.length>25000)serialBuffer=serialBuffer.slice(-8000);
        let n;
        while((n=serialBuffer.indexOf("\n"))!==-1){
          logReal(serialBuffer.slice(0,n).replace(/\r$/,""));
          serialBuffer=serialBuffer.slice(n+1);
        }
      }
    }catch(error){
      if(connected)append("device-log","[WEB SERIAL] "+error.message);
    }finally{
      try{reader?.releaseLock()}catch{}
      reader=null;
    }
  }
  function setConnected(isConnected){
    connected=isConnected;
    $("connect-serial").disabled=isConnected;
    $("send-serial").disabled=!isConnected;
    $("disconnect-serial").disabled=!isConnected;
    $("device-pill").textContent=isConnected?"ĐÃ MỞ CỔNG UART":"CHƯA KẾT NỐI";
    $("device-pill").style.color=isConnected?"var(--proof-lime)":"var(--proof-orange)";
  }
  async function connect(){
    if(!navigator.serial?.requestPort){
      $("serial-support").textContent="Trình duyệt không hỗ trợ Web Serial. Hãy dùng Chrome/Edge trên HTTPS hoặc theo dõi UART bằng idf.py monitor.";
      return;
    }
    try{
      port=await navigator.serial.requestPort();
      await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:"none",flowControl:"none"});
      setConnected(true);
      append("device-log","[WEB SERIAL] Đã mở cổng. Log dưới đây là dữ liệu thực qua serial.");
      void serialReadLoop();
    }catch(error){
      append("device-log","[WEB SERIAL] Không kết nối: "+error.message);
      port=null;
    }
  }
  async function disconnect(){
    setConnected(false);
    pending=null;
    try{await reader?.cancel()}catch{}
    try{await port?.close()}catch{}
    port=null;
    append("device-log","[WEB SERIAL] Đã ngắt");
  }
  async function send(){
    if(!connected||!port?.writable)return;
    const x=runReference();if(!x)return;
    pending={expected:x};
    const command="ENC "+x.source.replace(/[\r\n]+/g," ")+"\n";
    try{
      const writer=port.writable.getWriter();
      try{await writer.write(encoder.encode(command))}
      finally{writer.releaseLock()}
      append("device-log","[WEB SERIAL -> UART0] Đã gửi "+bytes(command)+" byte UTF-8; chờ output của board");
      $("board-comparison").textContent="Đã gửi, chưa nhận đủ CVNSS4 và DECODE để đối chiếu.";
      $("board-comparison").style.color="var(--proof-orange)";
    }catch(error){
      pending=null;
      append("device-log","[WEB SERIAL ERROR] "+error.message);
    }
  }
  function exportLog(){
    const json=JSON.stringify({
      project:"ViFirmware",mode:"physical Web Serial capture (if connected)",
      exportedAt:new Date().toISOString(),
      boardModel:"not verified by browser",
      serialLines:deviceLines,
      comparisonCases:verifiedCases,
      warnings:["WebSerial logs are user-captured, not an independent board attestation",
                "No measured electrical power, CPU frequency or flash partition unless logged by firmware"]
    },null,2);
    const link=document.createElement("a"),url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
    link.href=url;link.download="vifirmware-board-session.json";
    link.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  document.addEventListener("DOMContentLoaded",()=>{
    const a=reference();
    if(!a||!a.selfTest().ok){
      $("reference-status").textContent="THAM CHIẾU JS / LỖI";
    }
    $("simulate").addEventListener("click",runReference);
    document.querySelectorAll("[data-sample]").forEach(button=>button.addEventListener("click",()=>{
      $("proof-input").value=button.getAttribute("data-sample");runReference();
    }));
    $("copy-uart").addEventListener("click",async()=>{
      const text="ENC "+$("proof-input").value.replace(/[\r\n]+/g," ")+"\n";
      try{await navigator.clipboard.writeText(text);$("copy-uart").textContent="Đã sao chép UART ✓";}
      catch(error){append("sim-log","[COPY ERROR] "+error.message);}
    });
    $("clear-sim").addEventListener("click",()=>{$("sim-log").textContent="[SIM/JS] Đã xóa log mô phỏng.";});
    $("connect-serial").addEventListener("click",connect);
    $("disconnect-serial").addEventListener("click",disconnect);
    $("send-serial").addEventListener("click",send);
    $("export-log").addEventListener("click",exportLog);
    if(!navigator.serial){
      $("serial-support").textContent="Web Serial không khả dụng trên trình duyệt này. Có thể chạy mô phỏng hoặc dùng idf.py monitor.";
    }
    runReference();
  });
})();
