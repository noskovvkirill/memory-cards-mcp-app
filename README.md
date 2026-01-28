# Memory Cards - MCP App

Capture meaningful moments from AI conversations as beautiful, collectible cards.

## What is this?

Memory Cards is an MCP App that lets you say "remember this" during any AI conversation and capture that moment as a beautiful, shareable card. Build a collection of your insights, decisions, funny moments, and ideas.

## Features

- **Instant capture** - Say "remember this" to save a moment
- **Beautiful cards** - Postcard-style design, not ugly text dumps
- **Collection gallery** - Browse all your captured memories
- **Shareable** - Download cards as images or share links
- **Persistent** - Your memories survive across conversations

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV
- **Framework:** Hono
- **Protocol:** MCP (Model Context Protocol)

## Development

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create memory-cards-db
# Copy the database_id to wrangler.toml

# Create KV namespace
wrangler kv:namespace create SESSIONS
# Copy the id to wrangler.toml

# Run migrations
npm run db:migrate:local

# Start dev server
npm run dev
```

### Project Structure

```
src/
├── index.ts           # Main worker entry
├── types.ts           # TypeScript types
├── mcp/
│   ├── server.ts      # MCP server setup
│   ├── tools/         # Tool implementations
│   └── resources/     # UI resources
├── db/
│   ├── queries.ts     # Database queries
│   └── migrations/    # SQL migrations
├── ui/
│   ├── capture.html   # Card capture UI
│   ├── collection.html # Collection grid
│   └── card.html      # Card detail view
└── utils/
    └── image.ts       # Card image generation
```

## Documentation

- [SPEC.md](./SPEC.md) - Product specification
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture

## License

MIT
