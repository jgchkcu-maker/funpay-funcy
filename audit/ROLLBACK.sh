#!/usr/bin/env bash
set -euo pipefail
target="$1"
source="$2"
cp -- "$source" "$target"
cmp -s -- "$target" "$source"
printf 'ROLLBACK_OK restored_hash=%s\n' "$(sha256sum "$target" | awk '{print $1}')"
