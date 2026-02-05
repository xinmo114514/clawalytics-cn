import {
  createAlert,
  logAudit,
  type SecurityAlert,
  type AlertInput,
} from '../db/queries-security.js';

// ============================================
// Interfaces
// ============================================

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  condition: (event: unknown) => boolean;
  severity: AlertSeverity;
  message: (event: unknown) => string;
}

export interface AlertServiceConfig {
  /** Enable or disable the alert service */
  enabled: boolean;
  /** Custom rules to add to defaults */
  customRules?: AlertRule[];
  /** Replace default rules entirely */
  replaceDefaults?: boolean;
}

// ============================================
// Default Alert Rules
// ============================================

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'auth_failure',
    name: 'Authentication Failure',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return event.event === 'auth_failure';
    },
    severity: 'high',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `Authentication failure from ${event.ip || 'unknown IP'}`;
    },
  },
  {
    id: 'new_device',
    name: 'New Device Pairing',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return event.type === 'device_paired';
    },
    severity: 'medium',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `New device paired: ${event.name || 'Unknown device'}`;
    },
  },
  {
    id: 'suspicious_connection',
    name: 'Suspicious Connection Pattern',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return (
        event.event === 'connection' &&
        typeof event.connectionCount === 'number' &&
        event.connectionCount > 100
      );
    },
    severity: 'high',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `Unusual connection frequency from device ${event.deviceId || 'unknown'}`;
    },
  },
  {
    id: 'pairing_request',
    name: 'New Pairing Request',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return event.type === 'pairing_request';
    },
    severity: 'medium',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `New pairing request from: ${event.deviceName || 'Unknown device'}`;
    },
  },
  {
    id: 'device_removed',
    name: 'Device Removed',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return event.type === 'device_removed';
    },
    severity: 'low',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `Device removed: ${event.deviceId || 'Unknown'}`;
    },
  },
  {
    id: 'connection_error',
    name: 'Connection Error',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return event.level === 'ERROR' && event.event === 'connection';
    },
    severity: 'medium',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `Connection error: ${event.message || event.error || 'Unknown error'}`;
    },
  },
  {
    id: 'multiple_auth_failures',
    name: 'Multiple Authentication Failures',
    condition: (e): boolean => {
      const event = e as Record<string, unknown>;
      return (
        event.event === 'auth_failure' &&
        typeof event.failureCount === 'number' &&
        event.failureCount >= 3
      );
    },
    severity: 'critical',
    message: (e): string => {
      const event = e as Record<string, unknown>;
      return `Multiple authentication failures (${event.failureCount}) from ${event.ip || 'unknown IP'}`;
    },
  },
];

// ============================================
// Alert Service Class
// ============================================

export class AlertService {
  private rules: Map<string, AlertRule>;
  private enabled: boolean;

  // Singleton instance
  private static instance: AlertService | null = null;

  constructor(config?: AlertServiceConfig) {
    this.rules = new Map();
    this.enabled = config?.enabled ?? true;

    // Initialize rules
    if (!config?.replaceDefaults) {
      for (const rule of DEFAULT_RULES) {
        this.rules.set(rule.id, rule);
      }
    }

    // Add custom rules
    if (config?.customRules) {
      for (const rule of config.customRules) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  /**
   * Get the singleton instance of AlertService
   */
  static getInstance(config?: AlertServiceConfig): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService(config);
    }
    return AlertService.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    AlertService.instance = null;
  }

  /**
   * Process an event and generate alerts if rules match
   */
  processEvent(event: unknown): void {
    if (!this.enabled) {
      return;
    }

    const alerts = this.checkRules(event);

    for (const alert of alerts) {
      // Create alert in database
      const alertId = createAlert({
        type: alert.ruleId,
        severity: alert.severity,
        message: alert.message,
        details: JSON.stringify(event),
      });

      // Create audit log entry
      logAudit({
        action: 'alert_triggered',
        entity_type: 'alert',
        entity_id: String(alertId),
        details: JSON.stringify({
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          severity: alert.severity,
        }),
      });

      console.log(
        `[ALERT] ${alert.severity.toUpperCase()}: ${alert.message} (rule: ${alert.ruleId})`
      );
    }
  }

  /**
   * Check all rules against an event and return triggered alerts
   */
  checkRules(event: unknown): Array<{
    ruleId: string;
    ruleName: string;
    severity: AlertSeverity;
    message: string;
  }> {
    const triggeredAlerts: Array<{
      ruleId: string;
      ruleName: string;
      severity: AlertSeverity;
      message: string;
    }> = [];

    for (const [id, rule] of this.rules) {
      try {
        if (rule.condition(event)) {
          triggeredAlerts.push({
            ruleId: id,
            ruleName: rule.name,
            severity: rule.severity,
            message: rule.message(event),
          });
        }
      } catch (error) {
        console.error(`Error checking rule ${id}:`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Add a new alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Added alert rule: ${rule.id}`);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      console.log(`Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Get a specific rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable or disable the alert service
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`Alert service ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if the alert service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// ============================================
// Convenience exports
// ============================================

/**
 * Get the default alert rules
 */
export function getDefaultAlertRules(): AlertRule[] {
  return [...DEFAULT_RULES];
}

/**
 * Create a custom alert rule
 */
export function createAlertRule(
  id: string,
  name: string,
  severity: AlertSeverity,
  condition: (event: unknown) => boolean,
  message: (event: unknown) => string
): AlertRule {
  return {
    id,
    name,
    severity,
    condition,
    message,
  };
}
