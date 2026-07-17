import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'

const OptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  explanation: z.string().min(1),
})

const QuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(OptionSchema).min(3).max(4),
  correctOptionId: z.string().min(1),
  explanation: z.string().min(1),
}).superRefine((question, context) => {
  const ids = question.options.map((option) => option.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: '选项 ID 必须唯一' })
  if (!ids.includes(question.correctOptionId)) context.addIssue({ code: 'custom', message: '正确选项不存在' })
})

const QuestionSetSchema = z.array(QuestionSchema).length(20, '每个知识单元必须生成 20 道题')
const QuestionBatchSchema = z.array(QuestionSchema).length(10, '每批必须生成 10 道题')

export function parseApiConfigText(text) {
  const endpoint = text.match(/https?:\/\/[^\s\r\n]+/i)?.[0]?.replace(/[，。；;]+$/, '')
  const apiKey = text.match(/sk-[A-Za-z0-9_-]+/)?.[0]
  const model = text.match(/gpt-[A-Za-z0-9._-]+/i)?.[0]
  if (!endpoint || !apiKey || !model) throw new Error('APIKEY.txt 缺少接口地址、Key 或模型名称')
  return { endpoint, apiKey, model }
}

export function validateQuestionSet(value) {
  const questions = QuestionSetSchema.parse(value)
  const prompts = questions.map((question) => question.prompt.trim())
  if (new Set(prompts).size !== prompts.length) throw new Error('20 道题的题干必须唯一')
  return questions
}

export function buildSourcePacket(source, pageRange) {
  const pages = source.pages.filter((page) => page.page >= pageRange.pageStart && page.page <= pageRange.pageEnd && page.text?.trim())
  if (!pages.length) throw new Error(`原书第 ${pageRange.pageStart}-${pageRange.pageEnd} 页没有可用文本`)
  const count = Math.min(16, pages.length)
  const selected = []
  for (let index = 0; index < count; index += 1) {
    const page = pages[Math.min(pages.length - 1, Math.floor(index * pages.length / count))]
    if (!selected.some((candidate) => candidate.page === page.page)) selected.push(page)
  }
  return selected.map((page) => `【原书第${page.page}页】\n${page.text.slice(0, 1800)}`).join('\n\n')
}

function parseJsonObject(content) {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('生成接口未返回 JSON 对象')
  return JSON.parse(content.slice(start, end + 1))
}

async function withRetry(operation, limit = 3) {
  let lastError
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt < limit) await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt))
    }
  }
  throw lastError
}

async function requestQuestionBatch(config, unit, sourcePacket, batchIndex, excludedPrompts = [], fetcher = fetch) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  const response = await fetcher(`${config.endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      max_completion_tokens: 8_000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是严谨的《威科夫操盘法》私人题库编辑。只能根据给定原书页文出题。不得引用页文之外的知识，不得提供实时交易信号。只输出合法JSON。',
        },
        {
          role: 'user',
          content: `为下面知识单元生成第${batchIndex}批、恰好10道中文单选题。${batchIndex === 1 ? '本批重点覆盖定义、判断顺序和供需含义。' : '本批重点覆盖努力与结果、常见误判和陌生情境迁移。'}\n\n单元：${unit.title}\n单元摘要：${unit.summary}\n判断要点：${unit.keyPoints.join('；')}\n原书章节：${unit.source.chapter}\n原书页码：${unit.source.pageStart}-${unit.source.pageEnd}\n禁止重复的题干：${excludedPrompts.length ? excludedPrompts.join('｜') : '无'}\n\n输出结构：\n{"questions":[{"id":"q01","prompt":"题干","options":[{"id":"a","label":"选项","explanation":"该选项为什么成立或不成立"},{"id":"b","label":"选项","explanation":"..."},{"id":"c","label":"选项","explanation":"..."}],"correctOptionId":"a","explanation":"结合原书概念说明标准答案"}]}\n\n硬性要求：\n1. 恰好10题，每题3到4个选项且只有一个正确答案。\n2. 不能只是同义改写，不得重复禁止题干。\n3. 每个错误选项都要解释为什么不成立。\n4. 不允许出现“根据以上材料”“原文说”等泄露答题方式的表述。\n5. 不考具体页码，不使用未来行情证明答案。\n\n原书材料：\n${sourcePacket}`,
        },
      ],
    }),
  }).finally(() => clearTimeout(timeout))
  if (!response.ok) throw new Error(`题库生成失败（HTTP ${response.status}）`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('题库生成返回为空')
  return QuestionBatchSchema.parse(parseJsonObject(content).questions)
}

async function loadOutline(contentDirectory) {
  const outlinePath = path.join(contentDirectory, 'course-outline.json')
  try {
    return JSON.parse(await readFile(outlinePath, 'utf8'))
  } catch {
    const coursePath = path.join(contentDirectory, 'course.json')
    const course = JSON.parse(await readFile(coursePath, 'utf8'))
    const outline = {
      stages: course.stages.map((stage) => ({
        id: stage.id,
        title: stage.title,
        goal: stage.goal,
        units: stage.units.map(({ exercise, bookQuestions, ...unit }) => unit),
      })),
    }
    await writeFile(outlinePath, JSON.stringify(outline, null, 2), 'utf8')
    return outline
  }
}

function normalizeQuestionIds(unit, questions) {
  return questions.map((question, index) => ({
    ...question,
    id: `${unit.id}-q-${String(index + 1).padStart(2, '0')}`,
    source: unit.source,
  }))
}

async function main() {
  const cwd = process.cwd()
  const contentDirectory = path.join(cwd, 'private-content')
  const configPath = process.env.WEIKEFU_API_FILE || path.join(process.env.USERPROFILE || '', 'Desktop', 'APIKEY.txt')
  const config = parseApiConfigText(await readFile(configPath, 'utf8'))
  const pages = JSON.parse(await readFile(path.join(contentDirectory, 'original-pages.json'), 'utf8'))
  const outline = await loadOutline(contentDirectory)
  const draftDirectory = path.join(contentDirectory, 'challenge-drafts')
  await mkdir(draftDirectory, { recursive: true })
  const stages = []
  let completed = 0
  const total = outline.stages.reduce((sum, stage) => sum + stage.units.length, 0)

  for (const stage of outline.stages) {
    const units = []
    for (const unit of stage.units) {
      const draftPath = path.join(draftDirectory, `${unit.id}.json`)
      let questions
      if (process.env.WEIKEFU_REGENERATE !== '1') {
        try {
          questions = validateQuestionSet(JSON.parse(await readFile(draftPath, 'utf8')))
        } catch {
          questions = undefined
        }
      }
      if (!questions) {
        const packet = buildSourcePacket(pages, unit.source)
        const firstBatch = await withRetry(() => requestQuestionBatch(config, unit, packet, 1))
        const secondBatch = await withRetry(() => requestQuestionBatch(config, unit, packet, 2, firstBatch.map((question) => question.prompt)))
        questions = validateQuestionSet([...firstBatch, ...secondBatch])
        await writeFile(draftPath, JSON.stringify(questions, null, 2), 'utf8')
      }
      units.push({ ...unit, bookQuestions: normalizeQuestionIds(unit, questions) })
      completed += 1
      process.stdout.write(`原书题库 ${completed}/${total} 已校验\n`)
    }
    stages.push({ ...stage, units })
  }

  const course = { version: 2, stages }
  const allUnits = stages.flatMap((stage) => stage.units)
  if (allUnits.length !== 14 || allUnits.some((unit) => unit.bookQuestions.length !== 20)) {
    throw new Error('最终课程必须包含14个单元和每单元20道题')
  }
  const output = path.join(contentDirectory, 'course.json')
  await writeFile(output, JSON.stringify(course, null, 2), 'utf8')
  process.stdout.write(`原书题库已生成：${output}（${allUnits.length * 20} 道题）\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
