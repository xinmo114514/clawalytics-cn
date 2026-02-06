import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDatabase } from '../db/schema.js';
import { TOOL_DEFINITIONS, handleToolCall } from './tools.js';

export async function startMcpServer(): Promise<void> {
  // Ensure database is initialized before serving tools
  getDatabase();

  const server = new McpServer({
    name: 'clawalytics',
    version: '0.3.0',
  });

  // Register all tools
  for (const tool of TOOL_DEFINITIONS) {
    // Build a zod schema from the tool's inputSchema properties
    const schemaShape: Record<string, z.ZodTypeAny> = {};
    const props = tool.inputSchema.properties;
    const required = tool.inputSchema.required ?? [];

    for (const [key, prop] of Object.entries(props)) {
      const p = prop as { type?: string; enum?: string[]; description?: string };
      let zodType: z.ZodTypeAny;

      if (p.enum) {
        zodType = z.enum(p.enum as [string, ...string[]]);
      } else if (p.type === 'number') {
        zodType = z.number();
      } else if (p.type === 'boolean') {
        zodType = z.boolean();
      } else {
        zodType = z.string();
      }

      if (p.description) {
        zodType = zodType.describe(p.description);
      }

      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      schemaShape[key] = zodType;
    }

    const toolName = tool.name;
    server.tool(
      toolName,
      tool.description,
      schemaShape,
      async (args) => {
        try {
          const result = handleToolCall(toolName, args as Record<string, unknown>);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: message }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Start the stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run if called directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('/mcp/index.js') ||
  process.argv[1].endsWith('/mcp/index.ts')
);

if (isMainModule) {
  startMcpServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
