"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders } from "../adminUtils";

interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
}

interface TicketMessage {
  id: number;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_name: string;
}

const STATUS_COLOR: Record<string, string> = {
  open:        "#f59e0b",
  in_progress: "#6366f1",
  resolved:    "#22c55e",
  closed:      "#6b7280",
};

const STATUS_LABEL: Record<string, string> = {
  open:        "Ouvert",
  in_progress: "En cours",
  resolved:    "Résolu",
  closed:      "Fermé",
};

const CAT_ICON: Record<string, string> = {
  support: "💬", bug: "🐛", feature: "✨", question: "❓",
};

export default function AdminTicketsPage() {
  const [tickets, setTickets]               = useState<Ticket[]>([]);
  const [selected, setSelected]             = useState<Ticket | null>(null);
  const [messages, setMessages]             = useState<TicketMessage[]>([]);
  const [reply, setReply]                   = useState("");
  const [loading, setLoading]               = useState(true);
  const [sending, setSending]               = useState(false);
  const [filterStatus, setFilterStatus]     = useState("all");
  const [search, setSearch]                 = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/tickets/admin/all`, { headers: getHeaders() });
      setTickets(res.data);
    } catch {
      console.error("Erreur chargement tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: number) => {
    try {
      const res = await axios.get(`${API}/tickets/${ticketId}/messages`, { headers: getHeaders() });
      setMessages(res.data);
    } catch {}
  };

  const selectTicket = (ticket: Ticket) => {
    setSelected(ticket);
    fetchMessages(ticket.id);
    setReply("");
  };

  // ── L'admin répond → is_admin=1 côté backend ──────────────────
  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await axios.post(
        `${API}/tickets/${selected.id}/reply`,
        { message: reply },
        { headers: getHeaders() }
      );
      setReply("");
      fetchMessages(selected.id);
      fetchTickets();
    } catch {
      alert("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (ticketId: number, status: string) => {
    try {
      await axios.patch(
        `${API}/tickets/admin/${ticketId}/status?status=${status}`,
        {},
        { headers: getHeaders() }
      );
      fetchTickets();
      if (selected?.id === ticketId) {
        setSelected(prev => prev ? { ...prev, status } : prev);
      }
    } catch {
      alert("Erreur mise à jour statut");
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const filtered = tickets.filter(t =>
    (filterStatus === "all" || t.status === filterStatus) &&
    (t.subject.toLowerCase().includes(search.toLowerCase()) ||
     (t.user_email ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {
    open:        tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    resolved:    tickets.filter(t => t.status === "resolved").length,
    closed:      tickets.filter(t => t.status === "closed").length,
  };

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .ticket-row { padding:14px 16px; border-bottom:1px solid #12151f; cursor:pointer; transition:background 0.15s; }
        .ticket-row:hover { background:rgba(91,99,245,0.05); }
        .ticket-row.sel { background:rgba(91,99,245,0.12); border-left:3px solid #5b63f5; }
        .msg-row { display:flex; flex-direction:column; max-width:78%; margin-bottom:4px; }
        .msg-row.user  { align-self:flex-end; align-items:flex-end; }
        .msg-row.admin { align-self:flex-start; align-items:flex-start; }
        .msg-bubble { padding:10px 15px; border-radius:18px; font-size:13px; line-height:1.55; word-wrap:break-word; }
        .msg-row.user  .msg-bubble { background:#1e2235; color:#a8b0d0; border-radius:18px 18px 4px 18px; }
        .msg-row.admin .msg-bubble { background:rgba(91,99,245,0.15); color:#c4c9f0; border-bottom-right-radius:4px; }
        .msg-sender { font-size:10px; color:#5a6080; margin-bottom:3px; font-family:'JetBrains Mono',monospace; }
        .msg-time   { font-size:10px; color:#3a4060; margin-top:3px; }
        .status-select { background:#0a0c14; border:1px solid #1e2235; color:#a8b0d0; padding:5px 10px; border-radius:8px; font-size:11px; cursor:pointer; font-family:'JetBrains Mono',monospace; }
        .status-select:focus { outline:none; border-color:#5b63f5; }
      `}</style>

      <div style={{ flex:1, background:"#07090f", overflowY:"auto", display:"flex", flexDirection:"column" }}>

        {/* HEADER */}
        <div style={{ padding:"24px 36px 20px", borderBottom:"1px solid #1e2235", background:"#0a0c14" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#5b63f5", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:6 }}>● SUPPORT</p>
              <h1 style={{ fontSize:22, fontWeight:800, color:"#f1f3fc", letterSpacing:"-0.02em" }}>Tickets Support</h1>
              <p style={{ fontSize:11, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>Répondez aux tickets des utilisateurs</p>
            </div>
            <button onClick={fetchTickets} style={{ padding:"9px 18px", background:"rgba(91,99,245,0.1)", border:"1px solid rgba(91,99,245,0.25)", borderRadius:10, color:"#818cf8", fontSize:11, fontFamily:"'JetBrains Mono',monospace", cursor:"pointer" }}>
              ↻ Actualiser
            </button>
          </div>

          {/* Stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:20 }}>
            {Object.entries(counts).map(([status, count]) => (
              <div key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                style={{ background:`${STATUS_COLOR[status]}10`, border:`1px solid ${STATUS_COLOR[status]}28`, borderRadius:10, padding:"12px 14px", cursor:"pointer", opacity: filterStatus !== "all" && filterStatus !== status ? 0.5 : 1, transition:"opacity 0.2s" }}>
                <div style={{ fontSize:20, fontWeight:800, color:STATUS_COLOR[status] }}>{count}</div>
                <div style={{ fontSize:10, color:"#a8b0d0", fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>{STATUS_LABEL[status]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", flex:1, overflow:"hidden" }}>

          {/* Liste */}
          <div style={{ borderRight:"1px solid #1e2235", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px", borderBottom:"1px solid #1e2235" }}>
              <input
                type="text"
                placeholder="🔍 Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width:"100%", padding:"8px 12px", background:"#0a0c14", border:"1px solid #1e2235", borderRadius:8, color:"#a8b0d0", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}
              />
            </div>
            <div style={{ overflowY:"auto", flex:1 }}>
              {loading ? (
                <div style={{ padding:24, textAlign:"center", color:"#5a6080", fontSize:12 }}>Chargement...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:24, textAlign:"center", color:"#5a6080", fontSize:12 }}>Aucun ticket</div>
              ) : filtered.map(t => (
                <div
                  key={t.id}
                  className={`ticket-row${selected?.id === t.id ? " sel" : ""}`}
                  onClick={() => selectTicket(t)}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"#f1f3fc", flex:1 }}>
                      {CAT_ICON[t.category]} {t.subject.length > 26 ? t.subject.slice(0,26)+"…" : t.subject}
                    </span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`${STATUS_COLOR[t.status]}18`, color:STATUS_COLOR[t.status], fontWeight:600, whiteSpace:"nowrap", fontFamily:"'JetBrains Mono',monospace" }}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace" }}>
                    {t.user_email ?? "Utilisateur"} · {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Détail */}
          <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {!selected ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#5a6080", gap:10 }}>
                <div style={{ fontSize:40 }}>💬</div>
                <div style={{ fontSize:13, fontWeight:600, color:"#a8b0d0" }}>Sélectionnez un ticket</div>
                <div style={{ fontSize:11 }}>pour voir et répondre à la conversation</div>
              </div>
            ) : (
              <>
                {/* Ticket head */}
                <div style={{ padding:"16px 22px", borderBottom:"1px solid #1e2235", background:"#0a0c14", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#f1f3fc", marginBottom:6 }}>
                      {CAT_ICON[selected.category]} {selected.subject}
                    </div>
                    <div style={{ fontSize:11, color:"#5a6080", fontFamily:"'JetBrains Mono',monospace" }}>
                      {selected.user_email ?? "Utilisateur"} · {new Date(selected.created_at).toLocaleString()}
                    </div>
                  </div>
                  {/* Changement de statut */}
                  <select
                    className="status-select"
                    value={selected.status}
                    onChange={e => updateStatus(selected.id, e.target.value)}
                  >
                    <option value="open">Ouvert</option>
                    <option value="in_progress">En cours</option>
                    <option value="resolved">Résolu</option>
                    <option value="closed">Fermé</option>
                  </select>
                </div>

                {/* Messages */}
                <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:12, minHeight:200, maxHeight:380 }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign:"center", color:"#5a6080", padding:24, fontSize:12 }}>Aucun message</div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={`msg-row ${msg.is_admin ? "admin" : "user"}`}>
                      <div className="msg-sender">
                        {msg.is_admin ? "🛡️ Support (vous)" : `👤 ${msg.user_name}`}
                      </div>
                      <div className="msg-bubble">{msg.message}</div>
                      <div className="msg-time">{new Date(msg.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Réponse admin */}
                {selected.status === "closed" ? (
                  <div style={{ padding:"16px 22px", borderTop:"1px solid #1e2235", textAlign:"center", color:"#5a6080", fontSize:12 }}>
                    🔒 Ticket fermé — réouvrez-le pour répondre
                  </div>
                ) : (
                  <div style={{ padding:"14px 22px", borderTop:"1px solid #1e2235", display:"flex", gap:10, background:"#0a0c14" }}>
                    <textarea
                      rows={2}
                      placeholder="Répondre en tant que Support..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      disabled={sending}
                      style={{ flex:1, padding:"10px 14px", background:"#07090f", border:"1px solid #1e2235", borderRadius:10, color:"#a8b0d0", fontSize:13, fontFamily:"'JetBrains Mono',monospace", resize:"none" }}
                      onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) sendReply(); }}
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      style={{ padding:"10px 20px", background:"rgba(91,99,245,0.15)", border:"1px solid rgba(91,99,245,0.3)", borderRadius:10, color:"#818cf8", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, cursor:"pointer", alignSelf:"flex-end" }}
                    >
                      {sending ? "…" : "↵ Envoyer"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

