import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

const candles = Array.from({ length: 120 }, (_, index) => ({
  time: 1_700_000_000 + index * 3_600,
  open: 3_000 + index, high: 3_008 + index, low: 2_994 + index, close: 3_004 + index, volume: 100 + index,
}))

const course = {
  version: 1,
  stages: [{ id: 'stage-1', title: '风险纪律与看盘顺序', goal: '先背景和风险，再考虑交易', units: [{
    id: 'unit-1', title: '单笔账户风险', summary: '每笔交易先确定失效位置和止损距离，再用账户权益的 1% 计算最大名义仓位。杠杆只影响保证金占用，不能提高允许承担的风险。',
    source: { pdfPath: 'assets/original.pdf', chapter: '聪明钱的看盘顺序', pageStart: 12, pageEnd: 12 }, excerpt: '配合当时的大背景，做出结论或推断，并使用危机管理把风险降为最低。',
    keyPoints: ['先判断 4 小时背景', '在 1 小时图寻找结构', '先定止损再算仓位'],
    exercise: {
      id: 'exercise-1', prompt: '止损距离扩大时，怎样保持账户风险不变？',
      options: [{ id: 'a', label: '相应缩小仓位' }, { id: 'b', label: '提高杠杆' }, { id: 'c', label: '忽略止损距离' }], correctOptionId: 'a',
      evidence: [{ id: 'e1', label: '风险金额固定为账户权益的 1%' }, { id: 'e2', label: '仓位与止损距离反向变化' }], requiredEvidenceIds: ['e1', 'e2'],
      explanationPrompt: '看到止损距离变化后，风险金额、仓位和失效条件分别应该怎样处理？',
    },
  }] }],
}

const marketCases = { version: 1, cases: [{
  id: 'case-1', title: 'ETH 多周期测试案例', timeframe: '1h', context4h: '先看背景', cutoff: 100,
  evidenceOptions: [{ id: 'e1', label: '回测缩量' }, { id: 'e2', label: '突破放量' }], candles, candles4h: candles.slice(0, 30),
}] }

export async function createFixturePack() {
  const output = path.resolve('test-results', 'fixture.wkf')
  await mkdir(path.dirname(output), { recursive: true })
  const files = [
    { path: 'content/course.json', kind: 'course', bytes: Buffer.from(JSON.stringify(course)) },
    { path: 'content/market-cases.json', kind: 'market-cases', bytes: Buffer.from(JSON.stringify(marketCases)) },
    { path: 'assets/original.pdf', kind: 'pdf', bytes: Buffer.from('%PDF-1.4\n%%EOF') },
  ]
  const manifest = {
    format: 'weikefu-pack', formatVersion: 1, id: 'fixture', title: '端到端测试课程', version: '1.0.0', minAppVersion: '1.0.0',
    createdAt: '2026-07-16T00:00:00.000Z', sourceFingerprints: [],
    files: files.map((file) => ({ path: file.path, kind: file.kind, sha256: createHash('sha256').update(file.bytes).digest('hex') })),
  }
  const zip = new JSZip()
  for (const file of files) zip.file(file.path, file.bytes)
  zip.file('manifest.json', JSON.stringify(manifest))
  await writeFile(output, await zip.generateAsync({ type: 'nodebuffer' }))
  return output
}
