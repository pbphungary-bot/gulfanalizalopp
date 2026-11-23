# MANIFEST.md — Product scope and status

> What the app must do, and what is actually done. Rules for working are in `CLAUDE.md`. Statuses follow the evidence policy below; update them only with evidence.

## 0. Document control

- **Product:** golf performance app, working name "Golf Coach" (final name open, "GolfAxis" preferred, not cleared)
- **Tagline:** YOUR GAME. DECODED.
- **Platforms:** iOS, iPad, Android. No desktop or web target.
- **Markets and languages:** Hungary (main), Slovakia, Austria. Hungarian and English. Metric default.
- **Owner:** the user. Last audit: 2026-11-23, from the repository on branch `claude/dreamy-allen-elqlqt`.
- **Status legend:** `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `IMPLEMENTED_UNVERIFIED` · `VERIFIED`
- **Evidence policy:** `IMPLEMENTED_UNVERIFIED` means the code exists and passes type checking, bundling and any listed logic checks. `VERIFIED` needs an automated test in the repository, or a manual run on a real device written down with its date. Nothing is `VERIFIED` today.

## 1. Vision

One home for a golfer's whole development. It should say not only what happened, but **what to work on next, why, how to train it, and whether it worked**.

Principles: one golfer profile, not separate silos · measured data over decoration · advice built only from the player's own data · open about estimates and placeholders · data stays on the device and is easy to export · every distance is right in the unit the player chose.

## 2. Users

Primary: an ambitious amateur who plays, uses a launch monitor or range, and wants a plan. Later: coaches reviewing consenting players. No multi-player or coach accounts in the first release.

## 3. Navigation

Five tabs: **Home** (today, progress, next action) · **Coach** (weekly plan and why) · **Play** (courses, rounds, shot entry) · **Fitness** (gym log) · **My Game** (strokes gained, club distances, imports). Settings today: language, units and theme buttons on Home. New features go inside these tabs first.

## 4. Module ledger

| # | Module | Status | Evidence | Gaps / next |
|---|---|---|---|---|
| 1 | Profile and onboarding | IMPLEMENTED_UNVERIFIED | `Onboarding.tsx`, `db` profile in kv | Edit profile later; gender and handedness not stored |
| 2 | Language (en/hu) | IMPLEMENTED_UNVERIFIED | `src/i18n`; parity enforced by types; script check passed | **Hungarian is a draft; needs a native golfer's review** |
| 3 | Units (metres/yards, ft on green) | IMPLEMENTED_UNVERIFIED | `units.ts`; migration tested on a real SQLite file with sample rows; unit script checks | Weight unit (kg/lb) not switchable yet |
| 4 | Theme (dark, light) | IMPLEMENTED_UNVERIFIED | `theme.tsx`; the earlier untappable-button bug was fixed in code | Re-confirm on a phone |
| 5 | Round and shot entry | IMPLEMENTED_UNVERIFIED | `Round.tsx`, `db` shots | Needs a full round on a phone; no edit of a past shot; no GPS |
| 6 | Strokes gained | IMPLEMENTED_UNVERIFIED, **placeholder baseline** | `strokesGained.ts` | Replace baseline with licensed or validated data before real benchmarks |
| 7 | Coach (rules based plan) | IMPLEMENTED_UNVERIFIED | `coach.ts`; diagnose, allocate, weekly plan, rationale | Not AI. No plan history or undo. Needs more drills |
| 8 | Drills | IMPLEMENTED_UNVERIFIED | `drills.ts`, 10 drills, unit-aware | Content needs review by a qualified coach |
| 9 | Fitness / gym | IMPLEMENTED_UNVERIFIED | `Fitness.tsx`, `gym.ts`, `progression.ts` (double progression) | Exercise library is small; kg only; no muscle-group guidance yet |
| 10 | Club distances (manual) | IMPLEMENTED_UNVERIFIED | `ClubDistances.tsx`, `db/clubs.ts` | None known |
| 11 | Launch-monitor import (CSV, XLSX) | IMPLEMENTED_UNVERIFIED | `importer.ts`; scripted checks on four synthetic files and the owner's FlightScope workbook (mixed yards and metres) | Real file is not in the repo as a fixture; no automated tests; no dispersion or direction fields yet |
| 12 | Courses and tees | IMPLEMENTED_UNVERIFIED | `courses.ts` model and validation; Hencse National built in (lengths match published totals); add and edit form; tee and gender pick; automatic hole data in a round | Needs a device run; 9-hole and non-standard cases untested; no import of course files |
| 13 | Hungarian course data (MGSZ) | BLOCKED | Owner says permission was given | Written permission and attribution wording; then bulk import |
| 14 | Round on a rated course: handicap | IMPLEMENTED_UNVERIFIED | `courseHandicap` shown as an estimate | No handicap index tracking, no score differentials, no stableford |
| 15 | Putting and green dataset | NOT_STARTED | Requested by owner | First-putt distance, putt lengths, miss direction and distance, chip vs putt from off the green, pin position |
| 16 | Tee-shot miss data | NOT_STARTED | Requested | Distance and side off the fairway |
| 17 | GPS shot capture | NOT_STARTED | — | Needs a plan for permissions, battery, and a map or distance data source with licensing |
| 18 | Swing video | NOT_STARTED | — | Storage, playback, frame step, annotations; no automated swing claims without a validated method |
| 19 | Exercise library (MuscleWiki style) | NOT_STARTED | Requested | Own curated library: goal → quality → muscle group → exercise. Do not copy another site's content |
| 20 | Backup, export, restore | NOT_STARTED | — | JSON export and import; needed before real use |
| 21 | Accounts, sync, cloud | NOT_STARTED | — | Only if a real need appears; requires owner approval |
| 22 | Real AI coaching | NOT_STARTED | — | Only on validated structured data, with consent for any outside processing |
| 23 | Automated tests and CI | NOT_STARTED | Check scripts exist outside the repo | Move them into the repo and run them in CI |
| 24 | Privacy, GDPR, store release | NOT_STARTED | — | Policy, consent, deletion, export; trademark and store checks for the final name |

## 5. Data rules

- Distances in metres; speeds and other units get an explicit unit field when added.
- Original imports are kept; derived averages are computed apart. Mishit filtering shows what it removed.
- Every measurement should carry its source (typed, monitor file, GPS) and date.
- Missing is not zero.
- Strokes gained uses a baseline that is named and versioned. Until then it is labelled a placeholder.
- Ratings, stroke index and hole lengths of a course come from the club or federation; keep the source and date with the data.

## 6. Acceptance criteria for the next work

**Putting and green dataset (module 15).** Record per putt: start distance, result (holed, short, long, left, right), and miss size. Record chips and putts from off the green separately. Works with and without GPS. Shows averages by distance band and a first-putt distance trend. All distances in the chosen unit, stored in metres.

**Course import (module 13).** A CSV or Excel file maps to course, tee, rating, hole par, stroke index and lengths. Preview shows what will be saved and what failed `validateCourse`. Duplicate courses are detected. Source and permission text are saved with the data.

**Backup (module 20).** One file holds everything (profile, rounds, shots, clubs, courses, plans, logs). Import restores it on a fresh install without loss. Version number in the file; older versions are read.

**Tests (module 23).** Units, importer, strokes gained, course validation and the metres migration have tests that run in one command and in CI.

## 7. Open decisions

1. Final name, trademark, domain, store listing.
2. Written MGSZ permission and the exact credit line.
3. Strokes-gained baseline source and licence.
4. Hungarian review: who reads and corrects the text.
5. Course and GPS data source for countries beyond Hungary.
6. Whether to add accounts and cloud sync, and which provider.
7. Business model: personal tool, subscription, or coach edition.
8. Privacy basis and retention for video, location and health-related inputs.

## 8. Decisions already made

- One integrated app, not separate tools.
- Mobile and tablet only.
- Dark first with a light mode.
- Metric default; the player can switch to yards at any time.
- Data local first.
- Advice only from the player's own data; estimates and placeholders are labelled.
- Hencse National is included as the first built-in course.

## 9. Log

Newest first. Facts only.

```text
2026-11-23  Courses: model, validation, Hencse National, add/edit form, tee and gender pick, hole data in rounds. tsc and Android export passed; course totals checked by script; pushed and byte-compared with the repo. Not run on a device.
2026-11-23  Units: metres stored, m/yd toggle, importer and drills unit-aware, one-time migration tested on SQLite with sample rows. tsc, export and scripted checks passed. Pushed and byte-compared. Not run on a device.
earlier     Language setup (en/hu), launch-monitor import (CSV/XLSX), club distances, fitness log, V1 tracking, strokes gained (placeholder), rules-based coach and drills.
```

Template for new entries:

```text
Date:
Scope:
Files changed:
Delivered:
Checks run and results:
Device run:
Known limits:
Statuses changed:
Next:
```
