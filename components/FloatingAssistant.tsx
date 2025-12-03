
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FinanceState } from '../types';
import { useAiChat } from '../hooks/useAiChat';
import ReactMarkdown from 'react-markdown';
import { calculateNetWorth, getTransactionsForMonth } from '../lib/finance';

interface FloatingAssistantProps {
  state: FinanceState;
}

export const FloatingAssistant: React.FC<FloatingAssistantProps> = ({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Calculate lightweight context for the AI
  // We don't need heavy budget math here, just the high-level stats
  const contextData = useMemo(() => {
    const { netWorth } = calculateNetWorth(state.accounts);
    const today = new Date();
    const recentTx = getTransactionsForMonth(state.transactions, today.getFullYear(), today.getMonth() + 1);
    
    return {
      summary: "User is asking via the Global Floating Assistant.",
      stats: {
        totalNetWorth: netWorth,
        numberOfAccounts: state.accounts.length,
        transactionsThisMonth: recentTx.length,
        accounts: state.accounts.map(a => ({ name: a.name, type: a.type, balanceCents: a.currentBalanceCents }))
      }
    };
  }, [state.accounts, state.transactions]);

  // 2. Init Chat Hook
  const { messages, isTyping, sendMessage } = useAiChat(contextData, {
    personality: state.appSettings.ai.personality,
    searchGroundingEnabled: state.appSettings.ai.searchGroundingEnabled,
    displayName: state.appSettings.profile.displayName
  });

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-slate-700 text-white' : 'bg-indigo-600 text-white animate-bounce-subtle'
        }`}
        aria-label="Open AI Assistant"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-[90vw] sm:w-[400px] h-[500px] max-h-[70vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col z-50 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-slate-700 dark:to-slate-900 p-4 shrink-0 flex justify-between items-center">
             <div className="flex items-center gap-2 text-white">
                <span className="text-xl">✨</span>
                <h3 className="font-bold">Financial Assistant</h3>
             </div>
             <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
               </svg>
             </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                }`}>
                  {msg.role === 'model' ? (
                    <div className="prose prose-sm prose-indigo dark:prose-invert">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                  {msg.groundingSources && msg.groundingSources.length > 0 && (
                    <div className="mt-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                      <p className="font-semibold text-slate-500 mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingSources.map((source, i) => (
                          <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[140px]">
                            {source.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 text-slate-500 text-xs px-3 py-2 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 flex gap-1 items-center">
                  <span>Thinking</span>
                  <span className="animate-pulse">.</span><span className="animate-pulse delay-100">.</span><span className="animate-pulse delay-200">.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 rounded-full border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full disabled:opacity-50 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
