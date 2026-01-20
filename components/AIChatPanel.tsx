import {
  CloseOutlined,
  CustomerServiceOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Avatar, Input } from "antd";
import { useEffect, useRef, useState } from "react";
import { FilterState } from "./UsersFilter";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface AIAction {
  type: "UPDATE" | "DELETE" | "CREATE";
  targetName?: string;
  fields?: any;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterApply: (filters: Partial<FilterState>, shouldReset?: boolean) => void;
  onAction?: (action: AIAction) => void;
  onRefresh?: () => void;
  currentFilters?: FilterState;
}

export default function AIChatPanel({
  isOpen,
  onClose,
  onFilterApply,
  onAction,
  onRefresh,
  currentFilters,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_chat_history");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse chat history");
        }
      }
    }
    return [
      {
        role: "assistant",
        content: "Hi! I'm your Neural Assistant. I can help you manage your database records, filter users, or update details. How can I assist you today?",
      },
    ];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-20)));
  }, [messages]);

  const clearChat = () => {
    const initialMessage: Message = {
      role: "assistant",
      content: "Hi! I'm your Neural Assistant. I can help you manage your database records, filter users, or update details. How can I assist you today?",
    };
    setMessages([initialMessage]);
    localStorage.removeItem("ai_chat_history");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, status, loading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setStatus("");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setStatus("Syncing...");

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: input,
          history: messages.slice(-20),
          currentFilters: currentFilters
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Neural link failure");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream unavailable");

      const decoder = new TextDecoder();
      let assistantMessageContent = "";
      let metadataParsed = false;
      let buffer = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        while (!metadataParsed && buffer.includes("\n")) {
          const newlineIndex = buffer.indexOf("\n");
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          try {
            const data = JSON.parse(line);
            if (data.status) setStatus(data.status);
            if (data.metadata) {
              if (data.filters) onFilterApply(data.filters, data.shouldReset);
              if (data.refresh && onRefresh) onRefresh();
              metadataParsed = true;
              setStatus("");
            }
          } catch (e) {
            // Processing...
          }
        }

        if (metadataParsed) {
          const contentChunk = buffer;
          buffer = "";
          assistantMessageContent += contentChunk;

          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === "assistant") {
              lastMessage.content = assistantMessageContent;
            }
            return [...newMessages];
          });
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === "assistant" && !lastMessage.content) {
            return newMessages.slice(0, -1);
          }
          return newMessages;
        });
      } else {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `CRITICAL ERROR: ${error instanceof Error ? error.message : "Neural link severed"}`,
        }]);
      }
    } finally {
      setLoading(false);
      setStatus("");
      abortControllerRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] md:relative md:inset-auto md:z-0 flex flex-col h-full w-full md:w-[450px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 transition-all duration-300 transform animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600">
            <ThunderboltOutlined className="text-white text-base" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 leading-none">AI CORE</h3>
            <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter mt-1">Real-time DB Logic Active</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={clearChat} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Clear</button>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            <CloseOutlined className="text-sm" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-zinc-50/20 dark:bg-transparent">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isLatest = index === messages.length - 1;
          const showTyping = !isUser && !message.content && loading && isLatest;

          return (
            <div key={index} className={`flex flex-col ${isUser ? "items-end text-right" : "items-start text-left"}`}>
              <div className="flex items-center gap-2 mb-2">
                {!isUser && (
                  <Avatar 
                    size={18} 
                    icon={<CustomerServiceOutlined />} 
                    className="bg-blue-600 border-none scale-90"
                  />
                )}
                <span className={`text-[9px] font-black uppercase tracking-widest ${isUser ? "text-indigo-600" : "text-zinc-400"}`}>
                  {isUser ? "AUTHORIZED USER" : (showTyping ? "SYNCING STATE" : "NEURAL ASYNC")}
                </span>
                {isUser && (
                  <Avatar 
                    size={18} 
                    icon={<UserOutlined />} 
                    className="bg-indigo-600 border-none scale-90"
                  />
                )}
              </div>
              
              <div className={`
                max-w-[90%] px-5 py-3 text-sm leading-relaxed
                ${isUser 
                  ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[20px] rounded-tr-none" 
                  : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 rounded-[20px] rounded-tl-none border border-zinc-200 dark:border-zinc-800"
                }
              `}>
                {showTyping ? (
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                    </div>
                    <span className="text-[11px] font-bold text-blue-600 italic tracking-tight">{status || "Analyzing context..."}</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => handleSubmit()}
            placeholder="Interrogate neural core..."
            className="flex-1 h-[44px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl text-sm placeholder:text-zinc-400 hover:border-blue-500 focus:border-blue-600 transition-all font-medium"
            disabled={loading}
          />
          {loading ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center justify-center w-[44px] h-[44px] rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 hover:scale-105 active:scale-95 transition-all"
            >
              <StopOutlined />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center justify-center w-[44px] h-[44px] rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:scale-110 active:scale-95 disabled:opacity-30 disabled:grayscale transition-all"
            >
              <SendOutlined className="text-sm" />
            </button>
          )}
        </form>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
        }
      `}</style>
    </div>
  );
}

