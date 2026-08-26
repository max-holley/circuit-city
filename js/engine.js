export const COMPONENT_DEFS = {
  battery: { name:'Battery', icon:'🔋', ports:['pos','neg'], role:'source', defaultProps:{ voltage:3 } },
  bulb: { name:'Bulb', icon:'💡', ports:['a','b'], role:'load', defaultProps:{ resistance:3 } },
  switch: { name:'Switch', icon:'⏻', ports:['a','b'], role:'control', defaultProps:{ closed:false } },
  motor: { name:'Motor', icon:'⚙️', ports:['a','b'], role:'load', defaultProps:{ resistance:4 } },
  buzzer: { name:'Buzzer', icon:'🔔', ports:['a','b'], role:'load', defaultProps:{ resistance:6 } },
  resistor: { name:'Resistor', icon:'〰️', ports:['a','b'], role:'load', defaultProps:{ resistance:3 } },
  sample: { name:'Material', icon:'🧱', ports:['a','b'], role:'material', defaultProps:{ conductive:false, material:'Rubber' } }
};

const terminal = (componentId, port) => `${componentId}:${port}`;
const isLoad = c => COMPONENT_DEFS[c.type]?.role === 'load';

class UnionFind {
  constructor(items=[]) { this.parent = new Map(items.map(i => [i,i])); }
  find(x) { if (!this.parent.has(x)) this.parent.set(x,x); const p=this.parent.get(x); if(p!==x) this.parent.set(x,this.find(p)); return this.parent.get(x); }
  union(a,b) { a=this.find(a); b=this.find(b); if(a!==b) this.parent.set(a,b); }
}

function safeComponents(circuit) {
  return (circuit.components || []).filter(c => COMPONENT_DEFS[c.type]).map(c => ({...c, props:{...COMPONENT_DEFS[c.type].defaultProps,...(c.props||{})}}));
}

function connectionValid(conn, compMap) {
  if (!conn || conn.faulty) return false;
  const ca=compMap.get(conn.a?.componentId), cb=compMap.get(conn.b?.componentId);
  if (!ca || !cb) return false;
  const pa=COMPONENT_DEFS[ca.type].ports, pb=COMPONENT_DEFS[cb.type].ports;
  if (!pa.includes(conn.a.port) || !pb.includes(conn.b.port)) return false;
  return terminal(conn.a.componentId,conn.a.port) !== terminal(conn.b.componentId,conn.b.port);
}

function buildDetailedGraph(components, connections, {includeLoads=true, forceSwitchesClosed=false}={}) {
  const compMap = new Map(components.map(c=>[c.id,c]));
  const graph = new Map();
  const addNode = n => { if(!graph.has(n)) graph.set(n,[]); };
  const addEdge = (a,b,meta) => { addNode(a); addNode(b); graph.get(a).push({to:b,...meta}); graph.get(b).push({to:a,...meta}); };
  components.forEach(c => COMPONENT_DEFS[c.type].ports.forEach(p=>addNode(terminal(c.id,p))));
  connections.forEach(conn => {
    if(connectionValid(conn,compMap)) addEdge(terminal(conn.a.componentId,conn.a.port),terminal(conn.b.componentId,conn.b.port),{kind:'wire',id:conn.id});
  });
  components.forEach(c => {
    const [p1,p2]=COMPONENT_DEFS[c.type].ports;
    if(c.type==='switch' && (forceSwitchesClosed || c.props.closed)) addEdge(terminal(c.id,p1),terminal(c.id,p2),{kind:'component',id:c.id,type:c.type});
    else if(c.type==='sample' && c.props.conductive) addEdge(terminal(c.id,p1),terminal(c.id,p2),{kind:'component',id:c.id,type:c.type});
    else if(includeLoads && isLoad(c)) addEdge(terminal(c.id,p1),terminal(c.id,p2),{kind:'component',id:c.id,type:c.type});
  });
  return graph;
}

function enumeratePaths(graph,start,end,maxPaths=180) {
  const paths=[];
  if(!graph.has(start)||!graph.has(end)) return paths;
  const visited=new Set([start]);
  const edgePath=[];
  const nodePath=[start];
  function dfs(node){
    if(paths.length>=maxPaths) return;
    if(node===end){ paths.push({edges:[...edgePath],nodes:[...nodePath]}); return; }
    for(const e of graph.get(node)||[]){
      if(visited.has(e.to)) continue;
      visited.add(e.to); edgePath.push(e); nodePath.push(e.to);
      dfs(e.to);
      nodePath.pop(); edgePath.pop(); visited.delete(e.to);
    }
  }
  dfs(start);
  return paths;
}

function buildNets(components, connections) {
  const compMap=new Map(components.map(c=>[c.id,c]));
  const terms=[];
  components.forEach(c=>COMPONENT_DEFS[c.type].ports.forEach(p=>terms.push(terminal(c.id,p))));
  const uf=new UnionFind(terms);
  connections.forEach(conn=>{
    if(connectionValid(conn,compMap)) uf.union(terminal(conn.a.componentId,conn.a.port),terminal(conn.b.componentId,conn.b.port));
  });
  components.forEach(c=>{
    const [p1,p2]=COMPONENT_DEFS[c.type].ports;
    if(c.type==='switch'&&c.props.closed) uf.union(terminal(c.id,p1),terminal(c.id,p2));
    if(c.type==='sample'&&c.props.conductive) uf.union(terminal(c.id,p1),terminal(c.id,p2));
  });
  const net = t => uf.find(t);
  const edges=[];
  components.filter(isLoad).forEach(c=>{
    const [a,b]=COMPONENT_DEFS[c.type].ports;
    edges.push({id:c.id,type:c.type,a:net(terminal(c.id,a)),b:net(terminal(c.id,b))});
  });
  return {net,edges};
}

function netPaths(edges,start,end,maxPaths=120){
  const graph=new Map();
  const add=(n,e)=>{if(!graph.has(n))graph.set(n,[]);graph.get(n).push(e)};
  edges.forEach(e=>{add(e.a,{to:e.b,id:e.id,type:e.type});add(e.b,{to:e.a,id:e.id,type:e.type})});
  return enumeratePaths(graph,start,end,maxPaths);
}

export function analyzeCircuit(circuit={components:[],connections:[]}) {
  const components=safeComponents(circuit);
  const connections=(circuit.connections||[]).map((c,i)=>({...c,id:c.id||`wire-${i+1}`}));
  const compMap=new Map(components.map(c=>[c.id,c]));
  const batteries=components.filter(c=>c.type==='battery');
  const activeComponents=new Set();
  const activeConnections=new Set();
  const activePathSets=[];
  const warnings=[];
  const detailed=buildDetailedGraph(components,connections,{includeLoads:true});
  const noLoadGraph=buildDetailedGraph(components,connections,{includeLoads:false});
  let shortCircuit=false;
  let closedCircuit=false;
  let capped=false;

  for(const battery of batteries){
    const start=terminal(battery.id,'pos'), end=terminal(battery.id,'neg');
    if(enumeratePaths(noLoadGraph,start,end,1).length){ shortCircuit=true; continue; }
    const paths=enumeratePaths(detailed,start,end);
    if(paths.length>=180) capped=true;
    if(paths.length){
      closedCircuit=true;
      activeComponents.add(battery.id);
      paths.forEach(path=>{
        const compIds=new Set();
        path.edges.forEach(e=>{
          if(e.kind==='wire') activeConnections.add(e.id);
          if(e.kind==='component'){ activeComponents.add(e.id); compIds.add(e.id); }
        });
        activePathSets.push(compIds);
      });
    }
  }

  if(batteries.length===0) warnings.push({code:'missing-source',text:'There is no battery. A circuit needs a source of electrical energy.'});
  if(shortCircuit) warnings.push({code:'short',text:'A wire-only path links the battery terminals. That is a short circuit, so this build is treated as unsafe and will not power the devices.'});
  if(!shortCircuit && batteries.length && !closedCircuit){
    const faulty=connections.some(c=>c.faulty);
    const openSwitch=components.some(c=>c.type==='switch'&&!c.props.closed);
    if(faulty) warnings.push({code:'faulty-wire',text:'A dashed red wire is faulty. Remove it and make a sound connection.'});
    else if(openSwitch) warnings.push({code:'open-switch',text:'At least one switch is open. An open switch breaks that path, so current cannot flow through it.'});
    else warnings.push({code:'open-circuit',text:'The loop is incomplete. Trace a continuous path from battery +, through a device, and back to battery −.'});
  }
  if(capped) warnings.push({code:'complex',text:'This circuit has many possible paths. The lab has limited path tracing to keep the game responsive.'});

  const nets=buildNets(components,connections);
  const batteryTopologies=[];
  for(const b of batteries){
    const start=nets.net(terminal(b.id,'pos')), end=nets.net(terminal(b.id,'neg'));
    batteryTopologies.push({batteryId:b.id, paths:start===end?[]:netPaths(nets.edges,start,end)});
  }
  const topologyPaths=batteryTopologies.flatMap(x=>x.paths);

  return {
    components, connections, closedCircuit: closedCircuit&&!shortCircuit, shortCircuit,
    activeComponentIds:[...activeComponents], activeConnectionIds:[...activeConnections],
    warnings, topologyPaths, nets, activePathSets
  };
}

export function classifyLoads(analysis, componentType) {
  const targets=analysis.components.filter(c=>c.type===componentType && analysis.activeComponentIds.includes(c.id));
  if(targets.length<2) return {mode:'single',count:targets.length};
  const edges=analysis.nets.edges.filter(e=>e.type===componentType && targets.some(t=>t.id===e.id));
  const pairs=edges.map(e=>[e.a,e.b].sort().join('|'));
  if(new Set(pairs).size===1) return {mode:'parallel',count:targets.length};
  const paths=analysis.topologyPaths.map(p=>new Set(p.edges.filter(e=>e.type===componentType).map(e=>e.id)));
  const targetIds=targets.map(t=>t.id);
  if(paths.length && paths.every(set=>targetIds.every(id=>set.has(id)))) return {mode:'series',count:targets.length};
  return {mode:'mixed',count:targets.length};
}

export function allActivePathsIncludeType(analysis,type){
  const paths=analysis.activePathSets;
  if(!paths.length) return false;
  return paths.every(set=>[...set].some(id=>analysis.components.find(c=>c.id===id)?.type===type));
}

export function validateObjective(circuit, objective) {
  const analysis=analyzeCircuit(circuit);
  const fail=(message)=>({ok:false,message,analysis});
  if(analysis.shortCircuit) return fail('That creates a short circuit. Remove the direct wire-only route between + and −.');
  if(!objective) return {ok:analysis.closedCircuit,message:analysis.closedCircuit?'Circuit is working.':'The circuit is not complete yet.',analysis};
  if(objective.requiresClosed!==false && !analysis.closedCircuit) return fail(analysis.warnings[0]?.text || 'Complete the circuit first.');

  const active=new Set(analysis.activeComponentIds);
  const comps=analysis.components;
  if(objective.powerIds){
    const missing=objective.powerIds.filter(id=>!active.has(id));
    if(missing.length) return fail(`Not every required device is powered yet. Check the path to ${missing.join(', ')}.`);
  }
  if(objective.powerType){
    const needed=objective.count||1;
    const n=comps.filter(c=>c.type===objective.powerType&&active.has(c.id)).length;
    if(n<needed) return fail(`Power ${needed} ${COMPONENT_DEFS[objective.powerType].name.toLowerCase()}${needed>1?'s':''} at the same time.`);
  }
  if(objective.activeType){
    const n=comps.filter(c=>c.type===objective.activeType&&active.has(c.id)).length;
    if(n<(objective.activeCount||1)) return fail(`The working path must include a ${COMPONENT_DEFS[objective.activeType].name.toLowerCase()}.`);
  }
  if(objective.topology){
    const info=classifyLoads(analysis,objective.topology.componentType);
    if(info.count<(objective.topology.count||2)) return fail(`Power ${objective.topology.count||2} ${COMPONENT_DEFS[objective.topology.componentType].name.toLowerCase()}s first.`);
    if(info.mode!==objective.topology.mode) return fail(`Those devices are arranged as ${info.mode}. Reconnect them as a ${objective.topology.mode} circuit.`);
  }
  if(objective.allPathsIncludeType && !allActivePathsIncludeType(analysis,objective.allPathsIncludeType)){
    return fail(`Every powered branch must pass through the ${COMPONENT_DEFS[objective.allPathsIncludeType].name.toLowerCase()}. Put it before the branches split (or after they rejoin).`);
  }
  if(objective.componentProp){
    const {type,prop,value,activeOnly=true}=objective.componentProp;
    const found=comps.some(c=>c.type===type&&c.props?.[prop]===value&&(!activeOnly||active.has(c.id)));
    if(!found) return fail(`Choose the ${COMPONENT_DEFS[type].name.toLowerCase()} with ${prop} = ${value}.`);
  }
  if(objective.material){
    const found=comps.some(c=>c.type==='sample'&&c.props.material===objective.material&&active.has(c.id));
    if(!found) return fail(`Use the ${objective.material} sample as part of the working path.`);
  }
  return {ok:true,message:objective.success||'Great work — the circuit meets the mission!',analysis};
}

export function describeComponent(c){
  const def=COMPONENT_DEFS[c.type];
  if(!def) return '';
  if(c.type==='battery') return `${c.props?.voltage??3} V battery`;
  if(c.type==='resistor') return `${c.props?.resistance??3} Ω resistor`;
  if(c.type==='sample') return `${c.props?.material||'Material'} (${c.props?.conductive?'conductor':'insulator'})`;
  if(c.type==='switch') return `${c.props?.closed?'Closed':'Open'} switch`;
  return c.label||def.name;
}
