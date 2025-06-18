import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box } from '@chakra-ui/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

console.log('📍 MapContainer mounted');

const DEFAULT_CENTER = [-74.006, 40.7128]; // New York City
const DEFAULT_ZOOM = 15;
const MAX_RETRIES = 3;
const MIN_DISTANCE_THRESHOLD = 50; // meters
const ZOOM_LEVEL = 15;
const FLY_DURATION = 1000;

const MapContainer = ({ 
  isTracking, 
  currentLocation, 
  route, 
  onMapError,
  markerEmoji = '🚶'
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastCenterRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  const createMarkerElement = (emoji) => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.fontSize = '24px';
    el.style.textAlign = 'center';
    el.style.transform = 'translate(-50%, -50%)';
    el.innerHTML = emoji;
    return el;
  };

  const isValidCoordinate = (lat, lng) => {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  };

  const updateMapView = useCallback((newCenter) => {
    if (!mapRef.current || !mapRef.current.loaded()) return;

    const now = Date.now();
    const lastUpdate = lastUpdateTimeRef.current;
    const timeSinceLastUpdate = now - lastUpdate;

    if (timeSinceLastUpdate < 3000) return;

    const lastCenter = lastCenterRef.current;
    const distance = lastCenter
      ? maplibregl.LngLat.convert(lastCenter).distanceTo(newCenter)
      : Infinity;

    if (distance > MIN_DISTANCE_THRESHOLD) {
      mapRef.current.flyTo({
        center: newCenter,
        zoom: ZOOM_LEVEL,
        essential: true,
        duration: FLY_DURATION,
        maxDuration: FLY_DURATION
      });
      lastCenterRef.current = newCenter;
      lastUpdateTimeRef.current = now;
    }
  }, []);

  const initializeMap = useCallback(() => {
    console.log('Initializing map...');
    console.log('Container ref:', mapContainerRef.current);
    
    if (!mapContainerRef.current) {
      console.error('Map container not found!');
      return;
    }

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM
      });

      map.on('load', () => {
        console.log('Map loaded!');
        mapRef.current = map;
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
      });
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }, []);

  useEffect(() => {
    console.log('Map initialization effect triggered');
    
    const raf = requestAnimationFrame(() => {
      if (mapContainerRef.current) {
        console.log('Container found, initializing map...');
        initializeMap();
      } else {
        console.warn('Map container still not ready, retrying via animation frame...');
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
        } else {
          console.error('Max retries reached, map initialization failed');
        }
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initializeMap, retryCount]);

  // Handle current location updates
  useEffect(() => {
    if (!mapRef.current || !currentLocation || !mapRef.current.loaded()) return;

    const { latitude, longitude } = currentLocation;
    if (!isValidCoordinate(latitude, longitude)) return;

    const newCenter = [longitude, latitude];

    if (markerRef.current) {
      markerRef.current.setLngLat(newCenter);
    } else {
      markerRef.current = new maplibregl.Marker({
        element: createMarkerElement(markerEmoji),
        anchor: 'bottom'
      })
        .setLngLat(newCenter)
        .addTo(mapRef.current);
    }

    if (isTracking) {
      updateMapView(newCenter);
    }
  }, [isTracking, currentLocation, markerEmoji, updateMapView]);

  return (
    <Box
      ref={mapContainerRef}
      width="100%"
      height="100%"
      bg="gray.50"
      style={{ height: '100%' }}
    />
  );
};

export default MapContainer;
