import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { H1, Lead } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Wine } from 'lucide-react';
import { LoginPage } from '@/pages/login';
import { SignupPage } from '@/pages/signup';
import { VerifyEmailPage } from '@/pages/verify-email';
import { RequestResetPage } from '@/pages/request-reset';
import { ResetPasswordPage } from '@/pages/reset-password';
import { ProfilePage } from '@/pages/profile';
import { DashboardPage } from '@/pages/dashboard';
import { ProtectedRoute } from '@/components/auth/protected-route';

function App() {
  const navigate = useNavigate();
  
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-background">
            <Section spacing="lg">
              <Container>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <Wine className="w-10 h-10" />
                  </div>
                  <H1>Spoiled Vine</H1>
                  <Lead className="max-w-[42rem] mx-auto">
                    Your premier destination for discovering and reviewing the
                    world's finest wines. Join our community of wine enthusiasts
                    and share your tasting experiences.
                  </Lead>
                  <div className="flex gap-4 mt-8">
                    <Button size="lg" onClick={() => navigate('/login')}>Get Started</Button>
                    <Button size="lg" variant="outline">
                      Learn More
                    </Button>
                  </div>
                </div>
              </Container>
            </Section>
          </div>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/request-reset" element={<RequestResetPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;