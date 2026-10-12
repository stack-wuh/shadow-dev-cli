#!/usr/bin/env node
// gen-pr-template.mjs —— 生成宿主的 .github/PULL_REQUEST_TEMPLATE.md：逐字复制模板真源，不改写、不折行、不加装饰。
// 模板真源属 shadow-dev-workflow（norms/templates/pr-body.md，结构规则见 norms/pr-message.md）；本仓只负责这一类确定性脚本动作。
// 解析序：--template 显式路径 > 已绑定/已物化的 workflow 产物根（同 `shadow-dev workflow status` 的 resolved：LINK 优先，其次 CURRENT）。
// 用法：node scripts/gen-pr-template.mjs --out <宿主>/.github/PULL_REQUEST_TEMPLATE.md [--template <path>] [--check]
// 退出：0 一致或已生成 · 1 模板缺段/宿主与真源不一致（--check 供门与 CI 用） · 2 参数错误 · 3 找不到模板真源
import fs from 'node:fs';
import path from 'node:path';

function die(code, msg) { console.error('gen-pr-template: ' + msg); process.exit(code); }

const argv = process.argv.slice(2);
let out = '';
let template = '';
let check = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') { out = argv[++i] || ''; continue; }
  if (argv[i] === '--template') { template = argv[++i] || ''; continue; }
  if (argv[i] === '--check') { check = true; continue; }
  die(2, '未知参数：' + argv[i]);
}
if (!out) die(2, '缺少 --out <宿主 .github/PULL_REQUEST_TEMPLATE.md 路径>');

// 模板真源定位：显式路径优先；否则问已物化的 workflow 产物根要
const SRC_REL = ['norms', 'templates', 'pr-body.md'];
async function locate() {
  if (template) {
    if (!fs.existsSync(template)) die(3, '--template 指定的文件不存在：' + path.resolve(template));
    return path.resolve(template);
  }
  try {
    const { resolvedRoot } = await import('../lib/domains/workflow.mjs');
    return path.join(resolvedRoot({}), ...SRC_REL);
  } catch (e) {
    die(3, '未显式给 --template，且本机没有已绑定/已物化的 workflow 产物（' + e.message + '）；用 --template <shadow-dev-workflow>/norms/templates/pr-body.md');
  }
}

const src = await locate();
if (!fs.existsSync(src)) die(3, '模板真源缺失：' + src);
const want = fs.readFileSync(src, 'utf8');
for (const must of ['## 变更', '## 影响', '## 关联']) {
  if (!want.includes(must)) die(1, '模板缺少必需段落：' + must + '（真源：' + src + '）');
}
// 署名尾注只审渲染区（HTML 注释块里的「禁止 Co-authored-by」是规则文字，不是尾注）
const rendered = () => { const i = want.indexOf('-->'); return i < 0 ? want : want.slice(i + 3); };
if (/co-authored-by/i.test(rendered())) die(1, '模板渲染区含署名尾注，违反 norms/pr-message.md 第 5 条：' + src);

const abs = path.resolve(out);
const have = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;

if (check) {
  if (have === null) die(1, '宿主模板不存在，需生成：' + abs);
  if (have !== want) die(1, '宿主模板与真源不一致（以真源为准，重新生成）：' + abs);
  console.log('ok: ' + abs + ' 与 ' + src + ' 一致');
  process.exit(0);
}
if (have === want) { console.log('none: ' + abs + ' 已是最新（源 ' + src + '）'); process.exit(0); }
fs.mkdirSync(path.dirname(abs), { recursive: true });
fs.writeFileSync(abs, want, 'utf8');
console.log('generated: ' + abs + ' (' + Buffer.byteLength(want) + 'B, 源 ' + src + ')');
