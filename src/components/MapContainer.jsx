import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Center, Spinner, Text, VStack } from '@chakra-ui/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

console.log('📍 MapContainer mounted');

const DEFAULT_CENTER = [-74.006, 40.7128]; // New York City
const DEFAULT_ZOOM = 15;
const MIN_HEIGHT = { base: '300px', md: '500px' };
const MIN_DISTANCE_THRESHOLD = 50; // meters
const ZOOM_LEVEL = 15;
const FLY_DURATION = 1000;
const MAX_RETRIES = 3;

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

    if (mapRef.current.getSource('route')) {
      mapRef.current.removeLayer('route-line');
      mapRef.current.removeSource('route');
    }

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
        center: [0, 0],
        zoom: 2
      });

      map.on('load', () => {
        console.log('Map loaded!');
        mapRef.current = map;
        setIsMapLoaded(true);
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
  }, [initializeMap]);

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
  }, [isTracking, currentLocation, markerEmoji, retryCount, updateMapView]);

  useEffect(() => {
    if (!mapRef.current || !route || route.length === 0 || !mapRef.current.loaded()) return;

    const currentRoute = JSON.stringify(route);
    if (currentRoute === previousRouteRef.current) return;
    previousRouteRef.current = currentRoute;

    const coordinates = route.map(point => [point.longitude, point.latitude]);
    drawRoute(coordinates);

    if (!isTracking) {
      const bounds = coordinates.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

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
      style={{ 
        minHeight: typeof minHeight === 'object' ? minHeight.base : minHeight,
        border: '2px solid red' // Temporary border to visualize container
      }}
    />
  );
};

export default MapContainer;
