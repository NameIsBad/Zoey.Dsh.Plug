/**
 * 「功能集」页壳的样式契约。
 *
 * `.fh-set-*` 是页壳、共享控件（`lib/settings-controls.tsx`）与各功能设置面板之间
 * 的契约：页头、标签栏、卡片、设置行、开关、步进器、滑杆、按钮的外观都在这里定义，
 * 功能的 `settings.ts` 只写内容结构。
 *
 * 配色分两层：
 *   - **文字/边框/底色** 只用 `--dsw-alias-*` 主题 token，深浅主题自动跟随；
 *   - **装饰色** 由卡片的 `data-tone` 映射到 `--fh-set-accent`（`lib/palette.ts`
 *     提供的国风色），只用于图标底、开关轨道、进度条与分组标记。
 * 因此浅色主题下文字对比度不受强调色影响。
 */

export const styles = `
.fh-set {
  max-width: 720px;
  padding: 2px 0 10px;
  color: var(--dsw-alias-label-primary);
}
.fh-set, .fh-set *, .fh-set *::before, .fh-set *::after { box-sizing: border-box; }

/* ---- 页头 ---- */
.fh-set-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 2px 16px;
}
.fh-set-hero-mark {
  flex: none;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  background:
    radial-gradient(120% 120% at 20% 0%, color-mix(in srgb, var(--fh-tone-gold) 16%, transparent), transparent 62%),
    radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--fh-tone-blue) 14%, transparent), transparent 60%),
    var(--dsw-alias-settings-card-fill);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
.fh-set-hero-text { flex: 1 1 auto; min-width: 0; }
.fh-set-hero-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  line-height: 24px;
  letter-spacing: 0.01em;
}
.fh-set-hero-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  text-wrap: pretty;
}
.fh-set-hero-count {
  flex: none;
  align-self: flex-start;
  margin-top: 2px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

/* ---- 标签页：一个功能一个标签，只有当前标签的卡片可见 ---- */
.fh-set-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 2px 12px;
}
.fh-set-tab {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px 0 7px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  border-radius: 11px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}
.fh-set-tab:hover {
  border-color: color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
  color: var(--dsw-alias-label-primary);
}
.fh-set-tab[data-active='true'] {
  border-color: color-mix(in srgb, var(--fh-set-accent) 45%, transparent);
  background: color-mix(in srgb, var(--fh-set-accent) 11%, transparent);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.fh-set-tab:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fh-set-accent) 60%, transparent);
  outline-offset: 1px;
}
.fh-set-tab-icon {
  flex: none;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: color-mix(in srgb, var(--fh-set-accent) 12%, transparent);
  color: var(--fh-set-accent);
}
.fh-set-tab[data-active='true'] .fh-set-tab-icon {
  background: color-mix(in srgb, var(--fh-set-accent) 20%, transparent);
}
.fh-set-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 卡片 ---- */
.fh-set-panels { display: flex; flex-direction: column; }
.fh-set-panel[hidden] { display: none; }
.fh-set-card {
  position: relative;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke);
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--fh-set-accent) 5%, var(--dsw-alias-settings-card-fill)),
    var(--dsw-alias-settings-card-fill) 96px
  );
}
.fh-set-card::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--fh-set-accent) 75%, transparent),
    color-mix(in srgb, var(--fh-set-accent) 12%, transparent) 55%,
    transparent
  );
  pointer-events: none;
}
/* 每个功能一个强调色；缺省（未知 tone）退回石碑蓝。 */
.fh-set-card[data-tone='gold'],
.fh-set-tab[data-tone='gold'] {
  --fh-set-accent: var(--fh-tone-gold);
}
.fh-set-card[data-tone='red'],
.fh-set-tab[data-tone='red'] {
  --fh-set-accent: var(--fh-tone-red);
}
.fh-set-card[data-tone='blue'],
.fh-set-tab[data-tone='blue'] {
  --fh-set-accent: var(--fh-tone-blue);
}
.fh-set-card[data-tone='green'],
.fh-set-tab[data-tone='green'] {
  --fh-set-accent: var(--fh-tone-green);
}
.fh-set-card[data-tone='violet'],
.fh-set-tab[data-tone='violet'] {
  --fh-set-accent: var(--fh-tone-violet);
}
.fh-set-card[data-tone='pink'],
.fh-set-tab[data-tone='pink'] {
  --fh-set-accent: var(--fh-tone-pink);
}
.fh-set-card,
.fh-set-tab {
  --fh-set-accent: var(--fh-tone-blue);
}

.fh-set-card-head { padding: 13px 16px 0; }
.fh-set-card-title {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}
.fh-set-card-desc {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  text-wrap: pretty;
}
.fh-set-card-body { padding: 2px 14px 10px; }

/* ---- 设置行 ---- */
.fh-set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: 10px;
  transition: background-color 120ms ease;
}
.fh-set-row:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.fh-set-row + .fh-set-row {
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
}
.fh-set-row-hero {
  margin: 2px 0 6px;
  padding: 11px 10px;
  background: color-mix(in srgb, var(--fh-set-accent) 7%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fh-set-accent) 17%, transparent);
}
.fh-set-row-hero:hover { background: color-mix(in srgb, var(--fh-set-accent) 10%, transparent); }
.fh-set-row-hero + .fh-set-row { box-shadow: none; }
.fh-set-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fh-set-label { font-size: 13px; font-weight: 500; line-height: 20px; }
.fh-set-row-hero .fh-set-label { font-size: 14px; font-weight: 600; }
.fh-set-help {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  text-wrap: pretty;
}
.fh-set-control { display: flex; align-items: center; gap: 8px; flex: none; }

/* ---- 分组小标题 ---- */
.fh-set-group { margin-top: 12px; }
.fh-set-group:first-child { margin-top: 4px; }
.fh-set-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 1px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  letter-spacing: 0.06em;
}
.fh-set-group-title::before {
  content: '';
  flex: none;
  width: 3px;
  height: 10px;
  border-radius: 2px;
  background: var(--fh-set-accent);
  opacity: 0.85;
}
.fh-set-group .fh-set-row { padding: 9px 8px; }

/* ---- 开关 ---- */
.fh-set-switch {
  position: relative;
  flex: none;
  width: 38px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  cursor: pointer;
  transition: background-color 160ms ease;
}
.fh-set-switch[data-on='true'] { background: var(--fh-set-accent); }
.fh-set-switch:hover:not(:disabled) { filter: brightness(1.04); }
.fh-set-switch:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fh-set-accent) 70%, transparent);
  outline-offset: 2px;
}
.fh-set-switch:disabled { opacity: 0.45; cursor: default; }
.fh-set-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
  transition: transform 160ms cubic-bezier(0.2, 0.7, 0.3, 1);
}
.fh-set-switch[data-on='true'] .fh-set-switch-thumb { transform: translateX(16px); }

/* ---- 步进器 ---- */
.fh-set-stepper {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 2px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: var(--dsw-alias-bg-layer-1);
}
.fh-set-stepper:focus-within { border-color: color-mix(in srgb, var(--fh-set-accent) 60%, transparent); }
.fh-set-stepper-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.fh-set-stepper-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  color: var(--dsw-alias-label-primary);
}
.fh-set-stepper-btn:disabled { opacity: 0.35; cursor: default; }
.fh-set-stepper-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fh-set-accent) 65%, transparent);
  outline-offset: 0;
}
.fh-set-stepper-input {
  width: 42px;
  height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: none;
}
.fh-set-stepper-unit {
  padding: 0 7px 0 1px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

/* ---- 滑杆 ---- */
.fh-set-slider { display: inline-flex; align-items: center; gap: 10px; }
.fh-set-range {
  width: 150px;
  height: 18px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}
.fh-set-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--fh-set-accent) var(--fh-pct, 50%),
    color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent) var(--fh-pct, 50%)
  );
}
.fh-set-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border-radius: 50%;
  border: 2px solid var(--fh-set-accent);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent);
}
.fh-set-range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
}
.fh-set-range::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--fh-set-accent);
}
.fh-set-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--fh-set-accent);
  background: var(--dsw-alias-bg-layer-1);
}
.fh-set-range:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fh-set-accent) 60%, transparent);
  outline-offset: 4px;
  border-radius: 999px;
}
.fh-set-range-value {
  min-width: 42px;
  text-align: right;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ---- 快捷胶囊 ---- */
.fh-set-presets { display: inline-flex; align-items: center; gap: 4px; }
.fh-set-preset {
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 22px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.fh-set-preset:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.fh-set-preset[data-active='true'] {
  border-color: color-mix(in srgb, var(--fh-set-accent) 45%, transparent);
  background: color-mix(in srgb, var(--fh-set-accent) 12%, transparent);
  color: var(--fh-set-accent);
  font-weight: 600;
}
.fh-set-preset:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fh-set-accent) 60%, transparent);
  outline-offset: 1px;
}

/* ---- 按钮 ---- */
.fh-set-button {
  height: 30px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.fh-set-button:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); }
.fh-set-button:disabled { opacity: 0.4; cursor: default; }
.fh-set-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fh-set-accent) 60%, transparent);
  outline-offset: 1px;
}
.fh-set-button-soft {
  border-color: color-mix(in srgb, var(--fh-set-accent) 34%, transparent);
  background: color-mix(in srgb, var(--fh-set-accent) 13%, transparent);
  color: var(--fh-set-accent);
  font-weight: 600;
}
.fh-set-button-soft:hover:not(:disabled) { background: color-mix(in srgb, var(--fh-set-accent) 20%, transparent); }
.fh-set-button-danger {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent);
  color: var(--dsw-alias-state-error-primary);
}
.fh-set-button-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
}

/* ---- 状态文字（测试通知的结果、权限状态） ---- */
.fh-set-note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 18px;
}
.fh-set-note-ok { color: var(--dsw-alias-state-success-primary); }
.fh-set-note::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.85;
}

/* ---- 页脚 ---- */
.fh-set-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 2px 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.fh-set-foot-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fh-tone-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fh-tone-green) 16%, transparent);
}

/* ---- 窄屏：控件换到下一行，避免把说明挤成一条窄缝 ---- */
@media (max-width: 560px) {
  .fh-set-row { flex-direction: column; align-items: stretch; gap: 8px; }
  .fh-set-control { justify-content: flex-end; }
  .fh-set-hero-count { display: none; }
  .fh-set-tab { flex-basis: calc(50% - 3px); }
  .fh-set-slider { width: 100%; }
  .fh-set-range { flex: 1 1 auto; width: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .fh-set-row, .fh-set-tab, .fh-set-switch, .fh-set-switch-thumb { transition: none; }
}
`
