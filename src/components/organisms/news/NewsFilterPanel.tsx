import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Select, SelectItem } from '@/components/atoms/Select'

export interface NewsFilterState {
  keyword: string
  category: string
  sentiment: '' | 'positive' | 'negative' | 'neutral'
  source: string
}

export interface NewsFilterPanelProps {
  filter: NewsFilterState
  onChange: (filter: NewsFilterState) => void
}

const DEFAULT_FILTER: NewsFilterState = {
  keyword: '',
  category: '',
  sentiment: '',
  source: '',
}

/**
 * NewsFilterPanel
 * @param onChange }
 */
export function NewsFilterPanel({ filter, onChange }: NewsFilterPanelProps): React.JSX.Element {
  const update = (partial: Partial<NewsFilterState>) => {
    onChange({ ...filter, ...partial })
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="news-keyword" className="text-sm font-medium">
          关键词
        </label>
        <Input
          id="news-keyword"
          placeholder="搜索标题或正文"
          value={filter.keyword}
          onChange={(event) => update({ keyword: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="news-category" className="text-sm font-medium">
          分类
        </label>
        <Input
          id="news-category"
          placeholder="如：个股、行业、宏观"
          value={filter.category}
          onChange={(event) => update({ category: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="news-sentiment" className="text-sm font-medium">
          情感
        </label>
        <Select
          id="news-sentiment"
          value={filter.sentiment}
          onChange={(event) => update({ sentiment: event.target.value as NewsFilterState['sentiment'] })}
        >
          <SelectItem value="">全部</SelectItem>
          <SelectItem value="positive">正面</SelectItem>
          <SelectItem value="negative">负面</SelectItem>
          <SelectItem value="neutral">中性</SelectItem>
        </Select>
      </div>

      <div className="space-y-2">
        <label htmlFor="news-source" className="text-sm font-medium">
          来源
        </label>
        <Input
          id="news-source"
          placeholder="如：mock、财新"
          value={filter.source}
          onChange={(event) => update({ source: event.target.value })}
        />
      </div>

      <Button variant="outline" className="w-full" onClick={() => onChange(DEFAULT_FILTER)}>
        重置
      </Button>
    </div>
  )
}
