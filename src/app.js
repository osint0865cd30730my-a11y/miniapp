
/* ===== Дані LEX_K: позиції ВС з експорту бази (OUTPUTS/miniapp/lexa-data.json). «Покарання» і «Регіони» — відкриті дані ДСА (D.g), «Досудове» — питання й позиції ВС зі статті бази. ===== */
const $ = id => document.getElementById(id);
const D = JSON.parse($("data").textContent);
const POS = D.p, TOP = D.t, OVER = D.o, CUT = D.e.split("-").reverse().join(".");
const byId = new Map(POS.map(p=>[String(p.i),p]));
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fd = iso => iso ? iso.split("-").reverse().join(".") : "";
const P = id => byId.get(String(id));
const court = p => p.c==="ВП" ? "Велика Палата ВС" : "ККС ВС";
const nc = s => s.toLowerCase().replace(/\s+/g,"");
const caseIdx = new Map();
const VXN = new Map(Object.entries(D.vx||{}).map(([k,v])=>[k.toLowerCase().replace(/\s+/g,'').replace(/-к$/,''),v]));
const vxOf = c => VXN.get(String(c).toLowerCase().replace(/\s+/g,'').replace(/-к$/,''));
const cut = (t,n) => t.length>n ? t.slice(0,t.lastIndexOf(' ',n)>n*0.6?t.lastIndexOf(' ',n):n)+'…' : t;
POS.forEach(p=>{ p._s=(p.t+" "+p.h+" "+p.x+" "+p.r.join(" ")+" "+p.d.map(d=>d[2]).join(" ")+" пп "+p.i).toLowerCase();
  p.d.map(d=>d[2]).concat(p.k||[]).forEach(c=>{ if(c){ const k=nc(c); if(!caseIdx.has(k)) caseIdx.set(k,[]); if(!caseIdx.get(k).includes(p)) caseIdx.get(k).push(p); } }); });
const ARTC = {}; POS.forEach(p=>p.r.forEach(a=>ARTC[a]=(ARTC[a]||0)+1));
// Від яких рішень відступив ВС: номери справ поруч зі словом «відступ» у тексті позицій «з відступом».
// DEP: справа (без «-к») → номер нової позиції. depBy(p): номер позиції, якою ВС відступив від висновку p.
const DEP = (()=>{ const m=new Map(), cre=/\d{1,4}\/\d{1,6}\/\d{2}(?:-к)?/g;
  POS.filter(p=>p.m==="indented").forEach(p=>{ const txt=[p.h||"",p.t||"",p.x||""].join(" "), own=new Set(p.d.map(d=>nc(d[2]||"").replace(/-к$/,""))), re=/відступ/gi; let mm;
    while((mm=re.exec(txt))){ (txt.slice(mm.index, mm.index+400).match(cre)||[]).forEach(c=>{ const k=nc(c).replace(/-к$/,""); if(!own.has(k)&&!m.has(k)) m.set(k,p); }); } });
  return m; })();
const pdate = p => ((p.d[0]||[])[1]||p.a||"");
const depBy = p => { for(const d of p.d){ const k=nc(d[2]||"").replace(/-к$/,""), q=k&&DEP.get(k); if(q&&q.i!==p.i&&pdate(q)>pdate(p)) return q; } return null; };
const depCase = c => DEP.get(nc(c||"").replace(/-к$/,"")) || null;
// Передачі на ОП ККС / ВП ВС (data/referrals.json у репозиторії → D.ref).
// Вирішено: у базі є позиція в тій самій справі пізнішої дати або поле decided. ch — справи, від висновків у яких пропонують відступити.
const ck = c => nc(c||"").replace(/-к$/,"");
const REF = (D.ref||[]).map(r=>{ const k=ck(r.case); let dec=null;
  if(k){ const ps=POS.filter(p=>p.d.some(d=>ck(d[2])===k)&&pdate(p)>r.date).sort((a,b)=>pdate(a)<pdate(b)?-1:1); if(ps.length) dec={p:ps[0]}; }
  if(!dec&&r.decided) dec={d:r.decided};
  return Object.assign({},r,{k,dec,chk:(r.ch||[]).map(ck)}); }).sort((a,b)=>a.date<b.date?1:-1);
const REFBY = new Map(); REF.forEach(r=>r.chk.forEach(c=>{ if(!REFBY.has(c)) REFBY.set(c,[]); REFBY.get(c).push(r); }));
// позицію пов'язуємо з передачею, лише якщо збігається хоч одна стаття (r.a — статті питання, збирає tools/build.py)
const pArts = p => p.r.map(s=>s.replace(/^ст\.\s*/,""));
const refsFor = p => [...new Set(p.d.flatMap(d=>REFBY.get(ck(d[2]))||[]))].filter(r=>pdate(p)<=r.date&&(r.a||[]).some(a=>pArts(p).includes(a)));
const refPending = p => refsFor(p).filter(r=>!r.dec);
const refTo = r => r.to==="ВП ВС"?"Велику Палату ВС":r.to==="ОП ККС"?"об’єднану палату ККС":"судову палату ККС";
const N_REFP = REF.filter(r=>!r.dec).length;
const N_TH = POS.filter(p=>p.h).length, MARKED = POS.filter(p=>p.m||depBy(p));

const ARTN = {"111":"Державна зрада","111-1":"Колабораційна діяльність","438":"Воєнні злочини"};
const PARTS = {"111-1":{
  "ч. 1":"Публічне заперечення агресії, заклики до підтримки рішень держави-агресора",
  "ч. 2":"Добровільне зайняття посади без організаційно-розпорядчих функцій",
  "ч. 3":"Пропаганда в закладах освіти, впровадження стандартів освіти держави-агресора",
  "ч. 4":"Передача матеріальних ресурсів, господарська діяльність у взаємодії з агресором",
  "ч. 5":"Зайняття посади з організаційно-розпорядчими функціями, участь в організації виборів",
  "ч. 6":"Організація заходів політичного характеру, інформаційна діяльність",
  "ч. 7":"Посада в незаконних судових чи правоохоронних органах, участь у збройних формуваннях",
  "ч. 8":"Дії, що призвели до загибелі людей або інших тяжких наслідків"}};
const DISTRICTS = ["Сумський","Харківський","Чернігівський","Київський","Дніпровський","Одеський","Полтавський","Запорізький"];
const CLS = [
 ["Застосував","Висновок вирішальний для результату"],
 ["Послався формально","Цитата без застосування до обставин"],
 ["Відмежував із мотивами","Суд пояснив, чому обставини неподібні"],
 ["Не врахував","Лише за наявності документа, що це підтверджує"],
 ["Застаріле посилання","Після дати відступу"],
 ["Неподібна позиція","Послався на висновок з інших правовідносин"]
];
const SENT = {
 "111-1|ч. 1":{sanction:"Позбавлення права обіймати певні посади або займатися певною діяльністю на строк від 10 до 15 років.",
   measure:"Строк позбавлення права, років",scale:[8,16],band:[10,15],
   groups:[{n:"Загальний порядок",c:186,d:[10,10,10,12,15]},{n:"Спрощене провадження, угода",c:241,d:[10,10,10,10,13]}],
   rows:[],hint:"Основне покарання за ч. 1 — позбавлення права, а не позбавлення волі."},
 "111-1|ч. 4":{sanction:"Штраф до 10 000 НМДГ або позбавлення волі на строк від 3 до 5 років, з позбавленням права на 10–15 років та з конфіскацією майна.",
   measure:"Позбавлення волі, років",scale:[0,6],band:[3,5],
   groups:[{n:"Очно, загальний порядок",c:38,d:[3,3,4,4.5,5]},{n:"Угода про визнання винуватості",c:27,d:[3,3,3,3.5,5]},{n:"Із застосуванням ст. 69",c:12,d:[1,1.5,2,2.5,2.9]},{n:"Заочно",c:6}],
   rows:[["Штраф як основне покарання","31"],["Звільнено з випробуванням (ст. 75)","22 · іспитовий строк, медіана 2 р."],["Конфіскація майна","58"]]},
 "111-1|ч. 5":{sanction:"Позбавлення волі на строк від 5 до 10 років з позбавленням права на 10–15 років та з конфіскацією майна або без такої.",
   measure:"Позбавлення волі, років",scale:[0,11],band:[5,10],
   groups:[{n:"Очно, загальний порядок",c:64,d:[5,5,6,7,10]},{n:"Заочно",c:212,d:[8,10,10,10,10]},{n:"Угода про визнання винуватості",c:19,d:[5,5,5,6,8]},{n:"Із застосуванням ст. 69",c:14,d:[2,3,3.5,4,4.9]}],
   rows:[["Звільнено з випробуванням (ст. 75)","9"],["Конфіскація майна","171 із 309"],["Позбавлення права, медіана","12 р."]]},
 "111-1|ч. 7":{sanction:"Позбавлення волі на строк від 12 до 15 років з позбавленням права на 10–15 років та з конфіскацією майна або без такої.",
   measure:"Позбавлення волі, років",scale:[0,16],band:[12,15],
   groups:[{n:"Очно, загальний порядок",c:57,d:[12,12,12,13,15]},{n:"Заочно",c:188,d:[12,13,14,15,15]},{n:"Угода про визнання винуватості",c:11,d:[12,12,12,12.5,13]},{n:"Із застосуванням ст. 69",c:8}],
   rows:[["Конфіскація майна","143 із 264"]]},
 "111|ч. 2":{sanction:"Позбавлення волі на строк 15 років або довічне позбавлення волі, з конфіскацією майна.",
   measure:"Позбавлення волі, років",scale:[0,16],band:[15,15],
   groups:[{n:"Очно, загальний порядок",c:96,d:[15,15,15,15,15]},{n:"Заочно",c:73,d:[15,15,15,15,15]},{n:"Із застосуванням ст. 69",c:41,d:[5,8,10,12,14]}],
   rows:[["Довічне позбавлення волі","6"]]},
 "438|ч. 1":{sanction:"Позбавлення волі на строк від 8 до 12 років.",
   measure:"Позбавлення волі, років",scale:[0,13],band:[8,12],
   groups:[{n:"Заочно",c:118,d:[9,10,11,12,12]},{n:"Очно",c:7}],
   rows:[],hint:"За даними моніторингів UBA, ULAG і МІПЛ, 87–98 % вироків за ст. 438 ухвалюють заочно. Статистика нижче описує насамперед заочну практику."}
};
const SENT_PARTS = {"111":["ч. 1","ч. 2"],"111-1":["ч. 1","ч. 2","ч. 3","ч. 4","ч. 5","ч. 6","ч. 7","ч. 8"],"438":["ч. 1","ч. 2"]};
const OFFICIAL = {
 "111":{txt:"Офіційно засуджено у 2024 р.: 309 осіб (2023 р. — 179).",base:"У базі за 2024 р.: 271 (умовно)."},
 "111-1":{txt:"Офіційно засуджено у 2024 р.: 814 осіб (2023 р. — 506).",base:"У базі за 2024 р.: 702 (умовно)."},
 "438":{txt:"Окремого рядка для ст. 438 в офіційній статистиці немає: публікують групу ст. 436–447 (441 особа у 2024 р.).",base:"У базі: 125 вироків (умовно)."}
};
const PRE = D.pre||[];

/* ===== Стан ===== */
const S = {tab:"positions",stacks:{positions:[{v:"home"}],regions:[{v:"home"}],sentencing:[{v:"home"}],pretrial:[{v:"home"}],more:[{v:"home"}],vaks:[{v:"home"}],vapp:[{v:"home"}],soon:[{v:"home"}]},inst:null,
  q:"",district:"Сумський",per:"war",reg:"*",reg2:"",pg:{},mode:"court",posD:"all",cls:null,full:{},follow:{},subs:{digest:true,vidstup:true,bot:false},check:null};
try{ const s=JSON.parse(localStorage.getItem("lexa2")||"null"); if(s){Object.assign(S.follow,s.follow||{});Object.assign(S.subs,s.subs||{});if(s.district)S.district=s.district;if(s.inst)S.inst=s.inst;if(s.reg&&(s.reg==="*"||(D.g&&D.g.reg[s.reg])))S.reg=s.reg} }catch(e){}
function save(){ try{localStorage.setItem("lexa2",JSON.stringify({follow:S.follow,subs:S.subs,district:S.district,reg:S.reg,inst:S.inst}))}catch(e){} }

function mBadge(p){ return (refPending(p).length?'<span class="badge b-info">Передано до '+(refPending(p).some(r=>r.to==="ВП ВС")?"ВП":"ОП")+'</span> ':'')+(depBy(p)?'<span class="badge b-bad">Від неї відступили</span> ':'')+(p.m==="indented"?'<span class="badge b-warn">З відступом</span>':p.m==="modified"?'<span class="badge b-info">Змінена</span>':''); }
function rnd(seed){ let h=2166136261; for(const ch of seed){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)} return ()=>{h+=0x6D2B79F5;let t=Math.imul(h^h>>>15,1|h);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}; }
function counts(pid,d,mode){
  const r=rnd(pid+d+mode), total=Math.floor(5+r()*r()*150);
  let w=[.5,.22,.11,.03,.04,.1].map(x=>x*(.6+r()*.8)); const sum=w.reduce((a,b)=>a+b,0);
  const c=w.map(x=>Math.floor(x/sum*total)); c[0]+=total-c.reduce((a,b)=>a+b,0); return c;
}
function countsAll(pid,mode){ const c=[0,0,0,0,0,0]; DISTRICTS.forEach(d=>counts(pid,d,mode).forEach((x,i)=>c[i]+=x)); return c; }
const sumA = a => a.reduce((x,y)=>x+y,0);
function stackBar(c,cls){ const t=sumA(c)||1; return '<div class="stack '+(cls||"")+'">'+c.map((x,i)=>x?'<i class="c'+(i+1)+'" style="width:'+(x/t*100)+'%"></i>':"").join("")+'</div>'; }
function demoDate(r){ const d=1+Math.floor(r()*27), m=1+Math.floor(r()*10); return String(d).padStart(2,"0")+"."+String(m).padStart(2,"0")+".2026"; }
const MOCK = '<span class="demo">Макет</span>';

/* ===== Позиції (справжні дані) ===== */
function posRow(p){ const d=p.d[0]||[];
  return '<button class="row" data-a="pos" data-v="'+p.i+'"><span class="main"><span class="t" style="font-size:15px">'+esc(p.h||p.t)+'</span><div class="s">'+court(p)+(d[1]?' · '+fd(d[1]):'')+(p.r.length?' · '+esc(p.r.slice(0,2).join(", ")):'')+'</div>'+((p.m||depBy(p)||refPending(p).length)?'<div class="s">'+mBadge(p)+'</div>':'')+'</span><span class="chev">›</span></button>'; }
const MARK='<svg class="mk" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="lxg" gradientUnits="userSpaceOnUse" x1="40" y1="14" x2="66" y2="86"><stop offset="0" stop-color="#3D8BFF"/><stop offset="1" stop-color="#FFC23D"/></linearGradient></defs><g transform="translate(-1 0)"><path d="M18 28 L32 14 L44 14 L44 64 L66 64 L66 78 L58 86 L18 86 Z" fill="url(#lxg)"/><rect x="72" y="76" width="14" height="10" rx="2" fill="url(#lxg)"/></g></svg>';
function header(title,back,mock){ return '<header class="hdr'+(back?'':' top')+'">'+(back?'<button class="back" data-a="back" aria-label="Назад">‹ Назад</button>':MARK)+'<h1>'+esc(title)+'</h1>'+(mock?'<span class="demo" title="Числа й приклади на цьому екрані умовні">Макет</span>':'')+'</header>'; }
function listHTML(list,limit){ const n=limit||60, show=list.slice(0,n);
  return (show.length?'<div class="group">'+show.map(posRow).join("")+'</div>':'')+(list.length>n?'<p class="note">Показано '+n+' із '+list.length+'. Уточніть запит, щоб звузити добірку.</p>':''); }
function search(q){ const am=/^\s*ст\.?\s*(\d+(?:-\d+)?)\s*кк\s*$/i.exec(q); if(am) return artHit(am[1]);
  const tk=q.toLowerCase().split(/\s+/).filter(Boolean); return POS.filter(p=>tk.every(t=>p._s.includes(t))); }
const QUICK_BY={sbu:["ст. 111-1 КК","ст. 111 КК","тримання під вартою","обшук","НСРД","ст. 290","заочн"],
  nabu:["ст. 368 КК","ст. 191 КК","ст. 364 КК","ст. 369-2 КК","неправомірн","НСРД","обшук"],
  police:["ст. 190 КК","ст. 185 КК","ст. 286 КК","ст. 307 КК","ст. 263 КК","тримання під вартою","обшук"],
  beb:["ст. 212 КК","ст. 204 КК","ст. 205-1 КК","ст. 222 КК","арешт майна","тимчасовий доступ","обшук"],
  dbr:["ст. 407 КК","ст. 365 КК","ст. 364 КК","ст. 366 КК","ст. 425 КК","тримання під вартою","обшук"]};
const quick=()=>QUICK_BY[S.inst]||QUICK_BY.sbu;
// Позиції, де згадано статтю КК (поле статей або текст «ст. 190 КК», «ч. 2 ст. 185, 186 КК», «статті 190 КК»)
const ART_HIT={};
function artHit(n){ if(ART_HIT[n]) return ART_HIT[n];
  const e=n.replace("-","\\-"), rx=new RegExp("(?:ст\\.|статт\\S*)\\s*(?:\\d+(?:-\\d+)?(?:,\\s*|\\s+(?:і|та)\\s+))*"+e+"(?![\\d-])[^;]{0,40}?кк");
  return ART_HIT[n]=POS.filter(p=>p.r.includes("ст. "+n+" КК")||rx.test(p._s)); }
// Склади злочинів за органом: добірки позицій за статтями КК (рахуються із самої бази)
const INST_CAT={
  police:{t:"Загальнокримінальні злочини: позиції ВС",h:"Загальнокримінальні злочини",g:[
    ["Проти життя та здоров’я",[["115","Умисне вбивство"],["121","Тяжкі тілесні ушкодження"],["122","Середньої тяжкості тілесні ушкодження"],["125","Легкі тілесні ушкодження"],["126-1","Домашнє насильство"]]],
    ["Проти власності",[["185","Крадіжка"],["186","Грабіж"],["187","Розбій"],["189","Вимагання"],["190","Шахрайство"],["194","Знищення або пошкодження майна"]]],
    ["Безпека руху",[["286","Порушення ПДР особою, що керує транспортом"],["286-1","Керування в стані сп’яніння"],["289","Незаконне заволодіння транспортним засобом"]]],
    ["Зброя, наркотики, громадський порядок",[["263","Незаконне поводження зі зброєю"],["296","Хуліганство"],["307","Збут наркотичних засобів"],["309","Наркотики без мети збуту"]]],
    ["Статеві злочини",[["152","Зґвалтування"],["153","Сексуальне насильство"]]],
    ["Правосуддя, управління, військовий обов’язок",[["336","Ухилення від призову за мобілізацією"],["342","Опір представникові влади"],["345","Погроза або насильство щодо працівника правоохоронного органу"],["382","Невиконання судового рішення"]]]]},
  beb:{t:"Економічні злочини: позиції ВС",h:"Економічні злочини",g:[
    ["Податки та акциз",[["212","Ухилення від сплати податків"],["212-1","Ухилення від сплати ЄСВ"],["204","Підакцизні товари"],["216","Марки акцизного податку"]]],
    ["Фінанси та гроші",[["199","Підроблені гроші"],["200","Платіжні інструменти"],["209","Легалізація доходів"],["222","Шахрайство з фінансовими ресурсами"],["222-1","Маніпулювання на фондовому ринку"],["218-1","Доведення до банкрутства"],["219","Доведення до банкрутства (до 2020 р.)"]]],
    ["Фіктивне підприємництво",[["205","Фіктивне підприємництво"],["205-1","Підроблення документів для реєстрації"],["206-2","Протиправне заволодіння майном підприємства"]]],
    ["Інтелектуальна власність, комерційна таємниця",[["229","Незаконне використання знака"],["231","Комерційна таємниця"],["232","Розголошення комерційної таємниці"]]]]},
  dbr:{t:"Злочини, які розслідує ДБР: позиції ВС",h:"Справи ДБР",g:[
    ["Військові злочини",[["402","Непокора"],["405","Погроза або насильство щодо начальника"],["406","Насильство щодо підлеглого"],["407","Самовільне залишення частини"],["408","Дезертирство"],["409","Ухилення від військової служби"],["410","Викрадення зброї військовослужбовцем"],["425","Недбале ставлення до служби"],["426-1","Перевищення влади військовою службовою особою"]]],
    ["Правоохоронці та судді",[["127","Катування"],["365","Перевищення влади або службових повноважень"],["371","Незаконне затримання"],["372","Притягнення завідомо невинного"],["373","Примушування давати показання"],["374","Порушення права на захист"],["375","Постановлення неправосудного рішення"]]],
    ["Службові злочини",[["364","Зловживання владою"],["366","Службове підроблення"],["367","Службова недбалість"]]]]},
};
function instCatBtn(){ if(S.inst==="nabu") return '<button class="row" data-a="topic" data-v="koruptsiini-zlochyny-pozytsii-vs" style="margin-bottom:10px;border-radius:12px;background:var(--card)"><span class="main"><span class="t">Корупційні та службові злочини: позиції ВС</span><div class="s">Ст. 191, 364, 366, 368, 369, 369-2 КК та суміжні</div></span><span class="chev">›</span></button>';
  const c=INST_CAT[S.inst]; if(!c) return "";
  const arts=c.g.flatMap(g=>g[1]).filter(a=>artHit(a[0]).length), n=new Set(arts.flatMap(a=>artHit(a[0]))).size;
  return '<button class="row" data-a="go" data-v="icat" style="margin-bottom:10px;border-radius:12px;background:var(--card)"><span class="main"><span class="t">'+c.t+'</span><div class="s">Ст. '+[...arts].sort((x,y)=>artHit(y[0]).length-artHit(x[0]).length).slice(0,5).map(a=>a[0]).join(", ")+' КК та інші · позицій: '+n+'</div></span><span class="chev">›</span></button>'; }
function vInstCat(){ const c=INST_CAT[S.inst]||INST_CAT.police;
  return header(c.h,true)+'<div class="wrap"><p class="note" style="margin-top:0">Позиції ВС за статтями КК, які найчастіше трапляються в справах органу. Позицію зараховано до статті, якщо статтю названо в її тексті; одна позиція може бути в кількох статтях. База найповніша щодо справ СБУ та корупційних справ, тож за частиною статей позицій поки небагато.</p>'+
   c.g.map(g=>{ const rows=g[1].filter(a=>artHit(a[0]).length); return rows.length?'<div class="sh">'+g[0]+'</div><div class="group">'+rows.map(a=>'<button class="row" data-a="iart" data-v="'+a[0]+'"><span class="main"><span class="t" style="font-size:15px">ст. '+a[0]+' КК · '+esc(a[1])+'</span></span><span class="v">'+artHit(a[0]).length+'</span><span class="chev">›</span></button>').join("")+'</div>':''; }).join("")+'</div>'; }
function vInstArt(n){ const a=(INST_CAT[S.inst]?INST_CAT[S.inst].g.flatMap(g=>g[1]):[]).find(x=>x[0]===n), list=byDate(artHit(n));
  return header("ст. "+n+" КК",true)+'<div class="wrap"><p class="note" style="margin-top:0">'+(a?esc(a[1])+' · ':'')+'позицій: '+list.length+'</p>'+listHTML(list,250)+'</div>'; }
function topicRows(rub){ return TOP.filter(t=>t.r===rub).map(t=>'<button class="row" data-a="topic" data-v="'+t.s+'"><span class="main"><span class="t" style="font-size:15px">'+esc(t.t)+'</span></span><span class="v">'+t.n+'</span><span class="chev">›</span></button>').join(""); }
function resultsHTML(){
  const q=S.q.trim();
  if(q){ const r=search(q); return '<div class="sh">Знайдено: '+r.length+'</div>'+(r.length?listHTML(r,40):'<p class="note">У базі немає позицій за цим запитом. Це не означає, що їх немає в практиці ВС: перевірте в ЄДРСР або змініть запит.</p>'); }
  const fresh=[...POS].sort((a,b)=>(b.a||"").localeCompare(a.a||"")).slice(0,5);
  return '<p class="note" style="margin-top:2px">'+POS.length+' позиція ККС ВС і Великої Палати ВС · '+N_TH+' із короткою тезою бази · зріз '+CUT+'</p>'+
    '<div class="sh">Склади злочинів</div><div class="group">'+topicRows("Склади")+'</div>'+
    '<div class="sh">Кримінальний процес</div><div class="group">'+topicRows("Процес")+'</div>'+
    '<div class="sh">Інші добірки</div><div class="group"><button class="row" data-a="go" data-v="arts"><span class="main"><span class="t">Усі статті КК і КПК</span><div class="s">'+Object.keys(ARTC).length+' статей</div></span><span class="chev">›</span></button>'+
    '<button class="row" data-a="go" data-v="marked"><span class="main"><span class="t">Відступи та зміни позицій</span><div class="s">Позначки бази правових позицій ВС</div></span><span class="v">'+MARKED.length+'</span><span class="chev">›</span></button>'+
    (REF.length?'<button class="row" data-a="go" data-v="refs"><span class="main"><span class="t">Передано на ОП і ВП</span><div class="s">Висновки під сумнівом, поки палата не вирішила</div></span><span class="v">'+N_REFP+'</span><span class="chev">›</span></button>':'')+'</div>'+
    '<div class="sh">Нещодавно додані</div><div class="group">'+fresh.map(posRow).join("")+'</div>'+
    '<div class="sh">Практика судів</div><div class="group">'+[["sentencing","Практика покарань",D.g.verdicts+" вироків за підслідністю СБУ з "+D.g.from+", за частинами статей і областями",""],["regions","Практика за регіонами","На які постанови ВС посилаються суди області",""],["pretrial","Досудове розслідування","Питання досудового розслідування: що вирішив ВС і чого не вирішував",""]].map(x=>'<button class="row" data-a="tabgo" data-v="'+x[0]+'"><span class="main"><span class="t" style="color:var(--link)">'+x[1]+'</span><div class="s">'+x[2]+'</div></span>'+x[3]+'<span class="chev">›</span></button>').join("")+'</div>'+
    '<p class="note">Тексти позицій — з бази правових позицій Верховного Суду, тези — з бази LEX_K. Кожна позиція має посилання на рішення в ЄДРСР.</p>';
}
// Плашка вгорі «Позицій»: з яким органом досудового розслідування працює користувач (обирається в «Стежу»)
const INST_NOTE={sbu:["Для СБУ","Злочини проти основ національної безпеки, воєнні злочини, тероризм"],
  nabu:["Для НАБУ / САП","Позиції ВС в антикорупційних справах"],
  police:["Для Національної поліції","Загальнокримінальні злочини"],
  beb:["Для БЕБ","Економічні злочини"],
  dbr:["Для ДБР","Злочини працівників правоохоронних органів, суддів та інших осіб, визначених ч. 4 ст. 216 КПК"],
  all:["Для всіх органів","Практика всіх органів досудового розслідування"]};
function instNote(){ const n=INST_NOTE[S.inst]; return n?'<div class="alert a-info" style="margin-top:0"><b>'+n[0]+'</b>'+n[1]+'</div>':''; }
function vPositionsHome(){ return header("Позиції Верховного Суду")+'<div class="wrap">'+instNote()+instCatBtn()+'<input class="search" id="q" type="search" placeholder="Пошук: стаття, слово, номер справи" value="'+esc(S.q)+'" autocomplete="off">'+
  '<div class="chips">'+quick().map(x=>'<button class="chip" data-a="quick" data-v="'+x+'">'+x+'</button>').join("")+'</div><div id="results" style="display:flex;flex-direction:column;gap:8px">'+resultsHTML()+'</div></div>'; }
function byDate(list){ return [...list].sort((a,b)=>((b.d[0]||[])[1]||"").localeCompare((a.d[0]||[])[1]||"")); }
function vTopic(s){ const t=TOP.find(x=>x.s===s), list=byDate(POS.filter(p=>p.o.includes(s)));
  return header(t.t,true)+'<div class="wrap"><p class="note" style="margin-top:0">'+esc(t.t)+' · позицій: '+list.length+'</p>'+listHTML(list,250)+'</div>'; }
function vArts(){ const num=a=>parseFloat(a.replace("ст. ","").replace("-","."));
  const grp=code=>Object.keys(ARTC).filter(a=>a.endsWith(" "+code)).sort((a,b)=>num(a)-num(b)).map(a=>'<button class="row" data-a="byart" data-v="'+a+'"><span class="main t">'+a+'</span><span class="v">'+ARTC[a]+'</span><span class="chev">›</span></button>').join("");
  return header("Статті",true)+'<div class="wrap"><div class="sh">Кримінальний кодекс</div><div class="group">'+grp("КК")+'</div><div class="sh">Кримінальний процесуальний кодекс</div><div class="group">'+grp("КПК")+'</div></div>'; }
function vByArt(a){ const list=byDate(POS.filter(p=>p.r.includes(a))); return header(a,true)+'<div class="wrap"><p class="note" style="margin-top:0">Позицій: '+list.length+'</p>'+listHTML(list,250)+'</div>'; }
function vRefs(){
  const row=r=>{ const id="ref|"+r.id, open=S.sv===id, lp=POS.filter(p=>refsFor(p).includes(r));
    let h='<button class="row" data-a="sv" data-v="'+id+'"><span class="main"><span class="t" style="font-size:15px">'+esc(r.issue)+'</span><div class="s">'+esc(r.to)+' · ухвала від '+fd(r.date)+(r.case?' · справа № '+esc(r.case):'')+(lp.length?' · позицій у базі: '+lp.length:'')+'</div>'+
      (r.dec?'<div class="s" style="color:var(--ok)">Вирішено'+(r.dec.p?': позиція № '+r.dec.p.i+', '+fd(pdate(r.dec.p)):r.dec.d.date?': постанова від '+fd(r.dec.d.date):'')+'</div>':'')+'</span><span class="chev">'+(open?'⌄':'›')+'</span></button>';
    if(open) h+='<div class="pad" style="display:flex;flex-wrap:wrap;gap:8px"><a class="badge b-info" href="https://reyestr.court.gov.ua/Review/'+r.id+'" target="_blank" rel="noopener">Ухвала про передачу ↗</a>'+(r.dec&&r.dec.p?'<button class="badge b-ok" data-a="pos" data-v="'+r.dec.p.i+'">Рішення: позиція № '+r.dec.p.i+' ›</button>':r.dec&&r.dec.d.edrsr?'<a class="badge b-ok" href="https://reyestr.court.gov.ua/Review/'+r.dec.d.edrsr+'" target="_blank" rel="noopener">Постанова ↗</a>':'')+'</div>'+
      (lp.length?'<div class="pad note" style="padding-top:0;margin:0">Позиції бази, від висновків яких пропонують відступити:</div>'+lp.map(posRow).join(""):(r.ch&&r.ch.length?'<div class="pad note" style="padding-top:0;margin:0">Справи, від висновків у яких пропонують відступити: '+r.ch.map(esc).join(", ")+'. Позицій у базі з цього питання за ними не знайдено.</div>':''));
    return h; };
  const pend=REF.filter(r=>!r.dec), done=REF.filter(r=>r.dec);
  return header("Передано на ОП і ВП",true)+'<div class="wrap"><p class="note" style="margin-top:0">Кримінальні справи, які ККС передав на розгляд об’єднаної палати, судової палати чи Великої Палати — найчастіше для відступу від попереднього висновку. Поки рішення немає, висновки, від яких пропонують відступити, — під сумнівом. Перелік — з оглядів Верховного Суду з серпня 2025 року, номери справ — з ухвал у ЄДРСР.</p>'+
   '<div class="sh">На розгляді · '+pend.length+'</div><div class="group">'+pend.map(row).join("")+'</div>'+
   '<div class="sh">Вирішено · '+done.length+'</div><div class="group">'+done.map(row).join("")+'</div>'+
   '<p class="note">«Вирішено» — у базі LEX_K уже є позиція ОП чи ВП у тій самій справі або відома постанова. Справи, у яких рішення ще не потрапило в базу, показано як «на розгляді»: перед посиланням перевірте в ЄДРСР. Оновлено: '+fd((D.refUpdated||"")||"")+'</p></div>';
}
function vMarked(){ return header("Відступи та зміни",true)+'<div class="wrap"><p class="note" style="margin-top:0">«З відступом» — позицію ухвалено з відступом від попереднього висновку. «Змінена» — позначка бази ВС про подальшу зміну позиції. «Від неї відступили» — пізніша позиція з відступом посилається на справу цієї позиції; зв’язок знайдено автоматично за номером справи, тому звіряйте з текстом нової позиції.</p>'+listHTML(byDate(MARKED),100)+'</div>'; }

const CITN = (()=>{ const m=new Map(); Object.entries((D.g&&D.g.citall)||{}).forEach(([c,v])=>{ const k=nc(c).replace(/-к$/,""); m.set(k,(m.get(k)||[]).concat(v)); }); return m; })();
function applyBlock(p){
  const cs=[...new Set(p.d.map(d=>d[2]).concat(p.k||[]).filter(Boolean).map(c=>nc(c).replace(/-к$/,"")))];
  const all=[...new Set(cs.flatMap(c=>CITN.get(c)||[]))].sort((a,b)=>{const da=GS.V[a][1].split(".").reverse().join(""),db=GS.V[b][1].split(".").reverse().join("");return db.localeCompare(da);});
  if(!all.length) return '<div class="sh">Посилання у вироках СБУ</div><div class="group"><div class="pad" style="font-size:14px;color:var(--hint)">У вироках за підслідністю СБУ (з '+GS.from+') посилань на '+(cs.length>1?'справи':'справу')+' цієї позиції не знайдено.</div></div>';
  const g=S.reg, idx=all.filter(vi=>inReg(vi,g)), byReg={}; all.forEach(vi=>{const r=GS.C[GS.V[vi][3]][1]; byReg[r]=(byReg[r]||0)+1;});
  const id="cit|"+p.i, open=S.sv===id, top=Object.entries(byReg).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return '<div class="sh">Посилання у вироках СБУ <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+
   '<button class="row" data-a="sv" data-v="'+esc(id)+'"><span class="main"><span class="t" style="font-size:15px">Вироків, що посилаються на '+(cs.length>1?'справи':'справу')+' позиції</span><div class="s">'+top.map(x=>esc(x[0])+' — '+x[1]).join(" · ")+'</div></span><span class="v">'+all.length+'</span><span class="chev">'+(open?'⌄':'›')+'</span></button>'+
   (open?listBlock(id,all):'')+'</div>'+
   '<p class="note">Номер справи ВС розпізнано автоматично в текстах вироків за підслідністю СБУ з '+GS.from+'. Посилання не означає, що суд застосував висновок: він міг і відхилити довід сторони. Статистики за суддями немає.</p>';
}
function examples(p,i,n){
  if(!n) return '<div class="pad" style="font-size:13px;color:var(--hint)">Рішень цього класу немає.</div>';
  const r=rnd(p.i+"e"+i+S.posD), q=["«…з урахуванням висновку Верховного Суду, викладеного в постанові…, суд дійшов висновку…»","«…колегія суддів бере до уваги правову позицію Верховного Суду…»","«…обставини цього провадження не є подібними, оскільки…»","Довід апеляційної скарги з посиланням на висновок залишено без відповіді. Підтверджено постановою ККС ВС про скасування ухвали.","Посилання зроблено після дати відступу від позиції.","Висновок стосується іншої норми."][i];
  let h=""; for(let k=0;k<Math.min(2,n);k++){ const d=S.posD==="all"?DISTRICTS[Math.floor(r()*DISTRICTS.length)]:S.posD;
    h+='<div class="pad" style="padding-top:8px;padding-bottom:10px;font-size:13px"><div style="color:var(--hint)">Умовний приклад · ухвала апеляційного суду · '+d+' округ · '+demoDate(r)+'</div><div style="margin-top:4px">'+q+'</div></div>'; }
  return h;
}
// Абзац для клопотання чи скарги: суд, вид і дата рішення, справа, текст позиції в лапках, посилання на ЄДРСР
function forMotion(p){
  const d=p.d[0]||[], kind={"Постанова":"у постанові","Ухвала":"в ухвалі","Рішення":"у рішенні"}[d[0]]||"у постанові";
  const who=p.c==="ВП"?"Велика Палата Верховного Суду":"Верховний Суд у складі Касаційного кримінального суду";
  let q=String(p.x||p.t||"").replace(/\s+/g," ").trim();
  if(q.length>650){ const ss=q.match(/[^.!?]+[.!?]+(\s|$)/g)||[q]; let t=""; for(const x of ss){ if((t+x).length>650&&t) break; t+=x; } q=t.trim()+(t.trim().length<q.length?" …":""); }
  q=q.replace(/[.\s]+$/,"");
  return who+" "+kind+(d[1]?" від "+fd(d[1]):"")+(d[2]?" у справі № "+d[2]:"")+(p.c==="ВП"?" сформулювала":" сформулював")+" правовий висновок: «"+q+"»"+(d[3]?" (https://reyestr.court.gov.ua/Review/"+d[3]+")":"")+".";
}
function cite(p){ const d=p.d[0]||[]; return (d[0]||"Постанова").toLowerCase()+" "+court(p)+(d[1]?" від "+fd(d[1]):"")+(d[2]?" у справі № "+d[2]:"")+" (ПП "+p.i+")"; }
function vPos(id){
  const p=P(id), long=p.x.length>700, open=S.full[p.i]||!long;
  let h=header("Позиція № "+p.i,true)+'<div class="wrap">';
  refsFor(p).forEach(r=>{ const ed='<a class="badge b-info" href="https://reyestr.court.gov.ua/Review/'+r.id+'" target="_blank" rel="noopener">Ухвала про передачу ↗</a>';
    if(!r.dec) h+='<div class="alert a-warn"><b>Питання передано на розгляд: '+esc(refTo(r))+'</b>'+esc(r.issue)+'. Ухвалою від '+fd(r.date)+(r.case?' у справі № '+esc(r.case):'')+' висновок цієї позиції названо серед тих, від яких пропонують відступити. Рішення ще немає (за даними LEX_K станом на '+CUT+').<div style="margin-top:8px">'+ed+'</div></div>';
    else h+='<div class="alert a-info"><b>Питання розглянула '+(r.to==="ВП ВС"?"Велика Палата ВС":r.to==="ОП ККС"?"об’єднана палата ККС":"судова палата ККС")+'</b>'+esc(r.issue)+'. Справу передавали ухвалою від '+fd(r.date)+'; висновок цієї позиції в ній згадано. Звірте, чи він досі чинний.<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px">'+(r.dec.p?'<button class="badge b-ok" data-a="pos" data-v="'+r.dec.p.i+'">Позиція № '+r.dec.p.i+' ('+fd(pdate(r.dec.p))+') ›</button>':r.dec.d.edrsr?'<a class="badge b-ok" href="https://reyestr.court.gov.ua/Review/'+r.dec.d.edrsr+'" target="_blank" rel="noopener">Постанова від '+fd(r.dec.d.date)+' ↗</a>':'')+ed+'</div></div>'; });
  const dq=depBy(p); if(dq) h+='<div class="alert a-bad"><b>Від цього висновку ВС відступив</b>'+esc(court(dq))+(pdate(dq)?' '+fd(pdate(dq)):'')+' ухвалив позицію з відступом від висновку в цій справі. Перш ніж посилатися, прочитайте нову позицію.<div style="margin-top:8px"><button class="badge b-ok" data-a="pos" data-v="'+dq.i+'">Нова позиція № '+dq.i+' ›</button></div></div>';
  if(p.m==="indented") h+='<div class="alert a-warn"><b>Ухвалена з відступом</b>Цією позицією Верховний Суд відступив від попереднього висновку. Посилання на стару практику з цього питання перевіряйте.</div>';
  if(p.m==="modified") h+='<div class="alert a-info"><b>Позицію змінено</b>У базі ВС є позначка про подальшу зміну. Звірте з текстом нижче й останніми рішеннями.</div>';
  h+='<div class="group"><div class="pad">'+(p.h?'<div class="s" style="font-size:12px;color:var(--hint);text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px">Теза бази LEX_K</div><p class="thesis">'+esc(p.h)+'</p>':'<p class="thesis">'+esc(p.t)+'</p>')+'</div></div>'+
   '<div class="sh">Текст позиції Верховного Суду</div><div class="group"><div class="pad">'+(p.h?'<p class="body" style="font-weight:600;margin-bottom:8px">'+esc(p.t)+'</p>':'')+'<p class="body">'+esc(open?p.x:p.x.slice(0,600).replace(/\s+\S*$/,"")+"…").replace(/\n/g,"<br>")+'</p>'+
   (long&&!open?'<button data-a="full" data-v="'+p.i+'" style="color:var(--link);margin-top:8px;font-size:15px">Показати повністю</button>':'')+(p.x.length>=2000?'<p class="s" style="font-size:13px;color:var(--hint);margin-top:8px">Текст скорочено до 2000 знаків. Повний — у рішенні.</p>':'')+'</div></div>'+
   (((D.od||{})[p.i]||[]).length?'<div class="sh">Окремі думки у цій справі</div><div class="group">'+D.od[p.i].map(o=>'<a class="row" href="https://reyestr.court.gov.ua/Review/'+o[3]+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">Окрема думка · '+esc(o[2])+'</span><div class="s">'+fd(o[1])+' · справа № '+esc(o[0])+'</div></span><span class="chev">↗</span></a>').join("")+'</div><p class="note" style="margin-top:6px">Окрему думку знайдено за номером справи: вона може стосуватися іншого рішення в цій справі. Суть незгоди для ключових справ — у статті бази «Окремі думки суддів ВС».</p>':'')+
   '<div class="sh">Рішення</div><div class="group">'+(p.d.length?p.d.map(d=>'<a class="row" href="'+(d[3]?'https://reyestr.court.gov.ua/Review/'+d[3]:'https://reyestr.court.gov.ua/')+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">'+esc(d[0])+(d[1]?' від '+fd(d[1]):'')+'</span><div class="s">'+(d[2]?'справа № '+esc(d[2])+' · ':'')+'відкрити в ЄДРСР</div></span><span class="chev">↗</span></a>').join(""):'<div class="pad" style="font-size:14px;color:var(--hint)">Посилання на рішення в базі немає.</div>')+
   '<div class="row"><span class="main t" style="font-size:15px">Суд</span><span class="v">'+court(p)+'</span></div>'+(p.a?'<div class="row"><span class="main t" style="font-size:15px">Додано до бази ВС</span><span class="v">'+fd(p.a)+'</span></div>':'')+'</div>'+
   (p.r.length?'<div class="chips">'+p.r.map(a=>'<button class="chip" data-a="byart" data-v="'+a+'">'+a+'</button>').join("")+'</div>':'')+
   '<div class="btns"><button class="btn'+(S.follow[p.i]?" ghost":"")+'" data-a="follow" data-v="'+p.i+'">'+(S.follow[p.i]?"Стежу":"Стежити")+'</button><button class="btn ghost" data-a="copy" data-v="'+p.i+'">Копіювати посилання</button></div>'+
   '<div class="group"><button class="row" data-a="motion" data-v="'+p.i+'"><span class="main"><span class="t" style="font-size:15px">Скопіювати для клопотання</span><div class="s">Абзац із судом, датою, справою, текстом позиції в лапках і посиланням на ЄДРСР</div></span><span class="chev">⧉</span></button>'+tgRow("pp_"+p.i,"Сповіщення в Telegram","Бот повідомить, якщо в базі з’явиться позначка про відступ чи зміну цієї позиції")+'</div>'+
   (S.motion&&S.motion.i===p.i?'<div class="group"><div class="pad"><div class="s" style="margin-bottom:6px">Буфер обміну недоступний — виділіть і скопіюйте вручну:</div><p class="body" style="user-select:text">'+esc(S.motion.t)+'</p></div></div>':'')+
   applyBlock(p);
  return h+'</div>';
}

/* ===== Макети: регіони, покарання, досудове ===== */
/* ===== Ст. 111: справжні дані пілоту з ЄДРСР ===== */
const KS = D.k, KR = D.kr||{};
let K = KS;
// Ст. 111 за апеляційними округами: Сумщина — пілот із ручною перевіркою (D.k), інші округи — автоматичний розбір (D.kr)
const kSet = r => { K = (r&&KR[r])||KS; return K; };
const kr = () => K!==KS?"|"+K.key:"";
const K_ORD = ["kyiv","odesa","dnipro","kharkiv"];
function k111List(){
  const row=(v,t,s)=>'<button class="row" data-a="p111" data-v="'+v+'"><span class="main"><span class="t">'+t+'</span><div class="s">'+s+'</div></span><span class="chev">›</span></button>';
  return '<div class="sh">Ст. 111 за апеляційними округами</div><div class="group">'+
   row("","Сумська область · Сумський апеляційний суд",KS.n.verdicts+' вироків 2024–2026, кожен звірено вручну: форма розгляду, апеляція, полон')+
   K_ORD.filter(k=>KR[k]).map(k=>{const x=KR[k];return row(k,esc(x.name)+' · '+esc(x.court),x.n.verdicts+' вироків 2024–2026, '+(x.auto?'автоматичний розбір':'кожен звірено вручну'))}).join("")+'</div>'+
   (K_ORD.some(k=>KR[k]&&KR[k].auto)?'<p class="note">Позначені «автоматичний розбір» округи ще не звірено вручну: перед цитуванням звіряйте з текстом вироку.</p>':'');
}
const yr = n => n+" "+(n%10===1&&n%100!==11?"рік":[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?"роки":"років");
const vrow = r => '<a class="row" href="https://reyestr.court.gov.ua/Review/'+r.id+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">'+esc(r.court)+'</span><div class="s">'+r.date+' · справа № '+esc(r.case)+'</div><div class="s">'+esc(r.short)+'</div>'+(r.ap?'<div class="s">Апеляція: '+esc(r.ap)+'</div>':'')+(r.note?'<div class="s" style="color:var(--warn)">'+esc(r.note)+'</div>':'')+'</span><span class="chev">↗</span></a>';
function sentHome111(){
  const n=K.n;
  return '<div class="sh">Ст. 111 КК · Державна зрада <span class="badge b-ok">Дані ЄДРСР</span></div>'+
   '<div class="group">'+["ч. 2","ч. 1"].filter(k=>K.parts[k]).map(k=>{const p=K.parts[k];return '<button class="row" data-a="sent" data-v="111|'+k+kr()+'"><span class="main"><span class="t">'+k+'</span><div class="s">'+p.persons+' '+(K.unit||"осіб")+' · '+esc(p.headline)+'</div></span><span class="chev">›</span></button>'}).join("")+
   '<button class="row" data-a="slist" data-v="'+(K!==KS?K.key:"")+'"><span class="main"><span class="t">Усі вироки</span><div class="s">'+n.verdicts+' вироків, з них '+n.acq+' виправдувальні й '+n.closed+' закриті'+(n.other?', '+n.other+' з іншим результатом':'')+'</div></span><span class="chev">›</span></button></div>'+
   '<p class="note">'+esc(K.region)+', вироки '+esc(K.period)+', зріз '+K.cut+'. '+(K.auto?'Розбір автоматичний, за текстами з відкритих даних ДСА; вручну не звірено. ':K.manual?'Кожен вирок звірено вручну '+esc(K.manual)+'. ':'')+esc(K.official)+'</p>';
}
function vSent111(k){
  const p=K.parts[k], tot=p.persons, un=K.unit||"осіб";
  let h=header(k+" ст. 111 КК",true)+'<div class="wrap">'+
   '<div class="sh">Санкція</div><div class="group"><div class="pad body">'+esc(p.sanction)+'</div></div>'+
   '<div class="sh">Призначено · '+tot+' '+un+'</div><div class="group">'+p.values.map((v,i)=>{const open=S.sv===k+i;
     return '<button class="row" data-a="sv" data-v="'+k+i+'"><span class="main"><span class="t">'+esc(v.label)+'</span>'+(v.note?'<div class="s">'+esc(v.note)+'</div>':'')+
     '<div class="stack mini" style="margin-top:7px"><i class="c3" style="width:'+(v.n/tot*100)+'%"></i></div></span><span class="v">'+v.n+'</span><span class="chev">'+(open?'⌄':'›')+'</span></button>'+(open?v.rows.map(vrow).join(""):"")}).join("")+'</div>'+
   (p.hint?'<div class="alert a-info"><b>Що це означає</b>'+esc(p.hint)+'</div>':'')+
   K.alerts.map(a=>'<div class="alert a-warn"><b>'+esc(a.title)+'</b>'+esc(a.text)+(a.id?'<div style="margin-top:8px"><a class="badge b-warn" href="https://reyestr.court.gov.ua/Review/'+a.id+'" target="_blank" rel="noopener">Постанова в ЄДРСР ↗</a></div>':'')+'</div>').join("")+
   '<div class="sh">Як розглядали</div><div class="group">'+p.forms.map(f=>'<div class="row"><span class="main t" style="font-size:15px">'+esc(f[0])+'</span><span class="v">'+f[1]+'</span></div>').join("")+'</div>'+
   '<div class="sh">Інші наслідки</div><div class="group">'+p.other.map(f=>'<div class="row"><span class="main t" style="font-size:15px">'+esc(f[0])+'</span><span class="v">'+esc(String(f[1]))+'</span></div>').join("")+'</div>'+
   '<div class="sh">Апеляція · усі вироки за ст. 111</div><div class="group">'+K.appeal.map(f=>'<div class="row"><span class="main t" style="font-size:15px">'+esc(f[0])+'</span><span class="v">'+f[1]+'</span></div>').join("")+'</div>'+
   '<p class="note">'+esc(K.region)+', вироки першої інстанції '+esc(K.period)+'. Вибірку зібрано за категорією справи в ЄДРСР, тому частина вироків за ст. 111 могла в неї не потрапити. Закриті тексти ('+K.n.closed+') не враховано.'+(K.auto?' Форму розгляду, конфіскацію, ознаки полону і результат апеляції визначено автоматично; результат апеляції — перше апеляційне рішення по суті після дати вироку.':K.manual?' Кожен вирок і останні апеляційні ухвали в справі звірено вручну; «немає» означає, що апеляційного рішення по суті у відкритих даних немає, а не те, що вирок не оскаржували.':'')+' Дані не є рекомендацією щодо міри покарання.</p></div>';
  return h;
}
function vList111(r){
  kSet(r);
  const g=[["Обвинувальні",K.list.filter(r=>r.res==="conv")],["Виправдувальні",K.list.filter(r=>r.res==="acq")],["Текст закрито",K.list.filter(r=>r.res==="closed")],["Інший результат",K.list.filter(r=>r.res==="other")]];
  return header("Вироки за ст. 111"+(K!==KS?" · "+K.name:""),true)+'<div class="wrap"><p class="note" style="margin-top:0">'+esc(K.region)+' · '+esc(K.period)+' · зріз '+K.cut+'</p>'+
   g.map(([t,l])=>l.length?'<div class="sh">'+t+' · '+l.length+'</div><div class="group">'+l.map(vrow).join("")+'</div>':'').join("")+'</div>';
}
/* ===== Вироки за підслідністю СБУ: відкриті дані ДСА (D.g) ===== */
let G = D.g; const GS = D.g, GSP = D.gp, GV = D.gv, GD = D.gd, GB = D.gb, GN = D.gn;
// Інституції з даними ЄДРСР для «Покарання» і «Регіонів»: поліція з’явиться, щойно в даних буде D.gn
const IG = {beb:GB, dbr:GD, police:GN}, INSTN = {sbu:"СБУ",beb:"БЕБ",dbr:"ДБР",police:"поліції"};
const hasIG = k => !!IG[k];
const perSel = () => (GSP&&(G===GS||G===GSP))?'<div class="chips" style="margin:0 0 10px">'+[["war","Після 24.02.2022"],["pre","До 24.02.2022"]].map(x=>'<button class="chip"'+(S.per===x[0]?' aria-pressed="true"':'')+' data-a="per" data-v="'+x[0]+'">'+x[1]+'</button>').join("")+'</div>'+(S.per==="pre"?'<p class="note" style="margin-top:0">Вироки до 24.02.2022 (з '+GSP.from+'): відкриті дані ДСА, архіви з 2018 р.; закриті тексти не враховано. Ст. 111-1, 111-2 тоді не існувало, санкції ст. 110, 111 змінювалися — порівнювати з воєнним періодом обережно.</p>':''):'';
const ARTF = {"305":"Контрабанда наркотичних засобів, психотропних речовин, їх аналогів чи прекурсорів або фальсифікованих лікарських засобів","333":"Порушення порядку здійснення міжнародних передач товарів, що підлягають державному експортному контролю","359":"Незаконні придбання, збут або використання спеціальних технічних засобів отримання інформації","332-2":"Незаконний перетин державного кордону України","110-2":"Фінансування дій, вчинених з метою насильницької зміни чи повалення конституційного ладу або захоплення державної влади, зміни меж території або державного кордону України","334":"Порушення правил міжнародних польотів","328":"Розголошення державної таємниці","258-5":"Фінансування тероризму","422":"Розголошення відомостей військового характеру, що становлять державну таємницю, або втрата документів чи матеріалів, що містять такі відомості","332-1":"Порушення порядку в’їзду на тимчасово окуповану територію України та виїзду з неї","201-1":"Контрабанда лісоматеріалів та цінних порід дерев","201-3":"Контрабанда товарів","201-4":"Контрабанда підакцизних товарів","211":"Видання нормативно-правових актів, що зменшують надходження бюджету або збільшують витрати бюджету всупереч закону","220-2":"Фальсифікація фінансових документів та звітності фінансової організації","233":"Незаконна приватизація державного, комунального майна","204":"Незаконне виготовлення, зберігання, збут або транспортування з метою збуту підакцизних товарів","358":"Підроблення документів, печаток, штампів та бланків, збут чи використання підроблених документів, печаток, штампів","199":"Виготовлення, зберігання, придбання, перевезення, ввезення або збут підроблених грошей","200":"Незаконні дії з документами на переказ, платіжними картками та іншими засобами доступу до банківських рахунків","203-2":"Незаконна діяльність з організації або проведення азартних ігор, лотерей","206-2":"Протиправне заволодіння майном підприємства, установи, організації","210":"Нецільове використання бюджетних коштів","212":"Ухилення від сплати податків, зборів (обов’язкових платежів)","212-1":"Ухилення від сплати єдиного внеску","222":"Шахрайство з фінансовими ресурсами","229":"Незаконне використання знака для товарів і послуг, фірмового найменування","405":"Погроза або насильство щодо начальника","406":"Порушення статутних правил взаємовідносин між військовослужбовцями за відсутності відносин підлеглості","408":"Дезертирство","409":"Ухилення від військової служби шляхом самокалічення або іншим способом","410":"Викрадення, привласнення, вимагання військовослужбовцем зброї, бойових припасів, військової техніки або заволодіння ними","413":"Втрата військового майна","414":"Порушення правил поводження зі зброєю, речовинами і предметами, що становлять підвищену небезпеку для оточення","415":"Порушення правил водіння або експлуатації машин","425":"Недбале ставлення до військової служби","426-1":"Перевищення військовою службовою особою влади чи службових повноважень","190":"Шахрайство","191":"Привласнення, розтрата майна або заволодіння ним шляхом зловживання службовим становищем","209":"Легалізація майна, одержаного злочинним шляхом","364":"Зловживання владою або службовим становищем","366":"Службове підроблення","366-1":"Декларування недостовірної інформації","366-2":"Декларування недостовірної інформації","368":"Прийняття пропозиції, обіцянки або одержання неправомірної вигоди службовою особою","369":"Пропозиція, обіцянка або надання неправомірної вигоди службовій особі","369-2":"Зловживання впливом","109":"Насильницька зміна чи повалення конституційного ладу","110":"Посягання на територіальну цілісність України","111":"Державна зрада","111-1":"Колабораційна діяльність","111-2":"Пособництво державі-агресору","113":"Диверсія","114-1":"Перешкоджання діяльності ЗСУ","114-2":"Поширення інформації про переміщення ЗСУ","201":"Контрабанда","258":"Терористичний акт","258-3":"Терористична група чи організація","436":"Пропаганда війни","436-2":"Виправдовування збройної агресії РФ","438":"Порушення законів та звичаїв війни"};
const regsOf = g => (g&&g.reg?Object.keys(g.reg).filter(r=>r!=="*"&&r!=="не визначено").sort((a,b)=>a.localeCompare(b,"uk")):[]);
const REGS0 = regsOf(GS); const regs = () => { const r=regsOf(G); return r.length?r:REGS0; };
const vyr = n => n+" "+(n%10===1&&n%100!==11?"вирок":[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?"вироки":"вироків");
const rname = g => g==="*"?"Вся Україна":g;
const regSel = () => G===GV?'':'<div class="cmpsel"><div><label class="note" for="rsel">Область суду</label><select class="sel" id="rsel"><option value="*">Вся Україна</option>'+regs().map(g=>'<option'+(g===S.reg?' selected':'')+'>'+esc(g)+'</option>').join("")+'</select></div>'+
  '<div><label class="note" for="rsel2">Порівняти з</label><select class="sel" id="rsel2"><option value="">— не порівнювати —</option>'+["*",...regs()].filter(g=>g!==S.reg).map(g=>'<option value="'+esc(g)+'"'+(g===S.reg2?' selected':'')+'>'+esc(rname(g))+'</option>').join("")+'</select></div></div>'+
  (S.reg2?'<div class="legend"><span><i class="c3"></i>'+esc(rname(S.reg))+'</span><span><i class="cmpB"></i>'+esc(rname(S.reg2))+'</span></div>':'');
const pct = (n,t) => t?Math.round(n/t*100)+'%':'—';
const two = (a,b) => S.reg2?'<span class="v2"><b class="ca">'+a+'</b><b class="cb">'+b+'</b></span>':'<span class="v">'+a+'</span>';
const artCountG = (a,g) => g==="*"?G.arts[a].n:((G.arts[a].regions.find(x=>x[0]===g)||[0,0])[1]);
const artCount = a => artCountG(a,S.reg);
const vrowE = vi => { const x=G.V[vi], c=G.C[x[3]]; return '<a class="row" href="https://reyestr.court.gov.ua/Review/'+x[0]+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">'+esc(c[0])+'</span><div class="s">'+x[1]+' · справа № '+esc(x[2])+(x[4]&1?' · заочно':'')+'</div></span><span class="chev">↗</span></a>'; };
const PG = 10;
function pager(id,n){ const pages=Math.ceil(n/PG); if(pages<2) return ''; const cur=Math.min(S.pg[id]||0,pages-1);
  const b=(k,t,lab)=>'<button data-a="pg" data-v="'+esc(id)+'|'+k+'"'+(k===cur&&!t?' aria-current="page"':'')+(lab?' aria-label="'+lab+'"':'')+'>'+(t||(k+1))+'</button>';
  if(pages<=9) return '<div class="pager" role="navigation" aria-label="Сторінки">'+Array.from({length:pages},(_,k)=>b(k)).join("")+'</div>';
  // 7 сторінок навколо поточної; «…» веде до наступної сторінки за вікном (або попередньої перед ним); перша й остання — завжди
  const st=Math.max(0,Math.min(cur-3,pages-8)), en=Math.min(pages-2,st+6); let h='';
  if(st>0) h+=b(0)+(st>1?b(st-1,'…','Попередні сторінки'):'');
  for(let k=st;k<=en;k++) h+=b(k);
  if(en<pages-2) h+=b(en+1,'…','Наступні сторінки');
  h+=b(pages-1);
  return '<div class="pager" role="navigation" aria-label="Сторінки">'+h+'</div>'; }
function listBlock(id,idx,fn){ const cur=Math.min(S.pg[id]||0,Math.max(0,Math.ceil(idx.length/PG)-1)); return idx.slice(cur*PG,cur*PG+PG).map(fn||vrowE).join("")+pager(id,idx.length); }
const AP_L=["Вирок залишено без змін","Змінено покарання","Змінено в іншій частині","Скасовано, призначено новий розгляд","Скасовано, провадження закрито","Апеляційний суд ухвалив новий вирок","Скасовано (інший результат)","Апеляцію не розглянуто по суті","На апеляційному розгляді"];
const vrowAp = vi => { const x=G.V[vi], a=(G.ap||{})[vi], c=G.C[x[3]]; return '<a class="row" href="https://reyestr.court.gov.ua/Review/'+a[1]+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">'+esc(AP_L[a[0]])+'</span><div class="s">Вирок '+x[1]+' · '+esc(c[0])+' · справа № '+esc(x[2])+'</div></span><span class="chev">↗</span></a>'; };
const inReg = (vi,g) => g==="*"||G.C[G.V[vi][3]][1]===g;
function partRows(p,g){ return p.r.filter(x=>inReg(x[0],g)); }
// Повнота даних: скільки вироків знайдено і чому це не вся практика (згортається)
// Вироки, що є в реєстрі, але їхній текст закрито (G.hid з експорту): у розбір не потрапили
function hidNote(g){ const h=g&&g.hid; if(!h||!h.n) return "";
  return 'Ще '+h.n+' '+(h.n%10===1&&h.n%100!==11?'вирок':h.n%10>=2&&h.n%10<=4&&(h.n%100<12||h.n%100>14)?'вироки':'вироків')+' є в реєстрі, але їхній текст закрито (не оприлюднено), тому тут їх не враховано'+(h.tot?' — '+(h.n/h.tot*100).toFixed(h.n/h.tot<0.1?1:0).replace('.',',')+'% від усіх '+h.tot+' вироків за цими статтями в реєстрі':'')+(h.ap?' (з них апеляційних — '+h.ap+')':'')+'. За роками: '+h.years.map(y=>y[0]+' — '+y[1]).join(", ")+'. Пораховано за метаданими відкритих даних ДСА; документи, повністю вилучені з реєстру, там не видно, тож закритих може бути більше.'; }
function complNote(){
  const id="compl|"+(G===GS?"sbu":G===GSP?"sbupre":G===GB?"beb":G===GD?"dbr":G===GN?"npu":"x"), open=S.sv===id;
  const closed=Object.values(G.arts||{}).reduce((n,a)=>n+(a.closed||0),0);
  return '<div class="group" style="margin-bottom:6px"><button class="row" data-a="sv" data-v="'+id+'"><span class="main"><span class="t" style="font-size:15px">Повнота даних</span><div class="s">Опублікована практика: '+vyr(G.verdicts)+' до '+esc(G.cut)+'</div></span><span class="badge b-mute">не вся практика</span><span class="chev">'+(open?'⌄':'›')+'</span></button>'+
   (open?'<div class="pad" style="padding-top:0;font-size:14px;line-height:1.5;color:#E6EAE6">Тут лише вироки з відкритих даних ДСА. Частину рішень у ЄДРСР закрито за постановами органів розслідування або внесено із запізненням, тому реальних вироків більше, ніж показано.'+
    (G===GS?' Для справ за підслідністю СБУ після 24.02.2022 це відчутніше: доступ до вироків у справах про колабораційну діяльність і державну зраду обмежували масово, тож за ст. 111, 111-1, 111-2 вибірка може бути неповною.':'')+
    (G===GN?' Для поліції взято вибірку, а не всі вироки: за кожною з 60 найчастіших категорій — до 100 останніх вироків першої інстанції і ще до 100 за липень 2024 – червень 2025 (щоб був видний результат апеляції), а також усі апеляційні вироки.'+(G.interim?' Це проміжні дані: завантаження вироків поліції триває, числа ще зміняться.':''):'')+
    (G===GD?' За ст. 402 і 407 КК (непокора, СЗЧ) вироків тисячі, тому взято вибірку: 100 останніх вироків першої інстанції за кожною з цих статей.':'')+
    (G.hid?' '+hidNote(G):'')+
    (closed?' У '+closed+' знайдених вироках текст закрито: відомий лише результат.':'')+
    ' Числа показують, як суди вирішували опубліковані справи, а не частку всіх справ.</div>':'')+'</div>';
}
const srcNote = () => '<p class="note">Джерело: '+esc(G.source)+'. Вироки з '+G.from+' до '+G.cut+', '+vyr(G.verdicts)+' без повторних публікацій. Розбір автоматичний, за резолютивною частиною: перед цитуванням звіряйте з текстом. Дані не є рекомендацією щодо міри покарання.</p>';
function vSentHome(){
  const arts=Object.keys(G.arts).sort((a,b)=>artCount(b)-artCount(a));
  return header("Практика покарань")+'<div class="wrap">'+(S.inst==="all"?segVaks("sbu"):'')+perSel()+regSel()+complNote()+
   '<div class="sh">Вироки за підслідністю СБУ · '+esc(rname(S.reg))+' <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+
   arts.map(a=>{const n=artCount(a);const n2=S.reg2?artCountG(a,S.reg2):0;return (n||n2)?'<button class="row" data-a="sa" data-v="'+a+'"><span class="main"><span class="t">Ст. '+a+' КК</span>'+(ARTF[a]?'<div class="s">'+esc(ARTF[a])+'</div>':'')+'</span>'+two(n,n2)+'<span class="chev">›</span></button>':''}).join("")+'</div>'+
   (S.per==="pre"&&G===GSP?apSum("sap","виправдувальні вироки і вироки з реальним позбавленням волі (без ст. 75 КК), ухвалені до 24.02.2022")+'<div class="sh">Касація</div><div class="group"><button class="row" data-a="kas" data-v="sbupre"><span class="main"><span class="t" style="font-size:15px">Постанови ККС у справах СБУ до 24.02.2022: де рішення скасовано або змінено</span></span><span class="chev">›</span></button></div>':'')+srcNote()+
   k111List()+'</div>';
}
function vPilot111(r){ kSet(r); return header(K!==KS?"Ст. 111 · "+K.name:"Пілот: ст. 111, Сумщина",true)+'<div class="wrap">'+sentHome111()+'</div>'; }
function partHead(p,g){ const rr=partRows(p,g), c=p.labels.map(()=>0); rr.forEach(x=>c[x[1]]++); const top=p.labels.map((l,k)=>[l,c[k]]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).slice(0,2); return {t:rr.length,top}; }
function vSentArt(a){
  const A=G.arts[a], g=S.reg, parts=Object.keys(A.parts);
  let h=header("Ст. "+a+" КК",true)+'<div class="wrap">'+regSel()+(ARTF[a]?'<p class="note" style="margin-top:0">'+esc(ARTF[a])+'</p>':'');
  h+='<div class="sh">Обвинувальні вироки першої інстанції · '+esc(rname(g))+'</div><div class="group">'+(parts.map(k=>{const p=A.parts[k],{t,top}=partHead(p,g);
     const t2=S.reg2?partHead(p,S.reg2).t:0;return (t||t2)?'<button class="row" data-a="sp" data-v="'+a+'|'+k+'"><span class="main"><span class="t">'+(k==="без частини"?"Частину не визначено":k)+'</span>'+((PARTS[a]||{})[k]?'<div class="s">'+esc(PARTS[a][k])+'</div>':'')+'<div class="s">'+top.map(x=>esc(x[0])+' — '+x[1]).join(", ")+'</div></span>'+two(t,t2)+'<span class="chev">›</span></button>':''}).join("")||'<div class="pad note">Для цієї області вироків немає.</div>')+'</div>';
  h+=apArt(A,g);
  if(g==="*") h+='<div class="sh">Усі вироки за статтею · Україна</div><div class="group">'+[["Усього вироків",A.n],["Виправдувальні",A.acq],["Частково виправдувальні",A.part],["Апеляційні вироки",A.appeal],["Текст закрито",A.closed]].map(r=>'<div class="row"><span class="main t" style="font-size:15px">'+r[0]+'</span><span class="v">'+r[1]+'</span></div>').join("")+'</div>'+
    (G===GV?'':'<div class="sh">За областями</div><div class="group">'+A.regions.slice(0,12).map(r=>'<div class="row"><span class="main t" style="font-size:15px">'+esc(r[0])+'</span><span class="v">'+r[1]+'</span></div>').join("")+'</div>');
  return h+srcNote()+'</div>';
}
// Апеляція за статтею в області: скільки вироків залишено без змін, змінено, скасовано (серед тих, де результат відомий)
const AP_G=[["Залишено без змін",[0],"c1"],["Змінено",[1,2,5],"c5"],["Скасовано",[3,4,6],"c4"]];
function apArt(A,g){
  const AP=G.ap||{}; if(!Object.keys(AP).length) return '';
  const rows=gg=>Object.values(A.parts).flatMap(p=>partRows(p,gg)).map(x=>x[0]);
  const stat=gg=>{ const ids=[...new Set(rows(gg))], known=ids.filter(i=>AP[i]&&AP[i][0]<=6), pend=ids.filter(i=>AP[i]&&AP[i][0]===8).length;
    return {ids,known,pend,by:AP_G.map(([,cs])=>known.filter(i=>cs.includes(AP[i][0])))}; };
  const g2=S.reg2, a=stat(g), b=g2?stat(g2):null;
  if(!a.known.length&&!(b&&b.known.length)) return '';
  const id0="apa|"+g+"|";
  // частку показуємо лише від 10 відомих результатів: на 1–9 рішеннях відсотки вводять в оману
  const MIN=10, pc=(n,t)=>t>=MIN?' · '+pct(n,t):'', w=(n,t)=>t>=MIN?n/t*100:0;
  const line=(k)=>{ const [l,,c]=AP_G[k], ix=a.by[k], id=id0+k, open=S.sv===id;
    const v=b?'<span class="v2"><b class="ca">'+ix.length+pc(ix.length,a.known.length)+'</b><b class="cb">'+b.by[k].length+pc(b.by[k].length,b.known.length)+'</b></span>':'<span class="v">'+ix.length+pc(ix.length,a.known.length)+'</span>';
    return '<button class="row" data-a="sv" data-v="'+esc(id)+'"'+(ix.length?'':' disabled')+'><span class="main"><span class="t" style="font-size:15px">'+l+'</span><div class="stack mini" style="margin-top:7px"><i class="'+c+'" style="width:'+w(ix.length,a.known.length)+'%"></i></div>'+(b?'<div class="stack mini" style="margin-top:4px"><i class="cmpB" style="width:'+w(b.by[k].length,b.known.length)+'%"></i></div>':'')+'</span>'+v+'<span class="chev">'+(ix.length?(open?'⌄':'›'):'')+'</span></button>'+(open?listBlock(id,ix,vrowAp):''); };
  return '<div class="sh">Апеляція за статтею · '+esc(rname(g))+(b?' · '+esc(rname(g2)):'')+' <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+AP_G.map((_,k)=>line(k)).join("")+
   '<div class="row"><span class="main t" style="font-size:15px;color:var(--hint)">Результат відомий</span><span class="v">'+a.known.length+' із '+a.ids.length+(b?' · '+b.known.length+' із '+b.ids.length:'')+'</span></div>'+
   ((a.pend||(b&&b.pend))?'<div class="row"><span class="main t" style="font-size:15px;color:var(--hint)">Ще на апеляційному розгляді</span><span class="v">'+a.pend+(b?' · '+b.pend:'')+'</span></div>':'')+'</div>'+
   ((a.known.length<MIN||(b&&b.known.length<MIN))?'<p class="note" style="margin-top:6px">Якщо відомо менше ніж '+MIN+' результатів, частку не показано: на кількох рішеннях вона випадкова.</p>':'')+'<p class="note">Частки — серед обвинувальних вироків першої інстанції, для яких у відкритих даних знайдено апеляційне рішення по суті. Апеляційні рішення шукали не для всіх вироків, а насамперед для виправдувальних і з реальним позбавленням волі, тому це не частка всіх оскаржених вироків області. «Змінено» — змінено покарання чи іншу частину або ухвалено новий вирок; «Скасовано» — скасовано з новим розглядом, закриттям провадження чи з іншим результатом. Порівняння областей не є оцінкою судів чи суддів.</p>';
}
/* ===== Схожі вироки: підбір за ознаками з резолютивної частини ===== */
const SIMF=[["ug",4,"Угода","Без угоди"],["za",1,"Заочно","Не заочно"],["s69",8,"Ст. 69","Без ст. 69"],["s75",2,"Ст. 75","Без ст. 75"],["kf",0,"Конфіскація","Без конфіскації"]];
const simHas = (x,k,b) => k==="kf"?!!x[2]:!!(G.V[x[0]][4]&b);
function simMatch(x){ const sm=S.sim||{};
  for(const [k,b] of SIMF){ const w=sm[k]||0; if(w===1&&!simHas(x,k,b)) return false; if(w===2&&simHas(x,k,b)) return false; }
  return !S.simFresh || +G.V[x[0]][1].slice(-4)>=2025; }
const yrs = l => { const m=/^(\d+(?:,\d+)?)\s*р\.$/.exec(l||""); return m?+m[1].replace(",","."):null; };
const qv = (a,q) => { if(!a.length) return null; const i=(a.length-1)*q, lo=Math.floor(i), hi=Math.ceil(i); return a[lo]+(a[hi]-a[lo])*(i-lo); };
const fy = x => (Math.round(x*10)/10).toString().replace(".",",")+" р.";
function vSimilar(v){
  const [a,k]=v.split("|"), p=G.arts[a].parts[k], g=S.reg, all=partRows(p,g);
  const m=all.filter(simMatch).sort((x,y)=>G.V[y[0]][1].split(".").reverse().join("").localeCompare(G.V[x[0]][1].split(".").reverse().join("")));
  const lab=new Map(m.map(x=>[x[0],p.labels[x[1]]])), s75=x=>simHas(x,"s75",2);
  const ys=m.map(x=>yrs(p.labels[x[1]])).filter(y=>y!==null).sort((x,y)=>x-y);
  const real=m.filter(x=>!s75(x)).map(x=>yrs(p.labels[x[1]])).filter(y=>y!==null).sort((x,y)=>x-y);
  const other={}; m.forEach(x=>{ const l=p.labels[x[1]]; if(yrs(l)===null) other[l]=(other[l]||0)+1; });
  const chips=SIMF.map(([key,,on,off])=>{ const w=(S.sim||{})[key]||0; return '<button class="chip" data-a="simf" data-v="'+key+'"'+(w?' aria-pressed="true"':'')+'>'+(w===1?on+' ✓':w===2?off:on)+'</button>'; }).join("")+
    '<button class="chip" data-a="simfresh"'+(S.simFresh?' aria-pressed="true"':'')+'>З 2025 року</button>';
  const rsel='<label class="note" for="rsel">Область суду</label><select class="sel" id="rsel"><option value="*">Вся Україна</option>'+regs().map(r=>'<option'+(r===g?' selected':'')+'>'+esc(r)+'</option>').join("")+'</select>';
  let h=header("Схожі вироки",true)+'<div class="wrap"><p class="note" style="margin-top:0"><b>'+esc((k==="без частини"?"":k+" ")+"ст. "+a+" КК")+'</b> · обвинувальні вироки першої інстанції. Позначте, що відомо про вашу справу: натисніть ознаку раз — «так», удруге — «ні», утретє — «не важливо».</p>'+rsel+'<div class="chips" style="flex-wrap:wrap">'+chips+'</div>';
  h+='<div class="sh">Схожих вироків: '+m.length+' із '+all.length+' · '+esc(rname(g))+'</div>';
  if(!m.length){ h+='<div class="alert a-info"><b>Таких вироків немає</b>Зніміть частину ознак або оберіть «Вся Україна».</div>'; return h+'</div>'; }
  const row=(t,val)=>'<div class="row"><span class="main t" style="font-size:15px">'+t+'</span><span class="v">'+val+'</span></div>';
  h+='<div class="group">'+
    (ys.length?row("Призначений строк позбавлення волі, медіана",fy(qv(ys,.5))+" <span style=\"color:var(--hint);font-weight:500\">("+ys.length+")</span>")+row("Половина вироків — у межах",fy(qv(ys,.25))+" – "+fy(qv(ys,.75)))+row("Найменший і найбільший",fy(ys[0])+" – "+fy(ys[ys.length-1])):'')+
    (real.length&&real.length!==ys.length?row("Реальне позбавлення волі (без ст. 75), медіана",fy(qv(real,.5))+" <span style=\"color:var(--hint);font-weight:500\">("+real.length+")</span>"):'')+
    row("Звільнено з випробуванням (ст. 75)",m.filter(s75).length+" із "+m.length)+
    Object.entries(other).sort((x,y)=>y[1]-x[1]).map(([l,n])=>row(esc(l[0].toUpperCase()+l.slice(1)),n)).join("")+'</div>';
  if(ys.length&&ys.length<10) h+='<p class="note" style="margin-top:6px">Схожих вироків зі строком менше 10 — медіана й межі тут випадкові, дивіться самі вироки.</p>';
  h+='<div class="sh">Найновіші схожі вироки</div><div class="group">'+listBlock("sim|"+v+"|"+g,m.map(x=>x[0]),vi=>{ const x=G.V[vi], c=G.C[x[3]], f=x[4], tags=[lab.get(vi),f&2?"ст. 75":"",f&4?"угода":"",f&8?"ст. 69":"",f&1?"заочно":""].filter(Boolean).join(" · ");
      return '<a class="row" href="https://reyestr.court.gov.ua/Review/'+x[0]+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">'+esc(tags)+'</span><div class="s">'+x[1]+' · '+esc(c[0])+' · справа № '+esc(x[2])+'</div></span><span class="chev">↗</span></a>'; })+'</div>';
  h+='<p class="note">Схожість — лише за ознаками з резолютивної частини: частина статті, область, угода, заочний розгляд, ст. 69, ст. 75, конфіскація. Обставин справи, особи обвинуваченого, пом’якшувальних і обтяжувальних обставин тут не враховано, тож це орієнтир, а не прогноз покарання. Строк — призначений за цю частину статті; за ст. 75 його не відбувають реально. Порівняння не є оцінкою судів чи суддів.</p>';
  return h+srcNote()+'</div>';
}
function vSentPart(v){
  const [a,k]=v.split("|"), p=G.arts[a].parts[k], g=S.reg, g2=S.reg2, s=SENT[v], rr=partRows(p,g), t=rr.length, rr2=g2?partRows(p,g2):[], t2=rr2.length;
  const fl=(rows,b)=>rows.filter(x=>G.V[x[0]][4]&b).map(x=>x[0]), kf=rows=>rows.filter(x=>x[2]).map(x=>x[0]);
  // рядок: idx — вироки обраної області (відкриваються), n2 — кількість у другій області
  const row=(id,label,idx,bar,n2)=>{const open=S.sv===id, cmp=g2!=='';
    const vals=cmp?'<span class="v2"><b class="ca">'+idx.length+(bar===undefined?'':' · '+pct(idx.length,t))+'</b><b class="cb">'+n2+(bar===undefined?'':' · '+pct(n2,t2))+'</b></span>':'<span class="v">'+idx.length+(bar===undefined?' із '+t:'')+'</span>';
    const bars=bar===undefined?(cmp?'<div class="s">'+pct(idx.length,t)+' · '+pct(n2,t2)+'</div>':''):'<div class="stack mini" style="margin-top:7px"><i class="c3" style="width:'+(t?idx.length/t*100:0)+'%"></i></div>'+(cmp?'<div class="stack mini" style="margin-top:4px"><i class="cmpB" style="width:'+(t2?n2/t2*100:0)+'%"></i></div>':'');
    return '<button class="row" data-a="sv" data-v="'+esc(id)+'"'+(idx.length?'':' disabled')+'><span class="main"><span class="t"'+(bar===undefined?' style="font-size:15px"':'')+'>'+esc(label)+'</span>'+bars+'</span>'+vals+'<span class="chev">'+(idx.length?(open?'⌄':'›'):'')+'</span></button>'+(open?listBlock(id,idx,id.includes('|ap')?vrowAp:vrowE):'')};
  let h=header((k==="без частини"?"":k+" ")+"ст. "+a+" КК",true)+'<div class="wrap'+(g2?' cmp':'')+'">'+regSel();
  if(s&&s.sanction) h+='<div class="sh">Санкція</div><div class="group"><div class="pad body">'+esc(s.sanction)+'</div></div>';
  const head=g2?esc(rname(g))+' — '+vyr(t)+' · '+esc(rname(g2))+' — '+vyr(t2):esc(rname(g))+' · '+vyr(t);
  h+='<div class="sh">Призначено · '+head+'</div><div class="group">'+((t||t2)?p.labels.map((l,i)=>{const idx=rr.filter(x=>x[1]===i).map(x=>x[0]), n2=rr2.filter(x=>x[1]===i).length;return (idx.length||n2)?row(v+"|v"+i,l,idx,1,n2):''}).join(""):'<div class="pad note">Вироків немає.</div>')+'</div>';
  if(t) h+='<div class="group"><button class="row" data-a="sim" data-v="'+esc(v)+'"><span class="main"><span class="t">Підібрати схожі вироки</span><div class="s">Позначте ознаки своєї справи — область, угода, заочний розгляд, ст. 69, ст. 75, конфіскація</div></span><span class="chev">›</span></button></div>';
  if(g2) h+='<p class="note" style="margin-top:6px">Смуги й відсотки — частка вироків кожної області. Відкривається перелік вироків першої області; щоб побачити вироки другої, оберіть її першою.</p>';
  if(s&&s.hint) h+='<div class="alert a-info"><b>Зверніть увагу</b>'+esc(s.hint)+'</div>';
  if(a==="111"&&k==="ч. 2") h+=KS.alerts.map(x=>'<div class="alert a-warn"><b>'+esc(x.title)+'</b>'+esc(x.text)+'</div>').join("");
  if(t||t2){
    h+='<div class="sh">Як розглядали</div><div class="group">'+row(v+"|z","Заочно (спеціальне судове провадження)",fl(rr,1),undefined,fl(rr2,1).length)+'</div>'+
     '<div class="sh">Інші наслідки</div><div class="group">'+row(v+"|s75","Звільнено з випробуванням (ст. 75)",fl(rr,2),undefined,fl(rr2,2).length)+row(v+"|ug","Угода про визнання винуватості",fl(rr,4),undefined,fl(rr2,4).length)+row(v+"|s69","Нижче нижньої межі (ст. 69)",fl(rr,8),undefined,fl(rr2,8).length)+row(v+"|kf","Конфіскація майна за цією частиною",kf(rr),undefined,kf(rr2).length)+'</div>';
    const AP=G.ap||{}; if(Object.keys(AP).length){ const apx=(rows,c)=>rows.filter(x=>AP[x[0]]&&AP[x[0]][0]===c).map(x=>x[0]), none=rows=>rows.filter(x=>!AP[x[0]]).length;
    h+='<div class="sh">Апеляція <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+AP_L.map((l,c)=>{const ix=apx(rr,c),n2=apx(rr2,c).length;return (ix.length||n2)?row(v+"|ap"+c,l,ix,undefined,n2):''}).join("")+
     '<div class="row"><span class="main t" style="font-size:15px;color:var(--hint)">Апеляційного рішення у відкритих даних немає</span><span class="v">'+none(rr)+(g2?' · '+none(rr2):'')+'</span></div></div>'+
     '<p class="note">Результат апеляції визначено автоматично за резолютивною частиною: береться перше апеляційне рішення по суті в цій справі після дати вироку. «Рішення немає» не означає, що вирок не оскаржували: частину рішень не опубліковано, а в деяких справах остання апеляційна ухвала стосується іншого питання. Натисніть на рядок, щоб відкрити рішення апеляційного суду.</p>'; } }
  h+='<p class="note">Вироки в кожному переліку — від найновіших, по '+PG+' на сторінці. Один вирок — одне значення, навіть якщо обвинувачених кілька. За сукупності показано покарання саме за цю частину. «Строк не розпізнано» — автоматичний розбір не знайшов строку, варто відкрити вирок. Заочні вироки не відображають реально відбуте покарання. Порівняння областей не є оцінкою судів чи суддів.</p>';
  return h+srcNote()+'</div>';
}
function vRegions(){
  const g=S.reg, R=G.reg[g]||{n:0,withvs:0,top:[]};
  const fd2=d=>d?d.split("-").reverse().join("."):"";
  const g2=S.reg2, R2=g2?(G.reg[g2]||{n:0,withvs:0,top:[]}):null;
  const cnt=(c,gg)=>((G.cit||{})[c]||[]).filter(vi=>inReg(vi,gg)).length;
  let top=R.top; if(R2){ const m=new Map(R.top.map(x=>[x[0],x[1]])); R2.top.forEach(([c])=>{ if(!m.has(c)) m.set(c,cnt(c,g)); }); top=[...m.entries()].sort((x,y)=>(y[1]-x[1])||(cnt(y[0],g2)-cnt(x[0],g2))); }
  const rows=top.map(([c,n])=>{
    const x=(D.xc||{})[c], ps=caseIdx.get(nc(c))||caseIdx.get(nc(c).replace(/-к$/,''))||caseIdx.get(nc(c)+'-к')||(x?POS.filter(p=>p.i===x[0]):[]), vs=(G.vs||{})[c], id="rg|"+c, open=S.sv===id, tp=((G.wk||{})[c]||[]).map(k=>TOP.find(t=>t.slug===k||t.s===k)).filter(Boolean); const vx0=vxOf(c), vx=vx0&&vx0.q?vx0:null;
    const sub='Справа № '+esc(c)+(vs?' · '+esc(vs.court)+', '+fd2(vs.date):'');
    let h='<button class="row" data-a="sv" data-v="'+esc(id)+'"><span class="main"><span class="t" style="font-size:15px">'+(vx?esc(cut(vx.q,150)):ps.length?esc(ps[0].h||ps[0].t):sub)+'</span><div class="s">'+(ps.length?sub+' · позицій у базі: '+ps.length:vx?sub+' · '+(vx.k==='c'?'фрагмент постанови, позиції LPD немає':'переказ бази, позиції LPD немає'):(tp.length?'Згадано в темі «'+esc(tp[0].title||tp[0].t)+'»':vx0&&vx0.k==='u'?'Текст постанови є в базі; '+esc(vx0.r&&!/автоматично/.test(vx0.r)?vx0.r.replace(/^перевірено вручну: /,''):'висновок ще не опрацьовано'):vx0&&vx0.k==='m'?'Постанови з таким номером у відкритих даних ДСА не знайдено; номер у вироках може бути помилковим':'У базі LEX_K цієї постанови немає'))+'</div>'+(x&&x[1]?'<div class="s" style="color:var(--warn)">'+esc(x[1])+'</div>':'')+(depCase(c)?'<div class="s" style="color:var(--bad);font-weight:700">ВС відступив від висновку в цій справі (позиція № '+depCase(c).i+')</div>':'')+'</span>'+two(n,g2?cnt(c,g2):0)+'<span class="chev">'+(open?'⌄':'›')+'</span></button>';
    if(open){
      const cit=((G.cit||{})[c]||[]).filter(vi=>inReg(vi,g));
      h+='<div class="pad" style="display:flex;flex-wrap:wrap;gap:8px">'+(vs?'<a class="badge b-info" href="https://reyestr.court.gov.ua/Review/'+vs.id+'" target="_blank" rel="noopener">Текст постанови ('+esc(vs.court)+', '+fd2(vs.date)+') ↗</a>':'<span class="badge b-mute">Постанову у відкритих даних ДСА не знайдено</span>')+
         (ps.length?'<button class="badge b-ok" data-a="pos" data-v="'+ps[0].i+'">Позиція в базі ›</button>':'')+(depCase(c)?'<button class="badge b-bad" data-a="pos" data-v="'+depCase(c).i+'">Відступ: позиція № '+depCase(c).i+' ›</button>':'')+(!ps.length&&tp.length?'<button class="badge b-ok" data-a="topicgo" data-v="'+(tp[0].slug||tp[0].s)+'">Тема в базі ›</button>':'')+'</div>'+
         (vx?'<div class="pad" style="padding-top:0"><div class="sh" style="margin:0 0 4px">'+(vx.k==='c'?'Фрагмент постанови, який наводять вироки':vx.k==='t'?'Для чого цитують постанову суди (переказ бази)':'Що вирішив ВС (переказ бази за текстом постанови)')+'</div><blockquote class="vxq">'+esc(vx.q)+'</blockquote><p class="note" style="margin:4px 0 0">'+(ps.length?'Позиція LPD за цією постановою може стосуватися іншого питання, ніж те, заради якого її цитують вироки.':'Офіційної правової позиції ВС за цією постановою в базі LPD немає.')+' Перш ніж посилатися, прочитайте постанову повністю.</p></div>':'')+'<div class="pad note" style="padding-top:0">Вироки, що посилаються на цю справу · '+cit.length+'</div>'+listBlock(id,cit);
    }
    return h;}).join("");
  const ik=rinst(), iname=INSTN[ik]||"СБУ";
  return header("Практика за регіонами"+(ik!=="sbu"&&S.inst!=="all"?": "+(INST[ik]||[iname])[0]:""))+'<div class="wrap">'+(S.inst==="all"?segReg(ik):'')+perSel()+regSel()+complNote()+
   '<div class="sh">На які постанови ВС посилаються суди · '+esc(rname(g))+' <span class="badge b-ok">Дані ЄДРСР</span></div>'+
   '<p class="note" style="margin-top:0">Вироків за підслідністю '+iname+': '+R.n+'. Номер справи Верховного Суду розпізнано в '+R.withvs+' з них.'+(R2?' '+esc(rname(g2))+': '+R2.n+' вироків, номер справи ВС — у '+R2.withvs+'.':'')+' Натисніть на справу, щоб відкрити постанову ВС і вироки, які на неї посилаються.</p><div class="group">'+rows+'</div>'+
   '<p class="note">Число — у скількох вироках згадано цю справу. Згадка не означає, що суд застосував висновок: суд міг і відхилити постанову, на яку послалася сторона. Постанову ВС знайдено у відкритих даних ДСА за номером справи й датою, яку наводять вироки. Номер справи ВС розпізнано автоматично, тому частина посилань могла не потрапити. Порівняння областей не є оцінкою судів чи суддів.</p>'+(ik==="sbu"&&S.per!=="pre"?k111List():'')+srcNote()+'</div>';
}
function boxRow(g,sc,band){
  const pc=v=>Math.max(0,Math.min(100,(v-sc[0])/(sc[1]-sc[0])*100)), f=x=>String(x).replace(".",",");
  if(g.c<10||!g.d) return '<div class="bxrow"><div class="bxhead"><span>'+g.n+'</span><span class="num">'+g.c+' вироків</span></div><div class="bxsum">Замало випадків для статистики. <button data-a="toast" data-v="У повній версії тут відкривається перелік вироків із посиланнями на ЄДРСР" style="color:var(--link)">Показати перелік вироків</button></div></div>';
  const [mn,q1,md,q3,mx]=g.d;
  return '<div class="bxrow"><div class="bxhead"><span>'+g.n+'</span><span class="num">'+g.c+' вироків</span></div>'+
   '<div class="bx" role="img" aria-label="'+g.n+': медіана '+md+', від '+mn+' до '+mx+'"><div class="band" style="left:'+pc(band[0])+'%;width:'+(pc(band[1])-pc(band[0]))+'%"></div><div class="wh" style="left:'+pc(mn)+'%;width:'+(pc(mx)-pc(mn))+'%"></div><div class="box" style="left:'+pc(q1)+'%;width:'+(pc(q3)-pc(q1))+'%"></div><div class="med" style="left:'+pc(md)+'%"></div></div>'+
   '<div class="bxsum num">Медіана '+f(md)+' р. · половина вироків: '+f(q1)+'–'+f(q3)+' р. · розмах '+f(mn)+'–'+f(mx)+' р.</div></div>';
}
function vSent(v){
  const [a,k,r]=v.split("|"), s=SENT[v];
  if(a==="111"&&kSet(r).parts[k]) return vSent111(k);
  let h=header(k+" ст. "+a+" КК",true,true)+'<div class="wrap">';
  if(!s) return h+'<p class="note">Для цієї частини макет не заповнено. У повній версії тут ті самі блоки: санкція, фактичні межі за формою провадження, додаткові покарання, зміни в апеляції.</p></div>';
  const pc=x=>(x-s.scale[0])/(s.scale[1]-s.scale[0])*100, ticks=[...new Set([s.scale[0],s.band[0],s.band[1],s.scale[1]])];
  h+='<div class="sh">Санкція</div><div class="group"><div class="pad body">'+s.sanction+'</div></div>'+
   (s.hint?'<div class="alert a-warn"><b>Зверніть увагу</b>'+s.hint+'</div>':'')+
   '<div class="sh">Фактичні межі · '+s.measure.toLowerCase()+'</div><div class="group">'+s.groups.map(g=>boxRow(g,s.scale,s.band)).join("")+
   '<div class="axis">'+ticks.map(t=>'<span style="left:'+pc(t)+'%">'+t+'</span>').join("")+'</div><div style="height:8px"></div></div>'+
   '<p class="note">Блакитна зона — межі санкції. Прямокутник — середня половина вироків, риска — медіана, лінія — від мінімуму до максимуму.</p>';
  if(s.rows.length) h+='<div class="sh">Інші наслідки</div><div class="group">'+s.rows.map(r=>'<div class="row"><span class="main t" style="font-size:15px">'+r[0]+'</span><span class="v">'+r[1]+'</span></div>').join("")+'</div>';
  h+='<div class="sh">Повнота даних</div><div class="group"><div class="pad" style="font-size:14px;line-height:1.45">'+(OFFICIAL[a]?OFFICIAL[a].txt+' '+OFFICIAL[a].base:'')+' Частина вироків у ЄДРСР недоступна.</div></div>'+
   '<p class="note">Заочні вироки не відображають реально відбуте покарання. За сукупності враховано покарання саме за цю частину статті. Дані не є рекомендацією щодо міри покарання.</p></div>';
  return h;
}
function vPreHome(){
  return header("Досудове розслідування")+'<div class="wrap"><p class="note" style="margin-top:0">Типові питання досудового розслідування у провадженнях СБУ: що вирішив Верховний Суд і чого не вирішував.</p>'+
   '<div class="group">'+PRE.map(q=>'<button class="row" data-a="pre" data-v="'+q.id+'"><span class="main"><span class="t" style="font-size:15px">'+esc(q.t)+'</span><div class="s">'+esc(q.n)+' · позицій ВС: '+q.p.length+'</div>'+(q.g?'<div class="s"><span class="badge b-warn">Є питання без позиції ВС</span></div>':'')+'</span><span class="chev">›</span></button>').join("")+'</div>'+
   '<p class="note">Ухвали слідчих суддів після апеляції в касації здебільшого не переглядаються, тому з частини питань Верховний Суд не висловлюється. До питань додано практику судів у вироках СБУ, а там, де ВС не висловлювався, — ключові ухвали апеляційних судів.</p></div>';
}
function vPre(id){
  const q=PRE.find(x=>x.id===id); if(!q) return vPreHome();
  const ps=q.p.map(i=>P(i)).filter(Boolean);
  return header(q.n,true)+'<div class="wrap"><div class="group"><div class="pad"><p class="thesis">'+esc(q.t)+'</p></div></div>'+
   '<div class="sh">Що вирішив Верховний Суд · '+ps.length+'</div><div class="group">'+ps.map(posRow).join("")+'</div>'+
   (q.pr?'<div class="sh">Як суди вирішують у вироках СБУ <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group"><div class="pad" style="font-size:14px;line-height:1.45">'+esc(q.pr)+'</div>'+(q.v||[]).map(x=>'<a class="row" href="https://reyestr.court.gov.ua/Review/'+x[2]+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:15px">'+esc(x[0])+'</span><div class="s">'+esc(x[1].replace(/^вирок у справі /,'Справа '))+'</div></span><span class="chev">↗</span></a>').join("")+'</div>':'')+
   (q.g?'<div class="sh">Чого ВС не вирішував</div><div class="alert a-warn" style="margin:0 0 8px">'+esc(q.g)+'</div>':'')+
   ((q.ap&&q.ap.length)?'<div class="sh">Ключові ухвали апеляційних судів</div><div class="group">'+q.ap.map(x=>'<a class="row" href="https://reyestr.court.gov.ua/Review/'+x[3]+'" target="_blank" rel="noopener"><span class="main"><span class="t" style="font-size:14px;line-height:1.45">'+esc(x[4])+'</span><div class="s">'+esc(x[0])+' · справа '+esc(x[1])+' · '+fd(x[2])+'</div></span><span class="chev">↗</span></a>').join("")+'</div>':'')+
   (q.an?'<div class="sh">Апеляційна практика</div><div class="group"><div class="pad" style="font-size:14px;line-height:1.45">'+esc(q.an)+'</div></div>':'')+
   '<p class="note">Позиції показано тезою бази LEX_K, а якщо тези немає — офіційним заголовком бази правових позицій ВС; офіційний текст — у картці позиції. Вироки знайдено автоматично, ключові переглянуто вручну. «Чого ВС не вирішував» — висновок бази LEX_K за пошуком у вивантаженні; нова позиція могла з’явитися пізніше.</p></div>';
}

/* ===== Стежу, перевірка, про дані ===== */
// Сповіщення надсилає бот: кнопка відкриває його з готовою підпискою (/start <параметр>)
const BOT_LINK = "https://t.me/lexa_praktyka_bot";
const tgRow = (param,title,sub) => '<button class="row" data-a="tglink" data-v="'+esc(param)+'"><span class="main"><span class="t" style="font-size:15px">'+title+'</span>'+(sub?'<div class="s">'+sub+'</div>':'')+'</span><span class="chev">↗</span></button>';
function sw(key,on){ return '<button class="sw" role="switch" aria-checked="'+!!on+'" data-a="sub" data-v="'+key+'" aria-label="Перемкнути"></button>'; }
function vMore(){
  const fl=Object.keys(S.follow).filter(k=>S.follow[k]&&P(k));
  return header("Стежу та інструменти")+'<div class="wrap">'+instBlock()+'<div class="sh">Мої підписки</div><div class="group">'+
   (fl.length?fl.map(k=>posRow(P(k))).join(""):'<div class="pad" style="font-size:14px;color:var(--hint)">Ви ще не зберегли жодної позиції. Відкрийте позицію й натисніть «Стежити», щоб мати її тут; сповіщення про її зміну — кнопкою «Сповіщення в Telegram» на картці.</div>')+'</div>'+
   '<div class="sh">Сповіщення в Telegram</div><div class="group">'+tgRow("vidstup","Нові відступи від позицій ВС","Бот повідомить, щойно в базі з’явиться позиція з відступом або позначка про зміну")+tgRow("subs","Мої запити в боті","Перелік і скасування сповіщень")+'</div>'+
   '<p class="note">Бот @lexa_praktyka_bot раз на день перевіряє оновлення бази й надсилає нові позиції ВС за вашими запитами. Стежити можна за будь-яким пошуком у боті (кнопка «Стежити за запитом») або за окремою позицією — кнопкою на її картці.</p>'+
   '<div class="sh">Інструменти</div><div class="group"><button class="row" data-a="go" data-v="check"><span class="main"><span class="t">Перевірка посилань у документі</span><div class="s">Звіряє номери справ із базою та знаходить відступи</div></span><span class="chev">›</span></button></div>'+
   '<div class="sh">Довіра</div><div class="group"><button class="row" data-a="go" data-v="about"><span class="main"><span class="t">Про дані й методологію</span><div class="s">Зріз '+CUT+'</div></span><span class="chev">›</span></button></div></div>';
}
// Перелік усіх постанов і окремих думок ККС і ВП ВС у кримінальних справах (kks-index.txt поряд із застосунком):
// підвантажується лише під час перевірки посилань. KKX: справа (нормалізована, без «-к») → [[дата РРРР-ММ-ДД, id, тип]]
let KKX=null, KKX_CUT="", KKX_ERR=false;
function loadKKX(){ if(KKX||KKX_ERR) return Promise.resolve(KKX);
  return fetch("kks-index.txt").then(r=>{ if(!r.ok) throw 0; return r.text(); }).then(t=>{ const m=new Map(), L=t.split("\n");
    const h=/по (\d{4}-\d{2}-\d{2})/.exec(L[0]); KKX_CUT=h?h[1]:"";
    for(const l of L){ if(!l||l[0]==="#") continue; const [c,d,id,ty]=l.split("|"), k=nc(c).replace(/-к$/,"");
      if(!m.has(k)) m.set(k,[]); m.get(k).push([d.slice(0,4)+"-"+d.slice(4,6)+"-"+d.slice(6,8),id,ty]); }
    KKX=m; return m; }).catch(()=>{ KKX_ERR=true; return null; }); }
const EDRSR="https://reyestr.court.gov.ua/Review/";
const KKT={K:"постанова ККС",V:"постанова Великої Палати",k:"окрема думка (ККС)",v:"окрема думка (ВП)"};
function vCheck(){
  let res="";
  if(S.check){ res='<div class="sh">Результат · номерів справ: '+S.check.length+'</div><div class="group">'+(S.check.length?S.check.map(c=>{
     let h="";
     if(c.over) h+='<button class="row" data-a="pos" data-v="'+c.over[0]+'"><span class="main"><span class="t">№ '+esc(c.no)+'</span><div class="s">Верховний Суд відступив від висновку в цій справі: позиція № '+c.over.join(", № ")+'</div></span><span class="badge b-bad">Відступ</span></button>';
     if(c.ps.length) h+='<button class="row" data-a="pos" data-v="'+c.ps[0].i+'"><span class="main"><span class="t">№ '+esc(c.no)+'</span><div class="s">'+court(c.ps[0])+' · '+fd(c.ps[0].d[0][1])+' · позицій у базі: '+c.ps.length+'</div></span>'+(mBadge(c.ps[0])||'<span class="badge b-ok">Є в базі</span>')+'</button>';
     (c.refs||[]).forEach(r=>{ h+='<button class="row" data-a="go" data-v="refs"><span class="main"><span class="t">№ '+esc(c.no)+'</span><div class="s">Питання передано на '+esc(r.to)+' (ухвала від '+fd(r.date)+'): '+esc(cut(r.issue,140))+'</div></span><span class="badge b-info">Передано до '+(r.to==="ВП ВС"?"ВП":"ОП")+'</span></button>'; });
     if(c.date&&c.dates&&c.dates.length&&!c.dates.includes(c.date)) h+='<div class="row"><span class="main"><span class="t">№ '+esc(c.no)+'</span><div class="s">У тексті дата '+fd(c.date)+', а в базі рішення в цій справі від '+c.dates.map(fd).join(", ")+'. Звірте реквізити.</div></span><span class="badge b-warn">Звірте дату</span></div>';
     if(c.kk&&c.kk.length){ const pst=c.kk.filter(x=>x[2]==="K"||x[2]==="V"), shown=(pst.length?pst:c.kk).slice(-3);
       const same=c.date?c.kk.some(x=>x[0]===c.date):null;
       h+='<a class="row" href="'+EDRSR+shown[shown.length-1][1]+'" target="_blank" rel="noopener"><span class="main"><span class="t">№ '+esc(c.no)+' · є в ЄДРСР</span><div class="s">'+
         shown.map(x=>KKT[x[2]]+" від "+fd(x[0])).join("; ")+(c.kk.length>shown.length?" (усього документів ККС/ВП у справі: "+c.kk.length+")":"")+
         (same===false?'. <b>Дати '+fd(c.date)+' серед них немає</b> — перевірте реквізити.':same?'. Дата збігається.':'')+'</div></span><span class="chev">↗</span></a>'; }
     else if(c.kk&&!c.ps.length&&!c.over) h+='<div class="row"><span class="main"><span class="t">№ '+esc(c.no)+' · <span style="color:var(--warn,#d98b2b)">не знайдено</span></span><div class="s">Постанов ККС чи Великої Палати в цій справі у відкритих даних ДСА за 2018 – '+fd(KKX_CUT)+' немає. Можливі причини: інший номер, рішення до 2018 р. або інша інстанція, текст закрито — або посилання вигадане (так буває з текстами від ШІ). Перевірте в ЄДРСР.</div></span></div>';
     if(!c.over&&!c.ps.length&&!c.kk) h+='<div class="row"><span class="main"><span class="t">№ '+esc(c.no)+'</span><div class="s">У базі такої справи немає. Це не означає, що постанови не існує: звірте реквізити в ЄДРСР.</div></span><span class="badge b-mute">Немає в базі</span></div>';
     return h; }).join(""):'<div class="pad" style="font-size:14px;color:var(--hint)">Номерів справ у тексті не знайдено.</div>')+'</div>'; }
  return header("Перевірка посилань",true)+'<div class="wrap"><p class="note" style="margin-top:0">Вставте фрагмент із посиланнями на постанови ВС. Застосунок звірить кожен номер справи й дату з базою та покаже відступи. Перевірка виконується на вашому пристрої, текст нікуди не надсилається. Не вставляйте матеріали проваджень. Те саме вміє бот: надішліть йому фрагмент або /check.</p>'+
   '<textarea class="ta" id="doc" aria-label="Текст для перевірки">'+esc(S.docText??D.s)+'</textarea><div class="btns"><button class="btn" data-a="runcheck">Перевірити</button></div>'+res+
   '<p class="note">'+(KKX?'Номери звірено з переліком усіх постанов і окремих думок ККС і Великої Палати ВС у кримінальних справах з 2018 р. ('+KKX.size+' справ, відкриті дані ДСА, по '+fd(KKX_CUT)+') і з позиціями бази.':KKX_ERR?'Перелік постанов ККС не завантажився, тому номери звірено лише з позиціями бази ('+caseIdx.size+' справ): «немає в базі» трапляється й для справжніх постанов.':'Номери звіряються з переліком усіх постанов ККС і Великої Палати з 2018 р. і з позиціями бази.')+' Чи містить постанова саме той висновок, застосунок не перевіряє.</p></div>';
}
function vAbout(){
  const rows=[["Позиції","Офіційні правові позиції ККС ВС і Великої Палати ВС у кримінальних справах: "+POS.length+" позицій, на які посилаються статті бази LEX_K."],["Тези","Короткий виклад позиції з бази LEX_K. Офіційний текст завжди показано поруч."],["Посилання","Кожна позиція веде на текст рішення в ЄДРСР."],["Відступи","Показано позначки бази правових позицій ВС: «з відступом» і «змінена»."],["Покарання і регіони","Вироки за підслідністю СБУ (ч. 2 ст. 216 КПК) з "+GS.from+": відкриті дані ДСА, ліцензія CC BY. Повторні публікації одного вироку відкинуто. Розбір резолютивної частини автоматичний, кожен вирок має посилання на ЄДРСР."],["Ст. 111 за округами","Вироки 2024–2026 рр. за апеляційними округами. Сумщину звірено вручну. Київ і Київська область, Одеська, Дніпропетровська, Харківська області — тексти з відкритих даних ДСА; звірені вручну округи позначено, решта — автоматичний розбір."],["Досудове","Питання досудового розслідування у справах СБУ з ключовими позиціями ВС; що ВС не вирішував — висновок бази LEX_K."],["Посилання у вироках","У картці позиції — вироки за підслідністю СБУ, у яких розпізнано номер справи, на якій стоїть позиція. Посилання не означає застосування висновку."],["Судді","Пошуку, фільтрів і статистики за суддями немає."],["Ваші запити","Пошук і перевірка працюють на пристрої, нічого не надсилається."]];
  return header("Про дані",true)+'<div class="wrap"><div class="group">'+rows.map(r=>'<div class="row"><span class="main"><span class="t">'+r[0]+'</span><div class="s" style="font-size:14px">'+r[1]+'</div></span></div>').join("")+'</div><p class="note">Зріз бази: '+CUT+'.</p></div>';
}

/* ===== Інституція і ВАКС (макет) ===== */
const INST={sbu:["СБУ","Злочини проти основ нацбезпеки, воєнні злочини, тероризм. Вироки за підслідністю СБУ з 2017 р. (відкриті дані ДСА)."],nabu:["НАБУ / САП","Корупційні злочини: практика ВАКС, Апеляційної палати ВАКС і ВС у справах ВАКС."],police:["Національна поліція","Загальнокримінальні злочини, які розслідують слідчі поліції (ч. 1 ст. 216 КПК)."],beb:["БЕБ","Економічні злочини за підслідністю Бюро економічної безпеки."],dbr:["ДБР","Злочини працівників правоохоронних органів, суддів та інших осіб, визначених ч. 4 ст. 216 КПК."],all:["Усі","Усі розділи; у «Покаранні» можна перемикатися між інституціями."]};
const SOON={police:{t:"Національна поліція",x:"Справи поліції — більшість кримінальних вироків у ЄДРСР, тому повна статистика за всіма вироками тут недоцільна. Пропонуємо разом обрати ключові склади й зібрати за ними те саме, що вже є для СБУ."},beb:{t:"БЕБ",x:"Економічні злочини за підслідністю БЕБ. Перелік статей звіримо з чинною редакцією ст. 216 КПК, а потім відберемо вироки у відкритих даних ЄДРСР за цими статтями."},dbr:{t:"ДБР",x:"Підслідність ДБР визначає суб’єкт (працівник правоохоронного органу, суддя тощо), а не лише стаття КК, тому у відкритих даних ЄДРСР її не відібрати за категорією. Потрібен відбір за текстом вироку (посада обвинуваченого) або за переліком статей, які ДБР розслідує незалежно від суб’єкта."}};
const DBR_META={"407":{t:"Самовільне залишення військової частини або місця служби",y:[["2022",1376],["2023",1930],["2024",1194],["2025",938],["2026",1418]]},"402":{t:"Непокора",y:[["2022",183],["2023",683],["2024",884],["2025",509],["2026",285]]}};
const BEB_META={"204":{t:"Незаконне виготовлення, зберігання, збут або транспортування з метою збуту підакцизних товарів",y:[["2022",91],["2023",218],["2024",303],["2025",362],["2026",283]]},"205-1":{t:"Підроблення документів, які подаються для проведення державної реєстрації",y:[["2022",22],["2023",77],["2024",102],["2025",89],["2026",67]]}};
// Перелік статей з урахуванням обраної області та області для порівняння (як у СБУ)
function artList(arts){
  arts=arts.slice().sort((a,b)=>(artCount(b)-artCount(a))||(G.arts[b].n-G.arts[a].n));
  const rows=arts.map(a=>{const n=artCount(a), n2=S.reg2?artCountG(a,S.reg2):0; return (n||n2)?'<button class="row" data-a="sa" data-v="'+a+'"><span class="main"><span class="t">Ст. '+a+' КК</span>'+(ARTF[a]?'<div class="s">'+esc(ARTF[a])+'</div>':'')+'</span>'+two(n,n2)+'<span class="chev">›</span></button>':''}).join("");
  return '<div class="sh">Статті · '+esc(rname(S.reg))+' <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+(rows||'<div class="pad note">Для цієї області вироків немає.</div>')+'</div>'+(S.reg2?'<p class="note" style="margin-top:6px">Порівняння областей не є оцінкою судів чи суддів.</p>':'');
}
function vBeb(){
  const g=GB, arts=Object.keys(g.arts).filter(a=>a!=="000");
  return header("Покарання: БЕБ",S.tab!=="soon")+'<div class="wrap">'+(S.inst==="all"?segVaks("beb"):'')+regSel()+complNote()+
   '<p class="note" style="margin-top:0">Вироки за статтями, які ст. 216 КПК відносить до підслідності БЕБ, у відкритих даних ДСА: <b>'+g.verdicts+'</b> (без повторних публікацій), '+g.from+' – '+g.cut+'. ЄДРСР не зберігає, який орган розслідував справу, тому вибірку зроблено за статтями; частину вироків 2022–2023 рр. могли розслідувати інші органи. Перелік статей — за ч. 3 ст. 216 КПК (редакція від 19.11.2026). Ст. 191, 364 і пов’язані ст. 192, 358, 366, 369 (підслідні БЕБ лише за певних умов) не включено. Підакцизні товари (ст. 204) і підроблення реєстраційних документів (ст. 205-1) — однотипні справи, нижче лише кількість вироків за їхніми категоріями ЄДРСР. Частина вироків за ст. 204 опублікована під категорією ст. 199, тому потрапила до розбору.</p>'+
   artList(arts)+
   '<div class="sh">Без розбору текстів</div><div class="group">'+Object.entries(BEB_META).map(([a,o])=>'<div class="row"><span class="main"><span class="t">Ст. '+a+' КК</span><div class="s">'+esc(o.t)+' · '+o.y.map(y=>y[0]+': '+y[1]).join(" · ")+'</div></span><span class="v">'+o.y.reduce((s,y)=>s+y[1],0)+'</span></div>').join("")+'</div>'+
   apSum("bap","виправдувальні вироки і вироки з реальним позбавленням волі (без ст. 75 КК)")+'<div class="sh">Касація</div><div class="group"><button class="row" data-a="kas" data-v="beb"><span class="main"><span class="t" style="font-size:15px">Постанови ККС у справах БЕБ: де рішення скасовано або змінено</span></span><span class="chev">›</span></button></div>'+
   '<p class="note">Розбір покарань автоматичний: перед цитуванням звіряйте з текстом. Статистики за суддями немає.</p></div>';
}
function apSum(pre,what){
  const AP=G.ap||{}, ks=Object.keys(AP).map(Number); if(!ks.length) return '';
  const by=AP_L.map((_,c)=>ks.filter(i=>AP[i][0]===c));
  return '<div class="sh">Результат апеляції <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+AP_L.map((l,c)=>{const id=pre+"|"+c, open=S.sv===id, ix=by[c]; return ix.length?'<button class="row" data-a="sv" data-v="'+id+'"><span class="main"><span class="t" style="font-size:15px">'+l+'</span></span><span class="v">'+ix.length+'</span><span class="chev">'+(open?'⌄':'›')+'</span></button>'+(open?listBlock(id,ix,vrowAp):''):''}).join("")+'</div>'+
   '<p class="note">Перевірено вибірково: '+what+' — '+ks.length+' вироків, щодо яких у відкритих даних є апеляційне рішення після дати вироку. Результат визначено автоматично за резолютивною частиною останніх апеляційних ухвал.</p>';
}
function vKas(k){
  const K=D.kas[k], lk=(txt,L)=>esc(txt).replace(/\u0001(\d+)\u0002/g,(_,i)=>{const x=L[+i];return '<a href="'+x[3]+'" target="_blank" rel="noopener" style="color:var(--link);font-weight:600">'+esc(x[0])+'</a> <span style="color:var(--hint)">'+esc(x[1])+(x[2]!=="постанова"&&k!=="odv"?', '+esc(x[2]):'')+'</span>'});
  return header(k==="odv"?"Окремі думки ВАКС":"Касація: "+({beb:"БЕБ",dbr:"ДБР",sbupre:"СБУ до 2022"}[k]),true)+'<div class="wrap"><p class="note" style="margin-top:0">'+esc(K.su)+'</p>'+
   K.secs.map(([h,intro,items])=>'<div class="sh">'+esc(h)+'</div>'+(intro?'<p class="note" style="margin:0 0 8px">'+esc(intro)+'</p>':'')+'<div class="group">'+items.map(([t,L])=>'<div class="row" style="display:block;font-size:15px;line-height:1.45">'+lk(t,L)+'</div>').join("")+'</div>').join("")+
   '<p class="note">Відкриті дані ДСА (ЄДРСР, CC BY). Добірка — за текстами рішень; перед цитуванням звіряйте з повним текстом.</p></div>';
}
function vNpu(){
  const g=GN, arts=Object.keys(g.arts).filter(a=>a!=="000");
  return header("Покарання: поліція",S.tab!=="soon")+'<div class="wrap">'+(S.inst==="all"?segVaks("police"):'')+regSel()+complNote()+
   (g.interim?'<div class="alert a-info" style="margin-top:0"><b>Проміжні дані</b>Завантаження вироків поліції триває. Зараз тут '+vyr(g.verdicts)+'; після завантаження числа зміняться.</div>':'')+
   '<p class="note" style="margin-top:0">Справи поліції — більшість кримінальних вироків у ЄДРСР, тому тут вибірка, а не всі вироки: до 100 останніх вироків першої інстанції за кожною з найчастіших категорій справ і апеляційні вироки з відкритих даних ДСА — <b>'+g.verdicts+'</b> (без повторних публікацій), '+g.from+' – '+g.cut+'. Вирок рахується за першою статтею Особливої частини КК у резолютивній частині. Частки показують, як вирішено справи у вибірці, а не в усіх справах.</p>'+
   artList(arts)+apSum("nap","виправдувальні вироки і вироки з реальним позбавленням волі (без ст. 75 КК)")+
   '<p class="note">Розбір покарань автоматичний: перед цитуванням звіряйте з текстом. Результату апеляції для поліції поки немає. Статистики за суддями немає.</p></div>';
}
function vDbr(){
  const g=GD, arts=Object.keys(g.arts).filter(a=>a!=="000");
  return header("Покарання: ДБР",S.tab!=="soon")+'<div class="wrap">'+(S.inst==="all"?segVaks("dbr"):'')+regSel()+complNote()+
   '<p class="note" style="margin-top:0">Вироки за військовими злочинами (ст. 402–435 КК, крім ст. 422 — підслідність ДБР) у відкритих даних ДСА: <b>'+g.verdicts+'</b> (без повторних публікацій), '+g.from+' – '+g.cut+'. Самовільне залишення частини (ст. 407) і непокору (ст. 402) не розбирали: ці справи однотипні; нижче — лише кількість вироків. Вирок рахується за першою статтею Особливої частини КК у резолютивній частині.</p>'+
   artList(arts)+
   '<div class="sh">Без розбору текстів</div><div class="group">'+Object.entries(DBR_META).map(([a,o])=>'<div class="row"><span class="main"><span class="t">Ст. '+a+' КК</span><div class="s">'+esc(o.t)+' · '+o.y.map(y=>y[0]+': '+y[1]).join(" · ")+'</div></span><span class="v">'+o.y.reduce((s,y)=>s+y[1],0)+'</span></div>').join("")+'</div>'+
   apSum("dap","виправдувальні вироки і вироки з реальним позбавленням волі (без ст. 75 КК)")+'<div class="sh">Касація</div><div class="group"><button class="row" data-a="kas" data-v="dbr"><span class="main"><span class="t" style="font-size:15px">Постанови ККС у військових справах: де рішення скасовано або змінено</span></span><span class="chev">›</span></button></div><p class="note">Кількість вироків за ст. 407 і 402 — з метаданих ЄДРСР (категорія справи). Розбір покарань автоматичний: перед цитуванням звіряйте з текстом. Результату апеляції для ДБР поки немає. Статистики за суддями немає.</p></div>';
}
function vSoon(k){ if(k==="dbr") return vDbr(); if(k==="beb"&&GB) return vBeb(); if(k==="police"&&GN) return vNpu(); const o=SOON[k]; return header("Покарання: "+o.t,S.tab!=="soon",true)+'<div class="wrap"><div class="alert a-info" style="margin-top:0"><b>Розділ ще не наповнено</b>'+esc(o.x)+'</div><div class="sh">Тут буде</div><div class="group">'+["Санкція і фактичні межі покарання за частинами статей","Ст. 75, угоди, ст. 69, конфіскація","Результат апеляції за кожним вироком","Ключові постанови ККС, де вирок скасовано або змінено"].map(t=>'<div class="row"><span class="main t" style="font-size:15px">'+t+'</span><span class="badge b-mute">Буде</span></div>').join("")+'</div><p class="note">Позиції ВС і розділ «Досудове» вже працюють для всіх інституцій: висновки ВС щодо КПК спільні.</p></div>'; }
// Попередній автоматичний підрахунок за резолютивними частинами (відкриті дані ДСА, 22.11.2026)
const VAKS={n:395,years:[["2019",2],["2020",20],["2021",34],["2022",41],["2023",58],["2024",67],["2025",87],["2026",86]],
 res:[["Обвинувальні вироки",324],["Частково виправдувальні",52],["Затверджено угоду",142],["Звільнено з випробуванням (ст. 75)",127]],
 arts:[["368","Прийняття пропозиції, обіцянки або одержання неправомірної вигоди",96],["364","Зловживання владою або службовим становищем",90],["191","Привласнення, розтрата майна",83],["369","Пропозиція, обіцянка або надання неправомірної вигоди",66],["366","Службове підроблення",53],["369-2","Зловживання впливом",33],["209","Легалізація майна, одержаного злочинним шляхом",25],["190","Шахрайство",23]],
 ap:{vyr:21,od:112,vs:160,vsod:11}};
function vInstPick(){
  return '<div class="hero">'+MARK+'<div class="hero-w">LEX<span>_</span>K</div><div class="hero-s">Практика Верховного Суду</div></div><header class="hdr"><h1>З чим ви працюєте?</h1><span class="demo">Макет</span></header><div class="wrap"><p class="note" style="margin-top:0">Від вибору залежать розділи застосунку. Змінити можна будь-коли в розділі «Стежу».</p><div class="group">'+
   Object.keys(INST).map(k=>'<button class="row" data-a="inst" data-v="'+k+'"><span class="main"><span class="t">'+INST[k][0]+'</span><div class="s" style="font-size:14px">'+INST[k][1]+'</div></span><span class="chev">›</span></button>').join("")+'</div></div>';
}
function instBlock(){
  return '<div class="sh">Інституція</div><div class="group">'+Object.keys(INST).map(k=>'<button class="row" data-a="inst" data-v="'+k+'"><span class="main"><span class="t">'+INST[k][0]+'</span><div class="s">'+INST[k][1]+'</div></span>'+(S.inst===k?'<span class="badge b-ok">Обрано</span>':'<span class="chev">›</span>')+'</button>').join("")+'</div>';
}
function vVaks(){
  const g=GV, arts=Object.keys(g.arts).filter(a=>a!=="000").sort((a,b)=>g.arts[b].n-g.arts[a].n);
  const yc={}; g.V.forEach(v=>{const y=(v[1]||"").slice(-4); if(y) yc[y]=(yc[y]||0)+1;}); const ys=Object.keys(yc).sort(), mx=Math.max(...Object.values(yc));
  const sum=k=>arts.reduce((s,a)=>s+(g.arts[a][k]||0),0);
  return header("Покарання: ВАКС",S.tab!=="vaks")+'<div class="wrap">'+(S.inst==="all"?segVaks("vaks"):'')+
   '<p class="note" style="margin-top:0">Вироки Вищого антикорупційного суду та Апеляційної палати у відкритих даних ДСА: <b>'+g.verdicts+'</b> (без повторних публікацій), '+g.from+' – '+g.cut+'. Вирок рахується за першою статтею Особливої частини КК у резолютивній частині.</p>'+(g.hid?'<div class="alert a-info"><b>Не вся практика ВАКС</b>'+esc(hidNote(g))+'</div>':'')+
   '<div class="sh">Статті <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+arts.map(a=>{const A=g.arts[a];return '<button class="row" data-a="sa" data-v="'+a+'"><span class="main"><span class="t">Ст. '+a+' КК</span>'+(ARTF[a]?'<div class="s">'+esc(ARTF[a])+'</div>':'')+'</span><span class="v">'+A.n+'</span><span class="chev">›</span></button>'}).join("")+'</div>'+
   '<div class="sh">Результат</div><div class="group">'+[["Обвинувальні вироки першої інстанції",sum("conv1")],["Виправдувальні",sum("acq")],["Частково виправдувальні",sum("part")],["Вироки Апеляційної палати",sum("appeal")]].map(r=>'<div class="row"><span class="main t" style="font-size:15px">'+r[0]+'</span><span class="v">'+r[1]+'</span></div>').join("")+'</div>'+
   '<div class="sh">Вироки за роками</div><div class="group"><div class="pad">'+ys.map(y=>'<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span class="num" style="width:40px;font-size:13px;color:var(--hint)">'+y+'</span><div class="stack mini" style="flex:1"><i class="c1" style="width:'+(yc[y]/mx*100)+'%"></i></div><span class="num" style="width:28px;text-align:right;font-size:13px">'+yc[y]+'</span></div>').join("")+'</div></div>'+
   '<p class="note">Розбір автоматичний, за резолютивною частиною: перед цитуванням звіряйте з текстом. Результат апеляції з’явиться після обробки ухвал Апеляційної палати. Статистики за суддями та колегіями немає.</p></div>';
}
function vVapp(){
  const g=GV, AP=g.ap||{}, first=g.V.map((v,i)=>i).filter(i=>!/Апеляційна палата/.test(g.C[g.V[i][3]][0]));
  const by=AP_L.map((_,c)=>first.filter(i=>AP[i]&&AP[i][0]===c)), none=first.filter(i=>!AP[i]).length;
  const row=(c)=>{const id="vap|"+c, open=S.sv===id, ix=by[c]; return ix.length?'<button class="row" data-a="sv" data-v="'+id+'"><span class="main"><span class="t" style="font-size:15px">'+AP_L[c]+'</span></span><span class="v">'+ix.length+' із '+first.length+'</span><span class="chev">'+(open?'⌄':'›')+'</span></button>'+(open?listBlock(id,ix,vrowAp):''):''};
  return header("Апеляція: ВАКС",S.tab!=="vapp")+'<div class="wrap"><p class="note" style="margin-top:0">Результат апеляційного перегляду вироків ВАКС першої інстанції: перше рішення Апеляційної палати по суті після дати вироку (ухвали й вироки Апеляційної палати, відкриті дані ДСА).</p>'+
   '<div class="sh">Результат апеляції <span class="badge b-ok">Дані ЄДРСР</span></div><div class="group">'+AP_L.map((_,c)=>row(c)).join("")+
   '<div class="row"><span class="main t" style="font-size:15px;color:var(--hint)">Апеляційного рішення у відкритих даних немає</span><span class="v">'+none+'</span></div></div>'+
   '<p class="note">Результат визначено автоматично за резолютивною частиною. «Рішення немає» не означає, що вирок не оскаржували: частину рішень не опубліковано. За статтями результат показано в картці частини статті у вкладці «ВАКС».</p>'+
   '<div class="sh">У базі також</div><div class="group">'+[["Вироки Апеляційної палати ВАКС",VAKS.ap.vyr],["Постанови ВС у справах ВАКС",VAKS.ap.vs],["Окремі думки суддів ВАКС і Апеляційної палати",VAKS.ap.od]].map(r=>'<div class="row"><span class="main t" style="font-size:15px">'+r[0]+'</span><span class="v">'+r[1]+'</span></div>').join("")+
   '<button class="row" data-a="topic" data-v="postanovy-vs-u-spravakh-vaks"><span class="main"><span class="t" style="font-size:15px">Постанови ВС у справах ВАКС: де вирок скасовано або змінено</span></span><span class="chev">›</span></button><button class="row" data-a="kas" data-v="odv"><span class="main"><span class="t" style="font-size:15px">Окремі думки суддів ВАКС і Апеляційної палати: розбіжності за темами</span></span><span class="chev">›</span></button></div></div>';
}
function segReg(cur){ return '<div class="chips" style="margin:0 0 10px">'+[["sbu","СБУ"],["police","Поліція"],["beb","БЕБ"],["dbr","ДБР"]].filter(x=>x[0]==="sbu"||hasIG(x[0])).map(x=>'<button class="chip"'+(cur===x[0]?' aria-pressed="true"':'')+' data-a="rinst" data-v="'+x[0]+'">'+x[1]+'</button>').join("")+'</div>'; }
function segVaks(cur){ return '<div class="chips" style="margin:0 0 10px">'+[["sbu","СБУ"],["vaks","ВАКС"],["police","Поліція"],["beb","БЕБ"],["dbr","ДБР"]].map(x=>'<button class="chip"'+(cur===x[0]?' aria-pressed="true"':'')+' data-a="segv" data-v="'+x[0]+'">'+x[1]+'</button>').join("")+'</div>'; }

/* ===== Навігація ===== */
const TABS_SBU=[["positions","Позиції","M12 7a4 4 0 0 0-4-3H3v14h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5V4h-5a4 4 0 0 0-4 3zM12 7v13"],["regions","Регіони","M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10zM12 9v4M10 11h4"],["sentencing","Покарання","M12 3v17M7 20h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"],["pretrial","Досудове","M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM20 20l-4.6-4.6"],["more","Стежу","M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"]];
const T_VAKS=["vaks","Покарання","M12 3v17M7 20h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"], T_VAPP=["vapp","Апеляція","M4 12h12M12 6l6 6-6 6"];
const T_SOON=["soon","Покарання","M12 3v17M7 20h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"];
function tabs(){ const [p,r,se,pr,mo]=TABS_SBU; return S.inst==="nabu"?[p,T_VAKS,T_VAPP,pr,mo]:SOON[S.inst]?(hasIG(S.inst)?[p,r,T_SOON,pr,mo]:[p,T_SOON,pr,mo]):TABS_SBU; }
function cur(){ const st=S.stacks[S.tab]; return st[st.length-1]; }
function vctx(){ return S.tab==="vaks"||S.tab==="vapp"||S.stacks[S.tab].some(x=>x.v==="vaksv"); }
function rinst(){ return S.inst==="all"?(S.rinst||"sbu"):S.inst; }
function ictx(k){ return (S.tab==="soon"&&S.inst===k)||(S.tab==="regions"&&rinst()===k)||S.stacks[S.tab].some(x=>x.v==="soonv"&&x.p===k); }
function dctx(){ return ictx("dbr"); }
function view(t){
  G = vctx()?GV:ictx("dbr")?GD:(ictx("beb")&&GB)?GB:(ictx("police")&&GN)?GN:(S.per==="pre"&&GSP)?GSP:GS; if(G===GV){ S.reg="*"; S.reg2=""; }
  if(t.v==="pos") return vPos(t.p);
  if(t.v==="topic") return vTopic(t.p);
  if(t.v==="icat") return vInstCat();
  if(t.v==="iart") return vInstArt(t.p);
  if(t.v==="kas") return vKas(t.p);
  if(t.v==="byart") return vByArt(t.p);
  if(t.v==="arts") return vArts();
  if(t.v==="marked") return vMarked();
  if(t.v==="refs") return vRefs();
  if(t.v==="sent") return vSent(t.p);
  if(t.v==="sentlist") return vList111(t.p);
  if(t.v==="sa") return vSentArt(t.p);
  if(t.v==="sp") return vSentPart(t.p);
  if(t.v==="sim") return vSimilar(t.p);
  if(t.v==="pilot111") return vPilot111(t.p);
  if(t.v==="pre") return vPre(t.p);
  if(t.v==="check") return vCheck();
  if(t.v==="about") return vAbout();
  if(t.v==="vaksv") return vVaks();
  if(t.v==="soonv") return vSoon(t.p);
  if(t.v==="vappv") return vVapp();
  return {positions:vPositionsHome,regions:vRegions,sentencing:vSentHome,pretrial:vPreHome,more:vMore,vaks:vVaks,vapp:vVapp,soon:()=>vSoon(S.inst)}[S.tab]();
}
function render(keep){
  const y=window.scrollY;
  if(!S.inst){ $("app").innerHTML=vInstPick(); $("tabs").innerHTML=""; window.scrollTo(0,0); return; }
  if(!tabs().some(x=>x[0]===S.tab)) S.tab="positions";
  $("app").innerHTML=view(cur());
  $("tabs").innerHTML=tabs().map(x=>'<button class="tab" data-a="tab" data-v="'+x[0]+'"'+(x[0]===S.tab?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+x[2]+'"/></svg>'+x[1]+'</button>').join("");
  const top=cur(), ry=keep?y:(top.y||0); if(!keep) delete top.y;
  window.scrollTo(0, ry);
  if(!keep&&!ry){ try{ const n=$("tabs"); n.scrollIntoView && n.scrollIntoView({block:"start"}); }catch(_){} }
  if(window.__tgSyncBack) window.__tgSyncBack();
}
// Прокрутка: перед переходом запам'ятовуємо, де був користувач (поле y запису в стеку), і повертаємо його туди «Назад»
function saveScroll(){ const st=S.stacks[S.tab]; if(!st||!st.length) return; const d=st.length-1;
  if(document.body.classList.contains("desk")){ const L=$("plist"), D=$("pdet")||$("psolo"); if(D) st[d].y=D.scrollTop; if(L&&d>0) st[d-1].y=L.scrollTop; }
  else st[d].y=window.scrollY; }
function goBack(){ const st=S.stacks[S.tab]; if(st&&st.length>1){ st.pop(); S.cls=null; render(); return true; } return false; }
function push(v,p){ if(!document.body.classList.contains("desk")) saveScroll(); S.stacks[S.tab].push({v,p}); S.cls=null; render(); }
let toastT; function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2600); }

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-a]"); if(!b) return; const a=b.dataset.a, v=b.dataset.v;
  if(a==="tab"){ if(S.tab===v) S.stacks[v]=[{v:"home"}]; else saveScroll(); S.tab=v; try{history.replaceState(null,"","#"+v)}catch(_){} render(); }
  else if(a==="tabgo"){ S.tab=v; S.stacks[v]=[{v:"home"}]; render(); }
  else if(a==="topicgo"){ S.tab="positions"; S.stacks.positions=[{v:"home"},{v:"topic",p:v}]; render(); }
  else if(a==="back"){ goBack(); }
  else if(a==="topic") push("topic",v);
  else if(a==="kas") push("kas",v);
  else if(a==="byart") push("byart",v);
  else if(a==="pos"){ S.posD="all"; push("pos",v); }
  else if(a==="posreg"){ S.posD=S.district; push("pos",v); }
  else if(a==="sent") push("sent",v);
  else if(a==="sa") push("sa",v);
  else if(a==="sp"){ S.sv=null; push("sp",v); }
  else if(a==="sv"){ S.sv = S.sv===v?null:v; render(true); }
  else if(a==="pg"){ const i=v.lastIndexOf("|"); S.pg[v.slice(0,i)]=+v.slice(i+1); render(true); }
  else if(a==="pre") push("pre",v);
  else if(a==="go") push(v);
  else if(a==="p111") push("pilot111",v);
  else if(a==="slist") push("sentlist",v);
  else if(a==="quick"){ S.q=v; render(); }
  else if(a==="iart") push("iart",v);
  else if(a==="full"){ S.full[v]=true; render(true); }
  else if(a==="mode"){ S.mode=v; render(true); }
  else if(a==="posd"){ S.posD=v; S.cls=null; render(true); }
  else if(a==="cls"){ S.cls = S.cls===+v?null:+v; render(true); }
  else if(a==="follow"){ S.follow[v]=!S.follow[v]; save(); render(true); toast(S.follow[v]?"Стежите за позицією":"Підписку скасовано"); }
  else if(a==="sub"){ S.subs[v]=!S.subs[v]; save(); render(true); }
  else if(a==="toast") toast(v);
  else if(a==="inst"){ S.inst=v; save(); S.stacks.more=[{v:"home"}]; if(!tabs().some(x=>x[0]===S.tab)) S.tab="positions"; render(); toast("Обрано: "+INST[v][0]); }
  else if(a==="per"){ S.per=v; const st=S.stacks[S.tab]; while(st.length>1) st.pop(); S.sv=null; S.pg={}; const g=(v==="pre"&&GSP)?GSP:GS; if(S.reg!=="*"&&!g.reg[S.reg]) S.reg="*"; if(S.reg2&&!g.reg[S.reg2]) S.reg2=""; render(); }
  else if(a==="rinst"){ S.rinst=v; const st=S.stacks[S.tab]; while(st.length>1) st.pop(); S.sv=null; S.pg={}; render(); }
  else if(a==="segv"){ const st=S.stacks[S.tab]; while(st.length>1) st.pop(); if(v==="vaks") push("vaksv"); else if(SOON[v]) push("soonv",v); else render(); }
  else if(a==="tglink"){ const url=BOT_LINK+"?start="+encodeURIComponent(v), W=window.Telegram&&window.Telegram.WebApp;
    if(W&&W.openTelegramLink&&W.initData) W.openTelegramLink(url); else window.open(url,"_blank","noopener"); }
  else if(a==="sim"){ push("sim",v); }
  else if(a==="simf"){ S.sim=S.sim||{}; S.sim[v]=((S.sim[v]||0)+1)%3; S.pg={}; render(true); }
  else if(a==="simfresh"){ S.simFresh=!S.simFresh; S.pg={}; render(true); }
  else if(a==="motion"){ const txt=forMotion(P(v)), done=()=>toast("Скопійовано. Текст позиції — з Бази правових позицій ВС: перед поданням звірте з рішенням.");
    const manual=()=>{ S.motion={i:+v,t:txt}; render(true); };
    try{ navigator.clipboard.writeText(txt).then(done,manual); }catch(_){ manual(); } }
  else if(a==="copy"){ const txt=cite(P(v)), done=()=>toast("Скопійовано: "+txt);
    try{ navigator.clipboard.writeText(txt).then(done,()=>toast(txt)); }catch(_){ toast(txt); } }
  else if(a==="runcheck"){ const txt=$("doc").value; S.docText=txt;
    if(!KKX&&!KKX_ERR){ toast("Завантажую перелік постанов ККС…"); loadKKX().then(()=>{ const b=document.querySelector('[data-a="runcheck"]'); if(b) b.click(); }); return; }
    const seen=new Set(), out=[];
    const iso=(d,m,y)=>y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    for(const m of txt.matchAll(/(\d{1,4}\/\d{1,6}\/\d{2}(?:-к)?)(?![\d\/])/gi)){ const raw=m[1], k0=nc(raw).replace(/-к$/,""); if(seen.has(k0)) continue; seen.add(k0);
      const ps=caseIdx.get(nc(raw))||caseIdx.get(k0)||caseIdx.get(k0+"-к")||[];
      const ov=[...new Set([...(OVER[raw]||OVER[k0]||OVER[k0+"-к"]||[]),...(depCase(raw)?[depCase(raw).i]:[])])].filter(i=>{const q=P(i); return q&&q.m==="indented"&&!ps.includes(q);});
      // дата біля номера: остання в 120 знаках перед ним («від 07.04.2025 у справі № …»), не далі за попередній номер;
      // якщо там немає — перша в 60 знаках після, не далі за наступний номер
      const DR=/(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/g, nums=[...txt.matchAll(/\d{1,4}\/\d{1,6}\/\d{2}/g)].map(x=>x.index);
      const prv=Math.max(-1,...nums.filter(i=>i<m.index)), nxt=Math.min(txt.length,...nums.filter(i=>i>m.index));
      const db=[...txt.slice(Math.max(0,m.index-120,prv+1),m.index).matchAll(DR)].pop(), da=[...txt.slice(m.index+raw.length,Math.min(m.index+raw.length+60,nxt)).matchAll(DR)][0];
      const dd=db||da, date=dd?iso(dd[1],dd[2],dd[3]):null;
      const dates=[...new Set(POS.flatMap(q=>q.d.filter(d=>d[2]&&nc(d[2]).replace(/-к$/,"")===k0).map(d=>d[1])))].sort();
      out.push({no:raw,ps,over:ov.length?ov:null,date,dates,refs:(REFBY.get(k0)||[]).filter(r=>!r.dec),kk:KKX?(KKX.get(k0)||[]).slice().sort((x,y)=>x[0].localeCompare(y[0])):null}); }
    S.check=out; render(true); }
});
document.addEventListener("input",e=>{ if(e.target.id==="q"){ S.q=e.target.value; $("results").innerHTML=resultsHTML(); } });
document.addEventListener("change",e=>{ if(e.target.id==="dsel"){ S.district=e.target.value; save(); render(true); } if(e.target.id==="rsel"){ S.reg=e.target.value; if(S.reg2===S.reg) S.reg2=""; S.sv=null; S.pg={}; save(); render(true); } if(e.target.id==="rsel2"){ S.reg2=e.target.value; save(); render(true); } });
function fromHash(){ const h=location.hash.slice(1); if(S.stacks[h]&&h!==S.tab){ S.tab=h; render(); } }
window.addEventListener("hashchange",fromHash);
const h0=location.hash.slice(1); if(S.stacks[h0]) S.tab=h0;
render();

/* Telegram Mini App: тема, розгортання, системна кнопка «Назад». Поза Telegram нічого не робить. */
(function(){
  const tg=window.Telegram&&window.Telegram.WebApp;
  if(!tg||!tg.platform||tg.platform==="unknown") return;
  try{ tg.ready(); tg.expand(); }catch(_){}
  const apply=()=>{ document.documentElement.setAttribute("data-theme",tg.colorScheme==="dark"?"dark":"light");
    try{ const bg=getComputedStyle(document.body).backgroundColor; tg.setHeaderColor(bg); tg.setBackgroundColor(bg); }catch(_){} };
  apply(); try{ tg.onEvent("themeChanged",apply); }catch(_){}
  const bb=tg.BackButton;
  window.__tgSyncBack=()=>{ try{ const st=S.inst&&S.stacks[S.tab]; (st&&st.length>1)?bb.show():bb.hide(); }catch(_){} };
  try{ bb.onClick(()=>{ goBack(); }); }catch(_){}
  window.__tgSyncBack();
})();

/* Відкрити позицію з бота: #pos-15734 або startapp=pos-15734 */
(function(){
  const tg=window.Telegram&&window.Telegram.WebApp;
  const sp=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.start_param)||"";
  const m=/^pos-(\d+)$/.exec(sp)||/^pos-(\d+)$/.exec(location.hash.slice(1));
  if(m&&P(m[1])){ if(!S.inst) S.inst="all"; S.tab="positions"; S.posD="all"; S.stacks.positions=[{v:"home"}]; push("pos",m[1]); }
})();


/* ===== Комп'ютер (≥ 960 px): список зліва, картка справа. На телефоні й у Telegram нічого не змінює. ===== */
(function(){
  const DESK = window.matchMedia("(min-width:960px)");
  const nav = document.querySelector(".tabbar");
  nav.insertAdjacentHTML("afterbegin",'<div class="sbrand">'+MARK+'<div><b>LEX_K</b><small>Практика Верховного Суду</small></div></div>');
  nav.insertAdjacentHTML("beforeend",'<div class="sfoot" id="sfoot"></div>');
  const tabsHTML = () => tabs().map(x=>'<button class="tab" data-a="tab" data-v="'+x[0]+'"'+(x[0]===S.tab?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+x[2]+'"/></svg>'+x[1]+'</button>').join("");
  const key = (t,d) => S.tab+"|"+d+"|"+t.v+"|"+(t.p==null?"":t.p);
  let fromList = false;

  /* Клік у списку відкриває нову картку замість поточної, а не поверх неї. */
  document.addEventListener("click", e => {
    fromList = !!(document.body.classList.contains("desk") && e.target.closest("#plist"));
    const b = e.target.closest('[data-a="instchange"]');
    if(b){ S.inst=null; save(); render(); }
  }, true);
  const pushBase = push;
  push = function(v,p){ if(document.body.classList.contains("desk")) saveScroll(); const st=S.stacks[S.tab]; if(fromList && st.length>1) st.pop(); fromList=false; pushBase(v,p); };

  function markSelected(child){
    const L = $("plist"); if(!L) return;
    const want = child.v, pv = child.p==null?null:String(child.p);
    for(const b of L.querySelectorAll("[data-a]")){
      const a=b.dataset.a, v=b.dataset.v;
      const hit = (a==="go" && v===want) || ((a===want || (a==="posreg" && want==="pos")) && v===pv);
      if(hit){ b.classList.add("is-sel"); b.setAttribute("aria-current","true"); }
    }
    const s = L.querySelector(".is-sel");
    if(s){ const r=s.getBoundingClientRect(), R=L.getBoundingClientRect(); if(r.top<R.top+64||r.bottom>R.bottom) s.scrollIntoView({block:"center"}); }
  }

  function renderDesk(keep){
    document.body.classList.add("desk");
    if(!tabs().some(x=>x[0]===S.tab)) S.tab="positions";
    const st=S.stacks[S.tab], app=$("app"), d=st.length-1;
    const oldL=$("plist"), oldD=$("pdet")||$("psolo");
    const ly=oldL?oldL.scrollTop:0, dy=oldD?oldD.scrollTop:0;
    const prevL=app.dataset.lk||"", prevD=app.dataset.dk||"";
    $("tabs").innerHTML=tabsHTML();
    const inst = (typeof INST!=="undefined" && INST[S.inst]) ? INST[S.inst][0] : "";
    $("sfoot").innerHTML=(inst?'<div>Інституція: <b style="color:var(--text)">'+esc(inst)+'</b><br><button data-a="instchange">Змінити</button></div>':'')+'<div><kbd>/</kbd> пошук &nbsp; <kbd>Esc</kbd> назад</div>';
    const dk=key(st[d],d);
    if(d>0){
      const lk=key(st[d-1],d-1);
      const lHTML=view(st[d-1]), dHTML=view(st[d]);   /* картку рахуємо останньою, як і в одноколонковій версії */
      app.className="app split";
      app.innerHTML='<section class="pane plist" id="plist" aria-label="Список">'+lHTML+'</section><section class="pane pdet" id="pdet" aria-label="Картка">'+dHTML+'</section>';
      const sl=st[d-1].y, sd=st[d].y; if(!keep){ delete st[d-1].y; delete st[d].y; }
      $("plist").scrollTop = keep||lk===prevL ? ly : (lk===prevD ? dy : (sl||0));
      $("pdet").scrollTop = keep||dk===prevD ? dy : (dk===prevL ? ly : (sd||0));
      app.dataset.lk=lk; markSelected(st[d]);
    } else {
      app.className="app solo";
      app.innerHTML='<section class="pane psolo" id="psolo">'+view(st[d])+'</section>';
      const sd=st[d].y; if(!keep) delete st[d].y;
      $("psolo").scrollTop = keep||dk===prevD ? dy : (dk===prevL ? ly : (sd||0));
      app.dataset.lk="";
    }
    app.dataset.dk=dk;
  }

  const renderBase = render;
  render = function(keep){
    if(DESK.matches && S.inst){ renderDesk(keep); return; }
    document.body.classList.remove("desk"); const app=$("app"); app.className="app"; delete app.dataset.lk; delete app.dataset.dk;
    renderBase(keep);
  };
  try{ DESK.addEventListener("change",()=>render()); }catch(_){ DESK.addListener(()=>render()); }

  /* Клавіші: «/» — пошук, Esc — назад. */
  document.addEventListener("keydown", e => {
    if(!document.body.classList.contains("desk") || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if(e.key==="/" && !typing){
      e.preventDefault();
      let q=$("q");
      if(!q){ S.tab="positions"; S.stacks.positions=[{v:"home"}]; render(); q=$("q"); }
      if(q){ q.focus(); q.select(); }
    } else if(e.key==="Escape"){
      if(typing){ e.target.blur(); return; }
      goBack();
    }
  });

  render();
})();
