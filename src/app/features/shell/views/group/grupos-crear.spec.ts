import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GroupsStore } from '../../../../core/groups';
import { Grupos } from './grupos';

/**
 * El diálogo de creación avisa de que el grupo nace con tres ligas y sus duraciones (F5.5-23).
 */
describe('Grupos — creación de grupo y disclaimer de ligas', () => {
  let createSpy: any;

  function createFixture(): ComponentFixture<Grupos> {
    createSpy = vi.fn().mockResolvedValue({ groupId: 'g-new', name: 'Nuevo Grupo' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'app/grupos/:id', component: class {} }]),
        {
          provide: GroupsStore,
          useValue: {
            status: () => 'ready',
            groups: () => [],
            selectedId: () => null,
            pending: () => false,
            reload: () => Promise.resolve([]),
            select: () => undefined,
            create: createSpy,
          },
        },
      ],
    });
    return TestBed.createComponent(Grupos);
  }

  function createComponent(): Grupos {
    return createFixture().componentInstance;
  }

  it('se crea correctamente', () => {
    const grupos = createComponent();
    expect(grupos).toBeTruthy();
  });

  it('el diálogo enseña el disclaimer de las tres ligas y sus duraciones', () => {
    const fixture = createFixture();
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const disclaimer = fixture.nativeElement.querySelector('.grp-leagues-disclaimer');
    expect(disclaimer).toBeTruthy();

    const text = disclaimer.textContent;
    expect(text).toContain('TU GRUPO NACE CON TRES LIGAS');
    expect(text).toContain('Competitivo');
    expect(text).toContain('6 meses');
    expect(text).toContain('Equilibrado');
    expect(text).toContain('3 meses');
    expect(text).toContain('Caos');
    expect(text).toContain('2 meses');
    expect(text).toContain('Podrás cambiar el nombre y la duración de cada una desde los ajustes del grupo');
  });

  it('crear un grupo envía matchmakingPreset fijo a BALANCED', async () => {
    const fixture = createFixture();
    const grupos = fixture.componentInstance;
    grupos.openCreate();
    grupos.name.set('Nuevo Grupo');
    grupos.tag.set('NG');
    fixture.detectChanges();

    await grupos.create();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nuevo Grupo',
        tag: 'NG',
        matchmakingPreset: 'BALANCED',
      }),
    );
  });
});
