# Chrome Web Store Assets Guide

This guide provides specifications and instructions for creating Chrome Web Store assets.

## Required Assets

### 1. Extension Icons ✅ (Already Created)
- **16x16 pixels** - `icons/icon16.png` ✅
- **48x48 pixels** - `icons/icon48.png` ✅
- **128x128 pixels** - `icons/icon128.png` ✅

### 2. Store Screenshots (Required)
Create screenshots showing the extension in action:

#### Small Tile (440x280 pixels)
- **Purpose**: Small promotional tile
- **Content**: Extension popup with shopping interface
- **Format**: PNG or JPEG
- **File**: `store-assets/small-tile.png`

#### Large Tile (920x680 pixels)
- **Purpose**: Large promotional tile
- **Content**: Extension features showcase
- **Format**: PNG or JPEG
- **File**: `store-assets/large-tile.png`

#### Marquee Promotional Tile (1400x560 pixels)
- **Purpose**: Marquee promotional tile
- **Content**: Hero image with key features
- **Format**: PNG or JPEG
- **File**: `store-assets/marquee-tile.png`

#### Screenshots (1280x800 pixels recommended)
Create at least 1 screenshot, up to 5:

1. **Main Screenshot** (`store-assets/screenshot-1.png`)
   - Show extension popup with natural language input
   - Example: "Buy Samsung phone under 50000"
   - Show the AI processing and platform selection

2. **Multi-Platform Support** (`store-assets/screenshot-2.png`)
   - Show supported platforms (Amazon, Flipkart, eBay, Walmart)
   - Display platform selection interface

3. **Store Locator** (`store-assets/screenshot-3.png`)
   - Show offline store locator feature
   - Display map with nearby stores
   - Show store details (phone, hours, directions)

4. **Order Tracking** (`store-assets/screenshot-4.png`)
   - Show order history and tracking interface
   - Display order status and details

5. **Settings & Configuration** (`store-assets/screenshot-5.png`)
   - Show settings panel
   - Display API key configuration
   - Show platform preferences

## Design Guidelines

### Screenshot Best Practices
1. **Show Real Usage**: Use actual extension screenshots, not mockups
2. **Highlight Key Features**: Each screenshot should showcase a specific feature
3. **Clear Text**: Ensure all text is readable at full size
4. **Consistent Style**: Use consistent colors and styling
5. **No Personal Info**: Remove or blur any personal information
6. **Chrome UI**: Include Chrome browser UI to show it's an extension

### Promotional Tile Guidelines
1. **Brand Colors**: Use extension brand colors (#667eea, #764ba2)
2. **Clear Messaging**: Include key value propositions
3. **Visual Hierarchy**: Important information should stand out
4. **Call to Action**: Include "Install Now" or similar CTA
5. **Feature Icons**: Use icons to represent key features

## Tools for Creating Assets

### Screenshot Tools
- **Chrome DevTools**: Use device toolbar for consistent sizing
- **Screenshot Extensions**: Use Chrome extensions for capturing
- **Design Tools**: Figma, Sketch, or Adobe XD for promotional tiles

### Image Editing
- **GIMP**: Free image editor
- **Photoshop**: Professional image editing
- **Canva**: Online design tool with templates
- **Figma**: Design tool with Chrome extension templates

## Step-by-Step Creation Process

### 1. Create Screenshots
```bash
# 1. Load extension in Chrome
# 2. Open extension popup
# 3. Navigate through features
# 4. Capture screenshots at 1280x800 resolution
# 5. Save as PNG files
```

### 2. Create Promotional Tiles
```bash
# 1. Use design tool (Figma/Canva)
# 2. Create canvas at required dimensions
# 3. Add extension branding
# 4. Include key features and benefits
# 5. Export as PNG/JPEG
```

### 3. Optimize Images
```bash
# Use tools like ImageOptim or TinyPNG
# Reduce file size while maintaining quality
# Ensure images are under 1MB each
```

## Asset Checklist

- [ ] 16x16 icon (✅ Already exists)
- [ ] 48x48 icon (✅ Already exists)
- [ ] 128x128 icon (✅ Already exists)
- [ ] Small promotional tile (440x280)
- [ ] Large promotional tile (920x680)
- [ ] Marquee promotional tile (1400x560)
- [ ] Screenshot 1: Main interface (1280x800)
- [ ] Screenshot 2: Multi-platform support (1280x800)
- [ ] Screenshot 3: Store locator (1280x800)
- [ ] Screenshot 4: Order tracking (1280x800)
- [ ] Screenshot 5: Settings (1280x800)

## File Organization

Create a `store-assets/` directory:
```
store-assets/
├── small-tile.png
├── large-tile.png
├── marquee-tile.png
├── screenshot-1.png
├── screenshot-2.png
├── screenshot-3.png
├── screenshot-4.png
└── screenshot-5.png
```

## Notes

- All assets should be optimized for web
- Use PNG for screenshots with text
- Use JPEG for promotional images if file size is a concern
- Keep file sizes reasonable (< 1MB per image)
- Test images look good at different sizes
- Ensure text is readable at thumbnail size

## Resources

- [Chrome Web Store Asset Guidelines](https://developer.chrome.com/docs/webstore/images/)
- [Chrome Web Store Design Guidelines](https://developer.chrome.com/docs/webstore/best-practices/)
- [Image Optimization Tools](https://tinypng.com/)

---

**Note**: Actual image creation requires design tools and cannot be automated. Use this guide to create the assets manually or hire a designer.

