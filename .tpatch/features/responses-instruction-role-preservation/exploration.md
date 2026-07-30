# Exploration

- `src/services/copilot/create-responses.ts`: Responses input role union omits system and the shared system/developer switch hardcodes developer.
- `src/services/copilot/create-chat-completions.ts`: Chat request type supports system/developer/user/assistant/tool.
- `src/lib/endpoint-routing.ts`: only Responses-routed models pass through this translator.
- `src/routes/messages/non-stream-translation.ts`: Claude conversion is separate and produces top-level Anthropic system instructions.
- New pure and route-capture tests pin exact role identity/order.
- Provider matrix covers GPT/MAI Responses, Gemini/legacy Chat and Claude boundary behavior.
