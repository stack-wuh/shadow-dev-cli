#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen 视频配音工具（支持 标准百炼 / Token Plan 双通道）

用法:
  python tts.py 文案.txt                          # 默认音色，自动识别 Key 类型
  python tts.py 文案.txt --voice Ethan            # 指定音色
  python tts.py --text "你好" --name demo         # 直接传文本
  python tts.py 文案.txt --dry-run                # 只看分段方案，不调 API
  python tts.py --voices                          # 列出音色

Key 自动识别:
  sk-sp-xxx  -> Token Plan 专属端点（qwen-audio-3.0-tts-plus）
  sk-xxx     -> 百炼通用端点（qwen3-tts-flash）
也可用 --plan standard|token 强制指定。

输出: <输出目录>/final.wav（整段合并）+ segments/chunk_*.wav（分段原件）
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

# ---- 端点 ----
STANDARD_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
TOKEN_PLAN_HOSTS = {
    "cn-beijing": "https://token-plan.cn-beijing.maas.aliyuncs.com",
    "ap-southeast-1": "https://token-plan.ap-southeast-1.maas.aliyuncs.com",
}
TOKEN_TTS_PATH = "/api/v1/services/audio/tts/SpeechSynthesizer"

DEFAULT_MODEL_STANDARD = "qwen3-tts-flash"
DEFAULT_MODEL_TOKEN = "qwen-audio-3.0-tts-plus"

MAX_CHARS = 480  # API 上限 600 字符，留安全余量
SENT_DELIMS = "。！？!?；;"

# ---- 音色列表 ----
# 标准端点 qwen3-tts-flash: https://help.aliyun.com/zh/model-studio/qwen-tts-voice-list
VOICES_STANDARD = {
    "标准音色（qwen3-tts-flash，普通话+多语种）": [
        ("Cherry", "芊悦", "女", "阳光积极、亲切自然小姐姐"),
        ("Serena", "苏瑶", "女", "温柔小姐姐"),
        ("Ethan", "晨煦", "男", "阳光温暖有朝气，带点北方口音"),
        ("Chelsie", "千雪", "女", "二次元虚拟女友"),
        ("Moon", "月白", "男", "率性帅气"),
        ("Maia", "四月", "女", "知性与温柔的碰撞"),
        ("Kai", "凯", "男", "耳朵的一场SPA"),
        ("Jennifer", "詹妮弗", "女", "品牌级、电影质感美语女声"),
        ("Ryan", "甜茶", "男", "节奏拉满，戏感炸裂"),
        ("Eldric Sage", "沧明子", "男", "沉稳睿智的老者"),
        ("Bellona", "燕铮莺", "女", "声音洪亮、吐字清晰，江湖评书风"),
        ("Vincent", "田叔", "男", "沙哑烟嗓，江湖豪情"),
        ("Neil", "阿闻", "男", "专业新闻主持人风格"),
        ("Elias", "墨讲师", "女", "学科严谨、擅长知识讲解"),
        ("Arthur", "徐大爷", "男", "质朴嗓音，讲奇闻异事"),
        ("Andre", "安德雷", "男", "声音磁性、沉稳"),
    ],
}
# Token Plan qwen-audio-3.0-tts-plus: 音色以 CosyVoice 列表为准
# https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
VOICES_TOKEN = {
    "Token Plan（qwen-audio-3.0-tts-plus，CosyVoice 音色）": [
        ("longanhuan_v3.6", "龙安欢", "—", "官方文档示例音色（已验证可用）"),
    ],
}


def say(msg: str) -> None:
    print(msg, flush=True)


def load_api_key(cli_value: str | None) -> str | None:
    if cli_value:
        return cli_value
    env = os.environ.get("DASHSCOPE_API_KEY")
    if env:
        return env.strip() or None
    keyfile = Path(__file__).parent / ".api_key"
    if keyfile.exists():
        content = keyfile.read_text(encoding="utf-8").strip()
        if content:
            return content
    return None


def chunk_text(text: str, limit: int = MAX_CHARS) -> list[str]:
    """把长文案切成 <=limit 字符的分段，尽量在句号等处断开。"""
    parts = re.split(rf"([{SENT_DELIMS}\n])", text)
    sentences: list[str] = []
    for p in parts:
        if not p:
            continue
        if sentences and len(p) == 1 and p in SENT_DELIMS + "\n":
            sentences[-1] += p
        else:
            sentences.append(p)

    chunks: list[str] = []
    buf = ""
    for raw in sentences:
        s = raw.strip("\n")
        if not s:
            continue
        while len(s) > limit:  # 单句超限：硬切
            if buf:
                chunks.append(buf)
                buf = ""
            chunks.append(s[:limit])
            s = s[limit:]
        if not s:
            continue
        if len(buf) + len(s) <= limit:
            buf += s
        else:
            if buf:
                chunks.append(buf)
            buf = s
    if buf:
        chunks.append(buf)
    return [c.strip() for c in chunks if c.strip()]


def candidate_urls(plan: str, region: str) -> list[str]:
    """按优先级排列的候选端点。"""
    if plan == "token":
        others = [r for r in TOKEN_PLAN_HOSTS if r != region]
        return [TOKEN_PLAN_HOSTS[region] + TOKEN_TTS_PATH] + [
            TOKEN_PLAN_HOSTS[r] + TOKEN_TTS_PATH for r in others
        ]
    return [STANDARD_API_URL]


def synthesize(text: str, voice: str, lang: str, model: str, api_key: str,
               plan: str, region: str, sample_rate: int,
               retries: int = 3) -> tuple[str, dict]:
    """调用 API 合成一段文本，返回 (音频下载 URL, usage)。"""
    if plan == "token":
        payload = {"model": model, "input": {
            "text": text, "voice": voice,
            "format": "wav", "sample_rate": sample_rate,
        }}
    else:
        payload = {"model": model, "input": {"text": text, "voice": voice}}
        if lang and lang.upper() != "AUTO":
            payload["input"]["language_type"] = lang

    urls = candidate_urls(plan, region)
    last_err = ""
    for attempt in range(1, retries + 1):
        for url in list(urls):
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=60) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                audio = body.get("output", {}).get("audio", {})
                link = audio.get("url")
                if not link:
                    raise RuntimeError(f"响应中没有音频 URL: {json.dumps(body, ensure_ascii=False)[:200]}")
                if url != urls[0]:  # 换到可用端点，优先使用
                    urls.insert(0, urls.pop(urls.index(url)))
                return link, body.get("usage", {})
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")
                if e.code in (401, 403):
                    raise RuntimeError(f"Key 无效或无权限 (HTTP {e.code}): {detail[:300]}")
                last_err = f"HTTP {e.code}: {detail[:200]}"
                if len(urls) > 1:
                    say(f"    端点不可用，尝试下一个…")
                    continue
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
        if attempt < retries:
            wait = 2 ** attempt
            say(f"    第 {attempt} 次失败（{last_err[:100]}），{wait}s 后重试…")
            time.sleep(wait)
    raise RuntimeError(f"合成失败: {last_err}")


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "qwen-tts-tool/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def sniff_audio_ext(data: bytes) -> str:
    if data[:4] == b"RIFF":
        return "wav"
    if data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0):
        return "mp3"
    if data[:4] == b"OggS":
        return "ogg"
    return "bin"


def is_valid_wav(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnframes() > 0
    except Exception:  # noqa: BLE001
        return False


def sanitize_wav(path: Path) -> float:
    """服务端返回的 WAV 头里帧数是占位错误值，重写头部并返回真实时长（秒）。"""
    with wave.open(str(path), "rb") as w:
        params = w.getparams()
        data = w.readframes(w.getnframes())
    with wave.open(str(path), "wb") as w:
        w.setparams(params)
        w.writeframes(data)
    bytes_per_frame = params.nchannels * params.sampwidth
    return len(data) / (bytes_per_frame * params.framerate)


def merge_wavs(paths: list[Path], out_path: Path) -> float:
    """纯 Python 拼接同参数 WAV，返回时长（秒）。"""
    params = None
    with wave.open(str(out_path), "wb") as out:
        for p in paths:
            with wave.open(str(p), "rb") as w:
                cur = w.getparams()
                if params is None:
                    params = cur
                    out.setparams(params)
                elif cur[:3] != params[:3]:
                    raise RuntimeError(f"音频参数不一致，无法合并: {p.name}")
                out.writeframes(w.readframes(w.getnframes()))
    with wave.open(str(out_path), "rb") as w:
        return w.getnframes() / w.getframerate()


def print_voices() -> None:
    say("音色列表（voice 参数即 --voice 的值）\n")
    for table in (VOICES_TOKEN, VOICES_STANDARD):
        for group, rows in table.items():
            say(f"== {group} ==")
            for vid, cn, gender, desc in rows:
                say(f"  {vid:<18} {cn:<10} {gender}  {desc}")
            say("")


def main() -> int:
    parser = argparse.ArgumentParser(description="Qwen 视频配音工具（标准百炼 / Token Plan）")
    parser.add_argument("input", nargs="?", help="文案 txt 文件路径（UTF-8）")
    parser.add_argument("--text", help="直接传文案文本（与 input 二选一）")
    parser.add_argument("--voice", default=None, help="音色，默认按通道取官方推荐")
    parser.add_argument("--model", default=None, help="模型，默认按通道自动选择")
    parser.add_argument("--plan", choices=["auto", "standard", "token"], default="auto",
                        help="通道：auto=按 Key 前缀识别（默认）")
    parser.add_argument("--region", choices=list(TOKEN_PLAN_HOSTS), default="cn-beijing",
                        help="Token Plan 地域，默认 cn-beijing（不可用会自动尝试另一个）")
    parser.add_argument("--lang", default="Auto", help="语种（仅 standard 通道生效）")
    parser.add_argument("--sample-rate", type=int, default=44100, help="采样率（仅 token 通道）")
    parser.add_argument("--name", help="输出子目录名，默认取文案文件名")
    parser.add_argument("--out", default="tts-output", help="输出目录，默认 ./tts-output")
    parser.add_argument("--api-key", help="API Key（默认读环境变量或 .api_key 文件）")
    parser.add_argument("--limit", type=int, default=MAX_CHARS, help=f"单段字符上限，默认 {MAX_CHARS}")
    parser.add_argument("--dry-run", action="store_true", help="只显示分段方案，不实际调用")
    parser.add_argument("--voices", action="store_true", help="列出音色并退出")
    args = parser.parse_args()

    if args.voices:
        print_voices()
        return 0

    if args.text:
        text = args.text
        default_name = "clip"
    elif args.input:
        p = Path(args.input)
        if not p.exists():
            say(f"错误: 文件不存在 {p}")
            return 1
        text = p.read_text(encoding="utf-8")
        default_name = p.stem
    else:
        parser.print_help()
        return 1

    api_key = load_api_key(args.api_key)
    if not api_key:
        say("\n错误: 找不到 API Key。两种方式任选：")
        say("  1. 设置环境变量   set DASHSCOPE_API_KEY=sk-xxx")
        say("  2. 把 Key 存到   " + str(Path(__file__).parent / ".api_key"))
        return 1

    # 通道识别
    if args.plan != "auto":
        plan = args.plan
    else:
        plan = "token" if api_key.startswith("sk-sp-") else "standard"
    model = args.model or (DEFAULT_MODEL_TOKEN if plan == "token" else DEFAULT_MODEL_STANDARD)
    voice = args.voice or ("longanhuan_v3.6" if plan == "token" else "Cherry")

    name = args.name or default_name
    out_dir = Path(args.out) / name
    seg_dir = out_dir / "segments"

    chunks = chunk_text(text, args.limit)
    if not chunks:
        say("错误: 文案为空")
        return 1

    say(f"通道: {plan} | 模型: {model} | 音色: {voice} | 总字数: {len(text)} | 分段: {len(chunks)} 段")
    for i, c in enumerate(chunks, 1):
        say(f"  [{i}] {len(c)} 字 | {c[:24]}…")
    if args.dry_run:
        say("\n(dry-run，未调用 API)")
        return 0

    seg_dir.mkdir(parents=True, exist_ok=True)
    segments: list[Path] = []
    total_chars = 0
    total_duration = 0.0
    start = time.time()
    for i, c in enumerate(chunks, 1):
        say(f"\n[{i}/{len(chunks)}] 合成中（{len(c)} 字）…")
        try:
            url, usage = synthesize(c, voice, args.lang, model, api_key,
                                    plan, args.region, args.sample_rate)
            data = download_bytes(url)
            ext = sniff_audio_ext(data)
            dest = seg_dir / f"chunk_{i:03d}.{ext}"
            dest.write_bytes(data)
            total_chars += usage.get("characters", 0) or 0
            if ext == "wav" and is_valid_wav(dest):
                dur = sanitize_wav(dest)
                total_duration += dur
                segments.append(dest)
                say(f"    完成 -> {dest.name}（{dur:.1f}s）")
            else:
                say(f"    完成 -> {dest.name}（非 WAV，跳过合并）")
        except RuntimeError as e:
            say(f"    失败: {e}")
            return 2

    final = out_dir / "final.wav"
    if segments and len(segments) == len(chunks):
        try:
            if len(segments) == 1:
                final.write_bytes(segments[0].read_bytes())
            else:
                final.parent.mkdir(parents=True, exist_ok=True)
                total_duration = merge_wavs(segments, final)
            say(f"\n✅ 完成: {final}")
            say(f"   时长 {total_duration:.1f}s | 大小 {final.stat().st_size / 1024 / 1024:.1f}MB")
        except RuntimeError as e:
            say(f"\n合并失败: {e}\n分段文件仍在 {seg_dir}，可手工处理")
            return 2
    else:
        say(f"\n⚠️ 有分段未成功或格式不支持合并，成品请看 {seg_dir}")

    if total_chars:
        say(f"   计费字符: {total_chars} | 耗时 {time.time() - start:.1f}s")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass
    sys.exit(main())
