# GCB regional stitching — scoping notes

Status: **groundwork only — no data shipped.** The index currently uses the
2015/16/17 global GCB (`GCB_RAW`), and the site's methodology section openly
tells readers why the regional editions have not been pooled. Executing this
plan is an editorial decision as much as a data task: the "cannot be stitched
without bias" caveat in the About section would need rewriting to describe
the harmonisation actually performed.

## Source editions

| Edition | Countries | Fieldwork | Data format |
|---|---|---|---|
| GCB Africa 2019 | 35 | 2019 (Afrobarometer R7 partnership) | PDF report tables |
| GCB Latin America & Caribbean 2019 | 18 | 2019 | PDF report tables |
| GCB Middle East & North Africa 2019 | 6 | 2019 | PDF report tables |
| GCB Asia 2020 | 17 | 2019–20 | PDF report tables |
| GCB EU 2021 | 27 | Oct–Dec 2020 (Kantar) | PDF report tables |
| GCB Pacific 2021 | 10 | 2021 | PDF report tables |

All via https://www.transparency.org/en/gcb — reports are PDFs; no
machine-readable regional datasets are published. Every number would have to
be transcribed from report tables and double-checked by hand.

## Harmonisation hazards (why this is not a copy-paste job)

1. **Different service baskets.** The bribery rate is "% of public-service
   users who paid a bribe in the previous 12 months", but the basket of
   services differs per edition (Africa: 6 services incl. police, ID
   documents, utilities; EU: health care most prominent; Pacific includes
   services with very small user bases). Rates are not directly comparable
   across editions.
2. **Different fieldwork windows.** 2019 (Africa, LatAm, MENA) vs late-2020
   (EU, mid-pandemic, suppressed service contact) vs 2021 (Pacific).
3. **Contact-based vs population-based rates.** Some editions report % of
   service *users*, others % of *all respondents*. Must be normalised to one
   base before use.
4. **Mode effects.** Afrobarometer face-to-face vs Kantar phone/online
   panels; mode alone shifts sensitive-behaviour reporting.
5. **Still-missing countries.** Norway, Iceland, Switzerland, Canada, USA,
   Israel, Gulf states, New Zealand are in no regional edition — the current
   index's most visible GCB gap would remain for exactly the countries the
   site's limitations section names.

## Proposed method (when executed)

1. Transcribe per-country bribery rates from each report's data annex into
   `gcb-regional-raw.csv` with columns: iso3, rate, base (users/all),
   services, fieldwork, edition. Two-person (or two-pass) verification
   against the PDFs.
2. Normalise to contact-based rates where both are published.
3. Drift check: ~60 countries overlap with GCB 2015–17; regress new vs old
   rates per edition to detect level shifts from basket/mode changes. If an
   edition shows a systematic shift, re-base it to the overlap countries.
4. Replace `GCB_RAW` with the stitched set; keep the 2015–17 value where no
   regional edition covers a country. Record vintage per country for the
   tooltip footnote.
5. Rewrite the About-section limitation paragraph to describe the
   harmonisation honestly (baskets, windows, re-basing) instead of saying
   pooling was not attempted.

## Effort estimate

Transcription + verification ~1 day; harmonisation analysis ~1 day; copy and
tooltip updates ~half a day. Best done with the PDFs open and a human
spot-checking every transcribed value.
