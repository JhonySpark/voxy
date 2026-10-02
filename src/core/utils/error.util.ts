import i18n from '../../i18n';

/**
 * Retorna uma mensagem de erro internacionalizada baseada no `code` da API,
 * com fallback inteligente para a mensagem original do backend ou mensagem padrão.
 */
export function getApiErrorMessage(
  err: any,
  fallback: string = 'Ocorreu um erro inesperado.'
): string {
  const code = err?.response?.data?.code || err?.code;
  if (code) {
    const errorKey = `errors.${code}`;
    if (i18n.exists(errorKey)) {
      return i18n.t(errorKey);
    }
  }

  return err?.response?.data?.message || err?.message || fallback;
}

/**
 * Traduz um código de resposta ou erro (ex: retornado em endpoints como check-username)
 */
export function getApiCodeMessage(
  code: string | undefined,
  fallbackMessage?: string
): string {
  if (code) {
    const errorKey = `errors.${code}`;
    if (i18n.exists(errorKey)) {
      return i18n.t(errorKey);
    }
  }
  return fallbackMessage || '';
}
