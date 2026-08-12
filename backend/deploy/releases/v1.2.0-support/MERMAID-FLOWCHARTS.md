# Mermaid 流程图集 — DEPLOY-OPS-MANUAL.md 故障排查与回滚

> **用途**: 将 `DEPLOY-OPS-MANUAL.md` 中的 ASCII 流程图转换为 Mermaid 代码,
> 方便插入 Markdown 文档 / Notion / Confluence 等支持 Mermaid 渲染的平台.
>
> **对应手册章节**: §8 常见问题排查 / §9 回滚策略

---

## §8.0 故障排查总览流程图

```mermaid
flowchart TD
    A[验证 Job 异常] --> B{kubectl get job}
    B -->|Job 不存在| C[§8.4 ConfigMap 脚本缺失?]
    B -->|Job 存在| D[kubectl get pods]
    D --> E{Pod 状态}
    E -->|Pending| F[§8.1 Job Pending]
    E -->|Running / 正常退出| G[提取 JSON exit_code]
    E -->|Error / ExitCode| G
    G --> H{exit_code}
    H -->|exit=0| I[✅ 正常 关闭工单]
    H -->|exit=1| J[§8.2 指纹漂移 → 回滚 §9]
    H -->|exit=2| K[§8.3 服务不可达]
    H -->|DeadlineExceeded| L[§8.5 超时 调参]
```

---

## §8.1 Job 一直 Pending

```mermaid
flowchart TD
    A[Pod Pending] --> B[kubectl describe pod]
    B --> C{Events 分析}
    C -->|ImagePullBackOff| D[§A: 镜像拉取失败]
    D --> D1[设置 images.pythonRegistry 为内网镜像]
    C -->|Insufficient cpu/memory| E[§B: 资源不足]
    E --> E1[降低 resources.requests 或扩容节点]
    C -->|FailedScheduling taint| F[§C: 调度约束]
    F --> F1[检查 nodeSelector / tolerations]
```

---

## §8.2 Check 2 指纹漂移

```mermaid
flowchart TD
    A["Check 2 FAIL: 指纹漂移"] --> B[提取完整日志 + 当前指纹 + 基线指纹]
    B --> C[检查 /api/embed/config 中 model_id]
    C --> D{model_id 是否正确?}
    D -->|model_id ≠ all-MiniLM-L6-v2| E[§A: 模型被切换]
    E --> E1[→ 场景 A 回滚 §9.5]
    D -->|model_id == all-MiniLM-L6-v2| F[§B: 模型正确但指纹不同]
    F --> G[重新 --gen-baseline]
    G --> H{新指纹 == 基线?}
    H -->|是| I[基线 SHA 抄错<br/>修正 baseline.sha 重跑验证]
    H -->|否| J[代码/配置隐式变更<br/>→ 场景 B/C 回滚 §9.6 / §9.7]
```

---

## §8.3 服务不可达 (exit code 2)

```mermaid
flowchart TD
    A["exit code 2: 服务不可达"] --> B["kubectl get svc"]
    B --> C{Service 是否存在?}
    C -->|不存在| D[§A: Service 名/namespace 配错]
    D --> D1[修正 service.name / service.namespace]
    C -->|存在| E[kubectl get endpoints]
    E --> F{Endpoints 是否为空?}
    F -->|为空| G[§B: Pod 未运行 / label 不匹配]
    G --> G1[检查 Deployment / Pod 状态]
    F -->|有 IP| H[从 debug Pod 测试连通性]
    H --> I{连接结果}
    I -->|超时| J[§C: NetworkPolicy / 防火墙阻断]
    J --> J1[检查 NetworkPolicy 规则]
    I -->|连接拒绝| K[§D: Embedding 进程未启动]
    K --> K1[检查 Pod 日志 / 健康检查]
```

---

## §8.4 ConfigMap 脚本缺失

```mermaid
flowchart TD
    A[Pod 启动失败: 脚本文件不存在] --> B[kubectl get configmap fingerprint-script]
    B --> C{ConfigMap 是否存在?}
    C -->|不存在| D{部署方式判断}
    D -->|Helm Chart| E[检查 files/ 目录是否有脚本]
    D -->|原生 YAML| F[手动创建 ConfigMap]
    C -->|存在| G{key 名是否正确?}
    G -->|key 名不对| H[检查 VolumeMount mountPath]
    H --> I[检查 ConfigMap data key 名称]
```

---

## §8.5 Job 超时 (activeDeadlineSeconds)

```mermaid
flowchart TD
    A[Job DeadlineExceeded] --> B[检查 Embedding 服务响应延迟]
    B --> C["curl -w time_total localhost:8001/api/embed/health"]
    C --> D{响应时间}
    D -->|> 10s| E[§A: Embedding 服务过载]
    E --> E1[扩容 Embedding Pod / 检查 GPU 利用率]
    D -->|< 1s| F[§B: 超时阈值过低]
    F --> F1["设置 runtime.timeoutSeconds=600"]
```

---

## §9.0 E2E 验证报告部署决策矩阵

```mermaid
flowchart TD
    A[E2E 仿真结果] --> B{6 阶段结果}
    B -->|全部 PASS| C[✅ 允许发布<br/>继续 Linux 真实服务验证]
    B -->|Phase 1/2 FAIL| D[❌ 禁止发布<br/>指纹算法本身有问题]
    D --> D1[通知开发团队修复<br/>verify-embedding-fingerprint.py]
    B -->|Phase 3/4/5 FAIL| E[❌ 禁止发布<br/>指纹无法检测对应事故类型]
    E --> E1[检查指纹算法是否被篡改]
    B -->|Phase 6 FAIL| F[❌ 禁止发布<br/>回滚无法恢复一致性]
    F --> F1[检查基线向量是否被污染<br/>重新生成 BASELINE_SHA]
```

---

## §9.1 指纹验证失败后的回滚总流程

```mermaid
flowchart TD
    A[指纹验证失败 exit=1] --> B[Step 1: 确认失败类型<br/>查看日志中哪个 Check FAIL]
    B --> C{哪个 Check 失败?}
    C -->|Check 1 元数据错| D[模型被切换]
    C -->|Check 2 指纹漂移| E[模型/代码变更]
    C -->|Check 3 维度异常| F[代码/配置变更]
    D --> G[Step 2: 回滚 Embedding 服务到 v1.1.0]
    E --> G
    F --> G
    G --> H[Step 3: 重新部署验证 Job<br/>helm upgrade --install]
    H --> I[Step 4: 验证通过?]
    I -->|exit=0| J[✅ 关闭工单]
    I -->|exit=1| K[进 §8 FAQ 排查]
```

---

## §9.5 场景 A: 模型切换事故回滚

```mermaid
flowchart TD
    A["Check 1: model_id ≠ all-MiniLM-L6-v2"] --> B[确认当前镜像 tag]
    B --> C{kubectl get deploy image}
    C -->|镜像 tag 是最新非 v1.1.0| D[回滚 Deployment 到 v1.1.0 镜像]
    D --> D1["kubectl rollout undo --to-revision"]
    C -->|镜像 tag 正确但模型文件被替换| E[检查模型挂载 PVC / ConfigMap]
    E --> F[恢复 v1.1.0 模型文件<br/>从备份 / PVC snapshot]
    D1 --> G[等待 Rollout 完成]
    F --> G
    G --> G1["kubectl rollout status --timeout=5m"]
    G1 --> H[重新执行指纹验证]
    H --> I{exit code?}
    I -->|exit=0| J[✅ 关闭工单]
    I -->|exit=1| K[§8.2 继续排查]
```

---

## §9.6 场景 B: 维度漂移事故回滚

```mermaid
flowchart TD
    A["Check 1/3: dim ≠ 384 如 385"] --> B[检查 Embedding 配置]
    B --> C[dim 来源判断]
    C -->|dim 来自配置文件/环境变量| D[检查 ConfigMap / env]
    D --> E{配置是否被改?}
    E -->|配置被改| F[恢复 v1.1.0 ConfigMap]
    E -->|配置正确但 dim 仍错| G[检查代码镜像]
    C -->|dim 来自模型本身| G
    G --> H[代码镜像 tag 漂移<br/>残留调试代码]
    H --> I[回滚 Deployment 镜像到 v1.1.0]
    F --> J[等待 Rollout + 重新验证]
    I --> J
    J --> K{exit code?}
    K -->|exit=0| L[✅ 关闭工单<br/>排查调试代码为何残留]
    K -->|exit=1| M[§8.2 继续排查]
```

---

## §9.7 场景 C: 精度丢失事故回滚

```mermaid
flowchart TD
    A["Check 1 PASS 元数据全对<br/>+ Check 2 FAIL 指纹漂移"] --> B[检查推理精度配置]
    B --> C{有 dtype/precision 字段?}
    C -->|dtype=float16 / precision=half| D[§A: 推理精度被降为 FP16]
    D --> D1[检查环境变量 / 启动参数]
    D1 --> D2[移除 FP16 配置 恢复 FP32]
    D2 --> E[回滚 Deployment]
    C -->|dtype=float32 / precision=full| F[§B: 精度配置正确<br/>可能是模型权重变化]
    F --> F1[回滚 Deployment 镜像 + 模型文件]
    C -->|无 dtype/precision 字段| G[§C: 检查环境变量]
    G --> G1["grep -iE fp16|half|float16"]
    G1 --> G2[清除相关环境变量 重新部署]
    E --> H[重新验证]
    F1 --> H
    G2 --> H
    H --> I{exit code?}
    I -->|exit=0| J[✅ 关闭工单<br/>加固精度配置告警]
    I -->|exit=1| K[§8.2 继续排查<br/>可能同时存在多种漂移]
```

---

## 使用说明

1. **GitHub / GitLab**: 直接将上述 ` ```mermaid ` 代码块粘贴到 Markdown 文件中, 平台原生渲染.
2. **Notion**: 粘贴 Mermaid 代码到 `/mermaid` 块中.
3. **Confluence**: 安装 Mermaid Charts 插件后插入宏.
4. **VS Code**: 安装 Markdown Preview Mermaid Support 插件, 预览 Markdown 即可渲染.
5. **独立导出**: 将代码粘贴到 [mermaid.live](https://mermaid.live) 在线编辑器, 导出 SVG/PNG.
