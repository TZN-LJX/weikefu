import { expect, test } from '@playwright/test'
import { createFixturePack } from './fixture-pack'

test('builds the fixture pack as an isolated in-memory upload', async () => {
  const pack = await createFixturePack() as unknown as { name: string; mimeType: string; buffer: Buffer }

  expect(pack.name).toBe('fixture.wkf')
  expect(pack.mimeType).toBe('application/octet-stream')
  expect(pack.buffer.byteLength).toBeGreaterThan(1_000)
})
