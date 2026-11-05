import { useEffect, useState } from 'react';

export interface NotificationData {
  kind: 'info' | 'success' | 'error';
  message: string;
}

const DURATION_MS = 5000;
const MAX_VISIBLE = 4;

/** GTAW-style notifications, sent by the client with `{ action: 'notify' }`. Visible with or without the menu. */
export function Notifications({ title }: { title: string }) {
  const [items, setItems] = useState<(NotificationData & { id: number })[]>([]);

  useEffect(() => {
    let nextId = 0;
    const timers = new Set<number>();
    const onMessage = (event: MessageEvent<{ action?: string; data?: NotificationData }>) => {
      const data = event.data?.action === 'notify' ? event.data.data : undefined;
      if (!data) return;
      const id = ++nextId;
      setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), { ...data, id }]);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setItems((current) => current.filter((item) => item.id !== id));
      }, DURATION_MS);
      timers.add(timer);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <div className="notifications" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`notification ${item.kind}`} role="status">
          <span className="notification-title">{title}</span>
          <span className="notification-message">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
