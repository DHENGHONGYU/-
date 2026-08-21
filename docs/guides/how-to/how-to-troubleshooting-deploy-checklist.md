---
type: how-to
domain: backend
phase: deployment
title: how-to-troubleshooting-deploy-checklist
code_version: "2.0.0-rc.2"
tier: important
status: active
version: v1.0.0
last_updated: 2026-08-16
doc_id: V9-DOC-HOW-906
change_log:
  - version: v1.0.0
    changes: "初版：整理 PowerShell .ps1 编码坑与 Docker 镜像模块缺失两类故障的标准排查清单（2026-08-16 部署实战提炼）"
    date: 2026-08-16
---

# 部署故障排查清单（PS 编码 / 镜像模块缺失）

> **用途**：遇到同类故障时按"现象 → 30 秒定位 → 修复"三步走，不重新踩坑。来源：2026-08-16 容器化部署实战。

---

## 清单 A：PowerShell 脚本中文乱码 / 解析崩溃

### 现象（命中任意一条即此坑）

- `powershell -File xxx.ps1` 报 `The string is missing the terminator: "`
- 报 `Missing expression after ','` 但该行语法肉眼检查无误
- 报错信息中行内容显示乱码（如 `鎺掓煡锛?`）
- 偶发 `Unexpected token ')'`，且脚本含中文注释/中文字符串

### 根因

Windows PowerShell 5.1 对**无 BOM 的 UTF-8** 文件按 ANSI/GBK 解码。中文字节被错误切分后恰好产生引号/反引号字符，破坏字符串边界，报错行往往**不是真正的出错行**（在更早的位置）。

### 30 秒定位

```powershell
# 看前 3 字节：输出 239 187 191 = EF BB BF = 已有 BOM（排除此坑）；无输出 = 无 BOM（命中）
[System.IO.File]::ReadAllBytes('D:\FinSightV9\scripts\xxx.ps1') | Select-Object -First 3
```

### 修复（补 BOM）

```powershell
$f = 'D:\FinSightV9\scripts\xxx.ps1'
$text = [System.IO.File]::ReadAllText($f, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($f, $text, [System.Text.UTF8Encoding]::new($true))
```

> 已修复文件：[api-restart-regression.ps1](../../../scripts/api-restart-regression.ps1)、[dev-prestart-check.ps1](../../../scripts/dev-prestart-check.ps1)

### 连带坑（同场景高发）

| 坑 | 现象 | 修复 |
|---|---|---|
| `&&` 语句分隔符 | `The token '&&' is not a valid statement separator` | PS 5.1 用 `;` 链接命令；`&&` 仅 PS 7+ 支持 |
| 外层命令插值 | `-Command "$f..."` 中 `$f`/`$_` 被吃掉变空 | 改写为 `-File 脚本.ps1` 执行；临时脚本本身必须纯 ASCII（否则触发本坑） |
| 单对象 `.Count` | 计数为空、`if ($n -gt 0)` 永假 | 用 `@(管道结果).Count` 强制数组 |

### 预防规则

1. 所有含非 ASCII 字符的 `.ps1` 保存为 **UTF-8 with BOM**（VS Code 右下角编码 → "Save with Encoding" → UTF-8 with BOM）。
2. 纯 ASCII 的临时脚本最稳（转换编码用的工具脚本不要含中文注释）。
3. 新脚本先跑 `powershell -File 脚本.ps1 -WhatIf`（或空跑参数分支）验证可解析。

---

## 清单 B：Docker 镜像运行时 ImportError（模块缺失）

### 现象（命中任意一条即此坑）

- 容器健康检查通过，但调用特定接口返回 `No module named '_xxx'`
- 日志出现 `ImportError` / `ModuleNotFoundError`，且模块文件在宿主机**确实存在**
- 仅个别接口失败，其余接口正常（延迟导入的典型特征）

### 根因

Python 模块在函数体内 `import`（延迟导入，如 [collect_endpoints.py](../../../python/data_service/collect_endpoints.py) 的 `from _sector_fund_flow import ...`），启动时不加载 → **HEALTHCHECK 探测不到**；而 [Dockerfile](../../../python/data_service/Dockerfile) 漏 COPY 该文件 → 只在真实调用时炸。

本例缺失链（板块资金流 L1→L2→L3 降级）：

```
collect_endpoints.py → _sector_fund_flow.py → _ths_hexinv.py
                                        └──→ _sector_fund_flow_db.py
```

### 30 秒定位（三连验证）

```powershell
# 1. 文件是否进镜像
docker exec v9-data-collector ls -la /app/_sector_fund_flow.py

# 2. 能否 import（比文件存在更强：语法+依赖全链验证）
docker exec v9-data-collector python -c "import _sector_fund_flow; print('OK')"

# 3. 宿主机↔容器内容一致性（MD5 对比，排查"改了代码没重建镜像"）
docker exec v9-data-collector md5sum /app/_sector_fund_flow.py
certutil -hashfile "D:\FinSightV9\python\data_service\_sector_fund_flow.py" MD5
```

### 修复

1. Dockerfile 补 `COPY _xxx.py ./`（模块有本地依赖时递归补全）
2. 重建并重启：`docker compose up -d --build data-collector`
3. 重跑回归：`powershell -ExecutionPolicy Bypass -File scripts/api-restart-regression.ps1 -Restart`（8/8 PASS 为闭环标准）

### 预防规则

1. **新增 `import _xxx` 本地模块时，同批在 Dockerfile 补 COPY 行**——健康检查无法覆盖延迟导入。
2. 依赖链排查命令：`Grep "^(from|import) _" 模块文件`，逐级确认。
3. 镜像内验证优先用 `python -c "import ..."` 而非 `ls`（能同时暴露二级依赖缺失）。

---

## 快速诊断命令速查

| 场景 | 命令 |
|---|---|
| 脚本是否带 BOM | `[System.IO.File]::ReadAllBytes($f) \| Select-Object -First 3` |
| 镜像内模块导入 | `docker exec v9-data-collector python -c "import _xxx; print('OK')"` |
| 容器/宿主机文件比对 | `docker exec ... md5sum` vs `certutil -hashfile ... MD5` |
| 容器是否用新镜像 | `docker inspect v9-data-collector --format "{{.Image}}"` vs `docker images finsightv9-data-collector` |
| 全链路回归 | `powershell -ExecutionPolicy Bypass -File scripts/api-restart-regression.ps1 -Restart` |

---

## 相关文档

- [how-to-deploy-docker-network.md](how-to-deploy-docker-network.md) — 部署主文档（IPv6/端口/网络/镜像四类坑详解）
- [how-to-troubleshooting.md](how-to-troubleshooting.md) — 通用排障手册
