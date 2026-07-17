import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import JSZip from 'jszip'
import { buildPrivatePack } from './build-private-pack.mjs'

test('builds a checksummed private learning pack with both PDFs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'weikefu-pack-'))
  const content = path.join(root, 'content')
  await mkdir(content)
  await writeFile(path.join(content, 'course.json'), '{"version":2,"stages":[]}')
  await writeFile(path.join(content, 'market-cases.json'), '{"version":2,"cases":[]}')
  await writeFile(path.join(root, 'original.pdf'), 'original')
  await writeFile(path.join(root, 'notes.pdf'), 'notes')
  const output = path.join(root, 'private.wkf')

  await buildPrivatePack({
    output,
    coursePath: path.join(content, 'course.json'),
    marketCasesPath: path.join(content, 'market-cases.json'),
    originalPdfPath: path.join(root, 'original.pdf'),
    notesPdfPath: path.join(root, 'notes.pdf'),
    now: new Date('2026-07-17T00:00:00.000Z'),
  })

  const zip = await JSZip.loadAsync(await readFile(output))
  const manifest = JSON.parse(await zip.file('manifest.json').async('text'))
  assert.deepEqual(Object.keys(zip.files).filter((name) => !name.endsWith('/')).sort(), [
    'assets/core-notes.pdf', 'assets/original.pdf', 'content/course.json', 'content/market-cases.json', 'manifest.json',
  ])
  assert.equal(manifest.files.length, 4)
  assert.equal(manifest.version, '2.0.0')
  assert.equal(manifest.minAppVersion, '2.0.0')
  assert.match(manifest.files[0].sha256, /^[a-f0-9]{64}$/)
})
