import React, { useState, useMemo } from 'react';
import styles from './CosmeticsInventoryModal.module.css';
import { X, Sparkles, Search, Ban, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CosmeticItem } from '../../../../core/types/cosmetic.types';
import { Avatar } from '../../../../components/common/Avatar';

export interface CosmeticsInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CosmeticItem[];
  equippedSlug: string | null;
  previewSlug: string | null;
  onSelectPreview: (slug: string | null) => void;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
}

export const CosmeticsInventoryModal: React.FC<CosmeticsInventoryModalProps> = ({
  isOpen,
  onClose,
  items,
  equippedSlug,
  previewSlug,
  onSelectPreview,
  userAvatarUrl,
  userDisplayName,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity = selectedRarity === 'ALL' || item.rarity === selectedRarity;
      return matchesSearch && matchesRarity;
    });
  }, [items, searchTerm, selectedRarity]);

  if (!isOpen) return null;

  const rarities = [
    { key: 'ALL', label: t('cosmetics.filterAll') },
    { key: 'COMMON', label: t('cosmetics.rarity.common') },
    { key: 'RARE', label: t('cosmetics.rarity.rare') },
    { key: 'EPIC', label: t('cosmetics.rarity.epic') },
    { key: 'LEGENDARY', label: t('cosmetics.rarity.legendary') },
  ];

  const getRarityClass = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'COMMON':
        return styles.rarityCommon;
      case 'RARE':
        return styles.rarityRare;
      case 'EPIC':
        return styles.rarityEpic;
      case 'LEGENDARY':
        return styles.rarityLegendary;
      default:
        return styles.rarityCommon;
    }
  };

  const getRarityCardClass = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'COMMON':
        return styles.cardCommon;
      case 'RARE':
        return styles.cardRare;
      case 'EPIC':
        return styles.cardEpic;
      case 'LEGENDARY':
        return styles.cardLegendary;
      default:
        return styles.cardCommon;
    }
  };


  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.header}>
          <div className={styles.headerTitleWrapper}>
            <Sparkles size={22} className={styles.headerIcon} />
            <div>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>{t('cosmetics.inventoryTitle')}</h2>
                <span className={styles.itemCountBadge}>
                  {items.length}
                </span>
              </div>
              <p className={styles.subtitle}>{t('cosmetics.inventorySubtitle')}</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        {/* Toolbar de Busca e Filtros */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.rarityFilters}>
            {rarities.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`${styles.rarityPill} ${
                  selectedRarity === r.key ? styles.rarityPillActive : ''
                }`}
                onClick={() => setSelectedRarity(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Molduras */}
        <div className={styles.body}>
          {(() => {
            const showNoneOption = selectedRarity === 'ALL' && !searchTerm.trim();

            if (filteredItems.length === 0 && !showNoneOption) {
              return (
                <div className={styles.emptyState}>
                  <p>{t('cosmetics.noFramesFound')}</p>
                </div>
              );
            }

            return (
              <div className={styles.grid}>
                {/* Opção: Nenhuma Moldura (Apenas na visão geral sem filtro ativo) */}
                {showNoneOption && (
                  <div
                    className={`${styles.itemCard} ${!previewSlug ? styles.itemCardActive : ''}`}
                    onClick={() => onSelectPreview(null)}
                    role="button"
                    tabIndex={0}
                  >
                    {!equippedSlug && (
                      <div className={styles.equippedCheck} title={t('cosmetics.equipped')}>
                        <Check size={13} strokeWidth={3} />
                      </div>
                    )}

                    <div className={styles.avatarPreviewFrameBox}>
                      <div className={styles.noneAvatarWrapper}>
                        <Avatar
                          src={userAvatarUrl}
                          displayName={userDisplayName || 'User'}
                          frameSlug={null}
                          size="xl"
                          className={styles.inventoryAvatar}
                        />
                        <div className={styles.noneBanOverlay}>
                          <Ban size={30} />
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardInfo}>
                      <span className={styles.itemName} title={t('cosmetics.none')}>
                        {t('cosmetics.none')}
                      </span>
                      <span className={`${styles.itemRarityTag} ${styles.rarityCommon}`}>
                        {t('cosmetics.default')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Lista Filtrada */}
                {filteredItems.map((item) => {
                  const isSelected = previewSlug === item.slug;
                  const isEquipped = equippedSlug === item.slug;

                  return (
                    <div
                      key={item.slug}
                      className={`${styles.itemCard} ${isSelected ? styles.itemCardActive : ''} ${getRarityCardClass(item.rarity)}`}
                      onClick={() => onSelectPreview(item.slug)}
                      role="button"
                      tabIndex={0}
                    >
                      {isEquipped && (
                        <div className={styles.equippedCheck} title={t('cosmetics.equipped')}>
                          <Check size={13} strokeWidth={3} />
                        </div>
                      )}

                      <div className={styles.avatarPreviewFrameBox}>
                        <Avatar
                          src={userAvatarUrl}
                          displayName={userDisplayName || 'User'}
                          frameSlug={item.slug}
                          size="xl"
                          animated={true}
                          className={styles.inventoryAvatar}
                        />
                      </div>

                      <div className={styles.cardInfo}>
                        <span className={styles.itemName} title={item.name}>
                          {item.name}
                        </span>

                        <div className={styles.tagRow}>
                          <span className={`${styles.itemRarityTag} ${getRarityClass(item.rarity)}`}>
                            {t(`cosmetics.rarity.${item.rarity.toLowerCase()}`)}
                          </span>

                          {item.metadata?.exclusive && (
                            <span className={styles.exclusiveBottomTag} title={t('cosmetics.exclusive')}>
                              <Sparkles size={8} strokeWidth={2.5} />
                              <span>{t('cosmetics.exclusive')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Rodapé com botão de fechar */}
        <div className={styles.footer}>
          <button type="button" className={styles.confirmBtn} onClick={onClose}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
