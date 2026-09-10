import {requestJSON} from './network.mjs';
import {config,modelJSON} from './ai.mjs';
import {parseQuery,localPrior,sourceLabel,scoreMarket,suggestedSide,marketQuery,hedgeAdvice,marketSearches,elsewhereHedges} from './entity.mjs';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {gunzipSync,inflateSync,inflateRawSync,brotliDecompressSync} from 'node:zlib';
const root=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8080);
export function allowedHost(host){
  const h=String(host||'').split(':')[0].toLowerCase();
  return h==='localhost'||h==='127.0.0.1'||h==='hedgemarkets.io'||h==='www.hedgemarkets.io'||h.endsWith('.vercel.app');
}
export function allowedOrigin(origin){
  if(!origin)return true;
  try{return allowedHost(new URL(origin).hostname)}catch{return false}
}
export function publicIP(ip){if(net.isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));}
export function websiteURL(raw){const u=new URL(raw.includes('://')?raw:'https://'+raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal'))throw Error('Enter a public company website.');u.hash='';return u;}
const pageHeaders={
  'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language':'en-US,en;q=0.9',
  'Accept-Encoding':'gzip, deflate, br',
  'Cache-Control':'no-cache',
  'Upgrade-Insecure-Requests':'1'
};
function blockedPage(status){
  if(status===401||status===403)return Error('This website blocked the request (HTTP '+status+'). Try an About or Contact page, or another public page from the business.');
  if(status===404)return Error('That page was not found (HTTP 404). Check the website address.');
  return Error('Website could not be read (HTTP '+status+').');
}
function decodeBody(buf,encoding){
  const enc=String(encoding||'').split(',')[0].trim().toLowerCase();
  try{
    if(enc==='gzip'||enc==='x-gzip')return gunzipSync(buf);
    if(enc==='br')return brotliDecompressSync(buf);
    if(enc==='deflate'){try{return inflateSync(buf)}catch{return inflateRawSync(buf)}}
  }catch{throw Error('The website sent a compressed page that could not be read.')}
  return buf;
}
function isHTML(type,html){
  const t=String(type||'').toLowerCase();
  return t.includes('text/html')||t.includes('application/xhtml')||(!t&&/<html[\s>]/i.test(html.slice(0,4000)));
}
function requestPage(u,addresses){
  return new Promise((done,fail)=>{
    const client=u.protocol==='https:'?https:http;
    const req=client.get(u,{headers:{...pageHeaders,Host:u.hostname},lookup:(_h,o,cb)=>o.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4),timeout:6000,servername:u.hostname},res=>{
      const redirect=[301,302,303,307,308].includes(res.statusCode);
      if(redirect||res.statusCode<200||res.statusCode>=300){res.resume();return done({status:res.statusCode,location:res.headers.location,type:res.headers['content-type'],html:''})}
      let chunks=[],size=0;
      res.on('data',c=>{size+=c.length;if(size>1500000){req.destroy(Error('Website is too large to read.'));return;}chunks.push(c)});
      res.on('error',fail);
      res.on('end',()=>{
        const html=decodeBody(Buffer.concat(chunks),res.headers['content-encoding']).toString('utf8');
        done({status:res.statusCode,location:res.headers.location,type:res.headers['content-type'],html});
      });
    });
    req.on('timeout',()=>req.destroy(Error('Website took too long to respond.')));
    req.on('error',fail);
  });
}
export async function readWebsite(raw,redirects=0){
  if(redirects>3)throw Error('The website redirects too many times.');
  const u=websiteURL(raw);
  const addresses=await dns.lookup(u.hostname,{all:true,family:4});
  if(!addresses.length||addresses.some(x=>!publicIP(x.address)))throw Error('Only public websites can be read.');
  const page=await requestPage(u,addresses);
  if([301,302,303,307,308].includes(page.status)){
    if(!page.location)throw Error('Invalid website redirect.');
    return readWebsite(new URL(page.location,u).href,redirects+1);
  }
  if(page.status<200||page.status>=300)throw blockedPage(page.status);
  if(!isHTML(page.type,page.html))throw Error('Use a public HTML business website.');
  return {url:u.href,html:page.html};
}
export async function tryWebsite(raw){
  try{
    const w=await readWebsite(raw);
    if(plain(w.html).length<80)return null;
    return w;
  }catch{return null}
}
function plain(s){return s.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&reg;/g,'®').replace(/\s+/g,' ').trim()}
const rules=[['Fuel',/\b(fuel|delivery|deliveries|transport|fleet|diesel|petrol|gasoline|logistics)\b/i,'Fuel costs may affect deliveries or transport.'],['Freight',/\b(import|imported|shipping|freight|overseas|supplier|suppliers|export|exports)\b/i,'Shipping or supplier costs may affect purchased goods.'],['Rates',/\b(loan|loans|borrow|borrowing|financing|mortgage|credit facility)\b/i,'Variable borrowing costs may be relevant; confirm your loan terms.'],['Tariffs',/\b(import|imported|export|exports|customs|tariff|tariffs|cross.border)\b/i,'Cross-border duties may affect purchases or sales.'],['Demand',/\b(customer|customers|retail|restaurant|catering|shop|store|booking|bookings|sales)\b/i,'Changes in customer spending may affect sales.']];
export function analyzeHTML(html,url,sector=''){const text=plain(html).slice(0,60000);if(text.length<80)throw Error('Not enough readable text. Try the business’s About page.');const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||new URL(url).hostname).slice(0,160);return {name:title,url,sector,method:'keyword-evidence',checkedAt:new Date().toISOString(),risks:rules.map(([category,re,reason])=>{const m=re.exec(text);return {category,reason,evidence:m?text.slice(Math.max(0,m.index-70),m.index+160):null,selected:Boolean(m)}})}}
async function upstream(url){const r=await requestJSON(url,{timeout:20000});if(!r.ok)throw Error('Market data is unavailable (HTTP '+r.status+'). Please retry.');return r.data}
function array(v){try{return Array.isArray(v)?v:JSON.parse(v||'[]')}catch{return []}}
async function markets(q){if(!q||String(q).trim().length<2)return [];const data=await upstream('https://gamma-api.polymarket.com/public-search?'+new URLSearchParams({q:String(q).slice(0,100),events_status:'active',limit_per_type:'10',search_profiles:'false',search_tags:'false'}));const seen=new Set();return (data.events||[]).flatMap(e=>(e.markets||[]).map(m=>({...m,eventSlug:e.slug}))).filter(m=>{if(seen.has(m.id))return false;seen.add(m.id);return m.active!==false&&!m.closed}).slice(0,24).map(m=>({id:String(m.id),question:m.question,rules:m.description||'',url:'https://polymarket.com/event/'+encodeURIComponent(m.eventSlug||m.slug||m.id),endDate:m.endDate,outcomes:array(m.outcomes),tokens:array(m.clobTokenIds),liquidity:Number(m.liquidityNum||0)})).filter(m=>m.outcomes.length>=1&&m.tokens.length>=1)}
const MIN_QUOTE_SHARES=5;
function round(n,p=4){const m=10**p;return Math.round((Number(n)+Number.EPSILON)*m)/m}
export function quoteBuy(asks,amount){
  const usd=Number(amount);
  if(!Number.isFinite(usd)||usd<1)return {fillable:false,reason:'Enter at least $1.',amount:usd,shares:0,cost:0,avgPrice:null,worstPrice:null,payout:0,profitIfWin:0,unfilled:Number.isFinite(usd)?round(usd,2):0};
  if(usd>25000)return {fillable:false,reason:'Enter at most $25,000 per quote.',amount:usd,shares:0,cost:0,avgPrice:null,worstPrice:null,payout:0,profitIfWin:0,unfilled:usd};
  const levels=(asks||[]).map(x=>({price:Number(x.price),size:Number(x.size)})).filter(x=>x.price>0&&x.price<1&&x.size>0).sort((a,b)=>a.price-b.price);
  if(!levels.length)return {fillable:false,reason:'No asks are available on this outcome.',amount:usd,shares:0,cost:0,avgPrice:null,worstPrice:null,payout:0,profitIfWin:0,unfilled:round(usd,2)};
  let remaining=usd,shares=0,cost=0,worst=null;
  for(const level of levels){
    if(remaining<=1e-9)break;
    const take=Math.min(level.size,remaining/level.price);
    if(take<=0)continue;
    shares+=take;
    const spend=take*level.price;
    cost+=spend;
    remaining-=spend;
    worst=level.price;
  }
  shares=round(shares,4);cost=round(cost,4);remaining=round(Math.max(0,remaining),4);
  const avg=shares>0?round(cost/shares,4):null;
  const fillable=shares>=MIN_QUOTE_SHARES&&cost>=1;
  let reason='';
  if(!fillable)reason=shares<MIN_QUOTE_SHARES?'Increase the amount — at least 5 shares are required.':'Not enough ask depth to fill this amount.';
  else if(remaining>=0.05)reason='Only part of this amount can be filled at current asks.';
  return {fillable,reason,amount:usd,shares,cost,avgPrice:avg,worstPrice:worst,payout:round(shares,2),profitIfWin:round(shares-cost,2),unfilled:round(remaining,2)};
}
function parseBook(d){
  const asks=(d.asks||[]).map(x=>({price:Number(x.price),size:Number(x.size)})).filter(x=>x.price>0&&x.price<1&&x.size>0).sort((a,b)=>a.price-b.price);
  const bids=(d.bids||[]).map(x=>({price:Number(x.price),size:Number(x.size)})).filter(x=>x.price>0&&x.price<1&&x.size>0).sort((a,b)=>b.price-a.price);
  const ask=asks[0]?.price??null,bid=bids[0]?.price??null;
  const depth=ask==null?0:asks.filter(x=>x.price<=ask+.05).reduce((n,x)=>n+x.price*x.size,0);
  return {asks,bids,ask,bid,spread:ask!=null&&bid!=null?round(ask-bid,4):null,askDepthWithin5c:round(depth,2),checkedAt:new Date().toISOString(),eligible:ask!=null&&bid!=null&&ask-bid<=.1&&depth>=100};
}
async function loadBook(token){if(!/^\d{1,100}$/.test(token))throw Error('Invalid outcome token.');return parseBook(await upstream('https://clob.polymarket.com/book?token_id='+token))}
async function book(token){const {asks,bids,...rest}=await loadBook(token);return rest}
async function quote(token,amount){
  const b=await loadBook(token);
  return {...quoteBuy(b.asks,amount),token,ask:b.ask,bid:b.bid,spread:b.spread,askDepthWithin5c:b.askDepthWithin5c,eligible:b.eligible,checkedAt:b.checkedAt,note:'Snapshot quote. Fees are not included. Price can change before a wallet confirms.'};
}
async function body(req){let b='';for await(const c of req){b+=c;if(b.length>30000)throw Error('Request too large.')}return JSON.parse(b||'{}')}
const files=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/presets.json','presets.json']]);
export default async function handle(req,res){const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))};try{if(!allowedHost(req.headers.host))return send(403,{error:'Unknown host.'});const u=new URL(req.url,'http://localhost:'+port);if(req.method==='POST'){const origin=req.headers.origin;if(origin&&!allowedOrigin(origin))return send(403,{error:'Request origin rejected.'})}
if(u.pathname==='/api/status'){const env=await config();return send(200,{marketData:'public',analysis:env.OPENROUTER_API_KEY?'openrouter':'not-configured',modelConfigured:Boolean(env.OPENROUTER_MODEL),automaticMatching:true,builderConfigured:/^0x[0-9a-fA-F]{64}$/.test(env.POLYMARKET_BUILDER_CODE||''),quotesEnabled:true,tradingEnabled:false})}
if(u.pathname==='/api/analyze'&&req.method==='POST'){const b=await body(req);return send(200,await analyzeBusiness(b))}
if(u.pathname==='/api/match'&&req.method==='POST'){const b=await body(req);return send(200,await matchAI(b))}
if(u.pathname==='/api/markets'&&req.method==='GET'){const q=(u.searchParams.get('q')||'').trim();if(q.length<2||q.length>100)throw Error('Enter a search between 2 and 100 characters.');return send(200,{markets:await markets(q),checkedAt:new Date().toISOString()})}
if(u.pathname==='/api/book'&&req.method==='GET')return send(200,await book(u.searchParams.get('token')||''));
if(u.pathname==='/api/quote'&&req.method==='GET')return send(200,await quote(u.searchParams.get('token')||'',u.searchParams.get('amount')||''));
if(req.method!=='GET'||!files.has(u.pathname))return send(404,{error:'Not found.'});const f=files.get(u.pathname);res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(resolve(root,'public',f)));
}catch(e){send(400,{error:e.message||'Unable to complete the request.'})}}
export const server=http.createServer(handle);
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(port,'127.0.0.1',()=>console.log('Hedge Markets: http://localhost:'+port));

async function analyzeAI(html,url,sector,country){const text=plain(html).slice(0,8000);if(text.length<80)throw Error('Not enough readable website text. Try the business’s About page.');const result=await modelJSON('Analyze a real SME website for possible fuel, freight, rates, tariffs and demand exposures. Never assert a loan or import dependence without evidence. Return {name:string,whatItDoes:string,risks:[{category:Fuel|Freight|Rates|Tariffs|Demand,reason:string,evidence:string,query:string}]}. At most five risks, one per category. evidence must be a short exact substring of the supplied text. query is a short Polymarket search for this business. Omit unsupported risks.',{url,sector,country,text},{timeout:25000,max_tokens:1200});const risks=(Array.isArray(result.risks)?result.risks:[]).filter(r=>rules.some(x=>x[0]===r.category)&&typeof r.evidence==='string'&&r.evidence.length>=8&&text.includes(r.evidence)&&typeof r.reason==='string'&&typeof r.query==='string').filter((r,i,a)=>a.findIndex(v=>v.category===r.category)===i).map(r=>({category:r.category,reason:r.reason.slice(0,500),evidence:r.evidence.slice(0,500),query:r.query.slice(0,100),selected:true}));return {name:String(result.name||new URL(url).hostname).slice(0,160),whatItDoes:String(result.whatItDoes||'').slice(0,400),url,sector,country,method:'openrouter',checkedAt:new Date().toISOString(),risks}}
async function websiteProfile(html,url,sector,country,query){
  try{
    const ai=await analyzeAI(html,url,sector,country);
    return {...ai,query,source:'website',sourceLabel:sourceLabel('website'),confidence:'high',generic:false,chips:[],chip:'',records:[],note:'Read from the public website. Confirm each exposure.',productFamily:sector||''};
  }catch{
    const kw=analyzeHTML(html,url,sector);
    const risks=kw.risks.filter(r=>r.selected&&r.evidence).map(r=>({...r,query:marketQuery[r.category],selected:true}));
    if(!risks.length)throw Error('empty');
    return {...kw,query,risks,source:'website',sourceLabel:sourceLabel('website'),confidence:'medium',generic:false,chips:[],chip:'',records:[],note:'Read from the public website. Confirm each exposure.',productFamily:sector||''};
  }
}
async function inferFromName(name,country){
  const result=await modelJSON('Query is a company name or industry. Use live web results to say what it does in this country. If the query is a general sector, set kind=industry, keep the user query as name, and describe typical operators — do not substitute a single firm. No SKUs or loan terms unless mentioned. JSON {kind:company|industry,name,whatItDoes,productFamily,confidence:high|medium|low,risks:[{category:Fuel|Freight|Rates|Tariffs|Demand,reason,query,evidence}]}. whatItDoes: 1-2 sentences. query: short Polymarket search for this activity (GPU, data center, crude oil, shipping, tariff, fed rate). Do not force oil or recession.',{query:name,country},{web:true,webResults:3,timeout:18000,max_tokens:400});
  const prior=localPrior(name,country,name);
  const risks=(Array.isArray(result.risks)?result.risks:[]).filter(r=>rules.some(x=>x[0]===r.category)&&typeof r.reason==='string'&&typeof r.query==='string'&&typeof r.evidence==='string'&&r.evidence.length>=8).filter((r,i,a)=>a.findIndex(v=>v.category===r.category)===i).map(r=>({category:r.category,reason:r.reason.slice(0,500),query:r.query.slice(0,100),evidence:r.evidence.slice(0,500),selected:true}));
  if(risks.length<2)return prior;
  const confidence=['high','medium','low'].includes(result.confidence)?result.confidence:prior.confidence;
  const kind=result.kind==='industry'?'industry':'name+records';
  const whatItDoes=String(result.whatItDoes||prior.whatItDoes||'').slice(0,400);
  return {name:(kind==='industry'?name:String(result.name||name)).slice(0,160),legalName:null,url:'',country,sector:String(result.productFamily||prior.productFamily).slice(0,80),productFamily:String(result.productFamily||prior.productFamily).slice(0,80),whatItDoes,chips:[],chip:'',confidence,generic:false,source:kind,sourceLabel:sourceLabel(kind),method:'openrouter-web',note:'',records:[],risks,checkedAt:new Date().toISOString()};
}
async function analyzeBusiness(input){
  const country=['sg','us','kr','mx','vn','gb'].includes(input.country)?input.country:'sg';
  const parsed=parseQuery(input.query||input.url||input.name||'');
  if(parsed.kind==='url'){
    const website=await tryWebsite(parsed.url);
    if(website){
      try{return await websiteProfile(website.html,website.url,'',country,parsed.query)}catch{}
    }
  }
  const name=String(input.name||parsed.name);
  let inferred;
  try{inferred=await inferFromName(name,country)}catch{inferred=localPrior(name,country,name)}
  if(!inferred.risks||inferred.risks.length<2)inferred=localPrior(name,country,name);
  return {...inferred,query:parsed.query,name:inferred.name||name,url:parsed.kind==='url'?parsed.url:inferred.url||'',country};
}
function capLines(lines,per=2){
  const n={};const out=[];
  for(const row of lines||[]){
    const c=row.category||'Other';
    n[c]=(n[c]||0)+1;
    if(n[c]<=per)out.push(row);
  }
  return out;
}
function matchResult(lines,risks=[],company){
  const covered=new Set(lines.map(l=>l.category));
  const gaps=risks.filter(r=>!covered.has(r.category)).map(r=>{
    const tip=hedgeAdvice[r.category]||{title:r.category,hedge:'Watch this cost even if no live Polymarket contract fits.'};
    return {category:r.category,reason:r.reason,title:tip.title,hedge:tip.hedge,live:false};
  });
  const elsewhere=elsewhereHedges(company,risks);
  return {lines,gaps,elsewhere,checkedAt:new Date().toISOString(),reason:'',liveCount:lines.length,gapCount:gaps.length,elsewhereCount:elsewhere.length,liquidityRule:'Markets are shown even if the book is thin or the spread is wide. Watchpoints have no matching Polymarket contract. Elsewhere rows are listed venues, not trades placed here.'};
}
async function quoteLine(m,category,side,rationale,basisRisk){
  const useSide=(m.outcomes||[]).includes(side)?side:(m.outcomes||[])[0];
  const token=m.tokens[(m.outcomes||[]).indexOf(useSide)]||m.tokens[0];
  const empty={ask:null,bid:null,spread:null,askDepthWithin5c:0,eligible:false,checkedAt:new Date().toISOString()};
  if(!token||!useSide)return {...m,category,side:useSide||side,rationale,basisRisk,quote:empty};
  try{return {...m,category,side:useSide,rationale,basisRisk,quote:await book(token)}}
  catch{return {...m,category,side:useSide,rationale,basisRisk,quote:empty}}
}
function bestRisk(question,risks,company){
  let best={score:0,risk:null};
  for(const r of risks){
    const s=scoreMarket(question,r,company);
    if(s>best.score)best={score:s,risk:r};
  }
  return best;
}
async function matchLocal(input,usedUrls=new Set()){
  const risks=input.risks.filter(r=>typeof r.query==='string'||rules.some(x=>x[0]===r.category));
  const queries=marketSearches(input.company,risks);
  const lists=await Promise.all(queries.map(q=>markets(q).catch(()=>[])));
  const seen=new Set();
  const pool=[];
  for(const m of lists.flat()){if(seen.has(m.id)||usedUrls.has(m.url))continue;seen.add(m.id);pool.push(m)}
  const ranked=pool.map(m=>({m,...bestRisk(m.question,risks,input.company)})).filter(row=>row.score>0&&row.risk).sort((a,b)=>b.score-a.score).slice(0,15);
  const rows=await Promise.all(ranked.map(row=>{
    const cat=row.risk.category;
    const side=suggestedSide(row.m.question,cat);
    return quoteLine(row.m,cat,side,'This live contract matches a cost this business actually faces.','The event may still settle on a different index than this business’s invoices.');
  }));
  const lines=[];
  for(const row of rows){if(!row||usedUrls.has(row.url)||lines.length>=15)continue;usedUrls.add(row.url);lines.push(row)}
  return matchResult(capLines(lines),risks,input.company);
}
async function matchAI(input){
  if(!input.company||!Array.isArray(input.risks)||!input.risks.length||input.risks.length>5)throw Error('Confirm at least one exposure first.');
  const risks=input.risks.filter(r=>rules.some(x=>x[0]===r.category)&&typeof r.query==='string');
  const queries=marketSearches(input.company,risks);
  const lists=await Promise.all(queries.map(q=>markets(q).catch(()=>[])));
  const map=new Map(lists.flat().map(m=>[m.id,m]));
  const candidates=[...map.values()].filter(m=>bestRisk(m.question,risks,input.company).score>0).slice(0,24);
  let lines=[];
  if(candidates.length&&(await config()).OPENROUTER_API_KEY){
    try{
      const result=await modelJSON('Pick only Polymarket markets whose QUESTION is about this business or a real hedge for it (coffee/commodity, GPU/data center, oil, shipping, tariffs, fed funds, recession). If none fit, return {lines:[]}. Never pick sports, TV, reality shows, app-store rankings, or a market that only shares a coincidental word. Thin books are allowed. Only use supplied IDs. Return {lines:[{id:string,category:string,side:string,rationale:string,basisRisk:string}]}. category is Fuel|Freight|Rates|Tariffs|Demand|Other. side must be one of that market’s outcomes. One market per event URL.',{company:{name:input.company.name,whatItDoes:input.company.whatItDoes,source:input.company.source,country:input.company.country},risks:risks.map(r=>({category:r.category,reason:r.reason,query:r.query})),candidates:candidates.map(m=>({id:m.id,question:m.question,outcomes:m.outcomes,endDate:m.endDate,event:m.url}))},{timeout:20000,max_tokens:900});
      const ok=new Set([...rules.map(x=>x[0]),'Other']);
      const picks=(Array.isArray(result.lines)?result.lines:[]).slice(0,12).filter(x=>{
        const m=map.get(String(x.id));
        return m&&ok.has(x.category)&&typeof x.rationale==='string'&&typeof x.basisRisk==='string'&&bestRisk(m.question,risks,input.company).score>0;
      });
      const checked=await Promise.all(picks.map(x=>quoteLine(map.get(String(x.id)),x.category,x.side,String(x.rationale).slice(0,700),String(x.basisRisk).slice(0,700))));
      const used=new Set();
      for(const row of checked){if(!row||used.has(row.url))continue;used.add(row.url);lines.push(row)}
    }catch{}
  }
  const extra=await matchLocal(input,new Set(lines.map(l=>l.url)));
  for(const row of extra.lines){if(lines.length>=15)break;if(!lines.some(l=>l.url===row.url))lines.push(row)}
  return matchResult(capLines(lines),risks,input.company);
}
