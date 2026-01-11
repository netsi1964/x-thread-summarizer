// Content script for extracting X.com threads
console.log('[X Thread Extractor] Content script loaded!');

class ThreadExtractor {
  constructor() {
    this.isRunning = false;
    this.extractedPosts = new Map();
    this.rootPostId = null;
    this.maxDepth = 2;
    this.scrollAttempts = 0;
    this.maxScrollAttempts = 20; // Default
    this.scrollStep = 1000;
    this.isArticleMode = false;
    this.targetReplyCount = 0;
    this.throttleCount = 0;
  }

  // Robust number parser for metrics
  parseMetricValue(text) {
    if (!text) return 0;
    
    const cleaned = text.trim().toLowerCase();
    
    // Check for suffix
    let multiplier = 1;
    // 'k' for kilo, 't' for Danish 'tusind', 'm' for million
    if (cleaned.includes('k') || cleaned.endsWith('t')) multiplier = 1000;
    else if (cleaned.includes('m')) multiplier = 1000000;
    
    // Extract numeric part
    let numStr = cleaned.replace(/[^\d,.]/g, '');
    
    if (multiplier > 1) {
      // For values with suffixes, treat first comma/dot as decimal separator
      numStr = numStr.replace(',', '.');
      const val = parseFloat(numStr);
      return isNaN(val) ? 0 : Math.round(val * multiplier);
    } else {
      // For large raw numbers, treat commas/dots as thousand separators
      numStr = numStr.replace(/[,.]/g, '');
      return parseInt(numStr, 10) || 0;
    }
  }

  // Extract post ID from URL
  extractPostId(url) {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // Get root post ID from current URL
  getRootPostId() {
    const url = globalThis.location.href;
    console.log('[X Thread Extractor] Current URL:', url);
    const postId = this.extractPostId(url);
    console.log('[X Thread Extractor] Extracted post ID:', postId);
    return postId;
  }

  // Extract post data from article element
  extractPostData(article) {
    try {
      // Detect if this is an X Article (Long post)
      // Articles typically have a different structure than tweets
      const isArticle = article.querySelector('h1, h2, [role="heading"]') && 
                        !article.querySelector('[data-testid="tweetText"]');

      // Extract permalink to get post ID
      const timeElement = article.querySelector('time');
      const linkElement = timeElement?.closest('a');
      const permalink = linkElement?.href || globalThis.location.href;

      const id = this.extractPostId(permalink) || this.rootPostId;
      if (!id) return null;

      // Extract author information
      const authorLink = article.querySelector('a[role="link"][href^="/"]');
      const handle = authorLink?.href.split('/').pop();
      const displayNameElement = article.querySelector('[dir="ltr"] span');
      const displayName = displayNameElement?.textContent || handle;

      // Extract timestamp
      const timestamp = timeElement?.getAttribute('datetime') || new Date().toISOString();

      // Extract text content
      let text = '';
      if (isArticle) {
        // Use specific selectors for article title and body
        const titleEl = article.querySelector('[data-testid="twitter-article-title"]') || 
                      article.querySelector('h1, h2, [role="heading"]');
        const title = titleEl?.textContent.trim() || '';
        
        const bodyContainer = article.querySelector('[data-testid="longformRichTextComponent"]');
        let paragraphs = [];
        
        if (bodyContainer) {
          // Extract text from the specific body container
          paragraphs = Array.from(bodyContainer.querySelectorAll('div, p'))
            .filter(el => {
              // Only take elements that are largely text and don't contain other paragraphs
              if (el.querySelector('p')) return false; 
              return el.textContent.trim().length > 0;
            })
            .map(el => el.textContent.trim());
        } else {
          // Fallback if the specific test-id is missing
          paragraphs = Array.from(article.querySelectorAll('div, p'))
            .filter(el => {
              if (el.closest('[role="group"]') || el.closest('[data-testid="group"]')) return false;
              if (el.getAttribute('aria-hidden') === 'true') return false;
              if (el.tagName.startsWith('H') || el.getAttribute('role') === 'heading') return false;
              return true;
            })
            .map(el => el.textContent.trim())
            .filter(t => t.length > 20);
        }
        
        const uniqueParagraphs = [...new Set(paragraphs)];
        text = title ? `# ${title}\n\n` : '';
        text += uniqueParagraphs.join('\n\n');
      } else {
        const textContainer = article.querySelector('[data-testid="tweetText"]');
        text = textContainer?.textContent || '';
      }

      // Extract engagement metrics
      const metrics = {
        replies: 0,
        reposts: 0,
        likes: 0
      };

      // Find metric buttons by data-testid or aria-label
      const replyBtn = article.querySelector('[data-testid="reply"]');
      const retweetBtn = article.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
      const likeBtn = article.querySelector('[data-testid="like"], [data-testid="unlike"]');

      if (replyBtn) metrics.replies = this.parseMetricValue(replyBtn.textContent || replyBtn.getAttribute('aria-label'));
      if (retweetBtn) metrics.reposts = this.parseMetricValue(retweetBtn.textContent || retweetBtn.getAttribute('aria-label'));
      if (likeBtn) metrics.likes = this.parseMetricValue(likeBtn.textContent || likeBtn.getAttribute('aria-label'));

      // If we still have 0, try the role="group" fallback
      if (metrics.replies === 0 && metrics.reposts === 0 && metrics.likes === 0) {
        const metricsContainer = article.querySelector('[role="group"]');
        if (metricsContainer) {
          const buttons = metricsContainer.querySelectorAll('[role="button"], a[role="link"]');
          buttons.forEach((button) => {
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            const testId = button.getAttribute('data-testid');
            const val = this.parseMetricValue(button.textContent || ariaLabel);

            if (testId === 'reply' || ariaLabel.includes('repl')) metrics.replies = val;
            else if (testId && (testId.includes('retweet') || testId.includes('repost')) || ariaLabel.includes('repost')) metrics.reposts = val;
            else if (testId === 'like' || ariaLabel.includes('like')) metrics.likes = val;
          });
        }
      }

      return {
        id,
        author: { handle, displayName },
        timestamp,
        text,
        permalink,
        metrics,
        parentId: null,
        depth: 0,
        isArticle
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
    // const isMainPost = article.closest('[data-testid="primaryColumn"]');
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
    const articles = document.querySelectorAll('article'); // Notice: removed [data-testid="tweet"] for articles

    for (const article of articles) {
      const postData = this.extractPostData(article);
      if (postData && postData.id === this.rootPostId) {
        postData.depth = 0;
        this.extractedPosts.set(postData.id, postData);
        if (postData.isArticle) this.isArticleMode = true;
        console.log('Root post found:', postData.id, postData.isArticle ? '(Article)' : '(Tweet)');
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
            if (postData.isArticle) this.isArticleMode = true;
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
    // Collect both articles and cellInnerDivs to be safe
    const containers = document.querySelectorAll('article, [data-testid="cellInnerDiv"]');
    let newPostsCount = 0;

    containers.forEach(container => {
      // If it's a cellInnerDiv, we want the article inside it
      const article = container.tagName === 'ARTICLE' ? container : container.querySelector('article');
      if (!article) return;

      const postData = this.extractPostData(article);
      if (postData && postData.id && !this.extractedPosts.has(postData.id)) {
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
    const expandButtons = document.querySelectorAll('[role="button"], [data-testid*="replies_pivot"]');
    let clickedCount = 0;

    for (const button of expandButtons) {
      const text = button.textContent.toLowerCase();
      const testId = button.getAttribute('data-testid') || '';
      
      // Handle "Show replies", "Show more", "Læs svar", and pivots
      if (testId.includes('replies_pivot') || 
          ((text.includes('show') || text.includes('read') || text.includes('læs')) && 
           (text.includes('repl') || text.includes('more') || text.includes('svar')))) {
        
        // Ensure it's not a button we already tried
        if (button.dataset.extractorClicked) continue;
        
        console.log('[X Thread Extractor] Clicking expand button:', text || testId);
        button.click();
        button.dataset.extractorClicked = 'true';
        clickedCount++;
        await this.sleep(1000); // Wait longer for pivots to load content
      }
    }

    return clickedCount > 0;
  }

  // Scroll to load more content
  // Check if we should stop scrolling (e.g. at bottom or spam marker found)
  isEndOfContent() {
    const afterHeight = document.documentElement.scrollHeight;
    const currentScroll = globalThis.scrollY + globalThis.innerHeight;
    const isAtBottom = currentScroll >= afterHeight - 200;

    // Check for "Show probable spam" or localized variants
    const spamMarkers = ["Show probable spam", "Vis muligt spam", "Visa sannolik skräppost"];
    const hasSpamMarker = Array.from(document.querySelectorAll('span, div, button')).some(el => 
      spamMarkers.some(marker => el.textContent.includes(marker))
    );

    if (hasSpamMarker) {
      console.log('[X Thread Extractor] Spam marker detected - stopping scroll');
      return true;
    }

    return isAtBottom;
  }

  // Scroll page function - Overhauled to use window/document level scrolling
  async scrollPage() {
    // Scroll the entire window - this is what makes it visible and works on X Articles
    globalThis.scrollBy({
      top: this.isArticleMode ? 2500 : 1000,
      behavior: 'smooth'
    });
    
    // Wait for scroll and potential content load
    await this.sleep(1500);
    
    const isEnd = this.isEndOfContent();
    const afterHeight = document.documentElement.scrollHeight;
    const currentScroll = globalThis.scrollY + globalThis.innerHeight;

    console.log(`[X Thread Extractor] Scrolling... Pos: ${Math.round(currentScroll)}/${afterHeight} (At end: ${isEnd})`);
    
    // Return true if we should CONTINUE scrolling
    return !isEnd;
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Send progress update
  sendProgress(phase, postsCount) {
    let liveData = null;
    
    // Only build tree periodically to avoid heavy overhead during scroll
    this.throttleCount++;
    if (this.throttleCount >= 3 || phase.includes('Complete') || phase.includes('Error')) {
      try {
        const tree = this.buildTree();
        const allPosts = Array.from(this.extractedPosts.values());
        const prunedByDepth = allPosts.filter(p => p.depth > (this.lastMaxDepth || 2)).length;
        
        liveData = {
          root: tree,
          stats: {
            postsTotal: this.extractedPosts.size,
            postsPrunedByDepth: prunedByDepth,
            targetReached: this.targetReplyCount > 0 && this.extractedPosts.size >= this.targetReplyCount
          }
        };
        this.throttleCount = 0;
      } catch (e) {
        console.warn('Could not build live tree:', e);
      }
    }

    chrome.runtime.sendMessage({
      type: 'EXTRACTION_PROGRESS',
      data: {
        phase,
        postsCount,
        isRunning: this.isRunning,
        liveData
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
        permalink: globalThis.location.href,
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

    posts.forEach(post => {
      if (post.id === this.rootPostId) return;

      const node = postMap.get(post.id);
      if (!node) return;

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
      } else {
        // Depth is 0 but it's not root - likely a misplaced reply
        // Or if we are in Article Mode, any post found that isn't the root is likely a reply
        node.parentId = this.rootPostId;
        const rootNode = postMap.get(this.rootPostId);
        if (rootNode) {
          rootNode.children.push(node);
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
    this.maxScrollAttempts = 20;

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
      
      const rootPost = this.extractedPosts.get(this.rootPostId);
      if (rootPost && rootPost.metrics && rootPost.metrics.replies) {
        this.targetReplyCount = rootPost.metrics.replies;
        console.log(`[X Thread Extractor] Target reply count identified: ${this.targetReplyCount}`);
      }
      
      if (this.isArticleMode) {
        console.log('[X Thread Extractor] Article Mode detected - increasing scroll limits');
        this.maxScrollAttempts = 80; // Even more attempts for 90k text
      }

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

        // Stop if no new content or reached target
        if (newPosts === 0 && !scrolled) {
          this.scrollAttempts++;
        } else {
          this.scrollAttempts = 0;
        }

        // Target-based termination
        if (this.targetReplyCount > 0 && this.extractedPosts.size >= this.targetReplyCount) {
          console.log(`[X Thread Extractor] Target reached (${this.extractedPosts.size}/${this.targetReplyCount}) - finishing up.`);
          break;
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
            rootUrl: globalThis.location.href,
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
                rootUrl: globalThis.location.href,
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_EXTRACTION') {
    extractor.startExtraction(message.maxDepth);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_EXTRACTION') {
    extractor.stopExtraction();
    sendResponse({ success: true });
  }
  return true;
});
