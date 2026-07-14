#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-daily-learning-cloud-push}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Missing GitHub CLI: gh"
  echo "Install it first: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not logged in."
  echo "Run: gh auth login"
  exit 1
fi

required_env=(
  FEISHU_APP_ID
  FEISHU_APP_SECRET
  FEISHU_USER_OPEN_ID
  FEISHU_CC_CHAT_ID
  OPENAI_API_KEY
)

for key in "${required_env[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing environment variable: ${key}"
    exit 1
  fi
done

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "${REPO_NAME}" --private --source=. --remote=origin --push
else
  git push -u origin HEAD
fi

for key in "${required_env[@]}"; do
  gh secret set "${key}" --body "${!key}"
done

gh variable set OPENAI_MODEL --body "${OPENAI_MODEL:-gpt-4o-mini}"

echo "Cloud workflows are pushed and secrets are configured."
echo "Run a manual test:"
echo "  gh workflow run daily-news.yml"
echo "  gh workflow run daily-growth.yml"
echo "  gh workflow run daily-call-center.yml"
