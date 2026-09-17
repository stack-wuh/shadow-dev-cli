---
title: CLI 双通道输出契约
domain: cli-infrastructure
keywords: [stdout, stderr, JSON 契约, 语言, i18n, nextStep, help, 人用提示]
scope: [cli.mjs, lib/output.mjs, lib/human.mjs, lib/i18n.mjs, lib/commands.mjs]
status: active
source:
  - changes/20260917-feature-human-cli-ux/brief.md
  - changes/20260917-feature-help-compact-noise/brief.md
verified: 2026-09-17
---

# CLI 双通道输出契约

## 当前结论

本 CLI 有且只有一个机器契约面：**stdout 恒为单行 JSON**（`{ok, command, ...}` / `{ok:false, error:{code,message}}`），与运行环境、语言设置、是否 TTY 完全无关。人类可读内容（进出场横幅、耗时、错误解释、help 人读版）只允许走 **stderr**，由 `lib/human.mjs` 渲染，可经 `SHADOW_DEV_QUIET` 整体关闭。命令目录 `lib/commands.mjs` 是两个通道的单一事实源：HELP 字符串、`help` JSON、`data.nextStep`、错误示例全部由它派生。

## 执行约束

- 任何新增输出必须二选一：进 stdout JSON 契约（视为公开 API，需测试钉住），或进 stderr 人用层；**禁止**向 stdout 写非 JSON 内容。
- 错误 code 与 `data.nextStep` 模板永不本地化；语言链固定为 `--lang` > `SHADOW_DEV_LANG` > locale 探测 > 默认 zh，且只影响 stderr 文案。
- `nextStep` 为 additive 字段，写入发生在 planHash 持久化与计算之后，不得参与 hash 输入。
- help 的 `data.help` 恒为字符串（概览默认唯一字段，最小面 <1KB）；结构化目录 `data.commands` 经 `--full` opt-in；`help <命令>` 组详情恒定返回该组 `commands`。
- 语言不变性由契约测试保护（同命令 zh/en stdout 逐字节一致），触碰输出面的变更必须保持其绿色。

## 适用边界

适用于 shadow-dev 全部子命令的 stdout/stderr 行为。不适用于技能（SKILL.md）自身向用户输出的进场/离场文案——那是编排层，不读本 CLI 的 stderr。

## 验证方式

`node --test test/cli.test.mjs` 全绿即契约成立（关键用例：`human layer: banners and hints on stderr, stdout contract language-invariant`、`SHADOW_DEV_QUIET silences the human channel`）。手工复验：`shadow-dev help --lang zh` 与 `--lang en` 的 stdout 应 diff 为空、stderr 应不同；`SHADOW_DEV_QUIET=1 shadow-dev repo inspect` 的 stderr 应为空。

## 关联知识

- [brief.md frontmatter 行尾契约](brief-frontmatter-crlf.md)
