import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, Send, Sparkles, AlertCircle, HelpCircle, ArrowRight } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface AiAssistantProps {
  initialPrompt: string;
  onClearInitialPrompt: () => void;
}

export default function AiAssistant({ initialPrompt, onClearInitialPrompt }: AiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu Consultor Técnico de Color y Serigrafía. Estoy aquí para resolver cualquier duda que tengas sobre mezclas de color Pantone, selección de mallas de serigrafía, problemas de adherencia o secado en toallas o hamacas, y optimización de tus procesos de estampado. ¿En qué te puedo ayudar hoy?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Desplazar chat hacia abajo al recibir mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Manejar prompts iniciales sugeridos desde el catálogo
  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
      onClearInitialPrompt(); // limpiar para evitar re-llenar al cambiar de pestaña
    }
  }, [initialPrompt]);

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputText;
    if (!textToSend.trim() || loading) return;

    setErrorMsg('');
    const userMsg: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputText('');
    setLoading(true);

    try {
      // Hacer la llamada a nuestra API del servidor Express local
      const response = await fetch('/api/color-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          // Enviamos el historial sin el primer saludo del asistente
          history: messages.slice(1).map(m => ({
            role: m.role,
            text: m.text
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar tu consulta.');
      }

      setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'No se pudo conectar con el servidor. Verifica que la clave API esté configurada.');
    } finally {
      setLoading(false);
    }
  };

  const presetQuestions = [
    '¿Cómo evito que se agriete la tinta en hilos gruesos de hamacas?',
    '¿Qué malla es mejor para tinta acramina sobre toalla de algodón?',
    '¿Cómo estabilizar el tono rojo 185 C en toalla oscura?',
    '¿Cuánto aditivo fijador debo agregar para lavado industrial?'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch overflow-hidden" id="ai-assistant-view">
      
      {/* Columna Lateral - Consejos Rápidos y Preguntas Frecuentes */}
      <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-900">Consultor AI de Serigrafía</h4>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Nuestra inteligencia está entrenada con conocimientos de ingeniería química textil y formulación de tintas específicas para el estampado en toallas de felpa y hamacas de hilos gruesos.
          </p>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preguntas Sugeridas de Taller</p>
            {presetQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(undefined, q)}
                className="w-full text-left p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 hover:bg-blue-50/50 hover:border-blue-200 hover:text-blue-700 transition-all flex items-center justify-between gap-2"
              >
                <span className="truncate">{q}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] text-blue-700 mt-6 flex gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>Al consultar, puedes detallar si el color se estampará en toallas blancas de rizo largo, toallas oscuras de playa, o hamacas rústicas, para recibir un consejo óptimo.</span>
        </div>
      </div>

      {/* Columna Principal - Ventana de Chat */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full">
        
        {/* Cabecera del chat */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          <p className="text-xs font-bold text-slate-700">Asesor de Color en Línea (Gemini)</p>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[460px] custom-scrollbar">
          {messages.map((m, idx) => {
            const isAi = m.role === 'assistant';
            return (
              <div 
                key={idx} 
                className={`flex gap-3 max-w-[85%] ${isAi ? 'self-start' : 'self-end ml-auto flex-row-reverse'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                  isAi ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}>
                  {isAi ? 'AI' : 'Op'}
                </div>
                
                <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                  isAi 
                    ? 'bg-slate-50 text-slate-800 border border-slate-100' 
                    : 'bg-blue-600 text-white'
                }`}>
                  {isAi ? (
                    <div className="markdown-body">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-[85%] self-start">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs shrink-0 flex items-center justify-center animate-pulse">
                AI
              </div>
              <div className="bg-slate-50 text-slate-400 border border-slate-100 p-4 rounded-2xl text-xs flex items-center gap-2 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>Analizando viscosidad, mallas y pigmentación...</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error del Asistente</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
          <input
            type="text"
            placeholder="Haz una consulta técnica sobre el color, mallas, temperatura..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none text-slate-800 font-semibold shadow-inner"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
