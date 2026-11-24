/**
 * 「压缩上下文」按钮的中英文字典。
 *
 * 键名与组件里的 `t(...)` 一一对应；两份字典必须同时加键，漏键会让界面显示原始 key。
 */

/** 中文文案。 */
export const zh = {
  label: '压缩上下文',
  tooltip: '上下文已用 {percent}%，点击压缩较早的对话历史（等同 /compact，不会动输入框里的草稿）',
  'disabled.running': '正在执行，结束后才能压缩',
  'disabled.busy': '正在提交，请稍候',
  running: '正在压缩…',
  failed: '压缩失败：{detail}',
  'failed.plain': '压缩没有执行成功，请稍后重试',
  unavailable: '当前环境没有可用的命令执行通道，无法压缩',
  'settings.title': '压缩上下文',
  'settings.description': '输入框右侧的「压缩上下文」按钮；上下文占用达到阈值后才会出现。',
  'threshold.label': '压缩按钮出现阈值（%）',
  'threshold.hint': '上下文占用达到该百分比才显示按钮；最小 {min}%。',
  'threshold.presets': '常用阈值',
  'threshold.presetsHint': '点一下套用常用百分比，滑杆会同步。',
  'threshold.reset': '恢复默认',
}

/** 英文文案；键与 {@link zh} 相同。 */
export const en: Record<keyof typeof zh, string> = {
  label: 'Compact context',
  tooltip:
    'Context is {percent}% full; compact earlier history now (same as /compact, never touches your draft)',
  'disabled.running': 'Running a turn; compaction is available when it ends',
  'disabled.busy': 'Submitting; try again in a moment',
  running: 'Compacting…',
  failed: 'Compaction failed: {detail}',
  'failed.plain': 'Compaction did not run; try again in a moment',
  unavailable: 'This build has no command-execution channel, so compaction is unavailable',
  'settings.title': 'Compact context',
  'settings.description':
    'The Compact context button beside the composer appears once context usage reaches the threshold.',
  'threshold.label': 'Compact button threshold (%)',
  'threshold.hint': 'The button appears once context usage reaches this percentage; minimum {min}%.',
  'threshold.presets': 'Common thresholds',
  'threshold.presetsHint': 'Pick a common percentage; the slider follows.',
  'threshold.reset': 'Reset',
}
