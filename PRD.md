# PRD.md – X Thread Extractor (Chrome Extension V0)

## PRD-SEC-001 Overview & Objectives

**Objective**
Build a Chrome Extension (Manifest V3) that allows a user to extract a conversation thread from X.com (Twitter) directly in the browser, starting from a single post, traversing visible replies up to a configurable depth (V0 focus: depth 1–2), and exporting the result as structured data.

**V0 Scope (Explicitly Limited)**

* DOM-based extraction only (no official API, no backend)
* User-initiated, interactive extraction on an open X.com conversation page
* Root post + replies that can be loaded via scrolling / expansion
* Best-effort hierarchy (root → replies; deeper nesting may be partial)

**Non-goals (V0)**

* Full, guaranteed reconstruction of arbitrarily deep reply trees
* Background crawling or automation without user interaction
* Bypassing authentication or visibility restrictions

---

## PRD-SEC-002 Target Audience

* Developers, researchers, and power users
* Users comfortable installing unpacked Chrome extensions
* Users who want to inspect, export, or archive public X.com conversations

---

## PRD-SEC-003 Core Features

### PRD-FEAT-001 Thread Initialization

**Description**
Detect or accept a root X.com post URL and initialize a thread capture session.

**Acceptance Criteria**

* The extension can read the active tab URL
* If URL contains `/status/<id>`, that ID is treated as the root post
* User can manually paste a URL if auto-detection fails

---

### PRD-FEAT-002 DOM-Based Post Extraction

**Description**
Extract post data from the currently rendered DOM of an X.com conversation page.

**Data Extracted per Post**

* post ID (from permalink `/status/<id>`)
* author handle (best-effort)
* author display name (best-effort)
* timestamp (ISO if available)
* full visible text content
* engagement counts (likes, reposts, replies – if visible)

**Acceptance Criteria**

* Each extracted post has a stable `id`
* Duplicate posts are not added twice
* Extraction works for at least the root post and visible replies

---

### PRD-FEAT-003 Progressive Loading (Scroll & Expand)

**Description**
Load additional replies by mimicking user interaction.

**Behaviors**

* Scroll the main conversation container incrementally
* Detect and click buttons like "Show replies" / "Show more"
* Wait for DOM mutations before re-parsing

**Acceptance Criteria**

* Newly loaded posts are detected and parsed
* Extraction stops when no new posts appear after N cycles

---

### PRD-FEAT-004 Depth Computation & Limiting

**Description**
Compute a logical depth for posts and prune the result to a user-defined maximum depth.

**V0 Rules**

* Root post depth = 0
* Direct replies depth = 1
* Deeper replies may be inferred or defaulted conservatively

**Acceptance Criteria**

* Depth is stored explicitly on each post
* Posts with depth > maxDepth are excluded from final output

---

### PRD-FEAT-005 Live Progress Reporting

**Description**
Provide real-time feedback during extraction.

**Signals**

* Running / stopped state
* Number of posts found
* Current phase (scrolling, expanding, parsing)

**Acceptance Criteria**

* UI updates without page reload
* User can stop extraction at any time

---

### PRD-FEAT-006 Result Inspection UI

**Description**
Allow the user to inspect extracted data in two synchronized views.

**Views**

1. Tree view (collapsible hierarchy)
2. Raw JSON view (pretty-printed)

**Acceptance Criteria**

* Selecting a node in the tree highlights the corresponding JSON
* UI remains responsive for at least hundreds of posts

---

### PRD-FEAT-007 Export

**Description**
Enable client-side export of extracted data.

**Formats**

* JSON (canonical schema)
* Markdown (hierarchical thread)
* Plain text

**Acceptance Criteria**

* Downloads are triggered via browser APIs (Blob + download)
* No server or filesystem permissions required

---

## PRD-SEC-004 Extension Architecture

### Components

**Background Service Worker (MV3)**

* Opens side panel
* Routes messages
* Stores settings/results in `chrome.storage`

**Content Script (x.com)**

* Interacts with DOM
* Performs scrolling and expansion
* Extracts post data
* Sends progress + data to UI

**Side Panel (Primary UI)**

* Long-lived execution context
* Owns crawl state and data model
* Renders UI and handles export

---

## PRD-SEC-005 Data Model

### Canonical Thread Schema (V0)

```json
{
  "schemaVersion": "1.0",
  "source": {
    "platform": "x.com",
    "rootUrl": "https://x.com/user/status/123",
    "capturedAt": "ISO-8601",
    "maxDepth": 2,
    "mode": "dom"
  },
  "root": {
    "post": {
      "id": "123",
      "author": { "handle": "user", "displayName": "User" },
      "timestamp": "ISO-8601",
      "text": "...",
      "parentId": null,
      "depth": 0,
      "metrics": { "likes": 0, "reposts": 0, "replies": 0 },
      "permalink": "https://x.com/user/status/123"
    },
    "children": []
  },
  "stats": {
    "postsTotal": 0,
    "postsPrunedByDepth": 0
  }
}
```

---

## PRD-SEC-006 UI Design Principles

* Vanilla JS + ES modules only
* Web Components with Shadow DOM
* Container Queries for layout adaptation
* Clear separation of:

  * configuration
  * progress
  * inspection
  * export

---

## PRD-SEC-007 Security & Permissions

**Required Permissions**

* `https://x.com/*` host permission
* `sidePanel`, `storage`, `scripting`

**Security Constraints**

* No credential access
* No background automation outside active user tab
* No data leaves the browser

---

## PRD-SEC-008 Development Phases

**Phase 0 – V0 (This PRD)**

* DOM-only extraction
* Root + visible replies
* Side panel UI

**Phase 1 – V1 (Future)**

* Network interception for better parent mapping
* Deeper depth accuracy
* Heuristic improvements

---

## PRD-SEC-009 Risks & Mitigations

| Risk                 | Mitigation                                      |
| -------------------- | ----------------------------------------------- |
| X DOM changes        | Heuristic-based selectors, versioned extractors |
| ToS concerns         | User-initiated, interactive use only            |
| Incomplete hierarchy | Explicitly documented limitation in UI          |
| MV3 worker lifetime  | Run crawl in side panel, not service worker     |

---

## PRD-SEC-010 Future Expansions

* Hybrid DOM + network capture mode
* Visual diff between reloads
* Quote-tweet inclusion
* Import/export of saved threads

---

**Status:** V0 – Ready for implementation
