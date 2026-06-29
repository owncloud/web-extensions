# ai-quick-draft-creator

Adds a "Draft from description" item to the oCIS files upload menu. A modal lets the user describe the document they need; the configured LLM generates a structured draft and saves it as a new file in the current folder.

**Extension point:** `app.files.upload-menu`

**LLM:** BYO-LLM via admin-configured OpenAI-compatible endpoint (`applicationConfig.llm.endpoint` + `model`). No telemetry, no hardcoded keys. Menu item is hidden when LLM is not configured.
