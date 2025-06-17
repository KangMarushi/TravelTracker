import React, { useState } from 'react';
import { ChakraProvider, Container, VStack, Heading, Alert, AlertIcon, useToast } from '@chakra-ui/react';
import TripControls from './components/TripControls';
import MapContainer from './components/MapContainer';
import TripSummaryModal from './components/TripSummaryModal';
import ErrorBoundary from './components/ErrorBoundary';
import useTripTracker from './hooks/useTripTracker';
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
    setRecordingDistance
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

      const tripToSave = {
        name: tripData.name,
        notes: tripData.notes,
        stats: tripData.stats,
        route: tripData.route, // Fix: Use tripData.route instead of tripData.stats.route
        createdat: new Date().toISOString(),
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
        <div className="app-container">
          <Container maxW="container.xl" py={4} height="100vh" display="flex" flexDirection="column">
            <VStack spacing={4} align="stretch" flex="1" minH="0">
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

              <div className="map-container" style={{ flex: 1, minHeight: '400px' }}>
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
