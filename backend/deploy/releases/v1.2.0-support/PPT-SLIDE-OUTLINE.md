# V9 Embedding 数据一致性守护 — PPT 大纲文件

> **用途**: 基于 `INSTRUCTOR-NOTES.md` 讲师备注稿提炼, 每页包含标题 + 核心内容点 + 配图指引,
> 可直接作为 PPT 制作的故事板 (storyboard).
>
> **总页数**: 14 页 | **总时长**: 约 90 分钟 | **配套流程图**: `flowchart-images/` 目录

---

## Slide 1: 封面 (1 min)

**标题**: V9 Embedding 数据一致性守护

**副标题**: 向量指纹漂移排查与回滚决策流程

**核心内容点**:
- 培训对象: 运维团队 / SRE
- 培训日期: 2026-08-08
- 版本: v1.2.0

**配图指引**: 全景架构图 (Embedding 服务 → 指纹验证 → CI/CD 门禁)

---

## Slide 2: 培训目标 & 考核方式 (3 min)

**标题**: 培训目标 & 考核方式

**核心内容点**:
- **Q1**: 什么是向量指纹? 它能检测哪些漂移? (理论)
- **Q2**: 收到 Check 2 FAIL 后, 10 秒内如何取证据? (实操)
- **Q3**: 回滚决策的三条红线是什么? (决策)
- **考核方式**: 实操 70% + 口头 30%, 允许查手册不允许查笔记
- **提供材料**: 6 份 (验证脚本 / 部署手册 / 速查表 / 培训大纲 / 讲师备注 / 回滚文档)

**配图指引**: 3 个核心问题用图标突出 (❓ / 🔧 / 🚦)

---

## Slide 3: 指纹技术原理 (8 min) ⭐ 核心

**标题**: 向量指纹技术原理 — 4 层断言架构

**核心内容点**:

- **3.1 什么是指纹** (2 min)
  - 定义: Embedding 向量的 "DNA" — 取前 8 个浮点数做 SHA256[:16]
  - 算法: `struct.pack(">f", x)` 大端打包 → SHA256 → 取前 16 hex 字符
  - 零依赖: 仅用 Python 标准库, 任何环境可运行

- **3.2 为什么取前 8 个浮点数** (2 min)
  - 前 1 个: 太少, 容易碰撞
  - 全 384 维: 太慢, 网络+哈希开销大
  - 前 8 个: 96 字节, 哈希 <1ms, 区分度足够

- **3.3 4 层断言架构** (3 min)
  - Check 1 元数据 (硬阻断): model_id / dim / max_batch / loaded
  - Check 2 指纹 (硬阻断): SHA256[:16] 比对 — 核心层
  - Check 3 维度 (硬阻断): 3 vectors x 384 dim
  - Check 4 运行时 (非阻塞): slow_threshold_ms / uvicorn_workers

- **3.4 为什么有效** (1 min)
  - 确定性模型对相同输入产生相同输出 (all-MiniLM-L6-v2 无 dropout)

**配图指引**: 4 层断言架构 ASCII 图 → 已有流程图 `9_1_指纹验证失败后的回滚总流程.png`

**代码块**:
```python
def compute_vector_fingerprint(vectors, head=8):
    buf = bytearray()
    for vec in vectors:
        for i in range(min(head, len(vec))):
            buf += struct.pack(">f", float(vec[i]))
    return hashlib.sha256(bytes(buf)).hexdigest()[:16]
```

---

## Slide 4: 指纹漂移的 4 种类型 (7 min)

**标题**: 指纹漂移分类 — 4 种类型与检测覆盖矩阵

**核心内容点**:

- **4.1 全景** (1 min): 4 种类型概览

- **4.2 各类型详解** (4 min):
  - **Type 1 模型切换** [P0 致命]: 根因 = 部署误用其他模型; Check 1 + Check 2 双重捕获
  - **Type 2 维度漂移** [P0 致命]: 根因 = 调试代码泄漏; Check 3 单层捕获; 特征 dim=385
  - **Type 3 精度丢失** [P1 严重]: 根因 = FP16 量化未评审; Check 2 单层捕获; 最隐蔽
  - **Type 4 代码变更** [P2 中等]: 根因 = normalize 顺序/padding 策略; Check 2 单层捕获

- **4.3 检测覆盖矩阵** (2 min):
  | 漂移类型 | Check 1 | Check 2 | Check 3 | 严重级别 |
  |---------|---------|---------|---------|---------|
  | 模型切换 | ✓ | ✓ | — | P0 |
  | 维度漂移 | — | ✓ | ✓ | P0 |
  | 精度丢失 | — | ✓ | — | P1 |
  | 代码变更 | — | ✓ | — | P2 |

**配图指引**: 4 种类型全景图 + 检测覆盖矩阵表格

---

## Slide 5: 指纹漂移识别方法 (6 min)

**标题**: 指纹漂移识别方法 — 退出码速查与双机对比法

**核心内容点**:

- **5.1 退出码速查** (1 min):
  | exit code | 含义 | 动作 |
  |-----------|------|------|
  | 0 | 验证通过 | 放行发布 |
  | 1 | 指纹漂移 | 阻断 + 回滚 |
  | 2 | 服务不可达 | 修复服务 (非漂移) |

- **5.2 Check 2 失败消息格式** (1 min):
  - `[FAIL] [Check 2] 指纹漂移! 当前=xxx, 基线=yyy`
  - 关键: 先搞清楚"当前"和"基线"哪个是对的

- **5.3 双机对比法** (2 min) — 核心!
  - 在基线机器和当前机器分别执行 python 单行命令
  - 对比 `v[i][:4]` 是否相同
  - 10 秒定位: 是基线抄错还是真实漂移

- **5.4 决策树** (2 min):
  - v[i][:4] 相同 + 指纹不同 → 基线版本抄错了 → 重新 --gen-baseline
  - v[i][:4] 不同 → 真实漂移 → 执行回滚

**配图指引**: 决策树流程图

**代码块**:
```bash
# 双机对比 — 10 秒取证据
python3 -c "
import urllib.request, json
r = json.loads(urllib.request.urlopen('http://localhost:8001/api/embed/embed',
    data=b'{\"texts\":[\"test\"],\"normalize\":true}').read())
print(r['vectors'][0][:4])
"
```

---

## Slide 6: 回滚决策流程树 (10 min) ⭐ 核心

**标题**: 回滚决策流程树 — 先取证据, 再做决策

**核心内容点**:

- **触发条件** (1 min):
  - T1: P95 延迟 >500ms 持续 5 分钟 (辅助信号)
  - T2: 下游业务方提工单
  - T3: 发布经理审批
  - 满足 T2 + T3 即可启动回滚

- **Step 1: 取证据** (2 min) — 禁止盲目回滚!
  - ① kubectl logs 取日志 ② 记录 Check/退出码/指纹 ③ 跑双机对比 ④ 截图保存
  - 10 秒取证据, 避免 30 分钟无效回滚

- **Step 2: 证据分类** (1 min): 根据 Check 1/2/3 → 分类 Type 1/2/3/4

- **Step 3: 执行回滚** (1.5 min):
  - `kubectl rollout undo` → `rollout status` → 等待 Pod Running (约 3 分钟)

- **Step 4: 验证回滚结果** (1.5 min):
  - `helm upgrade` 重新部署验证 Job → `kubectl wait` → `kubectl logs`
  - exit=0 → 关闭工单; exit=1 → 进 Slide 8 FAQ-P1

- **核心原则** (3 min):
  - ❌ 错误: 收到工单 → 直接 rollback → 验证 FAIL → 不知回滚到哪
  - ✅ 正确: 收到工单 → 取证据 → 分类 → 记录 → 再回滚 → 验证

**配图指引**: `9_1_指纹验证失败后的回滚总流程.png`

---

## Slide 7: 回滚触发条件 & 评估标准 (5 min)

**标题**: 回滚触发条件 — 三条红线与评估矩阵

**核心内容点**:

- **7.1 三条红线** (2 min):
  - 🔴 **硬红线**: Check 1/2/3 任一 FAIL, 无需审批, 脚本 exit=1 即触发
  - 🟡 **软红线**: CPU/内存 +20% 持续 10 分钟, SRE 确认, 15 分钟响应
  - 🟠 **业务红线**: 下游错误率 >1% + 发布经理审批, 30 分钟响应

- **7.2 评估矩阵** (2 min):
  | 失败场景 | 漂移类型 | 严重级别 | 是否回滚 | 回滚目标 |
  |---------|---------|---------|---------|---------|
  | Check 1 FAIL | 模型切换 | P0 | 是 | v1.1.0 |
  | Check 2 FAIL | 指纹漂移 | P0/P1 | 是 | v1.1.0 |
  | Check 3 FAIL | 维度异常 | P0 | 是 | v1.1.0 |
  | Check 4 WARN | 运行时参数 | P2 | 否 | 调参 |
  | exit=2 | 服务不可达 | — | 否 | 修服务 |

- **7.3 审批权限** (1 min):
  - 硬红线: 无需审批 (自动化)
  - 软红线: SRE oncall, 15 分钟
  - 业务红线: 发布经理, 30 分钟

**配图指引**: `9_0_E2E_验证报告部署决策矩阵.png`

---

## Slide 8: FAQ-P1 实战: Check 2 指纹漂移排查 (8 min) ⭐

**标题**: 实战排查 — Check 2 指纹漂移 (最高频事故)

**核心内容点**:

- **8.1 场景** (1 min):
  - 回滚 v1.2.0 → v1.1.0 后, 重新跑验证, Check 2 仍然 FAIL
  - 占生产事故 60% 以上

- **8.2 Step 1: 10 秒取证据** (3 min):
  - 在基线机器和当前机器分别跑 python 单行命令
  - 对比 v[0][:4] 输出

- **8.3 Step 2: 三类根因判定表** (2 min):
  | v[i][:4] 对比 | 指纹对比 | 根因 | 级别 | 动作 |
  |-------------|---------|------|------|------|
  | 相同 | 不同 | 基线版本抄错 | P3 | 重新 --gen-baseline |
  | 不同 | 不同 | 真实模型切换 | P0 | 检查 --to-revision |
  | 相同 | 相同但 FAIL | 基线版本号不对 | P2 | 核对 --baseline 参数 |

- **8.4 判定流程图** (1 min)

- **8.5 常见误判** (1 min):
  - "回滚失败了, 再回滚一次" → 其实基线抄错
  - "脚本有 bug" → 其实基线与版本不匹配
  - "服务没回滚" → 其实 rollback undo 回到了坏版本

**核心口诀**: v[i][:4] 相同 = 基线错了, 不是服务错了

**配图指引**: `8_2_Check_2_指纹漂移.png`

---

## Slide 9: FAQ-P2/P3 实战: 元数据 & 维度漂移 (7 min)

**标题**: 实战排查 — Check 1 元数据 & Check 3 维度异常

**核心内容点**:

- **9.1 FAQ-P2: Check 1 FAIL** (3 min):
  - 现象: `model_id mismatch: got=paraphrase-MiniLM-L6-v2, expected=all-MiniLM-L6-v2`
  - 根因: HF_HOME 环境变量被覆盖, 加载缓存中的其他模型
  - 排查 3 步: ① 检查 Pod env ② 检查 Deployment env ③ 检查 /api/embed/config
  - 修复: kubectl set env 修正 HF_HOME → rollout restart → 重新验证

- **9.2 FAQ-P3: Check 3 FAIL** (3 min):
  - **现象 A (dim=0)**: 服务启动异常, 模型未加载完 → 重启 Pod
  - **现象 B (dim=385)**: 调试代码泄漏 → 检查镜像 tag + grep 代码中 append/concat/pad
  - 修复: 回滚或修正 deploy.sh

- **9.3 P2/P3 对比** (1 min):
  - P2 = model_id 问题 (HF_HOME); P3 = dim 问题 (调试代码/版本不匹配)
  - 两者都是"配置/部署错误", 修复后无需重新训练

**配图指引**: `8_1_Job_一直_Pending.png` + `8_4_ConfigMap_脚本缺失.png`

---

## Slide 10: E2E 回滚仿真演示 (8 min)

**标题**: E2E 回滚仿真 — 6 阶段全流程演示

**核心内容点**:

- **10.1 6 阶段仿真概览** (2 min):
  - Phase 1: 基线建立 → Phase 2: 合规升级 → Phase 3-5: 3 类事故注入 → Phase 6: 回滚恢复
  - 不需要真实服务, 内部 mock 向量, 用相同指纹算法

- **10.2 演示命令** (1 min):
  ```bash
  python3 e2e-rollback-fingerprint-sim.py --seed 20260807
  ```

- **10.3 现场演示** (3 min) — 实际执行:
  - Phase 1: 基线指纹 f93b8bbb48950a84
  - Phase 2: 合规升级, 指纹不变 (exit=0)
  - Phase 3: 模型切换, Check 1+2 FAIL (exit=1)
  - Phase 4: 维度漂移, Check 3 FAIL (exit=1)
  - Phase 5: 精度丢失, 仅 Check 2 FAIL (exit=1) — 最隐蔽
  - Phase 6: 回滚恢复, 指纹恢复一致 (exit=0)

- **10.4 仿真结果汇总表** (2 min):
  | 阶段 | 状态 | 退出码 | 说明 |
  |------|------|--------|------|
  | Phase 1 基线 | PASS | 0 | 指纹建立 |
  | Phase 2 合规 | PASS | 0 | 指纹不变 |
  | Phase 3 模型切换 | PASS | 1 | 检测到漂移 |
  | Phase 4 维度漂移 | PASS | 1 | 检测到漂移 |
  | Phase 5 精度丢失 | PASS | 1 | 检测到漂移 |
  | Phase 6 回滚恢复 | PASS | 0 | 指纹恢复 |

**配图指引**: 6 阶段流程图 + 终端截图

---

## Slide 11: CI/CD 门禁集成 (5 min)

**标题**: CI/CD 门禁集成 — 自动化发布前验证

**核心内容点**:

- **11.1 工作流概览** (1 min):
  - GitHub Actions: `pre-release-fingerprint-verify.yml`
  - 4 种触发: tag push / PR to main / 每周一 cron / 手动触发

- **11.2 5 个 Job 流水线** (2 min):
  - Job 1 `static-test-suite`: 算法自检 + 21 项单测
  - Job 2 `e2e-simulation`: 6 Phase E2E 回滚仿真 ← Slide 10 演示
  - Job 3 `linux-preflight`: Linux 真实服务预检 + 指纹验证
  - Job 4 `k8s-helm-verify`: K8s Helm Chart 部署验证
  - Job 5 `gate-summary`: 门禁汇总, 4 Job 全绿才放行

- **11.3 依赖关系** (1 min):
  - Job 2 依赖 Job 1; Job 3/4 依赖 Job 1+2; Job 5 依赖 Job 1+2+3

- **11.4 门禁失败 = 阻断发布** (1 min):
  - 任一 Job 失败 → gate-summary exit 1 → GitHub 阻止 tag 推送 / PR 合并
  - 本地 --fail-fast = 人工红线; CI 流水线 = 机器红线; 两者互补

**配图指引**: CI/CD 流水线架构图 (5 个 Job 依赖关系)

---

## Slide 12: Helm Chart K8s 部署 (4 min)

**标题**: Helm Chart K8s 部署 — 一键验证

**核心内容点**:

- **12.1 一键部署命令** (1 min):
  ```bash
  helm upgrade --install fp-verify helm/fingerprint-verify \
    --namespace v9-embedding \
    --set baseline.sha="1f1f307f2eab7e11" \
    --set service.name="v9-embedding" \
    --set service.namespace="v9-embedding"
  ```

- **12.2 自动创建的 K8s 资源** (1 min):
  - Namespace → ServiceAccount + RBAC → ConfigMap x2 (baseline + script) → Job/CronJob

- **12.3 CronJob 周期巡检** (1 min):
  ```bash
  helm upgrade --install fp-verify helm/fingerprint-verify \
    --set job.mode="CronJob" \
    --set job.cronSchedule="0 */4 * * *"
  ```
  - 每 4 小时巡检, 检测静默漂移 (模型文件篡改/配置误改)

- **12.4 从 Pod 日志提取结果** (1 min):
  - `kubectl logs job/... -c verifier` → 解析 RESULT JSON
  - exit_code 字段 = CI/CD 判定依据

**配图指引**: K8s 资源创建流程图

---

## Slide 13: 现场演练 Demo (10 min)

**标题**: 现场演练 — 3 步操作考核

**核心内容点**:

- **13.1 3 步操作说明** (2 min):
  - Step 1: 生成基线 (`--gen-baseline`)
  - Step 2: 两步验证 (`systemctl` + `verify` 脚本)
  - Step 3: 退出码解读 (0=通过, 1=漂移, 2=不可达)

- **13.2 讲师演示** (5 min):
  - Demo 1: `--self-test` 离线算法自检 (4 项全过)
  - Demo 2: `--baseline 0000000000000000` 故意错误基线 → Check 2 FAIL, exit=1
  - Demo 3: 正确基线 → 全部 PASS, exit=0

- **13.3 考核标准** (3 min):
  | 项目 | 分值 | 考核内容 |
  |------|------|---------|
  | Step 1 生成基线 | 20 分 | 正确执行 --gen-baseline 并记录 SHA |
  | Step 2 两步验证 | 30 分 | systemctl + verify 脚本完整执行 |
  | Step 3 退出码解读 | 20 分 | 正确解读 0/1/2 三个退出码 |
  | 故障排查 | 30 分 | 用双机对比法定位模拟 Check 2 FAIL 根因 |

**配图指引**: 终端操作截图

---

## Slide 14: 资源 & Q&A (2 min)

**标题**: 资源清单 & Q&A

**核心内容点**:

- **14.1 资源清单** (1 min):
  | 文件 | 用途 |
  |------|------|
  | `verify-embedding-fingerprint.py` | 核心验证脚本 (4 层断言) |
  | `e2e-rollback-fingerprint-sim.py` | 6 阶段 E2E 仿真 |
  | `deploy-fingerprint-verify.sh` | 一键部署+验证脚本 |
  | `DEPLOY-OPS-MANUAL.md` | 运维操作手册 |
  | `TRAINING-PPT-OUTLINE.md` | 培训大纲 (14 页) |
  | `INSTRUCTOR-NOTES.md` | 讲师备注稿 |
  | `MERMAID-FLOWCHARTS.md` | Mermaid 流程图源码 |
  | `flowchart-images/` | PNG 流程图 (11 张, 可直接插入 PPT) |
  | `OPS-CHEATSHEET-FINGERPRINT.md` | 速查表 (打印贴工位) |
  | `helm/fingerprint-verify/` | Helm Chart |

- **14.2 预设 Q&A** (1 min):
  - Q1: 基线 SHA 丢了? → 在 v1.1.0 上重新 --gen-baseline
  - Q2: CronJob 巡检频率? → 每 4 小时, 兼顾发现速度和资源开销
  - Q3: Check 4 为什么非阻塞? → 性能参数不影响向量正确性

- **核心口诀回顾**:
  1. 先取证据, 再做决策
  2. v[i][:4] 相同 = 基线错了
  3. Check 2 是万能捕获层

**配图指引**: 资源文件树状图

---

## 附录: 流程图与 PPT 页对应关系

| PPT 页 | 对应流程图 PNG | 文件名 |
|---------|-------------|--------|
| Slide 6 | 回滚总流程 | `9_1_指纹验证失败后的回滚总流程.png` |
| Slide 7 | E2E 部署决策矩阵 | `9_0_E2E_验证报告部署决策矩阵.png` |
| Slide 8 | Check 2 指纹漂移排查 | `8_2_Check_2_指纹漂移.png` |
| Slide 8 | 故障排查总览 | `8_0_故障排查总览流程图.png` |
| Slide 9 | Job Pending | `8_1_Job_一直_Pending.png` |
| Slide 9 | ConfigMap 缺失 | `8_4_ConfigMap_脚本缺失.png` |
| Slide 9 | 服务不可达 | `8_3_服务不可达_exit_code_2.png` |
| Slide 9 | Job 超时 | `8_5_Job_超时_activeDeadlineSeconds.png` |
| Slide 9 (场景 A) | 模型切换回滚 | `9_5_场景_A_模型切换事故回滚.png` |
| Slide 9 (场景 B) | 维度漂移回滚 | `9_6_场景_B_维度漂移事故回滚.png` |
| Slide 9 (场景 C) | 精度丢失回滚 | `9_7_场景_C_精度丢失事故回滚.png` |

> 所有 PNG 文件位于 `flowchart-images/` 目录, 可直接在 PPT 中 "插入 → 图片" 使用.
