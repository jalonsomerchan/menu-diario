import type { MealSlot } from '../menu/types';

export type TupperStatus = 'active' | 'assigned' | 'consumed' | 'discarded' | 'archived';
export type TupperLocation = 'fridge' | 'freezer' | 'other' | '';
export type TupperFilter = 'all' | 'expiring' | 'expired' | 'freezer' | 'fridge' | 'done';

export type TupperItem = {
  id: string;
  name: string;
  normalizedName: string;
  dishId?: string;
  createdBy: string;
  groupId?: string;
  members: string[];
  preparedAt: string;
  expiresAt: string;
  portions?: number;
  location: TupperLocation;
  notes: string;
  status: TupperStatus;
  assignedMenuId?: string;
  assignedDay?: string;
  assignedMeal?: MealSlot;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TupperFormData = {
  name: string;
  dishId?: string;
  preparedAt: string;
  expiresAt: string;
  portions?: number;
  location: TupperLocation;
  notes: string;
};

export type TupperAssignment = {
  menuId: string;
  dayKey: string;
  meal: MealSlot;
};

export type TupperExpiryState = 'fresh' | 'expiring' | 'expired' | 'done';

export type UpcomingMealTarget = {
  dayKey: string;
  meal: MealSlot;
  label: string;
};
