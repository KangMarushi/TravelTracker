import React, { useState } from 'react';
import { ChakraProvider, Container, VStack, Heading, Alert, AlertIcon, useToast, Box } from '@chakra-ui/react';
import TripControls from './components/TripControls';
import MapContainer from './components/MapContainer';
import TripSummaryModal from './components/TripSummaryModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useTripTracker } from './hooks/useTripTracker';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const toast = useToast();
  const [showSummary, setShowSummary] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    isTracking,
    isPaused,
    recordingMode,
    recordingInterval,
    recordingDistance,
    currentLocation,
    currentAddress,
    isLoadingAddress,
    geoError,
    route,
    elapsed,
    tripStats,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setRecordingMode,
    setRecordingInterval,
    setRecordingDistance,
    error: trackingError
  } = useTripTracker();

  const handleStop = () => {
    stopTracking();
    setShowSummary(true);
  };

  const handleSaveTrip = async (tripData) => {
    setIsSaving(true);
    try {
      // Log the data being sent to Supabase
      console.log('Saving trip data:', tripData);

      const now = new Date().toISOString();
      const tripToSave = {
        name: tripData.name || 'Untitled Trip',
        notes: tripData.notes || '',
        route: tripData.route || [],
        createdat: now,
        updatedat: now,
        isfavorite: false,
        avgspeed: tripData.stats?.averageSpeed || 0,
        distance: tripData.stats?.distance || 0,
        duration: tripData.stats?.duration || 0,
        endPoint: tripData.stats?.endPoint || null,
        endTime: tripData.stats?.endTime || null,
        startPoint: tripData.stats?.startPoint || null,
        startTime: tripData.stats?.startTime || null,
        stats: tripData.stats || {}
      };

      console.log('Formatted trip data:', tripToSave);

      const { data, error } = await supabase
        .from('trips')
        .insert([tripToSave])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Saved trip data:', data);

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
        description: error.message || 'Failed to save trip. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapError = (error) => {
    console.error('Map error:', error);
    setMapError(error.message);
    toast({
      title: 'Map Error',
      description: error.message,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <ErrorBoundary>
      <ChakraProvider>
        <Container maxW="container.xl" h="100vh" p={0}>
          <VStack h="100%" spacing={0}>
            <Box w="100%" p={4} bg="white" boxShadow="sm">
              <Heading size="lg">Travel Tracker</Heading>
            </Box>

            {trackingError && (
              <Alert status="error">
                <AlertIcon />
                {trackingError}
              </Alert>
            )}

            <Box flex="1" w="100%" position="relative">
              <div className="map-container" style={{ height: '100%', width: '100%' }}>
                <MapContainer
                  isTracking={isTracking}
                  currentLocation={currentLocation}
                  route={route}
                  onMapError={handleMapError}
                />
              </div>
              <Box
                position="absolute"
                top={4}
                right={4}
                zIndex={1}
                bg="white"
                p={4}
                borderRadius="md"
                boxShadow="md"
              >
                <TripControls
                  isTracking={isTracking}
                  onStart={startTracking}
                  onStop={handleStop}
                  currentLocation={currentLocation}
                />
              </Box>
            </Box>
          </VStack>

          <TripSummaryModal
            isOpen={showSummary}
            onClose={() => setShowSummary(false)}
            stats={tripStats}
            onSave={handleSaveTrip}
            isSaving={isSaving}
          />
        </Container>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

export default App;
