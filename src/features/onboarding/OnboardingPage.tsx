import { FileArchive, ShieldCheck, Upload } from 'lucide-react'

type OnboardingPageProps = {
  onImport: (file: File) => void
  importing: boolean
  error?: string
}

export function OnboardingPage({ onImport, importing, error }: OnboardingPageProps) {
  return <main className="onboarding-page">
    <section className="onboarding-intro">
      <div className="product-mark"><FileArchive size={24} /> 威科夫闯关</div>
      <p className="eyebrow">私人学习资料 · 本地保存</p>
      <h1>导入私人学习包</h1>
      <p className="lede">完整PDF、原书题库和ETH历史案例只会写入当前浏览器，不会上传到GitHub或其他服务器。</p>
      <div className="privacy-points">
        <div><ShieldCheck size={19} /><span>导入前校验14个单元和全部标准答案</span></div>
        <div><ShieldCheck size={19} /><span>学习进度备份不包含出版物内容</span></div>
        <div><ShieldCheck size={19} /><span>闯关运行时不调用AI或交易接口</span></div>
      </div>
    </section>
    <section className="import-panel" aria-label="学习包导入">
      <div>
        <span className="step-label">首次使用</span>
        <h2>选择手机中的 .wkf 文件</h2>
        <p>文件可以通过USB、华为分享或私人网盘传到手机。清除浏览器数据后需要重新导入。</p>
      </div>
      {error && <p className="error-notice" role="alert">{error}</p>}
      <label className="primary-command" aria-disabled={importing}>
        <Upload size={19} />
        {importing ? '正在校验并导入...' : '选择 .wkf 文件'}
        <input
          type="file"
          accept=".wkf,application/octet-stream"
          aria-label="选择 .wkf 文件"
          disabled={importing}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
          }}
        />
      </label>
    </section>
  </main>
}
