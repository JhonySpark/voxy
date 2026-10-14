# Design: Modular Internationalization Architecture

## Context
O aplicativo utiliza `i18next` e `react-i18next` no React 19. Atualmente, todas as traduções estão embutidas diretamente como literais de objeto TypeScript dentro de `src/i18n.ts`. A falta de segregação e ferramentas de validação permitiu que componentes adotassem fallbacks inline chumbados em português (`t('chave', 'Texto')`) ou ignorassem o hook `useTranslation`, gerando comportamento inconsistente ao alternar idiomas.

## Goals / Non-Goals

**Goals:**
- Segregar dicionários de tradução em arquivos estáticos JSON modulares (`src/locales/{pt,en,es}.json`).
- Assegurar 100% de paridade de chaves entre os três idiomas (`pt`, `en`, `es`).
- Refatorar `src/i18n.ts` para carregar esses JSONs de forma enxuta e performática.
- Substituir textos literais JSX e chamadas com fallback por invocações canônicas `t('namespace.chave')`.
- Manter total conformidade com o tema Obsidian Mint, CSS Modules e zero estilos inline.

**Non-Goals:**
- Adicionar novos idiomas além de Português, Inglês e Espanhol neste ciclo.
- Tradução de logs de terminal ou mensagens internas de depuração do Electron/WebRTC.

## Decisions

### Decisão 1: Arquivos JSON dedicados em `src/locales/`
- **Abordagem escolhida**: Criar `src/locales/pt.json`, `src/locales/en.json` e `src/locales/es.json`.
- **Alternativa rejeitada**: Manter um único arquivo TypeScript gigante (`i18n.ts`).
- **Justificativa**: JSON permite validação de sintaxe estrita, facilita o diff em revisões de código, permite futura integração com plataformas de localização (Crowdin, Lokalise) e reduz o arquivo `i18n.ts` de 776 para ~35 linhas. O Vite importa JSON nativamente com otimização em tempo de compilação.

### Decisão 2: Padronização Hierárquica de Nomes (Namespaces por Ponto)
- **Abordagem escolhida**: Manter a convenção plana com separador de ponto (`settings.*`, `user.*`, `voice.*`, `server.*`, `channel.*`, `chat.*`, `common.*`, `errors.*`).
- **Justificativa**: Preserva a compatibilidade com todas as 223 chaves existentes sem exigir refatoração desnecessária de código pré-existente.

### Decisão 3: Eliminação de Fallbacks Hardcoded no Código
- **Abordagem escolhida**: Usar estritamente `t('chave')` nos componentes, removendo textos secundários em português como `t('user.displayName', 'Nome de exibição')`.
- **Justificativa**: O segundo parâmetro de fallback do i18next mascara chaves faltantes nos outros idiomas, forçando a UI a exibir português quando o usuário está em inglês ou espanhol. Se a chave estiver no JSON de todos os idiomas, o fallback no código é redundante e prejudicial.

## Risks / Trade-offs

- **[Risco de chave faltante em um idioma]** → Mitigação: Criação de script de validação de paridade de chaves no pipeline e fallback padrão configurado para `LanguageEnum.PT`.
- **[Risco de quebra de layout por comprimento de texto variável]** → Mitigação: O design Obsidian Mint já utiliza CSS Modules flexíveis (`min-width`, flexbox, grid e auto-wrap), evitando tamanhos fixos rígidos em botões e badges.
