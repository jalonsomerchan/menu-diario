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

export type DailyMenu = {
  lunch: string;
  dinner: string;
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

export type MenuPatch = {
  dayKey: string;
  slot: MealSlot | 'notes';
  value: string;
};
