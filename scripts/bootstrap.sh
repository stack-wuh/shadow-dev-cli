#!/usr/bin/env bash
# bootstrap.sh — shadow 生态一键装机：装 CLI → 拉 workflow 产物 → 绑定宿主 skills
#
# 用法（二选一）：
#   bash bootstrap.sh [host]                       # 本仓库内直接跑
#   curl -fsSL <raw-url-of-this-file> | bash -s [host]   # 远程一条龙（host 缺省 claude-code，原生宿主）
#
# 环境覆盖原样透传给各环节：
#   SD_PREFIX / SD_BIN                  CLI 安装前缀与 shim 位（install-cli.sh）
#   SHADOW_WORKFLOW_PREFIX              workflow 产物前缀（workflow 域）
#   SHADOW_WORKFLOW_HOME                宿主 home 根（bind 域，~/.claude/skills 等由此解析）
set -euo pipefail

TAG="v1.4.0"
HOST="${1:-claude-code}"
BIN="${SD_BIN:-$HOME/.local/bin}"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

step() { printf '\n==> %s\n' "$*"; }

step "1/3 安装 shadow-dev CLI（latest release，双轨 + 托管 shim）"
curl -fsSL "https://raw.githubusercontent.com/stack-wuh/shadow-dev-cli/$TAG/scripts/install-cli.sh" -o "$TMP/install-cli.sh"
bash "$TMP/install-cli.sh" install
SD="$BIN/shadow-dev"
[ -x "$SD" ] || { echo "shim 未生成：$SD" >&2; exit 1; }

planHash() { node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).planHash'; }

step "2/3 物化 shadow-dev-workflow 产物（release tarball → 版本化布局）"
H="$( "$SD" workflow plan --json | planHash )"
"$SD" workflow execute --plan-hash "$H" --confirm

step "3/3 绑定宿主：${HOST}（adapters 描述符驱动，复制 + 托管标记）"
H2="$( "$SD" bind plan --host "$HOST" --json | planHash )"
"$SD" bind execute --host "$HOST" --plan-hash "$H2" --confirm

VER="$( "$SD" workflow status --json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.current' )"
printf '\nshadow 生态就绪：CLI + workflow %s → %s（skills 已绑入，sidecar 可 unbind）\n' "$VER" "$HOST"
