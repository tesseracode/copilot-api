import { describe, expect, it } from "bun:test"

import { server } from "~/server"

import packageJson from "../package.json"

describe("operational hardening", () => {
  it("reports the package version from health", async () => {
    const response = await server.request("/health")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: "ok",
      version: packageJson.version,
    })
  })

  it.each(["/health", "/v1/models", "/token"])(
    "does not emit wildcard CORS by default for %s",
    async (path) => {
      const response = await server.request(path, {
        headers: { origin: "https://malicious.example" },
      })
      expect(response.headers.get("access-control-allow-origin")).toBeNull()
    },
  )

  it.each([
    "/v1/responses/resp_123",
    "/responses/resp_123",
    "/v1/conversations",
  ])("does not expose Responses lifecycle route %s", async (path) => {
    const response = await server.request(path)
    expect(response.status).toBe(404)
  })
})
