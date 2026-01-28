import React from 'react';
import { CardType, TYPE_COLORS, TYPE_LABELS } from '../types';

interface CardProps {
  quote: string;
  type: CardType;
  date: string;
  title?: string;
  size?: 'small' | 'large';
  onClick?: () => void;
}

export function Card({ quote, type, date, title, size = 'large', onClick }: CardProps) {
  const colors = TYPE_COLORS[type];
  const isSmall = size === 'small';

  return (
    <div
      className={`card ${isSmall ? 'card--small' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)`
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card__header">
        {title && <span className="card__title">{title}</span>}
      </div>
      <div className="card__body">
        <p className="card__quote">"{quote}"</p>
      </div>
      <div className="card__footer">
        <span className="card__type">{TYPE_LABELS[type]}</span>
        <span className="card__date">{date}</span>
      </div>
    </div>
  );
}

interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return <div className="card-grid">{children}</div>;
}
