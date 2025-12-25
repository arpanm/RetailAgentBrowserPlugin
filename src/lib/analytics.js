/**
 * Analytics Module
 * Optional analytics for usage tracking and error monitoring
 */

import { logger } from './logger.js';
import { configManager } from './config.js';

class Analytics {
    constructor() {
        this.enabled = false;
        this.events = [];
        this.maxEvents = 1000;
    }

    /**
     * Initialize analytics
     */
    async initialize() {
        this.enabled = await configManager.isFeatureEnabled('analytics');
        if (this.enabled) {
            logger.info('Analytics enabled');
        }
    }

    /**
     * Track event
     */
    track(eventName, properties = {}) {
        if (!this.enabled) {
            return;
        }

        const event = {
            name: eventName,
            properties,
            timestamp: new Date().toISOString(),
            sessionId: this._getSessionId(),
        };

        this.events.push(event);

        // Keep only last maxEvents
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }

        logger.debug('Analytics event tracked', { eventName, properties });
    }

    /**
     * Track error
     */
    trackError(error, context = {}) {
        this.track('error', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...context,
        });
    }

    /**
     * Track user action
     */
    trackAction(action, details = {}) {
        this.track('user_action', {
            action,
            ...details,
        });
    }

    /**
     * Track performance metric
     */
    trackPerformance(metricName, value, unit = 'ms') {
        this.track('performance', {
            metric: metricName,
            value,
            unit,
        });
    }

    /**
     * Get session ID
     */
    _getSessionId() {
        try {
            if (typeof sessionStorage !== 'undefined') {
                let sessionId = sessionStorage.getItem('analytics_session_id');
                if (!sessionId) {
                    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    sessionStorage.setItem('analytics_session_id', sessionId);
                }
                return sessionId;
            }
        } catch (e) {
            // sessionStorage not available
        }
        return 'no_session';
    }

    /**
     * Get analytics data
     */
    getData() {
        return {
            enabled: this.enabled,
            events: [...this.events],
            eventCount: this.events.length,
        };
    }

    /**
     * Clear analytics data
     */
    clear() {
        this.events = [];
        logger.info('Analytics data cleared');
    }

    /**
     * Export analytics data (for debugging)
     */
    export() {
        return JSON.stringify(this.getData(), null, 2);
    }
}

// Export singleton instance
export const analytics = new Analytics();

// Initialize on load
analytics.initialize().catch(error => {
    logger.error('Failed to initialize analytics', error);
});

