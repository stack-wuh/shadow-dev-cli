---
title: CLI 双通道输出契约
domain: cli-infrastructure
keywords: [stdout, stderr, JSON 契约, 语言, i18n, nextStep, help, 人用提示]
scope: [cli.mjs, lib/output.mjs, lib/human.mjs, lib/i18n.mjs, lib/commands.mjs]
status: active
source:
  - changes/20260917-feature-human-cli-ux/brief.md
  - changes/20260917-feature-help-compact-noise/brief.md
  - changes/20260917-feature-tty-human-default/brief.md
  - changes/20260917-fix-missing-arg-hints/brief.md
  - changes/20260917-feature-change-list-archived/brief.md
  - changes/20260917-feature-unified-issue-structure/brief.md
verified: 2026-09-18
---

# CLI 双通道输出契约

## 当前结论

本 CLI 的机器契约面是 **stdout 的单行 JSON**（`{ok, command, ...}` / `{ok:false, error:{code,message}}`），其**出现按环境路由**：非 TTY（管道/重定向）恒输出；交互 TTY 默认抑制，仅 `--json` 或 `SHADOW_DEV_JSON=1` 显式开启（判定纯函数 `output.jsonEnabled`）。JSON 的内容本身与语言、是否 TTY 无关。人类可读内容（进出场横幅、耗时、错误解释、help 人读版、TTY 下作为兜底的 `planHash` 行）只允许走 **stderr**，由 `lib/human.mjs` 渲染，可经 `SHADOW_DEV_QUIET` 整体关闭。退出码不受 JSON 抑制影响。命令目录 `lib/commands.mjs` 是两个通道的单一事实源：HELP 字符串、`help` JSON、`data.nextStep`、错误示例全部由它派生。

## 执行约束

- 任何新增输出必须二选一：进 stdout JSON 契约（视为公开 API，需测试钉住），或进 stderr 人用层；**禁止**向 stdout 写非 JSON 内容。
- 缺必填参数报错时，stderr 必须从 `COMMANDS` 逐行列出缺失参数的目录描述（`flag * desc`，经 `human.argLine` 与 help 详情共用同一渲染），示例行占位符与目录 example 一致（变更名为 `<change-name>`）；`HINTS` 只保留 code 级短句兜底，不得重复目录中的参数说明。
- `shadow-dev change list` 是变更名发现入口：stdout 契约 `data.changes:[{name,type,status,branch,archived}]`（按 name 排序）。默认只列 `shadow-docs/changes/` 活动目录（条目 `archived:false`）；`--all` 合并归档条目（`archived:true`），`--archived` 只列归档，两参同传按超集 `--all`；解析失败目录静默跳过（与 indexer 同规则，双目录扫描复用 `brief(r, name, archived)` 第三参）。新增无值布尔 flag 必须在 `lib/args.mjs` 白名单登记，否则会被当作取值 flag 吞掉后随参数。
- 抑制 stdout 的分支必须仍然设置退出码；plan 的人用收场行必须透出 `planHash`（PTY 环境下的 agent 兜底）。`--json` 是跨环境逃生门，不得复用为其他语义。
- 错误 code 与 `data.nextStep` 模板永不本地化；语言链固定为 `--lang` > `SHADOW_DEV_LANG` > locale 探测 > 默认 zh，且只影响 stderr 文案。
- `nextStep` 为 additive 字段，写入发生在 planHash 持久化与计算之后，不得参与 hash 输入。
- plan 域可导出 `present(x)` 声明 stdout data 的**最小投影**（`cli.mjs planDomain` 应用，缺省恒等）：重字段（全文正文、整段 brief/repo 回显）不进机器契约，语义输入仍在完整 planData 内参与 planHash。首个用户是 `issue plan`（摘要三件套 bodyBytes/bodySha256/sections，见 [issue 正文双通道结构契约](issue-body-contract.md)）；新域裁剪须有 token 依据并测试钉住。
- help 的 `data.help` 恒为字符串（概览默认唯一字段，最小面 <1KB）；结构化目录 `data.commands` 经 `--full` opt-in；`help <命令>` 组详情恒定返回该组 `commands`。
- 语言不变性由契约测试保护（同命令 zh/en stdout 逐字节一致），触碰输出面的变更必须保持其绿色。

## 适用边界

适用于 shadow-dev 全部子命令的 stdout/stderr 行为。不适用于技能（SKILL.md）自身向用户输出的进场/离场文案——那是编排层，不读本 CLI 的 stderr。

## 验证方式

`node --test test/cli.test.mjs` 全绿即契约成立（关键用例：`jsonEnabled routes the JSON surface by environment and explicit flags`、`TTY suppresses stdout JSON; --json and env restore it; planHash surfaces on stderr`、`human layer: banners and hints on stderr, stdout contract language-invariant`、`SHADOW_DEV_QUIET silences the human channel`、`missing required args render from the command catalog on stderr`、`change list enumerates active briefs and skips archive and unreadable dirs`、`change list --all merges active and archived; --archived scopes to archive`）。手工复验：`shadow-dev change list --archived` 应列出 `changes/archive/` 下全部条目且 `archived:true`；管道中 `shadow-dev repo inspect | jq .` 有 JSON；TTY 终端里 `shadow-dev help` 只见中文表、`shadow-dev --json help` 恢复 JSON；`SHADOW_DEV_QUIET=1 shadow-dev repo inspect` 的 stderr 应为空；`shadow-dev task list`（不带参数）的 stderr 应含 `--name * 变更名（shadow-docs/changes/ 下的子目录…）` 参数行。

## 关联知识

- [brief.md frontmatter 行尾契约](brief-frontmatter-crlf.md)
