# Memory Cards - MCP App Specification

## The Idea

**Memory Cards** is an MCP App that lets users capture meaningful moments from their AI conversations as beautiful, collectible cards.

### The Problem

- Conversations with AI contain valuable moments: insights, decisions, advice, ideas, funny exchanges
- These moments get lost in chat history
- Exporting conversations gives you ugly JSON/text dumps
- ChatGPT's "memory" stores facts, not moments
- People want to **keep** something tangible from meaningful conversations

### The Solution

Anytime in a conversation, you say **"remember this"** (or tap a button). The agent:

1. Identifies the meaningful moment from context
2. Summarizes it into card-worthy text
3. Generates a beautiful card (postcard aesthetic)
4. Adds it to your personal collection

### Why It Works

| Element | Value |
|---------|-------|
| **Tangible output** | A card feels like you "got" something from the conversation |
| **Beautiful by default** | Share-worthy without effort |
| **Collection = gamification** | Completionism, browsing your gallery |
| **Shareable** | Pride — "look at this insight I captured" |
| **Persistent** | Your memories survive across conversations |

---

## MVP Scope

### Core Features (V1)

1. **Capture Command**
   - User says "remember this" or triggers via tool
   - Agent identifies the moment to capture
   - Agent generates card content (title, quote, context)

2. **Card Generation**
   - Beautiful card UI rendered via MCP App
   - One card style for MVP (postcard aesthetic)
   - Includes: visual, quote text, type badge, date, conversation context

3. **Card Collection**
   - View all captured cards in a grid
   - Click to expand individual card
   - Filter by type (insight, decision, funny, idea, milestone)

4. **Card Actions**
   - Download card as image (PNG)
   - Share link to card
   - Delete card
   - Edit card text

### Out of Scope (V2+)

- Multiple card visual styles
- AI-generated illustrations per card
- Yearly "Wrapped" summary
- Public profile/collection sharing
- Physical print ordering
- Tamagotchi companion integration
- Toolbox integration

---

## User Flows

### Flow 1: Capture a Memory

```
User: [Having a conversation about career decisions]

User: "I think I finally understand why I've been unhappy at work.
       It's not the job itself, it's that I'm not learning anymore."

Agent: "That's a powerful realization. Growth and learning are
        clearly core values for you..."

User: "Remember this"

Agent: [Calls capture_memory tool]
       [MCP App renders card preview]

       +-------------------------------------+
       |  MEMORY CAPTURED                    |
       |                                     |
       |  [Card Preview]                     |
       |  "It's not the job itself, it's    |
       |   that I'm not learning anymore"   |
       |                                     |
       |  Insight - Jan 27, 2026            |
       |                                     |
       |  [Save] [Edit] [Cancel]            |
       +-------------------------------------+

User: [Clicks Save]

Agent: "Saved to your collection! You now have 12 memory cards."
```

### Flow 2: Browse Collection

```
User: "Show my memory cards"

Agent: [Calls get_collection tool]
       [MCP App renders collection grid]

       +-------------------------------------------+
       |  YOUR MEMORIES (12 cards)                 |
       |                                           |
       |  [All] [Insights] [Decisions] [Ideas]    |
       |                                           |
       |  +-----+ +-----+ +-----+ +-----+         |
       |  |Card1| |Card2| |Card3| |Card4|         |
       |  +-----+ +-----+ +-----+ +-----+         |
       |                                           |
       |  +-----+ +-----+ +-----+ +-----+         |
       |  |Card5| |Card6| |Card7| |Card8|         |
       |  +-----+ +-----+ +-----+ +-----+         |
       +-------------------------------------------+

User: [Clicks on Card 2]

Agent: [MCP App expands to single card view with full details]
```

### Flow 3: Share a Card

```
User: [Viewing a card]
User: [Clicks "Download PNG"]

Agent: [MCP App generates downloadable image]
       "Here's your card! Ready to share."
```

---

## Data Model

### Card Entity

```typescript
interface MemoryCard {
  id: string;                    // UUID
  userId: string;                // User identifier

  // Content
  title: string;                 // Short title (agent-generated)
  quote: string;                 // The captured text
  context: string;               // What conversation it came from
  type: CardType;                // insight | decision | funny | idea | milestone

  // Metadata
  conversationId?: string;       // Reference to original conversation
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp

  // Display
  style: CardStyle;              // For V2: postcard | polaroid | watercolor | etc
}

type CardType = 'insight' | 'decision' | 'funny' | 'idea' | 'milestone';
type CardStyle = 'postcard';     // MVP: only one style
```

---

## MCP Tools

### Tool 1: `capture_memory`

Capture a moment from the current conversation as a memory card.

**Input:**
```typescript
{
  quote: string;           // The text to capture
  title?: string;          // Optional title (agent generates if not provided)
  type?: CardType;         // Optional type (agent infers if not provided)
  context?: string;        // Description of the conversation context
}
```

**Output:** UI resource showing card preview with save/edit/cancel options.

**Visibility:** `["model", "app"]`

---

### Tool 2: `get_collection`

Retrieve user's card collection.

**Input:**
```typescript
{
  filter?: CardType;       // Optional: filter by type
  limit?: number;          // Optional: pagination (default 20)
  offset?: number;         // Optional: pagination offset
}
```

**Output:** UI resource showing card grid.

**Visibility:** `["model", "app"]`

---

### Tool 3: `get_card`

Get a single card's details.

**Input:**
```typescript
{
  cardId: string;
}
```

**Output:** UI resource showing single card view.

**Visibility:** `["model", "app"]`

---

### Tool 4: `update_card`

Edit a card's content.

**Input:**
```typescript
{
  cardId: string;
  title?: string;
  quote?: string;
  type?: CardType;
}
```

**Output:** Updated card data.

**Visibility:** `["app"]` (UI only)

---

### Tool 5: `delete_card`

Delete a card from collection.

**Input:**
```typescript
{
  cardId: string;
}
```

**Output:** Confirmation.

**Visibility:** `["app"]` (UI only)

---

### Tool 6: `export_card_image`

Generate downloadable PNG of a card.

**Input:**
```typescript
{
  cardId: string;
  format?: 'square' | 'story' | 'wide';
}
```

**Output:** Image data or download URL.

**Visibility:** `["app"]` (UI only)

---

## MCP UI Resources

| Resource URI | Purpose |
|--------------|---------|
| `ui://memory-cards/capture` | Card capture/preview interface |
| `ui://memory-cards/collection` | Card collection grid view |
| `ui://memory-cards/card` | Single card detail view |

---

## UI Design Specs

### Card Visual (Postcard Style)

```
+-------------------------------------------+
|                                           |
|   +-----------------------------------+   |
|   |                                   |   |
|   |      [Decorative Pattern]         |   |
|   |         or Gradient               |   |
|   |                                   |   |
|   +-----------------------------------+   |
|                                           |
|   ----------------------------------------|
|                                           |
|   "The captured quote goes here,         |
|    formatted nicely with proper          |
|    line breaks and emphasis."            |
|                                           |
|   ----------------------------------------|
|                                           |
|   [icon] Insight                         |
|   January 27, 2026                        |
|                                           |
+-------------------------------------------+
```

### Color Palette by Type

| Type | Primary Color | Hex |
|------|--------------|-----|
| Insight | Warm amber | #F59E0B |
| Decision | Deep blue | #3B82F6 |
| Funny | Bright pink | #EC4899 |
| Idea | Electric purple | #8B5CF6 |
| Milestone | Emerald green | #10B981 |

### Typography

- **Title:** Inter Bold, 18px
- **Quote:** Lora (serif), 16px, italic
- **Meta:** Inter Regular, 12px, muted

### Dimensions

- **Card aspect ratio:** 3:4 (portrait)
- **Grid thumbnail:** 160px x 213px
- **Expanded card:** 320px x 427px
- **Export sizes:**
  - Square: 1080 x 1080 (Instagram)
  - Story: 1080 x 1920 (Stories)
  - Wide: 1200 x 630 (Twitter/OG)

---

## Success Metrics

- Cards captured per user
- Collection views per user
- Cards shared (downloads + link copies)
- Retention (users who capture 2+ cards)
- Viral coefficient (shares -> new users)

---

## Open Questions (Resolved)

### 1. User identity: How do we identify users across sessions?

**Resolution: Anonymous + Recovery Link**

- Generate UUID on first visit, store in browser localStorage
- Same browser/device = same collection (no login required)
- "Recovery Link" feature lets users transfer to other devices
- V2: Optional OAuth (Google/GitHub) for persistent accounts

See ARCHITECTURE.md → User Identity section for implementation details.

---

### 2. Quote extraction: How smart should the agent be about identifying "the moment"?

**Resolution: Agent-driven with user override**

- Agent uses conversation context to identify the meaningful moment
- Agent generates title, selects type, extracts quote
- User can edit all fields before saving
- Simple heuristics for type inference (keywords like "decided", "realized", "idea")

---

### 3. Conversation context: Can we access conversation ID from MCP host?

**Resolution: Optional, host-dependent**

- Not all MCP hosts provide conversation IDs
- Make `conversationId` optional in the data model
- If available via MCP context, capture it
- If not, use "Unknown conversation" or timestamp-based identifier

---

### 4. Rate limiting: How many cards per user for free tier?

**Resolution: Generous free tier, controlled via Statsig**

| Tier | Cards/month | Total cards |
|------|-------------|-------------|
| Free | 50 | 500 |
| Pro (V2) | Unlimited | Unlimited |

- Limits enforced server-side via D1 query
- Configurable via Statsig dynamic config (no redeploy needed)
- Soft limit with friendly "upgrade" prompt, not hard block
