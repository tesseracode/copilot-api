# Analysis

Copilot IDE tokens last 30 minutes and request refresh after 25 minutes; the stored GitHub credential is the long-lived credential. Normal refresh succeeded for more than 15 hours in an isolated proxy, so ordinary token aging is not the defect.

The current interval has no fetch timeout or retry. A failed/hung refresh leaves the old token installed until it expires, throws from an async timer callback, and model requests do not recover from an expiry 401. This matches the observed daily `IDE token expired` failure window.

The compatible fix is single-flight refresh with timeout/backoff, dynamic scheduling from each token response, and one refresh-and-retry for Copilot 401 responses. Non-401 errors and aborts remain unchanged.
