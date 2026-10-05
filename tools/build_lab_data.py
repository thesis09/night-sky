"""Build the data used by the Astrophysics Lab (runs in the 'Build astrophysics lab data' GitHub Action).

Outputs into data/lab/:
  hr.bin                Gaia DR3 stars within 100 pc (absolute G and BP-RP) for the HR diagram
  lc/<id>.json          Kepler / TESS light curves (via lightkurve, from NASA MAST)
  spectra/<id>.json     SDSS spectra: a stellar sequence, catalogue galaxies, and listed objects
  index.json            what was built
Every step is independent: a failure is logged and skipped, so a partial build still works.
"""
import json, os, sys, time, traceback, math
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'data', 'lab')
TARGETS = json.load(open(os.path.join(os.path.dirname(__file__), 'lab_targets.json')))
STEPS = os.environ.get('STEPS', 'hr,lc,spectra').split(',')

def log(*a): print(*a, flush=True)

def downsample(x, y, n):
    """Average into n bins so files stay small while keeping the shape."""
    x = np.asarray(x, float); y = np.asarray(y, float); m = np.isfinite(x) & np.isfinite(y); x, y = x[m], y[m]
    if len(x) <= n: return x, y
    edges = np.linspace(0, len(x), n + 1).astype(int)
    xs = np.array([x[a:b].mean() for a, b in zip(edges[:-1], edges[1:]) if b > a])
    ys = np.array([y[a:b].mean() for a, b in zip(edges[:-1], edges[1:]) if b > a])
    return xs, ys

# ---------------------------------------------------------------- HR diagram
def build_hr(index):
    from astroquery.gaia import Gaia
    Gaia.ROW_LIMIT = -1
    q = ("SELECT phot_g_mean_mag + 5*LOG10(parallax) - 10 AS mg, bp_rp FROM gaiadr3.gaia_source "
         "WHERE parallax > 10 AND parallax_over_error > 10 AND bp_rp IS NOT NULL "
         "AND phot_bp_mean_flux_over_error > 10 AND phot_rp_mean_flux_over_error > 10")
    t = Gaia.launch_job_async(q).get_results()
    names = {c.lower(): c for c in t.colnames}
    mg = np.array(t[names['mg']], float); c = np.array(t[names['bp_rp']], float)
    m = np.isfinite(mg) & np.isfinite(c) & (mg > -6) & (mg < 20) & (c > -1) & (c < 6)
    mg, c = mg[m], c[m]
    with open(os.path.join(OUT, 'hr.bin'), 'wb') as f:
        f.write(np.array([len(mg), 0], np.uint32).tobytes())
        f.write(np.round(c * 1000).astype(np.int16).tobytes()); f.write(np.round(mg * 1000).astype(np.int16).tobytes())
    index['hr'] = {'file': 'hr.bin', 'n': int(len(mg)), 'source': 'Gaia DR3, stars within 100 pc with parallax better than 10%'}
    log(f'HR diagram: {len(mg):,} stars')

# ---------------------------------------------------------------- light curves
def build_lightcurves(index):
    import lightkurve as lk
    os.makedirs(os.path.join(OUT, 'lc'), exist_ok=True)
    index['lightcurves'] = []
    for t in TARGETS['lightcurves']:
        try:
            log('Light curve:', t['name'])
            sr = lk.search_lightcurve(t['query'], mission=t.get('mission', 'TESS'), author=t.get('author'))
            if len(sr) == 0: log('  nothing found'); continue
            # prefer the shortest cadence available in the first result set
            lc = sr[0].download(quality_bitmask='default')
            if lc is None: log('  download failed'); continue
            lc = lc.remove_nans().normalize()
            time_ = np.asarray(lc.time.value, float); flux = np.asarray(lc.flux.value, float)
            m = np.isfinite(time_) & np.isfinite(flux); time_, flux = time_[m], flux[m]
            tx, fx = downsample(time_, flux, 6000)
            label = str(sr[0].mission[0]) if hasattr(sr[0], 'mission') else t.get('mission', '')
            rec = {'id': t['id'], 'name': t['name'], 'kind': t['kind'], 'mission': t.get('mission'), 'product': label,
                   'period': t.get('period'), 'rstar': t.get('rstar'), 'time_unit': 'days (mission time system)',
                   'time': [round(float(v), 5) for v in tx], 'flux': [round(float(v), 6) for v in fx]}
            json.dump(rec, open(os.path.join(OUT, 'lc', t['id'] + '.json'), 'w'), separators=(',', ':'))
            index['lightcurves'].append({k: rec[k] for k in ('id', 'name', 'kind', 'mission', 'period', 'rstar', 'product')} | {'n': len(tx)})
            log(f'  {len(tx)} points')
        except Exception as e:
            log('  failed:', e)

# ---------------------------------------------------------------- spectra
def save_spectrum(index, sid, name, hdul, extra):
    d = hdul[1].data
    wave = 10 ** np.asarray(d['loglam'], float); flux = np.asarray(d['flux'], float)
    try:
        ivar = np.asarray(d['ivar'], float); flux = np.where(ivar > 0, flux, np.nan)
    except Exception: pass
    w, f = downsample(wave, flux, 1500)
    sp = hdul[2].data
    z = float(sp['Z'][0]); cls = str(sp['CLASS'][0]).strip(); sub = str(sp['SUBCLASS'][0]).strip()
    rec = {'id': sid, 'name': name, 'class': cls, 'subclass': sub, 'z': z, 'wave': [round(float(v), 2) for v in w], 'flux': [round(float(v), 4) for v in f]} | extra
    json.dump(rec, open(os.path.join(OUT, 'spectra', sid + '.json'), 'w'), separators=(',', ':'))
    index['spectra'].append({k: rec[k] for k in rec if k not in ('wave', 'flux')})
    log(f'  saved {name}: {cls} {sub} z={z:.4f}')

def build_spectra(index):
    from astroquery.sdss import SDSS
    from astropy.coordinates import SkyCoord
    import astropy.units as u
    os.makedirs(os.path.join(OUT, 'spectra'), exist_ok=True)
    index['spectra'] = []
    # 1) stellar sequence O -> M from the SDSS spectroscopic catalogue
    for sub in TARGETS['stellar_sequence']:
        try:
            log('Stellar spectrum:', sub)
            q = (f"SELECT TOP 1 plate, mjd, fiberID, ra, dec FROM SpecObj WHERE class='STAR' AND subClass LIKE '{sub}%' "
                 f"AND snMedian > 25 AND zWarning = 0")
            r = SDSS.query_sql(q, data_release=17)
            if r is None or len(r) == 0: log('  none'); continue
            sp = SDSS.get_spectra(plate=int(r['plate'][0]), mjd=int(r['mjd'][0]), fiberID=int(r['fiberID'][0]), data_release=17)
            save_spectrum(index, 'star_' + sub.lower(), f'Typical {sub}-type star', sp[0], {'ra': float(r['ra'][0]), 'dec': float(r['dec'][0]), 'group': 'Stellar sequence'})
        except Exception as e:
            log('  failed:', e)
    # 2) objects listed by hand
    for o in TARGETS.get('spectra_objects', []):
        try:
            log('Spectrum:', o['name'])
            xid = SDSS.query_region(SkyCoord(o['ra'] * u.deg, o['dec'] * u.deg), radius=5 * u.arcsec, spectro=True, data_release=17)
            if xid is None or len(xid) == 0: log('  none'); continue
            sp = SDSS.get_spectra(matches=xid[:1], data_release=17)
            save_spectrum(index, o['id'], o['name'], sp[0], {'ra': o['ra'], 'dec': o['dec'], 'group': 'Highlights'})
        except Exception as e:
            log('  failed:', e)
    # 3) galaxies from the chart's own catalogue that SDSS observed
    cfg = TARGETS.get('galaxy_spectra_from_catalogue')
    if cfg:
        cat = json.load(open(os.path.join(ROOT, 'data', 'catalog.json')))
        gals = [r for r in cat['dso'] if r[1] in ('G', 'GPair', 'GTrpl') and r[8] is not None and r[8] <= cfg['max_mag'] and r[3] >= cfg['min_dec']]
        gals.sort(key=lambda r: r[8])
        log(f'Checking {len(gals)} catalogue galaxies for SDSS spectra')
        found = 0
        for r in gals:
            try:
                xid = SDSS.query_region(SkyCoord(r[2] * u.deg, r[3] * u.deg), radius=6 * u.arcsec, spectro=True, data_release=17)
                if xid is None or len(xid) == 0: continue
                sp = SDSS.get_spectra(matches=xid[:1], data_release=17)
                name = (r[11].split(',')[0] if r[11] else (f'M{r[10]}' if r[10] else r[0]))
                save_spectrum(index, 'dso_' + r[0].replace(' ', '').lower(), name, sp[0], {'ra': r[2], 'dec': r[3], 'dso': r[0], 'group': 'Galaxies in the chart'})
                found += 1
                time.sleep(0.5)
            except Exception as e:
                log('  ', r[0], 'failed:', e)
        log(f'{found} galaxy spectra')

def main():
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'index.json')
    index = json.load(open(path)) if os.path.exists(path) else {}
    for step, fn in (('hr', build_hr), ('lc', build_lightcurves), ('spectra', build_spectra)):
        if step in STEPS:
            try: fn(index)
            except Exception: log(f'Step {step} failed:'); traceback.print_exc()
    index['built'] = time.strftime('%Y-%m-%d')
    json.dump(index, open(path, 'w'), indent=1)
    log('Done.')

if __name__ == '__main__':
    main()
