/** 设置页面壳的中英文字典；只放页面级文案，功能面板的文案在各自功能目录里。 */
export const zh = {
  title: '功能集',
  'saved.auto': '改动即时生效，无需保存',
}

/** 英文字案（与中文一一对应）。 */
export const en: Record<keyof typeof zh, string> = {
  title: 'Feature hub',
  'saved.auto': 'Changes apply immediately',
}
