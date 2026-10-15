# Spec Delta: avatar-cosmetics

## Purpose
Gerenciamento centralizado de itens cosméticos estéticos, controle de inventário de molduras de avatar no backend e renderização de alta fidelidade visual com tema Obsidian Mint no frontend do Voxy.

## ADDED Requirements

### Requirement: Centralized Avatar & Frame Rendering
O sistema MUST fornecer um componente reutilizável `<Avatar />` e `<AvatarFrame />` capaz de sobrepor molduras estéticas, status dot e a imagem do usuário sem gerar re-renderizações desnecessárias e sem uso de estilos inline.

#### Scenario: Render avatar with equipped frame
- **WHEN** um usuário possui uma moldura equipada (`equippedFrameSlug`)
- **THEN** o componente deve renderizar o asset da moldura em camada superior com efeito visual escalado proporcionalmente ao tamanho do avatar (`sm`, `md`, `lg`, `xl`).

#### Scenario: Render fallback without frame
- **WHEN** o usuário não possui nenhuma moldura equipada ou a moldura falha ao carregar
- **THEN** o componente deve renderizar o avatar circular padrão sem quebra de layout ou deslocamento do indicador de status.

### Requirement: Cosmetics Inventory & Equipment API
O sistema MUST expor endpoints seguros para consultar o catálogo/inventário do usuário e equipar molduras validadas pelo backend.

#### Scenario: Fetch user inventory
- **WHEN** o cliente autenticado requisita `GET /cosmetics/inventory`
- **THEN** o backend deve retornar a lista de molduras destravadas pelo usuário e o identificador da moldura ativa (`equippedFrameSlug`).

#### Scenario: Equip owned cosmetic frame
- **WHEN** o usuário envia `POST /cosmetics/equip` com um `cosmeticSlug` presente em seu inventário
- **THEN** o backend atualiza `User.equippedFrameSlug` e emite o evento de socket `USER_PROFILE_UPDATED` para sincronização em tempo real.

#### Scenario: Reject unowned cosmetic frame
- **WHEN** um usuário tenta equipar um `cosmeticSlug` que não possui em seu inventário
- **THEN** a requisição deve ser rejeitada com código HTTP 403 e mensagem de erro traduzida.

### Requirement: Exclusive Beta Pioneer Awarding
O sistema MUST conceder de forma imutável a moldura de fundador "Obsidian Pioneer" para todos os usuários pioneiros durante a fase de Beta do Voxy.

#### Scenario: Automatic grant on beta account creation or migration
- **WHEN** uma nova conta é registrada durante a fase Beta ou a migração inicial é executada
- **THEN** a moldura `beta-pioneer` de raridade `LEGENDARY` deve ser inserida no inventário `UserCosmetic` do usuário.

### Requirement: User Profile Customization Interface
O modal de configurações de perfil MUST conter uma seção interativa para visualização e seleção de molduras com preview instantâneo.

#### Scenario: Live preview frame selection
- **WHEN** o usuário clica em uma moldura na lista de seu inventário nas configurações de perfil
- **THEN** a área de preview deve exibir imediatamente o avatar atual do usuário com a moldura selecionada antes de salvar.
