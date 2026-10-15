export type CosmeticType = 'AVATAR_FRAME' | 'PROFILE_EFFECT' | 'NAMEPLATE' | 'BADGE';

export type CosmeticRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface CosmeticMetadata {
  exclusive?: boolean;
  glowColor?: string;
  animated?: boolean;
  badgeLabel?: string;
  [key: string]: any;
}

export interface CosmeticItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: CosmeticType;
  rarity: CosmeticRarity;
  assetUrl: string;
  previewUrl: string | null;
  metadata?: CosmeticMetadata | null;
  unlockedAt?: string | Date;
}

export interface UserInventoryResponse {
  equippedFrameSlug: string | null;
  items: CosmeticItem[];
}

export interface EquipCosmeticPayload {
  cosmeticSlug: string | null;
}

export interface EquipCosmeticResponse {
  success: boolean;
  equippedFrameSlug: string | null;
}
