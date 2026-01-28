# Memory Cards - Technical Architecture

## Overview

Memory Cards is built as an MCP App running on Cloudflare Workers, using D1 for persistence and KV for caching.

```
+-----------------------------------------------------------+
|                  MCP Host (Claude/ChatGPT)                |
|                                                           |
|  +-------------+     +--------------------------------+   |
|  |   Agent     |---->|      MCP App (iframe)          |   |
|  |             |     |                                |   |
|  | "remember   |     |  - Capture UI                  |   |
|  |  this"      |     |  - Collection Grid UI          |   |
|  |             |     |  - Card Detail UI              |   |
|  +-------------+     |                                |   |
|        |             |  postMessage <-> JSON-RPC      |   |
|        |             +--------------------------------+   |
|        |                         |                        |
+--------|-------------------------|------------------------+
         |                         |
         v                         v
+-----------------------------------------------------------+
|                   Cloudflare Workers                       |
|                                                           |
|  +-----------------------------------------------------+  |
|  |                  Hono + MCP Plugin                   |  |
|  |                                                      |  |
|  |  MCP Handlers:          API Routes:                 |  |
|  |  - tools/list           - GET /api/cards/:id/image  |  |
|  |  - tools/call           - GET /share/:id            |  |
|  |  - resources/read                                   |  |
|  +-----------------------------------------------------+  |
|              |                         |                   |
|              v                         v                   |
|  +-------------------+     +-------------------------+    |
|  |   Cloudflare D1   |     |    Cloudflare KV        |    |
|  |   (SQLite)        |     |    (Cache)              |    |
|  |                   |     |                         |    |
|  |  - users          |     |  - session data         |    |
|  |  - cards          |     |  - image cache          |    |
|  +-------------------+     +-------------------------+    |
+-----------------------------------------------------------+
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Cloudflare Workers | Edge compute, global distribution |
| Package Manager | Bun | Fast package manager and runtime |
| Framework | Hono | Fast, lightweight web framework |
| MCP | @modelcontextprotocol/sdk | MCP protocol handling |
| Database | Cloudflare D1 | SQLite at the edge, persistent storage |
| Cache | Cloudflare KV | Session data, image cache |
| UI Framework | React 18 (from esm.sh) | Component-based UI via CDN |
| Build Tool | Vite | Fast builds, HTML bundling |
| Analytics | Statsig | Event logging, feature flags, experiments |

---

## User Identity

### Strategy: Anonymous + Recovery Link

For MVP, we use a **device-local anonymous identity** with an optional **recovery link** for cross-device access.

```
┌─────────────────────────────────────────────────────────────┐
│                     First Visit                              │
├─────────────────────────────────────────────────────────────┤
│  1. UI checks localStorage for `mc_user_id`                 │
│  2. If not found, generate UUID via crypto.randomUUID()     │
│  3. Store in localStorage: { mc_user_id: "uuid-here" }      │
│  4. Send to server, which creates user record in D1         │
│  5. Server returns session token, stored in KV              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Return Visit                              │
├─────────────────────────────────────────────────────────────┤
│  1. UI reads mc_user_id from localStorage                   │
│  2. Sends to server with each request                       │
│  3. Server validates and returns user's cards               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Recovery Link (Cross-Device)                │
├─────────────────────────────────────────────────────────────┤
│  1. User clicks "Get Recovery Link" in settings             │
│  2. Server generates signed token: sign(userId, secret)     │
│  3. Returns URL: https://memory-cards.app/recover/{token}   │
│  4. User saves/shares link to access on other device        │
│  5. On new device, link sets mc_user_id in localStorage     │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

**Client (React UI):**
```typescript
// hooks/useUserId.ts
export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem('mc_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('mc_user_id', id);
    }
    setUserId(id);
  }, []);

  return userId;
}
```

**Server (Cloudflare Workers):**
```typescript
// utils/auth.ts
import { sign, verify } from 'hono/jwt';

export async function getUserId(request: Request, env: Env): Promise<string> {
  const userId = request.headers.get('X-User-Id');

  if (!userId) {
    throw new Error('User ID required');
  }

  // Ensure user exists in D1
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!existing) {
    await env.DB.prepare(
      'INSERT INTO users (id) VALUES (?)'
    ).bind(userId).run();
  }

  return userId;
}

export async function generateRecoveryToken(userId: string, env: Env): Promise<string> {
  return await sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400 * 365 }, env.JWT_SECRET);
}

export async function verifyRecoveryToken(token: string, env: Env): Promise<string | null> {
  try {
    const payload = await verify(token, env.JWT_SECRET);
    return payload.sub as string;
  } catch {
    return null;
  }
}
```

### V2: OAuth Integration

For V2, add optional OAuth (Google/GitHub) for persistent cross-device accounts:
- User can "upgrade" anonymous account by linking OAuth
- Cards transfer from anonymous ID to OAuth account
- Implemented via Cloudflare Workers + OAuth providers

---

## Analytics & Events (Statsig)

### Why Statsig

- **Event logging** - Track user actions for success metrics
- **Feature gates** - Control rollout of new features
- **Experiments** - A/B test card styles, UX variations
- **Dynamic config** - Adjust rate limits, defaults without deploy

### Events to Track

| Event | Properties | Trigger |
|-------|-----------|---------|
| `card_captured` | `type`, `quoteLength`, `hasCustomTitle` | User saves a card |
| `card_viewed` | `cardId`, `source` (collection/direct) | User views card detail |
| `collection_viewed` | `cardCount`, `filter` | User opens collection |
| `card_shared` | `cardId`, `format` (png/link) | User exports/shares |
| `card_deleted` | `cardId`, `cardAge` | User deletes card |
| `card_edited` | `cardId`, `fieldsChanged` | User edits card |

### Feature Gates

| Gate | Purpose |
|------|---------|
| `new_card_styles` | Gate V2 card styles |
| `ai_illustrations` | Gate AI-generated art |
| `recovery_link` | Gate recovery link feature |

### Implementation

**Client (React UI):**
```typescript
// hooks/useStatsig.ts
import { StatsigClient } from '@statsig/js-client';

let statsigClient: StatsigClient | null = null;

export async function initStatsig(userId: string) {
  statsigClient = new StatsigClient(
    import.meta.env.VITE_STATSIG_CLIENT_KEY,
    { userID: userId }
  );
  await statsigClient.initializeAsync();
}

export function logEvent(name: string, value?: string | number, metadata?: Record<string, string>) {
  statsigClient?.logEvent(name, value, metadata);
}

export function checkGate(gateName: string): boolean {
  return statsigClient?.checkGate(gateName) ?? false;
}
```

**Server (Cloudflare Workers):**
```typescript
// utils/statsig.ts
import Statsig from 'statsig-node';

export async function initStatsigServer(env: Env) {
  await Statsig.initialize(env.STATSIG_SERVER_KEY, {
    environment: { tier: env.ENVIRONMENT }
  });
}

export async function logServerEvent(
  userId: string,
  eventName: string,
  metadata?: Record<string, string | number>
) {
  Statsig.logEvent({ userID: userId }, eventName, undefined, metadata);
}
```

### Configuration

**Environment variables (wrangler.toml):**
```toml
[vars]
STATSIG_SERVER_KEY = "secret-xxx"  # Use wrangler secret for prod

# For client, use VITE_ prefix in ui/.env
# VITE_STATSIG_CLIENT_KEY = "client-xxx"
```

---

## Project Structure

```
collectibles-mcp-app/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── mcp/
│   │   ├── server.ts         # MCP server setup
│   │   ├── tools/
│   │   │   ├── capture.ts    # capture_memory tool
│   │   │   ├── collection.ts # get_collection tool
│   │   │   ├── card.ts       # get_card, update_card, delete_card
│   │   │   └── export.ts     # export_card_image tool
│   │   └── resources/
│   │       └── ui.ts         # UI resource handlers
│   ├── db/
│   │   ├── schema.ts         # Database schema types
│   │   ├── queries.ts        # D1 query functions
│   │   └── migrations/
│   │       └── 001_initial.sql
│   └── utils/
│       ├── auth.ts           # User identification
│       ├── analytics.ts      # Statsig server-side events
│       └── image.ts          # Card image generation
├── ui/                       # React UI (built with Vite)
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Root component with routing
│   │   ├── components/
│   │   │   ├── Card.tsx      # Memory card component
│   │   │   ├── CardPreview.tsx
│   │   │   ├── CardGrid.tsx
│   │   │   └── TypeBadge.tsx
│   │   ├── views/
│   │   │   ├── CaptureView.tsx
│   │   │   ├── CollectionView.tsx
│   │   │   └── CardDetailView.tsx
│   │   ├── hooks/
│   │   │   ├── useMcpClient.ts
│   │   │   ├── useHostStyles.ts
│   │   │   ├── useUserId.ts        # Anonymous user identity
│   │   │   └── useStatsig.ts       # Analytics client
│   │   └── styles/
│   │       └── index.css
│   ├── index.html            # Template for Vite
│   ├── vite.config.ts
│   └── package.json          # UI-specific deps
├── wrangler.toml             # Cloudflare config
├── package.json              # Root package.json (Bun workspace)
├── tsconfig.json
├── SPEC.md
└── ARCHITECTURE.md
```

---

## Database Schema (D1)

### migrations/001_initial.sql

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  card_count INTEGER NOT NULL DEFAULT 0
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quote TEXT NOT NULL,
  context TEXT,
  type TEXT NOT NULL CHECK (type IN ('insight', 'decision', 'funny', 'idea', 'milestone')),
  style TEXT NOT NULL DEFAULT 'postcard',
  conversation_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
```

---

## MCP Server Implementation

### src/mcp/server.ts

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';
import { captureMemoryTool } from './tools/capture';
import { getCollectionTool } from './tools/collection';
import { getCardTool, updateCardTool, deleteCardTool } from './tools/card';
import { exportCardImageTool } from './tools/export';

export function createMcpServer(env: Env) {
  const server = new McpServer({
    name: 'memory-cards',
    version: '1.0.0',
  });

  // Register tools
  server.tool('capture_memory', captureMemoryTool(env));
  server.tool('get_collection', getCollectionTool(env));
  server.tool('get_card', getCardTool(env));
  server.tool('update_card', updateCardTool(env));
  server.tool('delete_card', deleteCardTool(env));
  server.tool('export_card_image', exportCardImageTool(env));

  // Register UI resources
  server.resource('ui://memory-cards/capture', {
    mimeType: 'text/html;profile=mcp-app',
    // Content loaded from bundled HTML
  });

  server.resource('ui://memory-cards/collection', {
    mimeType: 'text/html;profile=mcp-app',
  });

  server.resource('ui://memory-cards/card', {
    mimeType: 'text/html;profile=mcp-app',
  });

  return server;
}
```

---

## Tool Implementations

### src/mcp/tools/capture.ts

```typescript
import { z } from 'zod';
import { nanoid } from 'nanoid';

const CaptureInput = z.object({
  quote: z.string().min(1).max(1000),
  title: z.string().max(100).optional(),
  type: z.enum(['insight', 'decision', 'funny', 'idea', 'milestone']).optional(),
  context: z.string().max(200).optional(),
});

export function captureMemoryTool(env: Env) {
  return {
    description: 'Capture a meaningful moment from the conversation as a memory card',
    inputSchema: CaptureInput,

    async handler(input: z.infer<typeof CaptureInput>, context: McpContext) {
      const userId = await getUserId(context, env);

      // Generate defaults if not provided
      const card = {
        id: nanoid(),
        userId,
        title: input.title || generateTitle(input.quote),
        quote: input.quote,
        type: input.type || inferType(input.quote),
        context: input.context || 'Conversation',
        style: 'postcard',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Don't save yet - return preview UI
      // Card will be saved when user confirms in UI

      return {
        content: [{
          type: 'resource',
          resource: {
            uri: 'ui://memory-cards/capture',
            mimeType: 'text/html;profile=mcp-app',
          }
        }],
        _meta: {
          ui: {
            resourceUri: 'ui://memory-cards/capture',
            visibility: ['model', 'app'],
          },
          // Pass card data to UI
          cardPreview: card,
        }
      };
    }
  };
}

function generateTitle(quote: string): string {
  // Simple: take first few words
  const words = quote.split(' ').slice(0, 5).join(' ');
  return words.length < quote.length ? `${words}...` : words;
}

function inferType(quote: string): CardType {
  // Simple heuristics - can be improved
  const lower = quote.toLowerCase();
  if (lower.includes('decided') || lower.includes('going to') || lower.includes('will ')) {
    return 'decision';
  }
  if (lower.includes('realized') || lower.includes('understand') || lower.includes('finally')) {
    return 'insight';
  }
  if (lower.includes('idea') || lower.includes('what if') || lower.includes('could ')) {
    return 'idea';
  }
  if (lower.includes('finished') || lower.includes('completed') || lower.includes('achieved')) {
    return 'milestone';
  }
  return 'insight'; // default
}
```

### src/mcp/tools/collection.ts

```typescript
import { z } from 'zod';

const CollectionInput = z.object({
  filter: z.enum(['insight', 'decision', 'funny', 'idea', 'milestone']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export function getCollectionTool(env: Env) {
  return {
    description: 'View your collection of memory cards',
    inputSchema: CollectionInput,

    async handler(input: z.infer<typeof CollectionInput>, context: McpContext) {
      const userId = await getUserId(context, env);

      // Query cards from D1
      let query = 'SELECT * FROM cards WHERE user_id = ?';
      const params: any[] = [userId];

      if (input.filter) {
        query += ' AND type = ?';
        params.push(input.filter);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(input.limit, input.offset);

      const result = await env.DB.prepare(query).bind(...params).all();
      const cards = result.results;

      // Get total count
      const countQuery = input.filter
        ? 'SELECT COUNT(*) as count FROM cards WHERE user_id = ? AND type = ?'
        : 'SELECT COUNT(*) as count FROM cards WHERE user_id = ?';
      const countParams = input.filter ? [userId, input.filter] : [userId];
      const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

      return {
        content: [{
          type: 'resource',
          resource: {
            uri: 'ui://memory-cards/collection',
            mimeType: 'text/html;profile=mcp-app',
          }
        }],
        _meta: {
          ui: {
            resourceUri: 'ui://memory-cards/collection',
            visibility: ['model', 'app'],
          },
          cards,
          total: countResult?.count || 0,
          filter: input.filter,
        }
      };
    }
  };
}
```

---

## UI Implementation (React 18)

The UI is built with React 18 loaded from esm.sh CDN. Vite builds a single HTML file with inlined assets.

### ui/index.html (Vite template)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18",
        "react-dom/client": "https://esm.sh/react-dom@18/client"
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lora:ital@1&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### ui/src/main.tsx

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

### ui/src/hooks/useMcpClient.ts

```tsx
import { useState, useEffect, useCallback } from 'react';

interface McpMessage {
  jsonrpc: '2.0';
  method?: string;
  id?: number;
  params?: any;
  result?: any;
}

export function useMcpClient() {
  const [isReady, setIsReady] = useState(false);
  const [toolInput, setToolInput] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<McpMessage>) => {
      const message = event.data;

      if (message.method === 'ui/notifications/tool-input') {
        setToolInput(message.params?.input);
      }
    };

    window.addEventListener('message', handleMessage);

    // Initialize MCP connection
    window.parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/initialize',
      params: { capabilities: {} }
    }, '*');

    setIsReady(true);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const callTool = useCallback((name: string, args: any) => {
    window.parent.postMessage({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args }
    }, '*');
  }, []);

  const close = useCallback(() => {
    window.parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/close'
    }, '*');
  }, []);

  return { isReady, toolInput, callTool, close };
}
```

### ui/src/components/Card.tsx

```tsx
import React from 'react';
import { CardType } from '../types';

interface CardProps {
  quote: string;
  type: CardType;
  date: string;
  onClick?: () => void;
}

const typeColors: Record<CardType, { primary: string; dark: string }> = {
  insight: { primary: '#F59E0B', dark: '#D97706' },
  decision: { primary: '#3B82F6', dark: '#2563EB' },
  funny: { primary: '#EC4899', dark: '#DB2777' },
  idea: { primary: '#8B5CF6', dark: '#7C3AED' },
  milestone: { primary: '#10B981', dark: '#059669' },
};

export function Card({ quote, type, date, onClick }: CardProps) {
  const colors = typeColors[type];

  return (
    <div
      className="card"
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)`
      }}
      onClick={onClick}
    >
      <div className="card-header" />
      <div className="card-quote">"{quote}"</div>
      <div className="card-meta">
        <span className="card-type">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
        <span className="card-date">{date}</span>
      </div>
    </div>
  );
}
```

### ui/src/views/CaptureView.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { useMcpClient } from '../hooks/useMcpClient';
import { Card } from '../components/Card';
import { CardType } from '../types';

export function CaptureView() {
  const { toolInput, callTool, close } = useMcpClient();

  const [title, setTitle] = useState('');
  const [quote, setQuote] = useState('');
  const [type, setType] = useState<CardType>('insight');

  useEffect(() => {
    if (toolInput) {
      setTitle(toolInput.title || '');
      setQuote(toolInput.quote || '');
      setType(toolInput.type || 'insight');
    }
  }, [toolInput]);

  const handleSave = () => {
    callTool('save_card', {
      ...toolInput,
      title,
      quote,
      type,
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

  return (
    <div className="container">
      <header className="header">
        <h2>Memory Captured</h2>
      </header>

      <Card
        quote={quote}
        type={type}
        date={formatDate(toolInput?.createdAt || new Date().toISOString())}
      />

      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short title..."
        />
      </div>

      <div className="form-group">
        <label>Quote</label>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="The captured moment..."
        />
      </div>

      <div className="form-group">
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as CardType)}>
          <option value="insight">Insight</option>
          <option value="decision">Decision</option>
          <option value="funny">Funny</option>
          <option value="idea">Idea</option>
          <option value="milestone">Milestone</option>
        </select>
      </div>

      <div className="actions">
        <button className="btn btn-secondary" onClick={close}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save to Collection</button>
      </div>
    </div>
  );
}
```

---

## Cloudflare Configuration

### wrangler.toml

```toml
name = "memory-cards"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "memory-cards-db"
database_id = "<your-database-id>"

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS"
id = "<your-kv-id>"

[[kv_namespaces]]
binding = "IMAGE_CACHE"
id = "<your-kv-id>"

# Development
[env.dev]
vars = { ENVIRONMENT = "development" }

[env.dev.d1_databases]
binding = "DB"
database_name = "memory-cards-db-dev"
database_id = "<your-dev-database-id>"
```

---

## Main Worker Entry

### src/index.ts

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMcpServer } from './mcp/server';

type Env = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  IMAGE_CACHE: KVNamespace;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS for MCP communication
app.use('*', cors());

// MCP endpoint
app.post('/mcp', async (c) => {
  const server = createMcpServer(c.env);
  const request = await c.req.json();
  const response = await server.handleRequest(request);
  return c.json(response);
});

// Card image export
app.get('/api/cards/:id/image', async (c) => {
  const cardId = c.req.param('id');
  const format = c.req.query('format') || 'square';

  // Check cache first
  const cacheKey = `image:${cardId}:${format}`;
  const cached = await c.env.IMAGE_CACHE.get(cacheKey, 'arrayBuffer');
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'image/png' }
    });
  }

  // Generate image (implementation in utils/image.ts)
  const card = await getCard(c.env.DB, cardId);
  if (!card) {
    return c.json({ error: 'Card not found' }, 404);
  }

  const image = await generateCardImage(card, format);

  // Cache for 1 hour
  await c.env.IMAGE_CACHE.put(cacheKey, image, { expirationTtl: 3600 });

  return new Response(image, {
    headers: { 'Content-Type': 'image/png' }
  });
});

// Public share page
app.get('/share/:id', async (c) => {
  const cardId = c.req.param('id');
  const card = await getCard(c.env.DB, cardId);

  if (!card) {
    return c.html('<h1>Card not found</h1>', 404);
  }

  // Return a simple HTML page with the card
  return c.html(renderSharePage(card));
});

export default app;
```

---

## Security Configuration

### CSP for MCP App

```typescript
const uiResourceMetadata = {
  csp: {
    connectDomains: [
      'https://featureassets.org',   // Statsig SDK assets
      'https://statsigapi.net',      // Statsig event logging
      'https://api.statsig.com',     // Statsig API
    ],
    resourceDomains: [
      'https://esm.sh',              // React 18 CDN
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://cdn.jsdelivr.net',    // Statsig client SDK
    ],
    frameDomains: [],
  },
  permissions: [], // No special permissions needed
  prefersBorder: true,
};
```

---

## Development Phases

### Phase 1: Infrastructure (Days 1-3)

- [ ] Initialize project with Bun workspace
- [ ] Set up Vite for UI builds
- [ ] Configure Cloudflare Workers with Hono
- [ ] Create D1 database and run migrations
- [ ] Set up KV namespaces
- [ ] Implement basic MCP server skeleton

### Phase 2: Core Tools (Days 4-6)

- [ ] Implement `capture_memory` tool
- [ ] Implement `get_collection` tool
- [ ] Implement `get_card` tool
- [ ] Implement `update_card` tool
- [ ] Implement `delete_card` tool
- [ ] Implement `save_card` internal tool

### Phase 3: UI Development with React (Days 7-10)

- [ ] Set up React 18 with esm.sh imports
- [ ] Build useMcpClient hook
- [ ] Build Card component with type-based styling
- [ ] Build CaptureView with live preview
- [ ] Build CollectionView with grid layout
- [ ] Build CardDetailView with actions
- [ ] Configure Vite to output single HTML files

### Phase 4: Integration & Polish (Days 11-14)

- [ ] Wire tools to UI resources (embed built HTML)
- [ ] Implement image export with canvas
- [ ] Add public share page
- [ ] Test with MCP host (Claude Desktop)
- [ ] Error handling and loading states

---

## Testing

### Local Development

```bash
# Install dependencies with Bun
bun install

# Start UI dev server (hot reload)
bun run dev:ui

# Start worker dev server
bun run dev

# Run D1 migrations locally
bun run db:migrate:local

# Build UI for production
bun run build:ui

# Type check
bun run typecheck
```

### Testing with MCP Host

Use the MCP Inspector or a compatible host (Claude Desktop, etc.) to test the integration:

1. Connect to `http://localhost:8787/mcp`
2. Call `capture_memory` with test data
3. Verify UI renders correctly
4. Test save flow
5. Test collection browsing

---

## Future Considerations

### V2 Features

- Multiple card styles (Polaroid, watercolor, etc.)
- AI-generated illustrations via Workers AI
- Yearly "Wrapped" summary generation
- OAuth for persistent accounts
- Public collection sharing

### Scaling

- D1 handles SQLite scaling automatically
- KV provides global edge caching
- Workers scale to millions of requests
- Consider R2 for image storage at scale
