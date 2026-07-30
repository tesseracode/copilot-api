# Analysis

Chat-to-Responses translation collapses `system` messages to `developer` even though the Responses contract and live Copilot GPT-5.6 accept both roles. Live conflict probes showed current GPT-5.6 behavior is order-based, so no output difference was observed while order remained intact; role identity is still silently lost.

The collapse affects all Responses-routed models, including GPT/Azure and MAI. Chat-routed Gemini/Fireworks/legacy models bypass this translator; Claude uses native Messages and a separate top-level system conversion. A pre-implementation test failed pure and routed system-role assertions while developer-role preservation passed.
