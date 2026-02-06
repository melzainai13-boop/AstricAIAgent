
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { GeminiService, submitOrderFunctionDeclaration } from './services/geminiService';
import { Message, CustomerProfile, AdminSettings, Order } from './types';
import { SUGGESTED_QUESTIONS, SYSTEM_PROMPT_TEMPLATE, PDF_OCR_CONTENT } from './constants';
import { Send, User, Bot, Settings as SettingsIcon, Mic, MicOff, Loader2, Volume2, VolumeX, Monitor, Cpu, Sparkles, MapPin, Globe, MessageCircle } from 'lucide-react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

// Audio Helpers
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzt-AIksyJR2VOLr9fFuc-giChZm9WE_hp6OCjtR2MKCU9qLO8mkxf5QHY4X72Ozh-axg/exec';

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'أهلاً بك في استرك للحلول التقنية، أنا مساعدك الذكي. كيف أقدر أساعدك الليلة؟', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const gemini = useRef(new GeminiService());
  const liveSession = useRef<any>(null);
  const audioContexts = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTime = useRef(0);
  const activeSources = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const savedCustomers = localStorage.getItem('astric_customers');
    if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
    const savedSettings = localStorage.getItem('astric_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateCRMRecord = (args: { customer_name: string; phone_number: string; order_details: string; address?: string }) => {
    if (!args.customer_name || !args.phone_number) return;
    setCustomers(prevCustomers => {
      const existingIdx = prevCustomers.findIndex(c => c.phone === args.phone_number);
      let updatedCustomers = [...prevCustomers];
      const newOrder: Order = {
        id: Date.now().toString(),
        service: args.order_details || 'طلب نظام',
        details: args.order_details || 'تم التسجيل عبر المساعد الذكي',
        timestamp: Date.now(),
        status: 'pending'
      };
      if (existingIdx > -1) {
        const lastOrder = updatedCustomers[existingIdx].orders.slice(-1)[0];
        if (!lastOrder || (Date.now() - lastOrder.timestamp > 15000)) {
           updatedCustomers[existingIdx].orders = [...updatedCustomers[existingIdx].orders, newOrder];
        }
      } else {
        updatedCustomers.push({
          id: Date.now().toString(),
          name: args.customer_name,
          phone: args.phone_number,
          address: args.address || 'غير محدد',
          activityType: 'غير محدد',
          createdAt: Date.now(),
          orders: [newOrder]
        });
      }
      localStorage.setItem('astric_customers', JSON.stringify(updatedCustomers));
      return updatedCustomers;
    });
  };

  const sendOrderToWebhook = async (orderData: any) => {
    console.log("DEBUG: إرسال الطلب إلى Webhook...", orderData);
    updateCRMRecord(orderData);
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(orderData)
      });
      console.log("DEBUG: تم تنفيذ طلب الـ Webhook بنجاح (Opaque Response)");
      return "ok";
    } catch (error) {
      console.error("DEBUG: خطأ أثناء الاتصال بالـ Webhook:", error);
      return "error";
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await gemini.current.generateResponse(text, history, settings?.instantInstructions);
      
      let aiResponseText = GeminiService.getResponseText(response);
      let toolCallDetected = false;

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'submit_customer_order') {
            await sendOrderToWebhook(fc.args);
            toolCallDetected = true;
            if (!aiResponseText.trim()) {
              aiResponseText = `تم استلام طلبك بنجاح يا ${fc.args.customer_name}، ووصل للإدارة الفنية، حنتواصل معاك في أقرب وقت.`;
            }
          }
        }
      }

      if (!aiResponseText.trim()) {
        aiResponseText = toolCallDetected ? "تم استلام الطلب بنجاح." : "عذراً، لم أستطع معالجة طلبك حالياً.";
      }
      
      const modelMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: aiResponseText, timestamp: Date.now() };
      setMessages(prev => [...prev, modelMsg]);
      
    } catch (error: any) {
      let errorText = 'عذراً، الخادم مضغوط شوية. يا ريت تحاول بعد ثواني بسيطة.';
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Quota Limit Reached");
      } else {
        console.error("Error:", error);
        errorText = 'حدث خطأ في الاتصال، يرجى المحاولة لاحقاً.';
      }
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: errorText, timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleVoiceMode = async () => {
    if (isVoiceActive) {
      liveSession.current?.close();
      setIsVoiceActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!audioContexts.current) {
        audioContexts.current = {
          input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
          output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
        };
      }

      let sessionPromise: Promise<any>;
      sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsVoiceActive(true);
            const source = audioContexts.current!.input.createMediaStreamSource(stream);
            const scriptProcessor = audioContexts.current!.input.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(session => session.sendRealtimeInput({
                media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
              }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContexts.current!.input.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'submit_customer_order') {
                  const result = await sendOrderToWebhook(fc.args);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: fc.id,
                        name: fc.name,
                        response: { result: result },
                      }]
                    });
                  });
                }
              }
            }
            if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data && speakerOn) {
              const base64 = msg.serverContent.modelTurn.parts[0].inlineData.data;
              const ctx = audioContexts.current!.output;
              nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTime.current);
              nextStartTime.current += buffer.duration;
              activeSources.current.add(source);
              source.onended = () => activeSources.current.delete(source);
            }
            if (msg.serverContent?.outputTranscription) {
               const text = msg.serverContent.outputTranscription.text;
               setMessages(prev => {
                 const last = prev[prev.length - 1];
                 if (last && last.role === 'model') {
                   const updated = [...prev];
                   updated[updated.length - 1] = { ...last, text: last.text + text };
                   return updated;
                 }
                 return [...prev, { id: Date.now().toString(), role: 'model', text: text, timestamp: Date.now() }];
               });
            }
          },
          onclose: () => setIsVoiceActive(false),
          onerror: (e) => setIsVoiceActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_PROMPT_TEMPLATE(PDF_OCR_CONTENT, settings?.instantInstructions || ""),
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          tools: [{ functionDeclarations: [submitOrderFunctionDeclaration] }],
          outputAudioTranscription: {}
        }
      });
      liveSession.current = await sessionPromise;
    } catch (e: any) {
      alert("يرجى تفعيل صلاحية الميكروفون.");
      setIsVoiceActive(false);
    }
  };

  if (isAdmin) return <AdminDashboard onLogout={() => setIsAdmin(false)} />;
  if (showAdminLogin) return <AdminLogin onLogin={(s) => { if(s){ setIsAdmin(true); setShowAdminLogin(false); }}} />;

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-black shadow-2xl relative">
      {/* Header */}
      <header className="p-6 bg-[#0a0a0a] border-b border-gray-800 flex flex-col items-center gap-2 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 relative group">
            <Monitor className="w-8 h-8 text-green-500 transition-transform group-hover:scale-110" />
            <Cpu className="w-4 h-4 text-green-400 absolute bottom-2 right-2 animate-pulse" />
            <Sparkles className="w-3 h-3 text-white absolute top-2 right-2 opacity-50" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-white leading-none">استرك - Astric</h1>
            <p className="text-[11px] text-green-500 uppercase tracking-widest mt-1 font-semibold">ريادة بناء النظم الذكية</p>
          </div>
        </div>
        <button onClick={() => setShowAdminLogin(true)} className="absolute left-6 top-8 p-2 hover:bg-gray-800 rounded-full transition-all text-gray-500 hover:text-green-500"><SettingsIcon className="w-5 h-5" /></button>
      </header>

      {/* Main Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 flex gap-3 ${msg.role === 'user' ? 'bg-[#111] border border-gray-800' : 'bg-green-600/10 border border-green-500/20 shadow-lg shadow-green-900/5'}`}>
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${msg.role === 'user' ? 'bg-gray-800' : 'bg-green-600'}`}>{msg.role === 'user' ? <User className="w-4 h-4 text-gray-400" /> : <Bot className="w-4 h-4 text-white" />}</div>
                <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-end">
              <div className="bg-green-600/10 rounded-2xl p-3 border border-green-500/20 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                <span className="text-xs text-green-500 font-medium">استرك بيكتب ليك...</span>
              </div>
            </div>
          )}
          
          {/* Footer inside scroll area to be seen at the end of chat */}
          <div className="mt-12 mb-8 pt-8 border-t border-gray-900 flex flex-col items-center text-center gap-6">
            <div className="flex flex-col md:flex-row gap-8 text-gray-400 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" />
                <span>السودان، الخرطوم - السوق العربي</span>
              </div>
              <a href="https://astric.sd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-green-500 transition-colors">
                <Globe className="w-4 h-4 text-green-500" />
                <span>astric.sd</span>
              </a>
            </div>
            
            <div className="flex flex-col items-center gap-2">
               <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">لطلب الأنظمة والخدمات</span>
               <a 
                 href="https://wa.me/249127556666" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-3 bg-green-600/10 hover:bg-green-600/20 border border-green-500/30 px-6 py-3 rounded-2xl transition-all group"
               >
                 <MessageCircle className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform" />
                 <span className="text-sm font-bold text-white tracking-wider" dir="ltr">+249 127 556 666</span>
               </a>
            </div>
          </div>
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Voice Control Button */}
      <div className="flex flex-col items-center justify-center gap-4 pb-4">
         <button onClick={toggleVoiceMode} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isVoiceActive ? 'bg-red-600 animate-pulse ring-4 ring-red-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/40 hover:shadow-green-500/30'}`}>{isVoiceActive ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}</button>
          <p className="text-xs text-gray-500 font-bold tracking-wide">{isVoiceActive ? "المساعد بيسمعك حالياً..." : "اضغط للدردشة الصوتية"}</p>
      </div>

      {/* Bottom Sticky Input Section */}
      <div className="p-4 bg-[#0a0a0a] border-t border-gray-800 sticky bottom-0">
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button key={idx} onClick={() => handleSendMessage(q.text)} className="shrink-0 flex items-center gap-2 bg-[#111] hover:bg-green-500/10 border border-gray-800 hover:border-green-500/30 text-[11px] px-3 py-2 rounded-full transition-all text-gray-300 font-medium">{q.icon} {q.text}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSpeakerOn(!speakerOn)} className={`p-3 rounded-2xl transition-all ${speakerOn ? 'bg-green-600/10 text-green-500' : 'bg-gray-800 text-gray-500'}`}>{speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</button>
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="flex-1 relative flex items-center gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب استفسارك هنا..." className="flex-1 bg-black border border-gray-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 transition-all placeholder:text-gray-700" />
            <button type="submit" disabled={!input.trim() || isTyping} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 p-3 rounded-2xl transition-all shadow-lg active:scale-95"><Send className="w-5 h-5 text-white transform rotate-180" /></button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
