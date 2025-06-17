import React from 'react';
import { Box, Heading, Text, Button, VStack, useToast } from '@chakra-ui/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log error to your error reporting service here
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={8} maxW="container.md" mx="auto">
          <VStack spacing={6} align="stretch">
            <Heading size="lg" color="red.500">Something went wrong</Heading>
            <Text color="gray.600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Button
              colorScheme="blue"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 