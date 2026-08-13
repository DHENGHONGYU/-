/**
 * 买卖点标注构建器
 *
 * 将交易信号和订单转换为 K 线图 markers，
 * 以及从订单历史中提取买卖点标注。
 *
 * P1-12 分层合规：纯函数实现已下沉到 src/domain/trading/markers.ts，
 *   本文件 re-export 保持 API 零破坏。
 *
 * @doc [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-FRONT-020]
 */

export {
  signalsToMarkers,
  ordersToMarkers,
  ordersToAnnotatedPoints,
  signalsToAnnotatedPoints,
} from '@/domain/trading/markers'
