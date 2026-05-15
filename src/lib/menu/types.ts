export type FirebaseUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export type WeekDay = {
  key: string;
  label: string;
  isoDate: string;
};

export type NoMealReason = 'away' | 'eating-out' | 'not-hungry' | 'other';
export type ThemePreference = 'system' | 'light' | 'dark';

export type MealEntry = {
  items: string[];
  skipped: boolean;
  reason: NoMealReason | '';
  note: string;
};

export type DailyMenu = {
  lunch?: string;
  dinner?: string;
  lunchItems?: string[];
  noLunch?: boolean;
  noLunchReason?: NoMealReason | '';
  noLunchDescription?: string;
  skipped?: boolean;
  reason?: NoMealReason | '';
  skipNote?: string;
  notes?: string;
  meals: Record<MealSlot, MealEntry>;
};

export type WeekMenu = {
  id: string;
  title: string;
  ownerId: string;
  members: string[];
  inviteCode: string;
  weekStart: string;
  days: Record<string, DailyMenu>;
  updatedAt?: Date;
  updatedBy?: string;
};

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  enabledMeals: MealSlot[];
  theme: ThemePreference;
  groupId?: string;
  updatedAt?: Date;
};

export type MenuGroup = {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  memberEmails: string[];
  pendingEmails: string[];
  inviteCode: string;
  enabledMeals: MealSlot[];
  updatedAt?: Date;
};

export type Dish = {
  id: string;
  name: string;
  normalizedName: string;
  createdBy: string;
  members?: string[];
  timesUsed: number;
  tags?: string[];
  archived?: boolean;
  createdAt?: Date;
  lastUsedAt?: Date;
  updatedAt?: Date;
};

export type MenuPatch = {
  dayKey: string;
  path?: string;
  slot?: string;
  value: string | string[] | boolean;
};