import React, { useState, useRef } from 'react';
import styles from './EditProfileModal.module.css';
import { X, Camera, Loader2, Sparkles, Image as ImageIcon, Plus, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../../core/enums';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import type { UserProfileData } from '../UserPopout/UserPopout';
import { getMediaUrl } from '../../../../core/utils/media.util';
import { useCosmetics } from '../../hooks/useCosmetics';
import { Avatar } from '../../../../components/common/Avatar';
import { CosmeticsInventoryModal } from '../CosmeticsInventoryModal/CosmeticsInventoryModal';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData;
  onProfileUpdated: (updated: Partial<UserProfileData>) => void;
}

const PRESET_COLORS = [
  '#a39580',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#1e293b',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    items: cosmeticItems,
    equippedFrameSlug,
    previewFrameSlug,
    selectPreview,
    revertPreview,
    equip,
  } = useCosmetics(user.id);

  // Filtra estritamente itens do tipo Moldura de Avatar que estão no inventário do usuário
  const userFrames = React.useMemo(() => {
    return cosmeticItems.filter((item) => !item.type || item.type === 'AVATAR_FRAME');
  }, [cosmeticItems]);

  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [bannerColor, setBannerColor] = useState(user.bannerColor || '#a39580');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(user.avatarUrl || null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(user.bannerUrl || null);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const bannerMedia = getMediaUrl(previewBanner);
  const avatarMedia = getMediaUrl(previewAvatar);

  React.useEffect(() => {
    if (isOpen) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setBannerColor(user.bannerColor || '#a39580');
      setPreviewAvatar(user.avatarUrl || null);
      setPreviewBanner(user.bannerUrl || null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.invalidImageType'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingAvatar(true);
    try {
      const res = await httpClient.post<{ avatarUrl: string }>(
        '/storage/avatar',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const url = res.avatarUrl.includes('?v=') ? res.avatarUrl : `${res.avatarUrl}?v=${Date.now()}`;
      setPreviewAvatar(url);
      onProfileUpdated({ avatarUrl: url });
      realtimeClient.emit(RealtimeEvents.USER_PROFILE_UPDATED, {
        userId: user.id,
        avatarUrl: url,
      });
      toast.success(t('user.avatarUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('errors.avatarUploadFailed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.invalidImageType'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingBanner(true);
    try {
      const res = await httpClient.post<{ bannerUrl: string }>(
        '/storage/banner',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const url = res.bannerUrl.includes('?v=') ? res.bannerUrl : `${res.bannerUrl}?v=${Date.now()}`;
      setPreviewBanner(url);
      onProfileUpdated({ bannerUrl: url });
      realtimeClient.emit(RealtimeEvents.USER_PROFILE_UPDATED, {
        userId: user.id,
        bannerUrl: url,
      });
      toast.success(t('user.bannerUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('errors.bannerUploadFailed'));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleModalClose = () => {
    revertPreview();
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await httpClient.patch<UserProfileData>(ApiRoutes.USERS_PROFILE, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        bannerColor,
      });

      if (previewFrameSlug !== equippedFrameSlug) {
        const equipOk = await equip(previewFrameSlug);
        if (equipOk) {
          onProfileUpdated({
            displayName: res.displayName,
            bio: res.bio,
            bannerColor: res.bannerColor,
            equippedFrameSlug: previewFrameSlug,
          });
        }
      } else {
        onProfileUpdated({
          displayName: res.displayName,
          bio: res.bio,
          bannerColor: res.bannerColor,
        });
      }

      realtimeClient.emit(RealtimeEvents.USER_PROFILE_UPDATED, {
        userId: user.id,
        displayName: res.displayName,
        bio: res.bio,
        bannerColor: res.bannerColor,
        equippedFrameSlug: previewFrameSlug,
      });

      toast.success(t('user.profileSaved'));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('errors.profileUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleModalClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitle}>
            <Sparkles size={20} className={styles.headerIcon} />
            <h2>{t('user.editProfileTitle')}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleModalClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className={styles.form}>
          {/* Card de Pré-visualização Interativo */}
          <div className={styles.previewCard}>
            {/* Banner com botão de alterar */}
            <div
              className={styles.bannerPreview}
              style={
                {
                  '--banner-bg': bannerColor || '#5865F2',
                  '--banner-img': bannerMedia ? `url(${bannerMedia})` : 'none',
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className={styles.changeBannerBtn}
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                title={t('user.changeBannerTitle')}
              >
                {isUploadingBanner ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
                <span>{t('user.changeBanner')}</span>
              </button>
              <input
                type="file"
                ref={bannerInputRef}
                hidden
                accept="image/*"
                onChange={handleBannerChange}
              />
            </div>

            {/* Cabeçalho do Perfil: Avatar + Nome e Tag lado a lado */}
            <div className={styles.previewBody}>
              <div className={styles.previewLeft}>
                <div className={styles.avatarBox}>
                  <Avatar
                    src={avatarMedia}
                    displayName={displayName || user.username}
                    frameSlug={previewFrameSlug}
                    size="xl"
                    animated={true}
                    circleClassName={styles.avatarBorderCutout}
                  />
                  <button
                    type="button"
                    className={styles.changeAvatarOverlay}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    title={t('user.changeAvatarTitle')}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Camera size={18} />
                    )}
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    hidden
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className={styles.previewInfo}>
                  <span className={styles.previewDisplayName}>
                    {displayName || user.username}
                  </span>
                  <span className={styles.previewHandle}>@{user.username}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cores do Banner */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <ImageIcon size={14} />
              <span>{t('user.bannerColor')}</span>
            </label>
            <div className={styles.colorPalette}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorChip} ${
                    bannerColor === c ? styles.colorChipActive : ''
                  }`}
                  style={{ '--chip-color': c } as React.CSSProperties}
                  onClick={() => setBannerColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Seletor Rápido de Moldura + Acesso ao Inventário */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Sparkles size={14} />
              <span>{t('cosmetics.avatarDecoration')}</span>
            </label>

            <div className={styles.quickFramesRow}>
              <button
                type="button"
                className={`${styles.quickFrameChip} ${!previewFrameSlug ? styles.quickFrameChipActive : ''}`}
                onClick={() => selectPreview(null)}
                title={t('cosmetics.none')}
              >
                <Ban size={15} />
                <span>{t('cosmetics.none')}</span>
              </button>

              {userFrames.slice(0, 3).map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className={`${styles.quickFrameChip} ${previewFrameSlug === item.slug ? styles.quickFrameChipActive : ''}`}
                  onClick={() => selectPreview(item.slug)}
                  title={`${item.name} (${t(`cosmetics.rarity.${item.rarity.toLowerCase()}`)})`}
                >
                  <img src={item.assetUrl} alt={item.name} className={styles.quickFrameImg} />
                  <span className={styles.quickFrameName}>{item.name}</span>
                  {item.metadata?.exclusive && (
                    <span className={styles.quickExclusiveDot} title={t('cosmetics.exclusive')} />
                  )}
                </button>
              ))}

              <button
                type="button"
                className={styles.moreFramesChip}
                onClick={() => setIsInventoryModalOpen(true)}
                title={t('cosmetics.browseCatalog')}
              >
                <Plus size={15} />
                <span>{t('cosmetics.more')}</span>
              </button>
            </div>
          </div>

          {/* Nome de Exibição */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              {t('user.displayNameLabel')}
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder={user.username}
              value={displayName}
              maxLength={32}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Pensamento / Bio */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              {t('user.bioLabel')}
            </label>
            <textarea
              className={styles.textarea}
              placeholder={t('user.bioPlaceholder')}
              value={bio}
              maxLength={160}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          {/* Botões do Rodapé */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSaving}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={isSaving || isUploadingAvatar || isUploadingBanner}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <span>{t('common.save')}</span>
              )}
            </button>
          </div>
        </form>
      </div>

      <CosmeticsInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        items={userFrames}
        equippedSlug={equippedFrameSlug}
        previewSlug={previewFrameSlug}
        onSelectPreview={selectPreview}
        userAvatarUrl={avatarMedia}
        userDisplayName={displayName || user.username}
      />
    </div>
  );
};

