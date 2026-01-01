# Icon Optimization Guide

Your extension icons are currently too large (359 KiB each). They should be optimized for better performance.

## Recommended Sizes
- **icon16.png**: ~1-5 KB
- **icon48.png**: ~5-15 KB
- **icon128.png**: ~10-30 KB

## Quick Fix Options

### Option 1: Online Tools (Easiest)
1. Visit [TinyPNG](https://tinypng.com/) or [Squoosh](https://squoosh.app/)
2. Upload each icon file
3. Download optimized versions
4. Replace files in `icons/` folder

### Option 2: ImageMagick (Command Line)
```bash
# Install ImageMagick (if not installed)
# macOS: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# Optimize icons
cd icons
magick icon16.png -strip -quality 85 icon16.png
magick icon48.png -strip -quality 85 icon48.png
magick icon128.png -strip -quality 85 icon128.png
```

### Option 3: Use PNG Compression Tools
```bash
# Using pngquant (install first: npm install -g pngquant-bin)
pngquant --quality=65-80 icon16.png
pngquant --quality=65-80 icon48.png
pngquant --quality=65-80 icon128.png
```

### Option 4: Recreate Icons
If you have the source files:
1. Export at exact sizes (16x16, 48x48, 128x128)
2. Use PNG format with 8-bit color depth
3. Remove unnecessary metadata
4. Use appropriate compression

## Verification
After optimization, rebuild:
```bash
npm run build
```

The warnings should disappear if icons are under ~244 KB each.

## Note
These are just warnings - your extension will work fine with larger icons, but optimized icons improve:
- Extension load time
- Chrome Web Store listing performance
- User experience

