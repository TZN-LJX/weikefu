import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'

const ExerciseSchema = z.object({
  id: z.string().min(1), prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(3).max(4),
  correctOptionId: z.string().min(1),
  evidence: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  requiredEvidenceIds: z.array(z.string().min(1)).min(1), explanationPrompt: z.string().min(1),
}).superRefine((exercise, context) => {
  if (!exercise.options.some((option) => option.id === exercise.correctOptionId)) context.addIssue({ code: 'custom', message: '正确选项不存在' })
  const evidenceIds = new Set(exercise.evidence.map((item) => item.id))
  if (exercise.requiredEvidenceIds.some((id) => !evidenceIds.has(id))) context.addIssue({ code: 'custom', message: '必需证据不存在' })
})

const UnitSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), summary: z.string().min(30),
  source: z.object({ pdfPath: z.literal('assets/original.pdf'), chapter: z.string().min(1), pageStart: z.number().int().positive(), pageEnd: z.number().int().positive() }),
  excerpt: z.string().min(10), keyPoints: z.array(z.string().min(1)).min(3).max(6), exercise: ExerciseSchema,
}).superRefine((unit, context) => {
  if (unit.source.pageEnd < unit.source.pageStart) context.addIssue({ code: 'custom', message: '来源页码无效' })
})

const StageSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), goal: z.string().min(10), units: z.array(UnitSchema).min(1),
})

const CourseSchema = z.object({ version: z.literal(1), stages: z.array(StageSchema).length(7, '课程必须包含七个阶段') })

const stagePlans = [
  { id: 'stage-1-risk', title: '风险纪律与聪明钱看盘顺序', pages: [6, 26], topics: ['市场自身行为与聪明钱视角', '背景-供需-风险的固定判断顺序'] },
  { id: 'stage-2-supply-demand', title: '供需、背景与价量关系', pages: [27, 64], topics: ['供求关系与供应需求扩大', '支撑阻力、努力与结果'] },
  { id: 'stage-3-accumulation', title: '吸筹与做多逻辑', pages: [65, 129], topics: ['熊市停止行为与吸筹阶段', '测试、震仓与进入牛市'] },
  { id: 'stage-4-distribution', title: '派发与做空逻辑', pages: [130, 176], topics: ['牛市终止与派发意图', '派发确认、失败和做空前提'] },
  { id: 'stage-5-spring', title: 'Spring、测试与失败案例', pages: [177, 208], topics: ['Spring 的位置、种类和供需含义', '测试确认、失败 Spring 与不交易'] },
  { id: 'stage-6-replay', title: 'ETH 历史行情综合回放', pages: [209, 257], topics: ['交易机会、进场点与危机管理', '多证据联合判断与失效条件'] },
  { id: 'stage-7-simulation', title: '30 笔内部模拟交易', pages: [258, 288], topics: ['完整分析结果与交易计划', '执行、退出和过程质量复盘'] },
]

export function parseApiConfigText(text) {
  const endpoint = text.match(/https?:\/\/[^\s\r\n]+/i)?.[0]?.replace(/[，。；;]+$/, '')
  const apiKey = text.match(/sk-[A-Za-z0-9_-]+/)?.[0]
  const model = text.match(/gpt-[A-Za-z0-9._-]+/i)?.[0]
  if (!endpoint || !apiKey || !model) throw new Error('APIKEY.txt 缺少接口地址、Key 或模型名称')
  return { endpoint, apiKey, model }
}

export function validateCourse(value) {
  const parsed = CourseSchema.safeParse(value)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    if (Array.isArray(value?.stages) && value.stages.length === 7 && value.stages.some((stage) => !stage.units?.length)) {
      throw new Error('每个阶段至少一个知识单元')
    }
    throw new Error(first?.message || '课程结构无效')
  }
  return parsed.data
}

function parseJsonContent(content) {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI 未返回 JSON 对象')
  return JSON.parse(content.slice(start, end + 1))
}

function sourcePacket(source, [start, end]) {
  const candidates = source.pages.filter((page) => page.page >= start && page.page <= end && page.charCount > 80)
  const count = Math.min(12, candidates.length)
  const selected = []
  for (let index = 0; index < count; index += 1) {
    const page = candidates[Math.min(candidates.length - 1, Math.floor(index * candidates.length / count))]
    selected.push(`【原书第${page.page}页】\n${page.text.slice(0, 1400)}`)
  }
  return selected.join('\n\n')
}

async function requestStage(config, plan, packet, fetcher = fetch) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  const response = await fetcher(`${config.endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal: controller.signal,
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      max_completion_tokens: 9000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你是严谨的威科夫教学设计师。只根据提供的原书页文制作私人课程，不给实时买卖信号，不承诺收益。只输出合法 JSON。' },
        { role: 'user', content: `生成一个课程阶段对象，必须严格符合下面结构：\n{"id":"...","title":"...","goal":"...","units":[{"id":"...","title":"...","summary":"至少80字，说明供需逻辑并补充ETHUSDT 4h背景/1h结构如何迁移，但不得改变原书原则","source":{"pdfPath":"assets/original.pdf","chapter":"...","pageStart":1,"pageEnd":1},"excerpt":"来自给定原书页的短摘录","keyPoints":["3到6条判断步骤"],"exercise":{"id":"...","prompt":"陌生情境判断题","options":[{"id":"a","label":"..."},{"id":"b","label":"..."},{"id":"c","label":"..."}],"correctOptionId":"a","evidence":[{"id":"e1","label":"可观察价量证据"},{"id":"e2","label":"可观察价量证据"}],"requiredEvidenceIds":["e1"],"explanationPrompt":"要求按看到什么、说明什么、预期什么、如何行动、何时失效解释"}}]}\n\n阶段固定信息：\nid=${plan.id}\ntitle=${plan.title}\n目标主题=${plan.topics.join('；')}\n页码必须在 ${plan.pages[0]}-${plan.pages[1]} 之间。\n必须生成 2 个知识单元，每个主题一个。题目要训练证据链，至少一个选项应为“不交易/证据不足”。不要在题干里暗示答案。\n\n原书材料：\n${packet}` },
      ],
    }),
  }).finally(() => clearTimeout(timeout))
  if (!response.ok) throw new Error(`AI 课程生成失败（HTTP ${response.status}）`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 课程生成返回为空')
  const stage = StageSchema.parse(parseJsonContent(content))
  if (stage.id !== plan.id) throw new Error(`阶段 ID 不匹配：${plan.id}`)
  for (const unit of stage.units) {
    if (unit.source.pageStart < plan.pages[0] || unit.source.pageEnd > plan.pages[1]) throw new Error(`${stage.id} 的来源页码超出范围`)
  }
  return stage
}

export async function generateStageWithRetry(request, limit = 3) {
  let lastError
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    try {
      return await request(attempt)
    } catch (error) {
      lastError = error
      if (attempt < limit) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt))
    }
  }
  throw lastError
}

async function main() {
  const cwd = process.cwd()
  const configPath = process.env.WEIKEFU_API_FILE || path.join(process.env.USERPROFILE || '', 'Desktop', 'APIKEY.txt')
  const config = parseApiConfigText(await readFile(configPath, 'utf8'))
  const source = JSON.parse(await readFile(path.join(cwd, 'private-content', 'original-pages.json'), 'utf8'))
  const draftDirectory = path.join(cwd, 'private-content', 'course-drafts')
  await mkdir(draftDirectory, { recursive: true })
  const stages = []
  for (const [index, plan] of stagePlans.entries()) {
    const draftPath = path.join(draftDirectory, `${plan.id}.json`)
    let stage
    try {
      stage = StageSchema.parse(JSON.parse(await readFile(draftPath, 'utf8')))
      process.stdout.write(`课程阶段 ${index + 1}/7 已从检查点加载\n`)
    } catch {
      stage = await generateStageWithRetry(() => requestStage(config, plan, sourcePacket(source, plan.pages)))
      await writeFile(draftPath, JSON.stringify(stage, null, 2), 'utf8')
      process.stdout.write(`课程阶段 ${index + 1}/7 已生成、校验并保存检查点\n`)
    }
    stages.push(stage)
  }
  const course = validateCourse({ version: 1, stages })
  const output = path.join(cwd, 'private-content', 'course.json')
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(course, null, 2), 'utf8')
  process.stdout.write(`课程已生成：${output}（${course.stages.reduce((sum, stage) => sum + stage.units.length, 0)} 个单元）\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
