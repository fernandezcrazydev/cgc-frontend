import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';

/**
 * Aterrizaje del Authorization Code. El backend nos devuelve aquí con `?code=...`
 * (esta URL es la `redirectUri` del RegisteredClient "cgc-web").
 *
 * `checkAuth()` canjea el code por el token usando el verifier de PKCE que la
 * librería guardó antes de salir. No hay nada que renderizar: es un paso técnico.
 */
@Component({
  selector: 'app-callback',
  standalone: true,
  template: '',
})
export class Callback implements OnInit {
  private readonly oidc = inject(OidcSecurityService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.oidc.checkAuth().subscribe({
      next: ({ isAuthenticated }) =>
        void this.router.navigateByUrl(isAuthenticated ? '/app' : '/'),
      error: () => void this.router.navigateByUrl('/'),
    });
  }
}
