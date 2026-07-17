# Challenge-Only Learning Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-section application with a single 14-unit challenge flow containing wrong-answer review, book mastery questions, and verifiable Binance Futures ETH replay questions.

**Architecture:** Keep the existing private pack import, PDF reader, chart renderer, GitHub Pages deployment, and IndexedDB foundation. Introduce one content schema, one pure challenge-domain module, and one route-driven challenge session so all three steps use the same single-choice answer model and persistence API. Generate private book questions and ETH cases outside the public bundle, validate them before pack creation, and reset legacy progress through a database version upgrade.

**Tech Stack:** React 19, TypeScript, React Router, Dexie, Zod, Lightweight Charts, Vitest, Testing Library, Playwright, Node.js content scripts, Binance USD-M Futures archives.

---

### Task 1: Product contract and challenge content schema

**Files:**
- Create: `prd(new).md`
- Modify: `src/features/pack/contentSchema.ts`
- Modify: `src/features/pack/contentSchema.test.ts`
- Modify: `tests/e2e/fixture-pack.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests proving that a valid unit contains at least 20 `bookQuestions`, every question has one correct option plus per-option explanations and source pages, and every unit has at least 3 market cases with a fixed `correctDirection`, 24 hidden 1h candles, evidence, answer analysis, and source pages.

- [ ] **Step 2: Run the focused schema test**

Run: `pnpm test:run src/features/pack/contentSchema.test.ts`

Expected: FAIL because the version 2 fields and validation do not exist.

- [ ] **Step 3: Implement the version 2 schema**

Expose these stable types:

```ts
export type Direction = 'up' | 'down' | 'range'
export type ChoiceQuestion = {
  id: string
  prompt: string
  options: { id: string; label: string; explanation: string }[]
  correctOptionId: string
  source: SourceReference
  explanation: string
}
export type MarketCase = {
  id: string
  unitId: string
  correctDirection: Direction
  visibleCandles: Candle[]
  futureCandles: Candle[]
  candles4h: Candle[]
  evidence: string[]
  directionAnalysis: Record<Direction, string>
  source: SourceReference
}
```

The course schema must contain exactly 14 units in display order, at least 20 book questions per unit, and at least 3 associated market cases per unit.

- [ ] **Step 4: Update the E2E fixture pack to version 2**

Generate the repeated fixture questions and cases in code so the fixture remains readable while satisfying production validation.

- [ ] **Step 5: Run schema and pack tests**

Run: `pnpm test:run src/features/pack/contentSchema.test.ts src/features/pack/importPack.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- 'prd(new).md' src/features/pack/contentSchema.ts src/features/pack/contentSchema.test.ts tests/e2e/fixture-pack.ts
git commit -m "feat: define challenge content contract"
```

### Task 2: Wrong-answer scheduling and progress persistence

**Files:**
- Create: `src/domain/challenge.ts`
- Create: `src/domain/challenge.test.ts`
- Modify: `src/db/database.ts`
- Modify: `src/db/repositories.ts`
- Modify: `src/db/repositories.test.ts`
- Modify: `src/db/backup.ts`
- Modify: `src/db/backup.test.ts`

- [ ] **Step 1: Write failing domain tests**

Cover these pure behaviors:

```ts
addWrongItem(state, attempt)
recordReviewAnswer(item, correct, now)
selectReviewQuestions(items, now, random)
scoreBookQuiz(answers)
nextUnitProgress(progress, event)
```

Tests must prove that active errors keep their count after another error, correct scheduled reviews advance through `1,2,4,7,14,21,30,45,60` days, the tenth correct review retires an item, a failed spot check resets it to zero, and selection returns no more than five items with at most one retired spot check.

- [ ] **Step 2: Run the domain tests**

Run: `pnpm test:run src/domain/challenge.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal pure domain module**

Use serializable records with explicit `questionKind`, `unitId`, `correctReviewCount`, `lastWrongAt`, `nextReviewAt`, and `status`. Accept an injected random function so scheduling tests are deterministic.

- [ ] **Step 4: Write failing repository and backup tests**

Require database version 2 tables for `challengeProgress`, `challengeAttempts`, and `wrongItems`. Require version 2 backups to contain only challenge data and settings, and reject version 1 backups.

- [ ] **Step 5: Implement database migration and repository methods**

The version 2 migration deletes legacy attempts, mastery, trades, journals, and stored `ai` settings, while retaining packs and assets. Add methods to load/save challenge progress, attempts, and wrong items atomically.

- [ ] **Step 6: Run focused persistence tests**

Run: `pnpm test:run src/domain/challenge.test.ts src/db/repositories.test.ts src/db/backup.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/domain/challenge.ts src/domain/challenge.test.ts src/db/database.ts src/db/repositories.ts src/db/repositories.test.ts src/db/backup.ts src/db/backup.test.ts
git commit -m "feat: persist challenge mastery and wrong answers"
```

### Task 3: Single-choice cards and immediate feedback

**Files:**
- Create: `src/features/challenge/ChoiceQuestionCard.tsx`
- Create: `src/features/challenge/ChoiceQuestionCard.test.tsx`
- Create: `src/features/challenge/ReviewStep.tsx`
- Create: `src/features/challenge/BookQuizStep.tsx`
- Create: `src/features/challenge/BookQuizStep.test.tsx`
- Delete: `src/features/feedback/EvidenceFeedback.tsx`
- Delete: `src/features/feedback/explanationRubric.ts`
- Delete: their tests

- [ ] **Step 1: Write failing question-card tests**

Prove that only one option can be selected, submit is disabled before selection, submission freezes the answer, and feedback shows correct/incorrect, the standard answer, each option explanation, source chapter/page, and a `查看原书` command.

- [ ] **Step 2: Run the card tests**

Run: `pnpm test:run src/features/challenge/ChoiceQuestionCard.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the reusable card**

Use button-based radio semantics and a single primary submit command. Do not render text inputs, checkboxes, or evidence forms.

- [ ] **Step 4: Write failing review and book-quiz tests**

Prove review renders up to five items sequentially and book quiz passes at 8/10, retries below 8/10, records wrong answers, and never duplicates a question inside one attempt.

- [ ] **Step 5: Implement review and book quiz steps**

Keep selection state local to the current card and emit serializable answer events to the parent session.

- [ ] **Step 6: Run focused component tests**

Run: `pnpm test:run src/features/challenge`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/features/challenge src/features/feedback
git commit -m "feat: add single-choice mastery steps"
```

### Task 4: Simple ETH replay question card

**Files:**
- Create: `src/features/challenge/ReplayStep.tsx`
- Create: `src/features/challenge/ReplayStep.test.tsx`
- Modify: `src/features/replay/MarketChart.tsx`
- Delete: `src/features/replay/ReplayPage.tsx`
- Delete: `src/features/replay/ReplayPage.test.tsx`
- Delete: `src/features/replay/replayState.ts`
- Delete: `src/features/replay/replayState.test.ts`

- [ ] **Step 1: Write failing replay tests**

Prove the initial chart shows only visible candles, 4h and 1h tabs work, the only answers are `上涨`, `下跌`, and `震荡／方向不明`, future candles remain absent before submit, and submit immediately shows correctness, standard direction, complete analysis, source pages, exact Binance timestamps, and all 24 future candles.

- [ ] **Step 2: Run the replay tests**

Run: `pnpm test:run src/features/challenge/ReplayStep.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement replay as a standard answer card**

Render the existing chart without the previous background, structure, evidence, action, or invalidation fields. Emit a wrong-item event on error and require a different case before retry.

- [ ] **Step 4: Run replay and chart tests**

Run: `pnpm test:run src/features/challenge/ReplayStep.test.tsx src/features/replay`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/challenge src/features/replay
git commit -m "feat: simplify ETH replay to one choice"
```

### Task 5: Challenge map, session orchestration, and route cleanup

**Files:**
- Create: `src/features/challenge/ChallengeMapPage.tsx`
- Create: `src/features/challenge/ChallengeMapPage.test.tsx`
- Create: `src/features/challenge/ChallengeSessionPage.tsx`
- Create: `src/features/challenge/ChallengeSessionPage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/styles/app.css`
- Delete: `src/features/today`
- Delete: `src/features/simulation`
- Delete: `src/features/journal`
- Delete: `src/features/ai`
- Delete: `src/features/curriculum/ExercisePage.tsx`
- Delete: `src/features/curriculum/LessonPage.tsx`
- Delete: obsolete tests for deleted features

- [ ] **Step 1: Write failing map and session tests**

Prove the map contains 14 units, only the next unit is unlocked, completed units remain reopenable, the session resumes its saved step, and completion advances `review -> book-quiz -> market-replay -> completed`.

- [ ] **Step 2: Run challenge page tests**

Run: `pnpm test:run src/features/challenge/ChallengeMapPage.test.tsx src/features/challenge/ChallengeSessionPage.test.tsx`

Expected: FAIL because the pages do not exist.

- [ ] **Step 3: Implement the map and session orchestration**

Keep all persistence in the session container and all rendering in the three step components. Show a stable three-step progress indicator and one continuation action.

- [ ] **Step 4: Write failing application-shell tests**

Require `/` to open the challenge map after pack import, remove `/today`, `/training`, `/simulation`, and `/review`, keep only the brand, challenge content, and settings button, and remove all AI controls from settings.

- [ ] **Step 5: Implement route and shell cleanup**

Remove unused imports, states, routes, and navigation. Preserve onboarding, pack management, PDF reading, backup, restore, and settings.

- [ ] **Step 6: Replace CSS with challenge-only styles**

Retain tokens and shared command styles, then delete selectors used only by removed features. Validate mobile vertical layout, horizontal chart mode, and desktop constrained content widths.

- [ ] **Step 7: Run all component tests**

Run: `pnpm test:run`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src tests
git commit -m "feat: make challenge flow the whole application"
```

### Task 6: Private content generation and validation tools

**Files:**
- Create: `scripts/generate-challenge-content.mjs`
- Create: `scripts/generate-challenge-content.test.mjs`
- Modify: `scripts/fetch-market-cases.mjs`
- Modify: `scripts/fetch-market-cases.test.mjs`
- Modify: `scripts/build-private-pack.mjs`
- Modify: `scripts/build-private-pack.test.mjs`
- Delete: `scripts/generate-course.mjs`
- Delete: `scripts/generate-course.test.mjs`

- [ ] **Step 1: Write failing content-tool tests**

Test source packet construction, 20-question validation, unique IDs and prompts, source-page bounds, objective ETH direction classification, exclusion of ambiguous paths, 24-future-candle enforcement, unit-to-case mapping, and secret-free output.

- [ ] **Step 2: Run tool tests**

Run: `pnpm test:tools`

Expected: FAIL because the version 2 generator and validators do not exist.

- [ ] **Step 3: Implement the book-question generator**

Read `APIKEY.txt` only inside the local generation process. Send original-page packets to the configured OpenAI-compatible endpoint, request exactly 20 fixed single-choice questions per unit, validate every response with Zod, save per-unit checkpoints under ignored `private-content/challenge-drafts`, and never print or write the key.

- [ ] **Step 4: Implement the ETH case selector**

Download closed 1h and 4h Binance Futures archives, scan candidate cutoff points, classify only clear 24-hour up/down/range paths using the PRD thresholds, select three non-overlapping cases per unit, and generate fixed evidence-based explanations grounded in that unit's source packet.

- [ ] **Step 5: Update pack creation**

Build a version 2 `.wkf` containing `content/course.json`, `content/market-cases.json`, the original PDF, and core notes PDF. Validate the final content before compression.

- [ ] **Step 6: Run all tool tests**

Run: `pnpm test:tools`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add scripts
git commit -m "feat: generate audited challenge content"
```

### Task 7: Generate and audit the real private learning pack

**Files (ignored private output):**
- Generate: `private-content/original-pages.json`
- Generate: `private-content/course.json`
- Generate: `private-content/market-cases.json`
- Generate: `private-packs/weikefu-private-content.wkf`

- [ ] **Step 1: Extract PDF pages**

Run: `python scripts/extract-pdf-content.py`

Expected: indexed page JSON for the complete original book.

- [ ] **Step 2: Generate fixed book questions and case explanations**

Run: `node scripts/generate-challenge-content.mjs`

Expected: 14 units, at least 280 book questions, and checkpoint files that contain no credentials.

- [ ] **Step 3: Fetch and select ETH cases**

Run: `node scripts/fetch-market-cases.mjs`

Expected: at least 42 unique Binance Futures cases, each with 24 future 1h candles and source-grounded analysis.

- [ ] **Step 4: Build the private pack**

Run: `node scripts/build-private-pack.mjs`

Expected: a checksummed version 2 `.wkf` in `private-packs`.

- [ ] **Step 5: Audit the generated content**

Run the schema validator, duplicate prompt scan, source-page bounds scan, candle continuity check, future-leak check, and forbidden-secret scan. Any failure blocks deployment.

### Task 8: End-to-end behavior, visual verification, and cleanup

**Files:**
- Modify: `tests/e2e/helpers.ts`
- Modify: `tests/e2e/learning-flow.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/visual.spec.ts`
- Delete: `tests/e2e/simulation.spec.ts`
- Delete: obsolete source files identified by `rg` and the TypeScript build

- [ ] **Step 1: Write failing E2E tests**

Cover pack import to challenge map, a wrong book answer entering the wrong list, 8/10 book quiz progression, replay future hiding, immediate standard-answer feedback, next-unit unlock, refresh resume, settings backup/restore, and absence of removed navigation.

- [ ] **Step 2: Run E2E tests and implement fixture adjustments**

Run: `pnpm test:e2e`

Expected: PASS after fixture and selector updates.

- [ ] **Step 3: Test the real private pack**

Import the real `.wkf` in Playwright, open the first unit, answer each step, open the cited PDF page, switch 4h/1h charts, reveal the future, refresh, and confirm progress resumes.

- [ ] **Step 4: Perform responsive visual QA**

Capture phone portrait, phone landscape, and desktop screenshots. Confirm no overlap, no blank chart, no clipped Chinese labels, and stable controls in the target Huawei-browser-compatible layout.

- [ ] **Step 5: Apply Occam cleanup**

Use `rg` imports, `rg --files`, TypeScript build output, dependency usage, and route coverage to identify files that are no longer reachable. Delete only files proven obsolete, remove unused packages and scripts, keep private source PDFs and the final `.wkf`, and verify all deletion targets resolve inside the worktree or named private directories.

- [ ] **Step 6: Run full verification**

Run:

```powershell
pnpm lint
pnpm test:run
pnpm test:tools
pnpm test:e2e
pnpm build
```

Expected: all commands exit 0 with no failed tests.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "test: verify challenge-only application"
```

### Task 9: Integrate and deploy GitHub Pages

**Files:**
- Update only deployment metadata if the existing workflow requires it.

- [ ] **Step 1: Merge the verified feature branch into `main`**

Use a non-interactive fast-forward or merge commit while preserving the verified commits.

- [ ] **Step 2: Copy ignored private outputs into the main workspace**

Keep the generated private content and final `.wkf` outside Git tracking so the user can import it locally.

- [ ] **Step 3: Push and deploy**

Use the existing authenticated GitHub deployment path for `TZN-LJX/weikefu`. Never include private content, PDFs, pack files, drafts, or API credentials in Git objects.

- [ ] **Step 4: Verify production**

Open `https://tzn-ljx.github.io/weikefu/`, import the real pack, complete a first-unit flow, reload, and confirm the production app resumes correctly.

- [ ] **Step 5: Remove the temporary worktree**

After integration and production verification, remove only the resolved `.worktrees/challenge-only` path through `git worktree remove` and prune stale worktree metadata.
