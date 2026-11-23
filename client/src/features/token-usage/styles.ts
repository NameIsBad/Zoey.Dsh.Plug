/**
 * 「用量状态条」的样式。
 *
 * 只用 `--dsw-alias-*` 主题 token 与 `color-mix()` 派生色，浅色/深色主题都不会翻车；
 * 类名统一 `fh-tu-` 前缀，避免与外壳或其它功能撞名。
 *
 * 对齐（关键）：
 *   状态条挂在 `conversation.input.dock`，而那个插槽是**满宽**的——它会从会话列
 *   最左一直铺到最右，直接左对齐就会比正文和输入框都靠左一大截。宿主把内容宽度
 *   暴露成 CSS 变量（`--dsh-composer-card-max-width`，定义在 `.an3WzG_body` 上，
 *   由 `--dsh-chat-content-width` 推出、跟随用户的列宽设置与 embedded 变体），
 *   输入框卡片就是用它 `align-self: center` + `max-width` 居中的。这里沿用同一个
 *   变量与同一套居中方式，于是状态条的左右边界与输入框卡片、与上方正文完全对齐，
 *   而且窗口变窄、用户拖宽列、切到 hero/embedded 布局时都不用改代码。
 *   兜底值 712px 与宿主默认（`680px + 32px`）一致，只在变量缺失时生效。
 *
 * 形制对齐输入框卡片下方那排统计胶囊：12px 字号、18px 行高（不用 `line-height: 1`，
 * 否则 g/p/y 的下伸部会被切掉）、`font-variant-numeric: tabular-nums` 让数字不跳动。
 * 左右内边距 14px 与输入框里的文字起点一致，读数因此和正文左对齐。
 */
export const styles = `
.fh-tu {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  align-self: center;
  width: 100%;
  min-width: 0;
  max-width: var(--dsh-composer-card-max-width, 712px);
  padding: 0 14px 2px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.fh-tu, .fh-tu * { box-sizing: border-box; }
.fh-tu-item { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; }
.fh-tu-label { color: color-mix(in srgb, var(--dsw-alias-label-primary) 55%, transparent); }
.fh-tu-value { display: inline-flex; align-items: baseline; gap: 2px; color: var(--dsw-alias-label-primary); font-weight: 500; }
.fh-tu-mark { color: color-mix(in srgb, var(--dsw-alias-label-primary) 50%, transparent); }
.fh-tu-unit { color: color-mix(in srgb, var(--dsw-alias-label-primary) 55%, transparent); font-weight: 400; }
.fh-tu-sep { color: color-mix(in srgb, var(--dsw-alias-label-primary) 32%, transparent); }
.fh-tu[data-running='true'] .fh-tu-item[data-metric='elapsed'] .fh-tu-value { color: var(--dsw-alias-state-business-primary); }
.fh-tu[data-running='true'] .fh-tu-item[data-metric='context'] .fh-tu-value { color: var(--dsw-alias-label-primary); }
`
