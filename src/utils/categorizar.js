export function categorizar(desc, kind) {
  if (kind==="inc") return null;
  const d = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if (/pagamento de fatura/.test(d)) return "_ignorar";
  if (/pet.?camp|veterinar|petshop|petz|cobasi|racao|pet.?shop|banho.?tosa|castracao/.test(d)) return "pet";
  if (/ifood|rappi|uber.?eat|james|99.?food|melfood|restaur|lanche|pizza|burguer|mcdon|subway|sushi|padaria|superm|carrefour|atacadao|enxuto|higa|extra|pao.?de.?acucar|hortifrut|acougue|peixar|bebida|sorvete|supermercado|jim\.com|kamikase|espaco.?nobre|d.?burger|cacau/.test(d)) return "alimentacao";
  if (/uber|99pop|cabify|taxi|gasolina|combustiv|posto|shell|ipiranga|chiminazzo|diamante.?auto|pauliceia|estacion|onibus|metro|trem|passagem|pedagio|autopeca|oficina|mecanica|detran|ipva|seguro.?auto|ancar.?park/.test(d)) return "transporte";
  if (/farmac|drogari|remedio|medico|medica|hospital|clinica|consulta|exame|laborat|dentist|odontos|plano.?saude|unimed|amil|notredame|hapvida|academia|gym|crossfit/.test(d)) return "saude";
  if (/netflix|spotify|amazon|disney|hbo|youtube|prime|deezer|apple.?music|cinema|teatro|show|ingresso|jogo|steam|playstation|xbox|nintendo|balada|clube|viagem|hotel|airbnb|booking|ebanx|pagbrasil|ea9/.test(d)) return "lazer";
  if (/aluguel|condom|energia|enel|cpfl|sabesp|internet|vivo|claro|tim|sky |telefon|gas |seguro.?resid|iptu|manutencao|hm.?72|empreendimento.?imob|london.?point/.test(d)) return "moradia";
  if (/escola|faculdade|univers|curso|mensalid|material|livro|papelaria|udemy|alura|coursera|duolingo/.test(d)) return "educacao";
  if (/renner|riachuelo|c&a|cea |hm |zara|marisa|shein|shopee|calcado|sapato|tenis |roupa/.test(d)) return "vestuario";
  if (/aplicac|aplicacao|rdb|poupanca|tesouro|fundo|cdb|lci|lca|previd|previdenc/.test(d)) return "investimento";
  if (/^pix\s|^ted\s|^doc\s|transferencia|pagamento\s+pix|pix\s+enviado/.test(d)) return "_ignorar";
  if (/google|microsoft|apple|icloud|dropbox|canva|chatgpt|openai|adobe|figma|notion/.test(d)) return "lazer";
  if (/lanchonete|sorveteria|confeitaria|hamburger|temakeria|yakisoba|churrascaria/.test(d)) return "alimentacao";
  return "outros";
}

export function detectIncType(desc) {
  const d = (desc||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if (/salario|salário|pro.?labore|prolabore|pagamento.?folha|holerite|vencimento/.test(d)) return "salario";
  if (/devolucao.*aplicac|devolução.*aplicac|rendimento|juros|dividendo|cdb|lci|lca|fundo|tesouro/.test(d)) return "investimento_ret";
  if (/credito em conta|crédito em conta/.test(d)) return "investimento_ret";
  if (/reembolso/.test(d)) return "transferencia";
  if (/transferencia.?recebida|pix.?recebido|ted.?recebido|credito.?pix/.test(d)) return "salario";
  if (/transferencia.?enviada|pix.?enviado|ted.?enviado/.test(d)) return "transferencia";
  if (/^transf/.test(d)) return "transferencia";
  if (/freelance|freela|servico|serviço|consultor|comissao|comissão|bico|extra/.test(d)) return "extra";
  return null;
}
