import { copilotBaseUrl } from "~/lib/api-config"
import { copilotFetch } from "~/lib/copilot-fetch"
import { state } from "~/lib/state"

export const createEmbeddings = async (
  payload: EmbeddingRequest,
  signal?: AbortSignal,
): Promise<Response> => {
  if (!state.copilotToken) throw new Error("Copilot token not found")

  return await copilotFetch(`${copilotBaseUrl(state)}/embeddings`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  })
}

export interface EmbeddingRequest {
  input: Array<string>
  model: string
  dimensions?: number
  encoding_format?: "float"
}

export interface Embedding {
  object: string
  embedding: Array<number>
  index: number
}

export interface EmbeddingResponse {
  object: string
  data: Array<Embedding>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}
