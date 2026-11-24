/** 设置页面壳的中英文字典；只放页面级文案，功能面板的文案在各自功能目录里。 */
export const zh = {
  title: '功能集',
  subtitle: '侧边栏、输入框与任务提醒的偏好都集中在这里，改完立即生效。',
  count: '{n} 项功能',
  'tabs.label': '功能分组',
  'saved.auto': '改动即时生效，无需保存',
}

/** 英文字案（与中文一一对应）。 */
export const en: Record<keyof typeof zh, string> = {
  title: 'Feature hub',
  subtitle: 'Preferences for the sidebar, composer, and task reminders — changes apply immediately.',
  count: '{n} features',
  'tabs.label': 'Feature sections',
  'saved.auto': 'Changes apply immediately',
}
