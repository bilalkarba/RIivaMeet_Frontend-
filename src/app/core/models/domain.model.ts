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

export const BOOKING_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that can no longer change (backend state machine, terminal states). */
export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
];

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
  editedAt?: string | null;
  revision?: number;
  attachment?: ChatMessageAttachment | null;
}

export interface ChatMessageAttachment {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
}

export interface ChatAttachmentConfig {
  configured: boolean;
  maxBytes: number;
  contentTypes: string[];
}

export interface DeletedChatMessage {
  messageId: string;
  conversationId: string;
}

export type ModerationAction = 'ALLOW' | 'WARN' | 'BLOCK' | 'FLAG';

export interface MessageModerationMatch {
  kind: string;
  label: string;
}

/** Returned to the sender on REST/socket acknowledgements, never broadcast to the peer. */
export interface MessageModeration {
  action: ModerationAction;
  policy: 'warn' | 'block' | 'flag';
  matches: MessageModerationMatch[];
}

/** `GET /conversations/moderation-policy` - advisory client mirror of the server policy. */
export interface MessageModerationConfig {
  enabled: boolean;
  policy: 'warn' | 'block' | 'flag';
}

/** A sent message plus the moderation outcome for the sender. */
export interface ChatMessageDelivery extends ChatMessage {
  moderation?: MessageModeration;
  /** True when the server deduplicated a retried attachment upload. */
  duplicate?: boolean;
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

// --- Coach verification ----------------------------------------------------

/** Official verification lifecycle (backend `VerificationStatus`). */
export const VERIFICATION_STATUSES = [
  'DRAFT',
  'PENDING',
  'IN_REVIEW',
  'NEEDS_INFO',
  'APPROVED',
  'REJECTED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** `NOT_SUBMITTED` is a presentation state: no application row exists yet. */
export type VerificationStatusView = VerificationStatus | 'NOT_SUBMITTED';

export const VERIFICATION_DOCUMENT_TYPES = ['DIPLOMA', 'CERTIFICATION', 'OTHER'] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

/** Only these types are accepted (the backend re-checks the file signature as well). */
export const ALLOWED_VERIFICATION_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

/** Statuses in which the coach may change documents. */
export const EDITABLE_VERIFICATION_STATUSES: readonly VerificationStatusView[] = [
  'DRAFT',
  'NEEDS_INFO',
  'REJECTED',
  'NOT_SUBMITTED',
];

export interface VerificationDocument {
  id: string;
  type: VerificationDocumentType;
  fileName: string | null;
  contentType: string;
  sizeBytes: number | null;
  isCurrent: boolean;
  uploadedAt: string;
  confirmed: boolean;
}

export interface VerificationHistoryEntry {
  type: string;
  fromStatus: VerificationStatus | null;
  toStatus: VerificationStatus | null;
  note: string | null;
  createdAt: string;
  actor?: { id: string; displayName: string } | null;
}

export interface CoachVerification {
  status: VerificationStatusView;
  submittedAt: string | null;
  lastSubmittedAt: string | null;
  requiredDocumentTypes: string[];
  missingRequirements: string[];
  canEditDocuments: boolean;
  canSubmit: boolean;
  documents: VerificationDocument[];
  adminFeedback: { note: string | null; decidedAt: string | null };
  history: VerificationHistoryEntry[];
}

/** Presigned upload target returned by `POST /coaches/me/verification/documents`. */
export interface VerificationUploadTarget {
  documentId: string;
  verification: CoachVerification;
  upload: {
    key: string;
    uploadUrl: string;
    method: 'PUT' | 'POST';
    headers: Record<string, string>;
    expiresAt: number;
    maxBytes: number;
  };
}

export interface VerificationStatusSummary {
  status: VerificationStatusView;
  isPublished: boolean;
  isPubliclyVisible: boolean;
}

export interface AdminVerification {
  id: string | null;
  coachProfileId: string;
  status: VerificationStatusView;
  submittedAt: string | null;
  lastSubmittedAt: string | null;
  coach: { id: string; displayName: string; email: string | null } | null;
  isPublished: boolean;
  documentCount: number;
  reviewNote: string | null;
  reviewedAt: string | null;
  updatedAt: string | null;
}

export interface AdminVerificationDetail extends AdminVerification {
  documents: VerificationDocument[];
  reviewedBy: { id: string; displayName: string } | null;
  history: VerificationHistoryEntry[];
}

export interface AdminVerificationFilters {
  status?: VerificationStatus | '';
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  limit?: number;
}

// --- Helper types ----------------------------------------------------------

/** Session bounds enforced by the backend booking schema. */
export const MIN_SESSION_MINUTES = 15;
export const MAX_SESSION_MINUTES = 12 * 60;
