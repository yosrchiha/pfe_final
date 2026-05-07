"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import AdminLayout from "../AdminLayout";
import { useRouter } from "next/navigation";
import {
  API, getHeaders, DataTable, TH, TD,
  ActionBtn, SearchInput, EmptyRow, Loader, ErrorState
} from "../adminUtils";
import type { UserItem } from "../adminUtils";

 
// ── 2. Dans le composant, initialiser le router ───────────────────────────


interface NewUserForm {
  email: string; username: string; password: string; role: "user" | "admin";
}
interface EditUserForm {
  email: string; username: string;
}

const EMPTY_FORM: NewUserForm = { email: "", username: "", password: "", role: "user" };

// ── Palette fixe dark admin ────────────────────────────────────────
const T = {
  bg:       "#07090f",
  card:     "#0a0c14",
  border:   "#1e2235",
  text:     "#f1f3fc",
  muted:    "#a8b0d0",
  faint:    "#5a6080",
  input:    "#07090f",
  modalBg:  "#0f1117",
  accentTxt:"#818cf8",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [users, setUsers]       = useState<UserItem[]>([]);
  const [search, setSearch]     = useState("");
  const [confirm, setConfirm]   = useState<{ userId: number; msg: string } | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const [showAdd, setShowAdd]         = useState(false);
  const [form, setForm]               = useState<NewUserForm>(EMPTY_FORM);
  const [formErr, setFormErr]         = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [editUser, setEditUser]       = useState<UserItem | null>(null);
  const [editForm, setEditForm]       = useState<EditUserForm>({ email: "", username: "" });
  const [editErr, setEditErr]         = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

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

  const ouvrirEdit = (u: UserItem) => {
    setEditUser(u);
    setEditForm({ email: u.email, username: u.username || "" });
    setEditErr("");
  };

  const validerEdit = async () => {
    if (!editForm.email.trim())    { setEditErr("L'email est requis."); return; }
    if (!editForm.username.trim()) { setEditErr("Le username est requis."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) { setEditErr("Format email invalide."); return; }
    setEditLoading(true); setEditErr("");
    try {
      await axios.patch(
        `${API}/admin/users/${editUser!.id}/update`,
        { email: editForm.email.trim(), username: editForm.username.trim() },
        { headers: getHeaders() }
      );
      setUsers(prev => prev.map(u =>
        u.id === editUser!.id ? { ...u, email: editForm.email.trim(), username: editForm.username.trim() } : u
      ));
      setEditUser(null);
      showToast("Utilisateur modifié avec succès.");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setEditErr(typeof d === "string" ? d : "Erreur lors de la modification.");
    } finally { setEditLoading(false); }
  };

  const createUser = async () => {
    setFormErr("");
    if (!form.email.trim())       return setFormErr("L'email est requis.");
    if (!form.username.trim())    return setFormErr("Le username est requis.");
    if (form.password.length < 6) return setFormErr("Mot de passe : 6 caractères minimum.");
    setFormLoading(true);
    try {
      await axios.post(
        `${API}/admin/users/create`,
        { email: form.email.trim(), username: form.username.trim(), password: form.password, role: form.role },
        { headers: getHeaders() }
      );
      setShowAdd(false); setForm(EMPTY_FORM);
      showToast(`Utilisateur ${form.email} créé avec succès.`);
      load();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setFormErr(typeof d === "string" ? d : "Erreur lors de la création.");
    } finally { setFormLoading(false); }
  };

  const toggleUser = async (id: number, active: boolean) => {
    try {
      await axios.patch(`${API}/admin/users/${id}/active`, { is_active: !active }, { headers: getHeaders() });
      setUsers(p => p.map(u => u.id === id ? { ...u, is_active: !active } : u));
      showToast(`Utilisateur ${!active ? "activé" : "désactivé"}`);
    } catch { showToast("Erreur.", false); }
  };

  const changeRole = async (id: number, role: string) => {
    const nr = role === "admin" ? "user" : "admin";
    try {
      await axios.patch(`${API}/admin/users/${id}/role`, { role: nr }, { headers: getHeaders() });
      setUsers(p => p.map(u => u.id === id ? { ...u, role: nr } : u));
      showToast(`Rôle changé en ${nr}`);
    } catch { showToast("Erreur.", false); }
  };

  const deleteUser = async (id: number) => {
    try {
      await axios.delete(`${API}/admin/users/${id}`, { headers: getHeaders() });
      setUsers(p => p.filter(u => u.id !== id));
      showToast("Utilisateur supprimé.");
      setConfirm(null);
    } catch { showToast("Erreur.", false); setConfirm(null); }
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );
  const admins = users.filter(u => u.role === "admin").length;
  const actifs = users.filter(u => u.is_active).length;

  // ── Petits composants réutilisables ───────────────────────────
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize:10, color:T.faint, fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:6 }}>{children}</div>
  );

  const Input = ({ type="text", placeholder, value, onChange }: {
    type?: string; placeholder: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      style={{ width:"100%", padding:"10px 14px", background:T.input, border:`1px solid ${T.border}`, borderRadius:9, color:T.text, fontSize:13, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}
      onFocus={e => (e.target.style.borderColor = "rgba(91,99,245,0.5)")}
      onBlur={e  => (e.target.style.borderColor = T.border)}
    />
  );

  const ErrBox = ({ msg }: { msg: string }) => (
    <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:8, padding:"10px 14px", color:"#f87171", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>✕ {msg}</div>
  );

  const Spin = () => (
    <div style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", animation:"spin 0.6s linear infinite" }} />
  );

  const ModalWrap = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:T.modalBg, border:`1px solid ${T.border}`, borderRadius:20, padding:"36px 40px", width:440, boxShadow:"0 24px 80px rgba(0,0,0,0.6)", animation:"fadeIn 0.2s ease" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  const BtnCancel = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} style={{ flex:1, padding:"11px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:9, color:T.faint, cursor:"pointer", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>Annuler</button>
  );

  const BtnPrimary = ({ onClick, loading, children }: { onClick: () => void; loading?: boolean; children: React.ReactNode }) => (
    <button onClick={onClick} disabled={loading} style={{ flex:2, padding:"11px", background:"linear-gradient(135deg,#5b63f5,#9b5cf6)", border:"none", borderRadius:9, color:"white", cursor:loading?"not-allowed":"pointer", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
      {children}
    </button>
  );

  return (
    <AdminLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .rb { flex:1;padding:9px;border-radius:9px;cursor:pointer;border:1px solid #1e2235;background:transparent;color:#5a6080;font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;transition:all 0.18s; }
        .rb.u { background:rgba(96,165,250,0.12);border-color:rgba(96,165,250,0.35);color:#60a5fa; }
        .rb.a { background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.35);color:#f59e0b; }
        .eb:hover { opacity:0.8;transform:scale(0.97); }
        .eb { transition:all 0.15s; }
        tr:nth-child(even) td { background:rgba(255,255,255,0.015); }
      `}</style>

      {loading ? <Loader message="Chargement des utilisateurs..." /> :
       error   ? <ErrorState message={error} onRetry={load} /> : (
        <div style={{ flex:1, background:T.bg, overflowY:"auto", display:"flex", flexDirection:"column" }}>

          {/* HEADER */}
          <div style={{ padding:"28px 36px 20px", borderBottom:`1px solid ${T.border}`, background:T.card }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.accentTxt, textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:6 }}>◈ UTILISATEURS</p>
                <h1 style={{ fontSize:22, fontWeight:800, color:T.text, letterSpacing:"-0.02em" }}>
                  Gestion des comptes <span style={{ marginLeft:10, fontSize:14, fontWeight:600, color:T.faint }}>({filtered.length})</span>
                </h1>
                <p style={{ fontSize:11, color:T.faint, fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>Gestion des comptes et permissions</p>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setFormErr(""); }}
                  style={{ padding:"10px 20px", background:"linear-gradient(135deg,#5b63f5,#9b5cf6)", border:"none", borderRadius:10, color:"white", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:"0 4px 18px rgba(91,99,245,0.35)", transition:"transform 0.2s" }}
                  onMouseEnter={e=>(e.currentTarget.style.transform="translateY(-1px)")}
                  onMouseLeave={e=>(e.currentTarget.style.transform="none")}>
                  + Ajouter un client
                </button>
                <button onClick={load}
                  style={{ padding:"10px 18px", background:"rgba(91,99,245,0.1)", border:"1px solid rgba(91,99,245,0.25)", borderRadius:10, color:T.accentTxt, fontSize:12, fontFamily:"'JetBrains Mono',monospace", cursor:"pointer" }}>
                  ↻ Actualiser
                </button>
              </div>
            </div>
          </div>

          <div style={{ padding:"24px 36px", flex:1 }}>

            {/* STATS */}
            <div style={{ display:"flex", gap:10, marginBottom:22, flexWrap:"wrap" }}>
              {[
                { label:"Total",        value:users.length,          color:"#5b63f5" },
                { label:"Actifs",       value:actifs,                color:"#22c55e" },
                { label:"Inactifs",     value:users.length-actifs,   color:"#f87171" },
                { label:"Admins",       value:admins,                color:"#f59e0b" },
                { label:"Utilisateurs", value:users.length-admins,   color:"#60a5fa" },
              ].map(p=>(
                <div key={p.label} style={{ background:`${p.color}12`, border:`1px solid ${p.color}30`, borderRadius:9, padding:"7px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <b style={{ color:p.color, fontSize:18, fontWeight:800 }}>{p.value}</b>
                  <span style={{ color:T.muted, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.label}</span>
                </div>
              ))}
            </div>

            {/* SEARCH */}
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Email ou username..." />
            </div>

            {/* TABLE */}
            <DataTable>
              <thead><tr>
                <TH>ID</TH><TH>Email</TH><TH>Username</TH><TH>Rôle</TH>
                <TH center>Statut</TH><TH center>Dépôts</TH><TH>Créé le</TH><TH center>Actions</TH>
              </tr></thead>
              <tbody>
                {filtered.map((u,i)=>(
                  <tr key={u.id} style={{ animation:"fadeIn 0.25s ease backwards", animationDelay:`${i*0.03}s` }}>
                    <TD><span style={{ color:T.faint, fontSize:10 }}>#{u.id}</span></TD>
                    <TD><b style={{ color:T.text }}>{u.email}</b></TD>
                    <TD><code style={{ color:T.accentTxt, fontSize:11 }}>@{u.username}</code></TD>
                    <TD center>
                      <span style={{ background:u.role==="admin"?"rgba(245,158,11,0.12)":"rgba(96,165,250,0.12)", color:u.role==="admin"?"#f59e0b":"#60a5fa", fontWeight:700, padding:"3px 10px", borderRadius:20, fontSize:10, fontFamily:"'JetBrains Mono',monospace", border:`1px solid ${u.role==="admin"?"rgba(245,158,11,0.25)":"rgba(96,165,250,0.25)"}` }}>
                        {u.role==="admin"?"👑 admin":"user"}
                      </span>
                    </TD>
                    <TD center>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:u.is_active?"#22c55e":"#f87171" }} />
                        <span style={{ color:u.is_active?"#22c55e":"#f87171", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{u.is_active?"actif":"inactif"}</span>
                      </div>
                    </TD>
                    <TD center><b style={{ color:T.accentTxt, fontSize:14 }}>{u.depot_count}</b></TD>
                    <TD><span style={{ color:T.faint, fontSize:11 }}>{u.created_at?.split("T")[0]}</span></TD>
                    <TD center>
                      <div style={{ display:"flex", gap:5, justifyContent:"center", flexWrap:"wrap" }}>
                        <button className="eb" onClick={()=>ouvrirEdit(u)}
                          style={{ padding:"5px 12px", border:"1px solid rgba(91,99,245,0.35)", borderRadius:7, cursor:"pointer", fontSize:11, fontWeight:600, background:"rgba(91,99,245,0.1)", color:"#818cf8", fontFamily:"'JetBrains Mono',monospace" }}>
                          ✏️ Modifier
                        </button>
                        <ActionBtn onClick={()=>toggleUser(u.id,u.is_active)} color={u.is_active?"red":"green"}>
                          {u.is_active?"Désactiver":"Activer"}
                        </ActionBtn>
                        <ActionBtn onClick={()=>changeRole(u.id,u.role)} color="gray">
                          → {u.role==="admin"?"user":"admin"}
                        </ActionBtn>
                        <ActionBtn onClick={()=>setConfirm({ userId:u.id, msg:`Supprimer ${u.email} et tous ses dépôts ?` })} color="red">
                          Supprimer
                        </ActionBtn>
                          
 
<button
  className="eb"
  onClick={() => router.push(`/admin-pages/users/${u.id}/activity`)}
  style={{
    padding: "5px 12px",
    border: "1px solid rgba(167,139,250,0.35)",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    background: "rgba(167,139,250,0.1)",
    color: "#a78bfa",
    fontFamily: "'JetBrains Mono',monospace",
  }}
>
  📊 Activité
</button>
 
                      </div>
                    </TD>
                  </tr>
                ))}
                {filtered.length===0 && <EmptyRow cols={8} message="Aucun utilisateur trouvé" />}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {/* ══ MODAL MODIFIER ══════════════════════════════════════ */}
      {editUser && (
        <ModalWrap onClose={()=>setEditUser(null)}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, color:T.accentTxt, fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:8 }}>✏️ MODIFIER</div>
            <h2 style={{ fontSize:18, fontWeight:800, color:T.text, letterSpacing:"-0.02em" }}>Modifier l'utilisateur</h2>
            <p style={{ fontSize:11, color:T.faint, fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>
              ID #{editUser.id} · Rôle : <span style={{ color:editUser.role==="admin"?"#f59e0b":"#60a5fa" }}>{editUser.role}</span>
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <Label>Email *</Label>
              <Input type="email" placeholder="nouveau@email.com" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} />
              {editForm.email && editForm.email!==editUser.email && (
                <div style={{ fontSize:10, color:"#f59e0b", fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>
                  ⚠ L'utilisateur devra utiliser ce nouvel email pour se connecter
                </div>
              )}
            </div>
            <div>
              <Label>Username *</Label>
              <Input placeholder="nom_utilisateur" value={editForm.username} onChange={e=>setEditForm(f=>({...f,username:e.target.value}))} />
            </div>
            {(editForm.email!==editUser.email || editForm.username!==(editUser.username||"")) && (
              <div style={{ background:"rgba(91,99,245,0.08)", border:"1px solid rgba(91,99,245,0.2)", borderRadius:9, padding:"10px 14px" }}>
                <div style={{ fontSize:10, color:T.accentTxt, fontFamily:"'JetBrains Mono',monospace", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Modifications</div>
                {editForm.email!==editUser.email && (
                  <div style={{ fontSize:11, color:T.muted, fontFamily:"'JetBrains Mono',monospace" }}>
                    email : <span style={{ color:T.faint, textDecoration:"line-through" }}>{editUser.email}</span>{" → "}<span style={{ color:T.accentTxt }}>{editForm.email}</span>
                  </div>
                )}
                {editForm.username!==(editUser.username||"") && (
                  <div style={{ fontSize:11, color:T.muted, fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>
                    username : <span style={{ color:T.faint, textDecoration:"line-through" }}>@{editUser.username}</span>{" → "}<span style={{ color:T.accentTxt }}>@{editForm.username}</span>
                  </div>
                )}
              </div>
            )}
            {editErr && <ErrBox msg={editErr} />}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:28 }}>
            <BtnCancel onClick={()=>setEditUser(null)} />
            <BtnPrimary onClick={validerEdit} loading={editLoading}>
              {editLoading ? <><Spin /> Enregistrement...</> : "✓ Enregistrer"}
            </BtnPrimary>
          </div>
        </ModalWrap>
      )}

      {/* ══ MODAL AJOUTER ════════════════════════════════════════ */}
      {showAdd && (
        <ModalWrap onClose={()=>setShowAdd(false)}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, color:T.accentTxt, fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:8 }}>● NOUVEAU COMPTE</div>
            <h2 style={{ fontSize:18, fontWeight:800, color:T.text, letterSpacing:"-0.02em" }}>Ajouter un client</h2>
            <p style={{ fontSize:11, color:T.faint, fontFamily:"'JetBrains Mono',monospace", marginTop:4 }}>Le client recevra ses identifiants pour se connecter</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div><Label>Email *</Label><Input type="email" placeholder="client@exemple.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
            <div><Label>Username *</Label><Input placeholder="nom_utilisateur" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} /></div>
            <div><Label>Mot de passe * (min. 6 caractères)</Label><Input type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} /></div>
            <div>
              <Label>Rôle</Label>
              <div style={{ display:"flex", gap:8 }}>
                <button className={`rb ${form.role==="user"?"u":""}`}  onClick={()=>setForm(f=>({...f,role:"user"}))}>👤 Utilisateur</button>
                <button className={`rb ${form.role==="admin"?"a":""}`} onClick={()=>setForm(f=>({...f,role:"admin"}))}>👑 Administrateur</button>
              </div>
            </div>
            {formErr && <ErrBox msg={formErr} />}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:28 }}>
            <BtnCancel onClick={()=>setShowAdd(false)} />
            <BtnPrimary onClick={createUser} loading={formLoading}>
              {formLoading ? <><Spin /> Création...</> : "✓ Créer le compte"}
            </BtnPrimary>
          </div>
        </ModalWrap>
      )}

      {/* ══ CONFIRM SUPPRESSION ══════════════════════════════════ */}
      {confirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:T.modalBg, border:`1px solid ${T.border}`, borderRadius:18, padding:"36px 40px", maxWidth:400, width:"100%", textAlign:"center", boxShadow:"0 24px 80px rgba(0,0,0,0.6)", animation:"fadeIn 0.2s ease" }}>
            <div style={{ fontSize:42, marginBottom:16 }}>⚠</div>
            <p style={{ color:T.text, fontWeight:700, fontSize:15, marginBottom:8 }}>Confirmer la suppression</p>
            <p style={{ color:T.muted, fontSize:12, fontFamily:"'JetBrains Mono',monospace", marginBottom:28 }}>{confirm.msg}</p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={()=>setConfirm(null)} style={{ padding:"10px 22px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:9, color:T.faint, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>Annuler</button>
              <button onClick={()=>deleteUser(confirm.userId)} style={{ padding:"10px 22px", background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:9, color:"#f87171", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOAST ════════════════════════════════════════════════ */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:T.modalBg, border:`1px solid ${toast.ok?"rgba(91,99,245,0.3)":"rgba(248,113,113,0.3)"}`, borderRadius:10, padding:"12px 20px", color:toast.ok?T.accentTxt:"#f87171", fontSize:12, fontFamily:"'JetBrains Mono',monospace", boxShadow:"0 8px 32px rgba(0,0,0,0.4)", zIndex:2000, animation:"fadeIn 0.2s ease" }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}