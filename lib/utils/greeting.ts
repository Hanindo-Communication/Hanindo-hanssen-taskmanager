/**
 * Returns time-based greeting in Indonesian.
 * Pagi 00:00–11:00, Siang 11:00–15:00, Sore 15:00–18:00, Malam 18:00–24:00.
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Returns time-based greeting in English (e.g. for welcome / post-login screen).
 * Morning 00:00–12:00, Afternoon 12:00–17:00, Evening 17:00–21:00, Night 21:00–24:00.
 */
export function getTimeBasedGreetingEn(): string {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good evening';
}

/**
 * Display name from Supabase user: full_name, or email local part, or fallback.
 */
export function getDisplayName(user: { user_metadata?: { full_name?: string }; email?: string } | null): string | null {
  if (!user) return null;
  const name = user.user_metadata?.full_name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split('@')[0] ?? null;
  return null;
}
