// Background service worker for X Thread Extractor

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Message routing between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Route messages from content script to side panel
  if (message.type === 'EXTRACTION_PROGRESS' ||
      message.type === 'EXTRACTION_COMPLETE' ||
      message.type === 'EXTRACTION_ERROR') {
    // Forward to all side panel instances
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open
    });
  }

  // Handle messages from side panel to content script
  if (message.type === 'START_EXTRACTION' ||
      message.type === 'STOP_EXTRACTION') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch((error) => {
          sendResponse({ error: error.message });
        });
      }
    });
    return true; // Keep channel open for async response
  }

  return false;
});

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    maxDepth: 2,
    autoScroll: true,
    scrollDelay: 500
  });
});
