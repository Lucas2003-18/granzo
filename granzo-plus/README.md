# Granzo Plus (Granzo2)

Assistente financeiro pessoal, um usuário só: coleta diária do MeuPluggy (Nubank primeiro),
banco local SQLCipher e bot Discord próprio. Specs e decisões vivem no Collab-Hub
(`10-Projects/Granzo2/`: ESCOPO, SPEC-01..05, TASKS). **Nenhum dado financeiro vai para este repo nem para o vault.**

> Vive em `granzo-plus/` na branch `granzo-plus` para não tocar o app Android legado.
> A SPEC-02 prevê repositório separado: quando for ao ar, mover esta pasta (`git subtree split`).

## Rodar testes
```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

## Status por sprint
| Sprint | Estado | Observação |
|---|---|---|
| 0 Fundação segura | ✅ código pronto | Dockerfile/compose endurecidos, SQLCipher, logs mascarados, `scripts/check_security.sh`. **Falta**: build/`docker compose up` no NUC |
| 1 Pluggy | 🟡 código + testes com mock | Auth, accounts, `/v2/transactions` com cursor, 1ª carga completa, upsert, log de execução. **Falta validar contra API real** (itens `VALIDAR` em `services/pluggy.py` e `normalize.py`) |
| 2 Modelo financeiro | 🟡 | Compra de cartão = despesa; pagamento de fatura fora dos totais (testado). **Falta**: preencher `credit_card_bills`/`bill_payments` (depende do endpoint de faturas) |
| 3 Migração Granzo | 🟡 esqueleto | `services/migrate_granzo.py`; chaves do JSON assumidas. **Falta** backup novo e dedupe contra histórico Pluggy (risco de dupla contagem) |
| 4 Diário + comandos | 🟡 | Diário + `/saldo /resumo /gastos /categorizar /orcamento /sync` (efêmeros, só dono, cooldown no /sync). **Falta**: testar no Discord real |
| 5 Mensal | 🟡 | Dia 1 às 08:00: entradas/saídas sem transferências, top categorias com variação, maiores gastos, assinaturas, estouros e frase de leitura. **Falta**: ver no Discord real |
| 6 Alertas | 🟡 | Uma mensagem consolidada após o diário: orçamento 80%/100%, fora do padrão (média+2dp e estabelecimento novo ≥R$300), assinatura nova, duplicada (<48h), projeção dias 15/25, sync >48h. Cada alerta dispara uma vez (`alertas_enviados`). Limiares são constantes em `services/alerts.py` |

## Decisões de implementação (além das specs)
- `Pix/transferência recebida` **não** vira salário (bug do legado): fica `inc_type='a_classificar'`.
- Regras `^pix`/`^ted` (→ ignorar) valem só para **saídas**.
- Entradas e saídas "fora dos totais" = `inc_type='transferencia'` ou `eh_pagamento_fatura=1`.
- Categoria `manual` nunca é sobrescrita por re-sync.
- LLM: só a interface e o payload (somente descrição) estão prontos; chamada real ao Gemini fica para quando houver chave.
- Chave do banco: Docker secret (`DB_KEY_FILE`), mín. 32 caracteres; nunca no `.env` em produção.

Ver `docs/RUNBOOK.md` para rotação de segredos e revogação do consentimento.
