import { glob } from 'glob'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const TRANSLATION_MAP: Record<string, string> = {
  'should be': '应该是',
  'should have': '应该有',
  'should not': '不应该',
  'should return': '应该返回',
  'should throw': '应该抛出',
  'should call': '应该调用',
  'should log': '应该记录',
  'should emit': '应该触发',
  'should subscribe': '应该订阅',
  'should unsubscribe': '应该取消订阅',
  'should include': '应该包含',
  'should allow': '应该允许',
  'should set': '应该设置',
  'should clear': '应该清除',
  'should update': '应该更新',
  'should create': '应该创建',
  'should delete': '应该删除',
  'should save': '应该保存',
  'should load': '应该加载',
  'should validate': '应该验证',
  'should filter': '应该过滤',
  'should sort': '应该排序',
  'should merge': '应该合并',
  'should parse': '应该解析',
  'should format': '应该格式化',
  'should generate': '应该生成',
  'should handle': '应该处理',
  'should ignore': '应该忽略',
  'should skip': '应该跳过',
  'should start': '应该开始',
  'should stop': '应该停止',
  'should complete': '应该完成',
  'should fail': '应该失败',
  'should succeed': '应该成功',
  'should work': '应该工作',
  'should behave': '应该表现',
  'should execute': '应该执行',
  'should initialize': '应该初始化',
  'should terminate': '应该终止',
  'should reset': '应该重置',
  'should persist': '应该持久化',
  'should fetch': '应该获取',
  'should store': '应该存储',
  'should retrieve': '应该检索',
  'should compute': '应该计算',
  'should compare': '应该比较',
  'should match': '应该匹配',
  'should exist': '应该存在',
  'should not exist': '不应该存在',
  'should be defined': '应该已定义',
  'should be undefined': '应该未定义',
  'should be null': '应该为 null',
  'should be truthy': '应该为真值',
  'should be falsy': '应该为假值',
  'should be empty': '应该为空',
  'should not be empty': '不应该为空',
  'should be greater than': '应该大于',
  'should be less than': '应该小于',
  'should be equal to': '应该等于',
  'should be greater than or equal': '应该大于等于',
  'should be less than or equal': '应该小于等于',
  'should contain': '应该包含',
  'should not contain': '不应该包含',
  'should contain exactly': '应该精确包含',
  'should have length': '应该有长度',
  'should have property': '应该有属性',
  'should have been called': '应该已被调用',
  'should not have been called': '不应该被调用',
  'should have been called with': '应该已被调用且参数为',
  'should have been called times': '应该已被调用次数',
  'should have been called once': '应该已被调用一次',
  'should have been called twice': '应该已被调用两次',
  'should have been called at least': '应该已被调用至少',
  'should have been called at most': '应该已被调用至多',
  'should match snapshot': '应该匹配快照',
  'should render': '应该渲染',
  'should not render': '不应该渲染',
  'should render correctly': '应该正确渲染',
  'should update when': '当...时应该更新',
  'should change when': '当...时应该改变',
  'should fire when': '当...时应该触发',
  'should trigger when': '当...时应该触发',
  'should respond when': '当...时应该响应',
  'should be triggered when': '当...时应该被触发',
  'should be updated when': '当...时应该被更新',
  'should be affected when': '当...时应该受影响',
  'should be reset when': '当...时应该被重置',
  'should be cleared when': '当...时应该被清除',
  'should be initialized when': '当...时应该被初始化',
  'should be cleaned up when': '当...时应该被清理',
  'should be destroyed when': '当...时应该被销毁',
  'should be created when': '当...时应该被创建',
  'should be removed when': '当...时应该被移除',
  'should be added when': '当...时应该被添加',
  'should be merged when': '当...时应该被合并',
  'should be persisted when': '当...时应该被持久化',
  'should be loaded when': '当...时应该被加载',
  'should be saved when': '当...时应该被保存',
  'should be validated when': '当...时应该被验证',
  'should be parsed when': '当...时应该被解析',
  'should be formatted when': '当...时应该被格式化',
  'should be generated when': '当...时应该被生成',
  'should be computed when': '当...时应该被计算',
  'should be compared when': '当...时应该被比较',
  'should be filtered when': '当...时应该被过滤',
  'should be sorted when': '当...时应该被排序',
  'should handle error': '应该处理错误',
  'should handle errors': '应该处理错误',
  'should handle exception': '应该处理异常',
  'should handle exceptions': '应该处理异常',
  'should handle null': '应该处理 null',
  'should handle undefined': '应该处理 undefined',
  'should handle empty': '应该处理空值',
  'should handle invalid': '应该处理无效值',
  'should handle valid': '应该处理有效值',
  'should handle missing': '应该处理缺失值',
  'should handle duplicate': '应该处理重复值',
  'should handle edge case': '应该处理边界情况',
  'should handle edge cases': '应该处理边界情况',
  'should handle success': '应该处理成功',
  'should handle failure': '应该处理失败',
  'should handle timeout': '应该处理超时',
  'should handle retry': '应该处理重试',
  'should handle concurrent': '应该处理并发',
  'should handle async': '应该处理异步',
  'should handle sync': '应该处理同步',
  'should handle promise': '应该处理 Promise',
  'should handle observable': '应该处理 Observable',
  'should handle event': '应该处理事件',
  'should handle events': '应该处理事件',
  'should handle request': '应该处理请求',
  'should handle response': '应该处理响应',
  'should handle callback': '应该处理回调',
  'should handle stream': '应该处理流',
  'should handle buffer': '应该处理缓冲区',
  'should handle string': '应该处理字符串',
  'should handle number': '应该处理数字',
  'should handle array': '应该处理数组',
  'should handle object': '应该处理对象',
  'should handle boolean': '应该处理布尔值',
  'should handle date': '应该处理日期',
  'should handle time': '应该处理时间',
  'should handle regex': '应该处理正则表达式',
  'should handle function': '应该处理函数',
  'should handle class': '应该处理类',
  'should handle instance': '应该处理实例',
  'should handle interface': '应该处理接口',
  'should handle type': '应该处理类型',
  'should handle generic': '应该处理泛型',
  'should handle union': '应该处理联合类型',
  'should handle intersection': '应该处理交叉类型',
  'should handle optional': '应该处理可选属性',
  'should handle required': '应该处理必需属性',
  'should handle readonly': '应该处理只读属性',
  'should handle private': '应该处理私有属性',
  'should handle public': '应该处理公共属性',
  'should handle protected': '应该处理受保护属性',
  'should handle static': '应该处理静态属性',
  'should handle abstract': '应该处理抽象属性',
  'should handle override': '应该处理重写',
  'should handle extend': '应该处理继承',
  'should handle implement': '应该处理实现',
  'should handle compose': '应该处理组合',
  'should handle decorate': '应该处理装饰',
  'should handle proxy': '应该处理代理',
  'should handle middleware': '应该处理中间件',
  'should handle hook': '应该处理钩子',
  'should handle lifecycle': '应该处理生命周期',
  'should handle mount': '应该处理挂载',
  'should handle unmount': '应该处理卸载',
  'should handle update': '应该处理更新',
  'should handle render': '应该处理渲染',
  'should handle effect': '应该处理副作用',
  'should handle state': '应该处理状态',
  'should handle props': '应该处理属性',
  'should handle context': '应该处理上下文',
  'should handle ref': '应该处理引用',
  'should handle memo': '应该处理记忆',
  'should handle callback': '应该处理回调',
  'should handle reducer': '应该处理归约器',
  'should handle selector': '应该处理选择器',
  'should handle dispatch': '应该处理分发',
  'should handle action': '应该处理动作',
  'should handle mutation': '应该处理变更',
  'should handle subscription': '应该处理订阅',
  'should handle publish': '应该处理发布',
  'should handle subscribe': '应该处理订阅',
  'should handle unsubscribe': '应该处理取消订阅',
  'should handle connect': '应该处理连接',
  'should handle disconnect': '应该处理断开连接',
  'should handle request': '应该处理请求',
  'should handle response': '应该处理响应',
  'should handle fetch': '应该处理获取',
  'should handle cache': '应该处理缓存',
  'should handle storage': '应该处理存储',
  'should handle database': '应该处理数据库',
  'should handle query': '应该处理查询',
  'should handle transaction': '应该处理事务',
  'should handle migration': '应该处理迁移',
  'should handle schema': '应该处理模式',
  'should handle index': '应该处理索引',
  'should handle table': '应该处理表',
  'should handle collection': '应该处理集合',
  'should handle document': '应该处理文档',
  'should handle record': '应该处理记录',
  'should handle row': '应该处理行',
  'should handle column': '应该处理列',
  'should handle field': '应该处理字段',
  'should handle value': '应该处理值',
  'should handle key': '应该处理键',
  'should handle unique': '应该处理唯一',
  'should handle foreign': '应该处理外键',
  'should handle primary': '应该处理主键',
  'should handle constraint': '应该处理约束',
  'should handle validation': '应该处理验证',
  'should handle sanitization': '应该处理清理',
  'should handle transformation': '应该处理转换',
  'should handle mapping': '应该处理映射',
  'should handle conversion': '应该处理转换',
  'should handle serialization': '应该处理序列化',
  'should handle deserialization': '应该处理反序列化',
  'should handle encoding': '应该处理编码',
  'should handle decoding': '应该处理解码',
  'should handle compression': '应该处理压缩',
  'should handle encryption': '应该处理加密',
  'should handle decryption': '应该处理解密',
  'should handle signing': '应该处理签名',
  'should handle verification': '应该处理验证',
  'should handle authentication': '应该处理认证',
  'should handle authorization': '应该处理授权',
  'should handle permission': '应该处理权限',
  'should handle role': '应该处理角色',
  'should handle token': '应该处理令牌',
  'should handle session': '应该处理会话',
  'should handle cookie': '应该处理 Cookie',
  'should handle header': '应该处理头部',
  'should handle body': '应该处理正文',
  'should handle parameter': '应该处理参数',
  'should handle query': '应该处理查询',
  'should handle route': '应该处理路由',
  'should handle middleware': '应该处理中间件',
  'should handle controller': '应该处理控制器',
  'should handle service': '应该处理服务',
  'should handle repository': '应该处理仓库',
  'should handle factory': '应该处理工厂',
  'should handle singleton': '应该处理单例',
  'should handle provider': '应该处理提供者',
  'should handle consumer': '应该处理消费者',
  'should handle producer': '应该处理生产者',
  'should handle observer': '应该处理观察者',
  'should handle subject': '应该处理主题',
  'should handle strategy': '应该处理策略',
  'should handle template': '应该处理模板',
  'should handle facade': '应该处理外观',
  'should handle proxy': '应该处理代理',
  'should handle decorator': '应该处理装饰器',
  'should handle adapter': '应该处理适配器',
  'should handle bridge': '应该处理桥接',
  'should handle composite': '应该处理组合',
  'should handle flyweight': '应该处理享元',
  'should handle chain': '应该处理责任链',
  'should handle command': '应该处理命令',
  'should handle iterator': '应该处理迭代器',
  'should handle mediator': '应该处理中介者',
  'should handle memento': '应该处理备忘录',
  'should handle state': '应该处理状态',
  'should handle visitor': '应该处理访问者',
  'should handle interpreter': '应该处理解释器',
  'should handle builder': '应该处理构建器',
  'should handle prototype': '应该处理原型',
  'should handle lazy': '应该处理懒加载',
  'should handle eager': '应该处理饿加载',
  'should handle async': '应该处理异步',
  'should handle sync': '应该处理同步',
  'should handle parallel': '应该处理并行',
  'should handle sequential': '应该处理顺序',
  'should handle concurrent': '应该处理并发',
  'should handle race': '应该处理竞态',
  'should handle deadlock': '应该处理死锁',
  'should handle timeout': '应该处理超时',
  'should handle retry': '应该处理重试',
  'should handle backoff': '应该处理退避',
  'should handle circuit': '应该处理熔断',
  'should handle throttle': '应该处理节流',
  'should handle debounce': '应该处理防抖',
  'should handle cache': '应该处理缓存',
  'should handle memoization': '应该处理记忆化',
  'should handle pagination': '应该处理分页',
  'should handle filtering': '应该处理过滤',
  'should handle sorting': '应该处理排序',
  'should handle searching': '应该处理搜索',
  'should handle matching': '应该处理匹配',
  'should handle indexing': '应该处理索引',
  'should handle aggregation': '应该处理聚合',
  'should handle grouping': '应该处理分组',
  'should handle joining': '应该处理连接',
  'should handle splitting': '应该处理分割',
  'should handle merging': '应该处理合并',
  'should handle concatenation': '应该处理连接',
  'should handle transformation': '应该处理转换',
  'should handle mapping': '应该处理映射',
  'should handle reduction': '应该处理归约',
  'should handle accumulation': '应该处理累积',
  'should handle iteration': '应该处理迭代',
  'should handle recursion': '应该处理递归',
  'should handle memoization': '应该处理记忆化',
  'should handle currying': '应该处理柯里化',
  'should handle composition': '应该处理组合',
  'should handle pipelining': '应该处理管道',
  'should handle chaining': '应该处理链式调用',
  'should handle fluent': '应该处理流式接口',
  'should handle builder': '应该处理构建器模式',
  'should handle factory': '应该处理工厂模式',
  'should handle singleton': '应该处理单例模式',
  'should handle prototype': '应该处理原型模式',
  'should handle adapter': '应该处理适配器模式',
  'should handle bridge': '应该处理桥接模式',
  'should handle composite': '应该处理组合模式',
  'should handle decorator': '应该处理装饰器模式',
  'should handle facade': '应该处理外观模式',
  'should handle flyweight': '应该处理享元模式',
  'should handle proxy': '应该处理代理模式',
  'should handle chain': '应该处理责任链模式',
  'should handle command': '应该处理命令模式',
  'should handle iterator': '应该处理迭代器模式',
  'should handle mediator': '应该处理中介者模式',
  'should handle memento': '应该处理备忘录模式',
  'should handle observer': '应该处理观察者模式',
  'should handle state': '应该处理状态模式',
  'should handle strategy': '应该处理策略模式',
  'should handle template': '应该处理模板方法模式',
  'should handle visitor': '应该处理访问者模式',
  'should handle interpreter': '应该处理解释器模式',
}

function translateDescription(description: string): string {
  let result = description

  const sortedKeys = Object.keys(TRANSLATION_MAP).sort((a, b) => b.length - a.length)

  for (const key of sortedKeys) {
    const regex = new RegExp(key, 'gi')
    result = result.replace(regex, TRANSLATION_MAP[key])
  }

  if (result.startsWith('should ')) {
    result = result.replace(/^should\s+/i, '')
    if (!result.startsWith('不应该')) {
      result = '应该' + result.charAt(0).toLowerCase() + result.slice(1)
    }
  }

  return result.trim()
}

async function processFile(filePath: string): Promise<{ changed: boolean; count: number }> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  let changed = false
  let count = 0

  const newLines = lines.map((line) => {
    const match = line.match(/it\(\s*(['"])([^'"]+)\1\s*,/)
    if (match) {
      const originalDescription = match[2]
      if (/^should\s/i.test(originalDescription)) {
        const translated = translateDescription(originalDescription)
        if (translated !== originalDescription) {
          const newLine = line.replace(match[2], translated)
          changed = true
          count++
          return newLine
        }
      }
    }
    return line
  })

  if (changed) {
    await writeFile(filePath, newLines.join('\n'), 'utf-8')
  }

  return { changed, count }
}

async function main() {
  const testFiles = await glob('**/*.test.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**', 'e2e/**'],
  })

  console.log(`找到 ${testFiles.length} 个测试文件...\n`)

  let totalChanged = 0
  let totalCount = 0
  const changedFiles: string[] = []

  for (const file of testFiles) {
    const { changed, count } = await processFile(file)
    if (changed) {
      totalChanged++
      totalCount += count
      changedFiles.push(file)
      console.log(`✓ ${file} (${count} 处替换)`)
    }
  }

  console.log(`\n处理完成：`)
  console.log(`  修改文件数：${totalChanged}`)
  console.log(`  替换描述数：${totalCount}`)
}

main().catch(console.error)
