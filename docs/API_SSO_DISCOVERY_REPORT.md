# MaldaOS — Post-Release API / SSO Discovery Report

**Investigation Target:** Official Malda College Existing Application & Student ERP integration contract
**Baseline Release:** `e9f1817` (frozen) — post-release integration HEAD `6298a6c`
**Investigation Type:** Read-only, non-invasive discovery. No application code, migrations, RLS policies, or runtime configuration was modified by this investigation.

---

## 1. API Discovery

### Status: **NOT FOUND IN PUBLIC DOCUMENTATION** — no public API/developer integration contract was discovered during the available non-invasive investigation.

This is a statement about publicly available documentation, not proof that no API exists. Absence of discoverable public documentation does not establish that no private or undocumented API exists. No claim of non-existence is made.

| Parameter | Finding |
|---|---|
| **Official sources probed** | `https://maldacollege.ac.in` (incl. `/home.php`, `robots.txt`), `https://mcerp.in` (incl. `/erp/login.aspx`, `/FAQ.aspx`) — safe HTTP header/page requests only. |
| **Documented endpoints / base URLs** | None discovered. No public REST (`/api/v1/`), GraphQL (`/graphql`), RPC (`/rpc/`), or Swagger/OpenAPI specification was found on either host. |
| **Authentication method (observed)** | Traditional server-side ASP.NET session state (`ASP.NET_SessionId` cookie, `__VIEWSTATE` form variables). No API key, bearer token, or machine-to-machine authentication is publicly documented or offered. |
| **Permitted integration purpose** | No third-party API integration contract is publicly authorized or published by the college administration. |

**Technical evidence (non-invasive HTTP probing, 2026-09-06):**

- `https://mcerp.in/erp/login.aspx` response headers:
  - `server: Microsoft-IIS/10.0`
  - `x-aspnet-version: 4.0.30319`
  - `x-powered-by: ASP.NET`
  - `x-powered-by-plesk: PleskWin`
  - `set-cookie: ASP.NET_SessionId=…; path=/; HttpOnly; SameSite=Lax`
- Standard discovery paths returned no public contracts:
  - `https://mcerp.in/.well-known/openid-configuration` → `HTTP/2 404 Not Found`
  - `https://mcerp.in/api`, `https://mcerp.in/swagger` → `HTTP/2 404 Not Found`
  - `https://maldacollege.ac.in/.well-known/openid-configuration` → `HTTP/2 403 Forbidden` (Hostinger WAF)
- `https://maldacollege.ac.in` is fronted by Hostinger with `x-frame-options: SAMEORIGIN` and `content-security-policy: frame-ancestors 'self'` — it cannot be iframed; outbound navigation must open in a separate tab.

**Observed infrastructure:** ASP.NET WebForms application hosted on Microsoft IIS 10.0 (Windows/Plesk) at `mcerp.in`; public college site at `maldacollege.ac.in` (Hostinger). All student/staff ERP logins route through `https://mcerp.in/erp/login.aspx`.

---

## 2. SSO Discovery (OAuth2 / OIDC / SAML)

### Status: **UNVERIFIED** — no public SSO mechanism was discovered during the available non-invasive investigation.

No claim is made that SSO does not exist or that the ERP has no SSO. Only that no public SSO endpoint, federation metadata, or documentation was discoverable through the available non-invasive checks. This remains **PENDING OFFICIAL COLLEGE / ERP CONFIRMATION**.

| Federation standard | Discovery result | Evidence |
|---|---|---|
| **OpenID Connect (OIDC)** | Not found in public documentation | `mcerp.in/.well-known/openid-configuration` → 404; `maldacollege.ac.in/.well-known/openid-configuration` → 403 (WAF). No OIDC discovery document publicly reachable. |
| **OAuth 2.0** | Not found in public documentation | No `/oauth/authorize`, `/oauth/token`, or client-registration portal publicly documented or reachable. |
| **SAML 2.0** | Not found in public documentation | No publicly reachable SAML IdP metadata XML or institutional identity federation discovered on `mcerp.in`. |
| **Observed login mechanism** | Manual credential entry | The ERP login is an ASP.NET WebForm (`login.aspx`) with session-cookie authentication; no publicly documented federated token or assertion exchange mechanism was discovered. |

---

## 3. Current Integration Contract (unchanged)

The implemented and tested contract remains a **secure, decoupled deep-link architecture**:

```
Existing Malda College App / ERP (records stay on college servers)
        │  inbound deep-link: ?source=college_app&return_url=…&student_id=…&category=…
        ▼
MaldaOS safe inbound boundary (parseInboundAppParams / sanitizeReturnUrl)
        ▼
Campus issue reporting → AI triage / geolocation → Admin assignment
        ▼
Staff resolution → Verification
        │  outbound: curated official links, new tab, rel="noopener noreferrer"
        ▼
Official College Services (portal, exams, fees, library, support)
```

- `source`: must equal `college_app` (case-insensitive).
- `return_url`: strictly validated by `sanitizeReturnUrl()` — absolute `http(s)` only, hostname restricted to `maldacollege.ac.in` (+ subdomains), `localhost`, `127.0.0.1`; rejects embedded credentials, control characters, protocol-relative URLs, relative paths, `javascript:`/`data:` schemes, and oversized inputs (open-redirect defense).
- `student_id` / `category` / `return_label`: length-capped, character-class-validated display/prefill tokens. No credentials, session tokens, or ERP data are ingested, stored, or exchanged.
- No API client, SSO bridge, credential store, schema migration, or RLS change is part of this contract.

---

## 4. Security Assessment

Deeper API or SSO integration is **not safe to pursue at this time** without an official administrative agreement and a published developer contract from Malda College:

1. **Authentication / session risks** — interfacing with the legacy ASP.NET WebForms stack would require simulating form posts or handling `ASP.NET_SessionId` cookies and `__VIEWSTATE` fields; this would violate secure session boundaries and break on any ERP UI change.
2. **Student-data boundary / privacy** — academic records (marks, fees, admissions) are confidential institutional data; ingesting them would violate data-minimization principles.
3. **Authorization / RLS integrity** — MaldaOS authorization is database-enforced (migrations 0001–0008, 37 live RLS tests); an ad-hoc external authorization bridge could weaken this model.
4. **Open-redirect / token-leakage** — any improvised SSO redirect without an official OIDC provider would create open-redirect and token-leakage vectors; the current `sanitizeReturnUrl()` guard exists precisely to prevent this class of issue.

---

## 5. Recommendation

**B. NO PUBLIC API/SSO DOCUMENTATION FOUND**

- Retain the current deep-link and external-navigation architecture.
- Mark API / SSO status as **PENDING OFFICIAL COLLEGE / ERP CONFIRMATION**.
- Do not build scrapers, reverse-engineered API clients, or undocumented SSO bridges.
- If the college later publishes an official REST API or an OIDC/SAML provider, run the full security-review and architecture-approval pipeline before any implementation.

---

*Report recorded 2026-09-06. Discovery performed via safe, non-invasive HTTP requests against public endpoints only; no authentication was bypassed, no private endpoints were accessed, and no credentials or session data were captured or stored.*
