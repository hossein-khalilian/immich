#!/bin/bash
# اسکریپت اعمال تغییرات فارسی روی /opt/immich
# این اسکریپت مخصوص مسیر /opt/immich است

set -e

PROJECT_ROOT="/opt/immich"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CHANGES_DIR="$SCRIPT_DIR"

echo "╔════════════════════════════════════════╗"
echo "║  اعمال تغییرات فارسی Immich          ║"
echo "║  مسیر: /opt/immich                    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# بررسی وجود دایرکتوری پروژه
if [ ! -d "$PROJECT_ROOT/web" ]; then
    echo "❌ خطا: دایرکتوری پروژه Immich در /opt/immich پیدا نشد!"
    echo "لطفاً ابتدا Immich را در /opt/immich نصب کنید"
    exit 1
fi

echo "✅ مسیر پروژه پیدا شد: $PROJECT_ROOT"
echo ""
echo "📋 در حال کپی فایل‌ها..."
echo ""

# کپی فایل‌ها با حفظ ساختار دایرکتوری
cd "$CHANGES_DIR"
find . -type f -not -name "*.md" -not -name "*.sh" -not -name "apply-to-opt-immich.sh" | while read -r file; do
    src="$CHANGES_DIR/$file"
    dest="$PROJECT_ROOT/$file"
    dest_dir=$(dirname "$dest")
    
    # ایجاد دایرکتوری مقصد
    mkdir -p "$dest_dir"
    
    # کپی فایل
    cp "$src" "$dest"
    echo "  ✅ $file"
done

echo ""
echo "✅ تمام تغییرات اعمال شد!"
echo ""
echo "مرحله بعد:"
echo "  1. نصب وابستگی‌ها:"
echo "     cd /opt/immich/web && pnpm install"
echo ""
echo "  2. Build پروژه:"
echo "     cd /opt/immich/web && pnpm run build"
echo ""
echo "  3. Restart Docker containers (اگر در حال اجرا هستند):"
echo "     cd /opt/immich/docker && docker compose restart immich-server"
echo ""
echo "  4. یا راه‌اندازی مجدد:"
echo "     cd /opt/immich/docker && docker compose down && docker compose up -d"
echo ""

