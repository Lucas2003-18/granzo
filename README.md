💰 Meu Financeiro

Controle financeiro pessoal para Android — simples, offline e seu.

📱 O que é
App financeiro pessoal gerado como APK Android via GitHub Actions. Todos os dados ficam no próprio celular (localStorage), sem servidor, sem conta, sem assinatura.

✨ Funcionalidades
📊 Dashboard

Resumo do mês: renda, gastos, saldo e % poupado
Alerta de despesas fixas pendentes no mês
Top 3 maiores gastos
Gastos recorrentes detectados automaticamente — com botão para adicionar às Fixas
Últimos lançamentos
Botão de compartilhar resumo mensal (texto ou clipboard)

📈 Gráficos

Evolução mensal com barras de receita vs gastos
Linha de tendência do saldo acumulado
Pizza por categoria (acumulado ou por mês)

💰 Orçamento

Limite mensal por categoria
Barra de progresso visual
Alerta automático ao ultrapassar

💸 Gastos

Lançamento manual de despesas e receitas
Parcelamento de compras no cartão
Edição inline com swipe para deletar
Filtro por mês, categoria e conta
Paginação (50 por vez)

🏦 Reservas (Caixinhas)

Separar dinheiro com propósito: emergência, viagem, férias...
Histórico de depósitos e retiradas por caixinha
Meta de valor por reserva

🛒 Mercado

Registro de preços por produto e mercado
Comparativo de preços entre mercados
Histórico de variação de preço

🤖 IA (Gemini)

Assistente financeiro pessoal com contexto real dos seus dados
Análise de gastos, dicas e resposta a perguntas
Resumo mensal automático gerado por IA
Usa a API Gemini (chave configurável por usuário)

⚙️ Config

Gerenciar contas bancárias
Gerenciar categorias com orçamento e emoji
Despesas fixas recorrentes com lançamento com 1 toque
Meta de poupança mensal
Importar extrato CSV (Nubank Conta, Nubank Cartão, Bradesco)
Exportar/importar backup JSON completo
Chave da API Gemini


🗂️ Estrutura do projeto
meu-financeiro/
├── src/
│   └── App.jsx          # App inteiro (single-file, ~2600 linhas)
├── public/
├── generate_icons.py    # Gera ícones Android via Pillow
├── capacitor.config.json
├── package.json
├── vite.config.js
└── .github/
    └── workflows/
        └── build-apk.yml  # Pipeline de build automático

🚀 Como gerar o APK
O build é 100% automático via GitHub Actions. Basta dar push na branch main.
Passo a passo

Fork ou clone este repositório no seu GitHub
Faça qualquer alteração e dê push para main
Vá em Actions → Build APK → último run
Baixe o artefato meu-financeiro-apk
Instale o .apk no Android (habilite "fontes desconhecidas" nas configurações)

O que o pipeline faz
Checkout → npm install → vite build → Java 17 + Android SDK
→ Capacitor sync → Gerar ícones (Python/Pillow)
→ Adaptive icon XML → Gradle build → Upload APK
Desenvolvimento local
bashnpm install
npm run dev        # servidor local em http://localhost:5173

📥 Importação de extratos
O app importa CSV exportado diretamente dos apps/sites dos bancos:
BancoFonteFormatoNubank ContaApp Nubank → Extrato → ExportarData,Valor,Identificador,DescriçãoNubank CartãoApp Nubank → Fatura → Exportardate,title,amountBradescoInternet Banking → ExtratoFormato padrão Bradesco
A categorização é automática — o app detecta o banco pelo cabeçalho do CSV e aplica regras de categorização por palavras-chave na descrição.

💾 Armazenamento local
Todos os dados ficam no localStorage do dispositivo:
ChaveConteúdomf_expsLançamentos (receitas e despesas)mf_catsCategorias personalizadasmf_contasContas bancáriasmf_fixasDespesas fixas recorrentesmf_reservasCaixinhas e históricomf_mktsMercados cadastradosmf_metaMeta de poupançamf_prods_extraProdutos extras do Mercadomf_precosHistórico de preçosmf_gemini_keyChave da API Geminimf_onboarding_doneFlag de onboarding concluído

💡 Use Config → Dados → Exportar backup JSON para não perder seus dados ao trocar de celular.


🤖 Configurando a IA

Acesse Google AI Studio
Crie uma chave de API gratuita
No app: ⚙️ Config → Chave IA → cole a chave
Pronto — o assistente já tem acesso aos seus dados financeiros

O modelo usado é gemini-2.5-flash (rápido e gratuito no tier free).

🛠️ Stack
CamadaTecnologiaUIReact 18 + JSX inline stylesBuildVite 5MobileCapacitor 5APKAndroid Gradle (debug)CI/CDGitHub ActionsIAGoogle Gemini APIÍconesPython + Pillow (gerado no CI)

📋 Changelog
v1.0.0 — Março 2026

🎉 Versão inicial completa
7 abas: Dashboard, Gráficos, Orçamento, Gastos, Reservas, Mercado, IA
Importação CSV Nubank e Bradesco
Assistente IA com Gemini
Backup/restore JSON
Onboarding interativo (7 passos)
Ícone personalizado gerado no CI
Despesas fixas com lançamento com 1 toque
Sugestão automática de recorrentes → Fixas
Modais próprios (sem window.confirm)
Datas seguras para Android (sem toLocaleDateString)


📄 Licença
Uso pessoal. Fique à vontade para adaptar para suas próprias finanças.
