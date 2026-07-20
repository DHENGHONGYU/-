/**
 * @module services/trading/use-cases
 * @description 交易域用例层 —— 对外暴露的稳定用例 API
 *
 * 用例层 vs 服务层的区别：
 *   - 用例层：编排多个服务，对应一个完整的业务场景（如"下单"、"调仓"）
 *   - 服务层：单一职责的领域服务（如"风控校验"、"仓位计算"）
 *
 * 所有对外部（MCP / UI / Store）暴露的交易操作，
 * 应该走用例层，而不是直接调用内部服务。
 */

export { placeBuyOrder, placeSellOrder } from './placeOrder'
export type { PlaceOrderResult } from './placeOrder'
