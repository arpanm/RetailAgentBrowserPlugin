document.addEventListener('DOMContentLoaded', () => {
  const messagesDiv = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const settingsModal = document.getElementById('settings-modal');
  const apiKeyInput = document.getElementById('api-key');
  const phoneNumberInput = document.getElementById('phone-number');
  const saveSettingsBtn = document.getElementById('save-settings');
  const checkModelsBtn = document.getElementById('check-models');
  const closeSettingsBtn = document.getElementById('close-settings');
  const loginPlatformsBtn = document.getElementById('login-platforms-btn');

  // Load settings
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['geminiApiKey', 'phoneNumber', 'loggedInPlatforms'], (result) => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
      } else {
        appendMessage('system', 'Please set your Gemini API Key in settings first.');
        settingsModal.classList.remove('hidden');
      }
      
      if (result.phoneNumber) {
        phoneNumberInput.value = result.phoneNumber;
      }
      
      // Load platform login status
      const loggedInPlatforms = result.loggedInPlatforms || [];
      ['amazon', 'flipkart', 'ebay', 'walmart'].forEach(platform => {
        const checkbox = document.getElementById(`${platform}-login`);
        if (checkbox) {
          checkbox.checked = loggedInPlatforms.includes(platform);
        }
      });
    });
  } else {
    console.error('chrome.storage not available. Are you running as an extension?');
    appendMessage('system', 'Error: Extension APIs not available.');
  }

  // Open side panel when extension icon is clicked
  chrome.action.onClicked?.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
  });

  // Initialize side panel if not already set
  chrome.runtime.onInstalled?.addListener(() => {
    chrome.sidePanel.setOptions({
      path: 'src/popup/index.html',
      enabled: true
    });
  });

  checkModelsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      appendMessage('system', 'Enter API Key first');
      return;
    }

    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      appendMessage('system', 'Checking models...');
      chrome.runtime.sendMessage({ type: 'CHECK_MODELS', apiKey: key }, (response) => {
        if (chrome.runtime.lastError) {
          appendMessage('system', 'Runtime Error: ' + chrome.runtime.lastError.message);
        } else if (response && response.error) {
          appendMessage('system', 'API Error: ' + response.error);
        } else if (response && response.models) {
          const names = response.models.map(m => m.name.replace('models/', '')).join(', ');
          appendMessage('system', 'Available Models: ' + names);
        } else {
          appendMessage('system', 'Unknown response from background script.');
        }
      });
    } else {
      appendMessage('system', 'Error: Extension APIs not available.');
    }
  });

  // Load previous messages from storage
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['chatHistory'], (result) => {
      if (result.chatHistory && Array.isArray(result.chatHistory)) {
        // Clear the default welcome message
        messagesDiv.innerHTML = '';
        // Reset collapsible state
        currentCollapsibleGroup = null;
        collapsibleMessageCount = 0;
        // Load all previous messages
        result.chatHistory.forEach(msg => {
          appendMessage(msg.sender, msg.text, false); // false = don't save to storage (already saved)
        });
        // Close any remaining collapsible group
        if (currentCollapsibleGroup) {
          currentCollapsibleGroup = null;
          collapsibleMessageCount = 0;
        }
        // Scroll to bottom
        scrollToBottom();
      }
    });
  }

  // Clear chat button
  clearChatBtn.addEventListener('click', () => {
    if (confirm('Clear all messages and start over?')) {
      messagesDiv.innerHTML = '';
      currentCollapsibleGroup = null;
      collapsibleMessageCount = 0;
      chrome.storage.local.set({ chatHistory: [] }, () => {
        appendMessage('system', 'Chat cleared. How can I help you?');
      });
    }
  });

  // Handlers
  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Keyboard navigation support
  document.addEventListener('keydown', (e) => {
    // Escape key closes settings modal
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
    }
  });

  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const phone = phoneNumberInput.value.trim();
    
    const updates = {};
    if (key) {
      updates.geminiApiKey = key;
    }
    if (phone) {
      updates.phoneNumber = phone;
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        alert('Settings saved!');
        settingsModal.classList.add('hidden');
        appendMessage('system', 'Settings saved successfully.');
      });
    }
  });

  // Platform login button
  loginPlatformsBtn.addEventListener('click', async () => {
    const selectedPlatforms = [];
    ['amazon', 'flipkart', 'ebay', 'walmart'].forEach(platform => {
      const checkbox = document.getElementById(`${platform}-login`);
      if (checkbox && checkbox.checked) {
        selectedPlatforms.push(platform);
      }
    });
    
    if (selectedPlatforms.length === 0) {
      appendMessage('system', 'Please select at least one platform to login.');
      return;
    }
    
    const phone = phoneNumberInput.value.trim();
    if (!phone) {
      appendMessage('system', 'Please enter your phone number first.');
      return;
    }
    
    loginPlatformsBtn.disabled = true;
    loginPlatformsBtn.textContent = 'Logging in...';
    
    try {
      appendMessage('system', `Starting login for ${selectedPlatforms.length} platform(s)...`);
      appendMessage('system', 'Please enter OTP on each platform website when prompted.');
      
      await chrome.runtime.sendMessage({
        type: 'LOGIN_PLATFORMS',
        platforms: selectedPlatforms,
        phoneNumber: phone
      });
      
      appendMessage('system', 'Login process started. Check browser tabs and enter OTP on each platform.');
    } catch (error) {
      appendMessage('system', `Error: ${error.message}`);
    } finally {
      loginPlatformsBtn.disabled = false;
      loginPlatformsBtn.textContent = 'Login to Selected Platforms';
    }
  });


  // Export logs functionality
  const exportLogsBtn = document.getElementById('export-logs-btn');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', async () => {
      try {
        appendMessage('system', 'Exporting logs...');
        
        const { detailedLogs = [], actionLogs = [] } = await chrome.storage.local.get(['detailedLogs', 'actionLogs']);
        
        let allLogs = [];
        if (detailedLogs && detailedLogs.length > 0) {
          allLogs = detailedLogs;
        } else if (actionLogs && actionLogs.length > 0) {
          allLogs = actionLogs.map(log => ({
            timestamp: log.time || new Date().toISOString(),
            level: log.text?.includes('[ERROR]') ? 'ERROR' : log.text?.includes('[WARN]') ? 'WARN' : 'INFO',
            message: log.text || '',
            data: log.fullLog || {}
          }));
        }
        
        if (allLogs.length === 0) {
          appendMessage('system', 'No logs found to export.');
          return;
        }
        
        const logText = allLogs.map(log => {
          const timestamp = log.timestamp || log.time || new Date().toISOString();
          const level = log.level || 'INFO';
          const message = log.message || log.text || '';
          const data = log.data || log.fullLog || {};
          return `[${timestamp}] [${level}] ${message}\n${JSON.stringify(data, null, 2)}`;
        }).join('\n\n---\n\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `retailagent-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        appendMessage('system', `Logs exported successfully! (${allLogs.length} entries)`);
      } catch (error) {
        appendMessage('system', `Error exporting logs: ${error.message}`);
        console.error('Export logs error:', error);
      }
    });
  }

  function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Close any open collapsible group before new message
    if (currentCollapsibleGroup) {
      currentCollapsibleGroup = null;
      collapsibleMessageCount = 0;
    }

    // Add user message to chat
    appendMessage('user', text);
    userInput.value = '';
    userInput.focus();

    // Send to background
    chrome.runtime.sendMessage({ type: 'PROCESS_QUERY', text: text }, (response) => {
      if (chrome.runtime.lastError) {
        appendMessage('system', 'Error: ' + chrome.runtime.lastError.message);
      } else if (response && response.status === 'processing') {
        // Background accepted it
      }
    });
  }

  // Track current collapsible group
  let currentCollapsibleGroup = null;
  let collapsibleMessageCount = 0;
  
  // Check if message is a final/important message (user needs to see)
  const isFinalMessage = (text) => {
    const finalPatterns = [
      /^Searching for/,
      /^Opening .* in a new tab/,
      /^Found .* items/,
      /^✅/,
      /^Unable to complete/,
      /^Please proceed manually/,
      /^Please complete/,
      /^Please click/,
      /^Product might be/,
      /^Added to cart successfully/,
      /^Settings saved/,
      /^Chat cleared/,
      /^Logs exported/,
      /^Available Models:/,
      /^Maximum retry attempts reached/,
      /^No suitable products found/,
      /^All navigation methods failed/,
    ];
    return finalPatterns.some(pattern => pattern.test(text));
  };
  
  // Messages that should be grouped as intermediate/collapsible
  // Everything else that's a system message and NOT a final message
  const isIntermediateMessage = (text, sender) => {
    // User messages are never intermediate
    if (sender !== 'system') return false;
    
    // Check if it's a final message first
    if (isFinalMessage(text)) return false;
    
    // All other system messages are intermediate
    return true;
  };

  function appendMessage(sender, text, saveToStorage = true) {
    // Close any open collapsible group for user messages
    if (sender === 'user' && currentCollapsibleGroup) {
      currentCollapsibleGroup = null;
      collapsibleMessageCount = 0;
    }
    
    // Check if this is an intermediate system message
    if (isIntermediateMessage(text, sender)) {
      // Create or add to collapsible group
      if (!currentCollapsibleGroup) {
        currentCollapsibleGroup = createCollapsibleGroup();
        messagesDiv.appendChild(currentCollapsibleGroup.container);
      }
      
      // Add message to collapsible content
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${sender} collapsible-message`;
      msgDiv.textContent = text;
      currentCollapsibleGroup.content.appendChild(msgDiv);
      collapsibleMessageCount++;
      
      // Update summary with better descriptions
      let summaryText = '';
      if (collapsibleMessageCount === 1) {
        summaryText = 'Processing...';
      } else if (collapsibleMessageCount < 5) {
        summaryText = `${collapsibleMessageCount} steps (click to expand)`;
      } else {
        summaryText = `${collapsibleMessageCount} steps (click to expand)`;
      }
      currentCollapsibleGroup.summary.textContent = summaryText;
    } else {
      // Close any open collapsible group before adding final message
      if (currentCollapsibleGroup) {
        currentCollapsibleGroup = null;
        collapsibleMessageCount = 0;
      }
      
      // Regular message (final/important)
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${sender}`;
      msgDiv.textContent = text;
      messagesDiv.appendChild(msgDiv);
    }
    
    scrollToBottom();

    // Save to storage for persistence
    if (saveToStorage) {
      chrome.storage.local.get(['chatHistory'], (result) => {
        const history = result.chatHistory || [];
        history.push({ sender, text, timestamp: new Date().toISOString() });
        // Keep only last 100 messages
        if (history.length > 100) {
          history.splice(0, history.length - 100);
        }
        chrome.storage.local.set({ chatHistory: history });
      });
    }
  }
  
  function createCollapsibleGroup() {
    const container = document.createElement('div');
    container.className = 'collapsible-group';
    
    const header = document.createElement('div');
    header.className = 'collapsible-header';
    
    const icon = document.createElement('span');
    icon.className = 'collapsible-icon';
    icon.textContent = '🔄';
    
    const summary = document.createElement('span');
    summary.className = 'collapsible-summary';
    summary.textContent = 'Processing...';
    
    const toggle = document.createElement('button');
    toggle.className = 'collapsible-toggle';
    toggle.textContent = '▶';
    toggle.setAttribute('aria-label', 'Expand details');
    toggle.setAttribute('aria-expanded', 'false');
    
    const content = document.createElement('div');
    content.className = 'collapsible-content collapsed';
    
    header.appendChild(toggle);
    header.appendChild(icon);
    header.appendChild(summary);
    container.appendChild(header);
    container.appendChild(content);
    
    // Toggle functionality
    header.addEventListener('click', () => {
      const isExpanded = content.classList.toggle('collapsed');
      toggle.textContent = isExpanded ? '▶' : '▼';
      toggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      scrollToBottom();
    });
    
    return { container, header, summary, content };
  }

  function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_STATUS') {
      appendMessage('system', message.text);
    }
    return false;
  });

  // Focus input on load
  userInput.focus();
});
