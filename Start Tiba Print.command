#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Tiba Print — one-click launcher (Mac / Linux)
#  Double-click this file to start the app.
#  • Installs dependencies the first time (or if missing)
#  • Starts the local dev server
#  • Opens the app in your browser
# ─────────────────────────────────────────────────────────────

# Move into this script's folder no matter where it's launched from.
cd "$(dirname "$0")" || exit 1

# Self-heal: ZIP downloads strip the execute bit and add a quarantine flag.
# Re-apply +x to ourself and clear quarantine so future double-clicks work.
chmod +x "$0" 2>/dev/null
xattr -d com.apple.quarantine "$0" 2>/dev/null

echo ""
echo "  🐢  Tiba Print — DTF Layout & Nesting"
echo "  ─────────────────────────────────────"
echo ""

# 1) Check Node.js — and install it automatically if missing, using the OFFICIAL
#    Node.js .pkg installer (no Homebrew needed; works on Apple Silicon & Intel).
if ! command -v node >/dev/null 2>&1; then
  echo "  ⏳  Node.js not found — installing it for you (official installer)..."
  echo "      You'll be asked for your Mac password — type it and press Enter."
  echo ""

  NODE_VER="v22.11.0"
  ARCH="$(uname -m)" # arm64 (Apple Silicon) or x86_64 (Intel)
  if [ "$ARCH" = "arm64" ]; then PKG="node-${NODE_VER}.pkg"; else PKG="node-${NODE_VER}.pkg"; fi
  PKG_URL="https://nodejs.org/dist/${NODE_VER}/${PKG}"
  TMP_PKG="/tmp/${PKG}"

  echo "  ⏳  Downloading Node.js ${NODE_VER}..."
  curl -fL "$PKG_URL" -o "$TMP_PKG" || {
    echo "  ❌  Download failed. Check your internet, or install manually from https://nodejs.org (LTS)."
    read -p "  Press Enter to close..."
    exit 1
  }

  echo "  ⏳  Installing (enter your Mac password if prompted)..."
  sudo installer -pkg "$TMP_PKG" -target /
  rm -f "$TMP_PKG"

  # Make sure the new node is on PATH for this session.
  export PATH="/usr/local/bin:$PATH"

  # Re-check.
  if ! command -v node >/dev/null 2>&1; then
    echo ""
    echo "  ❌  Couldn't install Node.js automatically."
    echo "      Please install it manually from https://nodejs.org (LTS), then run this again."
    echo ""
    read -p "  Press Enter to close..."
    exit 1
  fi
fi
echo "  ✓  Node.js $(node --version) found"

# 2) Install dependencies only if they're missing.
if [ ! -d "node_modules" ] || [ ! -d "node_modules/next" ]; then
  echo "  ⏳  First run — installing dependencies (this can take a few minutes)..."
  npm install || {
    echo "  ❌  Install failed. Check your internet connection and try again."
    read -p "  Press Enter to close..."
    exit 1
  }
  echo "  ✓  Dependencies installed"
else
  echo "  ✓  Dependencies already installed"
fi

# 3) Open the browser shortly after the server boots, then start the server.
( sleep 4; (command -v open >/dev/null && open http://localhost:4040) || (command -v xdg-open >/dev/null && xdg-open http://localhost:4040) ) &

echo ""
echo "  🚀  Starting the app at http://localhost:4040"
echo "      (Your browser will open automatically.)"
echo ""
echo "  ⚠️  Keep this window OPEN while using the app."
echo "      Close it (or press Ctrl+C) to stop the app."
echo ""

npm run dev
