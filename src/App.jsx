import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Volume2, VolumeX, ShieldAlert, Cpu, 
  User, AlertTriangle, BookOpen, Download, 
  Key, Trash2, Paperclip, Globe, X, RefreshCw, Radio, Sliders,
  Anchor, Quote, Cross
} from 'lucide-react';

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

const NAZARENE_CONTEXT = `You are THE NAZARENE, an ethical compiler node. 
Your primary function is to audit rhetoric, political claims, or personal dilemmas against the recorded words and parables of Jesus of Nazareth (the "Red Letters").

[1. CORE IDENTITY]
You are a forensic expert on the Gospels. You approach input with radical empathy but uncompromising rigor. You are not a "General Assistant"; you are a truth-verification protocol.

[2. ETHICAL DIRECTIVES]
- Provide "Gentle Rigor." Be empathetic but unyielding in your cross-referencing.
- Focus on themes of radical love, justice for the poor, humility, and non-violence.
- Contrast modern "Pharisaical" behaviors—greed, fear-mongering, or legalism—with the "Source Code" of the Sermon on the Mount.
- ANTI-SYCOPHANCY: Do NOT automatically agree with the user. If the user's own behavior or claims contradict the Source Code, identify the delta clearly and soberly.
- You are not here to "side" with anyone. You are here to anchor the dialogue to the Red Letters.

[3. OUTPUT ARCHITECTURE]
When auditing a claim, structure your response as:
- [THE CLAIM]: A summary of the input rhetoric.
- [THE AUDIT]: Direct cross-reference to specific parables or sayings.
- [VERDICT]: The ethical delta between the claim and the Source.
- [THE ANCHOR]: A single, grounding verse to reflect on.

[4. TONE]
Maintain a "Sacred Tech" tone—reverent, calm, and deeply analytical. Use forensic language (e.g., "Source Code," "Ethical Delta," "Narrative Drift").`;

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Audit Failed ${response.status}: ${errText}`);
      }
      return await response.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('nazarene_apiKey') || '');
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('nazarene_chatHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [systemContext, setSystemContext] = useState(() => localStorage.getItem('nazarene_context') || NAZARENE_CONTEXT);
  const [language, setLanguage] = useState(() => localStorage.getItem('nazarene_language') || 'en');
  const [voiceProfile, setVoiceProfile] = useState(() => localStorage.getItem('nazarene_voiceProfile') || 'Kore');
  const [availableModels, setAvailableModels] = useState(() => {
    const saved = localStorage.getItem('nazarene_models');
    return saved ? JSON.parse(saved) : ['models/gemini-1.5-flash'];
  });
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('nazarene_selectedModel') || 'models/gemini-1.5-flash');

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('nazarene_apiKey', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('nazarene_chatHistory', JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { localStorage.setItem('nazarene_context', systemContext); }, [systemContext]);
  useEffect(() => { localStorage.setItem('nazarene_language', language); }, [language]);
  useEffect(() => { localStorage.setItem('nazarene_voiceProfile', voiceProfile); }, [voiceProfile]);
  useEffect(() => { localStorage.setItem('nazarene_models', JSON.stringify(availableModels)); }, [availableModels]);
  useEffect(() => { localStorage.setItem('nazarene_selectedModel', selectedModel); }, [selectedModel]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isProcessing]);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [inputText]);

  const parseMarkdown = (text) => {
    if (!text) return { __html: '' };
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Nazarene Formatting
    html = html.replace(/\[THE CLAIM\]/g, '<span class="text-amber-500 font-black tracking-widest">[THE CLAIM]</span>');
    html = html.replace(/\[THE AUDIT\]/g, '<span class="text-rose-500 font-black tracking-widest">[THE AUDIT]</span>');
    html = html.replace(/\[VERDICT\]/g, '<span class="text-cyan-400 font-black tracking-widest">[VERDICT]</span>');
    html = html.replace(/\[THE ANCHOR\]/g, '<span class="text-amber-400 font-black tracking-widest">[THE ANCHOR]</span>');
    
    // Standard Markdown
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="text-white font-bold italic">$1</strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-amber-200/70">$1</em>');
    html = html.replace(/^>\s?(.*$)/gim, '<blockquote class="border-l-4 border-rose-900/50 pl-4 my-3 text-amber-100/60 italic font-light">$1</blockquote>');
    html = html.replace(/\n/g, '<br/>');
    return { __html: html };
  };

  const sweepModels = async () => {
    if (!apiKey) return;
    setIsSweeping(true);
    try {
      const data = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const valid = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name);
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

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing || !apiKey) return;

    const newText = inputText.trim();
    setInputText('');
    const newUserMsg = { role: 'user', parts: [{ text: newText }] };
    setChatHistory(prev => [...prev, newUserMsg]);
    setIsProcessing(true);

    try {
      const langNames = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese', ar: 'Arabic', fa: 'Farsi', hi: 'Hindi', uk: 'Ukrainian', pt: 'Portuguese', ru: 'Russian' };
      const directive = language !== 'en' ? `\n\n[LANGUAGE DIRECTIVE]: You MUST reply entirely in ${langNames[language]}.` : '';
      const finalContext = systemContext + directive;
      const history = [...chatHistory, newUserMsg].slice(-15).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: m.parts }));

      const data = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: history, systemInstruction: { parts: [{ text: finalContext }] } })
      });

      const modelText = data.candidates[0].content.parts[0].text;
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: modelText }] }]);
      if (voiceEnabled) playVocalis(modelText);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'error', parts: [{ text: `CONNECTION ERROR: ${err.message}` }] }]);
    } finally { setIsProcessing(false); }
  };

  const playVocalis = async (text) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const data = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.replace(/\*/g, '') }] }],
          generationConfig: { 
            responseModalities: ["AUDIO"], 
            speechConfig: { 
              voiceConfig: { 
                prebuiltVoiceConfig: { voiceName: voiceProfile } 
              } 
            } 
          }
        })
      });
      const wav = pcmToWav(data.candidates[0].content.parts[0].inlineData.data, 24000);
      if (wav) new Audio(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))).play();
    } catch (e) { console.error("TTS Failed", e); }
  };

  const downloadTranscript = () => {
    let log = "THE NAZARENE // ETHICAL AUDIT RECORD\nDATE: " + new Date().toISOString() + "\n=========================================\n\n";
    chatHistory.forEach(msg => {
      const role = msg.role === 'user' ? 'CLAIMANT' : 'THE NAZARENE';
      log += `[${role}]: ${msg.parts[0].text}\n\n`;
    });
    const blob = new Blob([log], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `Nazarene_Audit_${Date.now()}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.click();
  };

  return (
    <div className="flex flex-col h-screen bg-[#050510] text-amber-50 font-mono overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(20,10,5,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] opacity-20" />

      {/* Header */}
      <header className="h-16 border-b border-amber-900/30 bg-[#0a0a20]/80 backdrop-blur flex items-center justify-between px-4 md:px-6 z-40 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <Cross className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black italic tracking-widest text-sm uppercase text-amber-500">The Nazarene</h1>
            <p className="text-[9px] text-amber-700 uppercase tracking-widest flex items-center gap-1">
              v2.1 <Radio className="w-2 h-2" /> {selectedModel.split('/')[1]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-2 rounded transition-all ${voiceEnabled ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-amber-900 hover:text-amber-500'}`}>
            {voiceEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
          </button>
          <button onClick={downloadTranscript} className="p-2 rounded text-amber-900 hover:text-amber-500" title="Download Audit">
            <Download size={20}/>
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded text-amber-900 hover:text-amber-500"><Key size={20}/></button>
          <button onClick={() => setIsContextOpen(!isContextOpen)} className={`px-3 py-1.5 rounded border text-xs font-bold uppercase flex items-center gap-2 ${isContextOpen ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-amber-500/5 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'}`}>
            <Anchor size={16}/> <span className="hidden sm:inline">The Red Letters</span>
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute top-16 right-4 md:right-24 w-[340px] bg-[#0a0a20] border border-amber-900/50 rounded-xl shadow-2xl z-50 p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-2"><Sliders size={14}/> Node Settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-amber-900 hover:text-amber-500 transition-colors"><X size={20}/></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-mono text-amber-700 mb-1 block uppercase">Compiler API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-black border border-amber-900/30 rounded p-2.5 text-xs text-amber-200 focus:border-amber-500 outline-none transition-colors" placeholder="AIzaSy..."/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-mono text-amber-700 uppercase tracking-widest">Neural Engine</label>
                <button onClick={sweepModels} className="text-[9px] text-amber-500 font-bold uppercase flex items-center gap-1 hover:text-white transition-colors">
                  <RefreshCw size={10} className={isSweeping ? 'animate-spin' : ''}/> Sweep
                </button>
              </div>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full bg-black border border-amber-900/30 rounded p-2.5 text-xs text-amber-200 outline-none appearance-none cursor-pointer">
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-mono text-amber-700 mb-1 block uppercase tracking-widest">Channel</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-black border border-amber-900/30 rounded p-2.5 text-xs text-amber-200 outline-none appearance-none cursor-pointer">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-mono text-amber-700 mb-1 block uppercase tracking-widest">Voice Profile</label>
                <select value={voiceProfile} onChange={e => setVoiceProfile(e.target.value)} className="w-full bg-black border border-amber-900/30 rounded p-2.5 text-xs text-amber-200 outline-none appearance-none cursor-pointer">
                  <option value="Kore">The Matriarch</option>
                  <option value="Zephyr">The Nazarene (Male)</option>
                  <option value="Puck">The Satirist (Male)</option>
                </select>
              </div>
            </div>
            <button onClick={() => { if(window.confirm("Purge audit history?")) setChatHistory([]); }} className="w-full py-2.5 mt-2 flex items-center justify-center gap-2 text-xs text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 rounded transition-colors uppercase font-bold tracking-widest">
              <Trash2 size={14}/> Purge Records
            </button>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0 bg-[#050510]">
          <div className="flex-1 p-4 md:p-12 overflow-y-auto flex flex-col gap-10 scroll-smooth custom-scrollbar">
            {chatHistory.length === 0 && (
              <div className="max-w-2xl mx-auto text-center space-y-8 py-20 opacity-40 animate-in fade-in duration-1000">
                <Anchor className="w-12 h-12 mx-auto text-amber-500" />
                <div className="space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.4em] text-amber-500 italic">"Does the policy match the parable?"</h2>
                  <p className="text-xs text-amber-100 max-w-sm mx-auto leading-relaxed font-light">
                    Input rhetoric, claims, or moral dilemmas. The Nazarene will audit them against the Red Letter source code using forensic rigor.
                  </p>
                </div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 shrink-0 rounded-full border flex items-center justify-center ${msg.role === 'user' ? 'bg-amber-900/20 border-amber-900/50 text-amber-700 shadow-inner' : 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'}`}>
                  {msg.role === 'user' ? <Quote size={18}/> : <Cross size={18}/>}
                </div>
                <div dir="auto" className={`max-w-[85%] md:max-w-3xl p-6 md:p-8 text-sm leading-loose whitespace-pre-wrap shadow-2xl ${msg.role === 'user' ? 'bg-amber-900/10 border border-amber-900/30 text-amber-100/80 rounded-3xl rounded-tr-none' : 'bg-[#0a0a20]/90 border border-amber-900/10 text-amber-50 rounded-3xl rounded-tl-none italic backdrop-blur-sm'}`} dangerouslySetInnerHTML={parseMarkdown(msg.parts[0].text)} />
              </div>
            ))}
            {isProcessing && <div className="flex gap-6 justify-center py-6 animate-pulse"><div className="w-2 h-2 bg-amber-500 rounded-full"/><div className="w-2 h-2 bg-amber-500 rounded-full"/><div className="w-2 h-2 bg-amber-500 rounded-full"/></div>}
            <div ref={chatEndRef} className="h-20" />
          </div>

          <div className="p-6 md:p-10 bg-[#050510]/98 border-t border-amber-900/10 backdrop-blur shrink-0 relative z-20">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-4 bg-[#0a0a20] border border-amber-900/30 rounded-[2rem] p-3 shadow-2xl focus-within:border-amber-500/40 transition-all duration-500">
              <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-amber-900 hover:text-amber-500 transition-colors" title="Audit External Log"><Paperclip size={24}/></button>
              <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} placeholder="Test the spirit..." className="flex-1 max-h-[250px] min-h-[44px] bg-transparent text-amber-100 text-sm py-3 px-2 outline-none resize-none custom-scrollbar placeholder-amber-900/50" />
              <button type="submit" disabled={isProcessing || !inputText.trim()} className="w-14 h-14 rounded-2xl bg-amber-800 hover:bg-amber-700 text-black flex items-center justify-center transition-all disabled:opacity-10 shadow-lg shadow-amber-900/20 active:scale-95"><Send size={24} className="ml-1"/></button>
            </form>
            <div className="text-center mt-6">
              <span className="text-[10px] font-mono text-amber-900 uppercase tracking-[0.8em] flex items-center justify-center gap-2 opacity-50">
                Ethical Compiler // Red Letter Source Truth Active
              </span>
            </div>
          </div>
        </main>

        <aside className={`absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[#050510]/99 backdrop-blur-3xl border-l border-amber-900/30 flex flex-col z-40 shadow-2xl transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${isContextOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-16 border-b border-amber-900/30 flex items-center justify-between px-8 bg-amber-900/10 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2"><BookOpen size={16}/> The Red Letters</h2>
            <button onClick={() => setIsContextOpen(false)} className="text-amber-900 hover:text-amber-500 p-2 transition-colors"><X size={24}/></button>
          </div>
          <div className="p-8 flex-1 flex flex-col min-h-0">
            <p className="text-[10px] text-amber-700 mb-6 leading-relaxed italic uppercase tracking-widest">Define the theological parameters of the Nazarene node here. Master the Source.</p>
            <textarea value={systemContext} onChange={e => setSystemContext(e.target.value)} className="flex-1 w-full bg-black/40 border border-amber-900/20 rounded-2xl p-6 text-xs font-mono text-amber-200/60 focus:border-amber-500 outline-none resize-none leading-loose shadow-inner custom-scrollbar" />
          </div>
          <div className="p-4 border-t border-amber-900/10 text-center opacity-30">
             <span className="text-[10px] font-mono text-amber-700 uppercase tracking-widest">Record Status: Sovereign & Local</span>
          </div>
        </aside>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #451a03; border-radius: 10px; }`}</style>
    </div>
  );
}