import { useState, useRef, useEffect } from 'react';
import { calculateDistance, calculateTripStats } from '../utils/geolocation';

export const useTripTracker = ({ recordingMode, recordingInterval, recordingDistance, onError }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [route, setRoute] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastRecordedPoint, setLastRecordedPoint] = useState(null);
  const [tripStats, setTripStats] = useState(null);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecordingTimeRef = useRef(null);
  const pauseStartTimeRef = useRef(null);
  const totalPausedTimeRef = useRef(0);

  const startTracking = () => {
    if (!navigator.geolocation) {
      onError?.(new Error('Geolocation is not supported by your browser'));
      return;
    }

    setIsTracking(true);
    setIsPaused(false);
    const now = new Date();
    setStartTime(now);
    setElapsed(0);
    lastRecordingTimeRef.current = now.getTime();
    totalPausedTimeRef.current = 0;

    timerRef.current = setInterval(() => {
      const currentTime = new Date();
      const pausedTime = totalPausedTimeRef.current;
      setElapsed(Math.floor((currentTime - now - pausedTime) / 1000));
    }, 1000);

    startLocationTracking();
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    clearInterval(timerRef.current);
    setIsTracking(false);
    setIsPaused(false);
    totalPausedTimeRef.current = 0;

    if (route.length > 0) {
      const stats = calculateTripStats(route, startTime);
      setTripStats(stats);
    }
  };

  const pauseTracking = () => {
    if (!isTracking || isPaused) return;
    
    setIsPaused(true);
    pauseStartTimeRef.current = new Date();
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
  };

  const resumeTracking = () => {
    if (!isTracking || !isPaused) return;
    
    setIsPaused(false);
    const pauseEndTime = new Date();
    totalPausedTimeRef.current += pauseEndTime - pauseStartTimeRef.current;
    
    startLocationTracking();
  };

  const startLocationTracking = () => {
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPoint = [latitude, longitude];
        setCurrentLocation(newPoint);

        const now = Date.now();
        const shouldRecord = shouldRecordPoint(newPoint, now);

        if (shouldRecord) {
          setRoute(prev => [...prev, { ...newPoint, timestamp: now }]);
          setLastRecordedPoint(newPoint);
          lastRecordingTimeRef.current = now;
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Error getting location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'An unknown error occurred while getting location.';
        }
        
        onError?.(new Error(errorMessage));
      },
      options
    );
  };

  const shouldRecordPoint = (newPoint, now) => {
    if (!lastRecordedPoint || !lastRecordingTimeRef.current) return true;

    if (recordingMode === 'time') {
      return now - lastRecordingTimeRef.current >= recordingInterval * 1000;
    } else {
      const distance = calculateDistance(lastRecordedPoint, newPoint);
      return distance >= recordingDistance;
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    isPaused,
    route,
    startTime,
    elapsed,
    currentLocation,
    tripStats,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking
  };
}; 