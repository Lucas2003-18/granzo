export const MESES = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const MESES_CURTO = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export const INC_TIPOS = [
  { id:"salario",        label:"Salário/Pró-labore",     emoji:"💼" },
  { id:"extra",          label:"Renda extra",             emoji:"💵" },
  { id:"transferencia",  label:"Transferência recebida",  emoji:"🔄" },
  { id:"transf_interna", label:"Transferência entre contas", emoji:"↔️" },
  { id:"investimento_ret",label:"Retorno de investimento", emoji:"📈" },
  { id:"outro",          label:"Outro",                   emoji:"💰" },
];

export const CATS_DEF = [
  { id:"moradia",      label:"Moradia",      emoji:"🏠", budget:1500, color:"#60a5fa" },
  { id:"alimentacao",  label:"Alimentação",  emoji:"🛒", budget:800,  color:"#4ade80" },
  { id:"transporte",   label:"Transporte",   emoji:"🚗", budget:400,  color:"#f59e0b" },
  { id:"saude",        label:"Saúde",        emoji:"💊", budget:300,  color:"#f472b6" },
  { id:"lazer",        label:"Lazer",        emoji:"🎬", budget:200,  color:"#fb923c" },
  { id:"educacao",     label:"Educação",     emoji:"📚", budget:300,  color:"#a78bfa" },
  { id:"vestuario",    label:"Vestuário",    emoji:"👕", budget:200,  color:"#38bdf8" },
  { id:"pet",          label:"Pet",           emoji:"🐶", budget:300,  color:"#f97316" },
  { id:"investimento", label:"Investimento", emoji:"📈", budget:0,    color:"#34d399" },
  { id:"outros",       label:"Outros",       emoji:"📦", budget:200,  color:"#8FA893" },
];

export const FIXAS_DEF = [
  { id:"fx1", desc:"Aluguel",    valor:0, cat:"moradia",   emoji:"🏠", ativo:true },
  { id:"fx2", desc:"Internet",   valor:0, cat:"moradia",   emoji:"📶", ativo:true },
  { id:"fx3", desc:"Plano de saúde", valor:0, cat:"saude", emoji:"💊", ativo:true },
];

export const PRESETS = ["#60a5fa","#4ade80","#f59e0b","#f472b6","#a78bfa","#fb923c","#34d399","#8FA893","#f87171","#38bdf8"];

export const CONTAS_DEF = [
  { id:"geral", label:"Geral", emoji:"🏦", color:"#8FA893" },
];

export const APP_VERSION = "1.1";
