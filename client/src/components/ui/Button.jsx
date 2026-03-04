import { forwardRef } from 'react';

export const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  loading = false,
  className = '',
  ...props 
}, ref) => {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner" />
      ) : children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
