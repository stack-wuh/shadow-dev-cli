---
title: brief.md frontmatter 行尾契约
domain: cli-infrastructure
keywords: [brief, frontmatter, CRLF, 行尾, autocrlf, BRIEF_FRONTMATTER_REQUIRED]
scope: [lib/brief.mjs, shadow-docs/changes]
status: active
source:
  - changes/20260917-refactor-compat-and-domain-convergence/brief.md
verified: 2026-09-17
---

# brief.md frontmatter 行尾契约

## 当前结论

brief 解析器对行尾**只读容忍、写必统一**：读取按 `\r?\n` 匹配 frontmatter 定界（兼容 Windows `core.autocrlf=true` 检出与手工编辑产生的 CRLF），写回一律输出 LF（含正文 `body` 的 CRLF→LF 归一）。frontmatter 的 JSON 值经 `JSON.parse` 后与行尾无关，因此 planHash 在 LF/CRLF 等价文件上一致。

## 执行约束

- 任何触碰 `lib/brief.mjs` 读写的变更必须保持「读容忍 CRLF、写恒 LF」，禁止把定界匹配改回仅 `\n---\n`。
- 新增 brief 相关解析/生成逻辑时，测试必须覆盖 CRLF 文件的读-改-写 round-trip（契约测试 `brief parsing tolerates CRLF and writes back LF`）。
- CLI 之外手工生成或转换 brief 时不依赖写侧归一——归一只发生在 `write()` 落盘路径。

## 适用边界

适用于所有由 shadow-dev CLI 读写的 `shadow-docs/changes/**/brief.md`。不适用于技能文档等自由格式 markdown（其行尾不受 CLI 解析约束）。

## 验证方式

`node --test test/cli.test.mjs` 全绿即契约成立；单点复验：将 LF brief 全文替换为 CRLF 后执行 `task list --name <n>`，应返回 `ok:true`，随后一次带 `--confirm` 的写入命令应使文件回到纯 LF。

## 关联知识

- 无
