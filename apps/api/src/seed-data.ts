/**
 * Starter catalog for KIDZO. Used only by the seed script, never by request handlers.
 * French translations are included where marked. Other languages fall back to English
 * until translators add them in the admin dashboard.
 */
import type { ContentInput, LocalizedText, StickerInput, StoryNode } from '@kidzo/shared';

const t = (en: string, fr?: string): LocalizedText => (fr ? { en, fr } : { en });

type NodeInput = Omit<Partial<StoryNode>, 'scene'> &
  Pick<StoryNode, 'id' | 'text'> & {
    scene: Pick<StoryNode['scene'], 'emoji' | 'color'> & { videoUrl?: string | null };
  };
const node = ({ scene, ...n }: NodeInput): StoryNode => ({
  familyTurn: false,
  choices: [],
  next: null,
  ending: false,
  ...n,
  scene: { videoUrl: null, ...scene },
});

export const seedStickers: StickerInput[] = [
  { slug: 'moonbeam-butterfly', name: t('Moonbeam Butterfly', 'Papillon rayon de lune'), emoji: '🦋', color: '#A98BFF' },
  { slug: 'rainbow-brush', name: t('Rainbow Brush', 'Pinceau arc-en-ciel'), emoji: '🖌️', color: '#FF9EC7' },
  { slug: 'sleepy-cloud', name: t('Sleepy Cloud', 'Nuage endormi'), emoji: '☁️', color: '#5BC0F8' },
  { slug: 'brave-shell', name: t('Brave Shell', 'Carapace courageuse'), emoji: '🐢', color: '#4ED6A5' },
  { slug: 'counting-star', name: t('Counting Star', 'Étoile à compter'), emoji: '⭐', color: '#FFD23F' },
  { slug: 'animal-pal', name: t('Animal Pal', 'Ami des animaux'), emoji: '🦊', color: '#FF7A5C' },
  { slug: 'shape-shifter', name: t('Shape Shifter', 'Maître des formes'), emoji: '🔷', color: '#5BC0F8' },
  { slug: 'ocean-pearl', name: t('Ocean Pearl', 'Perle de l’océan'), emoji: '🐚', color: '#8C82C9' },
];

/** Content with the sticker referenced by slug; the seed script resolves it to an id. */
export type SeedContent = Omit<ContentInput, 'rewardStickerId'> & { rewardSticker: string | null };

const sky = { emoji: '☁️', color: '#5BC0F8' };
const garden = { emoji: '🌸', color: '#FF9EC7' };
const moon = { emoji: '🌙', color: '#A98BFF' };

export const seedContent: SeedContent[] = [
  {
    slug: 'the-secret-sky-garden',
    type: 'adventure',
    title: t('The Secret Sky Garden', 'Le jardin secret du ciel'),
    summary: t(
      'Fly above the clouds with Nia and help a sleepy garden bloom again. Your choices shape the story!',
      'Envole-toi au-dessus des nuages avec Nia et aide un jardin endormi à fleurir. Tes choix façonnent l’histoire !',
    ),
    ageMin: 5,
    ageMax: 8,
    durationMinutes: 18,
    skills: ['problem_solving', 'kindness'],
    languages: ['en', 'fr'],
    coverEmoji: '🌸',
    coverColor: '#5BC0F8',
    calm: false,
    featured: true,
    rewardStars: 30,
    rewardSticker: 'moonbeam-butterfly',
    body: {
      kind: 'branching',
      startNodeId: 'start',
      nodes: [
        node({
          id: 'start',
          scene: sky,
          text: t(
            'Nia and Zo float up, up, up on a fluffy cloud. Far above, they spot a garden resting on the sky.',
            'Nia et Zo montent, montent, montent sur un nuage tout doux. Tout là-haut, ils aperçoivent un jardin posé sur le ciel.',
          ),
          next: 'arrive',
        }),
        node({
          id: 'arrive',
          scene: garden,
          text: t(
            'The flowers are droopy and grey. "They forgot how to bloom," whispers a tiny bee. How should we say hello?',
            'Les fleurs sont tristes et grises. « Elles ont oublié comment fleurir », chuchote une petite abeille. Comment dire bonjour ?',
          ),
          choices: [
            { id: 'wave', label: t('Wave gently', 'Faire coucou doucement'), emoji: '👋', next: 'bee-friend' },
            { id: 'sing', label: t('Sing a little song', 'Chanter une petite chanson'), emoji: '🎵', next: 'bee-friend' },
          ],
        }),
        node({
          id: 'bee-friend',
          scene: { emoji: '🐝', color: '#FFD23F' },
          text: t(
            'The bee buzzes happily. "Thank you for being kind! The moonflowers in the middle need light to wake up."',
            'L’abeille bourdonne de joie. « Merci d’être gentils ! Les fleurs de lune au milieu ont besoin de lumière pour se réveiller. »',
          ),
          next: 'family-choice',
        }),
        node({
          id: 'family-choice',
          scene: moon,
          familyTurn: true,
          text: t(
            'The moonflowers need light. What should we try?',
            'Les fleurs de lune ont besoin de lumière. Que devrions-nous essayer ?',
          ),
          choices: [
            { id: 'sunbeam', label: t('Catch a sunbeam', 'Attraper un rayon de soleil'), emoji: '☀️', next: 'sunbeam' },
            { id: 'mirror', label: t('Use the magic mirror', 'Utiliser le miroir magique'), emoji: '🪞', next: 'mirror' },
          ],
        }),
        node({
          id: 'sunbeam',
          scene: { emoji: '☀️', color: '#FFD23F' },
          text: t(
            'Zo stretches out a sparkly arm and catches a warm sunbeam. It wiggles like a golden ribbon!',
            'Zo tend un bras scintillant et attrape un rayon de soleil tout chaud. Il ondule comme un ruban doré !',
          ),
          next: 'bloom',
        }),
        node({
          id: 'mirror',
          scene: { emoji: '🪞', color: '#A98BFF' },
          text: t(
            'Nia tilts the magic mirror. Light bounces from cloud to cloud, painting the sky with tiny rainbows.',
            'Nia penche le miroir magique. La lumière rebondit de nuage en nuage et peint le ciel de petits arcs-en-ciel.',
          ),
          next: 'bloom',
        }),
        node({
          id: 'bloom',
          scene: garden,
          text: t(
            'The moonflowers open one by one: pink, blue and glowing gold. The whole garden sings, "Thank you, friends!"',
            'Les fleurs de lune s’ouvrent une à une : roses, bleues et d’or brillant. Tout le jardin chante : « Merci, les amis ! »',
          ),
          next: 'butterfly',
        }),
        node({
          id: 'butterfly',
          scene: { emoji: '🦋', color: '#A98BFF' },
          text: t(
            'A moonbeam butterfly lands on Nia’s hand. "Kindness and clever ideas make everything bloom," says Zo. The end.',
            'Un papillon rayon de lune se pose sur la main de Nia. « La gentillesse et les bonnes idées font tout fleurir », dit Zo. Fin.',
          ),
          ending: true,
        }),
      ],
    },
  },
  {
    slug: 'zo-and-the-lost-colors',
    type: 'adventure',
    title: t('Zo and the Lost Colors', 'Zo et les couleurs perdues'),
    summary: t(
      'Oh no, the rainbow lost its colors! Help Zo find red, yellow and blue.',
      'Oh non, l’arc-en-ciel a perdu ses couleurs ! Aide Zo à retrouver le rouge, le jaune et le bleu.',
    ),
    ageMin: 3,
    ageMax: 6,
    durationMinutes: 10,
    skills: ['colors', 'problem_solving'],
    languages: ['en', 'fr'],
    coverEmoji: '🌈',
    coverColor: '#FF9EC7',
    calm: false,
    featured: false,
    rewardStars: 20,
    rewardSticker: 'rainbow-brush',
    body: {
      kind: 'branching',
      startNodeId: 'start',
      nodes: [
        node({
          id: 'start',
          scene: { emoji: '🌈', color: '#DFE2E8' },
          text: t('The rainbow is all grey today. Zo wants to find its colors. Where should we look first?', 'L’arc-en-ciel est tout gris aujourd’hui. Zo veut retrouver ses couleurs. Où chercher en premier ?'),
          choices: [
            { id: 'apple', label: t('In the apple tree', 'Dans le pommier'), emoji: '🍎', next: 'red' },
            { id: 'sea', label: t('By the sea', 'Au bord de la mer'), emoji: '🌊', next: 'blue' },
          ],
        }),
        node({
          id: 'red',
          scene: { emoji: '🍎', color: '#FF5A5F' },
          text: t('Shiny apples! Zo finds RED. Next, something yellow. What is yellow?', 'Des pommes brillantes ! Zo trouve le ROUGE. Maintenant, quelque chose de jaune. Qu’est-ce qui est jaune ?'),
          choices: [
            { id: 'sun', label: t('The sun', 'Le soleil'), emoji: '☀️', next: 'yellow' },
            { id: 'banana', label: t('A banana', 'Une banane'), emoji: '🍌', next: 'yellow' },
          ],
        }),
        node({
          id: 'blue',
          scene: { emoji: '🌊', color: '#5BC0F8' },
          text: t('Splashy waves! Zo finds BLUE. Next, something yellow. What is yellow?', 'Des vagues ! Zo trouve le BLEU. Maintenant, quelque chose de jaune. Qu’est-ce qui est jaune ?'),
          choices: [
            { id: 'sun', label: t('The sun', 'Le soleil'), emoji: '☀️', next: 'yellow' },
            { id: 'duck', label: t('A little duck', 'Un petit canard'), emoji: '🐤', next: 'yellow' },
          ],
        }),
        node({
          id: 'yellow',
          scene: { emoji: '🌟', color: '#FFD23F' },
          text: t('YELLOW! Zo mixes all the colors and swoosh, the rainbow shines again. Hooray!', 'JAUNE ! Zo mélange toutes les couleurs et hop, l’arc-en-ciel brille à nouveau. Hourra !'),
          ending: true,
        }),
      ],
    },
  },
  {
    slug: 'brave-little-turtle',
    type: 'adventure',
    title: t('Brave Little Turtle'),
    summary: t('Tilly the turtle is nervous about her first swim. Help her find her courage, one step at a time.'),
    ageMin: 4,
    ageMax: 8,
    durationMinutes: 12,
    skills: ['bravery', 'feelings'],
    languages: ['en'],
    coverEmoji: '🐢',
    coverColor: '#4ED6A5',
    calm: false,
    featured: false,
    rewardStars: 25,
    rewardSticker: 'brave-shell',
    body: {
      kind: 'branching',
      startNodeId: 'start',
      nodes: [
        node({
          id: 'start',
          scene: { emoji: '🏖️', color: '#FFD23F' },
          text: t('Tilly stands at the edge of the sea. Her tummy feels wobbly. What can help her feel calm?'),
          choices: [
            { id: 'breathe', label: t('Take three big breaths'), emoji: '🌬️', next: 'breathe' },
            { id: 'friend', label: t('Hold a friend’s flipper'), emoji: '🤝', next: 'friend' },
          ],
        }),
        node({
          id: 'breathe',
          scene: { emoji: '🌬️', color: '#5BC0F8' },
          text: t('In... and out. In... and out. In... and out. Tilly feels a little steadier.'),
          next: 'first-step',
        }),
        node({
          id: 'friend',
          scene: { emoji: '🐙', color: '#FF9EC7' },
          text: t('Otto the octopus offers a wiggly arm. "We can go together," he says with a smile.'),
          next: 'first-step',
        }),
        node({
          id: 'first-step',
          scene: { emoji: '🌊', color: '#5BC0F8' },
          text: t('Tilly dips one toe in. The water is cool and tickly! Should she try a little more?'),
          familyTurn: true,
          choices: [
            { id: 'yes', label: t('Yes, a little more'), emoji: '👣', next: 'swim' },
            { id: 'wait', label: t('Rest first, then try'), emoji: '⏳', next: 'rest' },
          ],
        }),
        node({
          id: 'rest',
          scene: { emoji: '🐚', color: '#A98BFF' },
          text: t('Resting is brave too. After a short break, Tilly feels ready.'),
          next: 'swim',
        }),
        node({
          id: 'swim',
          scene: { emoji: '🐢', color: '#4ED6A5' },
          text: t('Splash! Tilly swims her very first swim. "I was scared, and I did it anyway!" Being brave feels wonderful.'),
          ending: true,
        }),
      ],
    },
  },
  {
    slug: 'the-cloud-who-couldnt-sleep',
    type: 'story',
    title: t("The Cloud Who Couldn't Sleep", 'Le nuage qui ne pouvait pas dormir'),
    summary: t('A gentle bedtime story about a little cloud learning to rest.', 'Une douce histoire du soir sur un petit nuage qui apprend à se reposer.'),
    ageMin: 3,
    ageMax: 8,
    durationMinutes: 12,
    skills: ['calm', 'feelings'],
    languages: ['en', 'fr'],
    coverEmoji: '☁️',
    coverColor: '#8C82C9',
    calm: true,
    featured: true,
    rewardStars: 10,
    rewardSticker: 'sleepy-cloud',
    body: {
      kind: 'branching',
      startNodeId: 'p1',
      nodes: [
        node({ id: 'p1', scene: moon, next: 'p2', text: t('High in the evening sky lived a little cloud named Puff.', 'Tout en haut dans le ciel du soir vivait un petit nuage nommé Pouf.') }),
        node({ id: 'p2', scene: { emoji: '⭐', color: '#24264A' }, next: 'p3', text: t('The stars were twinkling softly, but Puff kept drifting this way and that. "I just can\'t sleep," Puff sighed.', 'Les étoiles scintillaient doucement, mais Pouf flottait par-ci, par-là. « Je n’arrive pas à dormir », soupira Pouf.') }),
        node({ id: 'p3', scene: moon, next: 'p4', text: t('The moon smiled kindly. "Let\'s breathe like the wind, slow and soft. In... and out."', 'La lune sourit gentiment. « Respirons comme le vent, lentement et doucement. Inspire... et expire. »') }),
        node({ id: 'p4', scene: { emoji: '🌬️', color: '#555980' }, next: 'p5', text: t('Puff breathed in, growing round and fluffy. Puff breathed out, settling low and still.', 'Pouf inspira et devint tout rond et moelleux. Pouf expira et se posa, calme et immobile.') }),
        node({ id: 'p5', scene: { emoji: '🌙', color: '#24264A' }, ending: true, text: t('Snuggled between two stars, Puff closed its eyes. Goodnight, little cloud. Goodnight, little you.', 'Blotti entre deux étoiles, Pouf ferma les yeux. Bonne nuit, petit nuage. Bonne nuit, toi aussi.') }),
      ],
    },
  },
  {
    slug: 'ocean-dreams',
    type: 'story',
    title: t('Ocean Dreams'),
    summary: t('Float along with sleepy sea friends as the tide rocks everyone to sleep.'),
    ageMin: 2,
    ageMax: 6,
    durationMinutes: 8,
    skills: ['calm', 'nature'],
    languages: ['en'],
    coverEmoji: '🐳',
    coverColor: '#555980',
    calm: true,
    featured: false,
    rewardStars: 10,
    rewardSticker: 'ocean-pearl',
    body: {
      kind: 'branching',
      startNodeId: 'p1',
      nodes: [
        node({ id: 'p1', scene: { emoji: '🌊', color: '#24264A' }, next: 'p2', text: t('Under the quiet sea, the water is soft and blue.') }),
        node({ id: 'p2', scene: { emoji: '🐠', color: '#555980' }, next: 'p3', text: t('Little fish tuck into the coral. Swish, swish, goodnight.') }),
        node({ id: 'p3', scene: { emoji: '🐙', color: '#24264A' }, next: 'p4', text: t('Octopus curls up in a cozy shell. Hush, hush, goodnight.') }),
        node({ id: 'p4', scene: { emoji: '🐳', color: '#555980' }, ending: true, text: t('Big whale hums a gentle song, and the whole ocean drifts off to dreams.') }),
      ],
    },
  },
  {
    slug: 'moon-song',
    type: 'song',
    title: t('Moon Song', 'La chanson de la lune'),
    summary: t('A soft lullaby to sing together before sleep.', 'Une douce berceuse à chanter ensemble avant de dormir.'),
    ageMin: 2,
    ageMax: 7,
    durationMinutes: 4,
    skills: ['calm', 'music'],
    languages: ['en', 'fr'],
    coverEmoji: '🌙',
    coverColor: '#24264A',
    calm: true,
    featured: false,
    rewardStars: 5,
    rewardSticker: null,
    body: {
      kind: 'song',
      audioUrl: null,
      lines: [
        { emoji: '🌙', text: t('Moon, moon, shining bright,', 'Lune, lune, qui brille si fort,') },
        { emoji: '⭐', text: t('Wrap the stars in silver light.', 'Enveloppe les étoiles d’argent et d’or.') },
        { emoji: '☁️', text: t('Clouds float slow, the wind blows low,', 'Les nuages flottent, le vent souffle tout bas,') },
        { emoji: '😴', text: t('Close your eyes, and off we go.', 'Ferme les yeux, et rêve avec moi.') },
      ],
    },
  },
  {
    slug: 'counting-stars-song',
    type: 'song',
    title: t('Counting Stars'),
    summary: t('Count from one to five with Zo and the twinkling stars.'),
    ageMin: 2,
    ageMax: 5,
    durationMinutes: 3,
    skills: ['counting', 'music'],
    languages: ['en'],
    coverEmoji: '⭐',
    coverColor: '#FFD23F',
    calm: false,
    featured: false,
    rewardStars: 5,
    rewardSticker: 'counting-star',
    body: {
      kind: 'song',
      audioUrl: null,
      lines: [
        { emoji: '1️⃣', text: t('One little star says hello!') },
        { emoji: '2️⃣', text: t('Two little stars put on a show!') },
        { emoji: '3️⃣', text: t('Three little stars twirl around!') },
        { emoji: '4️⃣', text: t('Four little stars jump up and down!') },
        { emoji: '5️⃣', text: t('Five little stars shine so bright, counting with Zo every night!') },
      ],
    },
  },
  {
    slug: 'animal-friends-quiz',
    type: 'game',
    title: t('Animal Friends', 'Les amis animaux'),
    summary: t('Can you guess which animal is which? Tap the right friend!', 'Sauras-tu reconnaître chaque animal ? Touche le bon ami !'),
    ageMin: 3,
    ageMax: 6,
    durationMinutes: 5,
    skills: ['nature', 'problem_solving'],
    languages: ['en', 'fr'],
    coverEmoji: '🦊',
    coverColor: '#FF7A5C',
    calm: false,
    featured: false,
    rewardStars: 15,
    rewardSticker: 'animal-pal',
    body: {
      kind: 'quiz',
      questions: [
        {
          id: 'q1',
          emoji: '🦊',
          prompt: t('Who has a bushy orange tail and says "yip"?', 'Qui a une queue touffue orange et fait « yip » ?'),
          correctOptionId: 'fox',
          options: [
            { id: 'panda', label: t('Red panda', 'Panda roux'), emoji: '🐼' },
            { id: 'fox', label: t('Little fox', 'Petit renard'), emoji: '🦊' },
          ],
        },
        {
          id: 'q2',
          emoji: '🦒',
          prompt: t('Who has the longest neck?', 'Qui a le plus long cou ?'),
          correctOptionId: 'giraffe',
          options: [
            { id: 'giraffe', label: t('Giraffe', 'Girafe'), emoji: '🦒' },
            { id: 'hippo', label: t('Hippo', 'Hippopotame'), emoji: '🦛' },
            { id: 'lion', label: t('Lion', 'Lion'), emoji: '🦁' },
          ],
        },
        {
          id: 'q3',
          emoji: '🐝',
          prompt: t('Who makes sweet honey?', 'Qui fabrique le miel ?'),
          correctOptionId: 'bee',
          options: [
            { id: 'butterfly', label: t('Butterfly', 'Papillon'), emoji: '🦋' },
            { id: 'bee', label: t('Bee', 'Abeille'), emoji: '🐝' },
            { id: 'ladybug', label: t('Ladybug', 'Coccinelle'), emoji: '🐞' },
          ],
        },
      ],
    },
  },
  {
    slug: 'count-with-zo',
    type: 'game',
    title: t('Count with Zo'),
    summary: t('How many can you count? Help Zo count fruit, stars and friends.'),
    ageMin: 3,
    ageMax: 6,
    durationMinutes: 6,
    skills: ['counting'],
    languages: ['en'],
    coverEmoji: '🔢',
    coverColor: '#FFD23F',
    calm: false,
    featured: false,
    rewardStars: 15,
    rewardSticker: 'counting-star',
    body: {
      kind: 'quiz',
      questions: [
        {
          id: 'q1',
          emoji: '🍎🍎🍎',
          prompt: t('How many apples?'),
          correctOptionId: 'three',
          options: [
            { id: 'two', label: t('Two'), emoji: '2️⃣' },
            { id: 'three', label: t('Three'), emoji: '3️⃣' },
            { id: 'four', label: t('Four'), emoji: '4️⃣' },
          ],
        },
        {
          id: 'q2',
          emoji: '⭐⭐⭐⭐⭐',
          prompt: t('How many stars?'),
          correctOptionId: 'five',
          options: [
            { id: 'five', label: t('Five'), emoji: '5️⃣' },
            { id: 'six', label: t('Six'), emoji: '6️⃣' },
            { id: 'four', label: t('Four'), emoji: '4️⃣' },
          ],
        },
        {
          id: 'q3',
          emoji: '🐥🐥',
          prompt: t('How many chicks?'),
          correctOptionId: 'two',
          options: [
            { id: 'one', label: t('One'), emoji: '1️⃣' },
            { id: 'two', label: t('Two'), emoji: '2️⃣' },
            { id: 'three', label: t('Three'), emoji: '3️⃣' },
          ],
        },
      ],
    },
  },
  {
    slug: 'shape-hunt',
    type: 'game',
    title: t('Shape Hunt'),
    summary: t('Spot circles, triangles and squares hiding all around.'),
    ageMin: 4,
    ageMax: 8,
    durationMinutes: 6,
    skills: ['shapes', 'problem_solving'],
    languages: ['en'],
    coverEmoji: '🔷',
    coverColor: '#5BC0F8',
    calm: false,
    featured: false,
    rewardStars: 15,
    rewardSticker: 'shape-shifter',
    body: {
      kind: 'quiz',
      questions: [
        {
          id: 'q1',
          emoji: '🍕',
          prompt: t('A slice of pizza looks like which shape?'),
          correctOptionId: 'triangle',
          options: [
            { id: 'circle', label: t('Circle'), emoji: '⚪' },
            { id: 'triangle', label: t('Triangle'), emoji: '🔺' },
            { id: 'square', label: t('Square'), emoji: '🟦' },
          ],
        },
        {
          id: 'q2',
          emoji: '🌕',
          prompt: t('The full moon is shaped like a...'),
          correctOptionId: 'circle',
          options: [
            { id: 'circle', label: t('Circle'), emoji: '⚪' },
            { id: 'star', label: t('Star'), emoji: '⭐' },
          ],
        },
        {
          id: 'q3',
          emoji: '🎁',
          prompt: t('This present box has sides shaped like a...'),
          correctOptionId: 'square',
          options: [
            { id: 'triangle', label: t('Triangle'), emoji: '🔺' },
            { id: 'square', label: t('Square'), emoji: '🟦' },
            { id: 'heart', label: t('Heart'), emoji: '❤️' },
          ],
        },
      ],
    },
  },
];
