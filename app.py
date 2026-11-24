from datetime import datetime
from typing import Any, Dict, List, Optional
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

WMO_WEATHER_MAP: Dict[int, Dict[str, str]] = {
    0: {"label": "Clear Sky", "icon": "☀️", "theme": "sunny"},
    1: {"label": "Mainly Clear", "icon": "🌤️", "theme": "sunny"},
    2: {"label": "Partly Cloudy", "icon": "⛅", "theme": "cloudy"},
    3: {"label": "Overcast", "icon": "☁️", "theme": "cloudy"},
    45: {"label": "Foggy", "icon": "🌫️", "theme": "cloudy"},
    48: {"label": "Depositing Rime Fog", "icon": "🌫️", "theme": "cloudy"},
    51: {"label": "Light Drizzle", "icon": "🌦️", "theme": "rainy"},
    53: {"label": "Moderate Drizzle", "icon": "🌦️", "theme": "rainy"},
    55: {"label": "Dense Drizzle", "icon": "🌧️", "theme": "rainy"},
    56: {"label": "Light Freezing Drizzle", "icon": "🌧️", "theme": "snowy"},
    57: {"label": "Dense Freezing Drizzle", "icon": "🌧️", "theme": "snowy"},
    61: {"label": "Slight Rain", "icon": "🌦️", "theme": "rainy"},
    63: {"label": "Moderate Rain", "icon": "🌧️", "theme": "rainy"},
    65: {"label": "Heavy Rain", "icon": "⛈️", "theme": "rainy"},
    66: {"label": "Light Freezing Rain", "icon": "🌨️", "theme": "snowy"},
    67: {"label": "Heavy Freezing Rain", "icon": "🌨️", "theme": "snowy"},
    71: {"label": "Slight Snowfall", "icon": "🌨️", "theme": "snowy"},
    73: {"label": "Moderate Snowfall", "icon": "❄️", "theme": "snowy"},
    75: {"label": "Heavy Snowfall", "icon": "❄️", "theme": "snowy"},
    77: {"label": "Snow Grains", "icon": "❄️", "theme": "snowy"},
    80: {"label": "Slight Rain Showers", "icon": "🌦️", "theme": "rainy"},
    81: {"label": "Moderate Rain Showers", "icon": "🌧️", "theme": "rainy"},
    82: {"label": "Violent Rain Showers", "icon": "⛈️", "theme": "rainy"},
    85: {"label": "Slight Snow Showers", "icon": "🌨️", "theme": "snowy"},
    86: {"label": "Heavy Snow Showers", "icon": "❄️", "theme": "snowy"},
    95: {"label": "Thunderstorm", "icon": "⛈️", "theme": "rainy"},
    96: {"label": "Thunderstorm with Slight Hail", "icon": "⛈️", "theme": "rainy"},
    99: {"label": "Thunderstorm with Heavy Hail", "icon": "⛈️", "theme": "rainy"},
}


def decode_weather_code(code: int, is_day: int = 1) -> Dict[str, str]:
    info = WMO_WEATHER_MAP.get(code, {"label": "Variable Conditions", "icon": "🌡️", "theme": "cloudy"}).copy()
    if is_day == 0:
        if code in (0, 1):
            info["icon"] = "🌙"
        info["theme"] = "night"
    return info


def degrees_to_compass(deg: Optional[float]) -> str:
    if deg is None:
        return "N/A"
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(deg / 22.5) % 16
    return directions[idx]


def classify_aqi(us_aqi: Optional[float]) -> Dict[str, str]:
    if us_aqi is None:
        return {"value": "N/A", "category": "Unavailable", "level": "neutral"}
    val = int(round(us_aqi))
    if val <= 50:
        return {"value": str(val), "category": "Good", "level": "good"}
    if val <= 100:
        return {"value": str(val), "category": "Moderate", "level": "moderate"}
    if val <= 150:
        return {"value": str(val), "category": "Sensitive Groups", "level": "warning"}
    if val <= 200:
        return {"value": str(val), "category": "Unhealthy", "level": "danger"}
    return {"value": str(val), "category": "Very Unhealthy", "level": "danger"}


def evaluate_travel_intelligence(
    temp_c: float,
    apparent_temp_c: float,
    precip_prob: float,
    wind_kmh: float,
    uv_index: float,
    aqi: Optional[float],
    weather_code: int,
    elevation: float,
) -> Dict[str, Any]:
    score = 100.0
    advisories: List[str] = []

    if temp_c > 35:
        score -= min(35, (temp_c - 30) * 3.0)
        advisories.append("Extreme Heat Advisory")
    elif temp_c > 29:
        score -= (temp_c - 27) * 2.0
        advisories.append("Warm & Sunny Conditions")
    elif temp_c < 2:
        score -= min(35, (10 - temp_c) * 2.5)
        advisories.append("Freezing / Cold Weather Prep")
    elif temp_c < 12:
        score -= (16 - temp_c) * 1.5
        advisories.append("Chilly Weather Prep")

    if weather_code in (95, 96, 99) or precip_prob >= 75:
        score -= 30
        advisories.append("Heavy Rain / Storm Alert")
    elif precip_prob >= 40 or weather_code in (51, 53, 55, 61, 63, 80, 81):
        score -= 18
        advisories.append("Pack Rain Gear")
    elif precip_prob >= 20:
        score -= 6

    if wind_kmh >= 45:
        score -= 22
        advisories.append("High Wind Alert")
    elif wind_kmh >= 30:
        score -= 10

    if uv_index >= 8:
        score -= 8
    elif uv_index >= 6:
        score -= 4

    if aqi is not None:
        if aqi > 150:
            score -= 20
            advisories.append("Poor Air Quality Alert")
        elif aqi > 100:
            score -= 8

    final_score = max(10, min(100, int(round(score))))

    if not advisories:
        if final_score >= 80:
            primary_badge = "Ideal for Sightseeing"
            badge_tone = "optimal"
        else:
            primary_badge = "Pleasant Travel Window"
            badge_tone = "good"
    else:
        primary_badge = advisories[0]
        badge_tone = "danger" if any(k in primary_badge for k in ["Storm", "Extreme", "High Wind", "Poor Air"]) else "warning"

    activities: List[Dict[str, str]] = []
    is_rainy_or_stormy = precip_prob >= 45 or weather_code in (61, 63, 65, 80, 81, 82, 95, 96, 99)
    is_snowy = weather_code in (71, 73, 75, 77, 85, 86) or temp_c <= 1

    if is_rainy_or_stormy:
        activities.extend([
            {"title": "Museums, Galleries & Indoor Heritage", "reason": f"{int(precip_prob)}% rain chance favors sheltered cultural exploration."},
            {"title": "Local Culinary & Café Hopping", "reason": "Stay dry while sampling regional cuisine and specialty coffee/tea."},
            {"title": "Scenic Train / Covered City Tour", "reason": "Enjoy misty landscapes comfortably without getting soaked."},
        ])
    elif is_snowy:
        activities.extend([
            {"title": "Winter Photography & Snow Viewpoints", "reason": "Crisp alpine scenery ideal for short daytime photo walks."},
            {"title": "Cozy Fireside Lounges & Hot Springs", "reason": f"Temperatures around {round(temp_c)}°C make warm indoor retreats essential."},
            {"title": "Guided Snow Trails (If Roads Clear)", "reason": "Check local pass advisories before embarking on mountain drives."},
        ])
    elif temp_c >= 33:
        activities.extend([
            {"title": "Sunrise Heritage Walks (6 AM – 9 AM)", "reason": "Beat midday peak heat before temperatures climb past 33°C."},
            {"title": "Air-Conditioned Palaces & Museums", "reason": "Reserve 12 PM – 4 PM for shaded or indoor attractions."},
            {"title": "Evening Waterfront / Night Markets", "reason": "Pleasant post-sunset breeze for street food and strolls."},
        ])
    else:
        if elevation >= 1200:
            activities.append({"title": "Mountain Ridge Trekking & Panoramic Passes", "reason": f"High elevation ({int(elevation)}m) with clear visibility and crisp air."})
        else:
            activities.append({"title": "Full-Day Heritage Walks & Architecture Tours", "reason": f"Comfortable {round(temp_c)}°C weather is ideal for walking tours."})
        activities.extend([
            {"title": "Outdoor Botanical Gardens & Viewpoints", "reason": "Low precipitation risk and balanced daylight conditions."},
            {"title": "Scenic Highway Road Trip / Sunset Cruise", "reason": "Smooth visibility and calm winds support open-air transit."},
        ])

    packing_list: List[Dict[str, str]] = [
        {"id": "docs", "item": "ID / Passport, Digital Tickets & Offline Maps", "category": "Essentials"},
        {"id": "shoes", "item": "Comfortable Broken-In Walking Shoes", "category": "Footwear"},
    ]

    if precip_prob >= 40 or is_rainy_or_stormy:
        packing_list.extend([
            {"id": "rain_jacket", "item": "Waterproof Hooded Rain Jacket / Poncho", "category": "Weather Gear"},
            {"id": "umbrella", "item": "Compact Windproof Travel Umbrella", "category": "Weather Gear"},
            {"id": "dry_bag", "item": "Waterproof Pouch for Electronics & Documents", "category": "Accessories"},
        ])

    if temp_c < 10 or apparent_temp_c < 8:
        packing_list.extend([
            {"id": "thermals", "item": "Thermal Base Layers & Fleece Pullover", "category": "Apparel"},
            {"id": "heavy_jacket", "item": "Insulated Down / Windbreaker Jacket", "category": "Apparel"},
            {"id": "winter_acc", "item": "Woolen Beanie, Gloves & Lip Balm", "category": "Accessories"},
        ])
    elif 10 <= temp_c <= 19:
        packing_list.append(
            {"id": "light_layer", "item": "Light Cardigan, Denim Jacket or Hoodie (Evening Chill)", "category": "Apparel"}
        )
    else:
        packing_list.append(
            {"id": "breathable", "item": "Breathable Cotton / Linen Outfits", "category": "Apparel"}
        )

    if uv_index >= 6 or temp_c >= 30:
        packing_list.extend([
            {"id": "sunscreen", "item": "Broad-Spectrum SPF 50+ Sunscreen & Sunglasses", "category": "Sun & Health"},
            {"id": "hydration", "item": "Insulated Water Bottle & Electrolyte Sachets", "category": "Sun & Health"},
            {"id": "hat", "item": "Wide-Brim Sun Hat or Cap", "category": "Accessories"},
        ])

    if aqi is not None and aqi > 120:
        packing_list.append(
            {"id": "mask", "item": "N95 / KN95 Respirator Masks (Elevated AQI)", "category": "Sun & Health"}
        )

    if elevation >= 1800:
        packing_list.append(
            {"id": "altitude", "item": "Motion/Altitude Sickness Tablets & Moisturizer", "category": "Sun & Health"}
        )

    return {
        "score": final_score,
        "badge": primary_badge,
        "badge_tone": badge_tone,
        "advisories": advisories if advisories else ["Clear & Balanced Travel Conditions"],
        "activities": activities,
        "packing_list": packing_list,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/process-weather", methods=["POST"])
def process_weather():
    """Processes raw Open-Meteo payloads fetched client-side to avoid shared-IP rate limits."""
    try:
        body = request.get_json(force=True)
        loc = body.get("location", {})
        w_data = body.get("weather", {})
        aq_data = body.get("air_quality") or {}

        current = w_data.get("current", {})
        daily = w_data.get("daily", {})
        hourly = w_data.get("hourly", {})
        elevation = w_data.get("elevation", loc.get("elevation", 0)) or 0

        aq_current = aq_data.get("current", {})
        us_aqi = aq_current.get("us_aqi")
        pm2_5 = aq_current.get("pm2_5")

        code = int(current.get("weather_code", 0))
        is_day = int(current.get("is_day", 1))
        decoded_current = decode_weather_code(code, is_day)

        today_uv_max = (daily.get("uv_index_max") or [0])[0] or 0
        today_precip_prob = (daily.get("precipitation_probability_max") or [0])[0] or 0
        visibility_km = round((current.get("visibility") or 10000) / 1000, 1)

        travel_intel = evaluate_travel_intelligence(
            temp_c=float(current.get("temperature_2m", 22)),
            apparent_temp_c=float(current.get("apparent_temperature", 22)),
            precip_prob=float(today_precip_prob),
            wind_kmh=float(current.get("wind_speed_10m", 10)),
            uv_index=float(today_uv_max),
            aqi=us_aqi,
            weather_code=code,
            elevation=float(elevation),
        )

        daily_list = []
        dates = daily.get("time", [])
        for i, date_str in enumerate(dates):
            d_code = int((daily.get("weather_code") or [0])[i])
            d_decoded = decode_weather_code(d_code, 1)
            dt_obj = datetime.strptime(date_str, "%Y-%m-%d")
            daily_list.append({
                "date": date_str,
                "day_name": "Today" if i == 0 else dt_obj.strftime("%a"),
                "date_label": dt_obj.strftime("%b %d"),
                "condition": d_decoded["label"],
                "icon": d_decoded["icon"],
                "temp_max": daily["temperature_2m_max"][i],
                "temp_min": daily["temperature_2m_min"][i],
                "precip_prob": daily["precipitation_probability_max"][i] or 0,
                "precip_sum": daily["precipitation_sum"][i] or 0,
                "uv_max": daily["uv_index_max"][i] or 0,
                "wind_max": daily["wind_speed_10m_max"][i] or 0,
                "sunrise": daily["sunrise"][i].split("T")[1] if "T" in daily["sunrise"][i] else daily["sunrise"][i],
                "sunset": daily["sunset"][i].split("T")[1] if "T" in daily["sunset"][i] else daily["sunset"][i],
            })

        hourly_list = []
        h_times = hourly.get("time", [])
        current_time_str = current.get("time", "")
        start_idx = 0
        if current_time_str and len(current_time_str) >= 13:
            prefix = current_time_str[:13]
            for idx, t in enumerate(h_times):
                if t.startswith(prefix):
                    start_idx = idx
                    break

        for idx in range(start_idx, min(start_idx + 24, len(h_times))):
            h_code = int(hourly["weather_code"][idx])
            h_decoded = decode_weather_code(h_code, 1)
            hourly_list.append({
                "time": h_times[idx].split("T")[1],
                "temp": hourly["temperature_2m"][idx],
                "precip_prob": hourly["precipitation_probability"][idx] or 0,
                "icon": h_decoded["icon"],
                "condition": h_decoded["label"],
            })

        return jsonify({
            "location": {
                "name": loc.get("name", "Selected Destination"),
                "admin1": loc.get("admin1", ""),
                "country": loc.get("country", ""),
                "latitude": float(loc.get("latitude", 0)),
                "longitude": float(loc.get("longitude", 0)),
                "elevation": round(elevation),
                "timezone": w_data.get("timezone", ""),
            },
            "current": {
                "temp_c": current.get("temperature_2m"),
                "feels_like_c": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "wind_speed": current.get("wind_speed_10m"),
                "wind_dir": degrees_to_compass(current.get("wind_direction_10m")),
                "uv_index": today_uv_max,
                "visibility_km": visibility_km,
                "precip_prob": today_precip_prob,
                "condition": decoded_current["label"],
                "icon": decoded_current["icon"],
                "theme": decoded_current["theme"],
                "is_day": is_day,
                "sunrise": daily_list[0]["sunrise"] if daily_list else "N/A",
                "sunset": daily_list[0]["sunset"] if daily_list else "N/A",
                "aqi": classify_aqi(us_aqi),
                "pm2_5": pm2_5,
            },
            "daily": daily_list,
            "hourly": hourly_list,
            "travel": travel_intel,
        })
    except Exception as exc:
        return jsonify({"error": f"Failed to process weather intelligence: {str(exc)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)