# Night Sky — live planetarium

A live, location-aware planetarium: 119,625 stars, 2,144 deep-sky objects with telescope photos,
planets, satellites, exoplanets, astrophysics data, phone compass/camera AR, and a desktop workspace.

## Project layout

```
index.html                 page shell (markup only)
css/app.css                core styles (phone + desktop)
css/pro.css                desktop workspace styles
js/boot.js                 loads data files, then the scripts below in order
js/core/                   utilities, catalogue decoding, state, astronomy, frame scheduler
js/data/knowledge.js       curated descriptions (stars, deep-sky objects, planets)
js/render/                 projection, WebGL renderer, Canvas fallback, planet globes, main render
js/ui/                     HUD, info panel, search, controls, interaction, formatting
js/sensors/                phone orientation (quaternion smoothing) and camera AR
js/live/                   satellites, exoplanets, Gaia deep-star tiles, NASA / Wikipedia / SIMBAD lookups
js/science/                astrophysics calculations, HR diagram, comet and asteroid orbits
js/pro/                    desktop workspace, command palette, tonight planner, equipment tools, survey viewer, 3D views,
                           astrophysics lab (HR diagram, light curves, spectra), events finder and ephemeris
js/main.js                 start-up
data/catalog.json          constellations, deep-sky catalogue, star names, exoplanet fallback
data/stars.bin             119,625 stars (binary, sorted by brightness)
data/*.tle, exoplanets.csv, comets.txt, asteroids.json   refreshed every 6 hours by the data action
data/lab/                  HR sample, light curves and spectra built by the 'Build astrophysics lab data' action
img/dso/*.webp             674 deep-sky photos (Stellarium collection, credited in the app)
img/milkyway.webp          all-sky Milky Way
img/planets/*.webp         planet surface maps
survey.html                multi-wavelength survey viewer (Aladin Lite), shown inside the app
data/gaia/                 Gaia DR3 star tiles, built once by the 'Build Gaia star tiles' action
tools/build_gaia_tiles.py  the tile builder used by that action
tools/build_lab_data.py    builds data/lab/ (Gaia 100 pc sample, Kepler/TESS light curves via lightkurve, SDSS spectra)
tools/lab_targets.json     the light-curve and spectrum targets; edit it to add your own
.github/workflows/         update-sky-data.yml refreshes satellites and exoplanets every 6 hours;
                           build-gaia-tiles.yml (run by hand once) downloads Gaia DR3 and builds data/gaia/
```

Scripts are plain (non-module) files that share the page's global scope; `js/boot.js` lists the order.
Bump `VERSION` in `js/boot.js` (and the `?v=` in index.html) after changes so browsers fetch fresh files.

The page must be served over http(s) (GitHub Pages works). Opening index.html from disk will not load the data files.

## Data credits
HYG database v4.1 (CC BY-SA 4.0) · OpenNGC (CC BY-SA 4.0) · d3-celestial constellation data (BSD) ·
Stellarium deep-sky and planet textures (GPL, per-image credits shown in the app) · Astronomy Engine (MIT) ·
satellite.js (MIT) · CelesTrak · NASA Exoplanet Archive · Open Exoplanet Catalogue · NASA Image and Video Library ·
Wikipedia (CC BY-SA) · SIMBAD and Aladin Lite / HiPS (CDS Strasbourg) · ESA Gaia DR3 (Gaia/DPAC) · NASA MAST (Kepler, TESS) via lightkurve · SDSS DR17 · Minor Planet Center · JPL Small-Body Database.

## Gaia deep stars
Run **Actions → Build Gaia star tiles → Run workflow** once. The default (G < 12) gives about three million
stars and adds roughly 70–80 MB to the repository. They appear when you zoom in to about a 6° field or less.

## Multi-wavelength surveys
`survey.html` embeds Aladin Lite (CDS Strasbourg) in its own page so its globals never clash with the app.
Survey imagery is streamed from CDS's HiPS servers; nothing is stored in this repository.

## Astrophysics lab data
Run **Actions → Build astrophysics lab data → Run workflow** once (about 30–90 minutes). It downloads a Gaia DR3
sample of stars within 100 pc for the HR diagram, Kepler/TESS light curves from NASA MAST, and SDSS spectra
(a stellar sequence, 3C 273, and every bright catalogue galaxy that SDSS observed). Each part can be re-run on its own
with the `steps` input (`hr`, `lc`, `spectra`). Add targets in `tools/lab_targets.json`.

## Comets and asteroids
The 6-hourly data action also downloads comet orbits (Minor Planet Center) and asteroids brighter than H = 11 (JPL).
Positions are computed in the browser with two-body orbits; checked against Astronomy Engine using Mars' orbit.

## 3D views
`js/pro/space3d.js` loads three.js r147 from jsDelivr only when a 3D view is opened: a solar-system orrery
(real positions from Astronomy Engine, true orbits, the Moon, asteroids and comets) and a 3D map of every
catalogue star with a measured distance, in galactic coordinates. Earth texture: three.js examples (NASA Blue Marble).
