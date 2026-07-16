import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { BookOpenText, ChartCandlestick, FileArchive, LoaderCircle, NotebookPen, ShieldCheck } from 'lucide-react'
import { HashRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { createBackup, validateBackup } from '../db/backup'
import { database, type PackRecord } from '../db/database'
import { createRepositories, type Repositories } from '../db/repositories'
import { testAiConnection } from '../features/ai/aiClient'
import { CurriculumPage } from '../features/curriculum/CurriculumPage'
import { ExercisePage } from '../features/curriculum/ExercisePage'
import { LessonPage } from '../features/curriculum/LessonPage'
import { JournalForm, type JournalEntry } from '../features/journal/JournalForm'
import { JournalPage } from '../features/journal/JournalPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { CourseSchema, MarketCasesSchema, type Course, type MarketCases } from '../features/pack/contentSchema'
import { importPack } from '../features/pack/importPack'
import { ReplayPage } from '../features/replay/ReplayPage'
import { SettingsPage, type StoredAiConfig } from '../features/settings/SettingsPage'
import { SimulationPage, type SimulationTrade } from '../features/simulation/SimulationPage'
import { TodayPage } from '../features/today/TodayPage'

const APP_VERSION = '1.0.0'
const defaultRepositories = createRepositories(database)
const emptyAi: StoredAiConfig = { endpoint: '', model: '', apiKey: '', rememberKey: false }
const PdfReader = lazy(() => import('../features/pdf/PdfReader').then((module) => ({ default: module.PdfReader })))

type AppState = {
  pack?: PackRecord
  course?: Course
  marketCases?: MarketCases
}

type AppContentProps = { repositories?: Repositories }

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function findUnit(course: Course, unitId?: string) {
  return course.stages.flatMap((stage) => stage.units).find((unit) => unit.id === unitId)
}

function LoadingPage() {
  return <main className="loading-page"><LoaderCircle className="spin" /><p>正在读取本机学习资料...</p></main>
}

function ContentError({ message, onReset }: { message: string; onReset: () => void }) {
  return <main className="loading-page"><FileArchive /><h1>学习包内容无法读取</h1><p>{message}</p><button className="primary-command compact-command" type="button" onClick={onReset}>返回导入页</button></main>
}

function TrainingHub({ caseId, unitId }: { caseId?: string; unitId?: string }) {
  return <div className="page-stack training-hub">
    <header className="page-heading"><div><p className="eyebrow">从判断到执行</p><h1>训练场</h1></div></header>
    <div className="training-list">
      {caseId && <Link to={`/replay/${caseId}`}><ChartCandlestick /><div><span>隐藏未来走势</span><h2>ETH 历史回放</h2><p>先完成 4h 背景、1h 结构、证据和失效条件，再揭示后续 K 线。</p></div></Link>}
      <Link to="/simulation"><ShieldCheck /><div><span>1% 风险门控</span><h2>模拟交易</h2><p>用止损距离计算仓位，缺少任何强制证据都无法创建模拟订单。</p></div></Link>
      {unitId && <Link to={`/lesson/${unitId}`}><BookOpenText /><div><span>回到课程</span><h2>概念与原书</h2><p>查看短讲解、来源页和知识检验。</p></div></Link>}
      <Link to="/review"><NotebookPen /><div><span>过程质量</span><h2>交易复盘</h2><p>区分合格亏损、违规盈利和真正的分析错误。</p></div></Link>
    </div>
  </div>
}

function UnitRoute({ course, mode, repositories }: { course: Course; mode: 'lesson' | 'exercise' | 'pdf'; repositories: Repositories }) {
  const { unitId } = useParams()
  const navigate = useNavigate()
  const unit = findUnit(course, unitId)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array>()
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    if (mode !== 'pdf' || !unit) return
    repositories.getAsset(unit.source.pdfPath).then((asset) => asset ? setPdfBytes(asset.bytes) : setPdfError('学习包中缺少对应 PDF 文件'))
  }, [mode, repositories, unit])

  if (!unit) return <Navigate to="/curriculum" replace />
  if (mode === 'lesson') return <LessonPage unit={unit} onOpenSource={() => navigate(`/pdf/${unit.id}`)} onStartExercise={() => navigate(`/exercise/${unit.id}`)} />
  if (mode === 'exercise') return <ExercisePage exercise={unit.exercise} onComplete={(correct) => { if (correct) window.setTimeout(() => navigate('/training'), 500) }} />
  if (pdfError) return <p className="error-notice" role="alert">{pdfError}</p>
  return pdfBytes ? <Suspense fallback={<LoadingPage />}><PdfReader bytes={pdfBytes} initialPage={unit.source.pageStart} title={unit.title} /></Suspense> : <LoadingPage />
}

export function AppContent({ repositories = defaultRepositories }: AppContentProps) {
  const [state, setState] = useState<AppState>({})
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [contentError, setContentError] = useState('')
  const [aiConfig, setAiConfig] = useState<StoredAiConfig>(emptyAi)
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [latestTrade, setLatestTrade] = useState<SimulationTrade>()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    setContentError('')
    try {
      const pack = await repositories.getActivePack()
      const storedAi = await repositories.getSetting<StoredAiConfig>('ai')
      setAiConfig(storedAi ?? emptyAi)
      setJournals((await repositories.getJournals()) as unknown as JournalEntry[])
      if (!pack) {
        setState({})
        return
      }
      const rawCourse = await repositories.getJsonAsset<unknown>('content/course.json')
      const rawCases = await repositories.getJsonAsset<unknown>('content/market-cases.json')
      setState({ pack, course: CourseSchema.parse(rawCourse), marketCases: MarketCasesSchema.parse(rawCases) })
    } catch (reason) {
      setContentError(reason instanceof Error ? reason.message : '私人学习包内容格式无效')
    } finally {
      setLoading(false)
    }
  }, [repositories])

  useEffect(() => { void load() }, [load])

  const handleImport = async (file: File) => {
    setImporting(true)
    setError('')
    try {
      await importPack(await file.arrayBuffer(), {
        appVersion: APP_VERSION,
        estimateStorage: () => navigator.storage?.estimate?.() ?? Promise.resolve({}),
        savePack: repositories.savePack,
        clearPartial: repositories.clearPartial,
      })
      await load()
      navigate('/today')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '学习包导入失败')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <LoadingPage />
  if (contentError) return <ContentError message={contentError} onReset={async () => { await repositories.deleteActivePack(); await load(); navigate('/') }} />

  if (!state.pack || !state.course || !state.marketCases) {
    return <Routes>
      <Route path="/settings" element={<SettingsPage aiConfig={aiConfig} onSaveAi={async (config) => { setAiConfig(config); await repositories.setSetting('ai', config) }} onTestAi={async (config) => { await testAiConnection(config) }} onReplacePack={handleImport} onDeletePack={() => undefined} onExportBackup={() => undefined} onImportBackup={() => undefined} />} />
      <Route path="*" element={<OnboardingPage importing={importing} error={error} onImport={handleImport} onOpenSettings={() => navigate('/settings')} />} />
    </Routes>
  }

  const course = state.course
  const marketCases = state.marketCases
  const firstUnit = course.stages.flatMap((stage) => stage.units)[0]
  const firstCase = marketCases.cases[0]
  const tasks = [
    { id: 'review-due', kind: 'review' as const, minutes: 3, title: '证据链复习', detail: '先观察，再解释供需含义' },
    ...(firstUnit ? [{ id: firstUnit.id, kind: 'lesson' as const, minutes: 5, title: firstUnit.title, detail: firstUnit.source.chapter }] : []),
    ...(firstCase ? [{ id: firstCase.id, kind: 'replay' as const, minutes: 8, title: 'ETH 隐藏回放', detail: firstCase.title }] : []),
  ]

  const exportBackup = async () => downloadJson(`weikefu-progress-${new Date().toISOString().slice(0, 10)}.json`, createBackup(await repositories.getBackupSnapshot() as never))
  const importBackupFile = async (file: File) => {
    try {
      const backup = validateBackup(JSON.parse(await file.text()))
      if (!window.confirm('导入后将覆盖当前学习进度、模拟交易和复盘记录，继续吗？')) return
      await repositories.restoreProgress(backup)
      await load()
      window.alert('学习进度已恢复')
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : '备份文件无效')
    }
  }

  const shell = (element: ReactNode) => <AppShell>{element}</AppShell>
  return <Routes>
    <Route path="/settings" element={<SettingsPage
      aiConfig={aiConfig}
      activePack={{ title: state.pack.title, version: state.pack.version }}
      onSaveAi={async (config) => { setAiConfig(config); await repositories.setSetting('ai', config) }}
      onTestAi={async (config) => { await testAiConnection(config) }}
      onReplacePack={handleImport}
      onDeletePack={async () => { if (window.confirm('删除本机学习包？学习进度不会自动删除。')) { await repositories.deleteActivePack(); await load(); navigate('/') } }}
      onExportBackup={exportBackup}
      onImportBackup={importBackupFile}
    />} />
    <Route path="/today" element={shell(<TodayPage stageTitle={course.stages[0]?.title ?? '威科夫基础'} progress={0} tasks={tasks} onStart={() => firstUnit ? navigate(`/lesson/${firstUnit.id}`) : navigate('/training')} />)} />
    <Route path="/curriculum" element={shell(<CurriculumPage stages={course.stages} unlockedStageIndex={0} />)} />
    <Route path="/lesson/:unitId" element={shell(<UnitRoute course={course} mode="lesson" repositories={repositories} />)} />
    <Route path="/exercise/:unitId" element={shell(<UnitRoute course={course} mode="exercise" repositories={repositories} />)} />
    <Route path="/pdf/:unitId" element={shell(<UnitRoute course={course} mode="pdf" repositories={repositories} />)} />
    <Route path="/training" element={shell(<TrainingHub caseId={firstCase?.id} unitId={firstUnit?.id} />)} />
    <Route path="/replay/:caseId" element={shell(<ReplayRoute cases={marketCases} />)} />
    <Route path="/simulation" element={shell(<SimulationPage onCreateTrade={async (trade) => { setLatestTrade(trade); await repositories.saveTrade(trade); navigate(`/journal/new/${trade.id}`) }} />)} />
    <Route path="/journal/new/:tradeId" element={shell(<JournalRoute trade={latestTrade} repositories={repositories} onSaved={(entry) => { setJournals((current) => [entry, ...current]); navigate('/review') }} />)} />
    <Route path="/review" element={shell(<JournalPage entries={journals} />)} />
    <Route path="*" element={<Navigate to="/today" replace />} />
  </Routes>
}

function ReplayRoute({ cases }: { cases: MarketCases }) {
  const { caseId } = useParams()
  const marketCase = cases.cases.find((item) => item.id === caseId)
  return marketCase ? <ReplayPage marketCase={marketCase} onComplete={() => undefined} /> : <Navigate to="/training" replace />
}

function JournalRoute({ trade, repositories, onSaved }: { trade?: SimulationTrade; repositories: Repositories; onSaved: (entry: JournalEntry) => void }) {
  const { tradeId } = useParams()
  if (!trade || trade.id !== tradeId) return <Navigate to="/simulation" replace />
  return <div className="page-stack"><header className="page-heading"><div><p className="eyebrow">模拟订单已创建</p><h1>完成交易前复盘</h1></div></header><JournalForm tradeId={trade.id} onSave={async (entry) => { await repositories.saveJournal(entry); onSaved(entry) }} /></div>
}

export default function App() {
  return <HashRouter><AppContent /></HashRouter>
}
