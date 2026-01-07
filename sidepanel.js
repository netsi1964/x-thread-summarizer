// Side Panel Main Logic

class ThreadExtractorUI {
  constructor() {
    this.extractedData = null;
    this.isRunning = false;

    // DOM elements
    this.elements = {
      maxDepth: document.getElementById('maxDepth'),
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      progressPanel: document.getElementById('progressPanel'),
      progressBadge: document.getElementById('progressBadge'),
      postsCount: document.getElementById('postsCount'),
      currentPhase: document.getElementById('currentPhase'),
      progressBar: document.getElementById('progressBar'),
      resultsPanel: document.getElementById('resultsPanel'),
      emptyState: document.getElementById('emptyState'),
      treeView: document.getElementById('treeView'),
      jsonView: document.getElementById('jsonView'),
      treeViewBtn: document.getElementById('treeViewBtn'),
      jsonViewBtn: document.getElementById('jsonViewBtn'),
      treeViewContainer: document.getElementById('treeViewContainer'),
      jsonViewContainer: document.getElementById('jsonViewContainer'),
      exportJson: document.getElementById('exportJson'),
      exportMarkdown: document.getElementById('exportMarkdown'),
      exportText: document.getElementById('exportText'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),
      configMessage: document.getElementById('configMessage'),
      startBtnTooltip: document.getElementById('startBtnTooltip')
    };

    this.initEventListeners();
    this.initMessageListener();
    this.checkPageStatus();

    // Re-check status when side panel regains focus
    window.addEventListener('focus', () => {
      this.checkPageStatus();
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url) {
        this.checkPageStatus();
      }
    });

    chrome.tabs.onActivated.addListener(() => {
      this.checkPageStatus();
    });
  }

  async checkPageStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        this.setPageStatus(false, 'No active tab');
        return;
      }

      const url = tab.url || '';
      const isValidPage = url.includes('x.com/') && url.includes('/status/');

      if (isValidPage) {
        this.setPageStatus(true, 'Ready');
      } else if (url.includes('x.com/') || url.includes('twitter.com/')) {
        this.setPageStatus(false, 'Not on post');
      } else {
        this.setPageStatus(false, 'Not on X.com');
      }
    } catch (error) {
      console.error('Error checking page status:', error);
      this.setPageStatus(false, 'Unknown');
    }
  }

  setPageStatus(isReady, statusText) {
    const indicator = this.elements.statusIndicator;
    const text = this.elements.statusText;
    const startBtn = this.elements.startBtn;
    const message = this.elements.configMessage;
    const tooltip = this.elements.startBtnTooltip;

    if (isReady) {
      indicator.textContent = '●';
      indicator.className = 'status-indicator ready';
      text.textContent = statusText;
      text.className = 'status-text ready';
      startBtn.disabled = false;
      message.style.display = 'none';
      tooltip.classList.remove('show');
    } else {
      indicator.textContent = '○';
      indicator.className = 'status-indicator not-ready';
      text.textContent = statusText;
      text.className = 'status-text not-ready';
      startBtn.disabled = true;
      message.style.display = 'flex';
      tooltip.classList.add('show');
    }
  }

  initEventListeners() {
    // Start extraction
    this.elements.startBtn.addEventListener('click', () => {
      this.startExtraction();
    });

    // Stop extraction
    this.elements.stopBtn.addEventListener('click', () => {
      this.stopExtraction();
    });

    // View toggle
    this.elements.treeViewBtn.addEventListener('click', () => {
      this.switchView('tree');
    });

    this.elements.jsonViewBtn.addEventListener('click', () => {
      this.switchView('json');
    });

    // Export buttons
    this.elements.exportJson.addEventListener('click', () => {
      this.exportAsJson();
    });

    this.elements.exportMarkdown.addEventListener('click', () => {
      this.exportAsMarkdown();
    });

    this.elements.exportText.addEventListener('click', () => {
      this.exportAsText();
    });

    // Sync tree and JSON views
    this.elements.treeView.addEventListener('node-selected', (e) => {
      if (this.extractedData) {
        this.elements.jsonView.highlightNode(e.detail.nodeId);
      }
    });
  }

  initMessageListener() {
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message) => {
      console.log('Side panel received message:', message.type);

      switch (message.type) {
        case 'EXTRACTION_PROGRESS':
          this.handleProgress(message.data);
          break;
        case 'EXTRACTION_COMPLETE':
          console.log('Handling EXTRACTION_COMPLETE with data:', message.data);
          this.handleComplete(message.data);
          break;
        case 'EXTRACTION_ERROR':
          console.log('Handling EXTRACTION_ERROR:', message.error);
          this.handleError(message.error, message.partialData);
          break;
      }
    });
  }

  async startExtraction() {
    const maxDepth = parseInt(this.elements.maxDepth.value, 10);

    // Send message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      alert('No active tab found');
      return;
    }

    // Check if on a valid post page
    const url = tab.url || '';
    const isValidPage = url.includes('x.com/') && url.includes('/status/');

    if (!isValidPage) {
      alert('Please navigate to an X.com post page first.\n\nExample: https://x.com/username/status/123456789');
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_EXTRACTION',
        maxDepth
      });

      this.setRunningState(true);
      this.showProgressPanel();
    } catch (error) {
      console.error('Error starting extraction:', error);
      alert('Error: ' + error.message);
    }
  }

  async stopExtraction() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'STOP_EXTRACTION'
      });
    }

    this.setRunningState(false);
  }

  setRunningState(running) {
    this.isRunning = running;
    this.elements.startBtn.disabled = running;
    this.elements.stopBtn.disabled = !running;
    this.elements.maxDepth.disabled = running;

    if (running) {
      this.elements.progressBadge.textContent = 'Running';
      this.elements.progressBadge.classList.add('running');
    } else {
      this.elements.progressBadge.textContent = 'Stopped';
      this.elements.progressBadge.classList.remove('running');
    }
  }

  showProgressPanel() {
    this.elements.emptyState.style.display = 'none';
    this.elements.progressPanel.style.display = 'block';
  }

  showResultsPanel() {
    this.elements.emptyState.style.display = 'none';
    this.elements.resultsPanel.style.display = 'block';
  }

  handleProgress(data) {
    this.elements.postsCount.textContent = data.postsCount;
    this.elements.currentPhase.textContent = data.phase;
    this.elements.currentPhase.style.color = ''; // Reset color

    // Animate progress bar
    const progress = Math.min(100, (data.postsCount / 50) * 100);
    this.elements.progressBar.style.width = `${progress}%`;
  }

  handleComplete(data) {
    this.extractedData = data;
    this.setRunningState(false);

    // Update final stats
    this.elements.postsCount.textContent = data.stats.postsTotal;

    // Show warnings if any
    if (data.warnings && data.warnings.length > 0) {
      this.elements.currentPhase.textContent = '⚠️ Complete with warnings';
      this.elements.currentPhase.style.color = '#f59e0b';
      console.warn('Extraction warnings:', data.warnings);
    } else {
      this.elements.currentPhase.textContent = '✓ Complete';
      this.elements.currentPhase.style.color = '#84cc16';
    }

    this.elements.progressBar.style.width = '100%';

    // Show results
    this.showResultsPanel();
    this.renderResults();

    // Store in chrome.storage for persistence
    chrome.storage.local.set({
      lastExtraction: data,
      lastExtractionTime: new Date().toISOString()
    });
  }

  handleError(error, partialData) {
    this.setRunningState(false);
    this.elements.currentPhase.textContent = `Error: ${error}`;

    // If we have partial data info, show it
    if (partialData && partialData.postsExtracted > 0) {
      const message = `Extraction error: ${error}\n\nHowever, ${partialData.postsExtracted} posts were extracted before the error.\n\nUnfortunately, the data structure could not be built. Check the console for more details.`;
      alert(message);
    } else {
      alert('Extraction error: ' + error);
    }
  }

  renderResults() {
    if (!this.extractedData) return;

    // Render tree view
    this.elements.treeView.setData(this.extractedData.root);

    // Render JSON view
    this.elements.jsonView.setData(this.extractedData);
  }

  switchView(view) {
    if (view === 'tree') {
      this.elements.treeViewContainer.style.display = 'block';
      this.elements.jsonViewContainer.style.display = 'none';
      this.elements.treeViewBtn.classList.add('active');
      this.elements.jsonViewBtn.classList.remove('active');
    } else {
      this.elements.treeViewContainer.style.display = 'none';
      this.elements.jsonViewContainer.style.display = 'block';
      this.elements.treeViewBtn.classList.remove('active');
      this.elements.jsonViewBtn.classList.add('active');
    }
  }

  // Export functionality
  exportAsJson() {
    if (!this.extractedData) return;

    const jsonString = JSON.stringify(this.extractedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    this.downloadBlob(blob, `thread-${this.extractedData.source.rootUrl.split('/').pop()}.json`);
  }

  exportAsMarkdown() {
    if (!this.extractedData) return;

    const markdown = this.convertToMarkdown(this.extractedData);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    this.downloadBlob(blob, `thread-${this.extractedData.source.rootUrl.split('/').pop()}.md`);
  }

  exportAsText() {
    if (!this.extractedData) return;

    const text = this.convertToPlainText(this.extractedData);
    const blob = new Blob([text], { type: 'text/plain' });
    this.downloadBlob(blob, `thread-${this.extractedData.source.rootUrl.split('/').pop()}.txt`);
  }

  convertToMarkdown(data) {
    let markdown = `# X Thread Export\n\n`;
    markdown += `**Source:** ${data.source.rootUrl}\n`;
    markdown += `**Captured:** ${new Date(data.source.capturedAt).toLocaleString()}\n`;
    markdown += `**Posts:** ${data.stats.postsTotal}\n`;
    markdown += `**Max Depth:** ${data.source.maxDepth}\n\n`;
    markdown += `---\n\n`;

    const renderNode = (node, depth = 0) => {
      const children = node.children || [];
      const indent = '  '.repeat(depth);
      let md = '';

      md += `${indent}### @${node.author.handle} (${node.author.displayName})\n\n`;
      md += `${indent}${node.text}\n\n`;
      md += `${indent}💬 ${node.metrics?.replies || 0} | 🔁 ${node.metrics?.reposts || 0} | ❤️ ${node.metrics?.likes || 0}\n\n`;

      if (children.length > 0) {
        md += `${indent}**Replies:**\n\n`;
        children.forEach(child => {
          md += renderNode(child, depth + 1);
        });
      }

      return md;
    };

    markdown += renderNode(data.root);

    return markdown;
  }

  convertToPlainText(data) {
    let text = `X THREAD EXPORT\n`;
    text += `${'='.repeat(60)}\n\n`;
    text += `Source: ${data.source.rootUrl}\n`;
    text += `Captured: ${new Date(data.source.capturedAt).toLocaleString()}\n`;
    text += `Posts: ${data.stats.postsTotal}\n`;
    text += `Max Depth: ${data.source.maxDepth}\n\n`;
    text += `${'='.repeat(60)}\n\n`;

    const renderNode = (node, depth = 0) => {
      const children = node.children || [];
      const indent = '  '.repeat(depth);
      let txt = '';

      txt += `${indent}@${node.author.handle} (${node.author.displayName})\n`;
      txt += `${indent}${'-'.repeat(40)}\n`;
      txt += `${indent}${node.text}\n`;
      txt += `${indent}Replies: ${node.metrics?.replies || 0} | Reposts: ${node.metrics?.reposts || 0} | Likes: ${node.metrics?.likes || 0}\n\n`;

      if (children.length > 0) {
        children.forEach(child => {
          txt += renderNode(child, depth + 1);
        });
      }

      return txt;
    };

    text += renderNode(data.root);

    return text;
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ThreadExtractorUI();
  });
} else {
  new ThreadExtractorUI();
}

// Load previous extraction if available
chrome.storage.local.get(['lastExtraction', 'lastExtractionTime'], (result) => {
  if (result.lastExtraction) {
    const ui = new ThreadExtractorUI();
    ui.extractedData = result.lastExtraction;
    ui.showResultsPanel();
    ui.renderResults();
  }
});
