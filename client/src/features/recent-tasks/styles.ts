/**
 * 「最近任务」分组的样式表；只使用 `--dsw-alias-*` 主题 token 与 `color-mix()` 派生色。
 *
 * 边界：本文件只补齐**外壳不再提供**的本功能类名。外壳的会话行已经从
 * `.fh-ws-row*` 改名为 `.fh-row*`，本分组仍沿用自己的 `fh-ws-` 前缀，
 * 因此标题省略号与状态点必须在功能目录里自带，否则标题会换行撑破行高、
 * 状态点没有尺寸而看不见。
 */

export const styles = `
/* 分组计数徽标：藤黄淡底，与时钟图标同一色系。 */
.fh-ws-recent .fh-ws-count {
  flex: none;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--fh-tone-gold) 26%, transparent);
  background: color-mix(in srgb, var(--fh-tone-gold) 11%, transparent);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: color-mix(in srgb, var(--fh-tone-gold) 72%, var(--dsw-alias-label-primary));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 行标题：单行省略，长标题不能把 32px 的行撑成两行 */
.fh-ws-row .fh-ws-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
}

/* 状态点：几何与配色与外壳的 .fh-dot* 保持一致 */
.fh-ws-row .fh-ws-dot {
  width: 6px;
  height: 6px;
  flex: none;
  display: inline-block;
  border-radius: 50%;
}
.fh-ws-row .fh-ws-dot-warn { background: var(--dsw-alias-state-warn-primary); }
.fh-ws-row .fh-ws-dot-done { background: var(--dsw-alias-state-success-primary); }
`

/** 本功能的注册描述对象，由 main.ts 的 SECTIONS 清单安装。 */
