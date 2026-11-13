// Kind Skies: forecast, search, units, and drawing the page.
// Loaded as a plain script; it shares names like $ and state with the other files.

// ---------- Small helpers ----------
const $ = id => document.getElementById(id);
const state = { unit: 'F', data: null, live: true };
try { const u = localStorage.getItem('ks-unit'); if (u === 'C' || u === 'F') state.unit = u; } catch (e) {}

const toUnit = c => state.unit === 'F' ? c * 9 / 5 + 32 : c;
const deg = c => Math.round(toUnit(c)) + '°';
const windNum = kmh => Math.round(state.unit === 'F' ? kmh * 0.621 : kmh);
const wind = kmh => windNum(kmh) + (state.unit === 'F' ? ' mph' : ' km/h');
// Wind direction is where the wind comes FROM; the arrow points where it's blowing TO.
const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const windArrow = from => `<svg class="arrow" viewBox="0 0 12 12" role="img" aria-label="Wind from the ${COMPASS[Math.round(from / 45) % 8]}" style="transform:rotate(${from + 180}deg)"><path d="M6 1l3.5 9L6 8 2.5 10z" fill="currentColor"/></svg>`;
const hourLabel = d => d.toLocaleTimeString([], { hour: 'numeric' }).replace(':00', '');
const dayLabel = (d, i) => i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' });

// ---------- Weather codes → words, sky color, gentle message ----------
// Open-Meteo uses WMO weather codes. Each group gets a label, a sky theme and a kind word.
function describe(code, isDay = 1) {
  const g =
    code === 0 ? 'clear' : code <= 2 ? 'partly' : code === 3 ? 'cloud' :
    code <= 48 ? 'fog' : code <= 67 || (code >= 80 && code <= 82) ? 'rain' :
    code <= 77 || code === 85 || code === 86 ? 'snow' : 'storm';
  const info = {
    clear:  { label: isDay ? 'Clear and bright' : 'Clear night', sky: 'clear',
              msg: isDay ? 'A bright one today. If you can, step outside and let the sun find you for a minute.' : 'A clear, quiet night. A good one for looking up at the stars.' },
    partly: { label: 'Partly sunny', sky: 'clear',
              msg: 'Sun and clouds taking turns. There is room for a little of everything today.' },
    cloud:  { label: 'Soft and cloudy', sky: 'cloud',
              msg: 'A soft gray sky. A good day for something warm to drink and an easy pace.' },
    fog:    { label: 'Misty', sky: 'cloud',
              msg: 'The world is wrapped in mist. Take it slow, and things will clear in time.' },
    rain:   { label: 'Rainy', sky: 'rain',
              msg: 'Rain is watering everything today. Bring an umbrella and enjoy the sound of it.' },
    snow:   { label: 'Snowy', sky: 'snow',
              msg: 'Snow is falling. Bundle up, go easy on the roads, and enjoy the hush.' },
    storm:  { label: 'Stormy', sky: 'storm',
              msg: 'A stormy stretch. It is a fine day to stay in, stay safe, and let it pass.' }
  }[g];
  return { group: g, ...info, sky: (!isDay && g !== 'rain' && g !== 'snow' && g !== 'storm') ? 'night' : info.sky };
}

// ---------- Simple, friendly icons drawn with SVG ----------
function icon(code, isDay = 1) {
  const g = describe(code, isDay).group;
  const sun = '<circle cx="24" cy="22" r="9" fill="#F7B267"/>' +
    [0,45,90,135,180,225,270,315].map(a => `<line x1="24" y1="7" x2="24" y2="10" stroke="#F7B267" stroke-width="2.5" stroke-linecap="round" transform="rotate(${a} 24 22)"/>`).join('');
  const moon = '<path d="M28 10a12 12 0 1 0 10 18 10 10 0 0 1-10-18z" fill="#F4D88A"/>';
  const cloud = (y = 0, fill = '#FFFFFF', stroke = '#9C97B4') => `<path d="M14 ${38+y}h20a7 7 0 0 0 0-14 9 9 0 0 0-17 2 6 6 0 0 0-3 12z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  const drops = '<g stroke="#5B8BC9" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="42" x2="16" y2="46"/><line x1="25" y1="42" x2="23" y2="46"/><line x1="32" y1="42" x2="30" y2="46"/></g>';
  const flakes = '<g fill="#8DB6E3"><circle cx="17" cy="44" r="2"/><circle cx="25" cy="45" r="2"/><circle cx="33" cy="44" r="2"/></g>';
  const bolt = '<path d="M25 38l-4 7h4l-2 5 6-8h-4l2-4z" fill="#F7B267"/>';
  const body = {
    clear: isDay ? sun : moon,
    partly: (isDay ? '<g transform="translate(-6 -6)">' + sun + '</g>' : '<g transform="translate(-8 -6) scale(.8)">' + moon + '</g>') + cloud(0),
    cloud: '<g opacity=".6">' + cloud(-8, '#E6E1EE') + '</g>' + cloud(0),
    fog: cloud(-6) + '<g stroke="#9C97B4" stroke-width="2" stroke-linecap="round"><line x1="12" y1="38" x2="36" y2="38"/><line x1="15" y1="43" x2="33" y2="43"/></g>',
    rain: cloud(-4) + drops,
    snow: cloud(-4) + flakes,
    storm: cloud(-4, '#D9D3E8') + bolt
  }[g];
  return `<svg viewBox="0 0 48 52" role="img" aria-label="${describe(code, isDay).label}">${body}</svg>`;
}

// ---------- Getting the data ----------
// Live data: Open-Meteo's free geocoding + forecast APIs (no key needed).
async function geocode(name) {
  // The search matches city names only, so "Dayton, Ohio" searches "Dayton"
  // and then prefers the result whose state or country matches "Ohio".
  const [city, ...rest] = name.split(',').map(s => s.trim());
  const hint = rest.join(' ').toLowerCase();
  const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=10&name=' + encodeURIComponent(city));
  const j = await r.json();
  if (!j.results || !j.results.length) throw new Error('notfound');
  const p = (hint && j.results.find(x => [x.admin1, x.country, x.country_code].some(v => v && (v.toLowerCase().includes(hint) || hint.includes(v.toLowerCase()))))) || j.results[0];
  return { name: [p.name, p.admin1 || p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude, cc: p.country_code };
}
async function forecast(place) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
    '&hourly=temperature_2m,weather_code,precipitation_probability,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&forecast_days=11&timezone=auto';
  const j = await (await fetch(url)).json();
  // Reshape the API's column-style arrays into friendly lists of objects.
  const hourly = j.hourly.time.map((t, i) => ({ time: new Date(t), temp: j.hourly.temperature_2m[i], code: j.hourly.weather_code[i], pop: j.hourly.precipitation_probability[i], isDay: j.hourly.is_day[i], wind: j.hourly.wind_speed_10m?.[i], gust: j.hourly.wind_gusts_10m?.[i], windDir: j.hourly.wind_direction_10m?.[i] }));
  const nowIdx = Math.max(0, hourly.findIndex(h => h.time > new Date(j.current.time)) - 1);
  return {
    place: place.name, lat: place.lat, lon: place.lon, cc: place.cc,
    current: { temp: j.current.temperature_2m, feels: j.current.apparent_temperature, humidity: j.current.relative_humidity_2m, code: j.current.weather_code, wind: j.current.wind_speed_10m, isDay: j.current.is_day },
    hourly: hourly.slice(nowIdx, nowIdx + 24),
    daily: j.daily.time.slice(0, 10).map((t, i) => ({ date: new Date(t + 'T12:00'), code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], pop: j.daily.precipitation_probability_max[i], sunrise: new Date(j.daily.sunrise[i]), sunset: new Date(j.daily.sunset[i]) }))
  };
}

// Sample data: a made-up autumn forecast, used when live data can't be reached.
function sampleData() {
  const now = new Date(); now.setMinutes(0, 0, 0);
  const codeAt = h => h < 9 ? 2 : h < 15 ? 1 : h < 19 ? 2 : 3;
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() + i * 3600e3), h = t.getHours();
    const temp = 12 + 6 * Math.cos((h - 15) / 24 * 2 * Math.PI);
    const windKmh = 9 + 7 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (i > 16 ? 6 : 0);
    return { time: t, temp, code: i > 18 ? 61 : codeAt(h), pop: i > 16 ? 35 + (i - 16) * 6 : 5, isDay: h >= 8 && h < 19 ? 1 : 0,
      wind: windKmh, gust: windKmh * 1.6, windDir: (200 + i * 3) % 360 };
  });
  const days = [[1, 18, 7, 10], [61, 15, 9, 70], [3, 13, 6, 20], [0, 16, 4, 0], [2, 17, 6, 10], [1, 19, 8, 5], [80, 14, 8, 60], [3, 12, 5, 25], [0, 13, 3, 0], [2, 15, 5, 10]];
  const daily = days.map(([code, max, min, pop], i) => {
    const d = new Date(); d.setDate(d.getDate() + i); d.setHours(12);
    const sr = new Date(d); sr.setHours(7, 58); const ss = new Date(d); ss.setHours(18, 31);
    return { date: d, code, max, min, pop, sunrise: sr, sunset: ss };
  });
  const c = hourly[0];
  return { place: 'Sample town', lat: 38.05, lon: -84.5, cc: 'US', current: { temp: c.temp, feels: c.temp - 1.5, humidity: 62, code: c.code, wind: 11, isDay: c.isDay }, hourly, daily };
}

// ---------- Drawing the page ----------
function bestHour(hours) {
  // The kindest hour to be outside: daylight, low rain chance, warmest.
  const ok = hours.filter(h => h.isDay && (h.pop ?? 0) < 30);
  return ok.length ? ok.reduce((a, b) => b.temp > a.temp ? b : a) : null;
}

function render() {
  const d = state.data; if (!d) return;
  const c = d.current, info = describe(c.code, c.isDay), today = d.daily[0];
  globe.update(d.lat, d.lon);
  radar.show(d.lat, d.lon, d.cc);
  const alertKey = [d.lat, d.lon, state.live].join();
  if (alertKey !== render.alertKey) { render.alertKey = alertKey; alerts.show(d.lat, d.lon, d.cc, d.place, state.live); }
  $('sky').className = 'sky ' + info.sky;
  $('place').textContent = d.place;
  $('when').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  $('big-icon').innerHTML = icon(c.code, c.isDay);
  $('temp').textContent = deg(c.temp);
  $('cond').textContent = info.label;
  $('hilo').textContent = 'High ' + deg(today.max) + ' · Low ' + deg(today.min);
  $('message').textContent = info.msg;
  const t = d2 => d2.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('facts').innerHTML = [['Feels like', deg(c.feels)], ['Humidity', c.humidity + '%'], ['Wind', wind(c.wind)], ['Sunrise', t(today.sunrise)], ['Sunset', t(today.sunset)]]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');

  const best = bestHour(d.hourly);
  const rainSoon = d.hourly.slice(0, 12).find(h => h.pop >= 50);
  let tip = best ? `Your nicest hour outside looks like <b>${hourLabel(best.time)}</b>, around ${deg(best.temp)}. Maybe a short walk?` : 'Today is a cozy indoor kind of day. That counts as a good day too.';
  if (rainSoon) tip += ` Rain is likely around ${hourLabel(rainSoon.time)}, so keep an umbrella close.`;
  $('tip').innerHTML = `<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="var(--accent-soft)"/><path d="M17 25s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 24 16c0 4.7-7 9-7 9z" fill="var(--accent)"/></svg><p>${tip}</p>`;

  $('hours').innerHTML = d.hourly.map((h, i) => `
    <div class="hour${i === 0 ? ' now-h' : ''}${best && h.time.getTime() === best.time.getTime() ? ' best' : ''}">
      <div class="t">${i === 0 ? 'Now' : hourLabel(h.time)}</div>
      ${icon(h.code, h.isDay)}
      <div class="v">${deg(h.temp)}</div>
      <div class="p">${h.pop >= 20 ? h.pop + '%' : ''}</div>
      ${h.wind == null ? '' : `<div class="w">${h.windDir == null ? '' : windArrow(h.windDir)}${wind(h.wind)}</div>`}
      ${h.gust == null ? '' : `<div class="g">gusts ${windNum(h.gust)}</div>`}
    </div>`).join('');

  // Range bars all share one scale: the week's coldest low to warmest high.
  const lo = Math.min(...d.daily.map(x => x.min)), hi = Math.max(...d.daily.map(x => x.max)), span = (hi - lo) || 1;
  $('days').innerHTML = d.daily.map((x, i) => `
    <div class="day">
      <div class="name">${dayLabel(x.date, i)}</div>
      ${icon(x.code, 1)}
      <div class="lo">${deg(x.min)}</div>
      <div class="track" aria-label="Low ${deg(x.min)}, high ${deg(x.max)}"><div class="fill" style="left:${(x.min - lo) / span * 100}%;right:${(hi - x.max) / span * 100}%"></div></div>
      <div class="hi">${deg(x.max)}</div>
      <div class="p">${x.pop >= 20 ? x.pop + '%' : ''}</div>
    </div>`).join('');
}

// Notices are built as text, never HTML, since they can include what someone typed.
function showNotice(text, lead) {
  const n = $('notice');
  n.replaceChildren();
  if (lead) { const s = document.createElement('strong'); s.textContent = lead; n.append(s, ' '); }
  n.append(text || '');
  n.hidden = !text && !lead;
}

async function load(cityName) {
  document.querySelector('.wrap').classList.add('loading');
  try {
    const place = await geocode(cityName);
    state.data = await forecast(place);
    state.live = true;
    showNotice('');
    try { localStorage.setItem('ks-city', cityName); } catch (e) {}
  } catch (err) {
    if (err.message === 'notfound') {
      showNotice(`We couldn't find “${cityName}”. Try adding the state or country, like “Dayton, Ohio”.`);
    } else {
      state.live = false;
      if (!state.data) state.data = sampleData();
      showNotice('Live weather can’t load in this preview. Open the HTML file in your browser to see real forecasts for any city.', 'Showing a sample forecast.');
    }
  }
  // Nothing to show yet (say, the very first city wasn't found): fall back to the sample.
  if (!state.data) { state.data = sampleData(); state.live = false; }
  render();
  document.querySelector('.wrap').classList.remove('loading', 'booting');
}

// ---------- Hourly strip: mouse wheel and drag scroll it sideways ----------
const hoursEl = $('hours');
hoursEl.addEventListener('wheel', e => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { hoursEl.scrollLeft += e.deltaY; e.preventDefault(); }
}, { passive: false });
let drag = null;
hoursEl.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  drag = { x: e.clientX, left: hoursEl.scrollLeft };
  hoursEl.classList.add('dragging');
});
window.addEventListener('pointermove', e => { if (drag) hoursEl.scrollLeft = drag.left - (e.clientX - drag.x); });
window.addEventListener('pointerup', () => { drag = null; hoursEl.classList.remove('dragging'); });

// ---------- Controls ----------
function setUnit(u, animate) {
  $('units').classList.toggle('c', u === 'C');
  if (animate && u !== state.unit && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const wrap = document.querySelector('.wrap');
    wrap.classList.add('swapping');
    setTimeout(() => { applyUnit(u); wrap.classList.remove('swapping'); }, 200);
    return;
  }
  applyUnit(u);
}
function applyUnit(u) {
  state.unit = u;
  $('unit-f').setAttribute('aria-pressed', u === 'F'); $('unit-c').setAttribute('aria-pressed', u === 'C');
  try { localStorage.setItem('ks-unit', u); } catch (e) {}
  render();
}
$('unit-f').addEventListener('click', () => setUnit('F', true));
$('unit-c').addEventListener('click', () => setUnit('C', true));
$('search-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('city').value.trim(); if (v) load(v);
});

// ---------- Start ----------
// Runs once every script file (globe.js, radar.js, alerts.js) has loaded.
// The page starts in a quiet "booting" state (see index.html) until the first forecast is ready.
document.addEventListener('DOMContentLoaded', () => {
  setUnit(state.unit);
  let startCity = 'Lexington, Kentucky';
  try { startCity = localStorage.getItem('ks-city') || startCity; } catch (e) {}
  load(startCity);
});
