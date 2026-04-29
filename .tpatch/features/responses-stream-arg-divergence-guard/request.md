# Feature Request: Guard against tool-call argument corruption in /responses streaming translation. In src/services/copilot/create-responses.ts, syncToolArguments currently emits the full nextArguments as a delta (and overwrites the accumulator) when nextArguments does not start with the previously accumulated arguments. Because earlier deltas already reached the client, this produces duplicated/invalid JSON in tool_use input. Detect the divergence, log a warning with both prefixes, and avoid re-emitting the prefix as a delta. Add a unit test simulating response.function_call_arguments.done arriving with arguments that disagree with the accumulated stream.

**Slug**: `responses-stream-arg-divergence-guard`
**Created**: 2026-04-29T22:10:05Z

## Description

Guard against tool-call argument corruption in /responses streaming translation. In src/services/copilot/create-responses.ts, syncToolArguments currently emits the full nextArguments as a delta (and overwrites the accumulator) when nextArguments does not start with the previously accumulated arguments. Because earlier deltas already reached the client, this produces duplicated/invalid JSON in tool_use input. Detect the divergence, log a warning with both prefixes, and avoid re-emitting the prefix as a delta. Add a unit test simulating response.function_call_arguments.done arriving with arguments that disagree with the accumulated stream.
