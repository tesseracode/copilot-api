import { badRequest } from "~/lib/error"
import {
  anthropicToCopilotModelId,
  copilotToAnthropicModelId,
} from "~/lib/model-mapping"
import { state } from "~/lib/state"
import {
  type ChatCompletionResponse,
  type ChatCompletionsPayload,
  type ContentPart,
  type Message,
  type TextPart,
  type Tool,
  type ToolCall,
} from "~/services/copilot/create-chat-completions"

import {
  type AnthropicAssistantContentBlock,
  type AnthropicAssistantMessage,
  type AnthropicMessage,
  type AnthropicMessagesPayload,
  type AnthropicResponse,
  type AnthropicTextBlock,
  type AnthropicThinkingBlock,
  type AnthropicTool,
  type AnthropicToolResultBlock,
  type AnthropicToolUseBlock,
  type AnthropicUserContentBlock,
  type AnthropicUserMessage,
} from "./anthropic-types"
import { mapOpenAIStopReasonToAnthropic } from "./utils"

// Payload translation

export function translateToOpenAI(
  payload: AnthropicMessagesPayload,
): ChatCompletionsPayload {
  return {
    model: translateModelName(payload.model),
    messages: translateAnthropicMessagesToOpenAI(
      payload.messages,
      payload.system,
    ),
    max_tokens: payload.max_tokens,
    stop: payload.stop_sequences,
    stream: payload.stream,
    temperature: payload.temperature,
    top_p: payload.top_p,
    user: payload.metadata?.user_id,
    tools: translateAnthropicToolsToOpenAI(payload.tools),
    tool_choice: translateAnthropicToolChoiceToOpenAI(payload.tool_choice),
  }
}

function translateModelName(model: string): string {
  return anthropicToCopilotModelId(model, state.is1MContext)
}

function translateAnthropicMessagesToOpenAI(
  anthropicMessages: Array<AnthropicMessage>,
  system: string | Array<AnthropicTextBlock> | undefined,
): Array<Message> {
  const systemMessages = handleSystemPrompt(system)

  const otherMessages = anthropicMessages.flatMap((message) =>
    message.role === "user" ?
      handleUserMessage(message)
    : handleAssistantMessage(message),
  )

  return [...systemMessages, ...otherMessages]
}

function handleSystemPrompt(
  system: string | Array<AnthropicTextBlock> | undefined,
): Array<Message> {
  if (!system) {
    return []
  }

  if (typeof system === "string") {
    return [{ role: "system", content: system }]
  } else {
    const systemText = system.map((block) => block.text).join("\n\n")
    return [{ role: "system", content: systemText }]
  }
}

function handleUserMessage(message: AnthropicUserMessage): Array<Message> {
  const newMessages: Array<Message> = []

  if (Array.isArray(message.content)) {
    const toolResultBlocks = message.content.filter(
      (block): block is AnthropicToolResultBlock =>
        block.type === "tool_result",
    )
    const otherBlocks = message.content.filter(
      (block) => block.type !== "tool_result",
    )

    // Tool results must come first to maintain protocol: tool_use -> tool_result -> user
    for (const block of toolResultBlocks) {
      if (!block.tool_use_id || !block.tool_use_id.trim()) {
        throw badRequest("tool_result block is missing tool_use_id")
      }
      newMessages.push({
        role: "tool",
        tool_call_id: block.tool_use_id,
        content: mapContent(block.content),
      })
    }

    if (otherBlocks.length > 0) {
      newMessages.push({
        role: "user",
        content: mapContent(otherBlocks),
      })
    }
  } else {
    newMessages.push({
      role: "user",
      content: mapContent(message.content),
    })
  }

  return newMessages
}

function handleAssistantMessage(
  message: AnthropicAssistantMessage,
): Array<Message> {
  if (!Array.isArray(message.content)) {
    return [
      {
        role: "assistant",
        content: mapContent(message.content),
      },
    ]
  }

  const toolUseBlocks = message.content.filter(
    (block): block is AnthropicToolUseBlock => block.type === "tool_use",
  )

  const textBlocks = message.content.filter(
    (block): block is AnthropicTextBlock => block.type === "text",
  )

  const thinkingBlocks = message.content.filter(
    (block): block is AnthropicThinkingBlock => block.type === "thinking",
  )

  // Combine text and thinking blocks, as OpenAI doesn't have separate thinking blocks
  const allTextContent = [
    ...textBlocks.map((b) => b.text),
    ...thinkingBlocks.map((b) => b.thinking),
  ].join("\n\n")

  return toolUseBlocks.length > 0 ?
      [
        {
          role: "assistant",
          content: allTextContent || null,
          tool_calls: toolUseBlocks.map((toolUse) => ({
            id: toolUse.id,
            type: "function",
            function: {
              name: toolUse.name,
              arguments: JSON.stringify(toolUse.input),
            },
          })),
        },
      ]
    : [
        {
          role: "assistant",
          content: mapContent(message.content),
        },
      ]
}

function mapContent(
  content:
    | string
    | Array<AnthropicUserContentBlock | AnthropicAssistantContentBlock>,
): string | Array<ContentPart> | null {
  if (typeof content === "string") {
    return content
  }
  if (!Array.isArray(content)) {
    return null
  }

  const hasImage = content.some((block) => block.type === "image")
  if (!hasImage) {
    return content
      .filter(
        (block): block is AnthropicTextBlock | AnthropicThinkingBlock =>
          block.type === "text" || block.type === "thinking",
      )
      .map((block) => (block.type === "text" ? block.text : block.thinking))
      .join("\n\n")
  }

  const contentParts: Array<ContentPart> = []
  for (const block of content) {
    switch (block.type) {
      case "text": {
        contentParts.push({ type: "text", text: block.text })

        break
      }
      case "thinking": {
        contentParts.push({ type: "text", text: block.thinking })

        break
      }
      case "image": {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        })

        break
      }
      // No default
    }
  }
  return contentParts
}

function translateAnthropicToolsToOpenAI(
  anthropicTools: Array<AnthropicTool> | undefined,
): Array<Tool> | undefined {
  if (!anthropicTools) {
    return undefined
  }
  return anthropicTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }))
}

function translateAnthropicToolChoiceToOpenAI(
  anthropicToolChoice: AnthropicMessagesPayload["tool_choice"],
): ChatCompletionsPayload["tool_choice"] {
  if (!anthropicToolChoice) {
    return undefined
  }

  switch (anthropicToolChoice.type) {
    case "auto": {
      return "auto"
    }
    case "any": {
      return "required"
    }
    case "tool": {
      if (anthropicToolChoice.name) {
        return {
          type: "function",
          function: { name: anthropicToolChoice.name },
        }
      }
      return undefined
    }
    case "none": {
      return "none"
    }
    default: {
      return undefined
    }
  }
}

// Response translation

function getThinkingBlocks(
  reasoningText: string | null | undefined,
): Array<AnthropicThinkingBlock> {
  if (!reasoningText) return []
  return [{ type: "thinking", thinking: reasoningText }]
}

export function translateToAnthropic(
  response: ChatCompletionResponse,
): AnthropicResponse {
  // Merge content from all choices
  const allTextBlocks: Array<AnthropicTextBlock> = []
  const allToolUseBlocks: Array<AnthropicToolUseBlock> = []
  const allThinkingBlocks: Array<AnthropicThinkingBlock> = []
  let stopReason: "stop" | "length" | "tool_calls" | "content_filter" | null =
    null // default
  stopReason = response.choices[0]?.finish_reason ?? stopReason

  // Process all choices to extract text and tool use blocks
  for (const choice of response.choices) {
    const textBlocks = getAnthropicTextBlocks(choice.message.content)
    const toolUseBlocks = getAnthropicToolUseBlocks(choice.message.tool_calls)

    // Map reasoning_text from GPT-5.x /responses to Anthropic thinking blocks
    allThinkingBlocks.push(...getThinkingBlocks(choice.message.reasoning_text))

    allTextBlocks.push(...textBlocks)
    allToolUseBlocks.push(...toolUseBlocks)

    // Use the finish_reason from the first choice, or prioritize tool_calls
    if (choice.finish_reason === "tool_calls" || stopReason === "stop") {
      stopReason = choice.finish_reason
    }
  }

  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: copilotToAnthropicModelId(response.model),
    content: [...allThinkingBlocks, ...allTextBlocks, ...allToolUseBlocks],
    stop_reason: mapOpenAIStopReasonToAnthropic(stopReason),
    stop_sequence: null,
    usage: {
      input_tokens:
        (response.usage?.prompt_tokens ?? 0)
        - (response.usage?.prompt_tokens_details?.cached_tokens ?? 0),
      output_tokens: response.usage?.completion_tokens ?? 0,
      ...(response.usage?.prompt_tokens_details?.cached_tokens
        !== undefined && {
        cache_read_input_tokens:
          response.usage.prompt_tokens_details.cached_tokens,
      }),
    },
  }
}

function getAnthropicTextBlocks(
  messageContent: Message["content"],
): Array<AnthropicTextBlock> {
  if (typeof messageContent === "string") {
    return [{ type: "text", text: messageContent }]
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .filter((part): part is TextPart => part.type === "text")
      .map((part) => ({ type: "text", text: part.text }))
  }

  return []
}

function getAnthropicToolUseBlocks(
  toolCalls: Array<ToolCall> | undefined,
): Array<AnthropicToolUseBlock> {
  if (!toolCalls) {
    return []
  }
  return toolCalls.map((toolCall) => ({
    type: "tool_use",
    id: toolCall.id,
    name: toolCall.function.name,
    input: JSON.parse(toolCall.function.arguments) as Record<string, unknown>,
  }))
}

/**
 * Convert an OpenAI assistant message to Anthropic content blocks.
 */
function convertAssistantMessage(
  msg: ChatCompletionsPayload["messages"][0],
): AnthropicMessage {
  const blocks: Array<AnthropicAssistantContentBlock> = []
  if (msg.content) {
    const text = typeof msg.content === "string" ? msg.content : ""
    if (text) blocks.push({ type: "text", text })
  }
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      blocks.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })
    }
  }
  if (blocks.length > 0) {
    return { role: "assistant", content: blocks } as AnthropicMessage
  }
  const fallbackContent = typeof msg.content === "string" ? msg.content : ""
  return { role: "assistant", content: fallbackContent } as AnthropicMessage
}

/**
 * Convert OpenAI messages to Anthropic messages, extracting system prompt.
 */
function convertOpenAIMessages(messages: ChatCompletionsPayload["messages"]): {
  anthropicMessages: Array<AnthropicMessage>
  systemPrompt?: string
} {
  const anthropicMessages: Array<AnthropicMessage> = []
  let systemPrompt: string | undefined

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
      case "developer": {
        systemPrompt = typeof msg.content === "string" ? msg.content : ""

        break
      }
      case "user": {
        anthropicMessages.push({
          role: "user",
          content: typeof msg.content === "string" ? msg.content : "",
        })

        break
      }
      case "assistant": {
        anthropicMessages.push(convertAssistantMessage(msg))

        break
      }
      case "tool": {
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.tool_call_id ?? "",
              content: typeof msg.content === "string" ? msg.content : "",
            },
          ],
        } as unknown as AnthropicMessage)

        break
      }
      // No default
    }
  }

  return { anthropicMessages, systemPrompt }
}

/**
 * Convert OpenAI tool definitions to Anthropic format.
 */
function convertOpenAITools(
  tools: ChatCompletionsPayload["tools"],
): AnthropicMessagesPayload["tools"] {
  if (!tools) return undefined
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  })) as AnthropicMessagesPayload["tools"]
}

/**
 * Convert OpenAI tool_choice to Anthropic format.
 */
function convertOpenAIToolChoice(
  choice: ChatCompletionsPayload["tool_choice"],
): AnthropicMessagesPayload["tool_choice"] {
  if (!choice) return undefined
  if (choice === "required") return { type: "any" }
  if (choice === "auto") return { type: "auto" }
  if (choice === "none") return { type: "none" }
  if (typeof choice === "object") {
    return { type: "tool", name: choice.function.name }
  }
  return undefined
}

/**
 * Convert an OpenAI Chat Completions payload to Anthropic Messages format.
 * Used when rerouting Claude models from /chat/completions to native /v1/messages.
 */
export function openaiToAnthropicPayload(
  payload: ChatCompletionsPayload,
): AnthropicMessagesPayload {
  const { anthropicMessages, systemPrompt } = convertOpenAIMessages(
    payload.messages,
  )

  const result: AnthropicMessagesPayload = {
    model: payload.model,
    messages: anthropicMessages,
    max_tokens: payload.max_tokens ?? 4096,
    stream: payload.stream ?? undefined,
  }

  if (systemPrompt) result.system = systemPrompt
  if (payload.temperature !== null && payload.temperature !== undefined)
    result.temperature = payload.temperature
  if (payload.top_p !== null && payload.top_p !== undefined)
    result.top_p = payload.top_p
  result.tools = convertOpenAITools(payload.tools)
  result.tool_choice = convertOpenAIToolChoice(payload.tool_choice)

  return result
}
