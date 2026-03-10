# Granzo 💰

> Seu dinheiro, do seu jeito.

![Version](https://img.shields.io/badge/versão-1.0.0-818cf8) ![Platform](https://img.shields.io/badge/plataforma-Android-4ade80) ![Stack](https://img.shields.io/badge/stack-React%20%2B%20Capacitor-6095FF)

App de finanças pessoais mobile, construído com React + Capacitor. Categorização inteligente via Gemini AI, importação de extratos CSV do Nubank, e controle completo de gastos, investimentos e reservas.

---

## Funcionalidades

**Dashboard** — visão geral do mês com saldo, poupança, projeção, gastos por conta e meta de economia

**Gráficos** — pizza por categoria, evolução mensal de renda vs gastos, top gastos

**Orçamento** — limite por categoria com barra de progresso e alertas

**Gastos** — lançamentos manuais com swipe para editar/excluir, filtros por mês e categoria

**Mercado** — lista de compras com controle de preços históricos

**IA** — chat com Gemini para análise e sugestões personalizadas

**Config** — importação CSV, despesas fixas, metas, contas, categorias, backup/restore

---

## Gerar o APK

O build roda automaticamente via GitHub Actions a cada push na `main`.

1. Faça push para `main`
2. Acesse **Actions → Build APK → granzo-apk**
3. Baixe o artefato `granzo-apk.zip` e instale o `.apk` no Android

### Build local
```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## Importação CSV

| Banco   | Como exportar |
|---------|--------------|
| Nubank  | App → Perfil → Extratos → Exportar CSV |

Campos reconhecidos: `Data`, `Descrição`, `Valor`

---

## Stack

- **React 18** + Vite
- **Capacitor 5** (Android)
- **Gemini 2.5 Flash** (IA)
- **GitHub Actions** (CI/CD)
- **Pillow** (geração de ícones)

---

## Changelog

### v1.0.0
- Dashboard com saldo, poupança, projeção e meta
- Importação CSV Nubank com deduplicação
- Categorização automática com regras + IA
- Despesas Fixas com lançamento em 1 toque
- Onboarding de 7 passos
- Reservas financeiras
- Acompanhamento de mercado
- Backup/restore JSON
- Ícone gerado via Python/Pillow no CI
- Rebranding: Granzo (`app.granzo.finance`)
