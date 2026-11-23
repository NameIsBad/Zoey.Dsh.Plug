/**
 * 侧边栏浏览区（外壳）的字典。
 *
 * 键名与组件里的 `t(...)` 一一对应，`zh` / `en` 两份必须同时加键：
 * 漏键的表现是界面上直接显示原始 key。占位符统一用 `{name}` / `{n}` /
 * `{count}` / `{time}` / `{y}/{m}/{d}`，由宿主的翻译函数负责填充。
 *
 * 文案刻意贴近原生 `dsh-client-ui-workspace` 的口径（同样的功能、同样的措辞），
 * 但中文按本插件一贯的简洁风格重写，不逐字照抄。
 */

/** 中文文案。 */
export const zh: Readonly<Record<string, string>> = {
  'section.workspaces': '工作区',
  'section.sessions': '会话',
  'group.ungrouped': '未分组',

  search: '搜索会话',
  'search.aria': '搜索会话',
  'search.placeholder': '搜索会话…',
  'search.clear': '清除搜索',
  'search.results.aria': '搜索结果',
  'search.pending': '正在搜索',
  'search.noMatches': '没有匹配的会话',
  'search.hasMore': '只显示前 {n} 条，输入更多关键词可缩小范围',

  'viewOptions.label': '视图选项',
  'groupBy.label': '分组方式',
  'groupBy.workspace': '按工作区',
  'groupBy.workspaceTree': '按目录树',
  'groupBy.flat': '一张列表',
  'orderBy.label': '排序方式',
  'orderBy.manual': '手动排序',
  'orderBy.updated': '最近活动',
  'filterBy.label': '归档会话',
  'viewOptions.hideArchived': '隐藏归档',
  'viewOptions.showArchived': '显示归档',
  'viewOptions.onlyArchived': '只看归档',

  'workspace.add': '添加工作区',
  'actions.newSession': '新建会话',
  'actions.newSession.aria': '在「{name}」新建会话',
  'actions.workspace.aria': '「{name}」的工作区选项',
  'actions.session.aria': '「{name}」的会话选项',
  'actions.unarchive': '取消归档',

  'session.new': '新会话',
  'session.untitled': '未命名会话',

  'time.now': '刚刚',
  'time.ago': '{t}前',
  'time.minute': '{n} 分钟',
  'time.hour': '{n} 小时',
  'time.day': '{n} 天',

  'status.running': '运行中',
  'status.completed': '有新结果',
  'status.idle': '空闲',
  'status.waitingApproval': '等待确认',
  'status.planReview': '等待确认计划',
  'status.waitingAnswer': '等待回答',
  'status.compact.approval': '待确认',
  'status.compact.planReview': '待确认',
  'status.compact.answer': '待回答',
  'status.subagentsRunning.one': '{n} 个子代理运行中',
  'status.subagentsRunning.other': '{n} 个子代理运行中',

  'row.archived': '已归档',
  'row.pinned': '已置顶',
  'hover.created': '创建于 {time}',
  'hover.copied': '已复制',
  copy: '复制',
  'date.ymd': '{y}/{m}/{d}',

  'sessions.expand': '显示更多（{n}）',
  'sessions.collapse': '收起',

  'empty.none': '还没有会话',
  'empty.noneArchived': '没有归档会话',
  'empty.viewOthers': '查看其他会话',

  'toast.archivedNotOpenable': '已归档的会话不能直接打开，请先取消归档',
  'toast.pinFailed': '置顶失败',
  'toast.unpinFailed': '取消置顶失败',
  'toast.archiveFailed': '归档失败',
  'toast.addFailed': '添加工作区失败：{message}',
  'toast.pickTimeout': '没有等到目录选择结果，已取消这次添加；可以再点一次加号重试。',

  rename: '重命名',
  cancel: '取消',
  close: '关闭',
  'rename.workspace.title': '重命名工作区',
  'delete.workspace': '删除工作区',
  'delete.desc': '只删除「{name}」这条工作区记录，不删除目录与会话日志。',
  'delete.pending': '正在删除…',
  'field.workspaceName': '工作区名称',
  'conflict.named': '已经有同名的工作区「{name}」',

  'picker.title': '选择工作区目录',
  'picker.path': '目录路径',
  'picker.up': '上一层',
  'picker.empty': '这个目录里没有子目录',
  'picker.use': '使用这个目录',
  'picker.system': '系统对话框…',
  'picker.newFolder': '新建文件夹',
  'picker.newFolderName': '文件夹名称',
  'picker.create': '创建',
  'picker.loading': '正在读取…',
  'picker.error': '读取目录失败：{message}',

  'shell.fallback': '侧边栏加载异常，已切换为简版列表；重开或刷新可恢复。',
}

/** 英文文案。 */
export const en: Readonly<Record<string, string>> = {
  'section.workspaces': 'Workspaces',
  'section.sessions': 'Sessions',
  'group.ungrouped': 'Ungrouped',

  search: 'Search sessions',
  'search.aria': 'Search sessions',
  'search.placeholder': 'Search sessions…',
  'search.clear': 'Clear search',
  'search.results.aria': 'Search results',
  'search.pending': 'Searching',
  'search.noMatches': 'No sessions match',
  'search.hasMore': 'Showing the first {n}; refine the query to narrow it',

  'viewOptions.label': 'View options',
  'groupBy.label': 'Group by',
  'groupBy.workspace': 'Workspace',
  'groupBy.workspaceTree': 'Workspace tree',
  'groupBy.flat': 'One list',
  'orderBy.label': 'Order by',
  'orderBy.manual': 'Manual',
  'orderBy.updated': 'Last updated',
  'filterBy.label': 'Archived sessions',
  'viewOptions.hideArchived': 'Hide archived',
  'viewOptions.showArchived': 'Show archived',
  'viewOptions.onlyArchived': 'Only archived',

  'workspace.add': 'Add workspace',
  'actions.newSession': 'New session',
  'actions.newSession.aria': 'New session in {name}',
  'actions.workspace.aria': 'Workspace actions for {name}',
  'actions.session.aria': 'Session actions for {name}',
  'actions.unarchive': 'Unarchive',

  'session.new': 'New session',
  'session.untitled': 'Untitled session',

  'time.now': 'now',
  'time.ago': '{t} ago',
  'time.minute': '{n} min',
  'time.hour': '{n} hr',
  'time.day': '{n} d',

  'status.running': 'Running',
  'status.completed': 'New result',
  'status.idle': 'Idle',
  'status.waitingApproval': 'Waiting for approval',
  'status.planReview': 'Waiting for plan review',
  'status.waitingAnswer': 'Waiting for your answer',
  'status.compact.approval': 'Review',
  'status.compact.planReview': 'Review',
  'status.compact.answer': 'Answer',
  'status.subagentsRunning.one': '{n} subagent running',
  'status.subagentsRunning.other': '{n} subagents running',

  'row.archived': 'Archived',
  'row.pinned': 'Pinned',
  'hover.created': 'Created {time}',
  'hover.copied': 'Copied',
  copy: 'Copy',
  'date.ymd': '{y}/{m}/{d}',

  'sessions.expand': 'Show {n} more',
  'sessions.collapse': 'Show less',

  'empty.none': 'No sessions yet',
  'empty.noneArchived': 'No archived sessions',
  'empty.viewOthers': 'View other sessions',

  'toast.archivedNotOpenable': 'An archived session cannot be opened; unarchive it first',
  'toast.pinFailed': 'Could not pin the session',
  'toast.unpinFailed': 'Could not unpin the session',
  'toast.archiveFailed': 'Could not archive the session',
  'toast.addFailed': 'Could not add the workspace: {message}',
  'toast.pickTimeout':
    'The directory chooser did not answer; this attempt was cancelled. Click + to try again.',

  rename: 'Rename',
  cancel: 'Cancel',
  close: 'Close',
  'rename.workspace.title': 'Rename workspace',
  'delete.workspace': 'Delete workspace',
  'delete.desc': 'Removes only the "{name}" workspace registration; files and session logs stay.',
  'delete.pending': 'Deleting…',
  'field.workspaceName': 'Workspace name',
  'conflict.named': 'A workspace named "{name}" already exists',

  'picker.title': 'Select a workspace directory',
  'picker.path': 'Directory path',
  'picker.up': 'Parent folder',
  'picker.empty': 'This folder has no subfolders',
  'picker.use': 'Use this directory',
  'picker.system': 'System dialog…',
  'picker.newFolder': 'New folder',
  'picker.newFolderName': 'Folder name',
  'picker.create': 'Create',
  'picker.loading': 'Loading…',
  'picker.error': 'Could not read the directory: {message}',

  'shell.fallback':
    'The full sidebar failed to render; showing a simplified list. Reopen or refresh to recover.',
}
