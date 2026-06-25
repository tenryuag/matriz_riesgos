import React from 'react';
import { AlertTriangle, RefreshCw, Home, LogOut } from 'lucide-react';
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

  // Limpia la sesión de Supabase y los datos locales que pudieran estar
  // corruptos, y vuelve al login. Rompe el bucle de "recargar y volver a
  // fallar" cuando el crash viene de una sesión/estado dañado en el navegador.
  handleClearSession = () => {
    try {
      Object.keys(window.localStorage).forEach((key) => {
        // Tokens de sesión de Supabase (sb-*) + nuestras marcas internas.
        if (key.startsWith('sb-') || key === 'last_activity') {
          window.localStorage.removeItem(key);
        }
      });
      window.sessionStorage.clear();
    } catch (_) {
      // storage no disponible; continuar al redirect de todos modos.
    }
    window.location.assign('/');
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

              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  ¿El problema persiste al recargar?
                </p>
                <Button
                  variant="ghost"
                  onClick={this.handleClearSession}
                  className="w-full sm:w-auto gap-2 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión y volver al login
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
