/** 本功能的样式表；只使用 `--dsw-alias-*` 主题 token 与 color-mix 派生色。 */
export const styles = `
.fh-ws-recent .fh-ws-count {
  flex: none;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
`

/** 本功能的注册描述对象，由 main.ts 的 SECTIONS 清单安装。 */
