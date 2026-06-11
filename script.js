/* =========================================================
   0. SETUP
   ========================================================= */
const HAS_GSAP = !!(window.gsap);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger);

/* =========================================================
   1. CUSTOM CURSOR (fluid magnetic ring)
   ========================================================= */
(function cursor(){
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (matchMedia('(pointer:coarse)').matches) return;
  let mx=innerWidth/2, my=innerHeight/2, rx=mx, ry=my;
  addEventListener('mousemove', e=>{ mx=e.clientX; my=e.clientY; });
  function loop(){
    rx += (mx-rx)*0.18; ry += (my-ry)*0.18;
    dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  }
  loop();
  const hot = 'a, button, [data-cursor], .pod, .cred, .node, .chip';
  document.addEventListener('mouseover', e=>{ if(e.target.closest(hot)) document.body.classList.add('hovering'); });
  document.addEventListener('mouseout',  e=>{ if(e.target.closest(hot)) document.body.classList.remove('hovering'); });
  // pod spotlight follows cursor
  document.querySelectorAll('.pod').forEach(p=>{
    p.addEventListener('mousemove', e=>{
      const r=p.getBoundingClientRect();
      p.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
      p.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
    });
  });
})();

/* =========================================================
   2. BACKGROUND PARTICLE FIELD (morphing canvas)
   ========================================================= */
const Field = (function(){
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  let W, H, DPR, P=[], mode='aura', N=0, t=0;
  let warp=0; // 0..1 warp intensity
  const mouse = {x:innerWidth/2, y:innerHeight/2, sx:innerWidth/2, sy:innerHeight/2};

  function resize(){
    DPR = Math.min(devicePixelRatio||1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    N = Math.max(70, Math.min(150, Math.floor(W*H/13000)));
    build();
  }

  function build(){
    P = [];
    for(let i=0;i<N;i++){
      P.push({
        x:Math.random()*W, y:Math.random()*H,
        tx:Math.random()*W, ty:Math.random()*H,
        vx:(Math.random()-.5)*.4, vy:(Math.random()-.5)*.4,
        r:Math.random()*1.8+.6,
        lime:Math.random()<0.14,
        ring:Math.floor(Math.random()*3),
        ang:Math.random()*Math.PI*2,
        lane:Math.random(),
        seed:Math.random()*1000
      });
    }
  }

  // ---- layout target generators ----
  function targets(){
    if(mode==='grid'){
      const cols=Math.ceil(Math.sqrt(N*W/H)), rows=Math.ceil(N/cols);
      const gx=W/(cols+1), gy=H/(rows+1);
      P.forEach((p,i)=>{
        const c=i%cols, r=Math.floor(i/cols);
        p.tx=gx*(c+1)+Math.sin(t*0.6+p.seed)*8;
        p.ty=gy*(r+1)+Math.cos(t*0.6+p.seed)*8;
      });
    } else if(mode==='stream'){
      P.forEach(p=>{
        p.x += 1.6 + p.lane*1.4;
        if(p.x>W+20) p.x=-20;
        const band = Math.floor(p.lane*9);
        p.ty = (band+1)*(H/10) + Math.sin(t*1.2+p.seed)*10;
        p.tx = p.x;
      });
    } else if(mode==='orbit'){
      const cx=W*0.5, cy=H*0.5;
      const radii=[Math.min(W,H)*0.16, Math.min(W,H)*0.27, Math.min(W,H)*0.38];
      P.forEach(p=>{
        p.ang += 0.004 + p.ring*0.0015;
        const rad=radii[p.ring];
        const persp = 0.5 + 0.5*Math.sin(p.ang*1.0); // fake depth
        p.tx = cx + Math.cos(p.ang)*rad;
        p.ty = cy + Math.sin(p.ang)*rad*0.5; // elliptical -> 3D-ish
        p.depth = persp;
      });
    } else if(mode==='wave'){
      P.forEach((p,i)=>{
        p.x += 0.5;
        if(p.x>W+20) p.x=-20;
        p.tx=p.x;
        p.ty=H*0.5 + Math.sin(p.x*0.004 + t*0.6 + p.lane*6)*H*0.16
                   + Math.sin(p.x*0.001 - t*0.3)*H*0.05;
      });
    } else { // aura
      P.forEach(p=>{
        p.x += p.vx; p.y += p.vy;
        if(p.x<0||p.x>W) p.vx*=-1;
        if(p.y<0||p.y>H) p.vy*=-1;
        // gentle cursor attraction
        const dx=mouse.sx-p.x, dy=mouse.sy-p.y, d=Math.hypot(dx,dy);
        if(d<260){ p.x+=dx/d*0.6; p.y+=dy/d*0.6; }
        p.tx=p.x; p.ty=p.y;
      });
    }
  }

  function draw(){
    t+=0.016;
    mouse.sx += (mouse.x-mouse.sx)*0.08;
    mouse.sy += (mouse.y-mouse.sy)*0.08;
    ctx.clearRect(0,0,W,H);
    targets();

    // warp displacement (transition tunnel)
    const cx=W/2, cy=H/2;

    // lerp toward targets
    const lerp = (mode==='stream'||mode==='wave'||mode==='aura')?1:0.06;
    P.forEach(p=>{
      if(lerp<1){ p.x += (p.tx-p.x)*lerp; p.y += (p.ty-p.y)*lerp; }
      if(warp>0){
        const dx=p.x-cx, dy=p.y-cy;
        p.x += dx*warp*0.22; p.y += dy*warp*0.22;
        if(p.x<-40||p.x>W+40||p.y<-40||p.y>H+40){ p.x=cx+(Math.random()-.5)*40; p.y=cy+(Math.random()-.5)*40; }
      }
    });

    // connections
    const maxD = warp>0 ? 999 : (mode==='stream'?70:130);
    for(let i=0;i<P.length;i++){
      const a=P[i];
      for(let j=i+1;j<P.length;j++){
        const b=P[j];
        const dx=a.x-b.x, dy=a.y-b.y;
        const d2=dx*dx+dy*dy;
        if(d2<maxD*maxD){
          const al=(1-Math.sqrt(d2)/maxD);
          if(warp>0){
            ctx.strokeStyle=`rgba(212,255,26,${al*0.5*warp})`;
          } else {
            ctx.strokeStyle = (a.lime||b.lime)
              ? `rgba(212,255,26,${al*0.18})`
              : `rgba(245,245,247,${al*0.12})`;
          }
          ctx.lineWidth = warp>0?1.2:0.6;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }

    // nodes
    P.forEach(p=>{
      let r=p.r;
      if(mode==='orbit'&&p.depth!=null) r=p.r*(0.5+p.depth);
      if(warp>0) r=p.r*(1+warp*1.5);
      ctx.beginPath();
      ctx.fillStyle = p.lime ? `rgba(212,255,26,${0.8})` : `rgba(245,245,247,${0.55})`;
      if(warp>0) ctx.fillStyle=`rgba(212,255,26,${0.6+0.4*warp})`;
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
  resize(); draw();

  return {
    setMode(m){ mode=m; },
    setWarp(v){ warp=v; },
    get mode(){ return mode; }
  };
})();

/* =========================================================
   3. TEXT SPLITTING HELPERS
   ========================================================= */
function splitWords(el){
  const text = el.textContent.trim();
  el.textContent='';
  const words=text.split(/\s+/);
  const inners=[];
  words.forEach((w,i)=>{
    const wrap=document.createElement('span'); wrap.className='word';
    const inner=document.createElement('span'); inner.className='word-inner'; inner.textContent=w;
    wrap.appendChild(inner); el.appendChild(wrap);
    if(i<words.length-1) el.appendChild(document.createTextNode(' '));
    inners.push(inner);
  });
  return inners;
}
function buildHeroName(){
  document.querySelectorAll('#heroName .seg').forEach(seg=>{
    const word=seg.dataset.word;
    [...word].forEach(c=>{
      const s=document.createElement('span'); s.className='ch'; s.textContent=c; seg.appendChild(s);
    });
  });
}

/* =========================================================
   4. HERO INTRO + TICKER
   ========================================================= */
buildHeroName();
(function ticker(){
  const el=document.getElementById('ticker');
  const parts=['SOFTWARE DEVELOPER',' // ','CLOUD ENTHUSIAST',' // ','MCA DEV'];
  el.innerHTML = parts.map((p,i)=> i%2 ? `<span class="tk">${p}</span>` : p).join('');
})();

if(HAS_GSAP){
  const introTl=gsap.timeline({delay:0.25});
  introTl.from('.hero-eyebrow',{y:14,opacity:0,duration:0.8,ease:'power3.out'})
    .to('#heroName .ch',{y:0,duration:1.05,ease:'power4.out',stagger:0.035},'-=0.3')
    .from('#ticker',{opacity:0,y:12,duration:0.7},'-=0.5')
    .from('.init-btn',{opacity:0,y:18,duration:0.7},'-=0.4')
    .to('#cue',{opacity:1,duration:0.6},'-=0.2');
} else {
  document.querySelectorAll('#heroName .ch').forEach(c=>c.style.transform='translateY(0)');
}

/* =========================================================
   5. WARP TRANSITION (INITIALIZE SYSTEM)
   ========================================================= */
const main=document.getElementById('main');
const track=document.getElementById('track');
let entered=false;

function enterCore(){
  if(entered) return; entered=true;
  main.classList.add('live');
  document.body.classList.remove('locked');
  track.classList.add('show');

  if(!HAS_GSAP || reduceMotion){
    Field.setMode('grid');
    document.getElementById('view1').scrollIntoView({behavior:'smooth'});
    setupReveals();
    return;
  }

  const tl=gsap.timeline();
  tl.to('#cue',{opacity:0,duration:0.2})
    .to('.hero-core',{scale:1.6,opacity:0,filter:'blur(6px)',duration:0.9,ease:'power3.in'},0)
    .to('.status,.hero-meta',{opacity:0,duration:0.4},0)
    // ignite warp
    .add(()=>{ gsap.to({v:0},{v:1,duration:0.45,onUpdate:function(){Field.setWarp(this.targets()[0].v);}}); },0.15)
    .add(()=>{ Field.setMode('grid');
               gsap.to({v:1},{v:0,duration:0.7,onUpdate:function(){Field.setWarp(this.targets()[0].v);}}); },0.95)
    .add(()=>{
      document.getElementById('hero').style.display='none';
      window.scrollTo(0,0);
      setupReveals();
      ScrollTrigger.refresh();
    },1.0)
    .fromTo('#main',{opacity:0},{opacity:1,duration:0.8,ease:'power2.out'},1.05);
}
document.getElementById('initBtn').addEventListener('click',enterCore);

/* =========================================================
   6. SCROLL REVEALS + CANVAS MODE + PROGRESS TRACK
   ========================================================= */
function setupReveals(){
  if(setupReveals.done) return; setupReveals.done=true;

  // split section titles into words
  document.querySelectorAll('.split').forEach(h=>{
    const inners=splitWords(h);
    if(HAS_GSAP){
      gsap.set(inners,{yPercent:115});
      ScrollTrigger.create({
        trigger:h, start:'top 82%',
        onEnter:()=>gsap.to(inners,{yPercent:0,duration:1,ease:'power4.out',stagger:0.08})
      });
    } else { inners.forEach(i=>i.style.transform='translateY(0)'); }
  });

  // generic reveals
  document.querySelectorAll('.reveal').forEach(el=>{
    if(HAS_GSAP){
      ScrollTrigger.create({
        trigger:el, start:'top 88%',
        onEnter:()=>gsap.to(el,{opacity:1,y:0,duration:0.9,ease:'power3.out'})
      });
    } else { el.style.opacity=1; el.style.transform='none'; }
  });

  // canvas mode + progress track per view
  const views=document.querySelectorAll('.view');
  const dots=document.querySelectorAll('#track .t');
  views.forEach((v,idx)=>{
    const mode=v.dataset.mode;
    if(HAS_GSAP){
      ScrollTrigger.create({
        trigger:v, start:'top 55%', end:'bottom 45%',
        onEnter:()=>setView(mode,idx),
        onEnterBack:()=>setView(mode,idx)
      });
    }
  });
  function setView(mode,idx){
    Field.setMode(mode);
    dots.forEach(d=>d.classList.toggle('active', +d.dataset.i===idx));
  }
  // initialise first
  setView('grid',0);
}

/* fallback: if user never clicks but scrolls (defensive) */
if(!HAS_GSAP){ /* content visible via fallbacks once entered */ }

/* =========================================================
   7. PROFILE IMAGE LOADER (tries common filenames, graceful fallback)
   ========================================================= */
(function profileImg(){
  const img=document.getElementById('meImg');
  const frame=document.getElementById('phFrame');
  if(!img||!frame) return;
  const candidates=['profile.jpg','profile.jpeg','profile.png','profile.webp','anmol.jpg'];
  let i=0;
  img.addEventListener('error',()=>{
    i++;
    if(i<candidates.length){ img.src=candidates[i]; }
    else { frame.classList.add('fallback'); }   // show styled "AS" placeholder
  });
})();

/* blinking terminal cursor */
setInterval(()=>{const b=document.getElementById('blink'); if(b) b.style.opacity = b.style.opacity==='0'?'1':'0';},530);
