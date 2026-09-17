(() => {
  const sidebarCollapsed = localStorage.getItem("pennyworth-sidebar-collapsed") === "true";

  if (sidebarCollapsed) {
    document.documentElement.dataset.sidebarCollapsed = "true";
  }
})();
