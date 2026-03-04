import { forwardRef } from 'react';

export const Input = forwardRef(({ 
  label,
  error,
  className = '',
  ...props 
}, ref) => {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <input
        ref={ref}
        className={`form-input ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
