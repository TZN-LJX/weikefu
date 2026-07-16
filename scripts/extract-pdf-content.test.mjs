import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import test from 'node:test'

const bundledPython = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe')
const python = process.env.WEIKEFU_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python')

test('extracts one indexed JSON record per PDF page', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'weikefu-pdf-'))
  const pdf = path.join(root, 'fixture.pdf')
  const output = path.join(root, 'pages.json')
  const create = spawnSync(python, ['-c', [
    'from reportlab.pdfgen import canvas',
    `c=canvas.Canvas(r'''${pdf}''')`,
    "c.drawString(72,720,'page one')",
    'c.showPage()',
    "c.drawString(72,720,'page two')",
    'c.save()',
  ].join(';')], { encoding: 'utf8' })
  assert.equal(create.status, 0, create.stderr)

  const extract = spawnSync(python, ['scripts/extract-pdf-content.py', '--input', pdf, '--output', output], { encoding: 'utf8' })
  assert.equal(extract.status, 0, extract.stderr)
  const result = JSON.parse(await readFile(output, 'utf8'))
  assert.equal(result.pageCount, 2)
  assert.match(result.pages[0].text, /page one/)
  assert.match(result.pages[1].text, /page two/)
})
