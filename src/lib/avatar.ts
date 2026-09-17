export const avatarOptions = [
  {
    id: "initials",
    label: "Initials",
    imagePath: null
  },
  {
    id: "auditor",
    label: "Auditor",
    imagePath: "/public/avatars/auditor.png"
  },
  {
    id: "archivist",
    label: "Archivist",
    imagePath: "/public/avatars/archivist.png"
  },
  {
    id: "operator",
    label: "Operator",
    imagePath: "/public/avatars/operator.png"
  },
  {
    id: "courier",
    label: "Courier",
    imagePath: "/public/avatars/courier.png"
  },
  {
    id: "custodian",
    label: "Custodian",
    imagePath: "/public/avatars/custodian.png"
  }
] as const;

export type AvatarKey = (typeof avatarOptions)[number]["id"];

export type AvatarPresentation = {
  key: AvatarKey;
  label: string;
  imagePath: string | null;
  initials: string;
};

export function isAvatarKey(value: string): value is AvatarKey {
  return avatarOptions.some((option) => option.id === value);
}

export function normalizeAvatarKey(value: string | null | undefined): AvatarKey {
  return value && isAvatarKey(value) ? value : "initials";
}

function firstCharacters(value: string, count: number) {
  return Array.from(value).slice(0, count).join("");
}

export function avatarInitials(name: string, email: string): string {
  const nameParts = name.trim().split(/\s+/u).filter(Boolean);

  if (nameParts.length > 1) {
    return `${firstCharacters(nameParts[0], 1)}${firstCharacters(nameParts.at(-1) ?? "", 1)}`.toLocaleUpperCase();
  }

  if (nameParts.length === 1) {
    return firstCharacters(nameParts[0], 2).toLocaleUpperCase();
  }

  const emailName = email.trim().split("@", 1)[0];
  return firstCharacters(emailName || "PW", 2).toLocaleUpperCase();
}

export function resolveAvatar(value: {
  avatarKey?: string | null;
  name: string;
  email: string;
}): AvatarPresentation {
  const key = normalizeAvatarKey(value.avatarKey);
  const option = avatarOptions.find((candidate) => candidate.id === key) ?? avatarOptions[0];

  return {
    key: option.id,
    label: option.label,
    imagePath: option.imagePath,
    initials: avatarInitials(value.name, value.email)
  };
}

export function avatarChoices(value: { name: string; email: string }) {
  const initials = avatarInitials(value.name, value.email);

  return avatarOptions.map((option) => ({
    ...option,
    initials
  }));
}
