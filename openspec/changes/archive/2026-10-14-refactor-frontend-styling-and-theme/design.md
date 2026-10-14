# Design

## Context

O Voxy Frontend utiliza React 19, TypeScript e Vite no ecossistema Electron. A estilização visual é baseada no conceito "Obsidian Mint" (fundo escuro profundo, translúcido com glassmorphism e acentos em verde esmeralda luminoso). Conforme descrito em `proposal.md`, a arquitetura atual sofre com classes globais excessivas em `src/index.css` (1.570 linhas), estilos inline (`style={{ ... }}`) dispersos em 28 arquivos e ausência de uma biblioteca de componentes primitivos compartilhados, o que leva à duplicação de regras visuais.

## Goals / Non-Goals

**Goals:**
- Estruturar a pasta `src/styles/` contendo Design Tokens modulares em CSS nativo puro (Zero Runtime Overhead, essencial para desktop a 60fps/4k).
- Criar a camada de componentes primitivos reutilizáveis em `src/components/common/` (`Button`, `Input`, `Badge`, `Card`, `IconButton`), consumindo unicamente tokens semânticos.
- Refatorar monólitos (`SettingsModal.tsx`, `Register.tsx`, `Login.tsx`, etc.) substituindo todos os estilos inline por CSS Modules (`.module.css`).
- Decompor o `SettingsModal.tsx` em abas e componentes atômicos dedicados, aposentando o `SettingsModal.css`.
- Remover arquivos mortos (`src/App.css`) e enxugar o `src/index.css`.

**Non-Goals:**
- Adicionar frameworks de estilização em tempo de execução (como Tailwind, Styled Components ou Emotion) que adicionem overhead de runtime ou parsing durante chamadas WebRTC em tempo real.
- Alterar a paleta visual ou branding existente: a estética "Obsidian Mint" será rigorosamente preservada e apenas formalizada tecnicamente.
- Reescrever a lógica de negócio dos componentes (WebRTC, LiveKit, IPC, autenticação).

## Decisions

### Decisão 1: Design Tokens em CSS Nativo puro via CSS Variables
- **Escolha**: Criar `src/styles/tokens/` (`colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `radii.css`) e o tema semântico `src/styles/themes/obsidian-mint.css`.
- **Por que**: Não introduz dependências externas, tem performance nativa imediata no Chromium/Electron, permite hot-reloading instantâneo no Vite e viabiliza futuros temas (ex: OLED/Midnight) apenas trocando atributos de dataset (`data-theme="obsidian-mint"`).
- **Alternativas consideradas**:
  - *Tailwind CSS*: Rejeitado para respeitar a convenção do projeto de CSS Modules e evitar atrito com regras existentes.
  - *CSS-in-JS (Styled Components/Emotion)*: Rejeitado por penalizar renderização a 60fps no desktop e incompatibilidade com React 19 sem compilação especial.

### Decisão 2: CSS Modules (`<ComponentName>.module.css`) para escopo de estilo
- **Escolha**: Todo novo componente e componente refatorado deve ter seu arquivo `.module.css` no mesmo diretório.
- **Por que**: Garante isolamento estrito de classes, elimina vazamentos de seletores globais e tem suporte nativo de primeira classe no Vite e TypeScript.
- **Alternativas consideradas**:
  - *BEM naming em CSS global*: Propenso a erros humanos e requer nomes de classes longos e frágeis.

### Decisão 3: Criação de Primitivos Atômicos em `src/components/common/`
- **Escolha**: Implementar primitivos tipados para botões (`Button`), inputs de texto (`Input`), badges de status (`Badge`) e cartões (`Card`).
- **Por que**: Mais de 70% dos estilos inline encontrados consistiam em ajustes repetidos de padding, bordas arredondadas, cores de background e efeitos de foco em botões e inputs nativos HTML. Ao fornecer primitivos polidos, o código dos formulários e modais torna-se declarativo e limpo.

### Decisão 4: Decomposição Modular do `SettingsModal`
- **Escolha**: Dividir o arquivo de 1.211 linhas em subpastas:
  - `src/components/SettingsModal/SettingsModal.tsx` (shell do diálogo)
  - `src/components/SettingsModal/tabs/VoiceTab.tsx`
  - `src/components/SettingsModal/tabs/AccountTab.tsx`
  - `src/components/SettingsModal/tabs/AppearanceTab.tsx`
  - `src/components/SettingsModal/tabs/NotificationsTab.tsx`
  - `src/components/SettingsModal/tabs/KeybindsTab.tsx`
  Cada aba com seu respectivo `.module.css`.
- **Por que**: Cumpre o requisito do projeto de componentes com menos de 250 linhas e separa as responsabilidades de IPC de áudio, alteração de senha e controles visuais.

## Risks / Trade-offs

- **[Risco de Regressão Visual durante a migração]** → *Mitigação*: Refatoração por fases incrementais, mantendo tokens com os mesmos valores hexadecimais do `index.css` atual e testando cada modal e tela no fluxo de build (`npm run build`).
- **[Conflito de especificidade durante migração gradual]** → *Mitigação*: Ao migrar uma tela para CSS Modules, remover as classes antigas de `index.css` para evitar duplicidade de estilos competitivos.
- **[Tamanho do Diff]** → *Mitigação*: Separar a implementação em blocos de tarefas claramente delimitadas: 1) Camada de Tokens e Primitivos, 2) Decomposição do SettingsModal, 3) Telas de Auth (Register/Login), 4) Telas e Painéis centrais (Dashboard/VoiceRoom).

## Migration Plan

1. **Fase 1 - Fundação de Tokens**:
   - Criar `src/styles/tokens/` e `src/styles/themes/obsidian-mint.css`.
   - Importar em `src/index.css`.
   - Excluir o arquivo não utilizado `src/App.css`.
2. **Fase 2 - Componentes Primitivos**:
   - Criar `Button`, `Input`, `Card` e `Badge` em `src/components/common/`.
3. **Fase 3 - Refatoração do SettingsModal**:
   - Decompor em abas com CSS Modules, removendo `SettingsModal.css` e todos os estilos inline.
4. **Fase 4 - Limpeza de Telas de Autenticação e Dashboard**:
   - Eliminar estilos inline de `Register.tsx`, `Login.tsx` e `Dashboard.tsx`.
5. **Fase 5 - Limpeza Residual e Validação**:
   - Remover estilos inline pontuais em `src/features/*`.
   - Enxugar regras redundantes de `src/index.css`.
   - Executar `npm run build` e validação no Electron.
