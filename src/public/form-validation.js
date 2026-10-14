import { formContracts, validateForm, fieldIsRequired, translateValidationMessage } from "./form-validation-core.js";

const controls = form => Array.from(form.elements).filter(element => typeof element.setCustomValidity === "function");
function formValues(form) {
  const values = {};
  for (const [name, item] of new FormData(form)) {
    if (typeof item !== "string") continue;
    if (name in values) values[name] = Array.isArray(values[name]) ? [...values[name], item] : [values[name], item];
    else values[name] = item;
  }
  return values;
}
function check(form) {
  const kind = form.dataset.validation;
  const values = formValues(form);
  const inputs = controls(form);
  for (const input of inputs) input.setCustomValidity("");
  for (const [name, rule] of Object.entries(formContracts[kind])) {
    const input = inputs.find(item => item.name === name);
    if (input && !input.disabled && input.type !== "hidden" && (rule.required || rule.requiredWhen || rule.when)) input.required = fieldIsRequired(rule, values);
  }
  const file = form.querySelector('[name="backupFile"]')?.files?.[0];
  const errors = validateForm(kind, values, {
    primaryCurrency: document.documentElement.dataset.primaryCurrency ?? form.querySelector('[name="currency"][readonly]')?.defaultValue,
    originalName: form.dataset.originalName,
    backupFileBytes: file?.size ?? 0,
    categoryTypes: Object.fromEntries(Array.from(form.querySelectorAll('[name="categoryId"] option[data-category-type]')).map(option => [option.value, option.dataset.categoryType])),
    categoryId: form.dataset.recordId,
    categoryParents: Object.fromEntries(Array.from(form.querySelectorAll('[name="parentId"] option[data-parent-id]')).map(option => [option.value, option.dataset.parentId || null]))
  });
  // The encrypted file is inspected asynchronously when selected; preserve that result.
  if (file && form.dataset.encryptedBackup === "true" && !values.backupPassphrase) errors.push({ field: "backupPassphrase", message: "Enter the backup passphrase." });
  if (file && form.dataset.backupFileError) errors.push({ field: "backupFile", message: form.dataset.backupFileError });
  if (file && form.dataset.readingBackup === "true") errors.push({ field: "backupFile", message: "Checking the backup file." });
  for (const error of errors) {
    const input = inputs.find(item => item.name === error.field && !item.disabled);
    if (input) input.setCustomValidity(translateValidationMessage(error.message, document.documentElement.lang));
  }
  return errors.length === 0 && form.checkValidity();
}
for (const form of document.querySelectorAll("form[data-validation]")) {
  if (!(form.dataset.validation in formContracts)) throw new Error("Unknown form validation contract");
  const update = () => check(form);
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("reset", () => queueMicrotask(update));
  // Capture runs before quick-entry fetch handlers, including programmatic submit events.
  form.addEventListener("submit", event => {
    if (!check(form)) { event.preventDefault(); event.stopImmediatePropagation(); form.reportValidity(); }
  }, true);
  const fileInput = form.querySelector('[name="backupFile"]');
  if (fileInput) fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    delete form.dataset.encryptedBackup;
    delete form.dataset.backupFileError;
    delete form.dataset.readingBackup;
    if (file && file.size <= 14 * 1024 * 1024) {
      form.dataset.readingBackup = "true";
      update();
      try {
        const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()));
        if (fileInput.files?.[0] !== file) return;
        form.dataset.encryptedBackup = String(data?.format === "pennyworth-encrypted-backup");
        if (!data || typeof data !== "object" || Array.isArray(data)) form.dataset.backupFileError = "Paste a valid JSON backup.";
        else if (form.dataset.encryptedBackup !== "true" && file.size > 10 * 1024 * 1024) form.dataset.backupFileError = "Backup JSON is too large.";
      } catch { if (fileInput.files?.[0] === file) form.dataset.backupFileError = "Paste a valid JSON backup."; }
      if (fileInput.files?.[0] !== file) return;
      delete form.dataset.readingBackup;
    }
    update();
  });
  // Existing page scripts have synchronously applied visibility/disabled state first.
  check(form);
  form.dataset.validationReady = "true";
}
