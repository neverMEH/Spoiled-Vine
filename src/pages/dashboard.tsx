import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Container } from '@/components/layout/container';
import { Section } from '@/components/layout/section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Settings, LogOut, HelpCircle } from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <Container>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold">Welcome to Spoiled Vine</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <Section>
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Your comprehensive platform for Amazon review analysis
            </p>

            <div className="flex justify-center">
              <Button className="px-8" onClick={() => navigate('/reviews/gather')}>
                Get Started →
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Review Gathering */}
              <Card className="relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Search className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Review Gathering</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Search and analyze Amazon product reviews
                  </p>
                </CardContent>
              </Card>

              {/* Analytics Dashboard */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 3v18h18" />
                      <path d="M18 9l-5 5-2-2-3 3" />
                    </svg>
                    <CardTitle className="text-lg">Analytics Dashboard</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    View insights and trends from your reviews
                  </p>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Settings className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Settings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Configure your preferences and account settings
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Getting Started Section */}
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Start Gathering Reviews</h3>
                    <p className="text-sm text-muted-foreground">
                      Navigate to Review Gathering and enter Amazon ASINs to analyze product reviews
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium">View Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                      Check the Analytics Dashboard for insights and trends from your gathered reviews
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium">Configure Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Customize your experience by adjusting your preferences in Settings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Announcements Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Announcements</CardTitle>
                  <span className="text-sm text-muted-foreground">Latest updates and news</span>
                </div>
              </CardHeader>
              <CardContent className="min-h-[100px] flex items-center justify-center text-muted-foreground">
                No announcements available
              </CardContent>
            </Card>

            {/* Need Help Section */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <CardTitle>Documentation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Learn how to use Spoiled Vine effectively with our comprehensive documentation.
                  </p>
                  <Button variant="outline" className="w-full">
                    View Documentation
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <CardTitle>Support</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Having issues? Our support team is here to help you resolve any problems.
                  </p>
                  <Button variant="outline" className="w-full">
                    Contact Support →
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </Section>
      </Container>
    </div>
  );
}