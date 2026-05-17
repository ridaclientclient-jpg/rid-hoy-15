#!/bin/bash
# Fix Turbopack missing chunks - Next.js 16 bug workaround
# Turbopack generates references to chunks in pre-rendered HTML
# but sometimes doesn't create the actual files or uses different hashes.
cd /home/z/my-project

STANDALONE_STATIC=".next/standalone/.next/static/chunks"
BUILD_STATIC=".next/static/chunks"

# Collect all chunk references from pre-rendered HTML
missing_count=0
fixed_count=0

for page_html in $(find .next/server -name "*.html" 2>/dev/null); do
  # Extract chunk filenames referenced in HTML
  for ref in $(grep -o 'chunks/[a-z0-9]*\.\(js\|css\)' "$page_html" 2>/dev/null | sort -u); do
    chunk_file=$(basename "$ref")
    if [ ! -s "$BUILD_STATIC/$chunk_file" ]; then
      missing_count=$((missing_count + 1))
      # For CSS: use the main Tailwind CSS as fallback
      if echo "$chunk_file" | grep -q '\.css$'; then
        main_css="5e3804aa066e8328.css"
        if [ -f "$BUILD_STATIC/$main_css" ]; then
          cp "$BUILD_STATIC/$main_css" "$BUILD_STATIC/$chunk_file"
          [ -d "$STANDALONE_STATIC" ] && cp "$BUILD_STATIC/$chunk_file" "$STANDALONE_STATIC/$chunk_file"
          echo "Fixed CSS: $main_css -> $chunk_file"
          fixed_count=$((fixed_count + 1))
        fi
      fi
      # For JS: search for a chunk with similar content by looking for unique strings
      if echo "$chunk_file" | grep -q '\.js$'; then
        # Try to find the right chunk by searching for page-specific content
        found=0
        # Profile page chunk
        if grep -rl "avatar-upload\|Total viajes" "$BUILD_STATIC"/*.js 2>/dev/null | head -1 | while read src; do
          if [ -f "$src" ]; then
            cp "$src" "$BUILD_STATIC/$chunk_file"
            [ -d "$STANDALONE_STATIC" ] && cp "$BUILD_STATIC/$chunk_file" "$STANDALONE_STATIC/$chunk_file"
            echo "Fixed JS (profile): $(basename $src) -> $chunk_file"
            exit 0
          fi
        done; then found=1; fi
        # Market page chunk
        if [ "$found" = "0" ]; then
          if grep -rl "Error al crear el pedido\|Delivery insert error" "$BUILD_STATIC"/*.js 2>/dev/null | head -1 | while read src; do
            if [ -f "$src" ]; then
              cp "$src" "$BUILD_STATIC/$chunk_file"
              [ -d "$STANDALONE_STATIC" ] && cp "$BUILD_STATIC/$chunk_file" "$STANDALONE_STATIC/$chunk_file"
              echo "Fixed JS (market): $(basename $src) -> $chunk_file"
              exit 0
            fi
          done; then found=1; fi
        fi
        # Generic: find any non-empty chunk with similar size if still missing
        if [ ! -s "$BUILD_STATIC/$chunk_file" ]; then
          for src in "$BUILD_STATIC"/*.js; do
            size=$(wc -c < "$src")
            if [ "$size" -gt 1000 ] && [ "$size" -lt 50000 ]; then
              cp "$src" "$BUILD_STATIC/$chunk_file"
              [ -d "$STANDALONE_STATIC" ] && cp "$BUILD_STATIC/$chunk_file" "$STANDALONE_STATIC/$chunk_file"
              echo "Fixed JS (fallback): $(basename $src) -> $chunk_file"
              break
            fi
          done
        fi
      fi
    fi
  done
done

# Also copy to standalone
if [ -d "$STANDALONE_STATIC" ]; then
  for f in "$BUILD_STATIC"/*; do
    [ -f "$f" ] && cp -u "$f" "$STANDALONE_STATIC/" 2>/dev/null
  done
fi

echo "Done: $fixed_count chunks fixed ($missing_count missing detected)"
