import { debounce } from 'lodash';

// Cache for geocoding results
const geocodeCache = new Map();

// Debounced geocoding function
export const getAddressFromCoordinates = debounce(async (latitude, longitude) => {
  const cacheKey = `${latitude},${longitude}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );
    const data = await response.json();
    
    if (data.display_name) {
      // Cache the result
      geocodeCache.set(cacheKey, data.display_name);
      return data.display_name;
    }
    return 'Unknown location';
  } catch (error) {
    console.error('Error getting address:', error);
    return 'Error getting location';
  }
}, 1000); // Debounce for 1 second

// Calculate distance between two points using Haversine formula
export const calculateDistance = (point1, point2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1[0] * Math.PI) / 180;
  const φ2 = (point2[0] * Math.PI) / 180;
  const Δφ = ((point2[0] - point1[0]) * Math.PI) / 180;
  const Δλ = ((point2[1] - point1[1]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Calculate trip statistics
export const calculateTripStats = (route, startTime) => {
  if (!route || route.length < 2) {
    return {
      distance: 0,
      duration: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0
    };
  }

  let totalDistance = 0;
  let maxSpeed = 0;
  let elevationGain = 0;
  let elevationLoss = 0;

  for (let i = 1; i < route.length; i++) {
    const distance = calculateDistance(route[i - 1], route[i]);
    totalDistance += distance;

    // Calculate speed (m/s)
    const timeDiff = (route[i].timestamp - route[i - 1].timestamp) / 1000;
    const speed = distance / timeDiff;
    maxSpeed = Math.max(maxSpeed, speed);

    // Calculate elevation changes
    if (route[i].elevation && route[i - 1].elevation) {
      const elevationDiff = route[i].elevation - route[i - 1].elevation;
      if (elevationDiff > 0) {
        elevationGain += elevationDiff;
      } else {
        elevationLoss += Math.abs(elevationDiff);
      }
    }
  }

  const duration = (route[route.length - 1].timestamp - route[0].timestamp) / 1000;
  const avgSpeed = totalDistance / duration;

  return {
    distance: totalDistance,
    duration,
    avgSpeed,
    maxSpeed,
    elevationGain,
    elevationLoss
  };
};

// Settings persistence
export const saveSettings = (settings) => {
  localStorage.setItem('tripSettings', JSON.stringify(settings));
};

export const loadSettings = () => {
  const defaultSettings = {
    recordingMode: 'time',
    recordingInterval: 20,
    recordingDistance: 100
  };

  try {
    const savedSettings = localStorage.getItem('tripSettings');
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
}; 