import { CloseOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Input, Space, Spin } from "antd";
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
  onFilterApply: (filters: Partial<FilterState>) => void;
  onAction?: (action: AIAction) => void;
  onRefresh?: () => void;
}

export default function AIChatPanel({
  isOpen,
  onClose,
  onFilterApply,
  onAction,
  onRefresh,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Initialize from localStorage directly to avoid race condition
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
        content: "Hi! I can help you manage users. Try asking: 'Show all users with age max 40' or 'Update Daryl Tanner's age to 53'",
      },
    ];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save history to localStorage whenever messages change
  useEffect(() => {
    localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-100)));
  }, [messages]);

  const clearChat = () => {
    const initialMessage: Message = {
      role: "assistant",
      content: "Hi! I can help you manage users. Try asking: 'Show all users with age max 40' or 'Update Daryl Tanner's age to 53'",
    };
    setMessages([initialMessage]);
    localStorage.removeItem("ai_chat_history");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: input,
          history: messages.slice(-100) // Send last 100 messages
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process request");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If filters were extracted, apply them
      if (data.filters) {
        onFilterApply(data.filters);
      }

      // If database was modified, trigger refresh
      if (data.refresh && onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-0 flex flex-col h-full w-full md:w-96 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex-shrink-0 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">AI Assistant</h3>
        <Space>
          <Button type="text" size="small" onClick={clearChat}>Clear</Button>
          <Button type="text" onClick={onClose} icon={<CloseOutlined />} />
        </Space>
      </div>

      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg px-4 py-2">
                <Spin size="small" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={() => handleSubmit()}
              placeholder="Ask about users..."
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSubmit()}
              loading={loading}
              disabled={!input.trim()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
