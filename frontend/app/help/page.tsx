"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { useTheme } from "@/app/ThemeContext";
import ThemeToggle from "@/app/ThemeToggle";

const API = "http://localhost:8001";

interface Ticket {
  id: number;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: number;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_name: string;
}

export default function HelpPage() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const D = {
    bg: theme.bg,
    card: theme.bgSecondary,
    border: theme.border,
    text: theme.text,
    muted: theme.textMuted,
    faint: theme.textFaint,
    tag: isDark ? "#1e2538" : "#f1f5f9",
    tagText: isDark ? "#94a3b8" : "#475569",
    btnPrimary: isDark ? "#6366f1" : "#0f172a",
    btnSec: isDark ? "#1e2538" : "#f1f5f9",
    inputBg: isDark ? "#0f1117" : "white",
    rowHover: isDark ? "#1a2030" : "#faf9fe",
    selectedBg: isDark ? "rgba(99,102,241,0.15)" : "#eef2ff",
    modalBg: isDark ? "#141921" : "white",
    userMsgBg: isDark ? "#6366f1" : "#6366f1",
    adminMsgBg: isDark ? "#1e2538" : "#f1f5f9",
    status: {
      open: { bg: isDark ? "#f59e0b20" : "#fef3c7", color: "#f59e0b", label: "Ouvert" },
      in_progress: { bg: isDark ? "#6366f120" : "#eef2ff", color: "#6366f1", label: "En cours" },
      resolved: { bg: isDark ? "#10b98120" : "#d1fae5", color: "#10b981", label: "Résolu" },
      closed: { bg: isDark ? "#6b728020" : "#f3f4f6", color: "#94a3b8", label: "Fermé" },
    },
    category: {
      support: { icon: "💬", label: "Support" },
      bug: { icon: "🐛", label: "Bug" },
      feature: { icon: "✨", label: "Fonctionnalité" },
      question: { icon: "❓", label: "Question" },
    },
  };

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("support");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchTickets();
    }
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/tickets/`, { headers: getHeaders() });
      setTickets(res.data);
    } catch {}
  };

  const fetchMessages = async (ticketId: number) => {
    try {
      const res = await axios.get(`${API}/tickets/${ticketId}/messages`, { headers: getHeaders() });
      setMessages(res.data);
    } catch {}
  };

  const createTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;
    if (!isLoggedIn) { router.push("/login"); return; }
    setLoading(true);
    try {
      await axios.post(
        `${API}/tickets/`,
        { subject: newTicketSubject, category: newTicketCategory, message: newTicketMessage },
        { headers: getHeaders() }
      );
      setNewTicketSubject("");
      setNewTicketCategory("support");
      setNewTicketMessage("");
      setShowNewTicketForm(false);
      fetchTickets();
    } catch {
      alert("Erreur lors de la création du ticket");
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setLoading(true);
    try {
      await axios.post(
        `${API}/tickets/${selectedTicket.id}/reply`,
        { message: replyMessage },
        { headers: getHeaders() }
      );
      setReplyMessage("");
      fetchMessages(selectedTicket.id);
      fetchTickets();
    } catch {
      alert("Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const selectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
  };

  const getStatus = (status: string) => {
    return D.status[status as keyof typeof D.status] || D.status.open;
  };

  const getCategory = (cat: string) => {
    return D.category[cat as keyof typeof D.category] || D.category.support;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${D.bg}; }
        ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: D.bg, fontFamily: "'Inter', sans-serif", color: D.text }}>

        {/* HEADER */}
        <div style={{ background: D.card, borderBottom: `1px solid ${D.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => router.push("/")}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "white", fontSize: 18 }}>⬡</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: D.text }}>AuditPlatform</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ThemeToggle />
            {isLoggedIn ? (
              <button onClick={() => router.push("/dashboard")} style={{ background: D.btnSec, border: "none", padding: "8px 18px", borderRadius: 40, fontSize: 13, fontWeight: 500, color: D.muted, cursor: "pointer" }}>
                ← Tableau de bord
              </button>
            ) : (
              <>
                <button onClick={() => router.push("/")} style={{ background: D.btnSec, border: "none", padding: "8px 18px", borderRadius: 40, fontSize: 13, fontWeight: 500, color: D.muted, cursor: "pointer" }}>← Accueil</button>
                <button onClick={() => router.push("/login")} style={{ background: D.btnPrimary, border: "none", padding: "8px 18px", borderRadius: 40, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Se connecter</button>
              </>
            )}
          </div>
        </div>

        {/* MAIN */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 32px" }}>
          
          {/* TITLE */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: D.text, marginBottom: 10 }}>💬 Support</h1>
            <p style={{ fontSize: 15, color: D.faint }}>Contactez notre équipe ou consultez vos tickets</p>
          </div>

          {/* TICKETS SECTION */}
          {!isLoggedIn ? (
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 20, padding: 48, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: D.text, marginBottom: 10 }}>Connexion requise</h3>
              <p style={{ color: D.faint, fontSize: 14, marginBottom: 24 }}>Connectez-vous pour créer un ticket et contacter notre support.</p>
              <button onClick={() => router.push("/login")} style={{ padding: "12px 32px", background: D.btnPrimary, border: "none", borderRadius: 30, color: "white", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
                Se connecter
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 0, background: D.card, borderRadius: 20, border: `1px solid ${D.border}`, overflow: "hidden", minHeight: 580 }}>

              {/* LEFT - Tickets List */}
              <div style={{ borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 18, borderBottom: `1px solid ${D.border}` }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: D.text, marginBottom: 10 }}>📋 Mes tickets</h3>
                  <button onClick={() => setShowNewTicketForm(true)} style={{ width: "100%", padding: 9, background: D.btnPrimary, border: "none", borderRadius: 10, color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                    ✨ Nouveau ticket
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 520 }}>
                  {tickets.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 48, color: D.faint }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                      <div style={{ fontSize: 13, marginBottom: 16 }}>Aucun ticket</div>
                      <button onClick={() => setShowNewTicketForm(true)} style={{ padding: "8px 20px", background: D.btnPrimary, border: "none", borderRadius: 20, color: "white", fontSize: 12, cursor: "pointer" }}>
                        Créer un ticket
                      </button>
                    </div>
                  ) : (
                    tickets.map(ticket => {
                      const status = getStatus(ticket.status);
                      const category = getCategory(ticket.category);
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => selectTicket(ticket)}
                          style={{
                            padding: "14px 16px",
                            borderBottom: `1px solid ${D.border}`,
                            cursor: "pointer",
                            transition: "background 0.15s",
                            background: selectedTicket?.id === ticket.id ? D.selectedBg : "transparent",
                            borderLeft: selectedTicket?.id === ticket.id ? `3px solid #6366f1` : "3px solid transparent"
                          }}
                          onMouseEnter={e => { if (selectedTicket?.id !== ticket.id) e.currentTarget.style.background = D.rowHover; }}
                          onMouseLeave={e => { if (selectedTicket?.id !== ticket.id) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: D.text, flex: 1 }}>
                              {category.icon} {ticket.subject.length > 28 ? ticket.subject.slice(0, 28) + "…" : ticket.subject}
                            </span>
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: status.bg, color: status.color }}>
                              {status.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: D.faint }}>{category.label} · {new Date(ticket.created_at).toLocaleDateString()}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT - Ticket Detail */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {!selectedTicket ? (
                  <div style={{ textAlign: "center", padding: 80, color: D.faint }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                    <div style={{ fontWeight: 600, color: D.muted }}>Sélectionnez un ticket</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>pour voir la conversation avec le support</div>
                  </div>
                ) : (
                  <>
                    {/* Ticket Header */}
                    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${D.border}` }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: D.text, marginBottom: 6 }}>
                        {getCategory(selectedTicket.category).icon} {selectedTicket.subject}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 12, color: D.faint, flexWrap: "wrap" }}>
                        <span>{getCategory(selectedTicket.category).label}</span>
                        <span style={{ color: getStatus(selectedTicket.status).color, fontWeight: 600 }}>● {getStatus(selectedTicket.status).label}</span>
                        <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14, minHeight: 280, maxHeight: 380 }}>
                      {messages.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 40, color: D.faint }}>Aucun message</div>
                      ) : (
                        messages.map(msg => (
                          <div
                            key={msg.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              maxWidth: "75%",
                              alignSelf: msg.is_admin ? "flex-start" : "flex-end",
                              alignItems: msg.is_admin ? "flex-start" : "flex-end"
                            }}
                          >
                            <div style={{ fontSize: 10, color: D.faint, marginBottom: 3 }}>
                              {msg.is_admin ? "🛡️ Support" : "👤 Vous"}
                            </div>
                            <div style={{
                              padding: "10px 15px",
                              borderRadius: 18,
                              fontSize: 13,
                              lineHeight: 1.55,
                              background: msg.is_admin ? D.adminMsgBg : D.userMsgBg,
                              color: msg.is_admin ? D.text : "white",
                             
                            }}>
                              {msg.message}
                            </div>
                            <div style={{ fontSize: 10, color: D.faint, marginTop: 3 }}>
                              {new Date(msg.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply Box */}
                    {selectedTicket.status === "closed" ? (
                      <div style={{ padding: 16, textAlign: "center", color: D.faint, fontSize: 13, borderTop: `1px solid ${D.border}` }}>
                        🔒 Ce ticket est fermé
                      </div>
                    ) : (
                      <div style={{ padding: "16px 20px", borderTop: `1px solid ${D.border}`, display: "flex", gap: 10, background: D.card }}>
                        <textarea
                          rows={2}
                          placeholder="Ajouter un message..."
                          value={replyMessage}
                          onChange={e => setReplyMessage(e.target.value)}
                          disabled={loading}
                          style={{ flex: 1, padding: "10px 14px", border: `1px solid ${D.border}`, borderRadius: 20, fontSize: 13, resize: "none", fontFamily: "inherit", background: D.inputBg, color: D.text }}
                        />
                        <button
                          onClick={sendReply}
                          disabled={loading || !replyMessage.trim()}
                          style={{ padding: "9px 22px", background: D.btnPrimary, border: "none", borderRadius: 20, color: "white", fontWeight: 600, cursor: "pointer", fontSize: 13, opacity: (loading || !replyMessage.trim()) ? 0.5 : 1 }}
                        >
                          {loading ? "…" : "Envoyer"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL - Nouveau ticket */}
      {showNewTicketForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowNewTicketForm(false)}>
          <div style={{ background: D.modalBg, borderRadius: 20, padding: 28, width: 480, maxWidth: "90%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: D.text, marginBottom: 18 }}>✨ Nouveau ticket</h3>
            <input
              type="text"
              placeholder="Sujet du ticket"
              value={newTicketSubject}
              onChange={e => setNewTicketSubject(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: `1px solid ${D.border}`, borderRadius: 10, marginBottom: 12, background: D.inputBg, color: D.text }}
            />
            <select
              value={newTicketCategory}
              onChange={e => setNewTicketCategory(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: `1px solid ${D.border}`, borderRadius: 10, marginBottom: 12, background: D.inputBg, color: D.text }}
            >
              <option value="support">💬 Support</option>
              <option value="bug">🐛 Bug</option>
              <option value="feature">✨ Nouvelle fonctionnalité</option>
              <option value="question">❓ Question</option>
            </select>
            <textarea
              placeholder="Décrivez votre problème en détail..."
              value={newTicketMessage}
              onChange={e => setNewTicketMessage(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: `1px solid ${D.border}`, borderRadius: 10, marginBottom: 12, minHeight: 90, resize: "vertical", background: D.inputBg, color: D.text }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNewTicketForm(false)} style={{ padding: "9px 20px", background: D.btnSec, border: "none", borderRadius: 30, color: D.muted, cursor: "pointer", fontWeight: 500, fontSize: 13 }}>Annuler</button>
              <button
                onClick={createTicket}
                disabled={loading || !newTicketSubject.trim() || !newTicketMessage.trim()}
                style={{ padding: "9px 20px", background: D.btnPrimary, border: "none", borderRadius: 30, color: "white", cursor: "pointer", fontWeight: 600, fontSize: 13, opacity: (loading || !newTicketSubject.trim() || !newTicketMessage.trim()) ? 0.5 : 1 }}
              >
                {loading ? "…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
