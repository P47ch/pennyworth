import {
  Activity,
  ArrowLeftRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarSync,
  Car,
  ChartCandlestick,
  ChartNoAxesCombined,
  ChartPie,
  ChevronDown,
  CircleHelp,
  CircleMinus,
  CircleOff,
  Clapperboard,
  Coins,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PawPrint,
  PiggyBank,
  Plane,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Shapes,
  ShoppingBag,
  Sun,
  Tags,
  Upload,
  Utensils,
  WalletCards,
  WandSparkles
} from "lucide-static";

const categoryIcons = {
  business: BriefcaseBusiness,
  education: GraduationCap,
  entertainment: Clapperboard,
  food: Utensils,
  gift: Gift,
  health: HeartPulse,
  home: House,
  investment: ChartCandlestick,
  other: Shapes,
  pets: PawPrint,
  salary: BadgeDollarSign,
  savings: PiggyBank,
  shopping: ShoppingBag,
  subscription: CalendarSync,
  tax: ReceiptText,
  transport: Car,
  travel: Plane,
  utilities: WalletCards
} as const;

export const categoryIconOptions = [
  { name: "salary", label: "Salary" },
  { name: "food", label: "Food" },
  { name: "home", label: "Home" },
  { name: "transport", label: "Transport" },
  { name: "health", label: "Health" },
  { name: "subscription", label: "Subscriptions" },
  { name: "investment", label: "Investments" },
  { name: "tax", label: "Taxes" },
  { name: "shopping", label: "Shopping" },
  { name: "entertainment", label: "Entertainment" },
  { name: "education", label: "Education" },
  { name: "travel", label: "Travel" },
  { name: "business", label: "Business" },
  { name: "gift", label: "Gifts" },
  { name: "pets", label: "Pets" },
  { name: "utilities", label: "Utilities" },
  { name: "savings", label: "Savings" },
  { name: "other", label: "Other" }
] as const;

export type CategoryIconName = (typeof categoryIconOptions)[number]["name"];

const categoryIconNames = new Set<string>(categoryIconOptions.map((option) => option.name));

const icons = {
  activity: Activity,
  assets: Coins,
  budgets: ChartPie,
  categories: Shapes,
  dashboard: LayoutDashboard,
  expense: CircleMinus,
  holdings: Layers3,
  investments: ChartCandlestick,
  logout: LogOut,
  menu: Menu,
  moon: Moon,
  plus: Plus,
  prices: BadgeDollarSign,
  recurring: CalendarSync,
  rules: WandSparkles,
  settings: Settings,
  statistics: ChartNoAxesCombined,
  sun: Sun,
  tags: Tags,
  transactions: ArrowLeftRight,
  accounts: Landmark,
  "chevron-down": ChevronDown,
  security: ShieldCheck,
  upload: Upload,
  "no-icon": CircleOff,
  ...categoryIcons
} as const;

export type IconName = keyof typeof icons;

export function parseCategoryIcon(value: string): CategoryIconName | "" {
  const iconName = value.trim();

  if (!iconName) {
    return "";
  }

  if (!categoryIconNames.has(iconName)) {
    throw new Error("Choose a valid icon.");
  }

  return iconName as CategoryIconName;
}

export function isCategoryIcon(name: string | null | undefined): name is CategoryIconName {
  return typeof name === "string" && categoryIconNames.has(name);
}

export function renderIcon(name: string, color?: string | null) {
  const isKnownIcon = Object.hasOwn(icons, name);
  const svg = isKnownIcon ? icons[name as IconName] : CircleHelp;
  const className = isKnownIcon ? name : "fallback";
  const safeColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null;

  return svg
    .replace(/^<!--[\s\S]*?-->\s*/, "")
    .replace(/class="[^"]*"/, `class="icon icon-${className}"`)
    .replace('stroke="currentColor"', `stroke="${safeColor ?? "currentColor"}"`)
    .replace("<svg", '<svg aria-hidden="true" focusable="false"');
}

export function renderCategoryIcon(name: string | null | undefined, color?: string | null) {
  return renderIcon(isCategoryIcon(name) ? name : "category-icon-fallback", color);
}

export function renderColorSwatch(color: string | null | undefined) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return "";
  }

  return `<svg class="color-swatch" aria-hidden="true" focusable="false" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="${color.toLowerCase()}" stroke="currentColor" stroke-width="1" /></svg>`;
}

type CategoryReference = {
  name: string;
  icon?: string | null;
  color?: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return replacements[character];
  });
}

export function renderCategoryLabel(category: CategoryReference | null | undefined) {
  if (!category) {
    return "-";
  }

  const marker = category.icon
    ? renderCategoryIcon(category.icon, category.color)
    : renderColorSwatch(category.color);
  const markerMarkup = marker
    ? `<span class="category-reference-marker" aria-hidden="true">${marker}</span>`
    : "";

  return `<span class="category-reference">${markerMarkup}<span>${escapeHtml(category.name)}</span></span>`;
}
