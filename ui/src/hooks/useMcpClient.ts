import { useState, useEffect, useCallback, useRef } from 'react';

interface McpMessage {
  jsonrpc: '2.0';
  method?: string;
  id?: number | string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpClientState {
  isReady: boolean;
  toolInput: Record<string, unknown> | null;
  viewData: Record<string, unknown> | null;
}

export function useMcpClient() {
  const [state, setState] = useState<McpClientState>({
    isReady: false,
    toolInput: null,
    viewData: null,
  });
  const pendingRequests = useRef<Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map());
  const requestId = useRef(1);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as McpMessage;
      if (!message || message.jsonrpc !== '2.0') return;

      // Handle notifications from host
      if (message.method === 'ui/notifications/tool-input') {
        setState(prev => ({
          ...prev,
          toolInput: message.params?.input as Record<string, unknown> | null,
        }));
      } else if (message.method === 'ui/notifications/view-data') {
        setState(prev => ({
          ...prev,
          viewData: message.params?.data as Record<string, unknown> | null,
        }));
      }

      // Handle responses to our requests
      if (message.id !== undefined && pendingRequests.current.has(message.id as number)) {
        const { resolve, reject } = pendingRequests.current.get(message.id as number)!;
        pendingRequests.current.delete(message.id as number);

        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Initialize MCP connection
    window.parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/initialize',
      params: { capabilities: {} }
    }, '*');

    setState(prev => ({ ...prev, isReady: true }));

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendRequest = useCallback((method: string, params?: Record<string, unknown>): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const id = requestId.current++;
      pendingRequests.current.set(id, { resolve, reject });

      window.parent.postMessage({
        jsonrpc: '2.0',
        id,
        method,
        params
      }, '*');

      // Timeout after 30s
      setTimeout(() => {
        if (pendingRequests.current.has(id)) {
          pendingRequests.current.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }, []);

  const callTool = useCallback((name: string, args: Record<string, unknown>) => {
    return sendRequest('tools/call', { name, arguments: args });
  }, [sendRequest]);

  const close = useCallback(() => {
    window.parent.postMessage({
      jsonrpc: '2.0',
      method: 'ui/close'
    }, '*');
  }, []);

  return {
    isReady: state.isReady,
    toolInput: state.toolInput,
    viewData: state.viewData,
    callTool,
    close,
    sendRequest,
  };
}
