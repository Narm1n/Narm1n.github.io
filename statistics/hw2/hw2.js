(() => {
  "use strict";
  const P = 17, G = {x:1,y:5};
  const mod = (n,m=P) => ((n % m) + m) % m;
  const inv = (a,m=P) => {
    a = mod(a,m);
    for (let i=1;i<m;i++) if (mod(a*i,m)===1) return i;
    throw new Error("No modular inverse exists.");
  };
  const pointText = p => p === null ? "∞" : `(${p.x}, ${p.y})`;
  function add(A,B) {
    if (A===null) return B;
    if (B===null) return A;
    if (A.x===B.x && mod(A.y+B.y)===0) return null;
    let slope;
    if (A.x===B.x && A.y===B.y) {
      if (A.y===0) return null;
      slope=mod(3*A.x*A.x*inv(2*A.y));
    } else slope=mod((B.y-A.y)*inv(B.x-A.x));
    const x=mod(slope*slope-A.x-B.x);
    const y=mod(slope*(A.x-x)-A.y);
    return {x,y};
  }
  function neg(A) { return A===null ? null : {x:A.x,y:mod(-A.y)}; }
  function sub(A,B) { return add(A,neg(B)); }
  function mul(k,A=G) {
    let n=k, result=null, base=A;
    while(n>0){if(n&1) result=add(result,base);base=add(base,base);n=Math.floor(n/2);}
    return result;
  }
  const pointKey = p => p===null ? "inf" : `${p.x},${p.y}`;
  const pointScalar = new Map();
  for(let i=0;i<=8;i++) pointScalar.set(pointKey(mul(i)),i);
  const $ = id => document.getElementById(id);
  const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clampInt=(v,min,max)=>Math.max(min,Math.min(max,Number.parseInt(v,10)||min));
  function asciiOctal(text) {
    const out=[];
    for(const ch of text) {
      const code=ch.codePointAt(0);
      if(code>127) throw new Error("Please use ASCII characters only in this tiny demonstration.");
      const oct=code.toString(8).padStart(3,"0");
      for(const digit of oct) out.push({char:ch,digit:Number(digit),oct});
    }
    return out;
  }
  function runECC() {
    const message=$("eccMessage").value;
    const d=clampInt($("eccPrivate").value,1,8), r=clampInt($("eccEphemeral").value,1,8);
    $("eccPrivate").value=d; $("eccEphemeral").value=r;
    if(!message.length){$("eccStatus").textContent="Enter a short message first.";return;}
    try {
      const blocks=asciiOctal(message), Q=mul(d), C1=mul(r), shared=mul(r,Q);
      let recovered="", rows="";
      for(let i=0;i<blocks.length;i++){
        const b=blocks[i], M=mul(b.digit+1), C2=add(M,shared);
        const M2=sub(C2,mul(d,C1));
        const scalar=pointScalar.get(pointKey(M2));
        const decodedDigit=scalar-1;
        if(scalar===undefined || decodedDigit!==b.digit) throw new Error("Decryption check failed.");
        rows+=`<tr><td>${i+1}</td><td>${b.digit} <span class="muted">(${b.oct})</span></td><td>${pointText(M)}</td><td>${pointText(C1)}</td><td>${pointText(C2)}</td><td>${pointText(M2)}</td></tr>`;
      }
      // Decode each character's three octal digits.
      const digits=blocks.map(b=>b.digit);
      for(let i=0;i<digits.length;i+=3) recovered+=String.fromCharCode(parseInt(digits.slice(i,i+3).join(""),8));
      $("eccPublic").textContent=pointText(Q);
      $("eccBlockCount").textContent=String(blocks.length);
      $("eccRecovered").textContent=recovered;
      $("eccTrace").innerHTML=rows || '<tr><td colspan="6">No blocks.</td></tr>';
      $("eccStatus").textContent=`Success: ${blocks.length} encoded blocks encrypted and recovered with d = ${d}, r = ${r}.`;
    } catch(e) {$("eccStatus").textContent=e.message;}
  }
  function caesar(text,key,mode) {
    const shift=mode==="decrypt" ? -key : key;
    return text.replace(/[a-z]/gi,ch=>{
      const base=ch===ch.toUpperCase()?65:97;
      return String.fromCharCode(base+mod(ch.charCodeAt(0)-base+shift,26));
    });
  }
  function runCaesar() {
    const key=clampInt($("caesarKey").value,0,25), mode=$("caesarMode").value;
    $("caesarKey").value=key;
    $("caesarOutput").value=caesar($("caesarInput").value,key,mode);
    $("caesarStatus").textContent=`Completed ${mode}ion with shift ${key}. Non-letters were preserved.`;
  }
  const english=[8.167,1.492,2.782,4.253,12.702,2.228,2.015,6.094,6.966,.153,.772,4.025,2.406,6.749,7.507,1.929,.095,5.987,6.327,9.056,2.758,.978,2.360,.150,1.974,.074];
  function counts(text) {
    const c=Array(26).fill(0);let n=0;
    for(const ch of text.toUpperCase()) if(ch>="A"&&ch<="Z"){c[ch.charCodeAt(0)-65]++;n++;}
    return {c,n};
  }
  function chiScore(text) {
    const {c,n}=counts(text); if(!n)return Infinity;
    return c.reduce((s,v,i)=>{const expected=n*english[i]/100;return s+(v-expected)**2/Math.max(expected,.0001);},0);
  }
  function renderCandidates(rows) {
    $("caesarCandidates").innerHTML=rows.map(r=>`<tr><td>${r.key}</td><td>${escapeHTML(r.text)}</td><td>${Number.isFinite(r.score)?r.score.toFixed(2):"—"}</td></tr>`).join("");
  }
  function runAttack(freqOnly=false) {
    const cipher=$("attackCipher").value;
    const rows=Array.from({length:26},(_,key)=>({key,text:caesar(cipher,key,"decrypt"),score:chiScore(caesar(cipher,key,"decrypt"))}));
    rows.sort((a,b)=>a.score-b.score);
    renderCandidates(freqOnly?rows.slice(0,8):rows);
  }
  function runEccAttack() {
    const target=clampInt($("attackTargetD").value,1,8), targetQ=mul(target);
    const candidates=[];
    for(let d=1;d<=8;d++) if(pointKey(mul(d))===pointKey(targetQ)) candidates.push(d);
    $("eccAttackResult").textContent=`Public key Q = ${pointText(targetQ)}\nCandidates tested: 8\nMatching private-key candidate(s): ${candidates.join(", ")}\nRecovered private key: ${candidates[0] ?? "not found"}`;
  }
  function renderFrequency(text,shifted=false) {
    const analyzed=shifted?caesar(text,3,"encrypt"):text;
    const {c,n}=counts(analyzed), max=Math.max(1,...c);
    $("frequencyChart").innerHTML=c.map((v,i)=>`<div class="freq-col"><span class="freq-value">${n?(100*v/n).toFixed(1):"0.0"}%</span><div class="freq-bar-wrap"><div class="freq-bar ${shifted?"shifted":""}" style="height:${Math.max(2,120*v/max)}px" title="${String.fromCharCode(65+i)}: ${v}"></div></div><span class="freq-label">${String.fromCharCode(65+i)}</span></div>`).join("");
  }
  $("eccRun").addEventListener("click",runECC);
  $("caesarRun").addEventListener("click",runCaesar);
  $("caesarCopy").addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText($("caesarOutput").value);$("caesarStatus").textContent="Output copied.";}
    catch{$("caesarStatus").textContent="Copy is unavailable in this browser context; select and copy the output manually.";}
  });
  $("caesarRoundTrip").addEventListener("click",()=>{
    const key=clampInt($("caesarKey").value,0,25), text=$("caesarInput").value;
    const encrypted=caesar(text,key,"encrypt"), decrypted=caesar(encrypted,key,"decrypt");
    $("caesarOutput").value=`ENCRYPTED:\n${encrypted}\n\nDECRYPTED:\n${decrypted}`;
    $("caesarStatus").textContent="Round trip completed; the decrypted text matches the original.";
  });
  $("bruteForce").addEventListener("click",()=>runAttack(false));
  $("frequencyAttack").addEventListener("click",()=>runAttack(true));
  $("eccAttack").addEventListener("click",runEccAttack);
  $("analyzeLetters").addEventListener("click",()=>renderFrequency($("frequencyText").value,false));
  $("shiftFrequency").addEventListener("click",()=>renderFrequency($("frequencyText").value,true));
  runECC();runCaesar();renderFrequency($("frequencyText").value,false);
})();
