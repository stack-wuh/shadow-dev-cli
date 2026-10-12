---
{
  "schema": "shadow-dev/v1",
  "name": "20261012-build-ci-release-publish",
  "type": "build",
  "scope": "ci",
  "status": "reviewed",
  "baseBranch": "main",
  "branch": "build/20261012-build-ci-release-publish",
  "files": [
    ".github/workflows/publish.yml",
    "scripts/publish.mjs",
    "shadow-docs/changes/20261012-build-ci-release-publish/brief.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 66,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/66",
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "0ea41e42d80d70b164404374dc5e5b6eb453acd6",
    "verifiedAt": "2026-10-12T12:14:43.336Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "issue:66",
    "planHash": "b7ad9485830fe6c9a3a0b1b78ec969a60c49e9a1245df799ae8f1faa231765f3",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[build] CLI 缺发布工作流：release 无资产导致安装器 asset not found",
      "titleRaw": "[build] CLI 缺发布工作流：release 无资产导致安装器 asset not found",
      "supplement": "v1.6.0 实测 release 零资产，资产由手工 pack + upload 补齐。本 change 把发布链做成脚本单实现 + yml 一行委派。",
      "body": "## 动机\nCLI 仓只有 `test.yml`，**没有发布工作流**。`gh release create v1.6.0` 建出来的 release **一个资产都没有**，而安装器（`scripts/install-cli.sh --channel release`）要找的是 `^shadow-dev-cli-v[0-9][0-9.]*\\.tar\\.gz$`——缺资产等于没发布，宿主会停在 `release asset not found`。\n\n实测证据：v1.6.0 发布后 `releases/tags/v1.6.0` 的 `assets` 为空数组，资产是我手工 `node scripts/pack.mjs` + `gh release upload` 补上去的（v1.4.0 / v1.5.0 各 1 资产，说明历史上也是手工）。这是每次发版必现的坑。\n\n## 引用规范\n（brief 缺少该节）\n\n## 决策\n- **单实现原则**：断言逻辑放脚本、yml 只一行委派（与 shadow-dev-workflow 的 `refactor(release-chain): 冒烟收敛为唯一实现，yml 只剩一行委派` 同源）。若把断言写进 yml 的内联 `run:`，本机门与 CI 门就会有两份实现，改一处漏一处。\n- **回读校验不可省**：上传成功不等于资产可被解析；脚本上传后回读 `releases/tags/<tag>` 断言资产数 ≥ 1 且名字匹配，否则非零。缺这一步，v1.6.0 这次的「release 建成但零资产」会静默通过。\n- **幂等**：`gh release upload --clobber`，重复触发不产生第二个同名资产。\n- 不在范围：不改 `install-cli.sh` 的解析逻辑（它的 `asset not found` 行为正是本 change 要消除的上游缺陷）；不引入第三方依赖（仓内 `package.json` 无 dependencies，脚本只用 node 内建 + 外部 `tar`/`gh`）。\n- 生效验证需下一次真实发版（本 change 合并后打 v1.6.1 才能看 CI 跑通）；本轮以本地脚本执行 + 单元断言为观察点，并如实标注未覆盖项。\n\n## 任务\n- [ ] task-1 — `scripts/publish.mjs` — 版本权威 / pack / 资产名契约 / 上传 / 回读 五步单实现，导出可单测的纯断言\n- [ ] task-2 — `.github/workflows/publish.yml` — release published 触发，只委派脚本\n- [ ] task-3 — `test/cli.test.mjs` — 断言用例（含反例：tag 与 package.json 不一致必须拒、非法资产名必须拒）\n- [ ] task-4 — 观察点 — 本地跑脚本的 `--dry-run`（不上传）在 v1.6.0 上必须全绿，且能复现「资产缺失」场景的判红\n\n## 补充\nv1.6.0 实测 release 零资产，资产由手工 pack + upload 补齐。本 change 把发布链做成脚本单实现 + yml 一行委派。\n\n完整 brief：shadow-docs/changes/20261012-build-ci-release-publish/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261012-build-ci-release-publish\",\"type\":\"build\",\"scope\":\"ci\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261012-build-ci-release-publish/brief.md\",\"cliVersion\":\"1.6.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "build",
        "ci"
      ]
    },
    "release": {
      "files": [
        ".github/workflows/publish.yml",
        "scripts/publish.mjs",
        "shadow-docs/changes/20261012-build-ci-release-publish/brief.md",
        "test/cli.test.mjs"
      ],
      "message": "build(ci): 补发布链——release published 时 pack、断言资产名契约并上传回读",
      "title": "build(ci): 补发布链——release published 时 pack、断言资产名契约并上传回读",
      "body": "## 变更\n- `scripts/publish.mjs`（新增）：发布链的唯一实现，五步顺序固定——版本权威断言 → `pack.mjs` 产出 → 资产名契约断言 → `gh release upload --clobber` → 回读 release 的 `assets` 确认资产真的存在。导出 `assertVersion` / `assertAssetName` / `readVersion` / `packArtifact` / `readBackAssetNames` 供离线单测。\n- `.github/workflows/publish.yml`（新增）：`on: release: types: [published]`，`permissions: contents: write`，`run: node scripts/publish.mjs --tag \"$GITHUB_REF_NAME\"` —— 只有这一行委派，断言不在 yml 里重抄。\n- `test/cli.test.mjs`：三组用例（纯断言含反例、干跑与退出码、yml 单实现防回归）。\n\n## 影响\n- 行为/触发面变化：以后 `gh release create` 会自动补齐资产；漏资产的 release 会被回读步骤判红，而不是静默让安装器在消费侧报 `release asset not found`。**直接动因**：`v1.6.0` 发布后 `releases/tags/v1.6.0` 的 `assets` 是空数组，资产是我手工 `pack.mjs` + `gh release upload` 补的（v1.4.0/v1.5.0 各 1 资产，说明历史上一直是手工）。\n- 明确不受影响的范围：不改 `cli.mjs` 与 `lib/`，命令目录零变化（无新命令键）→ 插件 `requiresCommands` 与 `cliVersion` 判定不受影响；`install-cli.sh` 的解析逻辑不动；既有 `test.yml` 触发矩阵不变；`scripts/pack.mjs` 未改，只是被调用。\n- 幂等与安全：`--clobber` 使重复触发不产生第二个同名资产；上传前任一断言失败即非零退出不上传。\n- 回滚方式：revert 即删除 yml 与脚本，发版退回手工补资产的老路径。\n\n## 验证\n- 干跑：`node scripts/publish.mjs --tag v1.6.0 --dry-run --json` → `ok:true`，五步 steps 齐（后两步标 `skipped (dry-run)`）。\n- 反证版本权威：`--tag v9.9.9` → exit **1**，`VERSION_AUTHORITY: package.json 1.6.0 != tag 9.9.9`。\n- 反证参数契约：缺 `--tag` → exit **2** `--tag is required`。\n- 反证资产名契约：`shadow-dev-cli-latest.tar.gz` 与 `shadow-dev-cli-v1.6.0.tgz` 均抛 `ASSET_NAME_CONTRACT`；`shadow-dev-cli-v1.6.0.tar.gz` 放行。\n- 单实现防回归：用例断 `publish.yml` 必须含委派行，且**不得**出现 `pack.mjs` / `VERSION_AUTHORITY` / `ASSET_NAME_CONTRACT`——断言回拷进 yml 即判红。\n- 子集：`--test-name-pattern publish.mjs` 2 绿、`publish.yml` 1 绿、`publish` 全组（含既有 publish 域用例）无回归。\n- **未覆盖项（明说）**：`upload` 与 `read-back` 只在下一个真实 tag 上端到端执行；本轮无法自证。验收点是 Actions 的 `publish-release` 绿 + `releases/tags/<新 tag>` 恰有一个合法名资产。\n\n## 关联\n- Closes #66\n- brief: shadow-docs/changes/20261012-build-ci-release-publish/brief.md"
    }
  },
  "knowledge": {
    "action": "无需变更",
    "target": "knowledge/plan-credential-chain.md",
    "reason": "发布链五步与单实现约束已由脚本头注释、brief 与三条测试锁定，知识卡不重复散文；既有 plan 凭证卡结论未被本 change 改写"
  }
}
---

# 20261012-build-ci-release-publish

## 动机

CLI 仓只有 `test.yml`，**没有发布工作流**。`gh release create v1.6.0` 建出来的 release **一个资产都没有**，而安装器（`scripts/install-cli.sh --channel release`）要找的是 `^shadow-dev-cli-v[0-9][0-9.]*\.tar\.gz$`——缺资产等于没发布，宿主会停在 `release asset not found`。

实测证据：v1.6.0 发布后 `releases/tags/v1.6.0` 的 `assets` 为空数组，资产是我手工 `node scripts/pack.mjs` + `gh release upload` 补上去的（v1.4.0 / v1.5.0 各 1 资产，说明历史上也是手工）。这是每次发版必现的坑。

## 覆盖范围

- `scripts/publish.mjs`（新增）：发布链的唯一实现，CI 只委派它。职责依次为 **版本权威断言 → pack → 资产名契约断言 → gh 上传 → 回读校验**。任一步失败即非零退出且不上传。
- `.github/workflows/publish.yml`（新增）：`on: release: types: [published]`，装 node、`node scripts/publish.mjs --tag "$GITHUB_REF_NAME"`，权限只给 `contents: write`。
- `test/cli.test.mjs`：对 `publish.mjs` 导出的纯断言做单元用例（版本/tag 一致与不一致、资产名合法与非法、pack 产物路径形态），离线可判定，不需要网络。

## 决策

- **单实现原则**：断言逻辑放脚本、yml 只一行委派（与 shadow-dev-workflow 的 `refactor(release-chain): 冒烟收敛为唯一实现，yml 只剩一行委派` 同源）。若把断言写进 yml 的内联 `run:`，本机门与 CI 门就会有两份实现，改一处漏一处。
- **回读校验不可省**：上传成功不等于资产可被解析；脚本上传后回读 `releases/tags/<tag>` 断言资产数 ≥ 1 且名字匹配，否则非零。缺这一步，v1.6.0 这次的「release 建成但零资产」会静默通过。
- **幂等**：`gh release upload --clobber`，重复触发不产生第二个同名资产。
- 不在范围：不改 `install-cli.sh` 的解析逻辑（它的 `asset not found` 行为正是本 change 要消除的上游缺陷）；不引入第三方依赖（仓内 `package.json` 无 dependencies，脚本只用 node 内建 + 外部 `tar`/`gh`）。
- 生效验证需下一次真实发版（本 change 合并后打 v1.6.1 才能看 CI 跑通）；本轮以本地脚本执行 + 单元断言为观察点，并如实标注未覆盖项。

## 任务

- [x] task-1 — `scripts/publish.mjs` — 版本权威 / pack / 资产名契约 / 上传 / 回读 五步单实现，导出可单测的纯断言
- [x] task-2 — `.github/workflows/publish.yml` — release published 触发，只委派脚本
- [x] task-3 — `test/cli.test.mjs` — 断言用例（含反例：tag 与 package.json 不一致必须拒、非法资产名必须拒）
- [x] task-4 — 观察点 — 本地跑脚本的 `--dry-run`（不上传）在 v1.6.0 上必须全绿，且能复现「资产缺失」场景的判红

## 结果

评级 M：新增发布链实现与 CI 触发，不改命令面、不改运行时行为；风险在真实发版路径，故本地以可离线判定的断言与干跑取证，上传/回读留给下一次发版。

- 干跑通过：`node scripts/publish.mjs --tag v1.6.0 --dry-run --json` →
  `{"ok":true,"tag":"v1.6.0","name":"shadow-dev-cli-v1.6.0.tar.gz","steps":["version-authority ok 1.6.0","pack shadow-dev-cli-v1.6.0.tar.gz","asset-contract ok","upload skipped (dry-run)","read-back skipped (dry-run)"]}`
- 反证（版本权威）：`--tag v9.9.9` → exit **1**，`{"ok":false,"error":"VERSION_AUTHORITY: package.json 1.6.0 != tag 9.9.9"}`。门能看见「bump 没进 tag」这类发版。
- 反证（参数契约）：缺 `--tag` → exit **2**，`--tag is required`。
- 反证（资产名契约）：`assertAssetName("shadow-dev-cli-latest.tar.gz")` 与 `assertAssetName("shadow-dev-cli-v1.6.0.tgz")` 均抛 `ASSET_NAME_CONTRACT`；`shadow-dev-cli-v1.6.0.tar.gz` 放行。安装器按同一正则找资产，名字写错等于没发布。
- 单实现防回归：新增用例断 `publish.yml` 必须含 `node scripts/publish.mjs --tag` 且**不得**出现 `pack.mjs` / `VERSION_AUTHORITY` / `ASSET_NAME_CONTRACT` —— 断言一旦回拷进 yml 就有第二份实现，判红。
- 套件：`node --test --test-name-pattern publish.mjs` → 2 绿 0 红；`--test-name-pattern publish.yml` → 1 绿 0 红；`--test-name-pattern publish` 全组（含既有 publish 域用例）无回归。
- 门槛：全量套件与 windows/macos/ubuntu × node 20/22/24 矩阵由 `test.yml` 在本 PR 上判定。
- **未覆盖项（明说）**：`upload` 与 `read-back` 两步只在本 PR 合并、下一次真实 `gh release create` 触发 `publish-release` 后才被端到端执行；本轮无法自证（v1.6.0 的资产是我手工补的，正是本 change 要消除的动作）。验证点为：Actions 上 `publish-release` 绿 + `releases/tags/<新 tag>` 的 `assets` 恰有一个合法名资产。
