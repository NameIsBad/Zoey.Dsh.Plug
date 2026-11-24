/**
 * 「压缩上下文」按钮的样式。
 *
 * 只用 `--dsw-alias-*` 主题 token 与 `color-mix()` 派生色，浅色/深色主题都不会翻车；
 * 类名统一 `fh-cx-` 前缀，避免与外壳或其它功能撞名。
 */
export const styles = `
.fh-cx { position: relative; display: inline-flex; align-items: center; }
.fh-cx, .fh-cx * { box-sizing: border-box; }
.fh-cx-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.fh-cx-button:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent); }
.fh-cx-button svg { filter: drop-shadow(0 1px 2px color-mix(in srgb, #000 22%, transparent)); }
.fh-cx-button:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 60%, transparent); outline-offset: 1px; }
.fh-cx-button-disabled { opacity: 0.5; cursor: default; }
.fh-cx-button-disabled:hover { color: var(--dsw-alias-label-secondary); background: transparent; }
.fh-cx-button[aria-busy='true'] { cursor: progress; }

.fh-cx-note {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 20;
  max-width: 280px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  box-shadow: 0 18px 44px color-mix(in srgb, #000 38%, transparent);
}
`
