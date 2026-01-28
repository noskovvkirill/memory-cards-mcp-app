import { useEffect, useState } from 'react';
import { useMcpClient } from '../hooks/useMcpClient';
import { logEvent } from '../hooks/useStatsig';
import { Card, CardGrid } from '../components/Card';
import { CardType, MemoryCard, TYPE_LABELS } from '../types';

const FILTERS: Array<{ value: CardType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'insight', label: TYPE_LABELS.insight },
  { value: 'decision', label: TYPE_LABELS.decision },
  { value: 'funny', label: TYPE_LABELS.funny },
  { value: 'idea', label: TYPE_LABELS.idea },
  { value: 'milestone', label: TYPE_LABELS.milestone },
];

export function CollectionView() {
  const { viewData, callTool } = useMcpClient();
  const [filter, setFilter] = useState<CardType | 'all'>('all');

  const data = viewData as {
    cards: MemoryCard[];
    total: number;
    filter?: CardType;
  } | null;

  const cards = data?.cards || [];
  const total = data?.total || 0;

  useEffect(() => {
    if (data?.filter) {
      setFilter(data.filter);
    }
  }, [data?.filter]);

  useEffect(() => {
    logEvent('collection_viewed', undefined, {
      cardCount: String(cards.length),
      filter: filter,
    });
  }, [cards.length, filter]);

  const handleFilterChange = (newFilter: CardType | 'all') => {
    setFilter(newFilter);
    callTool('get_collection', {
      filter: newFilter === 'all' ? undefined : newFilter,
    });
  };

  const handleCardClick = (cardId: string) => {
    callTool('get_card', { cardId });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="container">
      <header className="header">
        <h2>Your Memories</h2>
        <p>{total} card{total !== 1 ? 's' : ''} collected</p>
      </header>

      <div className="filter-tabs">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-tab ${filter === value ? 'filter-tab--active' : ''}`}
            onClick={() => handleFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">✨</div>
          <h3 className="empty-state__title">No memories yet</h3>
          <p className="empty-state__description">
            Say "remember this" in a conversation to capture your first memory card.
          </p>
        </div>
      ) : (
        <CardGrid>
          {cards.map((card) => (
            <Card
              key={card.id}
              quote={card.quote.length > 80 ? card.quote.slice(0, 80) + '...' : card.quote}
              type={card.type}
              title={card.title}
              date={formatDate(card.createdAt)}
              size="small"
              onClick={() => handleCardClick(card.id)}
            />
          ))}
        </CardGrid>
      )}
    </div>
  );
}
