import { nanoid } from 'nanoid';
import type { MemoryCard, CardType, User } from '../types';

// User queries
export async function getOrCreateUser(db: D1Database, userId: string): Promise<User> {
  // Try to get existing user
  const existing = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();

  if (existing) {
    return existing;
  }

  // Create new user
  const now = new Date().toISOString();
  await db
    .prepare('INSERT INTO users (id, created_at, card_count) VALUES (?, ?, 0)')
    .bind(userId, now)
    .run();

  return {
    id: userId,
    createdAt: now,
    cardCount: 0,
  };
}

// Card queries
export async function createCard(
  db: D1Database,
  userId: string,
  data: {
    title: string;
    quote: string;
    type: CardType;
    context?: string;
    conversationId?: string;
  }
): Promise<MemoryCard> {
  const id = nanoid();
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO cards (id, user_id, title, quote, context, type, style, conversation_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'postcard', ?, ?, ?)
    `)
    .bind(
      id,
      userId,
      data.title,
      data.quote,
      data.context || null,
      data.type,
      data.conversationId || null,
      now,
      now
    )
    .run();

  // Increment user's card count
  await db
    .prepare('UPDATE users SET card_count = card_count + 1 WHERE id = ?')
    .bind(userId)
    .run();

  return {
    id,
    userId,
    title: data.title,
    quote: data.quote,
    context: data.context || null,
    type: data.type,
    style: 'postcard',
    conversationId: data.conversationId || null,
    createdAt: now,
    updatedAt: now,
  };
}

// Map DB row to MemoryCard (snake_case -> camelCase)
function mapCard(row: Record<string, unknown>): MemoryCard {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    quote: row.quote as string,
    context: row.context as string | null,
    type: row.type as CardType,
    style: row.style as 'postcard',
    conversationId: row.conversation_id as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getCard(db: D1Database, cardId: string): Promise<MemoryCard | null> {
  const row = await db
    .prepare('SELECT * FROM cards WHERE id = ?')
    .bind(cardId)
    .first<Record<string, unknown>>();

  return row ? mapCard(row) : null;
}

export async function getCards(
  db: D1Database,
  userId: string,
  options: {
    filter?: CardType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ cards: MemoryCard[]; total: number }> {
  const { filter, limit = 20, offset = 0 } = options;

  // Build query
  let query = 'SELECT * FROM cards WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (filter) {
    query += ' AND type = ?';
    params.push(filter);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<Record<string, unknown>>();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as count FROM cards WHERE user_id = ?';
  const countParams: string[] = [userId];

  if (filter) {
    countQuery += ' AND type = ?';
    countParams.push(filter);
  }

  const countResult = await db
    .prepare(countQuery)
    .bind(...countParams)
    .first<{ count: number }>();

  return {
    cards: (result.results || []).map(mapCard),
    total: countResult?.count || 0,
  };
}

export async function updateCard(
  db: D1Database,
  cardId: string,
  data: {
    title?: string;
    quote?: string;
    type?: CardType;
  }
): Promise<MemoryCard | null> {
  const existing = await getCard(db, cardId);
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }

  if (data.quote !== undefined) {
    updates.push('quote = ?');
    params.push(data.quote);
  }

  if (data.type !== undefined) {
    updates.push('type = ?');
    params.push(data.type);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(cardId);

  await db
    .prepare(`UPDATE cards SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return getCard(db, cardId);
}

export async function deleteCard(db: D1Database, cardId: string): Promise<boolean> {
  const card = await getCard(db, cardId);
  if (!card) {
    return false;
  }

  await db.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();

  // Decrement user's card count
  await db
    .prepare('UPDATE users SET card_count = card_count - 1 WHERE id = ?')
    .bind(card.userId)
    .run();

  return true;
}
