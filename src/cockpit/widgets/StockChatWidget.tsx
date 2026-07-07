import React, { useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, MarketData, ChatMessage } from '@/types/modules/widget.types'
import { CHAT_DEMO_TARGETS } from '@/constants/cockpit.constants'

import { nanoid } from 'nanoid'
interface StockChatWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

/**
 * 轻量级 Markdown 渲染器
 * @description 支持标题、加粗、列表、代码块、引用、段落；未来可替换为 react-markdown
 * @remarks 禁止在组件中硬编码任何样式颜色
 */
function MarkdownRenderer({ content }: { content: string }): React.JSX.Element {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] | null = null
  let listOrdered = false

  const flushList = () => {
    if (!listBuffer || listBuffer.length === 0) return
    const ListTag = listOrdered ? 'ol' : 'ul'
    elements.push(
      <ListTag key={`list-${elements.length}`} className="list-inside pl-2 my-2 text-sm">
        {listBuffer}
      </ListTag>
    )
    listBuffer = null
    listOrdered = false
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()

    // 代码块
    if (line.startsWith('```')) {
      flushList()
      const codeLines: string[] = []
      let j = index + 1
      while (j < lines.length && !lines[j]?.trim().startsWith('```')) {
        codeLines.push(lines[j] ?? '')
        j++
      }
      elements.push(
        <pre key={`code-${index}`} className="bg-muted rounded-md p-2 my-2 text-xs overflow-auto">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      return
    }

    // 标题
    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/)
    if (headerMatch) {
      flushList()
      const level = headerMatch[1]!.length
      const text = headerMatch[2]!
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      const sizeClass = level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs'
      elements.push(
        <Tag key={`h-${index}`} className={`font-bold mt-3 mb-1 ${sizeClass}`}>
          {renderInline(text)}
        </Tag>
      )
      return
    }

    // 无序列表
    const ulMatch = line.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      if (!listBuffer || listOrdered) flushList()
      listBuffer ??= []
      listOrdered = false
      listBuffer.push(<li key={`li-${index}`}>{renderInline(ulMatch[1]!)}</li>)
      return
    }

    // 有序列表
    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    if (olMatch) {
      if (!listBuffer || !listOrdered) flushList()
      listBuffer ??= []
      listOrdered = true
      listBuffer.push(<li key={`li-${index}`}>{renderInline(olMatch[1]!)}</li>)
      return
    }

    // 空行
    if (line.trim() === '') {
      flushList()
      return
    }

    // 引用
    if (line.startsWith('>')) {
      flushList()
      elements.push(
        <blockquote key={`quote-${index}`} className="border-l-2 border-muted-foreground pl-3 my-2 text-xs text-muted-foreground">
          {renderInline(line.slice(1).trim())}
        </blockquote>
      )
      return
    }

    // 普通段落
    flushList()
    elements.push(
      <p key={`p-${index}`} className="text-sm my-1 leading-relaxed">
        {renderInline(line)}
      </p>
    )
  })

  flushList()
  return <div className="markdown-body">{elements}</div>
}

/**
 * 行内 Markdown 渲染（加粗、斜体、行内代码）
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={match.index} className="bg-muted px-1 rounded text-xs">
          {token.slice(1, -1)}
        </code>
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

/**
 * 个股深度分析与市场分析聊天 Widget
 * @description 类似 ChatGPT 的交互界面，支持选择标的、清空上下文、发送问题并渲染 Markdown 回复
 * @remarks 历史数据来自 MarketData.chatHistory；发送消息通过 MarketDataProvider.sendChatMessage
 */
export default function StockChatWidget({ config, data }: StockChatWidgetProps): React.JSX.Element {
  const marketData = useMarketData()
  const sourceData = data ?? marketData.data
  const initialChat = sourceData.chatHistory

  const [target, setTarget] = useState(initialChat.target || CHAT_DEMO_TARGETS[0]!.code)
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat.messages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleClear = () => {
    setMessages([])
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user_${nanoid(8)}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // 通过 MarketDataProvider 统一发送，避免组件直接调用后端
      const reply = await marketData.sendChatMessage(target, userMessage.content)
      setMessages((prev) => [...prev, reply])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${nanoid(8)}`,
          role: 'assistant',
          content: '消息发送失败，请稍后重试。',
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-48 text-xs">
            {CHAT_DEMO_TARGETS.map((item) => (
              <SelectItem key={item.code} value={item.code}>
                {item.name} ({item.type === 'market' ? '市场' : item.code})
              </SelectItem>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={handleClear} title="清空上下文">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto space-y-4 pr-2"
        >
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              请选择标的并输入问题，开始个股/市场深度分析
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                <div className="text-[10px] opacity-60 mt-1 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                <span className="animate-pulse">AI 正在分析...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex w-full items-start gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入个股深度分析的问题，或输入市场分析的问题..."
            className="min-h-[56px] flex-1 resize-none"
            disabled={isLoading}
          />
          <Button size="sm" onClick={() => void handleSend()} disabled={isLoading || !input.trim()} className="h-14 px-4">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
