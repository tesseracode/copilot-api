import type { ModelsResponse } from "~/services/copilot/get-models"

export type UpstreamEndpoint =
  | "/v1/messages"
  | "/responses"
  | "/chat/completions"

/**
 * Resolve which upstream Copilot API endpoint to use for a given model,
 * based on the model's supported_endpoints from the cached /models response.
 */
export function resolveEndpoint(
  modelId: string,
  cachedModels?: ModelsResponse,
): UpstreamEndpoint {
  const model = cachedModels?.data.find((m) => m.id === modelId)
  const endpoints = model?.supported_endpoints ?? []
  const isClaude = modelId.startsWith("claude-")

  // 1. Native Anthropic passthrough for Claude models
  if (isClaude && endpoints.includes("/v1/messages")) {
    return "/v1/messages"
  }
  // 2. Prefer /responses for richer capabilities (GPT-5.x)
  if (endpoints.includes("/responses")) {
    return "/responses"
  }
  // 3. Fallback to existing /chat/completions
  return "/chat/completions"
}
