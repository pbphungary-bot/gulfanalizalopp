# Golf Coach: data model and milestones

The goal is one app where every screen reads and writes the same player data, so the
coach can connect "you lost strokes on approach" to "you practised approach" to
"did it transfer to the course".

## Principles

- Keep the preview's look: dark navy, lime accent, rounded cards, mobile first.
- Runs as a plain web app (no build step). Opens from a link on a phone and can be
  added to the home screen.
- Every record is stored on the device (localStorage, one versioned document) and can
  be exported / imported as a JSON backup. A cloud sync can be added later without
  changing the model.
- Anything that is not computed from real data carries a visible **DEMO** tag.

## Data model (schema v1)

One document, `golfcoach.v1`:

| Entity | Key fields | Links |
| --- | --- | --- |
| `player` | name, handicap, targetHandicap, homeCourse, practiceMinutesPerWeek, preferredPlayDay, clubs[] | root |
| `goals[]` | kind (`handicap` / `custom`), title, target, byDate, status | player |
| `courses[]` | name, holes[{n, par, yards}] | used by rounds |
| `rounds[]` | date, courseId, courseName, holes[{n, par, yards}], status (`in_progress` / `complete`), source (`app` / `manual` / `csv` / app name), detail (`total` / `holes` / `shots`), competition flag | player, course |
| `shots[]` | roundId, hole, seq, club, startLie, startDist, endLie, endDist, penalty | round |
| `practiceSessions[]` | date, category, minutes, drillResults[] | plan item (milestone 4) |
| `plans[]` | weekStart, focus, items[{day, kind, title, minutes, done}], basedOn{} | player, stats (milestone 4) |

Distances: yards off the green, feet on the green. Lies: `tee`, `fairway`, `rough`,
`sand`, `recovery`, `green`, `holed`. A shot's start is the previous shot's end, so
recording a shot is usually three taps: club, finish, distance.

| `launchSessions[]` | date, source (`screenshot` / `csv`), device, imageCount, note | player (milestone 2) |
| `launchShots[]` | sessionId, group (e.g. red / yellow), club, carry, total, clubSpeed, ballSpeed, path, face, smash, launch, backspin, sidespin, apex, toTarget, flags[] | launch session |

Launch shot units are stored as shown on the monitor (metres, mph, degrees, rpm). Path,
face and sidespin are signed numbers: path + = in-to-out, face + = open, sidespin + = fade.

Later modules plug into the same document: `swingVideos[]`, `workouts[]`.

## Milestones

1. **Profile and round recording (this PR).** Golfer profile and goal, start a round,
   record every shot, edit par and yards per hole, undo, finish a round, round history
   with hole-by-hole detail, JSON backup. Home and My Game show real stats from saved
   rounds (scoring average, putts, fairways, greens, penalties).
2. **Import earlier golf history.** So a new user does not start from scratch.
   - Quick past-score entry: date, course, total score (or hole by hole), optional putts,
     competition yes/no. Fastest path for anything shown on screen, including a
     Golfigo handicap record or an old Golfshot / GameBook scorecard.
   - CSV import with column mapping (date, course, score, optional per-hole scores and
     putts), with a downloadable template. Covers spreadsheets and apps that do export.
   - Course data: par, length, course rating and slope entered once per course and reused.
   - **Read screenshots and photos** (scorecards from other apps, launch monitor shot
     history screens). Flow: pick one or more images → each is read by Claude vision into
     a fixed JSON shape → rows from all images are merged and overlapping duplicates
     dropped (same carry, total, speeds and spin) → a review table shows every row, with
     uncertain cells highlighted and a sanity check (smash ≈ ball speed / club speed) →
     the user picks the club per colour group, fixes or deletes rows, then saves. AVG rows
     are ignored and recomputed. Nothing is saved until the user confirms.
   - Vision needs an Anthropic API key. Phase 1: the user pastes their own key in
     Settings; it is stored only on that device and the images go straight from the phone
     to the API. Phase 2, if the app is shared: a small serverless proxy (for example a
     Cloudflare Worker) holds the key instead.
   - This brings launch monitor data forward from "deferred": per-club carry, dispersion,
     speeds and spin appear in My Game.
   - Imported rounds are marked with their source and level of detail, so stats only use
     what each round actually has (scoring trends use all rounds; putting, fairways and
     strokes gained use only rounds recorded shot by shot).
   - Source findings (Nov 2026): Golf GameBook states it has no export function or API.
     Golfshot documents no export, but its privacy policy offers data portability, so a
     user can request a copy of their data. Golfigo publishes competition datasheets
     publicly but no export or public API was found. No scraping of logged-in sites.
     Dedicated parsers are added when a real export file is in hand.
3. **Strokes gained.** Expected-strokes baseline by lie and distance, strokes gained per
   shot rolled up to tee / approach / around green / putting, approach by distance band.
4. **Practice logging.** Log sessions and drill results against a category.
5. **Adaptive weekly plan.** Build the week from the weakest strokes-gained category,
   available time and play day; mark items done; next week reweights from new rounds
   and drill results. The Home "Your next step" card becomes the centrepiece.

Deferred: GPS / course maps, direct launch monitor connections, swing video, fitness, AI chat coach.
