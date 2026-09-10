(async()=>{
const root=document.getElementById('hm2'),main=root.querySelector('#hm2-main'),presets=await (await fetch('/presets.json')).json();
let country=localStorage.getItem('hedge-country')||'sg';if(!presets[country])country='sg';let company=null,lines=[],gaps=[],elsewhere=[],page='home',busy=false,error='',motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;let tickets=[];try{tickets=JSON.parse(localStorage.getItem('hedge-tickets-v1')||'[]');if(!Array.isArray(tickets))tickets=[]}catch{}let currentId=null;
let wallet='',desk=[],quoteTimers={},status={quotesEnabled:true,builderConfigured:false,tradingEnabled:false};let receiptPos={x:0,y:0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=n=>`<i data-lucide="${n}" aria-hidden="true"></i>`;
const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const px=n=>Number(n).toFixed(3);
const queryHint={sg:'name, industry, or yourbusiness.sg',us:'name, industry, or yourbusiness.com',kr:'name, industry, or yourbusiness.kr',mx:'name, industry, or yourbusiness.mx',vn:'name, industry, or yourbusiness.vn',gb:'name, industry, or yourbusiness.co.uk'};
function sourceLine(){return company?.sourceLabel||'Source: website'}
function sourceStamp(){return esc(sourceLine())}
async function api(path,body,ms){const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:ms?AbortSignal.timeout(ms):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed.');return d}
try{status=await api('/api/status')}catch{}
function nav(){root.querySelectorAll('[data-country]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.country===country)));root.querySelector('.avatar').textContent=presets[country].code;root.querySelector('.tagline').innerHTML='A little more prepared.<br>For '+presets[country].people+' small businesses.';root.querySelector('#hm2-count').textContent=tickets.length?'('+tickets.length+')':'';root.classList.toggle('motion-paused',!motion)}
function receipt(torn=false){const live=lines.map((l,i)=>`<div class="receipt-row">${i+1}. ${esc(l.category)} <b>BUY ${esc(l.side.toUpperCase())}</b><br>${esc(l.question)}<small>${esc(l.basisRisk)}</small><small>${l.quote&&l.quote.ask!=null?'Ask: $'+Number(l.quote.ask).toFixed(3)+(l.quote.eligible?'':' · thin book'):'No live quote'}</small></div>`).join('');const watch=gaps.map((g,i)=>`<div class="receipt-row">${lines.length+i+1}. ${esc(g.category)} <b>NO LIVE MARKET</b><br>${esc(g.title||g.category)}<small>${esc(g.reason||'')}</small><small>${esc(g.hedge)}</small></div>`).join('');const off=elsewhere.map((e,i)=>`<div class="receipt-row">${lines.length+gaps.length+i+1}. ${esc(e.category)} <b>ELSEWHERE</b><br>${esc(e.title)}<small>${esc(e.venue)} · ${esc(e.product)}</small><small>${esc(e.hedge)}</small></div>`).join('');return `<div class="printer-wrap"><div class="printer"><div class="printer-brand"><img class="logo" src="/logo.png" width="22" height="22" alt=""><span>hedge markets</span></div><div class="slot"></div></div><div class="receipt ${torn?'torn':''}" tabindex="0" role="group" aria-label="Ticket. Drag to move it on the page." style="--rx:${receiptPos.x}px;--ry:${receiptPos.y}px"><h3>HEDGE MARKETS</h3><div class="receipt-head"><b>${esc(company.name)}</b><br>${sourceStamp()}<br>${lines.length} LIVE · ${gaps.length} WATCH · ${elsewhere.length} ELSEWHERE<br>${company.url?esc(company.url):'No website used'}</div>${live}${watch}${off}<div class="receipt-warning">Not a broker or insurance.<br>Live rows are Polymarket contracts ($1 or $0).<br>Watchpoints have no live contract here.<br>Elsewhere rows are other venues — not traded here.<br>You can lose your stake.<br>Payouts may not offset business losses.</div></div></div>`}
function xmlEsc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function inlineClone(src){
  const dst=src.cloneNode(true);
  const walk=(from,to,root)=>{
    if(from.nodeType!==1)return;
    const cs=getComputedStyle(from),box=from.getBoundingClientRect(),parts=[];
    for(let i=0;i<cs.length;i++){
      const p=cs.item(i);
      if(p.startsWith('--rx')||p.startsWith('--ry')||p.startsWith('animation')||p.startsWith('transition')||p==='offset-anchor'||p==='offset-path'||p==='offset-distance')continue;
      parts.push(p+':'+cs.getPropertyValue(p));
    }
    parts.push('width:'+Math.max(1,Math.ceil(box.width))+'px','box-sizing:border-box');
    if(root){
      parts.push('height:'+Math.max(1,Math.ceil(src.offsetHeight))+'px','transform:none','animation:none','margin:0','cursor:default','touch-action:auto','position:relative','left:auto','top:auto','right:auto','bottom:auto','filter:none','opacity:1');
      to.classList.remove('dragging','snap');
    }
    to.style.cssText=parts.join(';');
    to.removeAttribute('tabindex');to.removeAttribute('aria-label');to.removeAttribute('role');
    const a=[...from.children],b=[...to.children];
    for(let i=0;i<a.length;i++)walk(a[i],b[i],false);
  };
  walk(src,dst,true);
  return dst;
}
function toXHTML(node){
  if(node.nodeType===3)return xmlEsc(node.textContent);
  if(node.nodeType!==1)return '';
  const tag=node.tagName.toLowerCase();
  let attrs='';
  for(const at of node.attributes)attrs+=' '+at.name+'="'+xmlEsc(at.value)+'"';
  if({br:1,hr:1,img:1,input:1,meta:1,link:1}[tag])return '<'+tag+attrs+'/>';
  return '<'+tag+attrs+'>'+[...node.childNodes].map(toXHTML).join('')+'</'+tag+'>';
}
function loadImg(url){return new Promise((ok,fail)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>fail(Error('Could not render the ticket image.'));img.src=url})}
function paintCanvas(img,w,h){
  const scale=2,pad=28,canvas=document.createElement('canvas');
  canvas.width=(w+pad*2)*scale;canvas.height=(h+pad*2)*scale;
  const ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);
  ctx.fillStyle='#f3f8ff';
  ctx.fillRect(0,0,w+pad*2,h+pad*2);
  ctx.shadowColor='rgba(23,54,91,0.18)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;
  ctx.drawImage(img,pad,pad,w,h);
  return canvas.toDataURL('image/png');
}
function html2canvasReady(){
  if(globalThis.html2canvas)return Promise.resolve(globalThis.html2canvas);
  return new Promise((ok,fail)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload=()=>globalThis.html2canvas?ok(globalThis.html2canvas):fail(Error('Image capture failed to load.'));
    s.onerror=()=>fail(Error('Image capture failed to load.'));
    document.head.appendChild(s);
  });
}
async function snapshotReceipt(src){
  try{
    const h2c=await html2canvasReady();
    const shot=await h2c(src,{backgroundColor:null,scale:2,logging:false,imageTimeout:0,useCORS:true,onclone(doc){
      const el=doc.querySelector('.receipt');
      if(!el)return;
      el.style.transform='none';el.style.animation='none';el.style.margin='0';el.style.cursor='default';el.style.filter='none';el.style.touchAction='auto';
      el.classList.remove('dragging','snap');
    }});
    const pad=56,out=document.createElement('canvas');
    out.width=shot.width+pad*2;out.height=shot.height+pad*2;
    const ctx=out.getContext('2d');
    ctx.fillStyle='#f3f8ff';ctx.fillRect(0,0,out.width,out.height);
    ctx.shadowColor='rgba(23,54,91,0.18)';ctx.shadowBlur=24;ctx.shadowOffsetY=14;
    ctx.drawImage(shot,pad,pad);
    return out.toDataURL('image/png');
  }catch{
    const w=Math.ceil(src.offsetWidth),h=Math.ceil(src.offsetHeight);
    const clone=inlineClone(src);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><foreignObject width="'+w+'" height="'+h+'"><div xmlns="http://www.w3.org/1999/xhtml" style="width:'+w+'px;height:'+h+'px">'+toXHTML(clone)+'</div></foreignObject></svg>';
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try{return paintCanvas(await loadImg(url),w,h)}finally{URL.revokeObjectURL(url)}
  }
}
function wrapCanvasText(ctx,text,x,y,max,lineH){
  const words=String(text||'').split(/\s+/);let row='',top=y;
  for(const word of words){
    const next=row?row+' '+word:word;
    if(row&&ctx.measureText(next).width>max){ctx.fillText(row,x,top);top+=lineH;row=word}
    else row=next;
  }
  if(row){ctx.fillText(row,x,top);top+=lineH}
  return top;
}
function receiptFallbackPNG(){
  const scale=2,width=420,pad=28,inner=width-48;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const linesY=[];
  ctx.font='10px "Courier New",monospace';
  const measure=()=>{
    let y=70;
    y+=34;
    const head=[company.name,sourceLine(),lines.length+' LIVE · '+gaps.length+' WATCH · '+elsewhere.length+' ELSEWHERE',company.url||'No website used'];
    head.forEach(()=>y+=16);y+=24;
    const addRow=(title,buy,body,notes)=>{
      y+=6;ctx.font='10px "Courier New",monospace';y+=16;
      ctx.font='10px "Courier New",monospace';y=wrapCanvasText(ctx,body,0,y,inner,14);
      notes.forEach(n=>{y=wrapCanvasText(ctx,n,0,y,inner,13)});y+=10;
    };
    lines.forEach(l=>addRow(l.category,'BUY '+String(l.side||'').toUpperCase(),l.question,[l.basisRisk,l.quote&&l.quote.ask!=null?'Ask: $'+Number(l.quote.ask).toFixed(3)+(l.quote.eligible?'':' · thin book'):'No live quote']));
    gaps.forEach(g=>addRow(g.category,'NO LIVE MARKET',g.title||g.category,[g.reason||'',g.hedge]));
    elsewhere.forEach(e=>addRow(e.category,'ELSEWHERE',e.title,[e.venue+' · '+e.product,e.hedge]));
    y+=18;['Not a broker or insurance.','Live rows are Polymarket contracts ($1 or $0).','Watchpoints have no live contract here.','Elsewhere rows are other venues — not traded here.','You can lose your stake.','Payouts may not offset business losses.'].forEach(()=>y+=14);
    return y+36;
  };
  const height=Math.max(320,measure());
  canvas.width=(width+pad*2)*scale;canvas.height=(height+pad*2)*scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.fillStyle='#f3f8ff';ctx.fillRect(0,0,width+pad*2,height+pad*2);
  ctx.save();
  ctx.translate(pad,pad);
  ctx.shadowColor='rgba(23,54,91,0.18)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;
  ctx.beginPath();
  ctx.moveTo(0,0);ctx.lineTo(width,0);ctx.lineTo(width,height-14);
  for(let x=width;x>=0;x-=12)ctx.lineTo(x,height-(Math.round(x/12)%2?0:14));
  ctx.closePath();ctx.fillStyle='#fffef9';ctx.fill();ctx.clip();
  ctx.shadowColor='transparent';
  const fade=ctx.createLinearGradient(0,0,0,30);fade.addColorStop(0,'#c9cbd3');fade.addColorStop(1,'#fffef9');
  ctx.fillStyle=fade;ctx.fillRect(0,0,width,30);
  ctx.fillStyle='#11172b';ctx.textBaseline='top';ctx.font='700 15px "Courier New",monospace';ctx.textAlign='center';
  ctx.fillText('HEDGE MARKETS',width/2,22);
  ctx.font='11px "Courier New",monospace';
  let y=48;
  ctx.strokeStyle='#9197a4';ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(width-24,y);ctx.stroke();y+=12;
  ctx.fillStyle='#11172b';ctx.fillText(company.name,width/2,y);y+=16;
  ctx.fillStyle='#5a6070';ctx.font='10px "Courier New",monospace';
  [sourceLine(),lines.length+' LIVE · '+gaps.length+' WATCH · '+elsewhere.length+' ELSEWHERE',company.url||'No website used'].forEach(t=>{ctx.fillText(t,width/2,y);y+=14});
  y+=6;ctx.strokeStyle='#9197a4';ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(width-24,y);ctx.stroke();ctx.setLineDash([]);y+=8;
  ctx.textAlign='left';
  const drawRow=(left,buy,body,notes)=>{
    y+=8;
    ctx.font='10px "Courier New",monospace';ctx.fillStyle='#11172b';ctx.fillText(left,24,y);
    ctx.fillStyle='#0345c2';ctx.textAlign='right';ctx.fillText(buy,width-24,y);ctx.textAlign='left';y+=16;
    ctx.fillStyle='#11172b';y=wrapCanvasText(ctx,body,24,y,inner,14);
    ctx.fillStyle='#5a6070';ctx.font='9px "Courier New",monospace';
    notes.filter(Boolean).forEach(n=>{y=wrapCanvasText(ctx,n,24,y,inner,13)});
    y+=8;ctx.strokeStyle='#c3c6cb';ctx.setLineDash([1,2]);ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(width-24,y);ctx.stroke();ctx.setLineDash([]);
  };
  lines.forEach((l,i)=>drawRow((i+1)+'. '+l.category,'BUY '+String(l.side||'').toUpperCase(),l.question,[l.basisRisk,l.quote&&l.quote.ask!=null?'Ask: $'+Number(l.quote.ask).toFixed(3)+(l.quote.eligible?'':' · thin book'):'No live quote']));
  gaps.forEach((g,i)=>drawRow((lines.length+i+1)+'. '+g.category,'NO LIVE MARKET',g.title||g.category,[g.reason||'',g.hedge]));
  elsewhere.forEach((e,i)=>drawRow((lines.length+gaps.length+i+1)+'. '+e.category,'ELSEWHERE',e.title,[e.venue+' · '+e.product,e.hedge]));
  y+=14;ctx.fillStyle='#11172b';ctx.font='10px "Courier New",monospace';
  ['Not a broker or insurance.','Live rows are Polymarket contracts ($1 or $0).','Watchpoints have no live contract here.','Elsewhere rows are other venues — not traded here.','You can lose your stake.','Payouts may not offset business losses.'].forEach(t=>{ctx.fillText(t,24,y);y+=14});
  ctx.restore();
  return canvas.toDataURL('image/png');
}
async function ticketPNG(){
  const src=document.querySelector('#hm2 .receipt');
  if(!src)return receiptFallbackPNG();
  try{await document.fonts.ready;return await snapshotReceipt(src)}
  catch{return receiptFallbackPNG()}
}
function downloadData(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click()}
function pngFileName(){return 'hedge-ticket-'+(company.name||'ticket').replace(/[^a-z0-9]+/gi,'-').slice(0,55)+'.png'}
function dataUrlToFile(url,name){
  const [head,b64]=url.split(',');
  const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/png';
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new File([bytes],name,{type:mime});
}
const tweetText='Hedge your business risks via #hedgemarkets on hedgemarkets.io';
async function savePNG(){
  const btn=main.querySelector('#hm-png'),note=main.querySelector('#hm-share-status');
  if(btn){btn.disabled=true;btn.textContent='Saving PNG…'}
  try{
    const url=await ticketPNG();
    downloadData(url,pngFileName());
    if(note)note.textContent='Saved the ticket as it appears on screen.';
  }catch(e){
    if(note)note.textContent=e.message||'Could not save the ticket image.';
    throw e;
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Save as PNG ↓'}
  }
}
async function shareOnX(){
  const btn=main.querySelector('#hm-share-x'),note=main.querySelector('#hm-share-status');
  if(btn){btn.disabled=true;btn.textContent='Preparing share…'}
  try{
    const url=await ticketPNG();
    const file=dataUrlToFile(url,pngFileName());
    const payload={title:'hedge markets',text:tweetText,url:'https://hedgemarkets.io',files:[file]};
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share(payload);
      if(note)note.textContent='Shared. Choose X in the sheet so the receipt goes with the post.';
      return;
    }
    if(navigator.clipboard&&globalThis.ClipboardItem){
      try{
        await navigator.clipboard.write([new ClipboardItem({'image/png':file})]);
        window.open('https://x.com/intent/tweet?'+new URLSearchParams({text:tweetText,url:'https://hedgemarkets.io'}),'_blank','noopener,noreferrer');
        if(note)note.textContent='Receipt copied. Paste it into the X draft (⌘V or Ctrl+V), then post.';
        return;
      }catch{}
    }
    downloadData(url,file.name);
    window.open('https://x.com/intent/tweet?'+new URLSearchParams({text:tweetText,url:'https://hedgemarkets.io'}),'_blank','noopener,noreferrer');
    if(note)note.textContent='PNG downloaded. Attach it to the X draft, then post.';
  }catch(e){
    if(e&&e.name==='AbortError'){if(note)note.textContent='Share cancelled.';return}
    if(note)note.textContent=e.message||'Could not share the ticket.';
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Share on X ↗'}
  }
}
function saveTicket(){
  if(currentId)return true;
  currentId=crypto.randomUUID();
  tickets.unshift({id:currentId,company,lines,gaps,elsewhere,country,createdAt:new Date().toISOString()});
  try{localStorage.setItem('hedge-tickets-v1',JSON.stringify(tickets));nav();return true}
  catch{tickets.shift();currentId=null;return false}
}
function bindReceipt(){
  const paper=main.querySelector('.receipt');
  if(!paper)return;
  const apply=()=>{paper.style.setProperty('--rx',receiptPos.x+'px');paper.style.setProperty('--ry',receiptPos.y+'px')};
  let dragging=false,pid=null,sx=0,sy=0,ox=0,oy=0;
  paper.onpointerdown=e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    dragging=true;pid=e.pointerId;sx=e.clientX;sy=e.clientY;ox=receiptPos.x;oy=receiptPos.y;
    paper.classList.add('dragging');paper.classList.remove('snap');
    try{paper.setPointerCapture(e.pointerId)}catch{}
    try{paper.focus({preventScroll:true})}catch{}
    e.preventDefault();
  };
  paper.onpointermove=e=>{
    if(!dragging||e.pointerId!==pid)return;
    receiptPos.x=ox+(e.clientX-sx);
    receiptPos.y=oy+(e.clientY-sy);
    apply();
  };
  const end=e=>{
    if(!dragging||(e&&e.pointerId!==pid))return;
    dragging=false;paper.classList.remove('dragging');
    try{if(pid!=null)paper.releasePointerCapture(pid)}catch{}
    pid=null;
  };
  paper.onpointerup=end;paper.onpointercancel=end;
  paper.onkeydown=e=>{
    const step=24;
    if(e.key==='ArrowLeft'){receiptPos.x-=step;apply();e.preventDefault()}
    else if(e.key==='ArrowRight'){receiptPos.x+=step;apply();e.preventDefault()}
    else if(e.key==='ArrowUp'){receiptPos.y-=step;apply();e.preventDefault()}
    else if(e.key==='ArrowDown'){receiptPos.y+=step;apply();e.preventDefault()}
  };
}
function exportControls(){return '<div class="claim-actions" style="margin-top:18px"><button class="secondary" id="hm-png">Save as PNG ↓</button><button class="secondary" id="hm-share-x">Share on X ↗</button><p class="fine" id="hm-share-status" aria-live="polite">Share on X attaches the receipt when your device allows it.</p></div>'}
function tokenFor(line,side){const i=(line.outcomes||[]).indexOf(side);return i>=0?String((line.tokens||[])[i]||''):''}
function canTrade(line){const side=line.side||(line.outcomes||[])[0];return Array.isArray(line.outcomes)&&line.outcomes.length>=1&&Array.isArray(line.tokens)&&line.tokens.length>=1&&tokenFor(line,side)}
function quoteBits(l){const q=l.quote||{};if(q.ask==null)return 'No live quote (thin book or no order book).';return `Best ask $${Number(q.ask).toFixed(3)} · ${esc(new Date(q.checkedAt||Date.now()).toLocaleString())}<br>$${Number(q.askDepthWithin5c||0).toFixed(2)} of asks within 5¢ · Spread ${q.spread==null?'—':'$'+Number(q.spread).toFixed(3)}${q.eligible?'':' · shown even though the book is thin or wide'}`}
function resetDesk(){desk=lines.map(l=>({id:l.id,side:l.side,amount:'20',quote:null,error:'',busy:false,message:'',req:0}))}
function ensureDesk(){if(!(desk.length===lines.length&&desk.every((t,i)=>t.id===lines[i].id)))resetDesk()}
function walletLabel(){return wallet?wallet.slice(0,6)+'…'+wallet.slice(-4):'No wallet connected'}
function buyLabel(i){const t=desk[i];return (wallet?'Confirm in wallet':'Connect wallet to buy')+' '+String(t?.side||'').toUpperCase()}
function quoteHTML(i){
  const t=desk[i];
  if(!t)return '';
  if(t.busy)return '<p class="quote-status">Getting a live quote…</p>';
  if(t.error)return `<p class="quote-status bad">${esc(t.error)}</p>`;
  const q=t.quote;
  if(!q)return '<p class="quote-status">Enter an amount to quote this market.</p>';
  if(!q.fillable)return `<p class="quote-status bad">${esc(q.reason||'Not enough liquidity to fill this amount.')}</p>`;
  const partial=q.unfilled>=0.05;
  return `<div class="quote-box${partial?' partial':''}"><div class="quote-main"><b>$${money(q.cost)}</b> buys <b>${money(q.shares)}</b> ${esc(t.side.toUpperCase())} @ avg $${px(q.avgPrice)}</div><p>Pays $${money(q.payout)} if ${esc(t.side)} · profit $${money(q.profitIfWin)} if that outcome wins<br>Best ask $${q.ask==null?'—':px(q.ask)} · spread $${q.spread==null?'—':px(q.spread)} · ${esc(new Date(q.checkedAt).toLocaleString())}${partial?'<br>'+esc(q.reason||'Only part of this amount can be filled at current asks.'):''}</p><p class="fine">${esc(q.note||'Snapshot quote. Fees are not included.')}</p></div>`;
}
function tradeCard(l,i){
  const t=desk[i]||{side:l.side,amount:'20'};
  return `<article class="trade-card" data-trade="${i}"><div class="trade-card-top"><span class="pill">${esc(l.category)} · suggested BUY ${esc(l.side.toUpperCase())}</span><a target="_blank" rel="noopener noreferrer" href="${esc(l.url)}">Market rules ↗</a></div><h3>${esc(l.question)}</h3><p class="muted">${esc(l.rationale)}</p><div class="warning"><b>Where the hedge can miss</b>${esc(l.basisRisk)}</div>${canTrade(l)?`<div class="trade-controls"><div><span class="trade-label">Outcome to buy</span><div class="trade-outcomes" role="group" aria-label="Outcome">${(l.outcomes||['Yes','No']).map(o=>`<button type="button" data-side="${i}" data-outcome="${esc(o)}" aria-pressed="${t.side===o}">${esc(o)}</button>`).join('')}</div></div><label class="trade-amount">Amount (USD)<input data-amount="${i}" inputmode="decimal" min="1" max="25000" step="1" value="${esc(t.amount)}"></label></div><div class="quote-region" data-quote="${i}" aria-live="polite">${quoteHTML(i)}</div><div class="trade-actions"><button class="secondary" data-refresh="${i}">Refresh quote</button><button class="primary" data-buy="${i}" ${t.quote?.fillable&&!t.busy?'':'disabled'}>${esc(buyLabel(i))}</button></div><p class="fine" data-trade-msg="${i}">${esc(t.message||'')}</p>`:'<div class="amber">This saved ticket is missing outcome tokens. Print a new ticket to quote this market.</div>'}</article>`;
}
function tradeDesk(){
  if(!lines.length)return '';
  const builderNote=status.builderConfigured?'Quotes are live. A builder code is saved, so later signed orders can be attributed to Hedge Markets.':'Quotes are live. Add your Polymarket builder code to attribute later signed orders to Hedge Markets.';
  return `<div class="trade-desk"><div class="eyebrow">TRADE FROM THIS TICKET</div><div class="trade-head"><div><h2>Buy a position on each market.</h2><p class="muted">Live Polymarket quotes. Choosing a country hero does not decide whether you can trade.</p></div><div class="wallet-bar"><span id="hm-wallet-label">${esc(walletLabel())}</span><button class="secondary" id="hm-connect">${wallet?'Wallet connected':'Connect wallet'}</button></div></div><div class="info">${esc(builderNote)} Confirming asks your wallet to sign; orders are not submitted yet.</div><div class="trade-grid">${lines.map((l,i)=>tradeCard(l,i)).join('')}</div><div class="amber">Not insurance. Contracts settle at $1 or $0. You can lose your stake. A payout may not offset your business losses. Check current price, fees and resolution rules before confirming.</div></div>`;
}
function paintQuote(i){
  const el=main.querySelector(`[data-quote="${i}"]`);
  if(el)el.innerHTML=quoteHTML(i);
  const buy=main.querySelector(`[data-buy="${i}"]`);
  if(buy){buy.disabled=!(desk[i]?.quote?.fillable)||desk[i].busy;buy.textContent=buyLabel(i)}
}
function scheduleQuote(i){clearTimeout(quoteTimers[i]);quoteTimers[i]=setTimeout(()=>quoteMarket(i),350)}
async function quoteMarket(i){
  const line=lines[i],t=desk[i];
  if(!line||!t)return null;
  const token=tokenFor(line,t.side);
  if(!token){t.busy=false;t.quote=null;t.error='This market is missing a tradeable outcome token.';paintQuote(i);return null}
  const amount=Number(t.amount);
  if(!Number.isFinite(amount)){t.busy=false;t.quote=null;t.error='Enter a dollar amount.';paintQuote(i);return null}
  const req=++t.req;
  t.busy=true;t.error='';paintQuote(i);
  try{
    const q=await api('/api/quote?'+new URLSearchParams({token,amount:String(amount)}));
    if(t.req!==req)return null;
    t.quote=q;t.busy=false;t.error=q.fillable?'':(q.reason||'Cannot fill this amount.');
    paintQuote(i);return q;
  }catch(e){
    if(t.req!==req)return null;
    t.busy=false;t.quote=null;t.error=e.message||'Quote failed.';paintQuote(i);return null;
  }
}
async function connectWallet(){
  const label=main.querySelector('#hm-wallet-label');
  try{
    if(!window.ethereum)throw Error('No browser wallet found. Install MetaMask or Rabby, then retry.');
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
    wallet=accounts[0]||'';
    const btn=main.querySelector('#hm-connect');
    if(label)label.textContent=walletLabel();
    if(btn)btn.textContent=wallet?'Wallet connected':'Connect wallet';
    desk.forEach((_,i)=>paintQuote(i));
  }catch(e){
    if(label)label.textContent=e.message||'Wallet connection failed.';
  }
}
async function confirmTrade(i){
  const msg=main.querySelector(`[data-trade-msg="${i}"]`);
  if(!wallet){await connectWallet();if(!wallet)return}
  const q=await quoteMarket(i);
  const t=desk[i],line=lines[i];
  if(!q?.fillable){t.message=t.error||'Get a fillable quote first.';if(msg)msg.textContent=t.message;return}
  t.message='Quote ready: buy '+money(q.shares)+' '+t.side+' on “'+line.question+'” for $'+money(q.cost)+' at avg $'+px(q.avgPrice)+'. Wallet '+walletLabel()+' would sign this next. Order submission is not enabled yet.';
  if(msg)msg.textContent=t.message;
}
function bindTradeDesk(){
  const connect=main.querySelector('#hm-connect');
  if(connect)connect.onclick=connectWallet;
  main.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.side;if(!desk[i])return;
    desk[i].side=b.dataset.outcome;desk[i].message='';desk[i].quote=null;
    main.querySelectorAll(`[data-side="${i}"]`).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.outcome===desk[i].side)));
    const note=main.querySelector(`[data-trade-msg="${i}"]`);if(note)note.textContent='';
    quoteMarket(i);
  });
  main.querySelectorAll('[data-amount]').forEach(inp=>{
    inp.oninput=()=>{const i=+inp.dataset.amount;if(!desk[i])return;desk[i].amount=inp.value;desk[i].message='';scheduleQuote(i)};
    inp.onchange=()=>quoteMarket(+inp.dataset.amount);
  });
  main.querySelectorAll('[data-refresh]').forEach(b=>b.onclick=()=>quoteMarket(+b.dataset.refresh));
  main.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>confirmTrade(+b.dataset.buy));
  desk.forEach((t,i)=>{if(canTrade(lines[i]))quoteMarket(i)});
}

function render(p){if(p==='ticket'&&page!=='ticket'&&page!=='claim')receiptPos={x:0,y:0};page=p;nav();const c=presets[country];
if(p==='home')main.innerHTML=`<section class="hero idle"><img class="hero-art" src="${c.image}" alt="${esc(c.alt)}"><div class="scene-tools"><button id="hm-motion" aria-pressed="${motion}">${motion?'Ⅱ Pause motion':'▷ Play motion'}</button></div><div class="hero-copy"><span class="hero-badge">LOCAL BUSINESS. GLOBAL WHAT-IFS. · ${esc(c.label.toUpperCase())}</span><h1>Big world changes.<br>Small business impact.</h1><p>Turn your business risks into a simple <b>event-market shortlist.</b></p></div><div class="steam-group" aria-hidden="true"><span></span><span></span><span></span></div><button class="hotspot owner-spot" id="hm-start">Start with your business →</button><form class="intake intake-simple" id="hm2-form"><label>Company, website, or industry<input id="hm2-query" placeholder="${esc(queryHint[country]||c.placeholder)}" required value="${esc(company?.query||company?.name||'')}" autocomplete="organization"></label><button class="primary" ${busy?'disabled':''}>${busy?'Looking up your business…':'Find my risks →'}</button><div class="error" role="alert" ${error?'':'hidden'}>${esc(error)}</div></form><div class="steps"><div class="step"><em>1</em><span><b>Name, site, or industry</b>Any of the three is enough</span></div><div class="step"><em>2</em><span><b>What it does</b>Looked up from that query</span></div><div class="step"><em>3</em><span><b>Ticket & quotes</b>Receipt on top, live markets below</span></div></div></section>`;
if(p==='review')main.innerHTML=`<section class="view"><div class="eyebrow">WHAT THIS BUSINESS DOES</div><h2>${esc(company.name)}</h2>${company.whatItDoes?`<p style="margin:14px 0 8px;font-size:16px">${esc(company.whatItDoes)}</p>`:''}${company.url?`<p><a href="${esc(company.url)}" target="_blank" rel="noopener noreferrer">${esc(company.url)}</a></p>`:''}<div class="risk-grid" style="margin-top:22px">${(company.risks||[]).map((r,i)=>`<article class="risk"><h3>${esc(r.category)}</h3><p>${esc(r.reason)}</p><label style="display:flex;gap:10px;align-items:center"><input style="width:auto" type="checkbox" data-risk="${i}" ${r.selected?'checked':''}>Applies to my business</label></article>`).join('')}</div>${company.risks&&company.risks.length?'':'<div class="amber">Nothing usable was found. Try a fuller company name.</div>'}<div class="error" role="alert" style="margin-top:15px">${esc(error)}</div><div class="actions"><button class="secondary" data-go="home">← Edit name</button><button class="primary" id="hm-match" ${busy||!(company.risks||[]).some(r=>r.selected)?'disabled':''}>${busy?'Finding and checking live markets…':'Find matching events →'}</button></div></section>`;
if(p==='matches')main.innerHTML=`<section class="view"><div class="eyebrow">HEDGE POINTS</div><h2>Live markets and gaps.</h2><p class="muted">${lines.length} live Polymarket row${lines.length===1?'':'s'} · ${gaps.length} watchpoint${gaps.length===1?'':'s'} · ${elsewhere.length} elsewhere for ${esc(company.name)}.</p>${lines.map(l=>`<article class="risk" style="margin-top:17px"><span class="pill">${esc(l.category)} · LIVE · BUY ${esc(l.side.toUpperCase())}</span><h3 style="margin-top:12px">${esc(l.question)}</h3><p style="min-height:0">${esc(l.rationale)}</p><div class="warning"><b>Where the hedge can miss</b>${esc(l.basisRisk)}</div><p style="min-height:0;margin:12px 0">${quoteBits(l)}</p><a target="_blank" rel="noopener noreferrer" href="${esc(l.url)}">Read market and resolution rules ↗</a><details><summary>Resolution description</summary><p>${esc(l.rules)}</p></details></article>`).join('')}${gaps.map(g=>`<article class="risk" style="margin-top:17px"><span class="pill">${esc(g.category)} · NO LIVE MARKET</span><h3 style="margin-top:12px">${esc(g.title||g.category)}</h3><p style="min-height:0">${esc(g.reason||'')}</p><div class="warning"><b>Hedge this anyway</b>${esc(g.hedge)}</div></article>`).join('')}${elsewhere.map(e=>`<article class="risk" style="margin-top:17px"><span class="pill">${esc(e.category)} · ELSEWHERE</span><h3 style="margin-top:12px">${esc(e.title)}</h3><p style="min-height:0"><b>${esc(e.venue)}</b> · ${esc(e.product)}</p><div class="warning"><b>Hedge on another platform</b>${esc(e.hedge)}</div>${e.url?`<a target="_blank" rel="noopener noreferrer" href="${esc(e.url)}">Open ${esc(e.venue)} ↗</a>`:''}</article>`).join('')}<div class="amber">${esc(error||'Live rows are Polymarket contracts that settle at $1 or $0. Watchpoints have no live contract here. Elsewhere rows are other exchanges or brokers — not traded through Hedge Markets.')}</div><p class="fine">Live rows are shown even if the book is thin or the spread is wide. Quotes are snapshots, not execution guarantees. Elsewhere listings are referrals, not an order ticket.</p><div class="actions"><button class="secondary" data-go="review">← Review exposures</button><button class="primary" data-go="ticket" ${!(lines.length||gaps.length||elsewhere.length)?'disabled':''}>Print ticket →</button></div></section>`;
if(p==='ticket'||p==='claim'){saveTicket();ensureDesk();main.innerHTML=`<section class="view"><div class="ticket-layout"><div class="ticket-copy"><h2>${p==='ticket'?'Your risks,<br>on one ticket.':'Take your list<br>with you.'}</h2><p>${esc(company.name)} · ${lines.length} live · ${gaps.length} watch · ${elsewhere.length} elsewhere</p>${currentId?'<div class="success" style="margin-top:20px">✓ Ticket saved on this browser.</div>':''}<div class="claim-actions" style="margin-top:20px">${currentId?'<button class="primary" id="hm-download">Download ticket ↓</button>':''}<button class="secondary" data-go="matches">Review events</button></div>${exportControls()}</div>${receipt(false)}</div>${tradeDesk()}</section>`}
if(p==='saved')main.innerHTML=`<section class="view"><h2>My tickets</h2><p class="muted">Saved on this browser. Quotes on a ticket are historical snapshots until you open it and refresh.</p>${tickets.length?tickets.map(t=>`<div class="saved"><div><h3>${esc(t.company.name)}</h3><p class="muted">${t.lines.length} live · ${(t.gaps||[]).length} watch · ${(t.elsewhere||[]).length} elsewhere · ${esc(new Date(t.createdAt).toLocaleString())}</p></div><button class="secondary" data-open="${esc(t.id)}">Open ticket →</button></div>`).join(''):'<div class="empty">Your saved tickets will appear here.<br><button class="primary" data-go="home" style="margin-top:20px">Start with a name</button></div>'}</section>`;
if(p==='how')main.innerHTML=`<section class="view"><h2>From a name to a live quote.</h2><div class="risk-grid" style="margin-top:25px"><article class="risk"><h3>1. Name, website, or industry</h3><p>A company name, a site, or an industry like “coffee shops” is enough. If a website loads, we read it. If it is blocked, we still look the query up.</p></article><article class="risk"><h3>2. What it does</h3><p>Hedge Markets understands your business exposure through company, industry, and sector analysis.</p></article><article class="risk"><h3>3. Quote and buy</h3><p>The ticket lists live Polymarket markets, watchpoints, and other venues (for example ICE coffee futures) where a closer hedge may live. Those other venues are not traded through Hedge Markets.</p></article></div><div class="amber">Not insurance. Not a broker. Name lookup can still be wrong. Quotes are snapshots and fees are not included. You can lose money, and payouts may not match your business losses.</div></section>`;
main.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.disabled)return;render(b.dataset.go)});
if(p==='home'){const h=main.querySelector('.hero');main.querySelector('#hm-start').onclick=()=>main.querySelector('#hm2-query').focus();main.querySelector('#hm-motion').onclick=()=>{motion=!motion;render('home')};h.onpointermove=e=>{if(!motion||e.pointerType==='touch')return;const r=h.getBoundingClientRect();h.classList.remove('idle');h.style.setProperty('--px',((e.clientX-r.left)/r.width-.5)*-15+'px');h.style.setProperty('--py',((e.clientY-r.top)/r.height-.5)*-8+'px')};h.onpointerleave=()=>h.classList.add('idle');main.querySelector('#hm2-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const query=main.querySelector('#hm2-query').value.trim();if(!query)return;busy=true;error='';company={query,name:query};render('home');try{company=await api('/api/analyze',{query,country},35000);currentId=null;lines=[];gaps=[];elsewhere=[];desk=[];busy=false;render('review')}catch(e){error=e.name==='TimeoutError'?'Lookup took too long. Please retry.':(e.message||'Lookup failed.');busy=false;render('home')}}}
if(p==='review'){main.querySelectorAll('[data-risk]').forEach(i=>i.onchange=()=>{company.risks[+i.dataset.risk].selected=i.checked;main.querySelector('#hm-match').disabled=!company.risks.some(r=>r.selected)});main.querySelector('#hm-match').onclick=async()=>{if(busy)return;busy=true;error='';render('review');try{const result=await api('/api/match',{company:{name:company.name,url:company.url,country,source:company.source,sourceLabel:company.sourceLabel,productFamily:company.productFamily,whatItDoes:company.whatItDoes},risks:company.risks.filter(r=>r.selected)},55000);lines=result.lines||[];gaps=result.gaps||[];elsewhere=result.elsewhere||[];resetDesk();error=result.reason;busy=false;render('ticket')}catch(e){busy=false;error=e.name==='TimeoutError'?'Matching live markets took too long. Please retry.':(e.message||'Matching failed.');render('review')}}}
if(p==='ticket'||p==='claim'){bindTradeDesk();bindReceipt()}
const png=main.querySelector('#hm-png');if(png)png.onclick=()=>savePNG().catch(()=>{});const share=main.querySelector('#hm-share-x');if(share)share.onclick=()=>shareOnX();
const dl=main.querySelector('#hm-download');if(dl)dl.onclick=()=>{const content=main.querySelector('.receipt').innerText+'\n\n'+lines.map(l=>l.url).join('\n');const u=URL.createObjectURL(new Blob([content],{type:'text/plain'}));const a=document.createElement('a');a.href=u;a.download='hedge-ticket.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
main.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const t=tickets.find(t=>t.id===b.dataset.open);company=t.company;lines=t.lines;gaps=t.gaps||[];elsewhere=t.elsewhere||[];country=t.country;currentId=t.id;receiptPos={x:0,y:0};resetDesk();render('claim')});if(globalThis.lucide)lucide.createIcons({attrs:{width:16,height:16}})
}
root.querySelectorAll('nav [data-go]').forEach(b=>b.onclick=()=>{if(busy)return;error='';render(b.dataset.go)});root.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{if(busy)return;country=b.dataset.country;localStorage.setItem('hedge-country',country);error='';render('home')});render('home');
})().catch(()=>{document.getElementById('hm2-main').textContent='Unable to load the application. Please refresh.'});
