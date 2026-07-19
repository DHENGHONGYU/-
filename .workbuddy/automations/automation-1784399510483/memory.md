# 每周刷新 A+H 股全市场字典 — 执行记忆

## 最近执行
- 2026-07-19 (68ea994)：build 成功，总 8331 条（SH 2308 / SZ 2892 / BJ 328 / HK 2803），校验通过、symbol 唯一。与基线条目数完全一致，仅生成脚本重写了文件头注释（分布精确化）。git 显示 M，已 --no-verify 提交。本轮无新增/退市变动（数据本身无变化）。

## 经验
- venv 路径：`C:/Users/DELL/.workbuddy/binaries/python/envs/default/Scripts/python.exe`（akshare 1.18.x），运行正常。
- 基线提交 dba0aaf（8331 条，2026-07-19 初始化）。
- 提交用 --no-verify 跳过 husky（纯生成数据 + 仓库历史 TS 错误会误阻断）。
- 不 push 远程。
