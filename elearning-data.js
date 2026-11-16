/* ============================================================
   elearning-data.js  -  Fail storan maklumat untuk elearning.html
   Letak fail ini dalam folder yang SAMA dengan elearning.html
   Mengandungi: simpanan data (localStorage), fail (IndexedDB),
   akaun admin lalai & reset admin, dan SEGERAK ke Google Apps Script
   (supaya semua pengguna kongsi data yang sama).
   ============================================================ */

// URL Web App Google Apps Script (guna fail Code.gs yang disediakan)
const API_URL='https://script.google.com/macros/s/AKfycbwUia7pqQtAs4pVVEeuFsvMtxQAS56yFNpmCXbpsNm38FPVBWFkarWSbjjcqw-B5ww34g/exec';
const K='elearn_db';                 // kunci localStorage untuk semua data
const RESET_KEY='elearn_admin_reset_v1'; // penanda: reset admin sudah dibuat (sekali sahaja)

// ===== Akaun admin lalai (hanya untuk log masuk pertama - WAJIB tukar selepas itu) =====
const ADMIN_DEFAULT={username:'admin123',password:'Admin123456'};

// Hash ringkas (cyrb53) - bukan keselamatan sebenar, hanya supaya password tidak terpapar terus
const hash=s=>{let a=0xdeadbeef,b=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677)}a=Math.imul(a^a>>>16,2246822507)^Math.imul(b^b>>>13,3266489909);b=Math.imul(b^b>>>16,2246822507)^Math.imul(a^a>>>13,3266489909);return(4294967296*(2097151&b)+(a>>>0)).toString(36)};
const now=()=>new Date().toLocaleString('sv').slice(0,16);
const load=()=>{const d=JSON.parse(localStorage.getItem(K)||'null');if(d){d.bukti=d.bukti||[];d.groups=d.groups||[];d.latihan=d.latihan||[];d.hantaran=d.hantaran||[]}return d};
const persist=()=>{try{localStorage.setItem(K,JSON.stringify(db))}catch{if(typeof toast=='function')toast('Storan penuh! Guna gambar/fail lebih kecil','err')}schedulePush()};
const mut=f=>{db=load();const r=f();persist();return r};
const nid=()=>++db.seq;

// ===== Data kosong + 1 admin lalai (must_change = wajib tukar semasa log masuk) =====
const seedDB=()=>({users:[{id:1,username:ADMIN_DEFAULT.username,password:hash(ADMIN_DEFAULT.password),role:'admin',nama:'Administrator',nis:'',kelas:'',must_change:true,created_at:now()}],subjects:[],books:[],notes:[],quizzes:[],questions:[],results:[],bukti:[],messages:[],groups:[],latihan:[],hantaran:[],seq:1});

// ===== Reset admin: username -> admin123, password -> Admin123456, wajib tukar bila log masuk =====
function resetAdmin(){
  db=load()||seedDB();
  const a=db.users.find(u=>u.role=='admin');
  if(a){a.username=ADMIN_DEFAULT.username;a.password=hash(ADMIN_DEFAULT.password);a.must_change=true}
  else db.users.unshift({...seedDB().users[0],id:++db.seq});
  persist();
  try{localStorage.setItem(RESET_KEY,'1')}catch{}
}

// ===== SEGERAK dengan Google Apps Script =====
// syncState: 'wait' (sedang sambung) | 'ok' (tersambung) | 'off' (luar talian / ralat - guna data setempat)
let syncState='wait',rev=0,ver=0,dirty=false,pushing=false,pushT=null;
const syncReady=()=>syncState!='wait';
const apiCall=async(url,opt)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),25000);try{const r=await fetch(url,{...opt,signal:c.signal});return await r.json()}finally{clearTimeout(t)}};
const apiGet=r=>apiCall(API_URL+'?rev='+r+'&t='+Date.now());
const apiPost=b=>apiCall(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(b)});
function badge(){let b=document.getElementById('syncb');if(!b){if(!document.body)return;b=document.createElement('div');b.id='syncb';b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:99;font:600 11px system-ui,sans-serif;padding:5px 10px;border-radius:99px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.2);pointer-events:none';document.body.appendChild(b)}
 b.textContent=syncState=='ok'?(dirty||pushing?'☁️ Menyimpan...':'☁️ Disegerak'):syncState=='wait'?'☁️ Menyambung...':'⚠️ Luar talian (data setempat)';b.style.color=syncState=='off'?'#b45309':'#065f46'}
// Gabung data: item sama id -> versi setempat menang; item pelayan sahaja dikekalkan
function mergeDB(r,l){const o={...r},id=x=>x&&x.id!=null?x.id:JSON.stringify(x);for(const k in l){const a=l[k],b=r[k];if(Array.isArray(a)&&Array.isArray(b)){const m=new Map();b.forEach(x=>m.set(id(x),x));a.forEach(x=>m.set(id(x),x));o[k]=[...m.values()]}else if(k=='seq')o[k]=Math.max(+a||0,+b||0);else if(!(k in r))o[k]=a}return o}
function setLocal(d){try{localStorage.setItem(K,JSON.stringify(d))}catch{}db=load();window.dispatchEvent(new Event('storage'));if(inChat()&&typeof paint=='function'&&document.getElementById('msgs')){try{paint()}catch{}}}
let pulling=false;
async function pull(first){
  if(pulling||(!first&&(dirty||pushing)))return;
  pulling=true;
  try{const r=await apiGet(first?0:rev);if(!r.ok)throw 0;
    if(r.same){syncState='ok';badge();return}
    if(r.data){rev=r.rev;setLocal(r.data);syncState='ok'}
    else{rev=r.rev;syncState='ok';dirty=true;push()}   // pelayan kosong -> hantar data setempat
  }catch{if(first)syncState='off'}
  pulling=false;badge()}
const inChat=()=>typeof S!='undefined'&&S.page=='chat';
function schedulePush(){if(syncState!='ok')return;ver++;dirty=true;badge();clearTimeout(pushT);pushT=setTimeout(push,inChat()?80:700)}   // chat: hantar hampir serta-merta
async function push(){
  if(pushing){clearTimeout(pushT);pushT=setTimeout(push,500);return}
  pushing=true;badge();const v=ver;
  try{const r=await apiPost({baseRev:rev,data:load()});
    if(r.ok){rev=r.rev;if(v==ver)dirty=false}
    else if(r.conflict){rev=r.rev;setLocal(mergeDB(r.data,load()));pushing=false;return push()}
    else throw 0;
  }catch{clearTimeout(pushT);pushT=setTimeout(push,6000)}   // cuba semula
  pushing=false;badge();if(dirty&&v!=ver){clearTimeout(pushT);pushT=setTimeout(push,300)}}
addEventListener('online',()=>{if(syncState=='off')pull(true)});
addEventListener('DOMContentLoaded',badge);
let tick=0;
setInterval(()=>{tick++;if(document.hidden)return;if(!inChat()&&tick%3)return;   // chat: setiap 1.5 saat, lain: ~4.5 saat
  syncState=='off'?pull(true):pull(false)},1500);

// ===== Mula: ada data lama -> reset admin sekali sahaja; tiada data -> seed baharu =====
let db=load();
if(!db){db=seedDB();persist();try{localStorage.setItem(RESET_KEY,'1')}catch{}}
else if(!localStorage.getItem(RESET_KEY))resetAdmin();
pull(true);   // ambil data terkini dari pelayan

// ===== Storan fail: IndexedDB (aplikasi tidak letak had saiz) =====
const idb=()=>new Promise((r,j)=>{const q=indexedDB.open('elearn_files',1);q.onupgradeneeded=()=>q.result.createObjectStore('f');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
const fput=async(id,b)=>{const d=await idb();return new Promise((r,j)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(b,id);t.oncomplete=r;t.onerror=t.onabort=()=>j(t.error)})};
const fget=async id=>{const d=await idb();return new Promise((r,j)=>{const q=d.transaction('f').objectStore('f').get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})};
async function gc(){try{const d=await idb(),x=load(),used=new Set([...x.books,...x.notes,...x.bukti,...x.latihan,...x.hantaran,...x.messages.filter(m=>m.media).map(m=>({file_ref:m.media.ref}))].map(r=>r.file_ref).filter(Boolean));
 const ks=await new Promise(r=>{const q=d.transaction('f').objectStore('f').getAllKeys();q.onsuccess=()=>r(q.result)});
 const t=d.transaction('f','readwrite');ks.filter(k=>!used.has(k)&&Date.now()-parseInt(k.slice(1,14))>60000).forEach(k=>t.objectStore('f').delete(k))}catch{}}
