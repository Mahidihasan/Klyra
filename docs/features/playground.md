# Playground

> **API Development Workspace** — A full-featured, Postman-like environment built directly into the Klyra API Marketplace. Build, test, and debug HTTP requests, manage environments, organize collections, and leverage AI assistance — all without leaving the platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [How It Works](#how-it-works)
4. [Layout & UI Structure](#layout--ui-structure)
5. [Features](#features)
6. [Connections](#connections)
7. [Properties & Configuration](#properties--configuration)
8. [Data Model](#data-model)
9. [Backend API Reference](#backend-api-reference)
10. [Frontend API Service](#frontend-api-service)
11. [Security](#security)
12. [Data Persistence](#data-persistence)
13. [Default Data](#default-data)
14. [AI Copilot (Pro Feature)](#ai-copilot-pro-feature)
15. [Code Generation](#code-generation)
16. [Error Diagnosis](#error-diagnosis)
17. [Schema-Aware Validation](#schema-aware-validation)
18. [Environment Variables](#environment-variables)
19. [Keyboard Shortcuts & UX](#keyboard-shortcuts--ux)
20. [File Reference](#file-reference)

---

## Overview

The Playground is an integrated API development workspace that allows users to:

- **Build and send HTTP requests** with full control over method, URL, headers, parameters, cookies, authentication, and request bodies.
- **Manage multiple workspaces** to organize different projects or API sets.
- **Organize APIs** into three categories: *My APIs* (owned), *Connected APIs* (subscribed/recent), and *Local APIs* (user-defined).
- **Save requests** into color-coded collections for reuse and sharing.
- **Track request history** with searchable, timestamped entries.
- **Manage environments** with variables and secrets, using `{{variable}}` substitution syntax.
- **Generate code** in 10+ programming languages from any request configuration.
- **Validate requests** against inferred JSON schemas.
- **Diagnose errors** with AI-powered suggestions for common HTTP error scenarios.
- **Leverage AI assistance** (Pro feature) for request generation, error diagnosis, code generation, and conversational help.

The Playground is accessible as a top-level tab in the Klyra application. When active, it replaces the standard marketplace UI with a dedicated three-panel workspace.

---

## Architecture

The Playground is a full-stack feature with a clear separation between frontend and backend:

```
api-marketplace/
├── backend/
│   └── src/modules/playground/
│       ├── playground.routes.ts      # Express router — all REST endpoints
│       ├── playground.service.ts     # Request execution logic (proxy)
│       ├── playground.storage.ts     # File-based data persistence (JSON)
│       ├── playground.utils.ts       # Shared utility functions
│       └── playground.types.ts       # TypeScript type definitions
├── frontend/
│   ├── src/pages/Playground/
│   │   ├── index.tsx                 # Main Playground page component
│   │   └── styles.css                # All Playground-specific CSS
│   ├── src/components/playground/
│   │   ├── WorkspaceSidebar.tsx      # Left sidebar component
│   │   └── PgAiProBanner.tsx         # Pro upgrade banner
│   ├── src/types/playground.ts       # Frontend TypeScript types
│   ├── src/utils/playground.ts       # Frontend utility functions
│   └── src/services/api/playground.ts # Frontend API client
└── docs/features/playground.md       # This documentation
```

### Backend Stack

| Layer         | Technology         | File(s)                          |
|---------------|--------------------|----------------------------------|
| Routing       | Express.js Router  | `playground.routes.ts`           |
| Business Logic| TypeScript         | `playground.service.ts`          |
| Storage       | Node.js `fs` (JSON)| `playground.storage.ts`          |
| Utilities     | TypeScript         | `playground.utils.ts`            |
| Types         | TypeScript         | `playground.types.ts`            |

### Frontend Stack

| Layer         | Technology         | File(s)                          |
|---------------|--------------------|----------------------------------|
| Page          | React + TypeScript | `pages/Playground/index.tsx`     |
| Sidebar       | React + TypeScript | `components/playground/WorkspaceSidebar.tsx` |
| Pro Banner    | React + TypeScript | `components/playground/PgAiProBanner.tsx`    |
| Styling       | CSS (CSS variables)| `pages/Playground/styles.css`    |
| Types         | TypeScript         | `types/playground.ts`            |
| Utilities     | TypeScript         | `utils/playground.ts`            |
| API Client    | Fetch API          | `services/api/playground.ts`     |

---

## How It Works

### Request Execution Flow

1. **User builds a request** in the center panel — selecting an HTTP method, entering a URL, adding headers/params/cookies/auth, and composing a body.
2. **User clicks "Send"** — the frontend calls `executeRequest()` from `utils/playground.ts`.
3. **Backend proxy attempt** — the frontend first tries to send the request through the backend proxy at `POST /api/playground/execute`. This bypasses CORS restrictions that would occur with direct client-side `fetch()` to external APIs.
4. **Fallback to client-side fetch** — if the backend proxy is unreachable, the frontend falls back to a direct `fetch()` call from the browser.
5. **Response processing** — the response (status, headers, body, timing, size) is returned to the frontend and displayed in the response viewer.
6. **History recording** — the request details are automatically saved to the history (both in the backend store and the frontend state).

### Variable Substitution Flow

1. **Environment selection** — the user selects an active environment from the topbar dropdown.
2. **Variable resolution** — when a request is executed, all `{{variable_name}}` placeholders in the URL, query params, headers, auth fields, and body are replaced with values from the active environment's `variables` and `secrets` maps.
3. **Secrets handling** — secret values are substituted at execution time on the backend but are **never** displayed in the UI, logs, or generated code.

### Data Loading Flow

1. On initial load, the frontend calls `GET /api/playground/data` to fetch the complete playground state.
2. The backend returns all data (workspaces, APIs, collections, history, environments, examples) with **secret values masked** as `••••••••`.
3. The frontend hydrates all state from this single response.
4. Subsequent mutations (create/update/delete) are sent to individual REST endpoints, and the frontend updates its local state optimistically with fallback handling.

---

## Layout & UI Structure

The Playground uses a **three-zone layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                         │
│  [← Back] [Request Name]   [API Context]   [Env ▼] [Save] [⋯]  │
├──────────┬──────────────────────────────────────────┬───────────┤
│  LEFT    │  CENTER (Request Builder + Response)     │  RIGHT    │
│  SIDEBAR │                                          │  SIDEBAR  │
│          │  ┌────────────────────────────────────┐  │  (AI)     │
│          │  │ URL Bar: [GET ▼] [https://...] [Send]│  │           │
│          │  ├────────────────────────────────────┤  │           │
│          │  │ Tabs: Params | Auth | Headers | Body | Cookies │  │           │
│          │  ├────────────────────────────────────┤  │           │
│          │  │ Request Editor Content              │  │           │
│          │  │ (params, headers, auth form, body)  │  │           │
│          │  ├────────────────────────────────────┤  │           │
│          │  │ ─── Draggable Splitter ───         │  │           │
│          │  ├────────────────────────────────────┤  │           │
│          │  │ Response: [200 OK] [⏱ 42ms] [1.2KB]│  │           │
│          │  │ Tabs: Body | JSON Tree | Raw | Headers | Code │  │           │
│          │  │ Response Content                    │  │           │
│          │  └────────────────────────────────────┘  │           │
└──────────┴──────────────────────────────────────────┴───────────┘
```

### Left Sidebar (Workspace Explorer)

The left sidebar can be **expanded** (300px wide) or **collapsed** to a 48px rail. It contains four tabs:

| Tab           | Icon  | Description                                      |
|---------------|-------|--------------------------------------------------|
| **APIs**      | CPU   | Tree view of My APIs, Connected APIs, Local APIs |
| **Collections**| Folder | Saved request collections with color badges     |
| **History**   | Clock | Searchable request history with status indicators|
| **Environments**| Globe | Environment management with variables & secrets |

When collapsed, the sidebar becomes a vertical rail with icon-only buttons for each tab, plus a "New Request" button at the bottom.

### Center Panel (Request Builder + Response)

The center panel is split into two resizable sections:

- **Request Builder** (top, default 45% height):
  - URL bar with method selector and send button
  - Tabbed interface for request configuration
  - Resizable via a draggable splitter handle
  - Can be maximized to fill the entire center area

- **Response Viewer** (bottom, default 55% height):
  - Status badge with color-coded status
  - Response metrics (time, size)
  - Tabbed interface for response viewing
  - Error diagnosis panel (when applicable)

### Right Sidebar (AI Copilot)

The right sidebar (320px wide) can be **expanded** or **collapsed** to a 48px rail. It contains:

- **AI Copilot header** with collapse button
- **Context panel** showing current API, version, endpoint, request, auth, and response info
- **AI chat area** with message history and typing indicator
- **Contextual shortcut chips** that change based on the current state
- **AI input area** with textarea and send button
- **Pro upgrade banner** (when not a Pro user)

---

## Features

### 1. Request Builder

The request builder is the core of the Playground. It provides full control over every aspect of an HTTP request.

#### HTTP Method Selection

A dropdown selector supports all standard HTTP methods:

| Method   | Color     |
|----------|-----------|
| GET      | Green     |
| POST     | Purple    |
| PUT      | Amber     |
| PATCH    | Blue      |
| DELETE   | Red       |
| HEAD     | Indigo    |
| OPTIONS  | Violet    |

#### URL Input

- Free-text URL input with placeholder `https://api.example.com/endpoint`
- **Variable autocomplete**: When the user types `{{` in the URL or JSON body field, an autocomplete dropdown appears showing all available environment variables and secrets. Selecting a variable inserts `{{variable_name}}` at the cursor position.
- The URL input supports `{{variable}}` syntax for environment variable substitution.

#### Request Tabs

Five tabs for configuring different aspects of the request:

| Tab             | KeyValue Items | Description                                      |
|-----------------|----------------|--------------------------------------------------|
| **Params**      | Query params   | URL query parameters (key-value pairs)           |
| **Authorization**| Auth config   | Authentication method and credentials            |
| **Headers**     | HTTP headers   | Custom request headers (key-value pairs)         |
| **Body**        | Body config    | Request body in various formats                  |
| **Cookies**     | Cookie pairs   | HTTP cookies (key-value pairs)                   |

Each key-value row has:
- A **key** input field
- A **value** input field
- An **enable/disable toggle** (eye icon)
- A **remove** button (trash icon)
- An **add row** button at the bottom of each section

Tab badges show the count of enabled items (e.g., `Params (2)`).

#### Authentication

Four authentication types are supported:

| Type       | Fields                          | Description                              |
|------------|---------------------------------|------------------------------------------|
| **No Auth**| None                            | No authentication headers added          |
| **API Key**| Key Name, Key Value, Add to     | API key sent in header or query params   |
| **Bearer** | Bearer Token                    | `Authorization: Bearer <token>` header   |
| **Basic**  | Username, Password              | `Authorization: Basic <base64>` header   |

All auth fields support `{{variable}}` substitution from the active environment.

#### Body Types

Five body types are available:

| Type                     | Description                                      |
|--------------------------|--------------------------------------------------|
| **None**                 | No request body                                  |
| **JSON**                 | JSON editor with syntax highlighting             |
| **Form Data**            | Multipart form data (key-value pairs)            |
| **x-www-form-urlencoded**| URL-encoded form data (key-value pairs)          |
| **Raw**                  | Raw text with language selector (text/json/xml/html) |

The JSON editor supports:
- Variable autocomplete (`{{variable}}` syntax)
- **Prettify** button to format JSON
- **Schema validation** panel (when a schema is inferred from a sample request)

### 2. Response Viewer

The response viewer displays the full HTTP response with multiple viewing modes.

#### Response Meta

- **Status badge**: Color-coded status code with text (e.g., `200 OK`, `404 Not Found`)
  - Green: 2xx (Success)
  - Orange: 3xx (Redirect)
  - Red: 4xx (Client Error) / 5xx (Server Error)
- **Response time**: Displayed in milliseconds or seconds (e.g., `42 ms`, `1.23 s`)
- **Response size**: Formatted in bytes, KB, or MB (e.g., `1.2 KB`, `3.4 MB`)

#### Response Tabs

| Tab        | Icon  | Description                                      |
|------------|-------|--------------------------------------------------|
| **Body**   | Braces| Formatted response body (JSON highlighted or raw text) |
| **JSON Tree**| List | Interactive tree view of JSON response           |
| **Raw**    | File  | Raw response body in a dark code block           |
| **Headers**| Eye   | Response headers in a two-column grid            |
| **Code**   | Code  | Generated code snippet from the request config   |

#### Response Actions

- **Copy**: Copies the response body to clipboard
- **Download**: Downloads the response body as a `.json` file
- **AI Assistant**: Toggle the right sidebar (AI Copilot)

#### Response States

The response area shows different states:

| State         | Icon         | Description                              |
|---------------|--------------|------------------------------------------|
| **Loading**   | Spinner      | "Executing request..." with animated loader |
| **Empty**     | Terminal     | "Send a request to see the response"     |
| **Error**     | Alert Circle | Error details with diagnosis suggestions |
| **Success**   | (content)    | Response content in the active tab       |

### 3. Workspace Management

Workspaces allow users to organize their API projects.

#### Workspace Operations

| Action   | Method | Description                              |
|----------|--------|------------------------------------------|
| Create   | POST   | Create a new workspace with a name       |
| Rename   | PATCH  | Change the workspace name                |
| Pin      | POST   | Toggle pinned status (appears in sidebar)|
| Delete   | DELETE | Remove a workspace                       |

#### Workspace Properties

| Property    | Type      | Description                              |
|-------------|-----------|------------------------------------------|
| `id`        | string    | Unique identifier (e.g., `ws-abc123`)    |
| `name`      | string    | Display name                             |
| `isPinned`  | boolean   | Whether the workspace is pinned          |
| `isDefault` | boolean   | Whether this is the default workspace    |
| `createdAt` | string    | ISO timestamp of creation                |

#### Pinned Section

Pinned workspaces appear at the top of the left sidebar's APIs tab, with a star icon. If no workspaces are pinned, a placeholder message is shown: "Pin items to keep them handy."

### 4. API Organization

APIs are organized into three groups in the left sidebar:

#### API Groups

| Group           | Icon    | Source Values             | Description                              |
|-----------------|---------|---------------------------|------------------------------------------|
| **My APIs**     | Database| `my-apis`                 | APIs owned by the current user           |
| **Connected APIs**| Network | `subscribed`, `recent`   | APIs the user has subscribed to or recently used |
| **Local APIs**  | Rocket  | `local`                   | User-defined local API endpoints         |

#### API Tree View

Each API in the tree shows:
- API name with colored dot (accent color)
- Badges: `Owned`, `Sub` (subscribed), `Local`, `Draft`
- Endpoint count
- Version information (with `Draft` badge for unpublished versions)
- Endpoints listed under each version with method and path

#### API Operations

| Action           | Description                              |
|------------------|------------------------------------------|
| Add Local API    | Create a local API with a base URL       |
| Add Connected API| Create a connected API with name + URL   |
| Import API       | Import via OpenAPI/Swagger spec (Pro)    |
| Search           | Filter APIs by name                      |
| Source Filter    | Filter by API source (my-apis, subscribed, recent, all) |

#### Context Menu

Right-clicking (via the `⋮` context trigger) on any API, endpoint, collection, local API, or workspace reveals a context menu with actions:

| Item Type     | Available Actions                              |
|---------------|-------------------------------------------------|
| Workspace     | Open, Rename, Pin, Move, Duplicate, Settings, Delete |
| API           | Open, Test, Rename, Pin, Move, Duplicate, Settings, Delete |
| Collection    | Open, Run Collection, Rename, Pin, Move, Duplicate, Settings, Delete |
| Local API     | Open, Test, Rename, Pin, Move, Duplicate, Settings, Delete |
| Endpoint      | Open, Test, Duplicate, Delete                   |
| Group         | New Folder, New Test File                       |

### 5. Collections

Collections allow users to save and organize request configurations.

#### Collection Properties

| Property      | Type             | Description                              |
|---------------|------------------|------------------------------------------|
| `id`          | string           | Unique identifier                        |
| `name`        | string           | Collection name                          |
| `description` | string           | Optional description                     |
| `color`       | string           | Hex color for the collection badge       |
| `requests`    | SavedRequest[]   | Array of saved requests                  |
| `createdAt`   | string           | ISO timestamp                            |
| `updatedAt`   | string           | ISO timestamp of last update             |

#### Saved Request Properties

| Property      | Type            | Description                              |
|---------------|-----------------|------------------------------------------|
| `id`          | string          | Unique identifier                        |
| `name`        | string          | Request name                             |
| `collectionId`| string?         | Parent collection ID                     |
| `config`      | RequestConfig   | Full request configuration               |
| `createdAt`   | string          | ISO timestamp                            |
| `updatedAt`   | string          | ISO timestamp                            |

#### Collection Operations

- **Create**: New collection with auto-generated random color
- **Update**: Modify name, description, color, or requests
- **Delete**: Remove collection and all its requests
- **Add Request**: Save current request to a collection
- **Remove Request**: Delete a saved request from a collection
- **Load Request**: Load a saved request back into the request builder
- **Search**: Filter collections by name

### 6. History

Every executed request is automatically recorded in the history.

#### History Entry Properties

| Property        | Type      | Description                              |
|-----------------|-----------|------------------------------------------|
| `id`            | string    | Unique identifier                        |
| `requestName`   | string    | Name of the request                      |
| `method`        | HttpMethod| HTTP method used                         |
| `url`           | string    | Request URL                              |
| `status`        | number    | HTTP status code                         |
| `statusText`    | string    | Status text (e.g., "OK", "Not Found")    |
| `timeMs`        | number    | Response time in milliseconds            |
| `timestamp`     | string    | ISO timestamp of execution               |
| `responseBody`  | string?   | Response body (if available)             |
| `collectionId`  | string?   | Associated collection (if saved)         |
| `apiId`         | string?   | Associated API (if applicable)           |

#### History Operations

- **Automatic recording**: Each request execution adds a history entry
- **Search**: Filter by request name or URL
- **Load**: Click a history entry to load it back into the request builder
- **Delete single**: Remove an individual history entry
- **Clear all**: Delete the entire history (capped at 100 entries server-side)

### 7. Environments

Environments allow users to manage different sets of variables for different deployment targets (e.g., Development, Staging, Production).

#### Environment Properties

| Property    | Type                     | Description                              |
|-------------|--------------------------|------------------------------------------|
| `id`        | string                   | Unique identifier                        |
| `name`      | string                   | Environment name (e.g., "Development")   |
| `variables` | Record<string, string>   | Non-secret key-value pairs               |
| `secrets`   | Record<string, string>   | Secret key-value pairs (masked in UI)    |
| `baseUrl`   | string?                  | Optional base URL                        |
| `isDefault` | boolean?                 | Whether this is the default environment  |

#### Environment Operations

- **Create**: New environment with empty variables and secrets
- **Edit**: Full modal editor with:
  - Environment name field
  - Variables table (key-value pairs with add/remove)
  - Secrets table (key-value pairs with masked display)
  - Security note about `{{variable}}` syntax
- **Delete**: Remove an environment (default environments cannot be deleted)
- **Select**: Choose active environment from the topbar dropdown

#### Environment Editor Modal

The environment editor is a modal dialog with:

- **Environment Name** input field
- **Variables section**:
  - Header with "Add Variable" button
  - List of variable rows (key input, value input, remove button)
- **Secrets section**:
  - Header with "Add Secret" button
  - List of secret rows (key input, masked value input with `••••••••` overlay, remove button)
- **Security note**: "Variables are referenced using `{{variable}}` syntax. Secrets are always masked in the UI and never exposed in logs or generated code."

### 8. Variable Substitution

Variables are referenced using the `{{variable_name}}` syntax in:

- **URL**: e.g., `{{BASE_URL}}/users/{{USER_ID}}`
- **Query params**: Values can contain `{{variable}}`
- **Headers**: Values can contain `{{variable}}`
- **Auth fields**: Bearer token, API key value, basic username/password
- **JSON body**: Any string value can contain `{{variable}}`
- **Raw body**: Any text can contain `{{variable}}`
- **Form data / URL-encoded**: Field values can contain `{{variable}}`

#### Variable Autocomplete

When the user types `{{` in the URL input or JSON body editor, an autocomplete dropdown appears:

- Shows all variable and secret names from the active environment
- Supports filtering by typing after `{{`
- Clicking a variable inserts `{{variable_name}}` at the cursor position
- Positioned dynamically based on cursor location

### 9. Schema-Aware Request Editor

The Playground can infer a JSON schema from a sample request body and validate the current request against it.

#### Schema Inference

- Triggered when an API endpoint has a `sampleRequest` (JSON string)
- The `inferSchemaFromJson()` utility parses the JSON and builds a tree of `SchemaField` objects
- Each field has: name, type, required flag, description, default value, and children (for nested objects/arrays)

#### Schema Field Types

| Type      | Description                              |
|-----------|------------------------------------------|
| string    | Text value                               |
| number    | Numeric value                            |
| boolean   | True/false value                         |
| object    | Nested object with children fields       |
| array     | Array with item type and optional children|
| null      | Null value                               |
| any       | Unknown type                             |

#### Validation

The `validateRequestAgainstSchema()` function checks:

- **Required fields**: Reports missing required fields as errors
- **Undefined fields**: Reports fields set to `undefined` as warnings
- **Unknown fields**: The `getUnknownFields()` function reports fields not in the schema as warnings

#### Validation Display

When schema issues are found, a validation panel appears below the JSON editor:

- Shows issue count: "Schema Validation (N issues)"
- Lists each issue with:
  - Field path (monospace font)
  - Message
  - Severity indicator (error = red, warning = amber, info = muted)

### 10. Error Diagnosis

When a request results in an error (timeout, network error, 4xx, 5xx), the Playground automatically generates an error diagnosis with actionable suggestions.

#### Error Types

| Error Type         | Trigger Conditions                          |
|--------------------|---------------------------------------------|
| **Timeout**        | `isTimeout === true` (30s exceeded)         |
| **Network Error**  | `isNetworkError === true`                   |
| **401 Unauthorized** | `status === 401`                          |
| **403 Forbidden**  | `status === 403`                            |
| **404 Not Found**  | `status === 404`                            |
| **422 Unprocessable**| `status === 422`                          |
| **429 Too Many**   | `status === 429`                            |
| **5xx Server Error**| `status >= 500`                          |
| **4xx Client Error**| `status >= 400` (generic)                 |

#### Diagnosis Structure

Each diagnosis includes:

- **Title**: Short error description (e.g., "Unauthorized (401)")
- **Message**: Detailed explanation
- **Suggestions**: Array of cause/fix pairs:
  - `cause`: What likely went wrong
  - `fix`: How to resolve it
  - `actionable`: Whether a fix action is available
  - `action`: Optional callback function

#### Example Diagnosis (401)

```
Title: Unauthorized (401)
Message: Authentication is required or the provided credentials are invalid.
Suggestions:
  - Cause: Missing or invalid API key
    Fix: Check the Authorization header or API key in the Auth tab.
  - Cause: Expired token
    Fix: Refresh your token and try again.
```

### 11. Code Generation

The Playground can generate code snippets in 10 programming languages from the current request configuration.

#### Supported Languages

| Language Key           | Display Name              |
|------------------------|---------------------------|
| `curl`                 | cURL                      |
| `javascript-fetch`     | JavaScript (Fetch)        |
| `javascript-axios`     | JavaScript (Axios)        |
| `python-requests`      | Python (Requests)         |
| `node`                 | Node.js                   |
| `php`                  | PHP                       |
| `java`                 | Java                      |
| `csharp`               | C#                        |
| `go`                   | Go                        |
| `ruby`                 | Ruby                      |

#### Secure Code Generation

The `generateSecureCode()` function ensures secrets are never hardcoded:

1. **Secret detection**: Headers with keys matching patterns like `key`, `token`, `secret`, `password`, `authorization`, `apikey`, `api_key`, `bearer` are identified as secrets.
2. **Environment variable references**: Secret values are replaced with environment variable references:
   - JavaScript/Node.js: `process.env.VARIABLE_NAME`
   - Python: `os.environ.get("VARIABLE_NAME", "")`
   - PHP: `getenv('VARIABLE_NAME')`
   - Java: `System.getenv("VARIABLE_NAME")`
   - C#: `Environment.GetEnvironmentVariable("VARIABLE_NAME")`
   - Go: `os.Getenv("VARIABLE_NAME")`
   - Ruby: `ENV["VARIABLE_NAME"]`
   - cURL: `${VARIABLE_NAME}` (shell variable)
3. **Regular headers**: Non-secret headers are included as-is.

#### Code Generation Panel

The code generation panel (accessible via the "Code" response tab) includes:

- Language selector dropdown
- Copy button (with "Copied!" feedback)
- Read-only code display in a dark-themed code block

### 12. AI Copilot (Pro Feature)

The AI Copilot is a chat-based assistant in the right sidebar that provides AI-powered assistance for API development.

#### AI Actions

| Action ID              | Label                | Icon  | Description                              |
|------------------------|----------------------|-------|------------------------------------------|
| `generate-request`     | Generate Request     | Zap   | Generate a request from a description    |
| `explain-request`      | Explain Request      | Book  | Explain what a request does              |
| `diagnose-error`       | Diagnose Error       | Bug   | Analyze and explain an error response    |
| `fix-request`          | Fix Request          | Wrench| Suggest fixes for a failed request       |
| `explain-response`     | Explain Response     | File  | Explain a response body                  |
| `generate-code`        | Generate Code        | Code  | Generate code from the request           |
| `recommend-endpoint`   | Recommend Endpoint   | Compass| Suggest relevant API endpoints          |
| `suggest-improvements` | Suggest Improvements | Sparkles| Suggest optimizations for the request   |
| `ask-ai`               | Ask AI               | Bot   | Free-form chat with the AI assistant     |

#### Contextual Shortcuts

The AI sidebar shows context-aware shortcut chips based on the current state:

| State                           | Suggested Actions                              |
|---------------------------------|-------------------------------------------------|
| Error response (4xx/5xx/timeout)| Diagnose Error, Fix Request, Explain Error      |
| Successful response (2xx)       | Explain Response, Generate Code, Optimize       |
| Request has URL                 | Generate Request, Explain API, Add Auth         |
| Default (no context)            | Generate Request, Explain Response, Generate Code, Optimize |

#### Pro Upgrade Flow

When a non-Pro user attempts to use an AI action:

1. A Pro upgrade banner message appears in the AI chat
2. The message includes: "This is a **Pro feature**. Upgrade to Klyra Pro to use [action name]."
3. An "Upgrade to Pro" button is shown
4. The right sidebar is automatically expanded to show the message

#### AI Chat Interface

- **Message history**: All user and assistant messages are displayed
- **Typing indicator**: "Thinking..." with animated spinner when AI is processing
- **Input area**: Textarea with `Enter` to send, `Shift+Enter` for new line
- **Clear conversation**: Button to clear all messages
- **Auto-scroll**: Chat automatically scrolls to the bottom as new messages arrive

#### Context Panel

The AI sidebar displays the current context:

- **API**: Name of the selected API (if any)
- **Version**: API version (if selected)
- **Endpoint**: HTTP method and path (if selected)
- **Request**: Method and URL of the current request
- **Auth**: Current authentication type
- **Response**: Status code and text (if a response exists)

### 13. Save as API Example

Users can save a request/response pair as an API example:

- **Trigger**: "Save as Example" button in the topbar
- **Modal fields**:
  - Example Name (required)
  - Description (optional)
  - Auto-filled request details (endpoint, response status)
- **Storage**: Examples are saved to the backend and displayed in the examples list
- **Association**: Examples can be linked to a specific API and endpoint

### 14. Request Management

#### Topbar Actions

| Action              | Icon  | Description                              |
|---------------------|-------|------------------------------------------|
| Save                | Save  | Save current request to the first collection (or create one) |
| Save as Example     | File  | Save request/response as an API example  |
| Duplicate           | Copy  | Create a copy of the current request     |
| More Actions        | ⋮     | Additional actions menu                  |

#### Save Request Flow

1. If a collection exists, the request is saved to the first collection
2. If no collection exists, a new "My Collection" is created with the request
3. Both backend and frontend state are updated
4. Fallback to local state if the backend call fails

#### Duplicate Request

Creates a copy of the current request with:
- New ID (generated)
- Name suffixed with " (Copy)"
- All other properties preserved

### 15. Split View & Layout Controls

#### Resizable Splitter

- A draggable splitter handle between the request builder and response viewer
- Default split ratio: 45% (request) / 55% (response)
- Adjustable between 20% and 80%
- Visual grip with dotted drag handle
- Hover and active states with purple accent

#### Maximize Request

- Toggle button to maximize the request builder to fill the entire center area
- Hides the response viewer and splitter when maximized

#### Sidebar Controls

| Sidebar | Expand/Collapse | Default State |
|---------|-----------------|---------------|
| Left    | Chevron button  | Collapsed (rail mode) |
| Right   | Chevron button  | Expanded      |

### 16. Modals

The Playground uses several modal dialogs:

| Modal                  | Trigger                          | Purpose                              |
|------------------------|----------------------------------|--------------------------------------|
| Input Modal            | Create workspace, add API, etc.  | Generic text input for names/URLs    |
| Save as Example Modal  | Topbar "Save as Example" button  | Save request as API example          |
| Environment Editor     | Environment edit button          | Edit environment variables & secrets |

All modals use a consistent design:
- Semi-transparent overlay with blur
- Card-style dialog with header, body, and action buttons
- Close on overlay click or Escape key
- Primary/secondary button styling

---

## Connections

### Frontend ↔ Backend Communication

The frontend communicates with the backend exclusively through REST API calls via the `playgroundApi` service module.

#### API Client

**File**: `frontend/src/services/api/playground.ts`

The `playgroundApi` object provides typed methods for all backend operations:

```typescript
const API_BASE_URL = '/api/playground';
```

| Method                     | HTTP Method | Endpoint                              |
|----------------------------|-------------|---------------------------------------|
| `fetchPlaygroundData()`    | GET         | `/data`                               |
| `createWorkspace(name)`    | POST        | `/workspaces`                         |
| `renameWorkspace(id, name)`| PATCH       | `/workspaces/:id`                     |
| `togglePinWorkspace(id)`   | POST        | `/workspaces/:id/pin`                 |
| `deleteWorkspace(id)`      | DELETE      | `/workspaces/:id`                     |
| `createLocalApi(api)`      | POST        | `/local-apis`                         |
| `deleteLocalApi(id)`       | DELETE      | `/local-apis/:id`                     |
| `createCollection(col)`    | POST        | `/collections`                        |
| `updateCollection(col)`    | PUT         | `/collections/:id`                    |
| `deleteCollection(id)`     | DELETE      | `/collections/:id`                    |
| `addRequestToCollection()` | POST        | `/collections/:id/requests`           |
| `deleteRequestFromCollection()` | DELETE | `/collections/:cid/requests/:rid`   |
| `addHistoryEntry(entry)`   | POST        | `/history`                            |
| `clearHistory()`           | DELETE      | `/history`                            |
| `deleteHistoryEntry(id)`   | DELETE      | `/history/:id`                        |
| `createEnvironment(env)`   | POST        | `/environments`                       |
| `updateEnvironment(env)`   | PUT         | `/environments/:id`                   |
| `deleteEnvironment(id)`    | DELETE      | `/environments/:id`                   |
| `executeRequest(config, env)` | POST     | `/execute`                            |

#### Error Handling

The API client uses a `handleResponse<T>()` helper that:

1. Checks `res.ok` — if not, parses the error response body
2. Attempts to extract an `error` field from JSON error responses
3. Falls back to `HTTP {status}: {statusText}` format
4. Throws an `Error` with the message
5. Returns `{}` for 204 No Content responses
6. Returns parsed JSON for successful responses

#### Fallback Strategy

The frontend implements a dual-execution strategy for request execution:

1. **Primary**: Send request through backend proxy (`POST /api/playground/execute`)
2. **Fallback**: If the backend is unreachable, execute the request directly from the browser using `fetch()`

This ensures the Playground remains functional even if the backend service is down.

### Backend Route Registration

**File**: `backend/src/app.ts`

The playground router is mounted at `/api/playground`:

```typescript
app.use('/api/playground', playgroundRouter);
```

The Express app also includes:
- CORS middleware (allows all origins)
- Body parsing (`express.json` with 10MB limit, `express.urlencoded`)
- Health check endpoint at `/api/health`

### Backend Server

**File**: `backend/src/server.ts`

- Listens on port 4000 (or `PORT` env variable)
- Handles `SIGTERM` for graceful shutdown

### Frontend Routing

**File**: `frontend/src/App.tsx`

The Playground is integrated as a top-level tab in the main application:

```typescript
{activeTab === 'playground' ? (
  <PlaygroundPage onBackToKlyra={() => setActiveTab('home')} />
) : (
  // Standard marketplace UI
)}
```

- The Playground is the **default tab** (persisted in `localStorage` as `activeTab`)
- When active, the standard Klyra topbar and sidebar are hidden
- The `onBackToKlyra` callback switches back to the home tab

---

## Properties & Configuration

### State Management

The Playground uses React's `useState` and `useEffect` hooks for all state management. There is no external state management library (Redux, Zustand, etc.).

#### Core State Variables

| State Variable              | Type                          | Description                              |
|-----------------------------|-------------------------------|------------------------------------------|
| `config`                    | `RequestConfig`               | Current request configuration            |
| `response`                  | `PlaygroundResponse \| null`  | Last response received                   |
| `isLoading`                 | `boolean`                     | Whether a request is in progress         |
| `activeRequestTab`          | `RequestTab`                  | Active request configuration tab         |
| `activeResponseTab`         | `ResponseTab`                 | Active response viewing tab              |
| `isLeftExpanded`            | `boolean`                     | Left sidebar expanded state              |
| `isRightExpanded`           | `boolean`                     | Right AI sidebar expanded state          |
| `workspaceTab`              | `WorkspaceTab`                | Active left sidebar tab                  |
| `isRequestMaximized`        | `boolean`                     | Whether request builder is maximized     |
| `splitRatio`                | `number`                      | Split ratio between request/response     |
| `environments`              | `Environment[]`               | All environments                         |
| `activeEnvironment`         | `Environment \| null`         | Currently selected environment           |
| `collections`               | `Collection[]`                | All saved collections                    |
| `history`                   | `HistoryEntry[]`              | Request history entries                  |
| `workspaceApis`             | `ApiWorkspaceItem[]`          | All workspace APIs                       |
| `userWorkspaces`            | `UserWorkspace[]`             | All user workspaces                      |
| `localApis`                 | `LocalApi[]`                  | All local APIs                           |
| `aiMessages`                | `AiMsg[]`                     | AI chat message history                  |
| `isAiThinking`              | `boolean`                     | AI is processing a response            |
| `proUser`                   | `boolean`                     | Whether the user has Pro access          |
| `inferredSchema`            | `SchemaField[]`               | Inferred JSON schema from sample         |
| `schemaIssues`              | `RequestValidationIssue[]`    | Schema validation issues                 |
| `savedExamples`             | `ApiExample[]`                | Saved API examples                       |

### Layout Configuration

| Property              | Default | Persistence         | Description                              |
|-----------------------|---------|---------------------|------------------------------------------|
| `isLeftExpanded`      | `false` | `localStorage`      | Left sidebar expanded state              |
| `isRightExpanded`     | `true`  | None                | Right AI sidebar expanded state          |
| `splitRatio`          | `45`    | None                | Request/response split percentage        |
| `workspaceTab`        | `'apis'`| None                | Active left sidebar tab                  |
| `expandedApiGroups`   | `{my-apis: false, connected: false, local: false}` | `localStorage` | API group expansion state |
| `expandedApiIds`      | `{}`    | `localStorage`      | Individual API expansion state           |
| `activeWorkspaceId`   | First workspace | None       | Active workspace ID                    |
| `activeEnvironment`   | First environment | None       | Active environment                     |

### UI Configuration

| Property              | Default | Description                              |
|-----------------------|---------|------------------------------------------|
| `TIMEOUT_MS`          | `30000` | Request execution timeout (30 seconds)   |
| `History cap`         | `100`   | Maximum history entries stored           |
| `Method colors`       | See table | HTTP method color coding               |
| `AI shortcut delay`   | `900ms` | Simulated AI response delay              |

### CSS Custom Properties

The Playground uses CSS custom properties (variables) for theming, inheriting from the global Klyra theme:

| Variable              | Purpose                              |
|-----------------------|--------------------------------------|
| `--bg-app`            | Main background color                |
| `--bg-sidebar`        | Sidebar background color             |
| `--bg-card`           | Card/background color                |
| `--bg-input`          | Input field background               |
| `--bg-topbar`         | Topbar background color              |
| `--bg-modal`          | Modal background color               |
| `--bg-pill`           | Pill/badge background                |
| `--text-primary`      | Primary text color                   |
| `--text-secondary`    | Secondary text color                 |
| `--text-muted`        | Muted text color                     |
| `--text-accent`       | Accent text color                    |
| `--border-card`       | Card border color                    |
| `--border-subtle`     | Subtle border color                  |
| `--accent-purple`     | Primary accent color                 |
| `--accent-gradient`   | Gradient accent (buttons, badges)    |
| `--accent-gradient-hover` | Hover state gradient             |
| `--shadow-purple`     | Purple shadow (buttons)              |
| `--shadow-md`         | Medium shadow                        |
| `--shadow-lg`         | Large shadow                         |
| `--radius-md`         | Medium border radius                 |
| `--radius-lg`         | Large border radius                  |
| `--font-sans`         | Sans-serif font family               |
| `--font-mono`         | Monospace font family                |

---

## Data Model

### PlaygroundData (Root Container)

The complete playground state, returned by `GET /api/playground/data`:

```typescript
interface PlaygroundData {
  userWorkspaces: UserWorkspace[];
  workspaceApis: ApiWorkspaceItem[];
  localApis: LocalApi[];
  collections: Collection[];
  history: HistoryEntry[];
  environments: Environment[];
  apiExamples: ApiExample[];
}
```

### Type Definitions

All types are defined in two parallel files:
- **Backend**: `backend/src/modules/playground/playground.types.ts`
- **Frontend**: `frontend/src/types/playground.ts`

The frontend types include additional types for UI-specific features (schema validation, AI actions, etc.) that are not present in the backend types.

#### Core Types

| Type                  | File Location | Description                              |
|-----------------------|---------------|------------------------------------------|
| `HttpMethod`          | Both          | Union: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| `AuthType`            | Both          | Union: no-auth, api-key, bearer, basic   |
| `BodyType`            | Both          | Union: none, json, form-data, x-www-form-urlencoded, raw |
| `KeyValueItem`        | Both          | Key-value pair with enable flag          |
| `AuthConfig`          | Both          | Authentication configuration             |
| `BodyConfig`          | Both          | Request body configuration               |
| `RequestConfig`       | Both          | Complete request configuration           |
| `PlaygroundResponse`  | Both          | HTTP response with metadata              |
| `Environment`         | Both          | Environment with variables and secrets   |
| `Collection`          | Both          | Saved request collection                 |
| `SavedRequest`        | Both          | A saved request in a collection          |
| `HistoryEntry`        | Both          | Request history entry                    |
| `UserWorkspace`       | Both          | User workspace                           |
| `ApiWorkspaceItem`    | Both          | API in the workspace                     |
| `ApiVersionInfo`      | Both          | API version with endpoints               |
| `ApiWorkspaceEndpoint`| Both          | Individual API endpoint                  |
| `LocalApi`            | Both          | User-defined local API                   |
| `ApiExample`          | Both          | Saved request/response example           |
| `ExecuteRequestPayload`| Backend only | Payload for execute endpoint             |

#### Frontend-Only Types

| Type                  | Description                              |
|-----------------------|------------------------------------------|
| `RequestTab`          | Union: params, headers, auth, body, cookies |
| `ResponseTab`         | Union: body, json-tree, headers, raw, code |
| `AiAction`            | Union of all AI action types             |
| `AiMessage`           | AI chat message                          |
| `SchemaField`         | JSON schema field for validation         |
| `SchemaFieldType`     | Union: string, number, boolean, object, array, null, any |
| `RequestValidationIssue` | Validation issue with severity         |
| `SchemaValidationResult` | Result of schema validation            |
| `ErrorSuggestion`     | Cause/fix pair for error diagnosis       |
| `ErrorDiagnosis`      | Complete error diagnosis                 |
| `CodeLanguage`        | Union of supported code generation languages |
| `ApiSource`           | Union: my-apis, subscribed, recent       |
| `ApiGroupId`          | Union: my-apis, connected, local         |
| `WorkspaceTab`        | Union: apis, collections, history, environments |
| `JsonNode`            | Node in JSON tree view                   |
| `CodeGenInput`        | Input for code generation                |

---

## Backend API Reference

**Base URL**: `/api/playground`

All endpoints return JSON. Error responses use the format:
```json
{ "error": "Error message" }
```

### Data

#### GET `/data`

Returns the complete playground data with all secret values masked as `••••••••`.

**Response (200):**
```json
{
  "userWorkspaces": [...],
  "workspaceApis": [...],
  "localApis": [...],
  "collections": [...],
  "history": [...],
  "environments": [...],
  "apiExamples": [...]
}
```

### Workspaces

#### GET `/workspaces`

List all user workspaces.

**Response (200):** `UserWorkspace[]`

#### POST `/workspaces`

Create a new workspace.

**Request Body:**
```json
{ "name": "My Workspace" }
```

**Response (201):** `UserWorkspace`

**Errors:**
- 400: `Workspace name is required`

#### PATCH `/workspaces/:id`

Rename a workspace.

**Request Body:**
```json
{ "name": "New Name" }
```

**Response (200):** `UserWorkspace`

**Errors:**
- 404: `Workspace not found`

#### POST `/workspaces/:id/pin`

Toggle the pinned status of a workspace.

**Response (200):** `UserWorkspace`

**Errors:**
- 404: `Workspace not found`

#### DELETE `/workspaces/:id`

Delete a workspace.

**Response (204):** No content

**Errors:**
- 404: `Workspace not found`

### Workspace APIs

#### GET `/apis`

List all workspace APIs.

**Response (200):** `ApiWorkspaceItem[]`

#### POST `/apis`

Create a new workspace API.

**Request Body:**
```json
{
  "id": "api-123",
  "name": "My API",
  "source": "my-apis",
  "versions": [...]
}
```

**Response (201):** The created API object

**Errors:**
- 400: `API id and name are required`

#### PUT `/apis/:id`

Update an existing workspace API.

**Request Body:** Full API object (id must match `:id`)

**Response (200):** Updated API object

**Errors:**
- 400: `API id mismatch`
- 404: `API not found`

#### DELETE `/apis/:id`

Delete a workspace API.

**Response (204):** No content

**Errors:**
- 404: `API not found`

### Local APIs

#### GET `/local-apis`

List all local APIs.

**Response (200):** `LocalApi[]`

#### POST `/local-apis`

Create a new local API.

**Request Body:**
```json
{
  "id": "local-123",
  "name": "My Local API",
  "baseUrl": "http://localhost:5000/api",
  "endpoints": [...]
}
```

**Response (201):** `LocalApi` (with `source: 'local'`, `isLocal: true`)

**Errors:**
- 400: `Local API id and baseUrl are required`

#### DELETE `/local-apis/:id`

Delete a local API.

**Response (204):** No content

**Errors:**
- 404: `Local API not found`

### Collections

#### GET `/collections`

List all collections.

**Response (200):** `Collection[]`

#### POST `/collections`

Create a new collection.

**Request Body:**
```json
{
  "name": "My Collection",
  "description": "API requests for project X",
  "color": "#10b981",
  "requests": []
}
```

**Response (201):** `Collection` (with auto-generated id, timestamps)

**Errors:**
- 400: `Collection name is required`

#### PUT `/collections/:id`

Update an existing collection.

**Request Body:** Full collection object (id must match `:id`)

**Response (200):** Updated `Collection`

**Errors:**
- 400: `Collection id mismatch`
- 404: `Collection not found`

#### DELETE `/collections/:id`

Delete a collection.

**Response (204):** No content

**Errors:**
- 404: `Collection not found`

#### POST `/collections/:id/requests`

Add a request to a collection.

**Request Body:**
```json
{
  "id": "req-123",
  "name": "Get Users",
  "config": { ... },
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response (201):** Updated `Collection`

**Errors:**
- 400: `Request id is required`
- 404: `Collection not found`

#### DELETE `/collections/:collectionId/requests/:requestId`

Remove a request from a collection.

**Response (200):** Updated `Collection`

**Errors:**
- 404: `Collection not found`

### History

#### GET `/history`

List all history entries (most recent first, capped at 100).

**Response (200):** `HistoryEntry[]`

#### POST `/history`

Add a new history entry.

**Request Body:**
```json
{
  "requestName": "Get Users",
  "method": "GET",
  "url": "https://api.example.com/users",
  "status": 200,
  "statusText": "OK",
  "timeMs": 42,
  "responseBody": "...",
  "apiId": "api-123"
}
```

**Response (201):** `HistoryEntry` (with auto-generated id and timestamp)

**Errors:**
- 400: `History entry requires requestName and url`

#### DELETE `/history`

Clear all history entries.

**Response (204):** No content

#### DELETE `/history/:id`

Delete a specific history entry.

**Response (204):** No content

**Errors:**
- 404: `History entry not found`

### Environments

#### GET `/environments`

List all environments.

**Response (200):** `Environment[]`

#### POST `/environments`

Create a new environment.

**Request Body:**
```json
{
  "name": "Staging",
  "variables": { "BASE_URL": "https://staging.api.com" },
  "secrets": { "API_KEY": "secret123" },
  "isDefault": false
}
```

**Response (201):** `Environment` (with auto-generated id)

**Errors:**
- 400: `Environment name is required`

#### PUT `/environments/:id`

Update an existing environment.

**Request Body:** Full environment object (id must match `:id`)

**Response (200):** Updated `Environment`

**Errors:**
- 400: `Environment id mismatch`
- 404: `Environment not found`

#### DELETE `/environments/:id`

Delete an environment.

**Response (204):** No content

**Errors:**
- 404: `Environment not found`

### API Examples

#### GET `/examples`

List all saved API examples.

**Response (200):** `ApiExample[]`

#### POST `/examples`

Create a new API example.

**Request Body:**
```json
{
  "id": "example-123",
  "name": "Get Users Example",
  "description": "Example of fetching users",
  "apiId": "api-123",
  "endpointId": "ep-456",
  "request": { ... },
  "response": { ... },
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response (201):** The created example

**Errors:**
- 400: `Example id and name are required`

#### DELETE `/examples/:id`

Delete an API example.

**Response (204):** No content

**Errors:**
- 404: `Example not found`

### Execute Request

#### POST `/execute`

Execute an HTTP request through the backend proxy. This endpoint bypasses CORS restrictions by making the request server-side.

**Request Body:**
```json
{
  "config": {
    "id": "req-123",
    "name": "Get Users",
    "method": "GET",
    "url": "https://api.example.com/users",
    "params": [...],
    "headers": [...],
    "cookies": [...],
    "auth": { "type": "bearer", "bearerToken": "..." },
    "body": { "type": "none" }
  },
  "environment": {
    "id": "env-1",
    "name": "Development",
    "variables": { "BASE_URL": "https://api.example.com" },
    "secrets": { "API_KEY": "secret123" }
  }
}
```

**Response (200):** `PlaygroundResponse`

**Errors:**
- 400: `Request config with a URL is required`
- 500: `Request execution failed` (with error message)

---

## Frontend API Service

**File**: `frontend/src/services/api/playground.ts`

The `playgroundApi` object is the single interface between the frontend and backend. It wraps all REST endpoints with typed methods.

### Response Handling

The `handleResponse<T>()` function:

1. Checks if the response is OK (`res.ok`)
2. For non-OK responses, attempts to parse the error body as JSON to extract an `error` field
3. Falls back to `HTTP {status}: {statusText}` if no JSON error is found
4. Throws an `Error` with the extracted message
5. Returns `{}` for 204 No Content responses
6. Returns parsed JSON for successful responses

### Base URL

All API calls use the base URL `/api/playground`, which is relative to the frontend's origin. This works because the frontend and backend are served from the same origin in development (via proxy) and production.

---

## Security

### Secret Management

The Playground implements a multi-layered approach to secret security:

#### 1. UI Masking

- Secret values are displayed as `••••••••` in the environment editor
- The environment editor shows a masked overlay behind the password input field
- The `/data` endpoint returns all secrets masked as `••••••••`

#### 2. Code Generation Security

The `generateSecureCode()` function ensures secrets are never hardcoded in generated code:

- **Secret detection**: Header keys matching patterns (`key`, `token`, `secret`, `password`, `authorization`, `auth`, `apikey`, `api_key`, `bearer`) are identified as secrets
- **Environment variable references**: Secrets are replaced with language-appropriate environment variable access:
  - JavaScript/Node.js: `process.env.VARIABLE_NAME`
  - Python: `os.environ.get("VARIABLE_NAME", "")`
  - PHP: `getenv('VARIABLE_NAME')`
  - Java: `System.getenv("VARIABLE_NAME")`
  - C#: `Environment.GetEnvironmentVariable("VARIABLE_NAME")`
  - Go: `os.Getenv("VARIABLE_NAME")`
  - Ruby: `ENV["VARIABLE_NAME"]`
  - cURL: `${VARIABLE_NAME}` (shell variable)

#### 3. Response Body Masking

The `maskSecretsInResponse()` function (in `playground.service.ts`) replaces `{{...}}` patterns in response bodies with `[MASKED_SECRET]` to prevent secret leakage in responses.

#### 4. Backend Secret Handling

- The backend's `/data` endpoint creates a secure copy of all data with secrets masked before sending to the UI
- The `createSecureEnvironmentCopy()` function masks all secret values as `••••••••`
- Secrets are only used for variable substitution during request execution and are never logged

#### 5. CORS Configuration

The backend enables CORS for all origins:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization
```

### Request Timeout

All requests have a 30-second timeout (`TIMEOUT_MS = 30000`). If a request exceeds this limit, it is aborted and a timeout error is returned.

---

## Data Persistence

### Storage Mechanism

The backend uses a **file-based JSON storage** system:

- **Data directory**: `.data/` (relative to the backend's working directory)
- **Data file**: `.data/playground.json`
- **Format**: JSON with 2-space indentation

### Persistence Behavior

- The `PlaygroundStore` class is instantiated as a singleton (`playgroundStore`)
- On construction, it ensures the data file exists (creates with defaults if missing)
- Every write operation (create, update, delete) calls `persist()` which writes the entire data object to disk
- Read operations return the in-memory data (no disk I/O on reads)
- If disk write fails, the error is logged to console but does not crash the server

### History Cap

History entries are capped at 100 entries. When a new entry is added and the limit is exceeded, the oldest entries are removed:
```typescript
this.data.history = this.data.history.slice(0, 100);
```

### Data Recovery

If the data file is corrupted or unreadable, the store falls back to `DEFAULT_DATA`:
```typescript
catch {
  return { ...DEFAULT_DATA };
}
```

---

## Default Data

When the Playground is first initialized (no existing data file), the following default data is created:

### Default Workspace

```json
{
  "id": "ws-space-default",
  "name": "Default Workspace",
  "isPinned": true,
  "isDefault": true,
  "createdAt": "<current ISO timestamp>"
}
```

### Default Environments

**Development:**
```json
{
  "id": "env-dev",
  "name": "Development",
  "variables": { "BASE_URL": "https://api.example.com" },
  "secrets": {},
  "isDefault": true
}
```

**Production:**
```json
{
  "id": "env-prod",
  "name": "Production",
  "variables": { "BASE_URL": "https://api.example.com" },
  "secrets": {},
  "isDefault": false
}
```

### Empty Collections

- `workspaceApis`: `[]`
- `localApis`: `[]`
- `collections`: `[]`
- `history`: `[]`
- `apiExamples`: `[]`

---

## AI Copilot (Pro Feature)

The AI Copilot is a chat-based AI assistant integrated into the right sidebar of the Playground.

### Access Control

- The `proUser` state variable controls access (currently hardcoded to `false`)
- Non-Pro users see a Pro upgrade banner when attempting to use AI features
- The `PgAiProBanner` component displays the upgrade prompt

### AI Actions

The AI Copilot supports 9 actions:

| Action              | Description                              |
|---------------------|------------------------------------------|
| Generate Request    | Generate a request from a natural language description |
| Explain Request     | Explain what the current request does    |
| Diagnose Error      | Analyze an error response and suggest fixes |
| Fix Request         | Suggest fixes for a failed request       |
| Explain Response    | Explain the response body                |
| Generate Code       | Generate code in a selected language     |
| Recommend Endpoint  | Suggest relevant API endpoints           |
| Suggest Improvements| Suggest optimizations for the request    |
| Ask AI              | Free-form chat with the AI assistant     |

### Contextual Shortcuts

The AI sidebar dynamically shows relevant shortcut chips based on the current state:

- **Error state**: Diagnose Error, Fix Request, Explain Error
- **Success state**: Explain Response, Generate Code, Optimize
- **Editing state**: Generate Request, Explain API, Add Auth
- **Default**: Generate Request, Explain Response, Generate Code, Optimize

### AI Message Flow

1. User triggers an AI action or sends a chat message
2. User message is added to the chat
3. If non-Pro: Pro upgrade banner is shown instead of AI response
4. If Pro: AI "thinking" indicator appears (900ms simulated delay)
5. AI response is added to the chat
6. Chat auto-scrolls to the latest message

### Pro Upgrade Banner

The `PgAiProBanner` component displays:

- **Title**: "Unlock AI Features"
- **Description**: "Upgrade to Klyra Pro to access powerful AI features including request generation, error diagnosis, code generation, and AI assistant chat."
- **Actions**: "Upgrade to Pro" button and close button

---

## Code Generation

### Supported Languages

The Playground supports code generation in 10 languages:

| Language             | Key                  |
|----------------------|----------------------|
| cURL                 | `curl`               |
| JavaScript (Fetch)   | `javascript-fetch`   |
| JavaScript (Axios)   | `javascript-axios`   |
| Python (Requests)    | `python-requests`    |
| Node.js              | `node`               |
| PHP                  | `php`                |
| Java                 | `java`               |
| C#                   | `csharp`             |
| Go                   | `go`                 |
| Ruby                 | `ruby`               |

### Code Generation Modes

Two code generation functions exist:

1. **`generateCode()`** (frontend utils): Basic code generation that includes all headers as-is
2. **`generateSecureCode()`** (frontend utils): Secure code generation that separates secrets from regular headers and references them via environment variables

The response viewer's "Code" tab uses `generateSecureCode()` for security.

### Code Generation Input

```typescript
interface CodeGenInput {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType?: string;
  authType?: string;
}
```

---

## Error Diagnosis

### Diagnosis Triggers

Error diagnosis is automatically triggered when the response has any of these flags set:

- `isTimeout`: Request exceeded the 30-second timeout
- `isNetworkError`: Network-level failure (DNS, connection refused, etc.)
- `isClientError`: HTTP 4xx status code
- `isServerError`: HTTP 5xx status code

### Diagnosis Output

```typescript
interface ErrorDiagnosis {
  title: string;           // Short error title
  message: string;         // Detailed explanation
  suggestions: ErrorSuggestion[];  // Actionable suggestions
  code?: string;           // Optional error code
}

interface ErrorSuggestion {
  cause: string;           // What went wrong
  fix: string;             // How to fix it
  actionable?: boolean;    // Whether a fix action is available
  action?: () => void;     // Optional fix callback
}
```

### Specific Error Diagnoses

| Status | Title                    | Key Suggestions                              |
|--------|--------------------------|----------------------------------------------|
| 0 (timeout) | Request Timed Out   | Server slow, network latency, large payload  |
| 0 (network) | Network Error       | CORS policy, server not running, invalid URL |
| 401   | Unauthorized (401)       | Missing/invalid API key, expired token       |
| 403   | Forbidden (403)          | Insufficient permissions, IP allowlist       |
| 404   | Not Found (404)          | Incorrect URL path, wrong API version        |
| 422   | Unprocessable Entity (422)| Validation error, schema mismatch           |
| 429   | Too Many Requests (429)  | Rate limit reached, concurrent requests      |
| 5xx   | Server Error (5xx)       | Server-side issue, temporary outage          |
| 4xx   | Client Error (4xx)       | Invalid request, missing required fields     |

---

## Environment Variables

### Variable Syntax

Variables are referenced using double curly braces: `{{variable_name}}`

### Where Variables Are Substituted

| Location              | Substituted | Description                              |
|-----------------------|-------------|------------------------------------------|
| URL                   | Yes         | Full URL string                            |
| Query params (value)  | Yes         | Each param value                           |
| Headers (value)       | Yes         | Each header value                          |
| Auth: API Key value   | Yes         | API key value                              |
| Auth: Bearer token    | Yes         | Bearer token value                         |
| Auth: Basic username  | Yes         | Basic auth username                        |
| Auth: Basic password  | Yes         | Basic auth password                        |
| Body: JSON            | Yes         | Entire JSON string                         |
| Body: Raw             | Yes         | Entire raw string                          |
| Body: Form data       | Yes         | Each form field value                      |
| Body: URL-encoded     | Yes         | Each URL-encoded field value               |

### Variable Resolution Order

1. Environment **variables** (non-secret)
2. Environment **secrets** (masked in UI)

Secrets take precedence over variables with the same name.

### Variable Autocomplete

When typing `{{` in the URL input or JSON body editor:

1. An autocomplete dropdown appears below the cursor
2. All variable and secret names from the active environment are listed
3. Typing after `{{` filters the list
4. Clicking a variable inserts `{{variable_name}}` at the cursor position
5. The dropdown is positioned dynamically based on cursor location

### Environment Variable Naming

The `toEnvVarName()` utility converts variable names to environment variable format:

- Replaces non-alphanumeric characters with underscores
- Collapses multiple underscores
- Trims leading/trailing underscores
- Converts to uppercase
- Falls back to `SECRET` if the result is empty

Example: `api-key` → `API_KEY`, `Authorization Token` → `AUTHORIZATION_TOKEN`

---

## Keyboard Shortcuts & UX

### URL Input

- Variable autocomplete triggers when typing `{{`
- `Enter` in the URL input does not send the request (use the Send button)

### JSON Editor

- Variable autocomplete triggers when typing `{{`
- `Enter` in the JSON editor does not submit (multi-line text area)

### AI Chat Input

- `Enter` sends the message
- `Shift + Enter` inserts a new line

### Input Modal

- `Enter` confirms the input
- `Ctrl + Enter` (or `Cmd + Enter` on Mac) confirms in multiline mode
- `Escape` closes the modal

### Split View

- Drag the splitter handle between request and response to resize
- The splitter has a dotted grip with hover and active states

### Sidebar Toggle

- Left sidebar: Click the chevron button to expand/collapse
- Right sidebar: Click the chevron button to expand/collapse
- Collapsed sidebars show icon-only rails

---

## File Reference

### Backend Files

| File                          | Lines | Purpose                              |
|-------------------------------|-------|--------------------------------------|
| `playground.routes.ts`        | 239   | Express router with all REST endpoints |
| `playground.service.ts`       | 188   | Request execution logic (proxy)      |
| `playground.storage.ts`       | 316   | File-based data persistence          |
| `playground.utils.ts`         | 174   | Shared utility functions             |
| `playground.types.ts`         | 189   | TypeScript type definitions          |

### Frontend Files

| File                          | Lines | Purpose                              |
|-------------------------------|-------|--------------------------------------|
| `pages/Playground/index.tsx`  | 2640  | Main Playground page component       |
| `pages/Playground/styles.css` | 3389  | All Playground-specific CSS          |
| `components/playground/WorkspaceSidebar.tsx` | 1250 | Left sidebar component |
| `components/playground/PgAiProBanner.tsx` | 37 | Pro upgrade banner component |
| `types/playground.ts`         | 295   | Frontend TypeScript types            |
| `utils/playground.ts`         | 1448  | Frontend utility functions           |
| `services/api/playground.ts`  | 195   | Frontend API client                  |

### Integration Files

| File                          | Purpose                              |
|-------------------------------|--------------------------------------|
| `backend/src/app.ts`          | Mounts playground router at `/api/playground` |
| `backend/src/server.ts`       | Starts the backend server on port 4000 |
| `frontend/src/App.tsx`        | Renders PlaygroundPage when `activeTab === 'playground'` |

---

## Appendix: HTTP Method Colors

| Method   | Hex Color  |
|----------|------------|
| GET      | `#22c55e` (green)  |
| POST     | `#a78bfa` (purple) |
| PUT      | `#f59e0b` (amber)  |
| PATCH    | `#3b82f6` (blue)   |
| DELETE   | `#ef4444` (red)    |
| HEAD     | `#6366f1` (indigo)|
| OPTIONS  | `#8b5cf6` (violet)|

---

## Appendix: Status Code Colors

| Status Range | Class Name       | Color  |
|--------------|------------------|--------|
| 200–299      | `pg-success`     | Green  |
| 300–399      | `pg-redirect`    | Amber  |
| 400–499      | `pg-client-error`| Red    |
| 500+         | `pg-server-error`| Red    |
| 0 (error)    | `pg-error`       | Red    |

---

*This documentation is auto-generated from source code analysis of the Klyra API Marketplace Playground feature. For implementation details, refer to the source files listed in the [File Reference](#file-reference) section.*
