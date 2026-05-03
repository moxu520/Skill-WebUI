# Provider Config

Use the bundled script with an OpenAI-compatible Chat Completions endpoint.

## Required Environment Variables

- `OPENAI_API_KEY`: API key for the provider

## Optional Environment Variables

- `OPENAI_MODEL`: model name. Default: `gpt-4.1-mini`
- `OPENAI_BASE_URL`: base URL for OpenAI-compatible providers. Default: `https://api.openai.com/v1`

## Example Setups

OpenAI:

```bash
export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-4.1-mini
```

Compatible provider:

```bash
export OPENAI_API_KEY=...
export OPENAI_MODEL=your-model-name
export OPENAI_BASE_URL=https://your-endpoint.example.com/v1
```

## Output Guidance

- Use `--target-language zh-CN` for simplified Chinese.
- Add `--bilingual` to keep original subtitle text above the translation.
- Keep `--chunk-size` smaller if the source subtitles are dense or contain long dialogue blocks.
