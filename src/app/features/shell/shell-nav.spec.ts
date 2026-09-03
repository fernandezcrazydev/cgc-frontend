import { describe, expect, it } from 'vitest';
import { GROUP_NAV, groupIdFromUrl, isGroupHubUrl, pageTitleFor } from './shell-nav';

describe('pageTitleFor', () => {
  it('rotula las secciones de un grupo, que antes caían todas en «Inicio»', () => {
    // Este era el bug: la resolución anterior tomaba el último segmento («ranking») y, al no
    // encontrarlo entre los destinos globales, se rendía a «Inicio». La cabecera leía
    // «LAN Challenger · Inicio» estando en el ranking.
    expect(pageTitleFor('/app/grupos/abc-123/ranking')).toBe('Ranking');
    expect(pageTitleFor('/app/grupos/abc-123/tierlist')).toBe('Tierlist');
    expect(pageTitleFor('/app/grupos/abc-123/estadisticas')).toBe('Estadísticas');
    expect(pageTitleFor('/app/grupos/abc-123/partidas')).toBe('Partidas');
    expect(pageTitleFor('/app/grupos/abc-123/partidas/sala-9')).toBe('Sala');
    expect(pageTitleFor('/app/grupos/abc-123/crear-partida')).toBe('Crear partida');
    expect(pageTitleFor('/app/grupos/abc-123/discord')).toBe('Discord');
    expect(pageTitleFor('/app/grupos/abc-123/historial')).toBe('Historial');
    expect(pageTitleFor('/app/grupos/abc-123')).toBe('Hub del grupo');
    expect(pageTitleFor('/app/grupos')).toBe('Grupos');
  });

  it('rotula el cara a cara y el panel de administración', () => {
    expect(pageTitleFor('/app/versus/Pix3lQueen%23LAN')).toBe('Cara a cara');
    expect(pageTitleFor('/app/versus/Pix3lQueen%23LAN/seed-004')).toBe('Duelo directo');
    expect(pageTitleFor('/app/synergy/Pix3lQueen%23LAN')).toBe('Sinergia');
    expect(pageTitleFor('/app/historial-cruzado/Pix3lQueen%23LAN')).toBe('Historial cruzado');
    expect(pageTitleFor('/app/jugador/Pix3lQueen%23LAN')).toBe('Historial cruzado');
    expect(pageTitleFor('/app/jugador/Pix3lQueen%23LAN/contra')).toBe('Cara a cara');
    expect(pageTitleFor('/app/jugador/Pix3lQueen%23LAN/contra/seed-004')).toBe('Duelo directo');
    expect(pageTitleFor('/app/jugador/Pix3lQueen%23LAN/juntos')).toBe('Sinergia de dúo');
    expect(pageTitleFor('/app/jugador/Pix3lQueen%23LAN/juntos/seed-004')).toBe('Sinergia en la partida');
    expect(pageTitleFor('/app/admin')).toBe('Administración');
    expect(pageTitleFor('/app/admin/seguridad')).toBe('Seguridad');
    expect(pageTitleFor('/app/admin/feedback')).toBe('Feedback');
    expect(pageTitleFor('/app/admin/feedback/42')).toBe('Reporte');
    expect(pageTitleFor('/app/admin/riot-metricas')).toBe('Métricas de Riot');
  });

  it('distingue el historial personal de una partida suya, y del de un grupo', () => {
    expect(pageTitleFor('/app/historial')).toBe('Historial de partidas');
    expect(pageTitleFor('/app/historial/seed-001')).toBe('Partida');
    expect(pageTitleFor('/app/grupos/abc-123/historial')).toBe('Historial');
  });

  it('no confunde rutas con el mismo prefijo y distinto número de segmentos', () => {
    expect(pageTitleFor('/app/perfil')).toBe('Perfil');
    expect(pageTitleFor('/app/perfil/Pix3lQueen%23LAN')).toBe('Perfil');
  });

  it('ignora la query y el fragmento', () => {
    expect(pageTitleFor('/app/historial-cruzado/Pix3lQueen%23LAN?modo=versus')).toBe(
      'Historial cruzado',
    );
    expect(pageTitleFor('/app/grupos/abc-123/ranking#tabla')).toBe('Ranking');
  });

  it('una ruta desconocida bajo /app es 404, no «Inicio»', () => {
    // Importa que no mienta: el shell pinta `no-encontrado` en el outlet, y una cabecera que
    // dijera «Inicio» contradiría lo que se está viendo.
    expect(pageTitleFor('/app/lo-que-sea')).toBe('Página no encontrada');
    expect(pageTitleFor('/app/grupos/abc-123/inventado')).toBe('Página no encontrada');
  });

  it('cae en «Inicio» en la raíz del shell y fuera de él', () => {
    expect(pageTitleFor('/app')).toBe('Inicio');
    expect(pageTitleFor('/app/inicio')).toBe('Inicio');
    expect(pageTitleFor('/')).toBe('Inicio');
    expect(pageTitleFor('')).toBe('Inicio');
  });
});

describe('GROUP_NAV', () => {
  it('encabeza con el hub: pulsar el grupo despliega estas secciones en vez de entrar', () => {
    expect(GROUP_NAV[0].path).toBe('');
    expect(GROUP_NAV[0].label).toBe('Hub del grupo');
  });

  it('«Crear partida» sigue destacada: es la acción central de la app', () => {
    expect(GROUP_NAV[1].path).toBe('crear-partida');
    expect(GROUP_NAV[1].primary).toBe(true);
    expect(GROUP_NAV.filter((i) => i.primary)).toHaveLength(1);
  });

  it('solo Discord está restringido a quien gestiona el grupo', () => {
    expect(GROUP_NAV.filter((i) => i.adminOnly).map((i) => i.path)).toEqual(['discord']);
  });

  it('cada sección tiene su ruta real y ninguna se repite', () => {
    const paths = GROUP_NAV.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
    // El hub es la ruta del grupo a secas, así que su segmento es la cadena vacía.
    expect(paths).toContain('');
  });
});

describe('groupIdFromUrl', () => {
  it('reconoce el grupo en el hub y en todas sus secciones', () => {
    const id = '84ffd0e4-48d4-41b1-a60f-fefb46a96257';
    expect(groupIdFromUrl(`/app/grupos/${id}`)).toBe(id);
    expect(groupIdFromUrl(`/app/grupos/${id}/ranking`)).toBe(id);
    expect(groupIdFromUrl(`/app/grupos/${id}/estadisticas`)).toBe(id);
    expect(groupIdFromUrl(`/app/grupos/${id}/partidas/sala-9`)).toBe(id);
    expect(groupIdFromUrl(`/app/grupos/${id}/ranking?orden=winrate`)).toBe(id);
  });

  it('el directorio no es un grupo', () => {
    expect(groupIdFromUrl('/app/grupos')).toBeNull();
  });

  it('las rutas que no son de grupo no seleccionan nada', () => {
    // Importa que devuelva null y no algo: el grupo activo es pegajoso, y una ruta ajena no
    // debe cambiarlo (Inicio depende de que siga puesto).
    expect(groupIdFromUrl('/app/inicio')).toBeNull();
    expect(groupIdFromUrl('/app/historial/seed-001')).toBeNull();
    expect(groupIdFromUrl('/app/versus/Pix3lQueen%23LAN')).toBeNull();
    expect(groupIdFromUrl('/')).toBeNull();
  });
});

describe('isGroupHubUrl', () => {
  const id = '84ffd0e4-48d4-41b1-a60f-fefb46a96257';

  it('es cierto solo en el hub, no en sus secciones', () => {
    expect(isGroupHubUrl(`/app/grupos/${id}`)).toBe(true);
    expect(isGroupHubUrl(`/app/grupos/${id}?x=1`)).toBe(true);
    expect(isGroupHubUrl(`/app/grupos/${id}/ranking`)).toBe(false);
    expect(isGroupHubUrl(`/app/grupos/${id}/partidas/sala-9`)).toBe(false);
  });

  it('el directorio de grupos no es el hub de ninguno', () => {
    expect(isGroupHubUrl('/app/grupos')).toBe(false);
  });

  it('las rutas ajenas no lo son', () => {
    expect(isGroupHubUrl('/app/inicio')).toBe(false);
    expect(isGroupHubUrl('/')).toBe(false);
  });
});
