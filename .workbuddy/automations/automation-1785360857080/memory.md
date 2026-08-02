# automation-1785360857080 执行记忆

## 任务定义
- 名称：FinSightV9 每周 A+H 股票字典刷新
- 计划：每周日 03:00（rrule `0 3 * * 0`）
- 执行：运行 `npm run build:stock-dict`（经 `scripts/run-venv-python.cjs` 基于 USERPROFILE 动态解析受管 venv，抓取 akshare 再生 `src/services/stock/stockDictionary.ts`）→ `npm run build:stock-dict:verify`（四交易所分布+零重复）→ 有变更则 `--no-verify` 提交（不 push）。

## 有效运行记录
- 上次有效刷新：字典 8341 条（SH 2310 / SZ 2893 / BJ 331 / HK 2807），提交 `040ca668`（父 `9a8c6627`），树 `48d18589` 有效。
- 防回归：`generate-stock-dict.py` 模板已加 `swL1/swL2/swL3` 可选字段；`package.json` 5 条 DELL venv 硬路径已全部改为便携启动器。

## 2026-08-01 备注
- 本轮对话主线转入「硬编码路径根治」（消除华为/DELL 用户目录与盘符路径共存），非本定时任务范围，但同仓同机；路径治理已收口（活跃代码零命中）。
- 定时刷新机制本身保持可用；下次到点运行应仍能正常再生字典。
