import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import { normalizePage } from './pdfState'
import pdfWorkerUrl from './pdf.worker.ts?worker&url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type PdfReaderProps = {
  bytes: Uint8Array
  initialPage?: number
  title: string
}

export function PdfReader({ bytes, initialPage = 1, title }: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.25)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const task = getDocument({ data: bytes.slice() })
    task.promise.then((pdf) => {
      if (!active) return
      setDocument(pdf)
      setPage(normalizePage(initialPage, pdf.numPages))
    }).catch(() => active && setError('无法读取PDF，请重新导入学习包'))
    return () => {
      active = false
      task.destroy()
    }
  }, [bytes, initialPage])

  useEffect(() => {
    if (!document || !canvasRef.current) return
    let cancelled = false
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined
    document.getPage(page).then((pdfPage) => {
      if (cancelled || !canvasRef.current) return
      const viewport = pdfPage.getViewport({ scale })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * pixelRatio)
      canvas.height = Math.floor(viewport.height * pixelRatio)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      renderTask = pdfPage.render({ canvas, canvasContext: context, viewport })
      return renderTask.promise
    }).catch((reason) => {
      if (!cancelled && reason?.name !== 'RenderingCancelledException') setError('PDF页面渲染失败')
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [document, page, scale])

  if (error) return <p className="error-notice" role="alert">{error}</p>
  return <section className="pdf-reader">
    <header>
      <div><p className="eyebrow">本地私人资料</p><h1>{title}</h1></div>
      <span>{document ? `${page} / ${document.numPages}` : '加载中'}</span>
    </header>
    <div className="pdf-toolbar">
      <button type="button" title="上一页" disabled={!document || page <= 1} onClick={() => setPage((value) => normalizePage(value - 1, document?.numPages ?? 1))}><ChevronLeft /></button>
      <input aria-label="PDF页码" type="number" min="1" max={document?.numPages} value={page} onChange={(event) => setPage(normalizePage(Number(event.target.value), document?.numPages ?? 1))} />
      <button type="button" title="下一页" disabled={!document || page >= document.numPages} onClick={() => setPage((value) => normalizePage(value + 1, document?.numPages ?? 1))}><ChevronRight /></button>
      <span className="toolbar-spacer" />
      <button type="button" title="缩小" onClick={() => setScale((value) => Math.max(.7, value - .15))}><ZoomOut /></button>
      <button type="button" title="放大" onClick={() => setScale((value) => Math.min(2.3, value + .15))}><ZoomIn /></button>
    </div>
    <div className="pdf-canvas-scroll"><canvas ref={canvasRef} /></div>
  </section>
}
