import React, { useRef, useEffect, useState, useCallback } from 'react';
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

const MapContainer = ({ isTracking, currentLocation, route, onMapError }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;
    if (!apiKey) {
      const error = new Error('MapTiler API key is not configured');
      setError(error);
      onMapError(error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
        center: [0, 0],
        zoom: 2,
        attributionControl: false,
        preserveDrawingBuffer: true
      });

      map.on('load', () => {
        console.log('Map loaded successfully');
        setIsLoading(false);
        mapRef.current = map;

        // Add navigation controls after map is loaded
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.AttributionControl({
          compact: true
        }));
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        const error = new Error('Failed to load map');
        setError(error);
        onMapError(error);
        setIsLoading(false);
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      setError(error);
      onMapError(error);
      setIsLoading(false);
    }
  }, [onMapError]);

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

  // Update map when tracking starts or location changes
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;

    const { latitude, longitude } = currentLocation;
    
    // Ensure the map is loaded before trying to update it
    if (!mapRef.current.loaded()) {
      mapRef.current.once('load', () => {
        mapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          essential: true
        });
      });
    } else {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        essential: true
      });
    }
  }, [isTracking, currentLocation]);

  // Update route on map
  useEffect(() => {
    if (!mapRef.current || !route || route.length === 0) return;

    // Ensure the map is loaded before trying to update it
    if (!mapRef.current.loaded()) {
      mapRef.current.once('load', () => {
        updateRoute();
      });
    } else {
      updateRoute();
    }

    function updateRoute() {
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

      // Fit map to route bounds
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

      mapRef.current.fitBounds(bounds, {
        padding: 50,
        duration: 1000
      });
    }
  }, [route]);

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
    >
      {isLoading && (
        <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="white" zIndex={1}>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text>Loading map...</Text>
          </VStack>
        </Center>
      )}
      {error && (
        <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="white" zIndex={1}>
          <VStack spacing={4}>
            <Text color="red.500">{error.message}</Text>
            <Button onClick={initializeMap} colorScheme="blue">
              Retry
            </Button>
          </VStack>
        </Center>
      )}
    </Box>
  );
};

export default MapContainer; 