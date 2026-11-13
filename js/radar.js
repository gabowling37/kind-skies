// Kind Skies: the radar map (NOAA radar in the US, RainViewer elsewhere).
// Loaded as a plain script; it shares names like $ and state with the other files.

// ---------- Radar map ----------
// US cities: NOAA NEXRAD radar (via Iowa State's Iowa Environmental Mesonet) plus
// National Weather Service alerts. Everywhere else: RainViewer's worldwide radar.
const radar = (() => {
  const msgBox = $('radar-msg'), playBtn = $('radar-play'), slider = $('radar-time');
  const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  const PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.5" width="3.5" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1" fill="currentColor"/></svg>';
  const showMsg = text => { $('radar-msg-text').textContent = text; msgBox.hidden = !text; };
  if (!window.L) { showMsg('The radar map couldn’t load right now. The forecast still works.'); return { show() {}, setAlertShapes() {} }; }

  const map = L.map('radar-map', { scrollWheelZoom: false, worldCopyJump: true, zoomSnap: 0.5, center: [39, -84.5], zoom: 7 });
  map.attributionControl.setPrefix(false);
  new ResizeObserver(() => map.invalidateSize()).observe($('radar-map').parentElement);

  // If tiles keep failing and none arrive, the page is somewhere that blocks outside images.
  let loaded = 0, failed = 0;
  const onLoad = () => { loaded++; if (msgBox.dataset.kind === 'blocked') { showMsg(''); msgBox.dataset.kind = ''; } };
  const onFail = () => { failed++; if (failed > 8 && loaded === 0) { msgBox.dataset.kind = 'blocked'; showMsg('The radar map can’t load in this preview. It will work once Kind Skies is on a regular website.'); } };

  // Base map: OpenFreeMap's free vector maps (no key, no sign-up, no usage limits), drawn by MapLibre.
  // Its own pane sits under the radar. "positron" is the soft light style and "dark" the dark one.
  const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const styleUrl = () => 'https://tiles.openfreemap.org/styles/' + (isDark() ? 'dark' : 'positron');
  map.createPane('basemap').style.zIndex = 150;
  let base = null;
  if (window.maplibregl && L.maplibreGL) {
    base = L.maplibreGL({ style: styleUrl(), pane: 'basemap', interactive: false,
      attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);
    const ml = base.getMaplibreMap();
    ml.on('load', onLoad);
    ml.on('error', onFail);
    const restyle = () => ml.setStyle(styleUrl());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', restyle);
    new MutationObserver(restyle).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ---- Radar frames: one tile layer per moment in time; we fade between them ----
  let frames = [], idx = 0, timer = null;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setFrames(list) {
    frames.forEach(f => map.removeLayer(f.layer));
    frames = list.map(f => ({ label: f.label, layer: L.tileLayer(f.url, Object.assign({ opacity: 0, zIndex: 5, maxZoom: 12 }, f.opts)).on('tileload', onLoad).on('tileerror', onFail).addTo(map) }));
    slider.max = Math.max(0, frames.length - 1);
    showFrame(frames.length - 1);
  }
  function showFrame(i) {
    idx = i;
    frames.forEach((f, j) => f.layer.setOpacity(j === i ? 0.72 : 0));
    slider.value = i;
    $('radar-when').textContent = frames[i] ? frames[i].label : '';
  }
  function play() {
    if (!frames.length) return;
    stop(); playBtn.innerHTML = PAUSE; playBtn.setAttribute('aria-label', 'Pause radar loop');
    let rest = 0;
    timer = setInterval(() => {
      if (idx === frames.length - 1 && rest++ < 2) return;   // linger on "now" for a moment
      rest = 0; showFrame((idx + 1) % frames.length);
    }, 550);
  }
  function stop() { clearInterval(timer); timer = null; playBtn.innerHTML = PLAY; playBtn.setAttribute('aria-label', 'Play radar loop'); }
  playBtn.addEventListener('click', () => timer ? stop() : play());
  slider.addEventListener('input', () => { stop(); showFrame(+slider.value); });

  // NOAA NEXRAD via IEM: the last 50 minutes in 5-minute steps. The ?v= part refreshes the tiles every 5 minutes.
  function usFrames() {
    const v = Math.floor(Date.now() / 300000), IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913';
    return [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0].map(m => ({
      url: IEM + (m ? '-m' + String(m).padStart(2, '0') + 'm' : '') + '/{z}/{x}/{y}.png?v=' + v,
      label: m ? m + ' min ago' : 'Now'
    }));
  }
  // RainViewer: the last 2 hours in 10-minute steps; its free tiles stop at zoom 7, so Leaflet stretches them beyond that.
  async function worldFrames() {
    const j = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
    return j.radar.past.map(f => ({
      url: j.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png',
      label: new Date(f.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      opts: { maxNativeZoom: 7 }
    }));
  }

  // ---- Outlines of official alert areas (the alerts section below hands these over) ----
  const alertLayer = L.layerGroup().addTo(map);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function setAlertShapes(list) {
    alertLayer.clearLayers();
    list.forEach(({ feature, level }) => {
      if (!feature.geometry) return;
      const color = css('--' + level) || '#B4502F';
      L.geoJSON(feature, { style: { color, weight: 2, dashArray: '5 4', fillOpacity: 0.08 } })
        .bindPopup(() => { const d = document.createElement('div'); d.textContent = feature.properties.event; return d; })
        .addTo(alertLayer);
    });
  }

  // ---- Show the radar for a place ----
  const you = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2.5, fillColor: '#D9765F', fillOpacity: 1 }).addTo(map);
  let lastKey = '';
  async function show(lat, lon, cc) {
    if (lat == null) return;
    const key = lat + ',' + lon; if (key === lastKey) return; lastKey = key;
    const us = cc === 'US';
    stop(); map.setView([lat, lon], us ? 8 : 6.5); you.setLatLng([lat, lon]);
    $('radar-legend').style.setProperty('--legend', us
      ? 'linear-gradient(90deg, #6EE36E, #1E9E1E, #F4E04D, #F08C28, #E02020, #C040C0)'
      : 'linear-gradient(90deg, #A6D8FF, #3E8EDE, #1446A0, #F0C040, #E05030)');
    $('radar-credit').innerHTML = us
      ? 'Radar from NOAA’s National Weather Service, served by the <a href="https://mesonet.agron.iastate.edu/" target="_blank" rel="noopener">Iowa Environmental Mesonet</a>. Alerts from <a href="https://www.weather.gov/" target="_blank" rel="noopener">weather.gov</a>.'
      : 'Weather data by <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>.';
    if (msgBox.dataset.kind !== 'blocked') showMsg('');
    try { const list = us ? usFrames() : await worldFrames(); if (key !== lastKey) return; setFrames(list); }
    catch (e) { setFrames([]); showMsg('The radar couldn’t load right now. Try again in a few minutes.'); }
    if (!us) alertLayer.clearLayers();
    if (!reduceMotion) play();
  }
  return { show, setAlertShapes };
})();
