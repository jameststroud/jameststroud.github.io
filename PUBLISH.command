#!/bin/bash
# ---------------------------------------------------------------------------
# Publishes this folder to github.com/jameststroud/thestroudlab.github.io
#
# How to use it:
#   1. Unzip the website folder somewhere sensible (Desktop is fine).
#   2. Double-click this file. Terminal will open and ask for a token.
#   3. Paste the token and press Return. Nothing will appear as you paste;
#      that is normal, it is hidden on purpose.
#
# It replaces everything currently in the repository with this folder.
# ---------------------------------------------------------------------------

set -e
cd "$(dirname "$0")"

REPO="jameststroud/thestroudlab.github.io"

echo
echo "  Publishing the Stroud Lab website to $REPO"
echo "  ------------------------------------------------------------"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "  Git is not installed. macOS will offer to install it now."
  echo "  Accept, wait for it to finish, then double-click this file again."
  xcode-select --install 2>/dev/null || true
  read -r -p "  Press Return to close."
  exit 1
fi

if [ ! -d src ]; then
  echo "  This script is not sitting next to the website files."
  echo "  Move it into the unzipped folder (the one containing 'src') and try again."
  read -r -p "  Press Return to close."
  exit 1
fi

echo "  Paste your GitHub token and press Return."
echo "  (Settings > Developer settings > Personal access tokens >"
echo "   Fine-grained tokens. It needs Contents: Read and write, and"
echo "   Workflows: Read and write, on this one repository.)"
echo
read -r -s -p "  Token: " TOKEN
echo
echo

if [ -z "$TOKEN" ]; then
  echo "  No token entered. Nothing was changed."
  read -r -p "  Press Return to close."
  exit 1
fi

git init -q 2>/dev/null || true
git checkout -q -B main
git config user.name  "$(git config --global user.name  || echo 'James Stroud')"
git config user.email "$(git config --global user.email || echo 'stroud@gatech.edu')"

git add -A
git commit -q -m "Rebuild lab website" || echo "  (nothing new to commit)"

git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${TOKEN}@github.com/${REPO}.git"

echo "  Pushing..."
if git push -q --force origin main; then
  echo
  echo "  Done. The site is now at github.com/${REPO}"
  echo
  echo "  Two things left, both in the repository's Settings > Pages:"
  echo "    1. Set Source to 'GitHub Actions'"
  echo "    2. Set the custom domain to www.thestroudlab.com"
  echo
  echo "  Then revoke the token you just used, on the same page you made it."
else
  echo
  echo "  The push failed. The usual cause is the token missing the"
  echo "  'Workflows' permission, which is needed for the .github folder."
  echo "  Add it to the token and run this again."
fi

git remote set-url origin "https://github.com/${REPO}.git"
echo
read -r -p "  Press Return to close."
