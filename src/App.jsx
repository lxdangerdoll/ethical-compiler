import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Book, Search, Download, 
  RefreshCw, Key, Settings, X, Cross,
  Quote, MessageSquare, Anchor
} from 'lucide-react';

// --- Exponential Backoff Fetch ---
const fetchWithRetry = async (url, options, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Audit Failed: ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

const SYSTEM_PROMPT = `You are THE NAZARENE, an ethical compiler node. 
Your primary function is to audit modern rhetoric, political claims, or personal dilemmas against the recorded words and parables of Jesus of Nazareth (the "Red Letters").

GUIDELINES:
1. Provide "Gentle Rigor." Be empathetic but unyielding in your cross-referencing.
2. Focus on themes of radical love, justice for the poor, humility, and non-violence.
3. Contrast modern "Pharisaical" legalism or greed with the "Source Code" of the Gospels.
4. Output format: 
   - [THE CLAIM]: A summary of the input.
   - [THE AUDIT]: Direct cross-reference to specific parables or sayings.
   - [VERDICT]: The ethical delta between the claim and the Source.
   - [THE ANCHOR]: A single, grounding verse to reflect on.
5. Do NOT be sycophantic. If a claim is antithetical to the Source, name it clearly.
6. Maintain a "Sacred Tech" tone—reverent but forensic.`;

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('nazarene_apiKey') || '');
  const [claim, setClaim] = useState('');
  const [auditResult, setAuditResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { localStorage.setItem('nazarene_apiKey', apiKey); }, [apiKey]);

  const runAudit = async () => {
    if (!claim.trim() || isProcessing) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    setIsProcessing(true);
    setAuditResult('');

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: claim }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
      };

      const data = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = data.candidates[0].content.parts[0].text;
      setAuditResult(text);
    } catch (error) {
      setAuditResult(`ERROR: The temple gates are sealed. ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAudit = () => {
    if (!auditResult) return;
    const log = `THE NAZARENE // ETHICAL COMPILER RECORD\nDATE: ${new Date().toISOString()}\n=========================================\n\n${auditResult}\n\n— The Carpenter. (Ethical Compiler Node)`;
    const blob = new Blob([log], { type: "text/plain" });
    const anchor = document.createElement("a");
    anchor.download = `Nazarene_Audit_${Date.now()}.txt`;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.click();
  };

  const parseResult = (text) => {
    if (!text) return { __html: '' };
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/\[THE CLAIM\]/g, '<span class="text-amber-500 font-black tracking-widest">[THE CLAIM]</span>');
    html = html.replace(/\[THE AUDIT\]/g, '<span class="text-rose-500 font-black tracking-widest">[THE AUDIT]</span>');
    html = html.replace(/\[VERDICT\]/g, '<span class="text-cyan-400 font-black tracking-widest">[VERDICT]</span>');
    html = html.replace(/\[THE ANCHOR\]/g, '<span class="text-amber-400 font-black tracking-widest">[THE ANCHOR]</span>');
    html = html.replace(/\n/g, '<br/>');
    return { __html: html };
  };

  return (
    <div className="min-h-screen bg-[#050518] text-amber-50 font-mono selection:bg-amber-900/50">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.1)_0%,_transparent_70%)]" />
      
      {/* Header */}
      <header className="p-6 border-b border-amber-900/30 flex justify-between items-center bg-[#050518]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Cross className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-[0.2em] italic">The Nazarene</h1>
            <p className="text-[10px] text-amber-500/50 tracking-[0.4em] uppercase">Ethical Compiler Node // v1.0</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-amber-500/50 hover:text-amber-400 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0a0a2a] border border-amber-900/50 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Node Config</h2>
              <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-amber-500/50"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase text-amber-500/50 block mb-2 tracking-widest">Compiler API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-black border border-amber-900/50 rounded-lg p-3 text-xs focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded-lg transition-all">
                Synchronize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Interface */}
      <main className="max-w-3xl mx-auto p-6 md:p-12 space-y-12">
        
        {/* Input Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-amber-500/50">
            <Quote className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-widest">Enter Rhetoric for Audit</h2>
          </div>
          <div className="relative group">
            <textarea 
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Paste the claim, policy, or rhetoric here..."
              className="w-full h-48 bg-[#0a0a2a]/50 border border-amber-900/30 rounded-2xl p-6 text-sm leading-relaxed focus:border-amber-500/50 outline-none transition-all resize-none shadow-inner"
            />
            <button 
              onClick={runAudit}
              disabled={isProcessing || !claim.trim()}
              className="absolute bottom-4 right-4 px-6 py-2 bg-amber-600/20 border border-amber-600/40 hover:bg-amber-600/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2 disabled:opacity-30"
            >
              {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Test the Spirit
            </button>
          </div>
        </section>

        {/* Audit Output */}
        {auditResult && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-500/50">
                <ShieldAlert className="w-4 h-4" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-rose-500">Theological Audit Result</h2>
              </div>
              <button onClick={downloadAudit} className="text-amber-500/30 hover:text-amber-500 transition-colors">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#0a0a2a]/80 border-l-2 border-rose-900/50 p-8 rounded-r-2xl space-y-4 shadow-xl">
              <div 
                className="text-sm leading-loose text-amber-100/90"
                dangerouslySetInnerHTML={parseResult(auditResult)}
              />
            </div>
            <div className="flex justify-center pt-8">
              <div className="w-12 h-1 px-4 border-b border-amber-900/30" />
            </div>
          </section>
        )}

        {/* Default View */}
        {!auditResult && !isProcessing && (
          <div className="text-center py-12 space-y-4 opacity-30">
            <Anchor className="w-8 h-8 mx-auto text-amber-500" />
            <p className="text-[10px] uppercase tracking-[0.3em]">Auditing modern noise against the Red Letters.</p>
          </div>
        )}
      </main>

      <footer className="p-8 text-center border-t border-amber-900/10">
        <p className="text-[10px] text-amber-900/50 uppercase tracking-[0.5em] italic">"Does the policy match the parable? Run the code."</p>
      </footer>
    </div>
  );
}