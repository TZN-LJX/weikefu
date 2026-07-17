import { ArrowLeft, Download, FileArchive, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

type SettingsPageProps = {
  activePack?: { title: string; version: string }
  onReplacePack: (file: File) => void
  onDeletePack: () => void
  onExportBackup: () => void
  onImportBackup: (file: File) => void
}

export function SettingsPage(props: SettingsPageProps) {
  return <div className="page-stack settings-page">
    <header className="settings-header"><Link to="/" title="返回"><ArrowLeft /></Link><div><p className="eyebrow">本机资料</p><h1>设置</h1></div></header>

    <section className="settings-section">
      <div className="settings-title"><FileArchive /><div><h2>私人学习包</h2><p>{props.activePack ? `${props.activePack.title} · v${props.activePack.version}` : '尚未导入学习包'}</p></div></div>
      <div className="settings-actions">
        <label className="secondary-command"><Upload size={17} />{props.activePack ? '替换学习包' : '导入学习包'}<input className="visually-hidden" type="file" accept=".wkf,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onReplacePack(file) }} /></label>
        {props.activePack && <button className="danger-command" type="button" onClick={props.onDeletePack}><Trash2 size={17} />删除本机学习包</button>}
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-title"><ShieldCheck /><div><h2>闯关进度备份</h2><p>只包含章节进度、答题记录和错题掌握次数，不包含PDF、学习包或任何密钥。</p></div></div>
      <div className="settings-actions">
        <button className="secondary-command" type="button" onClick={props.onExportBackup}><Download size={17} />导出进度</button>
        <label className="secondary-command"><Upload size={17} />导入进度<input className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImportBackup(file) }} /></label>
      </div>
    </section>
  </div>
}
