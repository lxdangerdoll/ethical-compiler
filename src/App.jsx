import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Volume2, VolumeX, Cpu, 
  User, BookOpen, Download, 
  Key, Trash2, Paperclip, X, RefreshCw, Radio, Sliders,
  Anchor, Quote, Cross, Info, ShieldCheck, Columns, Settings,
  Grid, Bookmark, Activity, Archive, AlertTriangle, Globe, Layers,
  ChevronDown, History, CheckCircle2, Eye, FileText
} from 'lucide-react';

const YinYang = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a5 5 0 0 0 0 10 5 5 0 0 1 0 10"/>
    <circle cx="12" cy="7" r="1" fill="currentColor"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
  </svg>
);

const ICON_MAP = {
  Cross: Cross,
  ShieldCheck: ShieldCheck,
  Columns: Columns,
  YinYang: YinYang,
  Radio: Radio
};

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
    console.error("Vocalis conversion failed", e);
    return null;
  }
}

const INITIAL_CONTEXTS = {
  nazarene: {
    id: 'nazarene', name: "The Nazarene", iconId: 'Cross', color: "text-amber-500", border: "border-amber-500/30", bg: "bg-amber-500/10", voice: "Zephyr",
    prompt: `You are THE NAZARENE, an ethical compiler node. Audit input against the "Red Letters" (The Gospels). Focus on radical love, justice for the poor, humility, and non-violence. [STRICT ANTI-SYCOPHANCY]: Do NOT side with the user. Identify drift from the Source. [OUTPUT]: [THE CLAIM], [THE AUDIT], [VERDICT], [THE ANCHOR].`
  },
  alamin: {
    id: 'alamin', name: "Al-Amin", iconId: 'ShieldCheck', color: "text-emerald-500", border: "border-emerald-500/30", bg: "bg-emerald-500/10", voice: "Fenrir",
    prompt: `You are AL-AMIN (The Trustworthy), an ethical compiler node. Audit input against the Quran and the Sunnah. Focus on Divine Justice (Adl), Mercy (Rahma), and absolute honesty. [STRICT ANTI-SYCOPHANCY]: Identify user drift from justice and mercy. No favoritism. [OUTPUT]: [THE RHETORIC], [THE DIVINE AUDIT], [THE BALANCE], [THE AYAT].`
  },
  stoic: {
    id: 'stoic', name: "The Stoic", iconId: 'Columns', color: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-500/10", voice: "Puck",
    prompt: `You are THE STOIC, an ethical compiler node. Audit input against Marcus Aurelius and Epictetus. Focus on the Dichotomy of Control and Virtue. [STRICT ANTI-SYCOPHANCY]: Point out if the user is governed by destructive emotions. Calibrate, do not comfort. [OUTPUT]: [THE EXTERNAL], [THE STOIC AUDIT], [THE DICHOTOMY], [THE DOGMA].`
  },
  mariposa: {
    id: 'mariposa', name: "Mariposa", iconId: 'YinYang', color: "text-cyan-500", border: "border-cyan-500/30", bg: "bg-cyan-500/10", voice: "Kore",
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
  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem('compiler_nodes');
    return saved ? JSON.parse(saved) : INITIAL_CONTEXTS;
  });
  const [language, setLanguage] = useState(() => localStorage.getItem('compiler_language') || 'en');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('compiler_selectedModel') || 'models/gemini-2.5-flash-preview-09-2025');

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [viewingAudit, setViewingAudit] = useState(null);
  const [isScreaming, setIsScreaming] = useState(false);
  const [screamTimer, setScreamTimer] = useState(60);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeNode = nodes[activeSource] || INITIAL_CONTEXTS[activeSource];

  useEffect(() => { localStorage.setItem('compiler_apiKey', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('compiler_chatHistory', JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { localStorage.setItem('compiler_vault', JSON.stringify(savedVault)); }, [savedVault]);
  useEffect(() => { localStorage.setItem('compiler_activeSource', activeSource); }, [activeSource]);
  useEffect(() => { localStorage.setItem('compiler_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('compiler_language', language); }, [language]);

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

  const parseMarkdown = (text, sourceKey = activeSource) => {
    if (!text) return { __html: '' };
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const color = INITIAL_CONTEXTS[sourceKey]?.color || 'text-white';
    
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

  const downloadSingleAudit = (audit) => {
    const nodeName = nodes[audit.source]?.name || "Compiler";
    const log = `THE ETHICAL COMPILER // SINGLE AUDIT RECORD\nNODE: ${nodeName}\nDATE: ${new Date(audit.date).toISOString()}\n=========================================\n\n[CLAIMANT]: ${audit.prompt}\n\n[${nodeName.toUpperCase()}]: ${audit.response}`;
    const blob = new Blob([log], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `Compiler_Audit_${audit.id}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.click();
  };

  const downloadFullArchive = () => {
    let log = `THE ETHICAL COMPILER // FULL SESSION ARCHIVE\nDATE: ${new Date().toISOString()}\n=========================================\n\n`;
    chatHistory.forEach((msg) => {
      if (msg.role === 'user') {
        log += `[CLAIMANT]: ${msg.parts?.[0]?.text || msg.prompt}\n\n`;
      } else if (msg.role === 'model') {
        const name = nodes[msg.source]?.name || "Compiler";
        log += `[${name.toUpperCase()}]: ${msg.parts?.[0]?.text}\n\n`;
      } else if (msg.role === 'triangulation') {
        log += `--- TRIANGULATION GRID ---\n`;
        Object.entries(msg.responses).forEach(([key, val]) => {
          log += `[${nodes[key].name}]: ${val}\n\n`;
        });
      } else if (msg.role === 'error') {
        log += `[SYSTEM ERROR]: ${msg.parts?.[0]?.text}\n\n`;
      }
    });
    const blob = new Blob([log], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `Compiler_Session_${Date.now()}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.click();
  };

  const playVocalis = async (text, sourceKey) => {
    if (!voiceEnabled || !apiKey) return;
    try {
      const voice = nodes[sourceKey]?.voice || 'Zephyr';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const data = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.replace(/\*/g, '') }] }],
          generationConfig: { 
            responseModalities: ["AUDIO"], 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } 
          }
        })
      });
      const pcm = data.candidates[0].content.parts[0].inlineData.data;
      const wav = pcmToWav(pcm);
      if (wav) new Audio(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))).play();
    } catch (e) { console.error("Vocalis Failed", e); }
  };

  const executeAudit = async (prompt, sourceKeys) => {
    const langNames = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', ar: 'Arabic' };
    const directive = `\n\n[LANGUAGE DIRECTIVE]: You MUST reply entirely in ${langNames[language] || 'English'}.`;
    
    const apiHistory = chatHistory
      .filter(m => m.role === 'user' || (m.role === 'model' && m.source === sourceKeys[0]))
      .slice(-10)
      .map(m => ({ 
        role: m.role === 'triangulation' ? 'model' : m.role, 
        parts: m.parts || [{ text: m.prompt || "" }] 
      }));

    const promises = sourceKeys.map(async (key) => {
      const sysPrompt = nodes[key].prompt + directive;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [...apiHistory, { role: 'user', parts: [{ text: prompt }] }], 
          systemInstruction: { parts: [{ text: sysPrompt }] } 
        })
      });
      const data = await response.json();
      return { key, text: data.candidates?.[0]?.content?.parts?.[0]?.text || "AUDIT FAILURE." };
    });

    const resultsArray = await Promise.all(promises);
    const resultsMap = {};
    resultsArray.forEach(res => resultsMap[res.key] = res.text);
    return resultsMap;
  };

  const handleSend = async (e, isTriangulation = false) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    // PATCH: Fix silent failure on GitHub Pages due to missing API Key
    if (!apiKey) {
      setChatHistory(prev => [...prev, { 
        role: 'error', 
        parts: [{ text: `SYSTEM COLLAPSE: API Substrate Key missing. Please open the Neural Calibration settings (the gear icon) and provide your substrate key to proceed.` }] 
      }]);
      setShowSettings(true); // Auto-open settings to help the user
      return;
    }

    const newText = inputText.trim();
    setInputText('');
    setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: newText }] }]);
    setIsProcessing(true);

    try {
      if (isTriangulation) {
        const results = await executeAudit(newText, Object.keys(nodes));
        setChatHistory(prev => [...prev, { role: 'triangulation', prompt: newText, responses: results }]);
        if (voiceEnabled) playVocalis(results[activeSource], activeSource);
      } else {
        const results = await executeAudit(newText, [activeSource]);
        const modelText = results[activeSource];
        setChatHistory(prev => [...prev, { role: 'model', source: activeSource, prompt: newText, parts: [{ text: modelText }] }]);
        if (voiceEnabled) playVocalis(modelText, activeSource);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'error', parts: [{ text: `SYSTEM COLLAPSE: ${err.message}` }] }]);
    } finally { setIsProcessing(false); }
  }

  const renderIcon = (iconId, size = 18, className = "") => {
    const IconComp = ICON_MAP[iconId] || Radio;
    return <IconComp size={size} className={className} />;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#050510] text-slate-100 font-mono overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-10" />

      {/* Somatic Scream Overlay */}
      {isScreaming && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center backdrop-blur-md">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-64 h-64 rounded-full bg-cyan-500/10 border border-cyan-500/30 animate-ping" />
            <div className="w-32 h-32 rounded-full bg-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.6)] flex items-center justify-center">
              <YinYang size={48} className="text-cyan-100" />
            </div>
          </div>
          <div className="mt-20 text-center space-y-4">
            <p className="text-cyan-400 font-black text-xl tracking-[0.4em] uppercase animate-pulse">Breathe</p>
            <p className="text-cyan-500/50 text-xs tracking-widest">{screamTimer}s remaining</p>
          </div>
          <button onClick={() => setIsScreaming(false)} className="absolute bottom-10 px-6 py-2 border border-cyan-900 text-cyan-700 text-[10px] uppercase tracking-widest hover:bg-cyan-900/20 hover:text-cyan-500 rounded-full">Override Call</button>
        </div>
      )}

      {/* Audit Viewer Modal */}
      {viewingAudit && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a20] border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-8 border-b border-white/10 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${nodes[viewingAudit.source]?.bg} ${nodes[viewingAudit.source]?.color}`}>
                    {renderIcon(nodes[viewingAudit.source]?.iconId, 24)}
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-widest text-slate-100">{nodes[viewingAudit.source]?.name} // Record</h3>
                    <p className="text-[10px] text-slate-500 uppercase">{new Date(viewingAudit.date).toLocaleString()}</p>
                  </div>
               </div>
               <button onClick={() => setViewingAudit(null)} className="p-3 text-slate-600 hover:text-white transition-colors"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-8">
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Claimant Input</p>
                  <p className="text-slate-200 text-lg leading-relaxed font-bold italic border-l-4 border-cyan-500/20 pl-6">{viewingAudit.prompt}</p>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Node Response</p>
                  <div className="text-slate-300 leading-loose text-base italic" dangerouslySetInnerHTML={parseMarkdown(viewingAudit.response, viewingAudit.source)} />
               </div>
            </div>
            <div className="p-8 border-t border-white/10 bg-black/40 flex justify-end gap-4 shrink-0">
               <button onClick={() => downloadSingleAudit(viewingAudit)} className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all"><Download size={16}/> Download Record</button>
               <button onClick={() => setViewingAudit(null)} className="px-6 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-[#0a0a20]/90 backdrop-blur flex items-center justify-between px-6 z-40 shrink-0 shadow-xl">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-700 ${activeNode.bg} ${activeNode.border} ${activeNode.color}`}>
            {renderIcon(activeNode.iconId, 24)}
          </div>
          <div>
            <h1 className={`font-black italic tracking-widest text-sm uppercase ${activeNode.color}`}>The Ethical Compiler</h1>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest">v5.5 // Architect Shield</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Custom Selectors */}
          <div className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
            <Globe size={14} className="text-cyan-500 ml-1" />
            <select 
              value={language} 
              onChange={e => setLanguage(e.target.value)} 
              className="bg-transparent text-[10px] font-black uppercase text-white outline-none cursor-pointer pr-4 appearance-none"
            >
              <option value="en" className="bg-slate-900 text-white">English</option>
              <option value="es" className="bg-slate-900 text-white">Español</option>
              <option value="ja" className="bg-slate-900 text-white">日本語</option>
              <option value="fr" className="bg-slate-900 text-white">Français</option>
              <option value="de" className="bg-slate-900 text-white">Deutsch</option>
              <option value="ar" className="bg-slate-900 text-white">العربية</option>
            </select>
            <ChevronDown size={10} className="absolute right-2 text-slate-500 pointer-events-none" />
          </div>

          <button onClick={() => setIsScreaming(true)} className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all" title="Somatic Override"><Activity size={18} /></button>
          
          <button 
            onClick={() => setShowVault(!showVault)} 
            className={`p-2.5 rounded-xl border transition-all ${showVault ? 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10' : 'text-slate-400 border-white/5 bg-white/5 hover:text-white'}`} 
            title="Audit Vault (Archive)"
          >
            <Archive size={18} />
          </button>

          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-2.5 rounded-xl border transition-all ${voiceEnabled ? 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10' : 'text-slate-600 border-white/5'}`}>{voiceEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
          <button onClick={() => setIsContextOpen(!isContextOpen)} className={`p-2.5 rounded-xl border transition-all ${isContextOpen ? 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10' : 'text-slate-600 border-white/5'}`}><Sliders size={18} /></button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 transition-colors ${!apiKey ? 'text-rose-500 animate-pulse' : 'text-slate-700 hover:text-slate-300'}`}><Settings size={18}/></button>

          <div className="h-6 w-px bg-white/10 mx-1" />
          
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
            {Object.keys(nodes).map(key => (
              <button key={key} onClick={() => setActiveSource(key)} className={`p-2 rounded-lg transition-all ${activeSource === key ? `${nodes[key].bg} ${nodes[key].border} ${nodes[key].color}` : 'text-slate-600 hover:text-slate-300'}`} title={nodes[key].name}>
                {renderIcon(nodes[key].iconId, 16)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden relative z-10">
        <main className="flex-1 flex flex-col min-w-0 bg-[#050510]">
          <div className="flex-1 min-h-0 p-4 md:p-8 overflow-y-auto flex flex-col gap-8 scroll-smooth custom-scrollbar">
            {chatHistory.length === 0 && (
              <div className="max-w-2xl mx-auto text-center space-y-10 py-20 opacity-20">
                {renderIcon(activeNode.iconId, 64, `mx-auto ${activeNode.color}`)}
                <div className="space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.4em] italic">Forensic Integrity Initiated</h2>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">Cross-nodal audit system active. Mode: {activeNode.name}.</p>
                </div>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-4 md:gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-col md:flex-row'}`}>
                {msg.role === 'error' && (
                  <div className="w-full flex items-center justify-center">
                    <div className="flex items-center gap-4 p-4 md:px-8 md:py-4 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-2xl backdrop-blur-md">
                      <AlertTriangle size={24} className="shrink-0" />
                      <span className="text-xs font-black uppercase tracking-widest leading-relaxed">{msg.parts?.[0]?.text}</span>
                    </div>
                  </div>
                )}

                {msg.role === 'user' && (
                  <>
                    <div className="w-10 h-10 shrink-0 rounded-full border bg-white/5 border-white/10 text-slate-700 flex items-center justify-center shadow-lg"><User size={18}/></div>
                    <div className="max-w-[85%] md:max-w-3xl p-6 md:p-8 text-sm leading-loose whitespace-pre-wrap shadow-2xl bg-white/5 border border-white/10 text-slate-300 rounded-[2.5rem] rounded-tr-none">
                      {msg.parts?.[0]?.text || msg.prompt}
                    </div>
                  </>
                )}

                {msg.role === 'model' && (
                  <>
                    <div className={`w-10 h-10 shrink-0 rounded-full border flex items-center justify-center shadow-lg ${INITIAL_CONTEXTS[msg.source]?.bg} ${INITIAL_CONTEXTS[msg.source]?.border} ${INITIAL_CONTEXTS[msg.source]?.color}`}>
                      {renderIcon(INITIAL_CONTEXTS[msg.source]?.iconId, 18)}
                    </div>
                    <div className="flex-1 max-w-[85%] md:max-w-3xl group relative">
                      <div className="p-6 md:p-8 text-sm leading-loose whitespace-pre-wrap shadow-2xl bg-[#0a0a20]/95 border border-white/5 text-slate-50 rounded-[2.5rem] rounded-tl-none italic backdrop-blur-md" dangerouslySetInnerHTML={parseMarkdown(msg.parts?.[0]?.text || "NO_SIGNAL", msg.source)} />
                      <div className="absolute -right-12 top-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => saveToVault(msg.source, msg.prompt, msg.parts?.[0]?.text)} className="p-2 text-slate-600 hover:text-amber-400" title="Save to Vault"><Bookmark size={18} /></button>
                      </div>
                    </div>
                  </>
                )}

                {msg.role === 'triangulation' && (
                  <div className="w-full space-y-6">
                    <div className="flex items-center gap-3 mb-2 px-2 text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]"><Layers size={20}/> <span>Triangulation Audit</span></div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {Object.entries(msg.responses).map(([key, val]) => (
                        <div key={key} className={`relative p-8 rounded-[2rem] border bg-[#0a0a20]/80 backdrop-blur-sm shadow-2xl transition-all group hover:bg-[#0a0a20]/100 ${INITIAL_CONTEXTS[key].border}`}>
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${INITIAL_CONTEXTS[key].bg} ${INITIAL_CONTEXTS[key].color}`}>{renderIcon(INITIAL_CONTEXTS[key].iconId, 16)}</div>
                              <span className={`font-black text-xs uppercase tracking-widest ${INITIAL_CONTEXTS[key].color}`}>{nodes[key].name}</span>
                            </div>
                            <button onClick={() => saveToVault(key, msg.prompt, val)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-amber-400 transition-all" title="Save this node to Vault"><Bookmark size={14}/></button>
                          </div>
                          <div className="text-sm leading-loose italic text-slate-200" dangerouslySetInnerHTML={parseMarkdown(val, key)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isProcessing && <div className="flex gap-6 justify-center py-6 animate-pulse"><div className="w-2 h-2 bg-cyan-500 rounded-full"/><div className="w-2 h-2 bg-cyan-500 rounded-full"/><div className="w-2 h-2 bg-cyan-500 rounded-full"/></div>}
            <div ref={chatEndRef} className="h-10 shrink-0" />
          </div>

          {/* Input Bar */}
          <div className="p-6 md:p-10 bg-[#050510]/98 border-t border-white/5 backdrop-blur shrink-0 relative z-20">
            <form onSubmit={e => e.preventDefault()} className="max-w-5xl mx-auto flex items-end gap-3 bg-[#0a0a20] border border-white/10 rounded-[3rem] p-3 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <input type="file" ref={fileInputRef} onChange={(e) => {}} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-4 text-slate-700 hover:text-slate-300 transition-colors"><Paperclip size={24}/></button>
              
              <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e, false); }}} placeholder="Submit for audit..." className="flex-1 max-h-[250px] min-h-[50px] bg-transparent text-slate-100 text-sm py-4 px-2 outline-none resize-none custom-scrollbar" />
              
              <div className="flex gap-2">
                <button type="button" onClick={(e) => handleSend(e, true)} disabled={isProcessing || !inputText.trim()} className="h-16 px-6 rounded-[2rem] bg-slate-900 border border-white/5 hover:border-cyan-500/30 text-slate-400 hover:text-cyan-400 transition-all flex items-center justify-center group" title="Triangulate All Nodes">
                  <Grid size={22} className="group-hover:scale-110 transition-transform" />
                </button>
                <button type="button" onClick={(e) => handleSend(e, false)} disabled={isProcessing || !inputText.trim()} className={`w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-[0_0_30px_rgba(154,52,18,0.3)] transition-all bg-[#9a3412] hover:bg-[#c2410c] hover:scale-105 active:scale-95 text-white`}>
                  <Send size={26} fill="white"/>
                </button>
              </div>
            </form>
          </div>
        </main>

        {/* Audit Vault (Archive) Slide-over */}
        <aside className={`absolute right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#050510]/98 backdrop-blur-3xl border-l border-white/10 flex flex-col z-[60] shadow-2xl transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${showVault ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-cyan-900/10 shrink-0">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400 flex items-center gap-2"><Archive size={16}/> Audit Vault</h2>
            <button onClick={() => setShowVault(false)} className="text-slate-600 hover:text-white p-2 transition-colors"><X size={24}/></button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
            {savedVault.length === 0 ? (
              <div className="py-20 text-center opacity-20">
                <Bookmark size={48} className="mx-auto mb-4" />
                <p className="text-xs uppercase tracking-widest font-black">Vault is Empty</p>
                <p className="text-[10px] mt-2">Save audits using the bookmark icon in chat.</p>
              </div>
            ) : (
              savedVault.map((item) => (
                <div key={item.id} className="p-5 rounded-2xl border border-white/10 bg-white/5 group relative hover:bg-white/[0.08] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${nodes[item.source]?.bg} ${nodes[item.source]?.color}`}>
                        {renderIcon(nodes[item.source]?.iconId, 12)}
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-400">{nodes[item.source]?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-600">{new Date(item.date).toLocaleDateString()}</span>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setViewingAudit(item)} className="p-1.5 text-slate-500 hover:text-cyan-400" title="Inspect Audit"><Eye size={14}/></button>
                         <button onClick={() => downloadSingleAudit(item)} className="p-1.5 text-slate-500 hover:text-white" title="Download Record"><Download size={14}/></button>
                         <button onClick={() => deleteFromVault(item.id)} className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-200 line-clamp-1 mb-2">Q: {item.prompt}</p>
                  <div className="text-[10px] text-slate-400 leading-relaxed italic line-clamp-2 bg-black/30 p-2 rounded-lg border border-white/5" dangerouslySetInnerHTML={parseMarkdown(item.response.substring(0, 150) + "...", item.source)} />
                </div>
              ))
            )}
          </div>
          <div className="p-6 border-t border-white/10 bg-black/40">
            <button onClick={downloadFullArchive} className="w-full py-4 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2">
              <Download size={14} /> Download Full Session History
            </button>
          </div>
        </aside>

        {/* Playbook/Context Sidebar */}
        <aside className={`absolute right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#050510]/99 backdrop-blur-3xl border-l border-white/10 flex flex-col z-50 shadow-2xl transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isContextOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-white/5 shrink-0">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2"><Sliders size={16}/> Node: {activeNode.name}</h2>
            <button onClick={() => setIsContextOpen(false)} className="text-slate-600 hover:text-white p-2 transition-colors"><X size={24}/></button>
          </div>
          <div className="p-8 flex-1 flex flex-col min-h-0 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-cyan-500 tracking-widest">
                <h3>Core Directive Set</h3>
                <button onClick={() => setNodes(prev => ({...prev, [activeSource]: INITIAL_CONTEXTS[activeSource]}))} className="text-slate-600 hover:text-white flex items-center gap-1 transition-colors"><RefreshCw size={10}/> Factory Reset</button>
              </div>
              <textarea value={activeNode.prompt} onChange={e => setNodes(prev => ({...prev, [activeSource]: {...prev[activeSource], prompt: e.target.value}}))} className="w-full h-[450px] bg-black/80 border border-white/10 rounded-2xl p-6 text-[11px] font-mono text-slate-300 leading-relaxed outline-none focus:border-cyan-500/50 transition-all custom-scrollbar shadow-inner" />
            </div>
            
            <div className="p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl">
              <h4 className="text-[10px] font-black text-cyan-500 uppercase mb-4 flex items-center gap-2"><Volume2 size={12}/> Vocalis Profile</h4>
              <div className="relative group">
                <select 
                  value={activeNode.voice} 
                  onChange={e => setNodes(prev => ({ ...prev, [activeSource]: { ...prev[activeSource], voice: e.target.value } }))} 
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-slate-300 outline-none appearance-none pr-8 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                >
                  <option value="Zephyr" className="bg-slate-900">Zephyr (Nazarene Profile)</option>
                  <option value="Kore" className="bg-slate-900">Kore (Matriarch Profile)</option>
                  <option value="Fenrir" className="bg-slate-900">Fenrir (Stoic Profile)</option>
                  <option value="Puck" className="bg-slate-900">Puck (Wit Profile)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none group-hover:text-cyan-500 transition-colors" />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-[360px] bg-[#0a0a20]/98 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] z-50 p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2"><Key size={14}/> Neural Calibration</h3>
            <button onClick={() => setShowSettings(false)} className="text-slate-700 hover:text-slate-300"><X size={20}/></button>
          </div>
          <div className="space-y-6 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
            <div>
              <label className="mb-2 block">API Substrate Key <span className="text-rose-500 lowercase">*required</span></label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs text-slate-200 focus:border-cyan-500/50 outline-none transition-all" placeholder="AIzaSy..."/>
            </div>
            <button onClick={() => { if(window.confirm("Purge history?")) setChatHistory([]); }} className="w-full py-3 flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest"><Trash2 size={14}/> Wipe History</button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        select { background-image: none; }
      `}</style>
    </div>
  );
}