(() => {
  'use strict';

  const home = document.querySelector('#home');
  const toggle = document.querySelector('#menuMusic');
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!home || !toggle || !AudioContextCtor) return;

  const melody = [72, 79, 76, 79, 74, 81, 77, 81, 72, 79, 76, 83, 74, 81, 77, 74];
  const bass = [48, 53, 50, 55];
  const stepDuration = 0.34;
  let context;
  let master;
  let timer = 0;
  let step = 0;
  let enabled = true;
  let playing = false;

  function playNote(midi, when, length, volume, type) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + length);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(when);
    oscillator.stop(when + length + 0.03);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, {once: true});
  }

  function sequenceStep() {
    if (!playing || home.hidden || document.hidden) return;
    const when = context.currentTime + 0.035;
    playNote(melody[step], when, 0.27, 0.12, 'triangle');
    if (step % 4 === 0) playNote(bass[Math.floor(step / 4) % bass.length], when, 0.72, 0.075, 'sine');
    step = (step + 1) % melody.length;
    timer = window.setTimeout(sequenceStep, stepDuration * 1000);
  }

  async function startMusic() {
    if (!enabled || home.hidden || document.hidden) return;
    context ||= new AudioContextCtor();
    master ||= (() => {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      return gain;
    })();
    try {
      await context.resume();
      if (!enabled || home.hidden || document.hidden) return;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0.32, context.currentTime, 0.18);
      if (!playing) {
        playing = true;
        sequenceStep();
      }
    } catch {
      updateButton();
    }
  }

  function stopMusic() {
    playing = false;
    window.clearTimeout(timer);
    if (context && master) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.06);
      window.setTimeout(() => {
        if (!playing && context?.state === 'running') context.suspend();
      }, 300);
    }
  }

  function updateButton() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Apagar música de fondo' : 'Activar música de fondo');
    toggle.title = enabled ? 'Apagar música de fondo' : 'Activar música de fondo';
  }

  function unlockOnInteraction() {
    if (enabled && !home.hidden) startMusic();
  }

  document.addEventListener('pointerdown', unlockOnInteraction, {capture: true});
  document.addEventListener('keydown', unlockOnInteraction, {capture: true});

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    updateButton();
    if (enabled) startMusic();
    else stopMusic();
  });

  const observer = new MutationObserver(() => {
    if (home.hidden) stopMusic();
    else if (enabled) startMusic();
  });
  observer.observe(home, {attributes: true, attributeFilter: ['hidden']});

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMusic();
    else if (enabled) startMusic();
  });

  updateButton();
  startMusic();
})();
