# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

The **Civic Trust Index** ranks 173 countries on composite "civic quality" — not GDP or expert-assessed governance, but street-level behavioural reality: whether strangers return wallets, whether people bribe bureaucrats, homicide, road deaths, waste management, terrorism, social trust. Institutional measures (World Bank WGI) account for only 6% of the total weight; 94% is behavioural. The project is a purely static web application with no backend.

## Serving

No bundler; the only build artefact is the generated monolith (see below). Serve from any static HTTP server. The world atlas TopoJSON is self-hosted at `assets/world-50m.json`; if that fetch fails (e.g. the monolith opened from disk via `file://`), the app falls back to jsDelivr at runtime.

```bash
npx serve .          # port 3000
python3 -m http.server 8080
```

## Two HTML files — monolith is generated

| File | Purpose |
|---|---|
| `index.html` + `js/` + `css/` | Modular version. Primary development target. |
| `civic_trust_index.html` | Self-contained monolith, **generated** by `build-monolith.js`. All JS and CSS are inlined so the file can be shared and opened directly from disk. Never edit it by hand. |

After any change to `index.html`, `js/defacto.js`, `js/data.js`, `js/app.js`, or `css/styles.css`, regenerate the monolith:

```bash
node build-monolith.js
```

The script inlines the stylesheet and both scripts into a copy of `index.html`, strips the beta-gate `<script>` line (the monolith is for direct sharing and is never gated), and stamps a "generated file" banner at the top. It exits non-zero if any expected pattern is missing from `index.html` — if you rename the CSS/JS files or restructure the `<head>`, update the script's patterns to match.

## Architecture

### Data pipeline (`js/data.js`)

All country data, normalisation, and scoring live here. The file is self-contained and runs synchronously on load.

**Raw source dictionaries** — one per component, keyed by ISO3:

| Key | Source | Year | Update cadence |
|---|---|---|---|
| `WGI` / `GE` | World Bank WGI – Corruption Control / Gov. Effectiveness | 2023 | Annual |
| `SE` | World Bank Informal Economy DB (Elgin et al.) – MIMIC informal output (% GDP) | 2019 | Biennial |
| `WVS` | World Values Survey Wave 7 – interpersonal trust % | 2017–22 | ~5 years |
| `LSC` | Legatum Prosperity Index – social capital | 2023 | Annual |
| `GLO` | Gallup Law & Order Index | 2023 | Annual |
| `WLT` | Cohn et al. (Science 2019) – wallet return rate % | 2019 | One-time study |
| `GCB_RAW` | TI Global Corruption Barometer – bribery rate % | 2015/16/17 | No global edition since 2017 |
| `HOM` | UNODC homicide rate per 100k | 2021–23 | Periodic |
| `RTR` | WHO Road Safety Report – road deaths per 100k | 2021 | Biennial |
| `EPI` | Yale EPI – waste management score | 2022 | Biennial |
| `GTI` | IEP Global Terrorism Index (0–10) | 2026 (2025 data) | Annual |
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
- `TERR_FLAG` — territory display name → ISO2 code; legacy first-choice fallback for territory flags (every TERRITORY entry now also resolves via `I3N`/`N2I`, so this is belt-and-braces)
- `ISO2` — ISO3 → ISO2 for flag emoji generation via `flag(iso3)`
- `DEFACTO_POLYGONS` — GeoJSON for disputed/de-facto regions overlaid on both map views; lives in `js/defacto.js` (loaded before `data.js`)
- `byNum` / `byISO` — computed score objects keyed by UN numeric and ISO3 respectively

### Rendering (`js/app.js`)

`loadAtlas()` fetches the world TopoJSON once behind a shared promise (self-hosted `assets/world-50m.json`, jsDelivr fallback); all map rendering flows from that.

- **Flat map** — D3 `geoNaturalEarth1` projection, `d3.zoom()` (scale 1–12). Shape-rendering switches to `optimizeSpeed` during active zoom via `.zooming` CSS class. `will-change: transform` on the `<g>` layer.
- **Globe** — D3 `geoOrthographic`, lazy-initialised on first tab click. Drag stops auto-rotation; only the Reset button restarts it. Micro-state dots rendered as separate SVG circles clipped to the visible hemisphere.
- **Hero globe** — Decorative spinning sphere in the landing section. Uses `requestAnimationFrame` paused via `IntersectionObserver` when the hero scrolls out of view.
- **Tooltip** (`#tip`) — `position: fixed`, populated by `showTip(ev, r, name, numKey)`. **Critical**: `#tip` is a child of `#wrap` which has `overflow: hidden`. Do not add `contain: layout paint`, CSS `transform`, `filter`, or `will-change: transform` to `#wrap` or any ancestor of `#tip` — these create a new containing block that breaks fixed positioning.
- **Inline rankings** — `buildInlineRankings()` (Section 02). On viewports ≥ 1200px, lists of ≥ 30 rows are split into two real `.rk-col` divs with per-column headers; never use CSS `columns` here — Firefox and some Chrome versions render hover backgrounds incorrectly inside column containers.
- **Filter sidebar** — checkboxes grouped by category. Toggling calls `recomputeAll()` which recalculates filtered scores and repaints map fills + rankings.
- **Flags** — generated as regional indicator emoji via `String.fromCodePoint`, then converted to images by Twemoji. Lookup chain: `ISO2[r.iso3]` → `TERR_FLAG[terrName]` → `ISO2[N2I[numKey]]`.

### Styling (`css/styles.css`)

Scale anchor: `html { font-size: 20px }` — nearly all sizing is `rem`-based so this single value controls the entire UI scale. Breakpoints at 1400px, 1000px, 900px, 800px.

App layout: CSS grid `290px 1fr 290px` (sidebar | map | rank panel). Below 1400px the rank panel hides; below 900px the sidebar hides and layout becomes single-column.

## Known technical debt

1. **GCB 2017 coverage gaps** — the 2015/16/17 Global Corruption Barometer omits several high-income countries (Norway, Denmark, Finland, Iceland, Canada, USA, Switzerland, Austria, New Zealand, Israel, Gulf states). These score without the GCB component (proportional reweighting). TI has published only regional editions since 2017.
2. **LPI scope** — the World Bank LPI covers transport/logistics infrastructure only; it excludes electricity and water supply that the discontinued WEF GCI captured.
3. **SE legacy values** — five countries absent from the WB Informal Economy Database (TWN, HKG, SRB, MNE, UZB) keep their Schneider & Medina 2018 values; the rest use WB MIMIC 2019 (2019 chosen over 2020 to avoid COVID distortion).
4. **WGI cc/ge values need re-sourcing** — the `cc` and `ge` dictionaries in `js/data.js` are close to, but not, the published WGI 2023 estimates. Spot-checks show a non-constant downward bias of ~0.03–0.12 (Denmark 2.32 vs 2.3761; Singapore 1.92 vs 2.0402). Country ordering is correct, so rank-based validation does not catch it. They replaced an earlier set that was outright synthetic, so this is an improvement but unfinished. Fix by re-importing `CC.EST`/`GE.EST` for reference year 2023 from databank.worldbank.org — note that World Bank domains are blocked by the Claude Code web sandbox's egress policy, so this needs an environment with access. See the provenance warning above the `WGI` dict.
5. **GTI was re-imported in 2026** — the `GTI` dict previously held values that were not the published index at all (116 countries, none scoring 0 against the real index's 63 zeroes, max 9.1 against a true 8.574, last decimal clustering on `.5`). It now carries IEP's Global Terrorism Index 2026 (reporting year 2025), 161 of the published 163 countries. Palestine and North Korea are excluded because they have no WGI entry and so are not scored at all; Luxembourg and Malta fall outside the GTI's 163 and lose the component to proportional reweighting. The re-import moved 159 of 173 ranks, median 7 places, max 41. **Note the vintage is now newer than every other component** — most sit at 2021–2023 — so the index mixes years more than it did.
6. **Coverage exceeds source scope in `WVS` and `GLO`** — `WVS` holds 107 countries, but World Values Survey Wave 7 ran **64 national surveys** (~80 at its most expansive target). `GLO` holds 170, but Gallup's published Law & Order Index runs to roughly 140 and the World Poll itself to ~160–168. Neither dict carries a source comment, unlike `SE`, so where the surplus countries came from is unrecorded. Both need re-sourcing or their extra entries removing.
7. **Micro-state values in `GLO` and `EPI` look invented** — Liechtenstein, Monaco, San Marino, Andorra and (formerly) Vatican City appear in exactly three dictionaries — `GLO`, `HOM`, `EPI` — and nowhere else. In two of those the values form neat descending runs matching a prestige order rather than measurements: `GLO` 95/92/90/89/88 and `EPI` 92/90/88/88/85. The clearest tell was Vatican City carrying a Gallup Law & Order score of 95, for a state of ~800 residents that no pollster surveys; it has since been dropped from scoring for unrelated reasons, but the same pattern remains in the other four. `HOM` is plausible — UNODC does publish homicide counts for these states.
8. **The top four ranks rest on 5 of 13 components** — Liechtenstein, Monaco, San Marino and Andorra hold ranks 1–4 scored on `cc`, `ge`, `glo`, `hom`, `epi` only. They never face the wallet test, the bribery rate, interpersonal trust, social capital, road deaths, the shadow economy, terrorism or infrastructure. Proportional reweighting then collapses the full 100% onto the five that remain, all of which happen to favour small, rich, stable places. Removing the two suspect components barely moves them (Liechtenstein stays 1st) precisely because reweighting rewards absence. They are dimmed in the rankings but still occupy the top. Consider excluding countries below a component threshold from the headline ranking, or applying an explicit confidence penalty, rather than relying on dimming alone.
9. **No bundler or minification** — JS and CSS are served as raw source files.

## Pending improvements

- **GCB regional stitching** — scoped in `gcb-stitching-plan.md`: sources, harmonisation hazards, and method for pooling the regional editions into a ~110-country bribery dataset. Requires supervised PDF transcription and an editorial rewrite of the About-section caveat; not to be done as an unsupervised data pass.
- **Verify the remaining source values** — `WLT` (Cohn et al. 2019) and `GTI` (IEP 2026) have been checked against their primary sources; `WGI`/`GE` and `GTI` were both found wrong and `GTI` has been re-imported. Structural profiling has since flagged `WVS`, `GLO` and the micro-state entries in `EPI` (items 6–8 above). That leaves `SE`, `LSC`, `GCB_RAW`, `HOM`, `RTR` and `INF_RAW` unexamined. The other twelve components' figures came from earlier imports of varying provenance; the WGI case above shows those imports are not automatically trustworthy. Coverage counts and ranges quoted in Section 04 are computed from `js/data.js` itself and are accurate to the file, but that is not the same as being accurate to the source.
- **Mobile rankings UX** — currently truncates at 25 rows with a "show all" button; further polish needed.
