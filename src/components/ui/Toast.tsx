import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: {
    container: 'bg-white admin-dark:bg-gray-800 border-l-4 border-green-500 shadow-lg',
    icon: 'text-green-500',
    title: 'text-green-800 admin-dark:text-green-200',
    message: 'text-green-600 admin-dark:text-green-300',
  },
  error: {
    container: 'bg-white admin-dark:bg-gray-800 border-l-4 border-red-500 shadow-lg',
    icon: 'text-red-500',
    title: 'text-red-800 admin-dark:text-red-200',
    message: 'text-red-600 admin-dark:text-red-300',
  },
  warning: {
    container: 'bg-white admin-dark:bg-gray-800 border-l-4 border-yellow-500 shadow-lg',
    icon: 'text-yellow-500',
    title: 'text-yellow-800 admin-dark:text-yellow-200',
    message: 'text-yellow-600 admin-dark:text-yellow-300',
  },
  info: {
    container: 'bg-white admin-dark:bg-gray-800 border-l-4 border-blue-500 shadow-lg',
    icon: 'text-blue-500',
    title: 'text-blue-800 admin-dark:text-blue-200',
    message: 'text-blue-600 admin-dark:text-blue-300',
  },
};

export default function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const Icon = toastIcons[type];
  const styles = toastStyles[type];

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  return (
    <div
      className={`transform transition-all duration-300 ease-in-out ${
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${styles.container} rounded-lg p-4 mb-3 max-w-sm w-full border border-gray-200 admin-dark:border-gray-600`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`w-5 h-5 ${styles.icon}`} />
          </div>
          
          <div className="ml-3 flex-1">
            <h4 className={`text-sm font-semibold ${styles.title}`}>
              {title}
            </h4>
            {message && (
              <p className={`text-sm mt-1 ${styles.message}`}>
                {message}
              </p>
            )}
          </div>

          <button
            onClick={handleClose}
            className="ml-4 flex-shrink-0 text-gray-400 admin-dark:text-gray-500 hover:text-gray-600 admin-dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
