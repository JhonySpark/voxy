# Proposal: Complete App Internationalization (i18n)

## Why

Atualmente, o Voxy apresenta internacionalização parcial: mais de 100 chaves de tradução são chamadas no código com textos de fallback em português (`t('key', 'Texto em PT')`) que nunca foram registrados no dicionário de traduções, além de 24 arquivos contendo strings diretamente chumbadas no JSX sem passar pela função `t()`. Quando o usuário troca o idioma para Inglês ou Espanhol, o aplicativo continua exibindo trechos significativos em português. Esta mudança unifica e completa a cobertura multilíngue em todo o aplicativo (PT, EN e ES), migrando a arquitetura para dicionários modulares JSON (`src/locales/`).

## What Changes

- **Arquitetura Modular de Idiomas**:
  - Extração dos dicionários de tradução de `src/i18n.ts` para arquivos JSON dedicados:
    - `src/locales/pt.json` (Português - Brasil)
    - `src/locales/en.json` (Inglês - US)
    - `src/locales/es.json` (Espanhol)
  - Refatoração do `src/i18n.ts` para atuar puramente como inicializador e configurador do i18next, importando os arquivos JSON de forma tipada e enxuta.

- **Remoção de Strings Hardcoded e Padronização de Chaves**:
  - Eliminação de fallbacks em português chumbados nos pontos de chamada (`t('key', 'Texto')` -> `t('key')`).
  - Cobertura completa de strings brutas de JSX em todos os módulos:
    - **Configurações e Abas (`src/components/SettingsModal/tabs/`)**: `NotificationsTab` (100% dos switches, avisos e títulos), `AccountTab` (sinais etários WinRT/ECA, badges de idade, formulários de segurança), `VoiceTab` (badges de DSP, dispositivos padrão) e `AppearanceTab` (tags de tema ativo).
    - **Servidores e Canais (`src/features/servers/`)**: `ServerSettingsModal` (moderação, cargos, permissões, auditoria, zona de perigo), `ServerMembersSidebar`, `ChannelList`, `CreateServerModal`.
    - **Usuário e Modais (`src/features/user/`, `src/features/moderation/`)**: `EditProfileModal`, `UserProfileModal`, `UserPopout`, `ReportModal`.
    - **Áudio, Vídeo e Chat (`src/features/voice/`, `src/features/chat/`)**: `ShareScreenModal`, `MaximizedStreamView`, `StreamSettingsMenu`, `ChatArea`.
    - **Autenticação e Registro (`src/pages/`)**: `Register.tsx` (consentimento de pais/responsáveis, conformidade ANPD/ECA), `BetaWelcomeModal.tsx`, diálogos globais.

- **Sincronização Total PT, EN e ES**:
  - Adição das chaves de erro ausentes no idioma Espanhol (`errors.AUTH_BETA_LIMIT_REACHED`, `errors.AUTH_TERMS_NOT_ACCEPTED`).
  - Garantia de paridade 1:1 de todas as chaves entre os três idiomas.

## Capabilities

### New Capabilities
- `internationalization`: Cobertura completa, sincronização estrita e infraestrutura de carregamento modular de traduções (PT, EN e ES) em todo o ecossistema do frontend do Voxy.

### Modified Capabilities
<!-- Nenhuma capability existente anterior -->

## Impact

- **Código e Arquitetura**:
  - Novo diretório: `src/locales/` contendo `pt.json`, `en.json` e `es.json`.
  - Refatoração de `src/i18n.ts`.
  - Modificações pontuais em componentes JSX em `src/components/`, `src/features/` e `src/pages/` para utilizar exclusivamente `t('chave')`.
- **Estilização e Design System**:
  - Zero alteração na paleta de cores ou tokens: total conformidade com o tema Obsidian Mint (`index.css`) e CSS Modules (`.module.css`).
  - Nenhuma injeção de estilos inline (`style={{}}`).
- **Compatibilidade e Build**:
  - `npm run build` deve compilar sem nenhum aviso de tipagem ou ausência de imports JSON.
