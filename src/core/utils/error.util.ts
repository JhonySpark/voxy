import i18n from '../../i18n';

const KNOWN_MESSAGE_MAP: Record<string, string> = {
  'Este endereço de e-mail já está cadastrado.': 'errors.AUTH_EMAIL_ALREADY_EXISTS',
  'Este nome de usuário já está em uso.': 'errors.AUTH_USERNAME_ALREADY_EXISTS',
  'Nome de usuário disponível!': 'errors.AUTH_USERNAME_AVAILABLE',
  'Por favor, insira um e-mail válido.': 'errors.AUTH_INVALID_EMAIL',
  'O nome de usuário deve ter entre 3 e 32 caracteres (apenas letras, números, _ e -).': 'errors.AUTH_INVALID_USERNAME',
  'A senha não atende aos requisitos de segurança.': 'errors.AUTH_WEAK_PASSWORD',
  'E-mail ou senha inválidos.': 'errors.AUTH_INVALID_CREDENTIALS',
  'Data de nascimento inválida.': 'errors.AUTH_INVALID_BIRTHDATE',
  'Você precisa ter pelo menos 13 anos para criar uma conta no Voxy.': 'errors.AUTH_AGE_RESTRICTED',
  'Você precisa aceitar os Termos de Uso, Política de Privacidade e Diretrizes da ANPD para continuar.': 'errors.AUTH_TERMS_NOT_ACCEPTED',
  'Você precisa aceitar os Termos de Uso, Política de Privacidade e Diretrizes da ANPD para se cadastrar.': 'errors.AUTH_TERMS_NOT_ACCEPTED',
  'Código inválido ou expirado. Tente novamente.': 'errors.AUTH_INVALID_VERIFICATION_CODE',
  'Código de verificação expirado. Solicite um novo código.': 'errors.AUTH_VERIFICATION_CODE_EXPIRED',
};

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

  const rawMessage = err?.response?.data?.message || err?.message;
  if (typeof rawMessage === 'string' && KNOWN_MESSAGE_MAP[rawMessage.trim()]) {
    const mappedKey = KNOWN_MESSAGE_MAP[rawMessage.trim()];
    if (i18n.exists(mappedKey)) {
      return i18n.t(mappedKey);
    }
  }

  return rawMessage || fallback;
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
