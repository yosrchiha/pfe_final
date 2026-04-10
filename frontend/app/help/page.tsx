"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

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

  const [isLoggedIn, setIsLoggedIn]             = useState(false);
  const [activeTab, setActiveTab]               = useState<"faq" | "tickets">("faq");
  const [tickets, setTickets]                   = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket]     = useState<Ticket | null>(null);
  const [messages, setMessages]                 = useState<TicketMessage[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("support");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [replyMessage, setReplyMessage]         = useState("");
  const [loading, setLoading]                   = useState(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [searchQuery, setSearchQuery]           = useState("");
  const [openFaqItems, setOpenFaqItems]         = useState<Record<number, boolean>>({});

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
    // Pas de redirect — la page est accessible sans login
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

  // ── L'user envoie un message dans son propre ticket ──────────────
  // Seul l'admin peut répondre côté backend (is_admin=1)
  // Ici c'est le user qui répond à son propre ticket (is_admin=0)
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

  const toggleFaq = (idx: number) =>
    setOpenFaqItems(prev => ({ ...prev, [idx]: !prev[idx] }));

  const getStatusColor = (s: string) =>
    ({ open: "#f59e0b", in_progress: "#6366f1", resolved: "#10b981", closed: "#94a3b8" }[s] ?? "#64748b");

  const getStatusLabel = (s: string) =>
    ({ open: "Ouvert", in_progress: "En cours", resolved: "Résolu", closed: "Fermé" }[s] ?? s);

  const getCategoryIcon = (c: string) =>
    ({ support: "💬", bug: "🐛", feature: "✨", question: "❓" }[c] ?? "📝");

  const getCategoryLabel = (c: string) =>
    ({ support: "Support", bug: "Bug", feature: "Fonctionnalité", question: "Question" }[c] ?? c);

  const faqs = [
    { category: "Général",         q: "Qu'est-ce qu'AuditPlatform ?",               a: "Une plateforme d'audit de code GitLab utilisant l'IA pour analyser qualité, sécurité et performances." },
    { category: "Général",         q: "Comment accéder à la plateforme ?",           a: "Créez un compte ou connectez-vous via GitLab OAuth. Vous accédez ensuite à votre tableau de bord." },
    { category: "Dépôts",          q: "Comment ajouter un dépôt GitLab ?",           a: "Rendez-vous dans 'Dépôts' → 'Ajouter un dépôt'. Entrez le nom, l'URL, la branche et le token d'accès GitLab." },
    { category: "Dépôts",          q: "Où trouver mon token GitLab ?",               a: "GitLab → Settings → Access Tokens. Créez un token avec les scopes 'api', 'read_repository', 'write_repository'." },
    { category: "Analyse",         q: "Comment lancer une analyse IA ?",             a: "Depuis le tableau de bord, cliquez sur 'Nouvelle analyse' ou depuis un dépôt spécifique." },
    { category: "Analyse",         q: "Que signifie le score global ?",              a: "Score sur 100 combinant qualité, sécurité et performance du code analysé." },
    { category: "Tests",           q: "Quels langages sont supportés ?",             a: "Python (pytest), JavaScript (Jest), Java (JUnit), PHP (PHPUnit), Ruby (RSpec)." },
    { category: "Merge Requests",  q: "Quand une MR est-elle créée automatiquement ?", a: "Lorsque l'option 'Création auto MR' est activée lors d'une analyse." },
    { category: "Compte",          q: "Comment réinitialiser mon mot de passe ?",    a: "Sur la page de connexion, cliquez sur 'Mot de passe oublié'. Un code OTP vous sera envoyé." },
    { category: "Erreurs",         q: "Erreur : Token GitLab invalide",              a: "Vérifiez que le token est actif et possède les bons scopes. Générez un nouveau token si nécessaire." },
    { category: "Erreurs",         q: "L'analyse ne se termine pas",                 a: "Vérifiez que le dépôt est accessible et que le token n'a pas expiré. Contactez le support si besoin." },
  ];

  const filteredFaqs = searchQuery
    ? faqs.filter(f =>
        f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Inter',sans-serif; background:#f8fafc; }
        .help-container { min-height:100vh; background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%); }
        .help-header { background:white; border-bottom:1px solid #eef2ff; padding:16px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; }
        .logo { display:flex; align-items:center; gap:12px; cursor:pointer; }
        .logo-icon { width:36px; height:36px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:700; color:white; font-size:18px; }
        .logo-text { font-size:16px; font-weight:700; color:#0f172a; }
        .header-actions { display:flex; gap:10px; align-items:center; }
        .btn-back { background:#f1f5f9; border:none; padding:8px 18px; border-radius:40px; font-size:13px; font-weight:500; color:#475569; cursor:pointer; }
        .btn-back:hover { background:#e2e8f0; }
        .btn-login { background:#6366f1; border:none; padding:8px 18px; border-radius:40px; font-size:13px; font-weight:600; color:white; cursor:pointer; }
        .btn-login:hover { background:#4f46e5; }
        .help-main { max-width:1200px; margin:0 auto; padding:48px 32px; }
        .help-title { text-align:center; margin-bottom:40px; }
        .help-title h1 { font-size:36px; font-weight:700; color:#0f172a; margin-bottom:10px; }
        .help-title p { font-size:15px; color:#64748b; }
        .tabs { display:flex; justify-content:center; gap:12px; margin-bottom:40px; }
        .tab-btn { padding:10px 28px; background:white; border:1px solid #e2e8f0; border-radius:60px; font-size:14px; font-weight:600; color:#475569; cursor:pointer; transition:all 0.2s; }
        .tab-btn:hover { border-color:#6366f1; color:#6366f1; }
        .tab-btn.active { background:#6366f1; border-color:#6366f1; color:white; }
        .search-bar { max-width:480px; margin:0 auto 36px; position:relative; }
        .search-input { width:100%; padding:13px 20px 13px 46px; border:1px solid #e2e8f0; border-radius:60px; font-size:14px; background:white; }
        .search-input:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .search-icon { position:absolute; left:17px; top:50%; transform:translateY(-50%); font-size:17px; }
        .faq-section { background:white; border-radius:20px; border:1px solid #eef2ff; overflow:hidden; max-width:860px; margin:0 auto; }
        .faq-item { border-bottom:1px solid #f1f5f9; }
        .faq-question { padding:18px 22px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:500; color:#0f172a; }
        .faq-question:hover { background:#faf9fe; }
        .faq-answer { padding:0 22px 18px; color:#64748b; line-height:1.7; font-size:14px; }
        .faq-category-label { font-size:10px; color:#6366f1; font-weight:600; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.05em; }
        .tickets-layout { display:grid; grid-template-columns:300px 1fr; gap:0; background:white; border-radius:20px; border:1px solid #eef2ff; overflow:hidden; min-height:580px; }
        .tickets-list { border-right:1px solid #eef2ff; display:flex; flex-direction:column; }
        .tickets-list-header { padding:18px; border-bottom:1px solid #eef2ff; }
        .tickets-list-header h3 { font-size:15px; font-weight:600; color:#0f172a; margin-bottom:10px; }
        .new-ticket-btn { width:100%; padding:9px; background:#6366f1; border:none; border-radius:10px; color:white; font-weight:600; cursor:pointer; font-size:13px; transition:all 0.2s; }
        .new-ticket-btn:hover { background:#4f46e5; }
        .tickets-scroll { flex:1; overflow-y:auto; max-height:520px; }
        .ticket-item { padding:14px 16px; border-bottom:1px solid #f8fafc; cursor:pointer; transition:background 0.15s; }
        .ticket-item:hover { background:#f8fafc; }
        .ticket-item.selected { background:#eef2ff; border-left:3px solid #6366f1; }
        .ticket-subject-row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:5px; }
        .ticket-subject-text { font-size:13px; font-weight:600; color:#0f172a; flex:1; }
        .status-pill { font-size:10px; padding:2px 8px; border-radius:20px; font-weight:600; white-space:nowrap; }
        .ticket-meta { font-size:11px; color:#94a3b8; margin-top:4px; }
        .ticket-detail { display:flex; flex-direction:column; }
        .ticket-detail-head { padding:18px 22px; border-bottom:1px solid #eef2ff; }
        .ticket-detail-subject { font-size:17px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .ticket-detail-meta { display:flex; gap:14px; font-size:12px; color:#64748b; flex-wrap:wrap; }
        .messages-area { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:14px; min-height:280px; max-height:380px; }
        .msg-row { display:flex; flex-direction:column; max-width:75%; }
        .msg-row.user  { align-self:flex-end; align-items:flex-end; }
        .msg-row.admin { align-self:flex-start; align-items:flex-start; }
        .msg-sender { font-size:10px; color:#94a3b8; margin-bottom:3px; }
        .msg-bubble { padding:10px 15px; border-radius:18px; font-size:13px; line-height:1.55; word-wrap:break-word; }
        .msg-row.user  .msg-bubble { background:#6366f1; color:white; border-radius:18px 18px 4px 18px; }
        .msg-row.admin .msg-bubble { background:#f1f5f9; color:#1e293b; border-radius:18px 18px 18px 4px; }
        .msg-time { font-size:10px; color:#94a3b8; margin-top:3px; }
        .reply-box { padding:16px 20px; border-top:1px solid #eef2ff; display:flex; gap:10px; background:white; }
        .reply-input { flex:1; padding:10px 14px; border:1px solid #e2e8f0; border-radius:20px; font-size:13px; resize:none; font-family:inherit; }
        .reply-input:focus { outline:none; border-color:#6366f1; }
        .send-btn { padding:9px 22px; background:#6366f1; border:none; border-radius:20px; color:white; font-weight:600; cursor:pointer; font-size:13px; }
        .send-btn:hover { background:#4f46e5; }
        .send-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .closed-notice { padding:16px; text-align:center; color:#94a3b8; font-size:13px; border-top:1px solid #eef2ff; }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:48px; color:#94a3b8; gap:12px; text-align:center; }
        .empty-state-icon { font-size:40px; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal { background:white; border-radius:20px; padding:28px; width:480px; max-width:90%; }
        .modal h3 { font-size:20px; font-weight:700; color:#0f172a; margin-bottom:18px; }
        .modal input, .modal select, .modal textarea { width:100%; padding:11px 14px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:12px; font-family:inherit; font-size:13px; }
        .modal input:focus, .modal select:focus, .modal textarea:focus { outline:none; border-color:#6366f1; }
        .modal textarea { min-height:90px; resize:vertical; }
        .modal-footer { display:flex; gap:10px; justify-content:flex-end; }
        .btn-cancel { padding:9px 20px; background:#f1f5f9; border:none; border-radius:30px; color:#475569; cursor:pointer; font-weight:500; font-size:13px; }
        .btn-submit { padding:9px 20px; background:#6366f1; border:none; border-radius:30px; color:white; cursor:pointer; font-weight:600; font-size:13px; }
        .login-prompt { background:white; border:1px solid #eef2ff; border-radius:20px; padding:48px; text-align:center; max-width:480px; margin:0 auto; }
        .login-prompt h3 { font-size:20px; font-weight:700; color:#0f172a; margin-bottom:10px; }
        .login-prompt p { color:#64748b; font-size:14px; margin-bottom:24px; }
        .btn-login-large { padding:12px 32px; background:#6366f1; border:none; border-radius:30px; color:white; font-weight:600; font-size:15px; cursor:pointer; }
        .btn-login-large:hover { background:#4f46e5; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width:768px) {
          .tickets-layout { grid-template-columns:1fr; }
          .help-title h1 { font-size:26px; }
        }
      `}</style>

      <div className="help-container">

        {/* HEADER */}
        <div className="help-header">
          <div className="logo" onClick={() => router.push("/")}>
            <div className="logo-icon">⬡</div>
            <div className="logo-text">AuditPlatform</div>
          </div>
          <div className="header-actions">
            {isLoggedIn ? (
              <button className="btn-back" onClick={() => router.push("/dashboard")}>
                ← Tableau de bord
              </button>
            ) : (
              <>
                <button className="btn-back" onClick={() => router.push("/")}>← Accueil</button>
                <button className="btn-login" onClick={() => router.push("/login")}>Se connecter</button>
              </>
            )}
          </div>
        </div>

        {/* MAIN */}
        <div className="help-main">

          <div className="help-title">
            <h1>❓ Centre d'aide</h1>
            <p>Consultez la FAQ ou contactez notre support</p>
          </div>

          {/* TABS */}
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === "faq" ? "active" : ""}`}
              onClick={() => setActiveTab("faq")}
            >
              📚 FAQ
            </button>
            <button
              className={`tab-btn ${activeTab === "tickets" ? "active" : ""}`}
              onClick={() => setActiveTab("tickets")}
            >
              💬 Tickets {isLoggedIn && tickets.length > 0 && `(${tickets.length})`}
            </button>
          </div>

          {/* ── FAQ ─────────────────────────────────────────────── */}
          {activeTab === "faq" && (
            <>
              <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Rechercher dans la FAQ..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="faq-section">
                {filteredFaqs.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-icon">🔍</div><div>Aucun résultat</div></div>
                ) : filteredFaqs.map((faq, idx) => (
                  <div key={idx} className="faq-item">
                    <div className="faq-question" onClick={() => toggleFaq(idx)}>
                      <div>
                        <div className="faq-category-label">{faq.category}</div>
                        <div>{faq.q}</div>
                      </div>
                      <span style={{ fontSize: 20, color: "#6366f1", flexShrink: 0, marginLeft: 12 }}>
                        {openFaqItems[idx] ? "−" : "+"}
                      </span>
                    </div>
                    {openFaqItems[idx] && <div className="faq-answer">{faq.a}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── TICKETS ─────────────────────────────────────────── */}
          {activeTab === "tickets" && (
            <>
              {/* Pas connecté → invite à se connecter */}
              {!isLoggedIn ? (
                <div className="login-prompt">
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                  <h3>Connexion requise</h3>
                  <p>Connectez-vous pour créer un ticket et contacter notre support.</p>
                  <button className="btn-login-large" onClick={() => router.push("/login")}>
                    Se connecter
                  </button>
                </div>
              ) : (
                <div className="tickets-layout">

                  {/* Liste des tickets */}
                  <div className="tickets-list">
                    <div className="tickets-list-header">
                      <h3>📋 Mes tickets</h3>
                      <button className="new-ticket-btn" onClick={() => setShowNewTicketForm(true)}>
                        ✨ Nouveau ticket
                      </button>
                    </div>
                    <div className="tickets-scroll">
                      {tickets.length === 0 ? (
                        <div className="empty-state" style={{ padding: 32 }}>
                          <div className="empty-state-icon">📭</div>
                          <div style={{ fontSize: 13 }}>Aucun ticket</div>
                          <button className="new-ticket-btn" style={{ width: "auto", padding: "8px 20px" }}
                            onClick={() => setShowNewTicketForm(true)}>
                            Créer un ticket
                          </button>
                        </div>
                      ) : tickets.map(ticket => (
                        <div
                          key={ticket.id}
                          className={`ticket-item ${selectedTicket?.id === ticket.id ? "selected" : ""}`}
                          onClick={() => selectTicket(ticket)}
                        >
                          <div className="ticket-subject-row">
                            <span className="ticket-subject-text">
                              {getCategoryIcon(ticket.category)} {ticket.subject.length > 28 ? ticket.subject.slice(0, 28) + "…" : ticket.subject}
                            </span>
                            <span
                              className="status-pill"
                              style={{ background: `${getStatusColor(ticket.status)}18`, color: getStatusColor(ticket.status) }}
                            >
                              {getStatusLabel(ticket.status)}
                            </span>
                          </div>
                          <div className="ticket-meta">{getCategoryLabel(ticket.category)} · {new Date(ticket.created_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Détail du ticket sélectionné */}
                  <div className="ticket-detail">
                    {!selectedTicket ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">💬</div>
                        <div style={{ fontWeight: 600, color: "#475569" }}>Sélectionnez un ticket</div>
                        <div style={{ fontSize: 12 }}>pour voir la conversation avec le support</div>
                      </div>
                    ) : (
                      <>
                        <div className="ticket-detail-head">
                          <div className="ticket-detail-subject">
                            {getCategoryIcon(selectedTicket.category)} {selectedTicket.subject}
                          </div>
                          <div className="ticket-detail-meta">
                            <span>{getCategoryLabel(selectedTicket.category)}</span>
                            <span
                              style={{ color: getStatusColor(selectedTicket.status), fontWeight: 600 }}
                            >
                              ● {getStatusLabel(selectedTicket.status)}
                            </span>
                            <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Messages */}
                        <div className="messages-area">
                          {messages.length === 0 ? (
                            <div className="empty-state"><div>Aucun message</div></div>
                          ) : messages.map(msg => (
                            <div
                              key={msg.id}
                              className={`msg-row ${msg.is_admin ? "admin" : "user"}`}
                            >
                              <div className="msg-sender">
                                {msg.is_admin ? "🛡️ Support" : "👤 Vous"}
                              </div>
                              <div className="msg-bubble">{msg.message}</div>
                              <div className="msg-time">
                                {new Date(msg.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Zone de réponse — seulement si ticket pas fermé */}
                        {selectedTicket.status === "closed" ? (
                          <div className="closed-notice">🔒 Ce ticket est fermé</div>
                        ) : (
                          <div className="reply-box">
                            <textarea
                              className="reply-input"
                              rows={2}
                              placeholder="Ajouter un message..."
                              value={replyMessage}
                              onChange={e => setReplyMessage(e.target.value)}
                              disabled={loading}
                            />
                            <button className="send-btn" onClick={sendReply} disabled={loading || !replyMessage.trim()}>
                              {loading ? "…" : "Envoyer"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL — Nouveau ticket */}
      {showNewTicketForm && (
        <div className="modal-overlay" onClick={() => setShowNewTicketForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>✨ Nouveau ticket</h3>
            <input
              type="text"
              placeholder="Sujet du ticket"
              value={newTicketSubject}
              onChange={e => setNewTicketSubject(e.target.value)}
            />
            <select value={newTicketCategory} onChange={e => setNewTicketCategory(e.target.value)}>
              <option value="support">💬 Support</option>
              <option value="bug">🐛 Bug</option>
              <option value="feature">✨ Nouvelle fonctionnalité</option>
              <option value="question">❓ Question</option>
            </select>
            <textarea
              placeholder="Décrivez votre problème en détail..."
              value={newTicketMessage}
              onChange={e => setNewTicketMessage(e.target.value)}
            />
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowNewTicketForm(false)}>Annuler</button>
              <button
                className="btn-submit"
                onClick={createTicket}
                disabled={loading || !newTicketSubject.trim() || !newTicketMessage.trim()}
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