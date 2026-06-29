# AI Multi-Document Synthesizer

Select 2–10 text documents (.txt, .md) and click **Synthesize** to get an LLM-generated overview of shared themes, key differences, and action items. The result can be copied to the clipboard or saved as a new Markdown file in the same folder.

**Extension point:** `global.files.batch-actions`

**LLM:** uses the admin-configured endpoint (BYO-LLM, OpenAI-compatible). No telemetry, no hardcoded keys.

**Privacy:** all document content is sent to the admin-configured endpoint only. No data reaches third-party services.
