---
{
  "schema": "shadow-dev/v1",
  "name": "20261009-chore-release-v150",
  "type": "chore",
  "scope": "packaging,install",
  "status": "branched",
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
    "checkpoint": null,
    "planHash": "84d2f51109394ba4522e501f2748d99f3c09c30c78a59a185510c04c78059b43",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "package.json",
        "scripts/bootstrap.sh",
        "shadow-docs/changes/20261009-chore-release-v150/brief.md"
      ],
      "message": "chore(release): v1.5.0——版本号与 bootstrap TAG、README 安装 URL 三处同源",
      "title": "chore(release): v1.5.0 发版准备（版本号三处同源 bump）",
      "body": ""
    }
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
- 实际耗时: —
- 验证: —

## 知识评估
- **预期影响:** 无需变更
- **候选卡片:** 无
- **理由:** 版本号与安装 URL 属一次性发布事实，卡片承载的是稳定机制（双轨/断言/同源登记），已在 PR #47 更新到位；把「v1.5.0 已发布」写进 Knowledge 就是把变更历史塞进执行真相源。
