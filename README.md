# Immich Persian Changes

This directory contains every file that was modified to enable Persian (fa) language support, RTL layout tweaks, Jalali calendar logic, and Persian fonts.

## Content

1. Translations (i18n/fa.json, mobile translations)
2. RTL and language configuration (constants, stores, managers)
3. Jalali utilities and components (timeline, date inputs, modals)
4. CSS/HTML bootstrap changes and Yekan fonts
5. Mobile defaults (mobile/lib/main.dart, locales)

## Applying

`
cd persian-changes
export IMMICH_PATH=/opt/immich   # adjust if needed
bash apply-persian-changes.sh
`

Or copy the files manually preserving the directory structure.

## Notes

- Requires pnpm install/build in web/ after applying.
- Restart Immich services once the files are in place.
- Created at 2025-12-15 10:07:42
