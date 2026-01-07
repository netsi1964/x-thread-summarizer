# X Thread Extractor

A Chrome Extension (Manifest V3) for extracting and analyzing conversation threads from X.com (formerly Twitter) using DOM-based extraction.

## Features

- **DOM-based extraction** - Extract posts directly from the browser without API access
- **Progressive loading** - Automatically scrolls and expands replies to capture deep threads
- **Depth control** - Configure how many reply levels to extract (1-5)
- **Dual view modes** - Inspect data in both tree view and JSON view, with synchronized selection
- **Multiple export formats** - Export as JSON, Markdown, or plain text
- **Live progress tracking** - Real-time feedback during extraction

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory

## Usage

1. Navigate to an X.com post (e.g., `https://x.com/username/status/123456789`)
2. Click the extension icon to open the side panel
3. Configure the max depth (number of reply levels)
4. Click "Start Extraction"
5. Wait for the extraction to complete
6. View results in tree or JSON view
7. Export using the JSON, MD, or TXT buttons

## Architecture

### Components

- **manifest.json** - Extension configuration (MV3)
- **background.js** - Service worker for message routing
- **content.js** - DOM extraction logic that runs on X.com
- **sidepanel.html/js** - Main UI and state management
- **components/** - Web Components with Shadow DOM
  - `tree-view.js` - Hierarchical tree visualization
  - `json-viewer.js` - Syntax-highlighted JSON display

### Design

- **Typography**: Newsreader (editorial serif) paired with IBM Plex Mono (technical)
- **Color scheme**: Warm dark theme with amber/ochre accents
- **Animations**: Smooth transitions and staggered reveals for polished UX
- **Layout**: Container queries for responsive adaptation

## Data Schema

```json
{
  "schemaVersion": "1.0",
  "source": {
    "platform": "x.com",
    "rootUrl": "https://x.com/user/status/123",
    "capturedAt": "2025-01-07T...",
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
      "permalink": "..."
    },
    "children": []
  },
  "stats": {
    "postsTotal": 0,
    "postsPrunedByDepth": 0
  }
}
```

## Limitations (V0)

- DOM-based extraction only (no API access)
- Best-effort hierarchy reconstruction
- Depth accuracy limited for deeply nested threads
- Dependent on X.com's current DOM structure
- No authentication bypass (respects visibility restrictions)

## Permissions

- `sidePanel` - Display extraction UI
- `storage` - Save settings and results
- `scripting` - Inject content script
- `https://x.com/*` - Access X.com pages
- `https://twitter.com/*` - Access legacy Twitter URLs

## Future Enhancements (V1+)

- Network interception for improved parent mapping
- Better depth accuracy for deep threads
- Quote-tweet inclusion
- Import/export of saved threads
- Visual diff between extraction sessions

## Technical Notes

- Built with vanilla JavaScript + ES modules
- Web Components with Shadow DOM for encapsulation
- Container Queries for responsive layouts
- No external dependencies or frameworks
- Fully client-side (no backend required)

## Icon Assets

**Note:** Placeholder icons are included. Replace the files in `/icons/` with proper icon assets:
- `icon16.png` - 16x16px
- `icon48.png` - 48x48px
- `icon128.png` - 128x128px

You can create icons using tools like [Icon Generator](https://www.iconsgenerator.com/) or design your own.

## License

This project is for educational and research purposes. Please respect X.com's Terms of Service and only use this extension for authorized purposes.

## Credits

Built with distinctive design principles to avoid generic "AI slop" aesthetics. Features warm color palette, editorial typography, and thoughtful animations.
