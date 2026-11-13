// Kind Skies: official weather alerts, explained calmly, plus the breathing guide.
// Loaded as a plain script; it shares names like $ and state with the other files.

// ---------- Weather alerts, written for people who feel anxious about weather ----------
// The facts come straight from the National Weather Service (api.weather.gov).
// Kind Skies adds the calm framing: what the alert means in plain words, how long it lasts,
// a few clear steps, and the full official text tucked away for whoever wants it.
const alerts = (() => {
  const list = $('alerts-list');

  // Plain-language meaning and a few steps for the most common alerts.
  // Steps follow the National Weather Service's own safety advice, kept short on purpose.
  const GUIDE = {
    'Tornado Warning': ['A tornado has been seen or picked up on radar near you. This is the time to act, calmly and right away.',
      ['Go to a basement, storm shelter, or small room on the lowest floor, away from windows.', 'If you are in a mobile home or a car, get to the nearest sturdy building if you can do it safely.', 'Cover your head and neck. Stay there until the warning ends.']],
    'Tornado Watch': ['The weather could allow tornadoes to form. Nothing is happening yet. This is time to get ready.',
      ['Pick your safe spot now: the lowest floor, an inside room, away from windows.', 'Keep your phone charged with alerts turned on.', 'Then carry on with your day. You’ll see it here if a warning is issued.']],
    'Severe Thunderstorm Warning': ['A strong storm with damaging wind or large hail is happening or about to reach you.',
      ['Go indoors and stay away from windows.', 'If it’s safe, bring in or tie down loose things outside.', 'Wait 30 minutes after the last thunder before going back out.']],
    'Severe Thunderstorm Watch': ['Strong storms could develop. Nothing is happening yet.',
      ['Know where you’ll go if a storm comes: indoors, away from windows.', 'Keep your phone charged.', 'Check back later. Many watches pass without a storm where you are.']],
    'Flash Flood Warning': ['Flooding is happening or about to happen, and it can rise quickly.',
      ['If you’re in a low spot, move to higher ground.', 'Never walk or drive through flooded roads. Turn around instead.', 'Stay off the roads until the warning ends if you can.']],
    'Flash Flood Watch': ['Heavy rain could cause flash flooding. Nothing is happening yet.',
      ['Know a route to higher ground.', 'Plan to avoid low roads and underpasses.', 'Check back for updates.']],
    'Flood Warning': ['Flooding is happening or expected, usually near rivers, creeks, or low areas.',
      ['Stay away from flooded roads and fast water.', 'Never drive through water on the road.', 'Follow any instructions from local officials.']],
    'Flood Watch': ['Flooding is possible. Nothing is happening yet.', ['Avoid low areas if heavy rain starts.', 'Check back for updates.']],
    'Flood Advisory': ['Minor flooding is possible in low spots and places with poor drainage. It’s more of a hassle than a danger.',
      ['Allow extra travel time.', 'Go around water on the road.']],
    'Winter Storm Warning': ['Heavy snow or ice is expected, and travel may be hard or unsafe.',
      ['Stay home if you can, or allow plenty of extra time.', 'If you must drive, bring a charged phone, warm layers, and water.', 'Check on neighbors who might need a hand.']],
    'Winter Storm Watch': ['A winter storm is possible in the next few days. There’s time to prepare.',
      ['Pick up anything you need before it starts.', 'Make a plan in case travel gets hard.']],
    'Winter Weather Advisory': ['Snow, sleet, or ice may make roads and sidewalks slick. Care is needed, not alarm.',
      ['Slow down and allow extra time.', 'Watch for icy steps and sidewalks.']],
    'Ice Storm Warning': ['Ice is expected to coat roads, trees, and power lines.',
      ['Avoid travel if you can.', 'Keep a flashlight and charged phone handy in case the power goes out.', 'Stay clear of downed lines and branches.']],
    'Blizzard Warning': ['Strong wind and snow will make it very hard to see. Travel could be dangerous.',
      ['Stay inside if you can.', 'Keep phones charged and a flashlight nearby in case the power goes out.']],
    'Wind Advisory': ['Gusty winds may push loose things around and make driving tricky.',
      ['Secure trash cans and outdoor furniture.', 'Keep both hands on the wheel, especially in tall vehicles.']],
    'High Wind Warning': ['Strong winds could bring down tree limbs and power lines.',
      ['Secure loose outdoor items.', 'Stay away from downed power lines.', 'Keep a flashlight handy in case the power goes out.']],
    'Heat Advisory': ['It will be hot enough to be hard on the body, especially in the afternoon.',
      ['Drink water often, even before you feel thirsty.', 'Take breaks in shade or air conditioning.', 'Check on older neighbors, little ones, and pets.']],
    'Extreme Heat Warning': ['Dangerous heat is expected.',
      ['Stay somewhere cool during the hottest hours.', 'Drink water often.', 'Never leave anyone, pets included, in a parked car.']],
    'Extreme Heat Watch': ['Dangerous heat is possible soon. There’s time to plan.', ['Plan where you’ll stay cool.', 'Check that fans and air conditioning work.']],
    'Freeze Warning': ['Temperatures will drop below freezing.', ['Cover or bring in sensitive plants.', 'Protect outdoor pipes, and bring pets inside.']],
    'Frost Advisory': ['Frost may form overnight. Plants are the main concern.', ['Cover or bring in tender plants.']],
    'Cold Weather Advisory': ['It will feel very cold on bare skin.', ['Dress in layers, and cover your head and hands.', 'Keep time outside short.']],
    'Extreme Cold Warning': ['It will be dangerously cold. Bare skin can get frostbite quickly.',
      ['Stay inside if you can.', 'If you go out, cover all skin and keep trips short.', 'Bring pets inside.']],
    'Dense Fog Advisory': ['Fog will make it hard to see while driving.', ['Slow down and use low-beam headlights.', 'Leave extra space between cars.']],
    'Special Weather Statement': ['A heads-up about weather worth knowing, like a strong storm passing through. It isn’t a warning.',
      ['Read the short summary from the National Weather Service below if you’d like.', 'Keep an eye on the sky.']],
    'Air Quality Alert': ['The air may be unhealthy, especially for people sensitive to it.', ['Go easy on hard outdoor exercise.', 'Keep windows closed if smoke or haze is heavy.']]
  };
  // Older names the Weather Service still sometimes uses
  GUIDE['Excessive Heat Warning'] = GUIDE['Extreme Heat Warning']; GUIDE['Excessive Heat Watch'] = GUIDE['Extreme Heat Watch'];
  GUIDE['Wind Chill Advisory'] = GUIDE['Cold Weather Advisory']; GUIDE['Wind Chill Warning'] = GUIDE['Extreme Cold Warning'];

  // Four levels, named by what you should do, not by how scary it sounds.
  const LEVELS = {
    act:   { chip: 'Act now', rank: 0, calm: 'You have a plan in the steps above. Take them one at a time. Warnings exist to give you time to get safe.' },
    ready: { chip: 'Be ready', rank: 1, calm: 'A watch means be prepared. It doesn’t mean something will happen to you.' },
    care:  { chip: 'Take care', rank: 2, calm: 'Advisories are about being careful, not about danger. Small steps keep you comfortable.' },
    info:  { chip: 'Good to know', rank: 3, calm: 'Just a heads-up. Nothing you need to do right now.' }
  };
  const levelOf = ev => /Warning$/.test(ev) ? 'act' : /Watch$/.test(ev) ? 'ready' : /Advisory$/.test(ev) ? 'care' : 'info';
  const fallbackMeaning = {
    act: 'Hazardous weather is happening or about to happen. Follow the official steps below.',
    ready: 'The weather could turn hazardous. Nothing is happening yet. This is time to get ready.',
    care: 'Weather that calls for some care, but isn’t usually dangerous with simple precautions.',
    info: 'A heads-up from the National Weather Service.'
  };

  // "Until 9:00 PM today (about 3 hours from now)": a clear end time helps an alert feel finite.
  function whenText(a) {
    const now = Date.now(), start = new Date(a.onset || a.effective), end = new Date(a.ends || a.expires);
    const day = d => { const t = new Date(); t.setHours(0, 0, 0, 0); const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - t) / 864e5);
      return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : d.toLocaleDateString([], { weekday: 'long' }); };
    const clock = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ' + day(d);
    const rel = ms => { const h = ms / 36e5; return h < 1 ? 'less than an hour' : h < 1.5 ? 'about an hour' : h < 36 ? 'about ' + Math.round(h) + ' hours' : 'about ' + Math.round(h / 24) + ' days'; };
    const parts = [];
    if (!isNaN(start) && start > now) parts.push('Starts ' + clock(start) + ' (in ' + rel(start - now) + ')');
    if (!isNaN(end)) parts.push((parts.length ? 'ends ' : 'Until ') + clock(end) + (start > now ? '' : ' (' + rel(end - now) + ' from now)'));
    return parts.join(', ') + (parts.length ? '.' : '');
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  // The Weather Service wraps its text at fixed widths; join lines back into paragraphs.
  const paragraphs = t => (t || '').split(/\n\s*\n/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

  function card(a, level, opts = {}) {
    const L2 = LEVELS[level], g = GUIDE[a.event];
    const c = el('article', 'alert ' + level);
    const top = el('div', 'alert-top');
    top.append(el('span', 'chip', L2.chip));
    if (opts.example) top.append(el('span', 'chip example', 'Example, not a real alert'));
    c.append(top, el('h3', null, a.event));
    const w = whenText(a); if (w) c.append(el('div', 'alert-time', w));
    c.append(el('p', null, g ? g[0] : fallbackMeaning[level]));
    const steps = g ? g[1] : null;
    if (steps) {
      const box = el('div'); box.append(el('div', 'alert-label', 'What to do'));
      const ol = el('ol'); steps.forEach(s => ol.append(el('li', null, s))); box.append(ol); c.append(box);
    }
    c.append(el('p', 'alert-calm', L2.calm));
    // Full official wording, closed by default so nobody has to read the dense version unless they want to.
    const det = el('details'); det.append(el('summary', null, 'Read the official alert'));
    const off = el('div', 'official');
    if (a.headline) off.append(el('b', null, a.headline));
    paragraphs(a.description).forEach(t => off.append(el('p', null, t)));
    if (a.instruction) { off.append(el('b', null, 'What the National Weather Service recommends')); paragraphs(a.instruction).forEach(t => off.append(el('p', null, t))); }
    det.append(off); c.append(det);
    const src = el('div', 'alert-src', (a.senderName ? 'Issued by ' + a.senderName + '. ' : ''));
    const link = el('a', null, 'See it on weather.gov'); link.href = opts.link || 'https://www.weather.gov/'; link.target = '_blank'; link.rel = 'noopener';
    src.append(link); c.append(src);
    return c;
  }

  // ---- "Breathe with me": a slow 4-in, 6-out breathing guide ----
  let breathTimer = null;
  function breathePanel() {
    const box = el('div', 'breathe'), circle = el('div', 'breathe-circle'), text = el('div', 'breathe-text', 'Breathe in');
    const sub = el('p', 'breathe-sub', 'In through your nose for 4, out slowly for 6. Five rounds takes under a minute.');
    const stop = el('button', 'soft-btn', 'I’m done'); stop.type = 'button';
    box.append(circle, text, sub, stop);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let round = 0, phaseIn = true;
    const step = () => {
      if (round >= 5) { text.textContent = 'Nicely done.'; circle.classList.remove('in'); return; }
      const secs = phaseIn ? 4 : 6;
      circle.style.transitionDuration = still ? '0s' : secs + 's';
      circle.classList.toggle('in', phaseIn);
      text.textContent = (phaseIn ? 'Breathe in' : 'Breathe out') + (still ? ' (' + secs + ')' : '');
      if (!phaseIn) round++;
      phaseIn = !phaseIn;
      breathTimer = setTimeout(step, secs * 1000);
    };
    stop.addEventListener('click', () => { clearTimeout(breathTimer); box.remove(); });
    setTimeout(step, 60);
    return box;
  }

  function helpRow(hasAct) {
    const row = el('div', 'alerts-help');
    row.append(el('p', null, (hasAct ? 'Once you’ve done the steps, it’s okay to step away. ' : 'There’s no need to keep checking. ') +
      'Kind Skies looks for new alerts every 5 minutes while it’s open. For alerts when it’s closed, turn on emergency alerts on your phone.'));
    const b = el('button', 'soft-btn', 'Feeling uneasy? Breathe with me'); b.type = 'button';
    b.addEventListener('click', () => { const old = list.querySelector('.breathe'); if (old) { old.remove(); clearTimeout(breathTimer); } row.after(breathePanel()); });
    row.append(b);
    return row;
  }

  function quiet(text) {
    const q = el('div', 'panel alerts-quiet');
    q.innerHTML = '<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="var(--accent-soft)"/><path d="M9 15.5l4 4 8-9" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    q.append(el('p', null, text)); return q;
  }
  const stamp = () => { $('alerts-checked').textContent = 'Checked at ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

  // ---- Fetching ----
  let request = 0, current = null, refresh = null;
  async function check() {
    const { lat, lon, place } = current, mine = ++request;
    let j;
    try { j = await (await fetch('https://api.weather.gov/alerts/active?point=' + lat.toFixed(4) + ',' + lon.toFixed(4))).json(); }
    catch (e) {
      if (mine !== request) return;
      list.replaceChildren(quiet('Alerts couldn’t be checked just now. For official alerts, visit weather.gov.'));
      $('alerts-checked').textContent = ''; return;
    }
    if (mine !== request) return;   // a newer place was looked up meanwhile
    const now = Date.now(), seen = new Set();
    const items = (j.features || [])
      .filter(f => f.properties && f.properties.status === 'Actual' && f.properties.messageType !== 'Cancel' &&
        new Date(f.properties.ends || f.properties.expires) > now)
      .sort((a, b) => new Date(b.properties.sent) - new Date(a.properties.sent))
      .filter(f => { const k = f.properties.event + '|' + (f.properties.ends || f.properties.expires); if (seen.has(k)) return false; seen.add(k); return true; })
      .map(f => ({ feature: f, level: levelOf(f.properties.event) }))
      .sort((a, b) => LEVELS[a.level].rank - LEVELS[b.level].rank);
    radar.setAlertShapes(items);
    stamp();
    if (!items.length) { list.replaceChildren(quiet('All quiet. The National Weather Service has no alerts for ' + place + ' right now.')); return; }
    const link = 'https://forecast.weather.gov/MapClick.php?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4);
    list.replaceChildren(...items.map(i => card(i.feature.properties, i.level, { link })), helpRow(items.some(i => i.level === 'act')));
  }

  function show(lat, lon, cc, place, live) {
    clearInterval(refresh); request++;
    if (!live) {
      // Preview without live data: show what an alert looks like, clearly marked as an example.
      $('alerts-checked').textContent = '';
      const end = new Date(Date.now() + 5 * 36e5);
      list.replaceChildren(card({ event: 'Wind Advisory', ends: end.toISOString(), senderName: 'NWS (example)',
        headline: 'Example: Wind Advisory until this evening',
        description: 'Example text. Southwest winds 20 to 30 mph with gusts up to 45 mph.\n\nGusty winds could blow around unsecured objects.' }, 'care', { example: true }), helpRow(false));
      radar.setAlertShapes([]); return;
    }
    if (cc !== 'US') { $('alerts-checked').textContent = ''; radar.setAlertShapes([]);
      list.replaceChildren(quiet('Official alerts are shown for US locations. For ' + place + ', check your national weather service.')); return; }
    const same = current && current.lat === lat && current.lon === lon;
    current = { lat, lon, place };
    if (!same) list.replaceChildren(quiet('Checking for official alerts…'));
    check();
    refresh = setInterval(check, 5 * 60 * 1000);
  }
  return { show };
})();
