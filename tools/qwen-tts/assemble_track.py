#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《风陵 · 致郭襄》旁白整轨拼装
245s 人声轨（44.1kHz/16bit/mono），按落点表把各句放置到时间轴，其余为静音。
BGM 不混入——人声轨与 BGM 各占一路，由装配层 mux。
"""

import sys
import wave
from pathlib import Path

SR = 44100
TOTAL_S = 245.0
BASE = Path(__file__).resolve().parent / "tts-output"  # 相对本脚本，换机/换盘符无需改动

# (相对路径, 落点起点秒, 说明)
PLACEMENTS = [
    ("zgx-aud-lufeng/final.wav", 4.0, "男 S01 念念，我想给你讲一个故事。"),
    ("zgx-l1/final.wav", 189.0, "女 L1 我走过山时，山不说话，"),
    ("zgx-l2/final.wav", 191.6, "女 L2 我路过海时，海不说话，"),
    ("zgx-l3/final.wav", 196.0, "女 L3 小毛驴滴滴答答"),
    ("zgx-l4/final.wav", 215.0, "女 L4 大家都说我因为爱着杨过大侠"),
    ("zgx-l5/final.wav", 228.5, "女 L5 其实我只是爱上了峨嵋山上的云和霞，"),
    ("zgx-l6/final.wav", 235.0, "女 L6 像极了十六岁那年的烟花。"),
    ("zgx-aud-lufeng-end/final.wav", 239.5, "男 S38 这个故事，我讲完了，念念~"),
]

OUT = BASE / "voice-track" / "voice-track-full.wav"


def read_wav(path: Path) -> bytes:
    with wave.open(str(path), "rb") as w:
        if w.getframerate() != SR or w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise RuntimeError(f"参数不符 44.1k/16bit/mono: {path}")
        return w.readframes(w.getnframes())


def main() -> int:
    total_frames = int(TOTAL_S * SR)
    buf = bytearray(total_frames * 2)  # 16bit mono 静音底

    occupied = []
    for rel, start_s, desc in PLACEMENTS:
        data = read_wav(BASE / rel)
        n_frames = len(data) // 2
        start_f = int(start_s * SR)
        end_s = start_s + n_frames / SR
        if start_f + n_frames > total_frames:
            raise RuntimeError(f"超出片尾: {rel}")
        for a, b in occupied:
            if start_f < b and a < start_f + n_frames:
                raise RuntimeError(f"重叠: {rel} 与已有片段冲突")
        occupied.append((start_f, start_f + n_frames))
        buf[start_f * 2 : start_f * 2 + len(data)] = data
        print(f"  {start_s:>6.1f}s – {end_s:>6.1f}s  {desc}  ({n_frames / SR:.1f}s)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(buf))

    with wave.open(str(OUT), "rb") as w:
        dur = w.getnframes() / w.getframerate()
    print(f"\n✅ 整轨: {OUT}")
    print(f"   时长 {dur:.1f}s | 大小 {OUT.stat().st_size / 1024 / 1024:.1f}MB | 人声 {sum(b - a for a, b in occupied) / SR:.1f}s")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
