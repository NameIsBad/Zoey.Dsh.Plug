/**
 * 侧边栏浏览区与对话框的样式表。
 *
 * 颜色一律来自主题 token（`--dsw-alias-*`），更淡的层次用 `color-mix()`
 * 从主文字色派生，因此浅色/深色主题都不用另写一套。
 *
 * 类名两套并存：新组件用 `.fh-row*`，而「最近任务」分组仍用原来的
 * `.fh-ws-row*`；两边共享同一份几何与配色（选择器并列写），避免功能之间
 * 因为外壳改名而失去样式。
 */

export const SIDEBAR_STYLES = `
.fh-ws, .fh-ws *, .fh-ws *::before, .fh-ws *::after,
.fh-rail, .fh-rail *, .fh-dialog, .fh-dialog *, .fh-menu, .fh-menu * { box-sizing: border-box; }

.fh-ws {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100cqh;
  color: var(--dsw-alias-label-primary);
}

/* ---- 区头：标题 / 搜索 / 视图菜单 / 添加工作区 ----
   收起态：标题撑满左侧，搜索图标紧挨右侧动作，所以图标天然右对齐。
   展开态：标题不渲染、动作由 .fh-ws-head-open 隐藏，输入框吃掉整行。 */
.fh-ws-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 4px 0 12px;
  color: var(--dsw-alias-label-secondary);
}
.fh-ws-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 20px;
}
/* 搜索展开后的整行输入框：32px 高、8px 圆角、1px 主题描边，图标在左、清除在右。 */
.fh-ws-search {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0;
  height: 32px;
  padding: 0 4px 0 0;
  border-radius: 8px;
  /* 描边优先用组件库的边框 token；万一主题没定义，再从主文字色派生一层。 */
  border: 1px solid var(--dsw-alias-border-l4, color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent));
  color: var(--dsw-alias-label-secondary);
  cursor: text;
}
.fh-ws-search:focus-within {
  border-color: color-mix(in srgb, var(--dsw-alias-label-primary) 32%, transparent);
}
/* 放大镜占住输入框左端；右侧清除按钮沿用 .fh-icon-button 的 24px 方框。 */
.fh-ws-search > svg { flex: none; margin: 0 6px 0 8px; }
.fh-ws-search-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  outline: none;
}
.fh-ws-search-input::placeholder { color: var(--dsw-alias-label-secondary); }
/* 展开搜索时把整行让给输入框：右侧的视图菜单与「添加工作区」一并收掉。 */
.fh-ws-head-open { gap: 0; }
.fh-ws-head-open .fh-ws-head-actions { display: none; }
.fh-ws-head-actions { flex: none; display: inline-flex; align-items: center; gap: 2px; }

/* ---- 图标按钮（行尾、区头、对话框共用几何） ---- */
.fh-icon-button, .fh-ws-icon-button {
  flex: none;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.fh-icon-button:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-primary); }
.fh-icon-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.fh-icon-button:disabled { opacity: 0.45; cursor: default; }

/* ---- 列表容器 ---- */
.fh-ws-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px 16px 0;
  scrollbar-width: thin;
}

/* ---- 分组 ---- */
.fh-ws-group, .fh-group { display: block; }
.fh-ws-group + .fh-ws-group, .fh-group + .fh-group { margin-top: 4px; }
.fh-ws-group-head, .fh-workspace-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 6px 0 12px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
}
.fh-ws-group-head:hover, .fh-workspace-row:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
.fh-ws-group-head:focus-visible, .fh-workspace-row:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.fh-ws-group-head[draggable='true'], .fh-workspace-row[draggable='true'] { cursor: grab; }
.fh-ws-group-head[draggable='true']:active, .fh-workspace-row[draggable='true']:active { cursor: grabbing; }
.fh-workspace-active .fh-ws-group-title, .fh-workspace-active .fh-row-title { color: var(--dsw-alias-label-primary); }

.fh-ws-folder, .fh-row-folder {
  position: relative;
  flex: none;
  width: 16px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary);
  transition: color 120ms ease;
}
.fh-row-folder-active { color: var(--dsw-alias-brand-primary); }

/* 展开/收起只用图标本身区分（文件夹「敞开」与「合起」），不再叠加小三角。 */
.fh-workspace-row:hover .fh-row-folder,
.fh-ws-group-head:hover .fh-ws-folder { color: var(--dsw-alias-label-primary); }
.fh-workspace-row:hover .fh-row-folder-active { color: var(--dsw-alias-brand-primary); }

.fh-ws-group-title, .fh-row-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
}
.fh-ws-count {
  flex: none;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.fh-ws-group-head > .fh-icon-button,
.fh-workspace-row > .fh-row-actions .fh-icon-button { opacity: 0; }
.fh-ws-group-head:hover > .fh-icon-button,
.fh-workspace-row:hover > .fh-row-actions .fh-icon-button,
.fh-workspace-row:focus-within > .fh-row-actions .fh-icon-button { opacity: 1; }
.fh-ws-group-body, .fh-group-body { display: flex; flex-direction: column; gap: 2px; }

/* ---- 会话行 ---- */
.fh-ws-row, .fh-session-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 12px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
}
.fh-ws-row:hover, .fh-session-row:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
.fh-ws-row-selected, .fh-row-selected {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
}
.fh-ws-row:focus-visible, .fh-session-row:focus-visible, .fh-search-row:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.fh-ws-slot, .fh-row-slot {
  flex: none;
  width: 16px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary);
}
.fh-ws-rest, .fh-row-rest {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-secondary);
}
.fh-ws-time, .fh-row-time { font-size: 10px; line-height: 16px; font-variant-numeric: tabular-nums; }
/* 等待回答 / 等待确认：琥珀胶囊，比同色小字更醒目，且不依赖悬停才看见。 */
.fh-row-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 38%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent);
  color: var(--dsw-alias-state-warn-primary);
  font-size: 10px;
  line-height: 18px;
  font-weight: 600;
  white-space: nowrap;
}
.fh-row-badge::before {
  content: '';
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: fh-badge-pulse 1.6s ease-in-out infinite;
}
@keyframes fh-badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.fh-ws-actions, .fh-row-actions { display: none; flex: none; align-items: center; gap: 2px; }
.fh-ws-row:hover .fh-ws-rest, .fh-session-row:hover .fh-row-rest,
.fh-session-row:focus-within .fh-row-rest { display: none; }
.fh-ws-row:hover .fh-ws-actions, .fh-session-row:hover .fh-row-actions,
.fh-session-row:focus-within .fh-row-actions,
.fh-workspace-row:hover .fh-row-actions, .fh-workspace-row:focus-within .fh-row-actions { display: inline-flex; }
.fh-ws-row-archived .fh-ws-title, .fh-row-archived .fh-row-title { color: var(--dsw-alias-label-secondary); }
.fh-ws-pin, .fh-row-pin { color: var(--dsw-alias-label-secondary); display: inline-flex; }
.fh-row-anchor { position: relative; display: block; }

/* 拖拽落点：上下各一条主题色细线。 */
.fh-drop-before { position: relative; }
.fh-drop-after { position: relative; }
.fh-drop-before::before,
.fh-drop-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary);
  pointer-events: none;
}
.fh-drop-before::before { top: -2px; }
.fh-drop-after::after { bottom: -2px; }

/* ---- 状态点 ---- */
.fh-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; display: inline-block; }
.fh-dot-idle { background: var(--dsw-alias-state-idle-primary); }
.fh-dot-warning { background: var(--dsw-alias-state-warn-primary); }
.fh-dot-done { background: var(--dsw-alias-state-success-primary); }
.fh-dot-spinner, .fh-ws-spinner {
  box-sizing: border-box;
  width: 11px;
  height: 11px;
  flex: none;
  border-radius: 50%;
  border: 1.6px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: fh-spin 0.8s linear infinite;
}
@keyframes fh-spin { to { transform: rotate(360deg); } }
.fh-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ---- 空状态 / 显示更多 ---- */
.fh-ws-empty, .fh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.fh-empty-icon { color: var(--dsw-alias-label-secondary); opacity: 0.7; }
.fh-show-more {
  align-self: flex-start;
  margin: 2px 0 2px 12px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.fh-show-more:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-primary); }

/* ---- 搜索结果 ---- */
.fh-search-body { display: flex; flex-direction: column; gap: 2px; }
.fh-search-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.fh-search-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.fh-search-heading { display: flex; align-items: center; gap: 6px; }
.fh-search-meta { display: flex; gap: 8px; padding-left: 22px; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.fh-search-workspace { flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fh-search-snippet { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fh-search-status { padding: 8px 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); }

/* ---- 悬停卡片 ---- */
.fh-hovercard {
  position: fixed;
  z-index: 40;
  width: 260px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  font-size: 12px;
  pointer-events: none;
}
.fh-hovercard-body { display: flex; flex-direction: column; gap: 4px; }
.fh-hovercard-title { font-size: 12px; line-height: 18px; word-break: break-word; }
.fh-hovercard-path { color: var(--dsw-alias-label-secondary); font-size: 11px; word-break: break-all; }
.fh-hovercard-time { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.fh-hovercard-status { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); }
.fh-hovercard-archived { color: var(--dsw-alias-state-warn-primary); }
.fh-hovercard-copy {
  margin-top: 6px;
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11px;
  pointer-events: auto;
  cursor: pointer;
}

/* ---- 菜单（popover） ---- */
.fh-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 4px;
  min-width: 190px;
  max-width: 280px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  font-size: 13px;
}
.fh-menu:popover-open { display: flex; flex-direction: column; }
.fh-menu-label {
  padding: 6px 10px 2px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.fh-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--dsw-alias-border-l1);
}
.fh-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fh-menu-item:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.fh-menu-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.fh-menu-item:disabled { opacity: 0.45; cursor: default; }
.fh-menu-item-selected { color: var(--dsw-alias-brand-primary); }
.fh-menu-item-danger { color: var(--dsw-alias-state-error-primary); }
.fh-menu-item-icon { flex: none; width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; }
.fh-menu-item-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- 对话框 ---- */
.fh-dialog {
  width: min(440px, calc(100vw - 32px));
  max-height: min(70vh, 640px);
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent);
  font-size: 13px;
}
.fh-dialog::backdrop { background: color-mix(in srgb, var(--dsw-alias-label-primary) 32%, transparent); }
.fh-dialog[open] { display: flex; flex-direction: column; }
.fh-dialog-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px 16px;
}
.fh-dialog-title { flex: 1 1 auto; font-size: 14px; line-height: 20px; }
.fh-dialog-desc { margin: 0; padding: 0 16px 8px; color: var(--dsw-alias-label-secondary); line-height: 18px; }
.fh-dialog-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 16px 12px; }
.fh-dialog-foot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.fh-dialog-foot-gap { flex: 1 1 auto; }
.fh-dialog-error { margin-top: 8px; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
.fh-dialog-status { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.fh-input {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.fh-input:focus { border-color: var(--dsw-alias-brand-primary); }
.fh-button {
  flex: none;
  height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.fh-button:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.fh-button:disabled { opacity: 0.45; cursor: default; }
.fh-button-primary {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base);
}
.fh-button-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 88%, var(--dsw-alias-label-primary)); }
.fh-button-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }

/* ---- 目录选择器 ---- */
.fh-picker-path { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.fh-picker-path-input { flex: 1 1 auto; }
.fh-picker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  min-height: 120px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
}
.fh-picker-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fh-picker-entry:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.fh-picker-entry-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fh-picker-status { padding: 12px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.fh-picker-new { display: flex; gap: 8px; margin-top: 8px; }
.fh-picker-new .fh-input { flex: 1 1 auto; }

/* ---- 折叠 rail 态 ---- */
.fh-rail { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; }
.fh-rail-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.fh-rail-button:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-primary); }

/* ---- 右下角提示 ---- */
.fh-notices {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}
.fh-notice {
  max-width: 360px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  pointer-events: auto;
  cursor: pointer;
}
.fh-notice-warn { border-color: var(--dsw-alias-state-warn-primary); }

@media (hover: none) {
  .fh-ws-rest, .fh-row-rest { display: none; }
  .fh-ws-actions, .fh-row-actions { display: inline-flex; }
}
@media (prefers-reduced-motion: reduce) {
  .fh-row-folder, .fh-ws-folder { transition: none; }
  .fh-row-badge::before { animation: none; }
  .fh-dot-spinner, .fh-ws-spinner { animation: none; }
}
`
