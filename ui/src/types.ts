export type CardType = 'insight' | 'decision' | 'funny' | 'idea' | 'milestone';
export type CardStyle = 'postcard';

export interface MemoryCard {
  id: string;
  userId: string;
  title: string;
  quote: string;
  context: string;
  type: CardType;
  style: CardStyle;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardPreview {
  id?: string;
  title: string;
  quote: string;
  context?: string;
  type: CardType;
  createdAt: string;
}

export const TYPE_COLORS: Record<CardType, { primary: string; dark: string }> = {
  insight: { primary: '#F59E0B', dark: '#D97706' },
  decision: { primary: '#3B82F6', dark: '#2563EB' },
  funny: { primary: '#EC4899', dark: '#DB2777' },
  idea: { primary: '#8B5CF6', dark: '#7C3AED' },
  milestone: { primary: '#10B981', dark: '#059669' },
};

export const TYPE_LABELS: Record<CardType, string> = {
  insight: 'Insight',
  decision: 'Decision',
  funny: 'Funny',
  idea: 'Idea',
  milestone: 'Milestone',
};
