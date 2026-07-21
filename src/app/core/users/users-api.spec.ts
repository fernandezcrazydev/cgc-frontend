import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { UsersApi } from './users-api';
import { UserSearchResult } from './models';

const API = environment.apiUrl;

describe('UsersApi', () => {
  let api: UsersApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UsersApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(UsersApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('search hace GET /users con el query', () => {
    const expected: UserSearchResult[] = [{ userId: 'u1', discordUsername: 'St0rm', avatarUrl: null }];
    let received: UserSearchResult[] | undefined;
    api.search('st0').subscribe((r) => (received = r));

    const req = http.expectOne(`${API}/users?query=st0`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(received).toEqual(expected);
  });
});
