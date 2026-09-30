import React, { useState, useRef } from 'react';
import styles from './EditProfileModal.module.css';
import { X, Camera, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../../core/enums';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import type { UserProfileData } from '../UserPopout/UserPopout';
import { getMediaUrl } from '../../../../core/utils/media.util';

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

  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [bannerColor, setBannerColor] = useState(user.bannerColor || '#a39580');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(user.avatarUrl || null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(user.bannerUrl || null);
  const [avatarError, setAvatarError] = useState(false);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const bannerMedia = getMediaUrl(previewBanner);
  const avatarMedia = getMediaUrl(previewAvatar);

  React.useEffect(() => {
    setAvatarError(false);
  }, [avatarMedia]);

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
      toast.error(t('user.invalidImageType', 'Por favor, selecione uma imagem válida.'));
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
      toast.success(t('user.avatarUpdated', 'Avatar atualizado com sucesso!'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.invalidImageType', 'Por favor, selecione uma imagem válida.'));
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
      toast.success(t('user.bannerUpdated', 'Banner atualizado com sucesso!'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar banner.');
    } finally {
      setIsUploadingBanner(false);
    }
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

      onProfileUpdated({
        displayName: res.displayName,
        bio: res.bio,
        bannerColor: res.bannerColor,
      });

      realtimeClient.emit(RealtimeEvents.USER_PROFILE_UPDATED, {
        userId: user.id,
        displayName: res.displayName,
        bio: res.bio,
        bannerColor: res.bannerColor,
      });

      toast.success(t('user.profileSaved', 'Perfil salvo com sucesso!'));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitle}>
            <Sparkles size={20} className={styles.headerIcon} />
            <h2>{t('user.editProfileTitle', 'Editar Perfil')}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className={styles.form}>
          {/* Card de Pré-visualização Interativo */}
          <div className={styles.previewCard}>
            {/* Banner com botão de alterar */}
            <div
              className={styles.bannerPreview}
              style={{
                backgroundColor: bannerColor || '#5865F2',
                backgroundImage: bannerMedia ? `url(${bannerMedia})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <button
                type="button"
                className={styles.changeBannerBtn}
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                title="Trocar imagem do banner"
              >
                {isUploadingBanner ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
                <span>{t('user.changeBanner', 'Trocar banner')}</span>
              </button>
              <input
                type="file"
                ref={bannerInputRef}
                hidden
                accept="image/*"
                onChange={handleBannerChange}
              />
            </div>

            {/* Avatar com botão de alterar */}
            <div className={styles.avatarPreviewWrapper}>
              <div className={styles.avatarBox}>
                {avatarMedia && !avatarError ? (
                  <img
                    src={avatarMedia}
                    alt="Avatar"
                    className={styles.avatarImg}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {(displayName || user.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  className={styles.changeAvatarOverlay}
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  title="Trocar avatar"
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
            </div>

            <div className={styles.previewInfo}>
              <span className={styles.previewDisplayName}>
                {displayName || user.username}
              </span>
              <span className={styles.previewHandle}>@{user.username}</span>
            </div>
          </div>

          {/* Cores do Banner */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <ImageIcon size={14} />
              <span>{t('user.bannerColor', 'Cor do Banner')}</span>
            </label>
            <div className={styles.colorPalette}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorChip} ${
                    bannerColor === c ? styles.colorChipActive : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setBannerColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Nome de Exibição */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              {t('user.displayNameLabel', 'Nome de Exibição')}
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
              {t('user.bioLabel', 'Pensamento / Sobre mim')}
            </label>
            <textarea
              className={styles.textarea}
              placeholder={t('user.bioPlaceholder', 'Escreva algo sobre você ou um pensamento rápido...')}
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
              {t('common.cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={isSaving || isUploadingAvatar || isUploadingBanner}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('common.saving', 'Salvando...')}</span>
                </>
              ) : (
                <span>{t('common.saveChanges', 'Salvar Alterações')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
