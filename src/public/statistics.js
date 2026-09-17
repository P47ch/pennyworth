const netWorthExplorer = document.querySelector("[data-net-worth-chart]");

if (netWorthExplorer?.querySelector("[data-net-worth-canvas]") && window.Chart) {
  const canvas = netWorthExplorer.querySelector("[data-net-worth-canvas]");
  const tooltip = netWorthExplorer.querySelector("[data-net-worth-tooltip]");
  const rangeButtons = Array.from(netWorthExplorer.querySelectorAll("[data-net-worth-range]"));
  const seriesButtons = Array.from(netWorthExplorer.querySelectorAll("[data-net-worth-series]"));
  const config = JSON.parse(netWorthExplorer.dataset.netWorthChart || "{}");
  const allPoints = config.points || [];
  const styles = getComputedStyle(document.documentElement);
  const currency = config.currency || "EUR";
  const locale = config.locale || "en-US";
  const exactMoney = new Intl.NumberFormat(locale, { style: "currency", currency });
  const compactMoney = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1
  });
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visiblePoints = allPoints;

  const cssColor = (name) => styles.getPropertyValue(name).trim();
  const renderTooltip = ({ tooltip: tooltipModel }) => {
    if (!tooltip || tooltipModel.opacity === 0) {
      if (tooltip) {
        tooltip.hidden = true;
      }
      return;
    }

    tooltip.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = tooltipModel.title?.[0] || "";
    tooltip.append(title);

    const list = document.createElement("dl");
    for (const point of tooltipModel.dataPoints) {
      const term = document.createElement("dt");
      const swatch = document.createElement("span");
      swatch.className = "chart-tooltip-swatch";
      swatch.style.backgroundColor = point.dataset.borderColor;
      term.append(swatch, document.createTextNode(point.dataset.label));

      const value = document.createElement("dd");
      value.textContent = exactMoney.format(point.parsed.y / 100);
      list.append(term, value);
    }
    tooltip.append(list);
    tooltip.hidden = false;

    const halfWidth = tooltip.offsetWidth / 2;
    const left = Math.max(halfWidth + 8, Math.min(tooltipModel.caretX, canvas.clientWidth - halfWidth - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${tooltipModel.caretY}px`;
  };

  const chart = new window.Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          id: "netWorth",
          label: config.labels.netWorth,
          data: [],
          borderColor: cssColor("--accent"),
          backgroundColor: cssColor("--accent"),
          borderWidth: 3,
          pointBackgroundColor: cssColor("--panel"),
          pointBorderColor: cssColor("--accent"),
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.25
        },
        {
          id: "cash",
          label: config.labels.cash,
          data: [],
          borderColor: cssColor("--income"),
          backgroundColor: cssColor("--income"),
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.25
        },
        {
          id: "investments",
          label: config.labels.investments,
          data: [],
          borderColor: cssColor("--transfer"),
          backgroundColor: cssColor("--transfer"),
          borderWidth: 2,
          borderDash: [2, 4],
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.25
        }
      ]
    },
    options: {
      animation: prefersReducedMotion ? false : { duration: 260 },
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: renderTooltip }
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: cssColor("--muted"), maxRotation: 0, autoSkipPadding: 18 }
        },
        y: {
          border: { display: false },
          grid: { color: cssColor("--border") },
          ticks: {
            color: cssColor("--muted"),
            callback(value) {
              return compactMoney.format(Number(value) / 100);
            }
          }
        }
      }
    }
  });

  const setRange = (count) => {
    visiblePoints = allPoints.slice(-count);
    chart.data.labels = visiblePoints.map((point) => point.label);
    chart.data.datasets[0].data = visiblePoints.map((point) => point.netWorthMinor);
    chart.data.datasets[1].data = visiblePoints.map((point) => point.cashBalanceMinor);
    chart.data.datasets[2].data = visiblePoints.map((point) => point.investmentValueMinor);
    chart.update();

    for (const button of rangeButtons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.netWorthRange) === count));
    }
  };

  for (const button of rangeButtons) {
    button.addEventListener("click", () => setRange(Number(button.dataset.netWorthRange)));
  }

  for (const button of seriesButtons) {
    button.addEventListener("click", () => {
      const datasetIndex = chart.data.datasets.findIndex((dataset) => dataset.id === button.dataset.netWorthSeries);
      if (datasetIndex < 0) {
        return;
      }

      const visible = chart.isDatasetVisible(datasetIndex);
      chart.setDatasetVisibility(datasetIndex, !visible);
      button.setAttribute("aria-pressed", String(!visible));
      chart.update();
    });
  }

  setRange(Math.min(12, allPoints.length));
}

function setupMultiSeriesHistoryChart({
  rootSelector,
  configDataName,
  canvasSelector,
  tooltipSelector,
  rangeSelector,
  rangeDataName,
  seriesSelector,
  seriesDataName,
  seriesId,
  seriesValues,
  chartType,
  stacked = false
}) {
  const explorer = document.querySelector(rootSelector);

  if (!explorer?.querySelector(canvasSelector) || !window.Chart) {
    return;
  }

  const canvas = explorer.querySelector(canvasSelector);
  const tooltip = explorer.querySelector(tooltipSelector);
  const rangeButtons = Array.from(explorer.querySelectorAll(rangeSelector));
  const seriesButtons = Array.from(explorer.querySelectorAll(seriesSelector));
  const config = JSON.parse(explorer.dataset[configDataName] || "{}");
  const history = config.history || { months: [], series: [] };
  const styles = getComputedStyle(document.documentElement);
  const exactMoney = new Intl.NumberFormat(config.locale || "en-US", {
    style: "currency",
    currency: config.currency || "EUR"
  });
  const compactMoney = new Intl.NumberFormat(config.locale || "en-US", {
    style: "currency",
    currency: config.currency || "EUR",
    notation: "compact",
    maximumFractionDigits: 1
  });
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visibleMonths = history.months;

  const cssColor = (name) => styles.getPropertyValue(name).trim();
  const renderTooltip = ({ chart, tooltip: tooltipModel }) => {
    if (!tooltip || tooltipModel.opacity === 0) {
      if (tooltip) {
        tooltip.hidden = true;
      }
      return;
    }

    tooltip.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = tooltipModel.title?.[0] || "";
    tooltip.append(title);

    const list = document.createElement("dl");
    for (const point of tooltipModel.dataPoints) {
      const term = document.createElement("dt");
      const swatch = document.createElement("span");
      swatch.className = "chart-tooltip-swatch";
      swatch.style.backgroundColor = point.dataset.borderColor || point.dataset.backgroundColor;
      term.append(swatch, document.createTextNode(point.dataset.label));

      const value = document.createElement("dd");
      value.textContent = exactMoney.format(point.parsed.y / 100);
      list.append(term, value);
    }
    tooltip.append(list);
    tooltip.hidden = false;

    const { offsetLeft, offsetTop } = chart.canvas;
    const halfWidth = tooltip.offsetWidth / 2;
    const left = Math.max(halfWidth + 8, Math.min(tooltipModel.caretX, chart.canvas.clientWidth - halfWidth - 8));
    tooltip.style.left = `${offsetLeft + left}px`;
    tooltip.style.top = `${offsetTop + tooltipModel.caretY}px`;
  };
  const datasets = history.series.map((series, index) => {
    const color = cssColor(`--chart-series-${index % 8}`);
    const base = {
      id: seriesId(series),
      label: series.name,
      data: [],
      borderColor: color,
      backgroundColor: color
    };

    if (chartType === "bar") {
      return {
        ...base,
        borderRadius: 3,
        borderSkipped: false,
        maxBarThickness: 34
      };
    }

    return {
      ...base,
      borderWidth: 2.5,
      pointBackgroundColor: cssColor("--panel"),
      pointBorderColor: color,
      pointBorderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.25
    };
  });
  const chart = new window.Chart(canvas, {
    type: chartType,
    data: { labels: [], datasets },
    options: {
      animation: prefersReducedMotion ? false : { duration: 260 },
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: renderTooltip }
      },
      scales: {
        x: {
          stacked,
          border: { display: false },
          grid: { display: false },
          ticks: { color: cssColor("--muted"), maxRotation: 0, autoSkipPadding: 18 }
        },
        y: {
          stacked,
          beginAtZero: chartType === "bar",
          border: { display: false },
          grid: { color: cssColor("--border") },
          ticks: {
            color: cssColor("--muted"),
            callback(value) {
              return compactMoney.format(Number(value) / 100);
            }
          }
        }
      }
    }
  });

  const setRange = (count) => {
    const firstVisibleIndex = Math.max(0, history.months.length - count);
    visibleMonths = history.months.slice(firstVisibleIndex);
    chart.data.labels = visibleMonths.map((month) => month.label);
    chart.data.datasets.forEach((dataset, index) => {
      dataset.data = seriesValues(history.series[index]).slice(firstVisibleIndex);
    });
    chart.update();

    for (const button of rangeButtons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset[rangeDataName]) === count));
    }
  };

  for (const button of rangeButtons) {
    button.addEventListener("click", () => setRange(Number(button.dataset[rangeDataName])));
  }

  for (const button of seriesButtons) {
    button.addEventListener("click", () => {
      const datasetIndex = chart.data.datasets.findIndex((dataset) => dataset.id === button.dataset[seriesDataName]);
      if (datasetIndex < 0) {
        return;
      }

      const visible = chart.isDatasetVisible(datasetIndex);
      chart.setDatasetVisibility(datasetIndex, !visible);
      button.setAttribute("aria-pressed", String(!visible));
      chart.update();
    });
  }

  setRange(Math.min(12, history.months.length));
}

setupMultiSeriesHistoryChart({
  rootSelector: "[data-account-balance-chart]",
  configDataName: "accountBalanceChart",
  canvasSelector: "[data-account-balance-canvas]",
  tooltipSelector: "[data-account-balance-tooltip]",
  rangeSelector: "[data-account-balance-range]",
  rangeDataName: "accountBalanceRange",
  seriesSelector: "[data-account-balance-series]",
  seriesDataName: "accountBalanceSeries",
  seriesId: (series) => series.accountId,
  seriesValues: (series) => series.balancesMinor,
  chartType: "line"
});

setupMultiSeriesHistoryChart({
  rootSelector: "[data-category-spending-chart]",
  configDataName: "categorySpendingChart",
  canvasSelector: "[data-category-spending-canvas]",
  tooltipSelector: "[data-category-spending-tooltip]",
  rangeSelector: "[data-category-spending-range]",
  rangeDataName: "categorySpendingRange",
  seriesSelector: "[data-category-spending-series]",
  seriesDataName: "categorySpendingSeries",
  seriesId: (series) => series.key,
  seriesValues: (series) => series.amountsMinor,
  chartType: "bar",
  stacked: true
});

const cashflowExplorer = document.querySelector("[data-cashflow-chart]");

if (cashflowExplorer?.querySelector("[data-cashflow-canvas]") && window.Chart) {
  const canvas = cashflowExplorer.querySelector("[data-cashflow-canvas]");
  const tooltip = cashflowExplorer.querySelector("[data-chart-tooltip]");
  const rangeButtons = Array.from(cashflowExplorer.querySelectorAll("[data-chart-range]"));
  const seriesButtons = Array.from(cashflowExplorer.querySelectorAll("[data-series-toggle]"));
  const config = JSON.parse(cashflowExplorer.dataset.cashflowChart || "{}");
  const allMonths = config.months || [];
  const styles = getComputedStyle(document.documentElement);
  const currency = config.currency || "EUR";
  const locale = config.locale || "en-US";
  const exactMoney = new Intl.NumberFormat(locale, { style: "currency", currency });
  const compactMoney = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1
  });
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visibleMonths = allMonths;
  let activeTouchIndex = null;

  const cssColor = (name) => styles.getPropertyValue(name).trim();
  const monthUrl = (month) => {
    const query = new URLSearchParams({ from: month.from, to: month.to });
    return `/transactions?${query.toString()}`;
  };

  const renderTooltip = ({ chart, tooltip: tooltipModel }) => {
    if (!tooltip || tooltipModel.opacity === 0) {
      if (tooltip) {
        tooltip.hidden = true;
      }
      return;
    }

    tooltip.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = tooltipModel.title?.[0] || "";
    tooltip.append(title);

    const list = document.createElement("dl");
    for (const point of tooltipModel.dataPoints) {
      const term = document.createElement("dt");
      const swatch = document.createElement("span");
      swatch.className = "chart-tooltip-swatch";
      swatch.style.backgroundColor = point.dataset.borderColor || point.dataset.backgroundColor;
      term.append(swatch, document.createTextNode(point.dataset.label));

      const value = document.createElement("dd");
      value.textContent = exactMoney.format(point.parsed.y / 100);
      list.append(term, value);
    }
    tooltip.append(list);

    const action = document.createElement("span");
    action.className = "chart-tooltip-action";
    action.textContent = config.labels.openMonth;
    tooltip.append(action);

    tooltip.hidden = false;
    const { offsetLeft, offsetTop } = chart.canvas;
    const halfWidth = tooltip.offsetWidth / 2;
    const left = Math.max(halfWidth + 8, Math.min(tooltipModel.caretX, chart.canvas.clientWidth - halfWidth - 8));
    tooltip.style.left = `${offsetLeft + left}px`;
    tooltip.style.top = `${offsetTop + tooltipModel.caretY}px`;
  };

  const chart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          id: "income",
          label: config.labels.income,
          data: [],
          backgroundColor: cssColor("--income"),
          borderColor: cssColor("--income"),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 26,
          order: 2
        },
        {
          id: "expenses",
          label: config.labels.expenses,
          data: [],
          backgroundColor: cssColor("--expense"),
          borderColor: cssColor("--expense"),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 26,
          order: 2
        },
        {
          id: "net",
          type: "line",
          label: config.labels.net,
          data: [],
          borderColor: cssColor("--accent"),
          backgroundColor: cssColor("--accent"),
          borderWidth: 2.5,
          pointBackgroundColor: cssColor("--panel"),
          pointBorderColor: cssColor("--accent"),
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.28,
          order: 1
        }
      ]
    },
    options: {
      animation: prefersReducedMotion ? false : { duration: 260 },
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      onHover(event, elements) {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
      onClick(event) {
        const { left, right, top, bottom } = chart.chartArea;
        if (event.x < left || event.x > right || event.y < top || event.y > bottom) {
          return;
        }

        const index = Math.round(chart.scales.x.getValueForPixel(event.x));
        const month = visibleMonths[index];
        if (!month) {
          return;
        }

        if (window.matchMedia("(pointer: coarse)").matches && activeTouchIndex !== index) {
          activeTouchIndex = index;
          chart.setActiveElements(chart.data.datasets.map((_dataset, datasetIndex) => ({ datasetIndex, index })));
          chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], {
            x: event.x,
            y: event.y
          });
          chart.update();
          return;
        }

        window.location.assign(monthUrl(month));
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: renderTooltip }
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: cssColor("--muted"), maxRotation: 0, autoSkipPadding: 18 }
        },
        y: {
          border: { display: false },
          grid: { color: cssColor("--border") },
          ticks: {
            color: cssColor("--muted"),
            callback(value) {
              return compactMoney.format(Number(value) / 100);
            }
          }
        }
      }
    }
  });

  const setRange = (count) => {
    visibleMonths = allMonths.slice(-count);
    activeTouchIndex = null;
    chart.data.labels = visibleMonths.map((month) => month.label);
    chart.data.datasets[0].data = visibleMonths.map((month) => month.incomeMinor);
    chart.data.datasets[1].data = visibleMonths.map((month) => month.expensesMinor);
    chart.data.datasets[2].data = visibleMonths.map((month) => month.netCashflowMinor);
    chart.update();

    for (const button of rangeButtons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.chartRange) === count));
    }
  };

  for (const button of rangeButtons) {
    button.addEventListener("click", () => setRange(Number(button.dataset.chartRange)));
  }

  for (const button of seriesButtons) {
    button.addEventListener("click", () => {
      const datasetIndex = chart.data.datasets.findIndex((dataset) => dataset.id === button.dataset.seriesToggle);
      if (datasetIndex < 0) {
        return;
      }

      const visible = chart.isDatasetVisible(datasetIndex);
      chart.setDatasetVisibility(datasetIndex, !visible);
      button.setAttribute("aria-pressed", String(!visible));
      chart.update();
    });
  }

  setRange(Math.min(12, allMonths.length));
}

const spendingExplorer = document.querySelector("[data-spending-explorer]");

if (spendingExplorer) {
  const tabs = Array.from(spendingExplorer.querySelectorAll("[data-spending-tab]"));
  const panels = Array.from(spendingExplorer.querySelectorAll("[data-spending-panel]"));

  const selectTab = (selectedTab) => {
    for (const tab of tabs) {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }

    for (const panel of panels) {
      panel.hidden = panel.dataset.spendingPanel !== selectedTab.dataset.spendingTab;
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextTab = tabs[(index + direction + tabs.length) % tabs.length];
      selectTab(nextTab);
      nextTab.focus();
    });
  });
}
