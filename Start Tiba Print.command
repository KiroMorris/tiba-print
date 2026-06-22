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

echo ""
echo "  🐢  Tiba Print — DTF Layout & Nesting"
echo "  ─────────────────────────────────────"
echo ""

# 1) Check Node.js — and install it automatically if missing.
if ! command -v node >/dev/null 2>&1; then
  echo "  ⏳  Node.js not found — installing it for you..."
  echo ""

  if command -v brew >/dev/null 2>&1; then
    # Homebrew is already here — just install Node.
    brew install node
  else
    # No Homebrew. Install Homebrew (the standard Mac package manager) first,
    # then Node. This may ask for your Mac password (for the installer).
    echo "  ⏳  Installing Homebrew (Mac package manager) — you may be asked for your password..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null

    # Make brew available on this session (Apple Silicon vs Intel paths).
    if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi

    brew install node
  fi

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
