# 威科夫 ETH 学习系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并部署一个可在华为 Mate 80 浏览器中使用的 GitHub Pages 静态学习应用，支持本地私有学习包、威科夫课程、ETH 历史回放、证据反馈、模拟交易、交易日志和可选 AI 教练。

**Architecture:** 使用 React + TypeScript + Vite 构建 Hash Router 单页应用，公开构建只包含应用外壳。完整书本资料和私有课程封装为 `.wkf` ZIP 容器，经浏览器本地校验后写入 IndexedDB。确定性学习、风险和复习规则位于无 UI 依赖的 domain 模块；AI 通过用户配置的 OpenAI-compatible endpoint 直接调用。

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Playwright, Dexie, JSZip, pdfjs-dist, lightweight-charts, lucide-react, GitHub Actions, GitHub Pages.

---

## File Structure

```text
src/
  app/
    App.tsx                    # 应用入口和顶层状态
    routes.tsx                 # Hash Router 路由
    navigation.ts             # 主导航定义
  components/
    AppShell.tsx               # 移动底栏和桌面侧栏
    EmptyState.tsx             # 统一空状态
    ErrorNotice.tsx            # 统一错误提示
    ProgressBar.tsx            # 固定尺寸进度条
  db/
    database.ts                # Dexie 数据库与表结构
    migrations.ts              # 数据版本升级
    repositories.ts            # 本地读写接口
    backup.ts                  # 进度导入导出
  domain/
    types.ts                   # 核心实体类型
    risk.ts                    # 仓位和 R 倍数
    mastery.ts                 # 掌握度和解锁
    scheduling.ts              # 间隔复习
    scoring.ts                 # 证据评分
    today.ts                   # 今日任务编排
  features/
    onboarding/
      OnboardingPage.tsx       # 无学习包时的导入页
    settings/
      SettingsPage.tsx         # AI、学习包和备份设置
    pack/
      packSchema.ts            # manifest schema
      importPack.ts            # 本地导入与校验
      packStorage.ts            # 包资源存取
    today/
      TodayPage.tsx            # 今日任务首页
    curriculum/
      CurriculumPage.tsx       # 七阶段闯关地图
      LessonPage.tsx           # 短讲解和原文引用
      ExercisePage.tsx         # 选择题和费曼解释
    replay/
      ReplayPage.tsx           # 分步 ETH 回放
      MarketChart.tsx          # lightweight-charts 封装
      replayState.ts           # 未来数据遮蔽状态
    feedback/
      EvidenceFeedback.tsx     # 证据阶梯反馈
      explanationRubric.ts     # 五段式解释检查
    ai/
      aiClient.ts              # compatible API client
      aiPrompts.ts             # 结构化提示
    simulation/
      SimulationPage.tsx       # 风险检查和模拟订单
    journal/
      JournalPage.tsx          # 日志列表
      JournalForm.tsx          # 分步日志表单
    pdf/
      PdfReader.tsx            # pdfjs 页面阅读器
  styles/
    tokens.css                 # 色彩、尺寸、字级
    app.css                    # 响应式布局
  test/
    setup.ts                   # 测试环境
  main.tsx
scripts/
  build-private-pack.mjs       # 本地 .wkf 构建器
  extract-pdf-content.py       # PDF 文本和章节提取
  generate-course.mjs          # 调用本地 AI 配置生成课程草稿
  fetch-market-cases.mjs       # 获取并整理 ETHUSDT K 线
private-content/               # Git ignored，本地课程和资料
private-packs/                 # Git ignored，生成的 .wkf
tests/
  e2e/
    onboarding.spec.ts
    learning-flow.spec.ts
    simulation.spec.ts
    responsive.spec.ts
public/
  manifest.webmanifest
  robots.txt
  icons/
.github/workflows/deploy.yml
vite.config.ts
vitest.config.ts
playwright.config.ts
package.json
```

### Task 1: Repository, Vite, and Test Harness

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/main.tsx`
- Create: `index.html`

- [ ] **Step 1: Initialize Git and protect private files**

Use `.gitignore` containing:

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.vite/
.worktrees/
.superpowers/
private-content/
private-packs/
*.wkf
*.pdf
.env
.env.*
!.env.example
APIKEY.txt
```

Run:

```powershell
git init -b main
git remote add origin https://github.com/TZN-LJX/weikefu.git
git add .gitignore prd.md docs
git commit -m "docs: add product requirements and implementation plan"
```

- [ ] **Step 2: Create isolated worktree**

Run:

```powershell
git worktree add .worktrees/implementation -b feature/implementation
```

Expected: `.worktrees/implementation` is on `feature/implementation` and `.worktrees` is ignored.

- [ ] **Step 3: Scaffold React TypeScript app**

Run in the worktree:

```powershell
pnpm create vite . --template react-ts
pnpm add react-router-dom dexie jszip pdfjs-dist lightweight-charts lucide-react zod
pnpm add -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright @playwright/test
```

- [ ] **Step 4: Configure GitHub Pages base and tests**

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/weikefu/',
  plugins: [react()],
  build: { sourcemap: true },
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
```

- [ ] **Step 5: Verify baseline**

Run:

```powershell
pnpm test -- --run
pnpm build
```

Expected: baseline tests and build pass.

- [ ] **Step 6: Commit**

```powershell
git add .
git commit -m "chore: scaffold React application and test harness"
```

### Task 2: Domain Types and Risk Engine

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/risk.test.ts`
- Create: `src/domain/risk.ts`

- [ ] **Step 1: Write failing risk tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateTradePlan } from './risk';

describe('calculateTradePlan', () => {
  it('caps a long position by one percent account risk', () => {
    const result = calculateTradePlan({
      equity: 1000,
      availableEquity: 1000,
      leverage: 10,
      side: 'long',
      entry: 3000,
      stop: 2970,
      target: 3090,
    });
    expect(result.riskAmount).toBe(10);
    expect(result.stopDistanceRatio).toBeCloseTo(0.01);
    expect(result.maxNotional).toBeCloseTo(1000);
    expect(result.plannedR).toBe(3);
  });

  it('rejects an invalid long stop', () => {
    expect(() => calculateTradePlan({
      equity: 1000, availableEquity: 1000, leverage: 5,
      side: 'long', entry: 3000, stop: 3010, target: 3060,
    })).toThrow('做多止损必须低于入场价');
  });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm vitest run src/domain/risk.test.ts`

Expected: FAIL because `risk.ts` does not exist.

- [ ] **Step 3: Implement the risk engine**

```ts
export type TradePlanInput = {
  equity: number;
  availableEquity: number;
  leverage: number;
  side: 'long' | 'short';
  entry: number;
  stop: number;
  target: number;
};

export function calculateTradePlan(input: TradePlanInput) {
  if (input.side === 'long' && input.stop >= input.entry) {
    throw new Error('做多止损必须低于入场价');
  }
  if (input.side === 'short' && input.stop <= input.entry) {
    throw new Error('做空止损必须高于入场价');
  }
  const riskAmount = input.equity * 0.01;
  const stopDistanceRatio = Math.abs(input.entry - input.stop) / input.entry;
  const riskCappedNotional = riskAmount / stopDistanceRatio;
  const marginCappedNotional = input.availableEquity * input.leverage;
  return {
    riskAmount,
    stopDistanceRatio,
    maxNotional: Math.min(riskCappedNotional, marginCappedNotional),
    plannedR: Math.abs(input.target - input.entry) / Math.abs(input.entry - input.stop),
  };
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `pnpm vitest run src/domain/risk.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/domain
git commit -m "feat: add deterministic trade risk calculations"
```

### Task 3: Mastery, Scheduling, and Today Queue

**Files:**
- Create: `src/domain/mastery.test.ts`
- Create: `src/domain/mastery.ts`
- Create: `src/domain/scheduling.test.ts`
- Create: `src/domain/scheduling.ts`
- Create: `src/domain/today.test.ts`
- Create: `src/domain/today.ts`

- [ ] **Step 1: Write failing mastery and scheduling tests**

Test these behaviors:

```ts
expect(canUnlock({ accuracy: 0.9, explanationComplete: true })).toBe(true);
expect(canUnlock({ accuracy: 0.89, explanationComplete: true })).toBe(false);
expect(nextReviewDate(new Date('2026-07-16'), 0).toISOString()).toContain('2026-07-17');
expect(nextReviewDate(new Date('2026-07-16'), 3).toISOString()).toContain('2026-07-30');
```

Today queue test:

```ts
expect(buildTodayQueue({ dueReviews, newLessons, replayCases, minutes: 20 }))
  .toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'review' }),
    expect.objectContaining({ kind: 'lesson' }),
    expect.objectContaining({ kind: 'replay' }),
  ]));
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm vitest run src/domain/mastery.test.ts src/domain/scheduling.test.ts src/domain/today.test.ts`

- [ ] **Step 3: Implement deterministic rules**

Use intervals `[1, 3, 7, 14, 30]` days. `buildTodayQueue` must prioritize due reviews, then one lesson, then one replay, and stop before the minute budget is exceeded.

- [ ] **Step 4: Run tests and confirm GREEN**

Run the same Vitest command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/domain
git commit -m "feat: add mastery and adaptive study scheduling"
```

### Task 4: Database and Progress Backup

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/repositories.ts`
- Create: `src/db/backup.test.ts`
- Create: `src/db/backup.ts`
- Create: `src/db/migrations.ts`

- [ ] **Step 1: Write failing backup tests**

```ts
it('excludes AI credentials and private pack assets from progress backup', async () => {
  const result = await createBackup(fakeSnapshot);
  expect(result.settings.aiKey).toBeUndefined();
  expect(result).not.toHaveProperty('contentAssets');
});

it('rejects a backup with an unsupported schema version', () => {
  expect(() => validateBackup({ schemaVersion: 999 })).toThrow('不支持的备份版本');
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm vitest run src/db/backup.test.ts`

- [ ] **Step 3: Implement Dexie schema and backup**

Database tables:

```ts
this.version(1).stores({
  packs: 'id, version, importedAt, active',
  assets: '[packId+path], packId, kind',
  contentUnits: 'id, packId, stageId, order',
  exercises: 'id, contentUnitId',
  marketCases: 'id, packId, stageId',
  attempts: '++id, exerciseId, createdAt',
  mastery: 'contentUnitId, stageId, nextReviewAt',
  trades: 'id, caseId, openedAt, status',
  journals: 'id, tradeId, createdAt',
  settings: 'key',
});
```

Backup includes attempts, mastery, trades, journals, and non-secret settings only.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `pnpm vitest run src/db/backup.test.ts`

- [ ] **Step 5: Commit**

```powershell
git add src/db
git commit -m "feat: add local persistence and safe progress backup"
```

### Task 5: Private Learning Pack Schema and Importer

**Files:**
- Create: `src/features/pack/packSchema.ts`
- Create: `src/features/pack/importPack.test.ts`
- Create: `src/features/pack/importPack.ts`
- Create: `src/features/pack/packStorage.ts`

- [ ] **Step 1: Write failing importer tests**

Tests must prove:

```ts
await expect(importPack(corruptFile, deps)).rejects.toThrow('学习包校验失败');
await expect(importPack(tooNewFile, deps)).rejects.toThrow('需要更新应用');
await expect(importPack(validFile, deps)).resolves.toMatchObject({ id: 'wyckoff-core', active: true });
expect(deps.upload).not.toHaveBeenCalled();
```

Also test insufficient storage and interrupted import cleanup.

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm vitest run src/features/pack/importPack.test.ts`

- [ ] **Step 3: Define manifest schema**

```ts
export const PackManifestSchema = z.object({
  format: z.literal('weikefu-pack'),
  formatVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.string().min(1),
  minAppVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  sourceFingerprints: z.array(z.object({ name: z.string(), sha256: z.string() })),
  files: z.array(z.object({ path: z.string(), sha256: z.string(), kind: z.string() })),
});
```

- [ ] **Step 4: Implement local import**

Use JSZip to read the file, Web Crypto SHA-256 to verify entries, `navigator.storage.estimate()` to check available space, and Dexie transactions to prevent half imports. Do not call `fetch` in the importer.

- [ ] **Step 5: Run tests and confirm GREEN**

Run: `pnpm vitest run src/features/pack/importPack.test.ts`

- [ ] **Step 6: Commit**

```powershell
git add src/features/pack
git commit -m "feat: import private learning packs locally"
```

### Task 6: App Shell, Onboarding, Settings, and Responsive Navigation

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/features/onboarding/OnboardingPage.test.tsx`
- Create: `src/features/onboarding/OnboardingPage.tsx`
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`

- [ ] **Step 1: Write failing onboarding test**

```tsx
render(<OnboardingPage hasPack={false} onImport={onImport} />);
expect(screen.getByRole('heading', { name: '导入私人学习包' })).toBeVisible();
expect(screen.queryByText('今日任务')).not.toBeInTheDocument();
await userEvent.upload(screen.getByLabelText('选择 .wkf 文件'), file);
expect(onImport).toHaveBeenCalledWith(file);
```

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm vitest run src/features/onboarding/OnboardingPage.test.tsx`

- [ ] **Step 3: Implement shell and onboarding**

Use `HashRouter`. Mobile bottom navigation contains Today, Map, Training, Review; desktop uses a 224px sidebar. Without an active pack, only onboarding, settings, import, and help routes are available.

- [ ] **Step 4: Implement settings**

Settings fields: endpoint, model, API key, test connection, remember key toggle, active pack, replace/delete pack, export/import progress. The key input uses `type="password"` and is never included in export.

- [ ] **Step 5: Run component tests and build**

Run:

```powershell
pnpm vitest run src/features/onboarding/OnboardingPage.test.tsx
pnpm build
```

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat: add responsive shell and secure onboarding"
```

### Task 7: Curriculum, Today Page, Lessons, and Exercises

**Files:**
- Create: `src/features/today/TodayPage.test.tsx`
- Create: `src/features/today/TodayPage.tsx`
- Create: `src/features/curriculum/CurriculumPage.tsx`
- Create: `src/features/curriculum/LessonPage.tsx`
- Create: `src/features/curriculum/ExercisePage.test.tsx`
- Create: `src/features/curriculum/ExercisePage.tsx`

- [ ] **Step 1: Write failing Today page test**

Assert the page shows stage progress, estimated minutes, review task, lesson task, replay task, and a single “开始今日训练” command.

- [ ] **Step 2: Write failing exercise test**

Assert that an incorrect answer does not reveal the final answer immediately and instead opens evidence feedback.

- [ ] **Step 3: Run tests and confirm RED**

Run: `pnpm vitest run src/features/today/TodayPage.test.tsx src/features/curriculum/ExercisePage.test.tsx`

- [ ] **Step 4: Implement the learning pages**

Curriculum displays seven unframed stage bands. LessonPage renders summary, source chapter/page, private excerpt, and an “打开原书页面” action. ExercisePage supports multiple choice, evidence selection, and five-field Feynman explanation.

- [ ] **Step 5: Run tests and confirm GREEN**

Run the same Vitest command.

- [ ] **Step 6: Commit**

```powershell
git add src/features/today src/features/curriculum
git commit -m "feat: add adaptive curriculum learning flow"
```

### Task 8: PDF Reader and ETH Chart Replay

**Files:**
- Create: `src/features/pdf/PdfReader.tsx`
- Create: `src/features/replay/replayState.test.ts`
- Create: `src/features/replay/replayState.ts`
- Create: `src/features/replay/MarketChart.tsx`
- Create: `src/features/replay/ReplayPage.test.tsx`
- Create: `src/features/replay/ReplayPage.tsx`

- [ ] **Step 1: Write failing replay state tests**

```ts
const session = createReplaySession(candles, 100);
expect(session.visibleCandles).toHaveLength(100);
expect(session.futureCandles).toHaveLength(candles.length - 100);
expect(revealNext(session, 5).visibleCandles).toHaveLength(105);
```

Test that serialization never includes future candles before submission.

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm vitest run src/features/replay/replayState.test.ts`

- [ ] **Step 3: Implement PDF reader**

Load the PDF Blob from IndexedDB, configure the pdfjs worker using a bundled worker URL, render one page at a time to canvas, and provide previous/next page plus numeric page input. Revoke object URLs on unmount.

- [ ] **Step 4: Implement chart and replay workflow**

Use lightweight-charts candlestick and histogram series. The portrait workflow asks: 4h background, 1h phase, supply/demand evidence, Wyckoff event, trade/no-trade, plan, invalidation. A full-screen landscape control is available for chart marking.

- [ ] **Step 5: Run tests and confirm GREEN**

Run:

```powershell
pnpm vitest run src/features/replay
pnpm build
```

- [ ] **Step 6: Commit**

```powershell
git add src/features/pdf src/features/replay
git commit -m "feat: add private PDF reader and hidden chart replay"
```

### Task 9: Evidence Feedback and AI Coach

**Files:**
- Create: `src/features/feedback/explanationRubric.test.ts`
- Create: `src/features/feedback/explanationRubric.ts`
- Create: `src/features/feedback/EvidenceFeedback.tsx`
- Create: `src/features/ai/aiClient.test.ts`
- Create: `src/features/ai/aiClient.ts`
- Create: `src/features/ai/aiPrompts.ts`

- [ ] **Step 1: Write failing rubric tests**

The explanation passes only when observation, meaning, expectation, action, and invalidation are all non-empty and selected evidence does not directly contradict the conclusion.

- [ ] **Step 2: Write failing AI client tests**

Use dependency-injected fetch to prove the request includes endpoint/model/current question/current evidence but excludes full PDF bytes, pack manifest assets, and stored key from logs.

- [ ] **Step 3: Run tests and confirm RED**

Run: `pnpm vitest run src/features/feedback src/features/ai`

- [ ] **Step 4: Implement feedback and client**

The AI request uses `/chat/completions`, bearer authorization, structured JSON response instructions, a 30 second timeout, and explicit error categories for CORS, authentication, rate limit, and provider errors. Rule feedback remains available on failure.

- [ ] **Step 5: Run tests and confirm GREEN**

Run the same Vitest command.

- [ ] **Step 6: Commit**

```powershell
git add src/features/feedback src/features/ai
git commit -m "feat: add evidence feedback and optional AI coach"
```

### Task 10: Simulation and Journal

**Files:**
- Create: `src/features/simulation/SimulationPage.test.tsx`
- Create: `src/features/simulation/SimulationPage.tsx`
- Create: `src/features/journal/JournalForm.test.tsx`
- Create: `src/features/journal/JournalForm.tsx`
- Create: `src/features/journal/JournalPage.tsx`

- [ ] **Step 1: Write failing simulation tests**

Test that missing 4h background, missing invalidation, invalid stop direction, or calculated risk above 1% blocks submission and names the failed check. Test that a valid plan creates one trade only.

- [ ] **Step 2: Write failing journal tests**

Test required fields for background, phase, evidence, plan, emotion, rule violation, result R, and review category. Include “合格决策但结果亏损” as a valid category.

- [ ] **Step 3: Run tests and confirm RED**

Run: `pnpm vitest run src/features/simulation src/features/journal`

- [ ] **Step 4: Implement simulation and journal UI**

Use a stepper rather than one long form. The simulator starts at 1,000 USDT, supports long/short, leverage input, deterministic position sizing, historical replay settlement, and journal creation after close.

- [ ] **Step 5: Run tests and confirm GREEN**

Run the same Vitest command.

- [ ] **Step 6: Commit**

```powershell
git add src/features/simulation src/features/journal
git commit -m "feat: add risk-gated simulation and trade journal"
```

### Task 11: Local Private Pack Builder and Content Generation

**Files:**
- Create: `scripts/build-private-pack.mjs`
- Create: `scripts/extract-pdf-content.py`
- Create: `scripts/generate-course.mjs`
- Create: `scripts/fetch-market-cases.mjs`
- Create: `scripts/build-private-pack.test.mjs`
- Create local ignored: `private-content/course.json`
- Create local ignored: `private-content/market-cases.json`
- Create local ignored: `private-packs/weikefu-private-content.wkf`

- [ ] **Step 1: Write failing pack builder test**

Create tiny fixture files and assert the output ZIP includes `manifest.json`, `content/course.json`, `content/market-cases.json`, `assets/original.pdf`, and valid SHA-256 hashes.

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test scripts/build-private-pack.test.mjs`

- [ ] **Step 3: Implement PDF extraction**

Use bundled Python and pypdf to emit one JSON record per page with page number and extracted text. Do not write extracted content outside `private-content/`.

- [ ] **Step 4: Generate course content with the authorized AI endpoint**

Read `C:\Users\Administrator\Desktop\APIKEY.txt` only at runtime. Chunk source text by chapter. Require JSON containing stages, units, source pages, summary, evidence rules, choices, explanation prompt, acceptable conclusions, and failure reasons. Validate generated JSON before saving. Never print the key or source excerpts to logs.

- [ ] **Step 5: Fetch ETHUSDT market cases**

Use Binance public futures klines for 4h and 1h. Produce curated windows with visible and hidden segments, then add manual evidence labels for typical, ambiguous, failed, and no-trade cases.

- [ ] **Step 6: Build the real private pack**

Package both local PDFs, generated course JSON, market cases, and manifest checksums. The `.wkf` file remains under `private-packs/` and is not committed.

- [ ] **Step 7: Run builder test and inspect pack**

Run:

```powershell
node --test scripts/build-private-pack.test.mjs
node scripts/build-private-pack.mjs
```

Expected: pack builds successfully and `git status --short` does not show PDFs, private content, or `.wkf`.

- [ ] **Step 8: Commit only scripts**

```powershell
git add scripts package.json pnpm-lock.yaml
git commit -m "feat: add private content pack toolchain"
```

### Task 12: GitHub Pages, Manifest, and Public Safety

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `public/manifest.webmanifest`
- Create: `public/robots.txt`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Modify: `index.html`

- [ ] **Step 1: Create deploy workflow**

Workflow triggers on pushes to `main`, runs `pnpm install --frozen-lockfile`, `pnpm test -- --run`, `pnpm build`, uploads `dist`, and deploys with `actions/deploy-pages`.

- [ ] **Step 2: Add public safety metadata**

`public/robots.txt`:

```text
User-agent: *
Disallow: /
```

`index.html` includes:

```html
<meta name="robots" content="noindex,nofollow,noarchive" />
<link rel="manifest" href="/weikefu/manifest.webmanifest" />
```

- [ ] **Step 3: Add manifest**

Use `start_url: '/weikefu/#/today'`, `scope: '/weikefu/'`, `display: 'standalone'`, and generated PNG icons. Do not register an offline service worker.

- [ ] **Step 4: Verify forbidden files are absent**

Run:

```powershell
pnpm build
Get-ChildItem dist -Recurse | Where-Object { $_.Name -match 'pdf|wkf|APIKEY|\.env' }
```

Expected: no matches.

- [ ] **Step 5: Commit**

```powershell
git add .github public index.html
git commit -m "ci: deploy safe static app to GitHub Pages"
```

### Task 13: End-to-End, Responsive, and Deployment Verification

**Files:**
- Create: `tests/e2e/onboarding.spec.ts`
- Create: `tests/e2e/learning-flow.spec.ts`
- Create: `tests/e2e/simulation.spec.ts`
- Create: `tests/e2e/responsive.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write E2E tests before final UI changes**

Tests cover:

- no pack -> import onboarding only;
- import fixture pack -> Today page;
- lesson -> wrong answer -> evidence feedback -> corrected explanation;
- replay future candles remain hidden before submit;
- invalid simulation blocked;
- valid simulation creates journal;
- 360x800 mobile and 1440x900 desktop have no horizontal overflow.

- [ ] **Step 2: Run E2E and confirm failures**

Run: `pnpm playwright test`

Expected: tests identify any missing integration behavior.

- [ ] **Step 3: Fix integration gaps one test at a time**

For every failure, add or refine the smallest production behavior required, rerun the single failing test, then rerun the full suite.

- [ ] **Step 4: Run full verification**

```powershell
pnpm test -- --run
pnpm playwright test
pnpm build
```

Expected: all tests pass and build succeeds.

- [ ] **Step 5: Visual verification**

Start the Vite preview server and use browser screenshots at 360x800, 412x915, and 1440x900. Verify no blank canvas, clipping, overlap, unreadable text, or chart resizing. Check the PDF viewer and chart render nonblank pixels.

- [ ] **Step 6: Merge implementation branch**

```powershell
git switch main
git merge --no-ff feature/implementation
```

- [ ] **Step 7: Push and deploy**

```powershell
git push -u origin main
```

Complete the one-time browser authorization if Git Credential Manager requests it. Enable GitHub Pages with GitHub Actions if the repository setting is not already enabled.

- [ ] **Step 8: Verify production**

Open `https://tzn-ljx.github.io/weikefu/`, verify HTTP 200, import the fixture pack, run the learning loop, and confirm the deployed asset list contains no private files.

- [ ] **Step 9: Huawei handoff**

Provide the production URL and local `.wkf` path. User transfers the pack to Huawei Mate 80, imports it, adds the site to desktop, and reports any Huawei-only issue for a final compatibility fix.

## Self-Review

- Spec coverage: all P0 requirements map to Tasks 2-13.
- Private content boundary: public build excludes PDFs and `.wkf`; full content is imported locally.
- Deterministic rules: risk, unlock, scheduling, scoring, backup, and import validation have unit tests.
- AI fallback: core learning works without AI and AI receives minimal context only.
- Huawei target: responsive E2E plus required real-device acceptance.
- Deployment: GitHub Pages base path, Hash Router, manifest, noindex, and forbidden-file scan are explicit.
- Placeholder scan: no deferred implementation placeholders are present.
