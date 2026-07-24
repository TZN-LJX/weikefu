import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FileArchive, LoaderCircle } from 'lucide-react'
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { createBackup, validateBackup } from '../db/backup'
import { database, type ChallengeAttemptRecord, type PackRecord } from '../db/database'
import { createRepositories, type Repositories } from '../db/repositories'
import { createChallengeProgress, migrateChallengeProgress, type ChallengeProgress, type WrongItem } from '../domain/challenge'
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

type PendingProgressWrite = {
  revision: number
  progress: ChallengeProgress
  kind: 'standard' | 'training'
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

export function AppContent({ repositories = defaultRepositories }: AppContentProps) {
  const [state, setState] = useState<AppState>({ wrongItems: [] })
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [contentError, setContentError] = useState('')
  const progressRevision = useRef(0)
  const progressGeneration = useRef(0)
  const progressWriteQueue = useRef<Promise<unknown>>(Promise.resolve())
  const pendingProgressWrites = useRef(new Map<number, PendingProgressWrite>())
  const navigate = useNavigate()

  const flushProgressWrites = useCallback(async () => {
    progressRevision.current += 1
    progressGeneration.current += 1
    const queue = progressWriteQueue.current
    await queue.catch(() => undefined)
    if (progressWriteQueue.current === queue) progressWriteQueue.current = Promise.resolve()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setContentError('')
    await flushProgressWrites()
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
      const units = course.stages.flatMap((stage) => stage.units)
      const progress = migrateChallengeProgress(savedProgress, units, new Date())
      if (progress !== savedProgress) await repositories.saveChallengeProgress(progress)
      setState({ pack, course, marketCases, progress, wrongItems })
    } catch (reason) {
      setContentError(reason instanceof Error ? reason.message : '私人学习包内容格式无效')
    } finally {
      setLoading(false)
    }
  }, [flushProgressWrites, repositories])

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
      await flushProgressWrites()
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
  const enqueueProgressWrite = (
    progress: ChallengeProgress,
    revision: number,
    kind: PendingProgressWrite['kind'],
    onPersisted?: (persistedProgress: ChallengeProgress) => void,
  ) => {
    const job: PendingProgressWrite = { revision, progress, kind }
    pendingProgressWrites.current.set(revision, job)
    const write = progressWriteQueue.current
      .then(() => repositories.saveChallengeProgress(job.progress))
      .then(() => {
        onPersisted?.(job.progress)
        return job.progress
      })
    progressWriteQueue.current = write.then(
      () => { pendingProgressWrites.current.delete(revision) },
      () => { pendingProgressWrites.current.delete(revision) },
    )
    return write
  }
  const saveProgressOptimistically = (progress: ChallengeProgress) => {
    progressRevision.current += 1
    const revision = progressRevision.current
    setState((current) => ({ ...current, progress }))
    void enqueueProgressWrite(progress, revision, 'standard').catch(() => undefined)
  }
  const saveTrainingProgress = (progress: ChallengeProgress) => {
    progressRevision.current += 1
    const revision = progressRevision.current
    const generation = progressGeneration.current
    return enqueueProgressWrite(progress, revision, 'training', (persistedProgress) => {
      if (progressGeneration.current !== generation) return
      if (progressRevision.current === revision) {
        setState((current) => ({ ...current, progress: persistedProgress }))
        return
      }

      const trainingUnitId = units.find((unit) => unit.mode === 'case-training')?.id
      if (!trainingUnitId) return
      const mergeTrainingState = (target: ChallengeProgress): ChallengeProgress => {
        const unitStates = {
          ...target.unitStates,
          [trainingUnitId]: persistedProgress.unitStates[trainingUnitId],
        }
        return {
          ...target,
          mode: target.unitOrder.every((unitId) => unitStates[unitId]?.step === 'completed') ? 'reinforcement' : 'course',
          unitStates,
        }
      }
      for (const pending of pendingProgressWrites.current.values()) {
        if (pending.revision > revision && pending.kind === 'standard') pending.progress = mergeTrainingState(pending.progress)
      }
      if (pendingProgressWrites.current.get(progressRevision.current)?.kind === 'training') return
      setState((current) => current.progress
        ? { ...current, progress: mergeTrainingState(current.progress) }
        : current)
    })
  }
  const saveWrongItem = (item: WrongItem) => {
    setState((current) => ({ ...current, wrongItems: [...current.wrongItems.filter((candidate) => candidate.questionId !== item.questionId), item] }))
    void repositories.saveWrongItem(item)
  }
  const saveAttempt = (attempt: ChallengeAttemptRecord) => { void repositories.saveChallengeAttempt(attempt) }
  const openSource = (source: SourceReference) => navigate(`/pdf?page=${source.pageStart}`)
  const openUnit = (unitId: string) => {
    const step = state.progress?.unitStates[unitId]?.step
    const activeUnit = units.find((unit) => unit.id === unitId)
    if (step === 'completed' && state.progress && activeUnit?.mode === 'standard') {
      saveProgressOptimistically({ ...state.progress, unitStates: { ...state.progress.unitStates, [unitId]: { step: 'review' } }, updatedAt: new Date().toISOString() })
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
      onStandardProgressChange={saveProgressOptimistically}
      onTrainingProgressChange={saveTrainingProgress}
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

type ProgressChangeHandler = (progress: ChallengeProgress) => void | Promise<void | ChallengeProgress>

type SessionCallbacks = {
  onProgressChange: ProgressChangeHandler
  onWrongItemChange: (item: WrongItem) => void
  onAttempt: (attempt: ChallengeAttemptRecord) => void
  onOpenSource: (source: SourceReference) => void
  onReturnToMap: () => void
}

function ChallengeRoute({
  units,
  marketCases,
  progress,
  wrongItems,
  onStandardProgressChange,
  onTrainingProgressChange,
  ...callbacks
}: {
  units: ContentUnit[]
  marketCases: MarketCases
  progress: ChallengeProgress
  wrongItems: WrongItem[]
  onStandardProgressChange: ProgressChangeHandler
  onTrainingProgressChange: ProgressChangeHandler
} & Omit<SessionCallbacks, 'onProgressChange'>) {
  const { unitId } = useParams()
  const unit = units.find((candidate) => candidate.id === unitId)
  const index = unit ? units.indexOf(unit) : -1
  const unitState = unit ? progress.unitStates[unit.id] : undefined
  const unavailable = !unitState || unitState.step === 'locked'
    || (unit?.mode !== 'case-training' && index > progress.unlockedUnitIndex && unitState.step !== 'completed')
  if (!unit || unavailable) return <Navigate to="/" replace />
  const onProgressChange = unit.mode === 'case-training' ? onTrainingProgressChange : onStandardProgressChange
  return <ChallengeSessionPage
    key={unit.id}
    unit={unit}
    allUnits={units}
    marketCases={marketCases.cases}
    progress={progress}
    wrongItems={wrongItems}
    onProgressChange={onProgressChange}
    {...callbacks}
  />
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
