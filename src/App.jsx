import { Box, Heading, Text, Container, Button, HStack, VStack, Divider, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Textarea, FormControl, FormLabel, List, ListItem, IconButton, Spinner, Badge, Flex, Alert, AlertIcon, Center, SimpleGrid, Stat, StatLabel, StatNumber, ChakraProvider, Select } from '@chakra-ui/react'
import { StarIcon } from '@chakra-ui/icons'
import { useState, useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { supabase } from './supabaseClient'
import * as turf from '@turf/turf'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY

// Helper function to calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function App() {
  const [isTracking, setIsTracking] = useState(false)
  const [route, setRoute] = useState([])
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [showSave, setShowSave] = useState(false)
  const [tripName, setTripName] = useState('')
  const [tripNotes, setTripNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [trips, setTrips] = useState([])
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [showTripModal, setShowTripModal] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState(null)
  const timerRef = useRef(null)
  const geoRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const routeLayerId = 'route-line'
  const toast = useToast()
  const [lastRecordedPoint, setLastRecordedPoint] = useState(null)
  const watchIdRef = useRef(null)
  const [currentLocation, setCurrentLocation] = useState(null)
  const currentLocationMarkerRef = useRef(null)
  const currentLocationLayerId = 'current-location'
  const [isTrackingInterrupted, setIsTrackingInterrupted] = useState(false)
  const lastUpdateTimeRef = useRef(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const locationRetryCountRef = useRef(0)
  const MAX_RETRIES = 3
  const lastRecordingTimeRef = useRef(null)
  const MIN_DISTANCE = 100 // meters
  const MIN_INTERVAL = 30000 // 30 seconds
  const [currentAddress, setCurrentAddress] = useState(null)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const lastGeocodeTimeRef = useRef(null)
  const GEOCODE_INTERVAL = 50000 // Only geocode every 50 seconds
  const [showSummary, setShowSummary] = useState(false)
  const [tripStats, setTripStats] = useState(null)
  const summaryMapRef = useRef(null)
  const summaryMapContainerRef = useRef(null)
  const [recordingMode, setRecordingMode] = useState('time')
  const [recordingInterval, setRecordingInterval] = useState(20)
  const [recordingDistance, setRecordingDistance] = useState(100)
  const [lastAddressUpdate, setLastAddressUpdate] = useState(0)
  const [isInitializing, setIsInitializing] = useState(true)
  const initialWatchIdRef = useRef(null)
  const [error, setError] = useState(null)

  // Add beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isTracking) {
        // Stop tracking when page is closed/refreshed
        if (watchIdRef.current) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        clearInterval(timerRef.current)
        // Mark tracking as interrupted
        localStorage.setItem('trackingInterrupted', 'true')
        localStorage.setItem('lastUpdateTime', new Date().toISOString())
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isTracking])

  // Check for interrupted tracking on load
  useEffect(() => {
    const wasInterrupted = localStorage.getItem('trackingInterrupted') === 'true'
    const lastUpdateTime = localStorage.getItem('lastUpdateTime')
    
    if (wasInterrupted) {
      setIsTrackingInterrupted(true)
      // Clear the interrupted state
      localStorage.removeItem('trackingInterrupted')
      localStorage.removeItem('lastUpdateTime')
      
      // Show a toast notification
      toast({
        title: 'Tracking Interrupted',
        description: 'Your previous tracking session was interrupted. Please start a new trip.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [])

  // Restore trip state from localStorage on page load
  useEffect(() => {
    const savedTrip = localStorage.getItem('currentTrip')
    if (savedTrip) {
      const { 
        isTracking, 
        route, 
        startTime, 
        lastRecordedPoint: savedLastPoint, 
        currentLocation: savedLocation,
        currentAddress: savedAddress,
        lastUpdateTime: savedLastUpdateTime,
        lastRecordingTime: savedLastRecordingTime
      } = JSON.parse(savedTrip)

      // Check if the tracking was interrupted
      const lastUpdate = savedLastUpdateTime ? new Date(savedLastUpdateTime) : null
      const now = new Date()
      const timeSinceLastUpdate = lastUpdate ? now - lastUpdate : 0

      // If it's been more than 30 seconds since the last update, consider it interrupted
      if (timeSinceLastUpdate > 30000) {
        setIsTrackingInterrupted(true)
        localStorage.removeItem('currentTrip')
        toast({
          title: 'Tracking Interrupted',
          description: 'Your previous tracking session was interrupted. Please start a new trip.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        })
        return
      }

      setIsTracking(isTracking)
      setRoute(route)
      setStartTime(startTime ? new Date(startTime) : null)
      setLastRecordedPoint(savedLastPoint)
      setCurrentLocation(savedLocation)
      setCurrentAddress(savedAddress)
      lastUpdateTimeRef.current = savedLastUpdateTime ? new Date(savedLastUpdateTime) : null
      lastRecordingTimeRef.current = savedLastRecordingTime || null
      
      if (isTracking && startTime) {
        setElapsed(Math.floor((new Date() - new Date(startTime)) / 1000))
        // Restart the timer
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((new Date() - new Date(startTime)) / 1000))
        }, 1000)
        
        // Restart position watching
        if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const newPoint = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString()
              }

              // Update last update time
              lastUpdateTimeRef.current = new Date()

              // Always update current location marker
              setCurrentLocation(newPoint)

              if (!savedLastPoint || 
                  calculateDistance(
                    savedLastPoint.lat, 
                    savedLastPoint.lng, 
                    newPoint.lat, 
                    newPoint.lng
                  ) > 100) {
                setRoute(prevRoute => [...prevRoute, newPoint])
                setLastRecordedPoint(newPoint)
              }
            },
            (error) => {
              setGeoError(error.message)
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 5000
            }
          )
        }
      }
    }
  }, [])

  // Save trip state to localStorage whenever it changes
  useEffect(() => {
    if (isTracking) {
      localStorage.setItem('currentTrip', JSON.stringify({
        isTracking,
        route,
        startTime: startTime ? startTime.toISOString() : null,
        lastRecordedPoint,
        currentLocation,
        currentAddress,
        lastUpdateTime: lastUpdateTimeRef.current ? lastUpdateTimeRef.current.toISOString() : null,
        lastRecordingTime: lastRecordingTimeRef.current
      }))
    } else {
      localStorage.removeItem('currentTrip')
    }
  }, [isTracking, route, startTime, lastRecordedPoint, currentLocation, currentAddress])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      setMapLoading(true);
      setMapError(null);

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
        center: [78.6937, 10.7905], // Default to Trichy
        zoom: 13
      });

      map.on('load', () => {
        console.log('Map loaded successfully');
        mapRef.current = map;
        setMapLoading(false);
        // Start initial location tracking after map is loaded
        startInitialLocationTracking();
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Error loading map. Please check your internet connection and refresh the page.');
        setMapLoading(false);
      });

      return () => {
        if (map) {
          map.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Failed to initialize map. Please refresh the page.');
      setMapLoading(false);
    }
  }, []);

  // Start initial location tracking
  const startInitialLocationTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsInitializing(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    try {
      initialWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation([latitude, longitude]);
          
          // Update map center if map is ready
          if (mapRef.current) {
            mapRef.current.setCenter([longitude, latitude]);
            
            // Update or add the current location marker
            if (currentLocationMarkerRef.current) {
              currentLocationMarkerRef.current.setLngLat([longitude, latitude]);
            } else {
              currentLocationMarkerRef.current = new maplibregl.Marker({
                element: createMarkerElement('🧍'),
                anchor: 'bottom'
              })
                .setLngLat([longitude, latitude])
                .addTo(mapRef.current);
            }
          }

          // Get initial address
          getAddressFromCoordinates(latitude, longitude);
          setIsInitializing(false);
        },
        (error) => {
          console.error('Initial geolocation error:', error);
          setError(`Error getting initial location: ${error.message}`);
          setIsInitializing(false);
        },
        options
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setError('Failed to start location tracking');
      setIsInitializing(false);
    }
  };

  // Cleanup function
  useEffect(() => {
    return () => {
      if (initialWatchIdRef.current) {
        navigator.geolocation.clearWatch(initialWatchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map with route and marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || route.length === 0) return
    const last = route[route.length - 1]
    // Move marker
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#2b6cb0' })
        .setLngLat([last.lng, last.lat])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([last.lng, last.lat])
    }
    // Center map on latest point
    map.flyTo({ center: [last.lng, last.lat], zoom: 14 })
    // Draw route line
    if (map.getSource('route')) {
      map.getSource('route').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.map(p => [p.lng, p.lat]),
        },
      })
    } else {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.map(p => [p.lng, p.lat]),
          },
        },
      })
      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#2b6cb0',
          'line-width': 4,
        },
      })
    }
  }, [route])

  // Update current location marker with address
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return

    try {
      const source = mapRef.current.getSource(currentLocationLayerId)
      if (source) {
        source.setData({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [currentLocation.lng, currentLocation.lat]
          }
        })

        // Center map on current location if it's the first point
        if (route.length === 1) {
          mapRef.current.flyTo({
            center: [currentLocation.lng, currentLocation.lat],
            zoom: 15,
            duration: 2000
          })
        }

        // Update address if enough time has passed
        const now = Date.now()
        if (!lastGeocodeTimeRef.current || now - lastGeocodeTimeRef.current >= GEOCODE_INTERVAL) {
          setIsLoadingAddress(true)
          getAddressFromCoordinates(currentLocation.lat, currentLocation.lng)
            .then(address => {
              if (address) {
                setCurrentAddress(address)
                lastGeocodeTimeRef.current = now
              }
            })
            .finally(() => {
              setIsLoadingAddress(false)
            })
        }
      }
    } catch (error) {
      console.error('Error updating location marker:', error)
    }
  }, [currentLocation, route.length])

  // Function to get address from coordinates
  const getAddressFromCoordinates = async (lat, lng) => {
    try {
      setIsLoadingAddress(true);
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const address = data.features[0].place_name;
        setCurrentAddress(address);
      }
    } catch (error) {
      console.error('Error getting address:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // Function to handle recording mode change
  const handleRecordingModeChange = (mode) => {
    setRecordingMode(mode)
    setLastRecordingTime(0) // Reset last recording time when mode changes
  }

  // New function to handle continuous location watching with configurable recording
  const startContinuousWatching = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser')
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const now = Date.now()
        
        // Always update the current location marker
        if (mapRef.current) {
          const currentLocation = [latitude, longitude]
          mapRef.current.setCenter(currentLocation)
          
          // Update or add the current location marker
          if (currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.setLngLat(currentLocation)
          } else {
            currentLocationMarkerRef.current = new maplibregl.Marker({
              element: createMarkerElement('🧍'),
              anchor: 'bottom'
            })
              .setLngLat(currentLocation)
              .addTo(mapRef.current)
          }
        }

        // Check if we should record a new point based on the selected mode
        const shouldRecord = recordingMode === 'time' 
          ? now - lastRecordingTimeRef.current >= recordingInterval * 1000
          : calculateDistance(lastRecordedPoint, currentLocation) >= recordingDistance

        if (shouldRecord) {
          setRoute(prev => [...prev, currentLocation])
          setLastRecordedPoint(currentLocation)
          lastRecordingTimeRef.current = now
        }

        // Update address every 10 seconds
        if (now - lastAddressUpdate >= 10000) {
          getAddressFromCoordinates(latitude, longitude)
          setLastAddressUpdate(now)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setGeoError(`Error getting location: ${error.message}`)
      },
      options
    )

    setWatchId(watchId)
  }

  // Update the useEffect for map initialization
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      setIsInitializing(true);
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
        center: [78.6937, 10.7905], // Default to Trichy
        zoom: 13
      });

      map.on('load', () => {
        setMapLoading(false);
        mapRef.current = map;
        // Start initial location tracking after map is loaded
        startInitialLocationTracking();
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Error loading map. Please refresh the page.');
        setMapLoading(false);
      });
    }

    return () => {
      if (initialWatchIdRef.current) {
        navigator.geolocation.clearWatch(initialWatchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update the handleStart function to use existing location
  const handleStart = () => {
    if (!currentLocation) {
      setError('Waiting for location...');
      return;
    }

    setIsTracking(true);
    setStartTime(new Date());
    setRoute([currentLocation]);
    setLastRecordingTime(Date.now());
    setLastPoint(currentLocation);
    startContinuousWatching();
  };

  // Function to calculate trip statistics
  const calculateTripStats = (route, startTime) => {
    if (!route || route.length === 0) {
      return {
        distance: 0,
        duration: '0:00',
        averageSpeed: 0,
        points: 0,
        startAddress: 'Unknown location',
        endAddress: 'Unknown location',
        route: []
      };
    }

    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Calculate total distance using Turf.js
    let totalDistance = 0;
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1];
      const to = route[i];
      const distance = turf.distance(from, to, { units: 'kilometers' });
      totalDistance += distance;
    }

    // Calculate average speed in km/h
    const averageSpeed = durationHours > 0 ? totalDistance / durationHours : 0;

    // Format duration as HH:MM:SS
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    const duration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      distance: totalDistance,
      duration,
      averageSpeed,
      points: route.length,
      startAddress: 'Loading...', // Will be updated with reverse geocoding
      endAddress: 'Loading...', // Will be updated with reverse geocoding
      route
    };
  }

  // Stop trip recording
  const handleStop = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
    setIsTrackingInterrupted(false)
    clearInterval(timerRef.current)
    setCurrentLocation(null)
    localStorage.removeItem('currentTrip')
    
    // Calculate trip statistics
    if (route.length > 0) {
      const stats = calculateTripStats(route, startTime)
      setTripStats(stats)
      setShowSummary(true)
    }
  }

  // Handle save trip
  const handleSaveTrip = async (tripData) => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('trips')
        .insert([{
          name: tripData.name,
          notes: tripData.notes,
          route: tripData.route,
          startTime: new Date(tripData.startTime).toISOString(),
          endTime: new Date().toISOString(),
          distance: tripData.stats.distance,
          duration: tripData.stats.duration,
          avgSpeed: tripData.stats.averageSpeed,
          startPoint: tripData.stats.startAddress,
          endPoint: tripData.stats.endAddress,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isFavorite: false
        }]);

      if (error) throw error;
      
      setShowSave(false);
      setShowSummary(false);
      setRoute([]);
      setTripName('');
      setTripNotes('');
      fetchTrips();
    } catch (error) {
      console.error('Error saving trip:', error);
      setError('Failed to save trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Fetch trips from Supabase
  useEffect(() => {
    const fetchTrips = async () => {
      setLoadingTrips(true)
      const { data, error } = await supabase.from('trips').select('*').order('createdAt', { ascending: false })
      if (error) {
        toast({ title: 'Error loading trips', description: error.message, status: 'error', duration: 5000, isClosable: true })
      } else {
        setTrips(data)
      }
      setLoadingTrips(false)
    }
    fetchTrips()
  }, [showSave]) // refetch after saving

  // Mark as favorite
  const handleFavorite = async (trip) => {
    setFavoriteLoading(true)
    const { error } = await supabase.from('trips').update({ isFavorite: !trip.isFavorite, updatedAt: new Date().toISOString() }).eq('id', trip.id)
    setFavoriteLoading(false)
    if (error) {
      toast({ title: 'Error updating favorite', description: error.message, status: 'error', duration: 5000, isClosable: true })
    } else {
      setTrips(trips => trips.map(t => t.id === trip.id ? { ...t, isFavorite: !trip.isFavorite } : t))
    }
  }

  // Show trip details
  const handleShowTrip = (trip) => {
    setSelectedTrip(trip)
    setShowTripModal(true)
  }

  // Render trip route on map in modal
  const tripMapRef = useRef(null)
  useEffect(() => {
    if (!showTripModal || !selectedTrip) return
    if (!tripMapRef.current) return
    const map = new maplibregl.Map({
      container: tripMapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
      center: selectedTrip.route && selectedTrip.route.length > 0 ? [selectedTrip.route[0].lng, selectedTrip.route[0].lat] : [2.3522, 48.8566],
      zoom: 5,
    })
    if (selectedTrip.route && selectedTrip.route.length > 0) {
      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: selectedTrip.route.map(p => [p.lng, p.lat]),
            },
          },
        })
        map.addLayer({
          id: 'route-line-modal',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#2b6cb0',
            'line-width': 4,
          },
        })
        // Add marker at start
        new maplibregl.Marker({ color: '#2b6cb0' })
          .setLngLat([selectedTrip.route[0].lng, selectedTrip.route[0].lat])
          .addTo(map)
      })
    }
    return () => map.remove()
  }, [showTripModal, selectedTrip])

  // Trip Summary Modal
  const TripSummaryModal = ({ isOpen, onClose, stats, onSave }) => {
    const summaryMapRef = useRef(null)
    const summaryMapContainerRef = useRef(null)
    const [summaryMap, setSummaryMap] = useState(null)

    if (!stats) return null

    return (
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Trip Summary</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <SimpleGrid columns={2} spacing={4}>
                <Stat>
                  <StatLabel>Distance</StatLabel>
                  <StatNumber>{stats.distance?.toFixed(2) || '0.00'} km</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Duration</StatLabel>
                  <StatNumber>{stats.duration || '0:00'}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Average Speed</StatLabel>
                  <StatNumber>{stats.averageSpeed?.toFixed(1) || '0.0'} km/h</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Points Recorded</StatLabel>
                  <StatNumber>{stats.points || 0}</StatNumber>
                </Stat>
              </SimpleGrid>

              <Box>
                <Text fontWeight="bold" mb={2}>Start Location</Text>
                <Text>{stats.startAddress || 'Unknown location'}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>End Location</Text>
                <Text>{stats.endAddress || 'Unknown location'}</Text>
              </Box>

              <Box height="300px" ref={summaryMapContainerRef} />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onSave}>
              Save Trip
            </Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }

  return (
    <ChakraProvider>
      <Container maxW="container.md" py={10}>
        <Box textAlign="center" mb={8}>
          <Heading as="h1" size="2xl" mb={2} color="teal.400">
            Travel Tracker
          </Heading>
          <Text fontSize="lg" color="gray.500">
            Record, view, and relive your journeys.
          </Text>
        </Box>
        {geoError && (
          <Alert status="error" mb={4}>
            <AlertIcon />
            Geolocation error: {geoError}
          </Alert>
        )}
        <Box p={2} mb={2} bg="gray.100" borderRadius="md">
          <Text fontSize="xs" color="gray.600">Debug: Route array ({route.length} points)</Text>
          <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 100, overflowY: 'auto' }}>{JSON.stringify(route, null, 2)}</pre>
        </Box>
        <VStack spacing={6} align="stretch">
          <Box p={6} borderWidth={1} borderRadius="lg" bg="gray.50">
            <HStack justify="space-between">
              <Button colorScheme="teal" onClick={handleStart} isDisabled={isTracking}>
                Start Trip
              </Button>
              <Button colorScheme="red" onClick={handleStop} isDisabled={!isTracking}>
                Stop Trip
              </Button>
            </HStack>
            <Divider my={4} />
            {isTracking && (
              <Box textAlign="center">
                <Text fontSize="md" color="teal.600">Tracking in progress...</Text>
                <Text>Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s</Text>
                <Text>Points recorded: {route.length}</Text>
              </Box>
            )}
            {!isTracking && route.length > 0 && (
              <Box textAlign="center">
                <Text color="gray.600">Trip recorded with {route.length} points.</Text>
              </Box>
            )}
          </Box>
          <Box p={0} borderWidth={1} borderRadius="lg" bg="gray.50" minH="400px" height="400px" overflow="hidden" position="relative">
            {mapLoading && (
              <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="gray.50">
                <Spinner size="xl" color="teal.500" />
              </Center>
            )}
            {mapError && (
              <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="gray.50">
                <Alert status="error">
                  <AlertIcon />
                  {mapError}
                </Alert>
              </Center>
            )}
            {isGettingLocation && (
              <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="gray.50" zIndex={1}>
                <VStack>
                  <Spinner size="xl" />
                  <Text>Getting your location...</Text>
                  <Text fontSize="sm" color="gray.500">
                    Attempt {locationRetryCountRef.current + 1} of {MAX_RETRIES}
                  </Text>
                </VStack>
              </Center>
            )}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', visibility: mapLoading ? 'hidden' : 'visible' }} />
            {!isTracking && route.length === 0 && !mapLoading && !mapError && (
              <Text color="gray.400" textAlign="center" mt={4}>No location points recorded yet. Start a trip to begin tracking.</Text>
            )}
          </Box>
          <Box p={6} borderWidth={1} borderRadius="lg" bg="gray.50">
            <Heading as="h2" size="md" mb={4} color="teal.600">Trip History</Heading>
            {loadingTrips ? (
              <Flex justify="center" align="center" minH="80px"><Spinner /></Flex>
            ) : trips.length === 0 ? (
              <Text color="gray.400">No trips recorded yet.</Text>
            ) : (
              <List spacing={3}>
                {trips.map(trip => (
                  <ListItem key={trip.id} p={3} borderWidth={1} borderRadius="md" bg="white" _hover={{ bg: 'gray.50', cursor: 'pointer' }}>
                    <HStack justify="space-between">
                      <Box onClick={() => handleShowTrip(trip)}>
                        <Text fontWeight="bold">{trip.name} {trip.isFavorite && <StarIcon color="yellow.400" />}</Text>
                        <Text fontSize="sm" color="gray.500">{trip.date}</Text>
                      </Box>
                      <IconButton icon={<StarIcon />} aria-label="Favorite" colorScheme={trip.isFavorite ? 'yellow' : 'gray'} variant={trip.isFavorite ? 'solid' : 'outline'} isRound size="sm" isLoading={favoriteLoading} onClick={() => handleFavorite(trip)} />
                    </HStack>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </VStack>
        <TripSummaryModal isOpen={showSummary} onClose={() => setShowSummary(false)} stats={tripStats} onSave={() => handleSaveTrip({ name: tripName, notes: tripNotes, route, startTime, stats: tripStats })} />
        <Modal isOpen={showTripModal} onClose={() => setShowTripModal(false)} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{selectedTrip?.name}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text fontSize="sm" color="gray.500" mb={2}>Date: {selectedTrip?.date}</Text>
              <Text mb={2}><b>Notes:</b> {selectedTrip?.notes || <span style={{ color: '#aaa' }}>No notes</span>}</Text>
              <Box mb={2}><b>Points:</b> {selectedTrip?.route?.length}</Box>
              <Box mb={2} height="300px" borderWidth={1} borderRadius="md" overflow="hidden">
                <div ref={tripMapRef} style={{ width: '100%', height: '100%' }} />
              </Box>
              <Box>
                <Heading as="h4" size="sm" mb={1}>Timestamps</Heading>
                <Box maxH="100px" overflowY="auto" bg="gray.50" p={2} borderRadius="md">
                  {selectedTrip?.route?.map((p, i) => (
                    <Text key={i} fontSize="xs">{p.timestamp} ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})</Text>
                  ))}
                </Box>
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setShowTripModal(false)} variant="ghost">Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        <Modal isOpen={showSave} onClose={() => setShowSave(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Save Trip</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <FormControl mb={3} isRequired>
                <FormLabel>Trip Name</FormLabel>
                <Input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="e.g. France to Germany" />
              </FormControl>
              <FormControl mb={3}>
                <FormLabel>Notes</FormLabel>
                <Textarea value={tripNotes} onChange={e => setTripNotes(e.target.value)} placeholder="Trip notes (optional)" />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="teal" mr={3} onClick={() => handleSaveTrip({ name: tripName, notes: tripNotes, route, startTime, stats: tripStats })} isLoading={saving} isDisabled={!tripName}>
                Save
              </Button>
              <Button onClick={() => setShowSave(false)} variant="ghost">Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Container>
    </ChakraProvider>
  )
}

export default App
