# shadow-dev-cli 上下文地图

> 本仓限界上下文与统一语言的登记处（判据见内容包 `norms/domain-model.md`）。
> **domain 值域**＝本页「限界上下文 ∪ 横切实践 ∪ 外部上游」登记的名称；知识卡 `domain` 取值必须落在其中。新上下文先登记再建卡。

## 限界上下文

| 上下文 | 职责 | 上游 / 下游 | 主目录与 scope | 关键术语 |
|---|---|---|---|---|
| `cli-infrastructure` | brief 生命周期、workspace 归属、plan/execute 凭证链、双通道输出面 | ← `workflow-governance`（内容包经能力契约驱动）；→ 三宿主与项目仓 | `cli.mjs`, `lib/`, `test/cli.test.mjs` | brief / frontmatter / planHash / norm / 归属树 / workspace 迁移 / 零 dirty / stdout 契约 |
| `install-distribution` | 执行层自身的安装、shim、指针文件、产物物化与宿主绑定 | ← `workflow-governance` 的产物轨；→ `~/.local/share` 安装态与宿主目录 | `scripts/bootstrap.sh`, `scripts/install-cli.sh`, `scripts/pack.mjs`, `lib/domains/workflow.mjs`, `lib/domains/bind.mjs` | CURRENT/PREVIOUS/LINK 指针 / shim / sidecar / requiresCommands / ARTIFACT_INCOMPATIBLE / missingCommands |
| `github-integration` | GitHub 侧写操作：issue 渲染、PR 复用、合并校验、归档触发 | ← `cli-infrastructure` 的凭证链；→ api.github.com | `lib/github.mjs`, `lib/issue-render.mjs`, `lib/domains/issue.mjs`, `lib/domains/publish.mjs`, `lib/domains/archive.mjs` | issuePlan / bodySha256 / 机器通道 / PR 复用 / PR_NOT_MERGED |

## 横切实践

跨上下文的**方法**而非业务边界：允许登记为 `domain` 值，但不得当限界上下文扩写。

| 名称 | 说明 | 关联 |
|---|---|---|
| （无） | 本仓当前没有横切实践条目；内容包侧的 `debugging` 不在本仓建卡，故不登记 | — |

## 外部上游（本仓不定义其规范语义，只经能力契约被驱动）

| 名称 | 仓库 | 反腐边界 |
|---|---|---|
| `workflow-governance` | `stack-wuh/shadow-dev-workflow` | 依赖单向：**执行层驱动内容包**（`bootstrap → workflow plan/execute → bind plan/execute`）。内容包用 `package.json.requiresCommands` 声明所需命令键，本仓在**任何落盘前**用自身命令目录断言，缺失即 `ARTIFACT_INCOMPATIBLE` 且指针不动；兼容判定用能力名不用版本号；跨仓演进顺序＝本仓先发布支持、内容包随后声明 |

## 术语表增量

- 概念定义唯一来源：内容包 `norms/domain-model.md`；本页只登记归属与关系。
- **归属树 owning tree**：任一时刻决定「按 `--name` 去哪棵树读 brief」的那棵树，主工作区与某 worktree 互斥（详见 `shadow-docs/knowledge/worktree-brief-relocation.md`）。
- **载体豁免 carrier exclusion**：brief 作为 CLI 管理载体不计入工作区脏改动。

## 维护规则

- 新增/改名上下文：先改本页 → 再动卡片 `domain` 与本仓 `shadow-docs/menu.md` → 两侧不一致以本页为准。
- 本页只放长期事实；单次变更过程留在 `shadow-docs/changes/`。
