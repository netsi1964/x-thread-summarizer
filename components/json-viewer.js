// JSON Viewer Web Component

class JsonViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.data = null;
    this.highlightedPath = null;
  }

  connectedCallback() {
    this.render();
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  highlightNode(nodeId) {
    // Clear previous highlights
    this.shadowRoot.querySelectorAll('.highlight').forEach(el => {
      el.classList.remove('highlight');
    });

    // Find and highlight the node
    const elements = this.shadowRoot.querySelectorAll(`[data-id="${nodeId}"]`);
    elements.forEach(el => {
      el.classList.add('highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  render() {
    const styles = `
      <style>
        :host {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          color: #fafaf9;
        }

        .json-container {
          background: #0d0c0b;
          padding: 1rem;
          border-radius: 4px;
          overflow: auto;
          font-size: 0.813rem;
          line-height: 1.6;
        }

        .json-line {
          display: flex;
          padding: 0.125rem 0;
          transition: background 150ms ease;
        }

        .json-line:hover {
          background: rgba(245, 158, 11, 0.05);
        }

        .json-line.highlight {
          background: rgba(245, 158, 11, 0.15);
          border-left: 2px solid #f59e0b;
          padding-left: 0.5rem;
          animation: highlightPulse 1s ease-out;
        }

        @keyframes highlightPulse {
          0%, 100% {
            background: rgba(245, 158, 11, 0.15);
          }
          50% {
            background: rgba(245, 158, 11, 0.3);
          }
        }

        .line-number {
          flex-shrink: 0;
          width: 3rem;
          text-align: right;
          color: #78716c;
          user-select: none;
          padding-right: 1rem;
        }

        .line-content {
          flex: 1;
          white-space: pre;
          color: #d6d3d1;
        }

        /* JSON syntax highlighting */
        .json-key {
          color: #f59e0b;
        }

        .json-string {
          color: #84cc16;
        }

        .json-number {
          color: #3b82f6;
        }

        .json-boolean {
          color: #a855f7;
        }

        .json-null {
          color: #78716c;
          font-style: italic;
        }

        .json-punctuation {
          color: #a8a29e;
        }

        .empty-message {
          text-align: center;
          padding: 2rem;
          color: #78716c;
          font-style: italic;
        }

        .copy-button {
          position: sticky;
          top: 0;
          right: 0;
          margin: 0 0 1rem auto;
          display: block;
          padding: 0.5rem 1rem;
          background: #1a1714;
          border: 1px solid #44403c;
          border-radius: 4px;
          color: #f59e0b;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 150ms ease;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .copy-button:hover {
          background: #252019;
          border-color: #f59e0b;
        }

        .copy-button:active {
          transform: scale(0.95);
        }
      </style>
    `;

    const content = this.data
      ? this.renderJson()
      : '<div class="empty-message">No data to display</div>';

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="json-container">
        ${this.data ? '<button class="copy-button" id="copyBtn">Copy JSON</button>' : ''}
        ${content}
      </div>
    `;

    if (this.data) {
      this.attachEventListeners();
    }
  }

  renderJson() {
    const jsonString = JSON.stringify(this.data, null, 2);
    const lines = jsonString.split('\n');

    return lines.map((line, index) => {
      const highlighted = this.syntaxHighlight(line);
      const dataId = this.extractNodeId(line);

      return `
        <div class="json-line" ${dataId ? `data-id="${dataId}"` : ''}>
          <span class="line-number">${index + 1}</span>
          <span class="line-content">${highlighted}</span>
        </div>
      `;
    }).join('');
  }

  extractNodeId(line) {
    // Extract node ID from lines containing "id": "..."
    const match = line.match(/"id"\s*:\s*"(\d+)"/);
    return match ? match[1] : null;
  }

  syntaxHighlight(line) {
    return line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
      .replace(/([{}[\],])/g, '<span class="json-punctuation">$1</span>');
  }

  attachEventListeners() {
    const copyBtn = this.shadowRoot.getElementById('copyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const jsonString = JSON.stringify(this.data, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy JSON';
          }, 2000);
        });
      });
    }
  }
}

customElements.define('json-viewer', JsonViewer);
