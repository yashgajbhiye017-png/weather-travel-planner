(() => {
  // Application State
  const state = {
    unit: localStorage.getItem("av_unit") || "C",
    theme: localStorage.getItem("av_theme") || "light",
    currentData: null,
    comparisonList: JSON.parse(localStorage.getItem("av_compare") || "[]"),
    shortlist: JSON.parse(localStorage.getItem("av_shortlist") || "[]"),
    packedState: JSON.parse(localStorage.getItem("av_packed") || "{}"),
    chartInstance: null,
    mapInstance: null,
    mapMarker: null,
  };

  // DOM References
  const dom = {
    html: document.documentElement,
    searchForm: document.getElementById("search-form"),
    locationInput: document.getElementById("location-input"),
    clearSearchBtn: document.getElementById("clear-search-btn"),
    autocompleteDropdown: document.getElementById("autocomplete-dropdown"),
    unitC: document.getElementById("unit-c"),
    unitF: document.getElementById("unit-f"),
    themeToggle: document.getElementById("theme-toggle"),
    themeIcon: document.getElementById("theme-icon"),
    errorBanner: document.getElementById("error-banner"),
    errorMessage: document.getElementById("error-message"),
    dismissErrorBtn: document.getElementById("dismiss-error-btn"),
    skeletonLoader: document.getElementById("skeleton-loader"),
    dashboardContent: document.getElementById("dashboard-content"),
    heroBanner: document.getElementById("hero-banner"),
    heroRegion: document.getElementById("hero-region"),
    heroCoords: document.getElementById("hero-coords"),
    heroCity: document.getElementById("hero-city"),
    heroCondition: document.getElementById("hero-condition"),
    heroTemp: document.getElementById("hero-temp"),
    heroFeels: document.getElementById("hero-feels"),
    heroPrecip: document.getElementById("hero-precip"),
    travelBadge: document.getElementById("travel-badge"),
    travelScore: document.getElementById("travel-score"),
    travelScoreBar: document.getElementById("travel-score-bar"),
    addCompareBtn: document.getElementById("add-compare-btn"),
    saveShortlistBtn: document.getElementById("save-shortlist-btn"),
    metricHumidity: document.getElementById("metric-humidity"),
    metricWind: document.getElementById("metric-wind"),
    metricUv: document.getElementById("metric-uv"),
    metricVisibility: document.getElementById("metric-visibility"),
    metricAqi: document.getElementById("metric-aqi"),
    metricSun: document.getElementById("metric-sun"),
    hourlyStrip: document.getElementById("hourly-strip"),
    dailyForecastGrid: document.getElementById("daily-forecast-grid"),
    activitiesList: document.getElementById("activities-list"),
    packingChecklist: document.getElementById("packing-checklist"),
    packingProgress: document.getElementById("packing-progress"),
    mapCoordsLabel: document.getElementById("map-coords-label"),
    comparisonContainer: document.getElementById("comparison-container"),
    clearCompareBtn: document.getElementById("clear-compare-btn"),
    shortlistContainer: document.getElementById("shortlist-container"),
    shortlistCount: document.getElementById("shortlist-count"),
  };

  // Temperature Conversion Helper
  function formatTemp(tempC, showUnit = false) {
    if (tempC === null || tempC === undefined) return "--";
    const val = state.unit === "F" ? (tempC * 9) / 5 + 32 : tempC;
    const rounded = Math.round(val);
    return showUnit ? `${rounded}°${state.unit}` : `${rounded}°`;
  }

  function applyTheme(theme) {
    state.theme = theme;
    dom.html.setAttribute("data-theme", theme);
    dom.themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem("av_theme", theme);
    if (state.currentData) {
      renderForecastChart(state.currentData.daily);
    }
  }

  function applyUnit(unit) {
    state.unit = unit;
    localStorage.setItem("av_unit", unit);
    dom.unitC.classList.toggle("active", unit === "C");
    dom.unitF.classList.toggle("active", unit === "F");
    if (state.currentData) {
      renderDashboard(state.currentData);
    }
    renderComparison();
  }

  function showError(msg) {
    dom.errorMessage.textContent = msg;
    dom.errorBanner.classList.remove("hidden");
  }

  function hideError() {
    dom.errorBanner.classList.add("hidden");
  }

  // Fetch Weather Data from Flask Backend
  async function loadDestinationWeather(loc) {
    hideError();
    dom.skeletonLoader.classList.remove("hidden");
    dom.dashboardContent.classList.add("hidden");

    const params = new URLSearchParams({
      lat: loc.latitude,
      lon: loc.longitude,
      name: loc.name,
      admin1: loc.admin1 || "",
      country: loc.country || "",
      elevation: loc.elevation || 0,
    });

    try {
      const response = await fetch(`/api/weather?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to retrieve destination weather.");
      }
      state.currentData = data;
      renderDashboard(data);
    } catch (err) {
      showError(err.message);
    } finally {
      dom.skeletonLoader.classList.add("hidden");
      if (state.currentData) {
        dom.dashboardContent.classList.remove("hidden");
      }
    }
  }

  // Render Complete Dashboard
  function renderDashboard(data) {
    const { location, current, daily, hourly, travel } = data;

    // Hero Banner & Theme
    dom.heroBanner.className = `hero-banner theme-${current.theme}`;
    const regionParts = [location.admin1, location.country].filter(Boolean);
    dom.heroRegion.textContent = regionParts.join(", ") || "Global Destination";
    dom.heroCoords.textContent = `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}° • Elev ${location.elevation}m`;
    dom.heroCity.textContent = location.name;
    dom.heroCondition.textContent = `${current.icon} ${current.condition}`;
    dom.heroTemp.textContent = formatTemp(current.temp_c);
    dom.heroFeels.textContent = formatTemp(current.feels_like_c, true);
    dom.heroPrecip.textContent = `${current.precip_prob}%`;

    // Travel Readiness Gauge
    dom.travelBadge.textContent = travel.badge;
    dom.travelBadge.className = `status-badge ${travel.badge_tone}`;
    dom.travelScore.textContent = travel.score;
    dom.travelScoreBar.style.width = `${travel.score}%`;

    // Save Button State
    const isSaved = state.shortlist.some(
      (item) => item.name === location.name && Math.abs(item.latitude - location.latitude) < 0.05
    );
    dom.saveShortlistBtn.textContent = isSaved ? "❤️ Saved" : "🤍 Save Trip";

    // Metrics
    dom.metricHumidity.textContent = `${current.humidity}%`;
    dom.metricWind.textContent = `${Math.round(current.wind_speed)} km/h (${current.wind_dir})`;
    dom.metricUv.textContent = `${current.uv_index}`;
    dom.metricVisibility.textContent = `${current.visibility_km} km`;
    dom.metricAqi.textContent = `${current.aqi.value} (${current.aqi.category})`;
    dom.metricSun.textContent = `${current.sunrise} / ${current.sunset}`;

    // Hourly Strip
    dom.hourlyStrip.innerHTML = hourly
      .map(
        (h) => `
        <div class="hourly-item">
          <div class="hourly-time">${h.time}</div>
          <div class="hourly-icon">${h.icon}</div>
          <div class="hourly-temp">${formatTemp(h.temp)}</div>
          <div class="hourly-rain">💧 ${h.precip_prob}%</div>
        </div>
      `
      )
      .join("");

    // 7-Day Forecast Cards
    dom.dailyForecastGrid.innerHTML = daily
      .map(
        (d) => `
        <div class="day-card">
          <div class="day-name">${d.day_name}</div>
          <div class="day-date">${d.date_label}</div>
          <div class="day-icon" title="${d.condition}">${d.icon}</div>
          <div class="day-temps">${formatTemp(d.temp_max)}<span>${formatTemp(d.temp_min)}</span></div>
          <div class="day-rain">💧 ${d.precip_prob}%</div>
        </div>
      `
      )
      .join("");

    // Sightseeing & Activities
    dom.activitiesList.innerHTML = travel.activities
      .map(
        (act) => `
        <div class="activity-item">
          <h4>${act.title}</h4>
          <p>${act.reason}</p>
        </div>
      `
      )
      .join("");

    // Packing Checklist
    renderPackingChecklist(location.name, travel.packing_list);

    // Chart & Map
    renderForecastChart(daily);
    renderMap(location);
  }

  // Interactive Packing Checklist
  function renderPackingChecklist(cityName, items) {
    const cityKey = cityName.toLowerCase();
    const cityPacked = state.packedState[cityKey] || {};

    const updateCount = () => {
      const checkedCount = items.filter((i) => cityPacked[i.id]).length;
      dom.packingProgress.textContent = `${checkedCount}/${items.length} Packed`;
    };

    dom.packingChecklist.innerHTML = items
      .map((item) => {
        const isChecked = Boolean(cityPacked[item.id]);
        return `
          <li class="packing-item ${isChecked ? "checked" : ""}" data-pack-id="${item.id}">
            <label class="packing-left">
              <input type="checkbox" ${isChecked ? "checked" : ""} />
              <span>${item.item}</span>
            </label>
            <span class="packing-cat">${item.category}</span>
          </li>
        `;
      })
      .join("");

    dom.packingChecklist.querySelectorAll(".packing-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        const id = el.getAttribute("data-pack-id");
        const checkbox = el.querySelector("input[type='checkbox']");
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        cityPacked[id] = checkbox.checked;
        state.packedState[cityKey] = cityPacked;
        localStorage.setItem("av_packed", JSON.stringify(state.packedState));
        el.classList.toggle("checked", checkbox.checked);
        updateCount();
      });
    });

    updateCount();
  }

  // Chart.js Temperature & Precipitation Chart
  function renderForecastChart(daily) {
    const ctx = document.getElementById("forecast-chart").getContext("2d");
    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    const isDark = state.theme === "dark";
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(148, 163, 184, 0.15)" : "rgba(15, 23, 42, 0.08)";

    const labels = daily.map((d) => `${d.day_name} (${d.date_label})`);
    const maxTemps = daily.map((d) =>
      Math.round(state.unit === "F" ? (d.temp_max * 9) / 5 + 32 : d.temp_max)
    );
    const minTemps = daily.map((d) =>
      Math.round(state.unit === "F" ? (d.temp_min * 9) / 5 + 32 : d.temp_min)
    );
    const rainProbs = daily.map((d) => d.precip_prob);

    state.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "line",
            label: `High (°${state.unit})`,
            data: maxTemps,
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b",
            borderWidth: 2.5,
            tension: 0.35,
            yAxisID: "y",
          },
          {
            type: "line",
            label: `Low (°${state.unit})`,
            data: minTemps,
            borderColor: "#3b82f6",
            backgroundColor: "#3b82f6",
            borderWidth: 2,
            borderDash: [4, 4],
            tension: 0.35,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Rain Chance (%)",
            data: rainProbs,
            backgroundColor: "rgba(56, 189, 248, 0.35)",
            borderRadius: 6,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: textColor, font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            type: "linear",
            position: "left",
            ticks: { color: textColor, callback: (v) => `${v}°` },
            grid: { color: gridColor },
          },
          y1: {
            type: "linear",
            position: "right",
            min: 0,
            max: 100,
            ticks: { color: textColor, callback: (v) => `${v}%` },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  // Leaflet.js Interactive Map
  function renderMap(location) {
    dom.mapCoordsLabel.textContent = `${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E`;

    if (!state.mapInstance) {
      state.mapInstance = L.map("destination-map").setView([location.latitude, location.longitude], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(state.mapInstance);
      state.mapMarker = L.marker([location.latitude, location.longitude]).addTo(state.mapInstance);
    } else {
      state.mapInstance.setView([location.latitude, location.longitude], 11);
      state.mapMarker.setLatLng([location.latitude, location.longitude]);
    }

    state.mapMarker
      .bindPopup(`<strong>${location.name}</strong><br/>Elev: ${location.elevation}m`)
      .openPopup();

    setTimeout(() => state.mapInstance.invalidateSize(), 150);
  }

  // Side-by-Side Trip Comparison
  function addToComparison() {
    if (!state.currentData) return;
    const { location, current, travel } = state.currentData;

    const exists = state.comparisonList.some(
      (c) => c.name === location.name && Math.abs(c.latitude - location.latitude) < 0.05
    );
    if (exists) {
      showError(`${location.name} is already in your comparison table.`);
      return;
    }
    if (state.comparisonList.length >= 3) {
      state.comparisonList.shift();
    }

    state.comparisonList.push({
      name: location.name,
      region: [location.admin1, location.country].filter(Boolean).join(", "),
      latitude: location.latitude,
      longitude: location.longitude,
      elevation: location.elevation,
      temp_c: current.temp_c,
      icon: current.icon,
      condition: current.condition,
      precip_prob: current.precip_prob,
      aqi: current.aqi.value,
      score: travel.score,
      badge: travel.badge,
    });

    localStorage.setItem("av_compare", JSON.stringify(state.comparisonList));
    renderComparison();
  }

  function renderComparison() {
    if (state.comparisonList.length === 0) {
      dom.comparisonContainer.innerHTML =
        '<p class="empty-state">No destinations added yet. Search Manali, Munnar, or Jaipur and click <strong>⚖️ Compare</strong>.</p>';
      return;
    }

    dom.comparisonContainer.innerHTML = state.comparisonList
      .map(
        (c, idx) => `
        <div class="compare-card">
          <button class="compare-remove" data-idx="${idx}" title="Remove">✕</button>
          <div class="compare-city">${c.icon} ${c.name}</div>
          <div class="compare-country">${c.region} • ${c.elevation}m</div>
          <div class="compare-stats">
            <div><strong>Temp:</strong> ${formatTemp(c.temp_c, true)} (${c.condition})</div>
            <div><strong>Rain Chance:</strong> ${c.precip_prob}%</div>
            <div><strong>Air Quality:</strong> US AQI ${c.aqi}</div>
            <div><strong>Readiness:</strong> ${c.score}/100 (${c.badge})</div>
          </div>
        </div>
      `
      )
      .join("");

    dom.comparisonContainer.querySelectorAll(".compare-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-idx"));
        state.comparisonList.splice(idx, 1);
        localStorage.setItem("av_compare", JSON.stringify(state.comparisonList));
        renderComparison();
      });
    });
  }

  // Saved Trip Shortlist
  function toggleShortlist() {
    if (!state.currentData) return;
    const { location, current } = state.currentData;
    const existingIdx = state.shortlist.findIndex(
      (item) => item.name === location.name && Math.abs(item.latitude - location.latitude) < 0.05
    );

    if (existingIdx > -1) {
      state.shortlist.splice(existingIdx, 1);
    } else {
      state.shortlist.unshift({
        name: location.name,
        admin1: location.admin1,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        icon: current.icon,
      });
    }

    localStorage.setItem("av_shortlist", JSON.stringify(state.shortlist));
    renderShortlist();
    renderDashboard(state.currentData);
  }

  function renderShortlist() {
    dom.shortlistCount.textContent = `${state.shortlist.length} Saved`;
    if (state.shortlist.length === 0) {
      dom.shortlistContainer.innerHTML =
        '<p class="empty-state">Click <strong>🤍 Save Trip</strong> on any destination to build your shortlist.</p>';
      return;
    }

    dom.shortlistContainer.innerHTML = state.shortlist
      .map(
        (item, idx) => `
        <div class="shortlist-item">
          <div class="shortlist-info" data-idx="${idx}">
            <strong>${item.icon || "📍"} ${item.name}</strong>
            <span>${[item.admin1, item.country].filter(Boolean).join(", ")}</span>
          </div>
          <button class="icon-btn remove-shortlist-btn" data-idx="${idx}" title="Remove">✕</button>
        </div>
      `
      )
      .join("");

    dom.shortlistContainer.querySelectorAll(".shortlist-info").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.getAttribute("data-idx"));
        loadDestinationWeather(state.shortlist[idx]);
      });
    });

    dom.shortlistContainer.querySelectorAll(".remove-shortlist-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-idx"));
        state.shortlist.splice(idx, 1);
        localStorage.setItem("av_shortlist", JSON.stringify(state.shortlist));
        renderShortlist();
        if (state.currentData) renderDashboard(state.currentData);
      });
    });
  }

  // Autocomplete Search with Debounce
  let debounceTimer = null;
  async function fetchAutocomplete(query) {
    if (query.trim().length < 2) {
      dom.autocompleteDropdown.classList.add("hidden");
      return;
    }

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search error");

      const results = data.results || [];
      if (results.length === 0) {
        dom.autocompleteDropdown.innerHTML =
          '<div class="autocomplete-item"><span class="ac-sub">No matching cities or towns found.</span></div>';
        dom.autocompleteDropdown.classList.remove("hidden");
        return;
      }

      dom.autocompleteDropdown.innerHTML = results
        .map(
          (r, i) => `
          <div class="autocomplete-item" data-res-idx="${i}">
            <div>
              <div class="ac-main">${r.name}</div>
              <div class="ac-sub">${[r.admin1, r.country].filter(Boolean).join(", ")}</div>
            </div>
            <div class="ac-meta">
              <div>${r.latitude.toFixed(2)}°, ${r.longitude.toFixed(2)}°</div>
              <div>Elev ${Math.round(r.elevation || 0)}m</div>
            </div>
          </div>
        `
        )
        .join("");

      dom.autocompleteDropdown.querySelectorAll(".autocomplete-item").forEach((itemEl) => {
        itemEl.addEventListener("click", () => {
          const idx = Number(itemEl.getAttribute("data-res-idx"));
          const chosen = results[idx];
          dom.locationInput.value = `${chosen.name}, ${chosen.country}`;
          dom.autocompleteDropdown.classList.add("hidden");
          loadDestinationWeather(chosen);
        });
      });

      dom.autocompleteDropdown.classList.remove("hidden");
    } catch (err) {
      showError(err.message);
    }
  }

  // Event Listeners
  dom.locationInput.addEventListener("input", (e) => {
    const val = e.target.value;
    dom.clearSearchBtn.classList.toggle("hidden", val.length === 0);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchAutocomplete(val), 280);
  });

  dom.clearSearchBtn.addEventListener("click", () => {
    dom.locationInput.value = "";
    dom.clearSearchBtn.classList.add("hidden");
    dom.autocompleteDropdown.classList.add("hidden");
    dom.locationInput.focus();
  });

  dom.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = dom.locationInput.value.trim();
    if (!q) {
      showError("Please enter a city, hill station, or town name.");
      return;
    }
    dom.autocompleteDropdown.classList.add("hidden");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        showError(`Could not find "${q}". Try another town or check spelling.`);
        return;
      }
      loadDestinationWeather(data.results[0]);
    } catch (err) {
      showError("Network error while searching location.");
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      dom.autocompleteDropdown.classList.add("hidden");
    }
  });

  document.querySelectorAll(".dest-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      loadDestinationWeather({
        name: chip.dataset.name,
        admin1: chip.dataset.admin1,
        country: chip.dataset.country,
        latitude: parseFloat(chip.dataset.lat),
        longitude: parseFloat(chip.dataset.lon),
        elevation: parseFloat(chip.dataset.elev || "0"),
      });
    });
  });

  dom.unitC.addEventListener("click", () => applyUnit("C"));
  dom.unitF.addEventListener("click", () => applyUnit("F"));
  dom.themeToggle.addEventListener("click", () =>
    applyTheme(state.theme === "light" ? "dark" : "light")
  );
  dom.dismissErrorBtn.addEventListener("click", hideError);
  dom.addCompareBtn.addEventListener("click", addToComparison);
  dom.clearCompareBtn.addEventListener("click", () => {
    state.comparisonList = [];
    localStorage.removeItem("av_compare");
    renderComparison();
  });
  dom.saveShortlistBtn.addEventListener("click", toggleShortlist);

  // Initialize App State & Default Load (Pune, India)
  applyTheme(state.theme);
  dom.unitC.classList.toggle("active", state.unit === "C");
  dom.unitF.classList.toggle("active", state.unit === "F");
  renderComparison();
  renderShortlist();

  loadDestinationWeather({
    name: "Pune",
    admin1: "Maharashtra",
    country: "India",
    latitude: 18.5204,
    longitude: 73.8567,
    elevation: 560,
  });
})();