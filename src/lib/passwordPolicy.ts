export const minimumPasswordLength = 12;
export const maximumBcryptPasswordBytes = 72;

import { passwordFieldError } from "./formValidation.js";

export function passwordPolicyError(password: string, label = "Password"): string | null {
  return passwordFieldError(password, label);
}

export function assertPasswordPolicy(password: string, label = "Password") {
  const error = passwordPolicyError(password, label);

  if (error) {
    throw new Error(error);
  }
}
