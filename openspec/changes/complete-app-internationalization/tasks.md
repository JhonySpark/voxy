# Tasks

## 1. Estruturação Modular de Locales e Configuração do i18n

- [x] 1.1 Criar diretório `src/locales/` e arquivos `pt.json`, `en.json` e `es.json` migrando as 223 chaves existentes do `src/i18n.ts` com validação de paridade inicial.
- [x] 1.2 Mapear e adicionar todas as ~120 novas chaves identificadas (user, settings, servers, channels, voice, moderation, errors) nos três arquivos `pt.json`, `en.json` e `es.json`.
- [x] 1.3 Refatorar `src/i18n.ts` para importar diretamente os arquivos JSON e configurar o i18next de forma concisa e tipada.
- [x] 1.4 Criar script de checagem de paridade de chaves e verificar ausência de discrepâncias entre os idiomas.

## 2. Refatoração de Internacionalização: Configurações do Sistema

- [x] 2.1 Refatorar `SettingsModal.tsx` e `AppearanceTab.tsx` garantindo tradução dinâmica dos seletores e tags visuais do tema sem estilos inline.
- [x] 2.2 Refatorar `NotificationsTab.tsx` convertendo todos os cards, descrições, sons e switches de background em chamadas `t('settings.notifications.*')`.
- [x] 2.3 Refatorar `AccountTab.tsx` substituindo fallbacks e textos literais de proteção de menores (ECA/WinRT), badges de idade e formulário de senha por `t('user.*')`.
- [x] 2.4 Refatorar `VoiceTab.tsx` e `KeybindsTab.tsx` padronizando labels de dispositivos padrão, testes de áudio e badges de DSP via `t('settings.*')`.

## 3. Refatoração de Internacionalização: Servidores, Canais e Moderação

- [x] 3.1 Refatorar `ServerSettingsModal.tsx` substituindo 32 ocorrências de strings hardcoded de visão geral, cargos, banimentos, auditoria e zona de perigo por `t('server.*')`.
- [x] 3.2 Refatorar `ServerMembersSidebar.tsx` e `ChannelList.tsx` padronizando cabeçalhos de membros, roles e opções de contexto.
- [x] 3.3 Refatorar `CreateServerModal.tsx` e `ReportModal.tsx` para cobrir todos os fluxos de criação e denúncias de moderação.

## 4. Refatoração de Internacionalização: Usuário, Voz, Streaming e Chat

- [x] 4.1 Refatorar `EditProfileModal.tsx`, `UserProfileModal.tsx`, `UserPopout.tsx` e `UserProfileBar.tsx` eliminando fallbacks hardcoded em português.
- [x] 4.2 Refatorar `ShareScreenModal.tsx`, `MaximizedStreamView.tsx` e `StreamSettingsMenu.tsx` traduzindo resoluções, fps e opções de captura.
- [x] 4.3 Refatorar `ChatArea.tsx` e componentes auxiliares traduzindo cabeçalhos e mensagens de boas-vindas do canal.

## 5. Refatoração de Internacionalização: Páginas de Entrada e Modais Globais

- [x] 5.1 Refatorar `Register.tsx` traduzindo avisos de verificação etária, consentimento de responsáveis e mensagens de validação.
- [x] 5.2 Refatorar `Login.tsx`, `Dashboard.tsx`, `BetaWelcomeModal.tsx` e `DialogContext.tsx` removendo fallbacks residuais.

## 6. Validação, Paridade e Build

- [x] 6.1 Executar script de validação de paridade garantindo que 100% das chaves existam igualmente em `pt.json`, `en.json` e `es.json`.
- [x] 6.2 Executar `npm run build` no frontend verificando ausência de erros de compilação, tipos TypeScript e bundling de JSON.
