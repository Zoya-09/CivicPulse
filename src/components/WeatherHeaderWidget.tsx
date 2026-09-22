import React, { useState } from 'react';
import {
  CloudRain,
  CloudLightning,
  Sun,
  Cloud,
  Droplets,
  Wind,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  MapPin,
  Search,
  Check,
  Compass
} from 'lucide-react';
import {
  CityWeatherData,
  MONITORED_INDIAN_CITIES,
  IndianCityWeatherConfig
} from '../services/weatherService';

interface WeatherHeaderWidgetProps {
  activeWeather: CityWeatherData | null;
  allCitiesWeather: CityWeatherData[];
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onSimulateSevereRain?: () => void;
  onResetToLiveWeather?: () => void;
  isSimulated?: boolean;
  isDisasterMode: boolean;
}

export const WeatherHeaderWidget: React.FC<WeatherHeaderWidgetProps> = ({
  activeWeather,
  allCitiesWeather,
  selectedCityId,
  onSelectCity,
  isLoading,
  onRefresh,
  onSimulateSevereRain,
  onResetToLiveWeather,
  isSimulated = false,
  isDisasterMode
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [activeTab, setActiveTab] = useState<'city_detail' | 'pan_india_grid'>('city_detail');
  const [citySearchQuery, setCitySearchQuery] = useState('');

  if (!activeWeather && isLoading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-600 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-400" />
        <span className="hidden xl:inline text-stone-500 font-medium">India Weather:</span>
        <span className="font-mono text-[11px]">Syncing live...</span>
      </div>
    );
  }

  if (!activeWeather) return null;

  // Determine badge styling based on severeRainRisk
  const isSevere = activeWeather.severeRainRisk === 'CRITICAL_MONSOON' || activeWeather.severeRainRisk === 'HIGH';
  const isElevated = activeWeather.severeRainRisk === 'ELEVATED';

  // Any city in India currently having high-risk rain?
  const severeCitiesInIndia = allCitiesWeather.filter(
    (c) => c.severeRainRisk === 'HIGH' || c.severeRainRisk === 'CRITICAL_MONSOON'
  );

  let badgeBorderClass = 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100';
  let statusText = 'Fair / Dry';
  let StatusIcon = Sun;

  if (activeWeather.severeRainRisk === 'CRITICAL_MONSOON') {
    badgeBorderClass = 'border-red-400 bg-red-50 text-red-950 font-bold';
    statusText = 'MONSOON FLOOD RISK';
    StatusIcon = CloudLightning;
  } else if (activeWeather.severeRainRisk === 'HIGH') {
    badgeBorderClass = 'border-amber-400 bg-amber-50 text-amber-950 font-bold';
    statusText = 'HEAVY RAIN ALERT';
    StatusIcon = CloudRain;
  } else if (isElevated) {
    badgeBorderClass = 'border-sky-300 bg-sky-50 text-sky-900';
    statusText = 'RAIN IN VICINITY';
    StatusIcon = Droplets;
  } else {
    statusText = activeWeather.isRaining ? 'Light Rain' : 'Dry / Fair';
    StatusIcon = activeWeather.weatherCode >= 3 ? Cloud : Sun;
  }

  // City Short Display Tag
  const cityShortTag =
    activeWeather.cityId === 'bengaluru'
      ? 'BLR'
      : activeWeather.cityId === 'delhi'
      ? 'DEL'
      : activeWeather.cityId === 'mumbai'
      ? 'BOM'
      : activeWeather.cityId === 'chennai'
      ? 'MAA'
      : activeWeather.cityId === 'kolkata'
      ? 'CCU'
      : activeWeather.cityId === 'hyderabad'
      ? 'HYD'
      : activeWeather.cityId === 'ahmedabad'
      ? 'AMD'
      : activeWeather.cityId === 'lucknow'
      ? 'LKO'
      : activeWeather.cityName.slice(0, 3).toUpperCase();

  // Filter cities for search
  const filteredCities = allCitiesWeather.filter((c) => {
    const q = citySearchQuery.toLowerCase();
    return c.cityName.toLowerCase().includes(q) || c.state.toLowerCase().includes(q);
  });

  return (
    <div className="relative">
      <button
        id="btn-weather-header-popover"
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all shadow-2xs ${badgeBorderClass}`}
        title={`Real-Time Open-Meteo Weather for ${activeWeather.cityName}, ${activeWeather.state}: ${activeWeather.weatherDescription}, ${activeWeather.precipitationMm} mm/h rain, ${activeWeather.currentPrecipProbability}% rain probability`}
      >
        <div className="flex items-center gap-1.5">
          <StatusIcon
            className={`w-3.5 h-3.5 ${
              isSevere
                ? 'text-red-600 animate-pulse'
                : isElevated
                ? 'text-sky-600'
                : 'text-amber-500'
            }`}
          />
          <span className="font-semibold text-stone-700">{cityShortTag}:</span>
          <span className="font-mono font-bold text-stone-900">{activeWeather.temperatureC}°C</span>
        </div>

        {/* Rain metric pill */}
        <div className="flex items-center gap-1 text-[11px] font-mono border-l border-stone-300/60 pl-1.5">
          <Droplets className={`w-3 h-3 ${activeWeather.precipitationMm > 0 ? 'text-sky-600' : 'text-stone-400'}`} />
          <span>
            {activeWeather.precipitationMm > 0
              ? `${activeWeather.precipitationMm}mm`
              : `${activeWeather.currentPrecipProbability}%`}
          </span>
        </div>

        {/* Severe status chip */}
        {isSevere && (
          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-600 text-white animate-pulse">
            <AlertTriangle className="w-2.5 h-2.5" />
            HIGH RAIN
          </span>
        )}

        {/* National Alert indicator if another state in India has heavy rain */}
        {!isSevere && severeCitiesInIndia.length > 0 && (
          <span
            className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300"
            title={`${severeCitiesInIndia.map((c) => c.cityName).join(', ')} has high rain alert`}
          >
            <CloudLightning className="w-2.5 h-2.5 text-amber-700" />
            {severeCitiesInIndia.length} State Alert
          </span>
        )}

        {isSimulated && (
          <span className="text-[9.5px] font-mono bg-purple-100 text-purple-800 px-1 py-0.2 rounded border border-purple-200">
            TEST
          </span>
        )}

        <ChevronDown className="w-3 h-3 text-stone-400" />
      </button>

      {/* Popover detailed weather modal / dropdown */}
      {showPopover && (
        <div
          id="popover-weather-details"
          className="absolute right-0 mt-2 w-[340px] sm:w-[420px] bg-white border border-stone-200 rounded-xl p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 text-stone-900"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-sky-600" />
              <div>
                <span className="text-xs font-bold text-stone-900 block leading-tight">
                  Pan-India Live Meteorological Radar
                </span>
                <span className="text-[10.5px] text-stone-500">
                  Open-Meteo Ground Truth Telemetry (All States)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onRefresh()}
                disabled={isLoading}
                className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-800 transition-colors"
                title="Refresh Live Telemetry from Open-Meteo API"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowPopover(false)}
                className="text-stone-400 hover:text-stone-700 text-xs px-1.5 py-0.5 rounded hover:bg-stone-100"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Sub-tab Navigation: Focus City vs Pan-India States Grid */}
          <div className="flex rounded-lg bg-stone-100 p-1 mb-3 text-xs">
            <button
              onClick={() => setActiveTab('city_detail')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-all text-center ${
                activeTab === 'city_detail'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Focused City ({activeWeather.cityName})
            </button>
            <button
              onClick={() => setActiveTab('pan_india_grid')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-all text-center flex items-center justify-center gap-1.5 ${
                activeTab === 'pan_india_grid'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>All 15 Indian Locations</span>
              {severeCitiesInIndia.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>

          {/* VIEW 1: ACTIVE CITY DETAILED REAL-TIME METRICS */}
          {activeTab === 'city_detail' && (
            <div className="space-y-3">
              {/* City Switcher dropdown */}
              <div className="flex items-center justify-between gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span className="text-[11px] text-stone-500 shrink-0">Selected Location:</span>
                  <select
                    value={selectedCityId}
                    onChange={(e) => onSelectCity(e.target.value)}
                    className="text-xs font-bold text-stone-900 bg-transparent border-none focus:outline-none cursor-pointer truncate"
                  >
                    {MONITORED_INDIAN_CITIES.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name} ({city.state})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] font-semibold text-stone-500 px-1.5 py-0.5 rounded bg-white border border-stone-200 shrink-0">
                  {activeWeather.region} India
                </span>
              </div>

              {/* Sky Condition Banner */}
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <div className="text-[11px] text-stone-500 font-medium">Current Sky & Weather</div>
                  <div className="font-bold text-stone-900 text-sm mt-0.5 flex items-center gap-1.5">
                    <StatusIcon className="w-4 h-4 text-stone-700" />
                    <span>{activeWeather.weatherDescription}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-stone-500 font-medium">Risk Assessment</div>
                  <div
                    className={`font-extrabold text-xs mt-0.5 ${
                      isSevere ? 'text-red-600' : isElevated ? 'text-sky-700' : 'text-emerald-700'
                    }`}
                  >
                    {statusText}
                  </div>
                </div>
              </div>

              {/* Real-time Meteorological 4-Metric Grid */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-[10px] text-stone-500 block">Temperature</span>
                  <span className="font-mono font-bold text-stone-900 text-xs">
                    {activeWeather.temperatureC}°C
                  </span>
                </div>
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-[10px] text-stone-500 block">Precipitation</span>
                  <span className="font-mono font-bold text-stone-900 text-xs">
                    {activeWeather.precipitationMm} mm/h
                  </span>
                </div>
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-[10px] text-stone-500 block">Rain Chance</span>
                  <span className="font-mono font-bold text-stone-900 text-xs">
                    {activeWeather.currentPrecipProbability}%
                  </span>
                </div>
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-[10px] text-stone-500 block">Humidity</span>
                  <span className="font-mono font-bold text-stone-900 text-xs">
                    {activeWeather.humidity}%
                  </span>
                </div>
              </div>

              {/* Real Upcoming Hourly Forecast Strip */}
              {activeWeather.hourlyForecast && activeWeather.hourlyForecast.length > 0 && (
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-stone-600">
                      Real-Time Hourly Rain Forecast
                    </span>
                    <span className="text-[10px] text-stone-500">Next 4 Hours</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {activeWeather.hourlyForecast.slice(0, 4).map((hour, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 bg-white rounded border border-stone-200 flex flex-col items-center"
                      >
                        <span className="text-[10px] font-mono text-stone-500">{hour.timeStr}</span>
                        <span
                          className={`text-[11px] font-bold font-mono mt-0.5 ${
                            hour.precipitationProbability >= 60
                              ? 'text-sky-700'
                              : hour.precipitationProbability >= 20
                              ? 'text-stone-800'
                              : 'text-stone-500'
                          }`}
                        >
                          {hour.precipitationProbability}%
                        </span>
                        <span className="text-[9px] font-mono text-stone-400">
                          {hour.precipitationMm > 0 ? `${hour.precipitationMm}mm` : '0 mm'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-Trigger Threshold Explainer */}
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-950 leading-relaxed">
                <div className="font-bold flex items-center gap-1 text-amber-900 mb-0.5">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>Automated Disaster Triage Rules</span>
                </div>
                Disaster Mode activates when live precipitation reaches{' '}
                <strong className="font-mono">&ge; 7.5 mm/h</strong>, thunderstorms strike, or imminent
                downpour probability hits <strong className="font-mono">&gt; 80%</strong>. Currently,{' '}
                {activeWeather.cityName} is at <strong className="font-mono">{activeWeather.precipitationMm} mm/h</strong> with a{' '}
                <strong className="font-mono">{activeWeather.currentPrecipProbability}%</strong> rain probability (Status: {statusText}).
              </div>
            </div>
          )}

          {/* VIEW 2: PAN-INDIA MULTI-STATE LIVE RADAR GRID */}
          {activeTab === 'pan_india_grid' && (
            <div className="space-y-2.5">
              {/* Search Indian Cities & States */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search city or state (e.g. Karnataka, Delhi, Bengal)..."
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              {/* Scrollable list of 15 Indian locations */}
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {filteredCities.map((city) => {
                  const isSelected = city.cityId === selectedCityId;
                  const isCitySevere =
                    city.severeRainRisk === 'CRITICAL_MONSOON' || city.severeRainRisk === 'HIGH';
                  const isCityElevated = city.severeRainRisk === 'ELEVATED';

                  return (
                    <button
                      key={city.cityId}
                      onClick={() => {
                        onSelectCity(city.cityId);
                        setActiveTab('city_detail');
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900'
                          : isCitySevere
                          ? 'bg-red-50 hover:bg-red-100 text-stone-900 border-red-300'
                          : isCityElevated
                          ? 'bg-sky-50/70 hover:bg-sky-100 text-stone-900 border-sky-200'
                          : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="truncate">{city.cityName}</span>
                          <span
                            className={`text-[10px] font-normal px-1 rounded ${
                              isSelected
                                ? 'bg-stone-800 text-stone-300'
                                : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {city.state}
                          </span>
                        </div>
                        <div
                          className={`text-[10.5px] truncate mt-0.5 ${
                            isSelected ? 'text-stone-300' : 'text-stone-500'
                          }`}
                        >
                          {city.weatherDescription} &bull; {city.currentPrecipProbability}% rain chance
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <div className="font-mono font-bold text-xs">{city.temperatureC}°C</div>
                          <div className="text-[10px] font-mono">
                            {city.precipitationMm > 0 ? (
                              <span className={isSelected ? 'text-sky-300' : 'text-sky-600 font-bold'}>
                                {city.precipitationMm}mm
                              </span>
                            ) : (
                              <span className={isSelected ? 'text-stone-400' : 'text-stone-400'}>
                                0 mm
                              </span>
                            )}
                          </div>
                        </div>

                        {isCitySevere ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-600 text-white">
                            HIGH RAIN
                          </span>
                        ) : isSelected ? (
                          <Check className="w-3.5 h-3.5 text-stone-200" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Controls: Live Attribution & Test Simulation */}
          <div className="pt-2.5 mt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
            <div className="text-[10.5px] text-stone-500 truncate">
              Updated: {activeWeather.lastUpdated} ({activeWeather.source === 'open_meteo_live' ? 'Live API' : 'Telemetry'})
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isSimulated ? (
                <button
                  onClick={() => {
                    if (onResetToLiveWeather) onResetToLiveWeather();
                  }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-semibold text-[10.5px] transition-colors"
                >
                  Reset Live
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (onSimulateSevereRain) onSimulateSevereRain();
                  }}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 rounded font-bold text-[10.5px] transition-colors"
                  title="Test-simulate high-risk downpour in active city to test automated disaster trigger"
                >
                  Simulate High Rain
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
