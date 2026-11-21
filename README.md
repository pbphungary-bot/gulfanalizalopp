# Golf Coach

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
