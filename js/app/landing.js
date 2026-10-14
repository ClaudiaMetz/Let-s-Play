(()=>{
      const install=document.querySelector('#installApp'),help=document.querySelector('#installHelp'),steps=document.querySelector('#installSteps'),close=document.querySelector('#installClose');
      let deferredPrompt=null;
      const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
      const sync=()=>{if(standalone()){install.textContent='✓ LET’S PLAY INSTALADO';install.classList.add('installed');install.classList.remove('ready')}else if(deferredPrompt){install.textContent='★ DESCARGALO Y JUGÁ EN TU DISPOSITIVO CUANDO QUIERAS ★';install.classList.add('ready')}};
      const instructions=()=>{
        const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
        steps.innerHTML=ios
          ? 'En <b>Safari</b>, tocá <b>Compartir</b> (el cuadrado con flecha) y elegí <b>Agregar a pantalla de inicio</b>.'
          : 'En el menú <b>⋮</b> de Chrome elegí <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.';
        help.hidden=false;
      };
      window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;sync()});
      window.addEventListener('appinstalled',()=>{deferredPrompt=null;help.hidden=true;sync()});
      install.addEventListener('click',async()=>{if(standalone())return;if(!deferredPrompt){instructions();return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;sync()});
      close.addEventListener('click',()=>help.hidden=true);help.addEventListener('click',event=>{if(event.target===help)help.hidden=true});
      if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
      sync();
    })();
