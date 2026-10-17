# Clarity for US — Phase 0 feature preservation and acceptance matrix
As of 2026-10-15. **No runtime test in this document has passed unless explicitly marked.**
The saved Site view is static rendered text. Its controls, auth semantics and persistence cannot be certified from it.

| ID | Feature/surface | Evidence | Mandatory smoke test | Status |
|---|---|---|---|---|
| P0-01 | Site identity/access | Library active, v28; public 401 sign-in | Access as authorized admin, intended guest, unauthorized visitor; confirm deliberate permissions | **Metadata verified; auth behavior externally observed** |
| P0-02 | Home and branding | Snapshot headers and footer | Open desktop/mobile, screenshot, validate nav and language | **UI text only** |
| P0-03 | Global search input | Snapshot Search controls | Search person, bill, executive order; verify relevant results and empty query state | **UI text only** |
| P0-04 | Type filters | Ten filter categories shown | Filter each type; verify counts/scope, URLs, no results, pagination | **UI text only** |
| P0-05 | Politician profiles | Representative record tiles shown | Open 5 records with verified stable IDs; inspect office/cycle/source/date | **UI text only** |
| P0-06 | Candidate/elections | Type exists in filters | Verify one linked FEC candidate, correct committee and cycle | **Not tested** |
| P0-07 | Bill/version detail | Site reports bill totals | Open an official bill, inspect version and source citation | **Not tested** |
| P0-08 | House/Senate votes | Votes filter shown | Open roll call; verify each chamber/count/recorded vote, absence of mismatched bill | **Not tested** |
| P0-09 | FEC money, donors/PAC | Money, PAC, Contributor filters shown | Inspect donor vs transfer vs independent spending, source/cycle | **Not tested** |
| P0-10 | Executive orders | Site reports 50 orders | Open source/order number, date and presidential office term | **Not tested** |
| P0-11 | Presidential funding | Filter shown | Verify data actually comes from a legal primary source, not a design example | **Not tested** |
| P0-12 | Court cases | Court filter shown | Open case and verify specific bill/order relationship with legal evidence | **Not tested** |
| P0-13 | Clarity Graph | Graph intro and caution text visible | Traverse 3 edges, open evidence for each, distinguish inferred vs official | **Design text only** |
| P0-14 | Source links | Record tile states "Open evidence" | Test source URL reachable, correct record, last updated and relevant fragment | **Not tested** |
| P0-15 | Plain-English AI analysis | Historical Sites baseline reports provider configured | Analyze exact document version, verify grounded citations and safe errors | **Historical snapshot only** |
| P0-16 | Data/coverage dashboard | Data status link shown | Verify connector/freshness/row counts vs DB, failed jobs, stale states | **UI link only** |
| P0-17 | Owner-only refresh | Historical Sites baseline reports control | Anonymous denied, admin allowed; verify idempotent refresh and logs in safe staging | **Historical snapshot only** |
| P0-18 | D1 persistence | Historical Sites baseline reports D1 | Read schema and migrations, backup, restore in staging; compare counts and foreign links | **Not accessible** |
| P0-19 | External/public access | Fresh anonymous HTTP response 401 | Confirm intended audience and permission mode; test against release spec | **401 confirmed** |
| P0-20 | Accessibility/mobile | Unavailable externally | Keyboard navigation, focus, contrast, screen-reader labels, narrow viewport | **Not tested** |
| P0-21 | Scheduled ingestion | Prior reports describe refresh | Inspect jobs, checkpoints, retry and backoff behavior; verify no destructive rewrite | **Not accessible** |
| P0-22 | Source-control portability | GitHub main is static landing | Obtain actual app source/manifests; clean build and preview parity | **Blocked** |
| P0-23 | Data corrections/security | Intended by roadmap | Test access control, no secrets leaked, error reporting and correction links | **Not tested** |

## Test fixtures to preserve when authenticated
Use actual authoritative records and save only their **public source IDs** and URLs to this public repository:
- Current US House member and Senate member from an official roster (including one recent office change).
- One unambiguous Congress.gov 119th Congress bill and at least two source text versions if available.
- One House and one Senate recorded vote, with roll-call number and exact question.
- One FEC candidate and its matching committee; one separate independent-expenditure committee.
- One executive order from the Federal Register with document number and date.
- One court docket whose relation to a federal policy is supported by explicit filings, not merely shared keywords.

## Acceptance evidence format
Each future test run records:
`test_id | environment | test_date | tester | expected | actual | outcome | screenshot_or_log | source_record_id`.

No PASS status based on a link title, rendered text snapshot, previously reported test from a different app, or an unverified AI summary.
