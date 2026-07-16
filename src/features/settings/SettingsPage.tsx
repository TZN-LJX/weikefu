import { useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Download, FileArchive, KeyRound, RefreshCw, Save, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

export type StoredAiConfig = {
  endpoint: string
  model: string
  apiKey: string
  rememberKey: boolean
}

type SettingsPageProps = {
  aiConfig: StoredAiConfig
  activePack?: { title: string; version: string }
  onSaveAi: (config: StoredAiConfig) => void | Promise<void>
  onTestAi: (config: StoredAiConfig) => Promise<void>
  onReplacePack: (file: File) => void
  onDeletePack: () => void
  onExportBackup: () => void
  onImportBackup: (file: File) => void
}

export function SettingsPage(props: SettingsPageProps) {
  const [endpoint, setEndpoint] = useState(props.aiConfig.endpoint)
  const [model, setModel] = useState(props.aiConfig.model)
  const [apiKey, setApiKey] = useState('')
  const [rememberKey, setRememberKey] = useState(props.aiConfig.rememberKey)
  const [status, setStatus] = useState('')
  const currentConfig = () => ({ endpoint: endpoint.trim(), model: model.trim(), apiKey: apiKey || props.aiConfig.apiKey, rememberKey })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const config = currentConfig()
    await props.onSaveAi({ ...config, apiKey: rememberKey ? config.apiKey : '' })
    setStatus(rememberKey ? 'AI 设置已保存到本浏览器' : '接口和模型已保存，密钥仅用于当前会话')
  }

  const test = async () => {
    setStatus('正在测试连接...')
    try {
      await props.onTestAi(currentConfig())
      setStatus('AI 接口连接成功')
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'AI 接口连接失败')
    }
  }

  return <div className="page-stack settings-page">
    <header className="settings-header"><Link to={props.activePack ? '/today' : '/'} title="返回"><ArrowLeft /></Link><div><p className="eyebrow">本机配置</p><h1>设置</h1></div></header>

    <section className="settings-section">
      <div className="settings-title"><KeyRound /><div><h2>AI 教练</h2><p>可选功能。没有接口时，规则评分、课程和回放仍可使用。</p></div></div>
      <form className="settings-form" onSubmit={save}>
        <label>接口地址<input aria-label="接口地址" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://provider.example/v1" /></label>
        <label>模型名称<input aria-label="模型名称" value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID" /></label>
        <label>API Key<input aria-label="API Key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={props.aiConfig.apiKey ? '已保存，输入可替换' : '只发送给上方接口地址'} autoComplete="off" /></label>
        <label className="confirm-check"><input type="checkbox" checked={rememberKey} onChange={(event) => setRememberKey(event.target.checked)} />在这个浏览器中记住 API Key</label>
        <div className="settings-actions"><button className="secondary-command" type="button" onClick={test}><RefreshCw size={17} />测试连接</button><button className="primary-command" type="submit"><Save size={17} />保存 AI 设置</button></div>
        {status && <p className={status.includes('成功') || status.includes('已保存') || status.includes('仅用于') ? 'success-notice' : 'settings-status'} aria-live="polite">{status}</p>}
      </form>
    </section>

    <section className="settings-section">
      <div className="settings-title"><FileArchive /><div><h2>私人学习包</h2><p>{props.activePack ? `${props.activePack.title} · v${props.activePack.version}` : '尚未导入学习包'}</p></div></div>
      <div className="settings-actions">
        <label className="secondary-command"><Upload size={17} />{props.activePack ? '替换学习包' : '导入学习包'}<input className="visually-hidden" type="file" accept=".wkf,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onReplacePack(file) }} /></label>
        {props.activePack && <button className="danger-command" type="button" onClick={props.onDeletePack}><Trash2 size={17} />删除本机学习包</button>}
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-title"><CheckCircle2 /><div><h2>学习进度备份</h2><p>只包含答题、掌握度、模拟交易和非敏感设置，不包含 PDF、学习包和 API Key。</p></div></div>
      <div className="settings-actions"><button className="secondary-command" type="button" onClick={props.onExportBackup}><Download size={17} />导出进度</button><label className="secondary-command"><Upload size={17} />导入进度<input className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImportBackup(file) }} /></label></div>
    </section>
  </div>
}
