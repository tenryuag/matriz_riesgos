import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
          <Card className="w-full max-w-md border-red-200 dark:border-red-900 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl font-bold">Algo salió mal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                La aplicación ha encontrado un error inesperado. Hemos registrado el problema para investigarlo.
              </p>
              
              {import.meta.env.DEV && this.state.error && (
                <div className="mt-4 p-4 bg-muted rounded-md text-left text-xs font-mono overflow-auto max-h-40">
                  <p className="font-bold text-red-500 mb-2">{this.state.error.toString()}</p>
                  <pre className="text-muted-foreground">{this.state.errorInfo?.componentStack}</pre>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-center">
                <Button onClick={this.handleReload} className="w-full sm:w-auto gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Recargar Página
                </Button>
                <Button variant="outline" onClick={this.handleHome} className="w-full sm:w-auto gap-2">
                  <Home className="w-4 h-4" />
                  Ir al Inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default GlobalErrorBoundary;
