---
{
  "schema": "shadow-dev/v1",
  "name": "20260925-feature-workflow-domain",
  "type": "feature",
  "scope": "distribution",
  "status": "reviewed",
  "baseBranch": "main",
  "branch": "feature/20260925-feature-workflow-domain",
  "files": [
    "README.md",
    "lib/args.mjs",
    "lib/domains/bind.mjs",
    "lib/domains/workflow.mjs",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": null,
    "issue": null,
    "issueUrl": null,
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "77616b56f485c693c952ca114671381de59a87e0",
    "verifiedAt": "2026-09-25T07:38:24.141Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": null,
    "planHash": "5e7cd62b9be6cf1cfdbe5e3f98d7005ed47a3752a9c450b83cc63780d38d6363",
    "updatedAt": null,
    "lastError": null,
    "release": {
      "files": [
        "README.md",
        "cli.mjs",
        "lib/commands.mjs",
        "lib/domains/bind.mjs",
        "lib/domains/workflow.mjs",
        "lib/i18n.mjs",
        "shadow-docs/changes/20260925-feature-workflow-domain/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "feat(cli): workflow 物化域 + bind 宿主绑定域——CLI 驱动 shadow 生态分发(宿主无关,无 brief 凭证链)",
      "title": "20260925-feature-workflow-domain",
      "body": ""
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/install-distribution.md",
    "reason": "scope 扩展至 lib/domains/workflow.mjs 与 bind.mjs;宿主绑定(描述符数据化、sidecar 托管标记、非托管 guard)为新执行约束;大小写不敏感文件系统上指针文件与入口软链命名不得冲突(CURRENT/current 教训)"
  }
}
---

# workflow 域:生态物化与宿主绑定

## 动机

分发反转:CLI 从「被插件引导」变为「shadow 生态统一分发入口」。前置 brief `20260925-feature-pack-release`(shadow-dev-workflow 仓)提供带 adapters 的 release tarball;本 brief 在 CLI 侧新增物化与宿主绑定执行层。宿主无关:claude code 原生,zcode 兼容,codex/kimi 留描述符扩展位。

## 引用规范

- shadow-docs/knowledge/install-distribution.md
  - 当前结论: 双轨(物化+link)、LINK/CURRENT 语义互斥、落盘前冒烟不过指针不动、非托管同名文件 guard 绝不静默覆盖、--json 单行输出为跨仓接缝契约
  - 适用 scope: lib/domains/workflow.mjs、lib/domains/bind.mjs 全部行为
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: 单行 JSON 成功/失败结构、退出码 0-4、nextStep 提示面
  - 适用 scope: workflow/bind 新命令面的输出契约

## 决策

- **选型:** workflow 域完整复刻 CLI 自身双轨模型——release tarball 物化到 `~/.local/share/shadow-dev-workflow/shadow-dev-workflow-<ver>/` + CURRENT/PREVIOUS 指针 + `current` 稳定入口 + 落盘前冒烟(marketplace.json/package.json/skills/ 完整性)+ link 直通轨;bind 域读产物 `adapters/<host>.json`,按描述符把 SKILL.md 复制入宿主发现目录并打 managed-by 标记,非托管同名文件 guard 拒绝,unbind 逆操作,`--host auto` 探测本机已有宿主
- **对比方案:** 直写宿主注册表(否决——耦合内部格式);symlink 绑定(否决——跨宿主兼容未验证,复制+托管标记与托管 shim 同一已验证模式);以 ZCode marketplace 为接缝(否决——宿主无关要求)
- **理由:** 全部复用 install-distribution 卡已验证模式,测试与跨平台坑有先例;规则引用走 `$PREFIX/current` 稳定路径,注入宿主的文件面最小化
- **非目标:** init 域(另立 brief)、codex/kimi 描述符(独立小 brief)、superpowers 式强制入口/子代理派发(独立 brief)、移除 SessionStart hook(保留为插件型宿主 fallback)、cliVersion 反向 pin(避免双向耦合)

## 任务

### Phase 1
- [x] workflow 域模块 — `lib/domains/workflow.mjs` — planData/execute:install|update|rollback|status|link|unlink(物化轨+link 轨+指针+冒烟)
- [x] 命令面注册 — `lib/args.mjs` — workflow 命令与 HELP 条目

### Phase 2
- [x] bind 域模块 — `lib/domains/bind.mjs` — bind plan|execute --host auto|claude-code|zcode 与 unbind,描述符驱动+托管标记+guard
- [x] bind 命令面 — `lib/args.mjs` — bind/unbind 与 HELP

### Phase 3
- [x] 契约测试 — `test/cli.test.mjs` — workflow 布局/指针/回滚往返、bind 托管标记/guard/--json 契约用例
- [x] 文档 — `README.md` — 命令表补 workflow/bind,分发章节改为生态入口

## 结果

- 实际耗时: —
- 验证: —

## 知识评估

- **预期影响:** 更新
- **候选卡片:** shadow-docs/knowledge/install-distribution.md
- **理由:** scope 扩展至 lib/domains/workflow.mjs 与 bind.mjs;宿主绑定(描述符驱动、托管标记、guard)作为新执行约束沉淀
