# internationalization Specification

## Purpose
Fornecer infraestrutura modular e cobertura completa de internacionalização (i18n) para o Voxy Frontend, garantindo suporte sincronizado em tempo real aos idiomas Português (pt), Inglês (en) e Espanhol (es), eliminando strings hardcoded e fallbacks órfãos em todo o aplicativo.

## Requirements

### Requirement: Modular Translation Resource Architecture
The application MUST load translation dictionaries from dedicated JSON files located in `src/locales/{pt,en,es}.json`, imported directly into the i18next configuration (`src/i18n.ts`), guaranteeing strict 100% key parity across all three supported languages.

#### Scenario: Sincronização e Carregamento de Recursos
- **WHEN** o aplicativo inicializa
- **THEN** o i18next carrega os recursos dos arquivos `pt.json`, `en.json` e `es.json` sem dependência de strings chumbadas em TS.
- **AND** nenhuma chave existente em um idioma deve estar ausente nos demais idiomas suportados.

### Requirement: Strict Internationalization Usage in Components
All user-visible UI text (buttons, labels, headers, error messages, feedback alerts, placeholders, tooltips) MUST be retrieved strictly through `t('namespace.key')` without raw JSX strings or inline hardcoded fallbacks.

#### Scenario: Renderização de Textos Traduzidos
- **WHEN** um componente JSX renderiza um elemento com texto
- **THEN** o conteúdo exibido é obtido estritamente via `t('chave')`.
- **AND** não há strings de fallback em português mascarando chaves inexistentes.

### Requirement: Dynamic Language Switching Reactivity
The application MUST reactively and immediately update all mounted components, active modals, and popovers upon language selection in Appearance settings, persisting user selection in local storage.

#### Scenario: Alteração de Idioma pelo Usuário
- **WHEN** o usuário seleciona um novo idioma na aba de Aparência (`pt`, `en` ou `es`)
- **THEN** a função `i18n.changeLanguage()` é disparada.
- **AND** todos os componentes re-renderizam imediatamente no idioma escolhido sem exigir recarregamento da aplicação.
- **AND** a preferência é gravada na chave de armazenamento local configurada.

### Requirement: Full Domain Coverage
All application modules MUST have complete translations across Portuguese, English, and Spanish without residual language leakage.

#### Scenario: Acesso a Qualquer Módulo Traduzido
- **WHEN** o usuário navega para a aba de Notificações, Modal de Servidor, Transmissão ou Registro em Inglês ou Espanhol
- **THEN** 100% dos textos exibidos são apresentados no idioma ativo correspondente, com zero termos residuais em português.
