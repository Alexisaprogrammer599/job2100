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
  o.frequency.value = freq; o.type = 'sine';
  o.connect(g); g.connect(audioCtx.destination);
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
  o.start(); o.stop(audioCtx.currentTime + time);
}

const hood = new Image();
hood.src = 'assets/hooded.png';

// Game state
const state = {
  running: true,
  score: 0,
  honor: 50,   // 0..100 (higher = more 'good' choices)
  risk: 0,     // cumulative risk points (no deaths)
  speed: 3.0,
  maxSpeed: 7.5,
  gravity: 0.6,
  ground: H - 64,
  t: 0,
  present: false,
  stage: 0,
  ended: false
};

const ui = {
  score: document.getElementById('score'),
  honor: document.getElementById('honor'),
  risk: document.getElementById('risk'),
  speed: document.getElementById('speed'),
  year: document.getElementById('year')
};

const player = {x:120,y:state.ground-48,w:42,h:48,vy:0,onGround:true,dash:0,invuln:0};
const keys = {};
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if(e.key === ' ') e.preventDefault();
  if(e.key.toLowerCase() === 'm'){ muted=!muted; toast(muted?'Muted':'Unmuted'); }
  if(e.key.toLowerCase() === 'p'){ state.present=!state.present; toast(state.present?'Presentation ON':'Presentation OFF'); }
  if(e.key.toLowerCase() === 'r'){ restart(); }
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Entities
const obstacles = []; // hazards that increase risk if collided
const pickups = [];   // green 'good' pickups that increase honor

const timeline = [
  {year:1950,desc:"Turing, formal ideas of intelligence"},
  {year:1980,desc:"Expert systems — early industry uses"},
  {year:2000,desc:"Search, recommendations, and games"},
  {year:2020,desc:"Deep learning & large models widely used"},
  {year:2050,desc:"Copilots in workplaces; strong augmentation"},
  {year:2080,desc:"City-scale systems & automated governance"},
  {year:2100,desc:"Human+AI partners shape society"}
];

function spawnObstacle(){
  const r = Math.random();
  if(r<0.6){
    obstacles.push({x:W+40,y:state.ground-(70+Math.random()*110),w:40,h:24,type:'drone',vx:state.speed+1.2,penalty:5});
  } else {
    obstacles.push({x:W+40,y:state.ground-22,w:30,h:22,type:'spike',vx:state.speed,penalty:8});
  }
}
function spawnPickup(){
  const idx = Math.min(state.stage, timeline.length-1);
  pickups.push({x:W+20,y:state.ground-(100+Math.random()*140),r:12,vx:state.speed,info:timeline[idx],value:10});
}

let toastTimer=0,toastText='';
function toast(t){ toastText=t; toastTimer = 200; renderToast(); }
function renderToast(){
  const id = 'toastEl'; let el = document.getElementById(id);
  if(!el){ el = document.createElement('div'); el.id = id; el.className = 'toast'; document.body.appendChild(el); }
  el.innerHTML = toastText;
  if(toastTimer<=0){ try{ el.remove(); }catch(e){} }
}

function caption(msg){ if(!state.present) return; toast('<span class="badge">Explain</span>' + msg); }

function restart(){
  state.running=true; state.score=0; state.honor=50; state.risk=0; state.speed=3; state.stage=0; state.ended=false;
  obstacles.length=0; pickups.length=0;
  player.x=120; player.y=state.ground-48; player.vy=0; player.onGround=true; player.dash=0; player.invuln=0;
  uiUpdate();
  toast('Restarted timeline. Play as an AI engineer.');
}

function uiUpdate(){
  ui.score.textContent = 'Score: ' + state.score;
  ui.honor.textContent = 'Honor: ' + Math.round(state.honor);
  ui.risk.textContent = 'Risk: ' + Math.round(state.risk);
  ui.speed.textContent = 'Speed: ' + state.speed.toFixed(1) + 'x';
  ui.year.textContent = 'Year: ' + timeline[state.stage].year;
}

// helpers
function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
function circleRect(cx,cy,cr,rx,ry,rw,rh){
  const nx = Math.max(rx, Math.min(cx, rx+rw));
  const ny = Math.max(ry, Math.min(cy, ry+rh));
  const dx = cx - nx, dy = cy - ny;
  return (dx*dx + dy*dy) <= cr*cr;
}

// drawing
function drawBackground(t){
  ctx.fillStyle = '#020417';
  ctx.fillRect(0,0,W,H);
  // simple stars/parallax
  ctx.fillStyle = '#0f2145';
  for(let i=0;i<60;i++){
    const x = (i*137 + t*0.08) % W;
    const y = (i*73) % (H-100);
    ctx.fillRect(W-x, y, 2, 2);
  }
  // ground
  ctx.fillStyle = '#061028';
  ctx.fillRect(0, state.ground, W, H - state.ground);
}

function drawPlayer(){
  ctx.fillStyle = '#cfe3ff';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = '#14243a';
  ctx.fillRect(player.x+6, player.y+10, player.w-12, 10);
}
function drawDrone(o){ ctx.fillStyle = '#d05b5b'; ctx.fillRect(o.x,o.y,o.w,o.h); }
function drawSpike(o){
  ctx.fillStyle = '#d05b5b'; ctx.beginPath(); ctx.moveTo(o.x, o.y+o.h); ctx.lineTo(o.x+o.w*0.5,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.fill();
}
function drawPickup(p){
  ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
  ctx.fillStyle = '#6fe3b2'; ctx.fill();
  ctx.strokeStyle = '#bff5dd'; ctx.lineWidth = 2; ctx.stroke();
}

function drawCameo(t){
  if(state.stage < timeline.length-1) return;
  const x = W - ((t*0.3) % (W + 120));
  const y = 80 + Math.sin(t*0.008)*18;
  ctx.drawImage(hood, x, y);
}

// Endings: compute when stage reaches last and score threshold is met (or player chooses to stop collecting)
function maybeEnd(){
  if(state.ended) return;
  if(state.stage >= timeline.length-1 && state.score >= 30){
    state.ended = true;
    state.running = false;
    showEnding();
  }
}

function showEnding(){
  // Decide outcome by comparing honor and risk
  const honor = state.honor;
  const risk = state.risk;
  const container = document.createElement('div');
  container.className = 'endOverlay';
  document.body.appendChild(container);
  let title='', body='';
  if(honor >= 65 && risk <= 30){
    title = 'Uplift — Partnership Achieved';
    body = 'Your stewardship led to broadly beneficial outcomes. AIs amplify human creativity and prosperity. The engineer is celebrated as a systems steward.';
  } else if(honor <= 35 && risk >= 60){
    title = 'Breakdown — Unchecked Risk';
    body = 'Design choices prioritized short-term gains. Systems drifted, leading to runaway coordination failures. The world faces a difficult re-stabilization.';
  } else {
    title = 'Mixed Future — Coexistence with Tradeoffs';
    body = 'The future is neither utopia nor collapse. Regulations, audits, and cultural adaptation shape a negotiated balance.';
  }
  container.innerHTML = `<div style="max-width:760px"><h2>${title}</h2><p style="font-size:18px">${body}</p><p style="margin-top:12px"><strong>Stats</strong> — Honor: ${Math.round(honor)}, Risk: ${Math.round(risk)}, Score: ${state.score}</p><p style="margin-top:18px">Press <strong>R</strong> to play again.</p></div>`;
  // small cameo float
  setTimeout(()=>{
    let t0 = performance.now();
    function anim(ts){
      const elapsed = ts - t0;
      ctx.save();
      ctx.globalAlpha = Math.min(1, elapsed/1000);
      drawCameo(elapsed);
      ctx.restore();
      if(elapsed < 3000) requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);
  }, 400);
}

// main loop
let last = 0;
function loop(ts){
  if(!last) last = ts;
  const dt = Math.min(32, ts - last);
  last = ts;
  if(state.running) update(dt);
  render(ts);
  if(toastTimer>0){ toastTimer--; renderToast(); }
  requestAnimationFrame(loop);
}

function update(dt){
  state.t += dt;
  // spawn rates tied to score/stage for smoother pacing
  if(Math.random() < 0.018 + state.score*0.0006) spawnObstacle();
  if(Math.random() < 0.01 + state.stage*0.002) spawnPickup();

  // speed scaling gently
  state.speed = Math.min(state.maxSpeed, 3 + state.score*0.008);
  ui.speed.textContent = 'Speed: ' + state.speed.toFixed(1) + 'x';

  // player movement
  if(keys['a']||keys['arrowleft']) player.x -= 2.6;
  if(keys['d']||keys['arrowright']) player.x += 2.6;
  if(keys['shift'] && player.dash <= 0){ player.dash = 10; beep(520,0.04); }
  if(player.dash > 0){ player.x += 2.6; player.dash--; }
  if((keys[' ']||keys['space']) && player.onGround){ player.vy = -11; player.onGround = false; beep(740,0.06); caption('Upskill: jump to higher capability.'); }
  player.vy += state.gravity; player.y += player.vy;
  if(player.y + player.h >= state.ground){ player.y = state.ground - player.h; player.vy = 0; player.onGround = true; }
  player.x = Math.max(40, Math.min(W-100, player.x));
  if(player.invuln > 0) player.invuln--;

  // move world
  for(const o of obstacles) o.x -= o.vx;
  for(const p of pickups) p.x -= p.vx;

  // collisions: obstacles increase risk but don't kill; pickups increase honor and advance stage
  for(let i=obstacles.length-1;i>=0;i--){
    const o = obstacles[i];
    if(o.x < -120){ obstacles.splice(i,1); continue; }
    if(aabb(player.x,player.y,player.w,player.h, o.x,o.y,o.w,o.h)){
      // on collision, increase risk slightly, provide invulnerability frames to avoid repeated hits
      obstacles.splice(i,1);
      state.risk += o.penalty;
      state.honor -= o.penalty*0.3;
      player.invuln = 40;
      toast('<span class="badge">Risk</span> You encountered an unregulated hazard — Risk increased.');
      beep(260,0.06);
    }
  }

  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    if(p.x < -60){ pickups.splice(i,1); continue; }
    if(circleRect(p.x,p.y,p.r, player.x,player.y,player.w,player.h)){
      pickups.splice(i,1);
      state.score += 6;
      state.honor = Math.min(100, state.honor + p.value*0.8);
      toast('<span class="badge">'+p.info.year+'</span> '+p.info.desc);
      beep(880,0.05);
      // advance timeline stage (progression); but cap to final stage
      if(state.stage < timeline.length-1) state.stage++;
    }
  }

  // gentle decay and clamp of metrics for clearer endings
  state.risk = Math.max(0, Math.min(200, state.risk * 0.998));
  state.honor = Math.max(0, Math.min(100, state.honor));

  uiUpdate();

  // check ending condition: when at final stage and score high enough, trigger ending
  maybeEnd();
}

function render(ts){
  // clear + background
  drawBackground(state.t);

  // pickups
  for(const p of pickups) drawPickup(p);
  // obstacles
  for(const o of obstacles){ if(o.type==='drone') drawDrone(o); else drawSpike(o); }
  // ground
  ctx.fillStyle = '#0f2747'; ctx.fillRect(0, state.ground, W, 4);
  // player
  drawPlayer();
  // cameo
  drawCameo(state.t);

  // HUD small indicators (honor bar / risk bar)
  // honor bar (left)
  const barW = 200;
  ctx.fillStyle = '#12324a'; ctx.fillRect(12,12,barW,10);
  ctx.fillStyle = '#7be6ab'; ctx.fillRect(12,12, barW * (state.honor/100), 10);
  ctx.strokeStyle = '#0f2747'; ctx.strokeRect(12,12,barW,10);
  // risk bar (right)
  ctx.fillStyle = '#2a1010'; ctx.fillRect(W-12-barW,12,barW,10);
  const riskNorm = Math.min(1, state.risk/100);
  ctx.fillStyle = '#ff8b8b'; ctx.fillRect(W-12-barW,12, barW * riskNorm, 10);
  ctx.strokeStyle = '#0f2747'; ctx.strokeRect(W-12-barW,12,barW,10);

  // if game ended show overlay handled separately
}

// start
toast('Play as an AI engineer — collect milestones, manage Honor vs Risk.');
uiUpdate();
requestAnimationFrame(loop);
})();