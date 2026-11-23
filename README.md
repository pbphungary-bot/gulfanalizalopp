# Golf Coach

A mobile and tablet golf app built around one loop: **play → analyze → plan → practice → measure → adapt**.
Built with Expo / React Native (TypeScript). iOS, iPad and Android only; there is no desktop or web target.

## Run it

```bash
npm install
npm run ios      # or: npm run android
```

Use the Expo Go app on a phone or tablet, or a simulator.

Note: the app icon and splash images (`assets/`) are not in this commit because binary files could not be uploaded through the GitHub tool. Restore them from the initial Expo starter (`create-expo-app`) or add your own.

## What V1 does

- **Onboarding:** handicap, goal, available time and facilities.
- **Play:** fast shot-by-shot tracking. The start position carries over from the previous shot, so entry is club, finish lie, distance.
- **Round review:** score, strokes gained by category, approach performance by distance band.
- **My Coach:** a weekly plan built from where you lose strokes, with drills and gym sessions. Rebuilding it uses your latest rounds *and* your drill results.
- **Drills and gym:** drill logger with success rate and how it felt; gym templates for strength, power and mobility.
- **Offline first:** all data is stored on the device (SQLite). No account or connection needed on the course.

The plan logic is transparent and rule-based (`src/domain/coach.ts`), which makes it easy to test and explain.

## Layout

```
src/domain/   pure logic, no UI: strokes gained, coach/plan, drills, gym
src/db/       SQLite storage
src/screens/  one file per screen
```

## Known limitations (please read)

- **Strokes gained uses a placeholder baseline.** The expected-strokes table in `src/domain/strokesGained.ts` is a rough approximation so the pipeline works. Before showing comparisons against Tour, scratch or handicap benchmarks to users, replace it with a licensed or validated dataset. The UI labels this.
- Not built yet: swing video, launch monitor import, GPS shot capture, handicap-based benchmarks, cloud sync, coach sharing.
- Gym content is general guidance, not medical advice.

## Roadmap

1. **V1 (this):** profile, tracking, strokes gained, plans, drills, gym.
2. **V2:** swing video tools, launch monitor CSV import, GPS shots, adaptive plan refinements.
3. **V3:** AI swing and ball-flight analysis, caddie, coach collaboration, tournament prep.
A mobile-first golf performance app: golfer profile, shot-by-shot round recording,
and statistics built from your own data. Plain HTML, CSS and JavaScript with no build
step, so it runs from any static host (GitHub Pages) and can be added to a phone's
home screen.

- Plan, data model and milestones: [docs/PLAN.md](docs/PLAN.md)
- Data is stored on the device (`localStorage`, key `golfcoach.v1`). Use
  **My Game → Download backup** to keep a copy.
- Anything marked **DEMO · SAMPLE DATA** in the app is not yet computed from your data.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish on GitHub Pages

Settings → Pages → Build and deployment → Source: *Deploy from a branch*, Branch:
`main`, folder `/ (root)` → Save. The app is then at
`https://<owner>.github.io/<repo>/`.
