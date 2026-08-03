import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LobbiesApi } from './lobbies-api';
import { environment } from '../../../environments/environment';

describe('LobbiesApi', () => {
  let api: LobbiesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LobbiesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('convoca con las horas y la nota en el cuerpo', () => {
    api.create('g1', { slotStartTimes: ['2026-08-07T20:00:00Z'], note: 'scrims' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/groups/g1/lobbies`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ slotStartTimes: ['2026-08-07T20:00:00Z'], note: 'scrims' });
    req.flush(null);
  });

  it('pagina el listado por offset', () => {
    api.listForGroup('g1', 2, 10).subscribe();

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/groups/g1/lobbies`,
    );
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('apuntarse es un POST a la franja', () => {
    api.signUp('lb1', 'sl1').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/lobbies/lb1/slots/sl1/signup`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('bajarse es un DELETE a la misma ruta', () => {
    api.withdraw('lb1', 'sl1').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/lobbies/lb1/slots/sl1/signup`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('cancelar borra la convocatoria entera, no una franja', () => {
    api.cancel('lb1').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/lobbies/lb1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
