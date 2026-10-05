(() => {
  const transactionForm = document.querySelector("[data-transaction-form]");
  if (!transactionForm || typeof HTMLDialogElement === "undefined" || !HTMLDialogElement.prototype.showModal) return;

  const typeSelect = transactionForm.querySelector("[data-transaction-type]");
  const categorySelect = transactionForm.querySelector('[name="categoryId"]');
  const tagList = transactionForm.querySelector("[data-transaction-tags]");
  const status = transactionForm.querySelector("[data-quick-taxonomy-status]");

  const addOption = (select, record) => {
    let option = Array.from(select.options).find((item) => item.value === record.id);
    if (!option) {
      option = new Option(record.name, record.id);
      select.add(option);
    }
    option.textContent = record.name;
    option.dataset.categoryType = record.type || "";
    return option;
  };

  const syncCategoryOptions = () => {
    for (const option of categorySelect.options) {
      const compatible = !option.value || !option.dataset.categoryType ||
        option.dataset.categoryType === "both" || option.dataset.categoryType === typeSelect.value;
      option.disabled = !compatible;
      option.hidden = !compatible;
      if (!compatible && option.selected) categorySelect.value = "";
    }
  };

  typeSelect.addEventListener("change", syncCategoryOptions);
  syncCategoryOptions();

  for (const dialog of document.querySelectorAll("[data-quick-taxonomy]")) {
    const kind = dialog.dataset.quickTaxonomy;
    const opener = transactionForm.querySelector(`[data-quick-taxonomy-open="${kind}"]`);
    const form = dialog.querySelector("form");
    const errorMessage = dialog.querySelector("[data-quick-taxonomy-error]");
    const existingNotice = dialog.querySelector("[data-quick-taxonomy-existing]");
    const useExisting = dialog.querySelector("[data-use-existing]");
    const cancel = dialog.querySelector("[data-dialog-cancel]");
    let pending = false;
    let existingRecord = null;

    const clearExisting = () => {
      existingRecord = null;
      existingNotice.hidden = true;
    };
    const showError = (message) => {
      errorMessage.textContent = message;
      errorMessage.hidden = false;
      errorMessage.focus();
    };
    const validRecord = (record) => record && typeof record.id === "string" && record.id &&
      typeof record.name === "string" && record.name &&
      (kind !== "category" || ["income", "expense", "both"].includes(record.type));
    const compatibleRecord = (record) => kind !== "category" ||
      (typeSelect.value !== "transfer" && (record.type === "both" || record.type === typeSelect.value));
    const selectRecord = (record, existing) => {
      if (!compatibleRecord(record)) {
        showError(dialog.dataset.incompatibleError);
        return;
      }
      if (kind === "category") {
        addOption(categorySelect, record);
        addOption(form.elements.namedItem("parentId"), record);
        const filter = document.querySelector('form[method="get"] [name="categoryId"]');
        if (filter) addOption(filter, record);
        categorySelect.value = record.id;
        syncCategoryOptions();
        categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        let checkbox = Array.from(tagList.querySelectorAll("input")).find((input) => input.value === record.id);
        if (!checkbox) {
          checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.name = "tagIds";
          checkbox.value = record.id;
          const label = document.createElement("label");
          label.append(checkbox, document.createTextNode(` ${record.name}`));
          tagList.append(label);
        }
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        const filter = document.querySelector('form[method="get"] [name="tagId"]');
        if (filter) addOption(filter, record);
      }
      status.textContent = existing ? dialog.dataset.existingSelected :
        (kind === "category" ? status.dataset.categoryCreated : status.dataset.tagCreated);
      dialog.close();
    };

    form.addEventListener("input", clearExisting);
    form.addEventListener("change", clearExisting);
    useExisting.addEventListener("click", () => {
      if (!pending && existingRecord) selectRecord(existingRecord, true);
    });

    opener.hidden = false;
    opener.addEventListener("click", () => {
      if (kind === "category" && typeSelect.value === "transfer") return;
      form.reset();
      clearExisting();
      status.textContent = "";
      errorMessage.hidden = true;
      errorMessage.textContent = "";
      dialog.querySelector("details")?.removeAttribute("open");
      if (kind === "category") {
        const categoryType = form.elements.namedItem("type");
        for (const option of categoryType.options) {
          option.disabled = option.value !== typeSelect.value && option.value !== "both";
          option.hidden = option.disabled;
        }
        categoryType.value = typeSelect.value;
      }
      dialog.showModal();
      form.elements.namedItem("name").focus();
    });

    cancel.addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", (event) => {
      if (pending) event.preventDefault();
    });
    dialog.addEventListener("close", () => opener.focus());

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      pending = true;
      clearExisting();
      errorMessage.hidden = true;
      errorMessage.textContent = "";
      const body = new URLSearchParams(new FormData(form));
      const controls = Array.from(form.querySelectorAll("input, select, button"))
        .map((control) => ({ control, disabled: control.disabled }));
      for (const { control } of controls) control.disabled = true;
      form.setAttribute("aria-busy", "true");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(form.action, {
          method: "POST", credentials: "same-origin", headers: { Accept: "application/json" }, body, signal: controller.signal
        });
        if (response.redirected) {
          showError(dialog.dataset.sessionError);
          return;
        }
        if (response.status === 403) {
          const refreshedPage = await fetch("/transactions", { credentials: "same-origin", signal: controller.signal });
          if (refreshedPage.redirected) {
            showError(dialog.dataset.sessionError);
            return;
          }
          if (!refreshedPage.ok) {
            showError(dialog.dataset.requestError);
            return;
          }
          const refreshedDocument = new DOMParser().parseFromString(await refreshedPage.text(), "text/html");
          const token = refreshedDocument.querySelector('[name="csrfToken"]')?.value;
          if (!token) {
            showError(dialog.dataset.requestError);
            return;
          }
          for (const input of document.querySelectorAll('input[name="csrfToken"]')) {
            input.value = token;
            input.defaultValue = token;
          }
          showError(dialog.dataset.csrfError);
          return;
        }
        if (!response.headers.get("content-type")?.includes("application/json")) {
          showError(dialog.dataset.requestError);
          return;
        }
        const result = await response.json();
        if (!response.ok) {
          const message = typeof result?.error === "string" ? result.error : dialog.dataset.requestError;
          if (response.status === 409 && validRecord(result?.existing)) {
            if (compatibleRecord(result.existing)) {
              existingRecord = result.existing;
              existingNotice.hidden = false;
            } else {
              showError(`${message} ${dialog.dataset.incompatibleError}`);
              return;
            }
          }
          showError(message);
          return;
        }
        const record = result?.[kind];
        if (!validRecord(record)) {
          showError(dialog.dataset.requestError);
          return;
        }
        selectRecord(record, false);
      } catch {
        showError(dialog.dataset.requestError);
      } finally {
        clearTimeout(timeout);
        pending = false;
        for (const { control, disabled } of controls) control.disabled = disabled;
        form.removeAttribute("aria-busy");
      }
    });
  }
})();
