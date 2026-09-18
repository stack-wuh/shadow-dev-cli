---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-install-link-mode",
  "type": "feature",
  "scope": "scripts/install-cli.sh",
  "status": "branched",
  "baseBranch": "main",
  "branch": "feature/20260917-feature-install-link-mode",
  "files": [],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 20,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/20",
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
    "checkpoint": "issue:20",
    "planHash": "be18f297a3af19ccd6be47a0f8f2e15d38815773a58b477b7222feed9baee39d",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[feature] install-cli.sh 新增 link 模式：shim 一次性映射到仓库真实地址",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\n现有安装模型是\"release 物化\"：每次代码更新必须发布新 GitHub Release 再重跑 install。实际痛点：`change list` 等能力已合并进 main，但装的 v1.1.0 没有该命令，用户终端报\"没有这个指令\"；而 CLI 开发者本人每次改 `cli.mjs`/`lib/` 都要走发版链路才能生效。需要一条\"装一次、映射指向真实仓库目录、代码即改即生效\"的开发直通入口，同时插件钩子依赖的 release 链路原封不动。\n\n## 引用规范\n- norms/code-style.md\n  - 当前结论: 渐进式治理（link 是新增模式，不重构 release 路径）；同一字段不复用双语义\n  - 适用 scope: scripts/install-cli.sh\n- norms/tdd-verification.md\n  - 当前结论: 先写失败契约测试再实现（test/install.test.mjs 已有 6 项安装器契约先例）\n  - 适用 scope: test/install.test.mjs\n- 文件头接缝契约（install-cli.sh:3-12，README「安装与分发」同源）\n  - 当前结论: commands/options/exit/layout/信任边界是对外契约，新增子命令必须同步登记两处\n  - 适用 scope: scripts/install-cli.sh, README.md\n\n## 决策\n- **选型:** 方案 A——独立 `LINK` 指针文件 + shim 两段解析。`link <path>` 校验目标（`cli.mjs`+`package.json` 存在、`help --json` 冒烟）通过后把绝对路径写入 `$PREFIX/LINK`；shim 运行时优先读 LINK，命中则 `node <LINK>/cli.mjs`，否则按 CURRENT 走物化版本。`unlink` 删除 LINK（回 release 轨）。`status` 输出增加 `linked` 字段。冲突保护复用 `shim_guard`。\n- **对比方案:** B 复用 CURRENT 存绝对路径——值域重载（版本号 OR 路径），所有解析方需适配，违背不复用语义原则；C 生成内嵌路径的 shim——relink 必须重写 shim 文件，违背\"更新不动 shim\"既有原则且 status 不可读。\n- **理由:** 双指针各有唯一语义：LINK=开发直通（存在即最高优先），CURRENT/PREVIOUS=release 物化；双轨切换各一条命令；信任边界不扩——link 目标由用户显式给出本机路径，不引入下载面；rollback/status 现有语义不破坏（status 仅 additive 字段）。\n- **非目标:** 不新增 PowerShell profile 入口（现有 `.cmd` 托管 shim 已覆盖 PowerShell/cmd，\"ps1 入口\"是用户对形态的类比）；不改插件钩子契约；不在本次实现\"link 目标的自动 git pull 同步\"（仓库主人自己拉代码）。\n\n## 任务\n### Phase 1（TDD：红 → 绿）\n\n- [ ] task-1 — `test/install.test.mjs` — 新增失败契约用例：①`link` 校验失败（缺 cli.mjs / 冒烟不过）不落指针、exit 3/1；②`link` 成功后 shim 解析走 LINK 目标（以目标仓库版本输出为证）、`status` 含 `linked`；③`unlink` 后 shim 回退 CURRENT 物化版本；跑一遍确认红\n- [ ] task-2 — `scripts/install-cli.sh` — 实现 `link <path>`/`unlink` 子命令与 `$PREFIX/LINK` 指针；LINK 校验与自校验复用 `verof`/`help --json` 冒烟；`status` JSON additive 输出 `linked`；shim（sh 与 .cmd 两模板）改为 LINK 优先两段解析；文件头接缝契约注释同步更新\n- [ ] task-3 — `README.md` — 「安装与分发」命令块补 `link`/`unlink` 用法与双轨说明（更新免重装的开发者直通语义）\n\n### Phase 2（知识治理）\n\n- [ ] task-4 — `shadow-docs/knowledge/install-distribution.md`、`shadow-docs/menu.md` — 新增 active 卡片：安装/分发域（指针文件集、shim 托管协议、release/link 双轨语义、信任边界、接缝契约与测试对应关系），menu 追加路由；source 指向本 brief 与两个已归档安装 brief\n- [ ] task-5 — 本机真实验证 — `bash scripts/install-cli.sh link D:/works/shadow-dev-cli` 后终端 `shadow-dev change list --archived` 立即可用；改一行代码再跑确认即时生效；`unlink` 后回 v1.1.0 行为（记录到结果字段）\n\n完整 brief：shadow-docs/changes/20260917-feature-install-link-mode/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20260917-feature-install-link-mode\",\"type\":\"feature\",\"scope\":\"scripts/install-cli.sh\",\"status\":\"branched\",\"branch\":\"feature/20260917-feature-install-link-mode\",\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20260917-feature-install-link-mode/brief.md\",\"cliVersion\":\"1.2.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "feature"
      ]
    }
  }
}
---

# install-cli.sh 新增 link 模式：shim 一次性映射到仓库真实地址

## 动机

现有安装模型是"release 物化"：每次代码更新必须发布新 GitHub Release 再重跑 install。实际痛点：`change list` 等能力已合并进 main，但装的 v1.1.0 没有该命令，用户终端报"没有这个指令"；而 CLI 开发者本人每次改 `cli.mjs`/`lib/` 都要走发版链路才能生效。需要一条"装一次、映射指向真实仓库目录、代码即改即生效"的开发直通入口，同时插件钩子依赖的 release 链路原封不动。

## 引用规范

- norms/code-style.md
  - 当前结论: 渐进式治理（link 是新增模式，不重构 release 路径）；同一字段不复用双语义
  - 适用 scope: scripts/install-cli.sh
- norms/tdd-verification.md
  - 当前结论: 先写失败契约测试再实现（test/install.test.mjs 已有 6 项安装器契约先例）
  - 适用 scope: test/install.test.mjs
- 文件头接缝契约（install-cli.sh:3-12，README「安装与分发」同源）
  - 当前结论: commands/options/exit/layout/信任边界是对外契约，新增子命令必须同步登记两处
  - 适用 scope: scripts/install-cli.sh, README.md

## 决策

- **选型:** 方案 A——独立 `LINK` 指针文件 + shim 两段解析。`link <path>` 校验目标（`cli.mjs`+`package.json` 存在、`help --json` 冒烟）通过后把绝对路径写入 `$PREFIX/LINK`；shim 运行时优先读 LINK，命中则 `node <LINK>/cli.mjs`，否则按 CURRENT 走物化版本。`unlink` 删除 LINK（回 release 轨）。`status` 输出增加 `linked` 字段。冲突保护复用 `shim_guard`。
- **对比方案:** B 复用 CURRENT 存绝对路径——值域重载（版本号 OR 路径），所有解析方需适配，违背不复用语义原则；C 生成内嵌路径的 shim——relink 必须重写 shim 文件，违背"更新不动 shim"既有原则且 status 不可读。
- **理由:** 双指针各有唯一语义：LINK=开发直通（存在即最高优先），CURRENT/PREVIOUS=release 物化；双轨切换各一条命令；信任边界不扩——link 目标由用户显式给出本机路径，不引入下载面；rollback/status 现有语义不破坏（status 仅 additive 字段）。
- **非目标:** 不新增 PowerShell profile 入口（现有 `.cmd` 托管 shim 已覆盖 PowerShell/cmd，"ps1 入口"是用户对形态的类比）；不改插件钩子契约；不在本次实现"link 目标的自动 git pull 同步"（仓库主人自己拉代码）。

## 任务

### Phase 1（TDD：红 → 绿）

- [x] task-1 — `test/install.test.mjs` — 新增失败契约用例：①`link` 校验失败（缺 cli.mjs / 冒烟不过）不落指针、exit 3/1；②`link` 成功后 shim 解析走 LINK 目标（以目标仓库版本输出为证）、`status` 含 `linked`；③`unlink` 后 shim 回退 CURRENT 物化版本；跑一遍确认红
- [x] task-2 — `scripts/install-cli.sh` — 实现 `link <path>`/`unlink` 子命令与 `$PREFIX/LINK` 指针；LINK 校验与自校验复用 `verof`/`help --json` 冒烟；`status` JSON additive 输出 `linked`；shim（sh 与 .cmd 两模板）改为 LINK 优先两段解析；文件头接缝契约注释同步更新
- [x] task-3 — `README.md` — 「安装与分发」命令块补 `link`/`unlink` 用法与双轨说明（更新免重装的开发者直通语义）

### Phase 2（知识治理）

- [x] task-4 — `shadow-docs/knowledge/install-distribution.md`、`shadow-docs/menu.md` — 新增 active 卡片：安装/分发域（指针文件集、shim 托管协议、release/link 双轨语义、信任边界、接缝契约与测试对应关系），menu 追加路由；source 指向本 brief 与两个已归档安装 brief
- [x] task-5 — 本机真实验证 — `bash scripts/install-cli.sh link D:/works/shadow-dev-cli` 后终端 `shadow-dev change list --archived` 立即可用；改一行代码再跑确认即时生效；`unlink` 后回 v1.1.0 行为（记录到结果字段）

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 新增
- **候选卡片:** shadow-docs/knowledge/install-distribution.md
- **理由:** 安装/分发域在 knowledge 无任何 active 卡片与 menu 路由（本次查询确认的治理缺口），而该域已有跨仓接缝契约（插件钩子）与双轨模型这类长期事实，值得沉淀；不更新 cli-output-contract（那是 CLI 运行时输出面，不含安装器）
