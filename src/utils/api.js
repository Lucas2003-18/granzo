function getBase() { try { return localStorage.getItem("mf_backend_url") || ""; } catch { return ""; } }
function getKey()  { try { return localStorage.getItem("mf_backend_key") || ""; } catch { return ""; } }

export async function syncToBackend(snapshot) {
  const base = getBase();
  const key  = getKey();
  if (!base || !key) return;
  try {
    await fetch(`${base}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(snapshot),
    });
  } catch {}
}

export async function sendAlert(tipo, payload) {
  const base = getBase();
  const key  = getKey();
  if (!base || !key) return;
  try {
    await fetch(`${base}/api/alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ tipo, payload }),
    });
  } catch {}
}

export async function testBackend() {
  const base = getBase();
  const key  = getKey();
  if (!base || !key) return false;
  try {
    const r = await fetch(`${base}/api/health`, {
      headers: { "Authorization": `Bearer ${key}` },
    });
    return r.ok;
  } catch { return false; }
}
