import { useEffect, useState } from 'react';
import { useUserId } from './hooks/useUserId';
import { initStatsig } from './hooks/useStatsig';
import { CaptureView } from './views/CaptureView';
import { CollectionView } from './views/CollectionView';
import { CardDetailView } from './views/CardDetailView';

type ViewType = 'capture' | 'collection' | 'card';

function App() {
  const userId = useUserId();
  const [view, setView] = useState<ViewType>('capture');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Determine view from URL hash or default
    const hash = window.location.hash.slice(1);
    if (hash === 'collection') {
      setView('collection');
    } else if (hash === 'card') {
      setView('card');
    } else {
      setView('capture');
    }

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1) as ViewType;
      if (['capture', 'collection', 'card'].includes(newHash)) {
        setView(newHash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // Initialize Statsig when user ID is available
    if (userId && !isInitialized) {
      initStatsig(userId).then(() => {
        setIsInitialized(true);
      });
    }
  }, [userId, isInitialized]);

  // Show loading while user ID initializes
  if (!userId) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading__spinner" />
        </div>
      </div>
    );
  }

  switch (view) {
    case 'collection':
      return <CollectionView />;
    case 'card':
      return <CardDetailView />;
    case 'capture':
    default:
      return <CaptureView />;
  }
}

export default App;
