// Content script for extracting X.com threads
console.log('[X Thread Extractor] Content script loaded!');

class ThreadExtractor {
  constructor() {
    this.isRunning = false;
    this.extractedPosts = new Map();
    this.rootPostId = null;
    this.maxDepth = 2;
    this.scrollAttempts = 0;
    this.maxScrollAttempts = 20;
  }

  // Extract post ID from URL
  extractPostId(url) {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // Get root post ID from current URL
  getRootPostId() {
    const url = window.location.href;
    console.log('[X Thread Extractor] Current URL:', url);
    const postId = this.extractPostId(url);
    console.log('[X Thread Extractor] Extracted post ID:', postId);
    return postId;
  }

  // Extract post data from article element
  extractPostData(article) {
    try {
      // Extract permalink to get post ID
      const timeElement = article.querySelector('time');
      const linkElement = timeElement?.closest('a');
      const permalink = linkElement?.href;

      if (!permalink) return null;

      const id = this.extractPostId(permalink);
      if (!id) return null;

      // Extract author information
      const authorLink = article.querySelector('a[role="link"][href^="/"]');
      const handle = authorLink?.href.split('/').pop();
      const displayNameElement = article.querySelector('[dir="ltr"] span');
      const displayName = displayNameElement?.textContent || handle;

      // Extract timestamp
      const timestamp = timeElement?.getAttribute('datetime');

      // Extract text content
      const textContainer = article.querySelector('[data-testid="tweetText"]');
      const text = textContainer?.textContent || '';

      // Extract engagement metrics
      const metricsContainer = article.querySelector('[role="group"]');
      const metrics = {
        replies: 0,
        reposts: 0,
        likes: 0
      };

      if (metricsContainer) {
        const buttons = metricsContainer.querySelectorAll('[role="button"]');
        buttons.forEach((button) => {
          const ariaLabel = button.getAttribute('aria-label') || '';
          const match = ariaLabel.match(/(\d+)/);
          const count = match ? parseInt(match[1], 10) : 0;

          if (ariaLabel.includes('repl')) metrics.replies = count;
          else if (ariaLabel.includes('repost')) metrics.reposts = count;
          else if (ariaLabel.includes('like')) metrics.likes = count;
        });
      }

      return {
        id,
        author: { handle, displayName },
        timestamp,
        text,
        permalink,
        metrics,
        parentId: null,
        depth: 0
      };
    } catch (error) {
      console.error('Error extracting post data:', error);
      return null;
    }
  }

  // Compute depth based on DOM structure
  computeDepth(article) {
    // Root post is typically in the main timeline
    // Replies are nested in different sections
    const isMainPost = article.closest('[data-testid="primaryColumn"]');
    const replyLevel = article.closest('[data-testid="cellInnerDiv"]');

    if (!replyLevel) return 0;

    // Count nesting level - this is heuristic
    let depth = 0;
    let element = article;
    while (element && depth < 10) {
      element = element.parentElement;
      if (element?.getAttribute('data-testid') === 'cellInnerDiv') {
        depth++;
      }
    }

    return Math.min(depth, 3); // Cap at 3 for V0
  }

  // Extract root post specifically
  extractRootPost() {
    // Try multiple strategies to find the root post
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    for (const article of articles) {
      const postData = this.extractPostData(article);
      if (postData && postData.id === this.rootPostId) {
        postData.depth = 0;
        this.extractedPosts.set(postData.id, postData);
        console.log('Root post found:', postData.id);
        return true;
      }
    }

    // Fallback: try to find by URL in the article
    for (const article of articles) {
      const links = article.querySelectorAll('a[href*="/status/"]');
      for (const link of links) {
        if (link.href.includes(`/status/${this.rootPostId}`)) {
          const postData = this.extractPostData(article);
          if (postData) {
            postData.depth = 0;
            postData.id = this.rootPostId;
            this.extractedPosts.set(postData.id, postData);
            console.log('Root post found via fallback:', postData.id);
            return true;
          }
        }
      }
    }

    console.warn('Root post not found on page');
    return false;
  }

  // Extract all visible posts
  extractVisiblePosts() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    let newPostsCount = 0;

    articles.forEach((article) => {
      const postData = this.extractPostData(article);
      if (postData && !this.extractedPosts.has(postData.id)) {
        // Compute depth
        postData.depth = postData.id === this.rootPostId ? 0 : this.computeDepth(article);

        // Skip if exceeds max depth
        if (postData.depth <= this.maxDepth) {
          this.extractedPosts.set(postData.id, postData);
          newPostsCount++;
          console.log(`Extracted post ${postData.id} at depth ${postData.depth}`);
        }
      }
    });

    return newPostsCount;
  }

  // Click "Show replies" / "Show more" buttons
  async expandReplies() {
    const expandButtons = document.querySelectorAll('[role="button"]');
    let clicked = false;

    for (const button of expandButtons) {
      const text = button.textContent.toLowerCase();
      if (text.includes('show') && (text.includes('repl') || text.includes('more'))) {
        button.click();
        clicked = true;
        await this.sleep(300);
      }
    }

    return clicked;
  }

  // Scroll to load more content
  async scrollPage() {
    const scrollContainer = document.querySelector('[data-testid="primaryColumn"]');
    if (!scrollContainer) return false;

    const beforeHeight = scrollContainer.scrollHeight;
    scrollContainer.scrollBy(0, 1000);
    await this.sleep(500);

    const afterHeight = scrollContainer.scrollHeight;
    return afterHeight > beforeHeight;
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Send progress update
  sendProgress(phase, postsCount) {
    chrome.runtime.sendMessage({
      type: 'EXTRACTION_PROGRESS',
      data: {
        phase,
        postsCount,
        isRunning: this.isRunning
      }
    });
  }

  // Build hierarchical tree
  buildTree() {
    const posts = Array.from(this.extractedPosts.values());
    let rootPost = posts.find(p => p.id === this.rootPostId);

    // If root post not found, create a placeholder
    if (!rootPost) {
      console.warn('Root post not found! Creating placeholder...');
      console.warn('Looking for root ID:', this.rootPostId);
      console.warn('Extracted post IDs:', posts.map(p => p.id).join(', '));

      rootPost = {
        id: this.rootPostId,
        author: { handle: 'unknown', displayName: '[Root Post Not Found]' },
        timestamp: new Date().toISOString(),
        text: '⚠️ Root post could not be extracted from the page. This may happen if the post structure is different. The replies below were successfully captured.',
        permalink: window.location.href,
        metrics: { replies: posts.length, reposts: 0, likes: 0 },
        parentId: null,
        depth: 0,
        _placeholder: true
      };

      this.extractedPosts.set(this.rootPostId, rootPost);
      posts.unshift(rootPost);
    }

    // Build parent-child relationships (best effort)
    const postMap = new Map(posts.map(p => [p.id, { ...p, children: [] }]));

    // For V0, we use simple heuristics:
    // - Posts with depth 1 are likely replies to root
    // - Posts with depth 2+ are replies to depth 1 posts (best guess)
    posts.forEach(post => {
      if (post.id === this.rootPostId) return;

      const node = postMap.get(post.id);
      if (post.depth === 1) {
        // Direct reply to root
        node.parentId = this.rootPostId;
        postMap.get(this.rootPostId).children.push(node);
      } else if (post.depth > 1) {
        // Try to find likely parent (previous post with depth - 1)
        const potentialParent = posts.find(p =>
          p.depth === post.depth - 1 &&
          posts.indexOf(p) < posts.indexOf(post)
        );
        if (potentialParent) {
          node.parentId = potentialParent.id;
          postMap.get(potentialParent.id).children.push(node);
        } else {
          // Fallback to root
          node.parentId = this.rootPostId;
          postMap.get(this.rootPostId).children.push(node);
        }
      }
    });

    return postMap.get(this.rootPostId);
  }

  // Main extraction loop
  async startExtraction(maxDepth = 2) {
    this.isRunning = true;
    this.maxDepth = maxDepth;
    this.extractedPosts.clear();
    this.scrollAttempts = 0;

    // Get root post ID
    this.rootPostId = this.getRootPostId();
    if (!this.rootPostId) {
      chrome.runtime.sendMessage({
        type: 'EXTRACTION_ERROR',
        error: 'Not on a valid X.com post page'
      });
      return;
    }

    try {
      // Initial extraction - first get root post
      this.sendProgress('Finding root post', 0);
      await this.sleep(1000); // Wait for page to load

      this.extractRootPost();

      // Then extract all other posts
      this.sendProgress('Extracting visible posts', this.extractedPosts.size);
      this.extractVisiblePosts();
      this.sendProgress('Found posts', this.extractedPosts.size);

      // Progressive loading
      while (this.isRunning && this.scrollAttempts < this.maxScrollAttempts) {
        // Expand replies
        this.sendProgress('Expanding replies', this.extractedPosts.size);
        await this.expandReplies();
        await this.sleep(500);

        // Scroll to load more
        this.sendProgress('Scrolling to load more', this.extractedPosts.size);
        const scrolled = await this.scrollPage();

        // Extract newly visible posts
        const newPosts = this.extractVisiblePosts();
        this.sendProgress('Parsing new posts', this.extractedPosts.size);

        // Stop if no new content
        if (newPosts === 0 && !scrolled) {
          this.scrollAttempts++;
        } else {
          this.scrollAttempts = 0;
        }

        await this.sleep(300);
      }

      // Build tree structure
      this.sendProgress('Building tree structure', this.extractedPosts.size);
      console.log('About to build tree...');
      const tree = this.buildTree();
      console.log('Tree built successfully!', tree);

      // Calculate stats
      const allPosts = Array.from(this.extractedPosts.values());
      const prunedCount = allPosts.filter(p => p.depth > maxDepth).length;
      const rootIsPlaceholder = tree._placeholder === true;

      console.log('Sending EXTRACTION_COMPLETE message...');
      // Send complete data
      chrome.runtime.sendMessage({
        type: 'EXTRACTION_COMPLETE',
        data: {
          schemaVersion: '1.0',
          source: {
            platform: 'x.com',
            rootUrl: window.location.href,
            capturedAt: new Date().toISOString(),
            maxDepth,
            mode: 'dom'
          },
          root: tree,
          stats: {
            postsTotal: this.extractedPosts.size,
            postsPrunedByDepth: prunedCount,
            rootPostMissing: rootIsPlaceholder
          },
          warnings: rootIsPlaceholder ? ['Root post could not be extracted - using placeholder'] : []
        }
      });
    } catch (error) {
      console.error('Extraction error:', error);

      // Even if there's an error, try to send whatever data we have
      if (this.extractedPosts.size > 0) {
        console.log('Attempting to send partial data despite error...');

        try {
          // Try to build tree with whatever we have
          const tree = this.buildTree();
          const allPosts = Array.from(this.extractedPosts.values());
          const prunedCount = allPosts.filter(p => p.depth > maxDepth).length;

          chrome.runtime.sendMessage({
            type: 'EXTRACTION_COMPLETE',
            data: {
              schemaVersion: '1.0',
              source: {
                platform: 'x.com',
                rootUrl: window.location.href,
                capturedAt: new Date().toISOString(),
                maxDepth,
                mode: 'dom'
              },
              root: tree,
              stats: {
                postsTotal: this.extractedPosts.size,
                postsPrunedByDepth: prunedCount,
                partialExtraction: true
              },
              warnings: [`Extraction stopped with error: ${error.message}`, 'Data shown is partial']
            }
          });
        } catch (buildError) {
          console.error('Could not build tree from partial data:', buildError);
          // Last resort - send error but with post count
          chrome.runtime.sendMessage({
            type: 'EXTRACTION_ERROR',
            error: error.message,
            partialData: {
              postsExtracted: this.extractedPosts.size,
              postIds: Array.from(this.extractedPosts.keys())
            }
          });
        }
      } else {
        chrome.runtime.sendMessage({
          type: 'EXTRACTION_ERROR',
          error: error.message
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  stopExtraction() {
    this.isRunning = false;
  }
}

// Initialize extractor
const extractor = new ThreadExtractor();

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_EXTRACTION') {
    extractor.startExtraction(message.maxDepth);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_EXTRACTION') {
    extractor.stopExtraction();
    sendResponse({ success: true });
  }
  return true;
});
