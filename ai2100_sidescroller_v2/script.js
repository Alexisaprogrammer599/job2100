(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let muted = false;
  function beep(freq=660, time=0.05){
    if(muted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    o.type = 'sine';
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
    o.start(); o.stop(audioCtx.currentTime + time);
  }

  const palSprite = new Image();
  palSprite.src = 'assets/palpatine.png';

  const state = {
    running: true,
    score: 0,
    lives: 3,
    speed: 3.0,
    maxSpeed: 8,
    gravity: 0.6,
    ground: H - 64,
    t: 0,
    present: false,
    stage: 0
  };

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    speed: document.getElementById('speed'),
    year: document.getElementById('year')
  };

  const player = {x: 120, y: state.ground-48, w: 42, h: 48, vy: 0, onGround:true, dash:0, invuln:0};

  const keys = {};
  addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if(e.key === ' ') e.preventDefault();
    if(e.key.toLowerCase() === 'm'){ muted=!muted; toast(muted?"Muted":"Unmuted"); }
    if(e.key.toLowerCase() === 'p'){ state.present=!state.present; toast(state.present?"Presentation ON":"Presentation OFF"); }
    if(e.key.toLowerCase() === 'r'){ reset(); }
  });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  const obstacles = [];
  const pickups = [];

  const timeline = [
    {year: 1950, text:"1950s: Alan Turing proposes the 'Imitation Game' → the Turing Test."},
    {year: 1980, text:"1980s: Expert systems used in medicine, but brittle."},
    {year: 2000, text:"2000s: AI in search engines, recommendation, chess → daily life."},
    {year: 2020, text:"2020s: Deep learning and large language models widely adopted."},
    {year: 2050, text:"2050: AI copilots standard at work; universal translators fluent."},
    {year: 2080, text:"2080: AI helps govern smart cities and climate systems."},
    {year: 2100, text:"2100: Human + AI collaboration in most creative and civic fields."}
  ];

  function spawnObstacle(){
    const r=Math.random();
    if(r<0.6){ obstacles.push({x:W+40,y:state.ground-(60+Math.random()*120),w:40,h:24,type:'drone',vx:state.speed+1}); }
    else{ obstacles.push({x:W+40,y:state.ground-22,w:30,h:22,type:'spike',vx:state.speed}); }
  }
  function spawnPickup(){
    const idx=Math.min(state.stage,timeline.length-1);
    pickups.push({x:W+20,y:state.ground-(80+Math.random()*160),r:12,vx:state.speed,note:timeline[idx]});
  }

  let toastTimer=0,toastText="";
  function toast(t){toastText=t;toastTimer=180;renderToastLayer();}
  function renderToastLayer(){
    const elId="toastEl"; let el=document.getElementById(elId);
    if(!el){el=document.createElement('div');el.id=elId;el.className='toast';document.body.appendChild(el);}
    el.innerHTML=toastText; if(toastTimer<=0) el.remove();
  }
  function caption(msg){ if(!state.present) return; toast('<span class="badge">Explain</span>'+msg); }

  function reset(){
    state.score=0; state.lives=3; state.speed=3; state.t=0; state.stage=0;
    obstacles.length=0; pickups.length=0;
    player.x=120; player.y=state.ground-48; player.vy=0; player.onGround=true; player.invuln=0;
    toast("Restarted from scratch.");
  }

  function aabb(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
  function circleRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw));const ny=Math.max(ry,Math.min(cy,ry+rh));const dx=cx-nx,dy=cy-ny;return (dx*dx+dy*dy)<=cr*cr;}

  function drawBackground(t){
    ctx.fillStyle='#050814';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#1b274b';for(let i=0;i<80;i++){const x=(i*123+t*0.15)%W;const y=(i*47%H);ctx.fillRect(W-x,y,2,2);}
    ctx.fillStyle='#0a1229';ctx.fillRect(0,state.ground,W,H-state.ground);
  }

  function drawPlayer(){ctx.fillStyle=player.invuln>0?'#8fb1ff':'#cfe3ff';ctx.fillRect(player.x,player.y,player.w,player.h);ctx.fillStyle='#1b274b';ctx.fillRect(player.x+6,player.y+10,player.w-12,10);}
  function drawDrone(o){ctx.fillStyle='#c65151';ctx.fillRect(o.x,o.y,o.w,o.h);}
  function drawSpike(o){ctx.fillStyle='#c65151';ctx.beginPath();ctx.moveTo(o.x,o.y+o.h);ctx.lineTo(o.x+o.w*0.5,o.y);ctx.lineTo(o.x+o.w,o.y+o.h);ctx.closePath();ctx.fill();}
  function drawPickup(p){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='#52d1a5';ctx.fill();}

  function drawCameo(t){if(state.score<30)return;const y=80+Math.sin(t*0.01)*20;const x=W-((t*0.4)%(W+80));ctx.drawImage(palSprite,x,y);}

  let last=0;
  function loop(ts){if(!last)last=ts;const dt=Math.min(32,ts-last);last=ts;if(state.running){update(dt);render(ts);}requestAnimationFrame(loop);}

  function update(dt){
    state.t+=dt;
    if(Math.random()<0.02) spawnObstacle();
    if(Math.random()<0.01) spawnPickup();
    state.speed=Math.min(state.maxSpeed,3+state.score*0.01);
    ui.speed.textContent='Speed: '+state.speed.toFixed(1)+'x';

    // Player
    if(keys['a']||keys['arrowleft']) player.x-=2.4;
    if(keys['d']||keys['arrowright']) player.x+=2.4;
    if(keys['shift']&&player.dash<=0){player.dash=10; beep(520,0.04);}
    if(player.dash>0){player.x+=2.4;player.dash--;}
    if((keys[' ']||keys['space'])&&player.onGround){player.vy=-11;player.onGround=false;beep(740,0.06);}
    player.vy+=state.gravity; player.y+=player.vy;
    if(player.y+player.h>=state.ground){player.y=state.ground-player.h;player.vy=0;player.onGround=true;}
    player.x=Math.max(40,Math.min(W-100,player.x));
    if(player.invuln>0) player.invuln--;

    // Move
    for(const o of obstacles) o.x-=o.vx;
    for(const p of pickups) p.x-=p.vx;

    // Collisions
    for(let i=obstacles.length-1;i>=0;i--){
      const o=obstacles[i]; if(o.x<-80){obstacles.splice(i,1);continue;}
      if(player.invuln<=0&&(aabb(player.x,player.y,player.w,player.h,o.x,o.y,o.w,o.h))){
        obstacles.splice(i,1); state.lives--; player.invuln=60; beep(260,0.08);
        toast('<span class="badge">Risk</span> A setback occurred.');
      }
    }
    for(let i=pickups.length-1;i>=0;i--){
      const p=pickups[i]; if(p.x<-40){pickups.splice(i,1);continue;}
      if(circleRect(p.x,p.y,p.r,player.x,player.y,player.w,player.h)){
        pickups.splice(i,1); state.score+=5; beep(840,0.05);
        ui.score.textContent='Score: '+state.score;
        toast('<span class="badge">'+p.note.year+'</span> '+p.note.text);
        if(state.stage<timeline.length-1) state.stage++;
      }
    }

    if(state.lives<=0){state.running=false;toast("Game Over. Press R.");}
    ui.lives.textContent='Lives: '+state.lives; ui.score.textContent='Score: '+state.score;
    ui.year.textContent='Year: '+timeline[state.stage].year;
  }

  function render(ts){
    drawBackground(state.t);
    for(const p of pickups) drawPickup(p);
    for(const o of obstacles){ if(o.type==='drone') drawDrone(o); else drawSpike(o);}
    ctx.fillStyle='#1e2a4a';ctx.fillRect(0,state.ground,W,4);
    drawPlayer(); drawCameo(state.t);
    if(!state.running){ctx.save();ctx.fillStyle='rgba(4,7,18,.55)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='24px system-ui';ctx.textAlign='center';ctx.fillText('Game Over — Press R',W/2,H/2);ctx.restore();}
  }

  toast("Collect milestones to progress from 1950 → 2100!");
  requestAnimationFrame(loop);
})();