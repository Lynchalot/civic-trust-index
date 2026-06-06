# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

The **Civic Trust Index** ranks 174 countries on composite "civic quality" — not GDP or expert-assessed governance, but street-level behavioural reality: whether strangers return wallets, whether people bribe bureaucrats, homicide, road deaths, waste management, terrorism, social trust. Institutional measures (World Bank WGI) account for only 6% of the total weight; 94% is behavioural. The project is a purely static web application with no backend.

## Serving

No build step or bundler. Serve from any static HTTP server — the app must be served over HTTP (not `file://`) because it fetches the world atlas TopoJSON at runtime from jsDelivr.

```bash
npx serve .          # port 3000
python3 -m http.server 8080
```

## Two HTML files — keep them in sync

| File | Purpose |
|---|---|
| `index.html` + `js/` + `css/` | Modular version. Primary development target. |
| `civic_trust_index.html` | Self-contained monolith (3 882 lines). All JS and CSS are inlined so the file can be shared and opened directly from disk. Must be manually kept in sync whenever logic or styles change. |

**This is the single biggest source of fragility.** Any change to `data.js`, `app.js`, or `styles.css` also needs to be reflected inside `civic_trust_index.html`.

## Architecture

### Data pipeline (`js/data.js`)

All country data, normalisation, and scoring live here. The file is self-contained and runs synchronously on load.

**Raw source dictionaries** — one per component, keyed by ISO3:

| Key | Source | Year | Update cadence |
|---|---|---|---|
| `WGI` / `GE` | World Bank WGI – Corruption Control / Gov. Effectiveness | 2023 | Annual |
| `SE` | Schneider & Medina shadow economy (% GDP) | ~2018 | Irregular |
| `WVS` | World Values Survey Wave 7 – interpersonal trust % | 2017–22 | ~5 years |
| `LSC` | Legatum Prosperity Index – social capital | 2023 | Annual |
| `GLO` | Gallup Law & Order Index | 2023 | Annual |
| `WLT` | Cohn et al. (Science 2019) – wallet return rate % | 2019 | One-time study |
| `GCB_RAW` | TI Global Corruption Barometer – bribery rate % | 2015/16/17 | No global edition since 2017 |
| `HOM` | UNODC homicide rate per 100k | 2021–23 | Periodic |
| `RTR` | WHO Road Safety Report – road deaths per 100k | 2021 | Biennial |
| `EPI` | Yale EPI – waste management score | 2022 | Biennial |
| `GTI` | IEP Global Terrorism Index (0–10) | 2023 | Annual |
| `INF_RAW` | World Bank LPI infrastructure sub-index (1–5) + `GDP_BRACKET` | 2023 | Biennial |

**Weights** (`WEIGHTS`, sum = 100):
```js
{ cc:3, ge:3, se:6, wvs:8, lsc:8, glo:12, wlt:12, gcb:10, hom:7, rtr:6, epi:6, gti:8, inf:11 }
```

**Normalisation** — each raw value is mapped to 0–100 before weighting:

| Component | Function | Notes |
|---|---|---|
| WGI (cc, ge) | `(x + 2.5) / 5 * 100` | WGI range is −2.5 to +2.5 |
| GTI | `100 − score × 10` | Lower terrorism = higher civic score |
| Homicide | `100 × (1 − log(1+r) / log(72))` | Log scale; 72/100k used as reference ceiling |
| Road deaths | `100 × (1 − log(1+r) / log(42))` | Log scale; 42/100k ceiling |
| Shadow economy | `100 × (1 − max(0, s−5) / 60)` | Linear; 5% floor, 65% ceiling |
| WVS, GCB, GLO, LSC, EPI | Direct (already 0–100) | — |
| Infrastructure | `50 + (lpi − expected) × 25`, capped 0–100 | LPI 1–5 score minus income-bracket expectation |

**Missing data / proportional reweighting**: if a component is absent for a country, its weight is redistributed across available components: `score = Σ(value × weight) / Σ(available weights)`.

**Key lookup tables**:
- `I3N` — ISO3 → UN numeric (bridges data dicts to TopoJSON feature IDs)
- `N2I` — inverted `I3N`, built at runtime
- `TERRITORY` — UN numeric → `{name, info}` for countries on the map that have no score
- `TERR_FLAG` — territory display name → ISO2 code for flag emoji fallback (used when a territory is not in `I3N`)
- `ISO2` — ISO3 → ISO2 for flag emoji generation via `flag(iso3)`
- `DEFACTO_POLYGONS` — hardcoded GeoJSON for disputed/de-facto regions overlaid on both map views
- `byNum` / `byISO` — computed score objects keyed by UN numeric and ISO3 respectively

### Rendering (`js/app.js`)

Fetches `visionscarto-world-atlas@1/world/50m.json` (TopoJSON) once; all map rendering flows from that.

- **Flat map** — D3 `geoNaturalEarth1` projection, `d3.zoom()` (scale 1–12). Shape-rendering switches to `optimizeSpeed` during active zoom via `.zooming` CSS class. `will-change: transform` on the `<g>` layer.
- **Globe** — D3 `geoOrthographic`, lazy-initialised on first tab click. Drag stops auto-rotation; only the Reset button restarts it. Micro-state dots rendered as separate SVG circles clipped to the visible hemisphere.
- **Hero globe** — Decorative spinning sphere in the landing section. Uses `requestAnimationFrame` paused via `IntersectionObserver` when the hero scrolls out of view.
- **Tooltip** (`#tip`) — `position: fixed`, populated by `showTip(ev, r, name, numKey)`. **Critical**: `#tip` is a child of `#wrap` which has `overflow: hidden`. Do not add `contain: layout paint`, CSS `transform`, `filter`, or `will-change: transform` to `#wrap` or any ancestor of `#tip` — these create a new containing block that breaks fixed positioning.
- **Filter sidebar** — checkboxes grouped by category. Toggling calls `recomputeAll()` which recalculates filtered scores and repaints map fills + rankings.
- **Flags** — generated as regional indicator emoji via `String.fromCodePoint`, then converted to images by Twemoji. Lookup chain: `ISO2[r.iso3]` → `TERR_FLAG[terrName]` → `ISO2[N2I[numKey]]`.

### Styling (`css/styles.css`)

Scale anchor: `html { font-size: 20px }` — nearly all sizing is `rem`-based so this single value controls the entire UI scale. Breakpoints at 1400px, 1000px, 900px, 800px.

App layout: CSS grid `290px 1fr 290px` (sidebar | map | rank panel). Below 1400px the rank panel hides; below 900px the sidebar hides and layout becomes single-column.

## Known technical debt

1. **`civic_trust_index.html` drift** — the monolith has no automated sync with the modular files. Every edit needs to be applied twice.
2. **GCB 2017 coverage gaps** — the 2015/16/17 Global Corruption Barometer omits several high-income countries (Norway, Denmark, Finland, Iceland, Canada, USA, Switzerland, Austria, New Zealand, Israel, Gulf states). These score without the GCB component (proportional reweighting). TI has published only regional editions since 2017.
3. **LPI scope** — the World Bank LPI covers transport/logistics infrastructure only; it excludes electricity and water supply that the discontinued WEF GCI captured.
4. **Shadow economy ~2018** — Schneider & Medina data has no regular update schedule.
5. **`DEFACTO_POLYGONS` inlined** — disputed territory GeoJSON is hardcoded in `data.js` rather than loaded from a separate file.
6. **`I3N` coverage gaps** — some countries/territories visible on the map (e.g. The Bahamas, Niue, Barbados) are absent from `I3N`, so their flags fall back through `TERR_FLAG` by display name. Adding a newly scored country requires entries in both `WGI` (and other source dicts) and `I3N`.
7. **No bundler or minification** — JS and CSS are served as raw source files.

## Pending improvements

- **Two-column rankings on widescreen** — previously attempted with CSS `columns` but abandoned because Firefox and some Chrome versions render hover backgrounds incorrectly inside column containers. A JS-split approach (two `<div class="rank-col">`) is the correct path but needs the hover state managed carefully.
- **Refresh stale sources** — shadow economy (~2018) is the next candidate. The GCB regional editions (Africa 2019, Asia 2020, EU 2021, LatAm 2019, Pacific 2021) could be stitched into a ~110-country dataset with careful harmonisation.
- **Automate monolith sync** — a build script that inlines `data.js`, `app.js`, and `styles.css` into `civic_trust_index.html` would eliminate manual double-editing.
- **Mobile rankings UX** — currently truncates at 25 rows with a "show all" button; further polish needed.
