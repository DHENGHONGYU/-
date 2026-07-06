import React, { useState, useCallback } from 'react'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { COLOR_TOKENS, twText, twBg, twBorder } from '@/constants/theme.tokens'

/**
 * 数据标签接口
 */
interface DataLabel {
  id: string
  name: string
  category: 'sentiment' | 'intent' | 'entity' | 'custom'
  color: string
  description: string
  exampleCount: number
  createdAt: string
  updatedAt: string
}

/**
 * 数据标签管理页面
 * 
 * @component
 * @remarks
 * 功能：
 * - 创建/编辑/删除数据标签
 * - 导入/导出标签数据
 * - 标签分类管理
 * - 搜索和过滤
 * - 查看标签使用示例数
 */
const DataLabelManagementPage: React.FC = () => {
  // 状态管理
  const [labels, setLabels] = useState<DataLabel[]>([
    {
      id: 'label-001',
      name: '看涨',
      category: 'sentiment',
      color: COLOR_TOKENS.up.tailwind,
      description: '表示对市场或个股的看涨情绪',
      exampleCount: 1250,
      createdAt: '2026-01-15',
      updatedAt: '2026-07-01',
    },
    {
      id: 'label-002',
      name: '看跌',
      category: 'sentiment',
      color: COLOR_TOKENS.danger.tailwind,
      description: '表示对市场或个股的看跌情绪',
      exampleCount: 980,
      createdAt: '2026-01-15',
      updatedAt: '2026-07-01',
    },
    {
      id: 'label-003',
      name: '买入意图',
      category: 'intent',
      color: COLOR_TOKENS.info.tailwind,
      description: '表示用户有买入股票的意图',
      exampleCount: 850,
      createdAt: '2026-02-20',
      updatedAt: '2026-06-15',
    },
    {
      id: 'label-004',
      name: '卖出意图',
      category: 'intent',
      color: COLOR_TOKENS.warning.tailwind,
      description: '表示用户有卖出股票的意图',
      exampleCount: 720,
      createdAt: '2026-02-20',
      updatedAt: '2026-06-15',
    },
    {
      id: 'label-005',
      name: '公司实体',
      category: 'entity',
      color: COLOR_TOKENS.purple.tailwind,
      description: '表示文本中提到的公司名称',
      exampleCount: 2100,
      createdAt: '2026-03-10',
      updatedAt: '2026-07-05',
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [editingLabel, setEditingLabel] = useState<DataLabel | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<DataLabel['category'] | 'all'>('all')

  /**
   * 打开创建/编辑模态框
   */
  const handleOpenModal = useCallback((label?: DataLabel) => {
    if (label) {
      setEditingLabel({ ...label })
    } else {
      setEditingLabel({
        id: `label-${Date.now()}`,
        name: '',
        category: 'custom',
        color: COLOR_TOKENS.textPrimary.tailwind,
        description: '',
        exampleCount: 0,
        createdAt: new Date().toISOString().split('T')[0] ?? '',
        updatedAt: new Date().toISOString().split('T')[0] ?? '',
      })
    }
    setShowModal(true)
  }, [])

  /**
   * 保存标签
   */
  const handleSaveLabel = useCallback(() => {
    if (!editingLabel) return

    setLabels(prev => {
      const index = prev.findIndex(l => l.id === editingLabel.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = { ...editingLabel, updatedAt: new Date().toISOString().split('T')[0] ?? '' }
        return updated
      } else {
        return [...prev, editingLabel]
      }
    })

    setShowModal(false)
    setEditingLabel(null)
  }, [editingLabel])

  /**
   * 删除标签
   */
  const handleDeleteLabel = useCallback((labelId: string) => {
    if (window.confirm('确定要删除这个标签吗？关联的示例数据将保留但不再标记。')) {
      setLabels(prev => prev.filter(l => l.id !== labelId))
    }
  }, [])

  /**
   * 导入标签
   */
  const handleImportLabels = useCallback(() => {
    alert('导入功能正在开发中...')
    // 实际实现应该调用API上传文件
  }, [])

  /**
   * 导出标签
   */
  const handleExportLabels = useCallback(() => {
    const dataStr = JSON.stringify(labels, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'data-labels.json'
    link.click()
    URL.revokeObjectURL(url)
  }, [labels])

  /**
   * 过滤标签
   */
  const filteredLabels = labels.filter(label => {
    const matchesSearch = label.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          label.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || label.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  /**
   * 获取分类标签名称
   */
  const getCategoryLabel = (category: DataLabel['category']) => {
    switch (category) {
      case 'sentiment': return '情感'
      case 'intent': return '意图'
      case 'entity': return '实体'
      case 'custom': return '自定义'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${twText('gray', 900)} mb-2`}>
          数据标签管理
        </h1>
        <p className={twText('secondary')}>
          管理智能体训练和微调所需的数据标签
        </p>
      </div>

      {/* 操作栏 */}
      <div className="mb-6 flex flex-wrap gap-4 justify-between items-center">
        <div className="flex gap-4">
          {/* 搜索框 */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索标签..."
              className={`pl-10 pr-4 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* 分类过滤 */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as DataLabel['category'] | 'all')}
            className={`px-4 py-2 border ${twBorder('default')} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="all">全部分类</option>
            <option value="sentiment">情感</option>
            <option value="intent">意图</option>
            <option value="entity">实体</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleImportLabels}
            className={`flex items-center gap-2 px-4 py-2 ${twBg('muted')} ${twText('gray', 900)} rounded-lg hover:opacity-90 transition-opacity`}
          >
            <ArrowUpTrayIcon className="w-5 h-5" />
            导入
          </button>

          <button
            onClick={handleExportLabels}
            className={`flex items-center gap-2 px-4 py-2 ${twBg('muted')} ${twText('gray', 900)} rounded-lg hover:opacity-90 transition-opacity`}
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            导出
          </button>

          <button
            onClick={() => handleOpenModal()}
            className={`flex items-center gap-2 px-4 py-2 ${twBg('red', 600)} text-white rounded-lg hover:opacity-90 transition-opacity`}
          >
            <PlusIcon className="w-5 h-5" />
            创建标签
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${twBg('white', 0)} p-4 rounded-lg shadow-sm`}>
          <div className={`text-sm ${twText('muted')}`}>总标签数</div>
          <div className={`text-2xl font-bold ${twText('gray', 900)}`}>{labels.length}</div>
        </div>
        <div className={`${twBg('white', 0)} p-4 rounded-lg shadow-sm`}>
          <div className={`text-sm ${twText('muted')}`}>总示例数</div>
          <div className={`text-2xl font-bold ${twText('gray', 900)}`}>
            {labels.reduce((sum, l) => sum + l.exampleCount, 0).toLocaleString()}
          </div>
        </div>
        <div className={`${twBg('white', 0)} p-4 rounded-lg shadow-sm`}>
          <div className={`text-sm ${twText('muted')}`}>情感标签</div>
          <div className={`text-2xl font-bold ${twText('gray', 900)}`}>
            {labels.filter(l => l.category === 'sentiment').length}
          </div>
        </div>
        <div className={`${twBg('white', 0)} p-4 rounded-lg shadow-sm`}>
          <div className={`text-sm ${twText('muted')}`}>意图标签</div>
          <div className={`text-2xl font-bold ${twText('gray', 900)}`}>
            {labels.filter(l => l.category === 'intent').length}
          </div>
        </div>
      </div>

      {/* 标签列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLabels.map(label => (
          <div
            key={label.id}
            className={`${twBg('white', 0)} rounded-lg shadow-sm border ${twBorder('gray', 300)} p-6 hover:shadow-md transition-shadow`}
          >
            {/* 标签头部 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <h3 className={`text-lg font-semibold ${twText('gray', 900)}`}>
                  {label.name}
                </h3>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded ${twBg('gray', 100)} ${twText('gray', 700)}`}>
                {getCategoryLabel(label.category)}
              </span>
            </div>

            {/* 标签描述 */}
            <p className={`${twText('gray', 600)} text-sm mb-4`}>
              {label.description}
            </p>

            {/* 标签统计 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className={twText('gray', 600)}>示例数量</span>
                <span className={twText('gray', 900)}>{label.exampleCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={twText('gray', 600)}>创建时间</span>
                <span className={twText('gray', 900)}>{label.createdAt}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={twText('gray', 600)}>更新时间</span>
                <span className={twText('gray', 900)}>{label.updatedAt}</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenModal(label)}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 ${twBg('gray', 100)} ${twText('gray', 900)} rounded hover:opacity-90 transition-opacity`}
              >
                <PencilIcon className="w-4 h-4" />
                编辑
              </button>

              <button
                onClick={() => handleDeleteLabel(label.id)}
                className={`flex items-center justify-center px-3 py-2 ${twBg('red', 500)} text-white rounded hover:opacity-90 transition-opacity`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 创建/编辑模态框 */}
      {showModal && editingLabel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${twBg('white', 0)} rounded-lg p-6 w-full max-w-lg`}>
            <h2 className={`text-2xl font-bold ${twText('gray', 900)} mb-4`}>
              {labels.find(l => l.id === editingLabel.id) ? '编辑标签' : '创建标签'}
            </h2>

            <div className="space-y-4">
              {/* 标签名称 */}
              <div>
                <label className={`block text-sm font-medium ${twText('gray', 900)} mb-1`}>
                  标签名称 *
                </label>
                <input
                  type="text"
                  value={editingLabel.name}
                  onChange={(e) => setEditingLabel(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('gray', 300)} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="输入标签名称"
                />
              </div>

              {/* 标签分类 */}
              <div>
                <label className={`block text-sm font-medium ${twText('gray', 900)} mb-1`}>
                  分类 *
                </label>
                <select
                  value={editingLabel.category}
                  onChange={(e) => setEditingLabel(prev => prev ? { ...prev, category: e.target.value as DataLabel['category'] } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('gray', 300)} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="sentiment">情感</option>
                  <option value="intent">意图</option>
                  <option value="entity">实体</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              {/* 标签颜色 */}
              <div>
                <label className={`block text-sm font-medium ${twText('gray', 900)} mb-1`}>
                  颜色 *
                </label>
                <div className="flex gap-2">
                  {[COLOR_TOKENS.up.tailwind, COLOR_TOKENS.danger.tailwind, COLOR_TOKENS.info.tailwind, COLOR_TOKENS.warning.tailwind, COLOR_TOKENS.purple.tailwind, COLOR_TOKENS.textPrimary.tailwind].map(color => (
                    <button
                      key={color}
                      onClick={() => setEditingLabel(prev => prev ? { ...prev, color } : null)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        editingLabel.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* 标签描述 */}
              <div>
                <label className={`block text-sm font-medium ${twText('gray', 900)} mb-1`}>
                  描述 *
                </label>
                <textarea
                  value={editingLabel.description}
                  onChange={(e) => setEditingLabel(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className={`w-full px-3 py-2 border ${twBorder('gray', 300)} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows={3}
                  placeholder="输入标签描述"
                />
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSaveLabel}
                disabled={!editingLabel.name || !editingLabel.description}
                className={`flex-1 px-4 py-2 ${twBg('red', 500)} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingLabel(null)
                }}
                className={`flex-1 px-4 py-2 ${twBg('gray', 100)} ${twText('gray', 900)} rounded-lg hover:opacity-90 transition-opacity`}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataLabelManagementPage
