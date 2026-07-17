import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

async function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function existingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next workspace layout.
    }
  }
  throw new Error(`找不到文件：${candidates.map((item) => path.basename(item)).join(' / ')}`)
}

export async function buildPrivatePack(options) {
  const entries = [
    { source: options.coursePath, path: 'content/course.json', kind: 'course' },
    { source: options.marketCasesPath, path: 'content/market-cases.json', kind: 'market-cases' },
    { source: options.originalPdfPath, path: 'assets/original.pdf', kind: 'pdf' },
    { source: options.notesPdfPath, path: 'assets/core-notes.pdf', kind: 'pdf' },
  ]
  const zip = new JSZip()
  const files = []
  const fingerprints = []

  for (const entry of entries) {
    const bytes = await readFile(entry.source)
    const digest = await sha256(bytes)
    zip.file(entry.path, bytes, { compression: entry.kind === 'pdf' ? 'STORE' : 'DEFLATE' })
    files.push({ path: entry.path, sha256: digest, kind: entry.kind })
    if (entry.kind === 'pdf') fingerprints.push({ name: path.basename(entry.source), sha256: digest })
  }

  const manifest = {
    format: 'weikefu-pack',
    formatVersion: 1,
    id: 'wyckoff-eth-private',
    title: '威科夫 ETH 私人学习包',
    version: '2.0.0',
    minAppVersion: '2.0.0',
    createdAt: (options.now ?? new Date()).toISOString(),
    sourceFingerprints: fingerprints,
    files,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  await mkdir(path.dirname(options.output), { recursive: true })
  await writeFile(options.output, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }))
  return { output: options.output, manifest }
}

async function main() {
  const cwd = process.cwd()
  const sourceRoot = await existingPath([
    path.join(cwd, '《威科夫操盘法》原书.pdf'),
    path.resolve(cwd, '..', '..', '《威科夫操盘法》原书.pdf'),
  ]).then((file) => path.dirname(file))
  const result = await buildPrivatePack({
    output: path.join(cwd, 'private-packs', 'weikefu-private-content.wkf'),
    coursePath: path.join(cwd, 'private-content', 'course.json'),
    marketCasesPath: path.join(cwd, 'private-content', 'market-cases.json'),
    originalPdfPath: path.join(sourceRoot, '《威科夫操盘法》原书.pdf'),
    notesPdfPath: path.join(sourceRoot, '《威科夫操盘法》书本核心内容.pdf'),
  })
  const size = (await readFile(result.output)).byteLength
  process.stdout.write(`学习包已生成：${result.output} (${(size / 1024 / 1024).toFixed(1)} MB)\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
