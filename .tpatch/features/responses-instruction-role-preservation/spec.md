# Specification

1. Chat system messages remain Responses system messages.
2. Developer messages remain developer messages.
3. Mixed/repeated system, developer and user roles preserve identity and order exactly.
4. Routed `/v1/chat/completions` requests send the preserved roles upstream.
5. User, assistant, tools, content, effort and streaming behavior remain unchanged.
6. Native Responses passthrough is unchanged.
7. Provider role probes document Responses, Chat-routed non-OpenAI and Claude contracts without speculative cross-provider normalization.
8. Mutation tests prove role identity, ordering and type support.
