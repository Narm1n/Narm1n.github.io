(() => {
  'use strict';
  const p = 17, a = 0, b = 7;
  const INFINITY = null;
  const $ = (id) => document.getElementById(id);
  const scalarInput = $('scalar'), baseSelect = $('base'), canvas = $('curve'), ctx = canvas.getContext('2d');
  let state = { k: 6, G: [1,5], order: 9, trace: [], currentStep: 6, animTimer: null, animStep: 0 };

  function mod(n, m=p) { return ((n % m) + m) % m; }
  function inv(n) {
    n = mod(n);
    for (let i=1; i<p; i++) if (mod(n*i) === 1) return i;
    throw new Error('No modular inverse exists for this value.');
  }
  function same(P,Q) { return P === null ? Q === null : Q !== null && P[0]===Q[0] && P[1]===Q[1]; }
  function add(P,Q) {
    if (P===null) return Q;
    if (Q===null) return P;
    const [x1,y1]=P, [x2,y2]=Q;
    if (x1===x2 && mod(y1+y2)===0) return null;
    let lam;
    if (same(P,Q)) {
      if (y1===0) return null;
      lam = mod((3*x1*x1+a) * inv(2*y1));
    } else {
      lam = mod((y2-y1) * inv(x2-x1));
    }
    const x3 = mod(lam*lam-x1-x2);
    const y3 = mod(lam*(x1-x3)-y1);
    return [x3,y3];
  }
  function validPoint(P) { return P===null || mod(P[1]*P[1] - (P[0]*P[0]*P[0] + a*P[0] + b))===0; }
  function pointText(P) { return P===null ? '∞ (point at infinity)' : `(${P[0]}, ${P[1]})`; }
  function shortPoint(P) { return P===null ? '∞' : `(${P[0]}, ${P[1]})`; }
  function allCurvePoints() {
    const pts=[];
    for(let x=0;x<p;x++) for(let y=0;y<p;y++) if(validPoint([x,y])) pts.push([x,y]);
    return pts;
  }
  function multiples(G, max=100) {
    const list=[]; let R=null, order=null;
    for(let k=1;k<=max;k++) {
      R=add(R,G); list.push({k, point:R});
      if(R===null) { order=k; break; }
    }
    return {list, order};
  }
  function initBases() {
    const pts=allCurvePoints();
    // Avoid displaying inverse points as duplicates of the same choice only in label; every valid finite point is offered.
    pts.forEach(P => {
      const opt=document.createElement('option'); opt.value=`${P[0]},${P[1]}`; opt.textContent=`(${P[0]}, ${P[1]})`;
      if(P[0]===1 && P[1]===5) opt.selected=true;
      baseSelect.appendChild(opt);
    });
  }
  function draw(current=null, tracePoints=[]) {
    const W=canvas.width,H=canvas.height, m={l:45,r:24,t:25,b:40};
    const plotW=W-m.l-m.r, plotH=H-m.t-m.b;
    const X=x=>m.l + x/16*plotW, Y=y=>m.t + (16-y)/16*plotH;
    ctx.clearRect(0,0,W,H);
    ctx.font='12px system-ui'; ctx.lineWidth=1;
    for(let v=0;v<=16;v+=2) {
      ctx.strokeStyle='#e9edf5'; ctx.beginPath(); ctx.moveTo(X(v),m.t); ctx.lineTo(X(v),H-m.b); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.l,Y(v)); ctx.lineTo(W-m.r,Y(v)); ctx.stroke();
      ctx.fillStyle='#69758c'; ctx.textAlign='center'; ctx.fillText(v, X(v), H-m.b+18);
      ctx.textAlign='right'; ctx.fillText(v, m.l-9, Y(v)+4);
    }
    ctx.strokeStyle='#aeb9cb'; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.moveTo(m.l,m.t); ctx.lineTo(m.l,H-m.b); ctx.lineTo(W-m.r,H-m.b); ctx.stroke();
    ctx.fillStyle='#5d6a81'; ctx.textAlign='center'; ctx.fillText('x (mod 17)',m.l+plotW/2,H-8);
    ctx.save(); ctx.translate(14,m.t+plotH/2); ctx.rotate(-Math.PI/2); ctx.fillText('y (mod 17)',0,0); ctx.restore();
    const all=allCurvePoints();
    const multSet=new Set(tracePoints.filter(z=>z.point!==null).map(z=>z.point.join(',')));
    all.forEach(P=>{
      const key=P.join(','), isBase=same(P,state.G), isCurrent=same(P,current), isMult=multSet.has(key);
      const radius=isCurrent?8:isBase?7:isMult?5:4;
      ctx.beginPath(); ctx.arc(X(P[0]),Y(P[1]),radius,0,Math.PI*2);
      ctx.fillStyle=isCurrent?'#bd7800':isBase?'#138a83':isMult?'#315ee8':'#aab4c8'; ctx.fill();
      if(isCurrent || isBase) { ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); }
      if(isCurrent) { ctx.font='bold 12px system-ui'; ctx.textAlign='left'; ctx.fillStyle='#7a5000'; ctx.fillText(`kG ${shortPoint(P)}`,X(P[0])+10,Y(P[1])-8); }
      else if(isBase) { ctx.font='bold 12px system-ui'; ctx.textAlign='left'; ctx.fillStyle='#0b6e68'; ctx.fillText(`G ${shortPoint(P)}`,X(P[0])+10,Y(P[1])+15); }
    });
    if(current===null) {
      ctx.fillStyle='#8d3550'; ctx.font='bold 13px system-ui'; ctx.textAlign='right'; ctx.fillText('Current result: ∞',W-m.r,H-m.b-10);
    }
  }
  function addBarRows(targetId, counts, total) {
    const target=$(targetId); target.innerHTML='';
    const max=Math.max(1,...counts.map(d=>d.count));
    counts.forEach(d=>{
      const row=document.createElement('div'); row.className='barrow';
      const label=document.createElement('span'); label.textContent=d.label;
      const track=document.createElement('span'); track.className='bartrack';
      const fill=document.createElement('span'); fill.className='barfill'; fill.style.width=`${(d.count/max)*100}%`; track.appendChild(fill);
      const num=document.createElement('span'); num.textContent=d.count;
      row.append(label,track,num); target.appendChild(row);
    });
  }
  function renderStats(G, order) {
    const ms=multiples(G, order).list.filter(d=>d.point!==null);
    const freq=(coord)=>{
      const m=new Map(); ms.forEach(d=>m.set(d.point[coord],(m.get(d.point[coord])||0)+1));
      return [...m.entries()].sort((x,y)=>x[0]-y[0]).map(([v,count])=>({label:String(v),count}));
    };
    addBarRows('xBars',freq(0),ms.length); addBarRows('yBars',freq(1),ms.length);
    $('statsIntro').textContent=`This base point generates a subgroup of order ${order}. The counts below use its ${ms.length} distinct finite multiples once each; the point at infinity is excluded from coordinate counts.`;
    const xs=ms.map(d=>d.point[0]), ys=ms.map(d=>d.point[1]);
    const bitOn={x:0,y:0}, bitTotal=ms.length*5*2;
    ms.forEach(({point:[x,y]})=>{ for(let bit=0;bit<5;bit++){bitOn.x+=(x>>bit)&1; bitOn.y+=(y>>bit)&1;} });
    const xMean=xs.reduce((u,v)=>u+v,0)/xs.length, yMean=ys.reduce((u,v)=>u+v,0)/ys.length;
    let cov=0,vx=0,vy=0;
    for(let i=0;i<xs.length;i++){ cov+=(xs[i]-xMean)*(ys[i]-yMean); vx+=(xs[i]-xMean)**2; vy+=(ys[i]-yMean)**2; }
    const corr=(vx===0||vy===0)?NaN:cov/Math.sqrt(vx*vy);
    const div=document.createElement('div'); div.innerHTML=`<h3>Quick observations</h3><ul class="insights"><li><strong>Coordinate bits:</strong> x-coordinates contain ${bitOn.x} one-bits out of ${ms.length*5}; y-coordinates contain ${bitOn.y} one-bits out of ${ms.length*5}. Each coordinate is represented using only 5 bits here.</li><li><strong>Linear correlation in this tiny sample:</strong> Pearson correlation between numeric x and y values is ${Number.isFinite(corr)?corr.toFixed(3):'undefined'}; this number is descriptive only and says almost nothing about cryptographic security.</li><li><strong>Symmetry:</strong> each point (x,y) has inverse (x,17−y) (except y=0). In a cyclic subgroup, kG and (n−k)G are inverses, so their x-coordinates match.</li><li><strong>Interpretation:</strong> frequencies and bit counts depend on the chosen base point and the tiny subgroup. They are not evidence of uniformity on a cryptographic curve, nor an avalanche test for a hash function.</li></ul>`;
    $('statsText').replaceChildren(div);
  }
  function render(k, G, animateStep=null) {
    if(!validPoint(G) || G===null) throw new Error('Choose a valid finite point on the curve.');
    if(!Number.isInteger(k) || k<1 || k>100) throw new Error('Enter an integer k from 1 to 100.');
    const {list,order}=multiples(G, Math.max(100,k));
    // Since every finite point on a nonsingular curve has finite order, order is found well before max here.
    if(!order) throw new Error('Could not determine point order.');
    let R=null; const trace=[];
    for(let i=1;i<=k;i++){ R=add(R,G); trace.push({k:i,point:R}); }
    state={...state,k,G,order,trace,currentStep:animateStep===null?k:animateStep,animTimer:state.animTimer,animStep:state.animStep};
    const current=trace[Math.max(0,state.currentStep-1)].point;
    $('publicKey').textContent=shortPoint(trace[k-1].point);
    $('resultNote').textContent=`G=${shortPoint(G)}, k=${k}; point order n=${order}. Since n=${order}, scalars differing by n produce the same point.`;
    $('orderBadge').textContent=`Subgroup order: ${order}`;
    $('traceBody').innerHTML='';
    trace.forEach(d=>{
      const tr=document.createElement('tr');
      if(d.k===state.currentStep) tr.classList.add('active');
      if(d.point===null) tr.classList.add('infinity');
      const operation=d.k===1?'G':`${d.k-1}G + G`;
      let observation=d.point===null?'Reached point at infinity; scalar is a multiple of the order.':(d.k===order?'Base point order n: nG = ∞.':(d.k>order?'Cycle has repeated.':''));
      [d.k,operation,pointText(d.point),observation].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.appendChild(td);});
      $('traceBody').appendChild(tr);
    });
    draw(current, trace);
    renderStats(G,order);
    if(animateStep===null) $('status').textContent=`Computed ${k}G = ${shortPoint(trace[k-1].point)}. Highlighted row ${k} of ${k}.`;
  }
  function getInputs() {
    const k=Number(scalarInput.value), bits=baseSelect.value.split(',').map(Number);
    return {k,G:bits};
  }
  function stopAnimation() {
    if(state.animTimer!==null) clearTimeout(state.animTimer);
    state.animTimer=null; $('stop').disabled=true; $('animate').disabled=false;
  }
  function animate() {
    stopAnimation();
    const {k,G}=getInputs();
    try { render(k,G,1); } catch(e) { $('status').textContent=e.message; return; }
    $('animate').disabled=true; $('stop').disabled=false;
    let step=1;
    const tick=()=>{
      if(step>k){ stopAnimation(); $('status').textContent=`Animation complete: ${k}G = ${shortPoint(state.trace[k-1].point)}.`; return; }
      try { render(k,G,step); }
      catch(e){ stopAnimation(); $('status').textContent=e.message; return; }
      $('status').textContent=`Step ${step}/${k}: ${step===1?'G':`${step}G = ${step-1}G + G`} = ${shortPoint(state.trace[step-1].point)}.`;
      step++;
      state.animTimer=setTimeout(tick,650);
    };
    // Show the first multiple immediately, then animate each next addition.
    $('status').textContent=`Step 1/${k}: G = ${shortPoint(G)}.`;
    state.animTimer=setTimeout(tick,650);
  }
  $('compute').addEventListener('click',()=>{ stopAnimation(); try { const {k,G}=getInputs(); render(k,G); } catch(e) { $('status').textContent=e.message; } });
  $('animate').addEventListener('click',animate);
  $('stop').addEventListener('click',()=>{stopAnimation(); $('status').textContent='Animation stopped.';});
  scalarInput.addEventListener('keydown',e=>{if(e.key==='Enter') $('compute').click();});
  baseSelect.addEventListener('change',()=>{ if(!state.animTimer) $('compute').click(); });
  initBases();
  render(6,[1,5]);
})();
