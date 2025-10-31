

import React, { useState } from "react";
import { Eye, EyeOff } from 'react-feather';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  Plus,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon,
  Globe,
  ArrowRight,
  Shield,
  Lock,
  CheckCircle,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageProvider, useLanguage } from '@/components/LanguageContext';

const LoginScreen = ({ theme, toggleTheme }) => {
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await User.login(email, password);
      window.location.reload();
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: t('loginFeature1Title'),
      description: t('loginFeature1Description')
    },
    {
      icon: Lock,
      title: t('loginFeature2Title'),
      description: t('loginFeature2Description')
    },
    {
      icon: CheckCircle,
      title: t('loginFeature3Title'),
      description: t('loginFeature3Description')
    }
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, var(--accent), ${theme === 'light' ? '#B8860B' : '#8B7355'})`
          }}
        />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
          <div className="w-32 h-32 mb-8 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
            <AlertTriangle className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-title text-white mb-6">{t('riskManagement')}</h1>
          <p className="text-xl text-white/90 mb-12 max-w-md">
            {t('loginHeroSubtitle')}
          </p>
          <div className="grid gap-6 max-w-sm">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-subtitle text-sm mb-1">{feature.title}</h3>
                  <p className="text-white/80 text-xs">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-6 glass rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-2xl font-title text-foreground mb-2">{t('riskManagement')}</h1>
            <p className="text-muted">{t('professionalManagement')}</p>
          </div>

          {/* Language & Theme Controls */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button 
                onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
                variant="outline" 
                size="sm"
                className="glass hover:border-accent"
              >
                <Globe className="w-4 h-4 mr-2" />
                {language === 'es' ? 'ES' : 'EN'}
              </Button>
              <Button 
                onClick={toggleTheme} 
                variant="outline" 
                size="sm"
                className="glass hover:border-accent"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Login Content */}
          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-title text-foreground mb-3">{t('loginWelcomeTitle')}</h2>
              <p className="text-muted text-lg">{t('loginWelcomeSubtitle')}</p>
            </div>

            {/* Features for Mobile */}
            <div className="lg:hidden space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-4 glass rounded-xl">
                  <div className="w-8 h-8 bg-accent text-accent-foreground rounded-lg flex items-center justify-center">
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-subtitle text-sm text-foreground mb-1">{feature.title}</h3>
                    <p className="text-muted text-xs">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Email and Password Inputs */}
            <div className="space-y-4">
              <input
                type="email"
                placeholder={t('Email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-glass w-full p-3 rounded-xl"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t('Contraseña')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-glass w-full p-3 rounded-xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-black dark:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 py-4 text-lg font-subtitle"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin mr-3" />
                    {t('loginButtonLoading')}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span>{t('loginButton')}</span>
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </div>
                )}
              </Button>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted">
                  {t('loginNoAccount')}{' '}
                  <button
                    onClick={() => navigate('/register')}
                    className="text-accent hover:underline font-subtitle"
                  >
                    {t('loginRegisterLink')}
                  </button>
                </p>
                <p className="text-xs text-muted">
                  {t('loginDisclaimer')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppLayout = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [theme, setTheme] = React.useState("dark");
  const { language, changeLanguage, t } = useLanguage();

  React.useEffect(() => {
    loadUser();
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    setTheme(currentTheme => {
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('app-theme', newTheme);
      return newTheme;
    });
  };

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      console.log("Usuario no autenticado");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await User.logout();
    setUser(null);
  };
  
  const themeStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Avenir+Next:wght@300;400;700&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@700&display=swap');
    
    :root {
      --font-title: 'Frank Ruhl Libre', serif;
      --font-subtitle: 'Avenir Next', sans-serif;
      --font-body: 'Avenir Next', sans-serif;
    }

    .light {
      --background-start: #FAF7F6;
      --background-end: #EFEBE4;
      --foreground: #121212;
      --foreground-muted: rgba(18, 18, 18, 0.7);
      --accent: #DDBF5A;
      --accent-foreground: #121212;
      --card-bg: rgba(255, 255, 255, 0.25);
      --card-border: rgba(18, 18, 18, 0.15);
      --sidebar-bg: rgba(250, 247, 246, 0.3);
      --input-bg: rgba(255, 255, 255, 0.2);
      --shadow: rgba(18, 18, 18, 0.1);
      --popover-foreground: var(--foreground);
      --table-bg: rgba(250, 247, 246, 0.02);
      --table-row-hover: rgba(250, 247, 246, 0.05);
    }

    .dark {
      --background-start: #121212;
      --background-end: #1a1a1a;
      --foreground: #FAF7F6;
      --foreground-muted: rgba(250, 247, 246, 0.7);
      --accent: #DDBF5A;
      --accent-foreground: #121212;
      --card-bg: rgba(250, 247, 246, 0.08);
      --card-border: rgba(221, 191, 90, 0.2);
      --sidebar-bg: rgba(250, 247, 246, 0.05);
      --input-bg: rgba(250, 247, 246, 0.1);
      --shadow: rgba(0, 0, 0, 0.3);
      --popover-foreground: var(--foreground);
      --table-bg: rgba(250, 247, 246, 0.02);
      --table-row-hover: rgba(250, 247, 246, 0.05);
    }

    body, .font-body {
      font-family: var(--font-body);
      font-weight: 300;
      color: var(--foreground);
    }

    .font-title { 
      font-family: var(--font-title); 
      font-weight: 700; 
    }
    .font-subtitle { 
      font-family: var(--font-subtitle); 
      font-weight: 700; 
    }

    .glass {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--card-border);
      box-shadow: 0 8px 32px var(--shadow);
      color: var(--foreground);
    }

    /* Fix for dropdown item text color in all themes */
    .glass [role="option"],
    .glass [role="menuitem"],
    .glass [data-radix-select-item],
    .glass .select-item {
      color: var(--foreground) !important;
    }
    
    .glass [role="option"]:hover,
    .glass [role="menuitem"]:hover,
    .glass [data-radix-select-item]:hover,
    .glass .select-item:hover {
      color: var(--foreground) !important;
      background-color: rgba(221, 191, 90, 0.2) !important;
    }
    
    .glass-darker {
      background: var(--sidebar-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid var(--card-border);
      box-shadow: 0 8px 32px var(--shadow);
    }
    
    .glass-accent {
      background: rgba(221, 191, 90, 0.9);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      border: 1px solid rgba(221, 191, 90, 0.3);
      box-shadow: 0 8px 32px rgba(221, 191, 90, 0.2);
      color: var(--accent-foreground);
    }

    .glass-hover:hover {
      background: rgba(221, 191, 90, 0.15);
      border-color: rgba(221, 191, 90, 0.4);
      box-shadow: 0 12px 40px var(--shadow);
      transform: translateY(-2px);
      transition: all 0.3s ease;
    }

    .text-foreground { color: var(--foreground); }
    .text-muted { color: var(--foreground-muted); }
    .text-accent { color: var(--accent); }

    .input-glass {
      background: var(--input-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--card-border);
      color: var(--foreground);
      box-shadow: inset 0 2px 8px var(--shadow);
    }
    .input-glass::placeholder {
      color: var(--foreground-muted);
    }
    .input-glass:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(221, 191, 90, 0.1), inset 0 2px 8px var(--shadow);
    }

    .card-glass {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--card-border);
      box-shadow: 0 8px 32px var(--shadow);
      border-radius: 1.5rem;
      transition: all 0.3s ease;
    }
    
    .card-glass:hover {
      box-shadow: 0 16px 48px var(--shadow);
      transform: translateY(-4px);
      border-color: rgba(221, 191, 90, 0.3);
    }

    .nav-glass {
      background: rgba(221, 191, 90, 0.1);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      border: 1px solid rgba(221, 191, 90, 0.2);
      box-shadow: 0 4px 16px var(--shadow);
      transition: all 0.3s ease;
    }

    .nav-glass:hover {
      background: rgba(221, 191, 90, 0.2);
      border-color: rgba(221, 191, 90, 0.4);
      transform: translateX(4px);
    }

    .nav-glass.active {
      background: var(--accent);
      color: var(--accent-foreground);
      box-shadow: 0 8px 24px rgba(221, 191, 90, 0.3);
      border-color: var(--accent);
    }

    .button-glass {
      background: rgba(221, 191, 90, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(221, 191, 90, 0.3);
      box-shadow: 0 4px 16px rgba(221, 191, 90, 0.2);
      color: var(--accent-foreground);
      transition: all 0.3s ease;
    }

    .button-glass:hover {
      background: var(--accent);
      box-shadow: 0 8px 24px rgba(221, 191, 90, 0.3);
      transform: translateY(-2px);
    }

    /* Estilos específicos para tablas */
    .table-glass {
      background: var(--table-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .table-glass tbody tr:hover {
      background: var(--table-row-hover) !important;
    }
  `;

  if (loading) {
    return (
      <div className={`min-h-screen ${theme} flex items-center justify-center`}>
        <div 
          className="min-h-screen w-full"
          style={{
            background: `radial-gradient(ellipse at top, ${theme === 'light' ? 'rgba(221, 191, 90, 0.3)' : 'rgba(221, 191, 90, 0.1)'}, transparent), linear-gradient(135deg, var(--background-start), var(--background-end))`
          }}
        >
          <style>{themeStyles}</style>
          <div className="flex items-center justify-center min-h-screen">
            <div className="glass rounded-2xl p-8">
              <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${theme} font-body`}>
        <div 
          className="min-h-screen"
          style={{
            background: `linear-gradient(135deg, var(--background-start), var(--background-end))`
          }}
        >
          <style>{themeStyles}</style>
          <LoginScreen theme={theme} toggleTheme={toggleTheme} />
        </div>
      </div>
    );
  }

  const navigationItems = [
    { name: t("dashboard"), href: createPageUrl("Dashboard"), icon: LayoutDashboard },
    { name: t("departments"), href: createPageUrl("Departments"), icon: Building2 },
    { name: t("allRisks"), href: createPageUrl("AllRisks"), icon: ShieldCheck },
    { name: t("addRisk"), href: createPageUrl("AddRisk"), icon: Plus },
    { name: t("invitationCodes"), href: createPageUrl("InvitationCodes"), icon: Ticket }
  ];

  return (
    <div className={`min-h-screen font-body ${theme}`}>
      <div 
        className="min-h-screen"
        style={{
          background: `radial-gradient(ellipse at top left, ${theme === 'light' ? 'rgba(221, 191, 90, 0.15)' : 'rgba(221, 191, 90, 0.05)'}, transparent), radial-gradient(ellipse at bottom right, ${theme === 'light' ? 'rgba(221, 191, 90, 0.1)' : 'rgba(221, 191, 90, 0.03)'}, transparent), linear-gradient(135deg, var(--background-start), var(--background-end))`
        }}
      >
        <style>{themeStyles}</style>

        {/* Mobile Menu Button */}
        <div className="lg:hidden fixed top-6 left-6 z-50">
          <Button onClick={() => setSidebarOpen(!sidebarOpen)} size="icon" className="glass">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-40 w-80 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <div className="h-full glass-darker p-8 flex flex-col">
            <div className="flex items-center gap-4 mb-12">
              <div>
                <h1 className="font-title text-xl text-foreground">Gestión del Riesgo</h1>
                <p className="text-sm text-accent">{t('professionalManagement')}</p>
              </div>
            </div>

            <nav className="space-y-3 flex-grow">
              {navigationItems.map((item) => {
                const currentPath = location.pathname;
                const itemPath = item.href;
                const isActive = currentPath === itemPath;
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={(e) => {
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
                      isActive ? 'nav-glass active' : 'nav-glass'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-subtitle text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            
            {/* User & Controls Section */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button 
                  onClick={toggleTheme} 
                  variant="ghost" 
                  className="w-full justify-start nav-glass"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4 mr-3" /> : <Sun className="w-4 h-4 mr-3" />}
                  <span className="font-subtitle text-sm">
                    {theme === 'light' ? t('darkMode') : t('lightMode')}
                  </span>
                </Button>
                <Button 
                  onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
                  variant="ghost" 
                  size="icon"
                  className="nav-glass"
                >
                  <Globe className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="glass rounded-2xl p-4">
                <h3 className="font-subtitle text-sm text-foreground mb-1">{user.full_name}</h3>
                <p className="text-xs text-accent truncate mb-3">{user.email}</p>
                <span className="inline-block px-3 py-1 text-xs rounded-full glass border border-accent/30 text-accent">
                  {user.role}
                </span>
              </div>
              
              <Button 
                onClick={handleLogout} 
                variant="ghost" 
                className="w-full justify-start nav-glass text-foreground"
              >
                <LogOut className="w-4 h-4 mr-3" />
                <span className="font-subtitle text-sm">{t('logout')}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden" 
            onClick={() => setSidebarOpen(false)} 
          />
        )}

        {/* Main Content */}
        <div className="lg:pl-80">
          <main className="p-6 lg:p-12">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function LayoutWrapper({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <AppLayout currentPageName={currentPageName}>
        {children}
      </AppLayout>
    </LanguageProvider>
  );
}

