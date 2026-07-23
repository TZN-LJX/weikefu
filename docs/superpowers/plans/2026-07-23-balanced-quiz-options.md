# Balanced Quiz Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove answer-position leakage from book quizzes, wrong-answer review, and ETH replay while preserving stable answers within an attempt.

**Architecture:** Add a pure quiz-attempt preparation module that selects questions, assigns balanced correct-answer positions, and shuffles distractors once when an attempt starts. Reuse the same option-ordering helper for review entries, strengthen content-generation validation against positional bias, and shuffle ETH cases once per session so the first replay is not always the stored `up` case.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Node test runner.

---

### Task 1: Balanced option ordering

**Files:**
- Create: `src/features/challenge/quizAttempt.ts`
- Create: `src/features/challenge/quizAttempt.test.ts`
- Modify: `src/features/challenge/BookQuizStep.tsx`

- [ ] Write tests proving ten three-option questions distribute correct answers across all positions with a maximum count difference of one.
- [ ] Write a test proving no correct position repeats more than twice consecutively.
- [ ] Write a test proving option identities, labels, explanations, and `correctOptionId` remain intact.
- [ ] Run `pnpm vitest run src/features/challenge/quizAttempt.test.ts` and confirm failure because the module does not exist.
- [ ] Implement `prepareQuizAttempt(questionPool, previousIds, random)` using Fisher-Yates shuffling, least-used valid position selection, and stable copied question objects.
- [ ] Update `BookQuizStep` to store the prepared questions once per attempt and prepare a new order on retry.
- [ ] Run the focused tests and `BookQuizStep.test.tsx` until green.

### Task 2: Wrong-answer review ordering

**Files:**
- Modify: `src/features/challenge/ReviewStep.tsx`
- Modify: `src/features/challenge/ReviewStep.test.tsx`

- [ ] Add a failing test that supplies a correct-first book question and asserts a controlled random source can move the correct answer away from first position.
- [ ] Add an optional `random` prop and prepare copied book entries once when the review starts.
- [ ] Pass the session random source from `ChallengeSessionPage` into `ReviewStep`.
- [ ] Run the focused review and session tests until green.

### Task 3: Content-generation safeguards

**Files:**
- Modify: `scripts/generate-challenge-content.mjs`
- Modify: `scripts/generate-challenge-content.test.mjs`

- [ ] Add a failing tool test showing `validateQuestionSet` rejects twenty questions whose correct option is always stored first.
- [ ] Add a passing fixture whose correct positions are balanced across the available positions.
- [ ] Extend validation to require every available position to be used and no position to exceed half of a twenty-question unit.
- [ ] Change the model output example so correct answers are not demonstrated as always `a`, and add an explicit balanced-position generation requirement.
- [ ] Run `pnpm test:tools` until green.

### Task 4: ETH replay case order

**Files:**
- Modify: `src/features/challenge/ChallengeSessionPage.tsx`
- Modify: `src/features/challenge/ChallengeSessionPage.test.tsx`

- [ ] Add a failing test with stored cases ordered `up`, `down`, `range` and a controlled random source that expects a non-first case to appear initially.
- [ ] Shuffle the eligible unit cases once per session and keep that order stable while retrying.
- [ ] Keep direction buttons in their stable semantic order; only case selection changes.
- [ ] Run the focused session tests until green.

### Task 5: Verification and integration

**Files:**
- Verify all modified files above.

- [ ] Run `pnpm test:run`.
- [ ] Run `pnpm test:tools`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Run the relevant Playwright learning-flow test.
- [ ] Review `git diff --check` and `git status --short`.
- [ ] Commit the isolated branch and merge it into the main workspace after all verification commands pass.

### Task 6: Replay presentation adapter

**Files:**
- Create: `src/features/challenge/replayPresentation.ts`
- Create: `src/features/challenge/replayPresentation.test.ts`

- [ ] Add failing tests for calculating recent 24-hour return, prior 24-hour return, volume ratio, and 120-hour range position from visible candles.
- [ ] Add failing tests that replace `recentReturn`, `priorReturn`, `rangePosition`, `volumeRatio`, and ten-digit Unix timestamps in legacy evidence with Chinese learner-facing text.
- [ ] Add failing tests that assign timestamp annotations chronological `A`, `B`, `C` labels and return chart marker metadata.
- [ ] Add failing tests for SOP grouping and separate actual-result versus cutoff-time judgment labels.
- [ ] Implement a pure presentation builder without modifying imported market-case data.

### Task 7: Layered replay feedback and book citation

**Files:**
- Modify: `src/features/challenge/ReplayStep.tsx`
- Modify: `src/features/challenge/ReplayStep.test.tsx`
- Modify: `src/features/challenge/ReviewStep.tsx`
- Modify: `src/features/challenge/ChallengeSessionPage.tsx`

- [ ] Add failing component tests proving auxiliary statistics and A/B labels are hidden before submission.
- [ ] Add failing component tests proving submitted feedback shows `实际结果标签`, `截止点前的合理判断`, the fixed SOP order, Chinese statistics, and the unit's exact excerpt with source pages.
- [ ] Pass the matching content unit into replay feedback, including market-case wrong-answer review.
- [ ] Render markers only for submitted one-hour charts and keep future results outside the cutoff-time evidence section.

### Task 8: Beijing chart time and OHLCV tooltip

**Files:**
- Modify: `src/features/replay/MarketChart.tsx`
- Create: `src/features/replay/chartTime.ts`
- Create: `src/features/replay/chartTime.test.ts`
- Modify: `src/styles/app.css`

- [ ] Add failing tests for `09-29`, `2023-09`, `HH:mm`, and full `YYYY-MM-DD HH:mm（北京时间）` formatting from UTC timestamps.
- [ ] Configure Lightweight Charts tick marks and crosshair labels with the Beijing formatters.
- [ ] Subscribe to crosshair movement and show a compact overlay containing time, open, high, low, close, and volume.
- [ ] Create series markers from submitted replay annotations and remove them with the chart lifecycle.

### Task 9: New-content quality gates

**Files:**
- Modify: `scripts/fetch-market-cases.mjs`
- Modify: `scripts/fetch-market-cases.test.mjs`

- [ ] Add failing tests that reject generated evidence containing raw metric field names or unconverted Unix timestamps.
- [ ] Update the analysis prompt to request learner-facing Chinese evidence, structured timestamp annotations, SOP reasoning, and exact source quotes with page numbers.
- [ ] Preserve compatibility with legacy packs through the runtime adapter while requiring clean output for newly generated content.
