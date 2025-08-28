(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Audio (simple beep using WebAudio API)
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

  // Load Palpatine sprite (small cameo)
  const palSprite = new Image();
  palSprite.src = 'assets/palpatine.png';

  // Game state
  const state = {
    running: true,
    score: 0,
    lives: 3,
    speed: 3.2,
    maxSpeed: 8,
    gravity: 0.6,
    ground: H - 64,
    t: 0,
    present: false,
    factsIndex: 0
  };

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    speed: document.getElementById('speed')
  };

  // Player
  const player = {
    x: 120, y: state.ground - 48, w: 42, h: 48, vy: 0, onGround: true, face: 1, dash: 0, invuln: 0
  };

  // Inputs
  const keys = {};
  addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if(e.key === ' '){ e.preventDefault(); }
    if(e.key.toLowerCase() === 'm'){ muted = !muted; toast(muted ? "Muted" : "Unmuted"); }
    if(e.key.toLowerCase() === 'p'){ state.present = !state.present; toast(state.present ? "Presentation mode ON" : "Presentation mode OFF"); }
    if(e.key.toLowerCase() === 'r'){ reset(); }
  });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // World objects
  const obstacles = []; // drones/spikes
  const pickups = [];   // AI upgrades / hobby chips
  const notes = [
    { tag: "Jobs", text: "2100: Most routine analysis is automated; human roles lean into oversight, ethics, creativity, and domain nuance."},
    { tag: "Hobbies", text: "Personal AIs become collaborators—co-writing music, co-producing videos, and co-designing mods."},
    { tag: "Education", text: "Learning loops are personalized; simulators assess skills with rich, low-stakes feedback."},
    { tag: "Healthcare", text: "Clinicians supervise AI triage; bedside time increases, paperwork decreases."},
    { tag: "Safety", text: "Model governance is a core profession: red-teams, auditors, and standards engineers."},
    { tag: "Craft", text: "Handmade and ‘human-only’ provenance becomes a premium art movement."},
    { tag: "Sports", text: "Amateurs train with AI coaches; tactics optimized in sim, executed on field."},
    { tag: "Research", text: "Hypothesis generation at scale; scientists steward automated experiments."},
    { tag: "Civic", text: "Civic models summarize hearings; citizens browse simulations of policy outcomes."},
    { tag: "Play", text: "Game worlds co-authored on the fly; spectators steer live narratives."}
  ];

  function spawnObstacle(){
    const r = Math.random();
    if(r < 0.6){
      // flying drone
      const y = state.ground - (60 + Math.random()*120);
      obstacles.push({x: W + 40, y, w: 40, h: 24, type:'drone', vx: state.speed + 1.2});
    } else {
      // ground spike
      obstacles.push({x: W + 40, y: state.ground - 22, w: 30, h: 22, type:'spike', vx: state.speed});
    }
  }
  function spawnPickup(){
    pickups.push({x: W + 20, y: state.ground - (80 + Math.random()*160), r: 12, vx: state.speed, note: notes[(state.factsIndex++) % notes.length]});
  }

  // Toast UI
  let toastTimer = 0, toastText = "";
  function toast(t){
    toastText = t; toastTimer = 180;
    renderToastLayer();
  }
  function renderToastLayer(){
    const elId = "toastEl";
    let el = document.getElementById(elId);
    if(!el){
      el = document.createElement('div');
      el.id = elId;
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.innerHTML = toastText;
    if(toastTimer <= 0){ el.remove(); }
  }

  // Presentation captions
  function caption(msg){
    if(!state.present) return;
    toast('<span class="badge">Explain</span>' + msg);
  }

  // Reset
  function reset(){
    state.score = 0; state.lives = 3; state.speed = 3.2; state.t = 0; obstacles.length = 0; pickups.length = 0;
    player.x = 120; player.y = state.ground - 48; player.vy = 0; player.onGround = true; player.invuln = 0;
    toast("Run it back. Future’s not fixed.");
  }

  // Collision helpers
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function circleRect(cx,cy,cr,rx,ry,rw,rh){
    const nx = Math.max(rx, Math.min(cx, rx+rw));
    const ny = Math.max(ry, Math.min(cy, ry+rh));
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  // Background parallax layers
  function drawBackground(t){
    // stars
    ctx.fillStyle = '#050814';
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#1b274b';
    for(let i=0;i<80;i++){
      const x = (i*123 + t*0.15) % W;
      const y = (i*47 % H);
      ctx.fillRect(W - x, y, 2, 2);
    }
    // skyline
    ctx.fillStyle = '#0f1732';
    for(let i=0;i<16;i++){
      const w=40+Math.random()*80,h=120+Math.random()*200;
      const x = (i*160 - (t*state.speed*0.2)%160);
      ctx.fillRect(x, H-h-64, 120, h);
    }
    // ground
    ctx.fillStyle = '#0a1229';
    ctx.fillRect(0, state.ground, W, H - state.ground);
  }

  // Entities drawing
  function drawPlayer(){
    // body
    ctx.fillStyle = player.invuln>0 ? '#8fb1ff' : '#cfe3ff';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    // visor
    ctx.fillStyle = '#1b274b';
    ctx.fillRect(player.x+6, player.y+10, player.w-12, 10);
  }
  function drawDrone(o){
    ctx.fillStyle = '#c65151';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#ffcdcd';
    ctx.fillRect(o.x+6, o.y+6, 10, 4);
  }
  function drawSpike(o){
    ctx.fillStyle = '#c65151';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y+o.h);
    ctx.lineTo(o.x+o.w*0.5, o.y);
    ctx.lineTo(o.x+o.w, o.y+o.h);
    ctx.closePath();
    ctx.fill();
  }
  function drawPickup(p){
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fillStyle = '#52d1a5';
    ctx.fill();
    ctx.strokeStyle = '#b7ffe7';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Palpatine cameo (boss float-by)
  function drawCameo(t){
    if(state.score < 50) return;
    const y = 80 + Math.sin(t*0.01)*20;
    const x = W - ((t*0.4) % (W+80));
    ctx.drawImage(palSprite, x, y);
    if(Math.floor(t)%600===0) caption("Cameo: a hooded villain drifts by. In 2100, deepfakes & mythic villains are spectacle; authenticity matters.");
  }

  // Game loop
  let last = 0;
  function loop(ts){
    if(!last) last = ts;
    const dt = Math.min(32, ts - last); // clamp
    last = ts;
    if(state.running){
      update(dt);
      render(ts);
    }
    requestAnimationFrame(loop);
  }

  function update(dt){
    state.t += dt;

    // spawn
    if(Math.random() < 0.02 + state.speed*0.0015) spawnObstacle();
    if(Math.random() < 0.012) spawnPickup();

    // accelerate slowly with score
    state.speed = Math.min(state.maxSpeed, 3.2 + state.score * 0.01);
    ui.speed.textContent = 'Speed: ' + state.speed.toFixed(1) + 'x';

    // player physics
    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];
    const shift = keys['shift'];
    if(left)  player.x -= 2.4;
    if(right) player.x += 2.4;
    if(shift && player.dash<=0){ player.dash = 10; beep(520, 0.04); caption("Dash = automation boost: faster iteration, not teleportation."); }
    if(player.dash>0){ player.x += 2.4; player.dash--; }

    // jump
    if((keys[' '] || keys['space']) && player.onGround){
      player.vy = -11; player.onGround = false; beep(740,0.06);
      caption("Jump = upskilling: it takes effort & timing.");
    }
    player.vy += state.gravity;
    player.y += player.vy;
    if(player.y + player.h >= state.ground){
      player.y = state.ground - player.h; player.vy = 0; player.onGround = true;
    }
    player.x = Math.max(40, Math.min(W-100, player.x));
    if(player.invuln>0) player.invuln--;

    // move world
    for(const o of obstacles){
      o.x -= o.vx;
    }
    for(const p of pickups){
      p.x -= p.vx;
    }

    // collisions
    for(let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      if(o.x < -80){ obstacles.splice(i,1); continue; }
      if(player.invuln<=0){
        if(o.type==='drone' && aabb(player.x,player.y,player.w,player.h,o.x,o.y,o.w,o.h)){
          obstacles.splice(i,1);
          state.lives--; player.invuln = 60; beep(260,0.08);
          toast('<span class="badge">Risk</span> Misuse & hype can smack progress. Literacy and guardrails matter.');
        } else if(o.type==='spike' && aabb(player.x,player.y,player.w,player.h,o.x,o.y,o.w,o.h)){
          obstacles.splice(i,1);
          state.lives--; player.invuln = 60; beep(260,0.08);
          toast('<span class="badge">Risk</span> Legacy constraints bite—update policies, not just models.');
        }
      }
    }

    for(let i=pickups.length-1;i>=0;i--){
      const p = pickups[i];
      if(p.x < -40){ pickups.splice(i,1); continue; }
      if(circleRect(p.x,p.y,p.r,player.x,player.y,player.w,player.h)){
        pickups.splice(i,1);
        state.score += 5; beep(840,0.05);
        ui.score.textContent = 'Score: ' + state.score;
        toast('<span class="badge">'+p.note.tag+'</span>' + p.note.text);
      }
    }

    // lives
    if(state.lives <= 0){
      state.running = false;
      toast('<span class="badge">Game Over</span> Humans + AI is the meta. Press R to try a new path.');
    }
    ui.lives.textContent = 'Lives: ' + state.lives;
    ui.score.textContent = 'Score: ' + state.score;
  }

  function render(ts){
    drawBackground(state.t);

    // draw pickups
    for(const p of pickups) drawPickup(p);

    // draw obstacles
    for(const o of obstacles){
      if(o.type==='drone') drawDrone(o);
      else drawSpike(o);
    }

    // ground line
    ctx.fillStyle = '#1e2a4a';
    ctx.fillRect(0, state.ground, W, 4);

    drawPlayer();
    drawCameo(state.t);

    // paused overlay / presentation hint
    if(!state.running){
      ctx.save();
      ctx.fillStyle = 'rgba(4,7,18,.55)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#fff';
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over — Press R to Restart', W/2, H/2);
      ctx.restore();
    }
  }

  // initial tips
  toast('<span class="badge">Welcome</span> 2100: Pair with your model. Collect upgrades; avoid pitfalls.');
  caption('Pickups map to domains (jobs, hobbies). Obstacles represent risks (hype, misuse, legacy).');

  requestAnimationFrame(loop);
})();