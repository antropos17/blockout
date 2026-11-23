// ============================================================ вид
const cv=document.getElementById('cv'), wrap=document.getElementById('viewwrap');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
scene.background=new THREE.Color('#C6C3BB');
scene.fog=new THREE.Fog('#C6C3BB',30,70);
const shotCam=new THREE.PerspectiveCamera(38,16/9,.1,240);
const freeCam=new THREE.PerspectiveCamera(42,16/9,.1,240);
scene.add(new THREE.HemisphereLight('#ffffff','#8d8a82',.95));
const sun=new THREE.DirectionalLight('#ffffff',.75); sun.position.set(5,10,7); scene.add(sun);
const grid=new THREE.GridHelper(80,80,'#8a877f','#b3b0a8');
grid.material.opacity=.5; grid.material.transparent=true; scene.add(grid);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(260,260),
  new THREE.MeshStandardMaterial({color:'#BFBCB4',roughness:1}));
floor.rotation.x=-Math.PI/2; floor.position.y=-.01; scene.add(floor);
const camRig=new THREE.Group(); scene.add(camRig);
camRig.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.36,.7),
  new THREE.MeshStandardMaterial({color:'#E4B33C',roughness:.6})));
const lens=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.34,14),
  new THREE.MeshStandardMaterial({color:'#3a3833',roughness:.7}));
lens.rotation.x=Math.PI/2; lens.position.z=-.5; camRig.add(lens);
const camPath=new THREE.Line(new THREE.BufferGeometry(),
  new THREE.LineDashedMaterial({color:'#E4B33C',dashSize:.35,gapSize:.25}));
scene.add(camPath);

let shot=null, meshes=[], t=0, playing=false, freeView=false, selected=null, shotNo=1;
const YAW={camera:0,away:Math.PI,right:Math.PI/2,left:-Math.PI/2};
const fmt=s=>{const m=Math.floor(s/60);return String(m).padStart(2,'0')+':'+(s-m*60).toFixed(2).padStart(5,'0');};

function geoFor(def){
  const w=def.size[0],h=def.size[1],d=def.size[2];
  if(def.shape==='sphere') return new THREE.SphereGeometry(Math.max(w,h,d)/2,20,14);
  if(def.shape==='cylinder') return new THREE.CylinderGeometry(w/2,w/2,h,20);
  if(def.shape==='capsule') return new THREE.CylinderGeometry(w/2,w/2,Math.max(h-w,.01),18);
  return new THREE.BoxGeometry(w,h,d);
}
function build(data){
  meshes.forEach(m=>scene.remove(m.mesh)); meshes=[];
  shot=data;
  data.objects.forEach(def=>{
    const mat=new THREE.MeshStandardMaterial({color:'#F2F0EC',roughness:.85});
    const mesh=new THREE.Mesh(geoFor(def),mat);
    if(def.shape==='capsule'){
      const r=def.size[0]/2, sg=new THREE.SphereGeometry(r,16,12);
      const a=new THREE.Mesh(sg,mat), b=new THREE.Mesh(sg,mat);
      a.position.y=(def.size[1]-def.size[0])/2; b.position.y=-a.position.y;
      mesh.add(a,b);
      const nose=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.2),
        new THREE.MeshStandardMaterial({color:'#8d8a82'}));
      nose.position.set(0,a.position.y,r*1.0); mesh.add(nose);
    }
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({color:'#5d5a54'})));
    mesh.rotation.y=YAW[def.facing]||0;
    mesh.userData.id=def.id; scene.add(mesh);
    meshes.push({id:def.id,mesh,def});
  });
  t=0; playing=false; selected=null;
  document.getElementById('play').textContent='▶';
  document.getElementById('durlabel').textContent=data.duration.toFixed(1);
  document.getElementById('tcend').textContent=fmt(data.duration);
  document.getElementById('shotno').textContent=String(shotNo).padStart(3,'0');
  document.getElementById('objcount').textContent=data.objects.length+' объектов';
  document.getElementById('insp').hidden=true;
  drawList(); readback(); updateCamPath(); apply();
}
function interpLook(keys,time){
  return samplePos(keys.map(k=>({t:k.t,pos:k.look||[0,1,0]})),time);
}
function apply(){
  if(!shot) return;
  meshes.forEach(m=>{
    const p=samplePos(m.def.keys,t);
    m.mesh.position.set(p[0],p[1],p[2]);
  });
  const cp=samplePos(shot.camera.keys,t), look=interpLook(shot.camera.keys,t);
  shotCam.position.set(cp[0],cp[1],cp[2]);
  shotCam.lookAt(look[0],look[1],look[2]);
  camRig.position.copy(shotCam.position); camRig.quaternion.copy(shotCam.quaternion);
  camRig.visible=freeView; camPath.visible=freeView;
  document.getElementById('tc').textContent=fmt(t);
  document.getElementById('scrub').value=Math.round(t/shot.duration*1000);
  drawPerfs();
}
function updateCamPath(){
  if(!shot) return;
  const pts=[];
  for(let i=0;i<=56;i++){
    const p=samplePos(shot.camera.keys,shot.duration*i/56);
    pts.push(new THREE.Vector3(p[0],p[1],p[2]));
  }
  camPath.geometry.dispose();
  camPath.geometry=new THREE.BufferGeometry().setFromPoints(pts);
  camPath.computeLineDistances();
}

// ---------- расшифровка простыми словами ----------
function readback(){
  const box=document.getElementById('readback'), body=document.getElementById('readbody');
  if(!shot||!shot.spec){box.hidden=true;return;}
  const sp=shot.spec, nm=id=>{const o=sp.objects.find(x=>x.id===id);return o?(o.label||id):id;};
  const lines=[];
  sp.objects.forEach(o=>{
    if(o.kind==='person') lines.push('<b>'+(o.label||o.id)+'</b> — '+(FACE_RU[o.facing]||'смотрит на камеру')+'.');
  });
  (sp.placement||[]).forEach(r=>{
    const frame=(r.frame==='camera')?'от камеры':'с точки зрения '+nm(r.to);
    let screen='';
    if(r.frame!=='camera'&&(r.side==='left'||r.side==='right')){
      const tgt=sp.objects.find(x=>x.id===r.to);
      const flip=((tgt&&tgt.facing)||'camera')==='camera';
      const onScreen=(r.side==='left')?(flip?'справа':'слева'):(flip?'слева':'справа');
      screen=' → в кадре это <b>'+onScreen+'</b>';
    }
    lines.push(nm(r.of)+' — '+(SIDE_RU[r.side]||r.side)+' от '+nm(r.to)+' ('+frame+')'+screen+'.');
  });
  (sp.motion||[]).forEach(m=>{
    if(!m.action||m.action==='stand') return;
    let s=nm(m.who)+' движется '+(m.from==='left'?'слева':'справа')+' → '+(m.to==='left'?'налево':'направо');
    if(m.stop_at!=null) s+=', останавливается на '+m.stop_at+' с';
    lines.push(s+'.');
  });
  if(sp.meet&&sp.meet.who) lines.push(sp.meet.who.map(nm).join(' и ')+' равняются на '+sp.meet.t+' с.');
  const CAM={orbit:'облетает по дуге',dolly_out:'отъезжает назад',dolly_in:'наезжает',
             track:'едет следом',static:'стоит на месте'};
  lines.push('Камера '+(CAM[(sp.camera&&sp.camera.move)||'static']||'стоит на месте')+'.');
  let html=lines.map(l=>'<p>'+l+'</p>').join('');
  if(shot.notes.separated.length) html+='<p class="fix"><span>✓</span><span>Раздвинул, стояли внахлёст: '+shot.notes.separated.join(', ')+'</span></p>';
  if(shot.notes.lanes.length) html+='<p class="fix"><span>✓</span><span>Развёл по глубине, иначе прошли бы насквозь: '+shot.notes.lanes.join(', ')+'</span></p>';
  body.innerHTML=html; box.hidden=false;
}

// ---------- список и правка ----------
function drawList(){
  const el=document.getElementById('list');
  if(!shot||!shot.objects.length){el.innerHTML='<p class="empty">Появятся после сборки сцены.</p>';return;}
  el.innerHTML='';
  shot.objects.forEach(def=>{
    const row=document.createElement('div');
    row.className='row'+(def.id===selected?' on':'');
    row.innerHTML='<span class="nm">'+def.label+'</span><span class="tag">'+(def.keys.length>1?'движется':'стоит')+'</span>';
    row.onclick=()=>select(def.id);
    el.appendChild(row);
  });
}
function select(id){
  selected=id; drawList();
  const def=shot.objects.find(o=>o.id===id);
  document.getElementById('insp').hidden=!def;
  if(def){
    document.getElementById('inspname').textContent=def.label; syncInsp();
    if(typeof goTab==='function' && matchMedia('(pointer:coarse)').matches) goTab('objects');
  }
}
function syncInsp(){
  const def=shot.objects.find(o=>o.id===selected); if(!def) return;
  const p=samplePos(def.keys,t);
  [['ox',0],['oy',1],['oz',2]].forEach(pair=>{
    document.getElementById(pair[0]).value=p[pair[1]];
    document.getElementById(pair[0]+'v').textContent=p[pair[1]].toFixed(1);
  });
}
['ox','oy','oz'].forEach((id,i)=>{
  document.getElementById(id).addEventListener('input',e=>{
    const def=shot.objects.find(o=>o.id===selected); if(!def) return;
    const cur=samplePos(def.keys,t), d=[0,0,0];
    d[i]=parseFloat(e.target.value)-cur[i];
    shiftTrack(shot,def,d[0],d[1],d[2]); apply(); syncInsp(); readback();
  });
});
document.getElementById('keyhere').onclick=()=>{
  const def=shot.objects.find(o=>o.id===selected); if(!def) return;
  const p=samplePos(def.keys,t), ex=def.keys.find(k=>Math.abs(k.t-t)<.02);
  if(ex) ex.pos=p; else {def.keys.push({t:t,pos:p}); def.keys.sort((a,b)=>a.t-b.t);}
  drawList();
};
document.getElementById('delobj').onclick=()=>{
  const i=shot.objects.findIndex(o=>o.id===selected); if(i<0) return;
  const m=meshes.find(x=>x.id===selected); if(m) scene.remove(m.mesh);
  meshes=meshes.filter(x=>x.id!==selected); shot.objects.splice(i,1);
  selected=null; document.getElementById('insp').hidden=true;
  document.getElementById('objcount').textContent=shot.objects.length+' объектов';
  drawList();
};

// ---------- транспорт ----------
function drawPerfs(){
  const el=document.getElementById('perfs');
  if(el.children.length!==24){el.innerHTML='';for(let i=0;i<24;i++){const d=document.createElement('div');d.className='perf';el.appendChild(d);}}
  if(!shot) return;
  const k=Math.floor(t/shot.duration*23.999);
  Array.prototype.forEach.call(el.children,(c,i)=>c.classList.toggle('on',i<=k));
}
document.getElementById('play').onclick=()=>{
  if(!shot) return;
  if(t>=shot.duration) t=0;
  playing=!playing;
  document.getElementById('play').textContent=playing?'❚❚':'▶';
};
document.getElementById('scrub').oninput=e=>{
  if(!shot) return;
  playing=false; document.getElementById('play').textContent='▶';
  t=shot.duration*e.target.value/1000; apply(); if(selected) syncInsp();
};
function setFreeView(v){
  freeView=v;
  const b=document.getElementById('mode');
  b.textContent=v?'Смотрю со стороны':'Смотрю камерой шота';
  b.classList.toggle('act',!v);
  document.getElementById('setcam').style.display=v?'block':'none';
  document.getElementById('tip').textContent=v
    ?'Поставьте вид как хотите и нажмите «Снять камеру отсюда»'
    :'Перетащите объект мышью · тяните пустое место, чтобы обойти сцену · колесо — ближе и дальше';
  apply();
}
document.getElementById('mode').onclick=()=>setFreeView(!freeView);
document.getElementById('setcam').onclick=()=>{
  if(!shot) return;
  const p=freeCam.position;
  const key={t:t,pos:[p.x,p.y,p.z],look:[orbit.tx,orbit.ty,orbit.tz]};
  const ex=shot.camera.keys.find(k=>Math.abs(k.t-t)<.02);
  if(ex){ex.pos=key.pos;ex.look=key.look;} else {shot.camera.keys.push(key);shot.camera.keys.sort((a,b)=>a.t-b.t);}
  updateCamPath(); setFreeView(false);
};

// ---------- мышь ----------
let orbit={az:.5,el:.42,dist:15,tx:0,ty:1.2,tz:0}, drag=null;
const ray=new THREE.Raycaster(), ptr=new THREE.Vector2();
function placeFree(){
  freeCam.position.set(
    orbit.tx+orbit.dist*Math.cos(orbit.el)*Math.sin(orbit.az),
    orbit.ty+orbit.dist*Math.sin(orbit.el),
    orbit.tz+orbit.dist*Math.cos(orbit.el)*Math.cos(orbit.az));
  freeCam.lookAt(orbit.tx,orbit.ty,orbit.tz);
}
placeFree();
function ndc(e){
  const r=cv.getBoundingClientRect();
  ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
}
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId); ndc(e);
  ray.setFromCamera(ptr,freeView?freeCam:shotCam);
  const hit=ray.intersectObjects(meshes.map(m=>m.mesh),false)[0];
  if(hit){select(hit.object.userData.id); drag={mode:'obj',y:hit.object.position.y};}
  else {drag={mode:'orbit',sx:e.clientX,sy:e.clientY}; if(!freeView) setFreeView(true);}
});
cv.addEventListener('pointermove',e=>{
  if(!drag) return;
  if(drag.mode==='orbit'){
    orbit.az-=(e.clientX-drag.sx)*.006;
    orbit.el=Math.max(-.12,Math.min(1.35,orbit.el+(e.clientY-drag.sy)*.005));
    drag.sx=e.clientX; drag.sy=e.clientY; placeFree();
  } else {
    const m=meshes.find(x=>x.id===selected); if(!m) return;
    ndc(e); ray.setFromCamera(ptr,freeView?freeCam:shotCam);
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-drag.y), p=new THREE.Vector3();
    if(ray.ray.intersectPlane(plane,p)){
      const cur=samplePos(m.def.keys,t);
      shiftTrack(shot,m.def,p.x-cur[0],0,p.z-cur[2]); apply(); syncInsp(); readback();
    }
  }
});
addEventListener('pointerup',()=>{drag=null;});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  orbit.dist=Math.max(3,Math.min(55,orbit.dist+e.deltaY*.012)); placeFree();
},{passive:false});

// ---------- экспорт ----------
document.getElementById('png').onclick=()=>{
  if(freeView) setFreeView(false);
  renderer.render(scene,shotCam);
  const a=document.createElement('a');
  a.download='shot'+String(shotNo).padStart(3,'0')+'_'+fmt(t).replace(':','-')+'.png';
  a.href=cv.toDataURL('image/png'); a.click();
};
document.getElementById('webm').onclick=()=>{
  if(!shot) return;
  if(!cv.captureStream||typeof MediaRecorder==='undefined'){
    showErr('Этот браузер не умеет записывать видео. Сохраните кадр — модели его обычно достаточно.'); return;
  }
  setFreeView(false);
  const rec=new MediaRecorder(cv.captureStream(30),{mimeType:'video/webm'});
  const chunks=[]; rec.ondataavailable=e=>chunks.push(e.data);
  rec.onstop=()=>{
    const a=document.createElement('a');
    a.download='shot'+String(shotNo).padStart(3,'0')+'_blockout.webm';
    a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'})); a.click();
    document.getElementById('recdot').style.display='none';
  };
  document.getElementById('recdot').style.display='flex';
  t=0; apply(); rec.start(); playing=true;
  document.getElementById('play').textContent='❚❚';
  setTimeout(()=>{playing=false;document.getElementById('play').textContent='▶';rec.stop();},shot.duration*1000+250);
};

// ---------- генерация ----------
const SCHEMA='Ты раскладываешь описание шота на ОТНОШЕНИЯ. Координаты НЕ считай — их посчитает программа.\n'+
'Верни ТОЛЬКО JSON, без пояснений и без markdown.\n\n'+
'{"duration": 3-8,\n'+
' "anchor": "id главного объекта",\n'+
' "objects":[{"id":"латиницей","label":"имя по-русски","kind":"вид","facing":"camera|away|left|right"}],\n'+
' "placement":[{"of":"id","side":"left|right|behind|front","to":"id","frame":"object|camera","distance":метры}],\n'+
' "motion":[{"who":"id","action":"walk|drive|stand","from":"left|right","to":"left|right","stop_at":секунда или null}],\n'+
' "meet":{"t":секунда,"who":["id","id"],"where":"center|left|right"} или null,\n'+
' "camera":{"move":"static|orbit|dolly_in|dolly_out|track","target":"id","degrees":45-120,"direction":"right|left","distance":метры}}\n\n'+
'kind — одно из: person car truck bike tree pole wall building door box ball table chair animal.\n\n'+
'ВАЖНО про frame:\n'+
'- "object" — направление с точки зрения самого объекта ("слева от него").\n'+
'- "camera" — направление с точки зрения зрителя ("слева в кадре").\n'+
'Если сказано "слева от НЕГО" — ставь frame:"object". Если "слева в кадре" — frame:"camera".\n'+
'Лево и право НЕ пересчитывай сам, просто укажи frame верно.\n\n'+
'Движение камеры выбирай типом: облёт вокруг = orbit, отъезд = dolly_out, наезд = dolly_in,\n'+
'следует за героем = track, неподвижна = static.\n'+
'2-6 объектов. Если кто-то с кем-то встречается в конкретный момент — заполни meet.';

const EXAMPLES=[
  ['Облёт','Человек стоит лицом к камере, позади него стена, слева от него машина. Камера облетает его по дуге вправо.'],
  ['Встреча','Человек идёт справа налево, машина едет ему навстречу, на 3-й секунде они равняются в центре, потом человек останавливается.'],
  ['Погоня','Человек бежит справа налево, за ним едет машина, камера едет следом за человеком.'],
  ['Диалог','Двое стоят лицом друг к другу у стены, справа от них дерево, камера медленно наезжает.'],
  ['Двор','Машина стоит у дома, слева от неё дерево, человек идёт к камере, камера отъезжает назад.']
];
const exBox=document.getElementById('examples');
EXAMPLES.forEach(pair=>{
  const b=document.createElement('button');
  b.className='ex'; b.textContent=pair[0];
  b.onclick=()=>{document.getElementById('prompt').value=pair[1]; document.getElementById('go').click();};
  exBox.appendChild(b);
});
const showErr=m=>{const e=document.getElementById('err');e.textContent=m;e.hidden=false;};
const clearErr=()=>{document.getElementById('err').hidden=true;};

document.getElementById('go').onclick=async()=>{
  const btn=document.getElementById('go'), text=document.getElementById('prompt').value.trim();
  if(!text) return;
  clearErr(); btn.disabled=true; btn.textContent='Собираю…';
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1200,
        messages:[{role:'user',content:SCHEMA+'\n\nОписание шота: '+text}]})
    });
    const data=await r.json();
    const raw=(data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
    const clean=raw.replace(/```json|```/g,'').trim();
    const spec=JSON.parse(clean.slice(clean.indexOf('{'),clean.lastIndexOf('}')+1));
    if(!spec.objects||!spec.objects.length) throw new Error('нет объектов');
    spec.duration=Math.max(2,Math.min(10,spec.duration||5));
    shotNo++; build(buildScene(spec));
  }catch(err){
    console.error(err);
    showErr('Не получилось собрать. Попробуйте проще: кто в кадре, что делает, куда движется камера.');
  }finally{btn.disabled=false; btn.textContent='Собрать сцену';}
};

// ---------- вкладки на телефоне ----------
document.body.dataset.tab='scene';
function goTab(name){
  document.body.dataset.tab=name;
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),
    b=>b.classList.toggle('on', b.dataset.go===name));
}
Array.prototype.forEach.call(document.querySelectorAll('.tab'),
  b=>b.onclick=()=>goTab(b.dataset.go));
const isTouch = matchMedia('(pointer:coarse)').matches;

// ---------- щипок двумя пальцами ----------
const touches=new Map();
cv.addEventListener('pointerdown',e=>{ touches.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
cv.addEventListener('pointermove',e=>{
  if(!touches.has(e.pointerId)) return;
  const prev=touches.get(e.pointerId);
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2){
    drag=null;                                   // два пальца — только масштаб
    const pts=Array.from(touches.values());
    const d=Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    if(cv._lastPinch){
      orbit.dist=Math.max(3,Math.min(55, orbit.dist*(cv._lastPinch/d)));
      if(!freeView) setFreeView(true);
      placeFree();
    }
    cv._lastPinch=d;
  }
  void prev;
});
['pointerup','pointercancel','pointerleave'].forEach(ev=>
  cv.addEventListener(ev,e=>{ touches.delete(e.pointerId); if(touches.size<2) cv._lastPinch=null; }));

// ---------- старт ----------
function resize(){
  const w=wrap.clientWidth,h=wrap.clientHeight;
  renderer.setSize(w,h,false);
  shotCam.aspect=freeCam.aspect=w/h;
  shotCam.updateProjectionMatrix(); freeCam.updateProjectionMatrix();
}
addEventListener('resize',resize);
let last=performance.now();
function loop(now){
  const dt=(now-last)/1000; last=now;
  if(playing&&shot){
    t+=dt;
    if(t>=shot.duration){t=shot.duration;playing=false;document.getElementById('play').textContent='▶';}
    apply();
  }
  renderer.render(scene,freeView?freeCam:shotCam);
  requestAnimationFrame(loop);
}
setFreeView(false);
resize();
build(buildScene({
  duration:5, anchor:'man',
  objects:[{id:'man',label:'Человек',kind:'person',facing:'camera'},
           {id:'car',label:'Машина',kind:'car',facing:'right'},
           {id:'pole',label:'Фонарный столб',kind:'pole'},
           {id:'wall',label:'Стена',kind:'wall'}],
  placement:[{of:'car',side:'left',to:'man',frame:'object',distance:4},
             {of:'pole',side:'right',to:'man',frame:'object',distance:3},
             {of:'wall',side:'behind',to:'man',frame:'object',distance:5}],
  camera:{move:'orbit',target:'man',degrees:70,direction:'right',distance:7}
}));
requestAnimationFrame(loop);
