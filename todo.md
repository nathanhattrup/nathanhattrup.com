# TODO — get nathanhattrup.com un-blocked

Working list for clearing the reputation-filter block on the domain.

## Background

On 2026-08-09 the site started returning `SSL received a record that exceeded the maximum
permissible length` on a Spectrum home network. Diagnosis:

- DNS is correct — `www.nathanhattrup.com` → `nathanhattrup.github.io` → `185.199.108-111.153`.
- Connecting to that same IP with SNI `nathanhattrup.github.io` returns a clean TLS handshake
  and `HTTP/1.1 200 OK` from GitHub.com. With SNI `www.nathanhattrup.com` the handshake is
  killed.
- Plain HTTP returns `302 → https://block.charter-prod.hosted.cujo.io/warn.html?url=...`

So the block is done by **CUJO AI** (the engine behind Spectrum's Security Shield), matching on
hostname at the SNI layer. It never reads the page. The odd SSL error happens because CUJO can't
forge a certificate for the domain, so it answers the TLS ClientHello with a plaintext HTTP
redirect; the browser tries to parse `HTTP/1.1 302...` as a TLS record and reports a bogus
record length.

**Consequence for this list:** page content changes cannot fix the block directly. What these
products score is *domain reputation*, computed off-page from registration data, DNS hygiene,
domain age, traffic, and inbound links. Those are the high-leverage items.

Likely reason the domain scored badly: registered **2026-01-03** (~7 months old), very low
traffic, and CNAME'd to `*.github.io`, which is heavily abused for phishing kits and carries
poor shared reputation.

---

## 1. Identify how many vendors are involved

**Why:** Other people report the block, but rarely — that is a pattern in *vendors*, not in
people. CUJO ships inside Spectrum, parts of Comcast/Cox, Sky, and several router-OEM security
tiers. Anyone behind one of those is blocked; everyone else is fine. Knowing whether it is one
vendor or several decides how much delisting work there is.

- [ ] Ask each person who reports a block to open the block page and send the URL.
- [ ] Sort the answers:
  - URL contains `cujo.io` → same vendor as ours. One delisting fixes all of them.
  - `bitdefender` / `netgear armor` / `opendns` / `nextdns` / `umbrella` → separate reputation
    feeds, each needs its own submission (§3).

Do this before anything else — it scopes the rest of the work.

---

## 2. DNS and registration hygiene

Highest leverage, zero risk to the live site. All of this is done in the **GoDaddy** DNS panel
(nameservers are `ns55/ns56.domaincontrol.com`).

### 2a. Declare that the domain sends no mail

The apex currently publishes a DMARC record but **no SPF record and no MX record**. A domain
that cannot state "I send no mail" is trivially spoofable, and spoofable domains get downranked
by Spamhaus DBL and similar feeds — which flow downstream into consumer security products like
CUJO. This is the single cheapest reputation fix available.

Add these records:

| Type | Name | Value | Notes |
|------|------|-------|-------|
| TXT | `@` | `v=spf1 -all` | "no host is authorized to send mail as this domain" |
| MX | `@` | `.` with priority `0` | null MX per RFC 7505 — same claim at the mail-routing layer |

### 2b. Tighten DMARC

Current record is GoDaddy's default:

```
v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;
```

Since the domain sends no mail at all, there is no reason to run a relaxed, quarantine-only
policy. Replace the `_dmarc` TXT record with:

```
v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:nahattrup@gmail.com
```

Changes: `p=quarantine` → `p=reject`, relaxed alignment (`r`) → strict (`s`), and reports go
somewhere actually readable.

### 2c. Restrict certificate issuance (CAA)

| Type | Name | Value |
|------|------|-------|
| CAA | `@` | `0 issue "letsencrypt.org"` |
| CAA | `@` | `0 issuewild ";"` |

GitHub Pages provisions certificates through Let's Encrypt, so this is safe today.

> **Remember this record exists.** If the site ever moves to a host using a different CA
> (Cloudflare uses Google Trust Services / Let's Encrypt depending on plan), certificate
> issuance will fail until the CAA record is updated. This is the one item here that can break
> something later.

### 2d. Enable DNSSEC

GoDaddy exposes this as a toggle on the domain (may be a paid add-on depending on the plan).
Signals an actively maintained domain rather than a disposable one.

### 2e. Extend the registration term

Currently registered `2026-01-03` → expires `2028-01-03` (2-year term). Registration length is a
scored feature in reputation models, because throwaway abuse domains are almost always bought
for a single year.

- [ ] Renew out to **2031 or later**.

---

## 3. Request review from the reputation vendors

Free, no account needed for most. Expect days to weeks for a response.

- [ ] **Spectrum support ticket.** Give them the exact block URL
      (`https://block.charter-prod.hosted.cujo.io/warn.html?url=http://www.nathanhattrup.com/`),
      state it is a false positive on a personal portfolio site, and ask them to escalate to
      CUJO AI. Front-line support will usually just tell you to disable Security Shield — push
      for the escalation, since that is what actually fixes it for other people.
- [ ] **Google Safe Browsing** — https://safebrowsing.google.com/safebrowsing/report_error/
      (first check current status at
      https://transparencyreport.google.com/safe-browsing/search?url=nathanhattrup.com)
- [ ] **BrightCloud / Webroot** — https://www.brightcloud.com/tools/url-ip-lookup.php
      (look up the domain, then use the "request a review" / recategorization link)
- [ ] **Norton Safe Web** — https://safeweb.norton.com/ → search domain → "Dispute this rating"
- [ ] **Forcepoint CSI** — https://csi.forcepoint.com/
- [ ] **VirusTotal** — https://www.virustotal.com/gui/domain/nathanhattrup.com → rescan, and note
      which engines (if any) flag it. Useful evidence for the other submissions.

Add any additional vendors surfaced by §1.

---

## 4. Build presence signals

Domain age fixes itself with time, but confidence scores rise faster when the domain appears in
sources the reputation feeds already read.

- [ ] **Google Search Console** — add and verify the property (DNS TXT verification is easiest
      given GoDaddy access), then submit `https://www.nathanhattrup.com/sitemap.xml`.
- [ ] **Bing Webmaster Tools** — same; can import directly from Search Console.
- [ ] **Inbound links from aged, trusted domains.** A handful of real links is worth far more
      than zero:
  - LinkedIn profile → website field
  - GitHub profile → website field
  - University / lab / club page, if one exists

---

## 5. Remaining site edits

Most of this is already done. Recorded here so it is not re-litigated.

**Already complete:**

- [x] Meta descriptions on all 7 pages (`index`, `projects`, `courses`, `trips`, `books`,
      `lifts`, `gates`)
- [x] `assets/Lab 3.pdf` renamed to `assets/ece212-lab3.pdf` — descriptive, no space in the
      filename. Linked in context from `projects.html:206`. PDFs are the most common malware
      carrier format for content scanners, so a generic-named PDF is worth avoiding.
- [x] Vendored JS already carries provenance banners with source URL and version
      (`assets/d3.v7.min.js`, `assets/topojson-client.min.js`, `prism/prism.js`). Large minified
      blobs on a personal site can trip "possibly obfuscated" heuristics; the banner resolves
      any human review immediately.
- [x] `experience.html` deleted. Verified no dangling references remain in any HTML page, in
      `sitemap.xml`, or in the sidebar nav.

**Still open:**

- [ ] **Rewrite the meta descriptions with real content.** The current ones are templated
      (`"Books page for Nathan Hattrup"`, `"Trips page for Nathan Hattrup"`, …). Templated,
      near-identical metadata across a whole site is itself a low-quality signal to content
      classifiers — it is the shape parked and doorway pages have. Write one honest sentence per
      page describing what is actually on it. Example for `books.html`: *"A running shelf of
      books I've read, with covers, authors, and formats."*

- [ ] **Add Open Graph and Twitter Card tags.** No page has them. They are a normal marker of a
      real, maintained site, and they make links render properly when shared. Per page, in
      `<head>`:

  ```html
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Nathan Hattrup">
  <meta property="og:title" content="Books — Nathan Hattrup">
  <meta property="og:description" content="(same text as the meta description)">
  <meta property="og:url" content="https://www.nathanhattrup.com/books">
  <meta name="twitter:card" content="summary">
  ```

  Note `og:url` should use the clean extensionless URL, matching the existing `rel="canonical"`
  link on each page.

- [ ] **Update `CLAUDE.md`.** It is now stale: it still lists `experience.html` in the Pages
      table and still says to add `experience` to the sitemap "when it gets real content."

- [ ] *(Optional, low priority.)* Meta CSP via
      `<meta http-equiv="Content-Security-Policy">`. GitHub Pages cannot serve real response
      headers, and the meta form is the only option. **Tradeoff:** every page has inline
      `<script>` blocks (theme toggle, nav, lightbox), so the policy would need
      `'unsafe-inline'`, which blunts most of the benefit. Only worth doing as part of moving the
      inline JS out into files.

---

## 6. Fallback — only if still blocked in ~3 months

- [ ] **Migrate to Cloudflare Pages + Cloudflare DNS.** Two real advantages: actual control over
      security response headers (which GitHub Pages does not offer), and edge IPs with better
      standing than `*.github.io`, whose shared reputation is plausibly part of the original
      problem.

  Caveats: it is a real migration, the CAA record from §2c must be updated first or certificate
  issuance will fail, and `EPOCH` in `make_gates_data.py` plus the `localStorage["gates.v4"]`
  key are unaffected by a host move (same origin) — but confirm the domain stays exactly
  `www.nathanhattrup.com`, since a changed origin would orphan every player's stored Gates
  history.

Not worth doing preemptively. Switching static hosts in general (Netlify, Vercel) carries the
same shared-reputation baggage; Cloudflare is the only move with a clear upside, and only
because of the headers.

---

## Not worth doing

- Removing or altering page content to "look safer." The filter blocked at the SNI layer and
  never fetched a single byte of HTML.
- DNS-over-HTTPS as a workaround. The local resolver returned correct IPs — the block is on SNI,
  downstream of DNS. Only a VPN bypasses it client-side, and that helps one person, not visitors.
- Disabling Security Shield in the Spectrum app. Useful to confirm the diagnosis and to unblock
  your own machine, but it fixes nothing for anyone else.
