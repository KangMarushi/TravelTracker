import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentPosition, getAddressFromCoordinates } from '../utils/geolocation';

const useTripTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMode, setRecordingMode] = useState('time');
  const [recordingInterval, setRecordingInterval] = useState(5);
  const [recordingDistance, setRecordingDistance] = useState(100);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [route, setRoute] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [tripStats, setTripStats] = useState({
    distance: 0,
    duration: 0,
    averageSpeed: 0,
    route: []
  });

  // Refs for tracking last recorded point and time
  const lastRecordedPointRef = useRef(null);
  const lastRecordedTimeRef = useRef(null);

  // Update elapsed time
  useEffect(() => {
    let interval;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, isPaused]);

  // Update address when location changes
  useEffect(() => {
    if (currentLocation) {
      setIsLoadingAddress(true);
      getAddressFromCoordinates(currentLocation.latitude, currentLocation.longitude)
        .then(address => {
          setCurrentAddress(address);
          setIsLoadingAddress(false);
        })
        .catch(error => {
          console.error('Error getting address:', error);
          setCurrentAddress('Location unavailable');
          setIsLoadingAddress(false);
        });
    }
  }, [currentLocation]);

  // Calculate trip stats
  useEffect(() => {
    const safeRoute = Array.isArray(route) ? route : [];
    if (safeRoute.length > 0) {
      const totalDistance = safeRoute.reduce((acc, point, index) => {
        if (index === 0) return 0;
        const prevPoint = safeRoute[index - 1];
        const distance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          point.latitude,
          point.longitude
        );
        return acc + distance;
      }, 0);

      const duration = elapsed;
      const averageSpeed = duration > 0 ? (totalDistance / duration) * 3600 : 0; // km/h

      setTripStats({
        distance: totalDistance,
        duration,
        averageSpeed,
        route: safeRoute
      });
    }
  }, [route, elapsed]);

  const startTracking = useCallback(async () => {
    try {
      setIsTracking(true);
      setIsPaused(false);
      setGeoError(null);
      
      const position = await getCurrentPosition();
      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString()
      };
      
      setCurrentLocation(newLocation);
      setRoute([newLocation]);
      setStartTime(new Date());
      setElapsed(0);
      
      // Initialize tracking refs
      lastRecordedPointRef.current = newLocation;
      lastRecordedTimeRef.current = Date.now();
    } catch (error) {
      console.error('Error starting tracking:', error);
      setGeoError(error.message);
      setIsTracking(false);
    }
  }, []);

  const shouldRecordPoint = useCallback((newLocation) => {
    const now = Date.now();
    const lastPoint = lastRecordedPointRef.current;
    const lastTime = lastRecordedTimeRef.current;

    if (!lastPoint || !lastTime) return true;

    if (recordingMode === 'time') {
      return now - lastTime >= recordingInterval * 1000;
    } else {
      const distance = calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        newLocation.latitude,
        newLocation.longitude
      );
      return distance >= recordingDistance / 1000; // Convert meters to kilometers
    }
  }, [recordingMode, recordingInterval, recordingDistance]);

  // Track location updates
  useEffect(() => {
    let watchId;
    if (isTracking && !isPaused) {
      const options = {
        enableHighAccuracy: true,
        maximumAge: 60000, // Accept positions up to 60 seconds old
        timeout: 30000
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
          };
          
          // Only update if enough time has passed since last update
          const now = Date.now();
          const lastUpdate = lastRecordedTimeRef.current || 0;
          if (now - lastUpdate >= 60000) { // 60 seconds
            setCurrentLocation(newLocation);
            lastRecordedTimeRef.current = now;
          }
          
          if (shouldRecordPoint(newLocation)) {
            setRoute(prev => [...prev, newLocation]);
            lastRecordedPointRef.current = newLocation;
          }
        },
        (error) => {
          console.error('Error watching position:', error);
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
          
          setGeoError(errorMessage);
        },
        options
      );
    }
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTracking, isPaused, shouldRecordPoint]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setIsPaused(false);
    setStartTime(null);
    lastRecordedPointRef.current = null;
    lastRecordedTimeRef.current = null;
  }, []);

  const pauseTracking = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeTracking = useCallback(() => {
    setIsPaused(false);
  }, []);

  return {
    isTracking,
    isPaused,
    recordingMode,
    recordingInterval,
    recordingDistance,
    currentLocation,
    currentAddress,
    isLoadingAddress,
    geoError,
    route,
    elapsed,
    tripStats,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setRecordingMode,
    setRecordingInterval,
    setRecordingDistance
  };
};

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

export default useTripTracker; 