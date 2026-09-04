# Utilidades de la migración de `views.scss`

**Temporales.** Existen solo para desmontar `src/app/features/shell/views/views.scss` en hojas
por componente. Cuando ese fichero desaparezca, **borra esta carpeta entera**: no son
infraestructura del proyecto.

El procedimiento y las decisiones están en `CLAUDE.md`, § "Organización de ficheros y localidad
del CSS".

## El ciclo

```bash
node scripts/migracion-css/planificar.mjs cp pf cx          # 1. qué bloques tienen dueño único
node scripts/migracion-css/extraer-prefijo.mjs cp-step,... <destino.scss> --apply
node scripts/migracion-css/borrar-clases-muertas.mjs <hoja.scss> clase1 clase2
node scripts/migracion-css/verificar-vs-head.mjs            # 4. no se ha perdido nada
npm run arch && npm test && npx ng build --configuration production
```

## `planificar.mjs <prefijo...>`

Cruza los sub-bloques de un prefijo con los componentes que los escriben. Un bloque con **un
solo** consumidor puede irse a su hoja encapsulada; uno con varios se queda global salvo que
tenga un ancestro siempre cargado. Imprime las dos listas.

## `extraer-prefijo.mjs <prefijos> <destino.scss> [--apply]`

Mueve las reglas de esos prefijos a otra hoja, cortando por offsets del texto original: lo que
se queda conserva sus bytes exactos, así el diff del origen es **solo borrados**. Parte los
`@media` para llevarse únicamente las reglas del prefijo. Sin `--apply` solo informa.

Mira siempre sus dos avisos:

- **MIXTAS**: reglas que tocan varios prefijos. Van a mano.
- **RIESGO al encapsular**: selectores hacia `.nf-*`. Los que apuntan a la clase **host** del
  componente sobreviven (`<nf-avatar>` recibe el `_ngcontent` del padre); los que apuntan a
  **hijos internos** (`.nf-pager__btn`) no. Para esos, expón una custom property en la primitiva
  y fíjala sobre el host — ver `nf-pagination.scss` y `nf-segmented.scss`. Nunca `::ng-deep`.

`EXTRACT_SRC=<hoja>` cambia el fichero de origen, para repartir una hoja ya extraída que se pase
del presupuesto `anyComponentStyle` de Angular.

## `borrar-clases-muertas.mjs <hoja.scss> <clase...>`

Borra las reglas cuyos selectores ya no pueden casar. Un selector muere si **cualquiera** de sus
clases está muerta, sea el sujeto o un ancestro (`.viva .muerta` no casa jamás). En una lista
separada por comas se poda solo la parte muerta.

`npm run arch` lista las candidatas (regla `dead-css`). Confirma siempre con un grep sobre todo
`src/` antes de borrar.

## `verificar-vs-head.mjs [--todas] [--cambios]`

**El que da la confianza.** Compara el CSS de una referencia con el actual regla a regla y solo
falla si desaparece una regla cuyas clases siguen todas vivas. Detecta lo que un build en verde
no ve: reglas mutiladas, cuerpos alterados, selectores perdidos al mover un bloque.

Resuelve el anidamiento de SCSS (`.a { .b {} }`, `&:hover`) y las at-rules (`@media`). No es un
detalle: sin eso era ciego a 225 reglas de `shell.scss`, `inicio.scss` y las hojas del ranking,
justo donde más se anida.

```bash
REF=origin/main node scripts/migracion-css/verificar-vs-head.mjs   # tras un merge
```

Los "cuerpos cambiados" no hacen fallar el check: una sustitución de tokens
(`11px` → `var(--fs-label)`) los mueve todos y es legítima. Míralos con `--cambios` cuando el
cambio debiera haber sido puramente mecánico.

## Cinco trampas que ya costaron una pasada cada una

1. **Reformatear el fichero de origen** hace el diff irrevisable (1.040 inserciones antes de
   cortar por offsets). El origen solo debe perder líneas.
2. **Un comentario entre selectores** (`.a:hover,` / `/* nota */` / `.a.is-x {`) se colaba en el
   selector y dejaba fragmentos colgando. Un comentario solo es frontera de bloque si lo que se
   lleva acumulado es espacio en blanco.
3. **Una coma dentro de un comentario** (`/* ... (es un combobox), así que ... */`) hacía pasar
   la regla por lista de selectores y mutilaba el comentario al podarla. Nunca se reescribe una
   lista que lleve un comentario dentro.
4. **Un `@use` al principio del fichero** sin `;` tratado como frontera hacía que el parser
   tomara la primera regla por at-rule. Un `;` a nivel cero cierra una at-rule sin bloque.
5. **El anidamiento de SCSS** no se resolvía, así que el verificador daba OK sin haber mirado
   las reglas internas de las hojas que anidan. "Verificado" y "verificado del todo" no son lo
   mismo: comprueba el recuento de reglas de la referencia, no solo el veredicto.

## Al integrar `main`

La migración es **reproducible**, y ese es el motivo de que estas herramientas se commitearan.
Cuando `main` toca `views.scss`, no pelees los conflictos a mano: quédate con el CSS de `main`
(`git checkout --theirs`), borra las hojas extraídas, y **reejecuta el ciclo entero encima**.
Luego `REF=origin/main` en el verificador para comprobar que no se ha perdido nada de `main`.
