# Analysis: Reasoning Block Preservation

## Summary

GPT-5.x models on the Copilot `/responses` API return `type: "reasoning"` output items containing the model's chain-of-thought. Our proxy currently drops these blocks silently in `translateResponsesNonStreaming`, meaning:

1. Clients on `/chat/completions` lose reasoning content entirely
2. Clients on `/v1/messages` (Anthropic format) lose the equivalent of `thinking` blocks
3. Multi-turn conversations lose reasoning context since the blocks aren't returned for re-submission
4. `usage.output_tokens_details.reasoning_tokens` is dropped from token counts

## What the upstream returns

Raw `/responses` output from GPT-5.5:
```json
{
  "output": [
    {
      "type": "reasoning",
      "id": "rs_...",
      "summary": []
    },
    {
      "type": "message",
      "content": [{ "type": "output_text", "text": "2 + 2 = 4" }],
      "role": "assistant"
    }
  ],
  "usage": {
    "output_tokens_details": { "reasoning_tokens": 45 }
  }
}
```

The reasoning block has:
- `id` — opaque reference ID (for stored sessions / multi-turn)
- `summary` — array of `{ type: "summary_text", text: string }` (currently empty on Copilot)
- `encrypted_content` — optional, for session continuity (not seen on Copilot yet)

## What other projects do

### anomalyco/opencode (TypeScript)
- Full `OpenAIResponsesReasoning` type with `id`, `encrypted_content`, `summary`
- Preserves reasoning blocks in input via `item_reference` for stored sessions
- Maps `summary_text` to reasoning content for display

### opencode-ai/opencode (Go)
- No `/responses` support at all — only `/chat/completions`
- No reasoning block handling

## Translation targets

### For `/chat/completions` output
OpenAI's convention: `message.reasoning_text` field alongside `message.content`:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "2 + 2 = 4",
      "reasoning_text": "The user asks for 2+2..."
    }
  }]
}
```

### For `/v1/messages` output (Anthropic format)
Map to `thinking` block before text:
```json
{
  "content": [
    { "type": "thinking", "thinking": "The user asks for 2+2..." },
    { "type": "text", "text": "2 + 2 = 4" }
  ]
}
```

## Upstream status

Not present in the original copilot-api — it has no `/responses` support at all.

## Compatibility

- No breaking changes — adds new fields to existing responses
- `reasoning_text` is the OpenAI convention, clients that don't know about it ignore it
- `thinking` blocks are already in the Anthropic type system
- Reasoning `summary` is currently empty on Copilot — implementation is forward-looking
