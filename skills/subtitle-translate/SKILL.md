# 字幕翻译助手

Translate subtitle files while preserving timing, cue order, and structure. Use when Codex needs to translate `.srt` subtitles, produce Chinese subtitles from foreign-language subtitles, or generate bilingual subtitles with original and translated text in each cue. This skill is appropriate when the user asks to translate subtitles for movies, TV, anime, or downloaded caption files and wants the output to remain subtitle-player compatible.

## Overview

Use this skill to translate `.srt` subtitle files into Chinese while keeping timestamps and cue boundaries intact. Prefer the bundled script for repeatable work because it parses cues deterministically and only asks the model to translate dialogue text.

## Workflow

1. Confirm the input is an `.srt` file. If the user provides another subtitle format, convert it first or explain that this skill currently targets `.srt`.
2. Decide the output mode:
   - translated-only Chinese subtitles
   - bilingual subtitles with original text followed by Chinese translation
3. Run `scripts/translate-srt.js` with an OpenAI-compatible API configuration.
4. Validate the output by checking cue count, timestamps, and a few translated samples.

## Quick Start

Set provider environment variables:

```bash
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-4.1-mini
```

Run translated-only output:

```bash
node scripts/translate-srt.js \
  --input /path/to/input.srt \
  --output /path/to/output.zh.srt \
  --target-language zh-CN
```

Run bilingual output:

```bash
node scripts/translate-srt.js \
  --input /path/to/input.srt \
  --output /path/to/output.bilingual.srt \
  --target-language zh-CN \
  --bilingual
```

If the provider uses a custom endpoint, also set `OPENAI_BASE_URL`. See `references/provider-config.md`.

## Script Behavior

The script:

- parses `.srt` cues locally
- preserves cue numbers and timestamps
- batches dialogue lines into chunks for translation
- sends only cue ids and text to the model
- expects strict JSON back from the model
- rebuilds a valid `.srt` file after translation

Use `--chunk-size` to reduce request size for very large subtitle files.

## Validation

After translation:

1. compare cue count before and after
2. check that timestamps are unchanged
3. spot-check names, honorifics, and repeated phrases
4. open the subtitle in a player if timing-sensitive output matters

## References

- Read `references/provider-config.md` for environment variables and examples.
- Use `scripts/translate-srt.js --help` for CLI options.
