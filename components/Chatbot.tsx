
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Mic, Send, X, Volume2, Loader2, MicOff } from 'lucide-react';
import { gemini, GeminiService } from '../services/gemini';
import { SYSTEM_INSTRUCTION, CHATBOT_FLOW_INSTRUCTION, VOICE_FLOW_INSTRUCTION } from '../constants';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { ChatStage, ChatSessionData, ChatMessage } from '../types';

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<ChatStage>(ChatStage.WELCOME);
  const [sessionData, setSessionData] = useState<ChatSessionData>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hi! I\'m your real estate AI assistant. I can help you buy, rent, or sell… Are you looking to buy, rent, or sell today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [phoneRefusalCount, setPhoneRefusalCount] = useState(0);
  const [liveInputText, setLiveInputText] = useState('');
  const [liveOutputText, setLiveOutputText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  // Keep a ref to sessionData for use inside async callbacks
  const sessionDataRef = useRef<ChatSessionData>({});

  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  useEffect(() => {
    const handleScroll = () => {
      if (hasAutoOpened) return;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (windowHeight + scrollTop >= documentHeight - 100) {
        setIsOpen(true);
        setHasAutoOpened(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasAutoOpened]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isVoiceActive, liveInputText, liveOutputText]);

  const buildEmailHtml = (data: ChatSessionData, analysis: string, chatHistory: ChatMessage[]): string => {
    const transcript = chatHistory
      .map(m => `<tr><td style="padding:4px 8px;font-weight:bold;color:${m.role === 'user' ? '#2563eb' : '#374151'}">${m.role === 'user' ? 'Customer' : 'AI'}</td><td style="padding:4px 8px">${m.text}</td></tr>`)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New Real Estate Lead</title></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1f2937">
  <div style="background:#0f172a;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">🏙️ New Real Estate Lead – Skyline Elite Realty</h1>
    <p style="margin:4px 0 0;opacity:.7;font-size:13px">Generated automatically by the Skyline AI Concierge</p>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px">
    <h2 style="color:#0f172a;font-size:16px;margin:0 0 12px">Contact Information</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b;width:140px">Name</td><td style="padding:6px 0;font-weight:bold">${data.name || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Phone</td><td style="padding:6px 0;font-weight:bold">${data.phone || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0;font-weight:bold">${data.email || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Contact Preference</td><td style="padding:6px 0">${data.contactPreference || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Best Time to Reach</td><td style="padding:6px 0;font-weight:bold;color:#16a34a">${data.bestTime || '—'}</td></tr>
    </table>
  </div>

  <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:20px">
    <h2 style="color:#0f172a;font-size:16px;margin:0 0 12px">Property Requirements</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b;width:140px">Intent</td><td style="padding:6px 0"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:13px">${data.intent || '—'}</span></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Location</td><td style="padding:6px 0">${data.location || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Budget</td><td style="padding:6px 0">${data.budget || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Timeline</td><td style="padding:6px 0">${data.timeline || '—'}</td></tr>
      ${data.bedrooms ? `<tr><td style="padding:6px 0;color:#64748b">Bedrooms</td><td style="padding:6px 0">${data.bedrooms}</td></tr>` : ''}
      ${data.financingStatus ? `<tr><td style="padding:6px 0;color:#64748b">Financing</td><td style="padding:6px 0">${data.financingStatus}</td></tr>` : ''}
      ${data.zipCode ? `<tr><td style="padding:6px 0;color:#64748b">Zip Code</td><td style="padding:6px 0">${data.zipCode}</td></tr>` : ''}
      ${data.listingPreference ? `<tr><td style="padding:6px 0;color:#64748b">Listing Choice</td><td style="padding:6px 0">${data.listingPreference}</td></tr>` : ''}
    </table>
  </div>

  <div style="background:#fff7ed;border:1px solid #fed7aa;border-top:0;padding:20px">
    <h2 style="color:#9a3412;font-size:16px;margin:0 0 12px">🤖 AI Chat Analysis</h2>
    <p style="margin:0;line-height:1.6;white-space:pre-wrap">${analysis}</p>
  </div>

  <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:20px">
    <h2 style="color:#0f172a;font-size:16px;margin:0 0 12px">Full Chat Transcript</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${transcript}
    </table>
  </div>

  <div style="background:#0f172a;color:#94a3b8;padding:12px 20px;border-radius:0 0 8px 8px;font-size:11px;text-align:center">
    Skyline Elite Realty AI Concierge · Empire State Building, 72nd Floor, NY · concierge@skylineelite.nyc
  </div>
</body>
</html>`;
  };

  const triggerAgentNotification = async (data: ChatSessionData, chatHistory: ChatMessage[]) => {
    console.log('AGENT NOTIFICATION PAYLOAD:', data);
    try {
      // Generate AI analysis of the conversation
      const analysis = await gemini.generateChatAnalysis(chatHistory, data);

      const subject = `New Lead: ${data.name || 'Unknown'} – ${data.intent || 'Unknown Intent'} – ${data.location || 'No Location'}`;
      const htmlContent = buildEmailHtml(data, analysis, chatHistory);

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, htmlContent }),
      });

      if (!response.ok) {
        console.warn('Email API returned non-200:', await response.text());
      } else {
        const result = await response.json();
        console.log('Email API result:', result);
      }
    } catch (err) {
      console.error('triggerAgentNotification error:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await gemini.processMessage(userText, stage, sessionData, messages);

      const updatedData = { ...sessionData, ...(response.extractedData || {}) };

      if (response.extractedData) {
        setSessionData(updatedData);
      }

      // Hard Recovery Logic for Phone
      if (stage === ChatStage.LEAD_CAPTURE_CONTACT && !response.extractedData?.phone && !sessionData.phone) {
        setPhoneRefusalCount(prev => prev + 1);
      }

      setMessages(prev => [...prev, { role: 'model', text: response.message }]);

      if (response.nextStage) {
        setStage(response.nextStage);
        if (response.nextStage === ChatStage.COMPLETE) {
          const finalMessages = [...messages, { role: 'user' as const, text: userText }, { role: 'model' as const, text: response.message }];
          triggerAgentNotification(updatedData, finalMessages);
        }
      }
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceSession = async () => {
    if (isVoiceActive) {
      stopVoiceSession();
      return;
    }
    try {
      setIsLoading(true);
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || ((import.meta as any).env?.VITE_GEMINI_API_KEY as string);
      if (!apiKey) throw new Error('API Key missing');

      const ai = new GoogleGenAI({ apiKey });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
      setLiveInputText('');
      setLiveOutputText('');

      const updateLeadInfoTool = {
        functionDeclarations: [
          {
            name: 'updateLeadInfo',
            description: 'Update the lead information and conversation stage based on extracted data.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                extractedData: {
                  type: Type.OBJECT,
                  properties: {
                    intent: { type: Type.STRING },
                    location: { type: Type.STRING },
                    budget: { type: Type.STRING },
                    timeline: { type: Type.STRING },
                    bedrooms: { type: Type.STRING },
                    financingStatus: { type: Type.STRING },
                    zipCode: { type: Type.STRING },
                    listingPreference: { type: Type.STRING },
                    name: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    email: { type: Type.STRING },
                    contactPreference: { type: Type.STRING },
                    bestTime: { type: Type.STRING },
                  }
                },
                nextStage: { type: Type.STRING, description: 'The next stage to move the conversation to.' }
              }
            }
          }
        ]
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsVoiceActive(true);
            setIsLoading(false);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: GeminiService.encodeBase64(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then((session) => { if (session) session.sendRealtimeInput({ media: pcmBlob }); });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            // Handle Tool Calls
            if (msg.toolCall) {
              for (const call of msg.toolCall.functionCalls) {
                if (call.name === 'updateLeadInfo') {
                  const args = call.args as any;
                  let updatedSessionData: ChatSessionData = sessionDataRef.current;
                  if (args.extractedData) {
                    updatedSessionData = { ...sessionDataRef.current, ...args.extractedData };
                    setSessionData(updatedSessionData);
                  }
                  if (args.nextStage) {
                    setStage(args.nextStage as ChatStage);
                    if (args.nextStage === ChatStage.COMPLETE) {
                      setMessages(prev => {
                        triggerAgentNotification(updatedSessionData, prev);
                        return prev;
                      });
                    }
                  }
                  sessionPromise.then(session => {
                    if (session) {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: 'updateLeadInfo',
                          id: call.id,
                          response: { result: 'success' }
                        }]
                      });
                    }
                  });
                }
              }
            }

            // Accumulate live transcription for real-time display
            if (msg.serverContent?.inputTranscription?.text) {
              currentInputTranscription.current += msg.serverContent.inputTranscription.text;
              setLiveInputText(currentInputTranscription.current);
            }
            if (msg.serverContent?.outputTranscription?.text) {
              currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
              setLiveOutputText(currentOutputTranscription.current);
            }

            // On turn complete: commit transcriptions to chat messages
            if (msg.serverContent?.turnComplete) {
              const uText = currentInputTranscription.current.trim();
              const mText = currentOutputTranscription.current.trim();
              if (uText || mText) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  if (uText) newMsgs.push({ role: 'user', text: uText });
                  if (mText) newMsgs.push({ role: 'model', text: mText });
                  return newMsgs;
                });
              }
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
              setLiveInputText('');
              setLiveOutputText('');
            }

            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const audioCtx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
              const buffer = await GeminiService.decodeAudioData(GeminiService.decodeBase64(base64Audio), audioCtx, 24000, 1);
              const source = audioCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(audioCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: () => { stopVoiceSession(); },
          onclose: () => { setIsVoiceActive(false); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: VOICE_FLOW_INSTRUCTION + `\n\nCURRENT SESSION STATE:\nStage: ${stage}\nData: ${JSON.stringify(sessionData)}`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [updateLeadInfoTool],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setIsVoiceActive(false);
      setIsLoading(false);
    }
  };

  const stopVoiceSession = () => {
    if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} sessionRef.current = null; }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsVoiceActive(false);
    setIsLoading(false);
    setLiveInputText('');
    setLiveOutputText('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white w-[380px] h-[550px] mb-4 rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8">
          <div className="p-5 bg-slate-950 text-white flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight">Skyline Concierge</h4>
                <div className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${isVoiceActive ? 'bg-blue-400 animate-pulse' : 'bg-blue-500'}`}></span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                    {isVoiceActive ? 'Listening…' : 'Active Now'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => { stopVoiceSession(); setIsOpen(false); }} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="bg-slate-900 px-5 py-2 flex items-center space-x-2 border-t border-white/5">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{
                  width: `${(Object.values(ChatStage).indexOf(stage) + 1) / Object.values(ChatStage).length * 100}%`
                }}
              />
            </div>
            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
              Stage {Object.values(ChatStage).indexOf(stage) + 1}/8
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10 rounded-br-none'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-none font-medium'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {/* Live voice transcription during active voice session */}
            {isVoiceActive && (liveInputText || liveOutputText) && (
              <div className="space-y-2">
                {liveInputText && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-none text-sm leading-relaxed bg-blue-400/60 text-white italic animate-pulse">
                      {liveInputText}
                    </div>
                  </div>
                )}
                {liveOutputText && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-none text-sm leading-relaxed bg-white/70 text-slate-600 border border-slate-200 italic animate-pulse">
                      {liveOutputText}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isLoading && !isVoiceActive && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
              </div>
            )}

            {isVoiceActive && !liveInputText && !liveOutputText && (
              <div className="flex flex-col items-center justify-center py-4 space-y-3 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white animate-pulse">
                  <Volume2 className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Voice Concierge Active</p>
                <p className="text-[9px] text-slate-400">Speak now — conversation appears in chat</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 space-y-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={startVoiceSession}
                className={`p-3 rounded-2xl transition-all shadow-lg active:scale-90 flex-shrink-0 ${
                  isVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                }`}
                title={isVoiceActive ? 'Stop voice' : 'Start voice'}
              >
                {isVoiceActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <div className="flex-1 flex items-center bg-slate-100 px-3 py-2 rounded-2xl border border-transparent focus-within:border-blue-500/50 focus-within:bg-white transition-all shadow-inner">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isVoiceActive ? 'Listening over voice…' : 'Ask our advisor…'}
                  disabled={isVoiceActive}
                  className="flex-1 bg-transparent text-sm px-2 focus:outline-none text-slate-900 font-semibold placeholder:text-slate-400 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim() || isVoiceActive}
                  className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => { if (isOpen && isVoiceActive) stopVoiceSession(); setIsOpen(!isOpen); }}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group ${
          isOpen ? 'bg-slate-950 text-white' : 'bg-blue-600 text-white'
        }`}
      >
        {isOpen ? <X /> : <MessageSquare className="group-hover:animate-bounce" />}
        {!isOpen && (
          <span className="absolute right-16 bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none">
            Elite Concierge
          </span>
        )}
      </button>
    </div>
  );
};

export default Chatbot;
