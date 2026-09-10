import {requestJSON} from './network.mjs';

export const geo={
  sg:{label:'Singapore',jurisdiction:'sg',wikidata:'Q334',hint:'name, industry, or yourbusiness.sg'},
  us:{label:'United States',jurisdiction:'',wikidata:'Q30',hint:'name, industry, or yourbusiness.com'},
  kr:{label:'South Korea',jurisdiction:'kr',wikidata:'Q884',hint:'name, industry, or yourbusiness.kr'},
  mx:{label:'Mexico',jurisdiction:'mx',wikidata:'Q96',hint:'name, industry, or yourbusiness.mx'},
  vn:{label:'Vietnam',jurisdiction:'vn',wikidata:'Q881',hint:'name, industry, or yourbusiness.vn'},
  gb:{label:'United Kingdom',jurisdiction:'gb',wikidata:'Q145',hint:'name, industry, or yourbusiness.co.uk'}
};
export const marketQuery={Fuel:'crude oil',Freight:'shipping',Rates:'fed rate',Tariffs:'tariff',Demand:'recession'};
export const hedgeAdvice={
  Fuel:{title:'Diesel and energy costs',hedge:'A spike in diesel, LPG or power hits deliveries and cold storage. If no Polymarket contract fits, use fuel surcharges, a longer energy contract, or cash set aside for a price jump.'},
  Freight:{title:'Shipping and supply delays',hedge:'Freight rates and chokepoints can raise landed cost. If no live contract fits, dual-source suppliers, hold extra critical stock, or pass freight through in quotes.'},
  Rates:{title:'Borrowing costs',hedge:'A floating loan gets more expensive when policy rates stay high. If no live contract fits, ask your bank about fixing, refinancing, or a rate cap — only if you actually borrow.'},
  Tariffs:{title:'Import duties',hedge:'New duties can reprice imported ingredients or goods overnight. If no live contract fits, diversify origin, bring in stock before a known duty date, or rewrite supplier terms.'},
  Demand:{title:'Customer spending',hedge:'A slowdown in visits or orders is a demand shock. If no live contract fits, keep a cash buffer, flexible hours, and a cheaper menu or SKU you can switch to.'}
};
const ua={'User-Agent':'HedgeMarkets/0.2 (local SME research; +https://localhost)'};
const genericWord=/^(cafe|café|diner|kitchen|shop|mart|store|restaurant|bar|bakery|grill|express|trading|enterprise|holdings|group|pte|ltd|llc|inc)$/i;
const families=[
  {id:'seafood',label:'seafood import',re:/\b(frozen|seafood|fish|prawn|shrimp|crab|lobster|cold.?chain|freezer|ice)\b/i,chips:['seafood import','catering supply','retail shop'],risks:['Fuel','Freight','Tariffs','Demand']},
  {id:'import',label:'import wholesale',re:/\b(import|importer|export|wholesale|distributor|trading|supply)\b/i,chips:['import wholesale','retail shop','logistics'],risks:['Fuel','Freight','Tariffs','Demand']},
  {id:'logistics',label:'delivery & logistics',re:/\b(logistics|delivery|courier|transport|fleet|trucking|shipping)\b/i,chips:['delivery & logistics','retail shop','import wholesale'],risks:['Fuel','Freight','Demand']},
  {id:'fnb',label:'neighbourhood food shop',re:/\b(hawker|eats|diner|cafe|café|pho|taco|taquer|kitchen|restaurant|catering|noodle|bakery|coffee|bar|grill|bistro|makan)\b/i,chips:['neighbourhood food shop','catering supply','retail shop'],risks:['Fuel','Freight','Demand']},
  {id:'retail',label:'retail shop',re:/\b(retail|mart|minimart|supermarket|boutique|store|shop)\b/i,chips:['retail shop','neighbourhood food shop','delivery & logistics'],risks:['Fuel','Demand','Tariffs']},
  {id:'maker',label:'small manufacturer',re:/\b(manufactur|factory|workshop|fabric|textile|apparel|furniture)\b/i,chips:['small manufacturer','import wholesale','retail shop'],risks:['Fuel','Freight','Tariffs','Demand']}
];
const riskCopy={
  Fuel:{reason:'Fuel or energy costs may affect deliveries, cooking or cold storage.',query:marketQuery.Fuel},
  Freight:{reason:'Shipped or imported supplies may move with freight rates and delays.',query:marketQuery.Freight},
  Rates:{reason:'Variable borrowing costs may be relevant if this business has a loan; confirm the terms.',query:marketQuery.Rates},
  Tariffs:{reason:'Cross-border duties may affect imported ingredients or goods.',query:marketQuery.Tariffs},
  Demand:{reason:'Changes in customer spending may affect sales.',query:marketQuery.Demand}
};

function titleCase(s){return String(s||'').replace(/\s+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase())}
export function parseQuery(raw){
  const query=String(raw||'').trim();
  if(query.length<2)throw Error('Enter a business name, website, or industry.');
  if(query.length>120)throw Error('Keep the name, website, or industry under 120 characters.');
  try{
    const u=new URL(query.includes('://')?query:'https://'+query);
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||/\s/.test(u.hostname)||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal'))throw Error();
    const host=u.hostname.replace(/^www\./,'');
    const stem=host.split('.')[0].replace(/[-_]+/g,' ');
    return {kind:'url',query,url:u.href,host,name:titleCase(stem)};
  }catch{
    return {kind:'name',query,url:'',host:'',name:query.replace(/\s+/g,' ').slice(0,120)};
  }
}
export function sourceLabel(source){
  if(source==='website')return 'Source: website';
  if(source==='industry')return 'Source: industry';
  if(source==='name+records')return 'Source: name + public records';
  return 'Source: name + inferred prior';
}
export function isGenericName(name,candidates=[]){
  if(candidates.length<2)return false;
  const words=String(name||'').trim().split(/\s+/);
  if(words.length<=2)return true;
  if(words.some(w=>genericWord.test(w)))return true;
  return candidates.length>=3;
}
function familyFor(text){return families.find(f=>f.re.test(text))||null}
export function localPrior(name,country='sg',chip=''){
  const place=geo[country]||geo.sg;
  const hay=String(name||'')+' '+String(chip||'');
  const fam=familyFor(chip)||familyFor(name)||{id:'generic',label:'local small business',chips:['neighbourhood food shop','retail shop','delivery & logistics'],risks:['Fuel','Freight','Demand']};
  const confidence=familyFor(chip)||familyFor(name)?'medium':'low';
  const source='name+prior';
  const whatItDoes=chip||('Likely '+fam.label+' in '+place.label+', guessed from the name after public search returned little.');
  const evidence='Inferred: from the business name and '+place.label+' location. Not read from a website. No SKUs invented.';
  const risks=fam.risks.map(category=>({
    category,
    reason:riskCopy[category].reason,
    query:riskCopy[category].query,
    evidence,
    selected:true
  }));
  return {
    name:String(name).slice(0,160),
    legalName:null,
    url:'',
    country,
    sector:fam.label,
    productFamily:fam.label,
    whatItDoes,
    chips:[],
    chip:'',
    confidence,
    source,
    sourceLabel:sourceLabel(source),
    method:'local-prior',
    generic:false,
    note:'Guessed from the name after public search returned little. Not a sector menu.',
    records:[],
    risks,
    checkedAt:new Date().toISOString()
  };
}
function uniq(items){
  const seen=new Set();
  return items.filter(x=>{
    const k=(x.name||'').toLowerCase()+'|'+(x.description||'').slice(0,40).toLowerCase();
    if(seen.has(k)||!x.name)return false;
    seen.add(k);return true;
  });
}
async function searchWikidata(name){
  try{
    const r=await requestJSON('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',search:name,language:'en',uselang:'en',type:'item',limit:'8',format:'json'}),{timeout:8000,headers:ua});
    if(!r.ok)return [];
    return (r.data.search||[]).map(x=>({id:'wd:'+x.id,name:x.label,description:x.description||'Wikidata record',source:'wikidata',url:'https://www.wikidata.org/wiki/'+x.id})).filter(x=>x.name).slice(0,5);
  }catch{return []}
}
async function searchOpenCorporates(name,country){
  try{
    const params={q:name,per_page:'5'};
    const jurisdiction=geo[country]?.jurisdiction;
    if(jurisdiction)params.jurisdiction_code=jurisdiction;
    const r=await requestJSON('https://api.opencorporates.com/v0.4/companies/search?'+new URLSearchParams(params),{timeout:8000,headers:ua});
    if(!r.ok)return [];
    return ((r.data.results&&r.data.results.companies)||[]).map(row=>{
      const c=row.company||{};
      return {id:'oc:'+(c.jurisdiction_code||'')+':'+(c.company_number||''),name:c.name,description:[c.current_status,c.jurisdiction_code,c.registered_address_in_full].filter(Boolean).join(' · ')||'Company register',source:'opencorporates',url:c.opencorporates_url||''};
    }).filter(x=>x.name);
  }catch{return []}
}
async function searchWikipedia(q){
  try{
    const r=await requestJSON('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',list:'search',srsearch:q,srlimit:'5',utf8:'1',format:'json'}),{timeout:8000,headers:ua});
    if(!r.ok)return [];
    return ((r.data.query&&r.data.query.search)||[]).map(x=>({id:'wp:'+x.pageid,name:x.title,description:String(x.snippet||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),source:'wikipedia',url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(x.title).replace(/ /g,'_'))})).filter(x=>x.name);
  }catch{return []}
}
async function searchDuckDuckGo(q){
  try{
    const r=await requestJSON('https://api.duckduckgo.com/?'+new URLSearchParams({q,format:'json',no_html:'1',skip_disambig:'1'}),{timeout:8000,headers:ua});
    if(!r.ok||!r.data)return [];
    const hits=[];
    if(r.data.AbstractText)hits.push({id:'ddg:abstract',name:r.data.Heading||q,description:r.data.AbstractText,source:'search',url:r.data.AbstractURL||''});
    for(const t of (r.data.RelatedTopics||[]).slice(0,4)){
      const text=t.Text||(t.Topics&&t.Topics[0]&&t.Topics[0].Text)||'';
      if(!text)continue;
      hits.push({id:'ddg:'+hits.length,name:String(text).split(' - ')[0].slice(0,80),description:text,source:'search',url:t.FirstURL||''});
    }
    return hits;
  }catch{return []}
}
export async function researchCompany(name,country){
  const place=geo[country]?.label||'';
  const q=[name,place].filter(Boolean).join(' ');
  const [wiki,cos,wp,ddg]=await Promise.all([searchWikidata(name),searchOpenCorporates(name,country),searchWikipedia(q),searchDuckDuckGo(q)]);
  return uniq([...cos,...wiki,...wp,...ddg]).slice(0,8);
}
export async function resolveEntities(name,country){return researchCompany(name,country)}
const stop=new Set(['singapore','malaysia','america','united','states','korea','mexico','vietnam','britain','kingdom','price','trend','rates','south','local','the','and','for','with','that','this','from','their','about','business','company','industry','which','operates','shop','shops','store','stores','cafe','food','free','app','maps','game','games','will','peak','under','times','during','anyone','typical','operators','include','provide','customer','customers','drinks','chain','chains','services','support','winner','season']);
const aliases=[
  {re:/\b(coffee|cafe|café|espresso|coffeeshop)\b/i,terms:['coffee','espresso']},
  {re:/\bdata\s*cent|\bdatacent|\bgpu\b|\bnvidia\b|\ba100\b|\bh100\b/i,terms:['GPU','data center','nvidia','A100']},
  {re:/\b(seafood|prawn|shrimp|lobster|frozen fish)\b/i,terms:['seafood','shrimp']}
];
const noiseMarket=/big brother|#1 free app|apple app store|\bapp store\b|\bfree app\b|\blol:|\blcs playoffs|\bnfl\b|\bnba\b|\bmlb\b|\bnhl\b|premier league|\besports\b|\bgrammy\b|\boscars?\b|\bemmy\b|super bowl|world cup|will anyone say\b|\bsay\s+["“]|during earnings call|shopify rebellion/i;
const boostTerm=new Set(['gpu','a100','h100','nvidia','coffee','espresso','seafood','shrimp']);
function blobOf(company){return [company?.name,company?.whatItDoes,company?.productFamily].join(' ')}
function aliasTerms(company){
  const blob=blobOf(company);
  const terms=[];
  for(const a of aliases)if(a.re.test(blob))for(const t of a.terms)if(!terms.includes(t))terms.push(t);
  return terms;
}
function distinctiveTerms(company,risks){
  const terms=[];
  const push=s=>{
    const t=String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
    if(t.length<3||stop.has(t)||terms.includes(t))return;
    terms.push(t);
  };
  for(const w of String(company?.name||'').toLowerCase().split(/\W+/))if(w.length>=5)push(w);
  for(const w of String(company?.productFamily||'').toLowerCase().split(/\W+/))if(w.length>=5)push(w);
  for(const t of aliasTerms(company))push(t);
  for(const r of risks||[])push(r.query);
  for(const r of risks||[])if(marketQuery[r.category])push(marketQuery[r.category]);
  return terms;
}
export function scoreMarket(question,risk,company){
  const q=String(question||'').toLowerCase();
  if(noiseMarket.test(q))return 0;
  const terms=distinctiveTerms(company,risk?[{query:risk.query,category:risk.category}]:[]);
  let score=0;
  for(const t of terms){
    const parts=t.split(/\s+/).filter(w=>w.length>3&&!stop.has(w));
    if(!parts.length)continue;
    if(parts.every(w=>q.includes(w))){
      score+=parts.length;
      if(parts.some(w=>boostTerm.has(w)))score+=3;
    }
  }
  return score;
}
export function marketSearches(company,risks){
  const qs=[];
  const push=s=>{
    const t=String(s||'').replace(/\s+/g,' ').trim().slice(0,80);
    if(t.length<3||stop.has(t.toLowerCase())||qs.includes(t))return;
    qs.push(t);
    const us=t.replace(/\bcentres?\b/gi,m=>m.toLowerCase().endsWith('s')?'centers':'center');
    if(us!==t&&!qs.includes(us))qs.push(us);
  };
  push(company?.name);
  push(company?.productFamily);
  for(const t of aliasTerms(company))push(t);
  for(const r of risks||[])push(r.query);
  for(const r of risks||[])if(marketQuery[r.category])push(marketQuery[r.category]);
  return qs.slice(0,8);
}
export function suggestedSide(question,category){
  const q=String(question||'').toLowerCase();
  if(category==='Rates')return /\bcut|cuts|easing|lower|decrease\b/.test(q)?'No':'Yes';
  if(category==='Demand')return /\bgrowth|expands|expansion|boom|hot economy\b/.test(q)?'No':'Yes';
  if(category==='Fuel'||category==='Freight'||category==='Tariffs')return /\bdecline|drop|fall|below|lower\b/.test(q)?'No':'Yes';
  return 'Yes';
}
export function elsewhereHedges(company,risks=[]){
  const blob=blobOf(company);
  const want=new Set((risks||[]).map(r=>r.category));
  const has=c=>!want.size||want.has(c);
  const rows=[];
  const add=row=>{if(row&&!rows.some(x=>x.id===row.id))rows.push({...row,live:false})};
  if(/\b(coffee|cafe|café|espresso|coffeeshop)\b/i.test(blob))add({
    id:'ice-coffee',category:'Demand',title:'Coffee bean prices',venue:'ICE Futures',product:'Arabica Coffee C and Robusta coffee futures',url:'https://www.ice.com/products/15/Coffee-C-Futures',
    hedge:'Polymarket has no coffee-price contract. Bean cost is listed on ICE. A licensed futures broker can quote Coffee C (Arabica) or Robusta. Full-size lots are large for a single cafe — a fixed-price deal with your roaster or importer is often the practical hedge.'
  });
  if(/\bdata\s*cent|\bdatacent|\bgpu\b|\bnvidia\b|\ba100\b|\bh100\b/i.test(blob))add({
    id:'power-gpu',category:'Fuel',title:'Power and GPU hardware',venue:'Power market / NASDAQ',product:'Electricity PPAs or regional power futures; listed NVIDIA options',url:'https://www.nasdaq.com/market-activity/stocks/nvda',
    hedge:'Rack power is usually hedged with a utility or a power purchase agreement, not a prediction market. If GPU purchase prices are the risk, NVIDIA trades on NASDAQ. Options and futures need a brokerage account. Not executed here.'
  });
  if(/\b(seafood|prawn|shrimp|lobster|frozen fish)\b/i.test(blob)&&(has('Freight')||has('Tariffs')||has('Demand')||has('Fuel')))add({
    id:'seafood-landed',category:'Freight',title:'Imported seafood landed cost',venue:'Freightos / physical forwards',product:'Container freight (FBX) and supplier forwards',url:'https://fbx.freightos.com/',
    hedge:'There is no liquid shrimp future sized for a small importer. Track container rates on Freightos and lock landed cost with suppliers. A recession bet is not a fish-price hedge.'
  });
  if(has('Fuel')&&!rows.some(r=>r.id==='power-gpu'))add({
    id:'energy-futures',category:'Fuel',title:'Diesel and crude',venue:'CME / ICE',product:'WTI, Brent, heating oil, or gasoil futures',url:'https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html',
    hedge:'A Polymarket oil level pays $1 or $0. To follow the fuel bill more closely, NYMEX WTI, heating oil/ULSD, or ICE Brent/gasoil are the listed products — through a futures broker, not through Hedge Markets.'
  });
  if(has('Freight')&&!rows.some(r=>r.id==='seafood-landed'))add({
    id:'container-freight',category:'Freight',title:'Container and shipping rates',venue:'Freightos / Baltic',product:'FBX container index and dry-bulk freight',url:'https://fbx.freightos.com/',
    hedge:'Container and dry-bulk products sit with Freightos, the Baltic Exchange, and specialist brokers. A Polymarket shipping event may not match your lane or box rate.'
  });
  if(has('Rates'))add({
    id:'rate-futures',category:'Rates',title:'Borrowing costs',venue:'CME / your bank',product:'Fed funds or SOFR futures, or a loan cap',url:'https://www.cmegroup.com/markets/interest-rates/stirs/30-day-federal-fund.html',
    hedge:'If you actually have a floating loan, ask the bank for a fix or a cap. CME Fed funds and SOFR futures are listed rate hedges. They need a brokerage account and may not match a local-currency loan.'
  });
  return rows.slice(0,5);
}
