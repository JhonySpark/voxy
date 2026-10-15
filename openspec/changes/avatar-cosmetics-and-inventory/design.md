# Design: Avatar Cosmetics and Inventory System

## Context

Veja `proposal.md` para a motivação. Atualmente, os avatares são renderizados com tags `<img>` e divs circulares repetidas em múltiplos componentes (`ParticipantCard`, `UserProfileModal`, etc.). Não há registro no banco de dados para itens cosméticos ou inventário de usuários. O projeto adota arquitetura Hexagonal/Clean Architecture, CSS Modules, TypeScript estrito e o design system Obsidian Mint.

## Goals / Non-Goals

**Goals:**
- Projetar modelo de dados no Prisma com `CosmeticItem` e `UserCosmetic` já compatível com a futura loja virtual.
- Desnormalizar `equippedFrameSlug` em `User` para garantir latência mínima ao carregar listas de membros e participantes de voz.
- Criar o componente centralizado `src/components/common/Avatar/` com `<Avatar />` e `<AvatarFrame />` consumindo CSS Modules (`Avatar.module.css`) e tokens do tema (`--brand-primary`, `--bg-secondary`, `--shadow-md`, etc.).
- Armazenar assets das molduras em `frontend/public/cosmetics/frames/` no formato WebP / SVG com camada de animação e bloom CSS.
- Fornecer 4 molduras iniciais (1 Lendária de Beta Tester e 3 Gratuitas).

**Non-Goals:**
- Implementação de gateway de pagamento ou compra de moedas (escopo da futura loja).
- Efeitos de perfil de tela cheia ou banners animados (Fase 2).
- Upload de molduras customizadas por usuários comuns (apenas molduras oficiais do sistema).

## Decisions

### 1. Modelagem Relacional no Prisma e Desnormalização Estratégica
- **Decisão:** Criar as tabelas `CosmeticItem` e `UserCosmetic`, adicionando `equippedFrameSlug` (string nula) diretamente na tabela `User`.
- **Por que:** Evita joins custosos na tabela de inventário toda vez que o app busca mensagens de chat ou participantes de canal de voz. O inventário só é consultado quando o usuário abre as configurações de customização.
- **Alternativa Descartada:** Fazer join com `UserCosmetic WHERE isEquipped = true` em todas as consultas de usuário (prejudicaria a performance em servidores grandes).

### 2. Formato dos Assets e Camadas de Animação
- **Decisão:** Assets salvos em `frontend/public/cosmetics/frames/<slug>.webp` (ou `.svg`), renderizados em camada absoluta sobre o avatar (`pointer-events: none`). Efeitos de respiração e brilho neon são aplicados via classes CSS dedicadas (`.frameGlowPulse`, `.frameNeonMint`, etc.).
- **Por que:** Desempenho nativo a 60 FPS, sem custo de processamento JavaScript, e facilidade para adicionar artes estáticas ou em loop geradas por IA.
- **Alternativa Descartada:** Animações baseadas em Canvas ou Lottie pesado para cada avatar (consumiria muita memória em canais com 30+ pessoas).

### 3. Componente Unificado `<Avatar />`
- **Decisão:** Criar `src/components/common/Avatar/Avatar.tsx` e `AvatarFrame.tsx` com variações de tamanho padronizadas (`xs: 24px`, `sm: 32px`, `md: 40px`, `lg: 56px`, `xl: 80px`, `xxl: 120px`).
- **Por que:** Elimina duplicação de código, garante consistência no corte circular, posicionamento exato do `StatusDot` e aplicação uniforme da moldura.

### 4. Distribuição Automática da Moldura Beta
- **Decisão:** Na migração e no registro de novos usuários enquanto a flag de ambiente/configuração `IS_BETA_PERIOD = true` estiver ativa, conceder automaticamente a moldura `beta-pioneer` no `UserCosmetic`.
- **Por que:** Assegura que nenhum usuário ativo no período de testes perca sua recompensa exclusiva de fundador.

## Risks / Trade-offs

- **[Risco: Overflow visual em listas densas]** → A moldura se projeta ligeiramente (~15-20%) para fora da caixa do avatar. *Mitigação:* Usar `padding` compensatório nos wrappers ou `overflow: visible` controlado sem sobrepor textos adjacentes.
- **[Risco: Cache de imagens de molduras]** → Se um asset for atualizado, o navegador pode manter cache antigo. *Mitigação:* Utilizar versionamento ou hash no caminho do asset público caso necessário.

## Migration Plan

1. Executar migração do Prisma (`npx prisma migrate dev --name add_cosmetics_and_inventory`).
2. Executar script de seed para criar as 4 molduras iniciais e distribuir a moldura `beta-pioneer` aos usuários já cadastrados no banco.
3. Disponibilizar endpoints e testar no Postman/frontend.
4. Implementar componentes frontend e integrar no modal de perfil.
