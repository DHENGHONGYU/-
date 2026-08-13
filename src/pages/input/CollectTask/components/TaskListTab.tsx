/**
 * 采集任务监控 - 任务列表 Tab
 *
 * 显示采集任务列表，支持查看详情、状态徽章、进度条。
 *
 * @module CollectTask/components/TaskListTab
 */

import { Eye } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import type { CollectionTaskRuntime } from '@/types/modules/collection.types'
import { normalizeStatus, STATUS_BADGE } from '../utils'

interface TaskListTabProps {
  tasks: CollectionTaskRuntime[]
  isLoading: boolean
  onViewTask: (taskId: string) => void
}

/**
 * TaskListTab
 * @param isLoading
 * @param onViewTask }
 */
export function TaskListTab({ tasks, isLoading, onViewTask }: TaskListTabProps): React.JSX.Element {
  const dimensions = useSevenDimConfigStore((s) => s.dimensions)

  return (
    <Card>
      <CardHeader>
        <CardTitle>采集任务列表</CardTitle>
        <CardDescription>来自 collectionRuntimeStore 的实时任务状态</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="暂无采集任务"
            description="尚未发起任何采集任务，请前往数据测试面板执行"
            action={{ label: '前往数据测试', onClick: () => { window.location.href = '/input' } }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>维度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TaskRow
                    key={task.taskId}
                    task={task}
                    dimName={dimensions.find((d) => d.code === task.dimensionCode)?.name ?? ''}
                    onView={onViewTask}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TaskRowProps {
  task: CollectionTaskRuntime
  dimName: string
  onView: (taskId: string) => void
}

function TaskRow({ task, dimName, onView }: TaskRowProps): React.JSX.Element {
  const displayStatus = normalizeStatus(task.status)
  const statusInfo = STATUS_BADGE[displayStatus]
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
      <TableCell>
        <span className="text-sm">
          {task.dimensionCode} · {dimName}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </TableCell>
      <TableCell className="w-32">
        <div className="flex items-center gap-2">
          <Progress value={task.progress} max={100} showMax={false} className="flex-1" />
          <span className="text-xs text-muted-foreground">{task.progress}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => { onView(task.taskId) }}
        >
          <Eye className="h-3.5 w-3.5" />
          详情
        </Button>
      </TableCell>
    </TableRow>
  )
}
