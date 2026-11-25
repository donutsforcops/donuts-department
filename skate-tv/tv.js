const power = document.querySelector('#power');
const video = document.querySelector('video');
const card = document.querySelector('#card');
const canvas = document.querySelector('canvas');
const display = document.querySelector('#display');
const tracking = document.querySelector('input');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const channels = ['22 · SKATE TAPE', '00 · TEST PATTERN'];
let powered = false;
let channel = 0;
let timer;
let snowTimer;
let generation = 0;

function stopTransition() {
  generation++;
  clearTimeout(timer);
  clearInterval(snowTimer);
  canvas.hidden = true;
  card.hidden = true;
  video.pause();
  video.hidden = true;
}

function showCard(message) {
  card.querySelector('b').textContent = message;
  card.hidden = false;
}

function drawSnow() {
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const strength = 25 + 4 * Number(tracking.value);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grey = 68 + Math.random() * strength;
    pixels.data.set([grey, grey, grey, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
}

function tune() {
  stopTransition();
  display.textContent = channels[channel];
  const current = generation;
  if (!reducedMotion.matches) {
    canvas.hidden = false;
    drawSnow();
    snowTimer = setInterval(drawSnow, 80);
  }
  timer = setTimeout(() => {
    clearInterval(snowTimer);
    canvas.hidden = true;
    if (channel === 1) {
      showCard('PLEASE STAND BY');
      return;
    }
    if (!video.hasAttribute('src')) video.src = '../tv/ch22.mp4';
    video.hidden = false;
    video.play().catch(() => {
      if (generation !== current) return;
      video.hidden = true;
      showCard('SIGNAL LOST');
    });
  }, reducedMotion.matches ? 150 : 520);
}

function togglePower() {
  powered = !powered;
  power.setAttribute('aria-pressed', String(powered));
  for (const key of channelKeys) key.disabled = !powered;
  if (powered) tune();
  else {
    stopTransition();
    display.textContent = '12:00';
  }
}

const channelKeys = [...document.querySelectorAll('#previous, #next')];
for (const key of channelKeys) {
  key.disabled = true;
  key.addEventListener('click', () => {
    const direction = key.id === 'next' ? 1 : -1;
    channel = (channel + direction + channels.length) % channels.length;
    tune();
  });
}
video.hidden = true;
power.addEventListener('click', togglePower);
