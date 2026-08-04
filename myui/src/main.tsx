import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/lib/theme';
import { VoiceProvider } from '@/lib/voice';
import { AuthProvider } from '@/lib/auth';
import { ChatProvider } from '@/lib/chat-store';
import { applyUiConfig } from '@/lib/ui-config';
import './index.css';

// Push the UI knobs (motion speed, fonts) into CSS vars before first paint.
applyUiConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <VoiceProvider>
        <AuthProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </AuthProvider>
      </VoiceProvider>
    </ThemeProvider>
  </StrictMode>,
);
