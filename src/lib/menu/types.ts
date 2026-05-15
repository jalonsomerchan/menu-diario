export type FirebaseUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

export type MealSlot = 'lunch' | 'dinner';

export type WeekDay = {
  key: string;
  label: string;
  isoDate: string;
};

export type NoLunchReason = 'away' | 'eating-out' | 'other';

export type DailyMenu = {
  lunch?: string;
  dinner?: string;
  lunchItems: string[];
  noLunch: boolean;
  noLunchReason: NoLunchReason | '';
  noLunchDescription: string;
  notes: string;
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

export type Dish = {
  id: string;
  name: string;
  normalizedName: string;
  createdBy: string;
  timesUsed: number;
  lastUsedAt?: Date;
};

export type MenuPatch = {
  dayKey: string;
  slot: MealSlot | 'notes' | 'lunchItems' | 'noLunch' | 'noLunchReason' | 'noLunchDescription';
  value: string | string[] | boolean;
};
