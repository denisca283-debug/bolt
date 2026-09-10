import { useState } from 'react';
import { Send, Search, ArrowLeft } from 'lucide-react';
import { conversations, chatMessages } from '../data/mock';
import { Avatar } from '../components/ui';

export function MessagesPage() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [showChat, setShowChat] = useState(false);
  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  const openChat = (id: string) => {
    setActiveId(id);
    setShowChat(true);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 lg:hidden">
        <h1 className="font-display text-3xl font-semibold text-ink-900 tracking-tight">
          Сообщения
        </h1>
      </div>

      <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] surface overflow-hidden">
        {/* Conversations list */}
        <div className={`${showChat ? 'hidden' : 'flex'} flex-col w-full lg:w-80 border-r border-stone-300/50`}>
          <div className="p-4 border-b border-stone-300/50">
            <h2 className="font-display text-xl font-semibold text-ink-900 mb-3 hidden lg:block">
              Сообщения
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder="Поиск диалогов…"
                className="w-full bg-paper-200 border border-stone-300/60 rounded-lg pl-9 pr-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-fern-400 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-stone-300/30 hover:bg-paper-200 transition-colors text-left ${
                  activeId === c.id ? 'bg-fern-50' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar initials={c.initials} size="md" />
                  {c.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-fern-500 ring-2 ring-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900 truncate">{c.name}</p>
                    <span className="text-xs text-ink-400 shrink-0">{c.time}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">{c.role}</p>
                  <p className="text-xs text-ink-400 mt-1 truncate">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && (
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-1 rounded-full bg-fern-600 text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`${showChat ? 'flex' : 'hidden'} lg:flex flex-col flex-1`}>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-300/50">
            <button onClick={() => setShowChat(false)} className="lg:hidden text-ink-500 hover:text-ink-900">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar initials={active.initials} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">{active.name}</p>
              <p className="text-xs text-ink-400">
                {active.online ? 'В сети' : 'Не в сети'} · {active.role}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper-100">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'me'
                      ? 'bg-fern-600 text-white rounded-br-md'
                      : 'bg-white text-ink-900 border border-stone-300/60 rounded-bl-md'
                  }`}
                >
                  {msg.text}
                  <span className={`block text-[10px] mt-1 ${msg.sender === 'me' ? 'text-fern-100' : 'text-ink-400'}`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-stone-300/50 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Написать сообщение…"
                className="flex-1 bg-paper-200 border border-stone-300/60 rounded-lg px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-fern-400 transition-all"
              />
              <button className="btn-primary !px-3" aria-label="Отправить">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
