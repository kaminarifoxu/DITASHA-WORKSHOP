#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Install Docker Engine and the Compose plugin first. See README.md."; exit 1; }
docker compose version >/dev/null
read -r -p 'Username [foxu]: ' owner_name
owner_name=${owner_name:-foxu}
read -r -s -p 'New password (at least 12 characters): ' owner_password
printf '\n'
read -r -s -p 'Repeat password: ' owner_repeat
printf '\n'
[[ "$owner_password" == "$owner_repeat" ]] || { echo 'Passwords do not match.'; exit 1; }
printf '%s\n%s\n' "$owner_name" "$owner_password" | docker compose run --rm -T app node admin.mjs "${1:-init}"
unset owner_password owner_repeat
