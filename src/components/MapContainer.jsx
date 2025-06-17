import React, { useRef, useEffect, useState } from 'react';
import { Box, Center, Spinner, Text, Button, VStack } from '@chakra-ui/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Map error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Center height="400px" bg="white" borderRadius="md" boxShadow="md">
          <VStack spacing={4}>
            <Text color="red.500">Something went wrong with the map.</Text>
            <Button
              colorScheme="blue"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Retry
            </Button>
          </VStack>
        </Center>
      );
    }

    return this.props.children;
  }
}

const MapContainer = ({ 
  isTracking, 
  currentLocation, 
  route,
  onMapLoad,
  onMapError 
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(null);

  const initializeMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      setMapLoading(true);
      setMapError(null);

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.REACT_APP_MAPTILER_KEY}`,
        center: [78.6937, 10.7905],
        zoom: 13,
        attributionControl: false
      });

      map.addControl(new maplibregl.AttributionControl({
        compact: true
      }));

      map.on('load', () => {
        console.log('Map loaded successfully');
        mapRef.current = map;
        setMapLoading(false);
        onMapLoad?.(map);
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Error loading map. Please check your internet connection and try again.');
        setMapLoading(false);
        onMapError?.(e);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Failed to initialize map. Please refresh the page and try again.');
      setMapLoading(false);
      onMapError?.(error);
    }
  };

  useEffect(() => {
    if (isTracking && !mapRef.current) {
      initializeMap();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isTracking]);

  useEffect(() => {
    if (mapRef.current && currentLocation) {
      const [latitude, longitude] = currentLocation;
      mapRef.current.setCenter([longitude, latitude]);

      if (markerRef.current) {
        markerRef.current.setLngLat([longitude, latitude]);
      } else {
        markerRef.current = new maplibregl.Marker({
          element: createMarkerElement('🧍'),
          anchor: 'bottom'
        })
          .setLngLat([longitude, latitude])
          .addTo(mapRef.current);
      }
    }
  }, [currentLocation]);

  useEffect(() => {
    if (mapRef.current && route.length > 0) {
      const coordinates = route.map(point => [point[1], point[0]]);
      
      if (mapRef.current.getSource('route')) {
        mapRef.current.getSource('route').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates
          }
        });
      } else {
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
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3B82F6',
            'line-width': 4
          }
        });
      }
    }
  }, [route]);

  const createMarkerElement = (emoji) => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.fontSize = '24px';
    el.style.textAlign = 'center';
    el.innerHTML = emoji;
    return el;
  };

  return (
    <MapErrorBoundary>
      <Box 
        height="400px" 
        position="relative" 
        borderRadius="md" 
        overflow="hidden"
        boxShadow="md"
        borderWidth={1}
        borderColor="gray.200"
      >
        {mapLoading && (
          <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="white" zIndex={1}>
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" thickness="4px" />
              <Text color="gray.600">Loading map...</Text>
            </VStack>
          </Center>
        )}
        {mapError && (
          <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="white" zIndex={1}>
            <VStack spacing={4} p={4} textAlign="center">
              <Text color="red.500" fontWeight="medium">{mapError}</Text>
              <Button 
                colorScheme="blue" 
                onClick={() => {
                  setMapError(null);
                  initializeMap();
                }}
              >
                Retry
              </Button>
            </VStack>
          </Center>
        )}
        <Box
          ref={mapContainerRef}
          height="100%"
          width="100%"
          display={mapLoading ? 'none' : 'block'}
        />
      </Box>
    </MapErrorBoundary>
  );
};

export default MapContainer; 