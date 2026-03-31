// frontend/app/profile/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [depotsCount, setDepotsCount] = useState<number>(0);
  const [analysesCount, setAnalysesCount] = useState<number>(0);
  const [issuesCount, setIssuesCount] = useState<number>(0);
  const [mrCount, setMrCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", email: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const router = useRouter();

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        // 1. Profil utilisateur
        const res = await axios.get(`${API}/auth/me`, { headers: getHeaders() });
        const userData = res.data;
        setUser(userData);
        setEditForm({ username: userData.username ?? "", email: userData.email ?? "" });

        // 2. Nombre de dépôts
        const userId = userData.id;
        localStorage.setItem("user_id", String(userId));
        
        try {
          const depotsRes = await axios.get(`${API}/analyses/depots-user/${userId}`, { headers: getHeaders() });
          setDepotsCount(depotsRes.data.length);
        } catch {
          setDepotsCount(0);
        }

        // 3. Nombre d'analyses
        try {
          const analysesRes = await axios.get(`${API}/analyses/depot/${userId}`, { headers: getHeaders() });
          setAnalysesCount(analysesRes.data.length);
        } catch {
          setAnalysesCount(0);
        }

        // 4. Nombre d'issues
        try {
          const issuesRes = await axios.get(`${API}/issues/`, { headers: getHeaders() });
          setIssuesCount(issuesRes.data.length);
        } catch {
          setIssuesCount(0);
        }

        // 5. Nombre de MR
        try {
          const mrRes = await axios.get(`${API}/merge-requests/`, { headers: getHeaders() });
          setMrCount(mrRes.data.length);
        } catch {
          setMrCount(0);
        }

      } catch (err: any) {
        console.error("Erreur récupération user:", err);
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user_id");
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    router.push("/login");
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError(null);
    setEditSuccess(false);
    try {
      const res = await axios.put(
        `${API}/auth/update`,
        { username: editForm.username, email: editForm.email },
        { headers: getHeaders() }
      );
      setUser((prev: any) => ({ ...prev, ...res.data }));
      setEditSuccess(true);
      setTimeout(() => { setEditOpen(false); setEditSuccess(false); }, 1200);
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || "Erreur lors de la mise à jour");
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Récemment";
    return new Date(dateStr).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
        }

        /* Topbar */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          background: white;
          border-bottom: 1px solid #eef2ff;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .back-btn {
          background: #f1f5f9;
          border: none;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .back-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .title-section h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0 0 4px 0;
        }
        .title-section p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }
        .topbar-actions {
          display: flex;
          gap: 12px;
        }
        .btn-secondary {
          background: #f1f5f9;
          border: none;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #475569;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .btn-danger {
          background: #fef2f2;
          border: none;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #ef4444;
          transition: all 0.2s;
        }
        .btn-danger:hover {
          background: #fee2e2;
        }

        /* Layout */
        .layout {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px;
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 32px;
        }

        /* Cards */
        .card {
          background: white;
          border: 1px solid #eef2ff;
          border-radius: 24px;
          padding: 28px;
        }

        /* Profile Card */
        .profile-card {
          text-align: center;
        }
        .avatar {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 36px;
          font-weight: 700;
          color: white;
          box-shadow: 0 8px 20px rgba(99,102,241,0.2);
        }
        .profile-name {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }
        .profile-role {
          display: inline-block;
          background: #eef2ff;
          color: #6366f1;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 30px;
          margin-bottom: 20px;
        }
        .divider {
          height: 1px;
          background: #f1f5f9;
          margin: 20px 0;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin: 20px 0;
        }
        .stat-item {
          text-align: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 16px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
        }
        .stat-label {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }
        .profile-date {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        /* Info Card */
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f1f5f9;
        }
        .info-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 16px;
        }
        .info-icon {
          font-size: 20px;
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .info-content {
          flex: 1;
        }
        .info-label {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          font-family: monospace;
        }
        .info-badge {
          font-size: 10px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .badge-verified {
          background: #eef2ff;
          color: #6366f1;
        }
        .badge-active {
          background: #ecfdf5;
          color: #10b981;
        }
        .badge-gitlab {
          background: #fef3c7;
          color: #f59e0b;
        }

        /* Activity List */
        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 16px;
        }
        .activity-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .activity-text {
          flex: 1;
          font-size: 13px;
          color: #475569;
        }
        .activity-text strong {
          color: #0f172a;
        }
        .activity-time {
          font-size: 10px;
          color: #94a3b8;
          font-family: monospace;
        }

        /* Stats Grid supplémentaires */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: #f8fafc;
          border-radius: 20px;
          padding: 16px;
          text-align: center;
        }
        .stat-card-value {
          font-size: 28px;
          font-weight: 700;
        }
        .stat-card-label {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }
        .modal {
          background: white;
          border-radius: 24px;
          max-width: 480px;
          width: 100%;
          padding: 28px;
          box-shadow: 0 20px 35px -12px rgba(0,0,0,0.2);
        }
        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .modal-sub {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 24px;
        }
        .modal-field {
          margin-bottom: 20px;
        }
        .modal-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }
        .modal-input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.2s;
        }
        .modal-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .modal-error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          color: #ef4444;
          margin-bottom: 20px;
        }
        .modal-success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          color: #10b981;
          margin-bottom: 20px;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
        }
        .modal-cancel {
          flex: 1;
          padding: 10px;
          background: #f1f5f9;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .modal-confirm {
          flex: 2;
          padding: 10px;
          background: #0f172a;
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .modal-confirm:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #e2e8f0;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 12px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; padding: 20px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Chargement du profil...
        </div>
      ) : !user ? (
        <div className="loading">
          Impossible de charger le profil
          <button className="back-btn" style={{ marginLeft: 16 }} onClick={() => router.push("/dashboard")}>
            Retour
          </button>
        </div>
      ) : (
        <div className="page">

          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-left">
              <button className="back-btn" onClick={() => router.push("/dashboard")}>
                ← Tableau de bord
              </button>
              <div className="title-section">
                <h1>Mon profil</h1>
                <p>Gérez vos informations personnelles</p>
              </div>
            </div>
            <div className="topbar-actions">
              <button className="btn-secondary" onClick={() => { setEditOpen(true); setEditError(null); setEditSuccess(false); }}>
                ✎ Modifier
              </button>
              <button className="btn-danger" onClick={handleLogout}>
                Déconnexion
              </button>
            </div>
          </div>

          <div className="layout">

            {/* Colonne gauche - Carte profil */}
            <div className="card profile-card">
              <div className="avatar">
                {user.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="profile-name">{user.username}</div>
              <div className="profile-role">
                {user.role === "admin" ? "Administrateur" : "Utilisateur"}
              </div>

              <div className="stats-row">
                <div className="stat-item">
                  <div className="stat-value">{depotsCount}</div>
                  <div className="stat-label">Projets</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{analysesCount}</div>
                  <div className="stat-label">Analyses</div>
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-item">
                  <div className="stat-value">{issuesCount}</div>
                  <div className="stat-label">Issues</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{mrCount}</div>
                  <div className="stat-label">Merge Requests</div>
                </div>
              </div>

              <div className="divider" />

              <div className="profile-date">
                Membre depuis {formatDate(user.created_at)}
              </div>
            </div>

            {/* Colonne droite */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Informations du compte */}
              <div className="card">
                <div className="section-title">Informations du compte</div>
                <div className="info-list">
                  <div className="info-row">
                    <div className="info-icon">🆔</div>
                    <div className="info-content">
                      <div className="info-label">Identifiant</div>
                      <div className="info-value">#{user.id}</div>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-icon">👤</div>
                    <div className="info-content">
                      <div className="info-label">Nom d'utilisateur</div>
                      <div className="info-value">{user.username}</div>
                    </div>
                    <span className="info-badge badge-verified">✓ Vérifié</span>
                  </div>
                  <div className="info-row">
                    <div className="info-icon">📧</div>
                    <div className="info-content">
                      <div className="info-label">Adresse email</div>
                      <div className="info-value">{user.email}</div>
                    </div>
                    <span className="info-badge badge-active">Actif</span>
                  </div>
                  <div className="info-row">
                    <div className="info-icon">🔐</div>
                    <div className="info-content">
                      <div className="info-label">Connexion via</div>
                      <div className="info-value">GitLab OAuth</div>
                    </div>
                    <span className="info-badge badge-gitlab">GitLab</span>
                  </div>
                </div>
              </div>

              {/* Statistiques détaillées */}
              <div className="card">
                <div className="section-title">📊 Statistiques</div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-card-value" style={{ color: "#6366f1" }}>{depotsCount}</div>
                    <div className="stat-card-label">Projets analysés</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-value" style={{ color: "#10b981" }}>{analysesCount}</div>
                    <div className="stat-card-label">Analyses IA</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-value" style={{ color: "#f59e0b" }}>{issuesCount}</div>
                    <div className="stat-card-label">Issues GitLab</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-value" style={{ color: "#ef4444" }}>{mrCount}</div>
                    <div className="stat-card-label">Merge Requests</div>
                  </div>
                </div>
              </div>

              {/* Activité récente */}
              <div className="card">
                <div className="section-title">🕐 Activité récente</div>
                <div className="activity-list">
                  <div className="activity-item">
                    <div className="activity-dot" style={{ background: "#6366f1" }} />
                    <div className="activity-text">
                      Connexion via <strong>GitLab OAuth</strong>
                    </div>
                    <div className="activity-time">Maintenant</div>
                  </div>
                  <div className="activity-item">
                    <div className="activity-dot" style={{ background: "#10b981" }} />
                    <div className="activity-text">
                      Compte <strong>créé</strong> avec succès
                    </div>
                    <div className="activity-time">{formatDate(user.created_at)}</div>
                  </div>
                  {analysesCount > 0 && (
                    <div className="activity-item">
                      <div className="activity-dot" style={{ background: "#f59e0b" }} />
                      <div className="activity-text">
                        <strong>{analysesCount}</strong> analyse{analysesCount > 1 ? "s" : ""} réalisée{analysesCount > 1 ? "s" : ""}
                      </div>
                      <div className="activity-time">Récemment</div>
                    </div>
                  )}
                  {issuesCount > 0 && (
                    <div className="activity-item">
                      <div className="activity-dot" style={{ background: "#ef4444" }} />
                      <div className="activity-text">
                        <strong>{issuesCount}</strong> issue{issuesCount > 1 ? "s" : ""} GitLab créée{issuesCount > 1 ? "s" : ""}
                      </div>
                      <div className="activity-time">Récemment</div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Modal d'édition */}
          {editOpen && (
            <div className="modal-overlay" onClick={() => setEditOpen(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">✎ Modifier le profil</div>
                <div className="modal-sub">Mettez à jour vos informations personnelles</div>

                <div className="modal-field">
                  <label className="modal-label">Nom d'utilisateur</label>
                  <input
                    className="modal-input"
                    type="text"
                    value={editForm.username}
                    onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="Nom d'utilisateur"
                  />
                </div>

                <div className="modal-field">
                  <label className="modal-label">Adresse email</label>
                  <input
                    className="modal-input"
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@exemple.com"
                  />
                </div>

                {editError && <div className="modal-error">⚠️ {editError}</div>}
                {editSuccess && <div className="modal-success">✓ Profil mis à jour avec succès</div>}

                <div className="modal-actions">
                  <button className="modal-cancel" onClick={() => setEditOpen(false)}>Annuler</button>
                  <button
                    className="modal-confirm"
                    onClick={handleEditSave}
                    disabled={editLoading}
                  >
                    {editLoading ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </>
  );
}