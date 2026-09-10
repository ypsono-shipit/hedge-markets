import test from 'node:test';import assert from 'node:assert/strict';import {publicIP,websiteURL,analyzeHTML,quoteBuy,readWebsite,allowedHost,allowedOrigin} from '../server.mjs';
import {parseQuery,localPrior,sourceLabel,scoreMarket,suggestedSide,hedgeAdvice,marketSearches,elsewhereHedges} from '../entity.mjs';
test('blocks local, private and metadata ranges',()=>{for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicIP(ip),false,ip);assert.equal(publicIP('1.1.1.1'),true)});
test('allows local, Vercel and hedgemarkets.io hosts',()=>{
  assert.equal(allowedHost('localhost:8080'),true);
  assert.equal(allowedHost('hedgemarkets.io'),true);
  assert.equal(allowedHost('www.hedgemarkets.io'),true);
  assert.equal(allowedHost('hedge-markets-abc.vercel.app'),true);
  assert.equal(allowedHost('evil.example'),false);
  assert.equal(allowedOrigin('https://hedgemarkets.io'),true);
  assert.equal(allowedOrigin('https://evil.example'),false);
});
test('rejects unsafe website schemes and credentials',()=>{for(const u of ['file:///etc/passwd','http://user:pass@example.com','https://example.com:22','http://service.local'])assert.throws(()=>websiteURL(u));assert.equal(websiteURL('example.com').href,'https://example.com/')});
test('evidence comes from actual page text; scripts excluded',()=>{const a=analyzeHTML('<title>Actual Company</title><script>loan fuel import</script><p>Our company provides services to businesses across the city. We welcome enquiries and work with customers every day.</p>','https://example.com');assert.equal(a.name,'Actual Company');assert.equal(a.risks.find(r=>r.category==='Rates').selected,false);assert.equal(a.risks.find(r=>r.category==='Demand').selected,true)});
test('quoteBuy walks asks and fills the dollar amount',()=>{
  const q=quoteBuy([{price:0.4,size:10},{price:0.5,size:100}],20);
  assert.equal(q.fillable,true);
  assert.equal(q.shares,42);
  assert.equal(q.cost,20);
  assert.equal(q.avgPrice,0.4762);
  assert.equal(q.worstPrice,0.5);
  assert.equal(q.payout,42);
  assert.equal(q.profitIfWin,22);
  assert.equal(q.unfilled,0);
});
test('quoteBuy rejects sub-dollar amounts and missing asks',()=>{
  assert.equal(quoteBuy([{price:0.4,size:10}],0.5).fillable,false);
  assert.match(quoteBuy([],20).reason,/No asks/);
});
test('quoteBuy requires at least 5 shares',()=>{
  const q=quoteBuy([{price:0.5,size:100}],2);
  assert.equal(q.fillable,false);
  assert.match(q.reason,/5 shares/);
});
test('parseQuery treats names, industries and URLs separately',()=>{
  const n=parseQuery('Ah Huat Frozen');
  assert.equal(n.kind,'name');
  assert.equal(n.name,'Ah Huat Frozen');
  const i=parseQuery('coffee shops');
  assert.equal(i.kind,'name');
  assert.equal(i.name,'coffee shops');
  const u=parseQuery('yourbusiness.sg');
  assert.equal(u.kind,'url');
  assert.equal(u.host,'yourbusiness.sg');
  assert.equal(sourceLabel('industry'),'Source: industry');
});
test('localPrior infers frozen food activity without inventing SKUs',()=>{
  const p=localPrior('Ah Huat Frozen','sg');
  assert.equal(p.source,'name+prior');
  assert.match(p.whatItDoes,/frozen|seafood|cold/i);
  assert.equal(p.chips.length,0);
  assert.ok(p.risks.some(r=>r.category==='Freight'));
  assert.ok(p.risks.every(r=>r.evidence.startsWith('Inferred:')));
  assert.equal(p.risks.some(r=>r.category==='Rates'),false);
  assert.equal(sourceLabel('website'),'Source: website');
  assert.equal(sourceLabel('name+records'),'Source: name + public records');
});
test('hedgeAdvice covers every risk category',()=>{for(const c of ['Fuel','Freight','Rates','Tariffs','Demand'])assert.ok(hedgeAdvice[c].hedge.length>20,c)});
test('industry words get a local activity prior',()=>{
  const p=localPrior('coffee shops','sg','coffee shops');
  assert.match(p.whatItDoes,/food|coffee|shop/i);
  assert.ok(p.risks.some(r=>r.category==='Demand'));
});
test('market side heuristics',()=>{
  assert.equal(suggestedSide('Fed cuts rates in 2026?','Rates'),'No');
  assert.equal(suggestedSide('US recession in 2026?','Demand'),'Yes');
  assert.ok(scoreMarket('Brent crude oil above $100',{query:'crude oil',category:'Fuel'})>=1);
  assert.equal(scoreMarket('Will the highest temperature in Singapore be 31°C?',{query:'crude oil',category:'Fuel'}),0);
  const searches=marketSearches({name:'data centre',whatItDoes:'GPU cloud rental'},[{category:'Fuel',query:'electricity'}]);
  assert.ok(searches.some(q=>/data center/i.test(q)));
  assert.ok(searches.some(q=>/GPU/i.test(q)));
});
test('coffee shop does not match app store, TV, or untitled drought',()=>{
  const company={name:'coffee shop',whatItDoes:'Neighbourhood cafes serving espresso in Singapore',productFamily:'coffee shops'};
  const demand={query:'recession',category:'Demand'};
  const fuel={query:'crude oil',category:'Fuel'};
  assert.equal(scoreMarket('Will MapQuest GPS Navigation & Maps be #1 Free App in the US Apple App Store on September 11?',demand,company),0);
  assert.equal(scoreMarket('Will anyone say "Veto" 5+ times during Big Brother E33?',demand,company),0);
  assert.equal(scoreMarket('Will anyone say "Coffee" during Big Brother E33?',demand,company),0);
  assert.equal(scoreMarket('Will Oracle say "Data Center" 5+ times during earnings call?',{query:'GPU',category:'Demand'},{name:'data centre',whatItDoes:'GPU cloud rental'}),0);
  assert.equal(scoreMarket('Will the peak severe (S2+) drought coverage in Minas Gerais be under 5%?',demand,company),0);
  assert.ok(scoreMarket('US recession by end of 2026?',demand,company)>=1);
  assert.ok(scoreMarket('Will WTI Crude Oil (WTI) hit (HIGH) $100 in September?',fuel,company)>=1);
  assert.ok(scoreMarket('Will the Ornn A100 Index be less than $0.50 on September 30, 2026?',{query:'electricity',category:'Fuel'},{name:'data centre',whatItDoes:'GPU cloud rental'})>=1);
  const coffeeQs=marketSearches(company,[demand,fuel]);
  assert.ok(coffeeQs.some(q=>/coffee/i.test(q)));
  assert.equal(coffeeQs.some(q=>/^shop$/i.test(q)),false);
});
test('elsewhere hedges point coffee shops to ICE coffee',()=>{
  const company={name:'coffee shop',whatItDoes:'Neighbourhood cafes serving espresso',productFamily:'coffee shops'};
  const rows=elsewhereHedges(company,[{category:'Demand',query:'recession'},{category:'Fuel',query:'crude oil'}]);
  assert.ok(rows.some(r=>/ice/i.test(r.venue)&&/coffee/i.test(r.product)));
  assert.ok(rows.every(r=>r.live===false));
  assert.ok(rows.every(r=>r.hedge.length>40));
  const dc=elsewhereHedges({name:'data centre',whatItDoes:'GPU cloud rental'},[{category:'Fuel',query:'electricity'}]);
  assert.ok(dc.some(r=>/nasdaq|power/i.test(r.venue)));
});
test('reads a public HTML homepage',async()=>{
  const page=await readWebsite('https://example.com');
  assert.match(page.html,/Example Domain/i);
  assert.equal(new URL(page.url).hostname,'example.com');
});
test('quoteBuy reports unfilled remainder when depth is thin',()=>{
  const q=quoteBuy([{price:0.5,size:20}],100);
  assert.equal(q.fillable,true);
  assert.equal(q.shares,20);
  assert.equal(q.cost,10);
  assert.equal(q.unfilled,90);
  assert.match(q.reason,/part of this amount/i);
});
