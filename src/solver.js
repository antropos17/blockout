// ============================================================
// РАСЧЁТЧИК. Модель отдаёт отношения, координаты считаются здесь.
// Мир: камера в +Z смотрит в -Z. +X — вправо на экране.
// ============================================================
const KINDS = {
  person:{shape:'capsule',size:[.5,1.75,.5]}, car:{shape:'box',size:[4.2,1.35,1.8]},
  truck:{shape:'box',size:[6.5,2.8,2.4]},     bike:{shape:'box',size:[1.7,1,.5]},
  tree:{shape:'cylinder',size:[.7,4.5,.7]},   pole:{shape:'cylinder',size:[.25,5,.25]},
  wall:{shape:'box',size:[12,3.2,.35]},       building:{shape:'box',size:[8,9,6]},
  door:{shape:'box',size:[1.1,2.2,.15]},      box:{shape:'box',size:[1,1,1]},
  ball:{shape:'sphere',size:[.8,.8,.8]},      table:{shape:'box',size:[1.6,.75,.9]},
  chair:{shape:'box',size:[.5,.95,.5]},       animal:{shape:'box',size:[1.1,.8,.4]}
};
const FACING={camera:[0,0,1],away:[0,0,-1],left:[-1,0,0],right:[1,0,0]};
const FACE_RU={camera:'смотрит на камеру',away:'спиной к камере',left:'смотрит влево',right:'смотрит вправо'};
const SIDE_RU={left:'слева',right:'справа',behind:'позади',front:'перед'};

const cl=v=>v.slice();
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sc=(v,k)=>[v[0]*k,v[1]*k,v[2]*k], ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const kindOf=o=>KINDS[o.kind]||KINDS.box;
const halfXZ=o=>Math.max(kindOf(o).size[0],kindOf(o).size[2])/2;
const restY=o=>kindOf(o).size[1]/2;
const isBG=o=>o.kind==='wall'||o.kind==='building';

function sideVector(side,frame,target){
  if(frame==='camera') return {left:[-1,0,0],right:[1,0,0],behind:[0,0,-1],front:[0,0,1]}[side]||[1,0,0];
  const fwd=FACING[(target&&target.facing)||'camera']||FACING.camera;
  const left=cross([0,1,0],fwd);
  if(side==='left') return left;
  if(side==='right') return sc(left,-1);
  if(side==='behind') return sc(fwd,-1);
  if(side==='front') return cl(fwd);
  return sc(left,-1);
}
function place(spec){
  const byId={};
  spec.objects.forEach(o=>{byId[o.id]={...o,pos:[0,restY(o),0],placed:false};});
  const anchor=spec.anchor||spec.objects[0].id;
  if(byId[anchor]) byId[anchor].placed=true;
  for(let pass=0;pass<4;pass++)(spec.placement||[]).forEach(r=>{
    const self=byId[r.of],to=byId[r.to];
    if(!self||!to||self.placed) return;
    if(!to.placed&&to.id!==anchor) return;
    const dir=sideVector(r.side,r.frame||'object',to);
    const gap=(r.distance!=null)?r.distance:(halfXZ(self)+halfXZ(to)+1.2);
    self.pos=ad(to.pos,sc(dir,gap)); self.pos[1]=restY(self); self.placed=true;
  });
  let spare=0;
  Object.values(byId).forEach(o=>{if(!o.placed){o.pos=[spare*3-3,restY(o),-2];spare++;o.placed=true;}});
  return byId;
}
function separate(list,log){
  for(let it=0;it<24;it++){
    let moved=false;
    for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];
      if(isBG(a)||isBG(b)) continue;
      const need=halfXZ(a)+halfXZ(b);
      let dx=b.pos[0]-a.pos[0],dz=b.pos[2]-a.pos[2],d=Math.hypot(dx,dz);
      if(d>=need) continue;
      if(d<1e-4){dx=1;dz=0;d=1;}
      const p=(need-d)/2+.02;
      a.pos[0]-=dx/d*p; a.pos[2]-=dz/d*p; b.pos[0]+=dx/d*p; b.pos[2]+=dz/d*p;
      moved=true;
      const tag=a.label+' и '+b.label;
      if(log&&log.indexOf(tag)<0) log.push(tag);
    }
    if(!moved) break;
  }
}
const EDGE=7;
function samplePos(keys,time){
  if(keys.length===1) return cl(keys[0].pos);
  if(time<=keys[0].t) return cl(keys[0].pos);
  if(time>=keys[keys.length-1].t) return cl(keys[keys.length-1].pos);
  let a=keys[0],b=keys[keys.length-1];
  for(let i=0;i<keys.length-1;i++) if(time>=keys[i].t&&time<=keys[i+1].t){a=keys[i];b=keys[i+1];break;}
  const k=(time-a.t)/((b.t-a.t)||1), s=k*k*(3-2*k);
  return a.pos.map((v,i)=>v+(b.pos[i]-v)*s);
}
function trackFor(o,m,spec){
  const dur=spec.duration,y=restY(o);
  if(!m||!m.action||m.action==='stand') return [{t:0,pos:cl(o.pos)}];
  const sx=m.from==='left'?-EDGE:m.from==='right'?EDGE:o.pos[0];
  const ex=m.to==='left'?-EDGE:m.to==='right'?EDGE:o.pos[0];
  const z=o.pos[2];
  let keys=[{t:0,pos:[sx,y,z]},{t:dur,pos:[ex,y,z]}];
  const meet=spec.meet;
  if(meet&&meet.who&&meet.who.indexOf(o.id)>=0){
    const mx=meet.where==='left'?-3:meet.where==='right'?3:0;
    const tm=Math.max(.1,Math.min(dur-.1,meet.t));
    keys=[{t:0,pos:[sx,y,z]},{t:tm,pos:[mx,y,z]},{t:dur,pos:[ex,y,z]}];
  }
  if(m.stop_at!=null&&m.stop_at<dur){
    const ts=m.stop_at,p=samplePos(keys,ts);
    const kept=keys.filter(k=>k.t<ts);
    kept.push({t:ts,pos:p},{t:dur,pos:cl(p)});
    return kept;
  }
  return keys;
}
function unclash(objs,dur,log){
  for(let i=0;i<objs.length;i++) for(let j=i+1;j<objs.length;j++){
    const a=objs[i],b=objs[j];
    if(isBG(a)||isBG(b)) continue;
    const needZ=(kindOf(a).size[2]+kindOf(b).size[2])/2+.35;
    const needX=(kindOf(a).size[0]+kindOf(b).size[0])/2;
    let worst=0;
    for(let s=0;s<=40;s++){
      const t=dur*s/40,pa=samplePos(a.keys,t),pb=samplePos(b.keys,t);
      if(Math.abs(pa[0]-pb[0])<needX){
        const gap=needZ-Math.abs(pa[2]-pb[2]);
        if(gap>worst) worst=gap;
      }
    }
    if(worst>0){
      const heavy=kindOf(a).size[0]>=kindOf(b).size[0]?a:b, light=heavy===a?b:a;
      heavy.keys.forEach(k=>k.pos[2]-=worst*.55);
      light.keys.forEach(k=>k.pos[2]+=worst*.55);
      if(log) log.push(light.label+' и '+heavy.label);
    }
  }
}
function shiftTrack(shot,def,dx,dy,dz){
  def.keys.forEach(k=>{k.pos[0]+=dx;k.pos[1]+=dy;k.pos[2]+=dz;});
  const lanes=[];
  unclash(shot.objects,shot.duration,lanes);
  lanes.forEach(tag=>{if(shot.notes.lanes.indexOf(tag)<0) shot.notes.lanes.push(tag);});
}
function buildCamera(spec,byId){
  const dur=spec.duration,c=spec.camera||{move:'static'};
  const tgt=byId[c.target]||byId[spec.anchor]||Object.values(byId)[0];
  const p0=tgt?samplePos(tgt.keys,0):[0,1,0];
  const L=[p0[0],Math.max(1,p0[1]),p0[2]];
  const h=c.height!=null?c.height:1.7, d=c.distance!=null?c.distance:8;
  const keys=[];
  if(c.move==='orbit'){
    const deg=(c.degrees!=null?c.degrees:60)*Math.PI/180;
    const dir=(c.direction==='left')?-1:1, N=8;
    for(let i=0;i<=N;i++){
      const a=dir*deg*i/N;
      keys.push({t:dur*i/N,pos:[L[0]+Math.sin(a)*d,h,L[2]+Math.cos(a)*d],look:cl(L)});
    }
  } else if(c.move==='dolly_out'){
    keys.push({t:0,pos:[L[0],h,L[2]+d*.6],look:cl(L)},{t:dur,pos:[L[0],h+.9,L[2]+d*1.7],look:cl(L)});
  } else if(c.move==='dolly_in'){
    keys.push({t:0,pos:[L[0],h,L[2]+d*1.7],look:cl(L)},{t:dur,pos:[L[0],h,L[2]+d*.55],look:cl(L)});
  } else if(c.move==='track'){
    for(let i=0;i<=6;i++){
      const t=dur*i/6,p=tgt?samplePos(tgt.keys,t):[0,1,0];
      keys.push({t,pos:[p[0],h,p[2]+d],look:[p[0],Math.max(1,p[1]),p[2]]});
    }
  } else keys.push({t:0,pos:[L[0],h,L[2]+d],look:cl(L)});
  return {keys};
}
function buildScene(spec){
  const notes={separated:[],lanes:[]};
  const byId=place(spec), list=Object.values(byId);
  separate(list,notes.separated);
  const motions={}; (spec.motion||[]).forEach(m=>motions[m.who]=m);
  list.forEach(o=>o.keys=trackFor(o,motions[o.id],spec));
  unclash(list,spec.duration,notes.lanes);
  return {duration:spec.duration||5,notes,spec,
    objects:list.map(o=>({id:o.id,label:o.label||o.id,kind:o.kind,shape:kindOf(o).shape,
      size:kindOf(o).size,facing:o.facing||'camera',keys:o.keys})),
    camera:buildCamera(spec,byId)};
}

// экспорт для тестов в node; в браузере просто игнорируется
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {buildScene, samplePos, sideVector, place, separate, unclash, shiftTrack,
                    buildCamera, trackFor, KINDS, FACING};
}
