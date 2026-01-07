// Tree View Web Component

class ThreadTreeView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.data = null;
    this.selectedNode = null;
  }

  connectedCallback() {
    this.render();
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  render() {
    const styles = `
      <style>
        :host {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          color: #fafaf9;
        }

        .tree-container {
          padding: 0;
        }

        .tree-node {
          margin: 0;
          animation: slideIn 250ms ease-out backwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .node-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #1a1714;
          border: 1px solid #44403c;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .node-header:hover {
          background: #252019;
          border-color: #92400e;
          transform: translateX(2px);
        }

        .node-header.selected {
          background: #2d261f;
          border-color: #f59e0b;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
        }

        .node-toggle {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #252019;
          border: 1px solid #44403c;
          border-radius: 2px;
          font-size: 0.75rem;
          color: #a8a29e;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .node-toggle:hover {
          background: #2d261f;
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .node-toggle.empty {
          opacity: 0.3;
          cursor: default;
        }

        .node-content {
          flex: 1;
          min-width: 0;
        }

        .node-author {
          font-weight: 500;
          color: #f59e0b;
          margin-bottom: 0.25rem;
          font-size: 0.875rem;
        }

        .node-handle {
          color: #a8a29e;
          font-weight: 300;
        }

        .node-text {
          color: #d6d3d1;
          margin: 0.5rem 0;
          line-height: 1.5;
          font-size: 0.813rem;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .node-meta {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: #78716c;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .meta-icon {
          opacity: 0.7;
        }

        .node-children {
          margin-left: 2rem;
          border-left: 1px solid #44403c;
          padding-left: 1rem;
          position: relative;
        }

        .node-children::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(
            to bottom,
            #92400e 0%,
            transparent 100%
          );
        }

        .node-children.collapsed {
          display: none;
        }

        .depth-badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          background: #92400e;
          color: #f59e0b;
          border-radius: 10px;
          font-size: 0.625rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .empty-message {
          text-align: center;
          padding: 2rem;
          color: #78716c;
          font-style: italic;
        }
      </style>
    `;

    const content = this.data
      ? this.renderNode(this.data, 0)
      : '<div class="empty-message">No data to display</div>';

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="tree-container">
        ${content}
      </div>
    `;

    this.attachEventListeners();
  }

  renderNode(node, index) {
    const children = node.children || [];
    const hasChildren = children.length > 0;
    const nodeId = `node-${node.id}`;

    return `
      <div class="tree-node" style="animation-delay: ${index * 30}ms">
        <div class="node-header" data-node-id="${node.id}">
          <div class="node-toggle ${hasChildren ? '' : 'empty'}" data-toggle="${node.id}">
            ${hasChildren ? '▼' : '·'}
          </div>
          <div class="node-content">
            <div class="node-author">
              ${node.author.displayName}
              <span class="node-handle">@${node.author.handle}</span>
              <span class="depth-badge">D${node.depth}</span>
            </div>
            <div class="node-text">${this.escapeHtml(node.text)}</div>
            <div class="node-meta">
              <span class="meta-item">
                <span class="meta-icon">💬</span>
                ${node.metrics?.replies || 0}
              </span>
              <span class="meta-item">
                <span class="meta-icon">🔁</span>
                ${node.metrics?.reposts || 0}
              </span>
              <span class="meta-item">
                <span class="meta-icon">❤️</span>
                ${node.metrics?.likes || 0}
              </span>
            </div>
          </div>
        </div>
        ${hasChildren ? `
          <div class="node-children" data-children="${node.id}">
            ${children.map((child, i) => this.renderNode(child, i)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  attachEventListeners() {
    // Toggle collapse/expand
    this.shadowRoot.querySelectorAll('.node-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = toggle.getAttribute('data-toggle');
        const children = this.shadowRoot.querySelector(`[data-children="${nodeId}"]`);
        if (children) {
          children.classList.toggle('collapsed');
          toggle.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    });

    // Node selection
    this.shadowRoot.querySelectorAll('.node-header').forEach(header => {
      header.addEventListener('click', () => {
        // Remove previous selection
        this.shadowRoot.querySelectorAll('.node-header.selected').forEach(el => {
          el.classList.remove('selected');
        });

        // Add new selection
        header.classList.add('selected');

        // Dispatch event for JSON view sync
        const nodeId = header.getAttribute('data-node-id');
        this.dispatchEvent(new CustomEvent('node-selected', {
          detail: { nodeId },
          bubbles: true,
          composed: true
        }));
      });
    });
  }
}

customElements.define('thread-tree-view', ThreadTreeView);
