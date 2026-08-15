/**
 * @test_id V9-TEST-MCP-TNCLI-001
 * @covers_docs [技术方案-MCP-SKILL-腾讯新闻-数据采集舱改造方案 §4.2 / §9 / M1]
 *
 * TencentNewsCliBridge 单测（M1 门禁：CLI 调用 / 超时 / GBK 解码）。
 * 本桥接为 Node 宿主侧模块（child_process），按文件级 node 环境运行——
 * jsdom 的 TextDecoder 不支持 gb18030 标签，须用 Node ICU 实现。
 *
 * GBK 测试向量经 PowerShell GetEncoding(936) 实测核准（2026-08-15）：
 * - '腾讯新闻热点'      → CC DA D1 B6 D0 C2 CE C5 C8 C8 B5 E3
 * - '是腾讯新闻的命令行查询工具' → CA C7 CC DA D1 B6 D0 C2 CE C5 B5 C4 C3 FC C1 EE D0 D0 B2 E9 D1 AF B9 A4 BE DF
 */
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'

// mock 工厂保留真实模块：默认 spawn 为真实实现（供端到端用例），
// mock 用例经 mockImplementation 覆盖为假子进程（mockReset 会清空实现，须先 reset 再覆盖）
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: vi.fn(actual.spawn) }
})

import { spawn } from 'node:child_process'
import {
  TencentNewsCliBridge,
  decodeCliBytes,
  CliError,
} from '@/mcp/servers/news/TencentNewsCliBridge'

const mockedSpawn = vi.mocked(spawn)

/** 真实 spawn 实现（mockReset 清空后由端到端用例还原） */
const realSpawn = mockedSpawn.getMockImplementation()!

/**
 * invoke() 内部先 `await import('node:child_process')` 再 spawn、挂 stdout/close 监听；
 * 测试须先 yield 一个 macrotask，待监听挂好后再 emit 事件，否则事件丢失 → 悬空 20s 超时。
 */
async function waitListenersAttached(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

/** GBK('腾讯新闻热点') 实测字节 */
const GBK_TENCENT_NEWS_HOT = Buffer.from([
  0xcc, 0xda, 0xd1, 0xb6, 0xd0, 0xc2, 0xce, 0xc5, 0xc8, 0xc8, 0xb5, 0xe3,
])

/** 构造 spawn 返回的假子进程（stdout/stderr 为 EventEmitter，kill 为 spy） */
function makeFakeChild(): {
  child: ChildProcess
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
} {
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  const kill = vi.fn()
  const child = Object.assign(new EventEmitter(), { stdout, stderr, kill }) as unknown as ChildProcess
  return { child, stdout, stderr, kill }
}

describe('decodeCliBytes — 自适应编码解码（技术方案 §4.2 关键交付）', () => {
  it('UTF-8 中文输出：原样解码（CLI 实测真实形态）', () => {
    const text = 'tencent-news-cli 是腾讯新闻的命令行查询工具'
    expect(decodeCliBytes(Buffer.from(text, 'utf-8'))).toBe(text)
  })

  it('GBK 中文输出：正确解码为中文（若按 UTF-8 读会得 U+FFFD 乱码）', () => {
    // 按错误编码路径自证：宽松 UTF-8 解 GBK 必产生 replacement char
    expect(decodeCliBytes(GBK_TENCENT_NEWS_HOT)).toBe('腾讯新闻热点')
    expect(new TextDecoder('utf-8').decode(GBK_TENCENT_NEWS_HOT)).toContain('\uFFFD')
  })

  it('ASCII 输出：三种解码路径幂等', () => {
    expect(decodeCliBytes(Buffer.from('Usage: tencent-news-cli [command]', 'ascii'))).toBe(
      'Usage: tencent-news-cli [command]',
    )
  })

  it('既非 UTF-8 亦非 GBK 的坏字节：宽松保底不抛错，坏字节降级为 U+FFFD', () => {
    // 0x80/0xFF 在 UTF-8 与 gb18030 中均非法（gb18030 四字节序列需合法跟随字节）
    const bad = Buffer.from([0x41, 0x80, 0xff, 0xfe, 0x42])
    const out = decodeCliBytes(bad)
    expect(out).toContain('A')
    expect(out).toContain('B')
    expect(out).toContain('\uFFFD')
  })

  it('空缓冲：返回空串', () => {
    expect(decodeCliBytes(Buffer.alloc(0))).toBe('')
  })
})

describe('TencentNewsCliBridge.invoke — CLI 调用链路', () => {
  beforeEach(() => {
    mockedSpawn.mockReset()
  })

  it('GBK stdout 分片跨多字节边界：先拼接全部字节再解码，无乱码', async () => {
    const { child, stdout } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)

    const bridge = new TencentNewsCliBridge({ bin: 'fake-bin' })
    const p = bridge.invoke('hot')
    await waitListenersAttached()

    // 模拟 stream 把 GBK 双字节序列从中间切断（0xCC | DA D1 ...）
    stdout.emit('data', GBK_TENCENT_NEWS_HOT.subarray(0, 1))
    stdout.emit('data', GBK_TENCENT_NEWS_HOT.subarray(1))
    child.emit('close', 0)

    await expect(p).resolves.toBe('腾讯新闻热点')
    expect(mockedSpawn).toHaveBeenCalledWith(
      'fake-bin',
      ['hot'],
      expect.objectContaining({ windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
    )
  })

  it('UTF-8 stdout：正常解码返回', async () => {
    const { child, stdout } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)

    const bridge = new TencentNewsCliBridge({ bin: 'fake-bin' })
    const p = bridge.invoke('search', '数据要素 --limit 20')
    await waitListenersAttached()

    stdout.emit('data', Buffer.from('数据要素相关新闻', 'utf-8'))
    child.emit('close', 0)

    await expect(p).resolves.toBe('数据要素相关新闻')
    expect(mockedSpawn).toHaveBeenCalledWith('fake-bin', ['search', '数据要素', '--limit', '20'], expect.anything())
  })

  it('非零退出：CliError(kind=nonzero)，错误 tail 按 GBK 解码后展示', async () => {
    const { child, stderr } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)

    const bridge = new TencentNewsCliBridge({ bin: 'fake-bin' })
    const p = bridge.invoke('hot')
    await waitListenersAttached()

    stderr.emit('data', GBK_TENCENT_NEWS_HOT)
    child.emit('close', 1)

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(CliError)
    expect((err as CliError).kind).toBe('nonzero')
    expect((err as CliError).message).toContain('腾讯新闻热点')
  })

  it('超时即杀：reject CliError(kind=timeout) 并 kill(SIGKILL)，绝不挂起', async () => {
    // 用真实短超时（50ms）而非 fake timers：sinon 伪造计时器默认连 setImmediate 一起伪造，
    // 会破坏 waitListenersAttached 的 yield 语义；50ms 真等待足够快且确定性等价。
    const { child, kill } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)

    const bridge = new TencentNewsCliBridge({ bin: 'fake-bin', timeoutMs: 50 })
    const p = bridge.invoke('search', '金融科技')
    await expect(p).rejects.toMatchObject({ kind: 'timeout' })

    expect(kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('spawn 失败（如 bin 不存在）：CliError(kind=spawn)', async () => {
    const { child } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)

    const bridge = new TencentNewsCliBridge({ bin: 'fake-bin' })
    const p = bridge.invoke('hot')
    await waitListenersAttached()
    child.emit('error', new Error('ENOENT: no such file or directory'))

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(CliError)
    expect((err as CliError).kind).toBe('spawn')
    expect((err as CliError).message).toContain('ENOENT')
  })

  it('空输出（退出码 0 但 stdout 为空）：CliError(kind=empty)', async () => {
    const { child } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)

    const bridge = new TencentNewsCliBridge({ bin: 'fake-bin' })
    const p = bridge.invoke('morning')
    await waitListenersAttached()
    child.emit('close', 0)

    const err = await p.then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(CliError)
    expect((err as CliError).kind).toBe('empty')
  })

  it('bin 解析优先级：options.bin > TENCENT_NEWS_CLI env > 预装落盘路径', async () => {
    const { child, stdout } = makeFakeChild()
    mockedSpawn.mockImplementation(() => child)
    const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
    const exe = process.platform === 'win32' ? 'tencent-news-cli.exe' : 'tencent-news-cli'
    const expectedDefault = `${home}/.tencent-news-cli/bin/${exe}`

    // 1) 显式覆盖最高优先
    const b1 = new TencentNewsCliBridge({ bin: 'explicit-bin' })
    const p1 = b1.invoke('apikey-get')
    await waitListenersAttached()
    stdout.emit('data', Buffer.from('ok'))
    child.emit('close', 0)
    await p1
    expect(mockedSpawn).toHaveBeenLastCalledWith('explicit-bin', ['apikey-get'], expect.anything())

    // 2) env 次之
    process.env.TENCENT_NEWS_CLI = 'env-bin'
    try {
      const b2 = new TencentNewsCliBridge()
      const p2 = b2.invoke('apikey-get')
      await waitListenersAttached()
      stdout.emit('data', Buffer.from('ok'))
      child.emit('close', 0)
      await p2
      expect(mockedSpawn).toHaveBeenLastCalledWith('env-bin', ['apikey-get'], expect.anything())
    } finally {
      delete process.env.TENCENT_NEWS_CLI
    }

    // 3) 缺省走预装落盘路径
    const b3 = new TencentNewsCliBridge()
    const p3 = b3.invoke('apikey-get')
    await waitListenersAttached()
    stdout.emit('data', Buffer.from('ok'))
    child.emit('close', 0)
    await p3
    expect(mockedSpawn).toHaveBeenLastCalledWith(expectedDefault, ['apikey-get'], expect.anything())
  })
})

describe('TencentNewsCliBridge.isAvailable', () => {
  beforeEach(() => {
    mockedSpawn.mockReset()
  })

  it('缺省 bin 指向预装落盘路径：预装机器 available=true（环境自适应断言，CI 未装则 false）', async () => {
    const bridge = new TencentNewsCliBridge()
    const ok = await bridge.isAvailable()

    const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
    const exe = process.platform === 'win32' ? 'tencent-news-cli.exe' : 'tencent-news-cli'
    const fs = await import('node:fs/promises')
    const exists = await fs
      .access(`${home}/.tencent-news-cli/bin/${exe}`)
      .then(
        () => true,
        () => false,
      )
    expect(ok).toBe(exists)
  })

  it('bin 不存在：available=false（不抛错，供上层降级）', async () => {
    const bridge = new TencentNewsCliBridge({ bin: 'Z:/definitely/not/exist/cli.exe' })
    expect(await bridge.isAvailable()).toBe(false)
  })
})

describe('CliError', () => {
  it('携带 kind 分类与名称', () => {
    const e = new CliError('boom', 'timeout')
    expect(e.name).toBe('CliError')
    expect(e.kind).toBe('timeout')
    expect(e.message).toBe('boom')
  })
})

// ============================================================
// 真实乱码场景 — 真实子进程管道端到端（不 mock child_process）
//
// 用 bin=process.execPath 把桥接器指向 node 本身，子进程经 `node -e <script>`
// 向真实 stdout 管道写入原始字节，走完整 spawn → pipe → chunk 收集 → 拼接 →
// 自适应解码链路，验证真实 GBK 乱码场景下的解码逻辑。
//
// GBK 载荷（153 字节）经 PowerShell GetEncoding(936) 实测核准（2026-08-16），
// 对应文本：
//   tencent-news-cli hot --limit 3
//   【热点】腾讯新闻：数据采集行业动态，数据要素市场加速发展。
//   【早报】金融科技资讯；算力基础设施投入持续增长、政策利好释放。
// 分片点选在首个 GBK 双字节序列（【=A1 BE）中间：PART1 以 lead byte 0xA1 结尾、
// PART2 以 trail byte 0xBE 开头——天然构造「多字节序列被 chunk 切断」的真实管道形态。
// ============================================================

/** 期望解码文本（GBK 载荷的原文） */
const GBK_SIM_EXPECTED =
  'tencent-news-cli hot --limit 3\n' +
  '【热点】腾讯新闻：数据采集行业动态，数据要素市场加速发展。\n' +
  '【早报】金融科技资讯；算力基础设施投入持续增长、政策利好释放。\n'

/** PART1（32B）：ASCII 行 + \n + 【的 lead byte 0xA1（与 PART2 拼回后为完整 GBK 序列） */
const GBK_SIM_PART1 = [
  0x74, 0x65, 0x6e, 0x63, 0x65, 0x6e, 0x74, 0x2d, 0x6e, 0x65, 0x77, 0x73, 0x2d, 0x63, 0x6c, 0x69,
  0x20, 0x68, 0x6f, 0x74, 0x20, 0x2d, 0x2d, 0x6c, 0x69, 0x6d, 0x69, 0x74, 0x20, 0x33, 0x0a, 0xa1,
] as const

/** PART2（121B）：自 【的 trail byte 0xBE 起至文末 */
const GBK_SIM_PART2 = [
  0xbe, 0xc8, 0xc8, 0xb5, 0xe3, 0xa1, 0xbf, 0xcc, 0xda, 0xd1, 0xb6, 0xd0, 0xc2, 0xce, 0xc5, 0xa3,
  0xba, 0xca, 0xfd, 0xbe, 0xdd, 0xb2, 0xc9, 0xbc, 0xaf, 0xd0, 0xd0, 0xd2, 0xb5, 0xb6, 0xaf, 0xcc,
  0xac, 0xa3, 0xac, 0xca, 0xfd, 0xbe, 0xdd, 0xd2, 0xaa, 0xcb, 0xd8, 0xca, 0xd0, 0xb3, 0xa1, 0xbc,
  0xd3, 0xcb, 0xd9, 0xb7, 0xa2, 0xd5, 0xb9, 0xa1, 0xa3, 0x0a, 0xa1, 0xbe, 0xd4, 0xe7, 0xb1, 0xa8,
  0xa1, 0xbf, 0xbd, 0xf0, 0xc8, 0xda, 0xbf, 0xc6, 0xbc, 0xbc, 0xd7, 0xca, 0xd1, 0xb6, 0xa3, 0xbb,
  0xcb, 0xe3, 0xc1, 0xa6, 0xbb, 0xf9, 0xb4, 0xa1, 0xc9, 0xe8, 0xca, 0xa9, 0xcd, 0xb6, 0xc8, 0xeb,
  0xb3, 0xd6, 0xd0, 0xf8, 0xd4, 0xf6, 0xb3, 0xa4, 0xa1, 0xa2, 0xd5, 0xfe, 0xb2, 0xdf, 0xc0, 0xfb,
  0xba, 0xc3, 0xca, 0xcd, 0xb7, 0xc5, 0xa1, 0xa3, 0x0a,
] as const

describe('真实乱码场景 — 真实子进程管道输出 GBK 字节（端到端，不 mock）', () => {
  beforeEach(() => {
    mockedSpawn.mockReset()
    mockedSpawn.mockImplementation(realSpawn) // 还原真实 spawn，走真实管道
  })

  it('模拟真 GBK CLI 输出：解码精确还原中文，无 U+FFFD、无 GBK 显示乱码', async () => {
    const bridge = new TencentNewsCliBridge({ bin: process.execPath, timeoutMs: 10_000 })
    // node -e 脚本（无空格/引号，规避 tokenize 切分）：两次 write 模拟真实管道 chunk 分片
    const script =
      `process.stdout.write(Buffer.from([${GBK_SIM_PART1.join(',')}]));` +
      `process.stdout.write(Buffer.from([${GBK_SIM_PART2.join(',')}]))`
    const out = await bridge.invoke('-e', script)

    expect(out).toBe(GBK_SIM_EXPECTED)
    expect(out).not.toContain('\uFFFD')
    // 若桥接层误按 UTF-8 解码（未回退 gb18030），此处会出现典型乱码字符（如 备/鏂/椂 类）
    expect(out).not.toMatch(/[鏄吘璁柊椂囧璁銆]/)
  })

  it('同一管道按 UTF-8 输出（CLI v1.0.14 实测形态）：优先 UTF-8 不误判为 GBK', async () => {
    const bridge = new TencentNewsCliBridge({ bin: process.execPath, timeoutMs: 10_000 })
    // 同一段中文以 UTF-8 写出：UTF-8 字节恰好也能被 gb18030「合法」解码成乱码（鏄吘璁 悖论），
    // 本用例钉死「严格 UTF-8 优先」的判定顺序，防止解码顺序回归。
    // 载荷经 hex 传递（无空格/换行/引号，规避 tokenize 切分与 JS 字符串跨行限制）
    const hex = Buffer.from(GBK_SIM_EXPECTED, 'utf8').toString('hex')
    const script = `process.stdout.write(Buffer.from('${hex}','hex'))`
    const out = await bridge.invoke('-e', script)

    expect(out).toBe(GBK_SIM_EXPECTED)
    expect(out).not.toContain('\uFFFD')
  })
})

// afterEach 兜底清理 env（bin 优先级用例内已 try/finally 删除；此处防漏）
afterEach(() => {
  delete process.env.TENCENT_NEWS_CLI
})
