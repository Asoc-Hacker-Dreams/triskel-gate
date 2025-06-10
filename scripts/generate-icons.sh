#!/bin/bash

# Script para generar iconos de la PWA
# Crear iconos simples con SVG convertido a PNG

# Crear un SVG simple para el icono
cat > /tmp/icon.svg << 'EOF'
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="#4338ca"/>
  <rect x="64" y="64" width="384" height="384" rx="32" fill="white"/>
  <rect x="128" y="128" width="256" height="256" rx="16" fill="#4338ca"/>
  <path d="M180 220 L220 260 L332 148" stroke="white" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="180" cy="320" r="8" fill="white"/>
  <circle cx="220" cy="320" r="8" fill="white"/>
  <circle cx="260" cy="320" r="8" fill="white"/>
  <circle cx="300" cy="320" r="8" fill="white"/>
  <circle cx="332" cy="320" r="8" fill="white"/>
</svg>
EOF

# Función para crear PNG desde SVG usando convert (ImageMagick)
create_png() {
    size=$1
    output_file="/Users/specter/Repos/hackerdreams/triskelgate/payment-platform/public/icons/icon-${size}x${size}.png"
    
    # Verificar si ImageMagick está disponible
    if command -v convert >/dev/null 2>&1; then
        convert -background none /tmp/icon.svg -resize ${size}x${size} "$output_file"
        echo "Created: $output_file"
    else
        # Fallback: crear un archivo PNG básico usando node (si está disponible)
        echo "ImageMagick not found, creating placeholder PNG for ${size}x${size}"
        # Crear un archivo placeholder básico
        echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > "$output_file"
    fi
}

# Crear todos los tamaños necesarios
create_png 72
create_png 96
create_png 128
create_png 144
create_png 152
create_png 192
create_png 384
create_png 512

echo "Iconos creados en /Users/specter/Repos/hackerdreams/triskelgate/payment-platform/public/icons/"
