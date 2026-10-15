/**
 * Domain models.
 *
 * These mirror the payloads produced by the RivaMeet API presenters
 * (`src/utils/presenters.ts` in the backend) exactly. Money arrives as a
 * 2-decimal **string** (e.g. `"45.00"`) because the API serialises `Decimal`
 * columns that way, so the frontend never loses precision to floating point.
 */

export const ROLES = ['CLIENT', 'COACH', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Public registration may only create these two roles. */
export const SELF_ASSIGNABLE_ROLES = ['CLIENT', 'COACH'] as const satisfies readonly Role[];

export const BOOKING_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that can no longer change (backend state machine, terminal states). */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = ['REJECTED', 'CANCELLED', 'COMPLETED'];

export const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const COACH_SORTS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'rating_desc',
  'rating_asc',
  'distance_asc',
  'distance_desc',
] as const;
export type CoachSort = (typeof COACH_SORTS)[number];

/** Distance sorts require `latitude` + `longitude`, per the backend schema. */
export const DISTANCE_SORTS: readonly CoachSort[] = ['distance_asc', 'distance_desc'];

// --- Auth ------------------------------------------------------------------

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  hasCoachProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `POST /auth/login` and `POST /auth/register` payload. */
export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: (typeof SELF_ASSIGNABLE_ROLES)[number];
}

export interface LoginPayload {
  email: string;
  password: string;
}

// --- Catalogue -------------------------------------------------------------

export interface SportSummary {
  id: string;
  name: string;
  slug: string;
}

/** `GET /sports` adds a count of *published* coach profiles. */
export interface Sport extends SportSummary {
  coachCount: number;
}

// --- Coaches ---------------------------------------------------------------

export interface AvailabilitySlot {
  id: string;
  startAt: string;
  endAt: string;
  isAvailable: boolean;
}

export interface CoachSummary {
  id: string;
  userId: string;
  name: string;
  bio: string;
  /** 2-decimal string, e.g. `"45.00"`. */
  hourlyPrice: string;
  experienceLevel: ExperienceLevel;
  city: string;
  neighborhood: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isPublished: boolean;
  sports: SportSummary[];
  averageRating: number | null;
  reviewCount: number;
  /** Only present when the search was made with coordinates. */
  distanceKm?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachDetail extends CoachSummary {
  coachName: string;
  availability: AvailabilitySlot[];
  /** Count of the coach's COMPLETED bookings. */
  totalBookings?: number;
}

/** `GET /coaches` query parameters — exactly what the backend accepts. */
export interface CoachSearchFilters {
  sport?: string;
  city?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort?: CoachSort;
  page?: number;
  limit?: number;
}

/** `POST /coaches/me/profile` body. */
export interface CreateCoachProfilePayload {
  bio: string;
  hourlyPrice: number;
  experienceLevel: ExperienceLevel;
  city: string;
  neighborhood: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isPublished?: boolean;
}

/** `PATCH /coaches/me/profile` body — every field optional. */
export interface UpdateCoachProfilePayload {
  bio?: string;
  hourlyPrice?: number;
  experienceLevel?: ExperienceLevel;
  city?: string;
  neighborhood?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPublished?: boolean;
}

export interface AvailabilityPayload {
  startAt: string;
  endAt: string;
  isAvailable?: boolean;
}

// --- Bookings & reviews ----------------------------------------------------

export interface Booking {
  id: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  priceAtBooking: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  coach: {
    coachProfileId: string;
    userId: string;
    name: string;
    city: string;
    neighborhood: string;
    hourlyPrice: string;
  };
  review: { id: string; rating: number; comment: string | null; createdAt: string } | null;
}

export interface BookingNotification {
  id: string;
  type: 'BOOKING_REQUEST';
  bookingId: string;
  clientName: string;
  startAt: string;
  endAt: string;
  readAt: string | null;
  createdAt: string;
}

export interface BookingNotificationInbox {
  notifications: BookingNotification[];
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  participant: { id: string; displayName: string; avatarUrl: string | null };
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingPayload {
  coachProfileId: string;
  startAt: string;
  endAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  client: { id: string; name: string };
}

export interface RatingSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
}

// --- Helper types ----------------------------------------------------------

/** Session bounds enforced by the backend booking schema. */
export const MIN_SESSION_MINUTES = 15;
export const MAX_SESSION_MINUTES = 12 * 60;
