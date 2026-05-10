import React from 'react';
import { registerRootComponent } from 'expo';
import App from './App';
import { ErrorBoundary } from './App';

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

registerRootComponent(Root);
