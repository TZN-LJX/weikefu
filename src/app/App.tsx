import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FileArchive, LoaderCircle } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { createBackup, validateBackup } from '../db/backup'
import { database, type ChallengeAttemptRecord, type PackRecord } from '../db/database'
import { createRepositories, type Repositories } from '../db/repositories'
import { createChallengeProgress, type ChallengeProgress, type WrongItem } from '../domain/challenge'
import { ChallengeMapPage } from '../features/challenge/ChallengeMapPage'
import { ChallengeSessionPage } from '../features/challenge/ChallengeSessionPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { validateChallengeContent, type ContentUnit, type Course, type MarketCases, type SourceReference } from '../features/pack/contentSchema'
import { importPack } from '../features/pack/importPack'
import { SettingsPage } from '../features/settings/SettingsPage'

const APP_VERSION = '2.0.0'
const defaultRepositories = createRepositories(database)
const PdfReader = lazy(() => import('../features/pdf/PdfReader').then((module) => ({ default: module.PdfReader })))

type AppState = {
  pack?: PackRecord
  course?: Course
  marketCases?: MarketCases
  progress?: ChallengeProgress
  wrongItems: WrongItem[]
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

function LoadingPage() {
  return <main className="loading-page"><LoaderCircle className="spin" /><p>正在读取本机学习资料...</p></main>
}

function ContentError({ message, onReset }: { message: string; onReset: () => void }) {
  return <main className="loading-page"><FileArchive /><h1>学习包内容无法读取</h1><p>{message}</p><button className="primary-command compact-command" type="button" onClick={onReset}>返回导入页</button></main>
}

function sameUnitOrder(progress: ChallengeProgress, unitIds: string[]) {
  return progress.unitOrder.length === unitIds.length && progress.unitOrder.every((unitId, index) => unitId === unitIds[index])
}

export function AppContent({ repositories = defaultRepositories }: AppContentProps) {
  const [state, setState] = useState<AppState>({ wrongItems: [] })
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [contentError, setContentError] = useState('')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    setContentError('')
    try {
      const pack = await repositories.getActivePack()
      if (!pack) {
        setState({ wrongItems: [] })
        return
      }
      const [rawCourse, rawMarketCases, savedProgress, wrongItems] = await Promise.all([
        repositories.getJsonAsset<unknown>('content/course.json'),
        repositories.getJsonAsset<unknown>('content/market-cases.json'),
        repositories.getChallengeProgress(),
        repositories.getWrongItems(),
      ])
      const { course, marketCases } = validateChallengeContent(rawCourse, rawMarketCases)
      const unitIds = course.stages.flatMap((stage) => stage.units).map((unit) => unit.id)
      const progress = savedProgress && sameUnitOrder(savedProgress, unitIds) ? savedProgress : createChallengeProgress(unitIds)
      if (progress !== savedProgress) await repositories.saveChallengeProgress(progress)
      setState({ pack, course, marketCases, progress, wrongItems })
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
      navigate('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '学习包导入失败')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <LoadingPage />
  if (contentError) return <ContentError message={contentError} onReset={async () => { await repositories.deleteActivePack(); await load(); navigate('/') }} />

  const exportBackup = async () => downloadJson(`weikefu-progress-${new Date().toISOString().slice(0, 10)}.json`, createBackup(await repositories.getBackupSnapshot()))
  const importBackupFile = async (file: File) => {
    try {
      const backup = validateBackup(JSON.parse(await file.text()))
      if (!window.confirm('导入后将覆盖当前闯关进度和错题记录，继续吗？')) return
      await repositories.restoreProgress(backup)
      await load()
      window.alert('闯关进度已恢复')
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : '备份文件无效')
    }
  }

  if (!state.pack || !state.course || !state.marketCases || !state.progress) {
    return <Routes>
      <Route path="/settings" element={<SettingsPage onReplacePack={handleImport} onDeletePack={() => undefined} onExportBackup={exportBackup} onImportBackup={importBackupFile} />} />
      <Route path="*" element={<OnboardingPage importing={importing} error={error} onImport={handleImport} />} />
    </Routes>
  }

  const units = state.course.stages.flatMap((stage) => stage.units)
  const activeWrongCount = state.wrongItems.filter((item) => item.status === 'active').length
  const saveProgress = (progress: ChallengeProgress) => {
    setState((current) => ({ ...current, progress }))
    void repositories.saveChallengeProgress(progress)
  }
  const saveWrongItem = (item: WrongItem) => {
    setState((current) => ({ ...current, wrongItems: [...current.wrongItems.filter((candidate) => candidate.questionId !== item.questionId), item] }))
    void repositories.saveWrongItem(item)
  }
  const saveAttempt = (attempt: ChallengeAttemptRecord) => { void repositories.saveChallengeAttempt(attempt) }
  const openSource = (source: SourceReference) => navigate(`/pdf?page=${source.pageStart}`)
  const openUnit = (unitId: string) => {
    const step = state.progress?.unitStates[unitId]?.step
    if (step === 'completed' && state.progress) {
      saveProgress({ ...state.progress, unitStates: { ...state.progress.unitStates, [unitId]: { step: 'review' } }, updatedAt: new Date().toISOString() })
    }
    navigate(`/challenge/${unitId}`)
  }

  const shell = (element: ReactNode) => <AppShell>{element}</AppShell>
  return <Routes>
    <Route path="/settings" element={shell(<SettingsPage
      activePack={{ title: state.pack.title, version: state.pack.version }}
      onReplacePack={handleImport}
      onDeletePack={async () => { if (window.confirm('删除本机学习包？闯关进度不会自动删除。')) { await repositories.deleteActivePack(); await load(); navigate('/') } }}
      onExportBackup={exportBackup}
      onImportBackup={importBackupFile}
    />)} />
    <Route path="/pdf" element={shell(<PdfRoute repositories={repositories} />)} />
    <Route path="/challenge/:unitId" element={shell(<ChallengeRoute
      units={units}
      marketCases={state.marketCases}
      progress={state.progress}
      wrongItems={state.wrongItems}
      onProgressChange={saveProgress}
      onWrongItemChange={saveWrongItem}
      onAttempt={saveAttempt}
      onOpenSource={openSource}
      onReturnToMap={() => navigate('/')}
    />)} />
    <Route path="/reinforcement" element={shell(<ReinforcementRoute
      units={units}
      marketCases={state.marketCases}
      wrongItems={state.wrongItems}
      onWrongItemChange={saveWrongItem}
      onAttempt={saveAttempt}
      onOpenSource={openSource}
      onReturnToMap={() => navigate('/')}
    />)} />
    <Route path="/" element={shell(<ChallengeMapPage units={units} progress={state.progress} wrongCount={activeWrongCount} onOpenUnit={openUnit} onStartReinforcement={() => navigate('/reinforcement')} />)} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

type SessionCallbacks = {
  onProgressChange: (progress: ChallengeProgress) => void
  onWrongItemChange: (item: WrongItem) => void
  onAttempt: (attempt: ChallengeAttemptRecord) => void
  onOpenSource: (source: SourceReference) => void
  onReturnToMap: () => void
}

function ChallengeRoute({ units, marketCases, progress, wrongItems, ...callbacks }: {
  units: ContentUnit[]
  marketCases: MarketCases
  progress: ChallengeProgress
  wrongItems: WrongItem[]
} & SessionCallbacks) {
  const { unitId } = useParams()
  const unit = units.find((candidate) => candidate.id === unitId)
  const index = unit ? units.indexOf(unit) : -1
  if (!unit || index > progress.unlockedUnitIndex) return <Navigate to="/" replace />
  return <ChallengeSessionPage key={unit.id} unit={unit} allUnits={units} marketCases={marketCases.cases} progress={progress} wrongItems={wrongItems} {...callbacks} />
}

function ReinforcementRoute({ units, marketCases, wrongItems, onWrongItemChange, onAttempt, onOpenSource, onReturnToMap }: {
  units: ContentUnit[]
  marketCases: MarketCases
  wrongItems: WrongItem[]
  onWrongItemChange: (item: WrongItem) => void
  onAttempt: (attempt: ChallengeAttemptRecord) => void
  onOpenSource: (source: SourceReference) => void
  onReturnToMap: () => void
}) {
  const syntheticUnit = useMemo<ContentUnit>(() => ({
    id: 'reinforcement',
    mode: 'standard',
    title: '无限巩固',
    summary: '混合复习全部原书知识和ETH历史案例。',
    source: units[0].source,
    excerpt: units[0].excerpt,
    keyPoints: units.flatMap((unit) => unit.keyPoints).slice(0, 6),
    bookQuestions: units.flatMap((unit) => unit.bookQuestions),
  }), [units])
  const [roundProgress, setRoundProgress] = useState(() => createChallengeProgress(['reinforcement']))
  return <ChallengeSessionPage
    unit={syntheticUnit}
    allUnits={units}
    marketCases={marketCases.cases}
    includeAllMarketCases
    progress={roundProgress}
    wrongItems={wrongItems}
    onProgressChange={setRoundProgress}
    onWrongItemChange={onWrongItemChange}
    onAttempt={onAttempt}
    onOpenSource={onOpenSource}
    onReturnToMap={onReturnToMap}
  />
}

function PdfRoute({ repositories }: { repositories: Repositories }) {
  const [searchParams] = useSearchParams()
  const initialPage = Math.max(1, Number(searchParams.get('page')) || 1)
  const [bytes, setBytes] = useState<Uint8Array>()
  const [error, setError] = useState('')
  useEffect(() => {
    repositories.getAsset('assets/original.pdf').then((asset) => asset ? setBytes(asset.bytes) : setError('学习包中缺少原书PDF'))
  }, [repositories])
  if (error) return <p className="error-notice" role="alert">{error}</p>
  return bytes ? <Suspense fallback={<LoadingPage />}><PdfReader bytes={bytes} initialPage={initialPage} title="《威科夫操盘法》原书" /></Suspense> : <LoadingPage />
}

export default function App() {
  return <HashRouter><AppContent /></HashRouter>
}
