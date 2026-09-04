/**
 * Superficie pública de la feature de feedback.
 *
 * El shell monta este diálogo desde su barra, así que la feature necesita algo que otras
 * puedan importar: una feature nunca importa *internals* de otra (`npm run arch`, regla
 * `feature-internals`), pero sí su barrel. Lo que no esté aquí es privado.
 */
export { FeedbackDialog } from './feedback-dialog';
