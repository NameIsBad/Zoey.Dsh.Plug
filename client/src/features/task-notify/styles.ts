/**
 * 「任务提醒」的样式：右下角浮动提醒堆栈。
 *
 * 挂在 frame 级 `shell.overlay` 里，所以自己负责 `position: fixed` 与层级；
 * 默认穿透点击（`pointer-events: none`），只有每条提醒本体接收指针事件，
 * 不会挡住下面的界面。颜色只用主题 token，浅色/深色主题都成立。
 */
export const styles = `
.fh-tn-stack {
  position: fixed;
  right: 20px;
  /* 抬到输入框之上：输入框的发送按钮就在窗口右下角，提醒盖住它会让人
     在第一眼看到「任务完成」时点不到发送。 */
  bottom: 112px;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, calc(100vw - 40px));
  pointer-events: none;
}
.fh-tn-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 10px 11px 13px;
  border-radius: 14px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-left-width: 3px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 14px 36px color-mix(in srgb, #000 24%, transparent);
  pointer-events: auto;
  animation: fh-tn-in 160ms ease-out;
}
.fh-tn-completed { border-left-color: var(--dsw-alias-state-success-primary); }
.fh-tn-failed { border-left-color: var(--dsw-alias-state-error-primary); }
.fh-tn-asked { border-left-color: var(--dsw-alias-state-warn-primary); }
.fh-tn-icon {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.fh-tn-completed .fh-tn-icon {
  color: var(--dsw-alias-state-success-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);
}
.fh-tn-failed .fh-tn-icon {
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);
}
.fh-tn-asked .fh-tn-icon {
  color: var(--dsw-alias-state-warn-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
}
.fh-tn-content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  border-radius: 8px;
  outline: none;
}
.fh-tn-content:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.fh-tn-title { font-size: 12px; line-height: 18px; font-weight: 600; }
.fh-tn-session {
  font-size: 13px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fh-tn-detail {
  font-size: 12px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.fh-tn-close {
  flex: none;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 16px;
  line-height: 18px;
  cursor: pointer;
}
.fh-tn-close:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  color: var(--dsw-alias-label-primary);
}
.fh-tn-close:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
@keyframes fh-tn-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fh-tn-toast { animation: none; }
}
`
