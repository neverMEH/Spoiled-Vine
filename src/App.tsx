import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { H1, Lead } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { Wine } from 'lucide-react';
import { LoginPage } from '@/pages/login';

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
    </Routes>
  );
}

export default App;