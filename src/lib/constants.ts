export const ROLES = [
  { value: "OWNER", label: "Restaurant Owner" },
  { value: "MANAGER", label: "Restaurant Manager" },
  { value: "CASHIER", label: "Cashier" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "WAITER", label: "Waiter" },
] as const;

export type RoleValue = (typeof ROLES)[number]["value"];

export const roleLabel = (role: string) =>
  ROLES.find((r) => r.value === role)?.label ?? role;

export const ORDER_STATUS = [
  { value: "PENDING", label: "Pending", tone: "amber" },
  { value: "TAKEN", label: "Taken", tone: "sky" },
  { value: "PAID", label: "Paid", tone: "gold" },
  { value: "ACCEPTED", label: "Accepted", tone: "violet" },
  { value: "COOKING", label: "Cooking", tone: "teal" },
  { value: "READY", label: "Ready", tone: "emerald" },
  { value: "SERVED", label: "Served", tone: "sky" },
  { value: "COMPLETED", label: "Completed", tone: "zinc" },
  { value: "CANCELLED", label: "Cancelled", tone: "rose" },
] as const;

export const statusLabel = (s: string) =>
  ORDER_STATUS.find((x) => x.value === s)?.label ?? s;

export const ITEM_STATUS = [
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "COOKING", label: "Cooking" },
  { value: "READY", label: "Ready" },
  { value: "SERVED", label: "Served" },
] as const;

export const TAX_RATE = 0.08;

export const ROLE_HOME: Record<string, string> = {
  OWNER: "/manager",
  MANAGER: "/manager",
  CASHIER: "/cashier",
  KITCHEN: "/kitchen",
  WAITER: "/waiter",
};

export const MANAGEMENT_ROLES = ["OWNER", "MANAGER"] as const;

export const FOOD_IMAGE_OPTIONS = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
  "https://images.unsplash.com/photo-1571091718767-18b5b1457add",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327",
  "https://images.unsplash.com/photo-1512058564366-18510be2db19",
  "https://images.unsplash.com/photo-1513104890138-7c749659a591",
  "https://images.unsplash.com/photo-1551024506-0bccd828d307",
] as const;
