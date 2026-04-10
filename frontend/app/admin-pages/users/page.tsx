"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { API, getHeaders, PageHeader, DataTable, TH, TD, ActionBtn, SearchInput, EmptyRow, Loader, ErrorState } from "../adminUtils";
import type { UserItem } from "../adminUtils";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [users, setUsers]     = useState<UserItem[]>([]);
  const [search, setSearch]   = useState("");
  const [confirm, setConfirm] = useState<{ type: string; userId: number; msg: string } | null>(null);
  const [toast, setToast]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true); setError("");
    try {
      const r = await axios.get(`${API}/admin/users`, { headers: getHeaders() });
      setUsers(r.data);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? "Accès refusé." : "Erreur de chargement.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  async function toggleUser(id: number, active: boolean) {
    try {
      await axios.patch(`${API}/admin/users/${id}/active`, { is_active: !active }, { headers: getHeaders() });
      setUsers(p => p.map(u => u.id === id ? { ...u, is_active: !active } : u));
      showToast(`Utilisateur ${!active ? "activé" : "désactivé"}`);
    } catch { showToast("Erreur lors de la modification."); }
  }

  async function changeRole(id: number, role: string) {
    const nr = role === "admin" ? "user" : "admin";
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role: nr }, { headers: getHeaders() });
      setUsers(p => p.map(u => u.id === id ? { ...u, role: nr } : u));
      showToast(`Rôle changé en ${nr}`);
    } catch { showToast("Erreur lors du changement de rôle."); }
  }

  async function deleteUser(id: number) {
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: getHeaders() });
      setUsers(p => p.filter(u => u.id !== id));
      showToast("Utilisateur supprimé.");
      setConfirm(null);
    } catch { showToast("Erreur lors de la suppression."); setConfirm(null); }
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const admins  = users.filter(u => u.role === "admin").length;
  const actifs  = users.filter(u => u.is_active).length;

  return (
    <AdminLayout>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap'); @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } } @keyframes spin { to { transform:rotate(360deg) } }`}</style>
      {loading ? <Loader message="Chargement des utilisateurs..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex: 1, background: "#07090f", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <PageHeader icon="◈" title="Utilisateurs" count={filtered.length} sub="Gestion des comptes et permissions" onRefresh={load} />

          <div style={{ padding: "24px 36px", flex: 1 }}>

            {/* SUMMARY PILLS */}
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              {[
                { label: "Total",      value: users.length,  color: "#5b63f5" },
                { label: "Actifs",     value: actifs,        color: "#22c55e" },
                { label: "Inactifs",   value: users.length - actifs, color: "#f87171" },
                { label: "Admins",     value: admins,        color: "#f59e0b" },
                { label: "Utilisateurs", value: users.length - admins, color: "#60a5fa" },
              ].map(p => (
                <div key={p.label} style={{
                  background: `${p.color}12`, border: `1px solid ${p.color}30`,
                  borderRadius: 9, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <b style={{ color: p.color, fontSize: 18, fontWeight: 800 }}>{p.value}</b>
                  <span style={{ color: "#a8b0d0", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{p.label}</span>
                </div>
              ))}
            </div>

            {/* SEARCH */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Email ou username..." />
            </div>

            {/* TABLE */}
            <DataTable>
              <thead><tr>
                <TH>ID</TH><TH>Email</TH><TH>Username</TH><TH>Rôle</TH>
                <TH center>Statut</TH><TH center>Dépôts</TH><TH>Créé le</TH><TH center>Actions</TH>
              </tr></thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)", animation: "fadeIn 0.25s ease backwards", animationDelay: `${i * 0.03}s` }}>
                    <TD><span style={{ color: "#3a4060", fontSize: 10 }}>#{u.id}</span></TD>
                    <TD><b style={{ color: "#f1f3fc" }}>{u.email}</b></TD>
                    <TD><code style={{ color: "#818cf8", fontSize: 11 }}>@{u.username}</code></TD>
                    <TD center>
                      <span style={{
                        background: u.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(96,165,250,0.12)",
                        color: u.role === "admin" ? "#f59e0b" : "#60a5fa",
                        fontWeight: 700, padding: "3px 10px", borderRadius: 20, fontSize: 10,
                        fontFamily: "'JetBrains Mono',monospace",
                        border: `1px solid ${u.role === "admin" ? "rgba(245,158,11,0.25)" : "rgba(96,165,250,0.25)"}`,
                      }}>
                        {u.role === "admin" ? "👑 admin" : "user"}
                      </span>
                    </TD>
                    <TD center>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: u.is_active ? "#22c55e" : "#f87171" }} />
                        <span style={{ color: u.is_active ? "#22c55e" : "#f87171", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>
                          {u.is_active ? "actif" : "inactif"}
                        </span>
                      </div>
                    </TD>
                    <TD center><b style={{ color: "#5b63f5", fontSize: 14 }}>{u.depot_count}</b></TD>
                    <TD><span style={{ color: "#5a6080", fontSize: 11 }}>{u.created_at?.split("T")[0]}</span></TD>
                    <TD center>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                        <ActionBtn onClick={() => toggleUser(u.id, u.is_active)} color={u.is_active ? "red" : "green"}>
                          {u.is_active ? "Désactiver" : "Activer"}
                        </ActionBtn>
                        <ActionBtn onClick={() => changeRole(u.id, u.role)} color="gray">
                          → {u.role === "admin" ? "user" : "admin"}
                        </ActionBtn>
                        <ActionBtn onClick={() => setConfirm({ type: "delete", userId: u.id, msg: `Supprimer ${u.email} et tous ses dépôts ?` })} color="red">
                          Supprimer
                        </ActionBtn>
                      </div>
                    </TD>
                  </tr>
                ))}
                {filtered.length === 0 && <EmptyRow cols={8} message="Aucun utilisateur trouvé" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#0f1117", border: "1px solid #1e2235", borderRadius: 18,
            padding: "36px 40px", maxWidth: 400, width: "100%", textAlign: "center",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)", animation: "fadeIn 0.2s ease",
          }}>
            <div style={{ fontSize: 42, marginBottom: 16 }}>⚠</div>
            <p style={{ color: "#f1f3fc", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Confirmer la suppression</p>
            <p style={{ color: "#a8b0d0", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", marginBottom: 28 }}>{confirm.msg}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirm(null)} style={{ padding: "10px 22px", background: "transparent", border: "1px solid #1e2235", borderRadius: 9, color: "#a8b0d0", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>Annuler</button>
              <button onClick={() => deleteUser(confirm.userId)} style={{ padding: "10px 22px", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 9, color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, background: "#0f1117",
          border: "1px solid rgba(91,99,245,0.3)", borderRadius: 10, padding: "12px 20px",
          color: "#818cf8", fontSize: 12, fontFamily: "'JetBrains Mono',monospace",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 2000, animation: "fadeIn 0.2s ease",
        }}>✓ {toast}</div>
      )}
    </AdminLayout>
  );
}
