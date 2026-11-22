/** 本功能的中英文字典；键名与组件里使用的 `t(...)` 一一对应。 */
export const zh = {
  title: '最近任务',
  'row.new': '新会话',
  'row.untitled': '未命名会话',
  'empty.none': '还没有会话',
  'time.justNow': '刚刚',
  'time.minutes': '{count} 分钟前',
  'time.hours': '{count} 小时前',
  'time.days': '{count} 天前',
  'time.unknown': '—',
  'status.running': '运行中',
  'status.waiting': '待确认',
  'status.done': '有新结果',
  'status.idle': '空闲',
  'settings.title': '最近任务',
  'settings.description': '侧边栏顶部的「最近任务」分组列出全部项目最近的会话。',
  'limit.label': '最近任务条数',
  'limit.hint': '默认 5 条；运行中或等待确认的任务不会被这个数量裁掉，会额外列出。1–{max}。',
  'limit.reset': '恢复默认',
}

/** 英文字案（与中文一一对应）。 */

export const en: Record<keyof typeof zh, string> = {
  title: 'Recent tasks',
  'row.new': 'New session',
  'row.untitled': 'Untitled session',
  'empty.none': 'No sessions yet',
  'time.justNow': 'Just now',
  'time.minutes': '{count} min ago',
  'time.hours': '{count} hr ago',
  'time.days': '{count} d ago',
  'time.unknown': '—',
  'status.running': 'Running',
  'status.waiting': 'Waiting for you',
  'status.done': 'New result',
  'status.idle': 'Idle',
  'settings.title': 'Recent tasks',
  'settings.description':
    'The group at the top of the sidebar lists the newest sessions across all projects.',
  'limit.label': 'Recent tasks shown',
  'limit.hint':
    'Five by default; running or waiting sessions are listed on top of this number instead of being cut. Range 1–{max}.',
  'limit.reset': 'Reset',
}

/** 本功能追加的样式（分组主体样式由外壳提供）。 */
