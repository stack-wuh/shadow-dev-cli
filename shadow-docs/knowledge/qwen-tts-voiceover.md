---
title: Qwen TTS 视频配音产出管线（Token Plan）
domain: media-tts
keywords: [TTS, 语音合成, 配音, 音频, 音色, qwen-audio-3.0-tts-plus, Token Plan, sk-sp-, 百炼, DashScope, SpeechSynthesizer, longanhuan, final.wav, WAV 头, 采样率, 分段拼接, InvalidApiKey]
scope: [D:/works/qwen-tts]
status: active
source:
  - qwen-tts 仓（D:/works/qwen-tts）的 tts.py 与 README.md（仓外工具，无 brief——20261104 会话驱动的一次性产出）
  - 阿里云百炼官方文档「Token Plan 接入语音合成模型」（help.aliyun.com/zh/model-studio/token-plan-speech-synthesis）
verified: 2026-11-04
verified-depth: runtime
verified-scope: 北京 Token Plan 端点（sk-sp- Key）实调 `qwen-audio-3.0-tts-plus` + `longanhuan_v3.6` 出 5.1s / 44.1kHz / 16bit / mono WAV，`wave` 模块回读头字段自洽；通用端点对 sk-sp- Key 恒 401 InvalidApiKey 实证
---

# Qwen TTS 视频配音产出管线（Token Plan）

## 当前结论

视频配音走 **Token Plan 订阅通道**而非百炼通用通道。`sk-sp-` 前缀 Key 必须配专属端点：TTS 调 `POST https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`（备用地域 `ap-southeast-1`），模型 `qwen-audio-3.0-tts-plus`，请求体 `{model, input: {text, voice, format, sample_rate}}`；响应 `output.audio.url`（有时效）+ `usage.characters`（计费）。**Key 与 Base URL 必须配对**：`sk-sp-` Key 在通用端点 `dashscope.aliyuncs.com` 上恒 401 `InvalidApiKey`（20261104 实证），三套计费体系（订阅 Credits / 免费额度 / 按量）凭证完全隔离。音色属 **CosyVoice 体系**（如 `longanhuan_v3.6` 龙安欢，已验证可用），与 qwen3-tts-flash 的 Cherry/Ethan 体系**互不通用**。单请求文本上限 600 字符。工具载体为仓外 `D:\works\qwen-tts\tts.py`（Python 3.10 标准库零依赖单文件），Key 存同目录 `.api_key`；按 Key 前缀自动选通道；长文案按句切 ≤480 字分段合成后纯 Python 拼接，成品 `tts-output/<name>/final.wav`（44.1kHz / 16bit / mono，可直接进剪辑软件）。

## 执行约束

- 端点/模型/音色三者在 Token Plan 与标准通道不可混搭；换通道用 `--plan standard|token` 强制或换对应 Key。
- **服务端返回的 WAV 头 nframes 是占位错误值**（实测 2^30，5 秒音频被标成 ~6.8 小时）——任何落盘/合并前必须重写头（`tts.py` 的 `sanitize_wav`），否则播放器与剪辑软件时长错乱。
- 音频 URL 有时效（约 24h），合成后必须**立即下载落盘**，不得把 URL 当持久产物引用。
- `format`/`sample_rate` 显式传 `wav`/`44100`（面向视频剪辑的规格）；换 mp3 等格式会破坏纯 Python 的 WAV 拼接路径。
- 计费按 `usage.characters`（实测 28 字文案计 53 字符，与输入字数不同源），批量出片前先 `--dry-run` 看分段、用短文案试音色再跑全篇。

## 适用边界

适用于为视频/博客内容产出配音音频的任何任务。不适用于 shadow-dev-cli 本体代码——本卡是横切实践（方法沉淀），工具本体在仓外 `D:\works\qwen-tts`，不进本仓 scope；工具演进（新音色、克隆、VD 音色设计）直接改仓外工具并在本卡更新结论。

## 验证方式

`cd D:\works\qwen-tts && python tts.py --text "<约 25 字>" --name test`：产出 `final.wav` 后用 `wave` 模块回读，断言 `nframes/framerate` 折算时长 ≈ 实际朗读时长（基准 5.1s）且参数为 44100Hz/16bit/mono。通道识别断言：`sk-sp-` Key 走 token 通道（日志首行 `通道: token`）。
