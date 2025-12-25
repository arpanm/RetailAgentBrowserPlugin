/**
 * Structured logging system with log levels and persistent storage
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const MAX_LOG_ENTRIES = 1000;

class Logger {
    constructor() {
        this.logLevel = LOG_LEVELS.INFO;
        this.logs = [];
    }

    /**
     * Set the minimum log level
     * @param {string} level - 'DEBUG', 'INFO', 'WARN', or 'ERROR'
     */
    setLevel(level) {
        this.logLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    }

    /**
     * Log a debug message
     */
    debug(message, data = {}) {
        this._log(LOG_LEVELS.DEBUG, 'DEBUG', message, data);
    }

    /**
     * Log an info message
     */
    info(message, data = {}) {
        this._log(LOG_LEVELS.INFO, 'INFO', message, data);
    }

    /**
     * Log a warning message
     */
    warn(message, data = {}) {
        this._log(LOG_LEVELS.WARN, 'WARN', message, data);
    }

    /**
     * Log an error message
     */
    error(message, error = null, data = {}) {
        // Safely extract error information without DOM references
        let safeError = null;
        if (error) {
            try {
                if (error instanceof Error) {
                    safeError = {
                        message: String(error.message || 'Unknown error'),
                        stack: String(error.stack || ''),
                        name: String(error.name || 'Error')
                    };
                } else if (typeof error === 'string') {
                    safeError = { message: error, name: 'Error' };
                } else {
                    const errorStr = JSON.stringify(error, (key, value) => {
                        if (value && typeof value === 'object') {
                            try {
                                if (value.nodeType !== undefined || value.tagName !== undefined) return '[DOM Element]';
                                if (typeof globalThis.window !== 'undefined' && value === globalThis.window) return '[Browser Object]';
                                if (typeof globalThis.document !== 'undefined' && value === globalThis.document) return '[Browser Object]';
                                if (typeof globalThis.navigator !== 'undefined' && value === globalThis.navigator) return '[Browser Object]';
                            } catch (e) { return '[Inaccessible Object]'; }
                        }
                        if (typeof value === 'function') return '[Function]';
                        return value;
                    });
                    const parsed = JSON.parse(errorStr);
                    safeError = {
                        message: String(parsed.message || error.message || 'Unknown error'),
                        stack: String(parsed.stack || error.stack || ''),
                        name: String(parsed.name || error.name || 'Error')
                    };
                }
            } catch (e) {
                safeError = { message: 'Error serialization failed', name: 'Error' };
            }
        }
        
        // Ensure data is serializable
        let safeData = {};
        try {
            const dataStr = JSON.stringify(data, (key, value) => {
                if (value && typeof value === 'object') {
                    try {
                        if (value.nodeType !== undefined || value.tagName !== undefined) return '[DOM Element]';
                        if (typeof globalThis.window !== 'undefined' && value === globalThis.window) return '[Browser Object]';
                        if (typeof globalThis.document !== 'undefined' && value === globalThis.document) return '[Browser Object]';
                        if (typeof globalThis.navigator !== 'undefined' && value === globalThis.navigator) return '[Browser Object]';
                    } catch (e) { return '[Inaccessible Object]'; }
                }
                if (typeof value === 'function') return '[Function]';
                return value;
            });
            safeData = JSON.parse(dataStr);
        } catch (e) {
            safeData = { _serializationError: 'Failed to serialize log data' };
        }
        
        const errorData = {
            ...safeData,
            error: safeError
        };
        
        this._log(LOG_LEVELS.ERROR, 'ERROR', message, errorData);
        
        // Track error in analytics
        if (error) {
            import('./analytics.js').then(({ analytics }) => {
                analytics.trackError(error, { message, ...safeData });
            }).catch(() => {});
        }
    }

    /**
     * Internal logging method
     */
    _log(level, levelName, message, data = {}) {
        if (level < this.logLevel) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: levelName,
            message,
            data,
            context: this._getContext()
        };

        // Add to in-memory logs
        this.logs.push(logEntry);
        if (this.logs.length > MAX_LOG_ENTRIES) {
            this.logs.shift();
        }

        // Console output
        const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' :
                             level === LOG_LEVELS.WARN ? 'warn' :
                             level === LOG_LEVELS.DEBUG ? 'debug' : 'log';
        
        console[consoleMethod](`[${levelName}] ${message}`, data);

        // Persist to storage
        this._persistLog(logEntry);
    }

    /**
     * Get context information (tab ID, URL, etc.)
     */
    _getContext() {
        try {
            return {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Service Worker',
                timestamp: Date.now()
            };
        } catch (e) {
            return {
                userAgent: 'Unknown',
                timestamp: Date.now()
            };
        }
    }

    /**
     * Persist log entry to chrome.storage
     */
    async _persistLog(logEntry) {
        try {
            const { actionLogs = [], detailedLogs = [] } = await chrome.storage.local.get(['actionLogs', 'detailedLogs']);
            
            // Simple logs for popup display
            actionLogs.push({
                time: new Date().toLocaleTimeString(),
                text: `[${logEntry.level}] ${logEntry.message}`,
                fullLog: logEntry
            });
            
            // Detailed logs for debugging
            detailedLogs.push(logEntry);
            
            // Keep only last MAX_LOG_ENTRIES
            if (actionLogs.length > MAX_LOG_ENTRIES) {
                actionLogs.splice(0, actionLogs.length - MAX_LOG_ENTRIES);
            }
            if (detailedLogs.length > MAX_LOG_ENTRIES) {
                detailedLogs.splice(0, detailedLogs.length - MAX_LOG_ENTRIES);
            }
            
            await chrome.storage.local.set({ actionLogs, detailedLogs });
        } catch (error) {
            console.error('Failed to persist log:', error);
        }
    }

    /**
     * Export logs as downloadable file
     */
    async exportLogs() {
        try {
            const { detailedLogs = [] } = await chrome.storage.local.get(['detailedLogs']);
            const logText = detailedLogs.map(log => 
                `[${log.timestamp}] [${log.level}] ${log.message} ${JSON.stringify(log.data || {})}`
            ).join('\n');
            
            return logText;
        } catch (error) {
            console.error('Failed to export logs:', error);
            return '';
        }
    }

    /**
     * Get all logs
     */
    getLogs() {
        return [...this.logs];
    }

    /**
     * Clear all logs
     */
    async clearLogs() {
        this.logs = [];
        await chrome.storage.local.set({ actionLogs: [] });
    }

    /**
     * Get logs filtered by level
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }
}

// Export singleton instance
export const logger = new Logger();

