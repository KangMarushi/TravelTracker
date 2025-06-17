import { useState, useEffect, useCallback } from 'react';
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
    if (route.length > 0) {
      const totalDistance = route.reduce((acc, point, index) => {
        if (index === 0) return 0;
        const prevPoint = route[index - 1];
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
        route
      });
    }
  }, [route, elapsed]);

  const startTracking = useCallback(async () => {
    try {
      const position = await getCurrentPosition();
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      setRoute([{
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString()
      }]);
      setStartTime(new Date());
      setElapsed(0);
      setIsTracking(true);
      setIsPaused(false);
      setGeoError(null);
    } catch (error) {
      console.error('Error starting tracking:', error);
      setGeoError(error.message);
    }
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setIsPaused(false);
    setStartTime(null);
  }, []);

  const pauseTracking = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeTracking = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Track location updates
  useEffect(() => {
    let watchId;
    if (isTracking && !isPaused) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
          };
          setCurrentLocation(newLocation);
          setRoute(prev => [...prev, newLocation]);
        },
        (error) => {
          console.error('Error watching position:', error);
          setGeoError(error.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
    }
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTracking, isPaused]);

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