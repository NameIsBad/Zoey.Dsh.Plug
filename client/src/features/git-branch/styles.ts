/** 本功能的样式表；只使用 `--dsw-alias-*` 主题 token 与 color-mix 派生色。 */
export const styles = `
.fh-br { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.fh-br, .fh-br * { box-sizing: border-box; }
.fh-br-project {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  max-width: 40vw;
}
.fh-br-project-name { line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fh-br-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.fh-br-chip:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.fh-br-chip:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.fh-br-name { line-height: 18px; white-space: nowrap; }
.fh-br-dirty { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); flex: none; }

/* 关闭状态必须保留浏览器默认的 display:none，只有打开时才变成 flex 布局。 */
.fh-br-pop { display: none; }
.fh-br-pop-fallback { display: flex !important; position: fixed; margin: 0; inset: auto; }
.fh-br-pop:popover-open {
  position: fixed;
  margin: 0;
  inset: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(460px, 92vw);
  max-height: 52vh;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 18px 44px color-mix(in srgb, #000 38%, transparent);
  font-size: 13px;
  overflow: hidden;
}
.fh-br-pop, .fh-br-pop * { box-sizing: border-box; }
.fh-br-pop-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 2px 4px; }
.fh-br-pop-title { font-size: 12px; font-weight: 600; }
.fh-br-pop-current { font-size: 11px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fh-br-search {
  height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: var(--dsw-alias-bg-layer-1);
  color: inherit;
  font: inherit;
  font-size: 12px;
  outline: none;
}
.fh-br-search:focus-visible { border-color: var(--dsw-alias-brand-primary); }
.fh-br-list { overflow-y: auto; max-height: 30vh; display: flex; flex-direction: column; gap: 1px; }
.fh-br-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.fh-br-item:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.fh-br-item:disabled { opacity: 0.6; cursor: default; }
.fh-br-item-current { color: var(--dsw-alias-state-success-primary); }
.fh-br-item-name { white-space: normal; word-break: break-all; line-height: 16px; padding: 4px 0; }
.fh-br-check { font-size: 10px; flex: none; }
.fh-br-create { display: flex; align-items: center; gap: 6px; border-top: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); padding-top: 6px; }
.fh-br-create .fh-br-search { flex: 1 1 auto; min-width: 0; }
.fh-br-create-button {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.fh-br-create-button:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.fh-br-create-button:disabled { opacity: 0.5; cursor: default; }
.fh-br-empty { padding: 12px 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); text-align: center; }
.fh-br-error { padding: 6px 8px; border-radius: 6px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.fh-br-warn {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fh-br-warn-text { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); }
.fh-br-warn-actions { display: flex; justify-content: flex-end; gap: 6px; }
.fh-br-warn-cancel, .fh-br-warn-confirm {
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
.fh-br-warn-cancel:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.fh-br-warn-confirm {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 60%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent);
}
.fh-br-warn-confirm:disabled { opacity: 0.6; cursor: default; }
`

/** 本功能的注册描述对象，由 main.ts 的 CONTROLS 清单安装。 */
