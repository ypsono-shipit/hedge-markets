from pathlib import Path
import json,base64
presets={
'sg':dict(label='Singapore',code='SG',people='Singapore’s',business='Ah Huat Eats',placeholder='yourbusiness.sg',currency='SGD',owner='A neighbourhood hawker serving regulars, one fresh plate at a time.',supply='Cooking fuel, imported ingredients and delivery costs can all affect the same plate.',alt='Chibi Singapore hawker with HDB blocks and families'),
'us':dict(label='America',code='US',people='America’s',business='Main Street Diner',placeholder='yourbusiness.com',currency='USD',owner='A local diner owner keeping the grill hot and the neighbourhood fed.',supply='Fuel for deliveries, coffee shipments and a floating-rate business loan are possible exposures.',alt='Chibi American diner owner and neighbourhood main street'),
'kr':dict(label='Korea',code='KR',people='Korea’s',business='Seoul Neighbourhood Kitchen',placeholder='yourbusiness.kr',currency='KRW',owner='A neighbourhood snack-shop owner preparing favourites for the lunch crowd.',supply='Imported ingredients, cooking energy and delivery costs can affect a small kitchen.',alt='Chibi Korean food-shop owner in a Seoul neighbourhood'),
'mx':dict(label='Mexico',code='MX',people='Mexico’s',business='Taquería del Barrio',placeholder='yourbusiness.mx',currency='MXN',owner='A neighbourhood taquería bringing friends and families together over fresh tacos.',supply='Cooking gas, produce deliveries and loan costs are possible business exposures.',alt='Chibi Mexican taqueria owner with colourful neighbourhood shops'),
'vn':dict(label='Vietnam',code='VN',people='Vietnam’s',business='Corner Pho Kitchen',placeholder='yourbusiness.vn',currency='VND',owner='A local noodle-shop owner starting the day with a warm pot of broth.',supply='Cooking fuel, ingredient shipments and delivery costs can change the cost of each bowl.',alt='Chibi Vietnamese pho-shop owner with shophouses and scooters')}
for k,v in presets.items():
 v['image']='data:image/jpeg;base64,'+base64.b64encode(Path('work/hero-'+k+'.jpg').read_bytes()).decode()
s=Path('work/blue-ui.html').read_text()
s=s.replace('__HERO_DATA__','')
s=s.replace('</style>',Path('work/country-motion.css').read_text()+'\n</style>')
bar='<div class="country-bar"><span>Your business is in</span><div class="country-options" role="group" aria-label="Choose your country">'+''.join('<button data-country="'+k+'" aria-pressed="'+str(k=='sg').lower()+'">'+v['label']+'</button>' for k,v in presets.items())+'</div><span class="country-sub">Choose your neighbourhood</span></div>'
s=s.replace('</nav><main','</nav>'+bar+'<main')
code=Path('work/country-interactions.js').read_text().replace('__PRESETS__',json.dumps(presets,ensure_ascii=False))
s=s.replace('function ticket(isTorn=false){',code+'\nfunction ticket(isTorn=false){')
s=s.replace("function render(p){page=p;", "function render(p){page=p;countryBar();")
s=s.replace('<section class="hero">','<section class="hero idle">')
s=s.replace('<div class="hero-copy">','<div class="scene-tools"><button id="hm-motion" type="button" aria-pressed="true">Ⅱ Pause motion</button></div><div class="hero-copy">')
s=s.replace('<form class="intake"', '<div class="scene-hint">Move to explore · tap a business detail</div><div class="steam-group" aria-hidden="true"><span></span><span></span><span></span></div><button class="hotspot owner-spot" data-spot="owner" aria-pressed="false">Meet the owner</button><button class="hotspot supply-spot" data-spot="supply" aria-pressed="false">Follow the supplies</button><div class="scene-card" aria-live="polite" hidden></div><form class="intake"')
s=s.replace("else company='Ah Huat Eats'", "else company=presets[country].business")
s=s.replace('or leave blank to try Ah Huat Eats.', 'or leave blank to try the local sample business.')
s=s.replace('Sample profile · Neighbourhood food stalls and catering','${presets[country].label} · Illustrative neighbourhood food business')
s=s.replace('your SGD loan.', 'your ${presets[country].currency} loan.')
s=s.replace('taken=true;savedCompany=company;', 'taken=true;savedCompany=company;savedCountry=country;')
s=s.replace('company=savedCompany;render', 'company=savedCompany;country=savedCountry;render')
s=s.replace("if(globalThis.lucide)lucide.createIcons", "if(p==='home')setupHero();if(globalThis.lucide)lucide.createIcons")
s=s.replace("root.querySelectorAll('nav [data-go]')", "root.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{country=b.dataset.country;company=presets[country].business;render('home')});root.querySelectorAll('nav [data-go]')")
s=s.replace("const opts={motion:true};", "const opts={motion:motion};")
s=s.replace("onChange:()=>root.querySelector('main').classList.toggle('no-motion',!opts.motion)", "onChange:()=>{motion=opts.motion;countryBar();if(page==='home')setupHero()}")
s=s.replace("${!isTorn?'<button class=\"pull\"", "${!isTorn&&page==='ticket'?'<button class=\"pull\"")
p=Path('/Users/ypsono/.codex/visualizations/2026/09/09/01a08600-62dd-77e2-8ae6-74be2445f53c/hedge-markets-countries.html')
p.write_text(s)
assert p.stat().st_size<1000000,p.stat().st_size
Path('work/countries-check.js').write_text(s.split('<script>')[1].split('</script>')[0])
print('Wrote',p.stat().st_size,'bytes')
s=p.read_text()
a=s.index("if(p==='claim')")
b=s.index("if(p==='saved')",a)
segment=s[a:b].replace("if(p==='claim')main.innerHTML", "if(p==='claim'){const currentTaken=taken&&savedCompany===company&&savedCountry===country;main.innerHTML").replace('${taken', '${currentTaken').replace('ticket(taken)', 'ticket(currentTaken)')
s=s[:a]+segment+'}\n'+s[b:]
p.write_text(s)
Path('work/countries-check.js').write_text(s.split('<script>')[1].split('</script>')[0])
