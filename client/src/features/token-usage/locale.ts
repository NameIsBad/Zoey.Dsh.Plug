/**
 * 「用量状态条」的中英文字典。
 *
 * 键名与组件里的 `t(...)` 一一对应；两份字典必须同时加键，漏键会让界面显示原始 key。
 */

/** 中文文案。 */
export const zh = {
  'consumed.label': '已消耗',
  'consumed.unit': 'tok',
  'speed.label': '速度',
  'speed.unit': 'tok/s',
  'ttft.label': '首字',
  'elapsed.label': '耗时',
  'context.label': '上下文',
  'estimate.mark': '≈',
  'estimate.hint': '估算值',
  region: '会话用量',
  'aria.summary':
    '已消耗 {tokens} token；速度约 {speed} tok/s；首字约 {ttft}；耗时约 {elapsed}；上下文已用 {percent}%',
  'settings.title': '用量状态条',
  'settings.description': '输入框上方的一行实时用量：已消耗 token、本阶段速度、首字延迟、耗时与上下文占用。',
  'settings.enabled': '显示用量状态条',
  'settings.enabledHint': '关闭后输入框上方不再显示任何用量信息。',
  'settings.tokens': '已消耗 token',
  'settings.tokensHint': '本会话累计的提示词与输出 token 合计（与会话统计同一口径）。',
  'settings.exact': 'token 用精确数字',
  'settings.exactHint': '打开后显示 12,345 这样的千分位；关闭时用 12.3K / 1.2M 紧凑写法。',
  'settings.speed': '本阶段速度',
  'settings.speedHint': '最近一轮的解码速度；首字等待时间不计入吞吐。',
  'settings.ttft': '首字延迟',
  'settings.ttftHint': '最近一轮从发出请求到首个 token 的平均耗时。',
  'settings.elapsed': '本轮耗时',
  'settings.elapsedHint': '最近一轮从开始到结束的墙钟时间；执行中按当前时间估算。',
  'settings.live': '执行中实时刷新耗时',
  'settings.liveHint': '关闭后耗时只在事件到达时更新，减少每秒重渲染。',
  'settings.context': '上下文占用',
  'settings.contextHint': '与输入框下方那圈百分比同源；没有模型窗口信息时不显示。',
  'settings.resetLabel': '恢复默认设置',
  'settings.resetHint': '把所有开关与显示方式改回「全部展示」。',
  'settings.reset': '恢复默认（全部展示）',
}

/** 英文文案；键与 {@link zh} 相同。 */
export const en: Record<keyof typeof zh, string> = {
  'consumed.label': 'Used',
  'consumed.unit': 'tok',
  'speed.label': 'Speed',
  'speed.unit': 'tok/s',
  'ttft.label': 'First token',
  'elapsed.label': 'Elapsed',
  'context.label': 'Context',
  'estimate.mark': '≈',
  'estimate.hint': 'Estimated',
  region: 'Session usage',
  'aria.summary':
    'Used {tokens} tokens; speed about {speed} tok/s; first token about {ttft}; elapsed about {elapsed}; context {percent}% full',
  'settings.title': 'Usage bar',
  'settings.description':
    'One live line above the composer: consumed tokens, this turn’s speed, first-token latency, elapsed time, and context occupancy.',
  'settings.enabled': 'Show the usage bar',
  'settings.enabledHint': 'When off, nothing is rendered above the composer.',
  'settings.tokens': 'Consumed tokens',
  'settings.tokensHint':
    'Prompt and output tokens accumulated in this session (the same figure as session statistics).',
  'settings.exact': 'Exact token digits',
  'settings.exactHint': 'Show grouped digits like 12,345; otherwise 12.3K / 1.2M is used.',
  'settings.speed': 'Turn speed',
  'settings.speedHint': 'Decode throughput of the latest turn; first-token wait is excluded.',
  'settings.ttft': 'First-token latency',
  'settings.ttftHint': 'Average wait from request to the first token in the latest turn.',
  'settings.elapsed': 'Turn elapsed',
  'settings.elapsedHint':
    'Wall time of the latest turn; while it runs, the figure is estimated from the current clock.',
  'settings.live': 'Tick elapsed while running',
  'settings.liveHint': 'When off, elapsed updates only when events arrive instead of every second.',
  'settings.context': 'Context occupancy',
  'settings.contextHint':
    'Shares the percentage ring below the composer; hidden when no context window is known.',
  'settings.resetLabel': 'Reset preferences',
  'settings.resetHint': 'Put every switch and display choice back to “show everything”.',
  'settings.reset': 'Reset to defaults (everything shown)',
}
