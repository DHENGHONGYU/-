# V9 Embedding 数据一致性守护 — 向量指纹漂移排查 + 回滚决策流程实战培训

> **培训对象**: 运维团队 / SRE / 平台工程
> **版本**: v1.2.0 · 2026-08-07
> **总时长**: 约 90 分钟
> **配套文档**: `DEPLOY-OPS-MANUAL.md` / `ROLLBACK-v1.2.0-to-v1.1.0.md` / `OPS-CHEATSHEET-FINGERPRINT.md`

---

## Slide 1: 封面 (1 min)

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║        V9 Embedding 数据一致性守护                                ║
║        向量指纹漂移排查 + 回滚决策流程实战培训                    ║
║                                                                  ║
║        —— 让每一次模型变更都"有迹可循, 可证可回滚"               ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  讲师:    V9 平台工程组                                          ║
║  版本:    v1.2.0                                                 ║
║  日期:    2026-08-07                                             ║
║  时长:    约 90 分钟                                             ║
║  适用对象: 运维 / SRE / 平台工程                                 ║
╚══════════════════════════════════════════════════════════════════╝
```

**培训背景**

V9 系统升级到 v1.2.0 后, Embedding 服务的模型版本、维度、推理代码任何一处变更,
都会导致向量空间漂移, 进而引发下游检索召回率断崖式下跌。
本次培训旨在让运维团队掌握向量指纹验证工具的使用方法,
在升级/回滚场景中快速识别漂移、正确决策、规范操作。

---

## Slide 2: 培训目标 & 考核方式 (3 min)

### 培训后, 学员必须能回答以下 3 个核心问题

| # | 核心问题 | 验证方式 |
|---|---------|---------|
| Q1 | 向量指纹是什么? 4 层断言分别检查什么? 哪些是硬阻断, 哪些是非阻塞? | 口头问答 |
| Q2 | 回滚后 `[FAIL] Check 2 指纹漂移! 当前=abc, 基线=def`, 接下来 10 秒内该做什么? | 实操演练 |
| Q3 | 什么情况下必须立即回滚? 3 条红线分别是什么? | 口头问答 |

### 考核方式

- **实操考核 (70%)**: 每人独立完成现场演练 Demo (Slide 13), 包括生成基线、两步验证、退出码解读
- **口头问答 (30%)**: 围绕 3 个核心问题展开, 允许查手册但不允许查笔记

### 提供材料

| 材料 | 位置 | 用途 |
|------|------|------|
| 培训大纲 | `TRAINING-PPT-OUTLINE.md` (本文件) | 培训主线 |
| 部署操作手册 | `DEPLOY-OPS-MANUAL.md` | 日常运维参考 |
| 验证脚本 | `verify-embedding-fingerprint.py` | 核心工具 |
| E2E 仿真 | `e2e-rollback-fingerprint-sim.py` | 演示与练习 |
| Helm Chart | `helm/fingerprint-verify/` | K8s 部署 |
| 速查表 | `OPS-CHEATSHEET-FINGERPRINT.md` | 应急卡 |

---

## Slide 3: 指纹技术原理 (8 min) ⭐ 核心

### 3.1 什么是向量指纹

**定义**: 对 Embedding 服务返回的向量, 取每条向量的前 8 个浮点数,
按大端序 (`>f`) 打包成字节, 拼接后做 SHA256, 取前 16 个十六进制字符。

**算法实现** (摘自 `verify-embedding-fingerprint.py`):

```python
def compute_vector_fingerprint(vectors, head=8):
    """Take first `head` floats from each vector, pack as big-endian float (>f),
    then SHA256[:16] of the concatenated bytes."""
    buf = bytearray()
    for vec in vectors:
        for i in range(min(head, len(vec))):
            buf += struct.pack(">f", float(vec[i]))
    return hashlib.sha256(bytes(buf)).hexdigest()[:16]
```

### 3.2 为什么取前 8 个浮点数

| 候选方案 | 字节数 (3 向量) | 灵敏度 | 性能 | 选用? |
|---------|----------------|--------|------|------|
| 前 1 个 float | 12 B | 太低, 容易碰撞 | 极快 | ✗ |
| 前 4 个 float | 48 B | 中等 | 快 | ✗ |
| **前 8 个 float** | **96 B** | **高, 区分度足够** | **快 (<1ms)** | **✓** |
| 全 384 维 | 4608 B | 极高 | 慢 (网络+哈希) | ✗ |

**平衡点**: 前 8 个 float 既能在 float32→float16 精度丢失、模型切换、代码改写等场景下稳定触发漂移,
又能把单次哈希开销控制在 1ms 以内, 避免影响 CI 流水线节奏。

### 3.3 4 层断言架构

```
┌────────────────────────────────────────────────────────────────────┐
│              V9 Embedding 指纹验证 — 4 层断言架构                  │
└────────────────────────────────────────────────────────────────────┘

  客户端 POST /api/embed/embed (3 条 fixture 文本)
                │
                ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Check 1: 元数据基线 (硬阻断)                                  │
  │   字段: model_id / dim / max_batch / loaded                  │
  │   期望: all-MiniLM-L6-v2 / 384 / 64 / true                   │
  │   来源: GET /api/embed/config                                 │
  │   失败: exit 1 (fail-fast 立即终止)                           │
  └──────────────────────────────────────────────────────────────┘
                │ PASS
                ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Check 2: 向量指纹 SHA256[:16] (硬阻断) ⭐ 核心                │
  │   输入: 3 条 fixture 文本经 Embedding 推理后的向量            │
  │   算法: 前 8 float → 大端 >f 打包 → SHA256 → [:16]            │
  │   比对: current_sha == --baseline ?                          │
  │   失败: exit 1, 输出 "指纹漂移! 当前=xxx, 基线=yyy"           │
  └──────────────────────────────────────────────────────────────┘
                │ PASS
                ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Check 3: 批量维度 (硬阻断)                                    │
  │   期望: 3 vectors × 384 dim (每条向量维度必须等于 384)        │
  │   校验: len(vectors)==3 且 all(len(v)==384)                   │
  │   失败: exit 1 (如 dim=0 服务异常, dim=385 调试代码泄漏)      │
  └──────────────────────────────────────────────────────────────┘
                │ PASS
                ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Check 4: 运行时参数 (非阻塞)                                  │
  │   字段: slow_threshold_ms / uvicorn_workers                   │
  │   期望: 500 / 1                                               │
  │   失败: 仅 [WARN], 不影响 exit code                           │
  └──────────────────────────────────────────────────────────────┘
                │
                ▼
        exit 0  ✓ 全部通过
```

### 3.4 为什么这套机制有效

**核心原理**: 确定性模型对相同输入产生相同输出。
`all-MiniLM-L6-v2` 是确定性模型 (无随机性), 给定相同的 3 条 fixture 文本,
输出的向量必然逐位一致。任何导致向量变化的因素 (模型切换、精度丢失、代码改写),
都会在前 8 个 float 中体现, 进而被 SHA256 捕获。

> **讲师提示**: 强调"确定性"是整个机制的地基。如果未来引入带 dropout 的模型,
> 需要额外关闭随机性或采用统计指纹方案。

---

## Slide 4: 指纹漂移的 4 种类型 (7 min)

### 4.1 漂移分类全景

```
┌─────────────────────────────────────────────────────────────────┐
│                    指纹漂移 4 种类型                             │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  Type 1      │  Type 2      │  Type 3      │  Type 4           │
│  模型切换    │  维度漂移    │  精度丢失    │  代码/配置变更    │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ model_id 变  │ dim 384→385  │ float32→     │ 同模型, 同维度,   │
│              │ 或 dim=0     │ float16      │ 但推理代码改写    │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ Check 1 + 2  │ Check 3      │ Check 2      │ Check 2           │
│ 双重捕获     │ 单层捕获     │ 单层捕获     │ 单层捕获          │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ 严重: P0     │ 严重: P0     │ 严重: P1     │ 中等: P2          │
└──────────────┴──────────────┴──────────────┴───────────────────┘
```

### 4.2 各类型详解

#### Type 1: 模型切换 (model_id 变更)

| 维度 | 内容 |
|------|------|
| **根因** | 部署时误用 `paraphrase-MiniLM-L6-v2` 或 `bge-large-zh` 替代 `all-MiniLM-L6-v2`; HF_HOME 环境变量被覆盖导致加载缓存中的其他模型 |
| **检测** | Check 1 (model_id 字段不匹配) + Check 2 (指纹漂移) 双重捕获 |
| **严重级别** | **P0 致命** — 向量空间完全不同, 检索召回率归零 |
| **特征** | `model_id` 字段直接暴露, 最易识别 |

#### Type 2: 维度漂移 (384→385 或 dim=0)

| 维度 | 内容 |
|------|------|
| **根因** | 调试代码泄漏 (如开发者临时在向量末尾追加一个 metadata float, 忘记删除); 部署脚本与代码版本不匹配; 服务启动异常导致 dim=0 |
| **检测** | Check 3 (批量维度校验) 单层捕获 |
| **严重级别** | **P0 致命** — 下游索引构建失败或向量错位 |
| **特征** | `dim=385` (调试代码) 或 `dim=0` (服务异常) |

#### Type 3: 精度丢失 (float32→float16)

| 维度 | 内容 |
|------|------|
| **根因** | 显存优化时把模型权重从 float32 降到 float16; 量化部署 (INT8/FP16) 未走评审; 推理框架默认精度变更 |
| **检测** | Check 2 (指纹漂移) 单层捕获 — Check 1 元数据不变, Check 3 维度不变, 但 float 值低位字节不同 |
| **严重级别** | **P1 严重** — 召回率下降但不会归零, 难以被业务监控及时发现 |
| **特征** | model_id 和 dim 都正确, 仅指纹变化, 最隐蔽 |

#### Type 4: 代码/配置变更 (同模型, 不同推理代码)

| 维度 | 内容 |
|------|------|
| **根因** | 推理代码改写 (如 normalize 顺序调整、padding 策略变更); tokenizer 配置变更; 预处理逻辑调整 |
| **检测** | Check 2 (指纹漂移) 单层捕获 |
| **严重级别** | **P2 中等** — 视变更范围, 可能影响召回也可能不影响, 需人工评估 |
| **特征** | model_id / dim / 精度均正常, 仅指纹变化, 需结合代码 diff 判断是否预期 |

### 4.3 检测覆盖矩阵

| 漂移类型 | Check 1 元数据 | Check 2 指纹 | Check 3 维度 | Check 4 运行时 |
|---------|:--------------:|:------------:|:------------:|:--------------:|
| Type 1 模型切换 | ✅ FAIL | ✅ FAIL | — | — |
| Type 2 维度漂移 | — | — | ✅ FAIL | — |
| Type 3 精度丢失 | — | ✅ FAIL | — | — |
| Type 4 代码变更 | — | ✅ FAIL | — | — |

> **讲师提示**: Check 2 是"万能捕获层", 但单靠 Check 2 无法区分 Type 3 和 Type 4,
> 需结合代码 diff 和部署日志判断。

---

## Slide 5: 指纹漂移识别方法 (6 min)

### 5.1 退出码速查

```
┌──────────────────────────────────────────────────┐
│  退出码    含义             后续动作              │
├──────────────────────────────────────────────────┤
│  0         全部 Check 通过  关闭工单 / 合并 PR    │
│  1         指纹漂移或        进 FAQ-P1/P2/P3 排查 │
│            元数据不匹配                            │
│  2         服务不可达        检查 Embedding       │
│            (health 探测失败)  Service / Pod       │
└──────────────────────────────────────────────────┘
```

### 5.2 Check 2 失败消息格式

```
[FAIL] Check 2 失败: 指纹漂移! 当前=abc123def456abc1, 基线=1f1f307f2eab7e11
```

**字段解读**:
- `当前=abc123def456abc1`: 当前服务返回向量算出的指纹 (16 hex)
- `基线=1f1f307f2eab7e11`: `--baseline` 参数或 ConfigMap 中记录的 v1.1.0 基线

### 5.3 双机对比法 (10 秒定位)

**场景**: 回滚后 Check 2 仍然 FAIL, 需要判断是"基线错了"还是"真的还在漂移"。

**操作**: 在基线机器 (已知正常的 v1.1.0) 和当前机器 (待验证) 上分别跑一条 python 单行命令,
对比 `v[i][:4]` (每条向量的前 4 个浮点数):

```bash
# 在两台机器上分别执行 (替换 HOST/PORT)
python3 -c "
import urllib.request, json
body = json.dumps({'texts': ['The quick brown fox jumps over the lazy dog'], 'normalize': True}).encode()
req = urllib.request.Request('http://HOST:8001/api/embed/embed', data=body, headers={'Content-Type':'application/json'}, method='POST')
resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
vecs = resp.get('vectors') or resp.get('data',{}).get('vectors')
for i, v in enumerate(vecs):
    print(f'v[{i}][:4] = {v[:4]}')
"
```

### 5.4 决策树

```
                   双机对比 v[i][:4]
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
     v[i][:4] 相同              v[i][:4] 不同
            │                         │
            ▼                         ▼
    ┌───────────────┐         ┌───────────────┐
    │ 指纹却不同    │         │ 真实漂移      │
    │ → 基线版本    │         │ → 模型/代码/  │
    │   抄错了      │         │   精度确有变更│
    │ → 重新 --gen- │         │ → 执行回滚    │
    │   baseline    │         │   或联系开发  │
    └───────────────┘         └───────────────┘
```

**解读**:
- **v[i][:4] 相同 + 指纹不同**: 基本不可能 (除非哈希算法实现不同), 实际是基线 SHA 抄错版本, 重新 `--gen-baseline` 生成正确基线
- **v[i][:4] 不同**: 确实还在漂移, 回滚未生效或回滚到了错误版本, 联系开发排查

> **讲师提示**: 这个决策树是 Slide 8 FAQ-P1 实战的核心逻辑, 务必让学员记住"先比 v[i][:4], 再下结论"。

---

## Slide 6: 回滚决策流程树 (10 min) ⭐ 核心

### 6.1 完整回滚决策流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                     回滚决策流程树                                   │
│              核心原则: 先取证据, 再做决策                            │
└─────────────────────────────────────────────────────────────────────┘

  【触发条件】
  ┌──────────────────────────────────────────────────────────────┐
  │ T1: P95 延迟 > 500ms 持续 5 分钟                             │
  │ T2: 下游业务方提工单 (检索召回率异常 / 报错率上升)           │
  │ T3: 发布经理审批同意回滚                                     │
  │                                                              │
  │ 满足 T2 + T3 即可启动回滚 (T1 为辅助信号)                    │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Step 1: 取证据 (禁止盲目回滚!)                               │
  │                                                              │
  │  ① kubectl logs job/fp-verify-... -c verifier               │
  │  ② 记录: 哪个 Check FAIL? 退出码? 当前指纹? 基线指纹?        │
  │  ③ 如条件允许, 跑双机对比 v[i][:4]                            │
  │  ④ 截图/保存日志, 作为回滚依据                               │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Step 2: 证据分类                                              │
  │                                                              │
  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
  │  │ Check 1 FAIL    │  │ Check 2 FAIL    │  │ Check 3 FAIL │ │
  │  │ model_id 不匹配 │  │ 指纹漂移        │  │ 维度异常     │ │
  │  │ → Type 1 模型   │  │ → Type 3/4      │  │ → Type 2     │ │
  │  │   切换          │  │   精度/代码变更 │  │   调试代码   │ │
  │  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
  └───────────┼────────────────────┼─────────────────┼─────────┘
              │                    │                 │
              └────────────────────┼─────────────────┘
                                   │
                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Step 3: 执行回滚 (§3.1 备份恢复, 约 3 分钟)                  │
  │                                                              │
  │  ① kubectl rollout undo deployment/v9-embedding              │
  │  ② kubectl rollout status deployment/v9-embedding            │
  │     --timeout=5m                                             │
  │  ③ 等待 Pod 全部 Running                                     │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Step 4: 验证回滚结果                                         │
  │                                                              │
  │  ① helm upgrade --install fp-verify ...                      │
  │     --set baseline.sha="1f1f307f2eab7e11"                    │
  │  ② kubectl wait job/... --for=condition=Complete            │
  │  ③ kubectl logs job/... -c verifier                          │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
            ┌──────────────┐  ┌──────────────┐
            │ 指纹 PASS    │  │ 指纹仍 FAIL  │
            │ exit=0       │  │ exit=1       │
            │              │  │              │
            │ → 关闭工单   │  │ → 进 Slide 8 │
            │ → 通知业务方 │  │   FAQ-P1     │
            │   恢复正常   │  │   排查       │
            └──────────────┘  └──────────────┘
```

### 6.2 核心原则: "先取证据, 再做决策"

```
   ❌ 错误做法                    ✅ 正确做法
  ┌──────────────────┐          ┌──────────────────┐
  │ 收到工单 →       │          │ 收到工单 →       │
  │ 直接 rollout     │          │ ① 取 Job 日志    │
  │ undo →           │          │ ② 分类证据      │
  │ 跑验证 →         │          │ ③ 记录基线/当前 │
  │ 发现还是 FAIL →  │          │ ④ 再决定回滚    │
  │ 不知道回滚到哪   │          │ ⑤ 回滚后验证    │
  └──────────────────┘          └──────────────────┘
```

**为什么不能盲目回滚**:
- 如果是"基线抄错"导致的 Check 2 FAIL, 回滚毫无意义, 反而中断正常服务
- 如果是"调试代码泄漏"导致的 Check 3 FAIL, 回滚到 v1.1.0 可能有效, 但根因没解决, 下次升级还会犯
- 取证据只需 10 秒 (一条 kubectl logs), 但能避免 30 分钟的无效回滚

> **讲师提示**: 这是本次培训最重要的 10 分钟。让学员把"先取证据, 再做决策"默念 3 遍。

---

## Slide 7: 回滚触发条件 & 评估标准 (5 min)

### 7.1 三条红线

```
┌──────────────────────────────────────────────────────────────────┐
│                      回滚三条红线                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 硬红线 (Hard Red Line) — 立即回滚                            │
│     Check 1 / Check 2 / Check 3 任一 FAIL                       │
│     无需审批, 验证脚本 exit=1 即触发                            │
│                                                                  │
│  🟡 软红线 (Soft Red Line) — 评估后回滚                          │
│     CPU 或内存占用 +20% 持续 10 分钟                            │
│     需 SRE 确认非流量峰值, 联系开发评估                          │
│                                                                  │
│  🟠 业务红线 (Business Red Line) — 审批后回滚                    │
│     下游 API 错误率 > 1% + 发布经理审批同意                     │
│     需业务方提工单 + 发布经理签字                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 评估矩阵: Check 失败 → 动作

| 失败的 Check | 漂移类型 | 严重级别 | 是否回滚 | 回滚目标 | 回滚后动作 |
|:---:|:---:|:---:|:---:|:---:|---|
| Check 1 (model_id) | Type 1 模型切换 | P0 | ✅ 立即 | v1.1.0 | 重新验证指纹 |
| Check 2 (指纹) | Type 3 精度 / Type 4 代码 | P1/P2 | ✅ 评估后 | v1.1.0 | 双机对比确认 |
| Check 3 (维度) | Type 2 调试代码 | P0 | ✅ 立即 | v1.1.0 | 检查 deploy.sh 版本 |
| Check 4 (运行时) | — | P3 | ❌ 不回滚 | — | 调整 slow_threshold / workers |
| 服务不可达 (exit=2) | — | — | ❌ 不回滚 | — | 检查 Service / Pod 状态 |

### 7.3 审批权限

| 红线类型 | 审批人 | 响应时限 |
|---------|--------|---------|
| 硬红线 | 无需审批 (自动化) | 立即 |
| 软红线 | SRE oncall | 15 分钟 |
| 业务红线 | 发布经理 + 业务方 | 30 分钟 |

> **讲师提示**: 硬红线是"机器说了算", 软红线和业务红线是"人说了算"。
> 自动化脚本 `--fail-fast` 只覆盖硬红线场景。

---

## Slide 8: FAQ-P1 实战: Check 2 指纹漂移排查 (8 min) ⭐

### 8.1 场景

```
回滚 v1.2.0 → v1.1.0 后, 重新跑验证脚本:

[FAIL] Check 2 失败: 指纹漂移! 当前=abc123def456abc1, 基线=1f1f307f2eab7e11

退出码: 1
```

**问题**: 回滚了为什么还漂移? 是回滚没生效, 还是基线错了?

### 8.2 Step 1: 10 秒取证据 (一条命令)

```bash
# 在基线机器 (v1.1.0 正常节点) 和当前机器 (待验证节点) 上分别跑:
python3 -c "
import urllib.request, json, hashlib, struct
body = json.dumps({'texts': ['The quick brown fox jumps over the lazy dog',
  '股票池V9研究状态流转记录', '金融科技 Embedding 服务数据一致性验证'],
  'normalize': True}).encode()
req = urllib.request.Request('http://localhost:8001/api/embed/embed',
  data=body, headers={'Content-Type':'application/json'}, method='POST')
resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
vecs = resp.get('vectors') or resp.get('data',{}).get('vectors')
buf = bytearray()
for v in vecs:
    for i in range(min(8, len(v))): buf += struct.pack('>f', float(v[i]))
print('fingerprint =', hashlib.sha256(bytes(buf)).hexdigest()[:16])
for i, v in enumerate(vecs): print(f'v[{i}][:4] = {v[:4]}')
"
```

**输出对比示例**:

```
基线机器输出:
  fingerprint = 1f1f307f2eab7e11
  v[0][:4] = [0.0123, -0.0456, 0.0789, 0.0234]
  v[1][:4] = [0.0567, 0.0890, -0.0123, 0.0456]
  v[2][:4] = [0.0345, -0.0678, 0.0901, 0.0123]

当前机器输出:
  fingerprint = abc123def456abc1
  v[0][:4] = [0.0123, -0.0456, 0.0789, 0.0234]   ← 相同!
  v[1][:4] = [0.0567, 0.0890, -0.0123, 0.0456]   ← 相同!
  v[2][:4] = [0.0345, -0.0678, 0.0901, 0.0123]   ← 相同!
```

### 8.3 Step 2: 三类根因判定表

| 现象 | 根因 | 严重级别 | 处置动作 |
|------|------|:---:|---|
| v[i][:4] **相同** + 指纹不同 | 基线版本抄错了 (比对了错误的基线 SHA) | P3 | 重新 `--gen-baseline` 生成正确基线, 更新 ConfigMap |
| v[i][:4] **不同** | 真实模型切换 (回滚未生效 / 回滚到错误版本) | P0 | 检查 `rollout undo --to-revision`, 确认回滚目标版本 |
| 指纹相同但 Check 2 FAIL | 比对的基线版本号不对 (如用 v1.0.0 基线验证 v1.1.0) | P2 | 核对 `--baseline` 参数与实际部署版本是否匹配 |

### 8.4 判定流程图

```
            双机对比 v[i][:4]
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
  v[i][:4] 相同            v[i][:4] 不同
      │                         │
      ▼                         ▼
  ┌─────────┐             ┌─────────────┐
  │ 基线抄  │             │ 真实漂移    │
  │ 错版本  │             │ 回滚未生效  │
  │         │             │ 或回滚到    │
  │ 重新    │             │ 错误版本    │
  │ --gen-  │             │             │
  │ baseline│             │ 检查        │
  │ 更新    │             │ --to-revision│
  │ ConfigMap│            │ 联系开发    │
  └─────────┘             └─────────────┘
```

### 8.5 常见误判

| 误判 | 真实原因 | 纠正 |
|------|---------|------|
| "回滚失败了, 再回滚一次" | 基线 SHA 抄错版本 | 先跑双机对比, 确认 v[i][:4] |
| "脚本有 bug" | 比对的基线与部署版本不匹配 | 核对 `--baseline` 参数与版本号 |
| "服务没回滚" | rollout undo 回到了上一个 revision, 但上一个 revision 也是坏的 | 用 `--to-revision` 指定明确的版本 |

> **讲师提示**: 这个场景占生产事故的 60% 以上。让学员牢记"v[i][:4] 相同 = 基线错了, 不是服务错了"。

---

## Slide 9: FAQ-P2/P3 实战: 元数据 & 维度漂移 (7 min)

### 9.1 FAQ-P2: Check 1 FAIL (元数据不匹配)

**现象**:
```
[FAIL] Check 1 失败: model_id mismatch: got=paraphrase-MiniLM-L6-v2,
       expected=all-MiniLM-L6-v2
```

**根因**: `HF_HOME` 环境变量被覆盖, 导致 HuggingFace 缓存目录指向其他位置,
加载了缓存中残留的 `paraphrase-MiniLM-L6-v2` 模型。

**排查命令**:
```bash
# 1. 检查 Pod 的环境变量
kubectl -n v9-embedding exec <embedding-pod> -- env | grep HF_HOME

# 2. 检查 Deployment 的 env 配置
kubectl -n v9-embedding get deployment v9-embedding -o yaml | grep -A2 HF_HOME

# 3. 检查实际加载的模型
kubectl -n v9-embedding exec <embedding-pod> -- \
  curl -s localhost:8001/api/embed/config | python3 -m json.tool
```

**修复**:
```bash
# 修正 HF_HOME 环境变量
kubectl -n v9-embedding set env deployment/v9-embedding \
  HF_HOME=/opt/huggingface

# 等待重启
kubectl -n v9-embedding rollout status deployment/v9-embedding --timeout=5m

# 重新验证
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding --set baseline.sha="1f1f307f2eab7e11"
```

### 9.2 FAQ-P3: Check 3 FAIL (维度异常)

**现象 A** (dim=0):
```
[FAIL] Check 3 失败: count=3 (期望 3), dim=0 (期望 384), all_dim_ok=False
```

**根因 A**: 服务启动异常, 模型未加载完成就接收请求, 返回空向量。

**修复 A**:
```bash
# 检查模型加载状态
kubectl -n v9-embedding exec <embedding-pod> -- \
  curl -s localhost:8001/api/embed/health | python3 -m json.tool
# 若 model_loaded=false, 等待加载或重启 Pod
kubectl -n v9-embedding delete pod <embedding-pod>
```

**现象 B** (dim=385):
```
[FAIL] Check 3 失败: count=3 (期望 3), dim=385 (期望 384), all_dim_ok=False
```

**根因 B**: 调试代码泄漏 — 开发者临时在向量末尾追加了 1 个 metadata float,
忘记在提交前删除。或 `deploy.sh` 部署的代码版本与 v1.2.0 release 不匹配。

**排查 B**:
```bash
# 1. 检查部署的镜像 tag
kubectl -n v9-embedding get deployment v9-embedding -o jsonpath='{.spec.template.spec.containers[0].image}'

# 2. 检查 deploy.sh 中的版本号
grep VERSION deploy-fingerprint-verify.sh

# 3. 检查代码中是否有 append 操作
grep -rn "\.append\|concat\|pad" embedding_service.py | head -20
```

**修复 B**:
```bash
# 回滚到正确版本
kubectl -n v9-embedding rollout undo deployment/v9-embedding

# 或修正 deploy.sh 中的版本号后重新部署
sed -i 's/VERSION=v1.2.0-debug/VERSION=v1.2.0/' deploy-fingerprint-verify.sh
./deploy-fingerprint-verify.sh --baseline 1f1f307f2eab7e11
```

### 9.3 P2/P3 对比总结

| 维度 | FAQ-P2 (Check 1) | FAQ-P3 (Check 3) |
|------|:---:|:---:|
| 失败字段 | model_id | dim |
| 典型值 | paraphrase-MiniLM-L6-v2 | 0 或 385 |
| 根因 | HF_HOME 覆盖 | 调试代码 / 版本不匹配 |
| 严重级别 | P0 | P0 |
| 修复方式 | 修正环境变量 | 回滚 / 修正 deploy.sh |

> **讲师提示**: P2 和 P3 都是"配置/部署错误"而非"模型本身问题", 修复后无需重新训练或调整模型。

---

## Slide 10: E2E 回滚仿真演示 (8 min)

### 10.1 6 阶段仿真概览

```
┌──────────────────────────────────────────────────────────────────┐
│                  E2E 回滚指纹仿真 — 6 阶段                       │
└──────────────────────────────────────────────────────────────────┘

 Phase 1                Phase 2                Phase 3-5
 基线建立               合规升级               三类事故注入
┌──────────┐           ┌──────────┐           ┌──────────┐
│ v1.1.0   │           │ v1.2.0   │           │ Phase 3: │
│ 生成基线 │ ────────► │ 指纹不变 │ ────────► │ 模型切换 │
│ SHA      │           │ PASS     │           │ Type 1   │
└──────────┘           └──────────┘           ├──────────┤
                                              │ Phase 4: │
                                              │ 维度漂移 │
                                              │ Type 2   │
                                              ├──────────┤
                                              │ Phase 5: │
                                              │ 精度丢失 │
                                              │ Type 3   │
                                              └─────┬────┘
                                                    │
                                                    ▼
                                              Phase 6
                                              回滚恢复
                                              ┌──────────┐
                                              │ 回滚到   │
                                              │ v1.1.0   │
                                              │ 指纹恢复 │
                                              │ PASS     │
                                              └──────────┘
```

### 10.2 演示命令

```bash
# 运行 E2E 仿真 (使用固定 seed 保证可复现)
python3 e2e-rollback-fingerprint-sim.py --seed 20260807
```

### 10.3 预期输出

```
=== Phase 1: 基线建立 (v1.1.0) ===
[OK] 基线指纹: 1f1f307f2eab7e11
[OK] 基线已保存, 后续阶段将与此比对

=== Phase 2: 合规升级 (v1.2.0, 指纹不变) ===
[OK] 当前指纹: 1f1f307f2eab7e11
[OK] Check 2 通过: 指纹一致
[OK] 升级合规, 无需回滚

=== Phase 3: 事故注入 — 模型切换 (Type 1) ===
[FAIL] Check 1 失败: model_id mismatch: got=paraphrase-MiniLM-L6-v2
[FAIL] Check 2 失败: 指纹漂移! 当前=aa11bb22cc33dd44, 基线=1f1f307f2eab7e11
[INFO] 退出码=1, 触发回滚

=== Phase 4: 事故注入 — 维度漂移 (Type 2) ===
[FAIL] Check 3 失败: count=3, dim=385 (期望 384)
[INFO] 退出码=1, 触发回滚

=== Phase 5: 事故注入 — 精度丢失 (Type 3) ===
[FAIL] Check 2 失败: 指纹漂移! 当前=bb22cc33dd44ee55, 基线=1f1f307f2eab7e11
[INFO] Check 1 通过 (model_id 正确), Check 3 通过 (dim=384)
[INFO] 退出码=1, 精度丢失仅 Check 2 捕获

=== Phase 6: 回滚恢复 ===
[OK] 回滚到 v1.1.0
[OK] 当前指纹: 1f1f307f2eab7e11
[OK] Check 2 通过: 指纹一致
[OK] 回滚成功, 服务恢复
```

### 10.4 仿真结果汇总表

| Phase | 场景 | Check 1 | Check 2 | Check 3 | 退出码 | 动作 |
|:-----:|------|:-------:|:-------:|:-------:|:------:|------|
| 1 | 基线建立 v1.1.0 | — | — | — | — | 保存基线 SHA |
| 2 | 合规升级 v1.2.0 | PASS | PASS | PASS | 0 | 无需回滚 |
| 3 | 模型切换 (Type 1) | **FAIL** | **FAIL** | — | 1 | 回滚 |
| 4 | 维度漂移 (Type 2) | PASS | — | **FAIL** | 1 | 回滚 |
| 5 | 精度丢失 (Type 3) | PASS | **FAIL** | PASS | 1 | 回滚 |
| 6 | 回滚恢复 v1.1.0 | PASS | PASS | PASS | 0 | 关闭工单 |

> **讲师提示**: 现场跑一遍仿真, 让学员看到"每个 Phase 的退出码和 Check 失败组合"。
> 仿真脚本用 `--seed` 保证可复现, 课后学员可自行练习。

---

## Slide 11: CI/CD 门禁集成 (5 min)

### 11.1 GitHub Actions 工作流

**文件**: `.github/workflows/pre-release-fingerprint-verify.yml`

### 11.2 5 个 Job 流水线

```
┌──────────────────────────────────────────────────────────────────┐
│              pre-release-fingerprint-verify.yml                  │
└──────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┐
  │ Job 1:              │
  │ static-test-suite   │
  │ 静态测试 + 单元测试 │
  │ python -m pytest    │
  └─────────┬───────────┘
            │ PASS
            ▼
  ┌─────────────────────┐
  │ Job 2:              │
  │ e2e-simulation      │
  │ E2E 回滚仿真        │
  │ python e2e-...sim   │
  │ --seed $GITHUB_SHA  │
  └─────────┬───────────┘
            │ PASS
            ▼
  ┌─────────────────────┐
  │ Job 3:              │
  │ linux-preflight     │
  │ Linux 预检          │
  │ --self-test         │
  │ + --gen-baseline    │
  └─────────┬───────────┘
            │ PASS
            ▼
  ┌─────────────────────┐
  │ Job 4:              │
  │ k8s-helm-verify     │
  │ Helm Chart 部署验证 │
  │ helm lint + install │
  └─────────┬───────────┘
            │ PASS
            ▼
  ┌─────────────────────┐
  │ Job 5:              │
  │ gate-summary        │
  │ 门禁汇总            │
  │ 4 Job 全绿 → 放行  │
  │ 任一失败 → 阻断发布 │
  └─────────────────────┘
```

### 11.3 触发条件

| 触发方式 | 事件 | 说明 |
|---------|------|------|
| Tag push | `v*` tag 推送 | 正式发布前强制门禁 |
| PR to main | `pull_request` 到 main 分支 | 合并前预检 |
| Weekly cron | 每周一 02:00 UTC | 定期回归 |
| 手动触发 | `workflow_dispatch` | 应急手动验证 |

### 11.4 门禁失败 = 阻断发布

```yaml
# gate-summary Job 核心逻辑
- name: Gate Check
  run: |
    if [ "${{ needs.static-test-suite.result }}" != "success" ] || \
       [ "${{ needs.e2e-simulation.result }}" != "success" ] || \
       [ "${{ needs.linux-preflight.result }}" != "success" ] || \
       [ "${{ needs.k8s-helm-verify.result }}" != "success" ]; then
      echo "❌ 门禁失败, 阻断发布"
      exit 1
    fi
    echo "✅ 门禁通过, 允许发布"
```

> **讲师提示**: CI/CD 门禁是"自动化硬红线"的落地。本地跑 `--fail-fast` 是人工红线,
> CI 流水线是机器红线, 两者互补。

---

## Slide 12: Helm Chart K8s 部署 (4 min)

### 12.1 一键部署命令

```bash
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding --create-namespace \
  --set baseline.sha="1f1f307f2eab7e11" \
  --set service.name="v9-embedding" \
  --set service.namespace="v9-embedding" \
  --set service.port=8001
```

### 12.2 自动创建的 K8s 资源

```
┌──────────────────────────────────────────────────────────────┐
│  helm upgrade --install fp-verify ...                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐    ┌─────────────┐    ┌─────────────┐
  │ Namespace │    │ ServiceAcct │    │ RBAC        │
  │ v9-       │    │ fingerprint │    │ Role +      │
  │ embedding │    │ -verify-sa  │    │ RoleBinding │
  └───────────┘    └─────────────┘    └─────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ ConfigMap ×2    │
                  │ ① fingerprint-  │
                  │   baseline      │
                  │   (基线 SHA)    │
                  │ ② fingerprint-  │
                  │   script        │
                  │   (验证脚本)    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Job / CronJob   │
                  │ fp-verify-v9-   │
                  │ fingerprint-    │
                  │ verify-job      │
                  └─────────────────┘
```

### 12.3 CronJob 周期巡检模式

```bash
# 启用每 4 小时巡检
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11" \
  --set job.mode="CronJob" \
  --set job.cronSchedule="0 */4 * * *"
```

**巡检意义**: 即使没有发布, 也能及时发现模型文件被篡改、配置被误改等"静默漂移"。

### 12.4 从 Pod 日志提取结果 JSON

```bash
# 方法 1: 从日志标记间提取
kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier | \
  sed -n '/=== RESULT BEGIN ===/,/=== RESULT END ===/p' | \
  sed '1d;$d' | python3 -m json.tool

# 方法 2: 使用自动化脚本 (自动提取 + 判断)
./deploy-fingerprint-verify.sh --baseline 1f1f307f2eab7e11
```

**结果 JSON 结构**:
```json
{
  "exit_code": 0,
  "host": "v9-embedding.v9-embedding.svc",
  "port": 8001,
  "k8s_mode": true,
  "baseline_provided": true,
  "checks": [
    {"name": "check1.metadata",    "passed": true,  "detail": "model_id=all-MiniLM-L6-v2 ✓; dim=384 ✓; ..."},
    {"name": "check2.fingerprint", "passed": true,  "detail": "指纹一致 current=1f1f307f2eab7e11"},
    {"name": "check3.dimensions",  "passed": true,  "detail": "3 x 384 维度一致"},
    {"name": "check4.runtime",     "passed": true,  "detail": "slow_threshold_ms=500 ✓; uvicorn_workers=1 ✓"}
  ],
  "duration_ms": 1647,
  "timestamp": "2026-08-07T16:30:00+0800"
}
```

> **讲师提示**: CronJob 模式是"防静默漂移"的关键。建议生产环境默认启用 `0 */4 * * *` 巡检。

---

## Slide 13: 现场演练 Demo (10 min)

### 13.1 每人必须完成的 3 步操作

```
┌──────────────────────────────────────────────────────────────────┐
│                    现场演练 — 3 步操作                           │
└──────────────────────────────────────────────────────────────────┘

  Step 1: 回滚前 — 生成基线 (在 v1.1.0 上)
  ┌──────────────────────────────────────────────────────────────┐
  │ python3 verify-embedding-fingerprint.py \                    │
  │   --host <v1.1.0-host> --port 8001 --gen-baseline           │
  │                                                              │
  │ 预期输出:                                                    │
  │   BASELINE_SHA=1f1f307f2eab7e11                              │
  │   [OK] 基线指纹已生成: 1f1f307f2eab7e11                      │
  └──────────────────────────────────────────────────────────────┘
                           │
                           ▼
  Step 2: 回滚后 — 两步验证
  ┌──────────────────────────────────────────────────────────────┐
  │ ① systemctl 验证服务运行:                                    │
  │   systemctl status v9-embedding                              │
  │   (或 kubectl get pods -l app=v9-embedding)                  │
  │                                                              │
  │ ② 指纹验证脚本:                                              │
  │   python3 verify-embedding-fingerprint.py \                  │
  │     --host localhost --port 8001 \                          │
  │     --baseline 1f1f307f2eab7e11                             │
  └──────────────────────────────────────────────────────────────┘
                           │
                           ▼
  Step 3: 退出码解读 → 动作
  ┌──────────────────────────────────────────────────────────────┐
  │ exit 0 → 验证通过, 关闭工单                                  │
  │ exit 1 → 进 FAQ-P1/P2/P3 排查 (Slide 8/9)                   │
  │ exit 2 → 服务不可达, 检查 Service / Pod                      │
  └──────────────────────────────────────────────────────────────┘
```

### 13.2 现场演示 (讲师操作)

#### Demo 1: --self-test (离线算法验证)

```bash
python3 verify-embedding-fingerprint.py --self-test
```

**预期输出**:
```
[INFO] === 自检: 离线验证指纹算法 ===
[OK] 确定性验证通过: <16-hex>
[OK] 区分性验证通过: 双向量=<hex1>, 单向量=<hex2>
[OK] 空输入验证通过: <16-hex>
[OK] 指纹长度验证通过: 16 字符
[OK] 自检全部通过 ✓
```

#### Demo 2: 错误基线 → Check 2 FAIL

```bash
# 故意使用错误基线
python3 verify-embedding-fingerprint.py \
  --host localhost --port 8001 \
  --baseline 0000000000000000
```

**预期输出**:
```
[FAIL] Check 2 失败: 指纹漂移! 当前=1f1f307f2eab7e11, 基线=0000000000000000
[INFO] 汇总: 3/4 通过, 耗时 1234ms
[FAIL] 存在失败检查, exit code=1
```

#### Demo 3: 成功回滚 → PASS

```bash
# 使用正确基线
python3 verify-embedding-fingerprint.py \
  --host localhost --port 8001 \
  --baseline 1f1f307f2eab7e11
```

**预期输出**:
```
[OK] Check 1 通过: model_id=all-MiniLM-L6-v2 ✓; dim=384 ✓; max_batch=64 ✓; loaded=True ✓
[OK] Check 2 通过: 指纹一致 current=1f1f307f2eab7e11
[OK] Check 3 通过: 3 x 384 维度一致
[OK] Check 4: slow_threshold_ms=500 ✓; uvicorn_workers=1 ✓
[INFO] 汇总: 4/4 通过, 耗时 1234ms
[OK] 全部检查通过 ✓ (4 层断言: 元数据 / 指纹 / 维度 / 运行时)
```

### 13.3 演练考核标准

| 考核项 | 通过标准 | 分值 |
|--------|---------|:---:|
| Step 1 生成基线 | 正确执行 `--gen-baseline`, 记录 SHA | 20 |
| Step 2 两步验证 | systemctl + verify 脚本均执行 | 30 |
| Step 3 退出码解读 | 正确说出 0/1/2 对应动作 | 20 |
| 故障排查 | 模拟 Check 2 FAIL, 正确用双机对比定位 | 30 |
| **合计** | | **100** |

> **讲师提示**: 演练环节是考核重点。学员完成后, 讲师随机抽查 1-2 人复述"先取证据, 再做决策"流程。

---

## Slide 14: 资源 & Q&A (2 min)

### 14.1 资源清单

| 文件 | 路径 | 用途 |
|------|------|------|
| 培训大纲 | `backend/deploy/releases/v1.2.0-support/TRAINING-PPT-OUTLINE.md` | 本文档, 培训主线 |
| 部署操作手册 | `backend/deploy/releases/v1.2.0-support/DEPLOY-OPS-MANUAL.md` | 日常运维参考 |
| 验证脚本 | `backend/deploy/releases/v1.2.0-support/verify-embedding-fingerprint.py` | 核心验证工具 (4 层断言) |
| 部署脚本 | `backend/deploy/releases/v1.2.0-support/deploy-fingerprint-verify.sh` | 一键部署 + 验证 |
| 原生 YAML | `backend/deploy/releases/v1.2.0-support/fingerprint-verify-deployment.yaml` | 无 Helm 环境使用 |
| Helm Chart | `backend/deploy/releases/v1.2.0-support/helm/fingerprint-verify/` | K8s Helm 部署 |
| CI 工作流 | `.github/workflows/pre-release-fingerprint-verify.yml` | CI/CD 门禁集成 |
| E2E 仿真 | `backend/deploy/releases/v1.2.0-support/e2e-rollback-fingerprint-sim.py` | 回滚仿真演示 |
| 速查表 | `backend/deploy/releases/v1.2.0-support/OPS-CHEATSHEET-FINGERPRINT.md` | 应急速查卡 |
| 回滚手册 | `backend/deploy/releases/v1.2.0-support/ROLLBACK-v1.2.0-to-v1.1.0.md` | 回滚操作手册 |

### 14.2 预设 Q&A

**Q1: 如果基线 SHA 丢失了怎么办?**

A: 在已知正常的 v1.1.0 节点上重新执行 `--gen-baseline`:
```bash
python3 verify-embedding-fingerprint.py --host <v1.1.0-host> --port 8001 --gen-baseline
```
将输出的 `BASELINE_SHA` 更新到 ConfigMap 或 `--baseline` 参数。建议将基线 SHA 同时存入:
- ConfigMap (K8s 运行时读取)
- Git 仓库 (版本追溯)
- 密码管理器 (灾备)

---

**Q2: CronJob 巡检频率建议多少?**

A: 生产环境建议 `0 */4 * * *` (每 4 小时)。理由:
- 太频繁 (如每 10 分钟): 增加服务负载, 且模型静默篡改极少在 10 分钟内发生
- 太稀疏 (如每天): 发现漂移滞后, 可能已影响下游业务
- 4 小时是"发现速度"与"资源开销"的平衡点

如有发布操作, 发布后立即手动触发一次验证, 不依赖巡检周期。

---

**Q3: Check 4 (运行时参数) 为什么是非阻塞?**

A: `slow_threshold_ms` 和 `uvicorn_workers` 是性能调优参数, 不影响向量正确性:
- `slow_threshold_ms=500` vs `slow_threshold_ms=1000`: 只影响慢请求告警阈值
- `uvicorn_workers=1` vs `uvicorn_workers=4`: 只影响并发处理能力

这些参数变更不会导致向量空间漂移, 因此设为非阻塞。但建议在 [WARN] 出现时记录并跟进,
避免性能参数偏离基线过多。

### 14.3 联系方式

| 角色 | 职责 | 联系方式 |
|------|------|---------|
| V9 平台工程组 | 工具维护 / Bug 修复 | #v9-platform (内部 IM) |
| SRE oncall | 生产事故响应 | oncall@sre (24h 轮值) |
| 发布经理 | 回滚审批 (业务红线) | release-manager (审批流) |

---

## 附录: 时间分配总览

| Slide | 主题 | 时长 | 类型 |
|:-----:|------|:---:|:---:|
| 1 | 封面 | 1 min | 引入 |
| 2 | 培训目标 & 考核方式 | 3 min | 引入 |
| 3 | 指纹技术原理 ⭐ | 8 min | 核心理论 |
| 4 | 指纹漂移的 4 种类型 | 7 min | 理论 |
| 5 | 指纹漂移识别方法 | 6 min | 方法 |
| 6 | 回滚决策流程树 ⭐ | 10 min | 核心方法 |
| 7 | 回滚触发条件 & 评估标准 | 5 min | 方法 |
| 8 | FAQ-P1 实战: Check 2 ⭐ | 8 min | 核心实战 |
| 9 | FAQ-P2/P3 实战: 元数据 & 维度 | 7 min | 实战 |
| 10 | E2E 回滚仿真演示 | 8 min | 演示 |
| 11 | CI/CD 门禁集成 | 5 min | 工程实践 |
| 12 | Helm Chart K8s 部署 | 4 min | 工程实践 |
| 13 | 现场演练 Demo | 10 min | 考核 |
| 14 | 资源 & Q&A | 2 min | 收尾 |
| **合计** | | **~90 min** | |

---

> **文档版本**: v1.2.0 · 2026-08-07
> **维护团队**: V9 平台工程组
> **下次更新**: 随 v1.3.0 发布同步更新
