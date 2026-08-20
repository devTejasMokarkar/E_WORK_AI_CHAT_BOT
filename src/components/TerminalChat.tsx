'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { MenuState, ChatSession } from '@/types';

// Menu option configurations
const MENU_OPTIONS: Record<MenuState, { prompt: string; options?: string[] }> = {
  MAIN_MENU: {
    prompt: 'Please select an option:',
    options: ['1. Ask e-Work Chatbot', '2. e-Work Information', '0. Exit'],
  },
  ASK_CHATBOT: {
    prompt: 'Ask your question about e-Work (or type "back" to return to main menu):',
  },
  EWORK_INFO: {
    prompt: 'Please select an option:',
    options: [
      '1. Work Status',
      '2. Ask e-Work AI',
      '3. Main Menu',
    ],
  },
  WORK_STATUS: {
    prompt: 'Please enter the Work ID (e.g., 2026-27/3333) or type "back":',
  },
  AWAITING_WORK_ID: {
    prompt: 'Please enter the Work ID:',
  },
  AWAITING_QUESTION: {
    prompt: 'Ask your question (or type "back"):',
  },
  ASK_AI: {
    prompt: 'Ask your question about work status, payments, or analytics:',
  },
  WORK_DETAILS: {
    prompt: 'Select the required information:',
    options: [
      '1. Work Details',
      '2. Administrative Sanction',
      '3. Technical Sanction',
      '4. Financial Sanction',
      '5. Estimate',
      '6. Work Progress',
      '7. Work Photos',
      '8. Measurement Book',
      '9. Voucher Details',
      '10. FTO Details',
      '11. Payment Status',
      '12. Utilization Certificate',
      '13. Completion Certificate',
      '14. Main Menu',
    ],
  },
  ADMIN_SANCTION: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  TECHNICAL_SANCTION: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  FINANCIAL_SANCTION: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  ESTIMATE: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  WORK_PROGRESS: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  WORK_PHOTOS: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  MEASUREMENT_BOOK: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  VOUCHER_DETAILS: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  FTO_DETAILS: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  PAYMENT_STATUS: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  UTILIZATION_CERTIFICATE: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
  COMPLETION_CERTIFICATE: {
    prompt: 'Press "back" to return to Work Details menu:',
  },
};

export default function TerminalChat() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { session, addMessage, setMenu } = useChatStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userInput = input.trim();
    setInput('');
    setIsProcessing(true);

    // Add user message
    addMessage('user', userInput);

    try {
      // Call the API route instead of direct function call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          sessionId: session.id,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Add bot response
      addMessage('assistant', data.response);
      
      // Update session state from API response
      if (data.currentMenu) {
        setMenu(data.currentMenu);
      }
    } catch (error) {
      console.error('Error processing input:', error);
      addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
    } finally {
      setIsProcessing(false);
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Get current menu configuration
  const currentMenuConfig = MENU_OPTIONS[session.currentMenu] || { prompt: '' };

  // Check if we need to show the welcome message
  const showWelcome = session.messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-mono">
      {/* Header */}
      <div className="bg-green-700 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">📱</span>
          e-Work WhatsApp Assistant
        </h1>
        <p className="text-sm text-green-100 mt-1">Terminal Interface</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        {showWelcome && (
          <div className="bg-gray-800 rounded-lg p-4 border border-green-600">
            <p className="text-green-400">👋 Namaste! Welcome to the e-Work WhatsApp Assistant.</p>
          </div>
        )}

        {/* Chat Messages */}
        {session.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-800 text-gray-100 border border-gray-700'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
              <div className="text-xs text-gray-400 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="animate-pulse">●</span>
                <span>Processing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        {/* Menu Options Display */}
        {currentMenuConfig.options && (
          <div className="mb-3 text-sm text-gray-400">
            {currentMenuConfig.options.map((opt) => (
              <div key={opt} className="py-1">
                {opt}
              </div>
            ))}
          </div>
        )}

        {/* Prompt */}
        <div className="mb-2 text-sm text-green-400">{currentMenuConfig.prompt}</div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <span className="text-green-500 mt-2">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-b border-gray-600 focus:border-green-500 outline-none py-2 text-gray-100 placeholder-gray-500"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="bg-green-700 hover:bg-green-600 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}