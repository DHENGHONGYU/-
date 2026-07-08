#!/usr/bin/env python3
"""
数据链路时序图生成器
生成包含数据采集、处理、分析、存储、输出及回馈机制的完整链路时序图

运行方式：
python scripts/generate_data_link_diagram.py > docs/data_link_sequence_diagram.md
"""

def generate_sequence_diagram():
    """生成完整的数据链路时序图（Mermaid格式）"""
    diagram = """# DataBridge 完整数据链路时序图

## 一、数据采集→处理→分析→存储→输出主链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as UI层
    participant Store as Store层
    participant Fetcher as FetcherService
    participant DataBridge as DataBridge
    participant DataLayer as DataLayer
    participant DB as IndexedDB
    participant Scoring as V6ScoreEngine
    participant Strategy as StrategyEngine
    participant Trading as TradingService
    participant Feedback as FeedbackOrchestrator

    Note over User,Feedback: T0: 用户触发数据采集请求
    User->>UI: 点击"采集股票数据"
    UI->>Store: fetchStock(symbol)
    Store->>Fetcher: fetchStockBasic(symbol)
    
    Note over Fetcher,DB: T1: 数据采集阶段
    Fetcher->>Fetcher: collectBasic(symbol)
    Fetcher-->>Fetcher: HTTP请求Python采集服务
    Fetcher->>Fetcher: adaptBasicDataToStock()
    Fetcher->>DataBridge: forward(INSERT_STOCK)
    
    DataBridge->>DataBridge: ACL校验
    DataBridge->>DataLayer: stocks.save(stock)
    DataLayer->>DB: transaction.put(stocks, stock)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge->>DataBridge: broadcast(stocks, envelope)
    DataBridge-->>Fetcher: {success: true}
    Fetcher-->>Store: {success: true, data: stock}
    Store-->>UI: 更新stock状态
    
    Note over Fetcher,DB: T2: K线数据采集
    Store->>Fetcher: fetchStockKline(symbol)
    Fetcher->>Fetcher: collectKline(symbol)
    Fetcher-->>Fetcher: HTTP请求K线数据
    Fetcher->>Fetcher: adaptKlineDataToDailyQuotes()
    Fetcher->>DataBridge: forward(SAVE_DAILY_QUOTES)
    DataBridge->>DataLayer: dailyQuotes.save(quotes)
    DataLayer->>DB: transaction.put(dailyQuotes, quotes)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge->>DataBridge: broadcast(dailyQuotes, envelope)
    DataBridge-->>Fetcher: {success: true}
    Fetcher-->>Store: {success: true, data: quotes}
    
    Note over Scoring,DB: T3: V6评分计算（L-1~L8共11层）
    User->>UI: 点击"运行评分"
    UI->>Store: runV6Score(symbol)
    Store->>Scoring: runV6Score(symbol)
    
    Scoring->>DataLayer: stocks.get(symbol)
    DataLayer->>DB: get(stocks, symbol)
    DB-->>DataLayer: stock
    DataLayer-->>Scoring: stock
    
    Scoring->>DataLayer: dailyQuotes.get(symbol)
    DataLayer->>DB: get(dailyQuotes, symbol)
    DB-->>DataLayer: quotes
    DataLayer-->>Scoring: quotes
    
    Scoring->>Scoring: buildEngineInput()
    Scoring->>Scoring: engine.calculateAll(input)
    Note over Scoring: L-1行业评分→L0宏观→L1护城河→L2竞品→L3财务/估值→L4情景→L5技术成熟度→L6Hype→L7第二曲线→L8技术筹码
    Scoring->>Scoring: compositeToV6Score()
    Scoring->>DataBridge: forward(SAVE_V6_SCORE)
    DataBridge->>DataLayer: v6Scores.save(score)
    DataLayer->>DB: transaction.put(v6Scores, score)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge->>DataBridge: broadcast(v6Scores, envelope)
    DataBridge-->>Scoring: {success: true}
    Scoring-->>Store: {success: true, data: score}
    Store-->>UI: 更新评分显示
    
    Note over Strategy,DB: T4: 策略评分计算
    Store->>Strategy: refreshHotSectorScore()
    Strategy->>DataLayer: v6Scores.list()
    DataLayer->>DB: getAll(v6Scores)
    DB-->>DataLayer: scores[]
    DataLayer-->>Strategy: scores
    
    Strategy->>Strategy: calculateHotSectorScore()
    Strategy->>Strategy: 动量(35%)+情绪(25%)+突破(20%)+估值(15%)+市场环境(5%)
    Strategy->>DataBridge: forward(SAVE_HOT_SECTOR_SCORE)
    DataBridge->>DataLayer: hotSectorScores.save(sectorScore)
    DataLayer->>DB: transaction.put(hotSectorScores, sectorScore)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge->>DataBridge: broadcast(hotSectorScores, envelope)
    DataBridge-->>Strategy: {success: true}
    Strategy-->>Store: 更新策略评分
    
    Note over Trading,DB: T5: 选股与交易信号生成
    Store->>Trading: generateSignal(symbol)
    Trading->>DataLayer: v6Scores.get(symbol)
    DataLayer->>DB: get(v6Scores, symbol)
    DB-->>DataLayer: score
    DataLayer-->>Trading: score
    
    Trading->>Trading: signalGenerator.generate()
    Note over Trading: 买入信号: buy_dip/buy_pivot/buy_safety_margin
    Note over Trading: 卖出信号: sell_profit_taking/sell_trailing_stop
    Trading->>Trading: positionSizer.calculate()
    Note over Trading: Kelly公式半凯利仓位计算
    Trading->>Trading: riskEngine.check()
    Note over Trading: 风控检查: 数据新鲜度/冷却期/交易次数/仓位上限/持仓检查
    
    Trading->>DataBridge: forward(CREATE_SIGNAL)
    DataBridge->>DataLayer: signals.save(signal)
    DataLayer->>DB: transaction.put(signals, signal)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge->>DataBridge: broadcast(signals, envelope)
    DataBridge-->>Trading: {success: true}
    Trading-->>Store: 更新信号状态
    Store-->>UI: 显示交易信号
```

## 二、回馈机制时序图（评分数据不完整时自动触发）

```mermaid
sequenceDiagram
    participant Feedback as FeedbackOrchestrator
    participant DataLayer as DataLayer
    participant DB as IndexedDB
    participant Fetcher as FetcherService
    participant Scoring as V6ScoreEngine
    participant DataBridge as DataBridge

    Note over Feedback,DataBridge: T0: 定时检查或事件触发
    Feedback->>Feedback: checkAndTrigger(symbol)
    
    Note over Feedback,DB: T1: 问题检测阶段
    Feedback->>DataLayer: v6Scores.get(symbol)
    DataLayer->>DB: get(v6Scores, symbol)
    DB-->>DataLayer: score (数据完整度 40%)
    DataLayer-->>Feedback: score
    
    Feedback->>Feedback: detectIssues(score)
    Note over Feedback: 检测1: 数据完整度<80% → incomplete_score (high)
    Feedback->>DataLayer: dailyQuotes.get(symbol)
    DataLayer->>DB: get(dailyQuotes, symbol)
    DB-->>DataLayer: quotes (更新时间晚于评分时间)
    DataLayer-->>Feedback: quotes
    
    Feedback->>Feedback: checkDataFreshness()
    Note over Feedback: 检测2: 评分时间早于行情时间 → stale_data (high)
    Feedback->>Feedback: broadcastIssues(issues)
    DataBridge->>DataBridge: broadcast(event:feedback:symbol, envelope)
    
    Note over Feedback,Fetcher: T2: 自动触发数据补充采集
    Feedback->>Fetcher: fetchStockBasic(symbol)
    Fetcher->>Fetcher: collectBasic(symbol)
    Fetcher-->>Fetcher: HTTP请求成功
    Fetcher->>DataBridge: forward(INSERT_STOCK)
    DataBridge->>DataLayer: stocks.save(stock)
    DataLayer->>DB: transaction.put(stocks, stock)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge-->>Fetcher: {success: true}
    Fetcher-->>Feedback: {success: true}
    
    Feedback->>Fetcher: fetchStockKline(symbol)
    Fetcher->>Fetcher: collectKline(symbol)
    Fetcher-->>Fetcher: HTTP请求成功
    Fetcher->>DataBridge: forward(SAVE_DAILY_QUOTES)
    DataBridge->>DataLayer: dailyQuotes.save(quotes)
    DataLayer->>DB: transaction.put(dailyQuotes, quotes)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge-->>Fetcher: {success: true}
    Fetcher-->>Feedback: {success: true}
    
    Feedback->>Fetcher: fetchStockFinancial(symbol)
    Fetcher->>Fetcher: collectFinancial(symbol)
    Fetcher-->>Fetcher: HTTP请求成功
    Fetcher->>DataBridge: forward(SAVE_FINANCIAL_REPORT)
    DataBridge->>DataLayer: financialReports.save(financial)
    DataLayer->>DB: transaction.put(financialReports, financial)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge-->>Fetcher: {success: true}
    Fetcher-->>Feedback: {success: true}
    
    Note over Feedback,Scoring: T3: 重新运行评分
    Feedback->>Scoring: runV6Score(symbol)
    Scoring->>DataLayer: stocks.get(symbol)
    DataLayer->>DB: get(stocks, symbol)
    DB-->>DataLayer: updated stock
    DataLayer-->>Scoring: stock
    
    Scoring->>DataLayer: dailyQuotes.get(symbol)
    DataLayer->>DB: get(dailyQuotes, symbol)
    DB-->>DataLayer: updated quotes
    DataLayer-->>Scoring: quotes
    
    Scoring->>Scoring: engine.calculateAll(input)
    Note over Scoring: 重新计算11层评分
    Scoring->>DataBridge: forward(SAVE_V6_SCORE)
    DataBridge->>DataLayer: v6Scores.save(newScore)
    DataLayer->>DB: transaction.put(v6Scores, newScore)
    DB-->>DataLayer: OK
    DataLayer-->>DataBridge: {success: true}
    DataBridge->>DataBridge: broadcast(v6Scores, envelope)
    DataBridge-->>Scoring: {success: true}
    Scoring-->>Feedback: {success: true, data: newScore}
    
    Note over Feedback,DB: T4: 验证修复结果
    Feedback->>Feedback: detectIssues(newScore)
    Note over Feedback: 验证: 数据完整度 100%, 新鲜度合规
    Feedback->>Feedback: broadcastIssues([])
    Feedback-->>Feedback: {success: true, message: "所有问题已修复"}
    
    Note over Feedback,DataBridge: T5: 广播修复完成事件
    DataBridge->>DataBridge: broadcast(event:feedback:symbol, envelope)
```

## 三、数据链路状态转换图

```mermaid
stateDiagram-v2
    [*] --> INITIAL: 系统启动
    
    INITIAL --> COLLECTING: 用户触发采集
    COLLECTING --> COLLECTED: 采集成功
    COLLECTING --> COLLECTING: 采集失败重试
    COLLECTING --> ERROR: 采集失败(超限)
    
    COLLECTED --> SCORING: 触发评分
    SCORING --> SCORED: 评分成功
    SCORING --> INCOMPLETE: 评分数据不完整
    
    INCOMPLETE --> COLLECTING: 触发数据补充
    INCOMPLETE --> WAITING: 等待用户确认
    
    SCORED --> STRATEGY: 触发策略评分
    STRATEGY --> STRATEGIZED: 策略评分完成
    
    STRATEGIZED --> SIGNALING: 生成交易信号
    SIGNALING --> SIGNALED: 信号生成完成
    
    SIGNALED --> TRADING: 执行交易
    TRADING --> TRADED: 交易完成
    
    TRADED --> REVIEW: 生成复盘报告
    REVIEW --> REVIEWED: 复盘完成
    
    REVIEWED --> MONITORING: 进入监控状态
    MONITORING --> COLLECTING: 定时数据刷新
    
    ERROR --> [*]: 系统关闭
    WAITING --> [*]: 用户取消
    REVIEWED --> [*]: 系统关闭
```

## 四、回馈机制触发条件决策树

```mermaid
flowchart TD
    A[开始检查] --> B{评分存在?}
    B -->|否| C[触发: incomplete_score critical]
    B -->|是| D{数据完整度 >= 80%?}
    D -->|否| E[触发: incomplete_score]
    D -->|是| F{各层有证据支持?}
    F -->|否| G[触发: insufficient_evidence]
    F -->|是| H{数据新鲜度合规?}
    H -->|否| I[触发: stale_data]
    H -->|是| J{存在质量警告?}
    J -->|否| K[检查通过]
    J -->|是| L[触发: quality_warning]
    
    E --> M[评估严重程度]
    G --> M
    I --> M
    L --> M
    
    M --> N{自动修复启用?}
    N -->|是| O[触发数据补充采集]
    N -->|否| P[仅通知用户]
    
    O --> Q[重新运行评分]
    Q --> R[验证修复结果]
    R --> S{问题解决?}
    S -->|是| T[广播修复成功]
    S -->|否| U[广播剩余问题]
    
    C --> P
    K --> V[完成]
    P --> V
    T --> V
    U --> V
```

## 五、关键时间节点汇总

| 阶段 | 时间节点 | 关键操作 | 预期耗时 |
|------|---------|---------|---------|
| T0 | 用户触发 | 点击采集/评分按钮 | < 100ms |
| T1 | 数据采集 | Fetcher → DataBridge → DB | 1000-3000ms |
| T2 | K线采集 | Fetcher → DataBridge → DB | 1000-5000ms |
| T3 | V6评分 | 11层引擎计算 + 持久化 | 500-2000ms |
| T4 | 策略评分 | 热门板块/价值洼地/轮动信号 | 300-1000ms |
| T5 | 信号生成 | 信号检测 + 仓位计算 + 风控检查 | 200-500ms |
| T6 | 回馈检测 | 完整度检查 + 新鲜度检查 | 100-300ms |
| T7 | 数据补充 | 重新采集基础/K线/财务数据 | 3000-10000ms |
| T8 | 重新评分 | 重新执行V6评分 | 500-2000ms |
| T9 | 验证修复 | 再次检测问题是否解决 | 100-300ms |

## 六、数据链路组件交互关系图

```mermaid
graph TB
    subgraph 用户层
        UI[UI层]
    end
    
    subgraph 状态层
        Store[Store层<br/>47个Zustand Store]
    end
    
    subgraph 服务层
        Fetcher[FetcherService<br/>数据采集]
        Scoring[ScoringService<br/>V6评分引擎]
        Strategy[StrategyService<br/>策略评分]
        Trading[TradingService<br/>交易信号]
        Feedback[FeedbackOrchestrator<br/>回馈机制]
    end
    
    subgraph 核心层
        DataBridge[DataBridge<br/>数据桥接]
        IntegrityGuard[DataIntegrityGuard<br/>数据完整性]
    end
    
    subgraph 数据层
        DataLayer[DataLayer<br/>数据访问层]
        DB[(IndexedDB<br/>27+6个Store)]
    end
    
    UI --> Store
    Store --> Fetcher
    Store --> Scoring
    Store --> Strategy
    Store --> Trading
    Store --> Feedback
    
    Fetcher --> DataBridge
    Scoring --> DataBridge
    Strategy --> DataBridge
    Trading --> DataBridge
    Feedback --> DataBridge
    
    DataBridge --> DataLayer
    DataBridge --> IntegrityGuard
    
    DataLayer --> DB
    
    Feedback -.-> Fetcher: 触发重采集
    Feedback -.-> Scoring: 触发重评分
    IntegrityGuard -.-> Feedback: 完整性检查结果
    
    style UI fill:#f9f,stroke:#333,stroke-width:2px
    style Store fill:#bbf,stroke:#333,stroke-width:2px
    style Feedback fill:#fbb,stroke:#333,stroke-width:2px
    style DataBridge fill:#bfb,stroke:#333,stroke-width:2px
    style DB fill:#bff,stroke:#333,stroke-width:2px
```

## 七、异常场景响应流程

```mermaid
sequenceDiagram
    participant Feedback as FeedbackOrchestrator
    participant Fetcher as FetcherService
    participant DataLayer as DataLayer
    participant DB as IndexedDB
    participant Scoring as V6ScoreEngine

    Note over Feedback,Scoring: 场景1: 部分采集失败
    Feedback->>Fetcher: fetchStockBasic(symbol)
    Fetcher-->>Feedback: {success: true}
    
    Feedback->>Fetcher: fetchStockKline(symbol)
    Fetcher-->>Feedback: {success: false, error: "网络超时"}
    
    Feedback->>Fetcher: fetchStockFinancial(symbol)
    Fetcher-->>Feedback: {success: true}
    
    Feedback->>Feedback: 记录采集结果(2/3成功)
    Feedback->>Feedback: 广播部分失败事件
    
    Note over Feedback,Scoring: 场景2: 评分引擎异常
    Feedback->>Scoring: runV6Score(symbol)
    Scoring-->>Feedback: {success: false, error: "财务数据缺失"}
    
    Feedback->>Feedback: 记录评分失败
    Feedback->>Feedback: 触发财务数据补充采集
    
    Note over Feedback,Scoring: 场景3: 数据新鲜度持续违规
    loop 每5分钟检查
        Feedback->>DataLayer: dailyQuotes.get(symbol)
        DataLayer->>DB: get(dailyQuotes, symbol)
        DB-->>DataLayer: quotes (30分钟前)
        DataLayer-->>Feedback: quotes
        
        Feedback->>Feedback: checkDataFreshness()
        Feedback->>Feedback: 检测到stale_data
        
        alt 连续3次违规
            Feedback->>Fetcher: fetchStockKline(symbol)
            Fetcher-->>Feedback: {success: true}
        else
            Feedback->>Feedback: 记录警告，下次再试
        end
    end
```
"""
    return diagram

if __name__ == '__main__':
    print(generate_sequence_diagram())
