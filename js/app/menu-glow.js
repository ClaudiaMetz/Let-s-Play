(() => {
  'use strict';

  const menu = document.querySelector('.game-list');
  const cards = menu ? [...menu.querySelectorAll('.game-card')] : [];
  if (!cards.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let timer = 0;
  let activeCard = null;
  let previousIndex = -1;
  let stopped = false;

  function schedule(delay) {
    if (!stopped && !document.hidden) timer = window.setTimeout(illuminateRandomCard, delay);
  }

  function illuminateRandomCard() {
    let index = Math.floor(Math.random() * cards.length);
    if (cards.length > 1 && index === previousIndex) index = (index + 1 + Math.floor(Math.random() * (cards.length - 1))) % cards.length;
    previousIndex = index;
    activeCard = cards[index];
    activeCard.classList.add('random-lit');
    timer = window.setTimeout(() => {
      activeCard?.classList.remove('random-lit');
      activeCard = null;
      schedule(260 + Math.random() * 520);
    }, 720);
  }

  function stop() {
    stopped = true;
    window.clearTimeout(timer);
    activeCard?.classList.remove('random-lit');
    activeCard = null;
  }

  menu.addEventListener('click', event => {
    if (event.target.closest('.game-card')) stop();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(timer);
      activeCard?.classList.remove('random-lit');
      activeCard = null;
    } else if (!stopped) {
      schedule(180);
    }
  });

  schedule(500);
})();
