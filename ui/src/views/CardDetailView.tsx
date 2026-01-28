import { useState, useEffect } from 'react';
import { useMcpClient } from '../hooks/useMcpClient';
import { logEvent } from '../hooks/useStatsig';
import { Card } from '../components/Card';
import { MemoryCard, CardType } from '../types';

export function CardDetailView() {
  const { viewData, callTool } = useMcpClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const card = viewData as MemoryCard | null;

  const [editTitle, setEditTitle] = useState(card?.title || '');
  const [editQuote, setEditQuote] = useState(card?.quote || '');
  const [editType, setEditType] = useState<CardType>(card?.type || 'insight');

  useEffect(() => {
    if (card) {
      setEditTitle(card.title);
      setEditQuote(card.quote);
      setEditType(card.type);

      logEvent('card_viewed', undefined, {
        cardId: card.id,
        source: 'collection',
      });
    }
  }, [card]);

  if (!card) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading__spinner" />
        </div>
      </div>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleBack = () => {
    callTool('get_collection', {});
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    await callTool('update_card', {
      cardId: card.id,
      title: editTitle,
      quote: editQuote,
      type: editType,
    });

    logEvent('card_edited', undefined, {
      cardId: card.id,
      fieldsChanged: [
        editTitle !== card.title && 'title',
        editQuote !== card.quote && 'quote',
        editType !== card.type && 'type',
      ].filter(Boolean).join(','),
    });

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(card.title);
    setEditQuote(card.quote);
    setEditType(card.type);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }

    const cardAge = Date.now() - new Date(card.createdAt).getTime();

    await callTool('delete_card', { cardId: card.id });

    logEvent('card_deleted', undefined, {
      cardId: card.id,
      cardAge: String(Math.floor(cardAge / 1000 / 60 / 60 / 24)), // days
    });

    handleBack();
  };

  const handleExport = async (format: 'square' | 'story' | 'wide') => {
    await callTool('export_card_image', { cardId: card.id, format });

    logEvent('card_shared', undefined, {
      cardId: card.id,
      format,
    });
  };

  if (isEditing) {
    return (
      <div className="container">
        <header className="header">
          <h2>Edit Memory</h2>
        </header>

        <Card
          quote={editQuote || 'Your quote here...'}
          type={editType}
          title={editTitle}
          date={formatDate(card.createdAt)}
        />

        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label htmlFor="quote">Quote</label>
          <textarea
            id="quote"
            value={editQuote}
            onChange={(e) => setEditQuote(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div className="form-group">
          <label htmlFor="type">Type</label>
          <select id="type" value={editType} onChange={(e) => setEditType(e.target.value as CardType)}>
            <option value="insight">Insight</option>
            <option value="decision">Decision</option>
            <option value="funny">Funny</option>
            <option value="idea">Idea</option>
            <option value="milestone">Milestone</option>
          </select>
        </div>

        <div className="actions">
          <button className="btn btn--secondary" onClick={handleCancelEdit}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleSaveEdit}>
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <button
          className="btn btn--secondary"
          onClick={handleBack}
          style={{ marginBottom: 16, width: 'auto', flex: 'none' }}
        >
          ← Back to Collection
        </button>
      </header>

      <Card
        quote={card.quote}
        type={card.type}
        title={card.title}
        date={formatDate(card.createdAt)}
      />

      <div className="card-actions">
        <button className="btn btn--secondary" onClick={handleEdit}>
          Edit
        </button>
        <button className="btn btn--secondary" onClick={() => handleExport('square')}>
          Export
        </button>
        <button
          className={`btn ${isDeleting ? 'btn--danger' : 'btn--secondary'}`}
          onClick={handleDelete}
        >
          {isDeleting ? 'Confirm Delete' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
