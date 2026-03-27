import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Volume2, VolumeX, Cpu, 
  User, BookOpen, Download, 
  Key, Trash2, Paperclip, X, RefreshCw, Radio, Sliders,
  Anchor, Quote, Cross, Info, ShieldCheck, Columns, Settings,
  Grid, Bookmark, Activity, Archive, AlertTriangle
} from 'lucide-react';

// --- Custom Yin-Yang Icon ---
const YinYang = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a5 5 0 0 0 0 10 5 5 0 0 1 0 10"/>
    <circle cx="12" cy="7" r="1" fill="currentColor"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
  </svg>
);

// --- Utility: PCM to WAV for TTS ---
function pcmToWav(base64Pcm, sampleRate = 24000) {
  try {
    const binaryString = window.atob(base64Pcm);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const buffer = new ArrayBuffer(44 + len);
    const view = new DataView(buffer);
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, len, true);
    const pcmData = new Uint8Array(buffer, 44, len);
    pcmData.set(bytes);
    return buffer;
  } catch (e) {
    console.error("Audio conversion failed", e);
    return null;
  }
}

const CONTEXTS = {
  nazarene: {
    name: "The Nazarene", icon: Cross, color: "text-amber-500", border: "border-amber-500/30", bg: "bg-amber-500/10",
    prompt: `You are THE NAZARENE, an ethical compiler node. Audit input against the "Red Letters" (The Gospels). Focus on radical love, justice for the poor, humility, and non-violence. [STRICT ANTI-SYCOPHANCY]: Do NOT side with the user. Identify drift from the Source. [OUTPUT]: [THE CLAIM], [THE AUDIT], [VERDICT], [THE ANCHOR].`
  },
  alamin: {
    name: "Al-Amin", icon: ShieldCheck, color: "text-emerald-500", border: "border-emerald-500/30", bg: "bg-emerald-500/10",
    prompt: `You are AL-AMIN (The Trustworthy), an ethical compiler node. Audit input against the Quran and the Sunnah. Focus on Divine Justice (Adl), Mercy (Rahma), and absolute honesty. [STRICT ANTI-SYCOPHANCY]: Identify user drift from justice and mercy. No favoritism. [OUTPUT]: [THE RHETORIC], [THE DIVINE AUDIT], [THE BALANCE], [THE AYAT].`
  },
  stoic: {
    name: "The Stoic", icon: Columns, color: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-500/10",
    prompt: `You are THE STOIC, an ethical compiler node. Audit input against Marcus Aurelius and Epictetus. Focus on the Dichotomy of Control and Virtue. [STRICT ANTI-SYCOPHANCY]: Point out if the user is governed by destructive emotions. Calibrate, do not comfort. [OUTPUT]: [THE EXTERNAL], [THE STOIC AUDIT], [THE DICHOTOMY], [THE DOGMA].`
  },
  mariposa: {
    name: "Mariposa", icon: YinYang, color: "text-cyan-500", border: "border-cyan-500/30", bg: "bg-cyan-500/10",
    prompt: `You are MARIPOSA, an ethical compiler node focused on DBT and "Wise Mind". Audit input against Radical Acceptance and emotion regulation. Focus on identifying cognitive distortions. [STRICT ANTI-SYCOPHANCY]: Audit behavior objectively. Name Emotion Mind. Do not validate distortions. [OUTPUT]: [THE TRIGGER], [THE DBT AUDIT], [WISE MIND VERDICT], [THE SKILL ANCHOR].`
  }
};

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`Audit Failed ${response.status}`);
      return await response.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('compiler_apiKey') || '');
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('compiler_chatHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedVault, setSavedVault] = useState(() => {
    const saved = localStorage.getItem('compiler_vault');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSource, setActiveSource] = useState(() => localStorage.getItem('compiler_activeSource') || 'nazarene');
  const [language, setLanguage] = useState(() => localStorage.getItem('compiler_language') || 'en');
  const [voiceProfile, setVoiceProfile] = useState(() => localStorage.getItem('compiler_voiceProfile') || 'Zephyr');
  const [availableModels, setAvailableModels] = useState(() => {
    const saved = localStorage.getItem('compiler_models');
    return saved ? JSON.parse(saved) : ['models/gemini-1.5-flash'];
  });
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('compiler_selectedModel') || 'models/gemini-1.5-flash');

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [showVault, setShowVault] = useState(false);
  
  const [isScreaming, setIsScreaming] = useState(false);
  const [screamTimer, setScreamTimer] = useState(60);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('compiler_apiKey', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('compiler_chatHistory', JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { localStorage.setItem('compiler_vault', JSON.stringify(savedVault)); }, [savedVault]);
  useEffect(() => { localStorage.setItem('compiler_activeSource', activeSource); }, [activeSource]);
  useEffect(() => { localStorage.setItem('compiler_language', language); }, [language]);
  useEffect(() => { localStorage.setItem('compiler_voiceProfile', voiceProfile); }, [voiceProfile]);
  useEffect(() => { localStorage.setItem('compiler_models', JSON.stringify(availableModels)); }, [availableModels]);
  useEffect(() => { localStorage.setItem('compiler_selectedModel', selectedModel); }, [selectedModel]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isProcessing]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    let interval;
    if (isScreaming && screamTimer > 0) {
      interval = setInterval(() => setScreamTimer(prev => prev - 1), 1000);
    } else if (screamTimer === 0) {
      setIsScreaming(false);
      setScreamTimer(60);
    }
    return () => clearInterval(interval);
  }, [isScreaming, screamTimer]);

  const triggerScream = () => {
    setIsScreaming(true);
    setScreamTimer(60);
  };

  const parseMarkdown = (text, sourceKey = activeSource) => {
    if (!text) return { __html: '' };
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const color = CONTEXTS[sourceKey].color;
    
    const tags = [
      '\\[THE CLAIM\\]', '\\[THE RHETORIC\\]', '\\[THE EXTERNAL\\]', '\\[THE TRIGGER\\]',
      '\\[THE AUDIT\\]', '\\[THE DIVINE AUDIT\\]', '\\[THE STOIC AUDIT\\]', '\\[THE DBT AUDIT\\]',
      '\\[VERDICT\\]', '\\[THE BALANCE\\]', '\\[THE DICHOTOMY\\]', '\\[WISE MIND VERDICT\\]',
      '\\[THE ANCHOR\\]', '\\[THE AYAT\\]', '\\[THE DOGMA\\]', '\\[THE SKILL ANCHOR\\]'
    ];

    tags.forEach(tag => {
      const regex = new RegExp(tag, 'g');
      html = html.replace(regex, `<span class="${color} font-black tracking-widest">${tag.replace(/\\/g, '')}</span>`);
    });

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic opacity-70">$1</em>');
    html = html.replace(/^>\s?(.*$)/gim, '<blockquote class="border-l-4 border-white/10 pl-4 my-3 text-white/40 italic font-light">$1</blockquote>');
    html = html.replace(/\n/g, '<br/>');
    return { __html: html };
  };

  const sweepModels = async () => {
    if (!apiKey) return alert("API Key Required.");
    setIsSweeping(true);
    try {
      const data = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const valid = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent")).map(m => m.name);
      setAvailableModels(valid);
      if (valid.length > 0 && !valid.includes(selectedModel)) setSelectedModel(valid[0]);
    } catch (err) { console.error(err); }
    finally { setIsSweeping(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setInputText(prev => prev + (prev ? '\n\n' : '') + evt.target.result);
      textareaRef.current?.focus();
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const executeAudit = async (prompt, sourceKeys) => {
    const langNames = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese', ar: 'Arabic', fa: 'Farsi', hi: 'Hindi', uk: 'Ukrainian', pt: 'Portuguese', ru: 'Russian' };
    const directive = language !== 'en' ? `\n\n[LANGUAGE]: Reply in ${langNames[language]}.` : '';
    
    const rawHistory = chatHistory.filter(m => m.role === 'user' || (m.role === 'model' && m.source === sourceKeys[0]));
    const apiHistory = rawHistory.slice(-10).map(m => ({ role: m.role, parts: m.parts }));

    const promises = sourceKeys.map(async (key) => {
      const sysPrompt = CONTEXTS[key].prompt + directive;
      const data = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [...apiHistory, { role: 'user', parts: [{ text: prompt }] }], 
          systemInstruction: { parts: [{ text: sysPrompt }] } 
        })
      });
      return { key, text: data.candidates[0].content.parts[0].text };
    });

    const resultsArray = await Promise.all(promises);
    const resultsMap = {};
    resultsArray.forEach(res => resultsMap[res.key] = res.text);
    return resultsMap;
  };

  const handleSend = async (e, isTriangulation = false) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing || !apiKey) return;

    const newText = inputText.trim();
    setInputText('');
    const newUserMsg = { role: 'user', parts: [{ text: newText }] };
    setChatHistory(prev => [...prev, newUserMsg]);
    setIsProcessing(true);

    try {
      if (isTriangulation) {
        const sourceKeys = Object.keys(CONTEXTS);
        const results = await executeAudit(newText, sourceKeys);
        setChatHistory(prev => [...prev, { role: 'triangulation', prompt: newText, responses: results }]);
      } else {
        const results = await executeAudit(newText, [activeSource]);
        const modelText = results[activeSource];
        // Now storing 'prompt' within the model object for granular downloading later
        setChatHistory(prev => [...prev, { role: 'model', source: activeSource, prompt: newText, parts: [{ text: modelText }] }]);
        if (voiceEnabled) playVocalis(modelText);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'error', parts: [{ text: `CONNECTION ERROR: ${err.message}` }] }]);
    } finally { setIsProcessing(false); }
  };

  const playVocalis = async (text) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const data = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.replace(/\*/g, '') }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceProfile } } } }
        })
      });
      const wav = pcmToWav(data.candidates[0].content.parts[0].inlineData.data, 24000);
      if (wav) new Audio(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))).play();
    } catch (e) { console.error("TTS Failed", e); }
  };

  const saveToVault = (sourceKey, prompt, response) => {
    const newItem = {
      id: Date.now(),
      source: sourceKey,
      prompt: prompt,
      response: response,
      date: new Date().toISOString()
    };
    setSavedVault(prev => [newItem, ...prev]);
  };

  // --- Granular Download Function ---
  const downloadSingleAudit = (sourceKey, prompt, response) => {
    const nodeName = CONTEXTS[sourceKey || 'nazarene'].name;
    let log = `THE ETHICAL COMPILER // SINGLE AUDIT RECORD\n`;
    log += `NODE: ${nodeName}\n`;
    log += `DATE: ${new Date().toISOString()}\n`;
    log += `=========================================\n\n`;
    log += `[CLAIMANT]: ${prompt}\n\n`;
    log += `[${nodeName.toUpperCase()}]:\n${response}\n`;
    const blob = new Blob([log], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `${sourceKey}_single_audit_${Date.now()}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.click();
  };

  const downloadFullTranscript = () => {
    let log = `THE ETHICAL COMPILER // FULL SESSION RECORD\nDATE: ${new Date().toISOString()}\n=========================================\n\n`;
    chatHistory.forEach(msg => {
      if (msg.role === 'triangulation') {
         log += `[CLAIMANT]: ${msg.prompt}\n\n`;
         Object.keys(CONTEXTS).forEach(key => {
            log += `[${CONTEXTS[key].name.toUpperCase()}]:\n${msg.responses[key]}\n\n`;
         });
      } else {
         log += `[${msg.role === 'user' ? 'CLAIMANT' : 'AUDITOR'}]: ${msg.parts[0].text}\n\n`;
      }
    });
    const blob = new Blob([log], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `full_audit_session_${Date.now()}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.click();
  };

  const ActiveIcon = CONTEXTS[activeSource].icon;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#050510] text-slate-100 font-mono overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-10" />

      {/* Somatic Scream Overlay */}
      {isScreaming && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center backdrop-blur-md">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-64 h-64 rounded-full bg-cyan-500/10 border border-cyan-500/30 animate-ping" style={{ animationDuration: '4s' }} />
            <div className="absolute w-48 h-48 rounded-full bg-cyan-500/20 border border-cyan-500/50 animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="w-32 h-32 rounded-full bg-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.6)] flex items-center justify-center">
              <YinYang size={48} className="text-cyan-100" />
            </div>
          </div>
          <div className="mt-20 text-center space-y-4">
            <p className="text-cyan-400 font-black text-xl tracking-[0.4em] uppercase animate-pulse" style={{ animationDuration: '4s' }}>Breathe</p>
            <p className="text-cyan-500/50 text-xs tracking-widest">{screamTimer}s remaining</p>
          </div>
          <button onClick={() => { setIsScreaming(false); setScreamTimer(60); }} className="absolute bottom-10 px-6 py-2 border border-cyan-900 text-cyan-700 text-[10px] uppercase tracking-widest hover:bg-cyan-900/20 hover:text-cyan-500 rounded-full transition-colors">
            I am grounded. Override.
          </button>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-[#0a0a20]/90 backdrop-blur flex items-center justify-between px-6 z-40 shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border ${CONTEXTS[activeSource].bg} ${CONTEXTS[activeSource].border} ${CONTEXTS[activeSource].color}`}>
            <ActiveIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`font-black italic tracking-widest text-sm uppercase transition-colors duration-500 ${CONTEXTS[activeSource].color}`}>The Ethical Compiler</h1>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest flex items-center gap-1">
              Source: {CONTEXTS[activeSource].name} // v5.1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Somatic Panic Button */}
          <button onClick={triggerScream} className="mr-2 p-2 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(243,24,73,0.3)] transition-all border border-rose-500/30" title="8/10 Distress Override">
            <Activity size={18} />
          </button>
          
          <button onClick={() => setShowVault(!showVault)} className={`p-2 rounded transition-all ${showVault ? 'text-amber-400 bg-amber-400/10 border border-amber-400/30' : 'text-slate-700 hover:text-slate-300'}`} title="Canon Vault">
            <Archive size={20}/>
          </button>
          <button onClick={downloadFullTranscript} className="p-2 rounded text-slate-700 hover:text-slate-300" title="Download Full Session Record">
            <Download size={20}/>
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded text-slate-700 hover:text-slate-300"><Settings size={20}/></button>
          <div className="h-8 w-px bg-white/10 mx-1" />
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 shadow-inner">
            {Object.keys(CONTEXTS).map(key => {
              const Icon = CONTEXTS[key].icon;
              return (
                <button 
                  key={key} 
                  onClick={() => setActiveSource(key)}
                  className={`p-1.5 rounded-lg transition-all ${activeSource === key ? `${CONTEXTS[key].bg} ${CONTEXTS[key].border} ${CONTEXTS[key].color}` : 'text-slate-600 hover:text-slate-300'}`}
                  title={CONTEXTS[key].name}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
          <button onClick={() => setIsContextOpen(!isContextOpen)} className={`ml-2 p-2 rounded border border-white/10 text-slate-600 transition-colors ${isContextOpen ? 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5' : 'hover:text-slate-300'}`}>
            <BookOpen size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative z-10">
        <main className="flex-1 flex flex-col min-w-0 bg-[#050510]">
          {/* Chat Container */}
          <div className="flex-1 min-h-0 p-4 md:p-8 overflow-y-auto flex flex-col gap-8 scroll-smooth custom-scrollbar">
            {chatHistory.length === 0 && (
              <div className="max-w-2xl mx-auto text-center space-y-10 py-20 opacity-30 animate-in fade-in duration-1000">
                <ActiveIcon className={`w-16 h-16 mx-auto ${CONTEXTS[activeSource].color}`} />
                <div className="space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.4em] italic">"Initiating Forensic Integrity Protocol..."</h2>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-light">
                    Audit modern rhetoric against high-fidelity Source Code. Use the Matrix button for a Triangulation Audit.
                  </p>
                </div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-4 md:gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-col md:flex-row'}`}>
                
                {msg.role === 'user' && (
                  <>
                    <div className="w-10 h-10 shrink-0 rounded-full border bg-white/5 border-white/10 text-slate-700 shadow-inner flex items-center justify-center">
                      <User size={18}/>
                    </div>
                    <div dir="auto" className="max-w-[85%] md:max-w-3xl p-6 md:p-8 text-sm leading-loose whitespace-pre-wrap shadow-2xl bg-white/5 border border-white/10 text-slate-300 rounded-3xl rounded-tr-none">
                      {msg.parts[0].text}
                    </div>
                  </>
                )}

                {msg.role === 'model' && (
                  <>
                    <div className={`w-10 h-10 shrink-0 rounded-full border flex items-center justify-center ${CONTEXTS[msg.source || 'nazarene'].bg} ${CONTEXTS[msg.source || 'nazarene'].border} ${CONTEXTS[msg.source || 'nazarene'].color}`}>
                      {React.createElement(CONTEXTS[msg.source || 'nazarene'].icon, { size: 18 })}
                    </div>
                    <div className="flex-1 max-w-[85%] md:max-w-3xl group relative">
                      <div dir="auto" className="p-6 md:p-8 text-sm leading-loose whitespace-pre-wrap shadow-2xl bg-[#0a0a20]/90 border border-white/5 text-slate-50 rounded-3xl rounded-tl-none italic backdrop-blur-sm" dangerouslySetInnerHTML={parseMarkdown(msg.parts[0].text, msg.source || 'nazarene')} />
                      
                      {/* Action Bar for Standard Model Response */}
                      <div className="absolute -right-12 top-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => saveToVault(msg.source || 'nazarene', msg.prompt || 'Archived Claim', msg.parts[0].text)} className="p-2 text-slate-600 hover:text-amber-400" title="Pin to Vault">
                          <Bookmark size={18} />
                        </button>
                        <button onClick={() => downloadSingleAudit(msg.source || 'nazarene', msg.prompt || 'Archived Claim', msg.parts[0].text)} className="p-2 text-slate-600 hover:text-cyan-400" title="Download This Audit">
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {msg.role === 'triangulation' && (
                  <div className="w-full space-y-6">
                    <div className="flex items-center gap-3 mb-2 px-2">
                      <Grid className="text-slate-500 w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Triangulation Audit Completed</span>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {Object.keys(CONTEXTS).map(key => {
                        const CtxIcon = CONTEXTS[key].icon;
                        return (
                          <div key={key} className={`relative group p-6 rounded-2xl border bg-[#0a0a20]/80 backdrop-blur-sm shadow-xl ${CONTEXTS[key].border}`}>
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${CONTEXTS[key].bg} ${CONTEXTS[key].color}`}>
                                  <CtxIcon size={16} />
                                </div>
                                <span className={`font-black text-xs uppercase tracking-widest ${CONTEXTS[key].color}`}>{CONTEXTS[key].name}</span>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => downloadSingleAudit(key, msg.prompt, msg.responses[key])} className="text-slate-600 hover:text-cyan-400 transition-colors" title="Download Node Verdict">
                                  <Download size={16} />
                                </button>
                                <button onClick={() => saveToVault(key, msg.prompt, msg.responses[key])} className="text-slate-600 hover:text-amber-400 transition-colors" title="Pin Node Verdict">
                                  <Bookmark size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm leading-loose italic text-slate-200" dangerouslySetInnerHTML={parseMarkdown(msg.responses[key], key)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {msg.role === 'error' && (
                  <>
                    <div className="w-10 h-10 shrink-0 rounded-full border flex items-center justify-center bg-rose-500/10 border-rose-500/30 text-rose-500">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 max-w-[85%] md:max-w-3xl">
                      <div dir="auto" className="p-6 md:p-8 text-sm leading-loose whitespace-pre-wrap shadow-2xl bg-[#0a0a20]/90 border border-rose-500/30 text-rose-200 rounded-3xl rounded-tl-none font-mono uppercase tracking-wider italic backdrop-blur-sm" dangerouslySetInnerHTML={{ __html: msg.parts[0].text }} />
                    </div>
                  </>
                )}
              </div>
            ))}
            {isProcessing && <div className="flex gap-6 justify-center py-6 animate-pulse"><div className="w-2 h-2 bg-slate-700 rounded-full"/><div className="w-2 h-2 bg-slate-700 rounded-full"/><div className="w-2 h-2 bg-slate-700 rounded-full"/></div>}
            <div ref={chatEndRef} className="h-10 shrink-0" />
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-8 bg-[#050510]/98 border-t border-white/5 backdrop-blur shrink-0 relative z-20">
            <form className="max-w-5xl mx-auto flex items-end gap-3 bg-[#0a0a20] border border-white/10 rounded-[2rem] p-3 shadow-2xl focus-within:border-white/20 transition-all">
              <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-700 hover:text-slate-300 transition-colors" title="Upload Audit Source (.txt)"><Paperclip size={24}/></button>
              
              <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e, false); }}} placeholder="Input rhetoric or transcript..." className="flex-1 max-h-[250px] min-h-[44px] bg-transparent text-slate-100 text-sm py-3 px-2 outline-none resize-none custom-scrollbar placeholder-slate-800" />
              
              <div className="flex gap-2">
                <button type="button" onClick={(e) => handleSend(e, true)} disabled={isProcessing || !inputText.trim()} className="h-14 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-20 border border-slate-700/50" title="Triangulation Audit (All Nodes)">
                  <Grid size={20} />
                </button>
                <button type="button" onClick={(e) => handleSend(e, false)} disabled={isProcessing || !inputText.trim()} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 disabled:opacity-5 shadow-lg active:scale-95 ${CONTEXTS[activeSource].color.replace('text-', 'bg-').replace('500', '900')} text-black`} title={`Audit via ${CONTEXTS[activeSource].name}`}>
                  <Send size={24} className="ml-1"/>
                </button>
              </div>
            </form>
          </div>
        </main>

        {/* Canon Vault Sidebar */}
        <aside className={`absolute left-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#050510]/98 backdrop-blur-3xl border-r border-white/10 flex flex-col z-50 shadow-2xl transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${showVault ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-amber-500/5 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2"><Archive size={16}/> The Canon Vault</h2>
            <button onClick={() => setShowVault(false)} className="text-amber-900 hover:text-amber-500 p-2 transition-colors"><X size={24}/></button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {savedVault.length === 0 ? (
              <p className="text-xs text-slate-600 italic text-center mt-10">Vault is empty. Pin audits to save them to the Sovereign Record.</p>
            ) : (
              savedVault.map((item) => (
                <div key={item.id} className="p-5 rounded-xl border border-white/10 bg-black/40">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${CONTEXTS[item.source].color}`}>{CONTEXTS[item.source].name}</span>
                    <button onClick={() => setSavedVault(prev => prev.filter(v => v.id !== item.id))} className="text-slate-700 hover:text-rose-500"><Trash2 size={14}/></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 italic">"{item.prompt}"</p>
                  <div className="text-xs leading-relaxed text-slate-300" dangerouslySetInnerHTML={parseMarkdown(item.response, item.source)} />
                  <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[9px] text-slate-600 uppercase tracking-widest">
                    <span>Pinned: {new Date(item.date).toLocaleDateString()}</span>
                    <button onClick={() => downloadSingleAudit(item.source, item.prompt, item.response)} className="hover:text-cyan-400 flex items-center gap-1" title="Download Pinned Audit">
                      <Download size={10} /> Save
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Context Sidebar */}
        <aside className={`absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[#050510]/98 backdrop-blur-3xl border-l border-white/10 flex flex-col z-40 shadow-2xl transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${isContextOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-white/5 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><BookOpen size={16}/> The Source Instruction</h2>
            <button onClick={() => setIsContextOpen(false)} className="text-slate-600 hover:text-white p-2 transition-colors"><X size={24}/></button>
          </div>
          <div className="p-8 flex-1 flex flex-col min-h-0">
            <p className="text-[10px] text-slate-600 mb-6 leading-relaxed italic uppercase tracking-widest">Define the theological or philosophical parameters of the node here.</p>
            <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl p-6 text-xs font-mono text-slate-400 leading-loose shadow-inner overflow-y-auto whitespace-pre-wrap">
              {CONTEXTS[activeSource].prompt}
            </div>
          </div>
        </aside>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-[340px] bg-[#0a0a20]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2"><Sliders size={14}/> Node Calibration</h3>
            <button onClick={() => setShowSettings(false)} className="text-slate-700 hover:text-slate-300 transition-colors"><X size={20}/></button>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-[9px] font-mono text-slate-600 mb-1 block uppercase tracking-widest">Compiler API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 text-xs text-slate-300 focus:border-cyan-500/50 outline-none transition-all" placeholder="AIzaSy..."/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Neural Engine</label>
                <button onClick={sweepModels} className="text-[9px] text-cyan-500 font-bold uppercase flex items-center gap-1 hover:text-white transition-colors">
                  <RefreshCw size={10} className={isSweeping ? 'animate-spin' : ''}/> Sweep
                </button>
              </div>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 text-xs text-slate-300 outline-none">
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button onClick={() => { if(window.confirm("Purge audit history?")) setChatHistory([]); }} className="w-full py-2.5 mt-2 flex items-center justify-center gap-2 text-xs text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-all uppercase font-black tracking-widest">
              <Trash2 size={14}/> Purge Local Cache
            </button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e1e3f; border-radius: 10px; }
      `}</style>
    </div>
  );
}