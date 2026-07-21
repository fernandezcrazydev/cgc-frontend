import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { errorMessage, messageForError, parseApiError } from './api-error';

/** Un HttpErrorResponse con cuerpo ProblemDetail, como lo da el backend. */
function problem(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('parseApiError', () => {
  it('extrae code, detail y status de un ProblemDetail', () => {
    const err = parseApiError(
      problem(400, {
        code: 'UNSUPPORTED_IMAGE',
        detail: 'Unsupported image type; use JPEG or PNG',
        status: 400,
      }),
    );
    expect(err).toMatchObject({ status: 400, code: 'UNSUPPORTED_IMAGE' });
    expect(err.detail).toBe('Unsupported image type; use JPEG or PNG');
  });

  it('deja code/detail en null si el backend no los mandó', () => {
    const err = parseApiError(problem(500, { title: 'Server Error' }));
    expect(err.code).toBeNull();
    expect(err.detail).toBeNull();
    expect(err.status).toBe(500);
  });

  it('trata un error de red (status 0, sin cuerpo) sin romperse', () => {
    const err = parseApiError(problem(0, null));
    expect(err).toEqual({ status: 0, code: null, detail: null, errors: [] });
  });

  it('tolera un error que no es HttpErrorResponse', () => {
    const err = parseApiError(new Error('boom'));
    expect(err).toEqual({ status: 0, code: null, detail: null, errors: [] });
  });

  it('parsea errores por campo de un 422 y descarta entradas malformadas', () => {
    const err = parseApiError(
      problem(422, {
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'name', code: 'TOO_LONG' }, { field: 'name' }, 'basura'],
      }),
    );
    expect(err.errors).toEqual([{ field: 'name', code: 'TOO_LONG' }]);
  });
});

describe('messageForError', () => {
  it('traduce un code conocido a su mensaje en español', () => {
    const msg = messageForError({ status: 400, code: 'UNSUPPORTED_IMAGE', detail: null, errors: [] });
    expect(msg).toBe('Ese formato de imagen no es válido. Usa JPEG o PNG.');
  });

  it('cae al genérico por status y avisa en consola con un code desconocido', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const msg = messageForError({ status: 409, code: 'BRAND_NEW_CODE', detail: null, errors: [] });
    expect(msg).toBe('La operación entra en conflicto con el estado actual. Recarga e inténtalo de nuevo.');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('usa el genérico por status cuando no hay code', () => {
    const msg = messageForError({ status: 403, code: null, detail: null, errors: [] });
    expect(msg).toBe('No tienes permiso para hacer esto.');
  });

  it('mensaje de red para status 0', () => {
    const msg = messageForError({ status: 0, code: null, detail: null, errors: [] });
    expect(msg).toContain('No hay conexión');
  });

  it('fallback inespecífico para un status sin mensaje propio', () => {
    const msg = messageForError({ status: 418, code: null, detail: null, errors: [] });
    expect(msg).toBe('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
  });
});

describe('errorMessage', () => {
  it('encadena parse + message: del HttpErrorResponse directo al texto', () => {
    const msg = errorMessage(problem(400, { code: 'UNSUPPORTED_IMAGE' }));
    expect(msg).toBe('Ese formato de imagen no es válido. Usa JPEG o PNG.');
  });
});
