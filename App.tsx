import { useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Menu, Plus, Search, Paperclip, Mic, Send, SquarePen, Sparkles, Globe, Image, PenLine, LogOut, Settings, Crown, X, MessageSquare, PanelLeftClose } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase: SupabaseClient | null = supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

type Chat = { id: string; title: string; updated_at: string };
type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login"|"signup">("login");
  const [authError, setAuthError] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  const [usage, setUsage] = useState<{used:number; remaining:number; bonus:number}|null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) { loadChats(); loadUsage(); } else { setChats([]); setMessages([]); setActiveId(""); } }, [session]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, busy]);

  async function loadChats() {
    if (!supabase) return;
    const {data,error} = await supabase.from("conversations").select("id,title,updated_at").order("updated_at",{ascending:false});
    if (!error && data) setChats(data as Chat[]);
  }
  async function loadUsage() {
    if (!supabase) return;
    const {data} = await supabase.from("daily_usage").select("used,bonus").maybeSingle();
    if (data) setUsage({used:data.used,bonus:data.bonus,remaining:Math.max(0,10-data.used)+data.bonus});
    else setUsage({used:0,bonus:0,remaining:10});
  }
  async function openChat(id:string) {
    if (!supabase) return;
    setActiveId(id);
    const {data} = await supabase.from("messages").select("id,role,content").eq("conversation_id",id).order("created_at");
    setMessages((data||[]) as Msg[]);
  }
  async function newChat() { setActiveId(""); setMessages([]); setInput(""); }
  async function authenticate(e:React.FormEvent) {
    e.preventDefault(); setAuthError("");
    if (!supabase) { setAuthError("Weka VITE_SUPABASE_URL na VITE_SUPABASE_ANON_KEY kwenye mazingira ya project."); return; }
    const result = authMode==="signup"
      ? await supabase.auth.signUp({email,password})
      : await supabase.auth.signInWithPassword({email,password});
    if (result.error) setAuthError(result.error.message);
    else if (authMode==="signup" && !result.data.session) setAuthError("Angalia email yako kuthibitisha akaunti.");
  }
  async function sendMessage(textOverride?:string) {
    const content=(textOverride ?? input).trim();
    if (!content || busy || !supabase || !session) return;
    setInput(""); setBusy(true);
    let conversationId=activeId;
    try {
      if (!conversationId) {
        const title=content.slice(0,55);
        const {data,error}=await supabase.from("conversations").insert({user_id:session.user.id,title}).select("id").single();
        if (error) throw error;
        conversationId=data.id; setActiveId(conversationId);
      }
      const {data:userMsg,error:userErr}=await supabase.from("messages").insert({conversation_id:conversationId,user_id:session.user.id,role:"user",content}).select("id,role,content").single();
      if (userErr) throw userErr;
      setMessages(prev=>[...prev,userMsg as Msg]);
      const {data,error}=await supabase.functions.invoke("chat",{body:{conversationId,webSearch}});
      if (error) {
        const body=(error as any).context;
        let detail=error.message;
        try { const parsed=await body?.json(); detail=parsed?.error||detail; } catch {}
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      setMessages(prev=>[...prev,{id:crypto.randomUUID(),role:"assistant",content:data.reply}]);
      await loadChats(); await loadUsage();
    } catch(err:any) {
      setMessages(prev=>[...prev,{id:crypto.randomUUID(),role:"assistant",content:`Samahani, hitilafu imetokea: ${err.message||"Jaribu tena."}`}]);
      await loadUsage();
    } finally { setBusy(false); }
  }
  async function uploadFile(file?:File) {
    if (!file) return;
    if (file.size>8*1024*1024) { setNotice("Faili ni kubwa. Tumia faili lisilozidi 8 MB."); return; }
    setNotice(`Faili limechaguliwa: ${file.name}. Kwa sasa nakili maandishi yake kwenye ujumbe ili AI iyachambue.`);
  }
  async function logout() { await supabase?.auth.signOut(); }
  const isAdmin = !!session?.user?.email && (import.meta.env.VITE_ADMIN_EMAILS||"").toLowerCase().split(",").includes(session.user.email.toLowerCase());

  if (!supabase) return <div className="setup"><Sparkles size={32}/><h1>PROD LAYZA AI</h1><p>Weka Supabase URL na anon key kwenye environment variables za project, kisha refresh.</p><code>VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY</code><small>Usiweke DeepSeek au Linkup secret hapa.</small></div>;
  if (!session) return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Sparkles/></div><h1>PROD LAYZA AI</h1><p>Karibu. Ingia ili uanze mazungumzo.</p><form onSubmit={authenticate}><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/><button className="primary full">{authMode==="login"?"Log in":"Create account"}</button></form>{authError&&<p className="error">{authError}</p>}<button className="link" onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}>{authMode==="login"?"Huna akaunti? Jisajili":"Una akaunti? Ingia"}</button></div></main>;

  return <div className="app-shell">
    {sidebar&&<aside className="sidebar">
      <div className="side-head"><div className="mini-brand"><Sparkles size={19}/><b>PROD LAYZA</b></div><button className="icon-btn" onClick={()=>setSidebar(false)} title="Funga menu"><PanelLeftClose/></button></div>
      <button className="new-chat" onClick={newChat}><SquarePen size={17}/> New chat</button>
      <button className="side-action" onClick={()=>setNotice("Tafuta mazungumzo kwa kutumia orodha ya historia hapa chini.")}><Search size={17}/> Search chats</button>
      <div className="history-label">Your chats</div>
      <div className="chat-list">{chats.map(c=><button key={c.id} className={`chat-item ${activeId===c.id?"selected":""}`} onClick={()=>openChat(c.id)}><MessageSquare size={15}/><span>{c.title||"New chat"}</span></button>)}</div>
      <div className="side-bottom">
        {isAdmin&&<button className="side-action" onClick={()=>setAdminOpen(true)}><Settings size={17}/> Admin panel</button>}
        <div className="user-row"><div className="avatar">{session.user.email?.[0]?.toUpperCase()}</div><span>{session.user.email}</span><button className="icon-btn" onClick={logout} title="Log out"><LogOut size={17}/></button></div>
      </div>
    </aside>}
    <section className="main-area">
      <header className="topbar">
        <div className="top-left">{!sidebar&&<button className="icon-btn" onClick={()=>setSidebar(true)}><Menu/></button>}<span className="mobile-brand">PROD LAYZA AI</span></div>
        <div className="top-right"><span className="usage">{usage?`${usage.remaining} messages left`:""}</span><button className="premium-btn" onClick={()=>setPremiumOpen(true)}><Crown size={16}/> Get Premium</button><button className="icon-btn desktop-new" onClick={newChat} title="New chat"><Plus/></button></div>
      </header>
      <div className="conversation">
        {messages.length===0?<div className="welcome"><div className="welcome-icon"><Sparkles size={28}/></div><h1>What can I help with?</h1><p>Uliza swali lolote. PROD LAYZA AI iko tayari kukusaidia.</p><div className="suggestions">
          <button onClick={()=>sendMessage("Nisaidie kuelewa sayansi ya anga na sayari.")}><Sparkles/><b>Learn something</b><span>Explore science and technology</span></button>
          <button onClick={()=>sendMessage("Nisaidie kuandika ujumbe mzuri.")}><PenLine/><b>Write or edit</b><span>Create or improve text</span></button>
          <button onClick={()=>{setWebSearch(true);setNotice("Web search imewashwa. Andika swali lako.")}}><Globe/><b>Search the web</b><span>Find current information</span></button>
          <button onClick={()=>sendMessage("Nipe mawazo ya kutengeneza picha ya ubunifu.")}><Image/><b>Create an image</b><span>Prepare an image prompt</span></button>
        </div></div>:<div className="messages">{messages.map(m=><div className={`message ${m.role}`} key={m.id}><div className="message-avatar">{m.role==="assistant"?<Sparkles size={17}/>:session.user.email?.[0]?.toUpperCase()}</div><div className="message-content">{m.content}</div></div>)}{busy&&<div className="message assistant"><div className="message-avatar"><Sparkles size={17}/></div><div className="typing">Thinking<span>.</span><span>.</span><span>.</span></div></div>}<div ref={bottomRef}/></div>}
      </div>
      <div className="composer-wrap"><div className="composer">
        <input ref={fileRef} type="file" hidden onChange={e=>uploadFile(e.target.files?.[0])}/>
        <button className="composer-icon" onClick={()=>fileRef.current?.click()} title="Attach file"><Plus/></button>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Message PROD LAYZA AI..." rows={1}/>
        <button className={`tool-toggle ${webSearch?"active":""}`} onClick={()=>setWebSearch(!webSearch)} title="Web search"><Globe size={17}/><span>Search</span></button>
        <button className="composer-icon mic" onClick={()=>setNotice("Voice input inategemea ruhusa ya browser na microphone.")} title="Voice"><Mic/></button>
        <button className="send-btn" onClick={()=>sendMessage()} disabled={!input.trim()||busy}><Send size={17}/></button>
      </div><div className="disclaimer">PROD LAYZA AI inaweza kufanya makosa. Hakiki taarifa muhimu.</div></div>
    </section>
    {premiumOpen&&<div className="modal-backdrop" onClick={()=>setPremiumOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setPremiumOpen(false)}><X/></button><Crown size={30}/><h2>Get Premium</h2><p>Premium is coming soon. Hakuna malipo yatakayochukuliwa kwa sasa.</p><button className="primary full" onClick={()=>setPremiumOpen(false)}>Okay</button></div></div>}
    {adminOpen&&<div className="modal-backdrop" onClick={()=>setAdminOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setAdminOpen(false)}><X/></button><Settings size={28}/><h2>Admin Panel</h2><p>API keys na mipangilio ya AI husimamiwa kupitia Supabase Edge Function secrets. Hazionyeshwi kwenye browser.</p><code>DEEPSEEK_API_KEY<br/>LINKUP_API_KEY<br/>ADMIN_EMAILS</code><button className="primary full" onClick={()=>setAdminOpen(false)}>Close</button></div></div>}
    {notice&&<div className="toast" onClick={()=>setNotice("")}>{notice}<button><X size={14}/></button></div>}
  </div>;
}