#!/usr/bin/env bash
# install-cli.sh — shadow-dev CLI 的拉取/更新/回滚安装器（供 shadow-dev-workflow 插件钩子与人工共用）
#
# 接缝契约（与 README「安装与分发」同源）：
#   commands: install | update(=install) | rollback | status | link <path> | unlink
#   options : --channel release|main  --version vA.B.C  --from <tarball|dir>
#             --prefix DIR(~/.local/share/shadow-dev-cli)  --bin DIR(~/.local/bin)
#             --force  --dry-run  --json(单行机器输出)
#   exit    : 0 成功/已最新 | 1 参数或冲突 | 2 网络/API | 3 产物/目标自校验失败
#   布局    : $PREFIX/shadow-dev-cli-<ver>/{cli.mjs,lib,...}；CURRENT/PREVIOUS 为版本指针文本文件；
#             $PREFIX/LINK 为开发直通指针（存在即 shim 最高优先，指向含 cli.mjs 的仓库目录绝对路径）；
#             $BIN/shadow-dev(.cmd) 为托管 shim（头标 managed-by，运行时 LINK→CURRENT 两段解析 → 更新不动 shim）
#   双轨语义: release 轨（插件钩子/物化/回滚）与 link 轨（装一次、代码即改即生效）互不覆盖；unlink 回 release 轨
#   信任边界: release 轨 HTTPS + GitHub 仓库；link 轨目标为用户显式给出的本机目录，落指针前同样冒烟；
#             发布前自校验（node cli.mjs help --json 断言 ok）失败则指针不动
set -euo pipefail

REPO_SLUG="stack-wuh/shadow-dev-cli"
API="https://api.github.com/repos/$REPO_SLUG"
WEB="https://github.com/$REPO_SLUG"
MARK="managed-by: shadow-dev-cli-installer"

CMD="install"; CHANNEL="release"; VERSION=""; FROM=""; LINK_TARGET=""; FORCE=0; DRY=0; JSON=0
PREFIX="${SD_PREFIX:-$HOME/.local/share/shadow-dev-cli}"
BIN="${SD_BIN:-$HOME/.local/bin}"

json() { if [ "$JSON" -eq 1 ]; then printf '%s\n' "$1"; fi; }
log()  { if [ "$JSON" -ne 1 ]; then printf '%s\n' "$1"; fi; }
die() { # die <exit> <error> <message>
  json "{\"ok\":false,\"error\":\"$2\",\"message\":\"$3\"}"
  printf '%s: %s\n' "$2" "$3" >&2 || true
  exit "$1"
}

while [ $# -gt 0 ]; do
  case "$1" in
    install|update|rollback|status|link|unlink) CMD="$1"; shift
    ;;
    --channel) [ $# -ge 2 ] || die 1 usage "--channel needs release|main"; CHANNEL="$2"; shift 2
    ;;
    --version) [ $# -ge 2 ] || die 1 usage "--version needs vA.B.C"; VERSION="$2"; shift 2
    ;;
    --from) [ $# -ge 2 ] || die 1 usage "--from needs <tarball|dir>"; FROM="$2"; shift 2
    ;;
    --prefix) [ $# -ge 2 ] || die 1 usage "--prefix needs DIR"; PREFIX="$2"; shift 2
    ;;
    --bin) [ $# -ge 2 ] || die 1 usage "--bin needs DIR"; BIN="$2"; shift 2
    ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRY=1; shift ;;
    --json) JSON=1; shift ;;
    *) if [ "$CMD" = link ] && [ -z "$LINK_TARGET" ]; then LINK_TARGET="$1"; shift; else die 1 usage "unknown argument: $1"; fi ;;
  esac
done

command -v node >/dev/null || die 1 missing-node "node is required (>=20)"
if [ "$CMD" = install ] || [ "$CMD" = update ]; then
  if [ -n "$FROM" ] && { [ -n "$VERSION" ] || [ "$CHANNEL" = main ]; }; then die 1 usage "--from conflicts with --version/--channel main"; fi
  if [ "$CHANNEL" = main ] && [ -n "$VERSION" ]; then die 1 usage "--version conflicts with --channel main"; fi
fi

# ---- 依赖与工具 ----
DL() { # DL <url> <out>：curl 优先，wget 兜底，带可选 token
  local hdr=()
  [ -n "${GITHUB_TOKEN:-}${GH_TOKEN:-}" ] && hdr=(-H "Authorization: Bearer ${GITHUB_TOKEN:-$GH_TOKEN}")
  if command -v curl >/dev/null; then
    curl -fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: shadow-dev-installer" ${hdr[@]+"${hdr[@]}"} -o "$2" "$1"
  elif command -v wget >/dev/null; then
    wget -q ${hdr[@]+"${hdr[@]}"} -O "$2" "$1"
  else
    return 127
  fi
}
verof() { node -pe "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version" "$1/package.json"; }

# ---- 托管 shim：运行时 LINK→CURRENT 两段解析；任何更新/切换都不动 shim 文件 ----
shim_guard() {
  for f in "$BIN/shadow-dev" "$BIN/shadow-dev.cmd"; do
    [ -e "$f" ] || continue
    grep -q "$MARK" "$f" 2>/dev/null || die 1 unmanaged-shim "unmanaged file occupies shim path: $f — rename it or pass --bin elsewhere (never overwriting silently)"
  done
}
gen_shims() {
  mkdir -p "$BIN"
  {
    echo '#!/bin/sh'
    echo "# $MARK v2 — generated file, regenerate via install-cli.sh, do not edit"
    echo "root='$PREFIX'"
    echo 'if [ -f "$root/LINK" ]; then exec node "$(cat "$root/LINK")/cli.mjs" "$@"; fi'
    echo "v=\$(cat \"\$root/CURRENT\" 2>/dev/null)"
    echo "if [ -z \"\$v\" ]; then echo 'shadow-dev: not installed — run install-cli.sh install' >&2; exit 1; fi"
    echo "exec node \"\$root/shadow-dev-cli-\$v/cli.mjs\" \"\$@\""
  } > "$BIN/shadow-dev"
  chmod +x "$BIN/shadow-dev"
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*)
      WINROOT="$PREFIX"
      if command -v cygpath >/dev/null; then WINROOT="$(cygpath -w "$PREFIX")"; fi
      {
        echo '@echo off'
        echo "rem $MARK v2 — generated file, regenerate via install-cli.sh, do not edit"
        echo "set \"ROOT=$WINROOT\""
        echo 'set "L="'
        echo 'if exist "%ROOT%\LINK" set /p L=<"%ROOT%\LINK"'
        echo 'if not defined L goto materialized'
        echo 'node "%L%\cli.mjs" %*'
        echo 'exit /b %errorlevel%'
        echo ':materialized'
        echo 'set /p V=<"%ROOT%\CURRENT"'
        echo 'if "%V%"=="" (echo shadow-dev: not installed 1>&2 & exit /b 1)'
        echo 'node "%ROOT%\shadow-dev-cli-%V%\cli.mjs" %*'
      } > "$BIN/shadow-dev.cmd"
    ;;
  esac
}

# ---- 锁（陈旧>10min 自动接管）----
LOCK="$PREFIX/.lock"
mkdir -p "$PREFIX"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then rm -rf "$LOCK"; mkdir "$LOCK" || die 1 busy "cannot acquire lock";
  else die 1 busy "another install-cli run is in progress ($LOCK)"; fi
fi
trap 'rm -rf "$LOCK" 2>/dev/null || true' EXIT

# ---- 离线命令先行：rollback/status 不触网、不解析远端 ----
CUR="$(cat "$PREFIX/CURRENT" 2>/dev/null || true)"
if [ "$CMD" = rollback ]; then
  PREV="$(cat "$PREFIX/PREVIOUS" 2>/dev/null || true)"
  [ -n "$PREV" ] && [ -d "$PREFIX/shadow-dev-cli-$PREV" ] || die 1 no-rollback "no previous version available"
  printf '%s\n' "$CUR" > "$PREFIX/PREVIOUS"; printf '%s\n' "$PREV" > "$PREFIX/CURRENT"
  json "{\"ok\":true,\"action\":\"rollback\",\"current\":\"$PREV\",\"previous\":\"${CUR:-null}\"}"
  log "rolled back: $CUR -> $PREV"
  exit 0
fi
if [ "$CMD" = status ]; then
  PRV="$(cat "$PREFIX/PREVIOUS" 2>/dev/null || true)"
  LNK="$(cat "$PREFIX/LINK" 2>/dev/null || true)"
  json "{\"ok\":true,\"current\":\"${CUR:-null}\",\"previous\":\"${PRV:-null}\",\"linked\":\"$(printf '%s' "${LNK:-null}" | sed 's/\\/\\\\/g')\"}"
  log "current=${CUR:-<none>} previous=${PRV:-<none>} linked=${LNK:-<none>}"
  exit 0
fi

# ---- link 轨：shim 一次性映射到含 cli.mjs 的仓库目录，代码即改即生效；不触网 ----
if [ "$CMD" = link ]; then
  [ -n "$LINK_TARGET" ] || die 1 usage "link needs <path>"
  [ -d "$LINK_TARGET" ] || die 1 bad-target "link target is not a directory: $LINK_TARGET"
  { [ -f "$LINK_TARGET/cli.mjs" ] && [ -f "$LINK_TARGET/package.json" ]; } || die 3 artifact "link target lacks cli.mjs/package.json: $LINK_TARGET"
  node "$LINK_TARGET/cli.mjs" help --json 2>/dev/null | grep -q '"ok":true' || die 3 selfcheck "link target failed 'help --json' smoke test"
  LINKV="$LINK_TARGET"
  if command -v cygpath >/dev/null; then LINKV="$(cygpath -w "$LINK_TARGET")"; fi
  shim_guard
  printf '%s\n' "$LINKV" > "$PREFIX/LINK"
  gen_shims
  "$BIN/shadow-dev" help 2>/dev/null | grep -q '"ok":true' || die 3 selfcheck "linked shim failed smoke test"
  json "{\"ok\":true,\"action\":\"link\",\"linked\":\"$(printf '%s' "$LINKV" | sed 's/\\/\\\\/g')\",\"shim\":\"$(printf '%s' "$BIN/shadow-dev" | sed 's/\\/\\\\/g')\"}"
  log "shadow-dev linked to $LINKV (takes priority over the release track; run unlink to restore)"
  exit 0
fi
if [ "$CMD" = unlink ]; then
  [ -f "$PREFIX/LINK" ] || die 1 no-link "no LINK pointer to remove (not linked)"
  rm -f "$PREFIX/LINK"
  json '{"ok":true,"action":"unlink"}'
  log "unlinked; shims fall back to the release track (CURRENT)"
  exit 0
fi

# ---- 解析目标版本与物化产物（release/main/--from 三路同构：得到 WORK 目录 + VER）----
WORK=""; VER=""; TMP=""
if [ -n "$FROM" ]; then
  if [ -d "$FROM" ]; then
    [ -f "$FROM/cli.mjs" ] && [ -f "$FROM/package.json" ] || die 3 artifact "--from dir lacks cli.mjs/package.json"
    WORK="$FROM"
  else
    command -v tar >/dev/null || die 1 missing-tar "tar is required for tarball install"
    TMP="$(mktemp -d)"; trap 'rm -rf "$LOCK" "$TMP" 2>/dev/null || true' EXIT
    tar -xzf "$FROM" -C "$TMP"
    WORK="$TMP/shadow-dev-cli"
    [ -f "$WORK/cli.mjs" ] && [ -f "$WORK/package.json" ] || die 3 artifact "tarball lacks shadow-dev-cli/cli.mjs (invalid artifact)"
  fi
  VER="$(verof "$WORK")"
elif [ "$CHANNEL" = main ]; then
  command -v git >/dev/null || die 1 missing-git "git is required for --channel main"
  TMP="$(mktemp -d)"; trap 'rm -rf "$LOCK" "$TMP" 2>/dev/null || true' EXIT
  git clone --quiet --depth 1 "$WEB" "$TMP/clone" 2>/dev/null || die 2 network "git clone failed (check network/credentials)"
  SHA="$(git -C "$TMP/clone" rev-parse --short=8 HEAD)"
  WORK="$TMP/clone"; VER="$(verof "$WORK")-main.$SHA"
else
  command -v tar >/dev/null || die 1 missing-tar "tar is required"
  API_PATH=$([ -n "$VERSION" ] && echo "/releases/tags/$VERSION" || echo "/releases/latest")
  TMP="$(mktemp -d)"; trap 'rm -rf "$LOCK" "$TMP" 2>/dev/null || true' EXIT
  DL "$API$API_PATH" "$TMP/rel.json" || die 2 network "GitHub API request failed ($API$API_PATH)"
  URL="$(node -e '
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    const a = (j.assets || []).find(x => /^shadow-dev-cli-v[0-9][0-9.]*\.tar\.gz$/.test(x.name))
    if (!a) process.exit(1)
    console.log(a.browser_download_url)
  ' "$TMP/rel.json")" || die 2 network "release asset not found"
  case "$URL" in *tar.gz) ;; *) die 2 network "malformed asset url: $URL" ;; esac
  VER="$(node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tag_name.replace(/^v/,"")' "$TMP/rel.json")"
  DL "$URL" "$TMP/artifact.tgz" || die 2 network "artifact download failed"
  tar -xzf "$TMP/artifact.tgz" -C "$TMP"
  WORK="$TMP/shadow-dev-cli"
  [ -f "$WORK/cli.mjs" ] && [ -f "$WORK/package.json" ] || die 3 artifact "extracted artifact lacks cli.mjs (invalid)"
fi
[ "$(verof "$WORK")" = "${VER%%-main.*}" ] || die 3 artifact "version mismatch between tag and package.json"

if [ "$CUR" = "$VER" ] && [ -d "$PREFIX/shadow-dev-cli-$VER" ] && [ "$FORCE" -eq 0 ]; then
  json "{\"ok\":true,\"action\":\"none\",\"version\":\"$VER\"}"; exit 0
fi

# ---- 冲突保护：非托管同名 shim 在任何写盘前失败退出 ----
shim_guard
if [ "$DRY" -eq 1 ]; then
  json "{\"ok\":true,\"action\":\"dry-run\",\"version\":\"$VER\",\"current\":\"${CUR:-null}\",\"prefix\":\"$PREFIX/shadow-dev-cli-$VER\"}"
  log "dry-run: would install $VER to $PREFIX/shadow-dev-cli-$VER and refresh shims in $BIN"
  exit 0
fi

# ---- 物化 + 自校验（发布前，失败指针不动）----
DEST="$PREFIX/shadow-dev-cli-$VER"
rm -rf "$DEST"; mkdir -p "$DEST"
cp -r "$WORK/." "$DEST/"
node "$DEST/cli.mjs" help --json 2>/dev/null | grep -q '"ok":true' || { rm -rf "$DEST"; die 3 selfcheck "installed cli.mjs failed 'help --json' smoke test"; }

# ---- 原子发布：切指针，保留上一版供回滚，清理更旧版本 ----
[ -n "$CUR" ] && [ "$CUR" != "$VER" ] && printf '%s\n' "$CUR" > "$PREFIX/PREVIOUS"
printf '%s\n' "$VER" > "$PREFIX/CURRENT"
PRV="$(cat "$PREFIX/PREVIOUS" 2>/dev/null || true)"
for d in "$PREFIX"/shadow-dev-cli-*; do
  [ -d "$d" ] || continue
  b="$(basename "$d")"
  [ "$b" = "shadow-dev-cli-$VER" ] && continue
  [ "$b" = "shadow-dev-cli-$PRV" ] && continue
  rm -rf "$d"
done

# ---- 托管 shim：LINK→CURRENT 两段解析（生成逻辑与 link 共用）----
gen_shims

# ---- 安装后冒烟 + PATH 提示 ----
"$BIN/shadow-dev" help 2>/dev/null | grep -q '"ok":true' || die 3 selfcheck "installed shim failed smoke test"
case ":$PATH:" in *":$BIN:"*) ;; *) log "warn: $BIN is not on PATH — add it (unix: export PATH=\"$BIN:\$PATH\"; windows setx PATH \"%PATH%;%USERPROFILE%\.local\\bin\")" ;; esac

json "{\"ok\":true,\"action\":\"install\",\"version\":\"$VER\",\"previous\":\"${CUR:-null}\",\"prefix\":\"$PREFIX\",\"shim\":\"$BIN/shadow-dev\"}"
log "shadow-dev $VER installed to $DEST (was: ${CUR:-none})"
