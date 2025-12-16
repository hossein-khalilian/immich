#!/bin/bash
set -e

PROJECT_ROOT="${IMMICH_PATH:-/opt/immich}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ "$(basename "$SCRIPT_DIR")" = "persian-changes" ]; then
  PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
fi

if [ ! -d "$PROJECT_ROOT/web" ]; then
  echo "Immich project not found at $PROJECT_ROOT"
  echo "Set IMMICH_PATH or run this script next to the project root."
  exit 1
fi

echo "Copying files into $PROJECT_ROOT ..."
cd "$SCRIPT_DIR"
find . -type f -not -name "README.md" -not -name "*.sh" | while read -r file; do
  dest="$PROJECT_ROOT/$file"
  mkdir -p "$(dirname "$dest")"
  cp "$SCRIPT_DIR/$file" "$dest"
  echo "  -> $file"
done

echo "Done. Next steps:"
echo "  1. cd $PROJECT_ROOT/web && pnpm install"
echo "  2. pnpm run build"
echo "  3. cd $PROJECT_ROOT/docker && docker compose restart immich-server"