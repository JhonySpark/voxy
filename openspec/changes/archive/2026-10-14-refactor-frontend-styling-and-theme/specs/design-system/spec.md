# Spec Delta

## Purpose

Define a arquitetura central de estilização, tokens de design e convenções de componentes do Voxy Frontend, garantindo consistência visual no tema Obsidian Mint, zero estilos inline e componentes atômicos desacoplados e tipados.

## ADDED Requirements

### Requirement: Design Tokens e Tema Obsidian Mint

O sistema MUST disponibilizar um conjunto padronizado e modular de Design Tokens através de variáveis CSS nativas organizadas por responsabilidade (cores primitivas, tipografia, espaçamento, elevação e tema semântico).

#### Scenario: Consumo de Tokens Semânticos em Componentes
- **WHEN** um componente ou CSS Module renderiza superfícies, textos ou bordas
- **THEN** deve utilizar exclusivamente as variáveis CSS semânticas padronizadas (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-accent`, `--text-primary`, `--text-secondary`, `--text-muted`, `--brand-primary`, `--brand-hover`, `--border-subtle`, `--glass-bg`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`) definidas em `src/styles/themes/obsidian-mint.css`.

#### Scenario: Suporte a Glassmorphism e Neon Bloom
- **WHEN** painéis flutuantes, modais ou popovers forem renderizados
- **THEN** devem incorporar as propriedades de glassmorphism (`backdrop-filter: blur(20px a 28px)` e fundo `--glass-bg`) e realce de brilho luminoso `--shadow-md` para elementos ativos de marca.

### Requirement: Política Estrita de Zero Inline Styles

Todos os componentes visuais MUST declarar suas propriedades de estilo em arquivos de estilo dedicados (`.module.css`), sendo terminantemente proibido o uso de `style={{ ... }}` em código JSX/TSX.

#### Scenario: Renderização de Estilos Visuais
- **WHEN** qualquer componente do frontend for construído ou refatorado
- **THEN** nenhuma regra visual estática (margens, paddings, flex, cores, fontes, tamanhos) deve residir no atributo `style`, devendo residir em classes no arquivo `<ComponentName>.module.css` correspondente.

#### Scenario: Valores Dinâmicos Contínuos de Runtime
- **WHEN** houver necessidade estrita de valores contínuos a 60fps calculados em tempo real (como coordenadas de drag-and-drop ou VU meter de áudio)
- **THEN** o componente deve injetar o valor preferencialmente via CSS variable local (ex: `style={{ '--vu-level': `${level}%` } as React.CSSProperties}`) consumida pelo CSS Module.

### Requirement: Kit de Componentes Primitivos de UI

O sistema MUST fornecer componentes primitivos reutilizáveis e totalmente tipados em `src/components/common/`, encapsulando acessibilidade, estados visuais e variações de tamanho.

#### Scenario: Renderização de Botão Padronizado
- **WHEN** uma ação for acionada na interface via componente `Button`
- **THEN** o botão deve suportar as variantes `primary` (neon emerald), `secondary` (glass panel), `ghost` e `danger`, com estados hover, active e disabled devidamente estilizados via `Button.module.css`.

#### Scenario: Renderização de Input e Campos de Formulário
- **WHEN** um formulário capturar dados do usuário via componente `Input`
- **THEN** o campo deve apresentar bordas sutis (`--border-subtle`), fundo translúcido (`--bg-secondary`), tipografia 'Inter' e anel de foco luminoso verde esmeralda (`--brand-primary`).

### Requirement: Decomposição Modular de Componentes Complexos

Componentes com complexidade arquitetural elevada ou superiores a 250 linhas MUST ser decompostos em subcomponentes atômicos com responsabilidade única e estilos isolados.

#### Scenario: Renderização do SettingsModal
- **WHEN** o usuário abrir o modal de configurações
- **THEN** cada seção de configuração (Voz/Áudio, Conta/Segurança, Aparência/Tema, Notificações, Atalhos) deve ser um subcomponente isolado, com interface TypeScript própria e arquivo de estilo `.module.css` dedicado, eliminando a dependência do arquivo legado `SettingsModal.css`.
