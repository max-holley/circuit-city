import { COMPONENT_DEFS, analyzeCircuit, describeComponent } from './engine.js';

const clone=v=>JSON.parse(JSON.stringify(v));
const portSide=(type,port)=> (type==='battery'&&port==='pos')||port==='a' ? 'left':'right';
const portLabel=(type,port)=> type==='battery' ? (port==='pos'?'positive':'negative') : (port==='a'?'left terminal':'right terminal');

export class Workbench {
  constructor(mount,{circuit={components:[],connections:[]},inventory=[],obstacles=[],freeBuild=false,unlocks=[],onChange=()=>{}}={}){
    this.mount=mount; this.initial=clone(circuit); this.circuit=clone(circuit); this.inventory=clone(inventory); this.obstacles=clone(obstacles);
    this.freeBuild=freeBuild; this.unlocks=unlocks; this.onChange=onChange; this.selectedPort=null; this.selectedComponent=null; this.wireSeq=1; this.compSeq=1;
    this.cols=8; this.rows=6; this.drag=null; this.resizeObserver=null;
    this.render();
  }
  destroy(){ this.resizeObserver?.disconnect(); }
  getCircuit(){ return clone(this.circuit); }
  setCircuit(circuit){ this.initial=clone(circuit); this.circuit=clone(circuit); this.selectedPort=null; this.selectedComponent=null; this.render(); this.changed(); }
  reset(){ this.circuit=clone(this.initial); this.selectedPort=null; this.selectedComponent=null; this.render(); this.changed(); }
  changed(){ this.refreshAnalysis(); this.renderPaletteState(); this.renderInspector(); this.renderWires(); this.onChange(this.getCircuit(),this.analysis); }
  paletteItems(){
    if(!this.freeBuild) return this.inventory;
    const base=[];
    const add=(type,label,props={})=>{ if(this.unlocks.includes(type)) base.push({type,label,props,count:Infinity}); };
    add('battery','3 V Battery',{voltage:3}); add('bulb','Bulb'); add('switch','Switch',{closed:false}); add('motor','Motor'); add('buzzer','Buzzer');
    if(this.unlocks.includes('resistor')){base.push({type:'resistor',label:'3 Ω',props:{resistance:3},count:Infinity});base.push({type:'resistor',label:'6 Ω',props:{resistance:6},count:Infinity});}
    if(this.unlocks.includes('sample')){base.push({type:'sample',label:'Copper',props:{material:'Copper',conductive:true},count:Infinity});base.push({type:'sample',label:'Rubber',props:{material:'Rubber',conductive:false},count:Infinity});}
    return base;
  }
  render(){
    this.mount.innerHTML=`<div class="workbench-shell">
      <aside class="palette"><h3>Parts tray</h3><div class="palette-grid" data-role="palette"></div><ul class="help-list"><li>Tap a part to add it.</li><li>Tap one terminal, then another, to connect a wire.</li><li>Tap a switch to open or close it.</li><li>Drag components to rearrange the bench.</li></ul></aside>
      <div class="workbench" data-role="board" aria-label="Circuit workbench"></div>
      <aside class="inspector" data-role="inspector"></aside>
    </div>`;
    this.board=this.mount.querySelector('[data-role="board"]'); this.palette=this.mount.querySelector('[data-role="palette"]'); this.inspector=this.mount.querySelector('[data-role="inspector"]');
    this.renderObstacles(); this.renderComponents(); this.renderPalette(); this.refreshAnalysis(); this.renderInspector(); this.renderWires();
    this.resizeObserver?.disconnect(); this.resizeObserver=new ResizeObserver(()=>this.renderWires()); this.resizeObserver.observe(this.board);
  }
  renderObstacles(){
    this.obstacles.forEach(o=>{
      const el=document.createElement('div'); el.className='obstacle'; el.textContent=o.label||'BLOCKED';
      el.style.left=`${o.x/this.cols*100}%`;el.style.top=`${o.y/this.rows*100}%`;el.style.width=`${o.w/this.cols*100}%`;el.style.height=`${o.h/this.rows*100}%`;
      this.board.appendChild(el);
    });
  }
  componentAt(id){return this.circuit.components.find(c=>c.id===id)}
  renderComponents(){
    this.circuit.components.forEach(comp=>{
      const def=COMPONENT_DEFS[comp.type]; if(!def)return;
      const wrap=document.createElement('div'); wrap.className=`component${comp.faulty?' faulty':''}`;wrap.dataset.componentId=comp.id;wrap.dataset.type=comp.type;
      wrap.style.left=`${(comp.x+.5)/this.cols*100}%`;wrap.style.top=`${(comp.y+.5)/this.rows*100}%`;
      const core=document.createElement('button'); core.type='button';core.className='component-core';core.dataset.action='component';core.dataset.componentId=comp.id;
      core.setAttribute('aria-label',describeComponent({...comp,props:{...def.defaultProps,...(comp.props||{})}}));
      const detail=comp.type==='battery'?`${comp.props?.voltage??3} V`:comp.type==='resistor'?`${comp.props?.resistance??3} Ω`:comp.type==='sample'?(comp.props?.material||'Sample'):def.name;
      core.innerHTML=`<span class="symbol" aria-hidden="true">${def.icon}</span><span>${detail}</span><span class="state-mark" data-role="state-mark"></span>`;
      wrap.appendChild(core);
      def.ports.forEach((p,i)=>{
        const btn=document.createElement('button');btn.type='button';btn.className=`port ${i===0?'left':'right'} ${comp.type==='battery'?(p==='pos'?'positive':'negative'):''}`;btn.dataset.action='port';btn.dataset.componentId=comp.id;btn.dataset.port=p;
        btn.setAttribute('aria-label',`${describeComponent({...comp,props:{...def.defaultProps,...(comp.props||{})}})} ${portLabel(comp.type,p)}`);wrap.appendChild(btn);
      });
      this.board.appendChild(wrap);
    });
    this.board.addEventListener('click',e=>this.handleBoardClick(e));
    this.board.addEventListener('pointerdown',e=>this.handlePointerDown(e));
    this.board.addEventListener('pointermove',e=>this.handlePointerMove(e));
    this.board.addEventListener('pointerup',e=>this.handlePointerUp(e));
    this.board.addEventListener('pointercancel',e=>this.handlePointerUp(e));
  }
  renderPalette(){
    this.palette.innerHTML='';
    this.paletteItems().forEach((item,index)=>{
      const def=COMPONENT_DEFS[item.type]; const btn=document.createElement('button');btn.type='button';btn.className='palette-item';btn.dataset.paletteIndex=index;
      btn.innerHTML=`<span aria-hidden="true">${def.icon}</span>${item.label||def.name}<small data-count></small>`;btn.addEventListener('click',()=>this.addFromPalette(index));this.palette.appendChild(btn);
    });
    this.renderPaletteState();
  }
  renderPaletteState(){
    if(!this.palette)return; const items=this.paletteItems();
    [...this.palette.querySelectorAll('.palette-item')].forEach((btn,index)=>{
      const item=items[index]; if(!item)return;
      const used=this.circuit.components.filter(c=>c.paletteIndex===index).length; const remain=item.count===Infinity?Infinity:Math.max(0,(item.count??1)-used);
      btn.disabled=remain===0; const count=btn.querySelector('[data-count]'); if(count) count.textContent=remain===Infinity?'':` ×${remain}`;
    });
  }
  nextOpenCell(){
    const occupied=new Set(this.circuit.components.map(c=>`${c.x},${c.y}`));
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
      if(occupied.has(`${x},${y}`)||this.cellBlocked(x,y))continue; return {x,y};
    }
    return {x:Math.floor(Math.random()*this.cols),y:Math.floor(Math.random()*this.rows)};
  }
  cellBlocked(x,y){return this.obstacles.some(o=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h)}
  addFromPalette(index){
    const item=this.paletteItems()[index]; if(!item)return;
    if(!this.freeBuild){const used=this.circuit.components.filter(c=>c.paletteIndex===index).length;if(used>=(item.count??1))return;}
    const pos=this.nextOpenCell(); const id=`${item.type}-${Date.now().toString(36)}-${this.compSeq++}`;
    this.circuit.components.push({id,type:item.type,x:pos.x,y:pos.y,props:{...COMPONENT_DEFS[item.type].defaultProps,...(item.props||{})},label:item.label,paletteIndex:index});
    this.render(); this.selectedComponent=id; this.changed();
  }
  handleBoardClick(e){
    if(this.ignoreClickOnce){ this.ignoreClickOnce=false; return; }
    const port=e.target.closest('[data-action="port"]');
    if(port){e.stopPropagation();this.choosePort(port.dataset.componentId,port.dataset.port);return;}
    const core=e.target.closest('[data-action="component"]');
    if(core){
      const id=core.dataset.componentId; this.selectedComponent=id; const c=this.componentAt(id);
      if(c?.type==='switch'){c.props={...COMPONENT_DEFS.switch.defaultProps,...(c.props||{}),closed:!(c.props?.closed??false)};}
      this.selectedPort=null; this.changed(); return;
    }
  }
  choosePort(componentId,port){
    const next={componentId,port};
    if(!this.selectedPort){this.selectedPort=next;this.renderPortSelection();return;}
    if(this.selectedPort.componentId===componentId&&this.selectedPort.port===port){this.selectedPort=null;this.renderPortSelection();return;}
    const duplicate=this.circuit.connections.some(c=>!c.faulty&&((c.a.componentId===this.selectedPort.componentId&&c.a.port===this.selectedPort.port&&c.b.componentId===componentId&&c.b.port===port)||(c.b.componentId===this.selectedPort.componentId&&c.b.port===this.selectedPort.port&&c.a.componentId===componentId&&c.a.port===port)));
    if(!duplicate){this.circuit.connections.push({id:`wire-${Date.now().toString(36)}-${this.wireSeq++}`,a:{...this.selectedPort},b:next});}
    this.selectedPort=null;this.changed();
  }
  renderPortSelection(){
    this.mount.querySelectorAll('.port').forEach(p=>p.classList.toggle('selected',!!this.selectedPort&&p.dataset.componentId===this.selectedPort.componentId&&p.dataset.port===this.selectedPort.port));
  }
  handlePointerDown(e){
    const core=e.target.closest('[data-action="component"]'); if(!core||e.button>0)return;
    const c=this.componentAt(core.dataset.componentId); if(!c)return;
    this.drag={id:c.id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};
    core.setPointerCapture?.(e.pointerId);
  }
  handlePointerMove(e){
    if(!this.drag||this.drag.pointerId!==e.pointerId)return;
    if(Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)<7&&!this.drag.moved)return;
    this.drag.moved=true; const rect=this.board.getBoundingClientRect();
    let x=Math.floor((e.clientX-rect.left)/rect.width*this.cols);let y=Math.floor((e.clientY-rect.top)/rect.height*this.rows);
    x=Math.max(0,Math.min(this.cols-1,x));y=Math.max(0,Math.min(this.rows-1,y));
    if(this.cellBlocked(x,y)||this.circuit.components.some(other=>other.id!==this.drag.id&&other.x===x&&other.y===y))return;
    const c=this.componentAt(this.drag.id);if(!c)return;c.x=x;c.y=y;
    const el=this.board.querySelector(`[data-component-id="${CSS.escape(c.id)}"].component`);if(el){el.style.left=`${(x+.5)/this.cols*100}%`;el.style.top=`${(y+.5)/this.rows*100}%`;}
    this.renderWires();
  }
  handlePointerUp(e){ if(!this.drag||this.drag.pointerId!==e.pointerId)return;const moved=this.drag.moved;this.drag=null;if(moved){this.ignoreClickOnce=true;setTimeout(()=>{this.ignoreClickOnce=false},120);e.preventDefault();this.changed();} }
  removeConnection(id){this.circuit.connections=this.circuit.connections.filter(c=>c.id!==id);this.changed()}
  removeSelected(){
    const c=this.componentAt(this.selectedComponent); if(!c||c.locked)return;
    this.circuit.components=this.circuit.components.filter(x=>x.id!==c.id);this.circuit.connections=this.circuit.connections.filter(w=>w.a.componentId!==c.id&&w.b.componentId!==c.id);this.selectedComponent=null;this.render();this.changed();
  }
  refreshAnalysis(){
    this.analysis=analyzeCircuit(this.circuit); const active=new Set(this.analysis.activeComponentIds);
    this.mount.querySelectorAll('.component').forEach(el=>{
      const c=this.componentAt(el.dataset.componentId);if(!c)return;const powered=active.has(c.id)&&['bulb','motor','buzzer'].includes(c.type);const core=el.querySelector('.component-core');
      core.classList.toggle('active',powered);core.classList.toggle('closed',c.type==='switch'&&!!c.props?.closed);
      const mark=core.querySelector('[data-role="state-mark"]');if(mark){mark.textContent=powered?'⚡ powered':c.type==='switch'?(c.props?.closed?'closed':'open'):'';}
      core.setAttribute('aria-label',`${describeComponent({...c,props:{...COMPONENT_DEFS[c.type].defaultProps,...(c.props||{})}})}${powered?', powered':''}`);
    });
    this.renderPortSelection();
  }
  componentName(id){const c=this.componentAt(id);return c?`${c.label||COMPONENT_DEFS[c.type].name}`:id}
  renderInspector(){
    if(!this.inspector)return; const a=this.analysis||analyzeCircuit(this.circuit); const selected=this.componentAt(this.selectedComponent);
    const status=a.shortCircuit?'⚠️ Short circuit':a.closedCircuit?'⚡ Circuit working':'○ Circuit open';
    const statusText=a.shortCircuit?'A direct conductive route bypasses the loads.':a.closedCircuit?`${a.activeComponentIds.filter(id=>['bulb','motor','buzzer'].includes(this.componentAt(id)?.type)).length} output device(s) powered.`:(a.warnings[0]?.text||'Connect a complete loop.');
    this.inspector.innerHTML=`<h3>${status}</h3><p class="diag">${statusText}</p>
      ${selected?`<div class="connection-item"><span><strong>Selected:</strong> ${describeComponent({...selected,props:{...COMPONENT_DEFS[selected.type].defaultProps,...(selected.props||{})}})}</span>${selected.locked?'':'<button type="button" data-action="remove-component" aria-label="Remove selected component">✕</button>'}</div>`:''}
      <h3 style="margin-top:12px">Connections</h3><div class="connection-list">${this.circuit.connections.length?this.circuit.connections.map(conn=>`<div class="connection-item"><span>${conn.faulty?'⚠️ ':''}${this.componentName(conn.a.componentId)} → ${this.componentName(conn.b.componentId)}</span><button type="button" data-wire="${conn.id}" aria-label="Remove connection">✕</button></div>`).join(''):'<p class="diag">No wires yet.</p>'}</div>
      <button class="btn secondary" style="width:100%;margin-top:10px" type="button" data-action="reset">Reset bench</button>`;
    this.inspector.querySelectorAll('[data-wire]').forEach(b=>b.addEventListener('click',()=>this.removeConnection(b.dataset.wire)));
    this.inspector.querySelector('[data-action="remove-component"]')?.addEventListener('click',()=>this.removeSelected());
    this.inspector.querySelector('[data-action="reset"]')?.addEventListener('click',()=>this.reset());
  }
  renderWires(){
    if(!this.board)return; this.board.querySelector('.wire-layer')?.remove(); const rect=this.board.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('wire-layer');svg.setAttribute('aria-hidden','true');
    const active=new Set(this.analysis?.activeConnectionIds||[]);
    const boardRect=this.board.getBoundingClientRect();
    const point=(ep)=>{const el=this.board.querySelector(`.port[data-component-id="${CSS.escape(ep.componentId)}"][data-port="${CSS.escape(ep.port)}"]`);if(!el)return null;const r=el.getBoundingClientRect();return{x:r.left+r.width/2-boardRect.left,y:r.top+r.height/2-boardRect.top}};
    this.circuit.connections.forEach(conn=>{
      const a=point(conn.a),b=point(conn.b);if(!a||!b)return;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',this.routePath(a,b,boardRect));
      path.setAttribute('class',`wire-visible${active.has(conn.id)&&!conn.faulty?' wire-active':''}${conn.faulty?' wire-faulty':''}`);svg.appendChild(path);
    });
    this.board.prepend(svg);
  }
  routePath(a,b,boardRect){
    const obstacles=[...this.board.querySelectorAll('.obstacle')].map(el=>{const r=el.getBoundingClientRect();return{left:r.left-boardRect.left,right:r.right-boardRect.left,top:r.top-boardRect.top,bottom:r.bottom-boardRect.top}});
    const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
    const hit=obstacles.find(o=>o.right>minX&&o.left<maxX&&o.bottom>minY&&o.top<maxY);
    if(hit){const above=Math.max(12,hit.top-18),below=Math.min(boardRect.height-12,hit.bottom+18);const y=Math.abs(a.y-above)+Math.abs(b.y-above)<=Math.abs(a.y-below)+Math.abs(b.y-below)?above:below;const x1=(a.x+hit.left)/2,x2=(b.x+hit.right)/2;return`M ${a.x} ${a.y} L ${x1} ${a.y} L ${x1} ${y} L ${x2} ${y} L ${x2} ${b.y} L ${b.x} ${b.y}`;}
    const mid=(a.x+b.x)/2;return`M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  }
}
