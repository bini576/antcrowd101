FROM bkimminich/juice-shop:latest AS base

# We need a Node image to modify files, then copy back
FROM node:22-alpine AS patcher

COPY --from=base /juice-shop /juice-shop

# Copy in custom branding assets
COPY antcrowd-theme.css /juice-shop/frontend/dist/frontend/assets/public/antcrowd-theme.css

# Inject the CSS link into index.html
RUN node -e "\
const fs = require('fs');\
const p = '/juice-shop/frontend/dist/frontend/index.html';\
let h = fs.readFileSync(p, 'utf8');\
h = h.replace('</head>', '<link rel=\"stylesheet\" href=\"/assets/public/antcrowd-theme.css\"></head>');\
fs.writeFileSync(p, h);\
console.log('Injected antcrowd-theme.css into index.html');\
"

# Final image: copy patched files back into the original distroless image
FROM bkimminich/juice-shop:latest
COPY --from=patcher /juice-shop/frontend/dist/frontend/index.html /juice-shop/frontend/dist/frontend/index.html
COPY --from=patcher /juice-shop/frontend/dist/frontend/assets/public/antcrowd-theme.css /juice-shop/frontend/dist/frontend/assets/public/antcrowd-theme.css
