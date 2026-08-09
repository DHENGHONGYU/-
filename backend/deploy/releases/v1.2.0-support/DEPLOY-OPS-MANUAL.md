# V9 Embedding 指纹验证 — 部署操作手册

> **面向**: 运维团队 / SRE / 平台工程
> **版本**: v1.2.0 · 2026-08-08
> **对应文档**: `ROLLBACK-v1.2.0-to-v1.1.0.md` / `OPS-CHEATSHEET-FINGERPRINT.md`

---

## 目录

1. [概述](#1-概述)
2. [前提条件](#2-前提条件)
3. [方式一: Helm Chart 部署 (推荐)](#3-方式一-helm-chart-部署-推荐)
4. [方式二: 自动化脚本部署](#4-方式二-自动化脚本部署)
5. [方式三: 原生 YAML 部署](#5-方式三-原生-yaml-部署)
6. [验证结果查看](#6-验证结果查看)
7. [CronJob 巡检模式](#7-cronjob-巡检模式)
8. [常见问题排查](#8-常见问题排查)
9. [回滚策略](#9-回滚策略)
10. [附录: 资源清单](#10-附录-资源清单)

---

## 1. 概述

本手册指导运维团队在 Kubernetes 集群中部署 V9 Embedding 向量指纹一致性验证工具。

### 核心功能

- **4 层断言**: 元数据基线 → 向量指纹(SHA256) → 批量维度 → 运行时参数
- **一键部署**: Helm Chart 封装, 自动创建所有 K8s 资源
- **自动判断**: Job 完成后输出结构化 JSON, CI/CD 可直接解析
- **零外部依赖**: 验证脚本仅用 Python 3.11 stdlib

### 三种部署方式对比

| 方式 | 适用场景 | 复杂度 | 推荐度 |
|------|---------|--------|--------|
| Helm Chart | 生产环境日常使用 | 低 | ⭐⭐⭐ |
| 自动化脚本 | CI/CD 流水线集成 | 低 | ⭐⭐⭐ |
| 原生 YAML | 无 Helm 的环境 / 紧急手动部署 | 中 | ⭐⭐ |

---

## 2. 前提条件

### 2.1 工具版本要求

| 工具 | 最低版本 | 验证命令 |
|------|---------|---------|
| Kubernetes | 1.24+ | `kubectl version --short` |
| Helm | 3.10+ | `helm version` |
| kubectl | 1.25+ | `kubectl version --client` |
| Python (Pod 内) | 3.11+ | 由 `python:3.11-slim` 镜像提供 |

### 2.2 集群权限

部署人员需要以下权限:
- Namespace 的 create/get
- ServiceAccount / Role / RoleBinding 的 create/get/list
- ConfigMap 的 create/get
- Job / CronJob 的 create/get/list/watch
- Pod 的 get/list/logs

### 2.3 网络要求

- 验证 Job 的 Pod 必须能通过 K8s Service DNS 访问 Embedding 服务
- 即: `v9-embedding.<namespace>.svc:8001` 必须可达
- 如 Embedding 服务在其他 namespace, 使用 `service.hostOverride` 或修改 `service.namespace`

### 2.4 基线指纹

部署前需要准备好 v1.1.0 的基线指纹 (16 hex):

```bash
# 在 v1.1.0 正常运行时执行
python3 verify-embedding-fingerprint.py --host <emb-host> --port 8001 --gen-baseline
# 输出示例: BASELINE_SHA="1f1f307f2eab7e11"
```

---

## 3. 方式一: Helm Chart 部署 (推荐)

### 3.1 基本安装

```bash
# 进入 Chart 目录
cd backend/deploy/releases/v1.2.0-support

# 安装 (一次性 Job 模式)
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding --create-namespace \
  --set baseline.sha="1f1f307f2eab7e11" \
  --set service.name="v9-embedding" \
  --set service.namespace="v9-embedding" \
  --set service.port=8001
```

### 3.2 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `baseline.sha` | `""` (必填) | v1.1.0 基线指纹 (16 hex) |
| `service.name` | `v9-embedding` | Embedding Service 名称 |
| `service.namespace` | `default` | Service 所在 namespace |
| `service.port` | `8001` | Service 端口 |
| `service.hostOverride` | `""` | 覆盖自动拼接的 DNS (跨 ns 时用) |
| `job.mode` | `Job` | `Job` (一次性) 或 `CronJob` (周期巡检) |
| `job.backoffLimit` | `1` | 最大重试次数 |
| `job.ttlSecondsAfterFinished` | `3600` | 完成后 Pod 保留时间 (秒) |
| `runtime.failFast` | `true` | Check FAIL 时立即退出 |
| `runtime.verifyTimeout` | `15` | HTTP 请求超时 (秒) |
| `runtime.timeoutSeconds` | `300` | 整次 Job 超时 (秒) |

### 3.3 高级配置

```bash
# 使用 values.yaml 文件
cat > custom-values.yaml <<EOF
baseline:
  sha: "1f1f307f2eab7e11"
service:
  name: "v9-embedding"
  namespace: "prod"
  port: 8001
job:
  mode: "CronJob"
  cronSchedule: "0 */4 * * *"
runtime:
  failFast: true
  verifyTimeout: 20
resources:
  limits:
    cpu: "1000m"
    memory: "512Mi"
EOF

helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding --create-namespace \
  -f custom-values.yaml
```

### 3.4 使用已有 ConfigMap 作为基线

```bash
# 先创建基线 ConfigMap
kubectl -n v9-embedding create configmap my-baseline \
  --from-literal=baseline.sha=1f1f307f2eab7e11

# Helm 引用已有 ConfigMap
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.existingConfigMap="my-baseline" \
  --set service.name="v9-embedding"
```

### 3.5 升级 / 重新运行

```bash
# 重新触发 Job (Helm upgrade 会重新创建 Job)
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11" \
  --set service.name="v9-embedding"

# 或先删除旧 Job 再 upgrade
kubectl -n v9-embedding delete job fp-verify-v9-fingerprint-verify-job
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11"
```

### 3.6 卸载

```bash
helm uninstall fp-verify --namespace v9-embedding
# Namespace 如无其他资源可一并删除
# kubectl delete namespace v9-embedding
```

---

## 4. 方式二: 自动化脚本部署

### 4.1 基本用法

```bash
cd backend/deploy/releases/v1.2.0-support
chmod +x deploy-fingerprint-verify.sh

# 默认参数部署
./deploy-fingerprint-verify.sh

# 指定基线和服务
./deploy-fingerprint-verify.sh \
  --baseline 1f1f307f2eab7e11 \
  --namespace v9-embedding \
  --service v9-embedding \
  --port 8001
```

### 4.2 脚本执行流程

```
Step 1: 前提条件检查 (helm/kubectl/集群连通性)
Step 2: Helm Lint (验证 Chart 语法)
Step 3: 创建 Namespace (如不存在)
Step 4: Helm upgrade --install
Step 5: 等待 Job 完成 (Complete/Failed/Timeout)
Step 6: 提取结果 JSON (从 Pod 日志)
Step 7: 合规性判断 (Python 解析 JSON)
Step 8: 输出报告 + 返回退出码
```

### 4.3 脚本退出码

| 退出码 | 含义 | 后续动作 |
|--------|------|---------|
| 0 | 全部 Check 通过 | 关闭工单 / 合并 PR |
| 1 | 指纹漂移或元数据不匹配 | 排查 FAQ-P1 |
| 2 | 服务不可达 | 检查 Embedding Service |
| 3 | 前提条件不满足 | 安装 helm/kubectl |
| 4 | Job 超时 | 检查 Pod 资源/网络 |
| 5 | Helm 部署失败 | 检查 Chart/values |

### 4.4 CI/CD 集成示例

```bash
#!/bin/bash
set -euo pipefail

# CI 流水线中的用法
BASELINE=$(cat .baseline-sha)  # 从文件读取基线

./deploy-fingerprint-verify.sh \
  --baseline "$BASELINE" \
  --namespace "$K8S_NAMESPACE" \
  --service "$EMB_SERVICE" \
  --timeout 5m \
  --cleanup  # 验证后自动卸载

exit_code=$?
if [ $exit_code -eq 0 ]; then
  echo "✅ 指纹验证通过, 允许发布"
  exit 0
else
  echo "❌ 指纹验证失败 (exit=$exit_code), 阻止发布"
  exit 1
fi
```

### 4.5 Dry Run 模式

```bash
# 仅渲染模板不部署 (用于预检)
./deploy-fingerprint-verify.sh --dry-run
```

---

## 5. 方式三: 原生 YAML 部署

### 5.1 创建脚本 ConfigMap

```bash
# 1. 创建 Namespace
kubectl create namespace v9-embedding

# 2. 创建脚本 ConfigMap (脚本太大不适合内联 YAML)
kubectl -n v9-embedding create configmap fingerprint-script \
  --from-file=verify-embedding-fingerprint.py=./verify-embedding-fingerprint.py

# 3. 修改部署清单中的 baseline.sha
# 编辑 fingerprint-verify-deployment.yaml 第 100 行
sed -i 's/1f1f307f2eab7e11/你的基线SHA/' fingerprint-verify-deployment.yaml

# 4. 应用部署清单
kubectl apply -f fingerprint-verify-deployment.yaml
```

### 5.2 自定义 Service DNS

如果 Embedding 服务不在 `v9-embedding` namespace:

```bash
# 编辑 YAML 中的 TARGET_HOST
sed -i 's|v9-embedding.v9-embedding.svc|你的服务.你的namespace.svc|' \
  fingerprint-verify-deployment.yaml

kubectl apply -f fingerprint-verify-deployment.yaml
```

---

## 6. 验证结果查看

### 6.1 查看 Job 状态

```bash
kubectl -n v9-embedding get job
# NAME                           COMPLETIONS   DURATION   AGE
# fingerprint-verify-job         1/1           6s         30s    ← 成功
# fingerprint-verify-job         0/1           30s        30s    ← 进行中或失败
```

### 6.2 查看 Pod 日志

```bash
kubectl -n v9-embedding logs job/fingerprint-verify-job -c verifier
```

预期输出 (成功):
```
[INFO] [k8s-mode] host 未显式指定, 自动拼接 Service DNS: v9-embedding.v9-embedding.svc
[INFO] 目标服务: http://v9-embedding.v9-embedding.svc:8001   超时: 15.0s
[PASS] [Check 1] 元数据基线 (model_id=all-MiniLM-L6-v2, dim=384, max_batch=64, loaded=true)
[PASS] [Check 2] 指纹一致: 1f1f307f2eab7e11
[PASS] [Check 3] 批量维度 3 vectors × 384 dim
[WARN] [Check 4] 运行时参数: 1/1 匹配 (非阻塞)

[INFO] 完成 1647ms  4 层断言: 3/3 硬性通过 (Check 4 为非阻塞).
[verifier] Exit code = 0
[verifier] === RESULT BEGIN ===
{"exit_code": 0, "host": "v9-embedding.v9-embedding.svc", ...}
[verifier] === RESULT END ===
```

### 6.3 提取结果 JSON

```bash
# 方法 1: 从日志标记间提取
kubectl -n v9-embedding logs job/fingerprint-verify-job -c verifier | \
  sed -n '/=== RESULT BEGIN ===/,/=== RESULT END ===/p' | \
  sed '1d;$d' | python3 -m json.tool

# 方法 2: 使用自动化脚本 (自动提取 + 判断)
./deploy-fingerprint-verify.sh --baseline 1f1f307f2eab7e11
```

### 6.4 结果 JSON 字段说明

```json
{
  "exit_code": 0,           // 0=通过 1=Check失败 2=服务不可达
  "host": "v9-embedding.v9-embedding.svc",
  "port": 8001,
  "k8s_mode": true,
  "baseline_provided": true,
  "checks": [
    {"name": "check1_metadata",   "value": "PASS",   "pass": true},  // 元数据
    {"name": "check2_fingerprint","value": "PASS",   "pass": true},  // 指纹
    {"name": "check3_dimensions", "value": "PASS",   "pass": true},  // 维度
    {"name": "check4_runtime",    "value": "1/1",    "pass": true}   // 运行时(非阻塞)
  ],
  "duration_ms": 1647,
  "ts": "2026-08-07T16:30:00+0800"
}
```

---

## 7. CronJob 巡检模式

### 7.1 启用周期巡检

```bash
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11" \
  --set job.mode="CronJob" \
  --set job.cronSchedule="0 */4 * * *"
```

### 7.2 手动触发巡检

```bash
# 从 CronJob 手动创建一次 Job
kubectl -n v9-embedding create job manual-verify \
  --from=cronjob/fp-verify-v9-fingerprint-verify-cron

# 查看结果
kubectl -n v9-embedding logs job/manual-verify -c verifier
```

### 7.3 查看巡检历史

```bash
# 列出所有 CronJob 创建的 Job
kubectl -n v9-embedding get jobs --sort-by=.metadata.creationTimestamp

# 查看最近一次失败的 Job 日志
kubectl -n v9-embedding logs job/<最新失败的job名> -c verifier
```

---

## 8. 常见问题排查

### 8.0 故障排查总览流程图

遇到验证 Job 异常时, 按以下决策树快速定位故障类别并跳转到对应小节:

```
                    验证 Job 异常
                         │
                         ▼
              ┌─── kubectl get job ───┐
              │                        │
         Job 不存在               Job 存在 (Complete/Failed)
              │                        │
              ▼                        ▼
         §8.4 ConfigMap           kubectl get pods
         脚本缺失?                   │
                              ┌──────┼──────┐
                              ▼      ▼      ▼
                          Pending  Running  Error/
                                   正常退出 ExitCode
                              │      │      │
                              ▼      │      ▼
                          §8.1       │   提取 JSON
                          Pending    │   exit_code
                                     │      │
                                     ▼      │
                            日志最后一行      │
                                     │      │
                          ┌──────────┼──────┼──────────┐
                          ▼          ▼      ▼          ▼
                      exit=0     exit=1   exit=2   DeadlineExceeded
                          │        │        │          │
                          ▼        ▼        ▼          ▼
                       正常     §8.2     §8.3      §8.5
                       关闭    指纹漂移  服务不可达  超时
                       工单    回滚 §9              调参
```

### 8.1 Job 一直 Pending

**现象**: `kubectl get pods` 显示 Pod 状态为 `Pending`

**排查流程图**:
```
  Pod Pending
       │
       ▼
  kubectl describe pod <pod-name>
       │
       ├── Events 显示 ImagePullBackOff?
       │     │
       │     ▼
       │   §A: 镜像拉取失败
       │   解决: --set images.pythonRegistry=<内网镜像>
       │
       ├── Events 显示 Insufficient cpu/memory?
       │     │
       │     ▼
       │   §B: 资源不足
       │   解决: 降低 requests 或扩容节点
       │
       └── Events 显示 FailedScheduling (taint/toleration)?
             │
             ▼
           §C: 调度约束
           解决: 检查 nodeSelector / tolerations
```

**排查命令**:
```bash
# 查看 Pod 事件
kubectl -n v9-embedding describe pod <pod-name>

# 常见原因:
# 1) ImagePullBackOff — python:3.11-slim 拉取失败
#    解决: 配置镜像加速器或使用内网镜像
#    helm upgrade ... --set images.pythonRegistry=registry.internal
#
# 2) 资源不足 — 集群没有可用节点
#    解决: 降低资源请求或扩容节点
#    helm upgrade ... --set resources.requests.cpu=50m --set resources.requests.memory=64Mi
#
# 3) 调度约束 — nodeSelector / tolerations 不匹配
#    解决: helm upgrade ... --set nodeSelector={} --set tolerations=[]
```

### 8.2 Check 2 指纹漂移

**现象**: `[FAIL] [Check 2] 指纹漂移! 当前=xxx, 基线=yyy`

**排查流程图**:
```
  Check 2 FAIL: 指纹漂移
       │
       ▼
  提取完整日志 + 当前指纹 + 基线指纹
       │
       ▼
  ┌─── 检查 /api/embed/config 中 model_id ───┐
  │                                           │
  ▼                                           ▼
model_id ≠ all-MiniLM-L6-v2           model_id == all-MiniLM-L6-v2
  │                                           │
  ▼                                           ▼
§A: 模型被切换                          §B: 模型正确但指纹不同
→ 场景 A 回滚 (§9.5)                          │
                                              ▼
                                    ┌── 重新 --gen-baseline ──┐
                                    │                          │
                                    ▼                          ▼
                              新指纹 == 基线?            新指纹 ≠ 基线
                                    │                          │
                                    ▼                          ▼
                              基线 SHA 抄错              代码/配置隐式变更
                              修正 baseline.sha          → 场景 B/C 回滚
                              重跑验证                   (§9.6 / §9.7)
```

**排查步骤**:
```bash
# 1) 获取完整日志
kubectl -n v9-embedding logs job/<job-name> -c verifier

# 2) 检查基线是否正确
kubectl -n v9-embedding get configmap fingerprint-baseline -o yaml | grep baseline.sha

# 3) 确认 Embedding 服务的模型版本
kubectl -n v9-embedding exec <embedding-pod> -- \
  curl -s localhost:8001/api/embed/health | python3 -m json.tool

# 4) 如果模型 ID 不对 (例如 bge-large-zh 而非 all-MiniLM-L6-v2)
#    → 模型被切换了, 需要回滚 Embedding 服务 (§9.5 场景 A)
# 5) 如果模型 ID 正确但指纹不同
#    → 基线 SHA 可能抄错, 重新执行 --gen-baseline 确认
# 6) 如果 --gen-baseline 结果仍与基线不同
#    → 代码/配置引入隐式漂移, 按 §9.6 (维度漂移) 或 §9.7 (精度丢失) 排查
```

### 8.3 服务不可达 (exit code 2)

**现象**: `[FAIL] 服务预检失败: health=0 config=0 embed=0`

**排查流程图**:
```
  exit code 2: 服务不可达
       │
       ▼
  kubectl -n <ns> get svc <service-name>
       │
       ├── Service 不存在?
       │     │
       │     ▼
       │   §A: Service 名/namespace 配错
       │   解决: --set service.name=... --set service.namespace=...
       │
       └── Service 存在
             │
             ▼
       kubectl get endpoints
             │
             ├── Endpoints 为空?
             │     │
             │     ▼
             │   §B: Pod 未运行 / label 不匹配
             │   解决: 检查 Deployment / Pod 状态
             │
             └── Endpoints 有 IP
                   │
                   ▼
             从 debug Pod 测试连通性
                   │
                   ├── 超时?
                   │     │
                   │     ▼
                   │   §C: NetworkPolicy / 防火墙阻断
                   │   解决: 检查 NetworkPolicy 规则
                   │
                   └── 连接拒绝?
                         │
                         ▼
                       §D: Embedding 进程未启动
                       解决: 检查 Pod 日志 / 健康检查
```

**排查命令**:
```bash
# 1) 检查 Service 是否存在
kubectl -n v9-embedding get svc

# 2) 检查 Endpoints
kubectl -n v9-embedding get endpoints

# 3) 检查 Embedding Pod 是否运行
kubectl -n v9-embedding get pods -l app=v9-embedding

# 4) 从验证 Job 的 Pod 内部测试连通性
kubectl -n v9-embedding run debug --rm -it --image=python:3.11-slim -- \
  python3 -c "import urllib.request; print(urllib.request.urlopen('http://v9-embedding.v9-embedding.svc:8001/api/embed/health', timeout=5).read())"

# 5) 如果 Service 在其他 namespace
helm upgrade ... --set service.namespace=prod
# 或
helm upgrade ... --set service.hostOverride=v9-embedding.prod.svc.cluster.local

# 6) 检查 NetworkPolicy 是否阻断
kubectl -n v9-embedding get networkpolicy
```

### 8.4 ConfigMap 脚本缺失

**现象**: Pod 启动报错 `No such file or directory: /opt/verifier/verify-embedding-fingerprint.py`

**排查流程图**:
```
  Pod 启动失败: 脚本文件不存在
       │
       ▼
  kubectl get configmap fingerprint-script -o yaml
       │
       ├── ConfigMap 不存在?
       │     │
       │     ▼
       │   部署方式判断:
       │   ├─ Helm Chart → 检查 files/ 目录是否有脚本
       │   └─ 原生 YAML  → 手动创建 ConfigMap
       │
       └── ConfigMap 存在但 key 名不对?
             │
             ▼
           检查 VolumeMount mountPath 是否为 /opt/verifier
           检查 ConfigMap data key 是否为 verify-embedding-fingerprint.py
```

**排查命令**:
```bash
# 检查 ConfigMap 是否包含脚本
kubectl -n v9-embedding get configmap fingerprint-script -o yaml | head -20

# 如果使用 Helm Chart, 确保 files/ 目录有脚本
ls helm/fingerprint-verify/files/verify-embedding-fingerprint.py

# 如果使用原生 YAML, 手动创建 ConfigMap
kubectl -n v9-embedding create configmap fingerprint-script \
  --from-file=verify-embedding-fingerprint.py=./verify-embedding-fingerprint.py \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 8.5 Job 超时 (activeDeadlineSeconds)

**现象**: Pod 被 `DeadlineExceeded` 终止

**排查流程图**:
```
  Job DeadlineExceeded
       │
       ▼
  检查 Embedding 服务响应延迟
  curl -w "%{time_total}s" localhost:8001/api/embed/health
       │
       ├── 响应 > 10s?
       │     │
       │     ▼
       │   §A: Embedding 服务过载
       │   解决: 扩容 Embedding Pod / 检查 GPU 利用率
       │
       └── 响应 < 1s?
             │
             ▼
           §B: 超时阈值过低
           解决: --set runtime.timeoutSeconds=600
```

**解决命令**:
```bash
# 增加超时时间
helm upgrade ... --set runtime.timeoutSeconds=600

# 或检查 Embedding 服务响应时间
kubectl -n v9-embedding exec <embedding-pod> -- \
  curl -w "\n%{time_total}s\n" -s -o /dev/null http://localhost:8001/api/embed/health
```

---

## 9. 回滚策略

### 9.0 E2E 验证报告解读与部署决策

CI/CD 流水线在每次生产发布前自动执行 `e2e-rollback-fingerprint-sim.py` 6 阶段仿真,
产出验证报告。运维团队需根据报告结果决定是否允许发布:

#### 6 阶段仿真报告解读

| 阶段 | 说明 | 期望结果 | 失败含义 |
|------|------|---------|---------|
| Phase 1: 基线建立 | 生成基线指纹 | PASS | 仿真环境异常, 不可发布 |
| Phase 2: 合规升级 | 相同向量重算指纹 | PASS (与基线一致) | 指纹算法非确定性, 不可发布 |
| Phase 3: 模型切换事故 | 检测模型切换 | PASS (指纹漂移) | 指纹无法检测模型切换, 不可发布 |
| Phase 4: 维度漂移事故 | 检测维度变化 | PASS (指纹漂移) | 指纹无法检测维度漂移, 不可发布 |
| Phase 5: 精度丢失事故 | 检测精度退化 | PASS (指纹漂移) | 指纹无法检测精度丢失, 不可发布 |
| Phase 6: 回滚恢复 | 验证回滚后一致性 | PASS (与基线一致) | 回滚无法恢复一致性, 不可发布 |

#### 部署决策矩阵

```
E2E 仿真结果 (6/6 PASS)
        │
        ├── 全部 PASS → ✅ 允许发布, 继续 Linux 真实服务验证
        │
        ├── Phase 1/2 FAIL → ❌ 禁止发布, 指纹算法本身有问题
        │     动作: 通知开发团队修复 verify-embedding-fingerprint.py
        │
        ├── Phase 3/4/5 FAIL → ❌ 禁止发布, 指纹无法检测对应事故类型
        │     动作: 检查指纹算法是否被篡改, 通知开发团队
        │
        └── Phase 6 FAIL → ❌ 禁止发布, 回滚无法恢复一致性
              动作: 检查基线向量是否被污染, 重新生成 BASELINE_SHA
```

#### 报告获取方式

```bash
# 方式 1: GitHub Actions artifact 下载
# 在 Actions 运行页面下载 fingerprint-e2e-sim-report artifact

# 方式 2: 本地手动运行仿真
cd backend/deploy/releases/v1.2.0-support
python3 e2e-rollback-fingerprint-sim.py --seed 20260807 -v --json-output report.json

# 查看 JSON 报告
python3 -m json.tool report.json
```

报告 JSON 示例 (seed=20260807 实际输出):
```json
{
  "total_phases": 6,
  "passed": 6,
  "failed": 0,
  "baseline_fingerprint": "f93b8bbb48950a84",
  "phases": [
    {"name": "Phase 1: 基线建立",      "status": "PASS", "fingerprint": "f93b8bbb48950a84"},
    {"name": "Phase 2: 合规升级",      "status": "PASS", "fingerprint": "f93b8bbb48950a84"},
    {"name": "Phase 3: 模型切换事故",  "status": "PASS", "fingerprint": "c9d62af22bb9ff54"},
    {"name": "Phase 4: 维度漂移事故",  "status": "PASS", "fingerprint": "8f5a83dc1d6ddc1e"},
    {"name": "Phase 5: 精度丢失事故",  "status": "PASS", "fingerprint": "26fa8ce7342be7d5"},
    {"name": "Phase 6: 回滚恢复",      "status": "PASS", "fingerprint": "f93b8bbb48950a84"}
  ],
  "duration_ms": 0,
  "seed": 20260807
}
```

### 9.1 指纹验证失败后的回滚总流程

```
指纹验证失败 (exit=1)
        │
        ▼
   ┌─────────────────────────┐
   │ Step 1: 确认失败类型     │
   │ 查看日志中哪个 Check FAIL│
   └───────────┬─────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Check 1    Check 2    Check 3
 元数据错   指纹漂移   维度异常
    │          │          │
    ▼          ▼          ▼
 模型被切换  模型/代码   代码/配置
    │        变更        变更
    │          │          │
    └──────────┼──────────┘
               ▼
   ┌─────────────────────────┐
   │ Step 2: 回滚 Embedding   │
   │ 服务到 v1.1.0            │
   └───────────┬─────────────┘
               ▼
   ┌─────────────────────────┐
   │ Step 3: 重新部署验证 Job │
   │ helm upgrade --install   │
   │ --set baseline.sha=...   │
   └───────────┬─────────────┘
               ▼
   ┌─────────────────────────┐
   │ Step 4: 验证通过?        │
   │ exit=0 → 关闭工单        │
   │ exit=1 → 进 §8 FAQ 排查  │
   └─────────────────────────┘
```

### 9.2 Embedding 服务回滚命令

```bash
# 1. 备份当前版本
kubectl -n v9-embedding rollout undo deployment/v9-embedding

# 或指定回滚到的版本
kubectl -n v9-embedding rollout undo deployment/v9-embedding --to-revision=<revision号>

# 2. 等待 Rollout 完成
kubectl -n v9-embedding rollout status deployment/v9-embedding --timeout=5m

# 3. 重新执行指纹验证
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11"

kubectl -n v9-embedding wait job/fp-verify-v9-fingerprint-verify-job \
  --for=condition=Complete --timeout=5m

kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier
```

### 9.3 Helm Chart 回滚

```bash
# 查看 Helm 历史版本
helm history fp-verify --namespace v9-embedding

# 回滚到上一版本
helm rollback fp-verify 0 --namespace v9-embedding

# 完全卸载
helm uninstall fp-verify --namespace v9-embedding
```

### 9.4 回滚门禁检查清单

回滚完成后, 以下 4 项必须全绿才能关闭工单:

| # | 检查项 | 命令 | 预期 |
|---|--------|------|------|
| 1 | Embedding 服务运行 | `kubectl -n v9-embedding get pods -l app=v9-embedding` | 所有 Pod Running |
| 2 | 健康检查 | `kubectl -n v9-embedding exec <pod> -- curl -s localhost:8001/api/embed/health` | `status=ok, model_loaded=true` |
| 3 | 指纹验证 | `kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job` | `exit code = 0` |
| 4 | 元数据正确 | 同上日志 Check 1 | `model_id=all-MiniLM-L6-v2, dim=384` |

### 9.5 场景 A: 模型切换事故回滚

**触发条件**: Check 1 报告 `model_id` 不匹配 (例如 `bge-large-zh-v1.5` 而非 `all-MiniLM-L6-v2`),
对应 E2E 仿真 Phase 3。

**根因**: Embedding 服务的模型权重被误替换或镜像 tag 漂移。

**回滚流程图**:
```
  Check 1: model_id ≠ all-MiniLM-L6-v2
       │
       ▼
  确认当前镜像 tag
  kubectl get deploy v9-embedding -o jsonpath='{.spec.template.spec.containers[0].image}'
       │
       ├── 镜像 tag 是最新 tag (非 v1.1.0)?
       │     │
       │     ▼
       │  回滚 Deployment 到 v1.1.0 镜像
       │  kubectl rollout undo deploy/v9-embedding --to-revision=<v1.1.0 revision>
       │
       └── 镜像 tag 正确但模型文件被替换?
             │
             ▼
           检查模型挂载 PVC / ConfigMap
           kubectl get pvc,pv -n v9-embedding
           kubectl get configmap -n v9-embedding | grep model
             │
             ▼
           恢复 v1.1.0 模型文件 (从备份 / PVC snapshot)
       │
       ▼
  等待 Rollout 完成
  kubectl rollout status deploy/v9-embedding --timeout=5m
       │
       ▼
  重新执行指纹验证
  helm upgrade --install fp-verify helm/fingerprint-verify \
    --set baseline.sha="1f1f307f2eab7e11"
       │
       ▼
  exit=0? → ✅ 关闭工单
  exit=1? → §8.2 继续排查
```

**精确命令序列**:
```bash
# 1. 确认事故 — 检查当前 model_id
kubectl -n v9-embedding exec deploy/v9-embedding -- \
  curl -s localhost:8001/api/embed/config | python3 -m json.tool
# 预期看到 model_id != all-MiniLM-L6-v2

# 2. 查看 Deployment 修订历史
kubectl -n v9-embedding rollout history deploy/v9-embedding

# 3. 回滚到 v1.1.0 版本 (找到对应 revision 号)
kubectl -n v9-embedding rollout undo deploy/v9-embedding --to-revision=<revision号>

# 4. 等待 Rollout 完成
kubectl -n v9-embedding rollout status deploy/v9-embedding --timeout=5m

# 5. 确认 model_id 已恢复
kubectl -n v9-embedding exec deploy/v9-embedding -- \
  curl -s localhost:8001/api/embed/config | grep model_id
# 预期: "model_id": "all-MiniLM-L6-v2"

# 6. 重新执行指纹验证
kubectl -n v9-embedding delete job fp-verify-v9-fingerprint-verify-job 2>/dev/null || true
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11" \
  --set service.name="v9-embedding" \
  --set service.namespace="v9-embedding"

# 7. 等待验证结果
kubectl -n v9-embedding wait job/fp-verify-v9-fingerprint-verify-job \
  --for=condition=Complete --timeout=5m

# 8. 查看验证结果
kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier
```

### 9.6 场景 B: 维度漂移事故回滚

**触发条件**: Check 1 报告 `dim` 不匹配 (例如 `385` 而非 `384`), 或 Check 3 批量维度异常,
对应 E2E 仿真 Phase 4。

**根因**: 调试代码残留 (如 padding 一维), 或模型配置文件 dim 参数被误改。

**回滚流程图**:
```
  Check 1/3: dim ≠ 384 (如 385)
       │
       ▼
  检查 Embedding 配置
  kubectl exec deploy/v9-embedding -- \
    curl -s localhost:8001/api/embed/config | python3 -m json.tool
       │
       ├── dim 来自配置文件 / 环境变量?
       │     │
       │     ▼
       │  检查 ConfigMap / env
       │  kubectl get configmap -n v9-embedding
       │  kubectl get deploy v9-embedding -o yaml | grep -A5 env:
       │     │
       │     ├── 配置被改? → 恢复 v1.1.0 ConfigMap
       │     │
       │     └── 配置正确但 dim 仍错 → 检查代码镜像
       │
       └── dim 来自模型本身?
             │
             ▼
           代码镜像 tag 漂移, 残留调试代码
           → 回滚 Deployment 镜像到 v1.1.0
       │
       ▼
  等待 Rollout + 重新验证
       │
       ▼
  exit=0? → ✅ 关闭工单 + 排查调试代码为何残留 (code review)
  exit=1? → §8.2 继续排查
```

**精确命令序列**:
```bash
# 1. 确认事故 — 检查当前 dim
kubectl -n v9-embedding exec deploy/v9-embedding -- \
  curl -s localhost:8001/api/embed/config | python3 -c "
import sys, json
cfg = json.load(sys.stdin)
dim = cfg.get('dim') or cfg.get('embedding_dim')
print(f'当前 dim = {dim}')
if dim != 384:
    print(f'⚠️ 维度漂移! 期望 384, 实际 {dim}')
    sys.exit(1)
"

# 2. 检查配置来源 — ConfigMap
kubectl -n v9-embedding get configmap -l app=v9-embedding
kubectl -n v9-embedding get deploy v9-embedding -o yaml | grep -B2 -A10 "configMap:"

# 3. 检查环境变量
kubectl -n v9-embedding get deploy v9-embedding -o jsonpath='{.spec.template.spec.containers[0].env}' | python3 -m json.tool

# 4. 如果配置正确, 检查镜像 tag
kubectl -n v9-embedding get deploy v9-embedding \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""
# 如果 tag 不是 v1.1.0, 执行回滚

# 5. 回滚 Deployment
kubectl -n v9-embedding rollout undo deploy/v9-embedding --to-revision=<v1.1.0 revision>

# 6. 等待 Rollout 完成
kubectl -n v9-embedding rollout status deploy/v9-embedding --timeout=5m

# 7. 确认 dim 已恢复
kubectl -n v9-embedding exec deploy/v9-embedding -- \
  curl -s localhost:8001/api/embed/config | grep -o '"dim":[0-9]*'

# 8. 重新执行指纹验证
kubectl -n v9-embedding delete job fp-verify-v9-fingerprint-verify-job 2>/dev/null || true
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11"
kubectl -n v9-embedding wait job/fp-verify-v9-fingerprint-verify-job \
  --for=condition=Complete --timeout=5m
kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier

# 9. 事后: 排查调试代码为何残留, 加强 CI 代码审查
```

### 9.7 场景 C: 精度丢失事故回滚

**触发条件**: Check 1 元数据全部正确, 但 Check 2 指纹漂移,
对应 E2E 仿真 Phase 5 (float32 → float16 截断)。

**根因**: GPU 推理精度配置错误 (FP16 被意外启用), 或模型量化参数被改。

**识别特征**: model_id / dim / max_batch 全部正确, 但指纹不同 — 这是最隐蔽的漂移类型。

**回滚流程图**:
```
  Check 1 PASS (元数据全对) + Check 2 FAIL (指纹漂移)
       │
       ▼
  检查推理精度配置
  kubectl exec deploy/v9-embedding -- \
    curl -s localhost:8001/api/embed/config | python3 -m json.tool
       │
       ├── 有 dtype / precision 字段?
       │     │
       │     ├── dtype=float16 / precision=half?
       │     │     │
       │     │     ▼
       │     │  §A: 推理精度被降为 FP16
       │     │  检查环境变量 / 启动参数
       │     │  kubectl get deploy v9-embedding -o yaml | grep -i "dtype\|precision\|fp16\|half"
       │     │     │
       │     │     ▼
       │     │  移除 FP16 配置, 恢复 FP32
       │     │  → 回滚 Deployment
       │     │
       │     └── dtype=float32 / precision=full?
       │           │
       │           ▼
       │         §B: 精度配置正确, 可能是模型权重变化
       │         → 回滚 Deployment 镜像 + 模型文件
       │
       └── 无 dtype / precision 字段?
             │
             ▼
           §C: 检查环境变量中是否有 FORCE_FP16 / TORCH_HALF
           kubectl get deploy v9-embedding -o yaml | grep -iE "fp16|half|float16"
           → 清除相关环境变量, 重新部署
       │
       ▼
  重新验证
       │
       ▼
  exit=0? → ✅ 关闭工单 + 加固精度配置告警
  exit=1? → §8.2 继续排查 (可能同时存在多种漂移)
```

**精确命令序列**:
```bash
# 1. 确认事故 — 元数据全对但指纹漂移
kubectl -n v9-embedding exec deploy/v9-embedding -- \
  curl -s localhost:8001/api/embed/config | python3 -m json.tool
# 预期: model_id=对, dim=384, 但指纹不同

# 2. 检查推理精度配置
kubectl -n v9-embedding get deploy v9-embedding -o yaml | \
  grep -iE "dtype|precision|fp16|half|float16|FORCE_FP16|TORCH_HALF"

# 3. 检查启动命令 / args
kubectl -n v9-embedding get deploy v9-embedding \
  -o jsonpath='{.spec.template.spec.containers[0].args}'
echo ""
kubectl -n v9-embedding get deploy v9-embedding \
  -o jsonpath='{.spec.template.spec.containers[0].command}'
echo ""

# 4. 如果发现 FP16 相关配置, 回滚到 v1.1.0
kubectl -n v9-embedding rollout undo deploy/v9-embedding --to-revision=<v1.1.0 revision>

# 5. 等待 Rollout 完成
kubectl -n v9-embedding rollout status deploy/v9-embedding --timeout=5m

# 6. 确认精度配置已恢复 (无 FP16 相关环境变量)
kubectl -n v9-embedding get deploy v9-embedding -o yaml | \
  grep -iE "fp16|half|float16" && echo "⚠️ 仍有 FP16 配置" || echo "✅ FP16 配置已清除"

# 7. 重新执行指纹验证
kubectl -n v9-embedding delete job fp-verify-v9-fingerprint-verify-job 2>/dev/null || true
helm upgrade --install fp-verify helm/fingerprint-verify \
  --namespace v9-embedding \
  --set baseline.sha="1f1f307f2eab7e11"
kubectl -n v9-embedding wait job/fp-verify-v9-fingerprint-verify-job \
  --for=condition=Complete --timeout=5m
kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier

# 8. 事后: 在 Deployment 中增加精度配置告警
#    kubectl annotate deploy v9-embedding monitoring.precision="float32"
```

### 9.8 三种场景快速对照表

| 维度 | 场景 A: 模型切换 | 场景 B: 维度漂移 | 场景 C: 精度丢失 |
|------|-----------------|-----------------|-----------------|
| **对应仿真阶段** | Phase 3 | Phase 4 | Phase 5 |
| **Check 1 (元数据)** | FAIL (model_id 错) | FAIL (dim 错) | PASS (全对) |
| **Check 2 (指纹)** | FAIL | FAIL | FAIL |
| **Check 3 (维度)** | 可能 PASS | FAIL | PASS |
| **漂移隐蔽性** | 低 (元数据暴露) | 中 (维度暴露) | **高** (仅指纹暴露) |
| **常见根因** | 镜像 tag 漂移 / 模型文件替换 | 调试代码残留 / 配置误改 | FP16 意外启用 / 量化参数变更 |
| **回滚方式** | rollout undo + 模型文件恢复 | rollout undo + ConfigMap 恢复 | rollout undo + 清除 FP16 环境变量 |
| **事后加固** | 镜像 tag 锁定 / admission webhook | CI 代码审查 / dim 断言 | 精度配置告警 / 启动参数校验 |

---

## 10. 附录: 资源清单

### 10.1 部署创建的 K8s 资源

| 资源类型 | 名称 | 作用 |
|---------|------|------|
| Namespace | `v9-embedding` | 隔离验证资源 |
| ServiceAccount | `fingerprint-verify-sa` | Job 运行身份 |
| Role | `fingerprint-verify-role` | 最小权限 (get/list pods) |
| RoleBinding | `fingerprint-verify-binding` | SA ↔ Role 绑定 |
| ConfigMap | `fingerprint-baseline` | 基线 SHA 存储 |
| ConfigMap | `fingerprint-script` | 验证脚本存储 |
| Job | `fingerprint-verify-job` | 一次性验证执行 |
| CronJob (可选) | `fingerprint-verify-cron` | 周期性巡检 |

### 10.2 文件清单

| 文件 | 路径 | 作用 |
|------|------|------|
| 验证脚本 | `verify-embedding-fingerprint.py` | 核心验证逻辑 (4 层断言) |
| E2E 仿真脚本 | `e2e-rollback-fingerprint-sim.py` | 6 阶段回滚一致性仿真 (CI 门禁) |
| Helm Chart | `helm/fingerprint-verify/` | Helm 打包 |
| 部署清单 | `fingerprint-verify-deployment.yaml` | 原生 YAML |
| 自动化脚本 | `deploy-fingerprint-verify.sh` | 一键部署+验证 |
| 本手册 | `DEPLOY-OPS-MANUAL.md` | 运维操作手册 |
| 培训大纲 | `TRAINING-PPT-OUTLINE.md` | 运维团队培训 PPT 大纲 |
| CI 工作流 | `.github/workflows/pre-release-fingerprint-verify.yml` | CI/CD 门禁 (含 E2E 仿真) |

### 10.3 关键命令速查

```bash
# === 部署 ===
helm upgrade --install fp-verify helm/fingerprint-verify -n v9-embedding --set baseline.sha="1f1f307f2eab7e11"

# === 查看 Job 状态 ===
kubectl -n v9-embedding get job

# === 等待完成 ===
kubectl -n v9-embedding wait job/fp-verify-v9-fingerprint-verify-job --for=condition=Complete --timeout=5m

# === 查看日志 ===
kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier

# === 提取 JSON ===
kubectl -n v9-embedding logs job/fp-verify-v9-fingerprint-verify-job -c verifier | sed -n '/RESULT BEGIN/,/RESULT END/p' | sed '1d;$d' | python3 -m json.tool

# === 重新运行 ===
kubectl -n v9-embedding delete job fp-verify-v9-fingerprint-verify-job
helm upgrade --install fp-verify helm/fingerprint-verify -n v9-embedding --set baseline.sha="1f1f307f2eab7e11"

# === 卸载 ===
helm uninstall fp-verify -n v9-embedding

# === 自动化脚本 ===
./deploy-fingerprint-verify.sh --baseline 1f1f307f2eab7e11 --namespace v9-embedding

# === Dry Run ===
./deploy-fingerprint-verify.sh --dry-run

# === CronJob 手动触发 ===
kubectl -n v9-embedding create job manual-verify --from=cronjob/fp-verify-v9-fingerprint-verify-cron

# === E2E 回滚仿真 (CI 门禁, 本地可手动运行) ===
python3 e2e-rollback-fingerprint-sim.py --seed 20260807 -v --json-output report.json

# === 回滚 Embedding 服务 ===
kubectl -n v9-embedding rollout undo deploy/v9-embedding --to-revision=<revision号>
kubectl -n v9-embedding rollout status deploy/v9-embedding --timeout=5m
```
