import { useCallback, useState } from 'react';
import {
  AiAction,
  AiActionResult,
  PlaygroundAction,
} from '../types/playground';
import { chatWithGemini, PlaygroundAiContext } from '../services/gemini';

export interface AiChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: 'text' | 'action' | 'error';
  label?: string;
  action?: PlaygroundAction;
}

interface UseAiChatOptions {
  getContext: () => PlaygroundAiContext;
  applyAction: (action: PlaygroundAction) => Promise<string>;
}

interface UseAiChatResult {
  messages: AiChatEntry[];
  isThinking: boolean;
  send: (text: string, action?: AiAction) => Promise<void>;
  clear: () => void;
  pushNotice: (text: string, label?: string) => void;
  dismissProposal: (id: string) => void;
  applyProposal: (id: string, action?: PlaygroundAction) => Promise<void>;
}

let nextEntryId = 0;

function createEntryId(): string {
  nextEntryId += 1;
  return `ai-chat-${Date.now()}-${nextEntryId}`;
}

export function useAiChat({ getContext, applyAction }: UseAiChatOptions): UseAiChatResult {
  const [messages, setMessages] = useState<AiChatEntry[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const pushNotice = useCallback((text: string, label?: string) => {
    setMessages((current) => [
      ...current,
      { id: createEntryId(), role: 'assistant', text, label, kind: 'text' },
    ]);
  }, []);

  const send = useCallback(
    async (text: string, action?: AiAction) => {
      const content = text.trim();
      if (!content || isThinking) return;

      setMessages((current) => [
        ...current,
        { id: createEntryId(), role: 'user', text: content, label: action },
      ]);
      setIsThinking(true);

      try {
        const history = [...messages, { id: '', role: 'user' as const, text: content }]
          .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
          .map((entry) => ({
            role: entry.role,
            content: entry.text,
          }));
        const result: AiActionResult = await chatWithGemini(history, getContext());
        const entry: AiChatEntry =
          result.type === 'action' && result.action
            ? {
                id: createEntryId(),
                role: 'assistant',
                text: result.text || 'A request change is ready to apply.',
                kind: 'action',
                label: action,
                action: result.action,
              }
            : {
                id: createEntryId(),
                role: 'assistant',
                text: result.text || 'The AI returned no response.',
                label: action,
                kind: 'text',
              };
        setMessages((current) => [...current, entry]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI chat request failed.';
        setMessages((current) => [
          ...current,
          { id: createEntryId(), role: 'assistant', text: message, kind: 'error', label: action },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [getContext, isThinking, messages],
  );

  const clear = useCallback(() => setMessages([]), []);

  const dismissProposal = useCallback((id: string) => {
    setMessages((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const applyProposal = useCallback(
    async (id: string, action?: PlaygroundAction) => {
      if (!action) return;
      const confirmation = await applyAction(action);
      dismissProposal(id);
      pushNotice(confirmation, 'Fix applied');
    },
    [applyAction, dismissProposal, pushNotice],
  );

  return { messages, isThinking, send, clear, pushNotice, dismissProposal, applyProposal };
}
