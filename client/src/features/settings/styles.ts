/**
 * 「功能集」页壳的骨架样式。
 *
 * `.fh-set-*` 是页壳与各功能设置面板之间的契约：页壳负责卡片、设置行、输入框、
 * 开关与按钮的外观，功能的 `settings.ts` 只写内容结构并复用这些类名
 * （与侧边栏外壳的 `fh-ws-*` 契约一致）。颜色只用主题 token。
 */
export const styles = `
.fh-set { max-width: 720px; color: var(--dsw-alias-label-primary); }
.fh-set, .fh-set *, .fh-set *::before, .fh-set *::after { box-sizing: border-box; }
.fh-set-card {
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent);
  padding: 4px 16px 8px;
}
.fh-set-card-head { padding: 12px 0 4px; }
.fh-set-card-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 22px; }
.fh-set-card-desc { margin: 2px 0 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.fh-set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 0;
  border-top: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  margin-top: 8px;
}
.fh-set-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.fh-set-label { font-size: 13px; line-height: 20px; }
.fh-set-help { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.fh-set-control { display: flex; align-items: center; gap: 8px; flex: none; }
.fh-set-input {
  width: 68px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: right;
  outline: none;
  font-variant-numeric: tabular-nums;
}
.fh-set-input:focus-visible { border-color: var(--dsw-alias-brand-primary); }
.fh-set-reset {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.fh-set-reset:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); color: var(--dsw-alias-label-primary); }
.fh-set-reset:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.fh-set-checkbox {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.fh-set-checkbox:disabled { cursor: default; opacity: 0.45; }
.fh-set-checkbox:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.fh-set-button {
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.fh-set-button:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.fh-set-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.fh-set-card + .fh-set-card { margin-top: 16px; }
.fh-set-foot { margin: 10px 2px 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
`

/** 设置页的注册描述对象，由 main.ts 安装。 */
