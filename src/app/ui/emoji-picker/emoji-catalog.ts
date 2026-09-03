/**
 * Emojis con NOMBRE en español, para poder buscarlos por palabra.
 *
 * No es el juego completo a propósito, y no hace falta que lo sea: la rejilla del buscador se
 * genera de los bloques Unicode en el momento (`emoji-blocks.ts`), así que aquí solo están los
 * que tiene sentido encontrar escribiendo «fuego» o «dragón» —los que se usan de verdad para
 * comentar una partida—. Ampliarlo es añadir filas; no hay más lógica que la búsqueda.
 */
export interface EmojiEntry {
  emoji: string;
  /** Palabras por las que se encuentra, en minúsculas y sin tildes. */
  terms: string;
}

export interface EmojiGroup {
  id: string;
  label: string;
  emojis: readonly EmojiEntry[];
}

export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  {
    id: 'reacciones',
    label: 'Reacciones',
    emojis: [
      { emoji: '🔥', terms: 'fuego fire llamas on fire' },
      { emoji: '💀', terms: 'calavera muerte skull morir' },
      { emoji: '👑', terms: 'corona rey reina king' },
      { emoji: '🤡', terms: 'payaso clown troll' },
      { emoji: '😂', terms: 'risa lol jaja llorar de risa' },
      { emoji: '🫡', terms: 'saludo respeto salute o7' },
      { emoji: '🧊', terms: 'hielo frio cubito ice' },
      { emoji: '🐐', terms: 'cabra goat mejor de todos' },
      { emoji: '😱', terms: 'susto miedo grito shock' },
      { emoji: '🤯', terms: 'explota cabeza mente flipar' },
      { emoji: '😭', terms: 'llorar triste llanto' },
      { emoji: '🥶', terms: 'congelado frio helado' },
      { emoji: '🤝', terms: 'apreton manos trato duo' },
      { emoji: '👏', terms: 'aplauso bravo palmas' },
      { emoji: '🙏', terms: 'gracias porfavor rezar' },
      { emoji: '💅', terms: 'unas facil sin despeinarse' },
    ],
  },
  {
    id: 'partida',
    label: 'Partida',
    emojis: [
      { emoji: '⚔️', terms: 'espadas pelea duelo combate' },
      { emoji: '🛡️', terms: 'escudo defensa tanque' },
      { emoji: '🏹', terms: 'arco flecha adc tirador' },
      { emoji: '🗡️', terms: 'daga espada asesino' },
      { emoji: '🧙', terms: 'mago hechicero mid' },
      { emoji: '🐉', terms: 'dragon alma draco' },
      { emoji: '🦅', terms: 'aguila heraldo vision' },
      { emoji: '🏰', terms: 'torre castillo estructura nexo' },
      { emoji: '💣', terms: 'bomba explosion' },
      { emoji: '🎯', terms: 'diana puntería acierto skillshot' },
      { emoji: '🧠', terms: 'cerebro listo jugada inteligente' },
      { emoji: '🥷', terms: 'ninja sigilo emboscada' },
      { emoji: '🩸', terms: 'sangre first blood sangriento' },
      { emoji: '👁️', terms: 'ojo vision ward guardia' },
      { emoji: '🪤', terms: 'trampa emboscada' },
      { emoji: '🕹️', terms: 'mando jugar gameplay' },
    ],
  },
  {
    id: 'medallas',
    label: 'Medallas',
    emojis: [
      { emoji: '🏆', terms: 'trofeo copa campeon ganar' },
      { emoji: '🥇', terms: 'oro primero medalla' },
      { emoji: '🥈', terms: 'plata segundo medalla' },
      { emoji: '🥉', terms: 'bronce tercero medalla' },
      { emoji: '🎖️', terms: 'medalla honor mvp' },
      { emoji: '⭐', terms: 'estrella destacado top' },
      { emoji: '💎', terms: 'diamante joya elo' },
      { emoji: '🚀', terms: 'cohete subir escalar' },
      { emoji: '📈', terms: 'subida grafica lp' },
      { emoji: '📉', terms: 'bajada grafica perder lp' },
      { emoji: '🔨', terms: 'martillo aplastar dominar' },
      { emoji: '🧨', terms: 'petardo explotar remontada' },
    ],
  },
  {
    id: 'gente',
    label: 'Gente',
    emojis: [
      { emoji: '😎', terms: 'gafas guay chulo' },
      { emoji: '🥲', terms: 'sonrisa triste aguantar' },
      { emoji: '😴', terms: 'dormido afk aburrido' },
      { emoji: '🤔', terms: 'pensar duda hmm' },
      { emoji: '😤', terms: 'enfadado furia rabia' },
      { emoji: '🫠', terms: 'derretido fundido tilt' },
      { emoji: '🤫', terms: 'silencio callar shh' },
      { emoji: '🙈', terms: 'mono ver verguenza' },
      { emoji: '👀', terms: 'ojos mirar atento' },
      { emoji: '💪', terms: 'fuerza musculo carry' },
      { emoji: '🫶', terms: 'corazon manos amor apoyo' },
      { emoji: '🖐️', terms: 'mano parar saludo' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    emojis: [
      { emoji: '🍿', terms: 'palomitas espectaculo drama' },
      { emoji: '🐔', terms: 'pollo gallina cobarde' },
      { emoji: '🦆', terms: 'pato quack' },
      { emoji: '🍞', terms: 'pan bread manco' },
      { emoji: '🧻', terms: 'papel blandito' },
      { emoji: '🪦', terms: 'tumba muerto rip' },
      { emoji: '⏰', terms: 'reloj tiempo tarde' },
      { emoji: '🎲', terms: 'dado suerte azar caos' },
      { emoji: '🎰', terms: 'tragaperras azar ultra caos' },
      { emoji: '🧯', terms: 'extintor apagar fuegos' },
      { emoji: '🔧', terms: 'llave arreglar parche' },
      { emoji: '📌', terms: 'chincheta fijar nota' },
    ],
  },
];

/** Todos los emojis del catálogo, aplanados: es sobre esto que busca el selector. */
export const ALL_EMOJIS: readonly EmojiEntry[] = EMOJI_GROUPS.flatMap((g) => g.emojis);
