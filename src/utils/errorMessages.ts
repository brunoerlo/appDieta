export interface AppErrorLike {
  message?: unknown;
  code?: unknown;
  error_code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  name?: unknown;
  details?: unknown;
  hint?: unknown;
}

const DEFAULT_FALLBACK_PT =
  'Não foi possível concluir a operação. Tente novamente em instantes.';

/**
 * Mapeamento completo dos códigos de erro oficiais do Supabase Auth (GoTrue)
 * para mensagens específicas e acionáveis em português brasileiro.
 */
const AUTH_ERROR_CODE_MAP: Record<string, string> = {
  over_email_send_rate_limit:
    'Limite temporário de envio de e-mails atingido no servidor. Aguarde alguns minutos antes de criar outra conta ou solicitar um novo e-mail.',
  over_request_rate_limit:
    'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.',
  over_sms_send_rate_limit:
    'Limite de envio de SMS atingido. Aguarde alguns minutos antes de tentar novamente.',
  email_address_invalid:
    'Este endereço de e-mail não é aceito ou pertence a um domínio inválido. Use um e-mail real e válido.',
  email_address_not_authorized:
    'Envio de e-mail não autorizado para este endereço na configuração atual do servidor.',
  email_exists: 'E-mail já cadastrado no aplicativo.',
  user_already_exists: 'E-mail já cadastrado no aplicativo.',
  email_not_confirmed:
    'E-mail ainda não confirmado. Verifique sua caixa de entrada (e spam) para confirmar o cadastro antes de entrar.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  weak_password:
    'A senha informada é muito fraca. Utilize pelo menos 6 caracteres combinando letras e números.',
  same_password: 'A nova senha deve ser diferente da senha atual.',
  signup_disabled:
    'O cadastro de novas contas está temporariamente desativado no servidor.',
  email_provider_disabled:
    'O cadastro com e-mail e senha está temporariamente desativado no servidor.',
  user_not_found:
    'Usuário não encontrado. Verifique seu e-mail ou crie uma nova conta.',
  user_banned:
    'Esta conta está temporariamente suspensa. Entre em contato com o suporte.',
  otp_expired: 'O código ou link de verificação expirou. Solicite um novo envio.',
  otp_disabled:
    'O acesso por código de uso único (OTP) está desativado no servidor.',
  captcha_failed:
    'Falha na verificação de segurança (CAPTCHA). Tente novamente.',
  session_expired:
    'Sua sessão expirou. Faça login novamente para continuar.',
  session_not_found:
    'Sessão não encontrada. Faça login novamente para continuar.',
  refresh_token_already_used:
    'Sua sessão foi renovada ou encerrada. Faça login novamente para continuar.',
  refresh_token_not_found:
    'Sua sessão expirou. Faça login novamente para continuar.',
  bad_jwt: 'Sessão inválida. Faça login novamente para continuar.',
  no_authorization:
    'Autenticação necessária. Faça login novamente para continuar.',
  request_timeout:
    'A requisição demorou muito para responder. Verifique sua conexão e tente novamente.',
  unexpected_failure:
    'O serviço de autenticação apresentou uma instabilidade interna. Tente novamente em instantes.',
  conflict:
    'Conflito ao atualizar os dados simultaneamente. Aguarde um instante e tente novamente.',
  validation_failed:
    'Os dados informados estão em um formato inválido. Revise os campos e tente novamente.',
  bad_json: 'Formato inválido nos dados enviados. Tente novamente.',
  phone_exists: 'Este número de telefone já está cadastrado em outra conta.',
  phone_not_confirmed: 'O número de telefone ainda não foi confirmado.',
  phone_provider_disabled:
    'O cadastro por telefone está desativado no servidor.',
  sms_send_failed:
    'Não foi possível enviar o SMS de verificação. Tente novamente mais tarde.',
  anonymous_provider_disabled: 'O acesso anônimo está desativado.',
  manual_linking_disabled: 'A vinculação manual de contas está desativada.',
  insufficient_aal:
    'É necessário concluir a verificação em duas etapas (MFA) para continuar.',
  mfa_verification_failed:
    'Código de verificação em duas etapas incorreto. Confira e tente novamente.',
  mfa_verification_rejected:
    'Verificação em duas etapas recusada pelo servidor.',
  mfa_challenge_expired:
    'O código de verificação em duas etapas expirou. Solicite um novo.',
  mfa_factor_not_found: 'Fator de autenticação em duas etapas não encontrado.',
  mfa_factor_name_conflict:
    'Já existe um fator de autenticação cadastrado com esse nome.',
  mfa_ip_address_mismatch:
    'A configuração da verificação em duas etapas precisa ser iniciada e concluída na mesma rede.',
  mfa_totp_enroll_not_enabled:
    'O cadastro de autenticação por aplicativo (TOTP) está desativado.',
  mfa_totp_verify_not_enabled:
    'O login com aplicativo autenticador (TOTP) está desativado.',
  mfa_phone_enroll_not_enabled:
    'O cadastro de autenticação por SMS está desativado.',
  mfa_phone_verify_not_enabled:
    'O login com verificação por SMS está desativado.',
  mfa_web_authn_enroll_not_enabled:
    'O cadastro de autenticação por biometria/chave de acesso está desativado.',
  mfa_web_authn_verify_not_enabled:
    'O login por biometria/chave de acesso está desativado.',
  mfa_verified_factor_exists:
    'Já existe um telefone verificado na sua conta. Remova o anterior antes de continuar.',
  too_many_enrolled_mfa_factors:
    'Limite máximo de fatores de autenticação em duas etapas atingido.',
  reauthentication_needed:
    'Por segurança, confirme seu login novamente antes de alterar sua senha.',
  reauthentication_not_valid:
    'Código de reautenticação inválido. Solicite um novo código.',
  identity_not_found: 'Método de login vinculado não encontrado.',
  identity_already_exists:
    'Este método de login já está vinculado a outra conta.',
  single_identity_not_deletable:
    'Não é possível desvincular o único método de acesso da sua conta.',
  email_conflict_identity_not_deletable:
    'Este e-mail já está associado a outra conta no sistema.',
  provider_email_needs_verification:
    'É necessário confirmar seu e-mail antes de concluir o acesso com este provedor.',
  provider_disabled: 'Este provedor de login está desativado no momento.',
  oauth_provider_not_supported:
    'Este provedor de login não é suportado pelo servidor.',
  bad_oauth_state: 'Sessão de login externo inválida. Tente entrar novamente.',
  bad_oauth_callback:
    'Resposta incompleta do provedor de login externo. Tente novamente.',
  bad_code_verifier:
    'Falha na validação de segurança do login. Tente entrar novamente.',
  flow_state_expired: 'A solicitação de login expirou. Tente entrar novamente.',
  flow_state_not_found:
    'Solicitação de login expirada ou já utilizada. Tente entrar novamente.',
  invite_not_found: 'Convite expirado ou já utilizado.',
  not_admin: 'Acesso restrito a administradores.',
  user_sso_managed:
    'Contas corporativas (SSO) não permitem alterar este dado diretamente.',
  sso_provider_not_found:
    'Provedor de login corporativo (SSO) não encontrado.',
  sso_domain_already_exists:
    'Este domínio já está vinculado a outro provedor corporativo.',
  saml_provider_disabled: 'O login corporativo (SAML) está desativado.',
  saml_idp_not_found:
    'Provedor de identidade corporativa (SAML) não encontrado.',
  saml_idp_already_exists:
    'Provedor de identidade corporativa (SAML) já cadastrado.',
  saml_metadata_fetch_failed:
    'Não foi possível carregar os metadados do provedor corporativo.',
  saml_entity_id_mismatch:
    'Identificador do provedor corporativo incompatível.',
  saml_assertion_no_email:
    'O provedor corporativo não forneceu um e-mail válido.',
  saml_assertion_no_user_id:
    'O provedor corporativo não forneceu um identificador de usuário.',
  saml_relay_state_not_found:
    'Sessão de login corporativo expirada. Tente novamente.',
  saml_relay_state_expired:
    'O tempo de resposta do login corporativo expirou. Tente novamente.',
  unexpected_audience: 'Token de acesso incompatível com este aplicativo.',
  hook_timeout:
    'O servidor demorou para validar a solicitação. Tente novamente em instantes.',
  hook_timeout_after_retry:
    'O servidor não respondeu após várias tentativas. Tente novamente mais tarde.',
  hook_payload_over_size_limit:
    'Os dados enviados na autenticação excedem o limite permitido.',
  hook_payload_invalid_content_type:
    'Formato de resposta inválido durante a autenticação.',
};

/**
 * Códigos SQLSTATE do PostgreSQL e códigos PGRST do PostgREST.
 */
const POSTGRES_ERROR_CODE_MAP: Record<string, string> = {
  '42501': 'Sem permissão para acessar ou alterar este registro.',
  '23505': 'Este registro já existe. Evite duplicar os mesmos dados.',
  '23503':
    'Não foi possível concluir porque este item está vinculado a outro registro.',
  '23502': 'Falta preencher um campo obrigatório para concluir esta operação.',
  '23514': 'Um dos valores informados está fora do intervalo permitido.',
  '22P02': 'Formato de dado inválido enviado ao servidor.',
  '57014': 'A consulta demorou muito e foi cancelada. Tente novamente.',
  '08000': 'Falha de conexão com o banco de dados. Tente novamente em instantes.',
  '08003': 'Falha de conexão com o banco de dados. Tente novamente em instantes.',
  '08006': 'Falha de conexão com o banco de dados. Tente novamente em instantes.',
  PGRST116: 'Registro não encontrado ou em duplicidade no banco de dados.',
  PGRST301: 'Sua sessão expirou. Faça login novamente para continuar.',
  PGRST302: 'Sua sessão expirou. Faça login novamente para continuar.',
};

const HTTP_STATUS_MAP: Record<number, string> = {
  401: 'Sua sessão expirou ou não está autorizada. Faça login novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O recurso solicitado não foi encontrado.',
  408: 'A requisição demorou muito para responder. Tente novamente.',
  429: 'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.',
  500: 'O servidor encontrou uma falha interna temporária. Tente novamente em instantes.',
  502: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  503: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  504: 'O servidor demorou para responder. Verifique sua conexão e tente novamente.',
};

interface MessagePattern {
  pattern: RegExp;
  translate: (match: RegExpMatchArray) => string;
}

const MESSAGE_PATTERNS: MessagePattern[] = [
  {
    pattern: /email rate limit exceeded|over_email_send_rate_limit/i,
    translate: () => AUTH_ERROR_CODE_MAP.over_email_send_rate_limit,
  },
  {
    pattern: /for security purposes,\s*you can only request this after\s*(\d+)\s*seconds?/i,
    translate: (m) =>
      `Por segurança, aguarde ${m[1]} segundos antes de tentar novamente.`,
  },
  {
    pattern: /rate limit exceeded|over_request_rate_limit|too many requests/i,
    translate: () => AUTH_ERROR_CODE_MAP.over_request_rate_limit,
  },
  {
    pattern: /email address.*is invalid|unable to validate email|invalid email/i,
    translate: () => AUTH_ERROR_CODE_MAP.email_address_invalid,
  },
  {
    pattern: /not authorized.*email|email.*not authorized/i,
    translate: () => AUTH_ERROR_CODE_MAP.email_address_not_authorized,
  },
  {
    pattern: /already registered|user already exists|email_exists|already exists/i,
    translate: () => AUTH_ERROR_CODE_MAP.email_exists,
  },
  {
    pattern: /email not confirmed/i,
    translate: () => AUTH_ERROR_CODE_MAP.email_not_confirmed,
  },
  {
    pattern: /invalid login credentials|invalid credentials/i,
    translate: () => AUTH_ERROR_CODE_MAP.invalid_credentials,
  },
  {
    pattern: /password should be at least\s*(\d+)\s*characters?/i,
    translate: (m) => `A senha deve ter pelo menos ${m[1]} caracteres.`,
  },
  {
    pattern: /weak password/i,
    translate: () => AUTH_ERROR_CODE_MAP.weak_password,
  },
  {
    pattern: /new password should be different|same_password/i,
    translate: () => AUTH_ERROR_CODE_MAP.same_password,
  },
  {
    pattern: /signups? not allowed|signup_disabled|email_provider_disabled/i,
    translate: () => AUTH_ERROR_CODE_MAP.signup_disabled,
  },
  {
    pattern: /user not found/i,
    translate: () => AUTH_ERROR_CODE_MAP.user_not_found,
  },
  {
    pattern: /user is banned|user_banned/i,
    translate: () => AUTH_ERROR_CODE_MAP.user_banned,
  },
  {
    pattern: /otp.*expired|token has expired/i,
    translate: () => AUTH_ERROR_CODE_MAP.otp_expired,
  },
  {
    pattern: /captcha/i,
    translate: () => AUTH_ERROR_CODE_MAP.captcha_failed,
  },
  {
    pattern:
      /jwt expired|invalid jwt|refresh token|session.*missing|auth session missing|session_not_found|session_expired/i,
    translate: () => AUTH_ERROR_CODE_MAP.session_expired,
  },
  {
    pattern:
      /network request failed|network error|failed to fetch|fetch failed|networkerror|econnrefused|enotfound|etimedout|offline/i,
    translate: () =>
      'Sem conexão com a internet ou servidor inacessível. Verifique sua rede e tente novamente.',
  },
  {
    pattern: /database connection|connection failed|could not connect/i,
    translate: () => POSTGRES_ERROR_CODE_MAP['08000'],
  },
  {
    pattern: /sqlite.*lock|database is locked|lock busy/i,
    translate: () =>
      'O banco de dados local está ocupado no momento. Tente novamente em instantes.',
  },
  {
    pattern: /timeout|timed out|aborterror|aborted|statement timeout/i,
    translate: () =>
      'A operação demorou muito para responder (tempo esgotado). Verifique sua conexão e tente novamente.',
  },
  {
    pattern: /row-level security|rls policy|permission denied|insufficient_privilege|not authorized/i,
    translate: () => POSTGRES_ERROR_CODE_MAP['42501'],
  },
  {
    pattern: /duplicate key|unique constraint/i,
    translate: () => POSTGRES_ERROR_CODE_MAP['23505'],
  },
  {
    pattern: /foreign key constraint/i,
    translate: () => POSTGRES_ERROR_CODE_MAP['23503'],
  },
  {
    pattern: /not-null constraint|null value in column/i,
    translate: () => POSTGRES_ERROR_CODE_MAP['23502'],
  },
  {
    pattern: /check constraint/i,
    translate: () => POSTGRES_ERROR_CODE_MAP['23514'],
  },
  {
    pattern: /constraint/i,
    translate: () =>
      'Os dados informados violam uma regra de integridade do banco de dados.',
  },
  {
    pattern: /payload too large|entity too large|exceeded the maximum allowed size/i,
    translate: () => 'O arquivo enviado excede o limite máximo permitido.',
  },
  {
    pattern: /bucket not found/i,
    translate: () => 'Repositório de arquivos não encontrado no servidor.',
  },
  {
    pattern: /object not found|resource was not found/i,
    translate: () => 'O arquivo ou recurso solicitado não foi encontrado.',
  },
  {
    pattern: /invalid mime|mime type/i,
    translate: () => 'Formato de arquivo não suportado.',
  },
  {
    pattern: /must be used within a\s+(\w+provider)/i,
    translate: (m) =>
      `Erro interno de configuração: o componente precisa estar dentro de ${m[1]}.`,
  },
];

const PORTUGUESE_DIACRITIC_RE = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const PORTUGUESE_WORD_RE =
  /\b(não|nao|inválido|invalido|inválida|invalida|obrigatório|obrigatorio|obrigatória|obrigatoria|informe|falha|erro|conta|e-mail|senha|usuário|usuario|sessão|sessao|treino|rotina|alimento|água|agua|peso|medida|foto|porção|porcao|tente|verifique|cadastro|entrar|sair|salvar|excluir|carregar|atualizar|registro|permissão|permissao|limite|aguarde|caracteres|entre|maior|menor|nenhum|nenhuma|desativado|expirado|expirada)\b/i;
const RAW_JS_RUNTIME_RE =
  /\b(typeerror|referenceerror|syntaxerror|rangeerror|cannot read|is not a function|is not defined|undefined is not|null is not)\b/i;

function isLikelyPortuguese(message: string): boolean {
  if (RAW_JS_RUNTIME_RE.test(message)) {
    return false;
  }
  return PORTUGUESE_DIACRITIC_RE.test(message) || PORTUGUESE_WORD_RE.test(message);
}

function extractRawMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim();
  }
  if (error && typeof error === 'object') {
    const errObj = error as AppErrorLike;
    if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
      return errObj.message.trim();
    }
    if (typeof errObj.details === 'string' && errObj.details.trim().length > 0) {
      return errObj.details.trim();
    }
  }
  return '';
}

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const errObj = error as AppErrorLike;
  const raw = errObj.code ?? errObj.error_code;
  return typeof raw === 'string' ? raw.trim() : '';
}

function extractStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const errObj = error as AppErrorLike;
  const raw = errObj.status ?? errObj.statusCode;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/**
 * Converte qualquer erro (Supabase Auth, PostgREST, Storage, rede ou JS)
 * em uma mensagem clara, específica e em português brasileiro.
 */
export function translateErrorToPtBr(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK_PT
): string {
  const safeFallback =
    typeof fallback === 'string' && fallback.trim().length > 0
      ? fallback.trim()
      : DEFAULT_FALLBACK_PT;

  if (!error) {
    return safeFallback;
  }

  const code = extractErrorCode(error);
  if (code) {
    const normalizedAuthCode = code.toLowerCase();
    if (AUTH_ERROR_CODE_MAP[normalizedAuthCode]) {
      return AUTH_ERROR_CODE_MAP[normalizedAuthCode];
    }
    const normalizedPgCode = code.toUpperCase();
    if (POSTGRES_ERROR_CODE_MAP[normalizedPgCode]) {
      return POSTGRES_ERROR_CODE_MAP[normalizedPgCode];
    }
  }

  const rawMessage = extractRawMessage(error);
  if (rawMessage) {
    for (const entry of MESSAGE_PATTERNS) {
      const match = rawMessage.match(entry.pattern);
      if (match) {
        return entry.translate(match);
      }
    }
  }

  const status = extractStatusCode(error);
  if (status !== null && HTTP_STATUS_MAP[status]) {
    return HTTP_STATUS_MAP[status];
  }

  if (rawMessage && isLikelyPortuguese(rawMessage)) {
    return rawMessage;
  }

  return safeFallback;
}

/**
 * Cria um objeto `Error` garantindo mensagem traduzida para português brasileiro.
 */
export function toPortugueseError(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK_PT
): Error {
  return new Error(translateErrorToPtBr(error, fallback));
}
