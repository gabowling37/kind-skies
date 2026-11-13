# CLAUDE.md

Guidance for working in this repository.

## What this is

**Kind Skies** is a calm, gentle weather web app. It shows current conditions, a 24-hour strip, ten-day temperature-range bars, a rain radar map, and official US weather alerts rewritten for people who feel anxious about weather. It also has a 3D globe showing where the sun and moon are right now.

## Running it

- There is no build step, no `package.json`, no bundler, and no tests or linter. It is a static site.
- Open `index.html` in a browser, or serve the folder:

  ```bash
  python3 -m http.server 8000
  ```

- When network calls fail (sandboxed previews, offline), the app falls back to `sampleData()` and an example alert, and shows a "Showing a sample forecast" notice. That notice means fetches failed. It does not mean the code is broken.
- No API keys are needed. Every data source is free and keyless: Open-Meteo (geocoding and forecast), api.weather.gov (alerts), the Iowa Environmental Mesonet (NOAA NEXRAD radar tiles), RainViewer (world radar), and OpenFreeMap (basemap).

## Layout

```
index.html        Single page: static skeleton of sections with element IDs that JS fills in
css/styles.css    All styles; color/font tokens at the top, then sections (radar, alerts, …)
js/app.js         Shared helpers, data fetching, render(), controls, startup
js/globe.js       Three.js globe + sun/moon astronomy  → exposes `globe`
js/radar.js       Leaflet radar map + alert outlines   → exposes `radar`
js/alerts.js      NWS alerts, calm framing, breathing guide → exposes `alerts`
images/earth.png  1024×512 equirectangular Earth texture for the globe
```

### Scripts are plain globals, not modules

- The JS files are classic `<script>` tags sharing one global scope. **Load order matters**: `app.js` → `globe.js` → `radar.js` → `alerts.js` (see the bottom of `index.html`).
- `app.js` defines the shared helpers the other files use: `$` (getElementById), `state`, `deg`, `wind`, `describe`, `icon`, and others. Its startup code runs on `DOMContentLoaded`, so it can call `globe`, `radar` and `alerts` even though those files load after it.
- Each feature file is one IIFE singleton with a tiny public API:
  - `globe.update(lat, lon)`
  - `radar.show(lat, lon, cc)` and `radar.setAlertShapes(items)`
  - `alerts.show(lat, lon, cc, place, live)`
- If a library is missing (`window.THREE`, `window.L`), the singleton returns no-op stubs and shows a friendly message instead of throwing.
- Don't add top-level names that collide across files: they all share one scope.
- Third-party libraries load from CDNs with **pinned exact versions**: Leaflet 1.9.4, MapLibre GL 4.7.1, maplibre-gl-leaflet 0.1.3, Three.js r128, and OrbitControls from three@0.128.0. Keep versions pinned, and keep the library CSS before `css/styles.css`.

### Data flow (`js/app.js`)

1. `load(city)` calls `geocode(name)`. `geocode` searches on the part before the comma, then prefers the result whose state or country matches the rest ("Dayton, Ohio").
2. `forecast(place)` reshapes Open-Meteo's column arrays into one object:
   `{ place, lat, lon, cc, current, hourly[24], daily[10] }`. `sampleData()` returns the same shape.
3. The result goes into `state.data`, then `render()` redraws the whole page and hands the location to `globe`, `radar` and `alerts`.
4. `render()` is idempotent and re-runs on unit changes. Alerts only refetch when location or live/sample status changes (`render.alertKey`).
5. On startup the app renders sample data immediately (`state.pending = true`), then loads the saved or default city ("Lexington, Kentucky").

- `describe(code, isDay)` maps WMO weather codes to a group (`clear/partly/cloud/fog/rain/snow/storm`), a label, a sky theme, and a gentle message. `icon(code, isDay)` draws inline SVG for each group.
- Radar: US locations (`cc === 'US'`) use NOAA NEXRAD via IEM (last 50 min, 5-min steps). Everywhere else uses RainViewer (maxNativeZoom 7). The basemap is OpenFreeMap through MapLibre, restyled when the theme changes.
- Alerts: US only, from `api.weather.gov/alerts/active?point=…`, refreshed every 5 minutes. A `request` counter discards stale responses. `GUIDE` maps event names to a plain-language meaning and a few steps. `LEVELS` (`act` / `ready` / `care` / `info`) come from the event's Warning / Watch / Advisory suffix.

## Conventions

### Tone is the product

- All user-facing text is warm, calm, and plain-language. Avoid alarmist wording. Frame things by what to do next ("Act now", "Be ready", "Take care", "Good to know"), and give alerts a clear end time so they feel finite.
- New copy should match the existing voice (see `describe()` messages, `LEVELS[*].calm`, and the fallback notices).
- Safety steps in `GUIDE` follow the National Weather Service's own advice and stay short (2–3 steps). Don't invent safety guidance.
- Error states are gentle and reassuring ("The forecast still works."). Every network or library failure must degrade gracefully and leave the rest of the page working.

### Accessibility and motion

- Use `aria-live` regions for updating content, `aria-pressed` on toggles, `aria-label` on icon-only controls and SVG icons (`role="img"`), and `aria-hidden` on decorative SVG.
- Always honor `prefers-reduced-motion`. JS checks `matchMedia('(prefers-reduced-motion: reduce)')` before animating (globe fly-to, radar autoplay, breathing circle, unit swap), and the CSS disables transitions.

### CSS

- Colors and fonts are custom properties on `:root`. Dark mode redefines the colors twice: in `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and in `:root[data-theme="dark"]`. **A new color token must be added to all three blocks.**
- Use tokens, not raw hex, in CSS and inline SVG (`fill="var(--accent)"`). Exceptions: fixed palette colors in `icon()`, the radar legends, and the Three.js materials.
- Alert level colors are `--act`, `--ready`, `--care` and `--info`. `radar.js` reads them with `getComputedStyle`, so keep the names in sync with `LEVELS`.
- Sky themes are `.sky.<theme>` classes that set `--a` and `--b` from `--<theme>-a` and `--<theme>-b`.
- Layout is one centered column (max 720px) with a 16px minimum gutter and safe-area insets. The mobile breakpoint is `max-width: 460px`.
- Fonts: Fredoka for display (`--font-display`) and Nunito Sans for body text (`--font-body`).

### JavaScript style

- Use 2-space indent, single quotes, semicolons, `const` arrow helpers, and compact one-line statements where readable.
- Each file starts with a header comment saying what it does and that it is a plain script. Separate sections with banners such as `// ---------- Name ----------`.
- Comments explain *why*, in the same friendly voice as the copy.
- Keep values in metric internally (°C, km/h) and convert only for display with `deg()` and `wind()`. The F/C choice lives in `state.unit`.
- `localStorage` keys use the `ks-` prefix (`ks-unit`, `ks-city`). Always wrap storage access in `try/catch`.
- DOM building:
  - `app.js` uses template strings with `innerHTML`, but only for numeric or internally authored values.
  - External text (NWS alert content, API strings) must go through `textContent`. `alerts.js` uses its `el(tag, cls, text)` helper for this. Don't put external or user text into `innerHTML`.

### Data sources

- When adding or changing a data source, credit it in the footer, the radar credit (`#radar-credit`), or the map attribution.
- Prefer free, keyless APIs so the app stays a static site.
