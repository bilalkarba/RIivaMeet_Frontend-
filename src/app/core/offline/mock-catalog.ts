import type { LanguageCode } from '../i18n/locale.service';
import type { Paginated } from '../models/api.model';
import type {
  AvailabilitySlot,
  CoachDetail,
  CoachSearchFilters,
  CoachSummary,
  ExperienceLevel,
  RatingSummary,
  Review,
  Sport,
} from '../models/domain.model';
import { DISTANCE_SORTS } from '../models/domain.model';

/**
 * Development-only sample catalogue.
 *
 * Loaded exclusively through `OfflinePreviewService`'s dynamic import, so production
 * bundles never contain it. It answers *reads* only — every mutation still hits the
 * real API, which means no action can ever appear to succeed against sample data.
 */

const SPORT_IDS: Record<string, string> = {
  fitness: 'b1000000-0000-4000-8000-000000000001',
  boxing: 'b1000000-0000-4000-8000-000000000002',
  swimming: 'b1000000-0000-4000-8000-000000000003',
  football: 'b1000000-0000-4000-8000-000000000004',
  tennis: 'b1000000-0000-4000-8000-000000000005',
};

const SPORT_NAMES: Record<string, string> = {
  fitness: 'Fitness',
  boxing: 'Boxing',
  swimming: 'Swimming',
  football: 'Football',
  tennis: 'Tennis',
};

function uuid(group: string, index: number): string {
  return `${group}000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

type LocalizedText = Record<LanguageCode, string>;

interface MockCoachSeed {
  id: string;
  userId: string;
  name: string;
  city: string;
  neighborhood: string;
  address: string;
  latitude: number;
  longitude: number;
  hourlyPrice: string;
  experienceLevel: ExperienceLevel;
  sportSlugs: string[];
  averageRating: number;
  reviewCount: number;
  totalBookings: number;
  bio: LocalizedText;
}

const COACH_SEEDS: MockCoachSeed[] = [
  {
    id: uuid('c1', 1),
    userId: uuid('a1', 1),
    name: 'Anna Schmidt',
    city: 'Berlin',
    neighborhood: 'Mitte',
    address: 'Torstraße 112',
    latitude: 52.5298,
    longitude: 13.402,
    hourlyPrice: '45.00',
    experienceLevel: 'ADVANCED',
    sportSlugs: ['fitness', 'tennis'],
    averageRating: 4.9,
    reviewCount: 34,
    totalBookings: 128,
    bio: {
      ar: 'مدربة لياقة وتنس معتمدة بخبرة عشر سنوات. أعمل على بناء القوة تدريجيًا وتحسين الحركة، مع خطة واضحة لكل جلسة.',
      fr: "Coach certifiée en fitness et tennis avec dix ans d'expérience. Nous construisons la force par étapes et améliorons les déplacements, avec un plan clair à chaque séance.",
      en: 'Certified fitness and tennis coach with ten years of experience. We build strength in stages and clean up movement, with a clear plan for every session.',
    },
  },
  {
    id: uuid('c1', 2),
    userId: uuid('a1', 2),
    name: 'Omar Haddad',
    city: 'Hamburg',
    neighborhood: 'Altona',
    address: 'Ottenser Hauptstraße 4',
    latitude: 53.5521,
    longitude: 9.9351,
    hourlyPrice: '55.00',
    experienceLevel: 'PROFESSIONAL',
    sportSlugs: ['boxing', 'fitness'],
    averageRating: 4.8,
    reviewCount: 27,
    totalBookings: 96,
    bio: {
      ar: 'ملاكم محترف سابق ومدرّب في النادي منذ 2016. أركّز على الأسلوب وحركة القدمين وتدريبات البادل، مع عمل بدني منظم.',
      fr: "Ancien boxeur professionnel, entraîneur en club depuis 2016. Je travaille la technique, le jeu de jambes et les paos, avec une préparation physique structurée.",
      en: 'Former professional boxer, coaching at club level since 2016. Focused on technique, footwork and pad work, backed by structured conditioning.',
    },
  },
  {
    id: uuid('c1', 3),
    userId: uuid('a1', 3),
    name: 'Sophie Laurent',
    city: 'Berlin',
    neighborhood: 'Kreuzberg',
    address: 'Gneisenaustraße 52',
    latitude: 52.4911,
    longitude: 13.3955,
    hourlyPrice: '40.00',
    experienceLevel: 'INTERMEDIATE',
    sportSlugs: ['swimming'],
    averageRating: 4.6,
    reviewCount: 18,
    totalBookings: 54,
    bio: {
      ar: 'مدرّبة سباحة متخصصة في تصحيح الأسلوب وبناء الثقة في المياه المفتوحة. مناسبة للمبتدئين وحتى المتسابقين.',
      fr: "Coach de natation spécialisée dans la correction du geste et la confiance en eau libre. Pour débutants comme pour compétiteurs.",
      en: 'Swim coach specialising in stroke correction and open-water confidence. Works with complete beginners and competitive swimmers alike.',
    },
  },
  {
    id: uuid('c1', 4),
    userId: uuid('a1', 4),
    name: 'Yusuf Karim',
    city: 'Munich',
    neighborhood: 'Schwabing',
    address: 'Leopoldstraße 68',
    latitude: 48.1617,
    longitude: 11.5865,
    hourlyPrice: '50.00',
    experienceLevel: 'ADVANCED',
    sportSlugs: ['football'],
    averageRating: 4.7,
    reviewCount: 22,
    totalBookings: 71,
    bio: {
      ar: 'مدرّب كرة قدم لفرق الشباب وللاعبين الفرديين. التدريب يشمل التحكم بالكرة والتكتيك والجاهزية البدنية للمباريات.',
      fr: "Coach de football pour équipes de jeunes et joueurs individuels. Ballon, tactique et condition physique de match au programme.",
      en: 'Football coach for youth teams and individual players. Sessions cover ball mastery, tactical shape and match-day conditioning.',
    },
  },
  {
    id: uuid('c1', 5),
    userId: uuid('a1', 5),
    name: 'Clara Nowak',
    city: 'Frankfurt',
    neighborhood: 'Sachsenhausen',
    address: 'Schweizer Straße 29',
    latitude: 50.1051,
    longitude: 8.6859,
    hourlyPrice: '60.00',
    experienceLevel: 'PROFESSIONAL',
    sportSlugs: ['tennis', 'swimming'],
    averageRating: 5,
    reviewCount: 12,
    totalBookings: 40,
    bio: {
      ar: 'لاعبة تنس سابقة ومدرّبة معتمدة. أعمل على الإرسال والتبادل والحركة على الملعب، ويمكنني تدريب السباحة أيضًا.',
      fr: "Ancienne joueuse de tennis et coach certifiée. Service, échanges et déplacements sur le court, avec la natation en seconde discipline.",
      en: 'Former competitive tennis player and certified coach. Serve, rallying and court movement, with swimming as a second discipline.',
    },
  },
  {
    id: uuid('c1', 6),
    userId: uuid('a1', 6),
    name: 'Daniel Osei',
    city: 'Cologne',
    neighborhood: 'Ehrenfeld',
    address: 'Venloer Straße 301',
    latitude: 50.9498,
    longitude: 6.9192,
    hourlyPrice: '38.00',
    experienceLevel: 'BEGINNER',
    sportSlugs: ['fitness', 'football'],
    averageRating: 4.4,
    reviewCount: 9,
    totalBookings: 23,
    bio: {
      ar: 'مدرّب مبتدئ متحمّس لللياقة وكرة القدم. جلسات بسيطة وواضحة لمن يبدأ من الصفر ويريد الاستمرار.',
      fr: "Coach débutant passionné de fitness et de football. Des séances simples et claires pour ceux qui partent de zéro et veulent tenir dans la durée.",
      en: 'Motivated new coach working in fitness and football. Simple, clear sessions for people starting from zero and wanting to keep going.',
    },
  },
];

const REVIEWER_NAMES = ['Lina Haddad', 'Marc Dubois', 'Sara Yilmaz', 'Jonas Weber', 'Nour Ali', 'Amélie Kayser'];

const REVIEW_COMMENTS: Record<LanguageCode, string[]> = {
  ar: [
    'شرح واضح وجلسة منظّمة من البداية إلى النهاية.',
    'طاقة رائعة، دفعني بقوة مع الحفاظ على الأمان تمامًا.',
    'احترافية عالية، والملاحظات بعد كل تمرين كانت دقيقة ومفيدة.',
    'أسلوب هادئ ومشجّع، شعرت بالتقدم من الجلسة الأولى.',
  ],
  fr: [
    'Explications claires et séance bien structurée du début à la fin.',
    'Super énergie, il m’a poussé sans jamais négliger la sécurité.',
    'Très professionnel, les retours après chaque série étaient justes.',
    'Approche calme et encourageante, j’ai senti des progrès dès la première séance.',
  ],
  en: [
    'Clear explanations and a properly structured session from start to finish.',
    'Great energy, pushed me hard while keeping everything safe.',
    'Very professional, the feedback after each set was spot on.',
    'Calm and encouraging approach — I felt progress from the very first session.',
  ],
};

const NOW = () => new Date();

function buildAvailability(coachIndex: number): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const today = NOW();
  let counter = 1;

  for (let dayOffset = 1; dayOffset <= 8; dayOffset += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const windows: readonly (readonly [number, number])[] = [
      [9, 12],
      [16, 19],
    ];

    for (const [startHour, endHour] of windows) {
      // Vary the calendars a little so the lists do not all look identical.
      if (startHour === 9 && (dayOffset + coachIndex) % 3 === 0) {
        continue;
      }
      const start = new Date(day);
      start.setHours(startHour, 0, 0, 0);
      const end = new Date(day);
      end.setHours(endHour, 0, 0, 0);
      slots.push({
        id: uuid('e1', coachIndex * 100 + counter),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        isAvailable: true,
      });
      counter += 1;
    }
  }

  return slots;
}

function buildReviews(coachIndex: number, language: LanguageCode, count: number): Review[] {
  const comments = REVIEW_COMMENTS[language];
  const reviews: Review[] = [];
  const base = NOW().getTime();

  for (let index = 0; index < count; index += 1) {
    const rating = index % 5 === 3 ? 4 : 5;
    reviews.push({
      id: uuid('d1', coachIndex * 100 + index + 1),
      bookingId: uuid('f1', coachIndex * 100 + index + 1),
      rating,
      comment: comments[index % comments.length],
      createdAt: new Date(base - (index + 2) * 86_400_000 * 3).toISOString(),
      client: { id: uuid('a2', coachIndex * 10 + index), name: REVIEWER_NAMES[(coachIndex + index) % REVIEWER_NAMES.length] },
    });
  }

  return reviews.reverse();
}

function haversineKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a))) * 1000) / 1000;
}

export interface MockCatalog {
  sports(): Sport[];
  searchCoaches(filters: CoachSearchFilters): Paginated<CoachSummary>;
  getCoach(id: string): CoachDetail | null;
  listReviews(
    coachProfileId: string,
    page: number,
    limit: number,
  ): Paginated<Review, { summary: RatingSummary }> | null;
}

export function createMockCatalog(language: LanguageCode): MockCatalog {
  const toSummary = (seed: MockCoachSeed, distanceKm?: number): CoachSummary => ({
    id: seed.id,
    userId: seed.userId,
    name: seed.name,
    bio: seed.bio[language],
    hourlyPrice: seed.hourlyPrice,
    experienceLevel: seed.experienceLevel,
    city: seed.city,
    neighborhood: seed.neighborhood,
    address: seed.address,
    latitude: seed.latitude,
    longitude: seed.longitude,
    isPublished: true,
    sports: seed.sportSlugs
      .map((slug) => ({ id: SPORT_IDS[slug], name: SPORT_NAMES[slug], slug }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    averageRating: seed.averageRating,
    reviewCount: seed.reviewCount,
    ...(distanceKm === undefined ? {} : { distanceKm }),
    createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  });

  return {
    sports(): Sport[] {
      return Object.keys(SPORT_IDS).map((slug) => ({
        id: SPORT_IDS[slug],
        name: SPORT_NAMES[slug],
        slug,
        coachCount: COACH_SEEDS.filter((seed) => seed.sportSlugs.includes(slug)).length,
      }));
    },

    searchCoaches(filters: CoachSearchFilters): Paginated<CoachSummary> {
      const hasLocation =
        typeof filters.latitude === 'number' && typeof filters.longitude === 'number';

      let rows = COACH_SEEDS.map((seed, index) => {
        const distanceKm = hasLocation
          ? haversineKm(filters.latitude as number, filters.longitude as number, seed.latitude, seed.longitude)
          : undefined;
        return { seed, index, summary: toSummary(seed, distanceKm) };
      });

      if (filters.sport) {
        const sport = filters.sport.toLowerCase();
        rows = rows.filter((row) => row.seed.sportSlugs.includes(sport));
      }
      if (filters.city) {
        rows = rows.filter((row) => row.seed.city.toLowerCase() === filters.city?.toLowerCase());
      }
      if (filters.neighborhood) {
        rows = rows.filter(
          (row) => row.seed.neighborhood.toLowerCase() === filters.neighborhood?.toLowerCase(),
        );
      }
      if (typeof filters.minPrice === 'number') {
        rows = rows.filter((row) => Number(row.seed.hourlyPrice) >= (filters.minPrice as number));
      }
      if (typeof filters.maxPrice === 'number') {
        rows = rows.filter((row) => Number(row.seed.hourlyPrice) <= (filters.maxPrice as number));
      }
      if (typeof filters.minRating === 'number') {
        rows = rows.filter((row) => row.seed.averageRating >= (filters.minRating as number));
      }
      if (hasLocation && typeof filters.radiusKm === 'number') {
        rows = rows.filter((row) => (row.summary.distanceKm ?? 0) <= (filters.radiusKm as number));
      }

      const sort = filters.sort ?? 'newest';
      const numeric = (value: string) => Number(value);
      rows.sort((a, b) => {
        switch (sort) {
          case 'oldest':
            return a.index - b.index;
          case 'price_asc':
            return numeric(a.seed.hourlyPrice) - numeric(b.seed.hourlyPrice);
          case 'price_desc':
            return numeric(b.seed.hourlyPrice) - numeric(a.seed.hourlyPrice);
          case 'rating_asc':
            return a.seed.averageRating - b.seed.averageRating;
          case 'rating_desc':
            return b.seed.averageRating - a.seed.averageRating;
          case 'distance_asc':
            return (a.summary.distanceKm ?? 0) - (b.summary.distanceKm ?? 0);
          case 'distance_desc':
            return (b.summary.distanceKm ?? 0) - (a.summary.distanceKm ?? 0);
          default:
            return b.seed.reviewCount - a.seed.reviewCount;
        }
      });

      if (DISTANCE_SORTS.includes(sort) && !hasLocation) {
        rows = [];
      }

      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;
      const total = rows.length;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      const start = (page - 1) * limit;

      return {
        data: rows.slice(start, start + limit).map((row) => row.summary),
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1 && total > 0,
        },
      };
    },

    getCoach(id: string): CoachDetail | null {
      const index = COACH_SEEDS.findIndex((seed) => seed.id === id);
      if (index === -1) {
        return null;
      }
      const seed = COACH_SEEDS[index];
      return {
        ...toSummary(seed),
        coachName: seed.name,
        availability: buildAvailability(index),
        totalBookings: seed.totalBookings,
      };
    },

    listReviews(coachProfileId, page, limit) {
      const index = COACH_SEEDS.findIndex((seed) => seed.id === coachProfileId);
      if (index === -1) {
        return null;
      }
      const seed = COACH_SEEDS[index];
      const all = buildReviews(index, language, Math.min(seed.reviewCount, 6));
      const total = seed.reviewCount;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      const start = (page - 1) * limit;
      const summary: RatingSummary = {
        averageRating: seed.averageRating,
        reviewCount: seed.reviewCount,
      };

      return {
        data: all.slice(start, start + limit),
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1 && total > 0,
          summary,
        },
      };
    },
  };
}
