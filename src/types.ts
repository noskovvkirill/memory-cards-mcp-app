// Environment bindings
export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  ENVIRONMENT: string;
}

// Card types
export type CardType = 'insight' | 'decision' | 'funny' | 'idea' | 'milestone';
export type CardStyle = 'postcard';

export interface MemoryCard {
  id: string;
  userId: string;
  title: string;
  quote: string;
  context: string | null;
  type: CardType;
  style: CardStyle;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  createdAt: string;
  cardCount: number;
}

// MCP Tool inputs
export interface CaptureMemoryInput {
  quote: string;
  title?: string;
  type?: CardType;
  context?: string;
}

export interface GetCollectionInput {
  filter?: CardType;
  limit?: number;
  offset?: number;
}

export interface GetCardInput {
  cardId: string;
}

export interface UpdateCardInput {
  cardId: string;
  title?: string;
  quote?: string;
  type?: CardType;
}

export interface DeleteCardInput {
  cardId: string;
}

export interface ExportCardImageInput {
  cardId: string;
  format?: 'square' | 'story' | 'wide';
}

// Card colors by type
export const CARD_COLORS: Record<CardType, { primary: string; dark: string }> = {
  insight: { primary: '#F59E0B', dark: '#D97706' },
  decision: { primary: '#3B82F6', dark: '#2563EB' },
  funny: { primary: '#EC4899', dark: '#DB2777' },
  idea: { primary: '#8B5CF6', dark: '#7C3AED' },
  milestone: { primary: '#10B981', dark: '#059669' },
};
