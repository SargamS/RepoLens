'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, AlertCircle } from 'lucide-react'
import { api, ApiError, type ChatMessage as ApiChatMessage } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  repoId: number | string
  repoName: string
}

const suggestedQuestions = [
  'What does this repo do?',
  "What's the riskiest recent change?",
  'Explain the folder structure',
]

export function ChatDrawer({ isOpen, onClose, repoId, repoName }: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Load prior chat history for this repo the first time the drawer opens.
  useEffect(() => {
    if (!isOpen || historyLoaded) return
    let cancelled = false

    api
      .getChatHistory(repoId)
      .then((history: ApiChatMessage[]) => {
        if (cancelled) return
        setMessages(history.map((m) => ({ id: String(m.id), role: m.role, content: m.content })))
      })
      .catch(() => {
        // Non-fatal — just start with an empty conversation.
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, historyLoaded, repoId])

  const handleSendMessage = async (text?: string) => {
    const messageText = text || input
    if (!messageText.trim() || isLoading) return

    setError(null)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const { response } = await api.chat(repoId, messageText)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to get a response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isLoading) {
      handleSendMessage()
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border flex flex-col z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-1">Repository</p>
            <h3 className="text-foreground font-medium">{repoName}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card rounded-lg transition-colors text-muted hover:text-foreground"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-xs text-muted uppercase tracking-widest mb-4">Ask Anything</p>
              <h4 className="text-lg font-light text-foreground mb-6">Chat with this repo</h4>

              {/* Suggested Questions */}
              <div className="space-y-2 w-full">
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(question)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-card transition-colors text-left"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2.5 rounded-lg text-sm whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border text-foreground'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-lg px-4 py-2.5">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-full bg-card border border-border text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
