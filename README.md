# RetailAgent

AI-powered multi-platform ecommerce shopping assistant Chrome extension that understands natural language shopping intents and automates the entire shopping experience across multiple ecommerce platforms.

## 🚀 Features

### Core Functionality
- **Natural Language Processing**: Understands shopping intents from plain English queries
- **Multi-Platform Support**: Works with Amazon, Flipkart, eBay, Walmart, and more
- **Automated Shopping Flow**: From search to checkout, all automated
- **Smart Product Selection**: AI-powered product matching and selection
- **Order Management**: Track orders, initiate returns, and manage support tickets

### Advanced Features
- **Offline Store Locator**: Find nearby physical stores with Google Maps integration
- **Store Availability**: Check product availability at offline stores
- **Click-to-Call**: Direct phone calls to stores
- **Directions Integration**: Get directions to stores via Google Maps or Apple Maps
- **Address Management**: Save and manage multiple delivery addresses
- **Payment Methods**: Manage multiple payment methods (cards, wallets, UPI)
- **Order Tracking**: Real-time order tracking across platforms
- **Return & Refund**: Automated return and refund requests
- **Support Tickets**: Create and manage support tickets

### Platform Support
- ✅ Amazon (India, US, UK, Germany, France)
- ✅ Flipkart
- ✅ eBay
- ✅ Walmart
- 🔄 Shopify (in progress)
- 🔄 Myntra (planned)
- 🔄 Target (planned)

## 📦 Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store listing
2. Click "Add to Chrome"
3. Follow the setup instructions

### Manual Installation (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/RetailAgent.git
   cd RetailAgent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

## ⚙️ Configuration

### API Keys Setup

1. **Gemini API Key** (Required):
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Open the extension popup
   - Click the settings icon (⚙️)
   - Enter your Gemini API key
   - Click "Save"

2. **Google Maps API Key** (Optional, for store locator):
   - Get your API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Enable "Places API" and "Maps JavaScript API"
   - Add the key in extension settings

### Platform Configuration

Enable/disable platforms in the settings:
- Open extension settings
- Navigate to "Platforms"
- Toggle platforms on/off as needed

## 🎯 Usage

### Basic Shopping Flow

1. **Open the extension** by clicking the RetailAgent icon in your Chrome toolbar
2. **Enter your shopping intent** in natural language, for example:
   - "Buy a Samsung Galaxy phone under 50000"
   - "Find iPhone 15 Pro Max on Flipkart"
   - "Search for wireless headphones with good ratings"
   - "Buy a laptop with 16GB RAM and 512GB SSD"

3. **The extension will**:
   - Parse your intent
   - Open the appropriate ecommerce platform
   - Search for products matching your criteria
   - Select the best match
   - Guide you through checkout

### Advanced Features

#### Finding Offline Stores
- Say: "Find nearby stores selling iPhone"
- The extension will show nearby stores with:
  - Distance from your location
  - Store hours
  - Phone numbers (click to call)
  - Directions link

#### Order Tracking
- Access order history from the extension popup
- Track orders in real-time
- Get delivery updates automatically

#### Returns & Refunds
- Select an order from your history
- Click "Return" or "Refund"
- Fill in the reason
- Submit automatically

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Architecture Guide](docs/ARCHITECTURE.md)** - System architecture, components, and data flow
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Setup, development workflow, and contribution guidelines
- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete API reference for all libraries
- **[Platform Guide](docs/PLATFORM_GUIDE.md)** - How to add support for new e-commerce platforms
- **[Features Documentation](docs/FEATURES.md)** - Detailed feature descriptions and implementation details
- **[Quick Test Guide](docs/QUICK_TEST_GUIDE.md)** - Quick start testing guide for product comparison
- **[Chrome Store Publishing](docs/CHROME_STORE_PUBLISHING.md)** - Guide for publishing to Chrome Web Store

## 🏗️ Architecture

### Project Structure
```
RetailAgent/
├── src/
│   ├── background/          # Service worker (background script)
│   │   └── service_worker.js
│   ├── content/             # Content scripts for each platform
│   │   ├── *-loader.js      # ES6 module loaders
│   │   ├── *.js             # Platform content scripts
│   │   ├── platforms/      # Platform-specific implementations
│   │   │   ├── amazon-platform.js
│   │   │   ├── flipkart-platform.js
│   │   │   ├── ebay-platform.js
│   │   │   └── walmart-platform.js
│   │   └── shared/         # Shared utilities
│   │       ├── selectors.js
│   │       ├── actions.js
│   │       └── login-handlers.js
│   ├── lib/                 # Core libraries
│   │   ├── gemini.js        # Gemini API integration
│   │   ├── logger.js        # Logging system
│   │   ├── error-handler.js # Error handling
│   │   ├── retry.js         # Retry logic
│   │   ├── config.js        # Configuration management
│   │   ├── ecommerce-platforms.js  # Platform abstraction
│   │   ├── product-matcher.js       # Product matching
│   │   ├── product-comparator.js    # Product comparison
│   │   ├── page-analyzer.js         # LLM page analysis
│   │   ├── sponsored-detector.js     # Sponsored product detection
│   │   ├── store-locator.js         # Store locator service
│   │   ├── address-manager.js       # Address management
│   │   ├── payment-manager.js       # Payment method management
│   │   └── order-tracker.js         # Order tracking
│   └── popup/               # Extension popup UI
│       ├── index.html
│       ├── popup.js
│       └── styles.css
├── icons/                   # Extension icons
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      # Architecture documentation
│   ├── DEVELOPER_GUIDE.md   # Developer guide
│   ├── API_DOCUMENTATION.md # API reference
│   ├── PLATFORM_GUIDE.md    # Platform development guide
│   ├── FEATURES.md          # Features documentation
│   └── ...                  # More documentation
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── manifest.json            # Extension manifest
├── package.json            # NPM configuration
├── webpack.config.js      # Build configuration
└── README.md              # This file
```

### Key Components

1. **Intent Parser**: Uses Gemini AI to parse natural language shopping intents
2. **Platform Abstraction**: Unified interface for different ecommerce platforms
3. **State Machine**: Manages shopping flow states (searching, selecting, checkout, etc.)
4. **Error Handling**: Comprehensive error recovery and user-friendly messages
5. **Retry Logic**: Exponential backoff for API calls and DOM operations
6. **Product Comparison**: Multi-platform product comparison with intelligent scoring
7. **Sponsored Detection**: Filters out sponsored/advertisement products

For detailed architecture information, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 🛠️ Development

### Prerequisites
- Node.js 18+ and npm
- Chrome browser
- Gemini API key

### Setup
```bash
# Install dependencies
npm install

# Run in development mode with watch
npm run watch

# Build for production
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

### Adding a New Platform

See the comprehensive [Platform Development Guide](docs/PLATFORM_GUIDE.md) for detailed instructions.

Quick steps:
1. Create platform class extending `EcommercePlatform`
2. Create content script and loader
3. Update `manifest.json` with host permissions
4. Register platform in service worker

For complete guide with examples, see [PLATFORM_GUIDE.md](docs/PLATFORM_GUIDE.md).

## 📝 Chrome Web Store Publishing

### Preparation Checklist
- [ ] Update `manifest.json` with complete store listing details
- [ ] Create store screenshots (1280x800, 640x400)
- [ ] Write store description
- [ ] Create privacy policy page
- [ ] Prepare promotional images
- [ ] Test extension thoroughly
- [ ] Review Chrome Web Store policies

### Publishing Steps
1. Create Chrome Web Store developer account ($5 one-time fee)
2. Zip the `dist` directory
3. Upload to Chrome Web Store Developer Dashboard
4. Fill in store listing information
5. Submit for review
6. Wait for approval (typically 1-3 days)

See [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/publish/) for details.

## 🔒 Privacy & Security

- **API Keys**: Stored locally in Chrome storage, never transmitted to third parties
- **User Data**: All data stored locally, no external servers
- **Permissions**: Only requests necessary permissions
- **Privacy Policy**: Available in extension settings

## 🐛 Troubleshooting

### Extension not working
- Check if API key is configured correctly
- Verify Chrome version (requires Chrome 88+)
- Check browser console for errors
- Ensure extension is enabled

### Search not finding products
- Verify platform is enabled in settings
- Check internet connection
- Try rephrasing your query
- Check if platform website structure has changed

### Orders not tracking
- Verify you're logged into the platform
- Check if order ID format is correct
- Ensure platform supports order tracking API

## 🤝 Contributing

Contributions are welcome! Please see the [Developer Guide](docs/DEVELOPER_GUIDE.md) for detailed contribution guidelines.

Quick start:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the [code style guidelines](docs/DEVELOPER_GUIDE.md#code-style-guidelines)
4. Write tests for your changes
5. Update documentation if needed
6. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

For detailed development workflow, see [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for natural language processing
- Chrome Extensions API
- All ecommerce platforms for their APIs

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/RetailAgent/issues)
- **Documentation**: See [`docs/`](docs/) directory for comprehensive documentation
  - [Architecture Guide](docs/ARCHITECTURE.md)
  - [Developer Guide](docs/DEVELOPER_GUIDE.md)
  - [API Documentation](docs/API_DOCUMENTATION.md)
  - [Platform Guide](docs/PLATFORM_GUIDE.md)
  - [Features Documentation](docs/FEATURES.md)

## 🗺️ Roadmap

See [TODO.md](TODO.md) for detailed roadmap and upcoming features.

### Upcoming Features
- Voice commands support
- Mobile app companion
- Firefox extension
- Advanced analytics dashboard
- Social sharing
- Price tracking and alerts

---

**Made with ❤️ for smarter shopping**
