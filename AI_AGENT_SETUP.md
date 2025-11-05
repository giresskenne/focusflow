# AI Agent Setup (OpenAI-powered Intent Parsing)

## Why AI instead of regex?

Instead of maintaining complex regex patterns and duration parsing logic, we now use **OpenAI's GPT-4o-mini** (or compatible models) to understand natural language commands like:

- "Block social for 30 minutes"
- "Start test" (will prompt for duration)
- "Stop blocking"
- "Block TikTok for two hours"

This handles:
- Natural time expressions ("half an hour", "2 hrs", "thirty minutes")
- Typos and variations ("blok", "strt")
- Ambiguous commands (AI can ask for clarification)

## Setup

### 1. Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

**Cost**: gpt-4o-mini is ~$0.15 per 1M input tokens. Voice commands are tiny (~20-50 tokens each), so expect < $0.01/day for typical usage.

### 2. Add to `.env`

```bash
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-key-here
EXPO_PUBLIC_AI_INTENTS_ENABLED=true
EXPO_PUBLIC_AI_TTS_PROVIDER=ios   # or 'openai'
EXPO_PUBLIC_AI_TTS_VOICE=alloy    # only used when provider is 'openai'
EXPO_PUBLIC_AI_TTS_ENABLED=true
```

### 3. Restart the dev server

```bash
# Kill current server (Ctrl+C)
npx expo start --clear
```

## How it works

1. User speaks: "Block test for 2 minutes"
2. STT captures the phrase
3. **AI parser** sends to OpenAI:
   - System prompt: "You are an intent parser for a focus app..."
   - User message: "Block test for 2 minutes"
   - Model returns JSON: `{action: "block", target: "test", durationMinutes: 2}`
4. Executor resolves "test" alias → apps → starts blocking

### Fallback

If OpenAI is unavailable (no API key, network error, timeout), it falls back to the **regex parser** (existing grammar.js logic). So it works offline too.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `EXPO_PUBLIC_OPENAI_API_KEY` | *(empty)* | Your OpenAI API key |
| `EXPO_PUBLIC_OPENAI_BASE_URL` | `https://api.openai.com/v1` | API endpoint (change for proxies/local models) |
| `EXPO_PUBLIC_AI_INTENT_MODEL` | `gpt-4o-mini` | Model name (try `gpt-4o` for better accuracy) |
| `EXPO_PUBLIC_AI_TEMPERATURE` | `0.2` | Creativity (0 = deterministic, 1 = creative) |
| `EXPO_PUBLIC_AI_INTENTS_ENABLED` | `true` | Master flag to enable AI parsing |
| `EXPO_PUBLIC_AI_TTS_PROVIDER` | `ios` | `ios` (expo-speech) or `openai` |
| `EXPO_PUBLIC_AI_TTS_VOICE` | `alloy` | OpenAI TTS voice id (alloy, aria, verse, sol, luna) |
| `EXPO_PUBLIC_AI_TTS_ENABLED` | `true` | Enable TTS feedback for prompts/confirmations |

## Testing

1. Seed test aliases: Settings → "Seed AI Test Aliases"
2. Press mic button
3. Say: "Block test for 2 minutes"
4. Should see in logs:
   ```
   [AI Parser] Calling OpenAI...
   [AI] parseIntent result: {"action":"block","target":"test","durationMinutes":2}
   ```

## Alternative: Use Claude or local models

You can point `OPENAI_BASE_URL` to any OpenAI-compatible API:

- **Anthropic Claude** via proxy: https://github.com/jetbridge/openai-api-proxy
- **Local LLM** (Ollama, LM Studio): http://localhost:11434/v1
- **Azure OpenAI**: https://YOUR_RESOURCE.openai.azure.com/openai/deployments/...

Just make sure it supports chat completions with JSON mode.

## Privacy

- Commands are sent to OpenAI (or your configured endpoint)
- No PII (just the spoken phrase like "Block social for 30 minutes")
- To keep commands fully local, set `EXPO_PUBLIC_AI_INTENTS_ENABLED=false` and use regex fallback

## Troubleshooting

**"AI parser failed, falling back to regex"**
- Check API key is correct in `.env`
- Verify network connectivity
- Check OpenAI status: https://status.openai.com

**Commands still using regex**
- Ensure `EXPO_PUBLIC_AI_INTENTS_ENABLED=true`
- Restart dev server after changing `.env`
- Check logs for `[AI Parser]` entries

**Timeout errors**
- Default timeout is 10s
- If network is slow, increase in `ai-intent-parser.js`: `fetchWithTimeout(..., 15000)`

---

**Next steps:**
- Add conversation history for multi-turn ("Block it for longer" → AI remembers "it" = last blocked app)
- Integrate with Siri Shortcuts using same AI parser
- Add voice feedback (TTS) for confirmations
