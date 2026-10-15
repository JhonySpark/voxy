# Tasks: Avatar Cosmetics and Inventory System

## 1. Contratos, Modelagem e Backend

- [x] 1.1 Criar modelos Prisma `CosmeticItem` e `UserCosmetic`, adicionar campo `equippedFrameSlug` em `User` e gerar migração com `npx prisma migrate dev`
- [x] 1.2 Criar script de seed com as 4 molduras iniciais (`beta-pioneer`, `neon-mint`, `cyber-circuit`, `cosmic-violet`) e concessão automática da moldura `beta-pioneer` para usuários existentes
- [x] 1.3 Implementar endpoints REST no backend (`GET /cosmetics/inventory` e `POST /cosmetics/equip`) e emitir evento `USER_PROFILE_UPDATED` via socket ao equipar

## 2. Tipagens e Custom Hooks no Frontend

- [x] 2.1 Definir interfaces TypeScript para cosméticos em `src/core/types/cosmetic.types.ts` (`CosmeticItem`, `UserCosmetic`, `EquipCosmeticPayload`)
- [x] 2.2 Criar hook `useCosmetics` em `src/features/user/hooks/useCosmetics.ts` para carregar inventário, gerenciar preview de seleção e disparar mutação de equipamento

## 3. Componentes Visuais e Assets

- [x] 3.1 Adicionar assets das molduras em `frontend/public/cosmetics/frames/` (`beta-pioneer.webp`, `neon-mint.webp`, `cyber-circuit.webp`, `cosmic-violet.webp`)
- [x] 3.2 Criar componente `src/components/common/Avatar/AvatarFrame.tsx` com variações de escala e classes de bloom CSS
- [x] 3.3 Criar componente unificado `src/components/common/Avatar/Avatar.tsx` e `Avatar.module.css` integrando corte circular, moldura e `StatusDot` sem uso de estilos inline

## 4. Integração na UI e Internacionalização

- [x] 4.1 Adicionar seletor interativo de molduras com preview ao vivo na aba de perfil em `src/features/user/components/UserProfileModal/` ou modal de configurações
- [x] 4.2 Atualizar componentes de exibição (`ParticipantCard`, `VoiceRoom`, `UserProfileModal`) para utilizarem o novo `<Avatar />` unificado
- [x] 4.3 Cadastrar todas as chaves de internacionalização de cosméticos e raridades em `src/locales/pt.json`, `src/locales/en.json` e `src/locales/es.json`

## 5. Validação e Qualidade

- [x] 5.1 Executar validação de paridade de tradução com `npm run validate:i18n` e garantir 0 erros
- [x] 5.2 Executar build completo do frontend com `npm run build` e verificar integridade visual e ausência de estilos inline
