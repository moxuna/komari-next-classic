/* Komari Expiry Timeline + Asset Calculator v10 */
(function(){
'use strict';


const PERMANENT_THRESHOLD=30000,DISMISS_KEY='komari-expiry-dot-dismissed',SIZE_KEY='komari-expiry-size',ASSET_SIZE_KEY='komari-asset-size',GAP=5;
let USD_RATE=7.2;
fetch('https://open.er-api.com/v6/latest/USD').then(r=>r.json()).then(d=>{if(d?.rates?.CNY)USD_RATE=d.rates.CNY;}).catch(()=>{});

function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtD(s){const d=new Date(s);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

let nodeData=[],expiryOv=null,assetOv=null,btnEl=null,assetTab='paid';

// ===== STYLES =====
function injectCSS(){
  if(document.getElementById('et-css'))return;
  const s=document.createElement('style');s.id='et-css';
  s.textContent=`
@keyframes etIn{from{opacity:0}to{opacity:1}}@keyframes etOut{from{opacity:1}to{opacity:0}}
@keyframes etUp{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes etDown{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(8px) scale(.98)}}
@keyframes etPop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes etPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.4)}}
@keyframes etShine{from{left:-100%}to{left:100%}}
.eto{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);animation:etIn .2s ease}
.etd{background:var(--card,#fff);color:var(--card-foreground,#1a1a1a);border-radius:12px;border:1px solid var(--border,#e5e7eb);box-shadow:0 25px 60px -12px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;position:relative;animation:etUp .3s cubic-bezier(.16,1,.3,1)}
.eth{padding:12px 18px;border-bottom:1px solid var(--border,#e5e7eb);background:var(--muted,#f9fafb);border-radius:12px 12px 0 0;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;flex-shrink:0}
.etx{margin-left:auto;cursor:pointer;font-size:18px;opacity:.4;line-height:1;padding:4px 8px;border-radius:6px;transition:all .15s;border:none;background:none;color:inherit}.etx:hover{opacity:1;background:var(--accent,#f1f5f9)}
.et-body{flex:1;overflow:hidden;padding:10px 12px;display:flex;min-height:0}
.et-panel{border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--card,#fff);overflow:hidden;display:flex;flex-direction:column;min-height:0;flex:1}
.et-panel-head{padding:8px 12px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;background:var(--muted,#f9fafb);flex-shrink:0}
.et-panel-body{flex:1;overflow-y:auto;padding:6px;display:flex;flex-direction:column;gap:4px;min-height:0}
.et-stat{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;cursor:pointer;position:relative;overflow:hidden;border-radius:8px;padding:10px 12px;flex:1;display:flex;flex-direction:column;justify-content:center}
.et-stat:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
.et-stat:hover::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);animation:etShine .6s ease}
.et-stat.active{box-shadow:0 0 0 2px var(--primary,#6366f1)}
.et-stat:hover .et-num{animation:etPop .4s ease}
.et-num{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.etk{display:flex;align-items:stretch;border-radius:6px;border:1px solid var(--border,#e5e7eb);overflow:hidden;text-decoration:none;color:inherit;min-height:40px;max-height:40px;background:var(--card,#fff);transition:all .15s ease;cursor:pointer;flex-shrink:0}
.etk:hover{box-shadow:0 2px 8px rgba(0,0,0,.06);transform:translateX(3px);border-color:var(--primary,#6366f1)!important}
.etk:hover .etb{width:5px!important}
.etk:active{transform:translateX(1px) scale(.99)}
.etg{transition:transform .15s;font-size:9px;font-weight:600;padding:2px 6px;border-radius:99px}
.etk:hover .etg{transform:scale(1.05)}
.et-panel-body::-webkit-scrollbar{width:4px}.et-panel-body::-webkit-scrollbar-track{background:transparent}.et-panel-body::-webkit-scrollbar-thumb{background:var(--border,#e5e7eb);border-radius:4px}
.etp{animation:etPulse 2s ease-in-out infinite}
.etr{position:absolute;bottom:2px;right:2px;width:16px;height:16px;cursor:se-resize;opacity:.2;transition:opacity .2s}.etr:hover{opacity:.6}
`;document.head.appendChild(s);}

// ===== DATA =====
function fetchNodes(){fetch('/api/admin/client/list',{credentials:'include'}).then(r=>r.ok?r.json():null).then(d=>{if(!d)return;const l=d.data||d.result||d;if(Array.isArray(l)&&l.length>0){nodeData=l;updateDot();}}).catch(()=>{});}

function getExpiry(){
  const now=Date.now();
  const all=nodeData.filter(n=>n.expired_at||n.expiredAt).map(n=>{const s=n.expired_at||n.expiredAt||'';const e=new Date(s);if(isNaN(e.getTime()))return null;const d=Math.ceil((e.getTime()-now)/864e5);return{uuid:n.uuid||'',name:n.name||'?',expiredAt:s,days:d,perm:d>=PERMANENT_THRESHOLD};}).filter(Boolean);
  return{expired:all.filter(n=>n.days<0&&!n.perm).sort((a,b)=>a.days-b.days),urgent:all.filter(n=>n.days>=0&&n.days<=30&&!n.perm).sort((a,b)=>a.days-b.days),normal:all.filter(n=>(n.days>30&&!n.perm)||n.perm).sort((a,b)=>{if(a.perm&&!b.perm)return 1;if(!a.perm&&b.perm)return-1;return a.days-b.days;})};
}

function getAssets(){
  const paid=[],free=[];let totalCNY=0;
  for(const n of nodeData){
    const p=Number(n.price),cur=n.currency||'¥',cycle=Number(n.billing_cycle||n.billingCycle||30);
    if(p>0){
      const valueCNY=(cur==='$'||cur==='USD')?p*USD_RATE:p;
      totalCNY+=valueCNY;
      const cycleLabel={'-1':'一次性','30':'月付','92':'季付','365':'年付','730':'两年','1095':'三年'}[String(cycle)]||(cycle>0?cycle+'天':'未知');
      paid.push({uuid:n.uuid||'',name:n.name||'?',price:p,cur,cycle,cycleLabel,valueCNY});
    } else { free.push({uuid:n.uuid||'',name:n.name||'?'}); }
  }
  paid.sort((a,b)=>b.valueCNY-a.valueCNY);
  return{paid,free,totalCNY};
}

function updateDot(){
  if(!btnEl||!document.body.contains(btnEl))return;
  const{expired,urgent}=getExpiry();const has=expired.length>0||urgent.length>0;
  const dismissed=localStorage.getItem(DISMISS_KEY)===today();
  let dot=btnEl.querySelector('.etp');
  if(has&&!dismissed){if(!dot){dot=document.createElement('span');dot.className='etp';dot.style.cssText='position:absolute;top:-1px;right:-1px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:2px solid var(--background,#fff)';btnEl.appendChild(dot);}}
  else if(dot)dot.remove();
}

// ===== NAV =====
function findC(){const nav=document.querySelector('nav');if(!nav)return null;let b=null;for(const d of nav.querySelectorAll('div')){const bs=d.querySelectorAll(':scope>button');if(bs.length>=3&&(!b||bs.length>b.querySelectorAll(':scope>button').length))b=d;}return b;}
// 定位「资产计算器」按钮：按计算器图标找，找不到就退回「按钮排里第一个非搜索按钮」。
// （原版是按“第一个按钮”定位，但右侧按钮排最左侧现在是节点搜索按钮，
//   沿用旧写法会把搜索按钮的点击抢去打开资产面板。）
function findAssetBtn(c){
  const ic=c.querySelector(':scope>button .lucide-calculator, :scope>button [data-lucide="calculator"]');
  const hit=ic&&ic.closest('button');
  if(hit)return hit;
  const bs=Array.from(c.querySelectorAll(':scope>button'));
  return bs.find(b=>!b.classList.contains('ds-node-search-btn'))||bs[0]||null;
}
function createBtn(){
  if(btnEl&&document.body.contains(btnEl))return true;btnEl=null;
  const c=findC();if(!c)return false;
  if(c.querySelector('#et-btn')){btnEl=c.querySelector('#et-btn');return true;}
  const f=findAssetBtn(c);if(!f)return false;
  const b=document.createElement('button');b.id='et-btn';b.setAttribute('data-slot','button');b.className=f.className;b.style.position='relative';b.type='button';b.title='到期时间线';
  b.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/></svg>';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showExpiry();});
  f.insertAdjacentElement('afterend',b);btnEl=b;updateDot();

  if(!f.dataset.h){f.dataset.h='1';f.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showAsset();},true);}
  return true;
}

// ===== DIALOG HELPERS =====
function mkOv(close){const o=document.createElement('div');o.className='eto';o.addEventListener('click',e=>{if(e.target===o)close();});return o;}
function mkD(w,h){const d=document.createElement('div');d.className='etd';d.style.cssText=`width:${w}px;height:${h}px;max-width:95vw;max-height:90vh`;return d;}
function closeD(el){if(!el)return;el.querySelector('.etd').style.animation='etDown .2s ease forwards';el.style.animation='etOut .2s ease forwards';setTimeout(()=>{el.style.display='none';el.style.animation='';el.querySelector('.etd').style.animation='';},200);}
function openD(el){el.style.display='flex';el.style.animation='etIn .2s ease';el.querySelector('.etd').style.animation='etUp .3s cubic-bezier(.16,1,.3,1)';}
function addResize(dlg,key,fn){
  const h=dlg.querySelector('.etr');if(!h)return;
  h.onmousedown=e=>{e.preventDefault();let W=parseInt(dlg.style.width),H=parseInt(dlg.style.height);const sx=e.clientX,sy=e.clientY,sw=W,sh=H;
    function mv(v){W=Math.max(450,Math.min(1200,sw+(v.clientX-sx)));H=Math.max(280,Math.min(900,sh+(v.clientY-sy)));dlg.style.width=W+'px';dlg.style.height=H+'px';fn();}
    function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);localStorage.setItem(key,JSON.stringify({w:W,h:H}));}
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);};
}

// ===== EXPIRY DIALOG =====
function showExpiry(){
  localStorage.setItem(DISMISS_KEY,today());updateDot();
  if(expiryOv){openD(expiryOv);window._reE();return;}
  const sv=JSON.parse(localStorage.getItem(SIZE_KEY)||'null'),W=sv?.w||700,H=sv?.h||420;
  const ov=mkOv(()=>closeD(expiryOv)),dlg=mkD(W,H);ov.appendChild(dlg);document.body.appendChild(ov);expiryOv=ov;
  function re(){
    const{expired,urgent,normal}=getExpiry();
    dlg.innerHTML=`<div class="eth"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/></svg>到期时间线<span style="font-size:11px;font-weight:400;opacity:.5;margin-left:4px">共${expired.length+urgent.length+normal.length}台</span><button class="etx">✕</button></div>
    <div class="et-body" style="gap:10px">
      ${ePanel('已过期',expired.length,'#ef4444',expired)}
      ${ePanel('即将到期',urgent.length,'#f59e0b',urgent)}
      ${ePanel('正常',normal.length,'#10b981',normal)}
    </div><div class="etr"><svg viewBox="0 0 16 16" style="width:100%;height:100%"><path d="M14 14L8 14L14 8Z" fill="currentColor"/></svg></div>`;
    dlg.querySelector('.etx').onclick=()=>closeD(expiryOv);addResize(dlg,SIZE_KEY,re);
  }
  window._reE=re;re();
}

function ePanel(title,count,color,nodes){
  return `<div class="et-panel"><div class="et-panel-head"><div style="width:8px;height:8px;border-radius:50%;background:${color}"></div><span style="color:${color}">${title}</span><span style="margin-left:auto;font-size:15px;font-weight:800;color:${color}">${count}</span></div><div class="et-panel-body">${nodes.length===0?'<p style="text-align:center;font-size:11px;opacity:.4;padding:16px 0">无</p>':''}${nodes.map(n=>eCard(n,color)).join('')}</div></div>`;
}

function eCard(n,color){
  let badge;
  if(n.perm)badge='<span class="etg" style="color:#3b82f6;background:#3b82f610;border:1px solid #3b82f625">∞ 永久</span>';
  else if(n.days<0)badge=`<span class="etg" style="color:#ef4444;background:#ef444410;border:1px solid #ef444425">过期${Math.abs(n.days)}天</span>`;
  else if(n.days===0)badge='<span class="etg" style="color:#ef4444;background:#ef444410;border:1px solid #ef444425">今天</span>';
  else{const c=n.days<=7?'#ef4444':n.days<=30?'#f59e0b':'#10b981';badge=`<span class="etg" style="color:${c};background:${c}10;border:1px solid ${c}25">${n.days}天</span>`;}
  return `<div data-go="${n.uuid}" data-gn="${n.name}" class="etk"><div class="etb" style="width:3px;background:${color};transition:width .15s"></div><div style="flex:1;display:flex;align-items:center;gap:6px;padding:3px 8px;min-width:0"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.name}</div>${!n.perm?`<div style="font-size:9px;opacity:.5;margin-top:1px">${fmtD(n.expiredAt)}</div>`:''}</div><div style="flex-shrink:0">${badge}</div></div></div>`;
}

// ===== ASSET DIALOG =====
function showAsset(){
  assetTab='paid';
  if(assetOv){openD(assetOv);window._reA();return;}
  const sv=JSON.parse(localStorage.getItem(ASSET_SIZE_KEY)||'null'),W=sv?.w||700,H=sv?.h||420;
  const ov=mkOv(()=>closeD(assetOv)),dlg=mkD(W,H);ov.appendChild(dlg);document.body.appendChild(ov);assetOv=ov;
  function re(){
    const{paid,free,totalCNY}=getAssets();
    const isPaid=assetTab==='paid';const list=isPaid?paid:free;
    dlg.innerHTML=`<div class="eth"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/></svg>资产统计<span style="font-size:11px;font-weight:400;opacity:.5;margin-left:4px">共${paid.length+free.length}台</span><button class="etx">✕</button></div>
    <div class="et-body" style="gap:10px">
      <!-- Left stats column -->
      <div style="display:flex;flex-direction:column;gap:6px;width:160px;flex-shrink:0">
        <div class="et-stat" style="background:#8b5cf610;border:1px solid #8b5cf620;cursor:default">
          <div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px">💰</span><span style="font-size:10px;font-weight:600;color:#8b5cf6">资产估值</span></div>
          <div class="et-num" style="font-size:20px;font-weight:800;text-align:center;color:#8b5cf6;margin-top:3px">¥${totalCNY.toFixed(2)}</div>
        </div>
        <div class="et-stat ${isPaid?'active':''}" style="background:#f59e0b10;border:1px solid #f59e0b20" data-tab="paid">
          <div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px">🖥️</span><span style="font-size:10px;font-weight:600;color:#f59e0b">付费节点</span></div>
          <div class="et-num" style="font-size:22px;font-weight:800;text-align:center;color:#f59e0b;margin-top:3px">${paid.length}</div>
        </div>
        <div class="et-stat ${!isPaid?'active':''}" style="background:#10b98110;border:1px solid #10b98120" data-tab="free">
          <div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px">🎁</span><span style="font-size:10px;font-weight:600;color:#10b981">免费节点</span></div>
          <div class="et-num" style="font-size:22px;font-weight:800;text-align:center;color:#10b981;margin-top:3px">${free.length}</div>
        </div>
      </div>
      <!-- Right list panel -->
      <div class="et-panel">
        <div class="et-panel-head"><span style="color:${isPaid?'#f59e0b':'#10b981'}">${isPaid?'🖥️ 付费节点':'🎁 免费节点'}</span><span style="margin-left:auto;font-size:11px;opacity:.5">${isPaid?'按估值排序':'共'+free.length+'台'}</span></div>
        <div class="et-panel-body">
          ${list.length===0?'<p style="text-align:center;font-size:11px;opacity:.4;padding:16px 0">无</p>':''}
          ${isPaid?paid.map(n=>`<div data-go="${n.uuid}" data-gn="${n.name}" class="etk"><div class="etb" style="width:3px;background:#f59e0b;transition:width .15s"></div><div style="flex:1;display:flex;align-items:center;gap:6px;padding:3px 8px;min-width:0"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.name}</div><div style="font-size:9px;opacity:.5;margin-top:1px">${n.cycleLabel} · ${n.cur}${n.price}</div></div><div style="flex-shrink:0"><span class="etg" style="color:#8b5cf6;background:#8b5cf610;border:1px solid #8b5cf625">¥${n.valueCNY.toFixed(0)}</span></div></div></div>`).join('')
          :free.map(n=>`<div data-go="${n.uuid}" data-gn="${n.name}" class="etk"><div class="etb" style="width:3px;background:#10b981;transition:width .15s"></div><div style="flex:1;display:flex;align-items:center;gap:6px;padding:3px 8px;min-width:0"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.name}</div></div><div style="flex-shrink:0"><span class="etg" style="color:#10b981;background:#10b98110;border:1px solid #10b98125">Free</span></div></div></div>`).join('')}
        </div>
      </div>
    </div><div class="etr"><svg viewBox="0 0 16 16" style="width:100%;height:100%"><path d="M14 14L8 14L14 8Z" fill="currentColor"/></svg></div>`;
    dlg.querySelector('.etx').onclick=()=>closeD(assetOv);
    dlg.querySelectorAll('[data-tab]').forEach(el=>{el.addEventListener('click',()=>{assetTab=el.dataset.tab;re();});});
    addResize(dlg,ASSET_SIZE_KEY,re);
  }
  window._reA=re;re();
}


// ===== INIT =====
function init(){injectCSS();createBtn();
  document.addEventListener('click',function(e){
    const card=e.target.closest('[data-go]');
    if(!card)return;
    e.preventDefault();e.stopPropagation();
    const uuid=card.dataset.go,name=card.dataset.gn||'该节点';
    const overlay=document.createElement('div');
    overlay.className='eto';
    overlay.innerHTML='<div style="background:var(--card,#fff);border-radius:12px;padding:24px 32px;box-shadow:0 20px 40px rgba(0,0,0,.3);border:1px solid var(--border,#e5e7eb);text-align:center;animation:etUp .2s ease;max-width:360px"><div style="font-size:14px;font-weight:600;margin-bottom:16px">是否跳转到<br><span style=\"color:var(--primary,#6366f1);font-size:15px\">'+name+'</span><br>的详情页？</div><div style="display:flex;gap:10px;justify-content:center"><button onclick="this.closest(\'.eto\').remove()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--card,#fff);cursor:pointer;font-size:13px;transition:all .15s" onmouseover="this.style.background=\'var(--accent,#f1f5f9)\'" onmouseout="this.style.background=\'var(--card,#fff)\'">取消</button><button onclick="window.location.href=\'/instance/'+uuid+'\';this.closest(\'.eto\').remove();document.querySelectorAll(\'.eto\').forEach(e=>e.style.display=\'none\')" style="padding:8px 20px;border-radius:8px;border:none;background:var(--primary,#6366f1);color:#fff;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">确认跳转</button></div></div>';
    overlay.addEventListener('click',function(ev){if(ev.target===overlay)overlay.remove();});
    document.body.appendChild(overlay);
  });setInterval(()=>{if(!btnEl||!document.body.contains(btnEl))createBtn();},2000);setTimeout(fetchNodes,2000);setInterval(fetchNodes,30000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1500));
else setTimeout(init,1500);
})();