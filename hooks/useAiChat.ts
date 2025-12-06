
import { useState, useEffect, useCallback } from 'react';
import { AiOptions, requestChatReply } from '../lib/ai';

export interface Message {
  role: 'user' | 'model';
  text: string;
  groundingSources?: { uri: string; title: string }[];
}

export function useAiChat(contextData: any, options: AiOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const contextString = JSON.stringify(contextData, null, 2);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'model',
        text: `Hello ${options.displayName?.split(' ')[0] || 'there'}! I'm your AI Financial Assistant. How can I help you?`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextString, options.personality, options.searchGroundingEnabled, options.displayName]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg = text;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const { text: reply } = await requestChatReply({
        contextData: contextString,
        message: userMsg,
        options,
      });

      setMessages(prev => [...prev, { role: 'model', text: reply || "I'm not sure how to answer that right now." }]);
    } catch (error) {
      console.error("Chat error", error);
      let errorMsg = "Sorry, I encountered an error connecting to the service.";
      if (error instanceof Error) errorMsg += ` (${error.message})`;
      setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  }, []);

  return {
    messages,
    isTyping,
    sendMessage
  };
}
