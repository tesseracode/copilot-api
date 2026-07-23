import { afterEach, describe, expect, it, mock } from "bun:test"

import { copilotFetch } from "~/lib/copilot-fetch"
import { state } from "~/lib/state"

const originalFetch = globalThis.fetch

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

function setFetchMock(implementation: FetchImplementation): void {
  globalThis.fetch = mock(implementation) as unknown as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("copilotFetch token recovery", () => {
  it("returns successful responses without refreshing", async () => {
    let calls = 0
    setFetchMock(() => {
      calls += 1
      return Promise.resolve(new Response("ok", { status: 200 }))
    })
    state.copilotToken = "valid"

    const response = await copilotFetch("https://example.test/responses")

    expect(response.status).toBe(200)
    expect(calls).toBe(1)
  })

  it("refreshes once and retries a 401 with the new token", async () => {
    const authorizations: Array<string | null> = []
    let refreshes = 0
    setFetchMock((_input, init) => {
      authorizations.push(new Headers(init?.headers).get("authorization"))
      return Promise.resolve(
        new Response(authorizations.length === 1 ? "expired" : "ok", {
          status: authorizations.length === 1 ? 401 : 200,
        }),
      )
    })
    state.copilotToken = "expired"

    const response = await copilotFetch(
      "https://example.test/responses",
      {},
      {
        refresh: () => {
          refreshes += 1
          state.copilotToken = "fresh"
          return Promise.resolve()
        },
      },
    )

    expect(response.status).toBe(200)
    expect(refreshes).toBe(1)
    expect(authorizations).toEqual(["Bearer expired", "Bearer fresh"])
  })

  it("reuses a token refreshed by another request before replay", async () => {
    let refreshes = 0
    const authorizations: Array<string | null> = []
    setFetchMock((_input, init) => {
      authorizations.push(new Headers(init?.headers).get("authorization"))
      if (authorizations.length === 1) {
        state.copilotToken = "fresh"
        return Promise.resolve(new Response("expired", { status: 401 }))
      }
      return Promise.resolve(new Response("ok", { status: 200 }))
    })
    state.copilotToken = "expired"

    const response = await copilotFetch(
      "https://example.test/responses",
      {},
      {
        refresh: () => {
          refreshes += 1
          return Promise.resolve()
        },
      },
    )

    expect(response.status).toBe(200)
    expect(refreshes).toBe(0)
    expect(authorizations).toEqual(["Bearer expired", "Bearer fresh"])
  })

  it("does not replay one-shot request bodies", async () => {
    let calls = 0
    setFetchMock(() => {
      calls += 1
      return Promise.resolve(new Response("expired", { status: 401 }))
    })
    state.copilotToken = "expired"

    const response = await copilotFetch("https://example.test/responses", {
      method: "POST",
      body: new Blob(["payload"]),
    })

    expect(response.status).toBe(401)
    expect(calls).toBe(1)
  })

  it("does not retry non-authentication failures", async () => {
    let calls = 0
    setFetchMock(() => {
      calls += 1
      return Promise.resolve(new Response("busy", { status: 503 }))
    })
    state.copilotToken = "valid"

    const response = await copilotFetch("https://example.test/responses")

    expect(response.status).toBe(503)
    expect(calls).toBe(1)
  })

  it("does not retry an aborted request", async () => {
    let calls = 0
    const controller = new AbortController()
    controller.abort()
    setFetchMock(() => {
      calls += 1
      return Promise.resolve(new Response("expired", { status: 401 }))
    })
    state.copilotToken = "expired"

    const response = await copilotFetch("https://example.test/responses", {
      signal: controller.signal,
    })

    expect(response.status).toBe(401)
    expect(calls).toBe(1)
  })
})
