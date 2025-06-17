import { useState, useRef, useEffect } from 'react';
import { calculateDistance, calculateTripStats } from '../utils/geolocation';

export const useTripTracker = (settings) => {
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastRecordedPoint, setLastRecordedPoint] = useState(null);
  const [tripStats, setTripStats] = useState(null);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecordingTimeRef = useRef(null);

  const startTracking = () => {
    setIsTracking(true);
    const now = new Date();
    setStartTime(now);
    setElapsed(0);
    lastRecordingTimeRef.current = now.getTime();

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((new Date() - now) / 1000));
    }, 1000);

    startLocationTracking();
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    clearInterval(timerRef.current);
    setIsTracking(false);

    if (route.length > 0) {
      const stats = calculateTripStats(route, startTime);
      setTripStats(stats);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

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
      },
      options
    );
  };

  const shouldRecordPoint = (newPoint, now) => {
    if (!lastRecordedPoint || !lastRecordingTimeRef.current) return true;

    if (settings.recordingMode === 'time') {
      return now - lastRecordingTimeRef.current >= settings.recordingInterval * 1000;
    } else {
      const distance = calculateDistance(lastRecordedPoint, newPoint);
      return distance >= settings.recordingDistance;
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
    route,
    startTime,
    elapsed,
    currentLocation,
    tripStats,
    startTracking,
    stopTracking
  };
}; 