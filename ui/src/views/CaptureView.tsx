import { useState, useEffect } from 'react';
import { useMcpClient } from '../hooks/useMcpClient';
import { useUserId } from '../hooks/useUserId';
import { logEvent } from '../hooks/useStatsig';
import { Card } from '../components/Card';
import { CardType } from '../types';

interface ToolInputData {
  title?: string;
  quote?: string;
  type?: CardType;
  context?: string;
  createdAt?: string;
}

export function CaptureView() {
  const { toolInput, callTool, close } = useMcpClient();
  const userId = useUserId();

  const [title, setTitle] = useState('');
  const [quote, setQuote] = useState('');
  const [type, setType] = useState<CardType>('insight');
  const [context, setContext] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const inputData = toolInput as ToolInputData | null;

  useEffect(() => {
    if (inputData) {
      setTitle(inputData.title || '');
      setQuote(inputData.quote || '');
      setType(inputData.type || 'insight');
      setContext(inputData.context || '');
    }
  }, [inputData]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleSave = async () => {
    if (!quote.trim() || !userId) return;

    setIsSaving(true);

    try {
      await callTool('save_card', {
        userId,
        title: title.trim() || quote.slice(0, 50),
        quote: quote.trim(),
        type,
        context: context.trim() || 'Conversation',
      });

      logEvent('card_captured', undefined, {
        type,
        quoteLength: String(quote.length),
        hasCustomTitle: String(title !== inputData?.title),
      });

      close();
    } catch (error) {
      console.error('Failed to save card:', error);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    close();
  };

  const createdAt = inputData?.createdAt || new Date().toISOString();

  return (
    <div className="container">
      <header className="header">
        <h2>Memory Captured</h2>
        <p>Review and save your moment</p>
      </header>

      <Card
        quote={quote || 'Your quote here...'}
        type={type}
        title={title}
        date={formatDate(createdAt)}
      />

      <div className="form-group">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short title for this memory..."
          maxLength={100}
        />
      </div>

      <div className="form-group">
        <label htmlFor="quote">Quote</label>
        <textarea
          id="quote"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="The captured moment..."
          maxLength={1000}
        />
      </div>

      <div className="form-group">
        <label htmlFor="type">Type</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as CardType)}>
          <option value="insight">Insight</option>
          <option value="decision">Decision</option>
          <option value="funny">Funny</option>
          <option value="idea">Idea</option>
          <option value="milestone">Milestone</option>
        </select>
      </div>

      <div className="actions">
        <button className="btn btn--secondary" onClick={handleCancel} disabled={isSaving}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={!quote.trim() || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save to Collection'}
        </button>
      </div>
    </div>
  );
}
