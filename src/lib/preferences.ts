import { isAvatarKey, type AvatarKey } from "./avatar.js";

export const languages = [
  { id: "en", label: "English" },
  { id: "it", label: "Italiano" }
] as const;

export const themes = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
] as const;

export const menuGroups = [
  {
    id: "overview",
    label: "Overview",
    ariaLabel: "Primary navigation",
    items: [
      { id: "dashboard", href: "/", label: "Dashboard", title: "Dashboard", icon: "dashboard" },
      { id: "statistics", href: "/statistics", label: "Statistics", title: "Statistics", icon: "statistics" },
      { id: "budgets", href: "/budgets", label: "Budgets", title: "Budgets", icon: "budgets" },
      { id: "recurring", href: "/recurring", label: "Recurring", title: "Recurring", icon: "recurring" }
    ]
  },
  {
    id: "ledger",
    label: "Ledger",
    ariaLabel: "Ledger navigation",
    items: [
      { id: "accounts", href: "/accounts", label: "Accounts", title: "Accounts", icon: "accounts" },
      { id: "transactions", href: "/transactions", label: "Transactions", title: "Transactions", icon: "transactions" },
      { id: "categories", href: "/categories", label: "Categories", title: "Categories", icon: "categories" },
      { id: "tags", href: "/tags", label: "Tags", title: "Tags", icon: "tags" },
      { id: "rules", href: "/rules", label: "Rules", title: "Rules", icon: "rules" }
    ]
  },
  {
    id: "investments",
    label: "Investments",
    ariaLabel: "Investment navigation",
    items: [
      { id: "investments", href: "/investments", label: "Overview", title: "Investments", icon: "investments" },
      { id: "assets", href: "/assets", label: "Assets", title: "Assets", icon: "assets" },
      { id: "holdings", href: "/holdings", label: "Holdings", title: "Holdings", icon: "holdings" },
      {
        id: "investment-transactions",
        href: "/investment-transactions",
        label: "Activity",
        title: "Investment transactions",
        icon: "activity"
      },
      { id: "asset-prices", href: "/asset-prices", label: "Prices", title: "Prices", icon: "prices" }
    ]
  }
] as const;

export type Language = (typeof languages)[number]["id"];
export type Theme = (typeof themes)[number]["id"];
export type MenuItemId = (typeof menuGroups)[number]["items"][number]["id"];

export type UserPreferences = {
  language: Language;
  theme: Theme;
  avatarKey: AvatarKey;
  hiddenMenuItems: MenuItemId[];
};

export const defaultUserPreferences: UserPreferences = {
  language: "en",
  theme: "light",
  avatarKey: "initials",
  hiddenMenuItems: []
};

export const menuItemIds = menuGroups.flatMap((group) => group.items.map((item) => item.id)) as MenuItemId[];

export function isLanguage(value: string): value is Language {
  return languages.some((language) => language.id === value);
}

export function isTheme(value: string): value is Theme {
  return themes.some((theme) => theme.id === value);
}

export function isMenuItemId(value: string): value is MenuItemId {
  return menuItemIds.includes(value as MenuItemId);
}

export function normalizeUserPreferences(value: {
  language?: string;
  theme?: string;
  avatarKey?: string;
  hiddenMenuItems?: string[];
}): UserPreferences {
  return {
    language: value.language && isLanguage(value.language) ? value.language : defaultUserPreferences.language,
    theme: value.theme && isTheme(value.theme) ? value.theme : defaultUserPreferences.theme,
    avatarKey: value.avatarKey && isAvatarKey(value.avatarKey) ? value.avatarKey : defaultUserPreferences.avatarKey,
    hiddenMenuItems: Array.from(new Set((value.hiddenMenuItems ?? []).filter(isMenuItemId)))
  };
}
