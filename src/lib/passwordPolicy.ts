export const minimumPasswordLength = 12;
export const maximumBcryptPasswordBytes = 72;

const forbiddenPasswords = new Set(["change-me-now", "password", "admin", "admin123"]);

export function passwordPolicyError(password: string, label = "Password"): string | null {
  if (!password) {
    return `${label} is required.`;
  }

  if (password.length < minimumPasswordLength) {
    return `${label} must be at least ${minimumPasswordLength} characters.`;
  }

  if (Buffer.byteLength(password, "utf8") > maximumBcryptPasswordBytes) {
    return `${label} must be no more than ${maximumBcryptPasswordBytes} UTF-8 bytes for the current password hashing format.`;
  }

  if (forbiddenPasswords.has(password.toLowerCase())) {
    return `${label} uses a forbidden default password.`;
  }

  return null;
}

export function assertPasswordPolicy(password: string, label = "Password") {
  const error = passwordPolicyError(password, label);

  if (error) {
    throw new Error(error);
  }
}
