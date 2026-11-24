# AeroVoyage — Weather Forecasting & Travel Planner

A full-stack **Weather Forecasting & Travel Planner** built with **Python (Flask)** and modern **HTML5, CSS3, and Vanilla JavaScript**. Powered by the **Open-Meteo Geocoding, Weather Forecast, and Air Quality APIs**, it provides instant, zero-API-key coverage for every city, district, and hill station in India as well as global travel hubs.

## Key Features
- **Zero-Friction Global & All-India Search:** Debounced autocomplete with disambiguation showing State/Province, Country, Elevation, and Coordinates.
- **Real-Time Weather & 7-Day + 24-Hour Forecasts:** Live temperature (`°C`/`°F`), "Feels Like", Humidity, Wind speed & direction, UV Index, Visibility, US AQI, Sunrise/Sunset, and interactive **Chart.js** temperature/rain visualizations.
- **Python Travel Readiness Engine:** Computes a **0–100 Travel Comfort Score**, condition badges, tailored sightseeing/activity suggestions, and an interactive, checkable **Smart Packing Checklist** saved in `localStorage`.
- **Multi-Destination Comparison & Trip Shortlist:** Compare up to 3 destinations side-by-side and bookmark favorite trips locally.
- **Interactive Terrain Map:** Built with **Leaflet.js** and OpenStreetMap tiles.

## Setup & Run Instructions

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate      # On Windows: venv\Scripts\activate