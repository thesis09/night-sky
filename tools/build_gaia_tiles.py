"""Build Gaia DR3 star tiles for the Night Sky chart.

Runs inside the "Build Gaia star tiles" GitHub Action (or locally: pip install astroquery numpy).
Downloads every Gaia DR3 star between G = GMIN and G = GLIM, moves it to the current epoch with
its proper motion, and writes compact binary tiles plus data/gaia/index.json.

Tile layout (little-endian):
  uint32 N, uint32 pad,
  uint64 source_id[N], float32 ra_rad[N], float32 dec_rad[N], float32 parallax_mas[N] (NaN if none),
  int16 G*1000[N], int16 BP-RP*1000[N] (-32768 if none)
Stars inside a tile are sorted by G so the browser can draw "everything brighter than X" quickly.
"""
import json, math, os, sys, time
import numpy as np

GLIM = float(os.environ.get('GLIM', '12.0'))
GMIN = 8.0                      # brighter stars come from the Hipparcos-based catalogue already
EPOCH = float(os.environ.get('EPOCH', '2026.5'))
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'gaia')
BAND = 10                       # degrees of declination per band

def tiles_for_band(d0, d1):
    c = math.cos(math.radians((d0 + d1) / 2))
    return max(1, round(36 * c))

def sep(a1, b1, a2, b2):
    a1, b1, a2, b2 = map(math.radians, (a1, b1, a2, b2))
    return math.degrees(math.acos(max(-1, min(1, math.sin(b1)*math.sin(b2)+math.cos(b1)*math.cos(b2)*math.cos(a1-a2)))))

def write_band(index, d0, d1, sid, ra, de, g, bprp, plx):
    """Split one declination band into RA tiles and write them. ra/de in degrees (current epoch)."""
    n = tiles_for_band(d0, d1); added = 0
    rbin = np.minimum((ra / 360.0 * n).astype(int), n - 1)
    for k in range(n):
        m = rbin == k
        if not m.any():
            continue
        o = np.argsort(g[m])
        ids = sid[m][o]; r = np.radians(ra[m][o]).astype(np.float32); d = np.radians(de[m][o]).astype(np.float32)
        p = plx[m][o].astype(np.float32)
        gg = np.round(g[m][o] * 1000).astype(np.int16)
        bb = bprp[m][o]; bb = np.where(np.isnan(bb), -32768, np.round(bb * 1000)).astype(np.int16)
        name = f'b{d0+90:03d}_{k:02d}.bin'
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(np.array([len(ids), 0], dtype=np.uint32).tobytes())
            f.write(ids.tobytes()); f.write(r.tobytes()); f.write(d.tobytes()); f.write(p.tobytes()); f.write(gg.tobytes()); f.write(bb.tobytes())
        ra0, ra1 = k * 360.0 / n, (k + 1) * 360.0 / n
        cra, cde = (ra0 + ra1) / 2, (d0 + d1) / 2
        rad = max(sep(cra, cde, a, b) for a in (ra0, ra1) for b in (d0, d1)) + 0.2
        index['tiles'].append({'f': name, 'ra': round(cra, 4), 'dec': cde, 'r': round(rad, 3), 'n': int(len(ids)), 'gmin': round(float(g[m].min()), 2)})
        added += len(ids)
    return n, added

def run_query(d0, d1, tries=4):
    from astroquery.gaia import Gaia
    Gaia.ROW_LIMIT = -1
    q = (f"SELECT source_id, ra, dec, phot_g_mean_mag, bp_rp, parallax, pmra, pmdec "
         f"FROM gaiadr3.gaia_source WHERE phot_g_mean_mag >= {GMIN} AND phot_g_mean_mag < {GLIM} "
         f"AND dec >= {d0} AND dec < {d1}")
    for k in range(tries):
        try:
            job = Gaia.launch_job_async(q)
            return job.get_results()
        except Exception as e:
            print(f'  query failed ({e}); retrying in {20*(k+1)} s', flush=True)
            time.sleep(20 * (k + 1))
    raise SystemExit(f'Gaia query for dec {d0}..{d1} failed repeatedly')

def main():
    os.makedirs(OUT, exist_ok=True)
    index = {'source': 'Gaia DR3 (ESA/Gaia/DPAC)', 'gmin': GMIN, 'glim': GLIM, 'epoch': EPOCH, 'tiles': []}
    total = 0
    for d0 in range(-90, 90, BAND):
        d1 = d0 + BAND
        print(f'Dec {d0}..{d1}', flush=True)
        t = run_query(d0, d1)
        names = {c.lower(): c for c in t.colnames}   # the archive may return upper- or lower-case names
        def col(name, dtype=np.float64):
            c = t[names[name]]
            if dtype is np.float64 and hasattr(c, 'filled'):
                c = c.filled(np.nan)
            return np.array(c, dtype=dtype)
        sid = col('source_id', np.uint64)
        ra = col('ra'); de = col('dec'); g = col('phot_g_mean_mag')
        bprp = col('bp_rp'); plx = col('parallax'); pmra = col('pmra'); pmde = col('pmdec')
        dt = EPOCH - 2016.0
        pmra = np.nan_to_num(pmra); pmde = np.nan_to_num(pmde)
        cosd = np.maximum(np.cos(np.radians(de)), 1e-6)
        ra = (ra + pmra * dt / 3.6e6 / cosd) % 360.0
        de = np.clip(de + pmde * dt / 3.6e6, -90, 90)
        n, added = write_band(index, d0, d1, sid, ra, de, g, bprp, plx)
        total += added
        print(f'  {len(sid):,} stars in {n} tiles', flush=True)
    index['count'] = total
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, separators=(',', ':'))
    print(f'Done: {total:,} stars in {len(index["tiles"])} tiles')

if __name__ == '__main__':
    main()
