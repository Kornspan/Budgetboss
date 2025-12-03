
import { useState, useRef, useEffect, useCallback } from 'react';
import { createFinancialChatSession, AiOptions } from '../lib/ai';
import { Chat } from "@google/genai";

export interface Message {
  role: 'user' | 'model';
  text: string;
  groundingSources?: { uri: string; title: string }[];
}

export function useAiChat(contextData: any, options: AiOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatSession = useRef<Chat | null>(null);
  
  // Initialize or update chat session when context/settings change
  useEffect(() => {
    const contextString = JSON.stringify(contextData, null, 2);
    chatSession.current = createFinancialChatSession(contextString, options);
    
    // If it's a fresh session and no messages exist, add the welcome message
    if (messages.length === 0) {
       setMessages([{ 
         role: 'model', 
         text: `Hello ${options.displayName?.split(' ')[0] || 'there'}! I'm your AI Financial Assistant. How can I help you?` 
       }]);
    }
  }, [JSON.stringify(contextData), options.personality, options.searchGroundingEnabled, options.displayName]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !chatSession.current) return;

    const userMsg = text;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      let fullText = '';
      let groundingSources: { uri: string; title: string }[] = [];

      const result = await chatSession.current.sendMessageStream({ message: userMsg });

      for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.role === 'model') {
              return [...prev.slice(0, -1), { ...last, text: fullText }];
            } else {
              return [...prev, { role: 'model', text: fullText }];
            }
          });
        }

        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          groundingChunks.forEach(c => {
            if (c.web?.uri && c.web?.title) {
              groundingSources.push({ uri: c.web.uri, title: c.web.title });
            }
          });
        }
      }

      // Finalize message with sources
      setMessages(prev => {
        const last = prev[prev.length - 1];
        const uniqueSources = Array.from(new Map(groundingSources.map(item => [item['uri'], item])).values());
        const updatedMsg = { 
            ...last, 
            text: fullText, 
            groundingSources: uniqueSources.length > 0 ? uniqueSources : undefined 
        };
        
        // Ensure we replace the streaming/optimistic message correctly
        if (last.role === 'model') {
           return [...prev.slice(0, -1), updatedMsg];
        } else {
           return [...prev, { role: 'model', ...updatedMsg }];
        }
      });

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
