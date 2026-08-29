import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfAvatar, NfAvatarShape, NfAvatarTint } from './nf-avatar';

/** Host que expone cada input como signal, igual que lo haría una vista real. */
@Component({
  standalone: true,
  imports: [NfAvatar],
  template: `
    <nf-avatar
      [src]="src()"
      [fallback]="fallback()"
      [tint]="tint()"
      [size]="size()"
      [shape]="shape()"
      [loading]="isLoading()"
    />
  `,
})
class Host {
  readonly src = signal<string | null>(null);
  readonly fallback = signal('Ahri');
  readonly tint = signal<NfAvatarTint>(103);
  readonly size = signal(40);
  readonly shape = signal<NfAvatarShape>('round');
  readonly isLoading = signal(false);
}

describe('NfAvatar', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const hostEl = () => root().querySelector<HTMLElement>('nf-avatar')!;
  const skeleton = () => root().querySelector('nf-skeleton');
  const fallbackEl = () => root().querySelector('.nf-avatar__fallback');
  const img = () => root().querySelector<HTMLImageElement>('.nf-avatar__img');

  it('con loading=true pinta el skeleton con la caja exacta, no un fallback', () => {
    host.isLoading.set(true);
    fixture.detectChanges();

    expect(skeleton()).toBeTruthy();
    expect(fallbackEl()).toBeFalsy();
    expect(img()).toBeFalsy();
  });

  it('sin src cae a las iniciales sobre el degradado de tint', () => {
    expect(skeleton()).toBeFalsy();
    expect(img()).toBeFalsy();
    expect(fallbackEl()!.textContent!.trim()).toBe('AH');
    // jsdom normaliza hsl(...) a rgb(...) al leer `style.background`; el valor es
    // el mismo degradado, solo cambia la sintaxis con la que jsdom lo serializa.
    const bg = (fallbackEl() as HTMLElement).style.background;
    expect(bg).toContain('radial-gradient(circle at 32% 26%');
    expect(bg).toContain('rgb(127, 246, 81)'); // hsl(103,90%,64%)
    expect(bg).toContain('rgb(51, 136, 17)'); // hsl(103,78%,30%)
  });

  it('acepta un par de stops ya resueltos como tint', () => {
    host.tint.set(['#ff00ff', '#00ffff']);
    fixture.detectChanges();

    const bg = (fallbackEl() as HTMLElement).style.background;
    expect(bg).toContain('rgb(255, 0, 255)');
    expect(bg).toContain('rgb(0, 255, 255)');
  });

  it('calcula las iniciales a partir de fallback, ignorando símbolos, en mayúsculas', () => {
    host.fallback.set('miss fortune');
    fixture.detectChanges();
    expect(fallbackEl()!.textContent!.trim()).toBe('MI');
  });

  it('sin fallback usable, muestra "??"', () => {
    host.fallback.set('');
    fixture.detectChanges();
    expect(fallbackEl()!.textContent!.trim()).toBe('??');
  });

  it('con src pinta la imagen en vez del fallback', () => {
    host.src.set('https://ddragon.leagueoflegends.com/cdn/16.14.1/img/champion/Ahri.png');
    fixture.detectChanges();

    expect(fallbackEl()).toBeFalsy();
    const el = img()!;
    expect(el).toBeTruthy();
    expect(el.getAttribute('loading')).toBe('lazy');
    expect(el.getAttribute('decoding')).toBe('async');
    expect(el.width).toBe(40);
    expect(el.height).toBe(40);
  });

  it('si la imagen falla, conmuta al fallback de iniciales', () => {
    host.src.set('https://ddragon.leagueoflegends.com/cdn/16.14.1/img/champion/Ahri.png');
    fixture.detectChanges();

    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(img()).toBeFalsy();
    expect(fallbackEl()!.textContent!.trim()).toBe('AH');
  });

  it('al cambiar de src tras un fallo, se le da otra oportunidad a la imagen', () => {
    host.src.set('https://broken/1.png');
    fixture.detectChanges();
    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fallbackEl()).toBeTruthy();

    host.src.set('https://ddragon.leagueoflegends.com/cdn/16.14.1/img/champion/Ahri.png');
    fixture.detectChanges();

    expect(img()).toBeTruthy();
    expect(fallbackEl()).toBeFalsy();
  });

  it('expone `size` como la custom property --nf-avatar-size, no como width/height inline', () => {
    // A propósito: un `[style.width.px]` inline ganaría siempre a cualquier CSS de
    // vista (p. ej. la media query que sube `.m-card__champ-icon` a 52px en móvil), así
    // que el tamaño se aplica vía custom property y es el CSS del componente quien
    // la traduce a `width`/`height` (con hueco de override, ver nf-avatar.scss).
    expect(hostEl().style.getPropertyValue('--nf-avatar-size')).toBe('40px');
    expect(hostEl().style.width).toBe('');
    expect(hostEl().style.height).toBe('');

    host.size.set(68);
    fixture.detectChanges();
    expect(hostEl().style.getPropertyValue('--nf-avatar-size')).toBe('68px');
  });

  it('shape="round" (por defecto) marca el host con .nf-avatar--round; "square" no', () => {
    expect(hostEl().classList.contains('nf-avatar--round')).toBe(true);

    host.shape.set('square');
    fixture.detectChanges();
    expect(hostEl().classList.contains('nf-avatar--round')).toBe(false);
  });
});
