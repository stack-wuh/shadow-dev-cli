# qwen-tts 配音工具

用阿里云百炼的 TTS 模型把文案变成视频旁白音频。纯 Python 标准库实现（零依赖，3.10+）。
本目录是 shadow-dev-cli 仓的一部分；配音知识卡见 `shadow-docs/knowledge/qwen-tts-voiceover.md`。

## 首次使用

```bash
# 1. Key（二选一；.api_key 已被仓库 .gitignore 忽略，永不入库）
set DASHSCOPE_API_KEY=sk-sp-xxx        # 或写入本目录 .api_key 文件
# 2. 验证
python tts.py sample.txt --name hello
```

## 文件

| 文件 | 用途 |
|------|------|
| `tts.py` | 主工具：合成（Token Plan/百炼双通道按 Key 前缀自动识别）+ 长文案分段 + WAV 头修复 |
| `assemble_track.py` | 整轨拼装：按 `PLACEMENTS` 落点表把各句放置到片长时间轴（当前配置 = 致郭襄 245s 旁白轨）；产物落本目录 `tts-output/`（不入库） |
| `zhi-guo-xiang-poem.txt` | 致郭襄诗六行 TTS 输入原文（逐字定稿） |

## 用法

```bash
python tts.py 文案.txt --voice longanlingxin --name <slug>   # 成品 tts-output/<slug>/final.wav
python tts.py --voices                                        # 音色列表
python tts.py 文案.txt --dry-run                              # 只看分段不烧额度
python assemble_track.py                                      # 重拼整轨（改落点后）
```

## 与分镜的联动

落点起点（`PLACEMENTS`）必须与分镜字幕/音乐对位同步维护，权威记录在 `wuh.site.video` 仓
`shadow-docs/knowledge/tts-voiceover-pipeline.md`；改分镜时长时两处一起改。
