import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box } from '@chakra-ui/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

console.log('📍 MapContainer mounted');

const DEFAULT_CENTER = [-74.006, 40.7128]; // New York City
const DEFAULT_ZOOM = 15;
const MAX_RETRIES = 3;

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
