/**
 * Conversations API Service
 * Manages chat sessions with persistent memory
 * Base URL: https://dev-api.lunar-sys.com/v1/conversations
 */

import { ROUTER_BASE_URL } from '../config/api';

const CONVERSATIONS_URL = `${ROUTER_BASE_URL}/v1/conversations`;

// Types
export interface ConversationMessage {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  model?: string;
  provider?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  cost_usd?: number;
}

export interface Conversation {
  conversation_id: string;
  tenant_id: string;
  title: string;
  model: string;
  system_prompt?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  metadata?: Record<string, unknown>;
}

export interface CreateConversationRequest {
  title?: string;
  model?: string;
  system_prompt?: string;
  metadata?: Record<string, unknown>;
}

export interface ListConversationsResponse {
  conversations: Conversation[];
  total: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface ListMessagesResponse {
  conversation_id: string;
  messages: ConversationMessage[];
  total: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface SendMessageRequest {
  content: string;
  model?: string;
}

export interface SendMessageResponse {
  user_message: ConversationMessage;
  assistant_message: ConversationMessage;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    latency_ms: number;
    total_cost_usd: number;
  };
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  message_id?: string;
  latency_ms?: number;
  error?: string;
}

export function useConversationsService() {
  /**
   * Create a new conversation
   */
  const createConversation = async (
    accessToken: string,
    request: CreateConversationRequest = {}
  ): Promise<Conversation> => {
    const response = await fetch(CONVERSATIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create conversation: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  /**
   * List all conversations
   */
  const listConversations = async (
    accessToken: string,
    limit: number = 20,
    cursor?: string
  ): Promise<ListConversationsResponse> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);

    const response = await fetch(`${CONVERSATIONS_URL}?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list conversations: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  /**
   * Get a specific conversation
   */
  const getConversation = async (
    accessToken: string,
    conversationId: string
  ): Promise<Conversation> => {
    const response = await fetch(`${CONVERSATIONS_URL}/${conversationId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get conversation: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  /**
   * Update a conversation
   */
  const updateConversation = async (
    accessToken: string,
    conversationId: string,
    updates: { title?: string; model?: string }
  ): Promise<Conversation> => {
    const response = await fetch(`${CONVERSATIONS_URL}/${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update conversation: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  /**
   * Delete a conversation
   */
  const deleteConversation = async (accessToken: string, conversationId: string): Promise<void> => {
    const response = await fetch(`${CONVERSATIONS_URL}/${conversationId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete conversation: ${response.status} - ${errorText}`);
    }
  };

  /**
   * List messages in a conversation
   */
  const listMessages = async (
    accessToken: string,
    conversationId: string,
    limit: number = 100,
    order: 'asc' | 'desc' = 'asc'
  ): Promise<ListMessagesResponse> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      order,
    });

    const response = await fetch(`${CONVERSATIONS_URL}/${conversationId}/messages?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list messages: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  /**
   * Send a message (synchronous)
   */
  const sendMessage = async (
    accessToken: string,
    conversationId: string,
    request: SendMessageRequest
  ): Promise<SendMessageResponse> => {
    const response = await fetch(`${CONVERSATIONS_URL}/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  /**
   * Send a message with streaming response
   */
  const sendMessageStream = async (
    accessToken: string,
    conversationId: string,
    request: SendMessageRequest,
    onChunk: (chunk: StreamChunk) => void,
    onError?: (error: Error) => void
  ): Promise<void> => {
    try {
      const response = await fetch(`${CONVERSATIONS_URL}/${conversationId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let receivedDone = false;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === ':') continue; // Skip empty lines and SSE comments

          // Handle standard SSE format: "data: {...}"
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as StreamChunk;
              if (data.type === 'done') receivedDone = true;
              onChunk(data);
            } catch (e) {
              console.error('Failed to parse SSE chunk:', e, trimmed);
            }
          } else {
            // Try parsing as raw JSON (some providers don't use SSE format)
            try {
              const data = JSON.parse(trimmed) as StreamChunk;
              if (data.type === 'done') receivedDone = true;
              onChunk(data);
            } catch {
              // Not JSON, might be raw text content - emit as content chunk
              if (trimmed.length > 0) {
                onChunk({ type: 'content', content: trimmed });
              }
            }
          }
        }
      }

      // If stream ended without 'done' chunk, send a synthetic done
      if (!receivedDone) {
        onChunk({ type: 'done' });
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      } else {
        throw error;
      }
    }
  };

  return {
    createConversation,
    listConversations,
    getConversation,
    updateConversation,
    deleteConversation,
    listMessages,
    sendMessage,
    sendMessageStream,
  };
}
