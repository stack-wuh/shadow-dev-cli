---
{
  "schema": "shadow-dev/v1",
  "name": "20260917-feature-install-cli-script",
  "type": "feature",
  "scope": "scripts",
  "status": "archived",
  "baseBranch": "main",
  "branch": "feature/20260917-feature-install-cli-script",
  "files": [
    "README.md",
    "scripts/install-cli.sh",
    "test/install.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 11,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/11",
    "pullRequest": 13,
    "pullRequestUrl": "https://github.com/stack-wuh/shadow-dev-cli/pull/13"
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "62ecd070f668671316d69d544dfb008b9ef36916",
    "verifiedAt": "2026-09-17T09:27:15.137Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "merged-pr:13",
    "planHash": "e37b06db52f5611b62cdd2da728c84cb687b8b2352a08fd5176b2454883fcdc1",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "install-cli.sh：shadow-dev CLI 拉取/更新/回滚安装器",
      "body": "版本目录+CURRENT/PREVIOUS 指针、托管 shim 保护、发布前自校验、rollback/--json/--dry-run/--from 离线。供 shadow-dev-workflow 钩子以 install --json 幂等调用。契约测试含离线全链、冲突保护、回滚往返。",
      "labels": [
        "feature"
      ]
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": null,
    "reason": null
  }
}
---

# install-cli.sh：shadow-dev CLI 拉取/更新/回滚安装器

## 动机

CLI 与插件（shadow-dev-workflow）的接缝目前是手工的：本次 v1.1.0 发布后，用户 PATH 上的旧 exe 靠人工改名+手写 shim 才切到新行为。插件钩子需要一个可重复、机器可校验、可回滚的入口来保证「`shadow-dev` 永远指向正确版本」；同时本机 `.local/bin/shadow-dev.exe` 被非托管二进制占用这类冲突必须显式保护而非静默覆盖。

## 引用规范

- norms/code-style.md（通用规范）
  - 当前结论: 渐进式治理；脚本与 CLI 同仓演进，README 分发段落需同步。
  - 适用 scope: `scripts/`、`README.md`
- shadow-docs/knowledge/cli-output-contract.md
  - 当前结论: JSON 契约面按环境路由；退出码 0/1/2/3 语义（本脚本对齐其子集：0 成功/已最新、1 参数/冲突、2 网络、3 自校验失败）。
  - 适用 scope: 脚本 `--json` 输出与钩子集成契约。

## 决策

- **选型:** 版本目录 `$PREFIX/shadow-dev-cli-<ver>/` + `CURRENT`/`PREVIOUS` 指针文件；shim 运行时读指针（更新不动盘、回滚=改指针）；`install|update|rollback|status` 四命令 + `--channel release|main` / `--version` / `--from <tarball|dir>` 离线 / `--json` / `--dry-run` / `--force`；非托管同名 shim/二进制只告警退出；发布前 `node cli.mjs help --json` 自校验通过才切指针。
- **对比方案:** ① symlink 版本目录——Windows 无可靠 symlink，否；② curl|bash 直装——供应链面大且无锁，插件改为本地 clone 执行；③ 校验依赖 GitHub asset digest——可用性不稳，降级为结构校验+自跑（信任边界=HTTPS+仓库，README 注明）。
- **理由:** 插件钩子每次启动都跑 `install --json`，已最新秒退保护启动路径；失败/断网时旧指针版本照常可用（先物化后发布）。rolling `main` 通道保留给插件开发，但钩子默认 release 保可复现。

## 任务

### Phase 1 — 脚本（骨架→能力）

- [x] 骨架：set -euo、参数解析与互斥校验（--from↔--version/--channel main）、退出码 0/1/2/3、PREFIX/.lock 原子锁（>10min 判陈旧） —— `scripts/install-cli.sh`
- [x] 目标解析：release 通道 GitHub API（token 可选）取 tag+asset URL；`--from` 本地 tarball/目录；channel=main git 浅拉并合成 `ver-main.sha8` 版本 —— `scripts/install-cli.sh`
- [x] 物化与发布：结构校验（含 cli.mjs/package.json）→ 解包到 `shadow-dev-cli-<ver>.new` → 自跑 help --json 断言 ok → 原子改名+写 CURRENT/保留 PREVIOUS（force 允许同版重装） —— `scripts/install-cli.sh`
- [x] shim 托管：无扩展名 sh + .cmd（cygpath 归一）双 shim，头部 managed-by 标记，运行时读 CURRENT；已存在无标记文件→告警退出 1 不覆盖；BIN 不在 PATH 时打印补救指引 —— `scripts/install-cli.sh`
- [x] rollback / status / --json / --dry-run 语义收尾 —— `scripts/install-cli.sh`

### Phase 2 — 契约测试与文档

- [x] 新测试文件（bash 可用才运行）：离线 tarball 全链（CURRENT/shim 标记/自校验）、已最新秒退、--force、非托管冲突保护、rollback 往返、--json 可解析、dry-run 零写入 —— `test/install.test.mjs`
- [x] README「安装与分发」改写：钩子调用示例、退出码表、信任边界说明；全量冒烟（含既有 CLI 套件） —— `README.md`

## 结果

- 实际耗时: 约 40 分钟
- 验证: `node --test` CLI 49/49 + 安装器 6/6 全绿（测试先行：脚本缺失时全红，实现后逐步转绿；修复 `set -e` 下 `[ ] && cmd` 短路误杀、`json()` 退出码传染、rollback/status 误触网、`--from` 互斥校验取反、Windows→Git Bash tar 路径 `C:` 误解析为远程主机共 5 处真实缺陷，均由契约测试当场暴露）；README 分发段改写；npm test 并列两套件。范围偏差声明：`package.json` 的 test 脚本并入安装器套件属本变更直接配套，未在 brief files 清单声明，随 commit 一并入库，review 时请确认。

## 知识评估

- **预期影响:** 无需变更
- **候选卡片:** 无
- **理由:** 安装器接缝契约（命令、退出码、指针机制）是 README 分发段落的直接内容+脚本头注释，属单表面文档而非跨变更执行约束；未产生需要独立卡片防回归的非显然事实。
