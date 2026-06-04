'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  maxMessages?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

interface UseWebSocketReturn {
  messages: unknown[];
  isConnected: boolean;
  lastMessage: unknown | null;
}

export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { maxMessages = 100, reconnectDelay = 1000, maxReconnectDelay = 30000 } = options;
  const [messages, setMessages] = useState<unknown[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(reconnectDelay);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    try {
      const wsBase = process.env.NEXT_PUBLIC_WS_URL;
      let wsUrl: string;
      if (url.startsWith('ws')) {
        wsUrl = url;
      } else if (wsBase) {
        wsUrl = `${wsBase}${url}`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}${url}`;
      }
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        retryRef.current = reconnectDelay;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          setMessages((prev) => {
            const next = [data, ...prev];
            return next.slice(0, maxMessages);
          });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        // Reconnect with exponential backoff
        const delay = retryRef.current;
        retryRef.current = Math.min(delay * 2, maxReconnectDelay);
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setTimeout(connect, retryRef.current);
    }
  }, [url, maxMessages, reconnectDelay, maxReconnectDelay]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { messages, isConnected, lastMessage };
}
