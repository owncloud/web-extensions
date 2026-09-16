# web-app-jupyter

Adds an "Open in Notebooks" context-menu action for `.ipynb` files that
redirects to a configurable JupyterHub instance. This extension does not
embed a Jupyter server — it only builds a deep link into JupyterHub's
`user-redirect` tree view and opens it in a new tab.

## Configuration

| Key | Description | Default |
|-----|--------------|---------|
| `serverUrl` | Base URL of the JupyterHub instance | none (must be configured) |
| `serverPath` | Path appended after `serverUrl` | `hub/user-redirect/lab/tree` |
| `serverRootPath` | oCIS personal-space folder mapped as the Jupyter tree root | none |

The action is shown only for `.ipynb` files owned by the current user in
their personal space (and, if `serverRootPath` is set, only under that
folder).
