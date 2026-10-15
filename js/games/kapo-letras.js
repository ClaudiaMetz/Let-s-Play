(() => {
      'use strict';

      /* Diccionario jugable encapsulado. No expone variables globales y puede
         crecer sin interferir con los futuros juegos de Let's Play. */
      const KL_LEVELS = [
        { letters:'TECLADO', words:['TECLADO','COLETA','CELDA','TECLA','TALCO','LADO','TELA','ALTO','ACTO'], bonus:['ECO','OLA','CAL'] },
        { letters:'GRANITO', words:['GRANITO','GITANO','TRIGO','GRANO','TANGO','RANGO','RATON','GRITO','GIRO','RITO','NOTA','TINA','GATO'], bonus:['RIO','TAN'] },
        { letters:'PELIGRO', words:['PELIGRO','LIGERO','GOLPE','REGIO','RIEGO','PIEL','PELO','PERO','GIRO','LIGO'], bonus:['RIO','GOL','REO'] },
        { letters:'JUGADOR', words:['JUGADOR','JURADO','GRADO','AGUDO','DROGA','ARDUO','JUGAR','RAUDO','RUGA'], bonus:['ARO','ODA'] },
        { letters:'ESQUINA', words:['ESQUINA','QUIEN','SAQUE','USINA','ANIS','AQUI','ASÍ','SIN','UNA'], bonus:['ESA','SEA'] },
        { letters:'VIAJERO', words:['VIAJERO','VIAJE','VIEJO','OVEJA','REJA','ROJA','OJEA','RAJO','VIRA'], bonus:['RIO','AJO','OVA'] },
        { letters:'CUADROS', words:['CUADROS','CRUDO','ARDUO','DUROS','CURSO','SACRO','SUDOR','RUDO','ROCA','CARO','ARCO','USADO','SUDAR'], bonus:['USAR','ARO','DOS'] },
        { letters:'PINTURA', words:['PINTURA','RUTINA','PUNTA','TIRAN','PURA','TINA','RUTA','TIRA','UNIR','TURNA','TRINA'], bonus:['PAN','PAR','IRA'] },
        { letters:'CAMPEON', words:['CAMPEON','CAMPO','PEON','PENA','MANO','MONA','CENA','COME','COPA'], bonus:['AMO','PAN','CON'] },
        { letters:'LIBRETA', words:['LIBRETA','LIBRE','LETRA','RIEL','REAL','TELA','TIRA','LIRA','BATE','ARTE'], bonus:['BAR','ERA','IRA'] },
        { letters:'MONTAJE', words:['MONTAJE','MONJE','NOTA','MANO','MONA','TEMA','TOMA','MATE','TAJO','TEJA'], bonus:['AJO'] },
        { letters:'FORMULA', words:['FORMULA','MORAL','MOLAR','FAROL','FUMAR','FORMA','FLORA','AMOR','MURO','MULA','LOMA','ORAL'], bonus:['MAR'] },
        { letters:'PIEDRAS', words:['PIEDRAS','PERSA','PRESA','PRISA','SEDAR','PARES','PADRE','DARSE','SERIA','PISA','RISA','SEDA','IDEA'], bonus:['PIDE','PIE'] },
        { letters:'CUENTAS', words:['CUENTAS','CUESTA','SECTA','SAUCE','CESTA','TUNAS','SUENA','ANTES','ACUSE','CUNA','CENA','TUNA'], bonus:['ESTA','USA'] },
        { letters:'ABRIGOS', words:['ABRIGOS','SABIO','RASGO','SOBRA','OBRAS','GIRO','RISA','RASO','ROSA'], bonus:['ARO','RIO'] },
        { letters:'FRANCOS', words:['FRANCOS','FAROS','SACRO','ROSCA','CANSO','SOFA','ARCO','CARO','FARO','RASO','ORCA'], bonus:['ARO'] },
        { letters:'VOLUMEN', words:['VOLUMEN','NUEVO','MUEVO','VUELO','NULO','MENU','MULO','LEON'], bonus:['UNO'] },
        { letters:'DIURNOS', words:['DIURNOS','SUDOR','RUIDO','UNIDO','DUROS','NIDOS','RUDO','RUSO','UNIR','RINOS'], bonus:['RIO','UNO'] },
        { letters:'MARQUES', words:['MARQUES','QUEMA','SAQUE','SUMAR','MESA','REMA','RUSA'], bonus:['MAR','SER','SUR'] }
      ];

      const $ = selector => document.querySelector(selector);
      const game = $('#klGame');
      const home = $('#home');
      const board = $('#klBoard');
      const boardWrap = game.querySelector('.kl-board-wrap');
      const wheel = $('#klWheel');
      const currentEl = $('#klCurrent');
      const messageEl = $('#klMessage');
      const particles = $('#klParticles');
      const STORAGE = 'pablisgames-kapo-letras-v2';
      const STATS_KEY = 'pablisgames-kapo-letras-stats';
      const SOUND_KEY = 'pablisgames-sound';
      let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
      let audioCtx;
      let state;
      let layout;
      let letterOrder = [];
      let drag = null;
      let messageTimer;

      const normalize = word => String(word).toUpperCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').replace(/Ü/g,'U');

      KL_LEVELS.forEach(level => {
        level.letters = normalize(level.letters);
        level.words = level.words.map(normalize);
        level.bonus = level.bonus.map(normalize);
      });

      function defaultState(level = null) {
        if (!Number.isInteger(level)) level=Math.floor(Math.random()*KL_LEVELS.length);
        return { level, round:1, found:[], extras:[], hints:3, hinted:[], startedAt:Date.now(), elapsed:0, pausedSeconds:0, timerPaused:false };
      }

      function loadState() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE));
          if (!saved || !Number.isInteger(saved.level) || saved.level < 0 || saved.level >= KL_LEVELS.length) throw Error();
          return Object.assign(defaultState(saved.level), saved);
        } catch { return defaultState(); }
      }

      function saveState() { localStorage.setItem(STORAGE, JSON.stringify(state)); }

      function getStats() {
        try { return Object.assign({completed:0,words:0,extras:0}, JSON.parse(localStorage.getItem(STATS_KEY)) || {}); }
        catch { return {completed:0,words:0,extras:0}; }
      }

      function saveStatsLevel() {
        const stats = getStats();
        stats.completed++;
        stats.words += state.found.length;
        stats.extras += state.extras.length;
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      }

      const klClockText=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      function klElapsed(){const saved=Math.max(0,Number(state.pausedSeconds)||0),running=state.timerPaused?0:Math.max(0,Math.floor((Date.now()-state.startedAt)/1000));return Math.max(1,saved+running)}
      function updateKlClock(){if(state&&!game.hidden)$('#klTime').textContent=klClockText(state.elapsed||klElapsed())}

      function audio() {
        if (!soundOn) return null;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
      }

      function tone(freq, start, duration, type='triangle', volume=.035) {
        const ctx = audio();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = ctx.currentTime + start;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(volume, at + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + duration + .03);
      }

      function sfx(kind) {
        if (kind === 'tap') tone(420,0,.045,'square',.014);
        if (kind === 'delete') tone(250,0,.06,'square',.016);
        if (kind === 'bad') { tone(190,0,.16,'sawtooth',.025); tone(150,.1,.18,'sawtooth',.02); }
        if (kind === 'bonus') [[520,0],[660,.08],[790,.16]].forEach(([f,t])=>tone(f,t,.13,'triangle',.032));
        if (kind === 'word') [[392,0],[523,.08],[659,.17],[784,.27]].forEach(([f,t])=>tone(f,t,.16,'triangle',.04));
        if (kind === 'hint') [[880,0],[1175,.11]].forEach(([f,t])=>tone(f,t,.22,'sine',.03));
        if (kind === 'win') [[392,0],[523,.12],[659,.24],[784,.37],[1047,.55]].forEach(([f,t])=>tone(f,t,.32,'square',.045));
      }

      function shuffled(items) {
        const out = [...items];
        for (let i=out.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
        return out;
      }

      const key = (r,c) => `${r},${c}`;

      function canPlace(grid, dirs, word, row, col, dir, requireCross=true) {
        const dr = dir === 'v' ? 1 : 0;
        const dc = dir === 'h' ? 1 : 0;
        let crosses = 0;
        if (grid.has(key(row-dr,col-dc)) || grid.has(key(row+dr*word.length,col+dc*word.length))) return false;
        for (let i=0;i<word.length;i++) {
          const cellKey = key(row+dr*i,col+dc*i);
          const here = grid.get(cellKey);
          if (here && here !== word[i]) return false;
          if (here === word[i]) {
            if (dirs.get(cellKey)?.has(dir)) return false;
            crosses++;
          } else {
            const cellRow=row+dr*i, cellCol=col+dc*i;
            if (dir==='h' && (grid.has(key(cellRow-1,cellCol)) || grid.has(key(cellRow+1,cellCol)))) return false;
            if (dir==='v' && (grid.has(key(cellRow,cellCol-1)) || grid.has(key(cellRow,cellCol+1)))) return false;
          }
        }
        return !requireCross || crosses > 0;
      }

      function place(grid, dirs, word, row, col, dir) {
        const dr = dir === 'v' ? 1 : 0;
        const dc = dir === 'h' ? 1 : 0;
        for (let i=0;i<word.length;i++) {
          const cellKey=key(row+dr*i,col+dc*i);
          grid.set(cellKey, word[i]);
          if(!dirs.has(cellKey))dirs.set(cellKey,new Set());
          dirs.get(cellKey).add(dir);
        }
        return {word,row,col,dir};
      }

      function boundsFor(placements) {
        let minR=0,maxR=0,minC=0,maxC=0;
        placements.forEach(p => {
          const endR=p.row+(p.dir==='v'?p.word.length-1:0);
          const endC=p.col+(p.dir==='h'?p.word.length-1:0);
          minR=Math.min(minR,p.row,endR); maxR=Math.max(maxR,p.row,endR);
          minC=Math.min(minC,p.col,endC); maxC=Math.max(maxC,p.col,endC);
        });
        return {minR,maxR,minC,maxC,rows:maxR-minR+1,cols:maxC-minC+1};
      }

      function makeLayout(words) {
        const ordered = [...words].sort((a,b)=>b.length-a.length);
        let best = null;
        for (let attempt=0;attempt<180;attempt++) {
          const order = [ordered[0], ...shuffled(ordered.slice(1))];
          const grid = new Map();
          const dirs = new Map();
          const placements = [place(grid, dirs, order[0], 0, 0, 'h')];
          let failed = false;
          for (const word of order.slice(1)) {
            const candidates = [];
            for (const [pos,ch] of grid) {
              const [r,c] = pos.split(',').map(Number);
              for (let i=0;i<word.length;i++) if (word[i]===ch) {
                for (const dir of ['h','v']) {
                  const row=r-(dir==='v'?i:0), col=c-(dir==='h'?i:0);
                  if (canPlace(grid,dirs,word,row,col,dir,true)) {
                    const trial=[...placements,{word,row,col,dir}], b=boundsFor(trial);
                    candidates.push({row,col,dir,score:b.rows*b.cols+Math.abs(b.rows-b.cols)*2+Math.random()*5});
                  }
                }
              }
            }
            candidates.sort((a,b)=>a.score-b.score);
            if (!candidates.length) { failed=true; break; }
            const pick=candidates[Math.floor(Math.random()*Math.min(4,candidates.length))];
            placements.push(place(grid,dirs,word,pick.row,pick.col,pick.dir));
          }
          if (!failed) {
            const b=boundsFor(placements), score=b.rows*b.cols+Math.abs(b.rows-b.cols)*3;
            if (!best || score<best.score) best={placements,grid,bounds:b,score};
          }
        }
        if (!best) {
          const grid=new Map(), dirs=new Map(), placements=[];
          words.forEach((word,i)=>placements.push(place(grid,dirs,word,i*2,0,'h')));
          best={placements,grid,bounds:boundsFor(placements),score:9999};
        }
        const {minR,minC,rows,cols}=best.bounds;
        best.placements.forEach(p=>{p.row-=minR;p.col-=minC;});
        const normalized=new Map();
        best.grid.forEach((ch,pos)=>{const [r,c]=pos.split(',').map(Number);normalized.set(key(r-minR,c-minC),ch);});
        return {placements:best.placements,grid:normalized,rows,cols};
      }

      function cellIsVisible(cellKey) {
        if (state.hinted.includes(cellKey)) return true;
        return layout.placements.some(p => state.found.includes(p.word) && p.cells.includes(cellKey));
      }

      function prepareLayout() {
        layout = makeLayout(KL_LEVELS[state.level].words);
        layout.placements.forEach(p => {
          p.cells=[];
          for(let i=0;i<p.word.length;i++) p.cells.push(key(p.row+(p.dir==='v'?i:0),p.col+(p.dir==='h'?i:0)));
        });
      }

      function renderBoard(freshWord='') {
        board.innerHTML='';
        board.style.setProperty('--kl-cols',layout.cols);
        board.style.setProperty('--kl-rows',layout.rows);
        for(let r=0;r<layout.rows;r++) for(let c=0;c<layout.cols;c++) {
          const cellKey=key(r,c), ch=layout.grid.get(cellKey);
          const span=document.createElement('span');
          if (!ch) { span.style.visibility='hidden'; board.append(span); continue; }
          span.className='kl-cell';
          span.dataset.cell=cellKey;
          if (cellIsVisible(cellKey)) { span.classList.add('revealed'); span.textContent=ch; }
          if (state.hinted.includes(cellKey) && !layout.placements.some(p=>state.found.includes(p.word)&&p.cells.includes(cellKey))) span.classList.add('hint-cell');
          const freshPlacement=layout.placements.find(p=>p.word===freshWord);
          if (freshPlacement?.cells.includes(cellKey)) {
            span.classList.add('fresh');
            span.style.animationDelay=(freshPlacement.cells.indexOf(cellKey)*55)+'ms';
          }
          board.append(span);
        }
        requestAnimationFrame(fitBoard);
      }

      function fitBoard() {
        if(game.hidden || !layout)return;
        const gap=3, safe=18;
        const maxByWidth=(boardWrap.clientWidth-safe-gap*(layout.cols-1))/layout.cols;
        const maxByHeight=(boardWrap.clientHeight-safe-gap*(layout.rows-1))/layout.rows;
        const cell=Math.max(10,Math.floor(Math.min(48,maxByWidth,maxByHeight)));
        board.style.setProperty('--kl-cell',cell+'px');
      }

      function renderWheel() {
        wheel.querySelectorAll('.kl-letter').forEach(el=>el.remove());
        letterOrder.forEach((letter,i)=>{
          const button=document.createElement('button');
          button.type='button'; button.className='kl-letter'; button.textContent=letter;
          button.dataset.index=i; button.dataset.letter=letter; button.style.setProperty('--i',i);
          wheel.append(button);
        });
        syncSelectedLetters();
      }

      function usedLetterIndices() {
        const used=[];
        [...normalize(currentEl.textContent.trim())].forEach(ch=>{
          const idx=letterOrder.findIndex((letter,i)=>letter===ch&&!used.includes(i)); if(idx>=0)used.push(idx);
        });
        return used;
      }

      function syncSelectedLetters() {
        const used=usedLetterIndices();
        wheel.querySelectorAll('.kl-letter').forEach((el,i)=>el.classList.toggle('selected',used.includes(i)));
      }

      function currentWord() { return currentEl.textContent.trim().replace(/\u00a0/g,''); }
      function setCurrent(word='') { currentEl.textContent=word || '\u00a0'; syncSelectedLetters(); }

      function setMessage(text,kind='') {
        clearTimeout(messageTimer); messageEl.textContent=text; messageEl.className='kl-message'+(kind?' '+kind:'');
        messageTimer=setTimeout(()=>{messageEl.textContent='UNÍ LAS LETRAS PARA FORMAR PALABRAS';messageEl.className='kl-message';},1800);
      }

      function updateHud() {
        const level=KL_LEVELS[state.level];
        $('#klHintCount').textContent='×'+state.hints;
        $('#klHint').setAttribute('aria-label',`Usar una pista. Quedan ${state.hints}`);
        $('#klHint').disabled=state.hints<=0 || state.found.length===level.words.length;
      }

      function burst() {
        const colors=['#69e7ff','#32cd32','#ffe600','#ff6600','#ff2f9a'];
        for(let i=0;i<18;i++) {
          const dot=document.createElement('i'); dot.className='kl-particle';
          dot.style.setProperty('--pc',colors[i%colors.length]);
          dot.style.setProperty('--px',`${Math.cos(i/18*Math.PI*2)*(55+Math.random()*100)}px`);
          dot.style.setProperty('--py',`${Math.sin(i/18*Math.PI*2)*(45+Math.random()*90)}px`);
          particles.append(dot); setTimeout(()=>dot.remove(),760);
        }
      }

      function availableWord(word) {
        const pool=[...KL_LEVELS[state.level].letters];
        return [...word].every(ch=>{const i=pool.indexOf(ch);if(i<0)return false;pool.splice(i,1);return true;});
      }

      function addLetter(letter,index=null) {
        const word=currentWord();
        if (word.length>=7) return;
        const used=[];
        [...word].forEach(ch=>{const i=letterOrder.findIndex((l,n)=>l===ch&&!used.includes(n));if(i>=0)used.push(i);});
        const chosen=index===null?letterOrder.findIndex((l,i)=>l===letter&&!used.includes(i)):index;
        if(chosen<0||used.includes(chosen))return;
        setCurrent(word+letterOrder[chosen]); sfx('tap');
      }

      function deleteLetter() { const word=currentWord(); if(word){setCurrent(word.slice(0,-1));sfx('delete');} }

      function toggleLetter(letter,index) {
        const used=usedLetterIndices();
        const position=used.indexOf(index);
        if(position>=0) {
          const chars=[...currentWord()];
          chars.splice(position,1);
          setCurrent(chars.join(''));
          sfx('delete');
        } else addLetter(letter,index);
      }

      function submit() {
        const word=normalize(currentWord());
        if(word.length<3){setMessage('MÍNIMO TRES LETRAS','warn');sfx('bad');return;}
        const level=KL_LEVELS[state.level];
        if(!availableWord(word)){setMessage('ESA LETRA YA FUE USADA','warn');sfx('bad');setCurrent();return;}
        if(state.found.includes(word)||state.extras.includes(word)){setMessage('YA LA ENCONTRASTE','warn');sfx('bad');setCurrent();return;}
        if(level.words.includes(word)){
          state.found.push(word); saveState();
          renderBoard(word); updateHud(); burst(); sfx('word');
          setMessage(`¡${word}!`,'ok'); setCurrent();
          if(state.found.length===level.words.length) setTimeout(completeLevel,780);
          return;
        }
        if(level.bonus.includes(word)){
          state.extras.push(word); saveState(); updateHud(); sfx('bonus');
          setMessage('PALABRA EXTRA','ok'); setCurrent(); return;
        }
        setMessage('NO ESTÁ EN ESTE NIVEL','warn'); sfx('bad'); setCurrent();
      }

      function useHint() {
        if(state.hints<=0)return;
        const hidden=[...layout.grid.keys()].filter(k=>!cellIsVisible(k));
        if(!hidden.length)return;
        const chosen=hidden[Math.floor(Math.random()*hidden.length)];
        state.hints--; state.hinted.push(chosen); saveState(); renderBoard(); updateHud(); sfx('hint');
        setMessage('PISTA REVELADA','ok');
      }

      function completeLevel() {
        state.elapsed=klElapsed(); saveState(); saveStatsLevel(); window.PabliRanking?.submit('kapo-letras-tiempo',state.elapsed); updateKlClock(); sfx('win'); burst();
        $('#klCompleteText').textContent=`Tiempo ${klClockText(state.elapsed)} · ${state.extras.length} palabras extra.`;
        $('#klComplete').hidden=false;
      }

      function nextLevel() {
        let next=state.level;
        while(next===state.level)next=Math.floor(Math.random()*KL_LEVELS.length);
        const nextRound=(state.round||1)+1;
        const earned=nextRound%3===0?1:0;
        state=defaultState(next); state.round=nextRound; state.hints=3+earned; saveState();
        $('#klComplete').hidden=true; startLevel();
      }

      function abandonLevel() {
        if(!confirm('¿Abandonar este nivel y empezar una partida nueva?'))return;
        let next=state.level;
        while(next===state.level)next=Math.floor(Math.random()*KL_LEVELS.length);
        const nextRound=(state.round||1)+1;
        state=defaultState(next);
        state.round=nextRound;
        saveState();
        startLevel();
        setMessage('NUEVA PARTIDA','ok');
      }
      function startLevel() {
        const level=KL_LEVELS[state.level];
        state.found=state.found.filter(w=>level.words.includes(w));
        state.extras=state.extras.filter(w=>level.bonus.includes(w));
        letterOrder=shuffled([...level.letters]); prepareLayout(); renderBoard(); renderWheel(); updateHud(); setCurrent();
        setMessage('UNÍ LAS LETRAS PARA FORMAR PALABRAS'); updateKlClock(); saveState();
      }

      function openGame() {
        home.hidden=true; game.hidden=false; state=loadState();
        if(!state.elapsed&&state.timerPaused){state.startedAt=Date.now();state.timerPaused=false;saveState()}
        startLevel();
        $('#klSound').textContent=soundOn?'🔊':'🔇';
      }
      setInterval(updateKlClock,500);

      function closeGame() {if(state&&!state.elapsed&&!state.timerPaused){state.pausedSeconds=klElapsed();state.startedAt=0;state.timerPaused=true;saveState()}game.hidden=true;home.hidden=false;setCurrent();}

      document.querySelector('[data-game="kapo-letras"]').addEventListener('click',openGame);
      $('#klHome').addEventListener('click',closeGame);
      $('#klNew').addEventListener('click',abandonLevel);
      $('#klDelete').addEventListener('click',deleteLetter);
      $('#klHint').addEventListener('click',useHint);
      $('#klShuffle').addEventListener('click',()=>{letterOrder=shuffled(letterOrder);renderWheel();setCurrent();sfx('tap');});
      $('#klNext').addEventListener('click',nextLevel);
      $('#klHelp').addEventListener('click',()=>{$('#klHelpModal').hidden=false;});
      $('#klStats').addEventListener('click',()=>{
        const s=getStats();
        $('#klStatsText').innerHTML=`Crucigramas resueltos: <b>${s.completed}</b><br>Palabras encontradas: <b>${s.words}</b><br>Palabras extra: <b>${s.extras}</b>`;
        $('#klStatsModal').hidden=false;
      });
      document.querySelectorAll('[data-kl-close]').forEach(button=>button.addEventListener('click',()=>button.closest('.kl-modal').hidden=true));
      $('#klSound').addEventListener('click',event=>{
        soundOn=!soundOn;localStorage.setItem(SOUND_KEY,soundOn?'on':'off');event.currentTarget.textContent=soundOn?'🔊':'🔇';
        if(soundOn)sfx('bonus');
      });

      wheel.addEventListener('click',event=>{
        const letter=event.target.closest('.kl-letter');
        if(!letter||drag?.moved)return;
        toggleLetter(letter.dataset.letter,+letter.dataset.index);
      });

      wheel.addEventListener('pointerdown',event=>{
        const letter=event.target.closest('.kl-letter');
        if(!letter)return;
        drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:+letter.dataset.index,moved:false,seen:new Set()};
      });

      wheel.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7){drag.moved=true;setCurrent();addLetter(letterOrder[drag.start],drag.start);drag.seen.add(drag.start);}
        if(drag.moved&&!wheel.hasPointerCapture?.(event.pointerId))wheel.setPointerCapture?.(event.pointerId);
        if(!drag.moved)return;
        const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.kl-letter');
        if(target&&wheel.contains(target)){
          const index=+target.dataset.index;
          if(!drag.seen.has(index)){drag.seen.add(index);addLetter(target.dataset.letter,index);}
        }
      });

      wheel.addEventListener('pointerup',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const moved=drag.moved; setTimeout(()=>{drag=null;},0); if(moved)submit();
      });

      window.addEventListener('keydown',event=>{
        if(game.hidden)return;
        const openModal=[...game.querySelectorAll('.kl-modal')].find(modal=>!modal.hidden);
        if(event.key==='Escape'){
          if(openModal)openModal.hidden=true;else closeGame(); event.preventDefault(); return;
        }
        if(openModal)return;
        if(event.key==='Enter'){submit();event.preventDefault();return;}
        if(event.key==='Backspace'||event.key==='Delete'){deleteLetter();event.preventDefault();return;}
        const letter=normalize(event.key);
        if(/^[A-ZÑ]$/.test(letter)&&KL_LEVELS[state.level].letters.includes(letter)){addLetter(letter);event.preventDefault();}
      });

      if('ResizeObserver' in window)new ResizeObserver(fitBoard).observe(boardWrap);
      else window.addEventListener('resize',fitBoard);
    })();
