---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-refactor-compat-and-domain-convergence",
  "type": "refactor",
  "scope": "lib",
  "status": "committed",
  "baseBranch": "main",
  "branch": "refactor/20260917-refactor-compat-and-domain-convergence",
  "files": [
    "README.md",
    "cli.mjs",
    "lib/brief.mjs",
    "lib/domains/change.mjs",
    "lib/domains/commit.mjs",
    "lib/domains/index.mjs",
    "lib/domains/issue.mjs",
    "lib/domains/publish.mjs",
    "lib/domains/release.mjs",
    "lib/domains/sync.mjs",
    "lib/errors.mjs",
    "lib/git.mjs",
    "lib/input.mjs",
    "lib/steps.mjs",
    "scripts/pack.mjs",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 1,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/1",
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "pending",
    "verifiedCommit": null,
    "verifiedAt": null
  },
  "workflow": {
    "operation": null,
    "checkpoint": "0c221d14e6a69262f6de78e58a5c4b187bd463c2",
    "planHash": "0537bf0c92920057c535f2985483ffdf66483996d4207803b1dc4d7ec04e84bf",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "CLI 平台兼容性修复与领域架构收敛",
      "body": "分析发现两类问题：CRLF 导致 Windows 用户 brief 解析全面失败（已复现实证）；release 逻辑三处拷贝、路由器领域特例、index 校验语义分叉、错误构造三种风格并存。选定方案 B：兼容性修复 + 架构收敛，13 项任务分 3 个 Phase。详见 shadow-docs/changes/20260917-refactor-compat-and-domain-convergence/brief.md",
      "labels": [
        "refactor"
      ]
    }
  }
}
---

# CLI 平台兼容性修复与领域架构收敛

## 动机

逐文件分析发现两类会持续产生成本的问题：一是 CRLF 兼容性缺口——`brief.mjs` 的 frontmatter 定界只认 LF，Windows 用户 `core.autocrlf=true` checkout 或手工编辑的 brief 会令所有命令报 `BRIEF_FRONTMATTER_REQUIRED`（已实验复现）；二是架构渗漏——`release` 域整段复制 commit+publish 逻辑、路由器硬编码领域特例、`index` 域绕开通道自建一套 hash 校验（且与通用语义不一致）、错误构造三种风格并存。近期三次提交已证明团队在真实处理 node20/Windows 兼容问题，此时把兼容基线固化进解析层、把领域边界收敛干净，收益最高、回归面最小。

## 引用规范

- norms/code-style.md（通用规范）
  - 当前结论: 渐进式治理——新代码必须守规范，修改旧代码只修与当前改动直接相关的问题；不以 300 行为机械拆分门槛；不添加未使用 import；不为未来场景提前抽象。
  - 适用 scope: 全仓 `cli.mjs`、`lib/`
- norms/code-style-packages.md（部分适用）
  - 当前结论: 公共能力从稳定公开入口导出；变更导出入口时验证实际消费者。
  - 适用 scope: `lib/` 内部共享 helper（`errors`、`steps`、`input`）

## 决策

- **选型:** 方案 B——兼容性修复 + 架构收敛
- **对比方案:** 方案 A（只修兼容）会遗留 release 三处拷贝和路由领域渗漏，维护税持续发生；方案 C（微模块合并、数据驱动命令表、移除 --json）改动契约接口有兼容风险且违反「不为显然代码提前抽象」，均不选。
- **理由:** 兼容缺口是用户可感知的正确性 bug，优先固化到解析层（读取容忍 CRLF、写入统一 LF），不散落逐域打补丁；架构收敛限定在「同逻辑多份拷贝」和「契约不一致」两处，遵循 code-style 渐进式治理，不顺手做方案 C 的格式化重构。`--json` 保留为兼容参数并文档化，不删除。

## 任务

### Phase 1 — 兼容性修复

- [x] brief 解析容忍 CRLF：frontmatter 定界按 `\r?\n---\r?\n` 匹配，`write()` 输出统一 LF —— `lib/brief.mjs`
- [x] `--files` 归一化：反斜杠转正斜杠、去空段、排序，收敛为 `fileList()` helper 供 change/commit/release 消费 —— `lib/input.mjs` — `lib/domains/change.mjs` `lib/domains/commit.mjs` `lib/domains/release.mjs`
- [x] `git status --porcelain` rename 行取 ` -> ` 右侧新路径，不再产出脏字符串 —— `lib/git.mjs`
- [x] `git fetch` 加 120s 超时，与 push 对齐 —— `lib/domains/sync.mjs`
- [x] 删除 cli.mjs 未使用 import（repo/tasks/pr），execute 的 async IIFE 改直接 `async function` —— `cli.mjs` — `lib/domains/publish.mjs` `lib/domains/issue.mjs` `lib/domains/release.mjs`

### Phase 2 — 架构收敛

- [x] 提取共享步骤模块：`commitStep(r, x)`、`pushAndOpenPr(r, x, b)`，commit/publish/release 三域改为复用 —— `lib/steps.mjs` — `lib/domains/commit.mjs` `lib/domains/publish.mjs` `lib/domains/release.mjs`
- [x] plan 回写领域化：各域可选导出 `persistPlan(e, b)`，`planDomain` 改为 `mod.persistPlan?.(e, b)`，删除 `d === 'release'` / `d === 'issue'` 硬编码 —— `cli.mjs` — `lib/domains/release.mjs` `lib/domains/issue.mjs`
- [x] index 并入统一通道：改造为 DOMAINS 成员（planData/execute + persistPlan），hash 校验语义与 executeDomain 对齐，保持 `index rebuild plan|execute` 外部契约不变 —— `cli.mjs` — `lib/domains/index.mjs`
- [x] 错误构造统一：`lib/errors.mjs` 提供 `err(code, {status})`，全域错误改经它构造；错误码与退出码 1/2/3/4 语义文档化 —— `lib/errors.mjs` — `README.md`

### Phase 3 — 回归与文档

- [x] 新增测试：CRLF brief 读-改-写 round-trip、反斜杠 `--files` 与 conflict 交集匹配、rename 行 changedFiles 结果 —— `test/cli.test.mjs`
- [x] pack.mjs 清理冗余动态 import；`tar` 缺失时给出明确报错提示 —— `scripts/pack.mjs`
- [x] README 补命令总览、退出码表、`--json` 兼容参数说明；35 项存量测试全量回归 —— `README.md` — `test/cli.test.mjs`

## 结果

- 实际耗时: 约 50 分钟
- 验证: `node --test` 38/38 通过（35 存量 + 3 新增兼容契约）；全部模块 `node --check` 通过；`scripts/pack.mjs` 实测产出 tar 并验证内容清单（顺带发现并修复 Git Bash 下 `D:\` 被 tar 误判为远程主机路径的真实缺陷）；review 阶段修复 executeDomain 三元可读性问题后全量回归保持绿色。

## 知识评估

- **预期影响:** 新增
- **候选卡片:** shadow-docs/knowledge/brief-frontmatter-crlf.md（domain: cli-infrastructure，scope: lib/brief.mjs）
- **理由:** CRLF 定界约定是本次验证出的非显然约束（brief 文件格式契约），后续任何触碰 brief 读写的变更都必须知道「读容忍 CRLF、写必须 LF」；沉淀为卡片防止回归。其余改动为常规架构收敛，无需卡片。
