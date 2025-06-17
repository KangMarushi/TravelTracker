import React, { useState, useEffect } from 'react';
import { ChakraProvider, Container, Heading, VStack, Alert, AlertIcon, useToast } from '@chakra-ui/react';
import { useTripTracker } from './hooks/useTripTracker';
import { loadSettings, getAddressFromCoordinates } from './utils/geolocation';
import MapContainer from './components/MapContainer';
import TripControls from './components/TripControls';
import TripSummaryModal from './components/TripSummaryModal';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './supabaseClient';

function App() {
  const toast = useToast();
  // Load saved settings
  const savedSettings = loadSettings();
  
  // State management
  const [recordingMode, setRecordingMode] = useState(savedSettings.recordingMode);
  const [recordingInterval, setRecordingInterval] = useState(savedSettings.recordingInterval);
  const [recordingDistance, setRecordingDistance] = useState(savedSettings.recordingDistance);
  const [currentAddress, setCurrentAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Use the trip tracker hook
  const {
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
  } = useTripTracker({
    recordingMode,
    recordingInterval,
    recordingDistance,
    onError: (error) => {
      setGeoError(error.message);
      toast({
        title: 'Location Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  });

  // Update address when location changes
  useEffect(() => {
    if (currentLocation) {
      setIsLoadingAddress(true);
      getAddressFromCoordinates(currentLocation[0], currentLocation[1])
        .then(address => {
          setCurrentAddress(address);
          setIsLoadingAddress(false);
        })
        .catch(error => {
          console.error('Error getting address:', error);
          setCurrentAddress('Location unavailable');
          setIsLoadingAddress(false);
          toast({
            title: 'Address Error',
            description: 'Could not get address for current location',
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
        });
    }
  }, [currentLocation]);

  // Handle trip completion
  const handleStop = () => {
    if (window.confirm('Are you sure you want to stop tracking?')) {
      stopTracking();
      setShowSummary(true);
    }
  };

  // Handle trip save
  const handleSaveTrip = async (tripData) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('trips')
        .insert([
          {
            name: tripData.name,
            notes: tripData.notes,
            stats: tripData.stats,
            route: tripData.stats.route,
            created_at: new Date().toISOString(),
          }
        ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Trip saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setShowSummary(false);
    } catch (error) {
      console.error('Error saving trip:', error);
      toast({
        title: 'Error',
        description: 'Failed to save trip. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle map errors
  const handleMapError = (error) => {
    console.error('Map error:', error);
    setMapError(error.message || 'Error loading map. Please check your internet connection and try again.');
    toast({
      title: 'Map Error',
      description: error.message || 'Error loading map. Please check your internet connection and try again.',
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <ErrorBoundary>
      <ChakraProvider>
        <div className="app-container">
          <Container maxW="container.xl" py={4}>
            <VStack spacing={4} align="stretch">
              <Heading size="lg" color="blue.600">Travel Tracker</Heading>

              {mapError && (
                <Alert status="error" variant="subtle" borderRadius="md">
                  <AlertIcon />
                  {mapError}
                </Alert>
              )}

              <TripControls
                isTracking={isTracking}
                isPaused={isPaused}
                recordingMode={recordingMode}
                recordingInterval={recordingInterval}
                recordingDistance={recordingDistance}
                currentAddress={currentAddress}
                isLoadingAddress={isLoadingAddress}
                geoError={geoError}
                route={route}
                elapsed={elapsed}
                onStart={startTracking}
                onStop={handleStop}
                onPause={pauseTracking}
                onResume={resumeTracking}
                onRecordingModeChange={setRecordingMode}
                onIntervalChange={setRecordingInterval}
                onDistanceChange={setRecordingDistance}
              />

              <div className="map-container">
                <MapContainer
                  isTracking={isTracking}
                  currentLocation={currentLocation}
                  route={route}
                  onMapError={handleMapError}
                />
              </div>
            </VStack>

            <TripSummaryModal
              isOpen={showSummary}
              onClose={() => setShowSummary(false)}
              stats={tripStats}
              onSave={handleSaveTrip}
              isSaving={isSaving}
            />
          </Container>
        </div>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

export default App;
