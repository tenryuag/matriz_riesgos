import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/api/entities";
import { Eye, EyeOff } from 'react-feather';
import {
  AlertTriangle,
  ArrowRight,
  Shield,
  Lock,
  CheckCircle,
  Sun,
  Moon,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageProvider, useLanguage } from '@/components/LanguageContext';

const UpdatePasswordScreen = ({ theme, toggleTheme }) => {
  const { language, changeLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError(t('registerPasswordTooShort') || 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('registerPasswordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await User.updatePassword(password);
      setSuccess(t('passwordUpdatedSuccess') || 'Password updated successfully');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Update password error:', error);
      setError(t('updatePasswordError') || 'Error updating password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: t('loginFeature1Title') || 'Secure Access',
      description: t('loginFeature1Description') || 'Your data is protected with enterprise-grade security.'
    },
    {
      icon: Lock,
      title: t('loginFeature2Title') || 'Encrypted',
      description: t('loginFeature2Description') || 'End-to-end encryption for all sensitive information.'
    },
    {
      icon: CheckCircle,
      title: t('loginFeature3Title') || 'Compliant',
      description: t('loginFeature3Description') || 'Fully compliant with international risk standards.'
    }
  ];

  // Estilos del tema (igual que en Layout.jsx / Register.jsx)
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
    }

    .dark {
      --background-start: #121212;
      --background-end: #1a1a1a;
      --foreground: #FAF7F6;
      --foreground-muted: rgba(250, 247, 246, 0.7);
      --accent: #DDBF5A;
      --accent-foreground: #121212;
      --card-bg: rgba(250, 247, 246, 0.12);
      --card-border: rgba(221, 191, 90, 0.3);
      --sidebar-bg: rgba(250, 247, 246, 0.05);
      --input-bg: rgba(250, 247, 246, 0.1);
      --shadow: rgba(0, 0, 0, 0.3);
    }

    .font-body { font-family: var(--font-body); }
    .font-title { font-family: var(--font-title); }
    .font-subtitle { font-family: var(--font-subtitle); }

    .text-foreground { color: var(--foreground); }
    .text-muted { color: var(--foreground-muted); }
    .text-accent { color: var(--accent); }

    .glass {
      background: var(--card-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--card-border);
    }

    .input-glass {
      background: var(--input-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--card-border);
      color: var(--foreground);
    }

    .input-glass::placeholder {
      color: var(--foreground-muted);
    }

    .input-glass:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(221, 191, 90, 0.1);
    }

    /* Estilos específicos para botones de tema e idioma */
    .theme-button {
      transition: all 0.2s ease;
    }

    .theme-button:hover {
      background: var(--card-bg) !important;
      border-color: var(--accent) !important;
      color: var(--foreground) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(221, 191, 90, 0.2);
    }

    .theme-button:active {
      transform: translateY(0);
    }
  `;

  return (
    <div className={`min-h-screen ${theme} font-body`}>
      <div
        className="min-h-screen"
        style={{
          background: `linear-gradient(135deg, var(--background-start), var(--background-end))`
        }}
      >
        <style>{themeStyles}</style>
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
              <h1 className="text-5xl font-title text-white mb-6">{t('riskManagement') || 'Gestión del Riesgo'}</h1>
              <p className="text-xl text-white/90 mb-12 max-w-md">
                {t('loginHeroSubtitle') || 'Platform for the integral management of corporate risks.'}
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

          {/* Right Panel - Update Password Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
            <div className="w-full max-w-md space-y-8">
              {/* Mobile Logo */}
              <div className="lg:hidden text-center mb-12">
                <div className="w-20 h-20 mx-auto mb-6 glass rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-accent" />
                </div>
                <h1 className="text-2xl font-title text-foreground mb-2">{t('riskManagement') || 'Gestión del Riesgo'}</h1>
                <p className="text-muted">{t('professionalManagement') || 'Professional Management'}</p>
              </div>

              {/* Language & Theme Controls */}
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
                    variant="outline"
                    size="sm"
                    className="glass text-foreground border-2 theme-button"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {language === 'es' ? 'ES' : 'EN'}
                  </Button>
                  <Button
                    onClick={toggleTheme}
                    variant="outline"
                    size="sm"
                    className="glass text-foreground border-2 theme-button"
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Form Content */}
              <div className="space-y-6">
                <div className="text-center lg:text-left">
                  <h2 className="text-3xl font-title text-foreground mb-3">{t('updatePasswordTitle') || 'Set New Password'}</h2>
                  <p className="text-muted text-lg">{t('updatePasswordSubtitle') || 'Please enter your new password below.'}</p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
                    {success}
                  </div>
                )}

                {/* Form Inputs */}
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t('Contraseña') || 'Password'}
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
                  
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t('registerConfirmPassword') || 'Confirm Password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-glass w-full p-3 rounded-xl pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-black dark:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <Button
                    onClick={handleUpdatePassword}
                    disabled={isLoading || success}
                    className="w-full bg-accent text-[#121212] dark:text-white hover:bg-accent/90 py-4 text-lg font-subtitle"
                    size="lg"
                  >
                     {isLoading ? (
                      <div className="flex items-center">
                        <div className="w-5 h-5 border-2 border-white border-t-gray-300 rounded-full animate-spin mr-3" />
                        {t('updating') || 'Updating...'}
                      </div>
                    ) : success ? (
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <span>{t('updated') || 'Updated'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span>{t('updatePassword') || 'Update Password'}</span>
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper component with LanguageProvider
const UpdatePassword = ({ theme, toggleTheme }) => {
  return (
    <LanguageProvider>
      <UpdatePasswordScreen theme={theme} toggleTheme={toggleTheme} />
    </LanguageProvider>
  );
};

export default UpdatePassword;
