(() => {
  'use strict';
  const menu = document.querySelector('#home');
  const view = document.querySelector('#clave7View');
  const frame = document.querySelector('#clave7Frame');
  const card = document.querySelector('[data-game="clave7"]');

  function openClave7() {
    frame.src = './games/clave-7.html';
    menu.hidden = true;
    view.hidden = false;
    scrollTo({top: 0, behavior: 'smooth'});
  }

  function closeClave7() {
    view.hidden = true;
    frame.src = 'about:blank';
    menu.hidden = false;
    scrollTo({top: 0, behavior: 'smooth'});
  }

  card.addEventListener('click', openClave7);
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
    if (event.data?.type === 'clave7-home') closeClave7();
    if (event.data?.type === 'clave7-score') window.PabliRanking?.submit('clave-7', event.data.score);
  });
})();
