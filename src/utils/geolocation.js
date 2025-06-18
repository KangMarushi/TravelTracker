import { debounce } from 'lodash';

// Cache for geocoding results with size limit
const CACHE_SIZE = 100;
const geocodeCache = new Map();

// Debounced function to get address from coordinates
export const getAddressFromCoordinates = async (latitude, longitude) => {
  const cacheKey = `${latitude},${longitude}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch address');
    }

    const data = await response.json();
    const address = data.display_name || 'Address unavailable';
    
    // Manage cache size
    if (geocodeCache.size >= CACHE_SIZE) {
      const firstKey = geocodeCache.keys().next().value;
      geocodeCache.delete(firstKey);
    }
    
    // Cache the result
    geocodeCache.set(cacheKey, address);
    return address;
  } catch (error) {
    console.error('Error getting address:', error);
    throw error;
  }
};

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
  if (!route || route.length === 0) {
    return {
      distance: 0,
      duration: '00:00:00',
      averageSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
      points: 0,
      startAddress: 'Unknown location',
      endAddress: 'Unknown location',
      route: []
    };
  }

  const endTime = new Date();
  const durationMs = endTime - startTime;
  const durationHours = durationMs / (1000 * 60 * 60);
  
  // Calculate total distance and elevation changes
  let totalDistance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxSpeed = 0;
  let speeds = [];

  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1];
    const to = route[i];
    
    // Calculate distance
    const distance = calculateDistance(from, to);
    totalDistance += distance;

    // Calculate elevation changes
    if (from.elevation && to.elevation) {
      const elevationDiff = to.elevation - from.elevation;
      if (elevationDiff > 0) {
        elevationGain += elevationDiff;
      } else {
        elevationLoss += Math.abs(elevationDiff);
      }
    }

    // Calculate speed between points
    const timeDiff = (new Date(to.timestamp) - new Date(from.timestamp)) / 1000; // in seconds
    if (timeDiff > 0) {
      const speed = (distance / 1000) / (timeDiff / 3600); // km/h
      speeds.push(speed);
      maxSpeed = Math.max(maxSpeed, speed);
    }
  }

  // Calculate average speed in km/h
  const averageSpeed = speeds.length > 0 
    ? speeds.reduce((a, b) => a + b, 0) / speeds.length 
    : 0;

  // Format duration as HH:MM:SS
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    distance: totalDistance / 1000, // Convert to kilometers
    duration,
    averageSpeed,
    maxSpeed,
    elevationGain,
    elevationLoss,
    points: route.length,
    startAddress: 'Loading...', // Will be updated with reverse geocoding
    endAddress: 'Loading...', // Will be updated with reverse geocoding
    route
  };
};

// Default settings
const DEFAULT_SETTINGS = {
  recordingMode: 'time',
  recordingInterval: 20,
  recordingDistance: 100
};

// Save settings to localStorage
export const saveSettings = (settings) => {
  try {
    localStorage.setItem('tripSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

// Load settings from localStorage
export const loadSettings = () => {
  try {
    const savedSettings = localStorage.getItem('tripSettings');
    return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        let errorMessage = 'Error getting location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = 'An unknown error occurred while getting location.';
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // Increased timeout to 30 seconds
        maximumAge: 0
      }
    );
  });
}; 