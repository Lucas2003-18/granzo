# 💰 Meu Financeiro

> Controle financeiro pessoal para Android — simples, offline e seu.

![versão](https://img.shields.io/badge/versão-1.0.0-818cf8?style=flat-square)
![plataforma](https://img.shields.io/badge/plataforma-Android-4ade80?style=flat-square)
![build](https://img.shields.io/badge/build-GitHub%20Actions-f59e0b?style=flat-square)
![stack](https://img.shields.io/badge/stack-React%20%2B%20Capacitor-38bdf8?style=flat-square)

---

## 📱 O que é

App financeiro pessoal gerado como APK Android via GitHub Actions. Todos os dados ficam **no próprio celular** (localStorage), sem servidor, sem conta, sem assinatura.

---

## ✨ Funcionalidades

### 📊 Dashboard
- Resumo do mês: renda, gastos, saldo e % poupado
- Alerta de despesas fixas pendentes no mês
- Top 3 maiores gastos
- Gastos recorrentes detectados automaticamente — com botão para adicionar às Fixas
- Últimos lançamentos
- Botão de compartilhar resumo mensal (texto ou clipboard)

### 📈 Gráficos
- Evolução mensal com barras de receita vs gastos
- Linha de tendência do saldo acumulado
- Pizza por categoria (acumulado ou por mês)

### 💰 Orçamento
- Limite mensal por categoria
- Barra de progresso visual
- Alerta automático ao ultrapassar

### 💸 Gastos
- Lançamento manual de despesas e receitas
- Parcelamento de compras no cartão
- Edição inline com swipe para deletar
- Filtro por mês, categoria e conta
- Paginação (50 por vez)

### 🏦 Reservas (Caixinhas)
- Separar dinheiro com propósito: emergência, viagem, férias...
- Histórico de depósitos e retiradas por caixinha
- Meta de valor por reserva

### 🛒 Mercado
- Registro de preços por produto e mercado
- Comparativo de preços entre mercados
- Histórico de variação de preço

### 🤖 IA (Gemini)
- Assistente financeiro pessoal com contexto real dos seus dados
- Análise de gastos, dicas e resposta a perguntas
- Resumo mensal automático gerado por IA
- Usa a API Gemini (chave configurável por usuário)

### ⚙️ Config
- Gerenciar contas bancárias
- Gerenciar categorias com orçamento e emoji
- Despesas fixas recorrentes com lançamento com 1 toque
- Meta de poupança mensal
- Importar extrato CSV (Nubank Conta, Nubank Cartão, Bradesco)
- Exportar/importar backup JSON completo
- Chave da API Gemini

---

## 🗂️ Estrutura do projeto

```
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
```

---

## 🚀 Como gerar o APK

O build é 100% automático via GitHub Actions. Basta dar push na branch `main`.

### Passo a passo

1. **Fork ou clone** este repositório no seu GitHub
2. Faça qualquer alteração e dê **push para `main`**
3. Vá em **Actions → Build APK → último run**
4. Baixe o artefato **`meu-financeiro-apk`**
5. Instale o `.apk` no Android (habilite "fontes desconhecidas" nas configurações)

### O que o pipeline faz

```
Checkout → npm install → vite build → Java 17 + Android SDK
→ Capacitor sync → Gerar ícones (Python/Pillow)
→ Adaptive icon XML → Gradle build → Upload APK
```

### Desenvolvimento local

```bash
npm install
npm run dev        # servidor local em http://localhost:5173
```

---

## 📥 Importação de extratos

O app importa CSV exportado diretamente dos apps/sites dos bancos:

| Banco | Fonte | Formato |
|-------|-------|---------|
| Nubank Conta | App Nubank → Extrato → Exportar | `Data,Valor,Identificador,Descrição` |
| Nubank Cartão | App Nubank → Fatura → Exportar | `date,title,amount` |
| Bradesco | Internet Banking → Extrato | Formato padrão Bradesco |

A categorização é automática — o app detecta o banco pelo cabeçalho do CSV e aplica regras de categorização por palavras-chave na descrição.

---

## 💾 Armazenamento local

Todos os dados ficam no `localStorage` do dispositivo:

| Chave | Conteúdo |
|-------|----------|
| `mf_exps` | Lançamentos (receitas e despesas) |
| `mf_cats` | Categorias personalizadas |
| `mf_contas` | Contas bancárias |
| `mf_fixas` | Despesas fixas recorrentes |
| `mf_reservas` | Caixinhas e histórico |
| `mf_mkts` | Mercados cadastrados |
| `mf_meta` | Meta de poupança |
| `mf_prods_extra` | Produtos extras do Mercado |
| `mf_precos` | Histórico de preços |
| `mf_gemini_key` | Chave da API Gemini |
| `mf_onboarding_done` | Flag de onboarding concluído |

> 💡 Use **Config → Dados → Exportar backup JSON** para não perder seus dados ao trocar de celular.

---

## 🤖 Configurando a IA

1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crie uma chave de API gratuita
3. No app: **⚙️ Config → Chave IA** → cole a chave
4. Pronto — o assistente já tem acesso aos seus dados financeiros

O modelo usado é `gemini-2.5-flash` (rápido e gratuito no tier free).

---

## 🛠️ Stack

| Camada | Tecnologia |
|--------|-----------|
| UI | React 18 + JSX inline styles |
| Build | Vite 5 |
| Mobile | Capacitor 5 |
| APK | Android Gradle (debug) |
| CI/CD | GitHub Actions |
| IA | Google Gemini API |
| Ícones | Python + Pillow (gerado no CI) |

---

## 📋 Changelog

### v1.0.0 — Março 2026
- 🎉 Versão inicial completa
- 7 abas: Dashboard, Gráficos, Orçamento, Gastos, Reservas, Mercado, IA
- Importação CSV Nubank e Bradesco
- Assistente IA com Gemini
- Backup/restore JSON
- Onboarding interativo (7 passos)
- Ícone personalizado gerado no CI
- Despesas fixas com lançamento com 1 toque
- Sugestão automática de recorrentes → Fixas
- Modais próprios (sem `window.confirm`)
- Datas seguras para Android (sem `toLocaleDateString`)

---

## 📄 Licença

Uso pessoal. Fique à vontade para adaptar para suas próprias finanças.
