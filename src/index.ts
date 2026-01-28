import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, CardType } from './types';
import { getOrCreateUser, createCard, getCard, getCards, updateCard, deleteCard } from './db/queries';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for MCP communication
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-User-Id'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'memory-cards',
    version: '0.1.0',
    status: 'ok',
  });
});

// =============================================================================
// MCP Protocol Implementation
// =============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// Tool definitions
const TOOLS = [
  {
    name: 'capture_memory',
    description: 'Capture a meaningful moment from the conversation as a memory card. Call this when the user says "remember this" or wants to save a moment.',
    inputSchema: {
      type: 'object',
      properties: {
        quote: { type: 'string', description: 'The text to capture (the meaningful moment)' },
        title: { type: 'string', description: 'Optional short title for the card' },
        type: { type: 'string', enum: ['insight', 'decision', 'funny', 'idea', 'milestone'], description: 'Type of memory' },
        context: { type: 'string', description: 'Brief context about the conversation' },
      },
      required: ['quote'],
    },
  },
  {
    name: 'get_collection',
    description: 'View the user\'s collection of memory cards. Call this when the user wants to see their saved memories.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['insight', 'decision', 'funny', 'idea', 'milestone'], description: 'Filter by card type' },
        limit: { type: 'number', description: 'Max cards to return (default 20)' },
        offset: { type: 'number', description: 'Pagination offset' },
      },
    },
  },
  {
    name: 'get_card',
    description: 'Get details of a specific memory card.',
    inputSchema: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'The card ID' },
      },
      required: ['cardId'],
    },
  },
  {
    name: 'save_card',
    description: 'Save a memory card to the collection. Called from the UI after user confirms.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        title: { type: 'string' },
        quote: { type: 'string' },
        type: { type: 'string', enum: ['insight', 'decision', 'funny', 'idea', 'milestone'] },
        context: { type: 'string' },
      },
      required: ['userId', 'quote', 'type'],
    },
  },
  {
    name: 'update_card',
    description: 'Update an existing memory card.',
    inputSchema: {
      type: 'object',
      properties: {
        cardId: { type: 'string' },
        title: { type: 'string' },
        quote: { type: 'string' },
        type: { type: 'string', enum: ['insight', 'decision', 'funny', 'idea', 'milestone'] },
      },
      required: ['cardId'],
    },
  },
  {
    name: 'delete_card',
    description: 'Delete a memory card from the collection.',
    inputSchema: {
      type: 'object',
      properties: {
        cardId: { type: 'string' },
      },
      required: ['cardId'],
    },
  },
];

// Infer card type from quote text
function inferType(quote: string): CardType {
  const lower = quote.toLowerCase();
  if (lower.includes('decided') || lower.includes('going to') || lower.includes('will ') || lower.includes('choose')) {
    return 'decision';
  }
  if (lower.includes('realized') || lower.includes('understand') || lower.includes('finally') || lower.includes('learned')) {
    return 'insight';
  }
  if (lower.includes('idea') || lower.includes('what if') || lower.includes('could ') || lower.includes('imagine')) {
    return 'idea';
  }
  if (lower.includes('finished') || lower.includes('completed') || lower.includes('achieved') || lower.includes('done')) {
    return 'milestone';
  }
  if (lower.includes('lol') || lower.includes('haha') || lower.includes('funny') || lower.includes('hilarious')) {
    return 'funny';
  }
  return 'insight';
}

// Generate a title from quote
function generateTitle(quote: string): string {
  const words = quote.split(' ').slice(0, 6).join(' ');
  return words.length < quote.length ? `${words}...` : words;
}

// MCP endpoint
app.post('/mcp', async (c) => {
  const request = await c.req.json() as JsonRpcRequest;
  const userId = c.req.header('X-User-Id');

  const respond = (result: unknown): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id: request.id,
    result,
  });

  const respondError = (code: number, message: string): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id: request.id,
    error: { code, message },
  });

  try {
    switch (request.method) {
      // =======================================================================
      // MCP Discovery
      // =======================================================================
      case 'initialize': {
        return c.json(respond({
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'memory-cards',
            version: '0.1.0',
          },
          capabilities: {
            tools: {},
            resources: {},
          },
        }));
      }

      case 'tools/list': {
        return c.json(respond({ tools: TOOLS }));
      }

      // =======================================================================
      // Tool Handlers
      // =======================================================================
      case 'tools/call': {
        const { name, arguments: args } = request.params as { name: string; arguments: Record<string, unknown> };

        switch (name) {
          case 'capture_memory': {
            const quote = args.quote as string;
            const title = (args.title as string) || generateTitle(quote);
            const type = (args.type as CardType) || inferType(quote);
            const context = (args.context as string) || 'Conversation';

            // Return card preview for UI to display
            return c.json(respond({
              content: [{
                type: 'text',
                text: `Memory captured! Type: ${type}\n\n"${quote}"\n\nReview and save in the card preview.`,
              }],
              _meta: {
                ui: {
                  resourceUri: 'ui://memory-cards/capture',
                  visibility: ['model', 'app'],
                },
                cardPreview: {
                  title,
                  quote,
                  type,
                  context,
                  createdAt: new Date().toISOString(),
                },
              },
            }));
          }

          case 'save_card': {
            const cardUserId = args.userId as string;
            if (!cardUserId) {
              return c.json(respondError(-32602, 'userId required'));
            }

            await getOrCreateUser(c.env.DB, cardUserId);

            const card = await createCard(c.env.DB, cardUserId, {
              title: args.title as string,
              quote: args.quote as string,
              type: args.type as CardType,
              context: args.context as string,
            });

            return c.json(respond({
              content: [{
                type: 'text',
                text: `Card saved! You now have a new ${card.type} memory in your collection.`,
              }],
              card,
            }));
          }

          case 'get_collection': {
            if (!userId) {
              return c.json(respondError(-32602, 'X-User-Id header required'));
            }

            const { cards, total } = await getCards(c.env.DB, userId, {
              filter: args.filter as CardType | undefined,
              limit: (args.limit as number) || 20,
              offset: (args.offset as number) || 0,
            });

            return c.json(respond({
              content: [{
                type: 'text',
                text: `Found ${total} memory cards.`,
              }],
              _meta: {
                ui: {
                  resourceUri: 'ui://memory-cards/collection',
                  visibility: ['model', 'app'],
                },
                cards,
                total,
                filter: args.filter,
              },
            }));
          }

          case 'get_card': {
            const cardId = args.cardId as string;
            const card = await getCard(c.env.DB, cardId);

            if (!card) {
              return c.json(respondError(-32602, 'Card not found'));
            }

            return c.json(respond({
              content: [{
                type: 'text',
                text: `"${card.quote}"\n\n— ${card.type}, ${new Date(card.createdAt).toLocaleDateString()}`,
              }],
              _meta: {
                ui: {
                  resourceUri: 'ui://memory-cards/card',
                  visibility: ['model', 'app'],
                },
              },
              card,
            }));
          }

          case 'update_card': {
            const cardId = args.cardId as string;
            const updated = await updateCard(c.env.DB, cardId, {
              title: args.title as string | undefined,
              quote: args.quote as string | undefined,
              type: args.type as CardType | undefined,
            });

            if (!updated) {
              return c.json(respondError(-32602, 'Card not found'));
            }

            return c.json(respond({
              content: [{ type: 'text', text: 'Card updated!' }],
              card: updated,
            }));
          }

          case 'delete_card': {
            const cardId = args.cardId as string;
            const deleted = await deleteCard(c.env.DB, cardId);

            if (!deleted) {
              return c.json(respondError(-32602, 'Card not found'));
            }

            return c.json(respond({
              content: [{ type: 'text', text: 'Card deleted.' }],
            }));
          }

          default:
            return c.json(respondError(-32601, `Unknown tool: ${name}`));
        }
      }

      // =======================================================================
      // Resource Handlers (UI HTML)
      // =======================================================================
      case 'resources/list': {
        return c.json(respond({
          resources: [
            { uri: 'ui://memory-cards/capture', name: 'Capture View', mimeType: 'text/html' },
            { uri: 'ui://memory-cards/collection', name: 'Collection View', mimeType: 'text/html' },
            { uri: 'ui://memory-cards/card', name: 'Card Detail View', mimeType: 'text/html' },
          ],
        }));
      }

      case 'resources/read': {
        const uri = (request.params as { uri: string }).uri;

        // TODO: Return actual built HTML from ui/dist
        // For now, return placeholder
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memory Cards</title>
</head>
<body>
  <div id="root">Loading...</div>
  <script>
    // Placeholder - replace with built React app
    document.getElementById('root').innerHTML = '<p>UI not yet bundled. URI: ${uri}</p>';
  </script>
</body>
</html>`;

        return c.json(respond({
          contents: [{
            uri,
            mimeType: 'text/html;profile=mcp-app',
            text: html,
          }],
        }));
      }

      default:
        return c.json(respondError(-32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    console.error('MCP error:', error);
    return c.json(respondError(-32603, error instanceof Error ? error.message : 'Internal error'));
  }
});

// =============================================================================
// Public API Endpoints
// =============================================================================

// Card image export
app.get('/api/cards/:id/image', async (c) => {
  const cardId = c.req.param('id');
  const format = c.req.query('format') || 'square';

  const card = await getCard(c.env.DB, cardId);
  if (!card) {
    return c.json({ error: 'Card not found' }, 404);
  }

  // TODO: Implement actual image generation with canvas/resvg
  // For now return a placeholder response
  return c.json({
    message: 'Image generation not yet implemented',
    card,
    format,
  }, 501);
});

// Public share page
app.get('/share/:id', async (c) => {
  const cardId = c.req.param('id');
  const card = await getCard(c.env.DB, cardId);

  if (!card) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Card Not Found</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .message { text-align: center; }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Card Not Found</h1>
          <p>This memory card doesn't exist or has been deleted.</p>
        </div>
      </body>
      </html>
    `, 404);
  }

  const typeColors: Record<string, string> = {
    insight: '#F59E0B',
    decision: '#3B82F6',
    funny: '#EC4899',
    idea: '#8B5CF6',
    milestone: '#10B981',
  };

  const color = typeColors[card.type] || '#3B82F6';
  const date = new Date(card.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${card.title} - Memory Card</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta property="og:title" content="${card.title}">
      <meta property="og:description" content="${card.quote.slice(0, 150)}">
      <meta property="og:type" content="article">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Lora:ital@1&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .card {
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
          border-radius: 16px;
          padding: 24px;
          color: white;
          max-width: 360px;
          width: 100%;
          aspect-ratio: 3 / 4;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .card-header {
          height: 60px;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .card-title { font-size: 14px; font-weight: 600; opacity: 0.9; }
        .card-body { flex: 1; display: flex; align-items: center; }
        .card-quote {
          font-family: 'Lora', serif;
          font-style: italic;
          font-size: 18px;
          line-height: 1.5;
          text-align: center;
          width: 100%;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          opacity: 0.9;
          margin-top: 20px;
        }
        .card-type { text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px; }
        .branding {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">${card.title}</span>
          </div>
          <div class="card-body">
            <p class="card-quote">"${card.quote}"</p>
          </div>
          <div class="card-footer">
            <span class="card-type">${card.type}</span>
            <span>${date}</span>
          </div>
        </div>
        <p class="branding">Made with Memory Cards</p>
      </div>
    </body>
    </html>
  `);
});

export default app;
