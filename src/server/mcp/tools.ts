import { getAnalyticsService } from '../services/analytics-service.js';
import { getAlerts, getOutboundCallStats } from '../db/queries-security.js';
import { getBudgetStatus } from '../services/budget-checker.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_spending_summary',
    description: 'Get a comprehensive spending summary across time periods (today, this month, last month, lifetime). Includes total cost, tokens, cache savings, and session counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_cost_breakdown',
    description: 'Get cost breakdown by model, provider, agent, or channel. Returns detailed cost and token data grouped by the specified dimension.',
    inputSchema: {
      type: 'object',
      properties: {
        by: {
          type: 'string',
          enum: ['model', 'agent'],
          description: 'Group costs by "model" or "agent"',
        },
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 30)',
        },
      },
      required: ['by'],
    },
  },
  {
    name: 'get_daily_costs',
    description: 'Get daily cost trend data for the specified number of days. Returns cost, tokens, cache savings, session count, and request count per day.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 30)',
        },
      },
    },
  },
  {
    name: 'get_model_comparison',
    description: 'Compare cost-efficiency across models. Returns input/output tokens, cache token breakdown, cost, and request count per model.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 30)',
        },
      },
    },
  },
  {
    name: 'get_budget_status',
    description: 'Get current spending vs configured budget thresholds for daily, weekly, and monthly periods. Returns spent amount, budget limit, and percentage used.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_security_alerts',
    description: 'Get recent security alerts. Can filter by acknowledged status.',
    inputSchema: {
      type: 'object',
      properties: {
        acknowledged: {
          type: 'boolean',
          description: 'Filter by acknowledged status (omit for all alerts)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of alerts to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'get_agent_stats',
    description: 'Get per-agent performance statistics. Returns cost, tokens, and session count for each configured agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Optional: get daily cost breakdown for a specific agent ID',
        },
        days: {
          type: 'number',
          description: 'Number of days for daily breakdown (default: 30)',
        },
      },
    },
  },
  {
    name: 'get_session_stats',
    description: 'Get recent session information including project path, cost, tokens, and models used.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of sessions to return (default: 20)',
        },
      },
    },
  },
  {
    name: 'get_tool_usage',
    description: 'Get tool call statistics including total calls, unique tools, average duration, error rate, and top tools by call count.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 30)',
        },
      },
    },
  },
  {
    name: 'get_cache_efficiency',
    description: 'Get cache hit rates and savings analysis. Returns total savings, cache read/write tokens, savings percentage, and token breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 30)',
        },
      },
    },
  },
];

export function handleToolCall(name: string, args: Record<string, unknown>): unknown {
  const svc = getAnalyticsService();

  switch (name) {
    case 'get_spending_summary': {
      const summary = svc.getCostSummary();
      const trend = svc.getWeeklyTrend();
      return {
        ...summary,
        weeklyTrend: {
          thisWeekCost: trend.thisWeek.cost,
          lastWeekCost: trend.lastWeek.cost,
          changePercent: trend.changePercent,
        },
      };
    }

    case 'get_cost_breakdown': {
      const by = args.by as string;
      const days = (args.days as number) ?? 30;

      if (by === 'model') {
        return svc.getModelUsage(days);
      } else if (by === 'agent') {
        const stats = svc.getAgentStatsResult();
        return stats.agents;
      }
      return { error: `Unknown breakdown type: ${by}` };
    }

    case 'get_daily_costs': {
      const days = (args.days as number) ?? 30;
      return svc.getDailyCosts(days);
    }

    case 'get_model_comparison': {
      const days = (args.days as number) ?? 30;
      return svc.getModelUsageWithCache(days);
    }

    case 'get_budget_status': {
      return getBudgetStatus();
    }

    case 'get_security_alerts': {
      const acknowledged = args.acknowledged as boolean | undefined;
      const limit = (args.limit as number) ?? 20;
      return getAlerts(acknowledged, limit);
    }

    case 'get_agent_stats': {
      const agentId = args.agent_id as string | undefined;
      const days = (args.days as number) ?? 30;

      if (agentId) {
        const agent = svc.getAgent(agentId);
        const dailyCosts = svc.getAgentDailyCosts(agentId, days);
        return { agent: agent ?? null, dailyCosts };
      }

      const stats = svc.getAgentStatsResult();
      return stats;
    }

    case 'get_session_stats': {
      const limit = (args.limit as number) ?? 20;
      const sessions = svc.getSessions(limit);
      const total = svc.getSessionCount();
      return { sessions, total };
    }

    case 'get_tool_usage': {
      const days = (args.days as number) ?? 30;
      return getOutboundCallStats(days);
    }

    case 'get_cache_efficiency': {
      const days = (args.days as number) ?? 30;
      const savings = svc.getCacheSavings(days);
      const breakdown = svc.getTokenBreakdown(days);
      return {
        ...savings,
        tokenBreakdown: {
          input: breakdown.input,
          output: breakdown.output,
          cacheRead: breakdown.cacheRead,
          cacheCreation: breakdown.cacheCreation,
          total: breakdown.total,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
