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

export type MenuParticipant = {
  id: string;
  name: string;
  email: string;
};

export type NoMealReason = 'away' | 'eating-out' | 'not-hungry' | 'other';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DishScope = 'global' | 'group' | 'user';
export type DishSource = 'admin' | 'group' | 'legacy' | 'duplicated-global' | 'manual' | 'menu';

export type MealEntry = {
  items: string[];
  skipped: boolean;
  reason: NoMealReason | '';
  note: string;
  participantIds?: string[];
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
  groupId?: string;
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
  foodIntolerances: string;
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
  scope: DishScope;
  source: DishSource;
  groupId?: string;
  createdBy: string;
  members?: string[];
  isGlobal: boolean;
  editable: boolean;
  timesUsed: number;
  tags?: string[];
  quickTags?: string[];
  favorite?: boolean;
  blocked?: boolean;
  archived?: boolean;
  archivedAt?: Date;
  duplicatedFrom?: string;
  ingredients?: Array<string | { name: string; quantity?: string; category?: string }>;
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
