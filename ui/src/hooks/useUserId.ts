import { useState, useEffect } from 'react';

const USER_ID_KEY = 'mc_user_id';

export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(USER_ID_KEY);

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(USER_ID_KEY, id);
    }

    setUserId(id);
  }, []);

  return userId;
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }

  return id;
}
