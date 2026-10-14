# Proposal

## Why

A estilização do frontend do Voxy acumulou débito técnico através de um arquivo global monolítico (`src/index.css` com mais de 1.570 linhas), estilos inline (`style={{ ... }}`) dispersos em mais de 28 arquivos e monólitos com regras visuais acopladas e cores hexadecimais arbitrariamente declaradas. Para suportar a evolução rápida do produto, manter a experiência visual "Obsidian Mint" impecável a 60fps/4k no desktop e garantir facilidade de manutenção e escalabilidade da equipe, é necessário estabelecer um Design System formal em camadas (Tokens -> Tema Semântico -> Componentes Primitivos -> Features em CSS Modules) e eliminar completamente estilos inline.

## What Changes

- **Camada de Design Tokens Modularizada**: Extração e estruturação de tokens em `src/styles/tokens/` (`colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `radii.css`) e definição formal do tema em `src/styles/themes/obsidian-mint.css`.
- **Eliminação de Estilos Inline**: Remoção de todas as declarações `style={{ ... }}` existentes em telas e componentes (especialmente `SettingsModal`, `Register`, `Login`, `Dashboard` e `VoiceRoom`), transferindo para classes dedicadas de CSS Modules (`.module.css`).
- **Kit de Componentes Primitivos Reutilizáveis**: Criação ou consolidação de primitivos acessíveis e desacoplados em `src/components/common/` (`Button`, `Input`, `Badge`, `Card`, `IconButton`), consumindo estritamente os tokens de tema.
- **Decomposição Modular de Componentes Gigantes**: Refatoração do `SettingsModal.tsx` (>1.200 linhas) em subcomponentes atômicos e tabs isoladas em `src/features/settings/` (ou `src/components/SettingsModal/`), cada qual com seu respectivo `.module.css`.
- **Limpeza do `index.css` e Remoção de Código Morto**: Exclusão do `App.css` (código não utilizado do Vite) e enxugamento do `index.css`, preservando apenas resets, fontes e variáveis globais, migrando classes acopladas para seus respectivos domínios em `src/features/`.
- **Regra de Lint e Governança**: Garantia de integridade contínua no linter (`oxlint` / TypeScript) para barrar estilos inline arbitrários em novos desenvolvimentos.

## Capabilities

### New Capabilities
- `design-system`: Especifica os contratos dos tokens de design (primitivos, semânticos e de componente), tipografia ('Space Grotesk' e 'Inter'), tokens de elevação e glassmorphism, bem como as diretrizes de estilização com CSS Modules e a política estrita de zero estilos inline.

### Modified Capabilities
<!-- Nenhuma especificação anterior existe no repositório. -->

## Impact

- **Código Afetado**:
  - `src/index.css`: Reduzido drasticamente para atuar apenas como importador de tokens e reset.
  - `src/App.css`: Removido do repositório.
  - `src/styles/`: Criação da arquitetura central de tokens e temas.
  - `src/components/common/`: Novos componentes primitivos de UI.
  - `src/components/SettingsModal.tsx` e `SettingsModal.css`: Decomposição e migração para CSS Modules.
  - `src/pages/Register.tsx`, `src/pages/Login.tsx`, `src/pages/Dashboard.tsx`: Limpeza de estilos inline e refatoração para CSS Modules.
  - `src/features/*`: Migração pontual de estilos inline residuais para seus arquivos `.module.css` existentes.
- **APIs & Dependências**: Nenhuma dependência externa pesada necessária (zero runtime overhead via CSS nativo e CSS Modules padrão do Vite).
- **Internacionalização (i18n)**: Preservação e cobertura de todas as strings visíveis dos componentes refatorados nas línguas PT, EN e ES em `src/i18n.ts`.
