export type ServiceResult<TBody, TStream> =
  | { kind: "object"; body: TBody }
  | { kind: "stream"; stream: TStream }

export const objectResult = <T>(body: T) => ({ kind: "object", body }) as const
export const streamResult = <T>(stream: T) =>
  ({ kind: "stream", stream }) as const
