# Real Case Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifteenth case-training unit with 100 persistent, non-repeating real Binance cases split evenly between ETHUSDT and BTCUSDT.

**Architecture:** Extend the existing content and progress models with an explicit `case-training` mode rather than hard-coding a unit ID. Keep chart/replay behavior in `ReplayStep`, add a thin `CaseTrainingStep` orchestrator, and generate the 100 cases with a separate append-only historical-data script so the existing 42 ETH cases remain unchanged.

**Tech Stack:** React 19, TypeScript, Zod, Dexie, Vitest, Testing Library, Node test runner, JSZip, Binance monthly futures archives, Playwright.

---

### Task 1: Content schema for the fifteenth unit and dual symbols

**Files:**
- Modify: `src/features/pack/contentSchema.ts`
- Modify: `src/features/pack/contentSchema.test.ts`
- Modify: `tests/e2e/fixture-pack.ts`

- [ ] **Step 1: Add failing schema fixtures for a case-training unit**

Add a helper that appends this unit to the existing valid course:

```ts
const trainingUnit = {
  id: 'stage-8-real-case-training',
  mode: 'case-training',
  trainingCaseCount: 100,
  title: '真实案例集训',
  summary: '连续完成100个不重复真实案例。',
  source: { pdfPath: 'assets/original.pdf', chapter: '第一章 聪明钱的看盘顺序', pageStart: 17, pageEnd: 25 },
  excerpt: '只看技术指标无法得到真正的答案，我们这里介绍一下聪明钱的看图顺序：',
  excerptPage: 19,
  keyPoints: ['先看背景', '比较价量形态', '给出失效条件'],
  bookQuestions: [],
}
```

Generate 50 ETH and 50 BTC cases for the training unit and assert `validateChallengeContent` accepts 15 units and 142 cases.

- [ ] **Step 2: Add failing rejection tests**

Assert validation rejects:

```ts
expect(() => validateChallengeContent(course, with49Eth51Btc)).toThrow('必须包含 50 个 ETHUSDT 和 50 个 BTCUSDT')
expect(() => validateChallengeContent(course, duplicateSymbolCutoff)).toThrow('标的和截止时间必须唯一')
expect(() => validateChallengeContent(course, only99TrainingCases)).toThrow('必须包含 100 个真实案例')
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
pnpm vitest run src/features/pack/contentSchema.test.ts
```

Expected: failures because the schema still requires 14 units, ETH-only cases, and at least 20 questions for every unit.

- [ ] **Step 4: Implement the schema**

Add:

```ts
export const MarketSymbolSchema = z.enum(['ETHUSDT', 'BTCUSDT'])
export const ContentUnitModeSchema = z.enum(['standard', 'case-training'])
```

Change `ContentUnitSchema` to accept `mode` with default `standard`, optional `trainingCaseCount`, and a `bookQuestions` array whose constraints are enforced in `superRefine`:

```ts
if (unit.mode === 'case-training') {
  if (unit.trainingCaseCount !== 100) issue('trainingCaseCount', '真实案例集训必须声明 100 个案例')
  if (unit.bookQuestions.length !== 0) issue('bookQuestions', '真实案例集训不能包含原书测验')
} else if (unit.bookQuestions.length < 20) {
  issue('bookQuestions', '标准单元至少需要 20 道原书题')
}
```

Require exactly 15 units and require the final unit to be `case-training`. Change case symbols to `MarketSymbolSchema`, accept optional top-level `symbols`, enforce unique `symbol:cutoffTime`, require 3 cases for standard units, and require exactly 50 ETH plus 50 BTC for the training unit.

- [ ] **Step 5: Update the E2E fixture pack**

Append the training stage/unit and 100 deterministic training cases. Keep fixture candles small but valid; alternate symbols and distribute direction labels so schema validation passes.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
pnpm vitest run src/features/pack/contentSchema.test.ts
```

Expected: all content schema tests pass.

- [ ] **Step 7: Commit**

```powershell
git add src/features/pack/contentSchema.ts src/features/pack/contentSchema.test.ts tests/e2e/fixture-pack.ts
git commit -m "feat: support real case training content"
```

### Task 2: Persistent case-training progress and legacy migration

**Files:**
- Modify: `src/domain/challenge.ts`
- Modify: `src/domain/challenge.test.ts`
- Modify: `src/db/backup.ts`
- Modify: `src/db/backup.test.ts`

- [ ] **Step 1: Add failing progress tests**

Cover these APIs:

```ts
const initialized = ensureCaseTrainingProgress(progress, 'training', cases, () => 0, now)
expect(initialized.unitStates.training.training?.caseOrder).toHaveLength(100)

const advanced = advanceCaseTraining(initialized, 'training', { caseId, symbol: 'BTCUSDT', correct: false }, now)
expect(advanced.unitStates.training.training).toMatchObject({ nextIndex: 1, wrongCount: 1 })

const migrated = migrateChallengeProgress(old14UnitProgress, fifteenUnits, now)
expect(migrated.unitStates['stage-8-real-case-training'].step).toBe('case-training')
expect(migrated.mode).toBe('course')
```

Also assert 100 advances complete the unit, enter reinforcement mode, preserve one stable order, and never repeat an ID.

- [ ] **Step 2: Run domain tests and verify RED**

```powershell
pnpm vitest run src/domain/challenge.test.ts src/db/backup.test.ts
```

Expected: missing types/functions and backup schema rejection.

- [ ] **Step 3: Implement training progress types and pure functions**

Add:

```ts
export type CaseTrainingProgress = {
  caseOrder: string[]
  nextIndex: number
  correctCount: number
  wrongCount: number
  completedBySymbol: Record<MarketSymbol, number>
}

export type UnitProgressState = {
  step: ChallengeStep
  training?: CaseTrainingProgress
}
```

Add `case-training` to `ChallengeStep`. Implement:

```ts
export function migrateChallengeProgress(saved, units, now): ChallengeProgress
export function ensureCaseTrainingProgress(progress, unitId, caseIds, random, now): ChallengeProgress
export function advanceCaseTraining(progress, unitId, answer, now): ChallengeProgress
```

`ensureCaseTrainingProgress` must repair missing IDs by preserving the valid completed prefix and appending shuffled unseen IDs. `advanceCaseTraining` must verify the active ID matches the answer, update counts, and complete only at the end of the order.

- [ ] **Step 4: Extend backup validation**

Allow `case-training` steps and validate optional training state fields, counts, symbols, unique order IDs, and `nextIndex <= caseOrder.length`.

- [ ] **Step 5: Run tests and verify GREEN**

```powershell
pnpm vitest run src/domain/challenge.test.ts src/db/backup.test.ts
```

Expected: all progression and backup tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/challenge.ts src/domain/challenge.test.ts src/db/backup.ts src/db/backup.test.ts
git commit -m "feat: persist real case training progress"
```

### Task 3: Case-training interface and session routing

**Files:**
- Create: `src/features/challenge/CaseTrainingStep.tsx`
- Create: `src/features/challenge/CaseTrainingStep.test.tsx`
- Modify: `src/features/challenge/ReplayStep.tsx`
- Modify: `src/features/challenge/ReplayStep.test.tsx`
- Modify: `src/features/challenge/ChallengeSessionPage.tsx`
- Modify: `src/features/challenge/ChallengeSessionPage.test.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Add failing `ReplayStep` customization tests**

Add optional props:

```ts
continueLabel?: string
onContinue: (correct: boolean) => void
```

Assert a supplied label such as `下一案例（2/100）` is rendered after submission without changing standard-unit defaults.

- [ ] **Step 2: Add failing `CaseTrainingStep` tests**

Render progress at index 36 and assert:

```ts
expect(screen.getByText('真实案例集训 37/100')).toBeVisible()
expect(screen.getByText('正确 20')).toBeVisible()
expect(screen.getByText('错误 16')).toBeVisible()
expect(screen.getByText('ETH 18')).toBeVisible()
expect(screen.getByText('BTC 18')).toBeVisible()
```

After a wrong BTC answer and clicking continue, assert `onAdvance` receives the case ID, symbol, and `correct: false`.

- [ ] **Step 3: Add failing session tests**

Render a `case-training` unit whose progress step is `case-training`. Assert no “错题回顾” or “原书测验” text appears, the active saved-order case appears, and a wrong answer both calls the wrong-item handler and advances to the next case.

- [ ] **Step 4: Run focused tests and verify RED**

```powershell
pnpm vitest run src/features/challenge/ReplayStep.test.tsx src/features/challenge/CaseTrainingStep.test.tsx src/features/challenge/ChallengeSessionPage.test.tsx
```

Expected: missing component and unsupported unit mode.

- [ ] **Step 5: Implement `CaseTrainingStep` and routing**

`CaseTrainingStep` receives the active case, training progress, unit, and answer callbacks. It renders a compact progress strip and delegates the chart/question/feedback to `ReplayStep`.

In `ChallengeSessionPage`, branch before standard steps:

```tsx
if (unit.mode === 'case-training') {
  return <CaseTrainingStep ... />
}
```

Initialize/repair progress through `ensureCaseTrainingProgress`, persist via `onProgressChange`, and use `advanceCaseTraining` after the learner clicks continue. Wrong answers still call `saveWrong` before advancing.

- [ ] **Step 6: Add responsive styles**

Add `.training-progress`, `.training-counter-grid`, and mobile grid rules. Keep cards at the existing radius and ensure values do not resize the layout.

- [ ] **Step 7: Run tests and verify GREEN**

Run the focused command from Step 4. Expected: all component/session tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src/features/challenge/CaseTrainingStep.tsx src/features/challenge/CaseTrainingStep.test.tsx src/features/challenge/ReplayStep.tsx src/features/challenge/ReplayStep.test.tsx src/features/challenge/ChallengeSessionPage.tsx src/features/challenge/ChallengeSessionPage.test.tsx src/styles/app.css
git commit -m "feat: add persistent case training session"
```

### Task 4: App migration and challenge-map progress

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/challenge/ChallengeMapPage.tsx`
- Modify: `src/features/challenge/ChallengeMapPage.test.tsx`

- [ ] **Step 1: Add failing app migration tests**

Load a saved 14-unit progress snapshot with all units complete and mode `reinforcement`, then load a 15-unit pack. Assert the first 14 states remain completed, the training unit is unlocked at `case-training`, and mode becomes `course`. Add a second test where unit 10 is current and the training unit remains locked.

- [ ] **Step 2: Add failing map tests**

Assert 15 unit headings, dynamic header text, and a training card progress line:

```ts
expect(screen.getByText('15个知识单元 · 顺序解锁')).toBeVisible()
expect(screen.getByText('已完成 37/100')).toBeVisible()
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm vitest run src/app/App.test.tsx src/features/challenge/ChallengeMapPage.test.tsx
```

- [ ] **Step 4: Implement app migration and map display**

Replace exact `sameUnitOrder` reset logic with `migrateChallengeProgress(savedProgress, units, now)`. Pass training progress to `ChallengeMapPage`, derive the header count from `units.length`, and display `nextIndex/trainingCaseCount` on the training card.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: all app/map tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/App.tsx src/app/App.test.tsx src/features/challenge/ChallengeMapPage.tsx src/features/challenge/ChallengeMapPage.test.tsx
git commit -m "feat: migrate progress into case training"
```

### Task 5: Historical case-training generator

**Files:**
- Create: `scripts/generate-case-training.mjs`
- Create: `scripts/generate-case-training.test.mjs`
- Modify: `scripts/fetch-market-cases.mjs`
- Modify: `scripts/fetch-market-cases.test.mjs`

- [ ] **Step 1: Add failing pure selection tests**

Export and test:

```js
selectSpacedCandidates(candidates, {
  quotas: { up: 17, down: 17, range: 16 },
  blockedCutoffs,
  minimumSpacingSeconds: 7 * 86_400,
})
```

Assert 50 results, exact direction quotas, pairwise spacing, no blocked cutoff within seven days, and broad time distribution.

- [ ] **Step 2: Add failing append tests**

Given the current 14-unit course and 42 cases, call:

```js
appendCaseTrainingContent(course, marketCases, { ETHUSDT: ethCases, BTCUSDT: btcCases })
```

Assert the original 42 case objects are byte-for-byte unchanged, the new stage is last, and the final output has 142 cases.

- [ ] **Step 3: Run tool tests and verify RED**

```powershell
node --test scripts/generate-case-training.test.mjs scripts/fetch-market-cases.test.mjs
```

- [ ] **Step 4: Generalize archive loading helpers**

Change archive filenames and URLs from hard-coded ETH to a `symbol` argument. Export reusable `scanCandidates`, `takeEvenly`, and archive-loading functions without changing the existing 42-case generator behavior.

- [ ] **Step 5: Implement the append-only generator**

The script must:

1. Read `private-content/course.json` and `private-content/market-cases.json`.
2. Remove a previously generated training stage/cases before regeneration, while retaining the original 42 cases unchanged.
3. Load ETHUSDT and BTCUSDT 1h/4h archives from `2021-01-01` through `2026-07-01` using a symbol-specific cache.
4. Build daily candidates and select 17/17/16 per symbol with seven-day spacing.
5. Block ETH candidates within seven days of any original ETH cutoff.
6. Build visible-only fallback analyses, deterministic actual outcomes, IDs, titles, and source references.
7. Append the training stage and 100 cases.
8. Validate counts and write the two private JSON files.

- [ ] **Step 6: Run tool tests and verify GREEN**

Run the command from Step 3. Expected: all generator tests pass.

- [ ] **Step 7: Commit**

```powershell
git add scripts/generate-case-training.mjs scripts/generate-case-training.test.mjs scripts/fetch-market-cases.mjs scripts/fetch-market-cases.test.mjs
git commit -m "feat: generate spaced ETH and BTC training cases"
```

### Task 6: Generate and validate the real private pack

**Files:**
- Generate (ignored): `private-content/course.json`
- Generate (ignored): `private-content/market-cases.json`
- Generate (ignored): `private-packs/weikefu-private-content.wkf`

- [ ] **Step 1: Connect private data into the worktree**

Create directory junctions from the worktree's ignored `private-content` and `private-packs` paths to the main workspace's corresponding directories. Verify both resolved targets stay inside `E:\code\weikefu`.

- [ ] **Step 2: Run the generator**

```powershell
node scripts/generate-case-training.mjs
```

Expected: downloads/caches required Binance archives and reports 50 ETH plus 50 BTC appended without changing the original 42 IDs/cutoffs.

- [ ] **Step 3: Validate the generated JSON**

Run a read-only validation script that confirms:

```text
units=15
cases=142
training=100
ETHUSDT=50
BTCUSDT=50
raw learner fields=0
minimum same-symbol spacing>=604800 seconds
```

- [ ] **Step 4: Build the private pack**

```powershell
node scripts/build-private-pack.mjs
```

Expected: `private-packs/weikefu-private-content.wkf` is rebuilt with both PDFs and the expanded JSON content.

### Task 7: End-to-end training flow

**Files:**
- Modify: `tests/e2e/learning-flow.spec.ts`
- Modify: `tests/e2e/real-pack.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/visual.spec.ts`

- [ ] **Step 1: Add failing fixture flow test**

Complete the first 14 fixture units programmatically or seed progress, open the training unit, answer one BTC case incorrectly, continue, refresh, and assert the next saved case is restored. Confirm no review/book-quiz UI appears.

- [ ] **Step 2: Add failing real-pack assertions**

Read the real pack and assert 15 units, 142 cases, training counts 50/50, and no training cutoff violates seven-day spacing or overlaps an original ETH cutoff.

- [ ] **Step 3: Add responsive and visual coverage**

Capture the training screen at 412x915 and 1440x900 after submission. Assert chart canvas pixels are nonblank, counters fit, and there is no horizontal overflow.

- [ ] **Step 4: Run Playwright and verify RED/GREEN as implementation completes**

Use a reused preview server:

```powershell
$env:WEIKEFU_REUSE_SERVER='1'
$env:WEIKEFU_REAL_PACK='E:\code\weikefu\private-packs\weikefu-private-content.wkf'
node node_modules\@playwright\test\cli.js test
```

Expected final result: all configured desktop/mobile tests pass, with only the existing project-specific visual skip.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e
git commit -m "test: cover real case training flow"
```

### Task 8: Final verification and integration

**Files:**
- Verify all modified source, script, and test files.

- [ ] **Step 1: Run all automated checks**

```powershell
pnpm test:run
pnpm test:tools
pnpm lint
pnpm build
```

Expected: zero failures; the existing Vite large-chunk warning is non-blocking.

- [ ] **Step 2: Run full Playwright with the real pack**

Run the command from Task 7 Step 4. Expected: all non-skipped tests pass.

- [ ] **Step 3: Inspect generated screenshots**

Verify mobile and desktop training screenshots show the progress strip, BTC/ETH counters, A/B/C markers only after submission, readable SOP, and no overlap.

- [ ] **Step 4: Run repository checks**

```powershell
git diff --check
git status --short
```

- [ ] **Step 5: Request final code review**

Review the complete branch against `docs/superpowers/specs/2026-07-23-real-case-training-design.md`. Resolve all Critical and Important findings.

- [ ] **Step 6: Complete the branch**

Use `superpowers:finishing-a-development-branch`, merge the verified branch into `main`, rerun the full verification on `main`, and leave a preview server running for the user.
