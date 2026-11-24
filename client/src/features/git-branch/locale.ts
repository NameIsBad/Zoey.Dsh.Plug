/** 本功能的中英文字典；键名与组件里使用的 `t(...)` 一一对应。 */
export const zh = {
  'chip.label': '当前分支：{branch}。点击切换分支',
  detached: '游离 HEAD',
  dirty: '{count} 个文件有未提交改动',
  'popover.label': '切换分支',
  'popover.title': '切换分支',
  'popover.search': '搜索分支',
  'popover.empty': '没有匹配的分支',
  'popover.unborn': '这个仓库还没有任何提交，所以只有当前分支「{branch}」（首次提交后才会出现在列表里）。',
  'popover.current': '当前',
  'popover.createPlaceholder': '新分支名',
  'popover.create': '创建并切换',
  'error.generic': '操作失败',
  'error.unreachable': '无法连接 Host',
  'error.branchName': '分支名不合法',
  'project.unknown': '未归属项目',
  'project.copy': '点击复制项目名称：{name}',
  'project.copied': '已复制',
  'project.copyFailed': '复制失败',
  'warn.text':
    '该会话已开始工作，切到 {branch} 可能丢失未提交的改动（当前 {count} 个文件有改动）。确定切换？',
  'warn.running':
    '该会话正在执行中，切到 {branch} 可能打断执行并丢失代码（当前 {count} 个文件有改动）。确定切换？',
  'warn.cancel': '取消',
  'warn.confirm': '仍要切换',
}

/** 英文字案（与中文一一对应）。 */

export const en: Record<keyof typeof zh, string> = {
  'chip.label': 'Current branch: {branch}. Select to switch',
  detached: 'Detached HEAD',
  dirty: '{count} uncommitted files',
  'popover.label': 'Switch branch',
  'popover.title': 'Switch branch',
  'popover.search': 'Search branches',
  'popover.empty': 'No branch matches',
  'popover.unborn':
    'This repository has no commit yet, so only the current branch "{branch}" exists; more appear after the first commit.',
  'popover.current': 'Current',
  'popover.createPlaceholder': 'New branch name',
  'popover.create': 'Create and switch',
  'error.generic': 'The operation failed',
  'error.unreachable': 'Cannot reach the Host',
  'error.branchName': 'That branch name is not valid',
  'project.unknown': 'No project',
  'project.copy': 'Select to copy the project name: {name}',
  'project.copied': 'Copied',
  'project.copyFailed': 'Copy failed',
  'warn.text':
    'This session has already run work; switching to {branch} can strand uncommitted changes ({count} files changed). Switch anyway?',
  'warn.running':
    'This session is running; switching to {branch} can interrupt it and drop code ({count} files changed). Switch anyway?',
  'warn.cancel': 'Cancel',
  'warn.confirm': 'Switch anyway',
}

/** 本功能自带的样式；只用主题 token，浅色/深色都成立。 */
