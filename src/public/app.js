const themePreview = document.querySelector("[data-theme-preview]");
const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
const sidebarClose = document.querySelector("[data-sidebar-close]");
const csvFileInput = document.querySelector("[data-csv-file-input]");
const csvTextarea = document.querySelector("[data-csv-textarea]");
const importMappingForm = document.querySelector("[data-import-mapping-form]");
const clearImportMappingButton = document.querySelector("[data-clear-import-mapping]");
const importMappingStatus = document.querySelector("[data-import-mapping-status]");
const accountMenu = document.querySelector("[data-account-menu]");

const isMobileSidebar = () => window.matchMedia("(max-width: 900px)").matches;

const setSidebarExpandedState = () => {
  if (!sidebarToggle) {
    return;
  }

  const open = document.documentElement.dataset.sidebarOpen === "true";
  const collapsed = document.documentElement.dataset.sidebarCollapsed === "true";
  sidebarToggle.setAttribute("aria-expanded", String(isMobileSidebar() ? open : !collapsed));
};

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    if (isMobileSidebar()) {
      const open = document.documentElement.dataset.sidebarOpen === "true";
      document.documentElement.dataset.sidebarOpen = String(!open);
    } else {
      const collapsed = document.documentElement.dataset.sidebarCollapsed === "true";
      const nextCollapsed = !collapsed;
      document.documentElement.dataset.sidebarCollapsed = String(nextCollapsed);
      localStorage.setItem("pennyworth-sidebar-collapsed", String(nextCollapsed));
    }

    setSidebarExpandedState();
  });

  window.addEventListener("resize", setSidebarExpandedState);
  setSidebarExpandedState();
}

if (sidebarClose) {
  sidebarClose.addEventListener("click", () => {
    document.documentElement.dataset.sidebarOpen = "false";
    setSidebarExpandedState();
  });
}

if (accountMenu instanceof HTMLDetailsElement) {
  document.addEventListener("click", (event) => {
    if (accountMenu.open && event.target instanceof Node && !accountMenu.contains(event.target)) {
      accountMenu.open = false;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && accountMenu.open) {
      accountMenu.open = false;
      accountMenu.querySelector("summary")?.focus();
    }
  });
}

if (themePreview) {
  themePreview.addEventListener("change", () => {
    document.documentElement.dataset.theme = themePreview.value;
  });
}

if (csvFileInput && csvTextarea) {
  csvFileInput.addEventListener("change", async () => {
    const file = csvFileInput.files?.[0];

    if (!file) {
      return;
    }

    csvTextarea.value = await file.text();
  });
}

if (importMappingForm) {
  const mappingFields = [
    "dateColumn",
    "typeColumn",
    "amountColumn",
    "amountMinorColumn",
    "debitColumn",
    "creditColumn",
    "accountColumn",
    "destinationAccountColumn",
    "categoryColumn",
    "tagsColumn",
    "descriptionColumn",
    "notesColumn",
    "defaultType",
    "defaultAccountId"
  ];
  const headers = JSON.parse(importMappingForm.dataset.importHeaders || "[]");
  const storageKey = `pennyworth-import-mapping:${headers.join("|")}`;

  const showImportMappingStatus = (message) => {
    if (!importMappingStatus) {
      return;
    }

    importMappingStatus.textContent = message;
    importMappingStatus.hidden = false;
  };

  const selectHasValue = (select, value) => Array.from(select.options).some((option) => option.value === value);

  const storedMapping = localStorage.getItem(storageKey);

  if (storedMapping) {
    try {
      const mapping = JSON.parse(storedMapping);

      for (const fieldName of mappingFields) {
        const field = importMappingForm.elements[fieldName];
        const value = mapping[fieldName];

        if (field && typeof value === "string" && selectHasValue(field, value)) {
          field.value = value;
        }
      }

      showImportMappingStatus("Saved mapping loaded for these CSV headers.");
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  importMappingForm.addEventListener("submit", () => {
    const mapping = {};

    for (const fieldName of mappingFields) {
      const field = importMappingForm.elements[fieldName];

      if (field) {
        mapping[fieldName] = field.value;
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(mapping));
  });

  if (clearImportMappingButton) {
    clearImportMappingButton.addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      showImportMappingStatus("Saved mapping cleared for these CSV headers.");
    });
  }
}

for (const rulesHelp of document.querySelectorAll("[data-rules-help], [data-page-help]")) {
  document.addEventListener("click", (event) => {
    if (!rulesHelp.contains(event.target)) {
      rulesHelp.open = false;
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && rulesHelp.open) {
      rulesHelp.open = false;
      rulesHelp.querySelector("summary").focus();
    }
  });
}

const transactionForm = document.querySelector("[data-transaction-form]");

if (transactionForm) {
  const typeSelect = transactionForm.querySelector("[data-transaction-type]");
  const sourceAccountText = transactionForm.querySelector("[data-source-account-text]");
  const destinationField = transactionForm.querySelector("[data-transfer-only]");
  const categoryField = transactionForm.querySelector("[data-category-field]");
  const destinationSelect = destinationField?.querySelector("select");
  const categorySelect = categoryField?.querySelector("select");
  const persistedFields = transactionForm.querySelectorAll("[data-persist-field]");

  for (const persistedField of persistedFields) {
    const storageKey = `pennyworth-${persistedField.dataset.persistField}`;
    const storedValue = localStorage.getItem(storageKey);

    if (!persistedField.value && storedValue) {
      const hasOption = Array.from(persistedField.options).some((option) => option.value === storedValue);

      if (hasOption) {
        persistedField.value = storedValue;
      }
    }

    persistedField.addEventListener("change", () => {
      if (persistedField.value) {
        localStorage.setItem(storageKey, persistedField.value);
      } else {
        localStorage.removeItem(storageKey);
      }
    });
  }

  const syncTransactionForm = () => {
    const type = typeSelect.value;
    const isTransfer = type === "transfer";

    if (sourceAccountText) {
      sourceAccountText.textContent = isTransfer ? sourceAccountText.dataset.sourceLabel || "Source account" : sourceAccountText.dataset.accountLabel || "Account";
    }

    if (destinationField && destinationSelect) {
      destinationField.hidden = !isTransfer;
      destinationSelect.disabled = !isTransfer;
    }

    if (categoryField && categorySelect) {
      categoryField.hidden = isTransfer;
      categorySelect.disabled = isTransfer;
    }
  };

  if (typeSelect) {
    typeSelect.addEventListener("change", syncTransactionForm);
    syncTransactionForm();
  }
}

const recurringForm = document.querySelector('[data-recurring-form]');
if (recurringForm) {
  const type = recurringForm.querySelector('[data-transaction-type]');
  const mode = recurringForm.querySelector('[data-recurring-mode]');
  const fixed = recurringForm.querySelector('[data-recurring-fixed]');
  const target = recurringForm.querySelector('[data-recurring-target]');
  const fees = recurringForm.querySelector('[data-recurring-fees]');
  const syncRecurring = () => {
    const transfer = type.value === 'transfer';
    if (!transfer) mode.value = 'fixed';
    mode.disabled = !transfer;
    const calculated = transfer && mode.value === 'target_balance';
    fixed.hidden = calculated;
    fixed.querySelector('input').disabled = calculated;
    fixed.querySelector('input').required = !calculated;
    target.hidden = !calculated;
    target.querySelector('input').disabled = !calculated;
    target.querySelector('input').required = calculated;
    fees.hidden = !transfer;
    fees.disabled = !transfer;
  };
  type.addEventListener('change', syncRecurring);
  mode.addEventListener('change', syncRecurring);
  syncRecurring();
}
