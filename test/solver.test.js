const {buildScene, samplePos, KINDS} = require('../src/solver');
let fails = 0;
function ok(name, cond, info){
  console.log((cond?'  OK  ':'ПРОВАЛ') + ' | ' + name + (info?('  → '+info):''));
  if(!cond) fails++;
}

// ============ СЦЕНА 1: система отсчёта ============
// "Человек лицом к камере. Слева от него машина, справа столб,
//  позади стена. Камера объезжает его по дуге вправо."
const s1 = {
  duration:5, anchor:'man',
  objects:[
    {id:'man', label:'Человек', kind:'person', facing:'camera'},
    {id:'car', label:'Машина', kind:'car', facing:'right'},
    {id:'pole',label:'Столб', kind:'pole'},
    {id:'wall',label:'Стена', kind:'wall'}
  ],
  placement:[
    {of:'car', side:'left',  to:'man', frame:'object', distance:4},
    {of:'pole',side:'right', to:'man', frame:'object', distance:3},
    {of:'wall',side:'behind',to:'man', frame:'object', distance:4}
  ],
  camera:{move:'orbit', target:'man', degrees:70, distance:7}
};
const r1 = buildScene(s1);
const g = id => r1.objects.find(o=>o.id===id);
const X = id => samplePos(g(id).keys,0)[0];
const Z = id => samplePos(g(id).keys,0)[2];

console.log('\n=== СЦЕНА 1: лево-право от человека ===');
ok('машина СПРАВА в кадре (его лево, он смотрит на нас)', X('car') > 0.5, 'x='+X('car').toFixed(2));
ok('столб СЛЕВА в кадре (его право)',                     X('pole') < -0.5, 'x='+X('pole').toFixed(2));
ok('стена ЗА человеком, дальше от камеры',                Z('wall') < Z('man') - 1, 'z='+Z('wall').toFixed(2));

// камера: дуга, а не отрезок
const ck = r1.camera.keys;
ok('у камеры больше двух ключей (дуга)', ck.length > 2, ck.length+' ключей');
const mid = ck[Math.floor(ck.length/2)];
const first = ck[0], last = ck[ck.length-1];
// отклонение середины от прямой первый-последний
const lx = (first.pos[0]+last.pos[0])/2, lz = (first.pos[2]+last.pos[2])/2;
const bow = Math.hypot(mid.pos[0]-lx, mid.pos[2]-lz);
ok('середина дуги отходит от прямой', bow > 0.3, 'прогиб '+bow.toFixed(2)+' м');
// радиус постоянный
const rad = ck.map(k=>Math.hypot(k.pos[0]-X('man'), k.pos[2]-Z('man')));
ok('радиус облёта держится', Math.max(...rad)-Math.min(...rad) < 0.1,
   'разброс '+(Math.max(...rad)-Math.min(...rad)).toFixed(3)+' м');

// ============ СЦЕНА 2: встреча без проезда насквозь ============
const s2 = {
  duration:6, anchor:'man',
  objects:[
    {id:'man', label:'Человек', kind:'person', facing:'left'},
    {id:'car', label:'Машина', kind:'car', facing:'right'}
  ],
  placement:[{of:'car', side:'behind', to:'man', frame:'camera', distance:3}],
  motion:[
    {who:'man', action:'walk',  from:'right', to:'left', stop_at:3},
    {who:'car', action:'drive', from:'left',  to:'right'}
  ],
  meet:{t:3, who:['man','car'], where:'center'},
  camera:{move:'track', target:'man', distance:9}
};
const r2 = buildScene(s2);
const man = r2.objects.find(o=>o.id==='man'), car = r2.objects.find(o=>o.id==='car');

console.log('\n=== СЦЕНА 2: встреча и остановка ===');
const pm3 = samplePos(man.keys,3), pc3 = samplePos(car.keys,3);
ok('поравнялись по горизонтали на 3-й секунде', Math.abs(pm3[0]-pc3[0]) < 0.6,
   'разница '+Math.abs(pm3[0]-pc3[0]).toFixed(2)+' м');
ok('встреча в центре кадра', Math.abs(pm3[0]) < 0.6, 'x='+pm3[0].toFixed(2));

const pm6 = samplePos(man.keys,6);
ok('человек стоит после остановки', Math.abs(pm6[0]-pm3[0]) < 0.05,
   'сдвиг '+Math.abs(pm6[0]-pm3[0]).toFixed(3)+' м');
const pc6 = samplePos(car.keys,6);
ok('машина продолжила ехать', pc6[0] > pc3[0] + 2, 'проехала '+(pc6[0]-pc3[0]).toFixed(1)+' м');

// главное: не прошли насквозь ни в один момент
let minGap = 1e9, at = 0;
for(let s=0;s<=120;s++){
  const t = 6*s/120;
  const a = samplePos(man.keys,t), b = samplePos(car.keys,t);
  const dx = Math.abs(a[0]-b[0]), dz = Math.abs(a[2]-b[2]);
  const needX = (KINDS.person.size[0]+KINDS.car.size[0])/2;
  const needZ = (KINDS.person.size[2]+KINDS.car.size[2])/2;
  if(dx < needX){
    const gap = dz - needZ;
    if(gap < minGap){ minGap = gap; at = t; }
  }
}
ok('тела не пересекаются на всём шоте', minGap > 0,
   'минимальный зазор '+minGap.toFixed(2)+' м на '+at.toFixed(1)+' с');

// ============ устойчивость: мусор на входе ============
console.log('\n=== СЦЕНА 3: неполный ответ модели ===');
let crashed = false, r3 = null;
try{
  r3 = buildScene({duration:4, objects:[
    {id:'a', label:'Нечто', kind:'единорог'},
    {id:'b', label:'Второе'}
  ]});
}catch(e){ crashed = true; }
ok('не падает на неизвестном типе и без расстановки', !crashed && r3 && r3.objects.length===2);
ok('объекты не свалены в одну точку',
   r3 && Math.abs(samplePos(r3.objects[0].keys,0)[0] - samplePos(r3.objects[1].keys,0)[0]) > 0.5);

// Реальные обработчики интерфейса выполняются без WebGL, с подставленным вводом.
console.log('\n=== РУЧНАЯ ПРАВКА: мышь и слайдеры ===');
const vm = require('node:vm');
const appSource = require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
const solver = require('../src/solver');
function editThroughUI(input, moving){
  const data = buildScene(moving?s2:s1);
  const edited = data.objects.find(o=>o.id==='car');
  const other = data.objects.find(o=>o.id==='man');
  const beforeTimes = edited.keys.map(k=>k.t);
  const camera = JSON.stringify(data.camera);
  const at = moving?3:0, target = samplePos(other.keys,at);
  const handlers = {};
  let applied = 0, synced = 0;
  const context = {
    ...solver, shot:data, selected:edited.id, t:at,
    document:{getElementById:id=>({addEventListener:(event,fn)=>{handlers[id]=fn;}})},
    apply:()=>{applied++;}, syncInsp:()=>{synced++;}, readback:()=>{},
    cv:{addEventListener:(event,fn)=>{handlers[event]=fn;}},
    drag:{mode:'obj',y:target[1]}, meshes:[{id:edited.id,def:edited}],
    ndc:()=>{}, freeView:false, freeCam:{}, shotCam:{}, ptr:{},
    ray:{setFromCamera:()=>{},ray:{intersectPlane:(plane,p)=>{p.x=target[0];p.z=target[2];return p;}}},
    THREE:{Plane:class {},Vector3:class {constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}}
  };
  vm.createContext(context);
  const legacy = appSource.match(/function shiftTrack\([^\n]+/);
  if(legacy) vm.runInContext(legacy[0],context);
  vm.runInContext(appSource.slice(appSource.indexOf("['ox','oy','oz'].forEach"),appSource.indexOf("document.getElementById('keyhere')")),context);
  vm.runInContext(appSource.slice(appSource.indexOf("cv.addEventListener('pointermove'"),appSource.indexOf("addEventListener('pointerup'")),context);
  if(input==='drag') handlers.pointermove({});
  else {
    // Сначала совмещаем остальные оси: проверяем, что именно этот слайдер
    // создаёт пересечение, а не исправляет уже безопасную сцену.
    const axis={ox:0,oy:1,oz:2}[input];
    const current=samplePos(edited.keys,at);
    edited.keys.forEach(k=>k.pos=k.pos.map((v,i)=>i===axis?v:v+target[i]-current[i]));
    handlers[input]({target:{value:String(target[axis])}});
  }
  let clear = true;
  for(let step=0;step<=240;step++){
    const time=data.duration*step/240;
    for(let i=0;i<data.objects.length;i++) for(let j=i+1;j<data.objects.length;j++){
      const a=data.objects[i], b=data.objects[j];
      if(['wall','building'].includes(a.kind)||['wall','building'].includes(b.kind)) continue;
      const pa=samplePos(a.keys,time),pb=samplePos(b.keys,time);
      if(pa.every((v,axis)=>Math.abs(v-pb[axis])<(a.size[axis]+b.size[axis])/2-1e-6)) clear=false;
    }
  }
  ok(input+(moving?' — движущиеся тела':' — статика')+': нет пересечений на всём таймлайне',clear);
  ok(input+': тайминг и камера сохранены',JSON.stringify(beforeTimes)===JSON.stringify(edited.keys.map(k=>k.t))&&camera===JSON.stringify(data.camera));
  ok(input+': вид и инспектор обновлены',applied===1&&synced===1);
}
for(const input of ['drag','ox','oy','oz']){
  editThroughUI(input,false);
  editThroughUI(input,true);
}

console.log('\n' + (fails ? ('ПРОВАЛОВ: '+fails) : 'Все проверки пройдены.'));
process.exit(fails?1:0);
