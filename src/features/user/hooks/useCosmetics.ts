import { useState, useEffect, useCallback } from 'react';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { RealtimeEvents } from '../../../core/enums';
import type {
  CosmeticItem,
  UserInventoryResponse,
  EquipCosmeticResponse,
} from '../../../core/types/cosmetic.types';

export function useCosmetics(currentUserId?: string) {
  const [items, setItems] = useState<CosmeticItem[]>([]);
  const [equippedFrameSlug, setEquippedFrameSlug] = useState<string | null>(null);
  const [previewFrameSlug, setPreviewFrameSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await httpClient.get<UserInventoryResponse>('/cosmetics/inventory');
      setItems(res.items || []);
      setEquippedFrameSlug(res.equippedFrameSlug || null);
      setPreviewFrameSlug(res.equippedFrameSlug || null);
    } catch (err: any) {
      console.error('[useCosmetics] Erro ao carregar inventário de cosméticos:', err);
      setError(err?.message || 'Falha ao carregar cosméticos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Listener para sincronização de perfil em tempo real
  useEffect(() => {
    const handleProfileUpdated = (data: { userId?: string; equippedFrameSlug?: string | null }) => {
      if (!currentUserId || data.userId === currentUserId) {
        if (data.equippedFrameSlug !== undefined) {
          setEquippedFrameSlug(data.equippedFrameSlug);
          setPreviewFrameSlug(data.equippedFrameSlug);
        }
      }
    };

    realtimeClient.on(RealtimeEvents.USER_PROFILE_UPDATED, handleProfileUpdated);
    return () => {
      realtimeClient.off(RealtimeEvents.USER_PROFILE_UPDATED, handleProfileUpdated);
    };
  }, [currentUserId]);

  const selectPreview = useCallback((slug: string | null) => {
    setPreviewFrameSlug(slug);
  }, []);

  const revertPreview = useCallback(() => {
    setPreviewFrameSlug(equippedFrameSlug);
  }, [equippedFrameSlug]);

  const equip = useCallback(
    async (slug: string | null): Promise<boolean> => {
      try {
        setSaving(true);
        setError(null);
        const res = await httpClient.post<EquipCosmeticResponse>('/cosmetics/equip', {
          cosmeticSlug: slug,
        });

        const newSlug = res.equippedFrameSlug || null;
        setEquippedFrameSlug(newSlug);
        setPreviewFrameSlug(newSlug);

        // Notificar clientes realtime
        realtimeClient.emit(RealtimeEvents.USER_PROFILE_UPDATED, {
          userId: currentUserId,
          equippedFrameSlug: newSlug,
        });

        return true;
      } catch (err: any) {
        console.error('[useCosmetics] Erro ao equipar cosmético:', err);
        setError(err?.response?.data?.message || err?.message || 'Erro ao equipar moldura');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [currentUserId]
  );

  return {
    items,
    equippedFrameSlug,
    previewFrameSlug,
    loading,
    saving,
    error,
    selectPreview,
    revertPreview,
    equip,
    refetch: fetchInventory,
  };
}
