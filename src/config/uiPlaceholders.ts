/**
 * UI 层占位符常量。
 *
 * 提取自 ApiConfigurationPage / LlmManagementPage 的 endpoint / baseURL 输入框
 * placeholder 示例。audit:hardcode「硬编码 URL」门禁要求字面量仅出现在配置层，
 * 故将示例 URL 收敛到本文件，页面层以常量引用，避免非配置层出现硬编码 URL。
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/
export const API_ENDPOINT_PLACEHOLDER = 'https://api.example.com'
