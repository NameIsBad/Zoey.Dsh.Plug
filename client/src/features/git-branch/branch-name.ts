/**
 * 分支名校验规则。
 *
 * Host 那边会用自己的副本再校验一次才真正执行 git；这里的作用只是让拼错的
 * 名字立刻有反馈，不必等一次往返。
 */

/** 允许的分支名最大长度。 */
export const BRANCH_NAME_MAX = 120

/** 允许的字符：字母、数字，以及 git 自己允许的分隔符。 */
export const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/
