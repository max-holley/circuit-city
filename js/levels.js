const c=(id,type,x,y,props={},extra={})=>({id,type,x,y,props,...extra});
const w=(id,a,ap,b,bp,extra={})=>({id,a:{componentId:a,port:ap},b:{componentId:b,port:bp},...extra});

export const BUILDINGS=[
  {id:'house',name:'Home Row House',icon:'🏠',tag:'Start here',unlock:null,reward:'Junior Fixer badge'},
  {id:'toy-shop',name:'Rocket Toy Shop',icon:'🧸',tag:'Motors & multiple devices',unlock:'house',reward:'Motor component'},
  {id:'school',name:'Spark School',icon:'🏫',tag:'Parallel circuits',unlock:'toy-shop',reward:'Circuit Detective badge'},
  {id:'arcade',name:'Pixel Arcade',icon:'🕹️',tag:'Branches & buzzers',unlock:'school',reward:'Buzzer component'},
  {id:'cinema',name:'Neon Cinema',icon:'🎬',tag:'Series vs parallel',unlock:'arcade',reward:'Master Connector badge'},
  {id:'museum',name:'Science Museum',icon:'🔬',tag:'Resistance & materials',unlock:'cinema',reward:'Resistor + test samples'},
  {id:'observatory',name:'Sky Observatory',icon:'🔭',tag:'Voltage & resistance',unlock:'museum',reward:'Voltage Explorer badge'},
  {id:'theme-park',name:'Nova Theme Park',icon:'🎡',tag:'Grand city circuits',unlock:'observatory',reward:'City Power Champion'}
];

export const LEVELS=[
  {
    id:'house-1',building:'house',title:'First Light',brief:'The porch is dark. Connect the battery to the bulb and back again to make one complete loop.',
    concept:'A working circuit is a closed loop. Current has a continuous path from one battery terminal, through the bulb, and back to the other terminal.',
    hints:['A bulb needs two connections — one on each side.','Try battery + → bulb, then the other side of the bulb → battery −.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('lamp','bulb',5,3,{}, {locked:true})],connections:[]},
    objective:{powerIds:['lamp'],success:'The bulb has a complete path, so current can flow through it.'}
  },
  {
    id:'house-2',building:'house',title:'Switch on the Hall',brief:'Add the switch to the loop. Close it so the hall lamp can be turned on safely.',
    concept:'A closed switch completes its part of the path. An open switch makes a gap, so current stops.',
    hints:['The switch belongs in the same loop as the bulb.','Connect battery + → switch → bulb → battery −, then close the switch.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('sw','switch',3,3,{closed:false},{locked:true}),c('lamp','bulb',6,3,{}, {locked:true})],connections:[]},
    objective:{powerIds:['lamp'],activeType:'switch',success:'The closed switch is part of the complete loop and controls the lamp.'}
  },
  {
    id:'toy-1',building:'toy-shop',title:'Wind-up Window',brief:'The toy rocket display needs its motor. Build a complete motor circuit.',
    concept:'A motor is a load: it transfers electrical energy into movement. It still needs a complete circuit.',
    hints:['Treat the motor like the bulb from the first building.','Connect both motor terminals into one complete loop with the battery.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('motor','motor',5,3,{}, {locked:true})],connections:[]},
    objective:{powerIds:['motor'],success:'Electrical energy is being transferred to the motor, so the display can move.'}
  },
  {
    id:'toy-2',building:'toy-shop',title:'Two Toy Windows',brief:'Two window bulbs must glow in one simple series loop. Connect both bulbs one after the other.',
    concept:'In a series circuit there is one main path through each device. If that path breaks, every device in that loop stops.',
    hints:['Do not give each bulb its own branch.','Make one chain: battery → bulb → bulb → battery.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('b1','bulb',4,2,{}, {locked:true}),c('b2','bulb',6,4,{}, {locked:true})],connections:[]},
    objective:{powerType:'bulb',count:2,topology:{componentType:'bulb',mode:'series',count:2},success:'Both bulbs are on the same current path: a series circuit.'}
  },
  {
    id:'school-1',building:'school',title:'Parallel Classroom',brief:'The two classroom lamps must have separate branches so one branch does not sit in series with the other.',
    concept:'Parallel branches connect across the same two junctions. Each branch provides a separate path through its device.',
    hints:['Both bulbs need to connect between the same two junctions.','Connect battery + to one side of both bulbs, and battery − to the other side of both bulbs.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('b1','bulb',5,2,{}, {locked:true}),c('b2','bulb',5,4,{}, {locked:true})],connections:[]},
    objective:{powerType:'bulb',count:2,topology:{componentType:'bulb',mode:'parallel',count:2},success:'Each bulb has its own branch across the battery: a parallel circuit.'}
  },
  {
    id:'school-2',building:'school',title:'Find the Broken Wire',brief:'This classroom circuit should work, but one wire is faulty. Remove the bad wire and reconnect the lamp.',
    concept:'A circuit can look nearly complete and still fail if one connection is broken. A gap anywhere in a series path stops current in that path.',
    hints:['The faulty connection is shown as a dashed red wire.','Remove the dashed wire from the connection list, then reconnect those two terminals.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('b1','bulb',5,3,{}, {locked:true})],connections:[w('good','bat','pos','b1','a'),w('bad','b1','b','bat','neg',{faulty:true})]},
    objective:{powerIds:['b1'],success:'You repaired the open circuit by replacing the faulty connection.'}
  },
  {
    id:'arcade-1',building:'arcade',title:'Master Neon Switch',brief:'Two neon lamps run on parallel branches. Put one master switch where it controls every powered branch.',
    concept:'A master switch can be placed before branches split (or after they rejoin), so opening it interrupts every branch.',
    hints:['If the switch sits inside only one branch, the other branch can still work.','Place the switch between the battery and the junction feeding both lamps.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('sw','switch',3,3,{closed:false},{locked:true}),c('b1','bulb',6,2,{}, {locked:true}),c('b2','bulb',6,4,{}, {locked:true})],connections:[]},
    objective:{powerType:'bulb',count:2,topology:{componentType:'bulb',mode:'parallel',count:2},allPathsIncludeType:'switch',success:'The switch is on every powered path, so it controls the whole sign.'}
  },
  {
    id:'arcade-2',building:'arcade',title:'Buzz & Glow',brief:'Power the prize buzzer and the sign bulb at the same time on separate parallel branches.',
    concept:'Different loads can share a source using parallel branches. Each branch still needs a complete path between the same two junctions.',
    hints:['The bulb and buzzer should not sit one after the other.','Give the bulb one branch and the buzzer another branch across the battery.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('b1','bulb',5,2,{}, {locked:true}),c('buzz','buzzer',5,4,{}, {locked:true})],connections:[]},
    objective:{powerIds:['b1','buzz'],success:'Both devices have complete parallel paths from the same source.'}
  },
  {
    id:'cinema-1',building:'cinema',title:'Series Detective',brief:'The aisle lights are wired wrongly. Reconnect both lamps so there is exactly one main path through them.',
    concept:'Series means the same branch passes through one load and then the next. Parallel means separate branches.',
    hints:['A series circuit forms one chain.','Battery → lamp 1 → lamp 2 → battery.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('b1','bulb',4,2,{}, {locked:true}),c('b2','bulb',6,4,{}, {locked:true})],connections:[w('p1','bat','pos','b1','a'),w('p2','bat','pos','b2','a'),w('p3','b1','b','bat','neg'),w('p4','b2','b','bat','neg')]},
    objective:{powerType:'bulb',count:2,topology:{componentType:'bulb',mode:'series',count:2},success:'You changed the two separate branches into one series path.'}
  },
  {
    id:'cinema-2',building:'cinema',title:'Parallel Premiere',brief:'The CINEMA sign has three lamps. Wire all three in parallel so each lamp has its own branch.',
    concept:'Parallel branches share the same two connection points. This is how many real lighting systems let lamps work independently.',
    hints:['All left sides can share one battery terminal; all right sides can share the other.','Make three separate lamp branches across the battery.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('b1','bulb',5,1,{}, {locked:true}),c('b2','bulb',5,3,{}, {locked:true}),c('b3','bulb',5,5,{}, {locked:true})],connections:[]},
    objective:{powerType:'bulb',count:3,topology:{componentType:'bulb',mode:'parallel',count:3},success:'Three separate branches now light the cinema sign.'}
  },
  {
    id:'museum-1',building:'museum',title:'Protect the Buzzer',brief:'Add the resistor in series with the buzzer and power the circuit.',
    concept:'A resistor opposes current. In real circuits, resistors are chosen using electrical ratings and calculations. Here we focus on where a series resistor sits in the path.',
    hints:['The current path should pass through both the resistor and buzzer.','Make one chain: battery → resistor → buzzer → battery.'],
    inventory:[],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('r','resistor',4,2,{resistance:3},{locked:true}),c('buzz','buzzer',6,4,{}, {locked:true})],connections:[]},
    objective:{powerIds:['buzz'],activeType:'resistor',success:'The resistor and buzzer are both in the working path.'}
  },
  {
    id:'museum-2',building:'museum',title:'Conductor Test',brief:'Choose a material sample that can conduct and use it to complete the lamp circuit.',
    concept:'Conductors, such as metals, allow charge to move through them easily. Insulators such as rubber strongly resist that movement and are used to keep us separated from current.',
    hints:['Copper is a conductor; rubber is an insulator.','Add the Copper sample from the parts tray and place it in the loop.'],
    inventory:[{type:'sample',label:'Copper',props:{material:'Copper',conductive:true},count:1},{type:'sample',label:'Rubber',props:{material:'Rubber',conductive:false},count:1}],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('lamp','bulb',6,3,{}, {locked:true})],connections:[]},
    objective:{powerIds:['lamp'],material:'Copper',success:'Copper completed the path because it is a conductor.'}
  },
  {
    id:'observatory-1',building:'observatory',title:'Choose the Voltage',brief:'The telescope indicator is designed for this simplified puzzle to use the 3 V battery. Pick the correct source and power the lamp.',
    concept:'Voltage is a difference in electric potential. It helps drive current around a closed circuit. Real components have voltage ratings that must be followed.',
    hints:['Look at the labels on the batteries in the parts tray.','Use the 3 V battery, not the 1.5 V battery.'],
    inventory:[{type:'battery',label:'1.5 V',props:{voltage:1.5},count:1},{type:'battery',label:'3 V',props:{voltage:3},count:1}],
    circuit:{components:[c('lamp','bulb',6,3,{}, {locked:true})],connections:[]},
    objective:{powerIds:['lamp'],componentProp:{type:'battery',prop:'voltage',value:3},success:'You matched the source to the stated 3 V requirement.'}
  },
  {
    id:'observatory-2',building:'observatory',title:'Resistance Route',brief:'Use the 6 Ω resistor in the working path with the indicator lamp.',
    concept:'Resistance describes how strongly a component opposes current. More resistance generally means less current for the same voltage, but exact behaviour depends on the whole circuit.',
    hints:['Choose the resistor with the requested Ω value.','Add the 6 Ω resistor in series with the lamp.'],
    inventory:[{type:'resistor',label:'3 Ω',props:{resistance:3},count:1},{type:'resistor',label:'6 Ω',props:{resistance:6},count:1}],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('lamp','bulb',6,3,{}, {locked:true})],connections:[]},
    objective:{powerIds:['lamp'],activeType:'resistor',componentProp:{type:'resistor',prop:'resistance',value:6},success:'The requested 6 Ω resistor is part of the powered path.'}
  },
  {
    id:'park-1',building:'theme-park',title:'Ferris Wheel Feed',brief:'Power the Ferris wheel motor and two decorative bulbs on three parallel branches, all controlled by one master switch.',
    concept:'A larger circuit can have several parallel branches controlled by one series switch before the split. This combines ideas from earlier puzzles.',
    hints:['Put the switch on the shared part of the circuit.','After the switch, split into one motor branch and two bulb branches, then rejoin at battery −.'],
    inventory:[], obstacles:[{x:4,y:2,w:1,h:2,label:'FOUNTAIN'}],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('sw','switch',3,3,{closed:false},{locked:true}),c('motor','motor',6,1,{}, {locked:true}),c('b1','bulb',6,3,{}, {locked:true}),c('b2','bulb',6,5,{}, {locked:true})],connections:[]},
    objective:{powerIds:['motor','b1','b2'],topology:{componentType:'bulb',mode:'parallel',count:2},allPathsIncludeType:'switch',success:'One master switch now controls three working branches.'}
  },
  {
    id:'park-2',building:'theme-park',title:'Power the Whole City!',brief:'Build the final control circuit: two lamps in parallel plus the park buzzer, with a master switch controlling every branch.',
    concept:'Real electrical networks are much more complex than this model, but the same core ideas matter: sources, closed paths, branches, loads, control devices and safe avoidance of short circuits.',
    hints:['Start with battery → master switch → junction.','Create separate branches for each load, then join them all back to battery −.'],
    inventory:[], obstacles:[{x:4,y:2,w:1,h:2,label:'PLAZA'}],
    circuit:{components:[c('bat','battery',1,3,{voltage:3},{locked:true}),c('sw','switch',3,3,{closed:false},{locked:true}),c('b1','bulb',6,1,{}, {locked:true}),c('buzz','buzzer',6,3,{}, {locked:true}),c('b2','bulb',6,5,{}, {locked:true})],connections:[]},
    objective:{powerIds:['b1','b2','buzz'],topology:{componentType:'bulb',mode:'parallel',count:2},allPathsIncludeType:'switch',success:'Circuit City is fully powered. Every final branch works under one master switch.'}
  }
];

export const ACHIEVEMENTS=[
  {id:'first-spark',icon:'⚡',name:'First Spark',desc:'Complete your first puzzle.',test:s=>Object.keys(s.completed).length>=1},
  {id:'three-star',icon:'⭐',name:'Perfect Repair',desc:'Earn 3 stars on a level.',test:s=>Object.values(s.completed).some(v=>v.stars===3)},
  {id:'series-smarts',icon:'🔗',name:'Series Smarts',desc:'Complete the Toy Shop.',building:'toy-shop'},
  {id:'parallel-pro',icon:'🛣️',name:'Parallel Pro',desc:'Complete Spark School.',building:'school'},
  {id:'material-mind',icon:'🧱',name:'Material Mind',desc:'Complete the Science Museum.',building:'museum'},
  {id:'lab-notes',icon:'🧪',name:'Lab Notes',desc:'Save a Free Build circuit.',test:s=>s.sandbox.length>=1},
  {id:'star-collector',icon:'🌟',name:'Star Collector',desc:'Earn 24 stars.',test:s=>s.stars>=24},
  {id:'city-champion',icon:'🏙️',name:'City Champion',desc:'Restore every building.',building:'theme-park'}
];

export const AVATARS=[
  {icon:'🧑‍🔧',stars:0,label:'Engineer'}, {icon:'👩‍🔧',stars:0,label:'Engineer'},
  {icon:'🧑‍🚀',stars:8,label:'Space Engineer'}, {icon:'👩‍🚀',stars:8,label:'Space Engineer'},
  {icon:'🤖',stars:18,label:'Robot Engineer'}, {icon:'🦊',stars:30,label:'Fox Engineer'}
];

export function levelsFor(buildingId){ return LEVELS.filter(l=>l.building===buildingId); }
export function getLevel(id){ return LEVELS.find(l=>l.id===id); }
export function buildingComplete(save,buildingId){ const ls=levelsFor(buildingId); return ls.length>0&&ls.every(l=>save.completed[l.id]); }
export function buildingUnlocked(save,building){ return !building.unlock || buildingComplete(save,building.unlock); }
