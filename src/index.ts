import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for MCP communication
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'memory-cards',
    version: '0.1.0',
    status: 'ok',
  });
});

// MCP Protocol endpoint
// TODO: Implement MCP server handling
app.post('/mcp', async (c) => {
  const request = await c.req.json();

  // TODO: Route to MCP server
  // For now, return a placeholder
  return c.json({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      message: 'MCP server not yet implemented',
    },
  });
});

// Card image export endpoint
app.get('/api/cards/:id/image', async (c) => {
  const cardId = c.req.param('id');
  const format = c.req.query('format') || 'square';

  // TODO: Implement image generation
  return c.json({
    error: 'Not yet implemented',
    cardId,
    format,
  }, 501);
});

// Public share page
app.get('/share/:id', async (c) => {
  const cardId = c.req.param('id');

  // TODO: Implement share page
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Memory Card</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <h1>Memory Card: ${cardId}</h1>
      <p>Share page not yet implemented</p>
    </body>
    </html>
  `);
});

export default app;
