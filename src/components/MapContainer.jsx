import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@chakra-ui/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapContainer = ({ isTracking, currentLocation, route, onMapError }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const isFirstLoad = useRef(true);

  const createMarkerElement = (emoji) => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.fontSize = '24px';
    el.style.textAlign = 'center';
    el.style.transform = 'translate(-50%, -50%)';
    el.innerHTML = emoji;
    return el;
  };

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;
    if (!apiKey) {
      onMapError(new Error('MapTiler API key is not configured'));
      return;
    }

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
        center: [0, 0],
        zoom: 2,
        attributionControl: false,
        preserveDrawingBuffer: true,
        maxZoom: 18,
        minZoom: 2
      });

      map.on('load', () => {
        console.log('Map loaded successfully');
        mapRef.current = map;

        // Add navigation controls after map is loaded
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.AttributionControl({
          compact: true
        }));

        // Initialize marker if we have a location
        if (currentLocation) {
          const { latitude, longitude } = currentLocation;
          markerRef.current = new maplibregl.Marker({
            element: createMarkerElement('🚶'),
            anchor: 'bottom'
          })
            .setLngLat([longitude, latitude])
            .addTo(map);

          // Set initial view if this is the first load
          if (isFirstLoad.current) {
            map.flyTo({
              center: [longitude, latitude],
              zoom: 15,
              essential: true,
              duration: 0
            });
            isFirstLoad.current = false;
          }
        }
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        onMapError(new Error('Failed to load map'));
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      onMapError(error);
    }
  }, [onMapError, currentLocation]);

  // Initialize map on mount
  useEffect(() => {
    initializeMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initializeMap]);

  // Update marker and map when location changes
  useEffect(() => {
    if (!mapRef.current || !currentLocation || !mapRef.current.loaded()) return;

    const { latitude, longitude } = currentLocation;
    
    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
    } else {
      markerRef.current = new maplibregl.Marker({
        element: createMarkerElement('🚶'),
        anchor: 'bottom'
      })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);
    }

    // Update map view only when tracking
    if (isTracking) {
      const currentCenter = mapRef.current.getCenter();
      const currentZoom = mapRef.current.getZoom();
      const distance = mapRef.current.getCenter().distanceTo([longitude, latitude]);
      
      // Only update if we've moved significantly or zoom is too far out
      if (distance > 50 || currentZoom < 14) {
        mapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          essential: true,
          duration: 1000,
          maxDuration: 1000
        });
      }
    }
  }, [isTracking, currentLocation]);

  // Update route on map
  useEffect(() => {
    if (!mapRef.current || !route || route.length === 0 || !mapRef.current.loaded()) return;

    const coordinates = route.map(point => [point.longitude, point.latitude]);

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

    // Only fit bounds if we're not tracking
    if (!isTracking) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

      mapRef.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1000,
        maxZoom: 15
      });
    }
  }, [route, isTracking]);

  return (
    <Box
      ref={mapContainerRef}
      width="100%"
      height="100%"
      position="relative"
      display="flex"
      flexDirection="column"
      bg="gray.50"
      style={{ minHeight: '400px' }}
    />
  );
};

export default MapContainer; 