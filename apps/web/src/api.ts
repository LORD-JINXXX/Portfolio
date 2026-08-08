const API_URL=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')
export async function publicFetch<T=any>(path:string,options:RequestInit={}):Promise<T>{const r=await fetch(`${API_URL}${path}`,options);const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||`Request failed (${r.status})`);return p}
