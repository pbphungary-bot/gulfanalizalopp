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
| `rounds[]` | date, courseId, courseName, holes[{n, par, yards}], status (`in_progress` / `complete`) | player, course |
| `shots[]` | roundId, hole, seq, club, startLie, startDist, endLie, endDist, penalty | round |
| `practiceSessions[]` | date, category, minutes, drillResults[] | plan item (milestone 4) |
| `plans[]` | weekStart, focus, items[{day, kind, title, minutes, done}], basedOn{} | player, stats (milestone 4) |

Distances: yards off the green, feet on the green. Lies: `tee`, `fairway`, `rough`,
`sand`, `recovery`, `green`, `holed`. A shot's start is the previous shot's end, so
recording a shot is usually three taps: club, finish, distance.

Later modules plug into the same document: `launchSessions[]` (launch monitor imports,
linked to practice sessions), `swingVideos[]`, `workouts[]`.

## Milestones

1. **Profile and round recording (this PR).** Golfer profile and goal, start a round,
   record every shot, edit par and yards per hole, undo, finish a round, round history
   with hole-by-hole detail, JSON backup. Home and My Game show real stats from saved
   rounds (scoring average, putts, fairways, greens, penalties).
2. **Strokes gained.** Expected-strokes baseline by lie and distance, strokes gained per
   shot rolled up to tee / approach / around green / putting, approach by distance band.
3. **Practice logging.** Log sessions and drill results against a category.
4. **Adaptive weekly plan.** Build the week from the weakest strokes-gained category,
   available time and play day; mark items done; next week reweights from new rounds
   and drill results. The Home "Your next step" card becomes the centrepiece.

Deferred: GPS / course maps, launch monitor import, swing video, fitness, AI chat coach.
