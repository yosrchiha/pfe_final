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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"faq" | "tickets">("faq");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("support");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqItems, setOpenFaqItems] = useState<Record<number, boolean>>({});

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    setIsLoggedIn(true);
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/tickets/`, { headers: headers() });
      setTickets(res.data);
    } catch (error) {
      console.error("Erreur chargement tickets", error);
    }
  };

  const fetchMessages = async (ticketId: number) => {
    try {
      const res = await axios.get(`${API}/tickets/${ticketId}/messages`, { headers: headers() });
      setMessages(res.data);
    } catch (error) {
      console.error("Erreur chargement messages", error);
    }
  };

  const createTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;
    setLoading(true);
    try {
      await axios.post(
        `${API}/tickets/`,
        { subject: newTicketSubject, category: newTicketCategory, message: newTicketMessage },
        { headers: headers() }
      );
      setNewTicketSubject("");
      setNewTicketCategory("support");
      setNewTicketMessage("");
      setShowNewTicketForm(false);
      fetchTickets();
      setActiveTab("tickets");
    } catch (error) {
      console.error("Erreur création ticket", error);
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
        { headers: headers() }
      );
      setReplyMessage("");
      fetchMessages(selectedTicket.id);
      fetchTickets();
    } catch (error) {
      console.error("Erreur envoi réponse", error);
      alert("Erreur lors de l'envoi de la réponse");
    } finally {
      setLoading(false);
    }
  };

  const selectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "#f59e0b";
      case "in_progress": return "#6366f1";
      case "resolved": return "#10b981";
      case "closed": return "#94a3b8";
      default: return "#64748b";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Ouvert";
      case "in_progress": return "En cours";
      case "resolved": return "Résolu";
      case "closed": return "Fermé";
      default: return status;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "support": return "💬";
      case "bug": return "🐛";
      case "feature": return "✨";
      case "question": return "❓";
      default: return "📝";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "support": return "Support";
      case "bug": return "Bug";
      case "feature": return "Nouvelle fonctionnalité";
      case "question": return "Question";
      default: return category;
    }
  };

  const faqs = [
    { category: "Général", q: "Qu'est-ce qu'AuditPlatform ?", a: "Une plateforme intelligente d'audit de code GitLab utilisant l'IA pour analyser la qualité, la sécurité et les performances." },
    { category: "Général", q: "Comment accéder à la plateforme ?", a: "Créez un compte ou connectez-vous via GitLab OAuth. Une fois connecté, vous accédez à votre tableau de bord." },
    { category: "Général", q: "Est-ce que c'est gratuit ?", a: "Oui, la version académique est gratuite. Contactez-nous pour des besoins professionnels." },
    
    { category: "Dépôts", q: "Comment ajouter un dépôt GitLab ?", a: "Rendez-vous dans 'Dépôts' → 'Ajouter un dépôt'. Entrez le nom, l'URL, la branche et le token d'accès GitLab." },
    { category: "Dépôts", q: "Où trouver mon token GitLab ?", a: "GitLab → Settings → Access Tokens. Créez un token avec les scopes 'api', 'read_repository', 'write_repository'." },
    { category: "Dépôts", q: "Pourquoi mon dépôt ne s'affiche pas ?", a: "Vérifiez que le token est valide et que l'URL est correcte. Le système valide automatiquement le token avant ajout." },
    
    { category: "Analyse", q: "Comment lancer une analyse IA ?", a: "Depuis le tableau de bord, cliquez sur 'Nouvelle analyse' ou depuis un dépôt spécifique." },
    { category: "Analyse", q: "Que signifie le score global ?", a: "Score sur 100 combinant qualité, sécurité et performance du code." },
    { category: "Analyse", q: "Comment voir les vulnérabilités détectées ?", a: "Après analyse, cliquez sur une analyse pour voir la liste détaillée des vulnérabilités avec fichiers et lignes." },
    { category: "Analyse", q: "Combien de temps dure une analyse ?", a: "Cela dépend de la taille du dépôt, généralement entre 30 secondes et 5 minutes." },
    
    { category: "Tests", q: "Comment activer la génération automatique de tests ?", a: "Dans la configuration d'analyse, activez l'option 'Génération de tests unitaires'." },
    { category: "Tests", q: "Où sont créés les tests générés ?", a: "Les tests sont poussés dans une branche dédiée 'ai/tests/<date>' et une MR est créée automatiquement." },
    { category: "Tests", q: "Quels langages sont supportés pour les tests ?", a: "Python (pytest), JavaScript (Jest), Java (JUnit), PHP (PHPUnit), Ruby (RSpec)." },
    
    { category: "Merge Requests", q: "Quand une MR est-elle créée automatiquement ?", a: "Lorsque l'option 'Création auto MR' est activée, une MR est créée pour les tests générés." },
    { category: "Merge Requests", q: "Comment consulter les MR générées par IA ?", a: "Rendez-vous dans 'Merge Requests' et filtrez par 'Générées par IA'." },
    
    { category: "Compte", q: "Comment réinitialiser mon mot de passe ?", a: "Sur la page de connexion, cliquez sur 'Mot de passe oublié'. Un code OTP vous sera envoyé par email." },
    { category: "Compte", q: "Comment modifier mon profil ?", a: "Cliquez sur votre avatar en bas à gauche du tableau de bord → 'Modifier profil'." },
    
    { category: "Erreurs", q: "Erreur : Token GitLab invalide", a: "Vérifiez que le token est actif et possède les bons scopes. Générez un nouveau token si nécessaire." },
    { category: "Erreurs", q: "Erreur : Dépôt non trouvé", a: "Assurez-vous que l'URL du dépôt est correcte et que vous avez accès au projet." },
    { category: "Erreurs", q: "L'analyse ne se termine pas", a: "Vérifiez que le dépôt est accessible et que le token n'a pas expiré. Contactez le support si le problème persiste." },
  ];

  const filteredFaqs = searchQuery
    ? faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : faqs;

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f8fafc; }
        
        .help-container { min-height: 100vh; background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%); }
        
        .help-header {
          background: white;
          border-bottom: 1px solid #eef2ff;
          padding: 20px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .logo { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; }
        .logo-text { font-size: 16px; font-weight: 700; color: #0f172a; }
        .back-home { background: #f1f5f9; border: none; padding: 8px 20px; border-radius: 40px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; }
        .back-home:hover { background: #e2e8f0; }
        
        .help-main { max-width: 1400px; margin: 0 auto; padding: 48px 32px; }
        .help-title { text-align: center; margin-bottom: 48px; }
        .help-title h1 { font-size: 42px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .help-title p { font-size: 16px; color: #64748b; }
        
        .tabs { display: flex; justify-content: center; gap: 16px; margin-bottom: 48px; }
        .tab-btn { padding: 12px 32px; background: white; border: 1px solid #e2e8f0; border-radius: 60px; font-size: 15px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s; }
        .tab-btn:hover { border-color: #6366f1; color: #6366f1; }
        .tab-btn.active { background: #6366f1; border-color: #6366f1; color: white; }
        
        .search-bar { max-width: 500px; margin: 0 auto 48px; position: relative; }
        .search-input { width: 100%; padding: 14px 20px 14px 48px; border: 1px solid #e2e8f0; border-radius: 60px; font-size: 14px; background: white; }
        .search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
        .search-icon { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); font-size: 18px; }
        
        .faq-section { background: white; border-radius: 24px; border: 1px solid #eef2ff; overflow: hidden; max-width: 900px; margin: 0 auto; }
        .faq-item { border-bottom: 1px solid #f1f5f9; }
        .faq-question { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 500; color: #0f172a; }
        .faq-question:hover { background: #faf9fe; }
        .faq-answer { padding: 0 24px 20px 24px; color: #64748b; line-height: 1.6; font-size: 14px; }
        .faq-category { font-size: 11px; color: #6366f1; margin-bottom: 4px; }
        
        /* Tickets Layout */
        .tickets-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; background: white; border-radius: 24px; border: 1px solid #eef2ff; overflow: hidden; min-height: 600px; }
        .tickets-list { border-right: 1px solid #eef2ff; background: #fefefe; display: flex; flex-direction: column; }
        .tickets-header { padding: 20px; border-bottom: 1px solid #eef2ff; }
        .tickets-header h3 { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .new-ticket-btn { width: 100%; padding: 10px; background: #6366f1; border: none; border-radius: 12px; color: white; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .new-ticket-btn:hover { background: #8b5cf6; transform: translateY(-1px); }
        .tickets-list-scroll { flex: 1; overflow-y: auto; max-height: 500px; }
        .ticket-item { padding: 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s; }
        .ticket-item:hover { background: #f8fafc; }
        .ticket-item.active { background: #eef2ff; border-left: 3px solid #6366f1; }
        .ticket-subject { font-weight: 600; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
        .ticket-status { font-size: 10px; padding: 2px 8px; border-radius: 20px; font-weight: 500; }
        .ticket-category { font-size: 11px; color: #64748b; margin-top: 4px; }
        .ticket-date { font-size: 10px; color: #94a3b8; margin-top: 6px; }
        
        .ticket-detail { display: flex; flex-direction: column; height: 100%; }
        .ticket-detail-header { padding: 20px; border-bottom: 1px solid #eef2ff; background: white; }
        .ticket-detail-subject { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        .ticket-detail-meta { display: flex; gap: 16px; font-size: 12px; color: #64748b; flex-wrap: wrap; }
        .messages-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 400px; min-height: 300px; }
        .message { display: flex; gap: 12px; max-width: 80%; }
        .message.user { align-self: flex-end; flex-direction: row-reverse; }
        .message.admin { align-self: flex-start; }
        .message-bubble { padding: 12px 16px; border-radius: 20px; font-size: 13px; line-height: 1.5; max-width: 100%; word-wrap: break-word; }
        .message.user .message-bubble { background: #6366f1; color: white; border-radius: 20px 20px 4px 20px; }
        .message.admin .message-bubble { background: #f1f5f9; color: #1e293b; border-radius: 20px 20px 20px 4px; }
        .message-name { font-size: 10px; color: #94a3b8; margin-bottom: 4px; }
        .message-time { font-size: 10px; color: #94a3b8; margin-top: 4px; text-align: center; }
        .reply-area { padding: 20px; border-top: 1px solid #eef2ff; display: flex; gap: 12px; background: white; }
        .reply-input { flex: 1; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 24px; font-size: 13px; resize: none; font-family: inherit; }
        .reply-input:focus { outline: none; border-color: #6366f1; }
        .send-btn { padding: 10px 24px; background: #6366f1; border: none; border-radius: 24px; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .send-btn:hover { background: #8b5cf6; }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        /* Modal New Ticket */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: white; border-radius: 24px; padding: 32px; width: 500px; max-width: 90%; }
        .modal h3 { font-size: 24px; margin-bottom: 20px; color: #0f172a; }
        .modal input, .modal select, .modal textarea { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; font-family: inherit; font-size: 14px; }
        .modal textarea { min-height: 100px; resize: vertical; }
        .modal-buttons { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
        .modal-buttons button { padding: 10px 20px; border-radius: 40px; cursor: pointer; font-weight: 500; }
        .modal-cancel { background: #f1f5f9; border: none; color: #475569; }
        .modal-submit { background: #6366f1; border: none; color: white; }
        
        .empty-state { text-align: center; padding: 60px; color: #94a3b8; }
        .spinner { width: 20px; height: 20px; border: 2px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
          .tickets-layout { grid-template-columns: 1fr; }
          .tickets-list { border-right: none; border-bottom: 1px solid #eef2ff; }
          .message { max-width: 95%; }
          .help-title h1 { font-size: 28px; }
          .tabs { flex-direction: column; align-items: center; }
        }
      `}</style>

      <div className="help-container">
        <div className="help-header">
          <div className="logo" onClick={() => router.push("/dashboard")}>
            <div className="logo-icon">A</div>
            <div className="logo-text">AuditPlatform</div>
          </div>
          <button className="back-home" onClick={() => router.push("/dashboard")}>← Tableau de bord</button>
        </div>

        <div className="help-main">
          <div className="help-title">
            <h1>❓ Centre d'aide</h1>
            <p>Comment pouvons-nous vous aider ?</p>
          </div>

          <div className="tabs">
            <button className={`tab-btn ${activeTab === "faq" ? "active" : ""}`} onClick={() => setActiveTab("faq")}>
              📚 FAQ & Documentation
            </button>
            <button className={`tab-btn ${activeTab === "tickets" ? "active" : ""}`} onClick={() => setActiveTab("tickets")}>
              💬 Mes tickets ({tickets.length})
            </button>
          </div>

          {activeTab === "faq" ? (
            <>
              <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Rechercher une question..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
              <div className="faq-section">
                {filteredFaqs.length === 0 ? (
                  <div className="empty-state">Aucune question trouvée</div>
                ) : (
                  filteredFaqs.map((faq, idx) => (
                    <div key={idx} className="faq-item">
                      <div className="faq-question" onClick={() => toggleFaq(idx)}>
                        <div>
                          <div className="faq-category">📁 {faq.category}</div>
                          <div style={{ fontWeight: 500 }}>{faq.q}</div>
                        </div>
                        <span>{openFaqItems[idx] ? "−" : "+"}</span>
                      </div>
                      {openFaqItems[idx] && <div className="faq-answer">{faq.a}</div>}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="tickets-layout">
              <div className="tickets-list">
                <div className="tickets-header">
                  <h3>📋 Mes conversations</h3>
                  <button className="new-ticket-btn" onClick={() => setShowNewTicketForm(true)}>
                    ✨ Nouveau ticket
                  </button>
                </div>
                <div className="tickets-list-scroll">
                  {tickets.length === 0 ? (
                    <div className="empty-state" style={{ padding: 40 }}>
                      <div>📭 Aucun ticket</div>
                      <button className="new-ticket-btn" style={{ marginTop: 16, width: "auto", padding: "8px 24px" }} onClick={() => setShowNewTicketForm(true)}>
                        Créer un ticket
                      </button>
                    </div>
                  ) : (
                    tickets.map(ticket => (
                      <div 
                        key={ticket.id} 
                        className={`ticket-item ${selectedTicket?.id === ticket.id ? "active" : ""}`} 
                        onClick={() => selectTicket(ticket)}
                      >
                        <div className="ticket-subject">
                          <span>{getCategoryIcon(ticket.category)} {ticket.subject.length > 30 ? ticket.subject.substring(0, 30) + "..." : ticket.subject}</span>
                          <span className="ticket-status" style={{ background: `${getStatusColor(ticket.status)}15`, color: getStatusColor(ticket.status) }}>
                            {getStatusLabel(ticket.status)}
                          </span>
                        </div>
                        <div className="ticket-category">{getCategoryLabel(ticket.category)}</div>
                        <div className="ticket-date">{new Date(ticket.created_at).toLocaleDateString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="ticket-detail">
                {selectedTicket ? (
                  <>
                    <div className="ticket-detail-header">
                      <div className="ticket-detail-subject">{getCategoryIcon(selectedTicket.category)} {selectedTicket.subject}</div>
                      <div className="ticket-detail-meta">
                        <span>📁 {getCategoryLabel(selectedTicket.category)}</span>
                        <span>📌 Statut: {getStatusLabel(selectedTicket.status)}</span>
                        <span>📅 Créé le: {new Date(selectedTicket.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="messages-area">
                      {messages.length === 0 ? (
                        <div className="empty-state">Aucun message</div>
                      ) : (
                        messages.map(msg => (
                          <div key={msg.id} className={`message ${msg.is_admin ? "admin" : "user"}`}>
                            <div style={{ maxWidth: "100%" }}>
                              <div className="message-name">{msg.user_name}</div>
                              <div className="message-bubble">{msg.message}</div>
                              <div className="message-time">{new Date(msg.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                        ))
                      )}
                      {loading && (
                        <div style={{ textAlign: "center", padding: 20 }}>
                          <div className="spinner" />
                        </div>
                      )}
                    </div>
                    {selectedTicket.status !== "closed" && (
                      <div className="reply-area">
                        <textarea 
                          className="reply-input" 
                          rows={2} 
                          placeholder="Écrivez votre réponse..." 
                          value={replyMessage} 
                          onChange={(e) => setReplyMessage(e.target.value)} 
                          disabled={loading}
                        />
                        <button className="send-btn" onClick={sendReply} disabled={loading}>
                          {loading ? "..." : "Envoyer"}
                        </button>
                      </div>
                    )}
                    {selectedTicket.status === "closed" && (
                      <div className="reply-area" style={{ justifyContent: "center", color: "#94a3b8" }}>
                        Ce ticket est fermé
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    <div>💬 Sélectionnez une conversation</div>
                    <div style={{ fontSize: 12, marginTop: 8 }}>ou créez un nouveau ticket</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nouveau Ticket */}
      {showNewTicketForm && (
        <div className="modal-overlay" onClick={() => setShowNewTicketForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>✨ Nouveau ticket</h3>
            <input 
              type="text" 
              placeholder="Sujet" 
              value={newTicketSubject} 
              onChange={(e) => setNewTicketSubject(e.target.value)} 
            />
            <select value={newTicketCategory} onChange={(e) => setNewTicketCategory(e.target.value)}>
              <option value="support">💬 Support</option>
              <option value="bug">🐛 Bug</option>
              <option value="feature">✨ Nouvelle fonctionnalité</option>
              <option value="question">❓ Question</option>
            </select>
            <textarea 
              placeholder="Décrivez votre problème..." 
              value={newTicketMessage} 
              onChange={(e) => setNewTicketMessage(e.target.value)} 
            />
            <div className="modal-buttons">
              <button className="modal-cancel" onClick={() => setShowNewTicketForm(false)}>Annuler</button>
              <button className="modal-submit" onClick={createTicket} disabled={loading}>
                {loading ? "..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}