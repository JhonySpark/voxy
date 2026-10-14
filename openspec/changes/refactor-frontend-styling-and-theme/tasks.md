# Tasks

## 1. Fundação de Design Tokens e Limpeza Inicial

- [x] 1.1 Criar a estrutura de diretórios `src/styles/tokens/` e arquivos `colors.css`, `typography.css`, `spacing.css`, `elevation.css` e `radii.css` com as variáveis oficiais do projeto, verificando sua criação no disco.
- [x] 1.2 Criar o tema semântico oficial `src/styles/themes/obsidian-mint.css` mapeando os tokens primitivos para as variáveis semânticas do projeto (`--bg-primary`, `--brand-primary`, etc.).
- [x] 1.3 Atualizar `src/index.css` para importar os tokens modulares e tema semântico, removendo código legado e excluindo o arquivo não utilizado `src/App.css`, verificando que o build não acusa imports quebrados.

## 2. Componentes Primitivos Compartilhados (Atomic UI)

- [x] 2.1 Criar o componente primitivo `Button` (`Button.tsx`, `Button.module.css`) em `src/components/common/Button/` com suporte a variantes (`primary`, `secondary`, `ghost`, `danger`) e tipagem TypeScript estrita, verificando a compilação do componente.
- [x] 2.2 Criar o componente primitivo `Input` (`Input.tsx`, `Input.module.css`) em `src/components/common/Input/` com suporte a estados de foco, borda sutil e ícones integrados, verificando a compilação do componente.
- [x] 2.3 Criar o componente primitivo `Card` (`Card.tsx`, `Card.module.css`) e `Badge` (`Badge.tsx`, `Badge.module.css`) em `src/components/common/`, verificando que consomem apenas variáveis de tema e não utilizam estilos inline.

## 3. Decomposição Modular do SettingsModal

- [x] 3.1 Criar a estrutura modular `src/components/SettingsModal/tabs/` e extrair a lógica e UI da aba de Voz/Áudio para `VoiceTab.tsx` com `VoiceTab.module.css`, eliminando todos os estilos inline.
- [x] 3.2 Extrair a aba de Conta e Segurança para `AccountTab.tsx` com `AccountTab.module.css`, removendo estilos inline e hexadecimais soltos.
- [x] 3.3 Extrair as abas de Aparência, Notificações e Atalhos para seus respectivos subcomponentes com CSS Modules.
- [x] 3.4 Refatorar o container principal `SettingsModal.tsx` para orquestrar as abas de forma declarativa (< 250 linhas) e remover a folha legada `SettingsModal.css`, verificando abertura e troca de abas sem erros.

## 4. Eliminação de Estilos Inline nas Telas Principais

- [x] 4.1 Refatorar `src/pages/Register.tsx`, substituindo todos os blocos `style={{ ... }}` e hexadecimais soltos por classes semânticas em `Register.module.css` e componentes primitivos (`Button`, `Input`).
- [x] 4.2 Refatorar `src/pages/Login.tsx`, migrando formulário e botões para `Login.module.css` e eliminando todos os estilos inline.
- [x] 4.3 Refatorar `src/pages/Dashboard.tsx`, eliminando estilos inline de containers e barras laterais em favor de classes de `Dashboard.module.css`.

## 5. Limpeza de Estilos Residuais e Governança

- [x] 5.1 Realizar varredura nos componentes de `src/features/voice/`, `src/features/servers/`, `src/features/friends/` e `src/features/chat/`, migrando os `style={{ ... }}` residuais para seus arquivos `.module.css` existentes.
- [x] 5.2 Adicionar ou ajustar regra de verificação no linter (`npm run lint` / `oxlint`) para sinalizar o uso de estilos inline arbitrários em arquivos `.tsx`.
- [x] 5.3 Executar `npm run build` para garantir conformidade de tipagem TypeScript, integridade do bundle Vite e ausência de regressões no build do Electron.
