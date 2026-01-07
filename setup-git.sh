#!/bin/bash

# Setup script for X Thread Summarizer
# Run this after renaming the directory

echo "Setting up Git repository..."

# Navigate to the project directory
cd /Users/stenhougaard/Documents/GitHub/x-thread-summarizer

# Create .gitignore
cat > .gitignore << 'EOF'
# macOS
.DS_Store
._.DS_Store
**/.DS_Store
**/._.DS_Store

# Editor directories
.vscode/
.idea/
*.swp
*.swo
*~

# Test data
data/

# Node modules (if you later add npm)
node_modules/
EOF

echo "Created .gitignore"

# Initialize git repo
git init
echo "Initialized Git repository"

# Add all files
git add .
echo "Added all files to Git"

# Create initial commit
git commit -m "Initial commit: X Thread Extractor Chrome Extension

- Manifest V3 Chrome extension for extracting X.com threads
- DOM-based extraction with progressive loading
- Side panel UI with tree and JSON views
- Export to JSON, Markdown, and Plain text
- Warm dark theme with Newsreader + IBM Plex Mono fonts
- Handles missing root posts with placeholder system
- Partial extraction support for error recovery"

echo "Created initial commit"

# Create GitHub repo (private)
gh repo create x-thread-summarizer --private --source=. --remote=origin --push

echo ""
echo "✅ Done! Repository created and pushed to GitHub"
echo "   Repository: https://github.com/netsi1964/x-thread-summarizer"
