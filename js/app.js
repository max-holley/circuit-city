import { Workbench } from './workbench.js';
import { validateObjective } from './engine.js';
import { BUILDINGS, LEVELS, ACHIEVEMENTS, AVATARS, levelsFor, getLevel, buildingComplete, buildingUnlocked } from './levels.js';
import { loadSave, persist, exportSave, importSaveFile, resetSave } from './storage.js';

const DECORATION_REWARDS={house:['streetlights','Streetlights illuminated'],school:['trees','School garden lights'],cinema:['neon','Neon city banners'],observatory:['beacon','Observatory sky beacon']};
let save=loadSave();
let currentLevel=null,currentWorkbench=null,hintsUsed=0,hintIndex=0,labWorkbench=null;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function init(){
  bindNav(); bindDialogs(); bindSettings(); applySettings(); syncProgression(); renderAll(); initLab();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function bindNav(){
  $$('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>showScreen(btn.dataset.screen)));
  $('#homeBtn').addEventListener('click',()=>showScreen('city'));
  $('#avatarBtn').addEventListener('click',()=>showScreen('settings'));
}
function showScreen(name){
  $$('.screen').forEach(s=>s.classList.remove('active')); $(`#${name}Screen`)?.classList.add('active');
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
  if(name==='lab' && labWorkbench) setTimeout(()=>labWorkbench.renderWires(),0);
  $('#main').focus({preventScroll:true});
}

function renderAll(){renderStatus();renderCity();renderAchievements();renderSettings();renderSavedLabs();}
function renderStatus(){ $('#starCount').textContent=save.stars;$('#badgeCount').textContent=save.badges.length;$('#avatarIcon').textContent=save.avatar; }

function renderCity(){
  const done=LEVELS.filter(l=>save.completed[l.id]).length; const pct=Math.round(done/LEVELS.length*100);
  $('#cityPowerLabel').textContent=`${pct}%`;$('#powerMeterFill').style.width=`${pct}%`;$('.power-meter').setAttribute('aria-valuenow',String(pct));
  const map=$('#cityMap');map.innerHTML='';
  const scene=document.createElement('div'); scene.className='city-scene'; scene.setAttribute('aria-label','Restored city decorations');
  scene.innerHTML=`<span class="scene-skyline" aria-hidden="true">▂▅▃▇▆▃▅▇▂▆</span>${save.decorations.includes('streetlights')?'<span class="scene-deco lights" title="Restored streetlights">💡　💡　💡　💡</span>':''}${save.decorations.includes('trees')?'<span class="scene-deco trees" title="School garden lights">🌳　🌲　🌳</span>':''}${save.decorations.includes('neon')?'<span class="scene-deco neon" title="Neon banners">⚡ CIRCUIT CITY ⚡</span>':''}${save.decorations.includes('beacon')?'<span class="scene-deco beacon" title="Observatory beacon">🔭 ✦</span>':''}`;
  map.appendChild(scene);
  BUILDINGS.forEach((b,bi)=>{
    const levels=levelsFor(b.id),completed=levels.filter(l=>save.completed[l.id]).length,unlocked=buildingUnlocked(save,b),powered=buildingComplete(save,b);
    const card=document.createElement('article');card.className=`building ${powered?'powered':completed?'partial':''}`;card.dataset.building=b.id;card.tabIndex=unlocked?0:-1;card.setAttribute('aria-disabled',String(!unlocked));
    card.innerHTML=`${!unlocked?'<span class="building-lock">🔒 Locked</span>':''}<span class="building-icon" aria-hidden="true">${b.icon}</span><h2>${b.name}</h2><p>${powered?'Power restored!':unlocked?b.tag:'Restore the previous building first.'}</p><div class="level-dots">${levels.map((l,i)=>{const levelOpen=unlocked&&(i===0||!!save.completed[levels[i-1].id]);return `<button type="button" class="level-dot ${save.completed[l.id]?'done':''}" data-level="${l.id}" ${!levelOpen?'disabled':''} aria-label="${l.title}${!levelOpen?', locked until the previous puzzle is complete':save.completed[l.id]?`, completed with ${save.completed[l.id].stars} stars`:''}">${save.completed[l.id]?'★':levelOpen?i+1:'🔒'}</button>`}).join('')}</div><div class="building-progress"><span>${completed}/${levels.length} repairs</span><span>${powered?'⚡ ON':'○ OFF'}</span></div><span class="city-glow" aria-hidden="true"></span>`;
    card.querySelectorAll('[data-level]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openLevel(btn.dataset.level)}));
    const openNext=()=>{if(!unlocked)return;const next=levels.find(l=>!save.completed[l.id])||levels[0];openLevel(next.id)};
    card.addEventListener('click',e=>{if(!e.target.closest('button'))openNext()});card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();openNext()}});
    map.appendChild(card);
  });
}

function openLevel(id){
  const level=getLevel(id);if(!level)return;const building=BUILDINGS.find(b=>b.id===level.building);if(!buildingUnlocked(save,building))return;
  const siblings=levelsFor(level.building),idx=siblings.findIndex(l=>l.id===id);if(idx>0&&!save.completed[siblings[idx-1].id])return;
  currentLevel=level;hintsUsed=0;hintIndex=0;
  $('#levelBuilding').textContent=building.name;$('#levelTitle').textContent=level.title;$('#levelBrief').textContent=level.brief;$('#conceptCard').innerHTML=`<span aria-hidden="true">🧠</span><span>${level.concept}</span>`;
  $('#levelStarsPreview').textContent='★★★';displayFeedback('Connect the parts, then test your circuit.','neutral');
  currentWorkbench?.destroy();currentWorkbench=new Workbench($('#levelWorkbenchMount'),{circuit:level.circuit,inventory:level.inventory||[],obstacles:level.obstacles||[],freeBuild:false,onChange:(_,analysis)=>liveFeedback(analysis)});
  $('#levelDialog').showModal();
}

function liveFeedback(analysis){
  if(!currentLevel)return;
  if(analysis.shortCircuit) displayFeedback('Short circuit detected','bad','There is a direct conductive path between the battery terminals that bypasses the loads. Remove that route before testing.');
}
function displayFeedback(title,kind='neutral',text=''){
  const panel=$('#feedbackPanel');panel.className=`feedback-panel ${kind==='neutral'?'':kind}`;panel.innerHTML=`<strong>${title}</strong>${text?`<span>${text}</span>`:''}`;
}

function bindDialogs(){
  $('#hintBtn').addEventListener('click',()=>{
    if(!currentLevel)return;const hints=currentLevel.hints||['Trace the complete path carefully.'];const hint=hints[Math.min(hintIndex,hints.length-1)];hintIndex=Math.min(hintIndex+1,hints.length);hintsUsed=Math.min(2,hintsUsed+1);
    $('#levelStarsPreview').textContent='★'.repeat(Math.max(1,3-hintsUsed))+'☆'.repeat(Math.min(2,hintsUsed));displayFeedback('Hint','neutral',hint);playTone(440,.07);
  });
  $('#checkBtn').addEventListener('click',()=>{
    if(!currentLevel||!currentWorkbench)return;const result=validateObjective(currentWorkbench.getCircuit(),currentLevel.objective);
    if(result.ok){completeLevel(result.message);return;}
    const extra=result.analysis.warnings?.[0]?.text;displayFeedback('Not quite yet','bad',extra&&extra!==result.message?`${result.message} ${extra}`:result.message);playTone(180,.12);
  });
  $('#levelDialog').addEventListener('close',()=>{currentWorkbench?.destroy();currentWorkbench=null;currentLevel=null;});
  $('#rewardDialog').addEventListener('close',()=>{renderAll();showScreen('city')});
}

function completeLevel(message){
  const id=currentLevel.id;const old=save.completed[id]?.stars||0;const stars=Math.max(1,3-hintsUsed);save.completed[id]={stars:Math.max(old,stars),completedAt:new Date().toISOString()};save.stars+=Math.max(0,stars-old);
  const building=currentLevel.building;const unlocks=[];
  if(buildingComplete(save,building)){
    const badge=`${building}-badge`;if(!save.badges.includes(badge)){save.badges.push(badge);unlocks.push(BUILDINGS.find(b=>b.id===building)?.reward||'Building restored');}
    if(building==='toy-shop'&&!save.unlocks.includes('motor')){save.unlocks.push('motor');unlocks.push('Motor unlocked');}
    if(building==='arcade'&&!save.unlocks.includes('buzzer')){save.unlocks.push('buzzer');unlocks.push('Buzzer unlocked');}
    const deco=DECORATION_REWARDS[building];if(deco&&!save.decorations.includes(deco[0])){save.decorations.push(deco[0]);unlocks.push(deco[1]);}
    if(building==='museum'){
      for(const t of ['resistor','sample'])if(!save.unlocks.includes(t)){save.unlocks.push(t);unlocks.push(`${t==='sample'?'Material samples':'Resistor'} unlocked`);}
    }
  }
  syncProgression();persist(save);refreshLabPalette();playSuccess();
  const levelTitle=currentLevel.title;const buildingName=BUILDINGS.find(b=>b.id===building)?.name;
  $('#levelDialog').close();
  $('#rewardTitle').textContent=levelTitle;$('#rewardStars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('#rewardText').textContent=`${message} ${buildingComplete(save,building)?`${buildingName} is now fully powered!`: 'Another part of the city has lit up.'}`;
  $('#rewardUnlocks').innerHTML=unlocks.map(x=>`<span class="unlock-chip">🎁 ${x}</span>`).join('');$('#rewardDialog').showModal();renderStatus();
}

function syncProgression(){
  BUILDINGS.forEach(b=>{
    if(!buildingComplete(save,b.id)) return;
    const badge=`${b.id}-badge`; if(!save.badges.includes(badge)) save.badges.push(badge);
  });
  if(buildingComplete(save,'toy-shop')&&!save.unlocks.includes('motor')) save.unlocks.push('motor');
  if(buildingComplete(save,'arcade')&&!save.unlocks.includes('buzzer')) save.unlocks.push('buzzer');
  if(buildingComplete(save,'museum')) for(const t of ['resistor','sample']) if(!save.unlocks.includes(t)) save.unlocks.push(t);
  for(const [building,[id]] of Object.entries(DECORATION_REWARDS)) if(buildingComplete(save,building)&&!save.decorations.includes(id)) save.decorations.push(id);
  ACHIEVEMENTS.forEach(a=>{const unlocked=a.building?buildingComplete(save,a.building):a.test?.(save);if(unlocked&&!save.achievements.includes(a.id))save.achievements.push(a.id)});
  persist(save);
}
function renderAchievements(){
  const grid=$('#achievementsGrid');grid.innerHTML='';ACHIEVEMENTS.forEach(a=>{const unlocked=save.achievements.includes(a.id);const el=document.createElement('article');el.className=`achievement-card ${unlocked?'':'locked'}`;el.innerHTML=`<span class="achievement-icon" aria-hidden="true">${unlocked?a.icon:'🔒'}</span><div><h3>${a.name}</h3><p>${a.desc}</p></div>`;grid.appendChild(el)});
}

function initLab(){
  const initial={components:[],connections:[]};
  labWorkbench?.destroy();labWorkbench=new Workbench($('#labWorkbenchMount'),{circuit:initial,freeBuild:true,unlocks:save.unlocks,onChange:()=>{}});
  $('#newLabBtn').onclick=()=>labWorkbench.setCircuit(initial);
  $('#saveLabBtn').onclick=()=>saveLabCircuit();
}
function refreshLabPalette(){
  const current=labWorkbench?.getCircuit()||{components:[],connections:[]};labWorkbench?.destroy();labWorkbench=new Workbench($('#labWorkbenchMount'),{circuit:current,freeBuild:true,unlocks:save.unlocks,onChange:()=>{}});
}
function saveLabCircuit(){
  const circuit=labWorkbench.getCircuit();if(!circuit.components.length){toast('Add at least one component first.');return;}
  const name=(prompt('Name this experiment:','My Circuit')||'').trim();if(!name)return;
  save.sandbox.unshift({id:`lab-${Date.now()}`,name:name.slice(0,50),savedAt:new Date().toISOString(),circuit});save.sandbox=save.sandbox.slice(0,30);syncProgression();persist(save);renderAll();toast('Experiment saved locally.');
}
function renderSavedLabs(){
  const list=$('#savedLabList');if(!list)return;if(!save.sandbox.length){list.innerHTML='<p class="saved-empty">No saved experiments yet.</p>';return;}
  list.innerHTML=save.sandbox.map(s=>`<article class="saved-item"><h3>${escapeHtml(s.name)}</h3><div class="row"><button class="btn secondary" type="button" data-load-lab="${s.id}">Load</button><button class="btn secondary" type="button" data-delete-lab="${s.id}">Delete</button></div></article>`).join('');
  list.querySelectorAll('[data-load-lab]').forEach(b=>b.onclick=()=>{const item=save.sandbox.find(s=>s.id===b.dataset.loadLab);if(item){labWorkbench.setCircuit(item.circuit);showScreen('lab');}});
  list.querySelectorAll('[data-delete-lab]').forEach(b=>b.onclick=()=>{save.sandbox=save.sandbox.filter(s=>s.id!==b.dataset.deleteLab);persist(save);renderSavedLabs();});
}

function bindSettings(){
  $('#reducedMotionToggle').addEventListener('change',e=>updateSetting('reducedMotion',e.target.checked));
  $('#soundToggle').addEventListener('change',e=>updateSetting('sound',e.target.checked));
  $('#largeControlsToggle').addEventListener('change',e=>updateSetting('largeControls',e.target.checked));
  $('#exportSaveBtn').addEventListener('click',()=>exportSave(save));
  $('#importSaveInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{save=await importSaveFile(file);syncProgression();persist(save);applySettings();renderAll();refreshLabPalette();toast('Save imported.');}catch{toast('That file is not a valid Circuit City save.');}e.target.value='';});
  $('#resetSaveBtn').addEventListener('click',()=>{if(!confirm('Reset all Circuit City progress and saved lab circuits?'))return;save=resetSave();applySettings();renderAll();initLab();toast('Progress reset.');});
}
function updateSetting(key,value){save.settings[key]=value;persist(save);applySettings();}
function applySettings(){
  document.body.classList.toggle('reduced-motion',!!save.settings.reducedMotion);document.body.classList.toggle('large-controls',!!save.settings.largeControls);
  if($('#reducedMotionToggle'))$('#reducedMotionToggle').checked=!!save.settings.reducedMotion;if($('#soundToggle'))$('#soundToggle').checked=!!save.settings.sound;if($('#largeControlsToggle'))$('#largeControlsToggle').checked=!!save.settings.largeControls;
}
function renderSettings(){
  applySettings();const mount=$('#avatarChoices');mount.innerHTML='';AVATARS.forEach(a=>{const btn=document.createElement('button');btn.type='button';btn.className=`avatar-choice ${save.avatar===a.icon?'selected':''}`;btn.textContent=a.icon;btn.disabled=save.stars<a.stars;btn.title=btn.disabled?`Unlock at ${a.stars} stars`:a.label;btn.setAttribute('aria-label',btn.disabled?`${a.label}, locked until ${a.stars} stars`:a.label);btn.onclick=()=>{save.avatar=a.icon;persist(save);renderStatus();renderSettings();};mount.appendChild(btn)});
}

function playTone(freq,duration){
  if(!save.settings.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=freq;gain.gain.setValueAtTime(.05,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration);osc.onended=()=>ctx.close();}catch{}
}
function playSuccess(){playTone(523,.1);setTimeout(()=>playTone(659,.1),90);setTimeout(()=>playTone(784,.14),180)}
let toastTimer;function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

init();
