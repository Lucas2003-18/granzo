"""Categorias herdadas do Granzo (CATS_DEF) + categoria 'A classificar'."""

A_CLASSIFICAR = "a_classificar"
IGNORAR = "_ignorar"  # transferência/pagamento de fatura: fora de gasto e renda

CATEGORIAS = [
    # id, nome, emoji, orçamento mensal (None = sem limite)
    ("moradia", "Moradia", "🏠", 1500),
    ("alimentacao", "Alimentação", "🛒", 800),
    ("transporte", "Transporte", "🚗", 400),
    ("saude", "Saúde", "💊", 300),
    ("lazer", "Lazer", "🎬", 200),
    ("educacao", "Educação", "📚", 300),
    ("vestuario", "Vestuário", "👕", 200),
    ("pet", "Pet", "🐶", 300),
    ("investimento", "Investimento", "📈", None),
    ("outros", "Outros", "📦", 200),
    (A_CLASSIFICAR, "A classificar", "❓", None),
]

# Portadas de src/utils/categorizar.js (ordem importa: primeira que casar vence).
# Texto já normalizado (minúsculo, sem acento).
REGRAS_PADRAO: list[tuple[str, str]] = [
    (r"pagamento de fatura", IGNORAR),
    (r"pet.?camp|veterinar|petshop|petz|cobasi|racao|pet.?shop|banho.?tosa|castracao", "pet"),
    (r"ifood|rappi|uber.?eat|james|99.?food|melfood|restaur|lanche|pizza|burguer|mc.?don|subway|sushi|padaria|superm|carrefour|atacadao|enxuto|higa|extra|pao.?de.?acucar|hortifrut|acougue|peixar|bebida|sorvete|supermercado|jim\.com|kamikase|espaco.?nobre|d.?burger|cacau|casa.?de.?carne|sacolao|feira|mercearia", "alimentacao"),
    (r"uber|99pop|cabify|taxi|gasolina|combustiv|posto|shell|ipiranga|chiminazzo|diamante.?auto|pauliceia|estacion|onibus|metro|trem|passagem|pedagio|autopeca|oficina|mecanica|detran|ipva|seguro.?auto|ancar.?park", "transporte"),
    (r"farmac|drogari|remedio|medico|medica|hospital|clinica|consulta|exame|laborat|dentist|odontos|plano.?saude|unimed|amil|notredame|hapvida|academia|gym|crossfit", "saude"),
    (r"netflix|spotify|amazon|disney|hbo|youtube|prime|deezer|apple.?music|cinema|teatro|show|ingresso|jogo|steam|playstation|xbox|nintendo|balada|clube|viagem|hotel|airbnb|booking|ebanx|pagbrasil|ea9", "lazer"),
    (r"aluguel|condom|energia|enel|cpfl|sabesp|internet|vivo|claro|tim|sky |telefon|gas |seguro.?resid|iptu|manutencao|hm.?72|empreendimento.?imob|london.?point", "moradia"),
    (r"escola|faculdade|univers|curso|mensalid|material|livro|papelaria|udemy|alura|coursera|duolingo", "educacao"),
    (r"renner|riachuelo|c&a|cea |hm |zara|marisa|shein|shopee|calcado|sapato|tenis |roupa", "vestuario"),
    (r"aplicac|aplicacao|rdb|poupanca|tesouro|fundo|cdb|lci|lca|previd|previdenc", "investimento"),
    (r"^pix\s|^ted\s|^doc\s|transferencia|pagamento\s+pix|pix\s+enviado", IGNORAR),
    (r"google|microsoft|apple|icloud|dropbox|canva|chatgpt|openai|adobe|figma|notion", "lazer"),
    (r"lanchonete|sorveteria|confeitaria|hamburger|temakeria|yakisoba|churrascaria", "alimentacao"),
]
