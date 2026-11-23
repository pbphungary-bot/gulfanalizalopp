# CLAUDE.md — Golf performance app

> How to work in this repository. Read this first, then `MANIFEST.md` (what the product must do and what is really done). `AGENTS.md` holds the Expo rules and commands and still applies; this file adds the project rules. If they disagree, ask.

## 1. What this is

A mobile and tablet app (iOS, iPad, Android) that connects **play, analysis, practice, fitness and club data** for one golfer. Core loop: **PLAY → ANALYZE → PLAN → PRACTICE → MEASURE → ADAPT**. Tagline: **YOUR GAME. DECODED.**

- **Name is not final.** The app is still called "Golf Coach" in `app.json`. "GolfAxis" is the favourite but trademark, domain and store checks are not done. Do not hardcode a new name until the owner approves it. "GolfOS" is taken.
- **Markets:** Hungary first, then Slovakia and Austria. Metric by default. UI in Hungarian and English.
- **Mobile and tablet only.** No desktop or web target.

## 2. Stack (verified in the repo)

Expo SDK 58, React Native 0.88, TypeScript strict. React Navigation (bottom tabs plus native stack, not Expo Router; the Expo Router line in `AGENTS.md` does not apply here). `expo-sqlite` for all data, offline first. `expo-document-picker`, `expo-file-system`, `fflate` for CSV and XLSX import. `expo-localization` for language and units.

Layout: `src/domain` pure logic (no React), `src/db` SQLite access, `src/i18n` text, `src/screens`, `src/components`. Keep logic out of screens.

Before using any Expo or React Native API, check the docs for SDK 58 as `AGENTS.md` says. Do not trust memory.

## 3. Rules that must not be broken

**Distances.** Stored in **metres** everywhere (feet on the green are also stored as metres). Convert only for display and input, through `src/domain/units.ts` and the helpers in `useI18n()` (`len`, `short`, `parseLen`, `parseShort`). Never store yards. Never add a literal `yd`, `ft` or `m` to a translated string; use the `{m}` and `{unit}` parameters.

**Migrations.** Changing stored data needs a one-time, transactional migration with a kv flag, like `migrateToMetres` in `src/db/index.ts`. Never delete or rewrite user data silently. Old saved plans hold plain text, so keep reading them.

**Text.** Every visible string is a key in `src/i18n/en.ts` or `src/i18n/courses.ts`. English is the source. Hungarian must have the same keys (the types enforce it). Decimal comma in Hungarian. Stored coach messages are language-neutral `Msg` objects, translated when shown; never store translated text.

**Honest analytics.**
- The strokes-gained baseline in `src/domain/strokesGained.ts` is a **placeholder**. The review screen says so. Do not remove that notice or present the numbers as official until the baseline is replaced with licensed or validated data.
- The coach is rules based and uses only the player's own data. Do not call it AI-generated analysis, and do not invent a recommendation without data behind it.
- Handicap figures are **estimates**. The official index comes from the federation.
- Imports keep original values; mishit filtering is visible and reversible. Never read missing values as zero.

**Course data.** Courses live in `src/domain/courses.ts` (built in) and the `courses` table (user added). Validate with `validateCourse` before saving. Built-in courses refresh on every start. Hencse National is included with the owner's go-ahead. For Hungarian federation (MGSZ) data, the owner says permission was given; get it in writing, keep the attribution wording with the data, and note the source in `MANIFEST.md`.

**Safety.** Gym text is general guidance, not medical advice. Never prescribe through pain. Keep the safety line on gym screens.

**Privacy.** Data stays on the device. Do not add network calls, analytics, cloud AI or accounts without owner approval. Never commit secrets. Do not put the owner's personal details in code, commits or requests to outside services.

## 4. Working method

1. Read this file and `MANIFEST.md`. Check the repo state.
2. Do clear, reversible work without asking. Ask only for product direction that is genuinely open, anything that costs money, or anything destructive or public.
3. Build the whole slice: logic, storage, screen, text in both languages.
4. Run **before saying done**: `npx tsc --noEmit`, `npx expo lint`, an export bundle (`npx expo export --platform android --output-dir <tmp>`), and the logic checks that apply. Report exactly what was and was not run.
5. Update `MANIFEST.md` with evidence only. Do not mark anything `VERIFIED` without a test or a confirmed run on a device.
6. End with: delivered, verified, not verified, next.

Never claim a feature works because it compiles. Never claim device or phone testing that was not done.

## 5. Delivery in this environment

There is no git remote here, so changes reach GitHub through the GitHub MCP `push_files` tool on branch `claude/dreamy-allen-elqlqt`. Do not push elsewhere, do not open a pull request unless asked.

- Keep each push under about 30 KB of file content. Use `\u` escapes for non-ASCII text in the payload.
- **Always verify after pushing:** compare every changed file with the remote copy using `gh api -H "Accept: application/vnd.github.raw" repos/<owner>/<repo>/contents/<path>?ref=<branch>` and `cmp`. Typing long files by hand has already produced wrong Hungarian words; the comparison caught them.
- The owner runs the app on Windows: download the branch ZIP, copy `assets` from a fresh `create-expo-app`, `npm install`, `npx expo start --clear`. Binary assets cannot be pushed through MCP.

## 6. Design

Dark first (navy and slate with lime or emerald accent) plus a light mode for use in sun. Large touch targets, readable on a course in daylight, one clear next action per screen. Every button must do something; no placeholder charts. Include empty, error and offline states. Keep the five tabs: Home, Coach, Play, Fitness, My Game; add features inside them before adding tabs.

## 7. Not built yet (do not imply otherwise)

Swing video, GPS and maps, accounts and sync, cloud backup, real AI coaching, Hungarian course catalogue, putting and green-miss recording, tests in the repository. See `MANIFEST.md`.
