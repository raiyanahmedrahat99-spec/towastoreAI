import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  RotateCcw,
  ShoppingBag,
  Truck,
  CreditCard,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  Languages,
  Phone,
  ExternalLink,
  ShoppingCart,
  X,
  Mic,
  MicOff,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  product?: ProductCardData | null;
}

export interface ProductCardData {
  name: string;
  price: string;
  category?: string;
  handle?: string;
  url: string;
}

// Towastore.shop Official Favicon
export function TowaWebsiteFavicon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/favicon.svg"
      alt="Towa"
      width={size}
      height={size}
      className={`rounded-full object-contain ${className}`}
      onError={(e) => {
        (e.target as HTMLElement).style.display = 'none';
      }}
    />
  );
}

// Helper to render text with live interactive hyperlinks for Markdown links, URLs, and emails
export function FormattedMessageText({ text }: { text: string }) {
  // Regex to match markdown links [label](url) OR plain urls/emails
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|(https?:\/\/[^\s<]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link [Label](url)
      const label = match[1];
      const url = match[2];
      elements.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black font-bold underline decoration-neutral-400 hover:decoration-black hover:text-neutral-800 transition-colors inline-flex items-center gap-0.5 break-all"
        >
          <span>{label}</span>
          <ExternalLink size={11} className="inline shrink-0" />
        </a>
      );
    } else if (match[3]) {
      // Raw URL
      const url = match[3];
      elements.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black font-bold underline decoration-neutral-400 hover:decoration-black transition-colors break-all"
        >
          {url}
        </a>
      );
    } else if (match[4]) {
      // Raw Email
      const email = match[4];
      elements.push(
        <a
          key={match.index}
          href={`mailto:${email}`}
          className="text-black font-bold underline decoration-neutral-400 hover:decoration-black transition-colors break-all"
        >
          {email}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return <span>{elements}</span>;
}

// Bilingual quick suggestions
const SUGGESTIONS = {
  en: [
    { label: 'How to Order?', query: 'How do I place an order for items?', icon: ShoppingBag },
    { label: 'Payment (COD)?', query: 'What are the payment terms and COD policy?', icon: CreditCard },
    { label: 'Delivery Time?', query: 'How fast do you deliver inside Dhaka and outside?', icon: Truck },
    { label: 'Technical Help?', query: 'I have a technical problem with my order or website.', icon: Phone },
    { label: 'Popular Snacks?', query: 'What biscuits, cakes, and snacks do you have in stock with prices?', icon: Sparkles },
  ],
  bn: [
    { label: 'অর্ডার করবো কীভাবে?', query: 'আমি পণ্য অর্ডার করতে চাই, কিভাবে করবো?', icon: ShoppingBag },
    { label: 'পেমেন্ট ও COD?', query: 'পেমেন্ট নিয়ম ও ক্যাশ অন ডেলিভারি সম্পর্কে বলুন', icon: CreditCard },
    { label: 'ডেলিভারি কত দ্রুত?', query: 'ঢাকা ও বাইরে ডেলিভারি হতে কত দিন লাগে?', icon: Truck },
    { label: 'টেকনিক্যাল সমস্যা?', query: 'আমার ওয়েবসাইট বা অর্ডারে টেকনিক্যাল সমস্যা হচ্ছে, যোগাযোগ করবো কীভাবে?', icon: Phone },
    { label: 'স্ন্যাকস ও বিস্কুট?', query: 'আপনাদের জনপ্রিয় স্ন্যাকস ও বিস্কুটের দাম ও তালিকা দিন', icon: Sparkles },
  ],
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'bn'>('en'); // Primary English
  const [activeFloatingProduct, setActiveFloatingProduct] = useState<ProductCardData | null>(null);

  const getWelcomeMessage = (l: 'en' | 'bn') =>
    l === 'en'
      ? "Welcome to Towa Support. I'm here to help you check grocery products, prices, and delivery details. Please place all orders on [towastore.shop](https://towastore.shop)."
      : 'তোয়া সাপোর্টে স্বাগতম। পণ্যের স্টক, মূল্য এবং ডেলিভারি সংক্রান্ত যেকোনো তথ্য জানতে পারেন। অর্ডার করতে [towastore.shop](https://towastore.shop) ভিজিট করুন।';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-initial',
      role: 'ai',
      content: getWelcomeMessage('en'),
      timestamp: 'Just now',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, activeFloatingProduct]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Cleanup speech recognition on unmount or close
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Web Speech API Voice-to-Text handler with explicit getUserMedia permission request
  const toggleVoiceInput = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        lang === 'bn'
          ? 'আপনার ব্রাউজারে স্পিচ রিকগনিশন (ভয়েস-টু-টেক্সট) সমর্থিত নয়। অনুগ্রহ করে গুগল ক্রোম ব্রাউজার ব্যবহার করুন।'
          : 'Speech Recognition is not supported in this browser. Please use Google Chrome or a compatible browser.'
      );
      return;
    }

    // Step 1: Explicitly request microphone stream from user's browser if available
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop tracks so recognition engine can take control
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (permError: any) {
      console.warn('Microphone permission request error:', permError);
      alert(
        lang === 'bn'
          ? 'মাইক্রোফোনের অনুমতি দেওয়া হয়নি (Microphone Permission Blocked)। অনুগ্রহ করে ব্রাউজার অ্যাড্রেস বারের লক/সাইট সেটিংসে গিয়ে মাইক্রোফোন পারমিশন Allow করুন।'
          : 'Microphone permission was not allowed. Please click the camera/lock icon in your browser address bar and set Microphone to "Allow".'
      );
      setIsRecording(false);
      return;
    }

    // Step 2: Start speech recognition
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      // Adapt language based on current toggle (Bengali bn-BD or English en-US)
      recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          // Gracefully inform user without spamming console
          alert(
            lang === 'bn'
              ? 'মাইক্রোফোনের অনুমতি বন্ধ রয়েছে। ব্রাউজারের অ্যাড্রেস বারের সাইট সেটিংসে গিয়ে মাইক্রোফোন "Allow" করুন অথবা সরাসরি টাইপ করে লিখুন।'
              : 'Microphone access is blocked or not allowed in this iframe. Please allow microphone permissions in browser site settings or type your message.'
          );
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start voice recognition:', err);
      setIsRecording(false);
    }
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'bn' : 'en';
    setLang(nextLang);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading) return;

    const currentTime = new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: currentTime,
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          preferredLanguage: lang,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      const aiReply =
        data.reply ||
        (lang === 'bn'
          ? 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি। পুনরায় চেষ্টা করুন।'
          : 'Sorry, no response received. Please try again.');

      const productPayload: ProductCardData | null = data.product || null;

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: aiReply,
        timestamp: new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        product: productPayload,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If a product was recommended, open the floating Add-to-Cart window popup
      if (productPayload) {
        setActiveFloatingProduct(productPayload);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'ai',
        content:
          lang === 'bn'
            ? 'সংযোগ ত্রুটি হয়েছে। টেকনিক্যাল সহায়তার জন্য আমাদের [WhatsApp: +8801995981302](https://wa.me/8801995981302) অথবা ইমেইলে [info.towastore@gmail.com](mailto:info.towastore@gmail.com)-এ যোগাযোগ করুন।'
            : 'Connection error. For direct assistance, please reach us on [WhatsApp: +8801995981302](https://wa.me/8801995981302) or email [info.towastore@gmail.com](mailto:info.towastore@gmail.com).',
        timestamp: lang === 'bn' ? 'এখন' : 'Now',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setActiveFloatingProduct(null);
    setMessages([
      {
        id: `welcome-reset-${Date.now()}`,
        role: 'ai',
        content: getWelcomeMessage(lang),
        timestamp: lang === 'bn' ? 'এখন' : 'Now',
      },
    ]);
  };

  const isBengali = lang === 'bn';

  return (
    <div
      className={`fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-[999999] pointer-events-auto select-none ${
        isBengali ? 'font-bengali' : 'font-english'
      }`}
      style={{ isolation: 'isolate' }}
    >
      {/* 1. Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Towa Support AI"
        className={`flex items-center gap-2.5 bg-white text-black px-4 py-2.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.2)] border-2 border-black hover:bg-neutral-50 active:scale-95 transition-transform duration-150 ${
          isOpen ? 'hidden' : 'flex'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
          <TowaWebsiteFavicon size={28} />
        </div>
        <div className="text-left pr-1">
          <div className="text-sm font-bold text-black flex items-center gap-1.5 leading-tight">
            Towa Support AI
          </div>
        </div>
      </button>

      {/* 2. Main Chat Window: 100% Mobile Responsive (compact bottom-right card on desktop; fluid modal with safe insets on mobile) */}
      {isOpen && (
        <div className="relative w-[calc(100vw-24px)] h-[82vh] max-w-[390px] max-h-[620px] sm:w-[390px] sm:h-[580px] bg-white text-black rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-2 border-black flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <header className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-neutral-50 border border-neutral-300 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                <TowaWebsiteFavicon size={26} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-black leading-none">
                  Towa Support AI
                </h2>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1">
              {/* Language Switcher */}
              <button
                onClick={toggleLanguage}
                title={lang === 'en' ? 'বাংলা ভাষায় পরিবর্তন করুন' : 'Switch to English'}
                className="px-2 py-0.5 text-xs font-bold rounded border border-neutral-300 bg-white text-black hover:bg-black hover:text-white transition-colors"
                aria-label="Toggle Language"
              >
                <span className="flex items-center gap-1">
                  <Languages size={12} />
                  <span>{lang === 'en' ? 'EN' : 'বাং'}</span>
                </span>
              </button>

              {/* Reset Conversation */}
              <button
                onClick={resetChat}
                title={lang === 'en' ? 'Reset chat' : 'চ্যাট রিসেট'}
                className="p-1.5 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors"
                aria-label="Reset conversation"
              >
                <RotateCcw size={15} />
              </button>

              {/* Close Widget */}
              <button
                onClick={() => setIsOpen(false)}
                title={lang === 'en' ? 'Close' : 'বন্ধ করুন'}
                className="p-1.5 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors"
                aria-label="Close widget"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </header>

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-white custom-scrollbar">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-black text-white rounded-br-xs shadow-xs'
                        : 'bg-neutral-50 text-black border border-neutral-200 rounded-bl-xs'
                    }`}
                  >
                    {/* Copy Action */}
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(m.content, m.id)}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-black transition-opacity"
                        title={lang === 'en' ? 'Copy text' : 'কপি করুন'}
                      >
                        {copiedId === m.id ? (
                          <Check size={12} className="text-black" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    )}

                    <div className="whitespace-pre-wrap font-normal pr-2 break-words">
                      <FormattedMessageText text={m.content} />
                    </div>

                    <div
                      className={`text-[9px] mt-1 flex items-center gap-1 ${
                        isUser ? 'text-neutral-400 justify-end' : 'text-neutral-400'
                      }`}
                    >
                      <span>{m.timestamp}</span>
                    </div>
                  </div>

                  {/* Inline Product Card if message recommends an item */}
                  {m.product && (
                    <div className="mt-2 w-[85%] bg-white border-2 border-black rounded-xl p-3 shadow-md flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 border border-neutral-300 flex items-center justify-center shrink-0">
                          <ShoppingBag size={18} className="text-black" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-black truncate leading-tight">
                            {m.product.name}
                          </h4>
                          <span className="text-xs font-extrabold text-black block mt-0.5">
                            ৳{m.product.price}
                          </span>
                        </div>
                      </div>

                      <a
                        href={m.product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-black text-white px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 transition active:scale-95 shrink-0"
                      >
                        <ShoppingCart size={12} />
                        <span>{lang === 'en' ? 'Add to Cart' : 'কার্টে যোগ'}</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Human-like Chat Bubble Typing Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start animate-in fade-in duration-200">
                <div className="flex items-end gap-2 max-w-[85%]">
                  <div className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center p-0.5 overflow-hidden shrink-0 mb-1">
                    <TowaWebsiteFavicon size={20} />
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs">
                    <div className="flex items-center gap-1.5 h-4">
                      <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-duration:900ms]" />
                      <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-duration:900ms] [animation-delay:200ms]" />
                      <span className="w-2 h-2 rounded-full bg-black animate-bounce [animation-duration:900ms] [animation-delay:400ms]" />
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400 mt-1 pl-8 font-medium tracking-tight">
                  {lang === 'en' ? 'Towa AI is typing...' : 'তোয়া এআই ভাবছে...'}
                </span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* 3. Floating Add-to-Cart Window Popup when Customer Shows Product Interest */}
          {activeFloatingProduct && (
            <div className="mx-3 mb-2 p-3 bg-white border-2 border-black rounded-xl shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200 relative z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-300 flex items-center justify-center shrink-0">
                  <ShoppingBag size={20} className="text-black" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-500 block">
                    {lang === 'en' ? 'Product Highlight' : 'পণ্য প্রস্তাব'}
                  </span>
                  <h4 className="text-xs font-bold text-black truncate leading-tight">
                    {activeFloatingProduct.name}
                  </h4>
                  <span className="text-xs font-extrabold text-black">
                    ৳{activeFloatingProduct.price}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={activeFloatingProduct.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 transition active:scale-95 shadow-sm"
                >
                  <ShoppingCart size={13} />
                  <span>{lang === 'en' ? 'Add to Cart' : 'অ্যাড টু কার্ট'}</span>
                </a>
                <button
                  onClick={() => setActiveFloatingProduct(null)}
                  className="p-1 text-neutral-400 hover:text-black rounded transition"
                  title="Close popup"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Quick Suggestions */}
          <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-200 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {SUGGESTIONS[lang].map((chip, idx) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip.query)}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white text-black border border-neutral-300 rounded-full hover:bg-black hover:text-white hover:border-black transition-colors whitespace-nowrap shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    <Icon size={11} />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Input Box */}
          <footer className="p-2.5 bg-white border-t border-neutral-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-300 rounded-xl px-2.5 py-1.5 focus-within:border-black focus-within:bg-white transition-colors"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isRecording
                    ? lang === 'en'
                      ? 'Listening to your voice...'
                      : 'আপনার কথা শুনছি...'
                    : lang === 'en'
                    ? 'Write your message...'
                    : 'আপনার বার্তা লিখুন...'
                }
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-black placeholder-neutral-400 outline-none"
              />

              {/* Microphone Voice-to-Text Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isLoading}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                title={
                  isRecording
                    ? lang === 'en'
                      ? 'Stop voice recording'
                      : 'রেকর্ডিং বন্ধ করুন'
                    : lang === 'en'
                    ? 'Record voice'
                    : 'ভয়েস রেকর্ড করুন'
                }
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-90 ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse shadow-sm'
                    : 'text-neutral-500 hover:text-black hover:bg-neutral-200'
                }`}
              >
                {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Send Message"
                className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-black transition-all active:scale-90 shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          </footer>
        </div>
      )}
    </div>
  );
}
