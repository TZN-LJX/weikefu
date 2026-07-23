import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { createChallengeContentFixture } from '../../src/test/fixtures/challengeContent'

export async function createFixturePack() {
  const { course, marketCases } = createChallengeContentFixture()
  const files = [
    { path: 'content/course.json', kind: 'course', bytes: Buffer.from(JSON.stringify(course)) },
    { path: 'content/market-cases.json', kind: 'market-cases', bytes: Buffer.from(JSON.stringify(marketCases)) },
    { path: 'assets/original.pdf', kind: 'pdf', bytes: Buffer.from('%PDF-1.4\n%%EOF') },
  ]
  const manifest = {
    format: 'weikefu-pack', formatVersion: 1, id: 'fixture', title: '端到端测试课程', version: '2.0.0', minAppVersion: '2.0.0',
    createdAt: '2026-07-17T00:00:00.000Z', sourceFingerprints: [],
    files: files.map((file) => ({ path: file.path, kind: file.kind, sha256: createHash('sha256').update(file.bytes).digest('hex') })),
  }
  const zip = new JSZip()
  for (const file of files) zip.file(file.path, file.bytes)
  zip.file('manifest.json', JSON.stringify(manifest))
  return {
    name: 'fixture.wkf',
    mimeType: 'application/octet-stream',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  }
}
