import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Center, Spinner, Text, VStack } from '@chakra-ui/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_CENTER = [-74.006, 40.7128]; // New York City
const DEFAULT_ZOOM = 15;
const MIN_HEIGHT = { base: '300px', md: '500px' };
const MIN_DISTANCE_THRESHOLD = 50; // meters
const ZOOM_LEVEL = 15;
const FLY_DURATION = 1000;

const MapContainer = ({ 
  isTracking, 
  currentLocation, 
  route, 
  onMapError,
  markerEmoji = '🚶',
  minHeight = MIN_HEIGHT,
  onMapLoaded
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const isFirstLoad = useRef(true);
  const previousRouteRef = useRef(null);
  const lastCenterRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

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

  const drawRoute = useCallback((coordinates) => {
    if (!mapRef.current || !mapRef.current.loaded()) return;

    // Remove existing route layer if it exists
    if (mapRef.current.getSource('route')) {
      mapRef.current.removeLayer('route-line');
      mapRef.current.removeSource('route');
    }

    // Add new route layer
    mapRef.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      }
    });

    mapRef.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#4299E1',
        'line-width': 4
      }
    });
  }, []);

  const updateMapView = useCallback((newCenter) => {
    if (!mapRef.current || !mapRef.current.loaded()) return;

    const now = Date.now();
    const lastUpdate = lastUpdateTimeRef.current;
    const timeSinceLastUpdate = now - lastUpdate;

    // Skip if we've updated too recently (throttle)
    if (timeSinceLastUpdate < FLY_DURATION) {
      return;
    }

    const lastCenter = lastCenterRef.current;
    const distance = lastCenter
      ? maplibregl.LngLat.convert(lastCenter).distanceTo(newCenter)
      : Infinity;

    // Only update if we've moved significantly
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
    if (!mapContainerRef.current || mapRef.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;
    if (!apiKey) {
      console.error('MapTiler API key is not configured');
      onMapError(new Error('MapTiler API key is not configured. Please check your environment variables.'));
      return;
    }

    try {
      // Ensure container has dimensions
      const container = mapContainerRef.current;
      if (!container.offsetWidth || !container.offsetHeight) {
        console.warn('Map container has no dimensions, retrying...');
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
        }
        return;
      }

      const mapStyleUrl = `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`;
      console.log('Initializing map with style URL:', mapStyleUrl);

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: mapStyleUrl,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        preserveDrawingBuffer: true,
        maxZoom: 18,
        minZoom: 2
      });

      map.on('load', () => {
        console.log('Map loaded successfully');
        mapRef.current = map;
        setIsMapLoaded(true);
        if (onMapLoaded) onMapLoaded();

        // Add navigation controls after map is loaded
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.AttributionControl({
          compact: true
        }));

        // Initialize marker if we have a valid location
        if (currentLocation && isValidCoordinate(currentLocation.latitude, currentLocation.longitude)) {
          const newCenter = [currentLocation.longitude, currentLocation.latitude];
          markerRef.current = new maplibregl.Marker({
            element: createMarkerElement(markerEmoji),
            anchor: 'bottom'
          })
            .setLngLat(newCenter)
            .addTo(map);

          // Set initial view if this is the first load
          if (isFirstLoad.current) {
            map.flyTo({
              center: newCenter,
              zoom: ZOOM_LEVEL,
              essential: true,
              duration: 0
            });
            lastCenterRef.current = newCenter;
            isFirstLoad.current = false;
          }
        }
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        if (e.error && e.error.message && e.error.message.includes('API key')) {
          onMapError(new Error('Invalid MapTiler API key. Please check your environment variables.'));
        } else {
          onMapError(new Error('Failed to load map. Please try again.'));
        }
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      onMapError(error);
    }
  }, [onMapError, currentLocation, markerEmoji, onMapLoaded, retryCount]);

  // Initialize map on mount
  useEffect(() => {
    // Add a small delay to ensure container is rendered
    const timer = setTimeout(() => {
      initializeMap();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initializeMap, retryCount]);

  // Update marker and map when location changes
  useEffect(() => {
    if (!mapRef.current || !currentLocation || !mapRef.current.loaded()) {
      if (retryCount < MAX_RETRIES) {
        const timer = setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 1000);
        return () => clearTimeout(timer);
      }
      return;
    }

    const { latitude, longitude } = currentLocation;
    
    if (!isValidCoordinate(latitude, longitude)) {
      console.warn('Invalid coordinates:', { latitude, longitude });
      return;
    }

    const newCenter = [longitude, latitude];

    // Update or create marker
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

    // Update map view only when tracking
    if (isTracking) {
      updateMapView(newCenter);
    }
  }, [isTracking, currentLocation, markerEmoji, retryCount, updateMapView]);

  // Update route on map
  useEffect(() => {
    if (!mapRef.current || !route || route.length === 0 || !mapRef.current.loaded()) return;

    // Check if route has changed
    const currentRoute = JSON.stringify(route);
    if (currentRoute === previousRouteRef.current) return;
    previousRouteRef.current = currentRoute;

    const coordinates = route.map(point => [point.longitude, point.latitude]);
    drawRoute(coordinates);

    // Only fit bounds if we're not tracking
    if (!isTracking) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

      mapRef.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: FLY_DURATION,
        maxZoom: ZOOM_LEVEL
      });
    }
  }, [route, isTracking, drawRoute]);

  if (!isMapLoaded) {
    return (
      <Center minH={minHeight} bg="gray.50">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading map...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box
      ref={mapContainerRef}
      width="100%"
      height="100%"
      position="relative"
      display="flex"
      flexDirection="column"
      bg="gray.50"
      minH={minHeight}
      style={{ minHeight: typeof minHeight === 'object' ? minHeight.base : minHeight }}
    />
  );
};

export default MapContainer; 