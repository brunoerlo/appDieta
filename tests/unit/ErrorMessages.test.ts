import { translateErrorToPtBr, toPortugueseError } from '@/utils/errorMessages';
import { SupabaseAuthRepository } from '@/database/repositories/SupabaseAuthRepository';

describe('Portuguese Error Translation (errorMessages)', () => {
  it('translates Supabase email rate limit errors by code and by message', () => {
    const byCode = translateErrorToPtBr({
      code: 'over_email_send_rate_limit',
      status: 429,
      message: 'email rate limit exceeded',
    });
    expect(byCode).toContain('Limite temporário de envio de e-mails atingido');

    const byMessageOnly = translateErrorToPtBr(new Error('email rate limit exceeded'));
    expect(byMessageOnly).toContain('Limite temporário de envio de e-mails atingido');
  });

  it('translates invalid email domain errors (e.g. user@menosfrango.com)', () => {
    const byCode = translateErrorToPtBr({
      code: 'email_address_invalid',
      status: 400,
      message: 'Email address "user@menosfrango.com" is invalid',
    });
    expect(byCode).toContain('endereço de e-mail');

    const byMessageOnly = translateErrorToPtBr(
      new Error('Email address "teste@menosfrango.com" is invalid')
    );
    expect(byMessageOnly).toContain('endereço de e-mail não é aceito');
  });

  it('translates security cooldown and password length messages dynamically', () => {
    expect(
      translateErrorToPtBr(
        new Error('For security purposes, you can only request this after 45 seconds.')
      )
    ).toBe('Por segurança, aguarde 45 segundos antes de tentar novamente.');

    expect(
      translateErrorToPtBr(new Error('Password should be at least 6 characters.'))
    ).toBe('A senha deve ter pelo menos 6 caracteres.');
  });

  it('translates Postgres SQLSTATE, PostgREST, Storage, and network errors', () => {
    expect(translateErrorToPtBr({ code: '42501', message: 'permission denied' })).toBe(
      'Sem permissão para acessar ou alterar este registro.'
    );
    expect(translateErrorToPtBr({ code: '23505', message: 'duplicate key value' })).toBe(
      'Este registro já existe. Evite duplicar os mesmos dados.'
    );
    expect(translateErrorToPtBr({ code: 'PGRST116', message: 'JSON object requested' })).toBe(
      'Registro não encontrado ou em duplicidade no banco de dados.'
    );
    expect(translateErrorToPtBr(new TypeError('Network request failed'))).toContain(
      'Sem conexão com a internet'
    );
    expect(translateErrorToPtBr({ name: 'AbortError', message: 'Aborted' })).toContain(
      'tempo esgotado'
    );
    expect(translateErrorToPtBr({ status: 429, message: 'Unhandled limit' })).toContain(
      'Muitas tentativas'
    );
  });

  it('preserves already-Portuguese validation messages and blocks raw English JS exceptions', () => {
    expect(translateErrorToPtBr(new Error('Informe um peso válido entre 20 e 400 kg'))).toBe(
      'Informe um peso válido entre 20 e 400 kg'
    );

    const fallback = 'Não foi possível salvar a rotina.';
    expect(
      translateErrorToPtBr(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
        fallback
      )
    ).toBe(fallback);

    expect(
      translateErrorToPtBr(new Error('Some unexpected upstream English error'), fallback)
    ).toBe(fallback);
  });

  it('wraps translated message in Error via toPortugueseError', () => {
    const err = toPortugueseError({ code: 'email_not_confirmed', message: 'Email not confirmed' });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('E-mail ainda não confirmado');
  });

  it('SupabaseAuthRepository.registerUser translates email rate limit and invalid email errors to Portuguese', async () => {
    const rateLimitClient: any = {
      auth: {
        signUp: jest.fn(async () => ({
          data: { user: null, session: null },
          error: {
            message: 'email rate limit exceeded',
            code: 'over_email_send_rate_limit',
            status: 429,
          },
        })),
      },
    };
    const repo1 = new SupabaseAuthRepository(rateLimitClient);
    await expect(
      repo1.registerUser({
        name: 'Bruno',
        email: 'bruno@gmail.com',
        password: 'password123',
      })
    ).rejects.toThrow(/Limite temporário de envio de e-mails atingido/);

    const invalidEmailClient: any = {
      auth: {
        signUp: jest.fn(async () => ({
          data: { user: null, session: null },
          error: {
            message: 'Email address "user@menosfrango.com" is invalid',
            code: 'email_address_invalid',
            status: 400,
          },
        })),
      },
    };
    const repo2 = new SupabaseAuthRepository(invalidEmailClient);
    await expect(
      repo2.registerUser({
        name: 'Bruno',
        email: 'user@menosfrango.com',
        password: 'password123',
      })
    ).rejects.toThrow(/endereço de e-mail não é aceito/i);
  });
});
