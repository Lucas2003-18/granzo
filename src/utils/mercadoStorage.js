export const MERCADO_KEY="mf_precos";
export const MERCADO_PRODS_KEY="mf_prods_extra";

export function loadPrecos(){try{const v=localStorage.getItem(MERCADO_KEY);return v?JSON.parse(v):{}}catch{return {}}}
export function savePrecos(p){try{localStorage.setItem(MERCADO_KEY,JSON.stringify(p))}catch{}}
export function loadProdsExtra(){try{const v=localStorage.getItem(MERCADO_PRODS_KEY);return v?JSON.parse(v):[]}catch{return []}}
export function saveProdsExtra(list){try{localStorage.setItem(MERCADO_PRODS_KEY,JSON.stringify(list))}catch{}}
