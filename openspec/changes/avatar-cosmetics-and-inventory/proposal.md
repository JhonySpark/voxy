# Proposal: Avatar Cosmetics and Inventory System

## Why

Atualmente, o Voxy oferece apenas customização básica de avatar e banner estático, sem itens cosméticos ou elementos visuais colecionáveis como molduras animadas/estilizadas. Para aumentar o engajamento comunitário, premiar os primeiros usuários do período Beta ("Obsidian Pioneer") e preparar a arquitetura para uma futura loja virtual de itens cosméticos, é necessário criar um sistema unificado de inventário e renderização de molduras de avatar com alta performance e identidade visual Obsidian Mint.

## What Changes

- **Sistema de Inventário e Catálogo de Cosméticos**: Estruturação de dados no backend/Prisma com `CosmeticItem` e `UserCosmetic`, além de campo desnormalizado no `User` para carregamento de alta performance (`equippedFrameSlug`).
- **Endpoints de Inventário e Equipamento**: Adição de rotas de consulta (`GET /cosmetics/inventory`) e equipamento (`POST /cosmetics/equip`) com validação de posse do item no backend.
- **Componente Unificado `<Avatar />` e `<AvatarFrame />`**: Centralização da renderização de avatar em camada quádrupla (moldura, status dot, imagem com recorte circular e efeito de respiração/pulso neon) substituindo renderizações duplicadas em `UserProfileModal`, `ParticipantCard`, `VoiceRoom` e sidebars.
- **Moldura Exclusiva de Beta Tester ("Obsidian Pioneer")**: Concessão automática da moldura lendária de fundador para todos os usuários pioneiros durante a fase Beta do Voxy, indisponível para aquisição posterior.
- **Conjunto Inicial Gratuito de Molduras**: Disponibilização imediata de 3 molduras iniciais acessíveis a todos os usuários (`neon-mint`, `cyber-circuit`, `cosmic-violet`).
- **Interface de Customização no Perfil**: Adição de seletor visual de molduras com preview em tempo real nas configurações de perfil do usuário.
- **Sincronização em Tempo Real**: Atualização instantânea de molduras equipadas via socket `USER_PROFILE_UPDATED` em chat, canais de voz e lista de servidores/membros.

## Capabilities

### New Capabilities
- `avatar-cosmetics`: Gerenciamento de catálogo, inventário de itens estéticos, equipamento de molduras de avatar e renderização consistente de alta performance com temas do Voxy.

### Modified Capabilities
<!-- Nenhuma especificação durável existente sofre quebra de contrato de requisitos. -->

## Impact

- **Arquitetura de Features (Frontend)**:
  - Novo módulo reutilizável `src/components/common/Avatar/` (`Avatar.tsx`, `AvatarFrame.tsx`, `Avatar.module.css`).
  - Nova aba/seção em `src/features/user/components/SettingsModal/tabs/ProfileTab.tsx` ou modal de edição de perfil.
  - Refatoração dos pontos de renderização dispersos (`ParticipantCard`, `UserProfileModal`, etc.) para o componente unificado.
  - Respeito estrito aos tokens de CSS do tema Obsidian Mint (`--brand-primary`, `--bg-secondary`, `--border-subtle`, `--shadow-md`) e proibição absoluta de estilos inline.
- **Backend & Banco de Dados**:
  - Modelo Prisma atualizado com `CosmeticItem`, `UserCosmetic` e relação com `User`.
  - Migração de banco e script de seed para cadastrar as 4 molduras iniciais e distribuir a moldura do Beta para usuários existentes.
- **Internacionalização (i18n)**:
  - Adição de novas chaves semânticas de catálogo e inventário (`user.cosmetics.*`, `cosmetics.rarity.*`, `cosmetics.frames.*`) garantindo paridade estrita nos arquivos `pt.json`, `en.json` e `es.json`.
