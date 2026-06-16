#!/bin/zsh
# Daily knowledge-vault -> Supabase sync, run by launchd (com.sam.vault-sync).
# Portable: uses $HOME, so no hardcoded username. Logs to sync-vault.log.

REPO="$HOME/Desktop/claudedashboard"
export VAULT_PATH="$HOME/Desktop/knowledge-vault-project/knowledge-vault"

cd "$REPO" || exit 1

{
  echo "===== sync run: $(date '+%Y-%m-%d %H:%M:%S %Z') ====="
  npm run sync-vault
  echo "exit: $?"
  echo
} >> "$REPO/sync-vault.log" 2>&1
