# Installation Guide

## Quick Start

1. **Create Icon Files** (Optional but recommended)
   - Navigate to `/icons/` directory
   - Create PNG files: `icon16.png`, `icon48.png`, `icon128.png`
   - See `icons/README.md` for guidance
   - Or use the SVG template provided

2. **Load Extension in Chrome**
   ```
   1. Open Chrome
   2. Navigate to: chrome://extensions/
   3. Enable "Developer mode" (toggle in top-right corner)
   4. Click "Load unpacked"
   5. Select this directory (/temp/)
   6. Extension should now appear in your extensions list
   ```

3. **Pin the Extension** (Recommended)
   - Click the puzzle icon in Chrome toolbar
   - Find "X Thread Extractor"
   - Click the pin icon to keep it visible

4. **Test the Extension**
   - Visit any X.com post (e.g., https://x.com/elonmusk/status/1234567890)
   - Click the extension icon
   - Side panel should open on the right
   - Configure max depth (default: 2)
   - Click "Start Extraction"

## File Structure

```
/temp/
├── manifest.json              # Extension configuration
├── background.js              # Service worker
├── content.js                 # DOM extraction logic
├── sidepanel.html            # UI layout
├── sidepanel.js              # UI logic & state management
├── styles.css                # Styling with warm dark theme
├── components/
│   ├── tree-view.js          # Tree view web component
│   └── json-viewer.js        # JSON viewer web component
├── icons/
│   ├── icon-template.svg     # SVG template for icons
│   └── README.md             # Icon creation guide
├── README.md                 # Project documentation
└── INSTALL.md               # This file
```

## Troubleshooting

### Extension Not Loading
- Check that all files are present
- Look for errors in `chrome://extensions/` (click "Details" → "Errors")
- Ensure manifest.json is valid JSON

### Side Panel Not Opening
- Make sure you clicked the extension icon
- Check Chrome version (requires Chrome 114+)
- Try reloading the extension

### Extraction Not Working
- Verify you're on a valid X.com post page
- Check the browser console for errors (F12)
- Ensure you're logged into X.com (for viewing replies)
- Some private or deleted posts may not be accessible

### No Posts Extracted
- Wait longer - extraction takes time
- Try increasing max depth
- Scroll manually to load more replies first
- Some threads may have no visible replies

## Development

### Debugging

1. **Content Script Issues**
   - Open X.com post page
   - Press F12 to open DevTools
   - Check Console tab for errors
   - Use `console.log()` in content.js

2. **Side Panel Issues**
   - Open side panel
   - Right-click in side panel → "Inspect"
   - Check Console tab for errors
   - Use `console.log()` in sidepanel.js

3. **Background Script Issues**
   - Go to `chrome://extensions/`
   - Click "Service worker" under your extension
   - Check Console tab for errors

### Making Changes

After modifying code:
1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Reload any open X.com tabs
4. Reopen the side panel

## Next Steps

1. **Customize the Design**
   - Edit `styles.css` for different colors/fonts
   - Modify `sidepanel.html` for layout changes
   - Update web components for custom visualizations

2. **Improve Extraction**
   - Enhance `content.js` selectors for better accuracy
   - Add more robust depth detection
   - Implement retry logic for failed extractions

3. **Add Features**
   - Save multiple extractions
   - Compare threads over time
   - Add filtering and search
   - Support quote tweets

## Support

For issues or questions:
- Check the README.md for detailed documentation
- Review the PRD.md for feature specifications
- Examine the code comments for implementation details

## Notes

- This is a V0 release with basic functionality
- DOM selectors may break if X.com changes their HTML structure
- Use responsibly and respect X.com's Terms of Service
- For research and personal use only
