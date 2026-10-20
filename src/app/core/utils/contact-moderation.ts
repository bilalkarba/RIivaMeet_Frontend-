/**
 * Client-side contact-sharing detection.
 *
 * This is a UX pre-check only: the backend (`src/services/moderation.service.ts`) is the
 * authority and re-checks every REST and Socket.IO message. The frontend blocks obvious
 * matches before sending so the user gets an immediate, translated warning, while the
 * server still applies the configured warn/block/flag policy to every transport.
 *
 * The rules intentionally mirror `src/services/moderation.service.ts` (English, French,
 * Darija and Arabic script, spaced/letter-spaced disguises, domains and handles). Keep the
 * two implementations and their test matrices in sync when changing either one. Patterns
 * look for contact *formats* and account-introduction cues, not isolated words, so ordinary
 * coaching text is not rejected.
 */

export type ContactMatchKind =
  | 'PHONE'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'TELEGRAM'
  | 'SOCIAL_PROFILE'
  | 'SOCIAL_HANDLE';

const SOCIAL_DOMAINS: { kind: ContactMatchKind; pattern: RegExp }[] = [
  {
    kind: 'WHATSAPP',
    pattern:
      /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|wa\.link|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com|whatsapp\.link|whatsapp:)\b/i,
  },
  {
    kind: 'FACEBOOK',
    pattern:
      /(?:https?:\/\/)?(?:www\.|m\.|web\.|l\.)?(?:facebook\.com|fb\.com|fb\.me|fb\.watch|m\.me|messenger\.com)\b/i,
  },
  {
    kind: 'INSTAGRAM',
    pattern: /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am|ig\.me)\b/i,
  },
  {
    kind: 'TELEGRAM',
    pattern:
      /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.org|telegram\.dog|tg:\/\/)\b/i,
  },
  {
    kind: 'SOCIAL_PROFILE',
    pattern:
      /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|tiktok\.com|snapchat\.com|twitter\.com|x\.com|discord\.gg|discord\.com|youtube\.com|youtu\.be|pinterest\.com|reddit\.com)\b/i,
  },
];

const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

/**
 * Platform names in every spelling users type: English, French, transliterated Darija
 * and Arabic script, including the common "face book" spacing.
 */
const SOCIAL_PLATFORM_SOURCE = String.raw`face\s*book|facebook|facebok|facbook|fcbk|fcb|fb|messenger|fays\s*book|faysbook|faysbouk|fesbook|insta\s*gram|instagram|instgram|insta|ig|whats\s*app|whatsapp|whatsap|watsapp|tele\s*gram|telegram|telgram|tg|tiktok|snapchat|linkedin|فيسبوك|فايسبوك|فيس\s*بوك|انستغرام|إنستغرام|انستجرام|إنستجرام|واتساب|واتس\s*اب|وتساب|تلغرام|تيليغرام|تلجرام|تيليجرام`;

const PLATFORM_BOUNDARY_START = String.raw`(?<![\p{L}\p{N}])`;
const PLATFORM_BOUNDARY_END = String.raw`(?![\p{L}\p{N}])`;

/** Non-global: `exec` is safe to reuse without leaking `lastIndex`. */
const SOCIAL_PLATFORM_TEST = new RegExp(
  `${PLATFORM_BOUNDARY_START}(${SOCIAL_PLATFORM_SOURCE})${PLATFORM_BOUNDARY_END}`,
  'iu',
);

const SOCIAL_HANDLE_PATTERN = new RegExp(
  `${PLATFORM_BOUNDARY_START}(?:${SOCIAL_PLATFORM_SOURCE}|wa)${PLATFORM_BOUNDARY_END}\\s*(?::\\s*)?@[\\p{L}0-9_][\\p{L}0-9_.-]{2,31}${PLATFORM_BOUNDARY_END}`,
  'iu',
);

const STRONG_ACCOUNT_CUE_PATTERN = new RegExp(
  `${PLATFORM_BOUNDARY_START}(?:` +
    String.raw`(?:hada|had|hadak|hadi)\s+(?:howa\s+)?(?:hsab(?:i|iy|ek|o)?|compte|profil|page)(?:\s+(?:dyal(?:i|iy|ek|o)?))?\s+(?:on\s+|fi\s+|f\s+)?(?:${SOCIAL_PLATFORM_SOURCE})` +
    `|` +
    String.raw`(?:حسابي|حسابك|حسابه|حسابها|صفحتي|صفحتك|صفحته|صفحتها|بروفايلي|البروفايل)\s*(?:على|في|ف|عبر)?\s*(?:${SOCIAL_PLATFORM_SOURCE})` +
    `)${PLATFORM_BOUNDARY_END}`,
  'iu',
);

const CONTACT_INTENT_PATTERN = new RegExp(
  `${PLATFORM_BOUNDARY_START}(?:` +
    String.raw`(?:find|add|contact|reach|message|dm|text|call|follow|look)\s+me\s+(?:up\s+)?(?:on|at|via|through)\s+(?:${SOCIAL_PLATFORM_SOURCE})` +
    `|` +
    String.raw`(?:تواصلوا|تواصل|راسلوني|راسلني|تابعوني|أضيفوني|اضيفوني|ابحثوا\s+عني|ابحث\s+عني)\s*(?:على|في|عبر)\s*(?:${SOCIAL_PLATFORM_SOURCE})` +
    `)${PLATFORM_BOUNDARY_END}`,
  'iu',
);

/** Words that are never a person's name in this context (keeps ordinary text legal). */
const NAME_STOPWORDS = new Set(
  [
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as', 'at',
    'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over',
    'per', 'to', 'up', 'via', 'with', 'within', 'without', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did', 'have', 'has', 'had',
    'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'i', 'me',
    'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him',
    'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their', 'theirs',
    'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when', 'what',
    'who', 'whom', 'whose', 'which', 'how', 'why', 'yes', 'no', 'not', 'ok',
    'okay', 'please', 'thanks', 'thank', 'hello', 'hi', 'hey', 'bye',
    'all', 'any', 'some', 'more', 'most', 'much', 'many', 'few', 'lot', 'very',
    'just', 'only', 'also', 'too', 'now', 'soon', 'later', 'today', 'tonight',
    'tomorrow', 'yesterday', 'week', 'weekend', 'month', 'year', 'morning',
    'afternoon', 'evening', 'night', 'day', 'days', 'time', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january',
    'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
    'october', 'november', 'december',
    'page', 'pages', 'group', 'groups', 'account', 'accounts', 'profile',
    'profiles', 'business', 'marketing', 'advertising', 'ads', 'ad', 'promotion',
    'promotions', 'course', 'courses', 'training', 'coach', 'coaching', 'club',
    'clubs', 'gym', 'sport', 'sports', 'app', 'apps', 'website', 'link', 'links',
    'post', 'posts', 'story', 'stories', 'video', 'videos', 'photo', 'photos',
    'picture', 'pictures', 'reel', 'reels', 'live', 'event', 'events', 'update',
    'updates', 'news', 'feed', 'chat', 'message', 'messages', 'friends', 'login',
    'support', 'help', 'privacy', 'settings', 'contact', 'official', 'verified',
    'public', 'private', 'online', 'offline', 'useful', 'good', 'great', 'best',
    'nice', 'bad', 'amazing', 'awesome', 'terrible', 'boring', 'interesting',
    'important', 'popular', 'available', 'free', 'paid', 'easy', 'hard',
    'difficult', 'fun', 'cool', 'weird', 'rocks', 'sucks', 'new', 'feature',
    'features', 'tip', 'tips', 'guide', 'guides', 'tutorial', 'tutorials',
    'review', 'reviews', 'beta', 'version', 'launch',
    'facebook', 'fb', 'messenger', 'instagram', 'insta', 'ig', 'whatsapp',
    'telegram', 'tiktok', 'snapchat', 'linkedin',
    'est', "c'est", 'mon', 'ma', 'mes', 'notre', 'nos', 'ton', 'ta', 'tes',
    'votre', 'vos', 'son', 'sa', 'ses', 'le', 'la', 'les', 'un', 'une', 'des',
    'du', 'de', 'au', 'aux', 'et', 'ou', 'pour', 'sur', 'dans', 'avec', 'sans',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'ce', 'cette',
    'ces', 'qui', 'que', 'quoi', 'dont', 'où', 'comment', 'pourquoi', 'oui',
    'non', 'merci', 'bonjour', 'salut', 'compte', 'profil', 'groupe',
    'publication', 'publications', 'vidéo', 'vidéos', 'cours', 'entraînement',
    'salle', 'formation', 'utile', 'utiles', 'génial', 'super', 'nul', 'bien',
    'في', 'على', 'عن', 'من', 'الى', 'إلى', 'مع', 'بدون', 'هذا', 'هذه', 'ذلك',
    'تلك', 'هو', 'هي', 'هم', 'نحن', 'أنا', 'انا', 'كان', 'كانت', 'يكون', 'هل',
    'لا', 'نعم', 'ربما', 'شكرا', 'شكراً', 'مرحبا', 'السلام', 'عليكم', 'صفحة',
    'مجموعة', 'تطبيق', 'موقع', 'رابط', 'روابط', 'منشور', 'منشورات', 'صورة',
    'صور', 'فيديو', 'فيديوهات', 'قناة', 'تسويق', 'تدريب', 'مدرب', 'نادي',
    'رياضة', 'جيد', 'جيدة', 'رائع', 'مفيد', 'سيء', 'اليوم', 'غدا', 'غداً',
    'الآن', 'الان', 'الأسبوع', 'الشهر', 'السنة', 'صباحا', 'مساء', 'ليلا',
    'خلال', 'حول', 'بشأن', 'أثناء', 'اثناء',
  ].map((word) => word.toLowerCase()),
);

const NAME_WORD_PATTERN = /^[\p{L}][\p{L}'-]{1,30}$/u;

function classifySocialPlatform(provider: string): ContactMatchKind {
  const compact = provider.toLowerCase().replace(/\s+/g, '');

  if (
    compact.startsWith('face') ||
    compact.startsWith('fays') ||
    compact.startsWith('fes') ||
    compact === 'fb' ||
    compact === 'fcb' ||
    compact === 'fcbk' ||
    compact === 'facbook' ||
    compact.includes('messenger') ||
    compact.includes('فيس') ||
    compact.includes('فايسبوك')
  ) {
    return 'FACEBOOK';
  }
  if (compact.startsWith('insta') || compact === 'ig' || compact.includes('انست')) {
    return 'INSTAGRAM';
  }
  if (
    compact.startsWith('tele') ||
    compact === 'tg' ||
    compact.includes('تلغرام') ||
    compact.includes('تيلي')
  ) {
    return 'TELEGRAM';
  }
  if (
    compact.includes('whats') ||
    compact.includes('wats') ||
    compact.includes('واتس') ||
    compact.includes('وتساب')
  ) {
    return 'WHATSAPP';
  }
  return 'SOCIAL_PROFILE';
}

/**
 * Two name tokens are enough; a single token needs an explicit connector or a
 * capitalised Latin name. Stopwords keep ordinary discussion legal.
 */
function hasNameAfterPlatform(suffix: string): boolean {
  const immediate = suffix.split(/[.!?؟\n]/, 1)[0]?.trimStart() ?? '';
  if (immediate.startsWith('@')) {
    return true;
  }

  let rest = immediate;
  let connectorKind: 'separator' | 'account' | 'verb' | null = null;

  const separator = /^(?::|=|–|—|-)\s*/u.exec(rest);
  if (separator) {
    connectorKind = 'separator';
    rest = rest.slice(separator[0].length).trimStart();
  } else {
    const wordConnector =
      /^(is|c'est|est|account|profile|page|compte|profil|حساب|صفحة)(?![\p{L}\p{N}])\s*/iu.exec(
        rest,
      );
    if (wordConnector) {
      const connector = wordConnector[1]!.toLowerCase();
      connectorKind = ['is', "c'est", 'est'].includes(connector) ? 'verb' : 'account';
      rest = rest.slice(wordConnector[0].length).trimStart();
    }
  }

  if (SOCIAL_PLATFORM_TEST.test(rest)) {
    return false;
  }

  const tokens: string[] = [];
  for (const raw of rest.split(/\s+/).slice(0, 3)) {
    const word = raw.replace(/^[,;:.!?؟]+|[,;:.!?؟]+$/g, '');
    if (!NAME_WORD_PATTERN.test(word)) {
      break;
    }
    if (NAME_STOPWORDS.has(word.toLowerCase())) {
      break;
    }
    tokens.push(word);
  }

  if (tokens.length >= 2) {
    return true;
  }
  if (tokens.length === 1) {
    if (connectorKind === 'separator' || connectorKind === 'account') {
      return true;
    }
    return /^\p{Lu}/u.test(tokens[0]!);
  }
  return false;
}

function detectNamedSocialProfile(value: string): ContactMatchKind | null {
  for (const match of value.matchAll(
    new RegExp(
      `${PLATFORM_BOUNDARY_START}(${SOCIAL_PLATFORM_SOURCE})${PLATFORM_BOUNDARY_END}`,
      'giu',
    ),
  )) {
    const provider = match[1];
    const suffix = value.slice((match.index ?? 0) + match[0].length);
    if (provider && hasNameAfterPlatform(suffix)) {
      return classifySocialPlatform(provider);
    }
  }
  return null;
}

const PHONE_PATTERN = /(?<!\d)(?:\+|00)?\d(?:[\s().\/-]?\d){8,14}(?!\d)/g;

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gi, '')
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[．。｡]/g, '.')
    .replace(/[＠]/g, '@')
    .replace(/[\[({<]\s*(?:at|@)\s*[\])}>]/gi, '@')
    .replace(/[\[({<]\s*(?:dot|\.)\s*[\])}>]/gi, '.')
    .replace(/[\[({<]\s*\.\s*[\])}>]/g, '.')
    .replace(/(?<=\w)\s*\(\s*at\s*\)\s*(?=\w)/gi, '@')
    .replace(/(?<=\w)\s+dot\s+(?=\w)/gi, '.')
    .replace(/(?<=\w)\s+at\s+(?=[\w-]+\s*(?:\.|dot)\s*[\w-]+)/gi, '@')
    .replace(/\bface\s+book\b/gi, 'facebook')
    .replace(/\bwhats\s+app\b/gi, 'whatsapp')
    .replace(/\binsta\s+gram\b/gi, 'instagram')
    .replace(/\btele\s+gram\b/gi, 'telegram')
    .replace(/\b(?:[\p{L}]\s+){3,}[\p{L}]\b/gu, (chunk) => chunk.replace(/\s+/g, ''))
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*(?=[a-z]{2,}\b)/gi, '.');
}

function stripDatesAndTimes(value: string): string {
  return value
    .replace(
      /\b\d{4}-\d{2}-\d{2}(?:[t ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?)?\b/gi,
      ' ',
    )
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, ' ');
}

function hasPhone(value: string): boolean {
  const candidates = stripDatesAndTimes(value).match(PHONE_PATTERN) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) {
      return false;
    }
    const international = /^\s*(?:\+|00)/.test(candidate);
    const hasSeparator = /[\s().\/-]/.test(candidate.trim());
    return international || hasSeparator || digits.length >= 10;
  });
}

/** Returns the kinds of contact information found (empty when the text is fine). */
export function findContactSharing(value: string): ContactMatchKind[] {
  const normalized = normalize(value);
  const matches: ContactMatchKind[] = [];
  const push = (kind: ContactMatchKind): void => {
    if (!matches.includes(kind)) {
      matches.push(kind);
    }
  };

  for (const domain of SOCIAL_DOMAINS) {
    if (domain.pattern.test(normalized)) {
      push(domain.kind);
    }
  }
  if (EMAIL_PATTERN.test(normalized)) {
    push('EMAIL');
  }
  if (SOCIAL_HANDLE_PATTERN.test(normalized)) {
    push('SOCIAL_HANDLE');
  }

  const cue = STRONG_ACCOUNT_CUE_PATTERN.exec(normalized);
  const cuePlatform = cue ? (SOCIAL_PLATFORM_TEST.exec(cue[0])?.[1] ?? null) : null;
  if (cuePlatform) {
    push(classifySocialPlatform(cuePlatform));
  }

  const intent = CONTACT_INTENT_PATTERN.exec(normalized);
  const intentPlatform = intent
    ? (SOCIAL_PLATFORM_TEST.exec(intent[0])?.[1] ?? null)
    : null;
  if (intentPlatform) {
    push(classifySocialPlatform(intentPlatform));
  }

  const profile = detectNamedSocialProfile(normalized);
  if (profile) {
    push(profile);
  }
  if (hasPhone(normalized)) {
    push('PHONE');
  }

  return matches;
}
