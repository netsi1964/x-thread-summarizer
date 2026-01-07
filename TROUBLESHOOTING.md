# Troubleshooting Guide

## Error: "Could not establish connection. Receiving end does not exist"

This error occurs when the content script is not loaded on the X.com page.

### Solution:

1. **Remove and reload the extension:**
   - Go to `chrome://extensions/`
   - Find "X Thread Extractor"
   - Click **Remove**
   - Click "Load unpacked"
   - Select the `x-thread-summarizer` folder
   - The extension will reload with the correct path

2. **Reload the X.com page:**
   - Go to your X.com tab
   - Press F5 or Cmd+R to fully reload
   - Open the extension side panel
   - Try "Start Extraction" again

3. **Verify content script is loaded:**
   - Open DevTools on X.com page (F12)
   - Go to Console tab
   - Look for any errors related to content.js
   - You should NOT see any red errors

### Still not working?

Check if you're on a valid X.com post page:
- URL should match: `https://x.com/[username]/status/[id]`
- Example: `https://x.com/trq212/status/2008229496244081070`

### Debug steps:

1. Open extension side panel
2. Right-click in side panel → Inspect
3. Try to start extraction
4. Check both consoles:
   - X.com page console (F12)
   - Side panel console (right-click → Inspect)
5. Look for error messages

### Common issues:

- **Not on a post page**: Navigate to an actual post URL
- **Extension not refreshed**: Remove and reload extension
- **Page not reloaded**: Reload X.com after extension changes
- **Content script blocked**: Check browser console for CSP errors
