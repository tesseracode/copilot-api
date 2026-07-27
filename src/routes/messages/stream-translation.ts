import { copilotToAnthropicModelId } from "~/lib/model-mapping"
import { type ChatCompletionChunk } from "~/services/copilot/create-chat-completions"

import {
  type AnthropicStreamEventData,
  type AnthropicStreamState,
} from "./anthropic-types"
import { mapOpenAIStopReasonToAnthropic } from "./utils"

function isToolBlockOpen(streamState: AnthropicStreamState): boolean {
  if (!streamState.contentBlockOpen) {
    return false
  }
  // Check if the current block index corresponds to any known tool call
  return Object.values(streamState.toolCalls).some(
    (tc) => tc.anthropicBlockIndex === streamState.contentBlockIndex,
  )
}

// eslint-disable-next-line max-lines-per-function, complexity
export function translateChunkToAnthropicEvents(
  chunk: ChatCompletionChunk,
  streamState: AnthropicStreamState,
): Array<AnthropicStreamEventData> {
  const events: Array<AnthropicStreamEventData> = []

  if (chunk.choices.length === 0 && !chunk.error) {
    return events
  }

  if (chunk.error) {
    if (!streamState.messageStartSent) {
      events.push({
        type: "message_start",
        message: {
          id: chunk.id,
          type: "message",
          role: "assistant",
          content: [],
          model: copilotToAnthropicModelId(chunk.model),
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      })
      streamState.messageStartSent = true
    }
    if (streamState.contentBlockOpen) {
      events.push({
        type: "content_block_stop",
        index: streamState.contentBlockIndex,
      })
      streamState.contentBlockOpen = false
    }
    events.push(
      translateErrorToAnthropicErrorEvent({
        type: chunk.error.type,
        message: chunk.error.message,
      }),
    )
    return events
  }

  const choice = chunk.choices[0]
  const { delta } = choice

  if (!streamState.messageStartSent) {
    events.push({
      type: "message_start",
      message: {
        id: chunk.id,
        type: "message",
        role: "assistant",
        content: [],
        model: copilotToAnthropicModelId(chunk.model),
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens:
            (chunk.usage?.prompt_tokens ?? 0)
            - (chunk.usage?.prompt_tokens_details?.cached_tokens ?? 0),
          output_tokens: 0, // Will be updated in message_delta when finished
          ...(chunk.usage?.prompt_tokens_details?.cached_tokens
            !== undefined && {
            cache_read_input_tokens:
              chunk.usage.prompt_tokens_details.cached_tokens,
          }),
        },
      },
    })
    streamState.messageStartSent = true
  }

  if (delta.content) {
    if (isToolBlockOpen(streamState)) {
      // A tool block was open, so close it before starting a text block.
      events.push({
        type: "content_block_stop",
        index: streamState.contentBlockIndex,
      })
      streamState.contentBlockIndex++
      streamState.contentBlockOpen = false
    }

    if (!streamState.contentBlockOpen) {
      events.push({
        type: "content_block_start",
        index: streamState.contentBlockIndex,
        content_block: {
          type: "text",
          text: "",
        },
      })
      streamState.contentBlockOpen = true
    }

    events.push({
      type: "content_block_delta",
      index: streamState.contentBlockIndex,
      delta: {
        type: "text_delta",
        text: delta.content,
      },
    })
  }

  if (delta.tool_calls) {
    for (const toolCall of delta.tool_calls) {
      if (toolCall.id && toolCall.function?.name) {
        // New tool call starting.
        if (streamState.contentBlockOpen) {
          // Close any previously open block.
          events.push({
            type: "content_block_stop",
            index: streamState.contentBlockIndex,
          })
          streamState.contentBlockIndex++
          streamState.contentBlockOpen = false
        }

        const anthropicBlockIndex = streamState.contentBlockIndex
        streamState.toolCalls[toolCall.index] = {
          id: toolCall.id,
          name: toolCall.function.name,
          anthropicBlockIndex,
        }

        events.push({
          type: "content_block_start",
          index: anthropicBlockIndex,
          content_block: {
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: {},
          },
        })
        streamState.contentBlockOpen = true
      }

      if (toolCall.function?.arguments) {
        const toolCallInfo = streamState.toolCalls[toolCall.index]
        // Tool call can still be empty
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (toolCallInfo) {
          events.push({
            type: "content_block_delta",
            index: toolCallInfo.anthropicBlockIndex,
            delta: {
              type: "input_json_delta",
              partial_json: toolCall.function.arguments,
            },
          })
        }
      }
    }
  }

  if (choice.finish_reason) {
    if (streamState.contentBlockOpen) {
      events.push({
        type: "content_block_stop",
        index: streamState.contentBlockIndex,
      })
      streamState.contentBlockOpen = false
    }

    events.push(
      {
        type: "message_delta",
        delta: {
          stop_reason: mapOpenAIStopReasonToAnthropic(choice.finish_reason),
          stop_sequence: null,
        },
        usage: {
          input_tokens:
            (chunk.usage?.prompt_tokens ?? 0)
            - (chunk.usage?.prompt_tokens_details?.cached_tokens ?? 0),
          output_tokens: chunk.usage?.completion_tokens ?? 0,
          ...(chunk.usage?.prompt_tokens_details?.cached_tokens
            !== undefined && {
            cache_read_input_tokens:
              chunk.usage.prompt_tokens_details.cached_tokens,
          }),
        },
      },
      {
        type: "message_stop",
      },
    )
  }

  return events
}

export function translateErrorToAnthropicErrorEvent(
  payload: { type: string; message: string } = {
    type: "api_error",
    message: "An unexpected error occurred during streaming.",
  },
): AnthropicStreamEventData {
  return {
    type: "error",
    error: {
      type: payload.type,
      message: payload.message,
    },
  }
}
