/**
 * Decorative imagery.
 *
 * The API has no photo field for coach profiles, so coach cards render branded
 * initials avatars (see `AvatarComponent`) and photography is used only for editorial
 * decoration — hero, sport categories and the coach call-to-action. Every consumer
 * goes through `SmartImageComponent`, so a blocked/offline image degrades to a
 * branded gradient instead of a broken-image icon.
 */
export const MEDIA = {
  heroPortrait:
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=70',
  heroAction:
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=70',
  coachCta:
    'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?auto=format&fit=crop&w=1000&q=70',
  howItWorks:
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=70',
} as const;

/** One representative photo per seeded sport slug. */
export const SPORT_IMAGES: Record<string, string> = {
  fitness: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=70',
  boxing: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=600&q=70',
  swimming: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=600&q=70',
  football: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=70',
  tennis: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=600&q=70',
};

/** Inline SVG icon name for a sport slug. */
export const SPORT_ICONS: Record<string, string> = {
  fitness: 'dumbbell',
  boxing: 'glove',
  swimming: 'swimmer',
  football: 'football',
  tennis: 'tennis',
};

export function sportIcon(slug: string): string {
  return SPORT_ICONS[slug] ?? 'medal';
}

export function sportImage(slug: string): string | null {
  return SPORT_IMAGES[slug] ?? null;
}
