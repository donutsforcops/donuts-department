const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const shelf = $('#shelf');
const display = $('#display');
const power = $('#power');
const skip = $('#skip');
const source = $('#source');
const canvas = $('canvas');
const spots = ['12', '03', '07', '30', '64', '22'];
let catalog = [];
let selected = 0;
let completed = 0;
let spotIndex = 0;
let generation = 0;
let transition;
let sdk;
let powered = false;

function clearScreen() {
  generation++;
  clearTimeout(transition);
  skip.hidden = true;
  source.hidden = true;
  $('#checkout').hidden = true;
  $('#standby').hidden = powered;
  canvas.hidden = true;
  $('#card').hidden = true;
  document.body.classList.remove('inserting');
  screen.replaceChildren();
  return generation;
}

function loadSdk() {
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Player unavailable')); };
      document.head.append(script);
    }).catch(error => { sdk = undefined; throw error; });
  }
  return sdk;
}

function markShelf() {
  [...shelf.querySelectorAll("button")].forEach((button, index) => {
    button.setAttribute('aria-pressed', String(powered && index === selected));
  });
  power.setAttribute('aria-pressed', String(powered));
  $('#next').disabled = $('#previous').disabled = !powered;
}

function noise() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  canvas.hidden = false;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const contrast = 25 + 4 * Number($('input').value);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = 68 + Math.random() * contrast;
    pixels.data.set([value, value, value, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
}

function insertTape(index) {
  selected = (index + catalog.length) % catalog.length;
  powered = true;
  const token = clearScreen();
  const tape = catalog[selected];
  markShelf();
  display.textContent = 'Checking out · ' + tape.title;
  document.body.classList.add('inserting');
  $('#card').hidden = false;
  $('#checkout-title').textContent = tape.title;
  $('#checkout-details').textContent = tape.uploader + ' · ' + Math.round(tape.durationSec / 60) + ' min';
  $('#checkout').hidden = false;
  source.href = tape.sourceUrl;
  source.hidden = false;
  noise();
  transition = setTimeout(() => {
    canvas.hidden = true;
    $('#card').hidden = true;
    document.body.classList.remove('inserting');
    display.textContent = 'CH 22 · ' + tape.title;
    const frame = document.createElement('iframe');
    frame.title = tape.title + ' (Vimeo)';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.src = 'https://player.vimeo.com/video/' + tape.id + '?dnt=1&autoplay=1';
    screen.append(frame);
    loadSdk().then(() => {
      if (token !== generation) return;
      const player = new Vimeo.Player(frame);
      player.on('ended', () => {
        if (token !== generation) return;
        completed++;
        if (completed % 2 === 0 || tape.durationSec > 1500) commercial();
        else insertTape(selected + 1);
      });
      player.on('error', () => {
        if (token === generation) display.textContent = 'Playback unavailable · use the Vimeo link or pick another tape';
      });
      player.ready().catch(() => {
        if (token === generation) display.textContent = 'Use the Vimeo link or pick another tape';
      });
    }).catch(() => {
      if (token === generation) display.textContent = 'Manual tuning · choose the next tape when ready';
    });
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
}

function commercial() {
  const token = clearScreen();
  const clip = document.createElement('video');
  clip.playsInline = true;
  clip.muted = true;
  clip.src = '../tv/ch' + spots[spotIndex++ % spots.length] + '.mp4';
  clip.setAttribute('aria-label', 'Donuts Department commercial');
  display.textContent = 'Station break · Donuts Department';
  const advance = () => { if (token === generation) insertTape(selected + 1); };
  clip.onended = clip.onerror = advance;
  screen.append(clip);
  transition = setTimeout(() => { skip.hidden = false; }, 3000);
  clip.play().catch(advance);
}

power.onclick = () => {
  if (!powered) return insertTape(selected);
  powered = false;
  clearScreen();
  markShelf();
  display.textContent = '12:00';
};
$('#previous').onclick = () => insertTape(selected - 1);
$('#next').onclick = skip.onclick = () => insertTape(selected + 1);
markShelf();

async function stockShelf() {
  const response = await fetch('catalog.json');
  if (!response.ok) throw new Error('Catalog unavailable');
  catalog = await response.json();
  for (const [index, tape] of catalog.entries()) {
    const button = document.createElement('button');
    const label = document.createElement('strong');
    const details = document.createElement('small');
    label.textContent = tape.title;
    details.textContent = 'DD-22 / ' + String(index + 1).padStart(3, '0') +
      ' · ' + tape.uploader + ' · ' + Math.round(tape.durationSec / 60) + ' min';
    button.append(label, details);
    button.onclick = () => {
      insertTape(index);
      if (matchMedia('(max-width:840px)').matches) {
        power.focus({preventScroll:true});
        $('.cabinet').scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      }
    };
    const row = document.createElement('div');
    row.className = 'tape-row';
    const link = document.createElement('a');
    link.href = tape.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Vimeo ↗';
    link.setAttribute('aria-label', 'Open ' + tape.title + ' on Vimeo');
    row.append(button, link);
    shelf.append(row);
  }
  markShelf();
  power.disabled = !catalog.length;
  const requested = new URLSearchParams(location.search).get('tape');
  const match = catalog.findIndex(tape => tape.id === requested);
  if (match >= 0) insertTape(match);
}
stockShelf().catch(() => { display.textContent = 'Tape shelf unavailable · reload to retry'; });

$('#drawer').onclick = () => {
  setDrawer(shelf.hidden);
};

function setDrawer(open) {
  shelf.hidden = !open;
  $('#drawer').setAttribute('aria-expanded', String(!shelf.hidden));
  $('#drawer-state').textContent = open ? 'Close drawer' : 'Open drawer';
}

$('#standby a').addEventListener('click', () => setDrawer(true));
