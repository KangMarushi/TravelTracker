import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Select,
  Heading,
  Text,
  Alert,
  AlertIcon,
  Spinner
} from '@chakra-ui/react';
import { saveSettings } from '../utils/geolocation';

const TripControls = ({
  isTracking,
  recordingMode,
  recordingInterval,
  recordingDistance,
  currentAddress,
  isLoadingAddress,
  geoError,
  route,
  elapsed,
  onStart,
  onStop,
  onRecordingModeChange,
  onIntervalChange,
  onDistanceChange
}) => {
  const handleRecordingModeChange = (mode) => {
    onRecordingModeChange(mode);
    saveSettings({
      recordingMode: mode,
      recordingInterval,
      recordingDistance
    });
  };

  const handleIntervalChange = (e) => {
    const value = Number(e.target.value);
    onIntervalChange(value);
    saveSettings({
      recordingMode,
      recordingInterval: value,
      recordingDistance
    });
  };

  const handleDistanceChange = (e) => {
    const value = Number(e.target.value);
    onDistanceChange(value);
    saveSettings({
      recordingMode,
      recordingInterval,
      recordingDistance: value
    });
  };

  return (
    <VStack spacing={4} align="stretch">
      {!isTracking && (
        <Box p={4} borderWidth={1} borderRadius="md" bg="white" boxShadow="sm">
          <VStack spacing={4} align="stretch">
            <Heading size="sm" color="gray.700">Recording Settings</Heading>
            <HStack spacing={4}>
              <Button
                colorScheme={recordingMode === 'time' ? 'blue' : 'gray'}
                onClick={() => handleRecordingModeChange('time')}
                size="md"
                flex={1}
              >
                Time-based
              </Button>
              <Button
                colorScheme={recordingMode === 'distance' ? 'blue' : 'gray'}
                onClick={() => handleRecordingModeChange('distance')}
                size="md"
                flex={1}
              >
                Distance-based
              </Button>
            </HStack>
            
            {recordingMode === 'time' ? (
              <Select
                value={recordingInterval}
                onChange={handleIntervalChange}
                size="md"
                bg="white"
              >
                <option value={10}>Every 10 seconds</option>
                <option value={20}>Every 20 seconds</option>
                <option value={30}>Every 30 seconds</option>
                <option value={45}>Every 45 seconds</option>
                <option value={60}>Every 60 seconds</option>
              </Select>
            ) : (
              <Select
                value={recordingDistance}
                onChange={handleDistanceChange}
                size="md"
                bg="white"
              >
                <option value={50}>Every 50 meters</option>
                <option value={100}>Every 100 meters</option>
                <option value={200}>Every 200 meters</option>
                <option value={500}>Every 500 meters</option>
              </Select>
            )}
          </VStack>
        </Box>
      )}

      {currentAddress && isTracking && (
        <Box p={4} borderWidth={1} borderRadius="md" bg="blue.50" boxShadow="sm">
          <HStack justify="space-between">
            <Text fontWeight="bold" color="blue.700">Current Location:</Text>
            {isLoadingAddress ? (
              <Spinner size="sm" color="blue.500" />
            ) : (
              <Text color="blue.700">{currentAddress}</Text>
            )}
          </HStack>
        </Box>
      )}

      <HStack justify="center" spacing={4}>
        {!isTracking ? (
          <Button
            colorScheme="blue"
            onClick={onStart}
            size="lg"
            width="200px"
            boxShadow="md"
          >
            Start Trip
          </Button>
        ) : (
          <Button
            colorScheme="red"
            onClick={onStop}
            size="lg"
            width="200px"
            boxShadow="md"
          >
            Stop Trip
          </Button>
        )}
      </HStack>

      {geoError && (
        <Alert status="error" variant="subtle" borderRadius="md">
          <AlertIcon />
          {geoError}
        </Alert>
      )}

      {route.length > 0 && (
        <Box p={4} borderWidth={1} borderRadius="md" bg="white" boxShadow="sm">
          <VStack spacing={2} align="stretch">
            <Text fontWeight="medium" color="gray.700">Trip Progress</Text>
            <Text color="gray.600">Points recorded: {route.length}</Text>
            <Text color="gray.600">Elapsed time: {elapsed} seconds</Text>
          </VStack>
        </Box>
      )}
    </VStack>
  );
};

export default TripControls; 