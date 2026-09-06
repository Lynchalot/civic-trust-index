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

### Custom de facto flags

Five de facto states — Somaliland, South Ossetia, Abkhazia, Northern Cyprus,
Transnistria — have no ISO 3166-1 code and therefore no Unicode
regional-indicator flag emoji, so they get hand-drawn SVGs. The editable
sources are `flags/*.svg`; the copies the app actually uses are inlined as
URL-encoded `data:image/svg+xml,` URIs in `DEFACTO_FLAGS` (`js/data.js`), so
the monolith stays self-contained when shared.

After editing a source SVG, regenerate the inlined copies, then rebuild the
monolith:

```bash
node build-flags.js      # flags/*.svg  →  DEFACTO_FLAGS in js/data.js
node build-monolith.js
```

`build-monolith.js` does not look at `flags/` — the two steps are separate.
`build-flags.js` holds the basename → display-name map (display names must
match the `DEFACTO_POLYGONS` names in `js/defacto.js`) and exits non-zero if a
source SVG or the `DEFACTO_FLAGS` block is missing.

**Do not hand-write these URIs.** They are emitted into an HTML string
(`<img src="...">`) via `innerHTML`, so a raw `"` closes the attribute and a
raw `&` opens an entity; and per the URL spec a raw `#` — every hex colour
starts with one — begins the fragment and truncates the SVG at that point. An
earlier hand-inlined set carried all three and every flag failed to render.
`build-flags.js` escapes `%`, `#`, `&`, `"`, `'`, `<`, `>` and non-ASCII glyphs.

## Architecture

### Data pipeline (`js/data.js`)

All country data, normalisation, and scoring live here. The file is self-contained and runs synchronously on load.

**Raw source dictionaries** — one per component, keyed by ISO3:

| Key | Source | Year | Update cadence |
|---|---|---|---|
| `WGI` / `GE` | World Bank WGI – Corruption Control / Gov. Effectiveness | 2024 | Annual |
| `SE` | World Bank Informal Economy DB (Elgin et al.) – MIMIC informal output (% GDP) | 2019 | Biennial |
| `WVS` | World Values Survey Wave 7 – interpersonal trust % (Q57, computed from v6.0 microdata) | 2017–23 | ~5 years |
| `LSC` | Legatum Prosperity Index – Integrity of Communities | 2026 | Annual |
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
- `DEFACTO_FLAGS` — de facto state display name → inline SVG data URI, rendered by `defactoFlag(name)`; covers the five polygons that have no ISO 3166-1 code (see *Custom de facto flags* below)
- `byNum` / `byISO` — computed score objects keyed by UN numeric and ISO3 respectively

### Rendering (`js/app.js`)

`loadAtlas()` fetches the world TopoJSON once behind a shared promise (self-hosted `assets/world-50m.json`, jsDelivr fallback); all map rendering flows from that.

- **Flat map** — D3 `geoNaturalEarth1` projection, `d3.zoom()` (scale 1–12). Shape-rendering switches to `optimizeSpeed` during active zoom via `.zooming` CSS class. `will-change: transform` on the `<g>` layer.
- **Globe** — D3 `geoOrthographic`, lazy-initialised on first tab click. Drag stops auto-rotation; only the Reset button restarts it. Micro-state dots rendered as separate SVG circles clipped to the visible hemisphere.
- **Hero globe** — Decorative spinning sphere in the landing section. Uses `requestAnimationFrame` paused via `IntersectionObserver` when the hero scrolls out of view.
- **Tooltip** (`#tip`) — `position: fixed`, populated by `showTip(ev, r, name, numKey)`. **Critical**: `#tip` is a child of `#wrap` which has `overflow: hidden`. Do not add `contain: layout paint`, CSS `transform`, `filter`, or `will-change: transform` to `#wrap` or any ancestor of `#tip` — these create a new containing block that breaks fixed positioning.
- **Inline rankings** — `buildInlineRankings()` (Section 02). On viewports ≥ 1200px, lists of ≥ 30 rows are split into two real `.rk-col` divs with per-column headers; never use CSS `columns` here — Firefox and some Chrome versions render hover backgrounds incorrectly inside column containers.
- **Filter sidebar** — checkboxes grouped by category. Toggling calls `recomputeAll()` which recalculates filtered scores and repaints map fills + rankings.
- **Flags** — generated as regional indicator emoji via `String.fromCodePoint`, then converted to images by Twemoji. Lookup chain: `ISO2[r.iso3]` → `TERR_FLAG[terrName]` → `ISO2[N2I[numKey]]`. De facto states bypass this entirely and use `defactoFlag(name)` (`DEFACTO_FLAGS`), which returns an `<img>` and needs no Twemoji pass.

### Styling (`css/styles.css`)

Scale anchor: `html { font-size: 20px }` — nearly all sizing is `rem`-based so this single value controls the entire UI scale. Breakpoints at 1400px, 1000px, 900px, 800px.

App layout: CSS grid `290px 1fr 290px` (sidebar | map | rank panel). Below 1400px the rank panel hides; below 900px the sidebar hides and layout becomes single-column.

## Known technical debt

1. **GCB 2017 coverage gaps** — the 2015/16/17 Global Corruption Barometer omits several high-income countries (Norway, Denmark, Finland, Iceland, Canada, USA, Switzerland, Austria, New Zealand, Israel, Gulf states). These score without the GCB component (proportional reweighting). TI has published only regional editions since 2017.
2. **LPI scope** — the World Bank LPI covers transport/logistics infrastructure only; it excludes electricity and water supply that the discontinued WEF GCI captured.
3. **SE legacy values** — five countries absent from the WB Informal Economy Database (TWN, HKG, SRB, MNE, UZB) keep their Schneider & Medina 2018 values; the rest use WB MIMIC 2019 (2019 chosen over 2020 to avoid COVID distortion).
4. **WGI cc/ge re-imported from source (2024)** — `cc` and `ge` now hold World Bank WGI 2024 point estimates (`GOV_WGI_CC.EST` / `GOV_WGI_GE.EST`), taken from a DataBank export of the WGI database and rounded to 2dp, covering all 173 scored countries. This is the first set taken directly from the source. It replaced values that were close to but not the published figures (non-constant bias of 0.03–0.12), which had themselves replaced an outright synthetic set. Re-import impact was small: 75 of 173 ranks moved, median 0, max 5. Note the API indicator lives in source 3 (`?source=3`), not the default WDI source — plain `CC.EST` returns "indicator not found".
5. **GTI was re-imported in 2026** — the `GTI` dict previously held values that were not the published index at all (116 countries, none scoring 0 against the real index's 63 zeroes, max 9.1 against a true 8.574, last decimal clustering on `.5`). It now carries IEP's Global Terrorism Index 2026 (reporting year 2025), 161 of the published 163 countries. Palestine and North Korea are excluded because they have no WGI entry and so are not scored at all; Luxembourg and Malta fall outside the GTI's 163 and lose the component to proportional reweighting. The re-import moved 159 of 173 ranks, median 7 places, max 41. **Note the vintage is now newer than every other component** — most sit at 2021–2023 — so the index mixes years more than it did.
6. **`WVS` was re-imported from the Wave 7 microdata (v6.0), and the old values were not Wave 7** — the dict held 107 countries under the Wave 7 label. Against the actual file only **7 of the 58 overlapping entries matched to within half a point**, median error 4.1, worst Vietnam 52 against a real 27.7, Myanmar 34 against 15.1, Egypt 22 against 7.4. Some looked like older waves carried forward (Sweden's 60 and the Netherlands' 66 are the Wave 6 figures, Vietnam's 52 is Wave 5), and **49 entries had no Wave 7 survey at all** — all of Nordic and Western Europe, plus a block of African countries that reads like Afrobarometer. The slot now holds Q57 ("most people can be trusted") computed from the Cross-National Wave 7 v6.0 microdata, 97,220 respondents, weighted by `W_WEIGHT`, rounded to 1dp: **63 countries**, the 63 of Wave 7's 66 surveys that this index scores (adding Andorra, Cyprus, Libya, Maldives and Singapore, which the old dict lacked). The re-import moved 155 of 173 ranks, median 6, max 43. Fieldwork runs 2017–2023 (India 2023), so the label is now 2017–23. **Coverage fell 107 → 63 and Europe is the gap**: European countries are surveyed by the European Values Study, whose EVS 2017 wave joins WVS7 in the **Joint EVS/WVS 2017–2022 dataset (92 countries)**. Importing that file would restore them on a consistent vintage; until then they lose the component to proportional reweighting.
7. **`GLO` coverage exceeds source scope, and one fabricated entry is still in the file** — `GLO` holds 170 against the **141 countries and territories** Gallup's own 2023 Global Law and Order report says it surveyed — a surplus of about 29. The dict carries no source comment, so where the extras came from is unrecorded, and Gallup's site is blocked by the sandbox egress policy, so identifying them needs the published country list.
8. **Micro-state values in `GLO` and `EPI` look invented** — Liechtenstein, Monaco, San Marino, Andorra and Vatican City appear in exactly three dictionaries — `GLO`, `HOM`, `EPI` — and nowhere else. In two of those the values form neat descending runs matching a prestige order rather than measurements: `GLO` 95/92/90/89/88 and `EPI` 92/90/88/88/85. The clearest tell is Vatican City carrying a Gallup Law & Order score of 95, for a state of ~800 residents that no pollster surveys. **`GLO` still holds that VAT:95 entry** — it stopped affecting the index only because the Holy See has no WGI record and so is not scored, not because the value was removed. `HOM` is plausible — UNODC does publish homicide counts for these states. Against that, the top of `GLO` is not junk: Tajikistan at 96 is a real and repeatedly published Gallup result, so this reads as a genuine core with fabricated fill-ins rather than a fabricated dictionary.
9. **Thin-data countries are withheld from the ranking, and that rule is load-bearing** — Liechtenstein, Monaco, San Marino and Andorra are scored on `cc`, `ge`, `glo`, `hom`, `epi` only: 5 of 13 components, **31% of the weight**. Proportional reweighting then collapses the full 100% onto those five, all of which favour small, rich, stable places, and the 2026 Legatum edition does not cover them either, so the gap is not closing. Deleting the two least trustworthy of the five (item 8) leaves them on **three** components and makes **Monaco 1st** — removing bad data makes the ranking worse, because reweighting rewards absence. The only thing that answers it is a coverage rule, and the app has one: `RANK_MIN_COMP` (`js/data.js`) withholds every country under 8 of 13 components from both ranking views unless the reader ticks *Show withheld*. On the current data that is exactly a 50% weight-coverage floor — every country with 8+ components covers ≥53%, none below 8 reaches 50% — and it withholds 15 of 173, opening the index at Singapore, Mauritius, Norway, Denmark, Sweden. An earlier version of this note claimed the four merely got "dimmed" and still topped the ranking; that was wrong, and the rule pre-dates it. What was missing was disclosure, now added: the ranking header states how many countries are withheld and why, the tooltip shows each country's weight coverage, and the About-section caveat explains the rule.

10. **`LSC` changed source and meaning in the 2026 import** — the slot held Legatum's Social Capital pillar (2023): real values, verified against the published index, but only 66 countries, and skewed — by quartile of `cc` the coverage ran **34 / 22 / 10 / 0** from best-governed to worst, so an 8% weight vanished exactly where it would most likely have scored low. The 2026 edition rebuilt the index into three domains and ten pillars and dropped Social Capital entirely. The slot now holds **Integrity of Communities** (2026 data sheet, `scores` tab), 160 of 173 countries. It is the closest published successor, not the same measure: across the 66 countries holding both, the two correlate at only **r = 0.51**, so the component was renamed throughout rather than quietly refilled. The swap moved 141 of 173 ranks, median 3, max 43 — the largest falls (Eritrea −43, Turkmenistan −41, Equatorial Guinea −35) are countries that had been gaining from the pillar's absence. The 13 still missing (Liechtenstein, Monaco, San Marino, Andorra, Brunei, Cuba, Guyana, Hong Kong, Maldives, Syria, Taiwan, Ukraine, Kosovo) fall outside the 2026 index. **Its vintage, 2026, is now the newest in the index** — see item 5 on the widening spread.
11. **Digit profiling of the remaining unverified dicts** — `SE`, `GCB_RAW` and `INF_RAW` have last-digit distributions consistent with real measurement (χ² 9.6, 8.7, 7.7 against uniform, df 9, 5% critical value 16.9); nothing there looks fabricated. `HOM` (χ² 202) and `RTR` (χ² 62) cluster hard on `.0` and `.5` — 61% and 43% of values sit on a half-unit grid. That is what rounding a published rate to one decimal looks like, so it is not by itself evidence of invention, but neither dict has been checked against UNODC or WHO.
12. **No bundler or minification** — JS and CSS are served as raw source files.

## Pending improvements

- **GCB regional stitching** — scoped in `gcb-stitching-plan.md`: sources, harmonisation hazards, and method for pooling the regional editions into a ~110-country bribery dataset. Requires supervised PDF transcription and an editorial rewrite of the About-section caveat; not to be done as an unsupervised data pass.
- **Verify the remaining source values** — `WLT` (Cohn et al. 2019), `GTI` (IEP 2026), `WGI`/`GE` (World Bank 2024), `LSC` (Legatum 2026) and `WVS` (WVS7 v6.0 microdata) have been checked against their primary sources; `WGI`/`GE`, `GTI`, `LSC` and `WVS` were all re-imported as a result. The `WVS` re-import left Europe without a trust value — see item 6; the **Joint EVS/WVS 2017–2022 dataset** (GESIS ZA7505, 92 countries) is the file that would close it. Structural profiling has flagged `GLO` and the micro-state entries in `EPI` (items 7–8), and cleared `SE`, `GCB_RAW` and `INF_RAW` on digit distribution alone (item 11). That leaves `SE`, `GCB_RAW`, `HOM`, `RTR` and `INF_RAW` unchecked against their actual sources. The other twelve components' figures came from earlier imports of varying provenance; the WGI case above shows those imports are not automatically trustworthy. Coverage counts and ranges quoted in Section 04 are computed from `js/data.js` itself and are accurate to the file, but that is not the same as being accurate to the source.
- **Mobile rankings UX** — currently truncates at 25 rows with a "show all" button; further polish needed.
