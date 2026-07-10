# 代码安全校对报告

## 基本信息
- 项目名称: 测试项目
- 项目 ID: test-project-1
- 扫描时间: 2026/7/8 22:00:42
- 总体风险等级: 危急

## 问题统计
| 级别 | 数量 |
|------|------|
| 严重 | 2 |
| 高危 | 0 |
| 中危 | 1 |
| 低危 | 0 |
| 总计 | 3 |

## 摘要
项目 测试项目 的代码安全校对已完成。 本地扫描共检查 2 个文件。 云端风险检查共验证 2 个文件哈希，发现 0 个风险文件。 发现 2 个严重问题，建议立即修复。 发现 1 个中危问题，建议规划修复。

## 修复建议
1. [Hardcoded Password] 检测硬编码的密码，请修复文件 C:\Users\huawei\AppData\Local\Temp\hybrid-proofread-test-FkOeYn/src/config/env.ts 第 6 行
2. [Hardcoded Password] 检测硬编码的密码，请修复文件 C:\Users\huawei\AppData\Local\Temp\hybrid-proofread-test-FkOeYn/src/index.ts 第 2 行
3. [HTTP URL Usage] 检测使用 HTTP 而非 HTTPS 的 URL

## 本地扫描详情
- 扫描文件数: 2
- 跳过文件数: 0
- 规则匹配数: 3

## 云端风险详情
- 验证哈希数: 2
- 风险文件数: 0
- 风险条目数: 0