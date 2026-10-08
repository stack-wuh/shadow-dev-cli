---
{
  "schema": "shadow-dev/v1",
  "name": "20261008-fix-ci-bind-tar-harness",
  "type": "fix",
  "scope": "lib,test",
  "status": "reviewed",
  "baseBranch": "main",
  "branch": "fix/20261008-fix-ci-bind-tar-harness",
  "files": [
    "lib/domains/workflow.mjs",
    "shadow-docs/changes/20261008-fix-ci-bind-tar-harness/brief.md",
    "shadow-docs/knowledge/install-distribution.md",
    "test/cli.test.mjs"
  ],
  "github": {
    "repository": "stack-wuh/shadow-dev-cli",
    "issue": 43,
    "issueUrl": "https://github.com/stack-wuh/shadow-dev-cli/issues/43",
    "pullRequest": null,
    "pullRequestUrl": null
  },
  "review": {
    "conclusion": "passed",
    "verifiedCommit": "0b5235a3e39e0113625e91cffc6f031bf2d0013f",
    "verifiedAt": "2026-10-08T04:11:11.436Z"
  },
  "workflow": {
    "operation": null,
    "checkpoint": "issue:43",
    "planHash": "d6cc9b1053621346e2112bd19729854d38f8ae7e6539900201a5511e5821d6d4",
    "updatedAt": null,
    "lastError": null,
    "issuePlan": {
      "title": "[fix] 修复 CI 恒红两条用例：bind 目录序断言与 workflow tar 路径形态",
      "titleRaw": null,
      "supplement": "",
      "body": "## 动机\nmain 自 workflow/bind 域合入后 CI 恒红,与业务无关,全是测试面缺陷：1）bind status 的 managed 数组实际由产品稳定排序（entries .sort() → sidecar 键序 → Object.keys）,断言却写死了创建序 [propose, apply],在所有平台必红；2）workflow release track 用 bash -c 造 tarball 时直传反斜杠 Windows 路径,Git Bash tar 把 \"C:\" 误读为远程主机——install.test.mjs 已有 toUnix 解法,此用例漏用。\n\n## 引用规范\n- shadow-docs/knowledge/install-distribution.md\n  - 当前结论: tar 必须经 bash -c 与安装器同解析路径；Windows 传参先 cygpath 归 POSIX\n  - 适用 scope: test/cli.test.mjs workflow release track 用例\n\n## 决策\n- **选型:** 只改测试面：managed 断言改为产品承诺的字典序；tar 用例复用 toUnix（cygpath -u）转正两处路径参数\n- **对比方案:** 让 managed 回到 readdir 序（产品失去确定性,否决）；跳过用例（掩盖恒红,否决）\n- **理由:** 产品的排序是有意为之的确定性输出,测试应断言契约而非偶然顺序；Windows 路径形态问题与安装器同根,同法同治\n\n## 任务\n### Phase 1 — 复现与修复\n- [ ] bind managed 断言改字典序 — `test/cli.test.mjs` — 现网实际输出序 [apply, propose],断言对齐后全平台绿\n- [ ] workflow tar 用例接 toUnix — `test/cli.test.mjs` — 引 node:os platform + cygpath 归一 asset.tgz/staging 两参\n### Phase 2 — 回归\n- [ ] 全量测试与 CI 三平台复核 — 无 — 本地 87 用例仅剩 0 fail;PR CI bind/tar 两案转绿\n\n完整 brief：shadow-docs/changes/20261008-fix-ci-bind-tar-harness/brief.md\n\n<!-- shadow-dev:issue-metadata {\"name\":\"20261008-fix-ci-bind-tar-harness\",\"type\":\"fix\",\"scope\":\"test\",\"status\":\"proposed\",\"branch\":null,\"baseBranch\":\"main\",\"briefPath\":\"shadow-docs/changes/20261008-fix-ci-bind-tar-harness/brief.md\",\"cliVersion\":\"1.4.0\",\"prUrl\":null,\"issueNumber\":null} -->\n",
      "labels": [
        "fix"
      ]
    },
    "release": {
      "files": [
        "lib/domains/workflow.mjs",
        "shadow-docs/changes/20261008-fix-ci-bind-tar-harness/brief.md",
        "shadow-docs/knowledge/install-distribution.md",
        "test/cli.test.mjs"
      ],
      "message": "fix(ci): bind managed 断言改字典序;workflow 域两处解包统一 bash -c + cygpath——消除三平台恒红用例与 Windows 直 spawn tar 随 PATH 漂移的产品缺陷",
      "title": "fix(ci): 修复 CI 三平台恒红两条用例 + workflow 解包路径漂移",
      "body": "Closes #43\n\n完整 brief：shadow-docs/changes/20261008-fix-ci-bind-tar-harness/brief.md"
    }
  },
  "knowledge": {
    "action": "更新",
    "target": "shadow-docs/knowledge/install-distribution.md",
    "reason": "tar 经 bash -c + cygpath 归一约束从测试扩展到 workflow 域产品链路:直 spawn 在 Windows PATH 漂移下不可靠"
  }
}
---

# 修复 CI 恒红两条用例：bind 目录序断言与 workflow tar 路径形态

## 动机
main 自 workflow/bind 域合入后 CI 恒红,与业务无关,全是测试面缺陷：1）bind status 的 managed 数组实际由产品稳定排序（entries .sort() → sidecar 键序 → Object.keys）,断言却写死了创建序 [propose, apply],在所有平台必红；2）workflow release track 用 bash -c 造 tarball 时直传反斜杠 Windows 路径,Git Bash tar 把 "C:" 误读为远程主机——install.test.mjs 已有 toUnix 解法,此用例漏用。复现还暴露产品层同根缺陷：workflow 域两处 `execFileSync('tar')` 直 spawn——Windows 上 PATH 命中 Git Bash msys tar 时（本机实况）,`--from` tarball 与 release 下载解包全炸；CI runner 恰好直连 System32 bsdtar 才掩盖了差异。

## 引用规范
- shadow-docs/knowledge/install-distribution.md
  - 当前结论: tar 必须经 bash -c 与安装器同解析路径；Windows 传参先 cygpath 归 POSIX
  - 适用 scope: test/cli.test.mjs workflow release track 用例 + lib/domains/workflow.mjs 解包链路

## 决策
- **选型:** managed 断言改为产品承诺的字典序；tar 用例复用 toUnix（cygpath -u）；workflow 域两处解包统一走 bash -c + cygpath 归一,与安装器同形
- **对比方案:** 让 managed 回到 readdir 序（产品失去确定性,否决）；跳过用例（掩盖恒红,否决）；产品继续直 spawn tar（把环境差异推给用户,否决）
- **理由:** 产品的排序是有意为之的确定性输出,测试应断言契约而非偶然顺序；Windows 路径形态问题与安装器同根,同法同治

## 任务
### Phase 1 — 复现与修复
- [x] bind managed 断言改字典序 — `test/cli.test.mjs` — 现网实际输出序 [apply, propose],断言对齐后全平台绿
- [x] workflow tar 用例接 toUnix — `test/cli.test.mjs` — 引 node:os platform + cygpath 归一 asset.tgz/staging 两参
- [x] workflow 域解包与安装器同形 — `lib/domains/workflow.mjs` — 两处 execFileSync(tar) 统一 bash -c + cygpath 归一;消除 msys tar 抢占时 C:\ 形态必炸的环境差异
### Phase 2 — 回归
- [x] 全量测试与 CI 三平台复核 — 无 — 本地 87 用例仅剩 0 fail;PR CI bind/tar 两案转绿

## 补充
纯测试面修复,不动 lib/ 产品代码。
