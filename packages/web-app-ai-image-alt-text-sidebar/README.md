# AI Image Alt-Text Generator

Adds an **Alt Text** sidebar panel and a **Generate Alt Text** context-menu
action for image files. When triggered it downloads the image via WebDAV,
base64-encodes it, and sends it to an admin-configured, vision-capable
OpenAI-compatible LLM endpoint to produce a concise, accessible description.
The result is displayed in an editable textarea the user can revise, copy to
clipboard, or save back to the file as a persistent WebDAV property.

No LLM provider is bundled and no API keys are embedded in the browser —
the endpoint is fully operator-controlled (BYO-LLM).

## Supported Image Types

JPG, JPEG, PNG, WEBP, GIF

Images larger than **4 MB** are rejected before any upload to avoid LLM token
overflows. The limit is applied to the raw file size reported by oCIS; base64
overhead (~33 %) is not counted.

## Extension Points

| ID | Type |
|----|------|
| `global.files.sidebar` | `sidebarPanel` — "Alt Text" tab, visible for a single supported image when an LLM endpoint is configured |
| `global.files.context-actions` | `action` — "Generate Alt Text" entry that opens the Alt Text sidebar tab |

Both are hidden entirely when no LLM endpoint is configured in the app config.

## Configuration

### Web App Config (`ocis.apps.yaml`)

```yaml
ai-image-alt-text:
  llm:
    endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
    model: "gpt-4o"
    vision: true
```

| Key | Required | Description |
|-----|----------|-------------|
| `llm.endpoint` | yes | OpenAI-compatible LLM base URL (must expose `/chat/completions`) |
| `llm.model` | yes | Model identifier forwarded as-is in the request body |
| `llm.vision` | yes | Set to `true` to enable the multimodal vision payload. Without this flag the panel renders a "text-only model" notice instead of generating alt text |

The panel reads `applicationConfig.llm` at startup. If `endpoint` or `model` is
absent the Alt Text tab is hidden from the sidebar entirely — no network requests
are made.

### `ai-llm-proxy` Sidecar

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar lives in
`packages/ai-llm-proxy`, validates the user's oCIS OIDC bearer token, and
forwards the request to the configured LLM with the API key injected
server-side. The API key never reaches the browser.

| Variable | Required | Description |
|----------|----------|-------------|
| `OCIS_URL` | yes | oCIS base URL, used to verify OIDC tokens |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible) |
| `LLM_API_KEY` | no | API key forwarded in `Authorization: Bearer` |
| `PORT` | no | Listening port, default `3030` |

## States

| State | Shown when |
|-------|-----------|
| Hidden tab | `llm.endpoint` or `llm.model` absent from app config |
| Unconfigured | Config present but endpoint/model missing (should not normally occur) |
| Text-only notice | `llm.vision` is `false` or absent — prompts admin to switch to a vision model |
| Generating | LLM `/chat/completions` request in flight |
| Result | Editable textarea with Copy, Regenerate, and Save buttons |
| Error | Endpoint unreachable, auth failure, timeout, image too large, or unexpected response |

Errors appear as an inline banner above the textarea and include actionable
guidance for the user or admin.

## Alt Text Persistence

Saving accepted alt text writes it to the file as a custom WebDAV property:

| Attribute | Value |
|-----------|-------|
| Namespace | `urn:oc:ai:alt-text` |
| Property | `text` |
| Method | `PROPPATCH` |

On panel open the stored value is fetched with `PROPFIND` and pre-filled into
the textarea, so approved alt text survives page reloads and is available to
other oCIS components that can read custom WebDAV properties.

> **Search indexing:** oCIS's built-in search engine (Bleve) does not index
> custom WebDAV properties in private namespaces. Making the stored alt text
> discoverable via search requires a future server-side oCIS indexing extension
> and is out of scope for this client-side package.

## LLM Prompt

The extension sends a single-turn multimodal message asking the LLM to return
only the alt text string — no markdown, no quotes, no extra commentary. The
response language follows the user's oCIS preferred language (BCP 47 tag) with
English as the fallback. `max_tokens` is capped at 150 to match WCAG alt-text
length conventions.
