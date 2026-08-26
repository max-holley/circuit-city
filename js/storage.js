const KEY='circuit-city-save-v1';
export const SAVE_VERSION=1;

export const DEFAULT_SAVE={
  version:SAVE_VERSION,
  completed:{}, stars:0, badges:[], unlocks:['battery','bulb','switch'], decorations:[], achievements:[], sandbox:[],
  settings:{reducedMotion:false,sound:true,largeControls:false}, avatar:'🧑‍🔧'
};

function clone(v){return JSON.parse(JSON.stringify(v));}
export function loadSave(){
  try{
    const raw=localStorage.getItem(KEY); if(!raw) return clone(DEFAULT_SAVE);
    const parsed=JSON.parse(raw);
    return sanitizeSave(parsed);
  }catch{ return clone(DEFAULT_SAVE); }
}
export function sanitizeSave(data){
  const base=clone(DEFAULT_SAVE);
  if(!data||typeof data!=='object') return base;
  base.completed={};
  if(data.completed&&typeof data.completed==='object'){
    for(const [id,v] of Object.entries(data.completed)){
      if(!v||typeof v!=='object') continue;
      const stars=Math.max(1,Math.min(3,Math.floor(Number(v.stars)||1)));
      base.completed[id]={stars,completedAt:typeof v.completedAt==='string'?v.completedAt:new Date(0).toISOString()};
    }
  }
  base.stars=Object.values(base.completed).reduce((sum,v)=>sum+(v.stars||0),0);
  base.badges=Array.isArray(data.badges)?[...new Set(data.badges.filter(x=>typeof x==='string'))]:[];
  base.unlocks=Array.isArray(data.unlocks)?[...new Set([...DEFAULT_SAVE.unlocks,...data.unlocks.filter(x=>typeof x==='string')])]:[...DEFAULT_SAVE.unlocks];
  base.decorations=Array.isArray(data.decorations)?[...new Set(data.decorations.filter(x=>typeof x==='string'))]:[];
  base.achievements=Array.isArray(data.achievements)?[...new Set(data.achievements.filter(x=>typeof x==='string'))]:[];
  base.sandbox=Array.isArray(data.sandbox)?data.sandbox.filter(x=>x&&typeof x==='object'&&x.circuit&&Array.isArray(x.circuit.components)&&Array.isArray(x.circuit.connections)).slice(0,30):[];
  const incoming=data.settings&&typeof data.settings==='object'?data.settings:{};
  base.settings={reducedMotion:!!incoming.reducedMotion,sound:incoming.sound!==false,largeControls:!!incoming.largeControls};
  base.avatar=typeof data.avatar==='string'?data.avatar:base.avatar;
  return base;
}
export function persist(save){ localStorage.setItem(KEY,JSON.stringify({...save,version:SAVE_VERSION})); }
export function exportSave(save){
  const blob=new Blob([JSON.stringify({...save,version:SAVE_VERSION,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='circuit-city-save.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
}
export async function importSaveFile(file){
  const text=await file.text(); const parsed=JSON.parse(text); return sanitizeSave(parsed);
}
export function resetSave(){ localStorage.removeItem(KEY); return clone(DEFAULT_SAVE); }
