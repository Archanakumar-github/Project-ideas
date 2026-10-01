/** Time-of-day greetings and a small library of quiet, philosophical lines. */

export interface Greeting {
  title: string
  subtitle: string
}

export function greetingFor(date: Date): Greeting {
  const h = date.getHours()
  if (h >= 5 && h < 12) return { title: 'Quiet morning', subtitle: 'The day is still unwritten.' }
  if (h >= 12 && h < 17) return { title: 'Soft afternoon', subtitle: 'Linger a while with what you love.' }
  if (h >= 17 && h < 21) return { title: 'Gentle evening', subtitle: 'Let the light fade slowly.' }
  return { title: 'Still night', subtitle: 'The stars keep their own counsel.' }
}

export interface Quote {
  text: string
  author: string
}

export const QUOTES: Quote[] = [
  { text: 'Very little is needed to make a happy life; it is all within yourself.', author: 'Marcus Aurelius' },
  { text: 'The soul becomes dyed with the colour of its thoughts.', author: 'Marcus Aurelius' },
  { text: 'He who has a garden and a library wants for nothing.', author: 'Cicero' },
  { text: 'All of humanity’s problems stem from our inability to sit quietly in a room alone.', author: 'Blaise Pascal' },
  { text: 'We are all in the gutter, but some of us are looking at the stars.', author: 'Oscar Wilde' },
  { text: 'Nature does not hurry, yet everything is accomplished.', author: 'attributed to Lao Tzu' },
  { text: 'In the midst of winter, I found there was, within me, an invincible summer.', author: 'Albert Camus' },
  { text: 'The greatest thing in the world is to know how to belong to oneself.', author: 'Michel de Montaigne' },
  { text: 'The quieter you become, the more you are able to hear.', author: 'attributed to Rumi' },
  { text: 'I went to the woods because I wished to live deliberately.', author: 'Henry David Thoreau' },
  { text: 'Be patient toward all that is unsolved in your heart.', author: 'Rainer Maria Rilke' },
  { text: 'The cosmos is within us. We are made of star-stuff.', author: 'Carl Sagan' },
  { text: 'Wherever you are, be all there.', author: 'Jim Elliot' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'There is no greater agony than bearing an untold story inside you.', author: 'Maya Angelou' },
  { text: 'Keep your eyes on the stars, and your feet on the ground.', author: 'attributed to Theodore Roosevelt' },
  { text: 'To see a world in a grain of sand, and a heaven in a wild flower.', author: 'William Blake' },
  { text: 'The mind is everything. What you think you become.', author: 'attributed to the Buddha' },
  { text: 'Happiness depends upon ourselves.', author: 'Aristotle' },
  { text: 'One must still have chaos in oneself to give birth to a dancing star.', author: 'Friedrich Nietzsche' },
  { text: 'Not all those who wander are lost.', author: 'J. R. R. Tolkien' },
  { text: 'Two things fill the mind with ever new and increasing wonder: the starry heavens above me and the moral law within me.', author: 'Immanuel Kant' },
  { text: 'I have loved the stars too fondly to be fearful of the night.', author: 'Sarah Williams' },
]

/** The same quote all day, a new one tomorrow; `offset` lets a tap step through the rest. */
export function quoteFor(date: Date, offset = 0): Quote {
  const day = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2024, 0, 1)) / 86_400_000,
  )
  const n = QUOTES.length
  return QUOTES[(((day + offset) % n) + n) % n]
}
