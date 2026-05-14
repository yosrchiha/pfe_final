// "lib/api.ts" - fonctions pour appeler ton backend FastAPI
export async function loginUser(data: { email: string; password: string }) {
  const res = await fetch("http://localhost:8000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Erreur de connexion");
  }

  return res.json();
}

export async function registerUser(data: { email: string; username: string; password: string }) {
  const res = await fetch("http://localhost:8000/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Erreur lors de l'inscription");
  }

  return res.json();
}

