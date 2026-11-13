// Kind Skies: the 3D globe with the sun and moon.
// Loaded as a plain script; it shares names like $ and state with the other files.

// ---------- Sun and moon positions ----------
// Low-precision formulas (accurate to about a degree), plenty for a picture.
const rad = Math.PI / 180;
const wrap180 = x => ((x + 540) % 360) - 180;
function skyPositions(date = new Date()) {
  const n = date / 86400000 + 2440587.5 - 2451545.0;          // days since J2000
  const eps = (23.439 - 0.0000004 * n) * rad;                 // tilt of Earth's axis
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;    // how far Earth has turned
  // Sun
  const L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * rad;
  const sunLon = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const sunRA = Math.atan2(Math.cos(eps) * Math.sin(sunLon), Math.cos(sunLon)) / rad;
  const sunDec = Math.asin(Math.sin(eps) * Math.sin(sunLon)) / rad;
  // Moon
  const Lm = 218.316 + 13.176396 * n, Mm = (134.963 + 13.064993 * n) * rad, F = (93.272 + 13.229350 * n) * rad;
  const moonLon = (Lm + 6.289 * Math.sin(Mm)) * rad, moonLat = 5.128 * Math.sin(F) * rad;
  const moonRA = Math.atan2(Math.sin(moonLon) * Math.cos(eps) - Math.tan(moonLat) * Math.sin(eps), Math.cos(moonLon)) / rad;
  const moonDec = Math.asin(Math.sin(moonLat) * Math.cos(eps) + Math.cos(moonLat) * Math.sin(eps) * Math.sin(moonLon)) / rad;
  // How much of the moon is lit, and whether it is growing or shrinking
  const elong = Math.acos(Math.cos(moonLat) * Math.cos(moonLon - sunLon));
  const lit = (1 - Math.cos(elong)) / 2;
  const waxing = (((moonLon - sunLon) / rad) % 360 + 360) % 360 < 180;
  return {
    sun: { lat: sunDec, lon: wrap180(sunRA - gmst) },
    moon: { lat: moonDec, lon: wrap180(moonRA - gmst) },
    lit, waxing
  };
}
function phaseName(lit, waxing) {
  if (lit < 0.03) return 'New moon';
  if (lit > 0.97) return 'Full moon';
  if (Math.abs(lit - 0.5) < 0.06) return waxing ? 'First quarter' : 'Last quarter';
  return (waxing ? 'Waxing ' : 'Waning ') + (lit < 0.5 ? 'crescent' : 'gibbous');
}
const fmtLatLon = (lat, lon) => Math.abs(lat).toFixed(0) + '°' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(0) + '°' + (lon >= 0 ? 'E' : 'W');

// ---------- The 3D globe ----------
const globe = (() => {
  const stage = $('globe-stage');
  if (!window.THREE) { stage.innerHTML = '<div class="globe-fallback">The globe couldn’t load right now. The forecast still works.</div>'; return { update() {} }; }

  // Turn a latitude/longitude into a point on a sphere (matches the map texture's layout).
  const vec = (lat, lon, r = 1) => new THREE.Vector3(
    r * Math.cos(lat * rad) * Math.cos(lon * rad), r * Math.sin(lat * rad), -r * Math.cos(lat * rad) * Math.sin(lon * rad));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // Earth with a soft hand-made map, plus a gentle glow of atmosphere
  const tex = new THREE.TextureLoader().load('images/earth.png');
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({ map: tex, shininess: 12, specular: 0x334466 }));
  scene.add(earth);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.12, side: THREE.BackSide })));

  // Soft round glow sprite, drawn on a canvas
  function glow(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, inner); gr.addColorStop(1, outer);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  }

  // Sunlight comes from the sun's direction, so day and night fall where they really are.
  scene.add(new THREE.AmbientLight(0x6670a8, 0.35));
  const sunLight = new THREE.DirectionalLight(0xfff1dd, 1.25);
  scene.add(sunLight);
  const sun = glow('rgba(255,220,150,1)', 'rgba(255,190,120,0)'); sun.scale.set(1.6, 1.6, 1);
  scene.add(sun);

  // The moon is lit by the same light, so its phase shows on its own. Distances are squeezed to fit.
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 32), new THREE.MeshLambertMaterial({ color: 0xe9e4da }));
  scene.add(moon);

  // Your spot: a coral dot with a soft pulsing ring
  const marker = new THREE.Group();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf0957e }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 40), new THREE.MeshBasicMaterial({ color: 0xf0957e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  marker.add(dot, ring); scene.add(marker);

  // A quiet scattering of stars
  const sp = [];
  for (let i = 0; i < 700; i++) { const v = new THREE.Vector3().randomDirection ? new THREE.Vector3().randomDirection() : new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); sp.push(v.x * 40, v.y * 40, v.z * 40); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd3ff, size: 0.09, transparent: true, opacity: 0.7 })));

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 1.8; controls.maxDistance = 9; controls.rotateSpeed = 0.6;
  controls.addEventListener('start', () => { flyTo = null; });

  let home = new THREE.Vector3(0, 0, 3.4), flyTo = null;
  camera.position.copy(home);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage); size();

  let last = { lat: null, lon: null };
  function update(lat, lon) {
    const p = skyPositions();
    const sunDir = vec(p.sun.lat, p.sun.lon);
    sunLight.position.copy(sunDir.clone().multiplyScalar(10));
    sun.position.copy(sunDir.clone().multiplyScalar(7));
    moon.position.copy(vec(p.moon.lat, p.moon.lon, 2.4));

    if (lat != null) {
      const here = vec(lat, lon);
      marker.position.copy(here.clone().multiplyScalar(1.002));
      ring.lookAt(here.clone().multiplyScalar(2));
      if (lat !== last.lat || lon !== last.lon) {
        // Put your spot in the middle, with north pointing up, a little tilted so the moon and sun have room.
        home = here.clone().multiplyScalar(3.4);
        if (last.lat == null || reduceMotion) camera.position.copy(home); else flyTo = home.clone();
        last = { lat, lon };
      }
      const daylight = here.dot(sunDir) > 0;
      const moonUp = here.dot(vec(p.moon.lat, p.moon.lon)) > 0;
      const pct = Math.round(p.lit * 100);
      $('sky-facts').innerHTML = `
        <div><i style="background:#F0957E"></i><div><b>${daylight ? 'You’re in the daylight' : 'You’re on the night side'}</b><span>${daylight ? 'The sun is above your horizon right now.' : 'The sun will be back soon. Rest easy.'}</span></div></div>
        <div><i style="background:#FFD896"></i><div><b>Sun overhead near ${fmtLatLon(p.sun.lat, p.sun.lon)}</b><span>Someone there has the sun straight above them.</span></div></div>
        <div><i style="background:#E9E4DA"></i><div><b>${phaseName(p.lit, p.waxing)}, ${pct}% lit</b><span>${moonUp ? 'The moon is up in your sky now.' : 'The moon is below your horizon for now.'}</span></div></div>`;
    }
  }

  $('recenter').addEventListener('click', () => { if (reduceMotion) camera.position.copy(home); else flyTo = home.clone(); });

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    if (flyTo) {
      // Glide along the sphere's surface instead of cutting through the Earth.
      const r = THREE.MathUtils.lerp(camera.position.length(), flyTo.length(), 0.08);
      const dir = camera.position.clone().normalize().lerp(flyTo.clone().normalize(), 0.08).normalize();
      camera.position.copy(dir.multiplyScalar(r));
      if (camera.position.distanceTo(flyTo) < 0.01) flyTo = null;
    }
    if (!reduceMotion) { const s = 1 + 0.35 * Math.sin(t * 2.2); ring.scale.set(s, s, s); ring.material.opacity = 0.9 - 0.4 * (s - 0.65); }
    camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    controls.update();
    renderer.render(scene, camera);
  })();
  setInterval(() => update(last.lat, last.lon), 60000);
  return { update };
})();
