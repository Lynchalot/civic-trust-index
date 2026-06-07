# Launch guide — Civic Trust Index

Everything you do *outside the code* to get the site live, run a private
preview, go public, and get it seen. Work top to bottom.

---

## 0. How the hosting works (the one-minute mental model)

- The site is **static files** (HTML, CSS, JS) in your GitHub repo
  `Lynchalot/civic-trust-index`.
- **GitHub Pages** serves those files for free. No server, no monthly bill.
- Buying a domain just points a nice name (`civictrustindex.com`) at those
  files. GitHub also gives you free HTTPS.
- To change the site, you edit files, commit, and push. Pages redeploys in
  about a minute.

That's the whole stack. Nothing else is required.

---

## 1. Buy the domain

1. On **Crazy Domains**, buy `civictrustindex.com`.
2. **Skip every upsell** — hosting, email, "website builder", SSL/security
   add-ons, privacy protection (you can leave WHOIS privacy *on* if it's
   free, that's the one worth keeping). You need the domain and nothing else.
3. You'll manage the domain from Crazy Domains' **DNS** screen in step 2.

> I can't enter payment details for you — do the purchase yourself.

---

## 2. Point the domain at GitHub Pages

**a. Tell GitHub the domain.**
Repo → **Settings → Pages → Custom domain** → type `civictrustindex.com` →
Save. Leave **Enforce HTTPS** ticked once it becomes available (it may take
a few minutes while GitHub issues the certificate). This writes a `CNAME`
file into the repo automatically.

**b. Add the DNS records in Crazy Domains.**
In the domain's DNS management, add these:

Apex domain — four A records (host `@`):

    A   @   185.199.108.153
    A   @   185.199.109.153
    A   @   185.199.110.153
    A   @   185.199.111.153

`www` subdomain — one CNAME:

    CNAME   www   lynchalot.github.io

**c. Delete the default record.** Crazy Domains usually adds a "parking"
A record on `@`. Remove it, or it will fight the four GitHub records.

**d. Wait.** DNS changes take anywhere from a few minutes to a few hours.
When they land, `civictrustindex.com` shows your site over HTTPS.

---

## 3. Confirm it's live

- Visit `https://civictrustindex.com` — should load the site.
- Visit `https://www.civictrustindex.com` — should redirect to the apex.
- Check the padlock (HTTPS) is present.
- If it doesn't resolve after a few hours, the usual culprit is a leftover
  parking record from step 2c.

---

## 4. The private preview (already built in)

The site ships with a **password screen** so you can show it to a few
people before going public.

- **Default password:** *(sent to you separately — not written here, since
  this file is public once the site is)*.
- **What it does:** anyone visiting sees a "Private preview" password box.
  Friends type the password once; the site remembers them. Search engines
  are told not to index the site while the gate is on.
- **What it is not:** real security. A determined technical person could
  bypass it. That's fine — the site is going public anyway. It just keeps
  out casual visitors and search engines during the preview.

**To change the password:** in a terminal, run

    printf '%s' 'your-new-password' | sha256sum

Copy the long hex string it prints, open `beta-gate.js`, and paste it into
`PASSWORD_HASH`. Commit and push.

**To share with friends:** send them `https://civictrustindex.com` and the
password. Ask them to try it on phone and desktop, in light and dark mode,
and to tell you anything confusing or broken.

---

## 5. Go public

When you're ready (after your week of testing and any wording fixes):

1. Open `index.html`, find this line near the top of `<body>`:

       <script src="beta-gate.js"></script>

   **Delete it.** (You can also delete `beta-gate.js` itself.) That single
   removal takes down both the password screen and the search-engine block.
2. Commit and push.
3. Confirm: open the site in a private/incognito window — no password screen,
   and view-source shows **no** `noindex` tag.

That's the public launch.

---

## 6. Right after going public (do these once)

These tools cache previews and crawl data, so prime them once the site is
public and ungated.

- **Facebook / Open Graph debugger** — `developers.facebook.com/tools/debug`
  Paste the URL, hit "Scrape Again". Confirms the share card image works.
- **X / Twitter card validator** — `cards-dev.twitter.com/validator`
  (or just paste the link into a draft post and check the preview).
- **LinkedIn Post Inspector** — `linkedin.com/post-inspector`
- **Google Search Console** — `search.google.com/search-console`
  Add the domain, verify it (usually via a DNS TXT record in Crazy Domains),
  then submit `https://civictrustindex.com/sitemap.xml`. This is how you see
  what people search to find you, and it speeds up indexing.
- **Bing Webmaster Tools** — `bing.com/webmasters`
  Same idea, five minutes. Bing also feeds Copilot and some AI answers.

**Optional — traffic numbers.** GitHub Pages gives you no analytics. If you
want to know how many people visit, add a privacy-friendly, cookie-free
option (no banner needed):
- **Cloudflare Web Analytics** (free) or **Plausible** (paid, simple).
Either is one snippet in `<head>`; tell me and I'll wire it in.

---

## 7. Launch kit (post these to get the first wave of visitors)

SEO is slow. Your first real traffic comes from posting it where the right
people already are. Drafts below are in the site's voice — edit freely.

### Hacker News — "Show HN"
Post at `news.ycombinator.com/submit`. Best on a weekday morning US time.

**Title:**
> Show HN: Civic Trust Index – ranking 174 countries by everyday behaviour, not GDP

**Text:**
> Most country rankings grade institutions as experts perceive them. I wanted
> the opposite: a score built from what people actually do. Do strangers
> return lost wallets? Are bribes routine? Are the streets clean and the roads
> survivable? It pulls together thirteen public datasets — the Cohn wallet
> experiment, Gallup's Law & Order index, the World Values Survey, UNODC
> homicide data, and others — into one map. Institutional measures are only 6%
> of the weight; the other 94% is behaviour and outcomes. Every source and
> weight is listed, and you can toggle components to see how each one moves
> the ranking. It's a static site, no tracking. Feedback welcome, especially
> on the methodology and the data gaps (which are documented).

### Reddit — r/dataisbeautiful
Read the subreddit rules first; it requires the `[OC]` tag and a comment
naming your tools/sources.

**Title:**
> [OC] Which countries actually "work"? 174 countries ranked on civic trust — wallet returns, bribery, homicide, road deaths and more

**First comment (you post this yourself, right after submitting):**
> Tools: D3.js for the map, vanilla JS, no framework. Sources: World Bank,
> Gallup, World Values Survey, Transparency International, UNODC, WHO, Yale
> EPI, the Cohn et al. 2019 wallet study, and others — all listed on the site
> with weights and known limitations. Institutional measures are only 6% of
> the score; the rest is observed behaviour. Link: https://civictrustindex.com

Other subreddits worth a (rule-checked) post later: r/MapPorn, r/geography,
r/InternationalNews, country-specific subs when a result is surprising.

### X / Twitter thread
> 1/ Two countries can both get richer for a decade and be nothing alike to
> live in. I built an index that measures the difference: civic trust, scored
> across 174 countries. 🧵
>
> 2/ Standard rankings grade institutions the way experts see them. This one
> starts from the street. Do people return lost wallets? Are bribes routine?
> Are the roads survivable? 94% of the score is behaviour, not expert opinion.
>
> 3/ The heaviest single input is the 2019 "lost wallet" experiment — 17,000+
> wallets dropped in 40 countries to see who hands them in. It's about the
> cleanest test of everyday honesty ever run.
>
> 4/ Thirteen datasets in total — Gallup safety, World Values Survey trust,
> street-level bribery, homicide, road deaths, waste management, terrorism.
> Every source, weight and gap is documented.
>
> 5/ You can toggle any component and watch the map and rankings redraw — see
> exactly how much each measure moves a country.
>
> 6/ It's free, no tracking, independently built. Have a look (and tell me
> where your country surprised you): https://civictrustindex.com

### Cold email to writers / journalists
Keep it three sentences. Pick people who write about trust, institutions, or
social capital (the names you mentioned: Rob Henderson, the WSJ/Mead orbit,
data journalists).

> Subject: an index of civic trust across 174 countries
>
> I built a free, independent index that ranks 174 countries on civic trust —
> measured from behaviour (wallet returns, street-level bribery, safety, road
> deaths) rather than expert surveys, with every source documented. Thought it
> might be useful for your work on [their topic]; the data is open and
> citable. Link: https://civictrustindex.com

---

## 8. Donations

The "Support" button already points at your Ko-fi
(`ko-fi.com/falsehamartia`), and the footer has a share link. Once you have
traffic, the two things that lift donations are: (1) making the project look
credible and cited — which the documented sources and Dataset metadata help
with — and (2) a clear, low-key ask. Don't over-engineer it early; get
people to the site first.

---

## 9. If you ever want a *real* login wall

The built-in gate is a soft one. If you later need genuine access control
(e.g. a paid or member-only section), the clean free route is **Cloudflare
Pages + Cloudflare Access**: move hosting to Cloudflare Pages (connects to
the same GitHub repo), then Cloudflare Access gives real email-based login
for up to 50 users on the free plan. More setup than GitHub Pages, but it's
actual authentication. Ask me and I'll walk you through it.

---

## 10. Updating the site after launch

Edit files → commit → push. Pages redeploys in ~a minute. If you don't see
your change, hard-refresh (Ctrl+Shift+R) — the browser caches aggressively.
When you do your wording audit, just tell me what to change, or edit the
prose in `index.html` directly (it's all plain text inside the tags).
