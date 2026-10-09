---
{
  "schema": "shadow-dev/v1",
  "name": "20261009-chore-release-v150",
  "type": "chore",
  "scope": "packaging,install",
  "status": "archived",
  "baseBranch": "main",
  "branch": "chore/20261009-chore-release-v150",
  "files": [
    "README.md",
    "package.json",
    "scripts/bootstrap.sh"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
    "pullRequest": 48,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/48"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "30812060b5adfde1d03cbf1d312c9d012d1dbfb4",
    "verifiedAt": "2026-10-09T14:19:38.199Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:48",
    "planHash": "c64f64c652ec274e85c62fd3619d8e2e2cf6935ceaa77593d13a7a398334fe4d",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "shadow-docs/changes/20261009-chore-release-v150/brief.md"
      ],
      "message": "docs(shadow): review passed（S 级：diff 走查 + 结构扫描 + version 冒烟）",
      "title": "chore(release): v1.5.0 发版准备（版本号三处同源 bump）",
      "body": ""
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": null,
    "reason": "交付发布完成：Release v1.5.0（tag @ 3081206，tarball 资产齐备）+ 装机端到端验收三条通过；结论已在 CI 中复证，无新增长期事实"
  }
}
---

# 发版准备：v1.5.0 版本号与安装面三处同源 bump

## 动机
PR #47 已把「产物能力契约（requiresCommands 落盘前断言）+ worktree 域 + `.shadow-dev` 配置域 + blog publish 域」合入 main，但最新 release 仍是 v1.4.0——用户侧与 workflow 仓 pin 拿不到这些能力，change 2（workflow 仓删 `cliVersion` pin / SessionStart hook）也就没有地基。本 change 只做发版前的版本号同步，发布动作本身按 release 第 4 步委托执行。

## 复杂度评级
- **评级:** S
- **理由:** 三要素——①契约变更：无（版本号与安装 URL/标签字符串，行为已由 PR #47 定稿并有 CI 9/9 背书）；②触及面：纯声明式资产（package.json、README 安装段、bootstrap.sh 的 TAG）；③可发现性：装错版本立刻可见。
- **期望验证深度:** code-read（diff 走查 + 结构/残留扫描 + 两条冒烟）

## 引用规范
- `shadow-docs/knowledge/install-distribution.md`
  - 当前结论: 命令面/options/退出码与布局在两处同源登记，改行为必须同步改注释；bootstrap.sh 编排三段装机（CLI → workflow → bind）；跨仓演进顺序＝消费方先行兼容、生产方随后声明（本 change 正是「发布」这一环）。
  - 适用 scope: package.json, README.md, scripts/bootstrap.sh
- `norms/tdd-verification.md`
  - 当前结论: S 级不创建测试，验证＝diff 走查 + 结构/引用/残留扫描；进度可见性仍适用。
  - 适用 scope: 全流程

## 决策
- **选型:** 三处一起 bump（`1.4.0 → 1.5.0`），不留版本号分裂面。
- **对比方案:** 只改 package.json、让 bootstrap 的 `TAG` 继续指 v1.4.0——未选，那会让「一键装机」永远装到旧版，正是本项目反复出现的漂移形状；把 tag/release 也塞进本 change——未选，release 不作为 brief task（既有教训：会造成机械门禁死锁），且发布执行权在用户/CI。
- **理由:** 版本号唯一事实源是 package.json，README 安装 URL 与 bootstrap TAG 是它的两处投影，必须在同一提交里同步。

## 任务
### Phase 1
- [x] 版本号三处同源 bump — `package.json`, `README.md`, `scripts/bootstrap.sh` — 1.4.0→1.5.0；随后 grep 扫描全仓（排除 changes/archive 历史记录）确认无 v1.4.0 残留
- [x] 冒烟与结构验证 — `scripts/bootstrap.sh` — `bash -n` 语法过；`node cli.mjs version --json` 回 1.5.0；`node cli.mjs workflow status --json` 与 `help workflow --json` 结构正常

## 非目标
- 不执行 `git tag` / `gh release create`（合并后由用户按 release 第 4 步执行）
- 不动 workflow 仓（删 pin/hook/vendored installer、`adapters/codex.json`、`requiresCommands` 声明）——下一个 change

## 结果

- 实际耗时: ≈14 分钟（含一次 139 段错误重试、一次 `--confirm` 漏传返工、一次归档 push 失败恢复）
- 验证（S 级＝diff 走查 + 结构/残留扫描 + 两条冒烟，与评级匹配）:
  - `bash -n scripts/bootstrap.sh` 通过；`node cli.mjs version --json` → `1.5.0`；`workflow status --json`、`help workflow --json` 结构正常。
  - 残留扫描：`grep -rn "1\.4\.0" test/ lib/` 为空——版本号无硬编码，全仓仅剩叙述性历史指称。
  - CI（PR #48）合并前 checks **9/9 COMPLETED SUCCESS**（ubuntu/macos/windows × node 20/22/24）。
- 交付发布（release 第 4 步，经用户明确授权后代跑）:
  - PR **#48** squash 合入 main → `3081206`，远端分支已删除。
  - **Release: https://github.com/stack-wuh/shadow-dev-cli/releases/tag/v1.5.0** — tag `v1.5.0` @ main、标记 Latest、资产 `shadow-dev-cli-v1.5.0.tar.gz`（46,951 B，命名符合安装器正则 `^shadow-dev-cli-v[0-9][0-9.]*\.tar\.gz$`，与 v1.4.0 资产先例同源）。
  - 端到端装机（走用户真实路径 `install-cli.sh install --version v1.5.0`）：`CURRENT=1.5.0 / PREVIOUS=1.4.0`（可 rollback）、shim `shadow-dev version` → 1.5.0。
  - 装机后三条证明：① 越权产物 `workflow plan` 透出 `missingCommands=['nope.does-not-exist','zzz.future.command']`，`workflow execute` → `ARTIFACT_INCOMPATIBLE`；② `worktree inspect` 由 `UNKNOWN_COMMAND` 变 `BRIEF_NOT_FOUND`（域已发布）；③ `workflow status` 回 `cliVersion=1.5.0 / artifactVersion / missingCommands=[]` 三元组。
- 归档现场异常（真实缺陷，待独立 change）：`archive execute` 在物化+本地提交后 `git push` 失败返回 `GIT_PUSH_FAILED`（exit 3），而该命令**不可续跑**——重跑会在 `renameSync` 处因源目录已不存在而炸。本次恢复方式：补记结果段 → `git commit --amend`（改的是未推送的本地提交，不触碰共享历史）→ `git push origin main`。建议 CLI 把 archive 做成幂等（源目录缺失即视为已移动，只补 push），并把 push 前失败与 push 后失败分成两个错误码。

## 知识评估
- **预期影响:** 无需变更
- **候选卡片:** 无
- **理由:** 版本号与安装 URL 属一次性发布事实，卡片承载的是稳定机制（双轨/断言/同源登记），已在 PR #47 更新到位；把「v1.5.0 已发布」写进 Knowledge 就是把变更历史塞进执行真相源。
