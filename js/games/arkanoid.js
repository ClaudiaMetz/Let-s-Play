(()=>{
  'use strict';
  const canvas=document.querySelector('#arkCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d'),W=390,H=650,PLAY_BOTTOM=568,BALL_R=6,BRICK_GAP=3,COLS=8,BRICK_W=(W-24-BRICK_GAP*(COLS-1))/COLS,BRICK_H=20;
  const scoreEl=document.querySelector('#arkScore'),levelEl=document.querySelector('#arkLevel'),livesEl=document.querySelector('#arkLives'),powerEl=document.querySelector('#arkPower'),overlay=document.querySelector('#arkOverlay'),overlayTitle=document.querySelector('#arkOverlayTitle'),overlayText=document.querySelector('#arkOverlayText'),startBtn=document.querySelector('#arkStart'),pauseBtn=document.querySelector('#arkPause'),restartBtn=document.querySelector('#arkRestart');
  const SAVE_KEY='pablisgames-arkanoid',NEONS=['#ff24bd','#14ddff','#baff21','#ff7417','#9e45ff','#ffe12d','#ff354f'];
  const CAPS={sticky:{label:'P',color:'#ff9f43',name:'PEGA PELOTA'},grow:{label:'G',color:'#baff21',name:'BARRA GRANDE'},shrink:{label:'C',color:'#ff354f',name:'BARRA CHICA'},triple:{label:'T',color:'#9e45ff',name:'PELOTA TRIPLE'},gun:{label:'D',color:'#14ddff',name:'DISPARO'},unstoppable:{label:'I',color:'#fff',name:'IMPARABLE'},life:{label:'♥',color:'#ff3d76',name:'VIDA'}};
  let game=null,raf=0,last=0,opened=false,drag=null,audioCtx=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hash=(n,r,c)=>(n*97+r*31+c*17)%101;
  function sound(freq=440,d=.05,delay=0,type='square',volume=.025){try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+d+.02)}catch{}}
  function lostLifeSound(){[[520,0,.1],[390,.11,.14],[255,.25,.3]].forEach(([f,t,d])=>sound(f,d,t,'triangle',.035))}
  function gameOverSound(){[[330,0,.16],[247,.17,.2],[185,.38,.26],[110,.66,.58]].forEach(([f,t,d])=>sound(f,d,t,'sawtooth',.04))}
  function layoutCell(level,r,c){const p=(level-1)%10;switch(p){case 0:return r<5;case 1:return r<6&&(r+c)%2===0||r===2;case 2:return r<6&&c>=Math.abs(3.5-r*.45)&&c<8-Math.abs(3.5-r*.45);case 3:return r<7&&(c===0||c===7||r===0||r===6||r===3);case 4:return r<7&&((r+c)%3!==0);case 5:return r<7&&(c<3||c>4||r===3);case 6:return r<8&&Math.abs(c-3.5)<=3.5-r*.35;case 7:return r<8&&(r===0||r===7||c===r||c===7-r);case 8:return r<8&&(r%2===0||c%3===0);default:return r<9&&hash(level,r,c)>25}}
  function buildLevel(level,savedBricks){
    const bricks=[];
    for(let r=0;r<10;r++)for(let c=0;c<COLS;c++)if(layoutCell(level,r,c)){
      const h=hash(level,r,c);let type='neon',hp=1;
      if(level>=10&&h<Math.min(7+level*.35,17)){type='diamond';hp=999}
      else if(level>=7&&h>88-Math.min(level,20)*.35){type='gold';hp=3}
      else if(level>=4&&h>68-Math.min(level,20)*.25){type='silver';hp=2}
      bricks.push({x:12+c*(BRICK_W+BRICK_GAP),y:24+r*(BRICK_H+5),w:BRICK_W,h:BRICK_H,type,hp,maxHp:hp,color:NEONS[(r+c+level)%NEONS.length],life:false,forcedCapsule:''})
    }
    const candidates=bricks.filter(b=>b.type!=='diamond');
    if(level%3===0&&candidates.length){const lifeCount=level>=25?2:1;for(let i=0;i<lifeCount;i++)candidates[Math.floor((candidates.length-1)*(i? .78:.38))].life=true}
    if(level>=25){const stickyCandidates=candidates.filter(b=>!b.life);if(stickyCandidates.length)stickyCandidates[Math.floor(stickyCandidates.length*.61)].forcedCapsule='sticky'}
    if(savedBricks?.length===bricks.length)savedBricks.forEach((hp,i)=>bricks[i].hp=hp);
    return bricks;
  }
  function baseSpeed(level){return Math.min(260,190+(level-1)*2.4)}
  function makeBall(x,y,vx=0,vy=0,stuck=true){return{x,y,vx,vy,r:BALL_R,stuck,stickyCaught:false,offset:0,trail:[],lastDamage:0}}
  function freshGame(level=1,score=0,lives=5,savedBricks=null){
    game={level,score,lives,bricks:buildLevel(level,savedBricks),balls:[],capsules:[],shots:[],paddle:{x:W/2,w:86,y:526,h:12},running:false,paused:false,pauseStarted:0,ended:false,stickyUntil:0,sizeUntil:0,sizeMode:'',gunUntil:0,unstoppableUntil:0,lastShot:0,messageUntil:0,message:'',lifeDropped:false};
    resetBall();updateHud();save();
  }
  function resetBall(){const p=game.paddle;game.balls=[makeBall(p.x,p.y-10)];game.capsules=[];game.shots=[]}
  function save(){if(!game)return;localStorage.setItem(SAVE_KEY,JSON.stringify({level:game.level,score:game.score,lives:game.lives,bricks:game.bricks.map(b=>b.hp)}))}
  function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s&&s.level>=1&&s.lives>0)return freshGame(s.level,s.score,s.lives,s.bricks)}catch{}freshGame()}
  function updateHud(){scoreEl.textContent='PUNTOS '+String(game.score).padStart(6,'0');levelEl.textContent='NIVEL '+String(game.level).padStart(2,'0')+' · VUELTA '+Math.ceil(game.level/30);livesEl.textContent=Array(game.lives).fill('♥').join(' ');livesEl.setAttribute('aria-label',game.lives+' vidas')}
  function showOverlay(title,text,button='CONTINUAR'){overlayTitle.textContent=title;overlayText.innerHTML=text;startBtn.textContent=button;overlay.hidden=false}
  function launch(){const speed=baseSpeed(game.level);for(const b of game.balls)if(b.stuck){if(b.stickyCaught){const aim=clamp(b.offset/(game.paddle.w/2),-.92,.92);b.vx=speed*aim;b.vy=-Math.sqrt(Math.max(1,speed*speed-b.vx*b.vx));b.stickyCaught=false}else{const angle=(-.72+Math.random()*1.44);b.vx=Math.sin(angle)*speed;b.vy=-Math.cos(angle)*speed}b.stuck=false}game.running=true;overlay.hidden=true;last=performance.now();sound(520)}
  function rayAabb(ball,box,dt){
    const minX=box.x-ball.r,maxX=box.x+box.w+ball.r,minY=box.y-ball.r,maxY=box.y+box.h+ball.r;
    let tx1=-Infinity,tx2=Infinity,ty1=-Infinity,ty2=Infinity;
    if(ball.vx===0){if(ball.x<minX||ball.x>maxX)return null}else{tx1=(minX-ball.x)/ball.vx;tx2=(maxX-ball.x)/ball.vx;if(tx1>tx2)[tx1,tx2]=[tx2,tx1]}
    if(ball.vy===0){if(ball.y<minY||ball.y>maxY)return null}else{ty1=(minY-ball.y)/ball.vy;ty2=(maxY-ball.y)/ball.vy;if(ty1>ty2)[ty1,ty2]=[ty2,ty1]}
    const enter=Math.max(tx1,ty1),exit=Math.min(tx2,ty2);if(enter<-.00001||enter>exit||enter>dt)return null;
    return{t:Math.max(0,enter),nx:tx1>ty1?(ball.vx>0?-1:1):0,ny:ty1>=tx1?(ball.vy>0?-1:1):0}
  }
  function accelerate(ball){const max=360+game.level*5,s=Math.hypot(ball.vx,ball.vy);if(!s)return;const n=Math.min(max,s*1.03)/s;ball.vx*=n;ball.vy*=n}
  function containBall(ball){
    const speed=baseSpeed(game.level);
    if(!Number.isFinite(ball.x))ball.x=W/2;
    if(!Number.isFinite(ball.y))ball.y=game.paddle.y-ball.r-2;
    if(!Number.isFinite(ball.vx)||!Number.isFinite(ball.vy)||Math.hypot(ball.vx,ball.vy)<1){ball.vx=speed*.38;ball.vy=-speed*.92}
    if(ball.x<ball.r){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}
    else if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}
    if(ball.y<ball.r){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
  }
  function spawnCapsule(brick){
    let type=null;if(brick.life)type='life';else if(brick.forcedCapsule)type=brick.forcedCapsule;else if(Math.random()<.19){const bag=['sticky','grow','grow','shrink','triple','triple','gun','unstoppable'];type=bag[Math.floor(Math.random()*bag.length)]}
    if(type)game.capsules.push({x:brick.x+brick.w/2,y:brick.y+brick.h/2,vy:92,type})
  }
  function destroyBrick(brick){if(brick.hp<=0)return;brick.hp=0;game.score+=brick.type==='gold'?300:brick.type==='silver'?200:100;spawnCapsule(brick);updateHud();save();sound(680,.035)}
  function hitBrick(ball,brick,unstoppable,now){
    if(brick.type==='diamond'){accelerate(ball);sound(980,.04);return true}
    if(unstoppable){destroyBrick(brick);return false}
    if(now-ball.lastDamage<8)return true;ball.lastDamage=now;
    brick.hp--;game.score+=100;if(brick.maxHp>1)accelerate(ball);if(brick.hp<=0)spawnCapsule(brick);updateHud();save();sound(brick.hp>0?820:650,.035);return true
  }
  function moveBall(ball,dt,now){
    if(ball.stuck){ball.x=game.paddle.x+ball.offset;ball.y=game.paddle.y-ball.r-2;return}
    containBall(ball);
    let remain=dt,loops=0;const unstoppable=now<game.unstoppableUntil;
    while(remain>.00001&&loops++<10){let hit={t:remain+1,type:''};
      if(ball.vx<0){const t=(ball.r-ball.x)/ball.vx;if(t>=0&&t<hit.t)hit={t,type:'wall',nx:1,ny:0}}
      if(ball.vx>0){const t=(W-ball.r-ball.x)/ball.vx;if(t>=0&&t<hit.t)hit={t,type:'wall',nx:-1,ny:0}}
      if(ball.vy<0){const t=(ball.r-ball.y)/ball.vy;if(t>=0&&t<hit.t)hit={t,type:'wall',nx:0,ny:1}}
      if(ball.vy>0){const ph=rayAabb(ball,{x:game.paddle.x-game.paddle.w/2,y:game.paddle.y,w:game.paddle.w,h:game.paddle.h},remain);if(ph&&ph.t<hit.t)hit={...ph,type:'paddle'}}
      for(const brick of game.bricks)if(brick.hp>0){const bh=rayAabb(ball,brick,remain);if(bh&&bh.t<hit.t)hit={...bh,type:'brick',brick}}
      if(hit.t>remain){ball.x+=ball.vx*remain;ball.y+=ball.vy*remain;break}
      ball.x+=ball.vx*hit.t;ball.y+=ball.vy*hit.t;remain-=hit.t;
      let reflect=true;if(hit.type==='brick')reflect=hitBrick(ball,hit.brick,unstoppable,now);
      if(hit.type==='paddle'){
        if(now<game.stickyUntil){ball.stuck=true;ball.stickyCaught=true;ball.offset=clamp(ball.x-game.paddle.x,-game.paddle.w*.42,game.paddle.w*.42);return}
        const speed=Math.hypot(ball.vx,ball.vy),aim=clamp((ball.x-game.paddle.x)/(game.paddle.w/2),-.92,.92);ball.vx=speed*aim;ball.vy=-Math.sqrt(Math.max(1,speed*speed-ball.vx*ball.vx));reflect=false;sound(430,.025)
      }
      if(reflect){if(hit.nx)ball.vx=-ball.vx;if(hit.ny)ball.vy=-ball.vy}
      const nudge=.08;if(reflect){ball.x+=hit.nx*nudge;ball.y+=hit.ny*nudge}else{ball.x+=ball.vx*.0003;ball.y+=ball.vy*.0003;remain=Math.max(0,remain-.0003)}
    }
    containBall(ball);ball.trail.push({x:ball.x,y:ball.y});if(ball.trail.length>(unstoppable?9:4))ball.trail.shift()
  }
  function applyCapsule(type,now){
    const c=CAPS[type];game.message=c.name;game.messageUntil=now+1800;sound(760,.09);
    if(type==='sticky')game.stickyUntil=now+12000;
    else if(type==='grow'){game.sizeMode='grow';game.sizeUntil=now+12000;game.paddle.w=126}
    else if(type==='shrink'){game.sizeMode='shrink';game.sizeUntil=now+12000;game.paddle.w=58}
    else if(type==='gun')game.gunUntil=now+12000;
    else if(type==='unstoppable')game.unstoppableUntil=now+8000;
    else if(type==='life'){if(game.lives<7){game.lives++;game.message='VIDA EXTRA · '+game.lives+'/7'}else{game.score+=5000;game.message='VIDAS AL MÁXIMO · +5000'}game.messageUntil=now+2200;updateHud()}
    else if(type==='triple'){
      const original=[...game.balls];for(const b of original){if(game.balls.length>=27)break;const speed=Math.hypot(b.vx,b.vy)||baseSpeed(game.level),angle=Math.atan2(b.vy,b.vx);for(const shift of [-.24,.24])if(game.balls.length<27)game.balls.push(makeBall(b.x,b.y,Math.cos(angle+shift)*speed,Math.sin(angle+shift)*speed,false))}
    }
    save();
  }
  function updateDrops(dt,now){
    for(const c of game.capsules){c.y+=c.vy*dt;if(c.y>game.paddle.y-5&&c.y<game.paddle.y+game.paddle.h+10&&Math.abs(c.x-game.paddle.x)<game.paddle.w/2+11){c.dead=true;applyCapsule(c.type,now)}}game.capsules=game.capsules.filter(c=>!c.dead&&c.y<PLAY_BOTTOM);
    if(now<game.gunUntil&&now-game.lastShot>430){game.lastShot=now;game.shots.push({x:game.paddle.x-game.paddle.w/2+8,y:game.paddle.y},{x:game.paddle.x+game.paddle.w/2-8,y:game.paddle.y});sound(900,.018)}
    for(const s of game.shots){s.y-=360*dt;for(const b of game.bricks)if(!s.dead&&b.hp>0&&b.type!=='diamond'&&s.x>=b.x&&s.x<=b.x+b.w&&s.y>=b.y&&s.y<=b.y+b.h){s.dead=true;b.hp--;game.score+=75;if(b.hp<=0)spawnCapsule(b);updateHud();save()}}game.shots=game.shots.filter(s=>!s.dead&&s.y>-10)
  }
  function checkState(){
    game.balls=game.balls.filter(b=>b.y<PLAY_BOTTOM+20);if(!game.balls.length){game.lives--;game.paddle.w=86;game.stickyUntil=game.gunUntil=game.unstoppableUntil=game.sizeUntil=0;updateHud();save();if(game.lives<=0){gameOverSound();game.running=false;game.ended=true;window.PabliRanking?.submit('arkanoid',game.score);showOverlay('FIN DE LA PARTIDA','PUNTAJE '+game.score,'VOLVER A EMPEZAR');return}lostLifeSound();resetBall();game.running=false;showOverlay('VIDA PERDIDA','MOVÉ LA BARRA Y TOCÁ PARA LANZAR','CONTINUAR')}
    if(game.bricks.every(b=>b.hp<=0||b.type==='diamond')){game.running=false;const completed=game.level,roundDone=completed%30===0;if(roundDone)window.PabliRanking?.submit('arkanoid',game.score);game.level++;game.bricks=buildLevel(game.level);game.capsules=[];game.shots=[];game.lifeDropped=false;game.stickyUntil=game.gunUntil=game.unstoppableUntil=game.sizeUntil=0;game.paddle.w=86;resetBall();updateHud();save();showOverlay(roundDone?'VUELTA '+(completed/30)+' COMPLETADA':'NIVEL COMPLETADO',(roundDone?'PUNTAJE '+game.score+'<br>':'')+'NIVEL '+game.level+' · VUELTA '+Math.ceil(game.level/30)+'<br>MOVÉ LA BARRA Y TOCÁ PARA LANZAR','CONTINUAR')}
  }
  function update(dt,now){if(game.sizeUntil&&now>game.sizeUntil){game.sizeUntil=0;game.paddle.w=86}for(const b of game.balls)moveBall(b,dt*1.5,now);updateDrops(dt,now);checkState()}
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
  function drawBrick(b){
    if(b.hp<=0)return;ctx.save();ctx.shadowBlur=9;ctx.shadowColor=b.type==='diamond'?'#20cfff':b.type==='gold'?'#ffc400':b.type==='silver'?'#d8f4ff':b.color;
    if(b.type==='silver'){const g=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,'#f5fbff');g.addColorStop(.5,'#718594');g.addColorStop(1,'#dff5ff');ctx.fillStyle=g}
    else if(b.type==='gold'){const g=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,'#fff7a4');g.addColorStop(.5,'#dc9000');g.addColorStop(1,'#fff06b');ctx.fillStyle=g}
    else if(b.type==='diamond'){const g=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,'#e9fdff');g.addColorStop(.28,'#21cfff');g.addColorStop(.55,'#1757ca');g.addColorStop(.78,'#8ff5ff');g.addColorStop(1,'#153b8b');ctx.fillStyle=g}
    else ctx.fillStyle=b.color;roundRect(b.x,b.y,b.w,b.h,3);ctx.fill();ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1;ctx.stroke();if(b.type!=='diamond'&&b.hp<b.maxHp){ctx.strokeStyle='#172634cc';ctx.beginPath();ctx.moveTo(b.x+b.w*.25,b.y+2);ctx.lineTo(b.x+b.w*.48,b.y+b.h*.56);ctx.lineTo(b.x+b.w*.36,b.y+b.h-2);ctx.stroke()}ctx.restore()
  }
  function draw(now){
    ctx.clearRect(0,0,W,H);const bg=ctx.createRadialGradient(W/2,230,20,W/2,300,430);bg.addColorStop(0,'#10283e');bg.addColorStop(1,'#02060b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#2b6a8a33';ctx.lineWidth=1;for(let y=0;y<PLAY_BOTTOM;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    game.bricks.forEach(drawBrick);ctx.fillStyle='#14ddff';ctx.shadowColor='#14ddff';ctx.shadowBlur=8;for(const s of game.shots)ctx.fillRect(s.x-1,s.y-8,3,9);ctx.shadowBlur=0;
    for(const c of game.capsules){const def=CAPS[c.type];ctx.save();ctx.fillStyle='#071018';ctx.strokeStyle=def.color;ctx.shadowColor=def.color;ctx.shadowBlur=10;roundRect(c.x-13,c.y-8,26,16,7);ctx.fill();ctx.stroke();ctx.fillStyle=def.color;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(def.label,c.x,c.y);ctx.restore()}
    const unstoppable=now<game.unstoppableUntil;for(const b of game.balls){ctx.save();for(let i=0;i<b.trail.length;i++){ctx.globalAlpha=(i+1)/b.trail.length*.3;ctx.fillStyle=unstoppable?NEONS[(i+Math.floor(now/90))%NEONS.length]:'#14ddff';ctx.beginPath();ctx.arc(b.trail[i].x,b.trail[i].y,b.r*(i+1)/b.trail.length,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.fillStyle=unstoppable?NEONS[Math.floor(now/80)%NEONS.length]:'#fff';ctx.shadowColor=unstoppable?'#fff':'#14ddff';ctx.shadowBlur=unstoppable?18:9;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.restore()}
    const p=game.paddle;ctx.save();ctx.shadowColor=game.sizeMode==='shrink'?'#ff354f':'#14ddff';ctx.shadowBlur=12;const pg=ctx.createLinearGradient(p.x-p.w/2,p.y,p.x+p.w/2,p.y);pg.addColorStop(0,'#1264d4');pg.addColorStop(.2,'#efffff');pg.addColorStop(.8,'#efffff');pg.addColorStop(1,'#1264d4');ctx.fillStyle=pg;roundRect(p.x-p.w/2,p.y,p.w,p.h,7);ctx.fill();ctx.restore();
    ctx.fillStyle='#091b29cc';ctx.fillRect(0,PLAY_BOTTOM,W,H-PLAY_BOTTOM);ctx.strokeStyle='#4384aa';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(0,PLAY_BOTTOM);ctx.lineTo(W,PLAY_BOTTOM);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#6ea1bd';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('↔  ZONA DE ARRASTRE',W/2,615);
    const active=[];if(now<game.stickyUntil)active.push('PEGA');if(now<game.gunUntil)active.push('DISPARO');if(now<game.unstoppableUntil)active.push('IMPARABLE');if(game.balls.length>1)active.push(game.balls.length+' PELOTAS');powerEl.textContent=now<game.messageUntil?game.message:active.join(' · ')
  }
  function loop(now){if(!opened)return;const dt=Math.min(.025,(now-last)/1000||0);last=now;if(game.running&&!game.paused)update(dt,now);draw(now);raf=requestAnimationFrame(loop)}
  function canvasX(e){const r=canvas.getBoundingClientRect();return(e.clientX-r.left)*W/r.width}
  canvas.addEventListener('pointerdown',e=>{if(!game||game.paused)return;e.preventDefault();drag={id:e.pointerId,startX:canvasX(e),paddleX:game.paddle.x,moved:false};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=canvasX(e)-drag.startX;if(Math.abs(dx)>2)drag.moved=true;game.paddle.x=clamp(drag.paddleX+dx*1.2,game.paddle.w/2,W-game.paddle.w/2);for(const ball of game.balls)if(ball.stuck){ball.x=game.paddle.x+ball.offset;ball.y=game.paddle.y-ball.r-2}});
  canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.moved)launch();drag=null});canvas.addEventListener('pointercancel',()=>drag=null);
  function resumeFromPause(){if(!game?.paused)return;const shift=performance.now()-game.pauseStarted;for(const key of ['stickyUntil','sizeUntil','gunUntil','unstoppableUntil','messageUntil'])if(game[key])game[key]+=shift;game.paused=false;pauseBtn.textContent='Ⅱ';pauseBtn.classList.remove('active')}
  startBtn.onclick=()=>{
    if(game?.ended)freshGame();
    if(game?.paused){resumeFromPause();game.running=true}
    overlay.hidden=true;
    last=performance.now();
  };
  pauseBtn.onclick=()=>{if(!game||game.ended)return;if(!game.paused){game.paused=true;game.pauseStarted=performance.now();pauseBtn.textContent='▶';pauseBtn.classList.add('active');showOverlay('PAUSA','LA PARTIDA ESTÁ GUARDADA','REANUDAR')}else{resumeFromPause();overlay.hidden=true;last=performance.now()}};
  restartBtn.onclick=()=>{if(!game||!confirm('¿Reiniciar el nivel? Vas a perder una vida.'))return;game.lives--;if(game.lives<=0)return freshGame();game.bricks=buildLevel(game.level);game.paddle.w=86;game.lifeDropped=false;game.stickyUntil=game.gunUntil=game.unstoppableUntil=game.sizeUntil=0;resetBall();game.running=false;updateHud();save();showOverlay('NIVEL REINICIADO','MOVÉ LA BARRA Y TOCÁ PARA LANZAR','CONTINUAR')};
  window.arkanoidOpen=()=>{opened=true;if(!game)load();showOverlay(game.ended?'FIN DE LA PARTIDA':'ARKANOID','ARRASTRÁ ABAJO PARA MOVER<br>TOCÁ PARA LANZAR',game.ended?'VOLVER A EMPEZAR':'JUGAR');cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(loop)};
  window.arkanoidClose=()=>{opened=false;cancelAnimationFrame(raf);save()};
})();
