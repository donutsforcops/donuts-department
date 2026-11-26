/* Donuts Department arcade: offer to file a score on the weekly leaderboard.
   Games call DDScore.offer('<game-id>', score) when a run ends. */
(function () {
  var NAMES = { 'runaway-donut': 'Runaway Donut', 'city-beat': 'City Beat', 'donut-patrol': 'Donut Patrol', 'best-in-the-game': 'Best In The Game', 'road-rage-fighter': 'Road Rage Fighter', 'fare-game': 'Fare Game' };
  var UNITS = { 'road-rage-fighter': ' drivers', 'fare-game': '' };
  var css = '#ddsc{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translate(-50%,140%);width:min(92vw,380px);z-index:2147483000;' +
    'background:#22111b;color:#fff4e6;border:2px solid #ff4f9a;border-radius:20px;padding:14px 16px;font:400 15px/1.4 Rubik,system-ui,sans-serif;box-shadow:0 16px 50px #000a;transition:transform .35s cubic-bezier(.2,.9,.3,1.2)}' +
    '#ddsc.on{transform:translate(-50%,0)}#ddsc b.t{display:block;font:400 16px Bungee,Impact,sans-serif;color:#ff4f9a;margin-bottom:2px}' +
    '#ddsc p{margin:0 0 10px;color:#d8bfcb;font-size:14px}#ddsc form{display:flex;gap:8px}' +
    '#ddsc input{flex:1;min-width:0;min-height:44px;border-radius:12px;border:2px solid #4a2a3b;background:#170b12;color:#fff4e6;padding:8px 12px;font:600 16px Rubik,system-ui,sans-serif}' +
    '#ddsc button{min-height:44px;border-radius:999px;border:2px solid #ff4f9a;background:#ff4f9a;color:#fff;font:800 14px Rubik,system-ui,sans-serif;padding:8px 14px;cursor:pointer}' +
    '#ddsc .x{position:absolute;top:6px;right:8px;background:none;border:0;color:#d8bfcb;font-size:22px;min-height:36px;padding:0 8px}' +
    '#ddsc a{color:#5ef2c6;font-weight:800}';
  var box, game, score, busy = false;
  function el() {
    if (box) return box;
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    box = document.createElement('div'); box.id = 'ddsc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Leaderboard');
    document.body.appendChild(box);
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) {
      box.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
    });
    document.addEventListener('pointerdown', function (e) { if (box.classList.contains('on') && !box.contains(e.target)) hide(); }, true);
    return box;
  }
  function hide() { if (box) box.classList.remove('on'); }
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function saved() { try { return localStorage.getItem('dd_name') || ''; } catch (e) { return ''; } }
  function render(html) { el().innerHTML = '<button class="x" type="button" aria-label="Close">×</button>' + html; box.querySelector('.x').onclick = hide; }
  function offer(g, s) {
    s = Math.floor(Number(s) || 0);
    if (!(g in NAMES) || s <= 0 || location.protocol === 'file:') return;
    game = g; score = s;
    render('<b class="t">Put it on the record?</b><p>' + s.toLocaleString() + (UNITS[g] || '') + ' in ' + NAMES[g] + '. This week\'s board resets Monday.</p>' +
      '<form><input name="n" maxlength="16" autocomplete="nickname" placeholder="Your name or Whatnot handle" value="' + esc(saved()) + '" aria-label="Your name"><button>File it</button></form>');
    var f = box.querySelector('form');
    f.onsubmit = function (e) { e.preventDefault(); send(f.n.value); };
    setTimeout(function () { box.classList.add('on'); }, 600);
  }
  function send(name) {
    if (busy) return; busy = true;
    name = String(name || '').trim();
    try { localStorage.setItem('dd_name', name); } catch (e) {}
    fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: game, name: name, score: score }) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        busy = false;
        var j = x.j || {};
        if (j.ok) {
          render('<b class="t">' + (j.rank ? 'Filed. #' + j.rank + ' this week.' : 'Filed.') + '</b><p>' + (j.rank === 1 ? 'Top of the board. Act natural.' : j.rank ? 'Respectable police work.' : 'Not in the top 10 yet. Keep patrolling.') +
            ' <a href="../../index.html#board">See the board</a></p>');
          setTimeout(hide, 6000);
        } else {
          var why = j.error === 'bad_name' ? 'That name won\'t fit on the paperwork. Use 2 to 16 letters or numbers, and keep it clean.' :
            j.error === 'slow_down' ? 'Dispatch is busy. Try again in a few seconds.' : 'Couldn\'t file that one. Try again in a minute.';
          var p = box.querySelector('p'); if (p) p.textContent = why;
        }
      })
      .catch(function () { busy = false; var p = box && box.querySelector('p'); if (p) p.textContent = 'Couldn\'t reach dispatch. Your score is still saved on this phone.'; });
  }
  window.DDScore = { offer: offer, hide: hide };
})();
