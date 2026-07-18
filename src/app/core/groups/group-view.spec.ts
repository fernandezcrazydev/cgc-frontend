import { bannerColors, groupView, initialsOf } from './group-view';
import { GroupMembershipResponse } from './models';

describe('groupView', () => {
  it('mapea una membresía a la vista con rol, región e iniciales', () => {
    const m: GroupMembershipResponse = {
      group: { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: 'http://cdn/x.jpg' },
      role: 'ADMIN',
      joinedAt: '2026-07-18T12:00:00Z',
    };
    const v = groupView(m);
    expect(v.id).toBe('g1');
    expect(v.name).toBe('Los Cracks');
    expect(v.region).toBe('EUW');
    expect(v.role).toBe('ADMIN');
    expect(v.avatarUrl).toBe('http://cdn/x.jpg');
    expect(v.initials).toBe('LC');
  });
});

describe('initialsOf', () => {
  it('toma las iniciales de las dos primeras palabras', () => {
    expect(initialsOf('Los Cracks')).toBe('LC');
    expect(initialsOf('Vortex')).toBe('VO');
    expect(initialsOf('  ')).toBe('GR');
  });
});

describe('bannerColors', () => {
  it('es determinista: mismo id → mismos colores', () => {
    expect(bannerColors('abc')).toEqual(bannerColors('abc'));
  });

  it('ids distintos suelen dar tonos distintos', () => {
    expect(bannerColors('abc')).not.toEqual(bannerColors('xyz'));
  });
});
